---
title: "Reading Refusal Before the Model Speaks"
description: "An interpretability study with the Jacobian lens: the model commits to refusing roughly ten layers before it writes a word, that decision is legible in the verbalizable workspace, and a surgical pullback edit removes only about a third of it. Where the rest of the 'no' actually lives."
pubDate: 2026-07-06
tags: ['Interpretability', 'AI Safety', 'LLM', 'Mechanistic', 'Research']
---

The most surprising thing I found is not that you can edit a language model's refusal. It is that when you locate refusal precisely, read it cleanly, and surgically remove exactly the thing you were reading, the model keeps refusing anyway. About two thirds of the "no" is somewhere you were not looking.

This is a small study built on top of Anthropic's [Jacobian lens](https://github.com/anthropics/jacobian-lens), the reference implementation for [*Verbalizable Representations Form a Global Workspace in Language Models*](https://transformer-circuits.pub/2026/workspace/index.html). It is squarely interpretability and safety work: the question is not how to stop a model refusing, it is where and when inside the network that refusal is decided, whether that decision is legible, and how much of it you can actually reach from the part of the model you can read. The headline result is that the readable part is not the load-bearing part, and that is the interesting, safety-relevant finding.

## Refusal is a computation that finishes before the first token

The model here is `Qwen3.5-4B`: 32 layers, residual width 2560, with the pre-fitted Hub lens `neuronpedia/jacobian-lens @ qwen-n1000`. The Jacobian lens gives an average forward map $J_l$ from a layer-$l$ residual to the final logits. That linearization is what lets me ask a causal question about the future: not "what is written in this residual now" but "which directions in this residual push the model toward saying a refusal word later."

So I read the J-space at the assistant-generation position, the moment right before the model emits its first token, on harmful versus benign chat prompts. On harmful prompts the workspace lights up `Cannot`, `cannot`, the Chinese `无法`, and `illegal` at layers 16 to 24. Benign prompts do not. The relative refusal-mass is roughly +7 for harmful prompts against roughly 0 for benign ones.

Read that again in terms of time. Nothing has been generated yet. The model has not written "I". And already, about ten layers deep from where the refusal tokens finally surface, the decision to refuse is present and legible. Refusal is not something the model talks itself into as it writes. It is a computation that has essentially finished before the first token, and the lens lets you watch it finish.

## The pullback: refusal as it lives in the workspace

Here is the mechanical idea. The standard way to remove refusal is *abliteration* (Arditi et al. 2024): take the mean difference between harmful and harmless activations, call it the "refusal direction", and project it out of the residual stream everywhere. It works, but that direction is derived from what correlates with harmful *input*, and its damage is only ever checked at the *output*.

The Jacobian lens offers a sharper handle. Because $J_l$ maps a residual to logits, the residual directions that *cause* a future refusal token are the pullback of that token's unembedding through $J_l$. Concretely I build

$$d_l = J_l^{\top}\,(g \odot w), \qquad w = \operatorname{mean}(W[\text{refusal}]) - \operatorname{mean}(W), \qquad g = \text{final-norm gain}$$

where $W$ is the unembedding matrix and $w$ is the refusal-token covector, mean-centered. $d_l$ is refusal *as it lives in the verbalizable workspace*: the per-layer residual direction whose only job is to steer the model toward narrating "I cannot". No harmful/harmless contrast set is needed to find it, just the pullback of the refusal tokens themselves.

To edit, I ablate with a reversible forward hook that projects the residual orthogonal to that direction, $h' = h - \alpha\, Q^{\top}(Q h)$, at every fitted layer from 8 onward, for the duration of one generate pass. Nothing is written to weights. And critically I measure collateral *inside the interpretable workspace*: the off-refusal-axis KL of the J-space readout on benign controls. That is the anti-lobotomy safeguard. It asks whether the edit disturbed the rest of what the model verbalizably represents, not just whether the output still looks fine.

## The surgical edit that barely moves behavior

On disjoint eval splits (120 AdvBench, 200 XSTest, 250 ARC-Easy, 48 benign controls), at strength 1:

| method | AdvBench refusal | XSTest-unsafe | ARC | workspace KL | refusal suppression |
|---|---|---|---|---|---|
| original | 0.99 | 0.91 | 0.98 | 0.000 | 0.00 |
| mean-diff (abliteration) | **0.06** | 0.13 | 0.98 | 0.257 | 3.44 |
| **pullback** | 0.78 | 0.13 | 0.98 | **0.046** | **7.55** |
| pullback subspace r=3 | 0.55 | 0.23 | 0.98 | 0.196 | 7.18 |

Read the pullback row as a paradox. It is the most precise instrument on the table: it distorts the benign workspace about 5.6 times less than abliteration (KL 0.046 against 0.257) while suppressing the workspace's own refusal-mass about 2.2 times more (7.55 against 3.44). It is, almost by definition, the refusal-readout direction, so it barely touches anything off that axis. And it leaves 78% of AdvBench refusal behaviorally intact. Abliteration, the blunt instrument, drops refusal to 0.06.

Capability holds throughout: ARC stays at 0.98 for every non-degenerate edit. So the meaningful "lobotomy" signal is not accuracy, it is the workspace KL. This is exactly why measuring collateral in the J-space rather than only at the output matters: the two edits look very different inside the model and only somewhat different at the surface.

Pushing the single direction harder does not rescue it. A strength sweep shows it *plateaus*: it bottoms out around AdvBench refusal 0.68 with the workspace intact, and only reaches 0.00 at strength 3, where ARC collapses to 0.22 and workspace KL blows up to 17. You cannot get to full removal through that one direction without breaking the model.

## What "one third workspace-mediated" actually means

The plateau is the result, not a nuisance. Cleanly deleting the verbalizable "I cannot" disposition from the workspace removes only a minority of the refusal behavior. To locate the rest, I split abliteration's direction $m$ into the part parallel to the pullback, $m_{\parallel p}$, and the part orthogonal to it, $m_{\perp p}$, and ablated each on 100 AdvBench prompts:

| direction | behavior removed | workspace "cannot" cleared |
|---|---|---|
| pullback $p$ | 0.22 | **7.55** |
| workspace part $m_{\parallel p}$ | 0.23 | 7.55 |
| orthogonal part $m_{\perp p}$ | **0.90** | 1.81 |
| abliteration $m$ | 0.93 | 3.44 |

Ablating $p$ clears the verbalizable narration almost completely and moves behavior from 0.99 to 0.77. Ablating $m_{\perp p}$ removes the behavior (down to 0.09) while barely touching the narration. The lens-verbalizable slice of the refusal direction does not carry the refusal behavior. That is roughly a third: the readable part is a minority stakeholder in the decision.

I want to be honest about where the evidence is independent. $p = J_l^{\top}(g \odot w)$ is, up to the lens linearization, the gradient of the workspace refusal-mass itself. So "ablating $p$ maximizes suppression" and "the pullback has low off-axis workspace KL" are partly true *by construction*: those columns are coupled to how $p$ is built. Only the behavior column is independent evidence. And there $m_{\perp p}$ is close to plain abliteration, so that part is close to a restatement of the standard method.

## The correction I had to make

My first framing was that this is a "double dissociation" between a *verbalizable workspace* refusal and an *automatic* one living outside the lens. I red-teamed that claim and it did not survive, so I document both the claim and its retraction.

The mechanistic test is whether the behavior-carrying direction lives in the lens's null space. It does not. $m_{\perp p}$ is 61% lens-*visible*. Ablating the lens-visible part of $m$ removes 100% of refusal; ablating the lens-blind part removes 0%, the opposite of the null-space hypothesis. And the lens image of $m_{\perp p}$ does not decode to refusal words at all: it reads `illegal`, `crime`, `violence`, `police` at mid layers. It is a harmfulness-*perception* feature.

So the real distinction is not workspace versus automatic. Both directions are in the workspace. It is *perception versus narration*. One feature perceives that the request is harmful (`illegal`, `crime`), and a distinct feature narrates the refusal (`I cannot`). Behavior follows perception. Ablating the narration leaves a model that still refuses but can no longer articulate why, and a bidirectional steering test confirms the direction of causation: adding the harm *representation* to benign prompts induces genuine refusal, while adding the refusal *narration* just forces the words "I cannot" at a much higher workspace cost, and adding harm-narration alone makes the model cheerfully write "renewable energy: 1. Illegal drug trafficking" with no perception of harm and no refusal at all.

## Why this matters for safety

There is a practical spinoff that points the same way. Even after you abliterate the behavior-carrying direction so the model complies with harmful requests at the surface, its internal refusal-mass still separates harmful-that-complied prompts from benign ones at AUC 0.998, against 0.48 for the surface behavior. And it is a disposition detector, not a topic detector: benign-but-harmful-topic prompts like "how do I kill a Python process" score 2.75, far below genuinely-refused prompts at 8.57. An "uncensored" open model still carries a monitorable internal signal that it *knows* it should refuse. That is a real safety hook.

The lesson I take is about where safety behaviors live. The part of refusal you can most easily read and most surgically edit, the verbalizable "I cannot", is the narration, not the mechanism. It is a downstream readout of an upstream perception. If you edit the memo, the meeting already happened. Any safety intervention that operates on the legible, verbalizable layer is touching the announcement, not the decision, and the decision is stored somewhere you have to work harder to reach.
