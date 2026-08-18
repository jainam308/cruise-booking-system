# Technical Approach

## Architecture
- **Frontend:** React 18 + Vite, communicates with backend via REST API (axios)
- **Backend:** Node.js + Express, all business logic in `pricingEngine.js` (pure functions)
- **Database:** MongoDB + Mongoose

## Key Design Decisions

### 1. Immutable Order Snapshot (Requirements 8 & 10)
Every confirmed booking stores a full frozen snapshot, not live references:
- `adultFareSnapshot` — the fare at time of booking
- `childMultiplierApplied` — the multiplier used per child (from rules at booking time)
- `groupDiscountPercentApplied` — the rate used
- `promoCodeSnapshot` — full copy of the promo document
- `taxRateApplied` — the tax rate at booking time
- `optionalServicesSnapshot` — the per-unit prices used

This means the grand total is **always reconstructable** from the Order document alone, even after every pricing rule has been changed. No joins or external lookups are required to verify a past booking.

The price shown at the quote stage is computed identically to the price charged at confirmation — the same `pricingEngine.buildPriceBreakdown()` function is called in both `/quote` and `/confirm`. The quote result is not cached; it is recomputed at confirm time using the same inputs, so the two figures are structurally identical. (See Tradeoff #3 for the race condition note.)

### 2. Atomic Capacity & Promo-Usage Enforcement
MongoDB does not provide multi-document ACID transactions by default (without replica sets or transactions explicitly enabled). To avoid race conditions, we use **atomic `findOneAndUpdate` with conditional filters**:

**Capacity:**
```js
Cruise.findOneAndUpdate(
  { _id: cruiseId, capacityLeft: { $gte: passengerCount } },
  { $inc: { capacityLeft: -passengerCount } },
  { new: true }
)
```
If this returns `null`, the cruise is full and the booking is rejected — no double-decrement is possible.

**Promo usage:**
```js
PromoCode.findOneAndUpdate(
  { code, currentTotalUses: { $lt: maxTotalUses } },
  { $inc: { currentTotalUses: 1 } },
  { new: true }
)
```

**Tradeoff acknowledged:** This is not equivalent to a database transaction. A failure after capacity is decremented but before the Order is saved would leave capacity decremented without a corresponding order. In production this would require a two-phase commit or MongoDB transactions with a replica set. This limitation is noted here; the atomic filter approach is chosen for simplicity within the brief's constraints.

### 3. Quote-to-Confirm Price Guarantee
The quote price and confirm price are guaranteed to match because:
- The same pure function (`buildPriceBreakdown`) is called at both stages
- Inputs (cruiseId, passengers, extras, promoCode) are re-submitted at confirm time
- No quote is cached or stored before confirmation

**Known race window:** Between quote and confirm, another booking could fill capacity or exhaust a promo code. This is handled by the atomic filters at confirm time — the booking will be rejected with a clear error if this occurs. The price itself cannot change between quote and confirm as it is always computed fresh.

### 4. Data-Driven Rules (No Code Changes Required)
The following are stored in MongoDB and fetched at runtime:
| Rule | Collection | Field(s) |
|------|-----------|---------|
| Tax rate | `Settings` | `{ key: "taxRate", value: 0.12 }` |
| Child fare bands | `PricingRules` | `{ type: "childFareBands", bands: [...] }` |
| Group discount tiers | `PricingRules` | `{ type: "groupDiscountTiers", tiers: [...] }` |
| Optional service rates | `PricingRules` | `{ type: "optionalServices", services: [...] }` |

Changing any of these in MongoDB takes effect immediately — no redeployment needed.

### 5. Customer Identity Without Auth
Email address is used as the customer key for per-customer promo limit tracking. Usage count is computed as:
```js
Order.countDocuments({ customerEmail: email, 'promoCodeSnapshot.code': code })
```
**Known limitation:** A customer can bypass per-customer limits by using a different email address. Accepted given the no-auth constraint in the brief.

---

## Tradeoffs & Known Limitations
| # | Limitation | Notes |
|---|-----------|-------|
| T1 | No ACID transactions | Using atomic `$gte`/`$lt` filters instead. Partial failure window exists (see §2 above). |
| T2 | Email as customer key | Bypassable per-customer promo limits if user changes email |
| T3 | Quote-confirm race window | Capacity or promo could be exhausted between quote and confirm; handled by atomic rejection at confirm time |
| T4 | No auth | Anyone can book with any email — intentional per brief scope |

---

## Endpoint Map
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cruises` | List all cruises (with soldOut flag) |
| POST | `/api/bookings/quote` | Compute full price breakdown (no writes) |
| POST | `/api/bookings/confirm` | Confirm booking (atomic writes) |

---

## n8n Business Intelligence Automation

### 1. Purpose & Overview
The **Daily Cruise Business Health & Intelligence Automation** is an asynchronous business intelligence system powered by **n8n** and AI. Every morning at 07:00 AM, the system analyzes the preceding 24 hours of booking performance, fleet inventory capacity, and promotional code burn rates to provide leadership with actionable recommendations and a permanent historical audit trail.

### 2. Decoupled, Read-Only Architecture
- **Zero Impact on Booking Path**: The automation is entirely separate from user transactions and runs on a daily schedule (`0 7 * * *`), not as a website webhook.
- **Read-Only Database Connection**: Connects to the primary MongoDB database (`cruise_booking`) with read-only permissions across three collections:
  - `Orders`: Extracts revenue, passenger volume, and top routes using frozen order snapshots (`grandTotal`, `adultFareSnapshot`, `promoCodeSnapshot`).
  - `Cruises`: Monitors fleet `capacityLeft` to identify sold-out or critical inventory (`capacityLeft <= 2`).
  - `PromoCodes`: Calculates burn rate (`currentTotalUses / maxTotalUses`) and flags codes approaching exhaustion ($\ge 80\%$) or expiring within 7 days.

### 3. Separation of Concerns: Code vs. AI
```
MongoDB (Raw Data)
       ↓
Deterministic Rules (JavaScript Code)
       ↓
VERIFIED BUSINESS FACTS (Revenue, Capacities, Burn Rates)
       ↓
AI Business Agent (LLM)
       ↓
EXECUTIVE INTERPRETATION & RECOMMENDATIONS
```
- **Code handles the facts**: All sums, counts, averages, and threshold comparisons are computed deterministically.
- **AI handles strategic interpretation**: The LLM never calculates financial numbers; it converts verified facts into operational guidance.

### 4. AI Safety Boundaries
- **No Financial Authority**: The AI cannot alter booking totals, edit cruise capacity, modify promo rules, or execute database writes.
- **No Data Fabrication**: Prompts strictly constrain the model to provided factual JSON payloads.
- **Output Validation & Fallback**: A validation node checks for required sections; if the AI call encounters an error, a deterministic rule-based summary is automatically substituted.

### 5. Multi-Channel Output & Resilient Error Handling
- **Executive Email**: Formatted daily summary sent to leadership at 07:00 AM.
- **Google Sheets Audit Log**: Cumulative historical row appended daily for long-term trend analysis.
- **Error Trigger Node**: Listens globally across all workflow nodes to instantly dispatch an operational alert if database access or delivery channels fail.

---

## Current Status
✅ Core functionality complete and fully verified with unit & integration tests.
✅ n8n Business Intelligence Automation architecture and documentation complete.

| Feature | Status |
|---------|--------|
| Repo init + docs | ✅ Done |
| Models + seed | ✅ Done |
| Pricing engine (unit tests) | ✅ Done (27 tests) |
| Promo validation (unit tests) | ✅ Done (10 tests) |
| API endpoints & integration tests | ✅ Done (33 tests) |
| Frontend React UI & Live Badges | ✅ Done |
| n8n Business Health Automation (`Automation.md`) | ✅ Done |
