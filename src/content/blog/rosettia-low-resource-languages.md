---
title: 'Rosettia: Translation for Languages the Internet Forgot'
description: 'Building open translation and speech models for Quechua, Nahuatl, and Akkadian. 62 models and 68 datasets later, what I have learned about low-resource NLP.'
pubDate: 2026-07-01
tags: ['NLP', 'Low-resource', 'Quechua', 'HuggingFace', 'Open Source']
draft: true
---

After [NeuralTranslate](/blog/neuraltranslate-preserving-nahuatl-with-ai) showed that a careful fine-tune could reach near-human Nahuatl↔Spanish translation, an obvious question followed: does the recipe generalize? Can one person with rented GPUs build usable translation for *any* underserved language?

**Rosettia** is my attempt to answer yes. It's the umbrella for my open low-resource language work on HuggingFace ([Thermostatic](https://huggingface.co/Thermostatic)): currently 62 models and 68 datasets.

## The lineup

- **Rosettia Quechua (Chanka)**: translation models for the Andes' most widely spoken indigenous language family, including `rosettia-chanka-4b` and GSPO-trained NLLB variants like `rosettia-quy-gspo-nllb13b`. The Chanka parallel dataset has passed 1,000 downloads.
- **Neblinia**: speech recognition previews for Mexican Spanish, plus the **MEXA ASR leaderboard** so Mexican Spanish ASR finally has a public benchmark.
- **Akkadian embeddings**: Qwen3-4B sentence-similarity models for a language that's been dead for two millennia, aimed at assyriologists matching cuneiform transliterations.
- **Infrastructure datasets**: including a 405M-pair English-Spanish corpus (CCMatrix) republished in a trainable format.

## What low-resource work actually teaches you

**Small models with the right objective beat big models with the wrong one.** For Quechua, GSPO (a sequence-level policy-optimization method) applied to NLLB, a model *designed* for translation, outperformed generic instruction-tuned giants at a fraction of the inference cost. The Gemma-27B hammer from NeuralTranslate isn't always the right tool; sometimes a 1B translation specialist wins.

**The dataset is the contribution.** Models get replaced every quarter. A cleaned, deduplicated, properly licensed parallel corpus keeps compounding: every future model for that language starts from it. It's the closest thing NLP has to laying pipe.

**Evaluation is where low-resource projects die.** Without a benchmark, you can't tell progress from noise, which is why the ASR leaderboard exists, and why ChrF (character-level, tokenizer-free) is my default metric for morphologically rich languages.

**Dialect boundaries are data boundaries.** "Quechua" and "Nahuatl" are families, not languages. Mixing variants silently degrades quality; splitting them shrinks already-small corpora. Getting this trade-off right matters more than any hyperparameter.

## Why bother?

Roughly 7,000 languages exist. Foundation models serve perhaps 50 of them well. The rest won't be rescued by scale; the data simply isn't on the internet to be scraped. They'll be served by people who care on purpose: collecting corpora, training specialists, and publishing everything open so the next person starts further ahead.

Physics taught me to look for the underlying invariant. Here it is: **languages don't die from lack of speakers; they die from lack of infrastructure.** Infrastructure is something we can build.
