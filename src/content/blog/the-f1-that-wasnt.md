---
title: "The 0.98 F1 That Wasn't: Catching Your Own Benchmark Cheating"
description: 'An eval-integrity story: how a 0.987 member-F1 turned out to be a model grading its own homework, and the general rule for measuring the thing you think you are measuring.'
pubDate: 2026-07-09
tags: ['ML', 'Evaluation', 'SteelEye', 'Benchmarking', 'Research']
---

I once shipped a 0.987. Then I proved it was fake. This is the story of how, and why the number I kept instead, roughly 0.77, is the one I am proud of.

At [SteelEye](https://steeleye.ai) the model detects structural members on CAD construction drawings and assigns each its correct AISC section name. It is boosted trees on geometry features plus a small text embedding of each token. How I built that is a separate story, told in [Teaching XGBoost to Read Blueprints](/blog/teaching-xgboost-to-read-blueprints). This post is not about the build. It is about the evaluation, and about the specific, seductive way a benchmark can lie to you in your own favor.

## Two sources of truth, and the trap between them

Ground truth arrived in two forms.

The first was an **auto-derived benchmark**. I took the NC1 fabrication files, the CNC instructions the shop actually cuts from, and applied their rule logic to the drawing tokens to derive labels programmatically. Cheap, scalable, no human in the loop.

The second was **independent human annotation** in Label Studio: people looking at drawings and marking members by hand. Slow, expensive, small.

Scored against the auto-derived benchmark, the model looked spectacular: 0.948 end-to-end, 0.987 member-F1. State of the art by any reading. I believed it for longer than I would like to admit.

## The catch

Here is what I missed. The auto-derived labels were a near-deterministic function of the same input features the model sees. The rule that generated the "ground truth" and the model being graded were both reading the same drawing tokens, and the rule was simple enough that the model could largely re-learn it.

So the model was not being tested. It was reproducing a labeling rule, and then being graded by that same rule. It was grading its own homework, and of course it got an A.

The tell was there the whole time. **A suspiciously high number is a smell, not a trophy.** 0.987 on a genuinely hard perception task should have made me suspicious, not proud. Instead it made me stop looking.

## Regrading against a truth the model never touched

The fix was to score the exact same model against the independent human annotations, a source of truth with no causal connection to the feature pipeline.

The same model that scored 0.987 against the auto-derived benchmark scored a **member-F1 of about 0.25** against human gold.

That is not a small correction. That is nearly the entire result evaporating. The honest, rebuilt model now reaches around 0.77 member-F1 and 0.78 end-to-end on held-out human gold. The written conclusion in the repo is blunt, and I stand by it:

> The 0.98 was an illusion of a self-consistent, easier benchmark. Don't chase 0.98.

## What actually went wrong, stated generally

Strip out the steel and the failure is universal. Any ML engineer can walk into it.

**A benchmark derived from your own inputs measures label-rule reproduction, not capability.** If the process that produces your labels reads the same features your model reads, and that process is learnable, your model will learn it and your benchmark will applaud. You have built a closed loop and called it an evaluation. The score is real; it is just measuring the wrong thing.

The defenses are simple to state and easy to skip under deadline:

- **Always hold out a source of truth that is independent of your feature pipeline.** If your labels and your model both descend from the same inputs, you have no evaluation, you have a mirror. Human annotation, a different sensor, a downstream physical outcome: something the model cannot have reverse-engineered.
- **Treat a suspiciously high number as a smell.** The moment a hard task returns an easy score, stop and ask what shortcut you accidentally graded.
- **Report the number you can defend to a skeptic.** Not the number that looks best in a deck. Imagine someone hostile and competent asking "how do you know that isn't circular?" and report the number that survives the question. My defensible number is 0.78, and I would rather ship a real 0.78 than a benchmark's 0.98.

## The same mistake wears many costumes

This is one instance of a broader failure mode: **measure the thing you think you are measuring, not a proxy that happens to be lying nearby.**

I hit the same class of bug from a completely different direction on the speech-recognition side of my work. An early ASR preview looked mysteriously weak, and the cause was that it had been trained on one set of languages and evaluated on a different, non-overlapping set. The evaluation was accidentally zero-shot: the model was being graded on languages it had never seen. Different domain, different symptom, same root cause. The train and test sets did not describe the same thing, so the number was answering a question I had not asked.

In the steel case the eval was too easy because it was circular. In the ASR case the eval was too hard because it was disjoint. Both times the number was confident and both times it was wrong, and both times the fix was the same discipline: go find out, concretely, what your metric is actually a function of.

## The rule

A benchmark is a claim about the world, and like any claim it can be self-serving. The auto-derived one flattered me because I built it from the same clay as the model. The honest one, human gold the pipeline never touched, told me the truth, and the truth was a worse number and a better result.

If your evaluation and your model share ancestry, you do not have an evaluation. And if a hard problem hands you an easy score, the burden is on you to prove it is not measuring itself.
