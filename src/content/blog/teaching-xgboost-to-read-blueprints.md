---
title: 'Teaching XGBoost to Read Blueprints'
description: 'Lessons from building a vector-native structural member detector for steel construction drawings, where gradient-boosted trees beat transformers, label quality beat everything, and the headline number turned out to be measuring the wrong thing.'
pubDate: 2026-06-28
tags: ['ML', 'XGBoost', 'CAD', 'SteelEye', 'Research']
---

At [SteelEye](https://steeleye.ai) we needed to automate takeoff: given a structural construction drawing, find **every placed member** (columns, beams, joists, braces, base plates, deck) and assign each its correct AISC section name (`W14X22`, `HSS5X5X1/4`, `26KSP`…). Estimators do this by hand today, page by page, and it's slow, error-prone work that million-dollar bids depend on.

Two years of ML hype would tell you to fine-tune a vision-language model and call it a day. Here's what actually worked, after ~200 experiment scripts and 33k lines of research code.

## Work on vectors, not pixels

Construction PDFs aren't scans; they're CAD exports. The text tokens and line segments are *right there* in the file. Instead of rasterizing and running object detection, we extract primitives with PyMuPDF and classify **tokens**: is this string a member's name, and if so, what class of member?

This one decision bought us exact text (no OCR noise), exact geometry (segment endpoints, orientations, lengths), and two orders of magnitude less compute than a vision pipeline.

Ground truth came from an unusual place: **NC1 (DSTV) files**, the CNC instructions the fabrication shop actually cuts from. If the model says a page contains `W12X26` beams and the NC1 answer key agrees, that's validation no human labeling budget could match.

## The model zoo, and who survived it

We benchmarked honestly: gradient-boosted trees (LightGBM/XGBoost), a deep residual MLP, a set-attention transformer, a kNN message-passing GNN, tabular foundation models (TabICL, TabPFN), even the Hierarchical Reasoning Model. The numbers below are relative scores from the same self-consistent harness (more on why that harness flattered everyone in a moment), so read them as a ranking, not as capability.

| Model | Relative F1 (same harness) |
| --- | --- |
| **GBM (XGBoost/LightGBM)** | **best** |
| MLP (residual, bf16) | close behind |
| GBM + MLP ensemble | close behind |
| GNN (kNN graph, 3 layers) | worse |
| Transformer (set attention) | diverged |

The gradient-boosted trees won, on 84 engineered features: geometry (distance to segments, orientation context), relational cues (neighbor density, same-row/column), and 32 PCA dimensions of **e5-small text embeddings**. That last part matters: a 33M-parameter embedding model beat its larger siblings at understanding technical codes, and added +6.6 points on unseen naming schemes.

This mirrors the CAD symbol-spotting literature: state-of-the-art methods there are shallow, kNN-edge-based systems, not deep stacks. When your entities are sparse, structured, and text-anchored, representation beats architecture.

## Synthetic data is a representation lever, not a volume lever

The hardest problem was **cross-fabricator generalization**: every detailing shop has its own drawing style and mark scheme. Real training data all came from one fabricator.

So we built a procedural drawing generator with **style personas**: synthetic sheets with randomized grids, leader lines, mark conventions, and adversarial decoys (notes and callouts that look like members). Training on real + 500 synthetic sheets lifted novel-fabricator accuracy from 0.57 to 0.78.

Two counterintuitive findings:

- **Diversity saturates.** 48 personas ≈ 160 personas. Once the model has seen "enough kinds of different," more variety adds nothing.
- **Random mark schemes teach a skill, not facts.** Synthetic sheets with nonsense prefixes force the model to learn *"unknown prefix → trust the geometry"*, exactly the behavior you need on a new fabricator's drawings.

We also tested the fashionable alternatives: domain-generalization losses (IRM, GroupDRO, CORAL), an RL-based adversarial curriculum, pseudo-labeling. All rejected: none beat plain XGBoost with better data.

## Label quality beats model capacity

The single largest jump in the entire program came from a labeling fix, not a modeling idea: marking **one positive token per member** (its name/mark) instead of every token inside its bounding box. Clean supervision moved metrics more than any architecture change we tried.

If your model has plateaued, audit your labels before reaching for a bigger network. In our callout-detection work, a vision-model audit found **29% of human gold labels were corrupted** by an export bug. The "model problem" was a data problem wearing a costume.

## Where it landed

For a while I thought the production detector hit 0.987 member-F1 and 0.948 end-to-end, and I reported those numbers. They turned out to be measuring the wrong thing: scored against a benchmark auto-derived from the model's own inputs, the model was largely grading its own homework. I tell that whole eval-integrity story in [The 0.98 F1 That Wasn't](/blog/the-f1-that-wasnt). Regraded against independent human gold, the honest detector reaches **~0.77 member-F1** and **~0.78 end-to-end** (found *and* correctly named) on a frozen human-annotated test set, with leave-one-project-out cross-validation and reproducible-from-scratch docs. That is the number I stand behind, and I think it reads as the stronger result.

The boring stack won: engineered features, gradient-boosted trees, procedural data, obsessive label hygiene. The exciting part isn't the architecture. It's that estimators get hours of their week back.
