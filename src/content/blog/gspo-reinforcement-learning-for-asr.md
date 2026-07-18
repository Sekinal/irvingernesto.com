---
title: 'GSPO: Reinforcement Learning for Low-Resource Speech Recognition'
description: 'Teaching Whisper to hear Mexican Indigenous languages with RL. Hand-rolling GSPO around an audio policy, rewarding on negative Character Error Rate, and making real progress on languages every off-the-shelf system fails.'
pubDate: 2026-07-09
tags: ['ASR', 'Reinforcement Learning', 'Whisper', 'Low-resource', 'Nahuatl']
---

Every state-of-the-art speech recognizer can hear Spanish. None of them can hear the languages Spanish landed on top of. Point Whisper, NVIDIA Parakeet or Canary, Meta MMS, or IBM Granite at Mexican Spanish and you get roughly 14% word error rate: usable. Point the exact same models at Nahuatl, or any of the 22 other Indigenous languages of Mexico, and word error rate jumps to 99% or worse. The model is not transcribing. It is guessing in the wrong language.

That gap, 14% versus 99%, is the whole project. It is not a tuning problem. It is a "the training data never existed" problem, spanning 23 languages across six or more language families. This post is about closing part of that gap with reinforcement learning, and about the several ways I nearly fooled myself while doing it.

## First you need a benchmark you cannot cheat

Before touching a model I built the evaluation, because in low-resource work the benchmark is where projects quietly die. If you cannot tell progress from noise, every training run looks like progress.

The result is MEXA, a contamination-resistant ASR benchmark. Two pieces make it hard to game:

- A **private held-out test set** that never ships.
- A **public audio-plus-text fingerprint registry**, so anyone can decontaminate their own training data against the test without ever seeing the test itself. You check whether your clips collide with the fingerprints; you learn nothing about the answers.

The scoring is linguistically aware. A naive normalizer would strip the tone marks and glottal stops that carry meaning in these languages, quietly rewarding a model for mangling them. MEXA's normalization preserves those marks through both WER and CER, so the metric measures the language people actually speak, not a flattened ASCII shadow of it.

## Supervised first, then reinforcement

The base model is `openai/whisper-large-v3-turbo`. The pipeline is two stages.

Stage one is a supervised fine-tune: LoRA through Unsloth, with the hyperparameters found by Optuna rather than by me guessing. The winning configuration used rsLoRA plus DoRA at rank 128. This gets the model into the neighborhood of the languages. It stops guessing in Spanish and starts producing plausible orthography.

Stage two is where it gets interesting: reinforcement learning with GSPO, Group Sequence Policy Optimization ([arXiv 2507.18071](https://arxiv.org/abs/2507.18071)).

## Why I had to hand-roll the trainer

The obvious move is to reach for TRL's `GRPOTrainer` and be done in an afternoon. It does not work, and the reason is structural: every mainstream RL-for-LLM library assumes text in, text out. The policy is a language model, the prompt is tokens, the completion is tokens.

Whisper's input is not tokens. It is audio. The policy conditions on a log-mel spectrogram, samples a transcript, and gets scored against a reference. So the entire trainer had to be rebuilt around an **audio policy**: batching audio, generating groups of candidate transcripts per clip, computing rewards, and pushing the GSPO update, with the encoder in the loop the whole way.

```
for batch of audio clips:
    for each clip:
        sample G candidate transcripts from the policy   # audio -> text
        reward[g] = -CER(candidate[g], reference)        # verifiable, no reward model
    advantages = group_normalize(rewards)                # per-clip baseline
    ratio = exp((logp_theta - logp_old) / len(y))        # sequence-level, length-normalized
    loss = -(ratio * advantages) + beta * KL(policy || sft_anchor)
    step(loss)                                            # lr = 1e-6
```

## The reward is just negative CER, and that is the point

The reward function is negative Character Error Rate against the reference transcript. That is it. No learned reward model, no human preference data. This is RLVR, reinforcement learning from a **verifiable** reward: the reference is ground truth, so the reward is exact and free of the reward-hacking pathologies that plague learned critics.

It also has an elegant side effect. Whisper's worst failure mode on hard audio is hallucination: repetition loops where it emits the same phrase over and over. Under a CER reward those loops punish themselves, because every hallucinated character counts as an insertion error and inflates CER. The model is not told "stop looping." It discovers that looping is expensive.

To keep the policy from drifting off a cliff, there is a KL penalty (the k3 estimator) back to a frozen SFT anchor, and the learning rate is deliberately tiny at 1e-6. RL here is a scalpel, not a hammer.

## GSPO versus GRPO, briefly

The difference from GRPO is the importance ratio. GRPO computes it per token. GSPO computes it once per **sequence**, length-normalized:

```
ratio = exp( (log p_theta(y|x) - log p_old(y|x)) / |y| )
```

For long sequences the token-level product in GRPO accumulates variance and can blow up. The sequence-level, length-normalized ratio is far more stable, which matters when your outputs are full transcripts rather than short answers.

## Results

On the 240-clip MEXA subset, evaluated fairly through faster-whisper:

| Stage | WER | CER |
| --- | --- | --- |
| SFT preview | 68.5 | 30.6 |
| SFT + GSPO | 66.0 | 28.3 |

A net improvement of 2.45 WER from RL alone. The comparison that actually matters is not my own benchmark, it is the gap to what already exists: off-the-shelf systems (Whisper, Parakeet, Canary, MMS, Granite) sit near or above 99% WER on these languages, effectively unusable, and where the next-best measured system lands at 74.3 CER, this one reaches 30.6. The point is not a scoreboard rank on a benchmark I built, it is that the languages were near-untranscribable and now they are not.

The clearest evidence that the CER reward did what it was designed to do: the worst looping language dropped from 100.2 WER to 75.9. That is the hallucination penalty working exactly as predicted, on the language that needed it most.

## The negative result I am keeping in the paper

Here is the part I want to be honest about, because it taught me more than the win did.

I expected fancier reward shaping to help. Composite rewards, and an MGPO variant that biases toward informative examples. Neither beat plain negative-CER GSPO. Not "beat it by a little," did not beat it at all.

The reason is that low-resource ASR difficulty is **bimodal**, not smooth. The easy Spanish clips have a success probability near 1. The near-impossible Indigenous clips have a success probability near 0. In between there is only a thin frontier of clips where the model sometimes succeeds and sometimes fails, and the frontier is where learning signal lives. When I set a 0.5 difficulty threshold to find those frontier clips, roughly 23 of 50 batches had **zero** usable frontier clips. The fancier method was starving. It was engineered to exploit a gradient of difficulty that mostly is not there. Plain GSPO, which does not depend on that structure, kept learning.

The lesson generalizes: sophistication that assumes a smooth difficulty landscape is worse than useless on a bimodal one.

## Two engineering war stories

**The accidentally zero-shot preview.** An earlier preview looked oddly weak, and it took a while to see why: it had been trained on one set of languages and evaluated on a different, non-overlapping set. The model was being graded, zero-shot, on languages it had literally never trained on. Lesson, now written down where I will see it: always confirm that your train and test label or language sets actually intersect before you believe any number.

**The 30-second window.** Evaluation clips run around 60 seconds, but Whisper's attention window is 30. Naively you lose everything past the boundary. The fix is to force-align the transcript to the audio with MMS_FA, then cut on inter-word silences into chunks of at most 28 seconds, preserving the original orthography across the seams so the tone marks and glottal stops survive the split.

## Where this sits

This is part of the broader low-resource line I publish openly on HuggingFace at [Thermostatic](https://huggingface.co/Thermostatic), alongside the translation work. The models get replaced; the benchmark and the datasets are the durable contribution. MEXA exists so that the next person trying to make a speech model hear Nahuatl starts with a number they can trust, and a way to prove they did not cheat to get it.
</invoke>
