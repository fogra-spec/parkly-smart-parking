# Parkly presentation script

Three students, four slides each. Suggested timing: about 3–4 minutes per student, including a short demo during Student 2’s section. Practise the finance section aloud. The detailed calculations are in presentation-outline.md and the workbook.

## Student 1: slides 1–4

### Slide 1: Project introduction

Hello. We are presenting Parkly, a parking discovery and reservation platform for Astana. Our value proposition is simple: help drivers compare parking and reserve spaces that an operator has set aside for Parkly. Our project connects drivers with private parking operators. Today we show a university prototype and a business analysis, with clear limits. The parking locations and availability in the demo are fictional. We have no confirmed partners or actual revenue.

### Slide 2: Problem statement

Our problem statement starts with uncertainty. A driver may reach a destination before knowing the price or whether a space will be available. An operator may have unused spaces, but may lack a simple booking channel. These are hypotheses for interviews, not measured facts about all Astana drivers. Our research confirms that local parking information and payment services exist. We still need evidence on search time, unused capacity and demand for advance booking.

### Slide 3: Proposed solution

Parkly lets a driver search, compare, choose a time and confirm a reservation. The important rule is that a map location alone does not mean a space is reservable. An operator must allocate inventory. The system then checks overlapping reservations before confirmation. We propose a clear price and cancellation policy. A controlled pilot must test whether operators can fulfil the promise before a public launch.

### Slide 4: Target audience

We focus on three example personas. A commuter values a predictable arrival. A student is sensitive to price and may book only before important trips. A small parking manager wants useful demand and simple inventory control. These personas are research hypotheses. Their frequency and willingness to pay need interviews and a pilot. We do not claim an exact market size because we do not yet have reliable inputs. I will now hand over to the second presenter.

## Student 2: slides 5–8

### Slide 5: Stakeholders

The key stakeholders are drivers and parking operators. Drivers need a reliable reservation. Operators control the actual spaces and need clear settlement and cancellation rules. Founders own scope and business decisions. Developers own implementation quality. Payment providers and regulators become important before a paid pilot. We use a stakeholder register, a RACI matrix and a communication plan in the full report. Each decision needs a clear owner.

### Slide 6: Website prototype

The demonstration follows one user journey: find a sample parking location, choose the booking period, review the price, confirm a demo reservation and view it in booking history. Then we cancel it and check the available inventory again. We also show the operator settings and financial calculator. Demo authentication and sample availability need clear labels. The product should never suggest that real payment or a live parking integration is active.

### Slide 7: Business processes

In the current process, the driver often discovers availability and price after travelling. An unsuccessful attempt can create another search. In the proposed process, the driver checks reservable inventory before travelling. Confirmation links to a booking reference. Exceptions matter: payment failure, cancellation, expiry, no-show and availability mismatch need separate paths. The full report includes BPMN diagrams. The slide is a simple process summary.

### Slide 8: Business model

Our first revenue model is a ten percent commission on eligible completed reservations. On an eight hundred tenge booking, Parkly earns eighty tenge gross commission. The operator allocation is seven hundred and twenty tenge before other costs. An optional business plan costs forty thousand tenge per month in our classroom assumptions. Operators would pay only if reporting and management features save enough time or earn enough value. Corporate plans and a premium driver plan are future hypotheses. I will now hand over to the third presenter.

## Student 3: slides 9–12

### Slide 9: Financial analysis

The chart compares three illustrative monthly scenarios. Downside loses 429,670 tenge. Base loses 138,240 tenge. Upside earns 256,600 tenge. These are calculations, not market forecasts. The base case has ten partners, eight bookings per partner per day and thirty days, giving 2,400 bookings. At eight hundred tenge each, GMV is 1,920,000 tenge. Ten percent commission plus five subscriptions gives 392,000 tenge platform revenue. Payment fees are 18,240, variable costs are 12,000, and fixed costs are 500,000. Per booking, eighty minus seven point six minus five gives 67.4 tenge contribution. With five subscriptions, break-even is 4,452 bookings per month.

### Slide 10: MVP and roadmap

Our roadmap starts with validation. In months one and two we interview drivers and operators. In months three and four we improve and test the MVP. In months five and six we propose a small partner pilot. Later stages depend on reservation fulfilment, repeat use and contribution margin. Bank payments, barriers, sensors and native apps belong to future phases. In the financial workbook, a flat base case loses 1,658,880 tenge over twelve months. A hypothetical three million tenge funding amount, less 1,050,000 setup investment and those losses, leaves 291,120 tenge. This shows why a funding and demand gate matters.

### Slide 11: Risks and KPIs

Our main risks are incorrect availability, weak demand, partner disputes and insufficient funds. We reduce technical risk with capacity checks, access controls and recovery procedures. We reduce business risk with a small pilot and clear partner agreements. Our initial KPI targets are hypotheses: at least 95 percent fulfilment, at least 10 percent search-to-booking conversion, and at least 25 percent repeat booking among eligible customers. We must define the events and measurement periods before interpreting these figures.

### Slide 12: Conclusion

Parkly is a testable business proposal. The prototype can explain the customer journey and how the financial model responds to different assumptions. The next decision is whether a small Astana pilot can show reliable reservations and enough repeat demand. We recommend moving toward paid operation only after partner inventory commitments, legal and payment review, and evidence of affordable customer acquisition. Thank you. We are ready for your questions.

## Live demo checklist for Student 2

1. Open the parking search and point to the sample-data label.
2. Filter by price or parking type. Open one sample parking detail page.
3. Choose a future date and time. Explain the duration and total price.
4. Confirm a demo reservation. Read the reference and status.
5. Open booking history. Cancel the reservation and observe the inventory change.
6. Switch to the demo operator role. Adjust that operator’s inventory and price.
7. Open the finance simulator. Change daily bookings and explain the profit change.

Only demonstrate controls that pass the final application checks. Keep a screenshot or the deck’s illustrative flow ready if the local server or online map tiles fail. Clearly say that booking and authentication use a demo environment and no real payment is taken.

## Potential teacher questions and answers

**1. What is your main value proposition?**  
Parkly helps drivers compare parking and reserve inventory that a participating operator has allocated to the platform. The intended value is less uncertainty before travel.

**2. How is this different from a map application?**  
A map can show a parking location without offering a reservation. Parkly’s proposed difference is an explicit allocation of reservable spaces, a time period and a booking reference. We still need a pilot to validate this advantage.

**3. Do existing services already solve this problem?**  
Astana has municipal parking information and payment services. Our research found the UIMS Parking migration announcement. We do not claim that those services provide guaranteed reservations unless a source verifies that feature. Operator technology such as Parqour is another relevant alternative. The competitor matrix explains the evidence and unknowns.

**4. Why Astana?**  
It gives the student team a focused initial area for interviews and operator outreach. There are existing parking services to study. We need local demand and supply evidence before claiming a large opportunity.

**5. Are your parking partners real?**  
No. The demo locations and inventory are fictional. A production pilot needs signed operator agreements, allocated capacity and clear fulfilment responsibilities.

**6. How do you prevent double bookings?**  
The system must check overlapping booking periods against allocated capacity and update bookings atomically in a persistent backend. The demo implements the best supported local approach. We explain its actual storage and concurrency limitations in the application documentation. Production requires transaction tests and operational monitoring.

**7. What happens if the promised space is unavailable?**  
The proposed process flags a mismatch, contacts support and the operator, offers a suitable alternative where possible, and applies the refund policy. A production guarantee needs a contract, escalation rules and compensation funding. The demo does not move real money.

**8. What is the difference between GMV and revenue?**  
GMV is the total parking value booked through the platform. In the base scenario it is 1,920,000 KZT per month. Parkly’s commission is 192,000 KZT and B2B revenue is 200,000 KZT, making total platform revenue 392,000 KZT. The rest of parking value belongs to operators before other costs.

**9. Why does the base scenario lose money?**  
Its revenue is 392,000 KZT, while fees, variable costs and fixed costs total 530,240 KZT. The difference is a 138,240 KZT monthly operating loss. The assumptions do not provide enough booking contribution to cover fixed costs.

**10. How do you calculate break-even?**  
Contribution is 80 KZT commission minus 7.6 KZT payment fee minus 5 KZT variable cost, or 67.4 KZT per booking. Subscriptions cover 200,000 KZT of 500,000 KZT fixed costs. The remaining 300,000 divided by 67.4 gives 4,451.04, so we round up to 4,452 completed bookings per month.

**11. Is the 0.95% payment fee an actual bank quotation?**  
No. It is a classroom assumption. The baseline applies it to full GMV. A real provider quote may include minimum, refund, settlement and other charges. The contract decides who pays them. Charging only Parkly’s commission produces a different model.

**12. Why would an operator pay 40,000 KZT per month?**  
Only if advanced management and reporting save enough time or create enough additional value. We would test willingness to pay with interviews and a limited paid trial. We do not assume every partner becomes a paying account.

**13. Are CAC and LTV measured?**  
No. The financial model uses assumptions and formulas. CAC divides acquisition spend by newly acquired paying customers. LTV must use contribution and retention assumptions. A pilot must measure cohorts before we trust these metrics.

**14. What happens if demand is lower than expected?**  
The downside case loses 429,670 KZT per month. We would limit commitments, test acquisition channels and revisit prices and fixed costs. We would stop expansion if fulfilment or unit economics fail the agreed gate.

**15. Does Parkly qualify for Astana Hub tax incentives?**  
We do not assume eligibility. Registration, qualifying activities and applicable tax conditions require a current legal review. Being a software startup or being located in Astana is not enough by itself. The report links official sources and identifies review points.

**16. Why are taxes absent from the scenario profit chart?**  
The user’s classroom equations calculate operating profit before tax. Taxes, depreciation and startup costs require separate treatment. The workbook explains that boundary, and the report covers current official Kazakhstan requirements without assuming a tax regime.

**17. Which requirements have the highest priority?**  
Search, clear parking details, reservation and cancellation, booking history, operator inventory control, demo labels and protection against negative capacity are Must requirements. Real payments, sensors, barriers and native mobile apps come later.

**18. How do you know the project has succeeded?**  
For the university demo, the core flow and financial equations must pass checks. For a real pilot, we need reliable fulfilment, repeat use, partner retention and affordable acquisition. The KPI targets are starting hypotheses, not current performance.

**19. What is your biggest remaining uncertainty?**  
Whether enough operators will allocate reliable supply and enough drivers will book it repeatedly at a viable acquisition cost. Software can test the process, but it cannot prove those business assumptions alone.

**20. What does your cash-flow example mean?**  
With a hypothetical 3,000,000 KZT funding amount, 1,050,000 KZT startup cash spending and twelve base monthly losses totalling 1,658,880 KZT, closing cash is 291,120 KZT. This assumes immediate collection/payment and no tax cash flows. It is an illustration of funding need, not an investment commitment.

## Equal responsibility during questions

Student 1 answers market, persona and problem questions. Student 2 answers process, stakeholder and prototype questions. Student 3 answers finance, roadmap and KPI questions. Each student should also understand the main value proposition and the difference between assumptions and evidence.
