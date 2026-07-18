---
title: 'RosettIA: Beating the Task Winners on Spanish to Quechua'
description: 'A supervised NLLB baseline, GSPO reinforcement learning, and MBR decoding reach 46.71 ChrF on Spanish to Chanka Quechua, ahead of the AmericasNLP 2021 and 2023 systems. With the caveats that number deserves.'
pubDate: 2026-07-01
tags: ['NLP', 'Low-resource', 'Quechua', 'Reinforcement Learning', 'Open Source']
---

RosettIA is my open effort on translation for languages that the internet mostly forgot. The result I can put a number on, and the one I am proudest of, is Spanish to Chanka (Ayacucho) Quechua, where the system I built lands ahead of the published task winners on the standard AmericasNLP 2021 benchmark.

I want to show the number and then immediately show its limits, because a single benchmark score is easy to oversell and I would rather you trust the ones I do report.

## The benchmark

Everything below is on the **AmericasNLP 2021** test set for Spanish to Chanka (Ayacucho) Quechua: 1003 sentences, a single reference each, scored with **ChrF** (sacrebleu, word_order=0). ChrF is a character-level F-score, which suits a morphologically rich language like Quechua better than word-level BLEU, because so much meaning lives inside the word.

## The results

| System | ChrF |
| --- | --- |
| Sheffield 2023 (NLLB-3.3B ensemble) | 34.01 |
| Helsinki 2021 (prior task winner) | 39.40 |
| Qwen-9B (ours), greedy | 40.55 |
| NLLB-1.3B (ours), supervised | 42.95 |
| + GSPO reinforcement learning | 45.53 |
| + MBR decoding (single model) | 46.43 |
| Our best system | **46.71** |

The two grey rows are prior published work. Everything below them is mine, and every one of my systems clears both prior task winners on this metric.

## The build-up

The interesting part is not the top number, it is the climb.

A **supervised NLLB-1.3B** fine-tune already reaches 42.95, past both prior winners, which tells you most of the gap to earlier work was data and training discipline, not model scale. A general-purpose **Qwen-9B** with plain greedy decoding hits 40.55 without being a translation model at all, which is its own quiet statement about where open LLMs now sit on low-resource pairs.

Then two techniques stack on top of the supervised model:

- **GSPO reinforcement learning** adds +2.58 ChrF, from 42.95 to 45.53. GSPO (Group Sequence Policy Optimization) is the same sequence-level, length-normalized RL method I have used elsewhere in my work; here it optimizes the translation model directly against a quality signal rather than pure next-token likelihood.
- **MBR decoding** (minimum Bayes risk, single model) adds a bit more, to 46.43, by choosing the candidate translation that agrees most with the model's own sampled hypotheses instead of the single greedy path.

The best system combines the pieces to 46.71.

## The caveats, up front

I said I would show the limits, so here they are, and they are on the chart itself:

- **One benchmark, one reference, no human evaluation.** ChrF against a single reference rewards surface overlap, not fluency or adequacy as a Quechua speaker would judge it. I have not run a human eval, so treat this as a system-comparison number, not a claim about real-world translation quality.
- **I am not claiming to beat 2024.** The 2024 task winner, BSC-2024, reported 38.21 ChrF++ with word_order=2, which is a different metric configuration and is **not directly comparable** to the word_order=0 ChrF I report here. What I can defend is a strong, reproducible result on the standard 2021 setup, ahead of the 2021 and 2023 systems on the same metric. I am deliberately not putting our number next to theirs as if it were a fair fight.

That is the honest shape of it: a real improvement over the comparable prior work, measured carefully, with the comparison I cannot make left explicitly unmade.

## Why it matters

Quechua is spoken by millions of people across the Andes and has almost no usable machine translation. The gap is not that the problem is unsolvable, it is that almost nobody is working on it. RosettIA is my attempt to close a little of that gap in the open, with the models and the honest numbers both public, so the next person starts ahead of where I did.
