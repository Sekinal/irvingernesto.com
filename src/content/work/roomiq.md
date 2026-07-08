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
  - scikit-learn
  - Next.js
  - Docker
  - Stripe
metrics:
  - value: '80K+'
    label: Listings ingested every day
  - value: '600+'
    label: US cities covered
  - value: '11%'
    label: MAE on revenue prediction
  - value: '6,600+'
    label: Active properties tracked
summary: >
  RoomIQ turns the chaotic co-living rental market into investable data: occupancy,
  pricing, and revenue analytics down to the individual room. I built the data
  platform as a freelancer, then became CTO. The pipeline, the ML, and the product
  are my baby.
---

## The product

Room-by-room rentals (co-living) are one of the highest-yield corners of US real estate, and one of the most opaque. There's no MLS for rooms. Investors underwrite six-figure decisions on gut feel and stale spreadsheets.

RoomIQ fixes that: track occupancy, pricing, and revenue across hundreds of US cities, analyze any property down to the room level, and forecast returns **before** you invest. Search a market, read its trends, rank its properties, then run an AI-powered revenue forecast on any address.

## The engineering

This started as a freelance data contract and grew into a company; I'm now CTO. The platform I built runs on:

- **A Dagster-orchestrated pipeline** ingesting 80,000+ listings daily from co-living marketplaces, with scrapers hardened against bot protection, deduplication, and normalization into a warehouse-grade star schema on PostgreSQL.
- **ML revenue prediction** achieving ~11% MAE (good enough to underwrite with) using calibrated models over room-level features, market comparables, and seasonality.
- **Weekly forecast systems** with confidence bands, so investors see uncertainty instead of false precision.
- **A FastAPI analytics layer** feeding the dashboard: market KPIs, trend charts with private/shared bath breakdowns, metric-driven property ranking, and an interactive map with occupancy/revenue-coded clustering.
- **Full SaaS machinery**: auth, Stripe subscriptions with trial gating, role-based module access, and Docker-based deployment.

## The methodology stance

RoomIQ's differentiator is discipline, not dazzle: consistent filter scope across every tab, explicit date windows, and metrics that map one-to-one to dashboard fields. Every number is explainable, because people commit real capital against it.

## Outcome

RoomIQ is live at [roomiq.io](https://roomiq.io) with free and Pro tiers, tracking 6,600+ active properties. What began as "can you scrape some listings?" became the analytics layer an entire niche of real-estate investing was missing.
