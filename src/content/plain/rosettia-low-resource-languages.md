---
title: 'Building Translation Tools for the Languages the Internet Forgot'
summary: 'A friendly tour of Rosettia, one persons effort to build free translation and speech tools for languages the tech giants ignore, from Quechua to a language dead for two thousand years.'
---

Once you have built a good AI translator for one overlooked language, a natural question follows: was that a lucky one-off, or is it a recipe you can reuse? If it worked for Nahuatl, the language of the Aztecs, could the same approach work for any language the tech world has forgotten? Rosettia is one person's attempt to answer yes. It is the umbrella name for a whole collection of free, open translation and speech tools, and so far it includes 62 different AI models and 68 datasets, all published for anyone to use.

## What is in the collection

The lineup spans languages that big tech barely touches:

There are translators for Quechua, the most widely spoken Indigenous language family of the Andes. The core dataset of matched Quechua and Spanish sentences has already been downloaded more than a thousand times, which for a language this overlooked is a real sign of demand.

There are speech-recognition tools for Mexican Spanish, along with a public scoreboard, called MEXA, so that anyone building such tools finally has a fair, shared way to measure how good they are.

Strangest of all, there are tools for Akkadian, a language that has been dead for two thousand years. These help the scholars who study ancient cuneiform tablets match up passages of that long-silent writing.

And there is plumbing: large, cleaned-up collections of matched sentences, including one with 405 million English-Spanish pairs, repackaged so other people can actually train AI on them without wrestling the raw mess into shape first.

## What building tools for forgotten languages teaches you

A few honest lessons came out of this work.

The first is that a small, focused tool often beats a giant one. There is a temptation to reach for the biggest, most powerful AI available and point it at every problem. But for Quechua, a modest model actually designed for translation, trained carefully, beat the enormous general-purpose giants, and it was far cheaper to run. The biggest hammer is not always the right tool.

The second lesson is that the dataset outlasts the model. AI models get replaced every few months by something newer. But a clean, carefully organized, properly licensed collection of example sentences keeps paying off forever, because every future model for that language gets to start from it. It is the closest thing this field has to laying down permanent pipe that others build on top of.

The third lesson is that measuring progress is where these projects quietly die. Without a fair scoreboard, you genuinely cannot tell whether a change made things better or just different. Every experiment looks like progress when you have no honest ruler. That is precisely why building the public scoreboard mattered so much, and why the project favors letter-by-letter scoring, which is fairer for languages that build long words out of many small pieces.

The fourth lesson is subtle: a "language" is often really a family of related varieties. "Quechua" and "Nahuatl" each cover many regional forms that differ quite a bit. Blend them together carelessly and quality quietly rots. Split them apart and each already-tiny pile of examples shrinks further. Getting that balance right matters more than any technical fine-tuning.

## Why bother at all?

Here is the fact that drives the whole effort. There are roughly 7,000 languages spoken on Earth. The big, powerful AI models serve maybe 50 of them well. The other thousands will not be rescued simply by building bigger AIs, because the problem is not brainpower, it is that the example sentences those AIs need to learn from were never written down on the internet in the first place. You cannot scrape what does not exist.

So those languages will only be served by people who decide to care on purpose: going out and gathering the examples, training tools tuned to each specific language, and then publishing everything openly so the next person begins a step ahead instead of from scratch.

The person behind Rosettia came to AI from physics, a field that trains you to look for the deep, simple truth hiding under a messy problem. The deep truth here is this: languages do not die because they run out of speakers. They die because they run out of infrastructure, the dictionaries, the tools, the shared resources that let a language function in the modern world. And infrastructure, unlike a shrinking community of elders, is something we can simply choose to build.
