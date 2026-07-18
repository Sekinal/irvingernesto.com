---
title: RoomIQ
tagline: Market intelligence for room-rental investors. 600+ US cities, refreshed daily.
role: CTO & Co-founder
year: 2023 → Now
order: 1
link: https://roomiq.io
stack:
  - Python
  - Dagster
  - FastAPI
  - PostgreSQL
  - XGBoost
  - CatBoost
  - TabPFN
  - Chronos-2
  - Next.js 15
  - Redis
  - Stripe
  - Docker
metrics:
  - value: '80K+'
    label: Listings ingested every day
  - value: '600+'
    label: US cities covered
  - value: '6,600+'
    label: Active properties tracked live
  - value: '8.2%'
    label: Error on room-level rent forecasts
summary: >
  RoomIQ turns the chaotic co-living rental market into investable data: occupancy,
  pricing, and revenue analytics down to the individual room. I built the data
  platform as a freelancer, then became CTO. The pipeline, the ML, and the product
  are my baby.
---

## The product

Room-by-room rentals (co-living) are one of the highest-yield corners of US real estate, and one of the most opaque. There's no MLS for rooms. Investors underwrite six-figure decisions on gut feel and stale spreadsheets.

RoomIQ fixes that: track occupancy, pricing, and revenue across hundreds of US cities, analyze any property down to the room level, and forecast returns **before** you invest. Search a market, read its trends, rank its properties, then run an AI-powered revenue forecast on any address.

## The data platform

This started as a freelance data contract and grew into a company; I'm now CTO. The backbone is a **Dagster-orchestrated pipeline**: 44 assets across 21 scheduled jobs, ingesting 80,000+ listings daily into a star-schema PostgreSQL warehouse covering 116 metros, with freshness sensors, partition-level quality gates, and a 2,500-line scrape-quality reconciliation ledger that audits raw JSON against the warehouse every day.

The ingestion side uses request-budgeted, fingerprint-cloaked scrapers (raw-first, normalize-later), a Cloudflare R2 media mirror, and even FEMA flood-risk overlays as a property signal. Roughly 60,000 JSON documents parse into the warehouse in about 12 seconds across 8 parallel workers.

## The ML

Three model families do the heavy lifting:

- **Room-rent prediction**: an XGBoost regressor over 63 leakage-controlled features (target-encoded categoricals, K-Means geo-clusters, market aggregates computed from the training split only) hitting **8.2% MAPE** on held-out room-level rent.
- **A multi-expert revenue predictor** for cold-start properties: a coverage router dispatching between gradient-boosted specialists, retrieval-based comparables, Bayesian priors, and **in-context tabular foundation models (TabPFN, TabICL)**, emitting calibrated prediction intervals instead of point guesses.
- **Chronos-2 market forecasting**: weekly forward-looking forecasts of stock, price, occupancy, and revenue per city, with uncertainty bands and enforced metric identities. A fill-time model estimates 7/14/30-day fill probability and sweeps candidate prices to generate pricing guidance.

## The product surface

An 88-route FastAPI backend (Redis, SuperTokens auth, Stripe billing, rate limiting) serves a Next.js 15 dashboard with 260+ components: market KPIs, trend charts with private/shared bath breakdowns, metric-driven property ranking, and Leaflet vector maps with occupancy and revenue-coded clustering.

## The methodology stance

RoomIQ's differentiator is discipline, not dazzle: consistent filter scope across every tab, explicit date windows, and metrics that map one-to-one to dashboard fields. Every number is explainable, because people commit real capital against it. We even measured our own systematic bias (a 3.8% underestimation) and shipped an explicit calibration correction.

## Outcome

RoomIQ is live at [roomiq.io](https://roomiq.io) with free and Pro tiers, tracking 6,600+ active properties. What began as "can you scrape some listings?" is now the analytics layer an entire niche of real-estate investing was missing.
