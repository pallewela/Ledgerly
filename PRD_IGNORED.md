# Product Requirements Document — "Ledgerly"

**A QuickBooks for personal finance** (working title; final name TBD)

|                   |                                                              |
| ----------------- | ------------------------------------------------------------ |
| Version           | 0.1 — Draft for review                                       |
| Date              | 2026-10-19                                                   |
| Status            | Not yet reviewed                                             |
| Product type      | Multi-platform personal finance management (PFM) application |
| Proposed timeline | Alpha T+6 weeks · MVP GA ~T+6 months (see §13)               |

---

## 1. Executive summary

Ledgerly (working title) is a personal finance application that gives individuals and households the same financial clarity QuickBooks gives small businesses: every account in one place, income and expenses automatically captured and categorized, budgets that hold up, and forward-looking answers to questions like _"Can I afford this?"_, _"When will I be debt-free?"_, and _"Am I saving enough?"_ — without accounting jargon or bookkeeping mechanics.

It will ship as a freemium cloud service with a responsive web app and native iOS/Android apps. Bank-aggregation providers (e.g., Plaid) power automatic account sync; manual entry and file import (CSV) are first-class paths, not afterthoughts. The positioning: **accuracy-first, transparent automation, household-friendly, and total data ownership** (full export anytime, no ads, no data selling).

The MVP focuses on the core loop — **connect accounts → auto-track & categorize → budget → see net worth and cash flow**. Bills & subscriptions, forecasting, goals, and migration importers follow in V1.1; household sharing, debt planning, and tax reports in V1.2; read-only investments, multi-currency, and what-if scenarios in V2.

---

## 2. Problem & opportunity

### 2.1 Problem statement

- **Money is scattered.** A typical household holds 10+ financial relationships across banks, credit cards, loans, brokerages, and payment apps. No single bank app shows the whole picture.
- **Existing tools force bad trade-offs.**
  - _Bank apps_: per-bank silos, weak categorization, no planning.
  - _Spreadsheets_: total control, but entirely manual; they rot.
  - _Mint_: shut down in 2024 and folded into Credit Karma, which dropped budgeting — millions of users orphaned.
  - _YNAB (~$100+/yr)_: effective methodology, but steep learning curve and a budget-only worldview (no net worth or investments).
  - _Monarch / Copilot / Simplifi_: solid but **paid-only**, and Copilot is Apple-only.
  - _Rocket Money_: bill negotiation and subscription cancellation, but weaker as a ledger.
- **QuickBooks itself is the wrong tool for individuals.** Double-entry bookkeeping, invoicing, payroll, and a business Chart of Accounts are an accountant's mental model. The insight worth keeping is not the accounting engine — it's the _experience_: connect your institutions once, watch everything flow in automatically, trust the reports.

### 2.2 The QuickBooks concept, translated for personal finance

| QuickBooks concept       | Ledgerly equivalent                                       |
| ------------------------ | --------------------------------------------------------- |
| Company file             | Household (one or more members)                           |
| Chart of accounts        | Personal category tree                                    |
| Bank feeds               | Aggregation-powered account sync                          |
| Banking rules            | Categorization rules engine + learned merchant memory     |
| Reconciliation           | Statement reconciliation (P1)                             |
| P&L / Balance Sheet      | Income vs. Expenses report / Net Worth statement          |
| Classes & locations      | Tags (trip, project, "reimbursable")                      |
| Bills & Accounts Payable | Bill calendar & subscription tracking                     |
| Users & roles            | Household roles: Owner / Member / Viewer                  |
| Attachments              | Receipts & documents on transactions                      |
| Audit trail              | Transaction change history                                |
| — (no QB parallel)       | Forecasting, savings goals, debt planner, "safe to spend" |

### 2.3 Why now

1. **The Mint shutdown left a durable, still-underserved audience** actively shopping for a home four years later.
2. **Consumer expectation shift**: app-grade UX is now the baseline; several incumbents show their age.
3. **Aggregator APIs are mature** (Plaid, Finicity, MX, GoCardless/Nordigen) with instant, OAuth-style auth flows covering most institutions.
4. **Open banking is cheapening connectivity** — EU PSD2 already has; the US §1033 rule was finalized in Oct 2024 but is currently stayed and under reconsideration (see R4, §12). Direction of travel favors cheaper, more reliable data access even if the US timeline is uncertain.

### 2.4 Competitive landscape

| Player            | Strength                                     | Gap we exploit                        |
| ----------------- | -------------------------------------------- | ------------------------------------- |
| Monarch Money     | Best-in-class aggregation, household sharing | Paid-only; no free tier               |
| YNAB              | Devoted fans; methodology that works         | Learning curve; budget-only worldview |
| Quicken Simplifi  | Low price, solid basics                      | Legacy UX; weak data-ownership story  |
| Copilot Money     | Beautiful Apple-native design                | Apple-only; no web/Android            |
| Empower           | Free net worth + investments                 | Weak budgeting/transactions           |
| Rocket Money      | Subscription cancellation, bill negotiation  | Weak as a complete ledger             |
| Bank built-in PFM | Convenient, free                             | Per-bank silos                        |
| Spreadsheets      | Total control, free                          | Manual; no aggregation or automation  |

**Positioning note:** we do not try to out-feature Monarch on day one. We compete on _accuracy + trust + data freedom_, with a free tier that banks trust-wary users into the product.

---

## 3. Vision, positioning & principles

**Vision.** Every household runs its money with confidence — knowing what it has, what it owes, what's coming, and what's next.

**Positioning.** For individuals and households who want a complete, accurate, forward-looking picture of their money without bookkeeping jargon. Ledgerly is the household's financial operating system — automatically.

**Product principles**

1. **Accuracy is the product.** A wrong number destroys trust faster than a missing feature. Duplicates, mis-categorized transfers, and silently stale balances are treated as P0 bugs.
2. **Low-effort by default, full control on demand.** Automate everything; let the user inspect and override any automated decision.
3. **No dark patterns.** No ads, no data selling, no engagement-maximizing tricks. The user's financial interest _is_ the product.
4. **Data belongs to the user.** Full export at any time, self-serve. Leaving must be easy.
5. **Personal mental models, not accounting jargon.** Plain language; double-entry machinery stays hidden.

---

## 4. Goals & success metrics

### 4.1 Goals

- **G1 (User):** Complete financial picture within 10 minutes of install.
- **G2 (User):** ≥ 90% of transactions captured with zero manual entry once accounts are linked.
- **G3 (User):** Users can answer "can I afford X?" and "am I on track?" from inside the app.
- **G4 (Business):** Establish a paid tier with ≥ 5% free→paid conversion in year 1.
- **G5 (Trust):** Zero material security incidents; SOC 2 Type II within 6 months of GA.

### 4.2 Non-goals (explicitly out of scope)

- Business accounting: invoicing, payroll, AR/AP, sales tax, business books.
- Tax filing or tax advice (tax-report _assistance_ is in scope).
- Investment trading or personalized financial advice.
- Money movement: no bill payment execution, no transfers initiated in V1 (reminders only).
- Lending, credit building, credit scores.
- Social/peer features.

### 4.3 Success metrics (targets at GA + 6 months)

| Metric                                                                         | Target   |
| ------------------------------------------------------------------------------ | -------- |
| Activation: link ≥1 account (or sample data) & view dashboard in first session | ≥ 70%    |
| Time-to-first-dashboard (median)                                               | < 10 min |
| Week-4 retention                                                               | ≥ 40%    |
| Month-3 retention                                                              | ≥ 30%    |
| WAU / MAU stickiness                                                           | ≥ 50%    |
| Auto-categorization acceptance (accepted without edit)                         | ≥ 85%    |
| Sync success rate (per refresh attempt)                                        | ≥ 99%    |
| Free → paid conversion                                                         | ≥ 5%     |
| NPS                                                                            | ≥ 40     |
| Support contacts per 1k MAU                                                    | < 25     |

---

## 5. Target users & personas

1. **Maya, 23 — "Getting started."** First salary, first budget. Needs simplicity, guardrails, zero jargon. _Failure mode:_ overwhelmed → churn.
2. **Priya, 38 — "Household CFO."** Runs money for a family of four across 12+ accounts. Needs aggregation, shared access, a bill calendar, and "did I already pay that?"
3. **James, 31 — "Debt escapee."** $38k in student loans and card debt. Needs a payoff plan (snowball/avalanche), visible progress, and a cash-flow reality check.
4. **Alex, 45 — "Net-worth builder."** High saver, tracks everything, FIRE-curious. Needs net-worth trend, savings rate, read-only investments, precise data, export.
5. **Sam, 29 — "Spreadsheet refugee."** Power user leaving Google Sheets. Needs rules, splits, tags, CSV import/export; skeptical of clouds. Bridge persona to community evangelism.

**Anti-persona:** the small-business owner who needs invoicing or payroll. That is QuickBooks' job; we will not chase it (scope discipline).

---

## 6. Scope & release phasing

Priority key: **P0** = MVP must-have · **P1** = fast follow (V1.1–V1.2) · **P2** = V2 horizon · **Won't** = out of scope.

| Phase                              | Theme                                                                                                | Exit criteria (highlights)           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Phase 0 — Alpha (internal, ~6 wks) | Core ledger: manual accounts, transactions, categories, budgets                                      | Team dogfoods daily                  |
| Phase 1 — MVP / public beta        | Aggregation, auto-categorization, dashboard, net worth, web+iOS+Android, security hardening, billing | Activation ≥ 60% in beta; sync ≥ 99% |
| V1.1 (~GA+6 wks)                   | Bills & subscriptions, cash-flow forecast, goals, Mint/Quicken/YNAB importers                        | Migration CSAT ≥ 4.5/5               |
| V1.2 (~GA+3 mo)                    | Household sharing, debt planner, tax report, reconciliation                                          | ≥ 10% of households have 2+ members  |
| V2 (~GA+9 mo)                      | Read-only investments, multi-currency, what-if scenarios, offline-first                              | —                                    |

---

## 7. Functional requirements

### 7.1 Accounts & aggregation

| ID     | Requirement                                                                                                                                                                                         | P   |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-1.1 | Link checking, savings, credit-card, loan, and mortgage accounts via an aggregation provider, with institution search and an OAuth-style credential flow. Bank credentials never touch our servers. | P0  |
| FR-1.2 | Create manual accounts (cash, property, vehicle, personal loans, misc. assets/liabilities) with an opening balance and optional value history.                                                      | P0  |
| FR-1.3 | Display per-account balances grouped into assets and liabilities; compute **net worth = assets − liabilities**.                                                                                     | P0  |
| FR-1.4 | Refresh on app open, on demand (pull-to-refresh), and on a background schedule at least every 8 hours; show per-account sync status and last-updated time.                                          | P0  |
| FR-1.5 | Sync-failure UX distinguishes (a) expired credentials → one-tap "Fix" re-auth flow, (b) institution outage → status + retry, (c) app error → report. Never show silently stale data.                | P0  |
| FR-1.6 | Close or hide accounts without deleting history; optionally exclude an account from net worth.                                                                                                      | P0  |
| FR-1.7 | Institution coverage ≥ 90% of US banks/credit unions via the primary aggregator; unsupported institutions get a documented manual + CSV-import path.                                                | P0  |
| FR-1.8 | Manual balance-adjustment entries (with note) for value-tracked accounts like a home or car.                                                                                                        | P1  |
| FR-1.9 | Multi-currency accounts with a configurable FX-rate source and base-currency reporting.                                                                                                             | P1  |

### 7.2 Transactions

| ID      | Requirement                                                                                                                                                                           | P   |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-2.1  | Auto-import transactions from linked accounts with idempotent, de-duplicated upserts (match on account + external ID, tolerant of bank-side edits via amount/date/payee fingerprint). | P0  |
| FR-2.2  | **Detect transfers between the user's own accounts** and exclude them from income/expense reports; one-tap override.                                                                  | P0  |
| FR-2.3  | Fast manual entry: amount, payee, account, category, date, note, tags; ≤ 10 seconds on mobile to log a transaction; recurring presets.                                                | P0  |
| FR-2.4  | Edit, n-way split, and delete transactions; every change recorded in a change history (who, when, before/after).                                                                      | P0  |
| FR-2.5  | File import: CSV with a column-mapping wizard and preview at MVP; QIF/OFX in V1.1.                                                                                                    | P0  |
| FR-2.6  | Search and filter by date range, account, category, tag, amount, payee, and flags; saved views.                                                                                       | P0  |
| FR-2.7  | Attach receipts (image/PDF) to transactions; OCR-assisted capture.                                                                                                                    | P1  |
| FR-2.8  | Scheduled/future transactions feed projected balances.                                                                                                                                | P1  |
| FR-2.9  | Flags: reimbursable, tax-deductible, shared-with-partner — with per-flag reporting.                                                                                                   | P1  |
| FR-2.10 | Bulk edit (multi-select recategorize, tag, flag).                                                                                                                                     | P1  |

### 7.3 Categories, rules & automation

| ID     | Requirement                                                                                                                                                                        | P   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-3.1 | Default category tree (~60 spend/income/transfer/savings categories), fully editable (add, rename, merge, move, archive — archiving preserves history).                            | P0  |
| FR-3.2 | Auto-categorization engine with a deterministic order: user rules → learned merchant memory (per merchant × account) → model suggestion. Confidence is surfaced in the UI.         | P0  |
| FR-3.3 | Rules engine: IF (payee contains / amount in range / account = X) THEN (set category, tags, notes, rename payee). Ordered, editable, testable ("preview last 90 days of matches"). | P0  |
| FR-3.4 | Review queue for uncategorized and low-confidence transactions, with bulk accept.                                                                                                  | P0  |
| FR-3.5 | Payee cleanup: normalize raw bank strings (e.g., `SQ *BLUE BOTTLE COFFEE #412 SF`) into clean merchant names.                                                                      | P1  |
| FR-3.6 | Merchant pages: spending history per merchant, feeds subscription detection.                                                                                                       | P1  |

### 7.4 Budgeting

| ID     | Requirement                                                                                                         | P   |
| ------ | ------------------------------------------------------------------------------------------------------------------- | --- |
| FR-4.1 | Monthly category budgets with budget-vs-actual progress and pace indicator ("trending $40 over with 10 days left"). | P0  |
| FR-4.2 | Per-category rollover (opt-in) and tracking of unbudgeted spending.                                                 | P0  |
| FR-4.3 | Alerts at 80% / 100% / over-budget via push and in-app; configurable quiet hours.                                   | P0  |
| FR-4.4 | Copy budgets month to month; "base it on my 3-month average" suggestion.                                            | P1  |
| FR-4.5 | **Safe to spend today** = (remaining month budget − known upcoming bills) ÷ days left in month.                     | P1  |
| FR-4.6 | Envelope / zero-based budgeting mode (assign-every-dollar) as an optional methodology.                              | P2  |
| FR-4.7 | Irregular-expense planner: amortize annual/semi-annual costs (insurance, subscriptions) into monthly set-asides.    | P1  |

### 7.5 Planning: forecast, goals, debt

| ID     | Requirement                                                                                                                                                                                   | P   |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-5.1 | 30/90-day **cash-flow forecast** from scheduled + detected-recurring transactions plus historical averages; shows projected daily balance, minimum-balance date, and overdraft-risk warnings. | P1  |
| FR-5.2 | Savings goals: name, target amount, target date, linked account(s), progress %, and required monthly savings rate.                                                                            | P1  |
| FR-5.3 | **Debt payoff planner**: enter debts and rates; choose snowball / avalanche / custom order; extra-payment slider; projected payoff date and interest saved.                                   | P1  |
| FR-5.4 | What-if scenarios: clone the current plan, adjust income/expenses/payments, compare outcomes side by side.                                                                                    | P2  |
| FR-5.5 | Long-horizon trajectory: savings rate → simple net-worth projection to user-defined milestones (e.g., retirement). Informational, not advice.                                                 | P2  |

### 7.6 Bills & subscriptions

| ID     | Requirement                                                                                                                                         | P     |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-6.1 | Bill calendar: upcoming bills with amount, account, due date (auto-detected or manual); mark paid; missed-bill detection ("expected but not seen"). | P1    |
| FR-6.2 | Subscription detection from recurring merchant patterns; renewal alerts; annualized view ("you spend $812/yr on subscriptions").                    | P1    |
| FR-6.3 | Configurable reminder lead times per bill.                                                                                                          | P1    |
| FR-6.4 | Bill _payment execution_ — out of scope (see Non-goals).                                                                                            | Won't |

### 7.7 Reports & dashboard

| ID     | Requirement                                                                                                                                                | P   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-7.1 | Home dashboard: 12-month net-worth trend, this month's income vs. expenses vs. budget, upcoming bills, recent transactions, sync issues needing attention. | P0  |
| FR-7.2 | Income vs. expenses over time (month / quarter / year / custom range).                                                                                     | P0  |
| FR-7.3 | Spending by category, tag, or merchant with period comparison (vs. last month, vs. same month last year).                                                  | P0  |
| FR-7.4 | Net worth over time with asset/liability breakdown.                                                                                                        | P0  |
| FR-7.5 | Cash-flow calendar (actual + projected daily in/out).                                                                                                      | P1  |
| FR-7.6 | Tax summary: calendar-year totals by category plus deduction-flagged transactions; exportable CSV/PDF for a tax preparer.                                  | P1  |
| FR-7.7 | Savings rate (monthly and trailing-12-month); income-source breakdown.                                                                                     | P1  |
| FR-7.8 | Anomaly nudges ("your electric bill is 2× your 12-month average").                                                                                         | P2  |
| FR-7.9 | Export any report to CSV/PDF; print-friendly layouts.                                                                                                      | P1  |

### 7.8 Household & sharing

| ID     | Requirement                                                                                                                     | P   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-8.1 | Invite household members by email with roles: **Owner** (billing + everything), **Member** (full edit), **Viewer** (read-only). | P1  |
| FR-8.2 | Per-account privacy: mark any account private; visible only to its owner-member.                                                | P1  |
| FR-8.3 | Shared household budgets, categories, and bills; per-member spending views computed from non-private data only.                 | P1  |
| FR-8.4 | Audit-trail entries carry the acting member's identity.                                                                         | P1  |

### 7.9 Onboarding & migration

| ID     | Requirement                                                                                                                                             | P   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-9.1 | Guided onboarding: create household → link first account (or sample data / manual account) → confirm categories → first dashboard. Median ≤ 10 minutes. | P0  |
| FR-9.2 | Import from Mint export CSV, Quicken (QIF/CSV), YNAB export, and generic CSV — with field mapping, preview, and undo.                                   | P1  |
| FR-9.3 | Migration preserves at least 24 months of history where the source file provides it.                                                                    | P1  |
| FR-9.4 | Sample-data mode: evaluate the full product without linking real accounts.                                                                              | P0  |

### 7.10 Data ownership & settings

| ID      | Requirement                                                                                                                                               | P   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-10.1 | Self-serve **full export**: all accounts, transactions, budgets, rules, and attachments as a zip (CSV files + JSON manifest), available on the free tier. | P0  |
| FR-10.2 | Account deletion: hard-delete of all user data within 30 days of request, with confirmation and grace period.                                             | P0  |
| FR-10.3 | Automatic encrypted backups; point-in-time restore for 30 days (support-assisted).                                                                        | P1  |
| FR-10.4 | Settings: base currency, locale/date/number formats, notification matrix, theme, app-lock.                                                                | P0  |

### 7.11 Platform, notifications & integrations

| ID      | Requirement                                                         | P       |
| ------- | ------------------------------------------------------------------- | ------- |
| FR-11.1 | Responsive web app (desktop + mobile browsers).                     | P0      |
| FR-11.2 | Native iOS and Android apps.                                        | P0      |
| FR-11.3 | Push notifications; weekly/monthly email digest.                    | P0 / P1 |
| FR-11.4 | Quick-add home-screen widgets and watch complications.              | P1      |
| FR-11.5 | Assistant/shortcuts integration (Siri Shortcuts, Google Assistant). | P2      |
| FR-11.6 | Calendar feed (ICS) of upcoming bills.                              | P2      |

### 7.12 Investments (read-only)

| ID      | Requirement                                                                                                              | P   |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | --- |
| FR-12.1 | Link brokerage and retirement accounts; show holdings, allocation by asset class/account, and balances inside net worth. | P2  |
| FR-12.2 | Performance: time-weighted returns per account vs. simple benchmarks.                                                    | P2  |
| FR-12.3 | Contribution tracking vs. common annual limits (401(k)/IRA), informational only.                                         | P2  |

### 7.13 Reconciliation

| ID      | Requirement                                                                                                                             | P   |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-13.1 | Statement reconciliation: match transactions against an ending bank-statement balance, flag discrepancies, and lock reconciled periods. | P1  |

---

## 8. Non-functional requirements

| ID     | Area                   | Requirement                                                                                                                                                                                                                   |
| ------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-1  | Security — credentials | Bank credentials are handled exclusively inside the aggregation provider's flow; never transmitted to or stored by us.                                                                                                        |
| NFR-2  | Security — data        | TLS 1.2+ in transit; AES-256 at rest; secrets in a managed KMS; annual penetration test; bug bounty by GA.                                                                                                                    |
| NFR-3  | Security — auth        | Passkeys or email+password (argon2); TOTP 2FA; biometric app lock on mobile; session list and remote revocation.                                                                                                              |
| NFR-4  | Privacy & compliance   | GDPR and CCPA/CPRA rights (access, portability, deletion); no sale or advertising use of user data; DPA in place with aggregator; SOC 2 Type II within 6 months of GA. No card data is stored or processed (PCI scope: none). |
| NFR-5  | Reliability            | Sync success ≥ 99% of refresh attempts; automatic retry with backoff; graceful degradation with clearly labeled stale data; public status page.                                                                               |
| NFR-6  | Availability           | 99.9% monthly for API and sync services.                                                                                                                                                                                      |
| NFR-7  | Performance            | Dashboard p95 < 2s on 4G; mobile cold start < 3s; manual entry ≤ 10s; any report over 10,000 transactions < 2s.                                                                                                               |
| NFR-8  | Data integrity         | No silent loss or duplication: imports and syncs are idempotent; user-visible sync log; full audit trail on transactions.                                                                                                     |
| NFR-9  | Accessibility          | WCAG 2.1 AA; full dynamic-type support; never encode financial states by color alone.                                                                                                                                         |
| NFR-10 | Internationalization   | USD and en-US at MVP, but locale- and currency-aware data model from day one; multi-currency in P1+.                                                                                                                          |
| NFR-11 | Observability          | Per-institution sync telemetry, error budgets, privacy-respecting aggregate funnel analytics.                                                                                                                                 |
| NFR-12 | Support                | In-app help center and contact; first response < 24h at GA.                                                                                                                                                                   |
| NFR-13 | Legal                  | Terms and privacy policy; aggregator contract reviewed; trademark clearance for final name before GA.                                                                                                                         |

---

## 9. Technical considerations (directional, not final architecture)

- **Clients:** React web + React Native (iOS/Android) sharing a design system and API client.
- **Backend:** API-first modular monolith to start; sync pipeline, categorization, and notifications as separately deployable workers when needed. Postgres as the system of record; a queue/event backbone for sync and categorization jobs.
- **Aggregation:** Plaid as launch partner (Transactions, Liabilities, Investments products), behind an **aggregator-abstraction layer** so Finicity, MX, or GoCardless/Nordigen can be added per market. Prefer webhooks over polling.
- **Core data model:** `User`, `Household`, `Membership`, `Account`, `Balance`, `Transaction`, `Split`, `Category`, `Rule`, `Budget`, `Goal`, `Bill`, `Attachment`, `AuditEntry`.
- **Categorization service:** deterministic rule interpreter shared by client and server; merchant-memory store; an ML classifier retrained on user corrections. Every automated decision is explainable in the UI ("Rule: payee contains 'starbucks' → Coffee").
- **Idempotency & dedupe:** stable natural keys per transaction; a dedupe window tolerant of bank-side edits (amount/date/payee fingerprint).
- **Offline:** mobile read-cache plus offline manual entry with server reconciliation; full offline-first is P2.
- **Engineering quality:** IaC, CI/CD, unit coverage ≥ 80% on core ledger logic, E2E tests over critical paths, staging environment with sandbox aggregator data.

---

## 10. UX requirements & key flows

**Information architecture:** Home · Transactions · Plan (budgets, goals, bills, debt) · Reports · Net Worth · Settings.

**Design language:** calm, legible, number-forward; clear state colors for over/under budget; motion only for feedback. (Detailed visual design is out of scope for this PRD.)

**Critical flows and their requirements:**

1. **First-run:** install → sign up → link a bank (aggregator auth) → dashboard with real data, median ≤ 10 min. The sample-data path must reach an equivalent dashboard.
2. **Daily check-in (60 seconds):** open → pull-to-refresh → glance dashboard → clear flagged items → done.
3. **Log a cash expense (≤ 10s):** widget or FAB → amount keypad → payee autosuggest → save.
4. **Sync failure:** explicit per-account banner → "Fix" → provider re-auth → resume. Never silent stale data.
5. **Budget overage:** alert → deep-link to the category → view transactions or adjust budget inline.
6. **Migration:** upload file → map fields → preview counts → import → 7-day undo window.

Every screen ships with designed empty, loading, error, and stale-data states (content specs in the design phase).

---

## 11. Monetization & packaging (proposed)

| Tier    | Price (proposed)  | Includes                                                                                                                                |
| ------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Free    | $0                | Up to 3 linked accounts; unlimited manual accounts and cash tracking; core budgets and reports; full export                             |
| Premium | $7.99/mo · $69/yr | Unlimited linked accounts; forecasting; goals; bills & subscriptions; household sharing (up to 5 members); tax report; priority support |

Principles: no ads ever; data never sold; **export available on the free tier** (no hostage-taking); 30-day Premium trial on signup. Pricing to be validated against the paid-only incumbents (Monarch, Copilot, YNAB all sit in the roughly $100/yr class as of 2026) via willingness-to-pay research in beta.

---

## 12. Assumptions, dependencies, risks

**Assumptions:** US-first launch (USD, en-US); cloud SaaS (no self-hosted edition at MVP); web + iOS + Android all ship at MVP; Plaid as launch aggregator; freemium subscription model; no KYC/money-transmitter licensing needed because the product moves no money.

**Dependencies:** aggregator contract and pricing; Apple/Google app-store review; push and email providers; identity provider.

| #   | Risk                                                                                                       | Likelihood | Impact      | Mitigation                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| R1  | Aggregator sync reliability/coverage gaps — historically the #1 PFM pain point                             | High       | High        | Aggregator abstraction layer; per-institution telemetry; manual + CSV import as first-class fallbacks; honest sync-status UX |
| R2  | Aggregator per-item pricing erodes margin at scale                                                         | High       | Medium      | Free-tier link limits; webhook-driven rather than polling sync; volume-tier negotiation                                      |
| R3  | Security incident                                                                                          | Low        | Existential | NFR-1–3; SOC 2; pen tests; least-privilege access; rehearsed incident-response plan                                          |
| R4  | US open-banking flux: §1033 rule finalized Oct 2024, then stayed and under reconsideration as of 2025–2026 | Medium     | Medium      | Monitor rulemaking; the abstraction layer also positions us to connect directly to bank APIs where they emerge               |
| R5  | Incumbents (Monarch, banks) copy differentiators                                                           | Medium     | Medium      | Speed, a trust-first brand, data-freedom moat, and the spreadsheet-refugee community                                         |
| R6  | Categorization/sync edge cases create duplicate or missing transactions                                    | High       | High        | Idempotent pipeline; dedupe fingerprints; audit log; reconciliation feature; fast support remediation                        |
| R7  | Free tier mistuned (too generous → no revenue; too stingy → no activation)                                 | Medium     | Medium      | Beta pricing experiments; optimize activation first, conversion second                                                       |
| R8  | Small-team bandwidth                                                                                       | —          | —           | Ruthless MVP scope; investments and multi-currency deferred to V2                                                            |

---

## 13. Release plan & milestones (proposed)

| Milestone             | Target   | Content                                                                       | Exit criteria                                |
| --------------------- | -------- | ----------------------------------------------------------------------------- | -------------------------------------------- |
| M0 — Alpha            | T+6 wks  | Manual ledger core (accounts, transactions, categories, budgets)              | Team dogfoods daily                          |
| M1 — Private beta     | T+3 mo   | + aggregation, auto-categorization, dashboard & net worth, security hardening | 200 households; sync ≥ 99%; activation ≥ 60% |
| M2 — Public beta / GA | T+6 mo   | + polish, onboarding, billing (Premium)                                       | W4 retention ≥ 35%; crash-free ≥ 99.5%       |
| M3 — V1.1             | GA+6 wks | Bills & subscriptions, forecasting, goals, importers                          | Migration CSAT ≥ 4.5/5                       |
| M4 — V1.2             | GA+3 mo  | Household sharing, debt planner, tax report, reconciliation                   | ≥ 10% of households have 2+ members          |
| M5 — V2               | GA+9 mo  | Investments (read-only), multi-currency, what-if, offline-first               | Defined at V1.2 review                       |

---

## 14. Open questions

1. **Market:** US-only at MVP, or EU early? (Changes aggregator choice and compliance profile.)
2. **Platform order:** if sequencing is forced, web or mobile first for beta?
3. **Aggregator:** Plaid vs. Finicity/MX as launch partner — cost vs. coverage trade-off?
4. **Encryption posture:** do we ever offer an end-to-end-encrypted mode, accepting that it breaks household sharing and server-side ML?
5. **Self-hosted/community edition:** on the roadmap at all? Wins spreadsheet refugees but splits revenue focus.
6. **Alternative assets:** track crypto/other assets read-only in V2, or exclude entirely?
7. **Name & trademark:** final product name clearance.

---

## Appendix A — Representative user stories & acceptance criteria

**US-1 · Link a bank account (P0).** As a new user, I want to link my bank so transactions appear automatically.

- Given a supported institution, when I complete the aggregator auth flow, then accounts appear with balances within 60 seconds and transactions backfill at least 90 days where the institution provides them.
- Given an unsupported or failed institution, then I see a clear explanation and can add the account manually with CSV import.

**US-2 · Auto-categorization transparency (P0).** As a user, I want to know why a transaction was categorized, and correct it once.

- Given an auto-categorized transaction, then I can view the reason (rule / learned merchant / suggestion with confidence).
- Given I recategorize a merchant, then future transactions from that merchant on that account default to my correction.

**US-3 · Transfer detection (P0).**

- Given a $500 credit-card payment matching a $500 checking outflow within ±3 days, then both are marked as a transfer and excluded from income/expense reports, with one-tap undo.

**US-4 · Budget alert (P0).**

- Given a category reaches 80% of its monthly budget, then a push notification fires (respecting quiet hours) and deep-links to that category's transactions.

**US-5 · Split a transaction (P0).**

- Given any transaction, then I can split it n ways across categories by amount or percentage, and the parts must sum to the original.

**US-6 · Migrate from Mint (P1).**

- Given a Mint transactions CSV, when I map fields, then I see a preview (counts by account and category, date range) before committing, and I can undo the import for 7 days.

**US-7 · Household sharing (P1).**

- Given an owner invites member@example.com, when the invite is accepted, then the member sees shared accounts but never private-marked accounts, and every change carries the member's identity in the audit trail.

**US-8 · Forecast (P1).**

- Given scheduled bills and detected recurring income, when I view the 30-day forecast, then I see projected daily balance, the minimum-balance date, and a warning if any day projects below zero.

**US-9 · Export everything (P0).**

- Given any user, when they request a full export, then they receive within minutes a zip of CSVs plus a JSON manifest covering accounts, transactions, budgets, and rules — no support ticket required.

---

## Appendix B — Glossary

| Term                            | Definition                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| PFM                             | Personal Financial Management — software for tracking and planning personal money.                                                                |
| Aggregation                     | Third-party service (e.g., Plaid) that connects to banks and returns balances/transactions via API.                                               |
| Open banking / §1033 / PSD2     | Regulations requiring banks to expose customer data to authorized third parties; the US §1033 rule is currently stayed and under reconsideration. |
| Net worth                       | Assets minus liabilities.                                                                                                                         |
| Cash flow                       | Money in vs. money out over a period.                                                                                                             |
| Safe to spend                   | Discretionary money available today after commitments.                                                                                            |
| Envelope / zero-based budgeting | Method where every dollar is assigned a job before the month starts.                                                                              |
| Rollover                        | Unused budget carried into the next period.                                                                                                       |
| Snowball / avalanche            | Debt payoff orders: smallest-balance-first vs. highest-interest-first.                                                                            |
| Reconciliation                  | Matching app records against an official bank statement.                                                                                          |
| OFX / QIF / QBO                 | Legacy bank-export and financial-software file formats.                                                                                           |
| TWR                             | Time-weighted return — investment performance independent of deposits/withdrawals.                                                                |
| Idempotency                     | Re-running the same operation produces no duplicate effects.                                                                                      |
| SOC 2                           | Security-audit certification standard for SaaS.                                                                                                   |
| Passkey                         | Phishing-resistant passwordless login credential.                                                                                                 |
