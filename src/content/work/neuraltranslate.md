---
title: NeuralTranslate
tagline: An open Nahuatl to Spanish machine-translation model, and the lesson that the data mattered more than the model.
role: Creator & Researcher
year: 2025 → Now
order: 3
link: https://huggingface.co/Thermostatic
stack:
  - PyTorch
  - Unsloth
  - Gemma 3 27B
  - 4-bit Quantization
  - HuggingFace
metrics:
  - value: '27B'
    label: Gemma 3 base, fine-tuned in 4-bit
  - value: 'Nah → Es'
    label: Nahuatl to Spanish
  - value: 'Open'
    label: Weights on HuggingFace
summary: >
  Nahuatl is spoken by about 1.7 million people and ignored by nearly every
  translation system. I fine-tuned Gemma 3 27B into an open Nahuatl to Spanish
  translator, and learned the hard way that the corpus, not the model, was the
  real problem.
---

## The idea

Nahuatl, the language of the Aztec empire, is still spoken by about 1.7 million people in Mexico. It is polysynthetic (one word can carry a full sentence), fragmented across dialects, and almost absent from modern NLP. I wanted to see how far one person could push a usable Nahuatl to Spanish translator by fine-tuning a strong open model.

## The model

I fine-tuned Google's **Gemma 3 27B** with 4-bit quantization, which is what lets a model that nominally wants far more VRAM train on accessible hardware. The result is published openly on HuggingFace as "Neuraltranslate 27b Mt Nah Es", free for anyone to download and build on.

## What I got wrong, and fixed

The honest lesson of this project is that I underinvested in the data. The first version trained on an existing public Nahuatl-Spanish corpus (the SomosNLP Axolotl dataset) largely as it came. It scored well on validation, but the corpus uses an older orthography that does not fit how Nahuatl is written today, so a high validation score mostly meant the model had faithfully learned an outdated spelling. Nahuatl speakers, not a benchmark, are the ones who caught it: they read the output and told me it was off for modern Nahuatl. That feedback is what moved the work forward, and taking the orthography seriously from the start is what I would do differently next time.

## Why it matters

Language models are eating the world in a handful of high-resource languages. The other 7,000 need someone to build for them on purpose, and to do it in conversation with the people who actually speak them. That second part is the lesson I am keeping.
