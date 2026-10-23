# Parkly presentation outline

12 slides, approximately 10–12 minutes including the demonstration. All English is intended for B1–B2 speakers. Each student owns four slides. The final deck includes detailed speaker notes and the same financial assumptions as the financial model.

| Slide | Topic | Main message | Visual / evidence | Speaker |
|---|---|---|---|---|
| 1 | Project introduction | Parkly helps drivers reserve operator-allocated parking inventory in Astana. | Minimal brand cover, value proposition | Student 1 |
| 2 | Problem statement | Price and capacity uncertainty may cause unsuccessful parking attempts. These pain points need validation. | Driver/operator hypotheses and verified existing municipal services | Student 1 |
| 3 | Proposed solution | Search and compare, then reserve an allocated space. | Editable booking sequence | Student 1 |
| 4 | Target audience | Commuters, student drivers and private parking managers have different needs. | Fictional persona summary table | Student 1 |
| 5 | Stakeholder analysis | Operators control fulfilment. Founders and delivery teams need clear responsibilities. | Stakeholder responsibility/engagement table | Student 2 |
| 6 | Website prototype | Demonstrate booking, cancellation, inventory control and financial assumptions. | Illustrative demo journey, followed by the live application | Student 2 |
| 7 | Business processes | Check reservable capacity before travel. Handle exception paths explicitly. | Editable AS-IS and TO-BE summaries. Full BPMN is in report files. | Student 2 |
| 8 | Business model | Commission and optional B2B subscriptions provide potential revenue. | Editable 800 KZT booking allocation table | Student 2 |
| 9 | Financial analysis | The base classroom scenario loses money. Profit depends on bookings and paid accounts. | Editable monthly scenario profit chart, contribution and break-even | Student 3 |
| 10 | MVP and roadmap | Progress through validation gates before paid expansion. | Twelve-month roadmap and base annual operating loss | Student 3 |
| 11 | Risks and KPIs | Fulfilment, demand and funding need measurable controls. | Priority risks and explicitly hypothetical KPI targets | Student 3 |
| 12 | Conclusion | A controlled pilot must validate the business case. | Clear next decision | Student 3 |

## Explanation of every financial number

All amounts use KZT. These are classroom assumptions and calculations, not observed Parkly revenue or validated market forecasts. All scenario bookings count as eligible completed bookings. In a real model, cancellations, no-shows and refunds need separate treatment.

### Slide 8

- Booking value: **800 KZT**, supplied classroom assumption. This is GMV per booking.
- Commission: **10%**. Calculation: 800 × 10% = **80 KZT** Parkly gross commission.
- Operator allocation: 800 − 80 = **720 KZT**, before payment allocation, taxes and other operator costs.
- Optional B2B subscription: **40,000 KZT/month**, a proposed price to validate. The base case assumes five paying operators. A basic listing is free.

### Slide 9

| Input / calculation | Downside | Base | Upside |
|---|---:|---:|---:|
| Partners, assumption | 5 | 10 | 20 |
| Daily bookings per partner, assumption | 3 | 8 | 15 |
| Days per month, assumption | 30 | 30 | 30 |
| Monthly bookings = partners × daily bookings × days | 450 | 2,400 | 9,000 |
| Average booking price, KZT | 800 | 800 | 800 |
| GMV = bookings × price | 360,000 | 1,920,000 | 7,200,000 |
| Commission = GMV × 10% | 36,000 | 192,000 | 720,000 |
| Paid B2B accounts, assumption | 1 | 5 | 10 |
| B2B revenue = accounts × 40,000 | 40,000 | 200,000 | 400,000 |
| Platform revenue = commission + B2B | 76,000 | 392,000 | 1,120,000 |
| Payment fees = full GMV × 0.95% | 3,420 | 18,240 | 68,400 |
| Variable costs = bookings × 5 KZT | 2,250 | 12,000 | 45,000 |
| Fixed costs, assumption | 500,000 | 500,000 | 750,000 |
| Expenses = fees + variable + fixed | 505,670 | 530,240 | 863,400 |
| Monthly operating profit before tax | **−429,670** | **−138,240** | **256,600** |

The chart uses three columns. Each column is the final line above. Negative columns mean a monthly loss. A positive column means a monthly operating surplus in that scenario. The vertical scale uses KZT, not GMV or bookings. Results exclude startup costs, depreciation and taxes.

Contribution per completed booking = (800 × 10%) − (800 × 0.95%) − 5 = 80 − 7.6 − 5 = **67.4 KZT**. This is before fixed expenses and customer acquisition. Payment fees apply to **full GMV** under this model. If a licensed provider settles money directly to operators or charges only Parkly's fee, the fee base and contract must be modelled separately.

Base break-even bookings = ceiling[(500,000 − 5 × 40,000) ÷ 67.4] = **4,452 bookings/month**. This keeps B2B revenue and fixed costs unchanged. It is approximately 14.84 daily bookings per partner with ten partners and thirty days. If contribution is zero or negative, added bookings cannot cover fixed costs under the same assumptions.

### Slide 10 and presenter notes

- **12-month base operating loss: 1,658,880 KZT** = 138,240 × 12, using a flat monthly base scenario. It is a scenario, not a growth forecast.
- **Startup investment: 1,050,000 KZT** = 300,000 CAPEX + 750,000 setup expenses. These are separate hypothetical setup allocations in the financial model.
- **Funding: 3,000,000 KZT** is a hypothetical opening financing amount, not committed investment or revenue.
- **Closing cash: 291,120 KZT** = 3,000,000 − 1,050,000 − 1,658,880 under immediate cash collection/payment assumptions. The model separately discloses depreciation and accounting profit before tax.

## KPI targets on slide 11

Targets are hypotheses, not actual results. Use the full report's definitions when collecting events.

- Fulfilment ≥95%: fulfilled eligible confirmed arrivals ÷ eligible confirmed arrivals.
- Booking conversion ≥10%: confirmed bookings ÷ eligible search sessions.
- Repeat booking ≥25%: first-time bookers with another completed booking within 30 days ÷ first-time bookers whose full 30-day observation period has ended.

## Research and limitations

The report provides a dated source register. Local discovery/payment services do not prove reservable inventory. The deck makes no exact market-size estimate, confirmed partner claim, live availability claim, observed CAC/LTV claim or Astana Hub eligibility claim.

Official references used for the municipal-service context, accessed 23 October 2026:

- [Astana official UIMS Parking launch announcement](https://www.gov.kz/memleket/entities/astana-uad/press/news/details/1291554?lang=ru).
- [Astana parking service migration notice](https://astanapark.kz/ru).

Before presenting, run the live demo and replace students' placeholder names orally. Keep the network available if the map uses online tiles. Slide 6 is an illustrative walkthrough, not proof of a live payment or parking integration.
