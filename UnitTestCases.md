# Unit Test Cases

## 1. Child Fare Multiplier (pricingEngine — computePassengerFare)

| Test ID | Input (age, adultFare) | Expected fare | Reason |
|---------|----------------------|--------------|--------|
| CF-01 | age=1, fare=$1200 | $0 | Band 1–4: free (lower boundary) |
| CF-02 | age=4, fare=$1200 | $0 | Band 1–4: free (upper boundary) |
| CF-03 | age=5, fare=$1200 | $600 | Band 5–11 lower boundary: 50% |
| CF-04 | age=11, fare=$1200 | $600 | Band 5–11 upper boundary: 50% |
| CF-05 | age=12, fare=$1200 | $900 | Band 12–17 lower boundary: 75% |
| CF-06 | age=17, fare=$1200 | $900 | Band 12–17 upper boundary: 75% |
| CF-07 | age=18, fare=$1200 | ERROR | 18+ is adult; reject with message |
| CF-08 | age=0, fare=$1200 | ERROR | Age 0 disallowed (real-world validation) |
| CF-09 | age=-1, fare=$1200 | ERROR | Negative age invalid |
| CF-10 | age=4.5, fare=$1200 | ERROR | Non-integer age invalid |

## 2. Group Discount (pricingEngine — computeGroupDiscount)

| Test ID | Total passengers | Cruise fare subtotal | Expected discount | Expected discounted fare |
|---------|-----------------|--------------------|--------------------|------------------------|
| GD-01 | 1 | $1200 | $0 (0%) | $1200 |
| GD-02 | 2 | $2400 | $0 (0%) | $2400 |
| GD-03 | 3 | $3600 | $0 (0%) | $3600 |
| GD-04 | 4 | $4800 | $0 (0%) | $4800 |
| GD-05 | 5 | $6000 | $300 (5%) | $5700 |
| GD-06 | 6 | $7200 | $360 (5%) | $6840 |

## 3. Booking Validation

| Test ID | Scenario | Expected result |
|---------|---------|----------------|
| BV-01 | 0 adults, 2 children | REJECT: at least 1 adult required |
| BV-02 | 7 passengers (4 adults + 3 children) | REJECT: max 6 passengers |
| BV-03 | 6 passengers (3 adults + 3 children) | ACCEPT |
| BV-04 | Child age=18 entered | REJECT: must be adult |
| BV-05 | Child age=0 entered | REJECT: must be between 1 and 17 |

## 4. Capacity

| Test ID | Scenario | Expected result |
|---------|---------|----------------|
| CAP-01 | Book 4 passengers on cruise with capacityLeft=4 | ACCEPT; capacityLeft → 0 |
| CAP-02 | Book 1 passenger on cruise with capacityLeft=0 | REJECT: sold out |
| CAP-03 | Book 5 passengers on cruise with capacityLeft=4 | REJECT: not enough capacity |
| CAP-04 | MSC Seascape (capacity=0) booking attempt | REJECT: sold out |

## 5. Promo Code Validation

| Test ID | Code | Scenario | Expected rejection reason |
|---------|------|---------|--------------------------|
| PC-01 | SUMMER10 | Valid date, above min spend, uses available | ACCEPT |
| PC-02 | WINTER5 | Expired (valid Jan–Mar 2025, today is Aug 2026) | REJECT: "Promo code has expired" |
| PC-03 | SUMMER10 | preTaxSubtotal=$500 (below $1,000 minimum) | REJECT: "Minimum spend of $1,000 not met" |
| PC-04 | FIRST150 | currentTotalUses=500 (exhausted, max=500) | REJECT: "Promo code has reached its maximum uses" |
| PC-05 | CREW25 | Customer has already used it 3 times | REJECT: "You have reached the maximum uses for this code" |
| PC-06 | BOGUS99 | Code does not exist | REJECT: "Promo code not found" |
| PC-07 | FIRST150 | preTaxSubtotal=$1,500 (below $2,000 minimum) | REJECT: "Minimum spend of $2,000 not met" |
| PC-08 | SUMMER10 | Today is 2026-08-18 (within Jun–Aug 2026) | ACCEPT (not expired) |

## 6. Full Pricing Walkthrough (Order of Operations)

**Scenario:** 2 adults + 1 child (age 10) on Royal Caribbean Wonder of the Seas (7 nights, $1,200/adult), with Wi-Fi and Insurance. Promo: SUMMER10.

| Step | Calculation | Value |
|------|------------|-------|
| Adult 1 fare | $1,200 × 1.0 | $1,200 |
| Adult 2 fare | $1,200 × 1.0 | $1,200 |
| Child fare (age 10) | $1,200 × 0.5 | $600 |
| cruiseFareSubtotal | $1,200 + $1,200 + $600 | $3,000 |
| Group discount (3 pax → 0%) | $3,000 × 0% | $0 |
| discountedCruiseFare | $3,000 − $0 | $3,000 |
| Insurance (3 pax × $80) | | $240 |
| Wi-Fi (3 pax × $15 × 7 nights) | | $315 |
| optionalServicesTotal | $240 + $315 | $555 |
| preTaxSubtotal | $3,000 + $555 | $3,555 |
| SUMMER10 (10%, min $1,000 ✓) | $3,555 × 10% | $355.50 |
| taxableAmount | $3,555 − $355.50 | $3,199.50 |
| tax (12%) | $3,199.50 × 12% | $383.94 |
| **grandTotal** | $3,199.50 + $383.94 | **$3,583.44** |

## 7. Optional Services
| Test ID | Scenario | Expected |
|---------|---------|---------|
| OS-01 | Wi-Fi, 2 passengers, 7 nights | $15 × 2 × 7 = $210 |
| OS-02 | Shore excursion, 3 passengers | $120 × 3 = $360 |
| OS-03 | Insurance + Shore excursion, 1 passenger | $80 + $120 = $200 |
