# Business Requirements

## System Overview
Odysseus sells cruise holidays. This system allows customers to find a cruise, specify travellers, select optional extras, apply a promotional code, review a full price breakdown, and confirm a booking. Business owners can permanently reconstruct every sale.

---

## Pricing Rules

### 1. Child Fare Multipliers (by age)
| Age Range | Multiplier | Price |
|-----------|-----------|-------|
| 1–4 | 0% | Free (infants/children aged 1–4) |
| 5–11 | 50% | Half adult fare |
| 12–17 | 75% | Three-quarter adult fare |
| 18+ | — | Treated as adult (not a child) |

### 2. Booking Limits
- Minimum 1 adult per booking
- Maximum 6 passengers per booking (adults + children combined)
- Children must be aged 1–17 (age 0, negatives, and decimals disallowed); passengers aged 18+ must be entered as adults

### 3. Group Discount (applied to cruise fare subtotal only)
| Total Passengers | Discount |
|-----------------|---------|
| 1–2 | 0% |
| 3–4 | 0% |
| 5–6 | 5% |

**Source table ambiguity note (verbatim):** The source brief showed 3 passenger bands (1–2, 3–4, 5–6) alongside 4 discount values (blank/implied, 0%, 5%, 10%). The plain reading of the table's blank leading row for 1–2 passengers is 0% discount. 3–4 passengers also maps to 0% — no discount at small group sizes. 5–6 passengers maps to 5%. The leftover "10%" value appears to be an unused entry or typo in the source document and has been dropped. This resolution is intentional and must not be silently reinterpreted.

### 4. Optional Services
| Service | Price | Basis |
|---------|-------|-------|
| Travel Insurance | $80 | Per passenger |
| Wi-Fi | $15 | Per passenger, per night |
| Shore Excursion | $120 | Per passenger |

**Assumption:** Optional services are charged at full listed price per passenger regardless of age. The brief only defines age-based pricing for cruise fares; no such table exists for extras. This assumption is logged here and not hardcoded — rates live in the database.

### 5. Promotional Codes
- One promotional code allowed per booking
- Validation checks (all must pass; first failure returns a specific rejection reason):
  1. Code must exist
  2. Today's date must be within `validFrom`–`validTo`
  3. Global usage count must be below `maxTotalUses`
  4. This customer's usage count for the code must be below `maxUsesPerCustomer`
  5. `preTaxSubtotal` must be ≥ `minimumSpend`
- Code applies to `preTaxSubtotal` (discounted cruise fare + optional services total)

### 6. Tax
- Rate: 12% (data-driven — stored in `Settings` collection, snapshotted on each order)
- Applied to `taxableAmount = preTaxSubtotal − promoDiscount`
- Tax is applied **after** the promo discount because the promo reduces the base on which tax is levied

### 7. Order of Operations (exact, do not deviate)
1. Per passenger: `fare = adultFare × childMultiplier(age)`
2. `cruiseFareSubtotal = sum of all passenger fares`
3. `groupDiscountAmount = cruiseFareSubtotal × groupDiscountRate(totalPassengers)`
4. `discountedCruiseFare = cruiseFareSubtotal − groupDiscountAmount`
5. `optionalServicesTotal = sum of chosen extras × passengers (Wi-Fi × nights)`
6. `preTaxSubtotal = discountedCruiseFare + optionalServicesTotal`
7. Validate promo code against `preTaxSubtotal` → `promoDiscount`
8. `taxableAmount = preTaxSubtotal − promoDiscount`
9. `tax = taxableAmount × taxRate`
10. `grandTotal = taxableAmount + tax`

---

## Capacity Rules
- A cruise cannot be sold beyond its `capacityLeft`
- Capacity is decremented atomically by the total number of passengers (not by 1 per booking)
- A capacity=0 cruise must appear in listings as "Sold Out" but must be rejected at booking time

---

## Assumptions & Decisions Log
| # | Item | Decision |
|---|------|---------|
| A1 | Customer identity (no auth) | Email address is used as the customer key for per-customer promo tracking. Collisions (e.g. shared family email) are accepted as a known limitation given the no-auth constraint. |
| A2 | Minimum spend basis | `preTaxSubtotal` (before tax), consistent with the order of operations |
| A3 | Capacity decrement unit | Total passengers in the booking (e.g. 2 adults + 1 child = decrement by 3) |
| A4 | Booking reference format | Short alphanumeric: `CBS-XXXXXX` (6 uppercase alphanum chars) |
| A5 | Child age 18+ entered as child | Rejected with: "Child age must be 0–17. Passengers aged 18+ must be entered as adults." |
| A6 | Promo code case sensitivity | Case-insensitive (stored and matched in uppercase) |
| A7 | Sold-out cruise (capacity=0) | Shown in listings with a "Sold Out" badge; rejected at quote/booking with specific message |
| A8 | Optional services & children | Full listed price per passenger regardless of age (no age-based table defined for extras) |
| A9 | WINTER5 intentionally expired | valid range Jan–Mar 2025 is past; must always return "expired" rejection. This is a required test case. |
| A10 | Email uniqueness | No uniqueness constraint on Customer collection — same email may appear multiple times (one per booking). Usage count for promo per-customer limit is computed by counting Orders with matching email + promoCode. |
| A11 | Child fare bands and group tiers are data-driven | Stored in `PricingRules` collection, fetched at quote time, snapshotted into the Order |
