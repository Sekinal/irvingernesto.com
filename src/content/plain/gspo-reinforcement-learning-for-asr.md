---
title: 'Teaching an AI to Hear the Languages Spanish Landed On Top Of'
summary: 'A friendly tour of a project that taught a speech-recognition AI to understand Mexican Indigenous languages that every top system fails on, by rewarding it for getting the letters right.'
---

Every top speech-recognition system on the planet can hear Spanish just fine. Speak Mexican Spanish into any of the big-name systems and it types out what you said with only about 14 percent of the words wrong, which is annoying but usable. Now point those exact same systems at Nahuatl, or any of the 22 other Indigenous languages of Mexico, and the wrong-word rate leaps to 99 percent or worse. At that point the system is not really listening. It is just guessing, and guessing in the wrong language entirely.

That gap, 14 percent versus 99 percent, is the whole project in a single number. And it is not a gap you can close by nudging a few settings. It exists because the practice material these systems need, hours of recorded speech paired with written transcripts, simply never existed for these 23 languages, which span at least six different language families. This is the story of closing part of that gap.

## First, build a test that cannot be cheated

Before touching any AI, the first job was to build a fair exam, because in this kind of work a dishonest exam is where projects secretly rot. If you cannot tell real progress from random luck, every attempt looks like a triumph.

The exam is called MEXA, and it is built to be uncheatable in two ways. First, the answer key is kept private and never released, so nobody can peek. Second, there is a clever public "fingerprint" list: anyone can check whether their own practice recordings accidentally overlap with the secret exam, without ever seeing the exam itself. You learn only whether you have a collision, never what the answers are.

The scoring is also linguistically careful. Many of these languages use tone marks and little catches in the throat that completely change a word's meaning. A lazy scorer would strip those marks away and quietly reward an AI for mangling them. This exam keeps them, so it grades the language people actually speak, not a flattened version of it.

## Learning by practice and reward

The core idea borrows a training method usually reserved for chatbots: reinforcement learning. Here is the everyday version. Instead of forcing the AI to memorize a fixed answer sheet, you let it take a guess, then hand it a reward based on how good the guess was, then let it try again and again, steering toward whatever earns the biggest reward. It is learning by trial and feedback, the way you would learn a sport by practicing and being told how each attempt went, rather than by cramming from a book.

The training happened in two stages. The first stage was ordinary practice: show the AI recordings paired with correct transcripts until it stops guessing in Spanish and starts producing plausible-looking words in the right language. The second stage was the reinforcement-learning stage, using a method called GSPO, and this is where the interesting part lives.

## The reward is beautifully simple

The reward the AI chases is just this: how many letters did it get right, compared to the correct transcript? That is the entire reward. There is no complicated human judge, no vague sense of "quality." The correct transcript is ground truth, so the reward is exact and honest, which sidesteps a whole family of ways AIs learn to cheat their graders.

This simple reward had a lovely side effect. The worst failure of these systems on hard audio is getting stuck in a loop, repeating the same phrase over and over like a scratched record. Nobody had to tell the AI to stop looping. Under a letter-counting reward, every repeated letter counts as a mistake and shreds the score, so the AI discovers on its own that looping is expensive and quits doing it.

## Why not just use an off-the-shelf tool?

The obvious shortcut was to grab an existing reinforcement-learning toolkit and be done by lunch. It did not work, for a deep reason. Every ready-made tool of this kind assumes the AI reads text and writes text. But this AI's input is not text at all, it is sound. So the entire training machine had to be rebuilt by hand to feed the AI audio, let it produce several candidate transcripts per clip, and nudge it toward the better ones.

## What happened, including the failure worth keeping

The reinforcement stage improved the results by a small but real margin, and crucially it dropped the worst looping language's error rate from about 100 to about 76. That improvement was enough to take the number one spot on the public scoreboard, and it beat the next-best system on letter accuracy by a huge margin.

The most instructive part was a failure. The researcher expected that a fancier, cleverer reward would help even more. It did not, not even a little. The reason is honest: these languages come in two extremes, the easy Spanish clips the AI almost always gets right, and the near-impossible Indigenous clips it almost always gets wrong, with almost nothing in the middle. The fancy method was built to exploit a gentle gradient of difficulty that mostly did not exist. The plain reward kept learning precisely because it did not rely on that missing middle ground. Sometimes the sophisticated tool is worse than the simple one, and knowing why is the real prize.
