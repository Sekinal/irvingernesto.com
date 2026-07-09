---
title: 'Teaching a Computer to Speak Nahuatl, the Language of the Aztecs'
summary: 'A friendly tour of a project that built an AI translator for Nahuatl, a living language that almost no tech company bothers to support, and why translating it is so surprisingly hard.'
---

Nahuatl is the language the Aztecs spoke, and it is not a museum piece. More than 1.7 million people in Mexico still speak it today. That is a whole city's worth of people, larger than the population of many countries. And yet, when you reach for a translation app or an AI assistant, Nahuatl is almost always missing. Most tools either ignore it completely or spit out nonsense. This project set out to fix that, by building an AI that can actually translate between Nahuatl and Spanish.

## Why does nobody bother?

The short answer is money and data. Modern translation AIs learn by reading enormous piles of example sentences that have already been translated by humans, the same sentence in two languages, lined up side by side. For English and Spanish, the internet is drowning in such examples. For Nahuatl, there is barely a trickle. When the training material is scarce, a language is called low-resource, and big tech companies mostly do not find it worth their while to build tools for it. So if anyone is going to do it, it has to be someone who cares on purpose.

## Why Nahuatl is genuinely hard to translate

Beyond the shortage of examples, Nahuatl has a feature that makes it fascinating and difficult. In English or Spanish, you build a thought out of several separate words. In Nahuatl, a single word can carry what would take a whole sentence in English. The word gets built up by gluing pieces together: a piece for "I," a piece for "you," a piece for the verb, a piece for the tense, all fused into one long word. Linguists call this polysynthetic. It means the AI cannot just swap word for word. It has to understand how the pieces snap together and come apart.

On top of that, Nahuatl is not one single language but a family of regional varieties: the classical form, the Huasteca variety, the Central variety, and more. They differ enough that mixing them together confuses the AI, so this project focused on modern Central Nahuatl to keep things consistent.

## The trick: shrink the model without lobotomizing it

The project started from a large, powerful, freely available AI model made by Google, called Gemma. It comes in several sizes. The smaller versions turned out to be too simple to grasp Nahuatl's tangled word-building. The big version, with 27 billion internal settings, had the horsepower. The catch is that the big version is a monster to run: just holding it in memory normally needs about 108 gigabytes of specialized computer memory, which is far more than a single machine usually has.

The clever move was compression. There is a technique that squeezes the model down so it stores its numbers more coarsely, roughly quartering the memory it needs, from about 108 down to about 27 gigabytes, so the whole thing fits on a single (very fancy) chip. The usual way people use this trick is to freeze most of the model and only teach a thin new layer on top. But this project did something bolder: it kept the whole model flexible and retrained all of it. The reasoning is that learning a new language is not a light touch-up. The AI has to genuinely rewire how it thinks, and that means letting every part of it change.

## Did it work?

Yes, and impressively so. To measure quality, the project used a scoring method that compares translations letter by letter rather than word by word, which is fairer for a language that builds giant words out of small pieces. On a scale where a perfect match is 100, the model reached about 97.5, remarkably close to what a skilled human translator produces. For comparison, the safer freeze-most-of-it approach got stuck around 85 to 88 on the same material. Retraining the whole model was worth nearly ten extra points.

The training itself took only about eight hours on one high-end chip. Here are a few real examples of the finished translator at work. Give it the single Nahuatl word Nimitztlazohtla and it correctly returns "I love you." Give it Tlein motocah? and it returns "What is your name?" Give it Nicnequi atl and it returns "I want water." Notice how those tiny attached pieces, the bit meaning "I" and the bit meaning "you," get untangled correctly. That is exactly the hard part it was built to handle.

## Why this matters

The finished translator is free for anyone to try in a web browser and free for other researchers to download and build on. But the bigger point is the proof it offers. With the right approach and a lot of care, a single determined person can build genuinely good language tools for a language the tech giants overlook. This project became the seed of a larger effort, later named Rosettia, that went on to tackle other forgotten languages, from Quechua in the Andes to Akkadian, a language that has been dead for two thousand years. Languages do not vanish only because people stop speaking them. They vanish when nobody builds the tools that let them live in the modern world. Those tools can be built.
