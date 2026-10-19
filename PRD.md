# Product Requirements Document — "Ledgerly" (working title)

**Lite edition — calm personal finance for simpler households, no bank linking**

|                   |                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------- |
| Version           | 0.3 — Draft for review                                                                |
| Date              | 2026-10-19                                                                            |
| Status            | Not yet reviewed                                                                      |
| Supersedes        | v0.1 (full edition, archived as `PRD_IGNORED.md` — not the basis for the current app) |
| Product type      | Installable web app (PWA), local-first data, no third-party bank aggregation          |
| Proposed timeline | Dogfood T+4 wks · Private beta T+8 wks · Public beta T+12 wks (see §11)               |

---

## 1. Executive summary

Ledgerly Lite is a personal finance app for **simpler households**: people with a handful of accounts who want a calm, accurate picture of their money — this month's spending vs. budget, upcoming bills, and net worth — without connecting their bank, without a subscription, and without bookkeeping jargon. Households whose money spans countries are first-class citizens: accounts can hold **LKR, USD, or AUD (at minimum)**, with reporting in a base currency of the user's choice.

The defining bet of this edition: **no third-party aggregation, ever (for now).** Instead of bank feeds, the product is built around a great **import-and-review experience**: drop in a CSV, a PDF statement, or even screenshots of your banking app, and the app extracts the transactions on-device for one quick review. Quick manual entry and receipt capture cover the gaps.

It ships as a **web-first PWA** — fast on desktop, installable and camera-friendly on mobile — with **local-first storage**: the user's data lives on their device, nothing leaves it unless the user later opts into (end-to-end-encrypted) sync. No signup, no ads, no data selling, no bank credentials — ever.

The MVP is built for **our own household first, but public-ready**: the import parser must handle arbitrary bank formats generically from day one, not just our banks.

---

## 2. What changed from the full edition (v0.1)

The full-edition PRD (`PRD_IGNORED.md`) is parked — we are not building from it. This edition scales it down deliberately:

| Full edition (v0.1)                                     | This edition (v0.2)                                                       | Why                                                                                                          |
| ------------------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Bank aggregation via Plaid et al. (P0)                  | **Removed.** Manual accounts + CSV/PDF/screenshot import + manual entry   | Founder decision: no third-party providers first; revisit after launch with real friction data (§12 R4, §13) |
| Cloud SaaS, account-based, always synced                | **Local-first**, on-device storage; opt-in E2E-encrypted sync later (P1)  | Privacy as the product; no server dependency for the core loop                                               |
| Web + native iOS + native Android                       | **Web-first PWA** (responsive, installable, share-intake on mobile)       | One codebase; camera and file intake still work on phones                                                    |
| ML auto-categorization model                            | **Simplified:** deterministic rules + per-payee memory + suggestions      | Smaller build; fully explainable; runs on-device                                                             |
| Household multi-user with roles (P1)                    | **Single user at MVP**; one shared login is fine; multi-user later (V1.2) | Simpler households; big complexity cut                                                                       |
| Investments read-only, forecasting, goals, debt planner | **Deferred** (V2 / out of MVP)                                            | Focus on the calm dashboard loop                                                                             |
| Freemium subscription from GA                           | **Free; monetization decided later**                                      | Dogfood-first, no billing surface at MVP                                                                     |
| Mint/Quicken/YNAB migration importers (P1)              | **Deferred**; generic CSV import covers basic migration                   | Audience is simpler households, not power migrants (yet)                                                     |
| Tax reports, reconciliation (P1)                        | **Cut from MVP**; import carries a lightweight balance check instead      | Scope discipline                                                                                             |

**Kept from the full edition:** the accuracy-first principle, plain-language UX, full data export on day one, WCAG 2.1 AA, and the calm all-in-one dashboard as the product's heart.

---

## 3. Problem & positioning

**Problem.** Simpler households (a couple of bank accounts, a credit card, maybe a loan) want to know where their money goes and what's coming up. Today's options force a bad trade: bank-linked apps demand plaid-style credential sharing and get cluttered with upsells; bank apps show only one silo; spreadsheets rot. The Mint-orphaned audience is still underserved four years on — but this edition targets the quieter segment that was never comfortable linking banks at all.

**Positioning.** _Your money, on your device._ The household ledger that never asks for your bank password, never sells your data, and still takes only minutes a month to maintain. **"No linking" is a feature, not a gap** — it is the trust promise the product is built around.

**Product principles** (carried over, sharpened):

1. **Accuracy is the product.** A wrong number destroys trust faster than a missing feature. Every import is reviewed before commit; duplicates are the enemy.
2. **The device is the vault.** Core loop works fully offline; nothing leaves the device without an explicit opt-in.
3. **Low-effort by default, full control on demand.** Automate extraction and categorization; let the user inspect and override everything.
4. **Calm, not engagement-maximizing.** One clear dashboard; no streaks, no guilt mechanics, no notifications begging for attention.
5. **Data belongs to the user.** Full export anytime, self-serve, forever free.

---

## 4. Target users

1. **Maya, 26 — "Where did it go?"** First real job, two accounts and one card. Imports her statement once a month, wants spending by category and a simple budget. Hates bookkeeping. _Failure mode:_ import feels like homework → churn.
2. **Priya & Dan, 38/40 — "Household CFOs, lightly."** Busy parents, five accounts, one shared login. Want the monthly ritual (import → review → glance at dashboard), upcoming bills, and net worth. Use it together on the couch, not separately all day.
3. **Sam, 30 — "Privacy-first spreadsheet refugee."** Left Google Sheets; chose this app _because_ it doesn't link banks. Exports data regularly, writes rules, and will become the community evangelist if we never break the trust promise.

**Anti-persona:** power users demanding bank feeds, investment sync, or multi-currency on day one. They belong to the full edition's roadmap, not this one.

---

## 5. Goals, non-goals & success metrics

### 5.1 Goals

- **G1:** A new user reaches a meaningful dashboard (≥1 account, ≥1 month of transactions) in **under 15 minutes**, without creating any account or sharing any credentials.
- **G2:** The monthly maintenance ritual — import + review + categorize — takes **≤ 10 minutes** for a typical month (≈60–100 transactions).
- **G3:** Users can answer "how am I doing this month?", "what bills are coming?", and "what's my net worth?" from the dashboard alone.
- **G4:** Zero data-loss incidents. Local-first must not mean fragile.
- **G5:** Produce the evidence (import friction, retention) to make an informed **aggregation decision** post-launch (§13).

### 5.2 Non-goals (this edition)

- Bank aggregation of any kind (decision reopens only at the §13 gate).
- Money movement, bill payment, product recommendations, ads, data selling.
- Native iOS/Android apps (PWA instead; revisit only if iOS PWA limits bite).
- Multi-user households, investments, tax reports, forecasting.
- Cross-currency transactions within a single account (e.g., a USD charge on an LKR card) — working assumption is per-account currency only at MVP; decide at Q7.
- Monetization.

### 5.3 Success metrics (dogfood + private beta)

| Metric                                                                     | Target                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------ |
| Activation: first successful import (or 5 manual entries) in first session | ≥ 70%                                            |
| Median time: install → dashboard with real data                            | < 15 min                                         |
| Statement import: transactions extracted correctly with no edits           | ≥ 90% (text-layer PDFs); ≥ 75% (screenshots/OCR) |
| Import duplicates reaching the ledger                                      | < 1%                                             |
| Week-4 retention (private-beta households)                                 | ≥ 50%                                            |
| Monthly ritual completed per active month                                  | ≥ 60% of monthly actives                         |
| Uncategorized share of imported spend                                      | < 10% after month 2                              |
| Data-loss incidents                                                        | 0 (blocking)                                     |
| Crash-free sessions                                                        | ≥ 99.5%                                          |

---

## 6. Product core — the calm all-in-one dashboard

The home screen is the product. Everything else exists to feed it. It shows, in one glance:

1. **Net worth** — big number, 12-month trend.
2. **This month** — money in / money out vs. budget, on-pace indicator.
3. **Upcoming bills** — next 14 days.
4. **Needs attention** — uncategorized transactions, low-confidence import rows, accounts with stale balances.
5. **Recent transactions** — last 7 days.

Information architecture: **Home · Transactions · Import · Plan (budget, bills) · Settings.** That's the whole app.

---

## 7. Functional requirements

Priority key: **P0** = MVP must-have · **P1** = fast follow (V1.1) · **P2** = later.

### 7.1 Accounts (manual only)

| ID     | Requirement                                                                                                                                                                                     | P   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-1.1 | Create accounts by type: checking, savings, credit card, cash, loan/mortgage, and simple assets (home, vehicle, other). Each with name, institution (optional free text), and opening balance.  | P0  |
| FR-1.2 | Net worth = assets − liabilities, computed from current balances; 12-month trend on Home.                                                                                                       | P0  |
| FR-1.3 | Manual balance update with note (e.g., monthly home value adjustment); balance history retained.                                                                                                | P0  |
| FR-1.4 | Close or archive an account without losing history.                                                                                                                                             | P0  |
| FR-1.5 | When an imported statement carries opening/closing balances, offer a one-tap balance check: "statement says $4,210.37 — your ledger says $4,180.00; show the difference?"                       | P0  |
| FR-1.6 | Credit cards and loans shown as liabilities with current payoff-relevant balance.                                                                                                               | P0  |
| FR-1.7 | Every account carries a currency (ISO 4217; **LKR, USD, AUD supported at minimum**). Amounts are entered, imported, stored, and displayed in the account's currency — never silently converted. | P0  |

### 7.2 Transactions

| ID     | Requirement                                                                                                                                                  | P   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| FR-2.1 | Quick manual entry: amount, payee (autosuggest), account, category, date (defaults today), optional note. Target ≤ 10 seconds on a phone.                    | P0  |
| FR-2.2 | Edit, delete, and 2+ way split (by amount or %) any transaction; parts must sum to the whole.                                                                | P0  |
| FR-2.3 | Mark a transaction as a **transfer** between own accounts (or match two legs automatically — see FR-3.6); transfers are excluded from income/expense totals. | P0  |
| FR-2.4 | Search and filter by date, account, category, payee, amount range.                                                                                           | P0  |
| FR-2.5 | Mark transactions as recurring (feeds bill detection, FR-5.2).                                                                                               | P1  |
| FR-2.6 | Attach a receipt image to any transaction (stored locally).                                                                                                  | P1  |

### 7.3 Import pipeline — the heart of the product

| ID      | Requirement                                                                                                                                                                                                                                                                                                         | P   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-3.1  | **CSV import** with a column-mapping wizard (date, payee/description, amount or separate debit/credit, balance if present), date-format detection, locale/currency-aware number parsing, live preview, and full undo of any import.                                                                                 | P0  |
| FR-3.2  | **PDF statement import:** extract text layer (PDF.js) and parse transaction rows; if the PDF has no text layer (scanned), route pages through on-device OCR.                                                                                                                                                        | P0  |
| FR-3.3  | **Screenshot import:** select one or more screenshots (or photos) of a banking app / web list; on-device OCR extracts transaction rows; multiple images of a scrolling list are merged and overlapping rows deduplicated.                                                                                           | P0  |
| FR-3.4  | **Receipt capture:** camera or share-in a single receipt; extract amount, date, merchant; confirm in ≤ 3 taps. Amount is pre-focused for correction.                                                                                                                                                                | P0  |
| FR-3.5  | **Universal review screen** for every import (CSV/PDF/screenshot): editable rows, per-row confidence indicators, low-confidence rows highlighted, uncategorized flagged; bulk-accept high-confidence rows; commit applies atomically. Nothing enters the ledger unreviewed.                                         | P0  |
| FR-3.6  | **Deduplication:** before commit, fingerprint every row against existing transactions (same account, amount equal, date ±3 days, payee fuzzy match) and against other rows in the same import; duplicates pre-marked as "already in ledger" and skipped by default, one-tap override.                               | P0  |
| FR-3.7  | **Parser templates:** each successful import can be saved as a reusable template per (institution, account); template stores format layout (columns/positions, date format, debit/credit signs). Next import from the same source auto-applies it.                                                                  | P0  |
| FR-3.8  | **Teachable corrections:** user edits during review (payee cleanup, category fixes, skipped false-positive rows) update the template and the payee memory for next time.                                                                                                                                            | P0  |
| FR-3.9  | **Share intake:** the PWA registers as a share target for images and PDFs where the platform supports it (e.g., installed PWA on Android/Chrome); on platforms without share-target support (iOS today), an equivalent in-app camera/file picker is the path. Shared files land directly in the import review flow. | P0  |
| FR-3.10 | Import accepts **multiple files at once** (e.g., 3 statements, or 6 screenshots); processed into one combined review.                                                                                                                                                                                               | P0  |
| FR-3.11 | Import history log: every import recorded (source, date, rows accepted/skipped/edited) with per-import undo.                                                                                                                                                                                                        | P0  |
| FR-3.12 | Community/template library of known bank formats (bundled at first; curated later).                                                                                                                                                                                                                                 | P2  |

### 7.4 Categories, rules & memory

| ID     | Requirement                                                                                                                                                                                                                        | P   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-4.1 | Default category tree of ~25 flat-ish categories (two levels max: e.g., Food → Groceries / Eating out), fully editable (add, rename, merge, archive; archive preserves history).                                                   | P0  |
| FR-4.2 | Auto-categorization, deterministic and fully explainable: (1) user rules → (2) payee memory (per payee × account) → (3) default suggestion. Every suggestion states its reason ("You categorized 'BLUE BOTTLE' as Coffee before"). | P0  |
| FR-4.3 | Rules: IF payee contains X (optionally: and amount in range, and account = Y) THEN set category. Ordered, editable, with a "preview last 90 days" tester.                                                                          | P0  |
| FR-4.4 | Review queue for uncategorized transactions with bulk categorize.                                                                                                                                                                  | P0  |
| FR-4.5 | Payee cleanup: normalize raw bank strings (`SQ *BLUE BOTTLE #412`) into clean payee names; corrections are learned.                                                                                                                | P1  |

### 7.5 Budgeting

| ID     | Requirement                                                                                               | P   |
| ------ | --------------------------------------------------------------------------------------------------------- | --- |
| FR-5.1 | Monthly budget per category with progress bar and pace indicator ("trending $40 over with 10 days left"). | P0  |
| FR-5.2 | "Base it on my average" suggestion from the last 3 months when creating a budget.                         | P0  |
| FR-5.3 | Optional per-category rollover to next month.                                                             | P1  |
| FR-5.4 | Budget alerts in-app (badge + home card); web push alerts for installed PWAs.                             | P1  |
| FR-5.5 | Safe-to-spend-today number = (month budget remaining − known upcoming bills) ÷ days left.                 | P1  |

### 7.6 Bills & recurring

| ID     | Requirement                                                                                                                         | P     |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-6.1 | Manual bills: name, amount (fixed or variable), due day, account; shown in the Home "upcoming 14 days" card and a simple bill list. | P0    |
| FR-6.2 | Recurring-transaction detection: after 3+ occurrences of a similar payee/amount cadence, suggest creating a bill from it.           | P1    |
| FR-6.3 | Mark a bill paid (manually or auto-match to an imported transaction); missed-bill hint ("rent expected on the 1st, not seen yet").  | P1    |
| FR-6.4 | Bill payment execution — out of scope (non-goal).                                                                                   | Won't |

### 7.7 Reports

| ID     | Requirement                                                                                                                                                                                                                                          | P   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-7.1 | Income vs. expenses by month/quarter/year, with account filter.                                                                                                                                                                                      | P0  |
| FR-7.2 | Spending by category (and by payee), current period vs. previous period.                                                                                                                                                                             | P0  |
| FR-7.3 | Net worth over time with asset/liability breakdown.                                                                                                                                                                                                  | P0  |
| FR-7.4 | Export any report view as CSV; print-friendly layout.                                                                                                                                                                                                | P1  |
| FR-7.5 | Reports and net worth display in the user's chosen **base currency**, converted via cached FX rates with the as-of date visible; per-currency breakdown available; manual rate override in settings. Offline uses last-known rates, clearly labeled. | P0  |

### 7.8 Data, backup & sync

| ID     | Requirement                                                                                                                                                                         | P   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-8.1 | All data stored locally (browser storage) with **persistent-storage request** on install; storage-usage indicator and "your data lives on this device" explainer in Settings.       | P0  |
| FR-8.2 | **Full export anytime:** single file (JSON snapshot + CSVs) containing everything — accounts, transactions, budgets, rules, templates. No support ticket, no lock-in, forever free. | P0  |
| FR-8.3 | **Restore/import from export file** — the zero-to-hero path for moving devices or recovering.                                                                                       | P0  |
| FR-8.4 | Backup nudges: if the user hasn't exported in 30+ days, surface a gentle reminder (Home card). Local-first must not mean fragile.                                                   | P0  |
| FR-8.5 | **Opt-in sync (V1.1):** account created only when the user enables it; client-side end-to-end encrypted; server stores only ciphertext (zero-knowledge); multi-device.              | P1  |
| FR-8.6 | Delete everything: one action, hard-deletes all local data (and synced data if sync is on), with confirmation.                                                                      | P0  |
| FR-8.7 | Optional local app-lock (device biometric/PIN via WebAuthn) for opening the PWA.                                                                                                    | P1  |

### 7.9 PWA platform requirements

| ID     | Requirement                                                                                                                                                                         | P   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-9.1 | Installable PWA (manifest + service worker); app icon, standalone window.                                                                                                           | P0  |
| FR-9.2 | **Offline-capable core:** dashboard, transactions, manual entry, and budgets work with no network; imports of CSV work offline; OCR/PDF parsing runs on-device (no network needed). | P0  |
| FR-9.3 | Responsive design: desktop-first layouts that adapt gracefully to phone screens; all flows thumb-reachable.                                                                         | P0  |
| FR-9.4 | Camera and file-picker intake on mobile browsers (FR-3.4/3.9).                                                                                                                      | P0  |
| FR-9.5 | Web push notifications (installed PWA) for bill reminders and budget alerts.                                                                                                        | P1  |
| FR-9.6 | Home-screen quick-action shortcuts (e.g., "Add transaction", "Import").                                                                                                             | P2  |

### 7.10 Settings

Base currency (used for reporting; each account keeps its own currency), FX rate overrides, locale (date/number format), theme (light/dark/system), category manager, account manager, rules manager, import templates, backup & restore, sync (V1.1), delete all data. No account or email required unless sync is enabled.

---

## 8. Non-functional requirements

| ID     | Area                 | Requirement                                                                                                                                                                                                                                                                                                                                                  |
| ------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-1  | Privacy              | The core loop (entry, import, parse, OCR, budget, reports) runs **entirely on-device**; no network calls required. No analytics unless the user opts in; opt-in analytics is aggregate and documented. No ads, no data selling, no bank credentials — ever.                                                                                                  |
| NFR-2  | Data durability      | Zero silent data loss: write-ahead logging on the local store; atomic import commits; export/import round-trip tested in CI. Persistent-storage granted on install; storage pressure surfaced to the user (FR-8.4).                                                                                                                                          |
| NFR-3  | Security             | HTTPS only; local data optionally app-locked (FR-8.7); when sync ships, E2E encryption with keys that never leave the client unencrypted.                                                                                                                                                                                                                    |
| NFR-4  | Performance          | Dashboard render p95 < 1s with 5 years of data (~25k transactions); manual entry save < 100ms; OCR of a one-page statement < 30s on a mid-range phone; import review screen interactive while heavy parsing continues in a worker.                                                                                                                           |
| NFR-5  | Reliability          | Parsing failures degrade gracefully: an unreadable file always yields a clear error + manual-entry fallback, never a hang or silent skip. Crash-free sessions ≥ 99.5%.                                                                                                                                                                                       |
| NFR-6  | Accessibility        | WCAG 2.1 AA; full keyboard nav; never encode financial states by color alone.                                                                                                                                                                                                                                                                                |
| NFR-7  | Internationalization | **Multi-currency from day one** — LKR, USD, AUD at minimum, driven by an ISO 4217 currency table with per-currency minor-unit exponents; amounts stored as integer minor units in the account's currency; base-currency reporting via cached FX rates (offline-first: last-known rate, visible as-of date, manual override); locale-aware formatting (Intl). |
| NFR-8  | Browser support      | Evergreen Chrome, Edge, Firefox, Safari (desktop + mobile); SQLite-WASM/OPFS where available, IndexedDB fallback.                                                                                                                                                                                                                                            |
| NFR-9  | Observability        | Local diagnostics page (storage size, last import stats) the user can attach to a bug report; opt-in crash reporting.                                                                                                                                                                                                                                        |
| NFR-10 | Legal                | Terms + privacy policy even for a free PWA; trademark clearance for the final name before public beta.                                                                                                                                                                                                                                                       |

---

## 9. Technical considerations (directional)

- **App:** SvelteKit 2 (Svelte 5) PWA, SPA mode via adapter-static; TypeScript; service worker (@vite-pwa/sveltekit/Workbox) for offline shell and caching; all heavy work (PDF/OCR/parsing) in Web Workers.
- **Storage:** SQLite compiled to WASM with OPFS persistence (relational integrity, trivial full-snapshot export), IndexedDB/Dexie as fallback. Amounts stored as integer minor units.
- **Parsing stack (on-device):**
  - CSV: streaming parser + mapping wizard.
  - PDF: PDF.js text extraction → row grammar (date / amount / description heuristics per locale); scanned pages → OCR.
  - OCR: Tesseract.js (WASM) with layout post-processing to reconstruct tabular rows; confidence scores surfaced in review. An opt-in cloud-assist OCR for hard documents is a possible V2 relief valve (open question Q1) — not in MVP.
  - Parser templates stored as JSON, keyed by (institution, account), user-teachable.
- **Categorization:** deterministic rules engine shared client/server-ready; payee-memory store; no ML model in MVP.
- **Sync (V1.1):** oplog with last-write-wins per entity + import-batch IDs for dedupe; client-side E2E encryption; server is a dumb encrypted-blob store. Keep the door open to CRDTs only if conflict pain is real.
- **Quality:** unit tests ≥ 80% on ledger + parser cores; golden-file test corpus of real (sanitized) statements and screenshots — **the parser test corpus is a first-class deliverable**, grown with every dogfood import.

---

## 10. UX requirements & key flows

**Design language:** calm, number-forward, generous whitespace, one accent color; motion only for feedback; no red badges shouting (states shown with icons + text, not color alone).

**Critical flows:**

1. **First run (≤ 15 min, no signup):** open PWA → 3-screen intro → create your first account (with realistic balance) → import a file or start with manual entry → dashboard. An explicit "try with sample data" path exists from screen one.
2. **The monthly ritual (≤ 10 min):** Import → drop statement(s)/screenshots → template auto-applies → review screen (bulk-accept greens, fix the rest) → categorize stragglers → glance at dashboard → done. This flow is the product's signature and gets disproportionate design attention.
3. **Log a cash expense (≤ 10 s):** FAB → keypad → payee autosuggest → save. Works fully offline.
4. **Receipt capture (≤ 3 taps to confirm):** share or snap → extracted amount pre-focused → confirm → attached to account.
5. **Teach the app:** recategorize a payee once → confirmation toast "Future 'BLUE BOTTLE' → Coffee" with an undo and an edit-rules link. Learning must be visible, never silent.
6. **Backup & move devices:** Settings → Export → file downloaded; on the new device → Import backup → everything restored including templates and rules.
7. **Data-loss guardrails:** persistent-storage prompt on install; storage indicator; 30-day backup nudge; warning card if browser signals storage pressure.

Every screen ships designed empty, loading, error, and offline states.

---

## 11. Release plan

| Milestone         | Target   | Content                                                                                                         | Exit criteria                                                      |
| ----------------- | -------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| M0 — Dogfood      | T+4 wks  | Local ledger core: accounts, transactions, categories, manual entry, CSV import, dashboard, full export/restore | Our household's real money tracked weekly; zero data loss          |
| M1 — Private beta | T+8 wks  | + PDF/screenshot import, receipts, parser templates, rules & memory, budgets, bills, review-screen polish       | 5–10 households; import accuracy ≥ targets (§5.3); ritual ≤ 10 min |
| M2 — Public beta  | T+12 wks | + PWA hardening (offline, install, share target), push alerts, accessibility pass, diagnostics                  | Activation ≥ 70%; crash-free ≥ 99.5%; public launch decision       |
| V1.1              | post-GA  | Opt-in E2E sync, safe-to-spend, recurring detection, rollover, payee cleanup                                    | Sync adopted by ≥ 30% of monthly actives                           |
| V1.2              | later    | Multi-user households (shared login → real invites), missed-bill detection                                      | Per §2 cut-list review                                             |
| V2                | later    | Investments (manual), aggregation decision gate (§13)                                                           | —                                                                  |

---

## 12. Risks

| #   | Risk                                                                                                                                     | Likelihood | Impact | Mitigation                                                                                                                                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Statement-format heterogeneity** — every bank lays out PDFs differently; parsing accuracy varies (replaces aggregation as the #1 risk) | High       | High   | Review-before-commit always; teachable templates; golden-file corpus per bank; CSV as guaranteed fallback; community templates (P2)                             |
| R2  | **OCR quality on screenshots** — banking-app chrome, partial rows, low contrast                                                          | High       | Medium | Capture guidance UI; multi-image merge + dedupe; confidence surfacing; set honest expectations (75% target); receipts are 3-tap-confirm by design               |
| R3  | **Local-first data loss** — browser storage eviction, device loss, "clear site data"                                                     | Medium     | High   | Persistent-storage grant; WAL + atomic commits; 30-day backup nudges; one-tap export; restore path battle-tested                                                |
| R4  | **Import friction kills retention** — the reason the industry moved to aggregation                                                       | High       | High   | Instrument the ritual (time, edits per import); ≤ 10-min target; template reuse; monthly nudge notification; this risk is the input to the §13 aggregation gate |
| R5  | **iOS PWA gaps** — no share-target support; stricter storage policies on Safari                                                          | Medium     | Medium | In-app camera/picker as first-class iOS path; installed-PWA + regular use mitigates eviction; native wrapper is a documented escape hatch, not a plan           |
| R6  | Sync complexity (E2E, conflicts) lands in V1.1                                                                                           | Medium     | Medium | Defer to V1.1 deliberately; oplog + LWW; import-batch IDs for dedupe; ship backup/restore first                                                                 |
| R7  | Scope creep back toward the full edition                                                                                                 | High       | Medium | This document's §5.2 non-goals are the contract; new ideas go to the V2 parking lot, not the MVP                                                                |
| R8  | Offline FX rates go stale; LKR rate coverage varies by provider                                                                          | Medium     | Medium | Cached rates with as-of labels; manual override; per-currency reporting fallback; policy set at Q7                                                              |

---

## 13. The aggregation decision gate

We are not anti-aggregation forever; we are sequencing. At public-beta + 3 months (or 500 MAU, whichever first), review with data:

- Median ritual time and edits-per-import (is manual import actually painful at scale?)
- W4/M1 retention vs. industry benchmarks for linked products
- Qualitative demand (support tickets, survey) for bank linking

**Exit:** if friction is the dominant churn reason, open a spike to add **optional, clearly-consented** linking (aggregator behind an interface, off by default, per-account) — the full edition's PRD is the reference design. If retention holds, double down on the import ritual and privacy positioning.

---

## 14. Open questions

1. **OCR ceiling:** is on-device Tesseract good enough for screenshots at the 75% target, or do we need an opt-in "send this one image for better recognition" cloud assist (with explicit per-use consent)? Decide at M1 with real corpus data.
2. **Storage engine:** SQLite-WASM/OPFS vs. Dexie/IndexedDB — reliability on Safari is the deciding factor; bake-off during M0.
3. **Sync protocol:** oplog+LWW vs. CRDT — prototype in V1.1 only if multi-device conflicts prove painful.
4. **Template sharing:** if users contribute bank-format templates, what moderation and privacy review is required before bundling?
5. **Name & trademark** clearance before public beta (Ledgerly is a placeholder).
6. **Sample data:** how rich should the demo dataset be (months of realistic history) to make the first-run dashboard compelling?
7. **FX policy:** which rate source (LKR coverage varies by provider), refresh cadence, manual override scope, historical vs. current rates for reports — and whether cross-currency transactions (e.g., a USD charge on an LKR card) are MVP or V1.1.

---

## Appendix A — User stories & acceptance criteria

**US-1 · First run with no signup (P0).** As a new user, I want to start tracking without creating an account.

- Given the installed PWA, when I complete the 3-screen intro and add one account with a balance, then I reach a dashboard with no email, password, or permissions requested beyond storage persistence.

**US-2 · Import a PDF statement (P0).** As a monthly importer, I want to drop in my bank's PDF and review what was found.

- Given a text-layer bank PDF, when I drop it on the Import screen, then ≥ 90% of rows extract with correct date/payee/amount within 30 seconds, deduplicated rows are pre-skipped, and nothing is written to the ledger until I press "Add N transactions".
- Given the import commits, then I can undo it from Import history, which restores the exact prior state.

**US-3 · Screenshot scrolling list (P0).** As a phone user, I want to import screenshots of my banking app.

- Given 4 screenshots of a scrolling transaction list with overlapping rows, when I select them together, then overlapping rows are merged into one chronological list and each row appears once in review.

**US-4 · Receipt in three taps (P0).**

- Given a photographed receipt, when I share it to the app (or snap it in-app), then amount/date/merchant are extracted, the amount field is pre-focused, and the transaction is saved by the third tap.

**US-5 · Teach once, correct forever (P0).**

- Given I recategorize payee "SQ *BLUE BOTTLE #412" to Coffee, when the next import contains that payee, then it arrives pre-categorized as Coffee, and a toast explains why ("based on your last correction") with an undo.

**US-6 · Transfer between accounts (P0).**

- Given a $500 credit-card payment matching a $500 checking outflow within ±3 days, when either is imported, then the pair is offered as a transfer, and confirmed transfers are excluded from spending reports.

**US-7 · The monthly ritual (P0).**

- Given ~80 transactions for the month, when I run import + review, then median completion time is ≤ 10 minutes with ≤ 10 edited rows, measured in-product.

**US-8 · Move devices (P0).**

- Given a full export file, when I import it on a fresh device, then accounts, transactions, budgets, rules, and parser templates are all restored, and the next import from my bank auto-applies the template.

**US-9 · Leave easily (P0).**

- Given any user, when they open Settings → Export, then within one minute they hold a file containing every datum the product stores about them; and Delete all data removes everything irrecoverably with a typed confirmation.

---

## Appendix B — Glossary

| Term               | Definition                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| PWA                | Progressive Web App — installable, offline-capable web application.                              |
| OPFS               | Origin Private File System — browser storage enabling fast file (SQLite) persistence.            |
| Web Share Target   | PWA capability letting the OS share sheet send files to the app (Android/Chrome; not iOS today). |
| OCR                | Optical Character Recognition — extracting text from images; runs on-device here.                |
| Text layer         | Machine-readable text embedded in a PDF (vs. scanned images needing OCR).                        |
| Parser template    | Saved description of one bank's statement layout, reusable across imports.                       |
| Payee memory       | Learned mapping from payee string → category, built from user corrections.                       |
| Golden-file corpus | Test set of real (sanitized) statements/screenshots with expected parse output.                  |
| Local-first        | Data lives on the user's device; network and servers are optional additions.                     |
| E2E sync           | Multi-device sync where the server only ever sees encrypted ciphertext.                          |
| OPFS/WAL           | Write-ahead logging — durability technique ensuring no partially-written commits.                |
| Zero-knowledge     | Server design where the operator cannot read user data.                                          |
