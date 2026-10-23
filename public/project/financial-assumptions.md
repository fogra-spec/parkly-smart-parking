# Parkly financial model

All amounts are Kazakhstan tenge (KZT). This is an editable classroom model, prepared on 23 October 2026. It contains assumptions and calculations, not actual Parkly revenue or a validated forecast. Use `financial-model.xlsx` for live formulas and charts. `financial-scenarios.csv` is a portable snapshot of the initial comparison.

## How to use the workbook

1. Open the workbook in Excel or another application that recalculates ordinary Excel formulas.
2. On **Assumptions**, set D4 to 1 (Downside), 2 (Base), or 3 (Upside). This is the only scenario selector. The selected case appears on every worksheet.
3. Edit the amber cells for partners, bookings, price, commission, B2B accounts, subscription fee, payment fee, variable costs and fixed costs. Active formulas feed one 12-month forecast. The separate monthly comparison shows all three requested classroom cases at once.
4. Monthly multipliers change completed booking volume, paid accounts and fixed costs in M1–M12. The default is a flat twelve-month case, not a promised growth path. M1 is the first modeled pilot month; no launch date is assumed.
5. **Budget** contains editable setup and CAPEX estimates. Its detailed 500,000 KZT OPEX budget explains the Base fixed-cost assumption. If changing OPEX detail, also update the authoritative fixed-cost driver on Assumptions. The Budget difference row makes any mismatch visible.
6. **Sensitivity** uses simple live formulas. Change the amber daily volumes and commission rates. It is not an Excel What-If Data Table.

All modeled months contain 30 days. Bookings and paid accounts are rounded down to whole units after applying multipliers. Paid accounts must not exceed participating partners in a realistic scenario. Inputs should be nonnegative; rates should be between 0 and 100%. Booking volume must also be checked against the inventory and opening hours of the actual pilot.

## Revenue streams and validation

| Model | Proposed price | Why it may create value | Validation needed |
|---|---:|---|---|
| Booking commission | 10% of eligible completed reservation GMV | Operators pay in relation to delivered bookings; drivers can see the full parking price before booking | Agree inventory allocation, refunds, settlement, commission and no-show rules in a partner contract |
| Free listing | 0 | Allows an operator to test demand | Do listings convert into fulfilled bookings? |
| Business subscription | 40,000/month | Advanced inventory controls, booking history, utilization and revenue reports may save staff time | Interviews and a paid pilot; compare time saved and incremental net income with the fee |
| Enterprise / corporate accounts | Custom, future hypothesis | Central billing, visitor allocation, employee limits and reporting | Interview buyers; test procurement needs and willingness to pay; no revenue included |
| Premium driver subscription | Future hypothesis, no price forecast | Possible convenience benefits only after repeat demand is observed | Do not assume drivers will pay; no revenue included |

An operator should compare incremental earnings and administrative savings with commission and subscription fees. For example, 100 genuinely additional completed bookings × 800 KZT × 90% = 72,000 KZT operator allocation before its own costs. After a 40,000 subscription, only 32,000 KZT remains before operator costs. This example is a calculation, not evidence that 100 bookings will be incremental. Avoid charging for features a small operator does not need. Revenue figures assume the paid plan can be sold together with commission; validate this commercial structure.

## Authoritative classroom baseline

| Input | Downside | Base | Upside |
|---|---:|---:|---:|
| Parking partners | 5 | 10 | 20 |
| Daily completed bookings per partner | 3 | 8 | 15 |
| Paid B2B accounts | 1 | 5 | 10 |
| Monthly fixed costs | 500,000 | 500,000 | 750,000 |
| Average booking value | 800 | 800 | 800 |
| Commission | 10% | 10% | 10% |
| Monthly subscription fee | 40,000 | 40,000 | 40,000 |
| Payment processing / full GMV | 0.95% | 0.95% | 0.95% |
| Variable operations / booking | 5 | 5 | 5 |
| Days / month | 30 | 30 | 30 |

These inputs come from the user’s classroom brief. Every modeled booking is eligible and completed. Canceled, failed and refunded reservations generate no commission in this simplified model. A production model must add their volumes, retained fees, refund losses and PSP charges. It must also account for discounts, chargebacks, timing, bad debt and any subscription collection fees.

## Equations and checked results

```
Bookings = Partners × Daily completed bookings per partner × 30
GMV = Bookings × Booking value
Commission = GMV × Commission rate
B2B revenue = Paid B2B accounts × Monthly subscription fee
Platform revenue = Commission + B2B revenue
Payment fees = GMV × Payment processing rate
Variable cost = Bookings × Variable cost per booking
Operating result before tax = Platform revenue − Payment fees − Variable cost − Fixed costs
Operator allocation = GMV − Commission
```

| Monthly calculation | Downside | Base | Upside |
|---|---:|---:|---:|
| Completed bookings | 450 | 2,400 | 9,000 |
| GMV | 360,000 | 1,920,000 | 7,200,000 |
| Commission revenue | 36,000 | 192,000 | 720,000 |
| B2B subscription revenue | 40,000 | 200,000 | 400,000 |
| Total Parkly revenue | 76,000 | 392,000 | 1,120,000 |
| Payment fees | 3,420 | 18,240 | 68,400 |
| Variable operations | 2,250 | 12,000 | 45,000 |
| Fixed operating costs | 500,000 | 500,000 | 750,000 |
| Operating result before tax | **−429,670** | **−138,240** | **256,600** |
| Operator allocation before its costs | 324,000 | 1,728,000 | 6,480,000 |

All three operating results match the user’s expected values exactly. GMV is customer spending on parking. Parkly recognizes only commission and subscription revenue in this agency-style model, subject to review of its actual contracts and accounting treatment. Operator allocation is before its parking costs and any B2B subscription. The positive Upside result is not actual profit and does not prove product-market fit.

## Payment architecture changes the fee base

**A. Platform checkout / PSP marketplace settlement.** The customer pays 800 KZT through an authorized provider. The classroom model assumes Parkly bears a 0.95% acquiring fee on the full 800 KZT, or 7.60 KZT. Parkly earns 80 KZT commission, the operator receives a 720 KZT allocation before other charges, and the modeled booking contribution is 80 − 7.60 − 5 = **67.40 KZT**. Splitting settlement does not automatically mean acquiring fees apply only to commission. Confirm merchant-of-record, settlement, safeguarding, refunds and PSP responsibilities before launch. The prototype does not collect funds.

**B. Operator checkout with separate commission collection.** The operator collects the parking charge directly and Parkly invoices or collects its 80 KZT commission separately. If a provider actually charges 0.95% only on that commission transaction, Parkly's payment fee is 0.76 KZT and contribution is **74.24 KZT**. The operator may still pay acquiring costs on the full parking charge. This transfers some cost and collection risk; it does not eliminate it. At Base volumes the alternative simplified monthly result is **−121,824 KZT**, compared with −138,240 under architecture A. The same 0.95% rate is a sensitivity assumption, not a verified commercial offer. A bank transfer, minimum fee or other provider contract could produce different costs.

**C. B2B SaaS only.** Operators collect parking revenue themselves and Parkly invoices subscriptions. Parking GMV is not processed by Parkly. Fees apply to subscription payments under their own collection method. This is a separate model for later validation, not included in the current baseline.

No VAT or tax treatment is inferred from the payment route. For official Kazakhstan registration, payments, taxes and Astana Hub research, see [research sources](research-sources.md) and the business report. The financial model assumes no Astana Hub admission or tax exemption and calculates pre-tax results.

## Startup investment and monthly budget

The following figures are author hypotheses to make funding needs visible. Obtain supplier quotes and founder staffing plans before using them commercially.

| Initial item | Amount | Classification |
|---|---:|---|
| Test equipment | 300,000 | CAPEX, 36-month straight-line depreciation, zero residual value |
| MVP implementation support | 350,000 | Setup expense |
| Legal, contracts and registration preparation | 150,000 | Setup expense; not a statutory fee claim |
| Research and usability testing | 100,000 | Setup expense |
| Partner onboarding materials | 50,000 | Setup expense |
| Pilot launch preparation | 100,000 | Setup expense |
| **Total** | **1,050,000** | **300,000 CAPEX + 750,000 setup** |

| Base recurring OPEX | Monthly amount |
|---|---:|
| Support and founder compensation | 200,000 |
| Cloud, tools and maintenance | 80,000 |
| Marketing | 100,000 |
| Partner visits and operations | 50,000 |
| Accounting and administration | 70,000 |
| **Total fixed cash OPEX** | **500,000** |

Payment fees and 5 KZT variable cost are additional to fixed OPEX. The Upside scenario allows 250,000 KZT/month more fixed cost. Compensation is a small pilot budget, not a market salary claim. Donated student labor and university resources can hide the cost of a commercial team. Employer costs and taxes require a separate verified staffing plan.

## Twelve-month P&L and cash forecast

The default holds Base assumptions constant for M1–M12. This makes the relationship with the classroom scenario easy to explain. Growth can be tested with the editable multipliers; it has not been observed.

| Annual Base measure | Calculation | Result |
|---|---|---:|
| Completed bookings | 2,400 × 12 | 28,800 |
| GMV | 1,920,000 × 12 | 23,040,000 |
| Platform revenue | 392,000 × 12 | 4,704,000 |
| Payment fees | 18,240 × 12 | 218,880 |
| Variable costs | 12,000 × 12 | 144,000 |
| Fixed costs | 500,000 × 12 | 6,000,000 |
| Classroom operating result | −138,240 × 12 | −1,658,880 |
| Setup expense | Paid and expensed in M1 | 750,000 |
| Depreciation | 300,000 ÷ 36 × 12 | 100,000 |
| Accounting result before tax | −1,658,880 − 750,000 − 100,000 | **−2,508,880** |

The expected monthly scenario values are simplified operating results before setup, depreciation and taxes. The accounting P&L explicitly adds setup expense and depreciation. Equipment cash outflow is CAPEX and must not be expensed a second time in the P&L. The accounting view assumes development support is expensed; capitalization would require a separate policy review.

Cash forecast assumption: 3,000,000 KZT equity funding arrives in M1. Revenue is collected and variable/fixed costs paid in the same month; the operator is settled immediately. There is no debt, interest, VAT, tax cash flow, working capital delay, refund reserve or investor distribution.

```
Closing cash = Opening cash + Equity funding + Operating cash result − Setup cash − CAPEX
M1 closing cash = 3,000,000 − 138,240 − 750,000 − 300,000 = 1,811,760
M12 closing cash = 3,000,000 − 1,050,000 − 1,658,880 = 291,120
Cash needed for 12 flat Base months before a buffer = 1,050,000 + 1,658,880 = 2,708,880
```

The workbook shows all twelve monthly closing balances and reconciles the accounting result to cash by adding back depreciation. The Base year-end cash is positive only because of assumed financing. At the same burn rate, 1,950,000 after setup represents about 14.1 months of operating runway. A real launch should plan a refund and working-capital buffer beyond this simplified requirement. Depreciation is capped at the asset's remaining book value in each month.

## Unit economics and break-even

Contribution per booking = 800 × 10% − 800 × 0.95% − 5 = **67.40 KZT**. This equals **84.25% of booking commission revenue**, not of GMV. Contribution as a share of GMV is 8.425%. Fixed staff and technology costs remain to be covered.

```
Break-even bookings = CEILING(MAX(0, Fixed costs − B2B revenue) / Booking contribution)
Base = CEILING((500,000 − 200,000) / 67.40) = 4,452 completed bookings/month
Per Base partner per day = 4,452 / 10 / 30 = 14.84
```

The baseline 2,400 bookings is below that threshold. With no subscriptions and the same 500,000 fixed costs, the threshold is 7,419 bookings. Nonpositive contribution cannot support normal volume-driven break-even when a fixed-cost gap remains. Paying B2B accounts must be validated; their service cost is currently carried within fixed OPEX.

## CAC and LTV: assumption examples only

Active users are users who used the product during a defined period. Paying drivers completed a paid eligible booking. Paid B2B customers bought a subscription. These populations must not be mixed in conversion or CAC calculations.

| Metric | Hypothetical inputs and formula | Result |
|---|---|---:|
| Driver CAC | 100,000 marketing test ÷ 100 new paying drivers | 1,000 |
| Driver contribution LTV | 67.40 × 4 completed bookings/month × 6 retained months | 1,617.60 |
| Driver LTV / CAC | 1,617.60 ÷ 1,000 | 1.62× |
| B2B CAC | 200,000 acquisition test ÷ 2 new paid accounts | 100,000 |
| B2B monthly contribution | 40,000 fee − 10,000 allocated service cost | 30,000 |
| B2B contribution LTV | 30,000 × 12 retained months | 360,000 |
| B2B LTV / CAC | 360,000 ÷ 100,000 | 3.60× |

These are not observed acquisition or retention results. The workbook lets the student change every input. Driver acquisition cost of 1,000 would take about 3.7 active months to recover at four bookings per month. B2B service allocation is already within fixed cost in the P&L and must not be charged twice. LTV excludes discounting and fixed-cost allocation. A pilot must measure cohort retention and acquisition attribution before these ratios guide spending.

An assumed funnel might be 1,000 qualified visitors × 10% first-booking conversion = 100 paying drivers. It is not observed conversion; report visits, booking starts, confirmed bookings and completed reservations separately.

## Sensitivity and recommendation

Holding Base partner count, five B2B accounts and 500,000 fixed costs constant:

| Daily completed bookings / partner | 8% commission | 10% commission | 12% commission |
|---|---:|---:|---:|
| 3 | −253,740 | −239,340 | −224,940 |
| 8 | −176,640 | −138,240 | −99,840 |
| 15 | −68,700 | 3,300 | 75,300 |

Each cell is monthly operating result in KZT. Higher commission may reduce operator participation; volume and pricing should not be assumed independent in a real forecast. The model's main finding is that the Base case does not cover monthly costs. Test reservation demand, fulfillment and paid B2B value before expanding costs. Avoid presenting the Upside case as the expected outcome.

## Verification and limits

The file was recalculated with the bundled spreadsheet engine. Checks covered the three expected scenario results, contribution, break-even, twelve-month cash reconciliation, a scenario change, an M12 volume change, zero partners, and a missing selected-case input. All temporary edits were restored. No formula errors remained in the final scan. Seven worksheets were rendered and visually inspected; both charts are bound to workbook cells. An exported XLSX contains editable formulas, inputs, validation and charts. Native Microsoft Excel recalculation was not independently exercised in this environment.
