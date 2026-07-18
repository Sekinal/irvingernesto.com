---
title: SteelEye
tagline: An operating system for steel contractors, with ML that reads construction blueprints.
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
  - PyMuPDF
  - PostgreSQL
metrics:
  - value: '98.7%'
    label: Tonnage reconciled vs the shop's cut files
  - value: '373ms'
    label: To read and name a full drawing sheet
  - value: 'Hrs → min'
    label: Manual takeoff turned into review
  - value: 'EN / ES'
    label: Estimating through AIA billing, bilingual
summary: >
  SteelEye is the operating system a steel contractor runs the whole shop on:
  estimating, job costing, real AIA pay-application billing, WIP, cash forecasting.
  I'm the main developer, and I built the ML that reads structural blueprints and
  automates takeoff, producing a tonnage number that reconciles against what the
  shop actually cuts.
---

## The product

Steel contractors run million-dollar projects on disconnected spreadsheets. Bids depend on memory, field cost drift shows up too late, and leadership never has one trusted number. SteelEye is the operating system for the whole shop: estimating, job costing, real AIA G702/G703 pay-application billing (schedule-of-values gating, previous-application roll-forward), WIP, AR/AP aging, cash forecasting, payroll, and capacity planning across roughly 60 screens. It ships bilingual EN/ES.

I'm the main developer: Next.js 16 and React 19 on the front, Drizzle ORM over PostgreSQL, argon2 auth, AWS S3 for storage, plus a fleet of Python services for the document-intelligence work.

## Reading the blueprint

The part I'm proudest of is the takeoff automation: given a structural drawing, find every placed member (columns, beams, joists, braces, base plates, deck) and assign each its correct AISC section name. Estimators do this by hand today, page by page, and million-dollar bids ride on getting it right.

The insight that makes it work is that a CAD-generated PDF is already text. It carries its own selectable labels with coordinates and its own line geometry, so instead of rasterizing the page and running OCR, the system reads the drawing's real primitives directly with PyMuPDF. The model itself is deliberately boring: gradient-boosted trees (XGBoost) over hand-engineered geometry features plus a small text embedding of each label. It runs in 373 ms on a full sheet, no GPU required in production.

## Accuracy that reconciles to the shop

The number that matters to a fabricator is not a machine-learning score, it is tonnage, because tonnage is what they bill and buy steel against. So that is what I hold the system to. Ground truth comes from the DSTV NC1 files the shop's CNC machines actually cut from, and across four complete real projects the total tonnage the pipeline recovers lands within about 1% of those files, from 96.9% to 100%, averaging 98.7%. The takeoff a person spends hours on becomes minutes of review, against a number that ties out to the shop floor.

## Outcome

SteelEye is live at [steeleye.ai](https://steeleye.ai), serving steel fabricators in US operations. It replaces a stack of disconnected spreadsheets with one system that runs from the first estimate through AIA billing, and it turns the slowest, most error-prone step, counting and naming every member on every sheet, into a fast review against a number the shop trusts.
