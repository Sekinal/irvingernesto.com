---
title: Flight Data Infra
tagline: One API, six airlines, six different locked doors. The data platform behind FindMyFlight.ai.
role: Data Engineer · FindMyFlight.ai
year: '2025'
order: 4
stack:
  - Python
  - curl_cffi
  - Camoufox
  - Litestar
  - Celery
  - Redis
  - PostgreSQL
  - TLS Fingerprinting
  - Proxy Orchestration
metrics:
  - value: '6'
    label: Airlines, six escalating techniques
  - value: '10-20x'
    label: Throughput vs sequential search
  - value: '<100ms'
    label: Cached API responses, never scrapes
  - value: '>95%'
    label: Cookie-session success rate
summary: >
  FindMyFlight.ai recruited me after I won their scraper performance contest.
  I built the data infrastructure behind it: independent per-airline scrapers
  feeding a unified aggregation API on PostgreSQL, Redis, and Celery. The
  scrapers and the API worked; the product was later shelved when the client's
  funding ran out. What stands is the engineering: one API, six airlines, six
  different locked doors.
---

## The contest

FindMyFlight.ai found me through a scraper performance contest. My American Airlines scraper won, and that scraper became a published, Dockerized, MIT-licensed artifact with a real test suite, down to a regression test that pins the request signature so a silent upstream change can't rot it. Winning the contest got me the role. The philosophy behind the win became the architecture.

## One API, six locked doors

The platform pulled award-flight availability across six airlines: United, Qantas, Alaska, Delta, American, and JetBlue. Every one of them is a different building with a different lock, and the mistake most people make is buying one skeleton key (a full stealth browser) and using it on every door. That is slow, and it is louder than it needs to be.

I meet each target with the minimum-necessary technique for its defense posture, and I respect what each site is defending. The result is a deliberate spectrum:

- **United**: pure HTTP against a mobile-app API path. No browser at all.
- **Alaska and JetBlue**: TLS-fingerprint impersonation with a cloaking client (curl_cffi), still no browser.
- **American**: an HTTP client plus rotating proxies against a CDN-bot-managed endpoint, with programmatic handling of the challenge lifecycle. The client knows the difference between a challenge it can solve and a hard IP block it should back off from.
- **Delta and Qantas**: a full hardened stealth browser (Camoufox) running in-page GraphQL fetches, used only where a fingerprint-only approach isn't reliable.

The cheapest technique that actually holds is the right one. The browser is the last resort, not the default.

## Scale browsers, not requests

The counterintuitive idea that won the contest: when you need throughput, don't crank raw concurrency, model more independent users. Each cookie-session is its own browser identity with its own warmed-up cookies, and a fleet of distinct identities survives blocking far longer than one identity hammering an endpoint faster.

A full Award-plus-Revenue search on a single route lands in about 5 to 6 seconds after cookie warmup. Ten routes concurrently finish in about 6 to 8 seconds, versus 50 to 60 sequential: a 10 to 20x speedup. Cookie extraction clears 95% and API search clears 98%.

## The resilience stack

Every scraper reuses one shared spine. An adaptive token-bucket rate limiter tuned to each target's real tolerance, not a guess: one airline returns HTTP 406 above roughly 8 requests a minute, so I throttle it to about 9 and stop there. A circuit breaker opens after N consecutive failures so a struggling target doesn't drag the fleet down. Exponential backoff with jitter smooths the retries. A load-test harness drives 15 concurrent live routes so I find the ceiling before production does.

Coherence is the detail that separates a working scraper from a durable one. The HTTP client impersonates the exact browser version that mints the cookies, with matched header ordering, so both layers tell one consistent story instead of two contradictory ones.

## The aggregation API

The scrapers feed a single Litestar (async Python) API, packaged with uv and deployed via Docker Compose behind a Cloudflare Tunnel. The core is a strict cache-aside split: a cached search endpoint answers in under 100ms and never scrapes, while a realtime endpoint always scrapes and repopulates a Redis cache (TTL defaults to 4 hours, up to 3 days).

An orchestrator fans out to every requested airline with `asyncio.gather`, bridges blocking Celery results back into the async world, and enforces per-airline timeouts (browser-backed targets get a longer budget than HTTP ones, because they've earned it). Underneath sits PostgreSQL 16 with typed SQLAlchemy 2.0 models. The `price_history` table keeps raw JSON alongside normalized fields and carries three composite indexes built for the queries we actually run: route-plus-date, airline-plus-cabin, and trend. Schema driven by query patterns, not by hope. There's also an LLM natural-language front end that tool-calls the scrapers directly.

## The wider surface

Past the six core airlines there are more targets, points and award aggregators among them, so the real reverse-engineering surface is closer to ten. For the hardest of those, a separate multi-provider unblocking pipeline chains several commercial backends as ordered cost-versus-reliability fallbacks: try the cheap path first, escalate only when it fails.

Deploy discipline holds the whole thing together. Server checkouts are immutable and read-only, reset via git rather than edited in place. A deploy script runs health, readiness, and search verification across both servers before anything goes live, and scheduled scrapes run only on staging.

## How it ended

The product did not survive. The client ran out of money and FindMyFlight was shelved before it became a business. The engineering is what I keep from it: the scrapers worked, the API worked, and the contest-winning idea held up under load. Not every good build ships, and this one is worth showing anyway.

## The craft

This work is equal parts systems engineering and forensics. A target is a black box emitting signals, and the job is to build the model that explains them, then choose the lightest tool that fits. It rewards restraint: the elegant answer is almost never the biggest hammer, it is the smallest one that still opens the door.
