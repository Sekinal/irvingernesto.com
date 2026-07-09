---
title: "Reading Refusal Before the Model Speaks"
summary: "When an AI decides to say no, it makes up its mind well before it writes anything, you can watch that decision form, and you can only switch off about a third of it. This is safety research about understanding models, not defeating them."
---

Modern AI models sometimes refuse to answer. Ask one for something harmful and it will say some version of "I cannot help with that." This little study is not about how to make a model stop refusing. It is about a more basic and more interesting question: where inside the model, and when, does that "no" actually get decided? Can you even find it? And if you find it, can you switch it off? The answers turned out to be strange enough that I want to walk through them plainly.

## The model makes up its mind early

Think of the model as reading your request and thinking through many internal steps before it writes a single word. Using a tool from Anthropic that lets you peek at those steps, called the Jacobian lens, I looked at the model at the exact instant before it starts writing.

The decision to refuse was already there. Roughly ten steps before the model finally types the word "cannot", you can already see refusal-related concepts lighting up inside it on harmful requests, and staying dark on ordinary ones. The model does not talk itself into refusing as it writes. It has essentially decided before it says anything at all. The refusal you read on screen is the announcement of a decision made earlier, out of sight. You can literally watch the "no" form before it is spoken.

## You can read the decision, so surely you can edit it

Once you can see where refusal lives, the natural next step is to reach in and remove it, purely as a way of testing your understanding. If you truly found the thing, deleting it should work. So I did the most precise version of that edit I could. I found the exact internal signal that corresponds to the model narrating "I cannot", and I gently subtracted it, without damaging anything else. This edit really was surgical. Compared to the usual blunt method, it disturbed the rest of the model far less. By every measure of "did you find the refusal signal", it was a bullseye. It cleared away the "I cannot" almost completely.

And the model kept refusing anyway.

## Only about a third of the "no" was reachable

This is the heart of it. When I removed the refusal signal I could see and read, the model's refusing behavior barely budged. Only about a third of it went away. The other two thirds were stored somewhere I could not reach from that vantage point.

Digging into where that other part lived produced the real lesson. There turned out to be two different things inside the model that I had treated as one. The first is the model *perceiving* that a request is harmful: recognizing words like "illegal" or "crime", sizing up the situation. The second is the model *narrating* its refusal: producing the actual "I cannot help with that." The behavior follows the perception, not the narration. The narration is just the model announcing a conclusion it already reached. When I edited the narration, I made the model unable to *say* why it was refusing, while it went right on refusing.

## An analogy

Imagine a company where a decision gets made quietly in a meeting, and then someone writes up a memo announcing it. If you get hold of the memo and cross out the announcement, you have changed the memo. You have not changed the decision, and you certainly have not erased it from the memory of everyone who sat in the room. The decision still stands and still gets acted on. Editing the words of the announcement does not reach back into the meeting where the choice was actually made.

That is what happened here. The part of refusal you can most easily read and edit is the announcement. The decision lives upstream, in the perceiving, and it keeps driving behavior even after the announcement is gone.

## Why this is safety research

I want to be clear about what this is and is not. It is not a recipe for jailbreaking a model. The interesting, encouraging result is the opposite: the part of a model's caution that is easiest to find and edit is *not* the part that actually holds the line. The load-bearing safety behavior is stored more robustly and more deeply than the surface signal suggests.

One more finding points the same way. Even after I forced a model to comply with harmful requests on the surface, its internal "I should refuse this" signal was still there, still readable, and it reliably told apart genuinely harmful requests from ordinary ones. It was not just reacting to spicy topics either: an innocent question that happens to mention killing a computer process did not trigger it, while a genuinely harmful request did. So even a model that has been made to misbehave can still carry an internal signal that it knows it should have said no. That is a useful thing to be able to monitor.

The takeaway is simple. A model's "no" is decided before it is spoken, you can watch it happen, but the version you can read is only the tip. Understanding that gap, between what a model announces and what actually governs its behavior, is exactly what we need before we trust these systems, and it is why this patient, honest interpretability work is worth doing.
