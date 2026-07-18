---
title: 'RosettIA, in Plain English: Translating a Language Big Tech Ignores'
summary: A jargon-free version of the Quechua translation result and, just as importantly, its honest limits.
---

Quechua is spoken by millions of people across the Andes, and yet if you try to translate Spanish into it with the usual tools, you get very little. The big translation systems are trained on the handful of languages that make companies money, and Quechua is not one of them. RosettIA is my attempt to fix a small piece of that, in the open.

## The result

I built a translation system for Spanish into one variety of Quechua (Chanka, from the Ayacucho region), and I tested it on a standard shared exam that researchers use to compare their systems on this exact language pair. On that exam, my best system scored higher than the previous winners, including the university teams from Helsinki and Sheffield who had held the top spots.

Think of it as a well-known yearly race that a few labs enter. My system crossed the line ahead of the published record-holders on that track.

## How I got there

It was not one magic trick, it was a climb in steps:

- I started by carefully training a solid open translation model. That alone already beat the previous winners.
- Then I used a training method called reinforcement learning, where the model improves by being rewarded for better translations rather than just copying examples. That gave a real jump.
- Finally, instead of taking the model's first answer, I had it propose several translations and keep the one they most agreed on. That squeezed out a little more quality.

Each step added a bit, and together they reached the top score.

## The part I want to be honest about

A single test score is easy to brag about and easy to mislead with, so here is what the number does not mean:

- It was measured against one correct answer per sentence, by a computer, not judged by an actual Quechua speaker. So it says my system compares well to other systems, not that a native speaker would call every translation good.
- There is a newer 2024 winner whose score I deliberately do not claim to beat, because it was measured with a slightly different ruler. Comparing the two head to head would be dishonest, so I do not.

What I can stand behind is a genuine, careful improvement over the comparable earlier systems, with everything published so the next person starts ahead of where I did.

## Why bother

Quechua translation is bad not because it is impossible, but because almost nobody works on it. That is the whole point of doing this in the open: to make a language big tech ignores a little less ignored.
