---
title: NeuralTranslate
tagline: State-of-the-art machine translation for Nahuatl, the language of the Aztecs.
role: Creator & Researcher
year: 2025 → Now
order: 3
link: https://huggingface.co/Thermostatic
stack:
  - PyTorch
  - Unsloth
  - Gemma 3 27B
  - NLLB
  - HuggingFace
  - GRPO/GSPO
  - 4-bit Quantization
metrics:
  - value: '97+'
    label: ChrF score, Nahuatl↔Spanish
  - value: '#1'
    label: On the MEXA ASR leaderboard
  - value: '23'
    label: Indigenous languages benchmarked
  - value: '1.7M'
    label: Native Nahuatl speakers served
summary: >
  Nahuatl is spoken by 1.7 million people and ignored by nearly every translation
  system. I fine-tuned Gemma 3 27B into a state-of-the-art Nahuatl↔Spanish
  translator, built a contamination-resistant benchmark that exposes how badly SOTA
  models fail on Indigenous speech, and grew the effort into an open research program
  spanning Quechua, Akkadian, and Mexican Spanish.
---

## The problem

Nahuatl, the language of the Aztec empire, is still spoken by over 1.7 million people in Mexico. Yet it's polysynthetic (one word can carry a full English sentence), fragmented across dialects, and severely underrepresented in NLP. Most translation tools either ignore it or produce garbage.

That gap is not an accident of scale. It is what happens when 7,000 languages sit outside the data that trains the machines. My work under the **Thermostatic** handle on HuggingFace is one long attempt to close it: 62 models and 68 datasets released openly, spanning translation, speech, and the benchmarks needed to keep everyone honest.

## The translator

I fine-tuned Google's **Gemma 3 27B** on curated parallel corpora, using 4-bit quantization to fit a model that nominally wants 180GB of VRAM onto accessible hardware. Where standard QLoRA plateaued, a careful full fine-tune pushed through to **97+ ChrF**, state-of-the-art for the pair. The result, "Neuraltranslate 27b Mt Nah Es", is published and downloadable.

The corpus was the hard part. Nahuatl has many competing spellings, so every pair is normalized to the INALI orthographic standard using a finite-state transducer (py-elotl). Much of the data did not exist in machine-readable form: I OCR'd and manually reviewed scanned bilingual books and colonial-era manuscripts, including one 72-page book with no text layer at all. Morphological segmentation, the morphemes and glosses, is preserved so the model learns the polysynthetic grammar rather than memorizing surface strings.

## MEXA: a benchmark that can't be gamed

You cannot fix what you cannot measure, and low-resource speech benchmarks leak. So I built **MEXA**, a contamination-resistant ASR benchmark covering Mexican Spanish plus 23 Indigenous languages across 6+ language families.

The trick is a **private held-out test set** paired with a **public audio-and-text fingerprint registry**: anyone can decontaminate their own training data against MEXA without ever seeing the test itself. Normalization is linguistically aware, preserving tone marks and glottal stops inside the WER and CER rather than stripping the very features that carry meaning.

The headline result is damning. Every current SOTA system (Whisper, NVIDIA Parakeet and Canary, Meta MMS, IBM Granite) lands around **14% WER on Spanish and 99%+ WER on the Indigenous languages**. They do not transcribe these languages; they hallucinate at them. My own model tops the leaderboard: next-best CER of 30.6 against a field baseline of 74.3.

## Neblinia: teaching Whisper to listen

**Neblinia** (the MexicoSpeech ASR line) is how I earned the #1 spot. The base is openai/whisper-large-v3-turbo, adapted with a LoRA stack (Unsloth) whose hyperparameters were found by Optuna, using rsLoRA plus DoRA. Then I trained it with reinforcement learning via **GSPO** (Group Sequence Policy Optimization).

I had to **hand-roll GSPO**. Standard RL libraries like TRL's GRPO trainer assume text-in, text-out, but Whisper's input is audio, so none of them fit. The reward is deliberately simple: negative Character Error Rate. It is verifiable (no reward model to train or trust), and it self-punishes hallucination loops, because the repetition Whisper falls into inflates CER and gets penalized automatically. GSPO's key departure from GRPO is a sequence-level, length-normalized importance ratio, which is exactly what a variable-length transcription task needs.

On the 240-clip MEXA subset, GSPO moved SFT's 68.5 WER / 30.6 CER to **66.0 / 28.3** and took the #1 leaderboard spot. The worst looping language dropped from 100.2 to 75.9 WER.

## An honest negative result

Fancier reward shaping did not help. Composite rewards and an MGPO variant both **failed to beat plain negative-CER GSPO**. The reason is structural: low-resource ASR difficulty is bimodal, easy Spanish on one end, near-impossible Indigenous audio on the other, with almost nothing in the middle for a nuanced reward to grip. Reporting what did not work is part of the job.

## Beyond Mesoamerica

The same research line reaches further back and further out:

- **Akkadian**, a 4,000-year-old language: a translation pipeline fine-tuning Google's TranslateGemma 4B with QLoRA (Unsloth, 4-bit), reaching ~56 ChrF++ on the official Deep Past Challenge test, drawn from curated Old Assyrian archives. A companion mechanistic-interpretability study localized a quality gap to late decoder cross-attention via activation patching.
- **Rosettia**: a translation family extending to Quechua (Chanka) and other Indigenous languages, including GSPO-trained NLLB variants.

## Why it matters

Language models are eating the world in English, Mandarin, and Spanish. The other 7,000 languages need someone to care on purpose: to build the corpora by hand, to write the benchmarks that refuse to be gamed, and to publish the failures alongside the wins. This is my way of making sure the machines remember Mesoamerica.
