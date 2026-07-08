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
  - value: '62'
    label: Models published on HuggingFace
  - value: '68'
    label: Open datasets released
  - value: '1.7M'
    label: Native Nahuatl speakers served
summary: >
  Nahuatl is spoken by 1.7 million people and ignored by nearly every translation
  system. I fine-tuned Gemma 3 27B into a state-of-the-art Nahuatl↔Spanish
  translator, and grew the effort into an open research program covering Quechua,
  Akkadian, and Mexican Spanish speech.
---

## The problem

Nahuatl, the language of the Aztec empire, is still spoken by over 1.7 million people in Mexico. Yet it's polysynthetic (one word can carry a full English sentence), fragmented across dialects, and severely underrepresented in NLP. Most translation tools either ignore it or produce garbage.

## The approach

I fine-tuned Google's **Gemma 3 27B** on curated parallel corpora, using 4-bit quantization to fit a model that nominally wants 180GB of VRAM onto accessible hardware. Where standard QLoRA plateaued, a careful full fine-tune pushed through, reaching **97+ ChrF**, state-of-the-art for the pair.

The work didn't stop at one model. Under the **Thermostatic** handle on HuggingFace I maintain an open research line on low-resource and indigenous languages:

- **Rosettia**: translation family spanning Nahuatl, Quechua (Chanka), and more, including GSPO-trained NLLB variants
- **Neblinia**: speech recognition previews for Mexican Spanish
- **Akkadian embeddings**: sentence-similarity models for a 4,000-year-old language
- **62 models and 68 datasets** released openly, including a 405M-pair English-Spanish corpus and the MEXA ASR leaderboard

## Why it matters

Language models are eating the world in English, Mandarin, and Spanish. The other 7,000 languages need someone to care on purpose. This is my way of making sure the machines remember Mesoamerica.
