---
title: SteelEye
tagline: An operating system for steel contractors, with ML that reads construction blueprints.
role: Main Developer
year: 2025 → Now
order: 2
link: https://steeleye.ai
stack:
  - Next.js
  - TypeScript
  - Python
  - XGBoost
  - LightGBM
  - PyTorch
  - PyMuPDF
  - PostgreSQL
  - Docker
metrics:
  - value: '0.95'
    label: End-to-end F1, member detection + naming
  - value: '0.987'
    label: Member detection F1 on gold test set
  - value: '90K+'
    label: Lines of code across platform + research
  - value: '12,850'
    label: Structural drawing pages in training corpus
summary: >
  SteelEye replaces the spreadsheet chaos of steel fabrication with one platform:
  pipeline, estimating, job costing, AIA billing, and executive reporting. I'm the
  main developer, and I built the ML research program that taught it to read
  structural drawings.
---

## The product

Steel contractors run million-dollar projects on disconnected spreadsheets. Bids depend on memory, field cost drift shows up too late, and leadership never has one trusted number. SteelEye unifies pipeline management, estimating, job costing, AIA billing (G702/G703 packages generated straight from project data), and financial reporting into a single system with role-based dashboards.

I'm the main developer of the platform: a Next.js + TypeScript application backed by PostgreSQL, with a fleet of Python microservices for the document-intelligence work: vector extraction, OCR, page classification, member detection, and callout detection.

## Teaching software to read blueprints

The part I'm proudest of is the ML research program behind SteelEye's takeoff automation: detecting **every structural member** (columns, beams, joists, braces, base plates, deck) on CAD construction drawings, and assigning each its correct AISC section name.

The twist: instead of treating drawings as images, the system works **vector-natively** on the PDF's own primitives: exact text tokens and line segments extracted with PyMuPDF. Ground truth comes from NC1 (DSTV CNC) fabrication files, so every prediction is validated against what the shop actually cut.

Some findings from ~200 research scripts and 33k lines of experiments:

- **Gradient-boosted trees beat deep learning here.** A tuned XGBoost/LightGBM stack on 84 engineered features (geometry, topology, PCA-reduced e5 text embeddings) reaches **0.948 end-to-end F1**, while transformers and GNNs collapse on cross-fabricator generalization, consistent with the CAD symbol-spotting literature.
- **Synthetic data as a representation lever, not a volume lever.** A procedural drawing generator with "style personas" and adversarial decoys lifted novel-fabricator accuracy from 0.57 to 0.78, and diversity saturates around 48 personas.
- **Label quality beats model capacity.** The single biggest fix in the whole program was a labeling correction: one positive token per member, not every token in its box.

The production detector ships as a versioned artifact pipeline with leave-one-project-out cross-validation, frozen gold test sets, and reproducible-from-scratch documentation.

## Outcome

SteelEye is live at [steeleye.ai](https://steeleye.ai), serving steel fabricators in US operations under the banner *"Track every dollar, protect every margin."* The blueprint-reading pipeline turns hours of manual takeoff counting into minutes of review.
