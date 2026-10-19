# Build Plan — Ledgerly (working title), Lite edition

|         |                                                                        |
| ------- | ---------------------------------------------------------------------- |
| Version | 0.2 — Draft for review                                                 |
| Date    | 2026-10-19                                                             |
| Status  | Awaiting review                                                        |
| Input   | `PRD.md` v0.3 (sole basis; `PRD_IGNORED.md` is parked and not used)    |
| Team    | 2–3 builders (calibrated for 3; scaling notes included)                |
| Clock   | Sprints start Monday 2026-10-19; public beta target week of 2027-01-11 |

---

## 0. How to read this plan

- **§1** records decisions you made on 2026-10-19; **§2** lists what this plan assumes without asking.
- **§5–§8** are the build: workstreams (with FR traceability), then a sprint-by-sprint schedule with exit gates.
- **§13** is the open-questions register. Questions raised during building are _not_ blockers — they are parked there with an owner and a decide-by gate, so nothing stalls mid-sprint. We answer them at the stated gate.
- **Cadence rule:** this plan is re-baselined at every milestone gate (§8). Estimates are ±30%; gates, not dates, are commitments.

---

## 1. Clarified decisions (Q&A, 2026-10-19)

| ID  | Decision                                                                                                                                                  | Consequence for this plan                                                                                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Team of 2–3.** Plan calibrated for 3 builders; §7 notes the 2-person variant.                                                                           | Parallel workstreams with explicit contract freeze and integration gates (§7 gates G0–G11).                                                                                                                      |
| D2  | **SvelteKit** instead of the PRD's React proposal.                                                                                                        | Stack table in §4; PRD.md §9 updated to match.                                                                                                                                                                   |
| D3  | **Foundation-first sequencing.** Correctness core (storage + ledger engine, fully tested) precedes feature UI; no UI work builds on an unfinished engine. | UI person runs a parallel design-system + mock-adapter track behind a frozen Engine API (§5.3), so foundation-first does not idle anyone. Dogfood gate shifts T+4 → T+5; absorbed by later buffer (§8).          |
| D4  | **Real statement samples exist** and will be contributed early.                                                                                           | Golden-file corpus is a Sprint-0 activity with a defined sanitization procedure (§9.3) — the single biggest de-risker for the import pipeline (PRD risk R1).                                                     |
| D5  | **Multi-currency from the start** (user directive, 2026-10-19): LKR, USD, AUD at minimum.                                                                 | Per-account currency + base-currency reporting from Sprint 1 (A5; PRD v0.3 FR-1.7/FR-7.5/NFR-7); +6 pd across W1/W2/W4/W5/W6 → demand ≈ 106 pd; FX policy parked as Q-B21, cross-currency transactions as Q-B22. |

---

## 2. Assumptions & constraints

| ID  | Assumption                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | Builders can commit roughly 5 focused days/week each for the sprint window (focus factor 0.75 applied in §7 capacity math).                                                                                                                                                                                                                                                                                                                                        |
| A2  | Team knows, or ramps quickly on, Svelte 5 runes; verify in Sprint 0 (Q-B14) before estimates are trusted.                                                                                                                                                                                                                                                                                                                                                          |
| A3  | MVP needs no backend beyond static file hosting + CI: local-first, no accounts, no sync (PRD §7.8; sync is V1.1).                                                                                                                                                                                                                                                                                                                                                  |
| A4  | Hosting is a static PWA host with HTTPS (PWA install/share/push all require it). Default Cloudflare Pages; confirm Q-B2 in Sprint 0.                                                                                                                                                                                                                                                                                                                               |
| A5  | **Multi-currency from day one (D5):** LKR, USD, AUD at minimum, via an ISO 4217 currency table with per-currency minor-unit exponents (all three minimum currencies use ×100). Amounts are integer minor units in the **account's currency**; no silent conversion — conversion to a user-chosen base currency happens only at the report/net-worth layer, using cached FX rates (offline-first: last-known rate with a visible as-of date, plus manual override). |
| A6  | Only P0 FRs are in scope for M0–M2. P1s land in V1.1 (§14) unless a P1 is the cheapest way to satisfy a P0 (then it needs an explicit note in the sprint).                                                                                                                                                                                                                                                                                                         |
| A7  | Repo is private. If open-sourcing is ever considered, that is a V2+ decision (Q-B19).                                                                                                                                                                                                                                                                                                                                                                              |
| A8  | Estimates are ideal person-days; total demand ≈ 106 pd (incl. +6 pd multi-currency, D5); capacity math in §6. Re-plan at gates.                                                                                                                                                                                                                                                                                                                                    |

---

## 3. Team model, roles & ownership

| Role            | Focus                                                                         | Owns                         | Backup |
| --------------- | ----------------------------------------------------------------------------- | ---------------------------- | ------ |
| **Engine**      | Storage, ledger domain, categories/rules, reports computation, export/restore | W1, W2, W3, W6 (computation) | Parser |
| **Parser**      | CSV/PDF/OCR pipeline, dedupe, templates, corpus owner                         | W0 corpus, W4                | Engine |
| **UI/Platform** | Design system, all screens, PWA platform, accessibility                       | W5, W7, W8                   | Engine |

**2-person variant:** merge Engine + Parser into one role ("Core"), keep UI/Platform. Capacity math (§7.2) then requires either +3 weeks or trimming push alerts and payee cleanup to V1.1.

**Cross-cutting, owned by all three:** domain contracts review (Gate G1), golden-corpus regression before every merge, weekly plan review (Mondays, 30 min).

---

## 4. Tech stack (SvelteKit edition)

| Layer     | Choice                                                                                                                     | Used for                                         | FR/NFR trace             |
| --------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------ |
| Framework | SvelteKit 2 + Svelte 5 (runes), TypeScript strict, adapter-static **SPA mode**                                             | App shell; no SSR — local-first client           | FR-9.1–9.4               |
| Styling   | Tailwind CSS + design tokens; component kit TBD (shadcn-svelte vs Skeleton vs custom — Q-B5)                               | Calm-dashboard design language                   | PRD §10                  |
| State     | Svelte 5 runes + stores; **engine is framework-agnostic TypeScript** behind the Engine API                                 | UI never touches storage directly                | §5.3                     |
| Storage   | **Dexie / IndexedDB** (decided at Q-B1, 2026-10-19); a SQLite-WASM/OPFS adapter remains possible behind `LedgerRepository` | Ledger of record, atomic writes, snapshot export | FR-8.1–8.6, NFR-2, NFR-8 |
| Parsing   | PapaParse (CSV), PDF.js (text layer), Tesseract.js (OCR) — **all inside Web Workers**                                      | Import pipeline, receipts                        | FR-3.1–3.4, NFR-4        |
| PWA       | @vite-pwa/sveltekit (Workbox under the hood)                                                                               | Install, offline shell, share target, push       | FR-9.1, 9.2, 9.5         |
| Tests     | Vitest (unit), @testing-library/svelte (component), Playwright (E2E), axe-core (a11y), Lighthouse CI (perf budgets)        | §9 quality gates                                 | NFR-4, 6, 9              |
| CI/CD     | GitHub Actions; preview deploy per PR; Cloudflare Pages (Q-B2)                                                             | §10                                              | NFR-8                    |

**Architecture summary:** one SvelteKit app, three hard module boundaries — `src/lib/engine` (pure TS domain logic, zero Svelte imports), `src/lib/storage` (persistence + snapshots), `src/lib/import` (parsers, dedupe, templates — pure). Heavy work lives in workers; the UI imports only the Engine API and typed DTOs.

---

## 5. Workstreams

Estimates are ideal person-days (pd). Total demand ≈ **106 pd** (100 core + 6 multi-currency per D5).

### W0 — Setup, contracts & corpus intake · 4 pd

- Repo, CI (lint/typecheck/unit/build), Cloudflare Pages + PR preview deploys, SvelteKit skeleton (SPA + PWA shell), Tailwind + token stub.
- **Domain contracts:** `Account`, `Transaction`, `Split`, `Category`, `Rule`, `PayeeMemory`, `Budget`, `Bill`, `ImportBatch`, `Template`, `Settings`; Engine API interface (create/read/update/commit, batch import, undo).
- **Corpus intake:** collect D4 statement samples; sanitization procedure (§9.3); fixture harness skeleton.
- Storage bake-off spike (Q-B1), component-kit decision (Q-B5).
- DoD: CI green; app deploys to preview URL; contracts merged (Gate G1 ready); ≥ 20 sanitized fixtures committed; storage decision written up.

### W1 — Storage engine & export/restore · 8 pd

- Schema + migrations: ISO 4217 currency table, per-account currency (FR-1.7), FX-rate store, integer minor units (A5); atomic commit journal (WAL); query layer.
- Full export (JSON snapshot + CSVs) and restore round-trip (FR-8.2, FR-8.3); format versioning policy (Q-B8).
- Persistent-storage request + storage-usage API (FR-8.1).
- DoD: export→restore round-trip is a CI test; simulated crash mid-commit loses nothing (NFR-2).

### W2 — Ledger domain core · 13 pd

- Accounts CRUD, types, currency, balances, balance history, net worth (FR-1.1–1.7): per-currency subtotals, converted to base currency only at the reporting edge.
- FX service: fetch-when-online, cache, as-of labels, manual override (source per Q-B21).
- Transactions: entry, edit, delete, n-way splits, transfer pairing (FR-2.1–2.4); recurring markers (FR-2.5, cheap in engine — P1, build only if free).
- DoD: ≥ 80% unit coverage; property tests (splits sum to whole; net worth invariant under transfers; no cross-currency netting — mixed-currency totals only via explicit, dated conversion).

### W3 — Categories, rules & memory · 7 pd

- Category tree CRUD + archive semantics (FR-4.1); ordered rules engine with "preview last 90 days" tester (FR-4.3).
- Payee memory + deterministic suggestion chain with human-readable reasons (FR-4.2); review queue logic (FR-4.4).
- DoD: suggestion chain is fully explainable; rule engine shares one implementation client-side.

### W4 — Import pipeline (the product) · 29 pd

- CSV wizard: parser, mapping, date-format detection, locale/currency-aware number parsing (`1,234.56` / `1 234,56` / `Rs`·`$`·`A$` markers) (FR-3.1) · 4 pd.
- Universal review screen + batch commit + per-row confidence (FR-3.5) · 5 pd.
- Dedupe fingerprinting (existing + intra-import) (FR-3.6) · 2 pd.
- Import history + per-import undo (FR-3.11) · 2 pd.
- PDF text-layer extraction + row grammar (FR-3.2 text path) · 5 pd.
- OCR pipeline: Tesseract worker, layout→rows, multi-screenshot merge & overlap dedupe (FR-3.3), scanned-PDF route (FR-3.2) · 6 pd.
- Receipt capture, 3-tap confirm (FR-3.4) · 2 pd.
- Templates: save/apply/teach (FR-3.7, FR-3.8) · 3 pd.
- DoD: golden-corpus regression green (targets per PRD §5.3); imports never write unreviewed rows.

### W5 — UI foundation · 17 pd

- App shell + Home dashboard (net worth, this month, bills, needs-attention) · 5 pd.
- Transactions screen (list, search/filter, edit, split) · 4 pd.
- Quick manual entry ≤ 10 s (FR-2.1 UX) · 2 pd.
- Accounts (incl. currency picker), Budgets, Bills, Settings (incl. base-currency choice) screens; mixed-currency lists show native amounts with base-currency totals · 6 pd.
- DoD: every screen has designed empty/loading/error/offline states (PRD §10).

### W6 — Reports · 9 pd

- Income vs. expenses; spending by category/payee with period compare; net-worth trend (FR-7.1–7.3) · computation in engine, charts in UI.
- Base-currency conversion for all reports with visible as-of rate + per-currency breakdown toggle (FR-7.5) · 2 pd.
- CSV export + print-friendly (FR-7.4, P1 — include only if free).
- DoD: verified against dogfood data (tie to real month close).

### W7 — PWA platform · 9 pd

- Offline core-loop audit; install flow; storage persistence + eviction guard + backup nudges (FR-9.2, FR-8.4).
- Share-target intake (Android/Chrome) + iOS in-app camera/file picker (FR-3.9, FR-3.10).
- Push notifications + quiet hours (FR-9.5, FR-5.4) — scope per Q-B9.
- DoD: Lighthouse PWA installability + offline checks green; NFR-8 browser matrix pass.

### W8 — Quality & release · 10 pd

- Accessibility pass (axe + manual keyboard/screen reader) — WCAG 2.1 AA (NFR-6).
- Performance pass: route-level lazy loading of PDF.js/Tesseract/SQLite; budgets from NFR-4 enforced in CI.
- E2E suite (critical flows, PRD Appendix A US-1..US-9); diagnostics page (NFR-9); sample dataset (Q-B7); help content; terms/privacy (NFR-10).
- DoD: all NFR gates measured green; RC signed (Gate G11).

---

## 6. Sprint schedule (3 builders, 1-week sprints)

Capacity math: 13 weeks × 5 days × 3 people × 0.75 focus ≈ **145 pd available** vs **106 pd demand** → ~27% headroom for the holiday dip, beta feedback, and estimate error. **2-person variant:** ≈ 97 pd vs 106 pd demand — now over capacity: either stretch M2 by ~1–2 weeks or take the trim list (push alerts, payee cleanup, report CSV/print → V1.1); decision at Gate G4.

| Sprint | Dates (2026) | Engine (Core)                                        | Parser (Import)                                        | UI/Platform                                                          | Gate                                                                                              |
| ------ | ------------ | ---------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| S0     | Oct 19–25    | W0 setup; W1 bake-off                                | W0 corpus + sanitization                               | W0 PWA shell, tokens, wireframes (dashboard, transactions, review)   | G0: contracts merged; storage decided (Q-B1); ≥20 fixtures in                                     |
| S1     | Oct 26–Nov 1 | W1 storage (currency + FX schema); export/restore v1 | CSV parser engine + golden tests                       | Design system basics; screens w/ mock adapter                        | G1: Engine API v0 frozen (incl. currency semantics; Q-B21 answered); export→restore CI test green |
| S2     | Nov 2–8      | W2 accounts + currency, transactions, splits         | Dedupe + transfer-pair functions                       | Quick entry UX; transactions list + filters                          | G2: ledger core complete vs contracts, ≥80% coverage                                              |
| S3     | Nov 9–15     | Balances/net-worth; W3 categories + rules            | CSV wizard + review screen wiring; import history/undo | Dashboard v1; accounts; bulk categorize                              | G3: real CSV → review → commit → dashboard, end-to-end                                            |
| S4     | Nov 16–22    | Payee memory + suggestion chain                      | PDF text-layer parser; templates v1                    | Budgets; bills; settings v1                                          | **G4 = M0 gate (T+5): dogfood live, zero data loss**                                              |
| S5     | Nov 23–29    | Reports computation                                  | OCR pipeline; multi-screenshot merge; receipts         | Review polish; confidence UI; teachable-correction toasts            | G5: screenshots ≥75% rows on 3 real apps (corpus)                                                 |
| S6     | Nov 30–Dec 6 | Dogfood fixes                                        | Parser hardening vs corpus                             | Onboarding ≤15 min; sample-data mode; opt-in analytics (Q-B10)       | **G6 = M1 gate (T+7): private beta live**                                                         |
| S7     | Dec 7–13     | Offline audit; persistence guard; backup nudges      | Share target (Android) + iOS picker; multi-file import | Camera capture; push infra (Q-B9)                                    | G7: offline core loop green on Android Chrome + iOS Safari                                        |
| S8     | Dec 14–20    | Perf fixes (engine)                                  | Lazy-load workers; OCR perf                            | A11y pass; E2E suite; Lighthouse budgets in CI                       | G8: NFR gates green (NFR-4, 6, 8)                                                                 |
| S9     | Dec 21–27    | **Holiday buffer:** bug-fix only                     | (same)                                                 | (same)                                                               | —                                                                                                 |
| S10    | Dec 28–Jan 3 | **Holiday buffer:** bug-fix only                     | (same)                                                 | (same)                                                               | —                                                                                                 |
| S11    | Jan 4–10     | Delete-all-data; final regression                    | Corpus regression; final templates                     | RC: diagnostics page; help; sample dataset (Q-B7); terms/name (Q-B3) | G11: RC signed off                                                                                |
| S12    | Jan 11–17    | Launch week                                          | (monitoring)                                           | Public launch checklist: domain, landing, feedback channel           | **G12 = M2 gate: public beta (T+12)**                                                             |

---

## 7. Milestone gates & exit criteria (from PRD §11, §5.3)

| Gate                 | When      | Exit criteria — gate does not pass unless all are met                                                                                                                                                            |
| -------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G4 · M0 Dogfood      | Nov 22    | Our households' real money tracked weekly, across mixed currencies (LKR + USD at minimum); zero data-loss incidents (NFR-2); export/restore used for real; activation flow ≤ 15 min on two devices               |
| G6 · M1 Private beta | Dec 6     | 5–10 external households onboarded; import accuracy ≥ 90% (text PDFs) / ≥ 75% (screenshots) on corpus; duplicates < 1%; monthly ritual ≤ 10 min measured; opt-in analytics live                                  |
| G12 · M2 Public beta | Jan 11–17 | Activation ≥ 70%; crash-free ≥ 99.5%; WCAG 2.1 AA verified; PWA offline green; terms + privacy live; name/domain resolved (Q-B3)                                                                                 |
| V1.1                 | Feb 2027  | Opt-in E2E sync (Q-B11 spike first); safe-to-spend (FR-5.5); recurring detection (FR-6.2); rollover (FR-5.3); payee cleanup (FR-4.5); receipt attachments (FR-2.6); report CSV/print (FR-7.4); app-lock (FR-8.7) |
| V1.2                 | Apr 2027  | Multi-user households; missed-bill detection (FR-6.3)                                                                                                                                                            |
| V2                   | later     | Manual investments, multi-currency, template sharing (Q-B12), aggregation decision gate (PRD §13, Q-B17)                                                                                                         |

---

## 8. Test strategy & the golden-file corpus

**Layers**

1. **Unit (Vitest)** — ≥ 80% on `engine` and `import` cores; property tests for ledger invariants (split sums, transfer-neutral net worth, idempotent import commits, no cross-currency netting); FX conversion tests with fixed-rate fixtures.
2. **Golden-file corpus** — per-bank fixtures: sanitized input (CSV/PDF/screenshot) + expected parse output JSON. Regression is mandatory in CI before every merge to main.
3. **Component (Testing Library)** — suggestion-chain explainability, review-screen states, dashboard math rendering.
4. **E2E (Playwright)** — PRD Appendix A flows US-1..US-9 as executable specs.
5. **A11y (axe + manual)** and **performance (Lighthouse CI budgets)** — NFR gates, enforced from S8.

**Corpus sanitization procedure (owner: Parser role)**

1. Collect real inputs per household bank (statements, exports, screenshots).
2. Scrub in order: names/addresses → replace with per-fixture pseudonyms; account numbers → zeroed but same digit-count (format fidelity matters); balances stay (parser realism) unless they are personally identifying on their own.
3. Human verifies: no residual PII, no transaction content that identifies real merchants beyond what's needed (keep chain-store names; scrub small local merchants to fictional equivalents).
4. Commit fixture + expected output to private repo; corpus may never contain unsanitized files. Tooling to semi-automate scrubbing: Q-B6.
5. Add every dogfood import that reveals a new layout variant to the corpus (PRD §9: the corpus is a first-class deliverable).

---

## 9. Release engineering

- **Repo/branching:** single private repo; trunk-based; short-lived feature branches; ≥1 reviewer per PR; squash merge.
- **CI:** on every PR — lint, typecheck, unit + corpus, build; preview deploy to Cloudflare Pages. On main — same + E2E + Lighthouse budgets; production deploy.
- **Environments:** preview (per PR) → production (main). No staging needed pre-sync (static app); a `beta` channel appears only if V1.1 sync needs staged rollout.
- **Versioning:** semver; PWA auto-update strategy = prompt-on-new-version (financial data: never silently swap versions mid-session).
- **Observability:** opt-in only (Q-B10); in-app diagnostics page (NFR-9) for support; zero analytics in the core loop by default (NFR-1).

---

## 10. Traceability matrix (P0 requirements → plan)

| PRD FRs                                                                | Workstream | Sprint(s)   | Gate   |
| ---------------------------------------------------------------------- | ---------- | ----------- | ------ |
| FR-1.1–1.6 accounts, balances, net worth                               | W1, W2     | S1–S3       | G4     |
| FR-1.7 per-account currency; FR-7.5 base-currency reporting (PRD v0.3) | W1, W2, W6 | S1–S5       | G4/G6  |
| FR-2.1–2.4 transactions, splits, transfers, search                     | W2, W5     | S2–S3       | G4     |
| FR-3.1, 3.5, 3.6, 3.11 CSV + review + dedupe + undo                    | W4         | S3          | G4     |
| FR-3.2 PDF (text)                                                      | W4         | S4          | G6     |
| FR-3.2 OCR path, 3.3 screenshots, 3.4 receipts                         | W4         | S5          | G6     |
| FR-3.7, 3.8 templates + teach                                          | W4         | S4–S5       | G6     |
| FR-3.9, 3.10 share intake + multi-file                                 | W7         | S7          | G12    |
| FR-4.1–4.4 categories, rules, memory, queue                            | W3         | S3–S4       | G4     |
| FR-5.1, 5.2 budgets                                                    | W5         | S4          | G4     |
| FR-6.1 bills                                                           | W5         | S4          | G4     |
| FR-7.1–7.3 reports                                                     | W6         | S5          | G6     |
| FR-8.1–8.4, 8.6 storage, export/restore, nudges, delete-all            | W1, W7     | S1, S7, S11 | G4/G12 |
| FR-9.1–9.4 PWA install, offline, responsive, camera                    | W7         | S0, S7      | G12    |

---

## 11. Build risks

| #    | Risk                                                                     | Likelihood | Impact | Mitigation                                                                                                                          |
| ---- | ------------------------------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| RB1  | Team ramps slower than assumed on Svelte 5 runes                         | Medium     | Medium | Q-B14 check in S0; contracts-first confines blast radius; pair on first components                                                  |
| RB2  | Bundle weight: PDF.js + Tesseract + SQLite-WASM                          | High       | Medium | Route-level lazy loading; worker instantiation only on import; Lighthouse budgets from S8                                           |
| RB3  | Safari/OPFS storage quirks & eviction                                    | Medium     | High   | Bake-off includes Safari (Q-B1); persistent-storage grant; Dexie fallback; backup nudges (FR-8.4)                                   |
| RB4  | OCR accuracy under the 75% screenshot target on real apps                | Medium     | High   | Corpus-driven iteration; capture-guidance UX; Q-B4 (opt-in cloud assist) decided at M1 with data                                    |
| RB5  | Contract drift between three parallel builders                           | Medium     | Medium | Engine API frozen at G1; versioned mock adapter; weekly plan review; integration at every gate                                      |
| RB6  | Foundation-first delays first dogfood                                    | Low        | Medium | Mock-adapter UI track keeps UI productive; hard G4 at T+5; one-week slip absorbed by S9–S10 buffer                                  |
| RB7  | Holiday season productivity dip                                          | High       | Low    | S9–S10 explicitly buffer weeks; bug-fix only; M2 scheduled after them                                                               |
| RB8  | Estimate error ±30% (parsing especially)                                 | High       | Medium | Gate-based re-planning (§0); 30% headroom in capacity math; 2-person variant has a named trim list                                  |
| RB9  | PII leak via fixtures or support screenshots                             | Medium     | High   | Sanitization procedure (§9.3); private repo (A7); diagnostics page redacts amounts/names                                            |
| RB10 | iOS PWA gaps (no share target; storage policy)                           | High       | Medium | In-app picker is the first-class iOS path (FR-3.9); regular-use mitigation; native wrapper is a documented escape hatch, not a plan |
| RB11 | Offline FX rates go stale; LKR rate-source coverage thinner than USD/AUD | Medium     | Medium | Cached rates with visible as-of date; manual override; per-currency reporting fallback; source decided at Q-B21 (S1)                |

---

## 12. Open-questions register

Parked here by design (per §0); none of these block the current sprint. Answer at the stated gate.

| ID    | Question                                                                                                                                                                              | Owner           | Decide-by                                 | Status                                                                                                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-B1  | Storage bake-off winner: SQLite-WASM/OPFS vs Dexie? (Safari behavior is the tiebreaker)                                                                                               | Engine          | Oct 23 (S0)                               | **ANSWERED 2026-10-19:** Dexie/IndexedDB — Safari-reliable, no WASM boot cost, 25k-row datasets fit in-memory filtering; SQLite-WASM remains a possible adapter behind `LedgerRepository` |
| Q-B2  | Hosting: Cloudflare Pages (default) vs Vercel vs GitHub Pages?                                                                                                                        | Engine          | Oct 23 (S0)                               | OPEN                                                                                                                                                                                      |
| Q-B3  | App name + trademark + domain (Ledgerly is a placeholder)                                                                                                                             | All             | Jan 4 (S11, before M2)                    | OPEN — PRD Q5                                                                                                                                                                             |
| Q-B4  | Opt-in cloud-assist OCR for hard documents — needed or not?                                                                                                                           | Parser          | Dec 6 (M1 gate, with corpus data)         | OPEN — PRD Q1                                                                                                                                                                             |
| Q-B5  | Svelte component kit: shadcn-svelte vs Skeleton vs custom?                                                                                                                            | UI              | Oct 25 (S0)                               | OPEN                                                                                                                                                                                      |
| Q-B6  | Corpus scrubber: manual checklist vs scripted tool?                                                                                                                                   | Parser          | Oct 25 (S0)                               | OPEN                                                                                                                                                                                      |
| Q-B7  | Sample dataset richness (months of history, which categories)?                                                                                                                        | UI              | Jan 4 (S11)                               | OPEN — PRD Q6                                                                                                                                                                             |
| Q-B8  | Export format versioning & forward-compat policy                                                                                                                                      | Engine          | Nov 1 (S1, before format ships)           | OPEN                                                                                                                                                                                      |
| Q-B9  | Push scope at M2: bill reminders + budget alerts? Quiet-hour defaults?                                                                                                                | UI              | Dec 20 (S8)                               | OPEN                                                                                                                                                                                      |
| Q-B10 | Opt-in analytics: self-hosted Plausible vs nothing? Event list?                                                                                                                       | All             | Dec 6 (S6)                                | OPEN                                                                                                                                                                                      |
| Q-B11 | Sync protocol: oplog+LWW vs CRDT? (V1.1 spike)                                                                                                                                        | Engine          | Feb 2027                                  | OPEN — PRD Q3                                                                                                                                                                             |
| Q-B12 | Template sharing + moderation (V2)                                                                                                                                                    | Parser          | V2                                        | OPEN — PRD Q4                                                                                                                                                                             |
| Q-B13 | Physical device/browser test matrix (min: Pixel+Chrome Android, iPhone+Safari, desktop Chrome/Firefox/Safari)                                                                         | UI              | Dec 20 (S8)                               | OPEN                                                                                                                                                                                      |
| Q-B14 | Confirm team Svelte 5 experience; adjust ramp buffer                                                                                                                                  | All             | Oct 23 (S0)                               | OPEN                                                                                                                                                                                      |
| Q-B15 | Budget alert default thresholds (80%/100%) — confirm during dogfood                                                                                                                   | UI              | Nov 22 (G4)                               | OPEN                                                                                                                                                                                      |
| Q-B16 | In-app help content scope                                                                                                                                                             | UI              | Jan 4 (S11)                               | OPEN                                                                                                                                                                                      |
| Q-B17 | Aggregation gate review (PRD §13: public-beta +3 mo or 500 MAU)                                                                                                                       | All             | ~Apr 2027                                 | OPEN                                                                                                                                                                                      |
| Q-B18 | Monetization revisit (free for now per PRD)                                                                                                                                           | All             | post-GA                                   | OPEN                                                                                                                                                                                      |
| Q-B19 | Repo visibility/license if open-sourcing later                                                                                                                                        | All             | V2+                                       | OPEN                                                                                                                                                                                      |
| Q-B20 | Multi-currency schema depth at MVP                                                                                                                                                    | Engine          | —                                         | **ANSWERED 2026-10-19 (D5):** multi-currency from the start; per-account currency + base-currency reporting                                                                               |
| Q-B21 | FX rate source & offline policy: which API (LKR coverage varies by provider), refresh cadence, staleness UX, manual override scope, historical vs. current rates for reports (PRD Q7) | Engine          | Nov 1 (S1, before the G1 contract freeze) | OPEN                                                                                                                                                                                      |
| Q-B22 | Cross-currency transactions (e.g., USD spend from an LKR card, FX fees): MVP or V1.1? (PRD Q7) Working assumption: per-account currency only at MVP                                   | Engine + Parser | Nov 22 (G4)                               | OPEN                                                                                                                                                                                      |

---

## 13. Working agreements & definition of done

- **Scope contract:** PRD §5.2 non-goals are the scope guard. New ideas go to the V2 parking lot, never into the current sprint, unless they fix a P0 failure.
- **DoD for every task:** code + tests + the PRD FR's acceptance criterion demonstrably met + plan/docs touched if behavior changed.
- **DoD for every PR:** CI green (lint, typecheck, unit + corpus), ≥1 review, no new a11y failures, migrations reversible.
- **DoD for every gate:** §7 exit criteria all met, else the gate slips with a written reason in the change log.
- **Meetings:** Monday 30-min plan review; gates are the only other mandatory checkpoint.
- **This file is living:** every gate ends with a version bump + change log entry.

---

## 14. Change log

| Version | Date       | Change                                                                                                                                                                                                                                                                                      |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1     | 2026-10-19 | Initial build plan from PRD v0.2 + 2026-10-19 Q&A decisions D1–D4.                                                                                                                                                                                                                          |
| 0.2     | 2026-10-19 | D5 (user directive): multi-currency from the start — LKR, USD, AUD minimum. A5 rewritten; W1/W2/W4/W5/W6 re-estimated (+6 pd; demand ≈106 pd); capacity math, sprint cells, G4 criteria, tests, traceability, risks (RB11) updated; Q-B20 answered, Q-B21/Q-B22 added; PRD aligned to v0.3. |
| 0.3     | 2026-10-19 | Q-B1 answered: Dexie/IndexedDB storage. Stage 2–3 implementation status recorded in README (engine, storage, CSV import, UI; 58 tests).                                                                                                                                                     |
