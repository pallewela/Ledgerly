# Ledgerly

Calm, local-first personal finance for simpler households. Multi-currency
(**LKR / USD / AUD** from day one), no bank linking, no accounts, no data
leaving your device. Your money, on your device.

|              |                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Requirements | [`PRD.md`](./PRD.md) (v0.3)                                                                                                                       |
| Build plan   | [`PLAN.md`](./PLAN.md) (v0.2)                                                                                                                     |
| CI           | [![CI](https://github.com/pallewela/Ledgerly/actions/workflows/ci.yml/badge.svg)](https://github.com/pallewela/Ledgerly/actions/workflows/ci.yml) |

## Stage roadmap

Built in defined stages (PLAN.md §5–§7). Stage exits are gates, not dates.

| Stage                 | Scope                                                                                                                                                                                                                             | Status         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 0 — Foundation        | SvelteKit 2 SPA scaffold, TS strict, Tailwind 4, Vitest, ESLint/Prettier, GitHub Actions CI, repo                                                                                                                                 | ✅ done        |
| 1 — Contracts         | Domain types, currency core (ISO 4217, minor units), repository + engine interfaces, memory repository (Gate G1 freeze)                                                                                                           | ✅ done        |
| 2 — Core build-out    | Engine (accounts, transactions, splits, transfers, net worth, rules, payee memory, budgets, bills), IndexedDB storage + snapshot export/restore, CSV import pipeline (locale-aware numbers, date detection, dedupe, review, undo) | ✅ done        |
| 3 — UI foundation     | Dashboard, transactions, accounts, quick entry, import wizard + review, budgets, bills, settings                                                                                                                                  | ✅ done        |
| 4 — Hardening         | Installable PWA, offline shell + offline UX, focus/a11y pass                                                                                                                                                                      | ✅ done        |
| 5 — Statement imports | PDF text-layer parsing, OCR screenshots, receipts, parser templates, share-sheet intake                                                                                                                                           | 🟡 in progress |
| 6 — Private beta      | Dogfood polish, golden-file corpus growth, diagnostics                                                                                                                                                                            | ⬜ planned     |
| 7 — Public beta       | Landing, terms, name clearance, launch                                                                                                                                                                                            | ⬜ planned     |

**Implementation status (2026-10-20):** Stages 0–4 are complete and green. Stage 5 is in progress: **PDF text-layer import** (PDF.js, on-device) and **screenshot OCR** (Tesseract, multi-image, on-device) now feed the same review → commit pipeline as CSV, with per-row skip and duplicate flags. 70 unit/integration tests pass (including a real generated-PDF fixture), and lint, typecheck, build and CI are green.

**Known gaps before private beta:** receipt capture, parser templates + suggested categories in the import review (FR-3.7/3.8), share-sheet intake, rules / categories / transfer management screens. Push notifications stay deferred to V1.1 (web push needs a relay service; the core loop is local-first).

## Quick start

```bash
npm install
npm run dev        # local dev server
npm test           # unit + component tests (vitest)
npm run check      # typecheck (svelte-check)
npm run lint       # prettier + eslint
npm run build      # production build → build/
```

## Architecture

Local-first SPA (SvelteKit 2 + Svelte 5, adapter-static fallback). One hard
rule: the UI consumes the **engine facade only**; storage and parsers sit
behind it. All domain modules are pure TypeScript — no Svelte imports — so
they run in workers and test in plain node.

```
src/lib/engine     domain core: contracts (frozen), currency, ledger logic
src/lib/storage    IndexedDB repository + snapshot export/restore
src/lib/import     CSV parsing → ImportPlan → review → commit (PDF/OCR: stage 5)
src/lib/app        svelte stores wiring engine + storage into the UI
src/routes         SvelteKit routes (dashboard, transactions, accounts, …)
```

### Money rules (non-negotiable)

- Amounts are **integer minor units** in the **account's own currency** — never floats.
- Transactions are signed in **account direction**: positive = money in, negative = money out.
- **No silent currency conversion.** Conversion happens only at the report
  layer with an explicit, dated `FxRateTable`; missing rates are surfaced, never guessed.
- Budgets are denominated in the user's **base currency**.

### Engineering standards

- TypeScript strict; trunk-based; every PR: lint + typecheck + tests + build green (CI enforces).
- Domain modules carry unit + property-style tests (split sums, transfer-neutral
  net worth, idempotent imports). Tests live next to the code in `__tests__/`.
- Contracts are frozen at `src/lib/engine/{types,util,currency,repository,api}.ts`;
  changes require a plan review (PLAN.md §13 working agreements).

## Data ownership

Full export (JSON snapshot + CSVs) is a day-one feature, self-serve, free.
Delete-all removes everything irrecoverably. See PRD FR-8.x.
