# Cruise Booking — n8n Business Automation

## Daily Cruise Business Health & Intelligence Automation

---

## 1. Overview
The **Daily Cruise Business Health & Intelligence Automation** is an asynchronous, decoupled business intelligence pipeline powered by **n8n** and Large Language Models (AI). Every morning at 07:00 AM, n8n automatically connects to the Odysseus Cruise Booking MongoDB database (`cruise_booking`), analyzes performance from the preceding 24 hours, monitors live inventory capacity across all fleet ships, evaluates promotional code health and burn rates, applies deterministic business rules, and prompts an AI Business Agent to generate strategic executive recommendations. The resulting intelligence report is delivered via email to leadership and logged to a cumulative Google Sheets audit trail.

---

## 2. Business Problem
In cruise holiday operations, management faces three recurring operational challenges:
1. **Perishable Inventory Risk**: Cruise cabins cannot be sold after a ship departs. Unsold capacity represents permanent revenue loss, while undetected sold-out situations prevent demand redirection.
2. **Promotion Exhaustion & Margin Dilution**: High-performing discount codes (e.g. `SUMMER10`, `CREW25`) can exhaust their global allocation rapidly, leaving prospective high-intent bookers with rejected checkouts, or expiring before marketing realizes campaigns need refreshing.
3. **Information Lag**: Executives and operations teams often discover sales trends and inventory bottlenecks days late when reviewing retrospective reports.

---

## 3. Automation Objective
To deliver a high-level, reliable **Daily Business Health & Executive Summary** by 07:00 AM every single morning without requiring manual data pulling, database queries, or operational overhead.

---

## 4. Why n8n?
- **Decoupled Architecture**: Runs entirely outside the user-facing booking transaction path. Zero latency impact on customer checkouts.
- **Visual Workflow Orchestration**: Clear node-by-node auditability from trigger to data extraction, rule processing, AI prompting, validation, and multi-channel delivery.
- **Direct MongoDB Integration**: Native read-only querying of collections (`Orders`, `Cruises`, `PromoCodes`).
- **Resilient Error Handling**: Built-in Error Trigger (`Error Trigger Node 12`) ensures notification dispatch even if database connectivity, LLM API, or delivery channels fail.

---

## 5. Workflow Architecture

```
                 CRUISE BOOKING SYSTEM (PRODUCTION)
        ┌─────────────────────────────────────────────────┐
        │ React (Vite) Frontend                           │
        │ Node.js + Express REST API                      │
        │ MongoDB Database: cruise_booking                │
        │ Collections: Orders, Cruises, PromoCodes        │
        └───────────────────────┬─────────────────────────┘
                                │
                                │ Read-only query (07:00 AM)
                                ▼
              ┌─────────────────────────────────────┐
              │             n8n WORKFLOW             │
              │                                     │
              │  01 Schedule Trigger (07:00 AM)     │
              │       ↓                             │
              │  02–04 Read Mongo Collections       │
              │       ↓                             │
              │  05 Aggregate Metrics (Facts)       │
              │       ↓                             │
              │  06 Deterministic Business Analysis │
              │       ↓                             │
              │  07 AI Business Agent               │
              │       ↓                             │
              │  08 Output Validation               │
              │       ↓                             │
              │  09 Generate Final Report           │
              └──────────────────┬──────────────────┘
                                 │
                     ┌───────────┴───────────┐
                     ▼                       ▼
           10 Executive Email       11 Google Sheets Log
             (HTML + Markdown)         (Audit Trail)
```

---

## 6. Schedule Trigger
- **Cron Expression**: `0 7 * * *` (Daily at 07:00:00 AM).
- **Rationale**: Scheduled execution rather than event webhooks prevents workflow flooding during high-traffic booking spikes and provides management with consistent start-of-day operational context.

---

## 7. MongoDB Data Sources (Read-Only)

### A. `Orders` Collection
- **Query Filter**: `{ createdAt: { $gte: ISODate("yesterdayT00:00:00Z"), $lt: ISODate("todayT00:00:00Z") } }`
- **Extracted Fields**:
  - `grandTotal` (Revenue generated)
  - `passengers` (Passenger volume)
  - `cruiseNameSnapshot` (Ship / route popularity)
  - `promoCodeSnapshot` (Redemption volume and discount totals)
- **Design Advantage**: Uses frozen order snapshots (`adultFareSnapshot`, `promoCodeSnapshot`, `taxRateApplied`) rather than recomputing historical fares against current rules.

### B. `Cruises` Collection
- **Query Filter**: `{}` (All active fleet records)
- **Extracted Fields**:
  - `cruiseLine`, `ship`, `destination`, `nights`, `adultFare`, `capacityLeft`
- **Alert Criteria**: `capacityLeft <= 2` (Configurable threshold for low inventory/sold-out warnings).

### C. `PromoCodes` Collection
- **Query Filter**: `{}` (All promo documents)
- **Extracted Fields**:
  - `code`, `type`, `value`, `validFrom`, `validTo`, `maxTotalUses`, `currentTotalUses`, `minimumSpend`
- **Alert Criteria**:
  - `burnRate = (currentTotalUses / maxTotalUses) * 100 >= 80%`
  - `validTo - today <= 7 days` (Expiring soon)

---

## 8. Revenue & Performance Analysis
The workflow calculates deterministic aggregates:
- **Total Gross Revenue**: $\sum \text{Order.grandTotal}$
- **Total Net Pre-Tax Subtotal**: $\sum \text{Order.preTaxSubtotal}$
- **Total Bookings Count**: $N_{\text{orders}}$
- **Total Passengers Traveled**: $\sum \text{Order.passengers.length}$
- **Average Order Value (AOV)**: $\frac{\text{Total Gross Revenue}}{N_{\text{orders}}}$
- **Top Performing Cruise**: The cruise title with highest booking count.

---

## 9. Capacity Monitoring
Live fleet inventory is categorized deterministically into three operational states:
1. **SOLD OUT**: `capacityLeft === 0` (e.g. MSC Seascape).
2. **CRITICAL / LOW INVENTORY**: `0 < capacityLeft <= 2` (Immediate sales throttling or fare optimization).
3. **HEALTHY INVENTORY**: `capacityLeft > 2` (Target for promotional campaigns and agent allocation).

---

## 10. Promo-Code Monitoring & Burn Rate
Evaluates each promotional code against exhaustion and expiration risks:
- **Exhaustion Alert**: When `currentTotalUses / maxTotalUses >= 0.80`, flags the code so marketing can prepare a replacement or raise the cap.
- **Expiration Alert**: When `validTo` is within 7 days from execution time, flags the promo to prevent customer frustration.

---

## 11. Deterministic Business Rules Engine (Code Before AI)
To guarantee 100% mathematical and factual accuracy, **all calculations and threshold evaluations are executed in pure JavaScript code prior to invoking the AI Agent**:

```javascript
// Deterministic Business Analysis Node
const capacityAlerts = cruises
  .filter(c => c.capacityLeft <= 2)
  .map(c => ({
    cruise: `${c.cruiseLine} — ${c.ship}`,
    capacityLeft: c.capacityLeft,
    status: c.capacityLeft === 0 ? 'SOLD_OUT' : 'CRITICAL_LOW'
  }));

const promoAlerts = promoCodes
  .filter(p => (p.currentTotalUses / p.maxTotalUses) >= 0.8 || (new Date(p.validTo) - now) < 7 * 86400000)
  .map(p => ({
    code: p.code,
    usagePercentage: Math.round((p.currentTotalUses / p.maxTotalUses) * 100),
    daysUntilExpiry: Math.ceil((new Date(p.validTo) - now) / 86400000)
  }));
```

**Key Architectural Principle**: **Code provides reliability; AI provides intelligence.** The AI never calculates numbers; it interprets pre-verified facts.

---

## 12. AI Business Agent
The AI Business Agent takes the deterministic JSON payload and formulates a concise, contextual business interpretation.

### System Prompt
```
You are the Odysseus Cruise Executive Operations AI Agent.
You receive verified, pre-calculated daily metrics, inventory capacity alerts, and promo burn rates.
Your role:
1. Provide a concise executive overview of yesterday's commercial performance.
2. Interpret capacity bottlenecks and highlight inventory risks.
3. Identify marketing and promotional risks.
4. Formulate 3-4 specific, high-priority, actionable recommendations for Sales, Marketing, and Revenue Management.

Guidelines:
- Do not invent numbers or alter any provided data.
- Base every recommendation directly on the provided facts.
- Keep language executive, clear, and actionable.
```

---

## 13. AI Safety Boundaries
> [!IMPORTANT]
> **Strict AI Sandbox & Isolation**:
> - The AI agent is **READ-ONLY** and completely decoupled from transactional databases.
> - **Never Participates in Financial Operations**: The AI cannot alter booking totals, apply unverified discounts, modify database records, or change cruise capacity.
> - **No Hallucinated Mathematics**: All monetary figures, passenger counts, and capacity numbers are calculated by deterministic code before prompting.

---

## 14. Output Validation & Fallback Handling
After receiving the AI output, **Node 08 (Validate AI Response)** inspects the response:
- Verifies non-empty string output containing expected operational sections (`Executive Summary`, `Risks`, `Recommendations`).
- If the AI call fails or returns malformed text, a deterministic **Rule-Based Fallback Summary** is automatically substituted, ensuring email dispatch and logging are never blocked.

---

## 15. Complete 12-Node n8n Workflow

| Node # | Node Name | Type | Description |
|:------:|-----------|------|-------------|
| **01** | `Schedule Trigger` | `n8n-nodes-base.cron` | Fires every day at 07:00 AM |
| **02** | `Get Yesterday Orders` | `n8n-nodes-base.mongoDb` | Reads all `Orders` created in the last 24 hours |
| **03** | `Get Cruise Capacity` | `n8n-nodes-base.mongoDb` | Reads all fleet `Cruises` with current `capacityLeft` |
| **04** | `Get Promo Code Health` | `n8n-nodes-base.mongoDb` | Reads all `PromoCodes` and usage counters |
| **05** | `Aggregate Business Metrics` | `n8n-nodes-base.code` | Calculates revenue, passengers, AOV, top cruise |
| **06** | `Deterministic Business Analysis` | `n8n-nodes-base.code` | Evaluates thresholds for capacity & promo alerts |
| **07** | `AI Business Agent` | `@n8n/n8n-nodes-langchain.agent` | Analyzes structured payload and generates insights |
| **08** | `Validate AI Response` | `n8n-nodes-base.code` | Validates AI payload integrity; triggers fallback if invalid |
| **09** | `Generate Final Report` | `n8n-nodes-base.code` | Builds HTML & plain-text executive email template |
| **10** | `Send Email Report` | `n8n-nodes-base.emailSend` | Delivers executive summary to management team |
| **11** | `Append Google Sheets Log` | `n8n-nodes-base.googleSheets` | Records daily row into cumulative audit spreadsheet |
| **12** | `Error Trigger & Alert` | `n8n-nodes-base.errorTrigger` | Catches workflow failures and sends immediate alert |

---

## 16. Example Input Payload to AI Agent

```json
{
  "date": "2026-08-18",
  "performance": {
    "revenue": 18450.00,
    "bookings": 24,
    "passengers": 71,
    "averageOrderValue": 768.75,
    "topCruise": "Royal Caribbean — Wonder of the Seas"
  },
  "capacityAlerts": [
    {
      "cruise": "Princess Cruises — Sky Princess",
      "capacityLeft": 2,
      "status": "CRITICAL_LOW"
    },
    {
      "cruise": "MSC Cruises — MSC Seascape",
      "capacityLeft": 0,
      "status": "SOLD_OUT"
    }
  ],
  "promoAlerts": [
    {
      "code": "SUMMER10",
      "currentUses": 91,
      "maxUses": 100,
      "usagePercentage": 91,
      "status": "NEAR_EXHAUSTION"
    }
  ]
}
```

---

## 17. Example Generated Executive Email Report

```
================================================================================
⚓ ODYSSEUS CRUISE HOLIDAYS — DAILY BUSINESS HEALTH REPORT
Date: 18 August 2026 | Generated: 07:00:15 UTC
================================================================================

📊 YESTERDAY'S COMMERCIAL PERFORMANCE
--------------------------------------------------------------------------------
• Total Gross Revenue:    $18,450.00
• Confirmed Bookings:     24
• Total Passengers:       71
• Average Order Value:    $768.75
• Top Performing Route:   Royal Caribbean — Wonder of the Seas (9 bookings)

⚠️ CAPACITY & INVENTORY ALERTS
--------------------------------------------------------------------------------
1. Princess Cruises — Sky Princess: Only 2 spots left (Critical Low)
2. MSC Cruises — MSC Seascape: SOLD OUT (0 spots remaining)

🎟️ PROMOTION HEALTH ALERTS
--------------------------------------------------------------------------------
1. SUMMER10: 91% global limit consumed (91 / 100 redemptions). Exhaustion imminent.

🧠 AI STRATEGIC INSIGHTS & INTERPRETATION
--------------------------------------------------------------------------------
• High Demand on Sky Princess: Approaching full sell-out; yield management should
  consider closing discount promo eligibility for remaining inventory.
• Marketing Burn Rate Warning: SUMMER10 has 9 slots remaining. High likelihood of
  checkout rejection by mid-day if campaign traffic continues at current pace.
• Untapped Inventory: Norwegian Prima has 20 spots remaining (highest in fleet).

🎯 ACTION ITEMS
--------------------------------------------------------------------------------
1. Revenue Mgmt: Lock final 2 Sky Princess berths for premium direct inquiries.
2. Marketing: Stage replacement promo 'LATESUMMER10' before SUMMER10 caps out.
3. Sales Team: Redirect group inquiries to Norwegian Prima (Alaska, 5 nights).
================================================================================
```

---

## 18. Google Sheets Historical Log Schema

Every execution appends one row to the **Odysseus Business Intelligence Log** spreadsheet:

| Date | Total Revenue | Bookings Count | Passengers Count | AOV | Top Cruise | Low Capacity Count | Sold Out Count | Promo Alerts Count | Execution Status |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 2026-08-18 | $18,450.00 | 24 | 71 | $768.75 | Wonder of the Seas | 1 | 1 | 1 | SUCCESS |
| 2026-08-19 | $21,200.00 | 29 | 83 | $731.03 | Celebrity Beyond | 0 | 1 | 2 | SUCCESS |
| 2026-08-20 | $17,850.00 | 21 | 64 | $850.00 | Sky Princess | 1 | 2 | 0 | SUCCESS |

---

## 19. Error Handling Architecture
If any node encounters an uncaught exception (e.g. database timeout, authentication expired, AI rate limit exceeded):
1. **Node 12 (`Error Trigger`)** intercepts the execution context immediately.
2. Extracts error details (node name, timestamp, stack trace).
3. Formulates an urgent incident alert dispatched via email/Slack to the on-call engineering lead:
   ```
   🚨 AUTOMATION INCIDENT ALERT
   Workflow: Daily Cruise Business Health Automation
   Failed Node: Get Yesterday Orders (Node 02)
   Error: MongoTimeoutError - Server selection timed out after 30000 ms
   Timestamp: 2026-08-18T07:00:32Z
   Action Required: Verify MongoDB Atlas cluster status.
   ```

---

## 20. Security & Compliance
- **Read-Only Database Credentials**: The n8n connection uses a dedicated MongoDB user restricted strictly to `find` privileges on `Orders`, `Cruises`, and `PromoCodes`.
- **No Customer PII Sent to LLM**: Customer names, emails, phone numbers, and physical addresses are scrubbed during Node 05 aggregation and never exposed in the LLM prompt.
- **Environment Isolation**: Database connection strings and API keys reside in n8n encrypted credential vaults.

---

## 21. Limitations & Assumptions
- **Daily Window**: Analyzes completed calendar days (00:00:00 to 23:59:59 UTC). Intraday sales occurring after 07:00 AM are captured in the subsequent morning's report.
- **Decision Support Only**: The system proposes recommendations; it does not automatically modify live database prices or create promotions without human approval.

---

## 22. Future Improvements (Planned / Roadmap)
1. **Multi-Channel Dispatch**: Integration with Slack / Microsoft Teams operations channels.
2. **Predictive Occupancy Modeling**: Forecasting booking curve velocity using machine learning regressors.
3. **Automated Draft Campaigns**: Generating draft promo code documents in MongoDB awaiting one-click Admin UI approval.
