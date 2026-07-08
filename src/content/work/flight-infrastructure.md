---
title: Flight Data Infra
tagline: Reverse-engineering enterprise bot protection for airline data at scale.
role: Data Engineer · FindMyFlight.ai
year: 2025 → Now
order: 4
stack:
  - Python
  - curl_cffi
  - Camoufox
  - Litestar
  - APK Reverse Engineering
  - TLS Fingerprinting
  - Proxy Orchestration
metrics:
  - value: '10x'
    label: Faster than the previous pipeline
  - value: '6s'
    label: For 20 routes (down from 60s)
  - value: '1st'
    label: Place in the hiring contest that started it
  - value: '7+'
    label: Airline & travel targets in production
summary: >
  Recruited after winning a scraper performance contest, I build the data
  infrastructure behind FindMyFlight.ai, bypassing enterprise-grade bot
  protection with hybrid browser/HTTP architectures and mobile API
  reverse engineering.
---

## The contest

FindMyFlight.ai hired me after I won their flight-scraper performance contest. The winning design became the production architecture.

## The architecture

Airline websites sit behind **Akamai Bot Manager**: enterprise-grade protection that fingerprints your TLS handshake, your browser, and your behavior. The naive answer is browser automation for everything, which is why the old pipeline took 60 seconds for 20 routes.

My approach splits the problem:

1. **Camoufox** (a hardened Firefox) performs the expensive ritual once, passing the challenge and harvesting valid cookies.
2. **curl_cffi** impersonates the browser's exact TLS fingerprint and replays those cookies across dozens of concurrent, lightweight HTTP requests.

Same data, **6 seconds instead of 60**: a 10x improvement that holds under concurrency.

Where the web is too hostile, I go around it: decompiling airline **mobile APKs** to find internal API endpoints with weaker protection, then building clean typed clients against them. The pipelines ship behind production **Litestar** APIs with proxy orchestration and monitoring, covering major US carriers and Mexican bus operators alike.

## The craft

This work is equal parts systems engineering and forensics: TLS fingerprints, HTTP/2 frame ordering, certificate pinning, obfuscated JavaScript challenges. It rewards the same instinct physics does. The system is a black box emitting signals, and your job is to build the model that explains them.
