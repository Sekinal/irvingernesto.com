---
title: SteelEye
tagline: An operating system for steel contractors, with ML that reads construction blueprints vector-natively.
role: Main Developer
year: 2025 → Now
order: 2
link: https://steeleye.ai
stack:
  - Next.js 16
  - React 19
  - TypeScript
  - Drizzle ORM
  - Python
  - XGBoost
  - LightGBM
  - PyMuPDF
  - PostgreSQL
metrics:
  - value: '0.77'
    label: Member-F1 on independent human gold
  - value: '373ms'
    label: Name every member on a 100K-token sheet
  - value: '98.7%'
    label: Tonnage reconciled vs NC1 across 4 projects
  - value: '9'
    label: Structural member classes
summary: >
  SteelEye is the operating system a steel contractor runs the whole shop on:
  estimating, job costing, real AIA pay-application billing, WIP, cash forecasting.
  I'm the main developer, and I built the ML program that reads structural
  blueprints. This is also the story of how I shipped a 0.98 and then proved
  myself wrong.
---

## The product

Steel contractors run million-dollar projects on disconnected spreadsheets. Bids depend on memory, field cost drift shows up too late, and leadership never has one trusted number. SteelEye is the operating system for the whole shop: estimating, job costing, real AIA G702/G703 pay-application billing (schedule-of-values gating, previous-application roll-forward), WIP, AR/AP aging, cash forecasting, payroll, and capacity planning across roughly 60 app routes. It ships bilingual EN/ES.

I'm the main developer: Next.js 16 and React 19 on the front, Drizzle ORM over PostgreSQL, pdfjs-dist and zod on the document path, argon2 auth, AWS S3 for storage, plus a fleet of Python services for the document intelligence work.

## Reading the blueprint as text

The part I'm proudest of is the ML program behind takeoff automation: detecting every structural member on CAD plan sheets (erection, anchor, framing, foundation, detail) and assigning each its correct AISC section name.

The insight is that a CAD-generated PDF blueprint is already text. It carries its own selectable text tokens with coordinates and its own line geometry. So instead of rasterizing the page and running OCR, the system works vector-natively: PyMuPDF pulls the PDF's own primitives directly, and OCR is only a fallback. The blueprint is already text; we just stopped rasterizing it.

Ground truth comes from DSTV NC1 files, the CNC fabrication files the shop actually cuts, parsed into a mark to {section, grade, length} answer key. On top of that sit independent human annotations in Label Studio, which are the truest gold.

## Shipping a 0.98, then proving myself wrong

The first end-to-end numbers were spectacular: 0.948 end-to-end F1, 0.987 member-F1. I do not report those numbers anymore, because I graded them honestly and they did not survive.

Those figures were scored against an auto-derived NC1-rule benchmark, and that benchmark turned out to be a near-deterministic function of the model's own input features. The model was mostly reproducing a learnable heuristic and grading its own homework. Regraded against independent human annotations on held-out gold (pages with members), the honest numbers are member-F1 ~0.77, class-accuracy ~0.89, and end-to-end ~0.78. The written conclusion in the repo is blunt: the 0.98 was an illusion of a self-consistent, easier benchmark. Don't chase 0.98.

That is the number I stand behind, and I think it reads as the stronger result.

## Trees beat transformers

The shipped model is not deep learning. It is two gradient-boosted heads (XGBoost on GPU, LightGBM on CPU): a binary is_member classifier and a 9-way class head over a taxonomy of column, beam, joist, joist_girder, brace, base_plate, deck, metal_framing, and connection. Each token becomes an 84-dimensional vector: 52 hand-engineered geometry and topology features concatenated with a 32-dimensional PCA-reduced e5-small-v2 embedding of the token string.

I tried the fashionable architectures and they lost. A set-transformer collapsed to class-accuracy ~0.08, below random. A GNN underperformed. A faithful implementation of the Hierarchical Reasoning Model reached class-accuracy 0.29 against the boosted trees' 0.92. On a vector-primitive tabular representation, boosted trees are simply the right tool.

## What actually moved the needle

- **The text embedding is the core signal.** Geometry-only features give member-F1 ~0.19. Adding the e5 embedding of the token string jumps it to ~0.31 and, more importantly, carries cross-fabricator transfer: a section string like `HSS5X5X1/4` embeds the same regardless of who drafted the sheet.
- **Small encoders beat big ones.** e5-small (33M) beat e5-base (109M) beat mxbai (335M). Large natural-language semantics overfit short technical codes.
- **The biggest single lever was not modeling.** A tokenizer regex bug was mislabeling joist, girder, and hyphenated base-plate marks as "other," so the model scored them near zero. Three regex fixes crossed the F1 0.6 target on their own.
- **Unicode fraction repair.** CAD PDFs emit stacked fractions in scrambled glyph order, so "1/4" arrives as "14/". A dedicated repair reconstructs power-of-two denominators.
- **Synthetic data as a representation lever, not a volume lever.** A procedural sheet generator with 64 style personas and adversarial decoys lifted novel-fabricator class-accuracy from ~0.49 to ~0.83. Diversity saturates around the persona count.

## The number that actually bills

Per-member length is noisy: only ~62% of members land within 20% of NC1 gold. But billing runs on total tonnage, and summed length is within ~1% of gold. Complete-project tonnage reconciliation against NC1 across four real projects ran 96.9% to 100%, averaging 98.7%. To back this, a separate catalog was scraped: AISC v15.0 (2,091 shapes) plus EU (IPE/HEA/HEB), UK Blue Book, AU/NZS, JIS, SJI joists, and SDI deck.

Speed holds up in production: 373 ms to predict member and class over 105,931 tokens on a single sheet on GPU, and a 16-config hyperparameter sweep fans across CPU and GPU in about 91 to 97 seconds.

## Outcome

SteelEye is live at [steeleye.ai](https://steeleye.ai), serving steel fabricators in US operations. The blueprint-reading pipeline turns hours of manual takeoff counting into minutes of review, and the tonnage number it produces reconciles against what the shop cuts. The honest end-to-end score is ~0.78 on human gold, and that is exactly the point: I would rather ship a real 0.78 than a benchmark's 0.98.
