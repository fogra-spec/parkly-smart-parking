# Parkly — Business Analysis Report

**Find. Reserve. Park.**  
University project • Astana, Kazakhstan • 23 October 2026 • Currency: KZT

## 1. Executive summary

Parkly is a proposed parking discovery and reservation platform for drivers and private parking operators in Astana. Drivers can compare parking locations, see a clear price, and reserve inventory that an operator has allocated to the platform. Operators can manage this inventory, review bookings, and understand use through a simple dashboard.

The project addresses uncertainty about parking, prices, and access before a journey. The size of these problems has not yet been measured locally. The first target customers are office visitors, commuters, students who drive, and private facilities with spare capacity at selected times. Astana is a reasonable pilot location because official municipal parking services and digital payment options already exist. This supports a local test, but does not prove demand for Parkly.

Parkly proposes a 10% commission on eligible completed bookings and an optional 40,000 KZT monthly operator plan. These prices are classroom assumptions. Its proposed difference is a simple booking service linked to operator-controlled inventory. The university prototype uses fictional parking data and simulated reservations. A commercial launch requires partner contracts, reliable access procedures, validated demand, and approved payment arrangements.

**Value proposition:** Parkly helps drivers plan parking with a clear price and reserved partner inventory, while helping private operators sell and manage available spaces.

## 2. Evidence, assumptions and scope

**Research findings** use primary sources in [research-sources.md](research-sources.md), identified as S01–S17. **Assumptions** are classroom inputs, not observed results. **Calculations** follow stated formulas. **Recommendations** are decisions proposed for validation. All fictional users, spaces and bookings in the prototype are demo records. A map marker does not create a right to reserve a space. A reservation promise requires a signed allocation, a time interval and an operator access process.

| Topic | Established evidence | Hypothesis to validate | Validation method and proposed decision rule |
|---|---|---|---|
| Search time | Official maps provide parking discovery (S01, S04). | Drivers waste meaningful time finding a place. | 30 driver interviews and 20 observed trips; proceed if at least 12 interviewees describe a repeated problem. |
| Price uncertainty | Municipal rules publish zoned prices (S03). | Private-facility prices are hard to compare before arrival. | Audit 20 facilities and ask 30 drivers; record missing/unclear total prices. |
| Idle capacity | No local occupancy dataset obtained. | Private sites have saleable unused space at certain hours. | Ask 10 operators for four weeks of hourly counts; identify at least three with documented spare inventory. |
| Digital tools | B2B automation and online access applications exist (S06–S08). | Smaller operators still need a simpler booking tool. | Observe five reception workflows; seek three letters of intent, not verbal praise. |
| Guaranteed access | Reviewed maps/payment pages do not establish reserved inventory. | Drivers will choose and sometimes pay for a reservation. | Clearly labeled landing-page interest test followed by a supervised pilot; no charge before service exists. |

All sample sizes and decision rules above are recommendations. Do not describe them as completed research.

**Main opportunity:** connect limited, contractually allocated private parking supply to drivers with a time-specific need. Begin with a few business-center and hotel locations where staff can honor reservations manually.

**Problem statement:** Current Situation → Drivers use signs, maps and separate facility/payment systems. Problem → They may not know the total cost or whether access will be available on arrival. Business Impact → Possible lost time for drivers and missed sales for operators; magnitude unknown. Proposed Solution → Search, compare and reserve operator-allocated inventory with clear conditions. Expected Value → Less uncertainty and better use of participating spaces, measured in a controlled pilot.

## 3. Stakeholder analysis

### Stakeholder register

Influence and interest: H = high, M = medium, L = low. Responsibilities refer to the proposed operating model.

| Stakeholder | Interest and needs | Influence / interest | Expectations | Responsibilities | Possible conflict |
|---|---|---|---|---|---|
| Drivers | Reliable access, clear total price, quick cancellation | M/H | Booking honored; understandable terms | Correct booking details; arrive within conditions | Wants flexible refunds while owner wants certainty |
| Private parking owners | Asset income, legal control and low risk | H/H | No interference with tenants | Authorize commercial use and inventory allocation | Tenant capacity versus public sales |
| Operators/managers | Simple daily workflow and accurate arrivals | H/H | No double booking; easy changes | Update inventory, accept arrivals, report problems | Walk-in revenue versus reserved stock |
| Founders | Validated demand and sustainable cash | H/H | Evidence for investment decisions | Scope, funding, contracts and escalation | Fast growth versus service quality |
| Developers/designers | Clear requirements and achievable workload | M/H | Stable priorities and testable acceptance | Implement, test and maintain accessible product | Deadline versus technical debt |
| Payment providers | Valid transactions, compliance and low disputes | H/M | Approved settlement and refund process | Process payments under contract in future | Checkout simplicity versus controls |
| Mapping providers | License compliance and service use | M/L | Attribution and permitted request volume | Provide map service under agreed terms | Low cost versus API limits |
| Customer support | Clear case history and escalation rules | M/H | Access to necessary information only | Resolve access, cancellation and refund cases | Driver remedy versus operator responsibility |
| Regulators/local authorities | Lawful data, tax, payments and parking use | H/M | Correct filings and lawful operation | Set/enforce rules; answer formal applications | Product plans versus legal constraints |
| Investors | Credible growth, governance and runway | H/H if funded | Honest unit economics and risk reporting | Capital and oversight under agreement | Growth targets versus sustainable spending |
| Corporate customers | Visitor/employee access and reporting | M/M | Budget controls and reliable invoices | Define users, limits and internal policy | Convenience versus employee privacy |

### Power–interest matrix

| Position | Stakeholders | Engagement |
|---|---|---|
| High power / high interest: manage closely | Owners, operators, founders, committed investors | Weekly decisions; signed allocation and pilot review |
| High power / lower interest: keep satisfied | Regulators, payment providers | Compliance review before launch; incident escalation |
| Lower power / high interest: keep informed | Drivers, developers/designers, support | Usability sessions, sprint demos, service updates |
| Lower power / lower interest: monitor | Mapping provider, early corporate prospects | License reviews and monthly discovery check-ins |

Power changes with contracts: a single critical mapping supplier or large corporate buyer may move into a high-power group.

### RACI matrix

R = responsible; A = one accountable owner per activity; C = consulted; I = informed. DR drivers; OW owners; OP operators; FO founders; DV developers/designers; PY payment provider; MP map provider; CS support; RG regulators; IV investors; CO corporate customers.

| Activity | DR | OW | OP | FO | DV | PY | MP | CS | RG | IV | CO |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Validate needs and product scope | C | C | C | A/R | R | I | I | C | I | C | C |
| Approve site rights and allocation | I | A | R | R | C | I | I | C | C | I | I |
| Build and test demo | C | I | C | A | R | I | C | C | I | I | I |
| Maintain inventory/prices | I | A | R | C | C | I | I | C | I | I | I |
| Deliver reservation/access | R | I | A/R | C | C | I | I | R | I | I | I |
| Approve refund/dispute policy | C | C | C | A | C | C | I | R | C | I | C |
| Implement future payment flow | I | C | C | A | R | R | I | C | C | I | I |
| Data protection and compliance | I | C | C | A/R | R | C | C | R | C | I | C |
| Financial and investor reporting | I | I | C | A/R | C | C | I | C | I | C | I |

### Communication plan

| Stakeholders | Information / channel | Frequency and owner | Escalation |
|---|---|---|---|
| Drivers | Confirmation, conditions, booking status in app; pilot interview | Per booking; product/support | Failed access immediately to support |
| Owners | Allocation, commercial terms and utilization report by meeting/email | Weekly pilot; founder | Inventory breach within same working day |
| Operators | Arrival list, inventory changes and incidents in dashboard | Daily; operations lead | Stop sales immediately on mismatch |
| Founders | Backlog, cash runway, risk/decision log | Weekly; product lead | Critical security/service issue immediately |
| Developers/designers | Prioritized stories, designs and test results | Each sprint; technical lead | Release-blocking failure before demo |
| Payment providers | Settlement/reconciliation requirements, disputes | Before integration, then daily exceptions; finance lead | Unmatched charge/refund to provider support |
| Mapping providers | Terms, rate limits and errors | Monthly and on change; technical lead | Map failure: activate list fallback |
| Customer support | Runbook, open cases, refunds and privacy limits | Daily pilot; operations lead | Unresolved access to operator/founder |
| Regulators/local authorities | Registration, required filings and incident reports | Legal deadlines; founder/accountant | Statutory reporting timetable controls |
| Investors | Cash, hypothesis tests, milestones and material risks | Monthly; founder | Funding gap when runway falls below three months |
| Corporate prospects | Needs, pilot results and proposed access policies | Monthly discovery; sales lead | Privacy or invoice issue before onboarding |

## 4. Target market and personas

Initial segments: daily commuters and office workers with recurring destinations; students who drive and prioritize low prices; business-center visitors with a fixed appointment; shopping/entertainment visitors; private parking operators; hotels and corporate buildings with controlled spare space. These overlap, so do not sum segment counts without deduplication. Start with appointment-based visits and staffed private sites; students may prefer free alternatives.

These are **hypothetical personas**, not interviewed people.

| Persona | Situation and pain points | Current alternatives | Assumed frequency | Willingness-to-pay hypothesis | Expected benefit |
|---|---|---|---|---|---|
| Aigerim, office visitor, 29 | Meetings near business centers; worries about late arrival and unknown entry | Municipal parking, navigation maps, taxi, calling reception | 4–8 bookings/month | 800 KZT for a suitable two-hour visit; test against cheaper alternatives | Clear cost, access instructions and reserved inventory |
| Daniyar, driving student, 21 | Tight budget and irregular classes; wants a short walk | Campus/free roadside parking, public transport, shared rides | 2–4 bookings/month, exam/appointment peaks | 300–500 KZT short stay; likely rejects premium fee | Price filter and predictable arrival |
| Marina, private-site manager, 41 | Manual lists; spaces empty in selected hours; staff cannot monitor many systems | Phone, spreadsheet, permits, existing automation supplier | Daily operations | 40,000 KZT/month only if extra margin or saved work exceeds fee | Controlled allocation, booking records and simple analytics |

### Market sizing: transparent scenario, not a market estimate

Reliable counts of reservable private spaces, willing operators and paying drivers were not obtained. Do not label the financial model as Astana TAM. Use annual bookings as the common unit:

- TAM booking GMV = addressable drivers × paid parking occasions per driver/year × average paid amount.
- SAM booking GMV = TAM × share of occasions in launch areas × share suitable for partner reservations.
- Capacity-constrained SOM bookings = minimum(demand converted to bookings, partners × allocated spaces × saleable turns/day × operating days × expected occupancy).
- Platform revenue = SOM eligible completed GMV × commission + paid operator accounts × annual subscription fee. GMV is not platform revenue.

Illustrative arithmetic only: 50,000 hypothetical drivers × 24 occasions × 800 = **960,000,000 KZT annual TAM GMV**. At 20% launch-area share and 25% suitable occasions, hypothetical SAM = **48,000,000 KZT GMV**, or 60,000 bookings. If 10 partners allocate 5 spaces × 2 turns/day × 360 days × 40% occupancy, capacity permits 14,400 bookings; at a hypothetical 10% SAM conversion, demand permits 6,000. SOM is therefore 6,000 bookings = **4,800,000 KZT GMV**, with **480,000 KZT commission** before expenses. This example is deliberately separate from the classroom operating scenarios; none of its counts are sourced market facts. Replace each input through surveys, facility audits and pilot records.

## 5. Competitor and alternative analysis

S01 and S02 show that the municipal platform moved to UIMS Parking in September 2026. S03 sets current published zone rates; old uniform-tariff pages can be misleading. S04 describes a public mapping alternative. S05–S09 establish venue information, parking-management services and payment alternatives. See linked evidence register for full URLs.

Legend: **V** = feature advertised in reviewed official source; **U** = unverified/unknown for local use; **D** = proposed demo functionality, not a commercial service; **N** = outside the reviewed product's purpose. A U is never proof of absence.

| Solution | Discovery | Live free spaces | Guaranteed reservations | Price comparison | Online payment | Business dashboard | Analytics | Support |
|---|---|---|---|---|---|---|---|---|
| UIMS municipal parking (S01–S03) | V: zones/info | U | U | U: tariffs ≠ comparison tool | V | U | U | V: operator contact under rules |
| Smart Astana mapping (S04) | V | U: total capacity only | U | U | U | U | U | U |
| Khan Shatyr venue website (S05) | V: own venue | U | U | U | U | U | U | V: venue contact, not verified booking support |
| Kaspi payment guide (S09) | V: zone selection | U | U | U | V | U | U | V: bank guide; parking disputes may need operator |
| Parqour B2B automation (S06–S07) | U: consumer marketplace | V: vendor occupancy claim | U: local guaranteed booking | U | V | V | V | V |
| Turaq access applications (S08) | V: participating facilities | U | U: application approval ≠ instant reservation | U | U | V: administrator approval | U | U |
| Parkly prototype | D | No: simulated allocated stock | D: no real access promise | D: fictional prices | No | D | D | Planned; no live help desk |

No additional local guaranteed hourly booking marketplace was verified. Parqour's international reservation integrations do not prove local access through those services. Parkly should compete on **simple reservable allocation, clear total cost and operator onboarding**. This is a positioning hypothesis, not a proven unique feature or defensible advantage. Existing providers could add it quickly. Partner trust, fulfillment and repeat use would be stronger evidence than interface quality alone.

## 6. Business analysis frameworks

### SWOT

| Strengths (proposed/internal) | Weaknesses (internal) |
|---|---|
| One driver-to-operator booking record; low hardware need for a staffed pilot; transparent KZT calculator | No signed supply, payment integration or observed demand; student team has limited support time; manual updates can become stale |

| Opportunities (hypotheses) | Threats (external) |
|---|---|
| Sell selected idle hours; simplify smaller-site workflows; corporate visitor booking after validation | Existing maps/payment apps expanding; operators withholding stock; low willingness to pay; supplier and regulatory changes |

### PESTLE

| Factor | Parkly-specific implication | Action |
|---|---|---|
| Political | Municipal parking governance changed in September 2026 (S01). | Keep private allocation separate; verify authority before any public-space agreement. |
| Economic | An 80 KZT gross commission leaves only 67.4 KZT after assumed fees and variable cost. | Test acquisition spending and subscription value before growth. |
| Social | Drivers may distrust an unfamiliar guarantee; students may prefer free parking. | Show terms/source status; interview distinct segments. |
| Technological | Stale stock and concurrent bookings can break the promise. | Atomic interval checks, audit trail, bounded inventory and list fallback. |
| Legal | Data, payments, tax and site rights determine launch readiness (S10–S16). | Obtain contracts and local reviews before collecting payments or live personal data. |
| Environmental | Fewer search trips could reduce driving, but induced trips could offset savings. | Measure distance/time before making emissions claims. |

### Business Model Canvas

| Block | Parkly model |
|---|---|
| Customer segments | Appointment-based drivers; small private parking operators; later corporate administrators |
| Value propositions | Clear cost and reserved allocated stock; simple inventory/booking records for operators |
| Channels | Responsive web app, partner signage/QR, campus and office pilot referrals |
| Customer relationships | Self-service bookings with human pilot support and transparent recovery policy |
| Revenue streams | 10% eligible completed-booking commission; optional 40,000 KZT/month B2B; future corporate/premium hypotheses |
| Key resources | Allocation contracts, booking ledger, software, support runbook and operational trust |
| Key activities | Supply onboarding, inventory control, fulfillment review, reconciliation and product iteration |
| Key partners | Private owners/operators, future licensed PSP/bank and mapping supplier; none contracted yet |
| Cost structure | Engineering/support, hosting, partner sales, processing on applicable amount, per-booking support and compliance |

### Value Proposition Canvas

| Customer | Jobs | Pains | Gains | Product response and test |
|---|---|---|---|---|
| Driver | Arrive on time, park near destination, control cost | Uncertain access, hidden conditions, failed arrival | Predictable visit and easy recovery | Time-specific details, total price and confirmation; measure fulfillment and booking-task success |
| Operator | Sell space while protecting tenant access | Manual lists, stale counts, disputes | More net margin and fewer admin minutes | Separate platform allocation, arrival list and ledger; compare margin/admin time with baseline |

### Gap analysis

| Current state | Desired state | Gap and required change | Evidence of closure |
|---|---|---|---|
| Locations shown separately from booking rights | Only authorized inventory can be reserved | Signed owner allocation and approval workflow | Every active site has verified agreement |
| Manual/unknown availability | Time-specific remaining stock | Interval inventory service plus staff updates | No oversells in concurrency test and supervised pilot |
| Price found late | Full total before confirmation | Stored rate and server-calculated quote | Review total equals final booking total |
| Informal disputes | Consistent recovery and audit trail | Case policy, reason codes, notification | All pilot incidents have owner and resolution |
| Assumed business viability | Measured contribution and retention | Event definitions and pilot ledger | Monthly report separates GMV, revenue and refunds |

### Feasibility

Technical: a local full-stack demo is feasible; it does not prove distributed production concurrency, availability integrations or security readiness. Operational: staffed sites allow an affordable pilot, but owners must reserve stock from walk-ins. Commercial: the base classroom case loses 138,240 KZT/month, so demand alone is insufficient; B2B value, throughput or costs must improve. Schedule: core demo is suitable for a student team when IoT/payment/mobile scope is deferred. Legal: conditional on lawful site rights, data setup and a reviewed payment flow. Financial: proceed in stages with a cash limit and stop rules, not an assumed investment return.

### Cost–benefit analysis

At base assumptions, platform monthly revenue = **392,000 KZT**, variable/processing cost = **30,240 KZT**, fixed cost = **500,000 KZT** and operating loss = **138,240 KZT**. At upside assumptions the result is **256,600 KZT** before tax. These are calculations, not forecasts. Operator allocation per 800 KZT completed booking is 720 KZT before its own costs if Parkly bears processing fees. A 40,000 KZT subscription needs at least 56 *additional* 720 KZT allocations just to recover the fee before extra operator costs (40,000 ÷ 720, rounded up); existing bookings shifted to Parkly are not incremental benefit. Driver time savings have no measured monetary value yet. Use the financial workbook's setup and cash assumptions for funding decisions; do not count operator income as Parkly benefit or GMV as revenue.

## 7. AS-IS and TO-BE business processes

The importable [processes.bpmn](processes.bpmn) file contains BPMN 2.0 AS-IS and TO-BE processes with diagram layout. [process-notes.md](process-notes.md) explains paths and the proposed exception policy. These are analytical models; they do not claim every recovery path is automated in the prototype.

AS-IS: travel → search → inspect price/access → decide → enter → pay → finish. If full or unacceptable, search again or leave. Likely delays include circling, reading signs, queueing and searching for payment methods. These are hypotheses until observed.

TO-BE: destination/time → search → compare → validate allocated stock and price → demo confirmation → navigation → operator entry check → parking → complete. No-space, failed-payment, cancellation, expiration, no-show, operator cancellation, mismatch and refund branches are explicit. In demo mode no money is charged; a simulated payment result must never look like bank confirmation.

| Measure | AS-IS | TO-BE target hypothesis | Measurement |
|---|---|---|---|
| Search uncertainty | Capacity often unknown before arrival | Known *allocated* inventory with clear source | Driver interview and mismatch rate |
| Price visibility | May require site visit | Total displayed before confirm in every case | UI acceptance test |
| Booking fulfillment | No platform reservation | ≥95% pilot reservations honored | Operator check-in + incident records |
| Search time | Not measured | Median 20% reduction | Matched before/after trips, same destinations |
| Recovery | Individual negotiation | Logged reason and agreed remedy | Case-resolution audit |

## 8. Business requirements and traceability

The full machine-readable register is [requirements.csv](requirements.csv). Each row has an ID, parent business need, MoSCoW priority, user story, measurable acceptance criterion, validation method and delivery scope. **Must** means required for the university demo unless marked production; **Should** improves the pilot; **Could** is optional; **Won't now** is deliberately deferred. Acceptance criteria are targets; a requirement is not proven passed simply because it is listed.

BR-001: increase use of participating allocated inventory. BR-002: reduce parking uncertainty. BR-003: create sustainable platform revenue. BR-004: deliver operator value. Functional coverage includes FR-001 registration/login, FR-002 search, FR-003 map, FR-004 filters, FR-005 details, FR-006 creation, FR-007 status, FR-008 cancellation, FR-009 partner dashboard, FR-010 inventory, FR-011 history, FR-012 pricing, FR-013 analytics, plus roles/admin, favorites, localization and simulation. NFR-001–007 cover responsive design, security/privacy, performance, accessibility, reliability, maintainability and usability.

Change control: founders own scope; operator and driver feedback is recorded with evidence; each requested change links to a BR and a measurable benefit. Technical lead estimates effort and risk. Founder approves sprint scope. Record whether a change replaces or extends an acceptance criterion. Keep current limitations visible in the README and presentation.

## 9. Revenue model and financial interpretation

1. **Booking commission:** 10% of eligible completed bookings. At 800 KZT: gross commission 80; operator allocation 720 before other costs. Canceled/refunded bookings are excluded from eligible completed volume; refund/provider costs require separate policy.
2. **B2B:** free basic listing, optional Business dashboard at 40,000 KZT/month, Enterprise custom price. A paid plan must provide incremental value such as multi-user controls, exports and useful time-of-day reports. The demo demonstrates concepts; payment for the plan is unvalidated.
3. **Corporate accounts:** later per-company or per-active-seat fee with budget/visitor controls. Price and demand are hypotheses, with no revenue included in baseline.
4. **Premium drivers:** later recurring benefits only after retention/willingness evidence; no premium revenue included.

| Monthly calculation (KZT unless stated) | Downside | Base | Upside |
|---|---:|---:|---:|
| Partners / daily bookings each / paid B2B | 5 / 3 / 1 | 10 / 8 / 5 | 20 / 15 / 10 |
| Eligible completed bookings | 450 | 2,400 | 9,000 |
| GMV at 800 per booking | 360,000 | 1,920,000 | 7,200,000 |
| Commission at 10% | 36,000 | 192,000 | 720,000 |
| B2B at 40,000/account | 40,000 | 200,000 | 400,000 |
| Platform revenue | 76,000 | 392,000 | 1,120,000 |
| Processing at 0.95% of GMV | 3,420 | 18,240 | 68,400 |
| Variable operations at 5/booking | 2,250 | 12,000 | 45,000 |
| Fixed operating cost | 500,000 | 500,000 | 750,000 |
| Operating result before tax | **−429,670** | **−138,240** | **256,600** |

Thirty days per month is a classroom convention. Bookings mean eligible completed, paid bookings in the scenario model, not all booking attempts. Contribution per booking = 800 × (10% − 0.95%) − 5 = **67.4 KZT**, or 84.25% of commission. Base break-even bookings with five paid accounts = ceiling((500,000 − 200,000) ÷ 67.4) = **4,452/month**, about 14.84/day/partner for 10 partners. If contribution is zero/negative, increasing bookings cannot cover fixed costs. If subscription contribution already covers fixed costs, additional break-even bookings are zero.

CAC = attributable acquisition spend ÷ new acquired paying customers. Example hypothesis: 100,000 spend ÷ 100 new paying drivers = 1,000 KZT CAC. At four completed bookings/month, driver contribution = 269.6/month. With a hypothetical six-month active lifetime, contribution LTV = 1,617.6 KZT before fixed costs; LTV/CAC = 1.62. Neither cohort size nor retention is observed. Keep driver CAC separate from operator CAC, and active users separate from paying users. Estimate LTV from real cohorts before using it in fundraising.

### Payment architecture and tax treatment

**A. Marketplace collection through an authorized provider:** the provider processes the full 800 KZT and settles according to contracts. The baseline assumes Parkly bears 0.95% of full GMV, or 7.6 KZT per booking. Holding customer funds, provider onboarding, refunds and fiscal responsibilities need contract/legal review. A split payment does not automatically shrink the acquiring fee base to commission.

**B. Operator collects the parking charge:** operator pays acquiring fees on 800 KZT under its own agreement; Parkly invoices 80 KZT commission separately. If a provider processes only that 80 KZT invoice at an assumed 0.95%, Parkly's fee is 0.76 KZT. The operator may still pay fees on full GMV, and bank transfers/subscriptions can have other costs. The classroom expected results use A, not B. Never apply commission-only fees while also assuming Parkly collects all GMV without a provider quote.

For 2026, official sources state standard VAT of 16%, an applicable mandatory registration threshold of 10,000 MCI (43.25 million KZT), general CIT of 20%, and a conditional simplified-regime headline rate of 4% with local adjustments (S10–S12). These rates do not establish Parkly's eligibility, taxable base or total employment-tax burden. The financial scenarios are **before tax**. Determine agency versus principal accounting, commission/B2B taxable revenue, invoice treatment, payroll and fiscal-receipt duties with a Kazakhstan accountant. Full customer collections are not automatically Parkly accounting revenue, and low accounting revenue does not by itself settle the tax-turnover question.

LLP registration is available through eGov Business with a digital signature and required founder/entity details (S13). For a multi-founder startup, an LLP and a written founders' agreement are recommendations. Registration is not approval for payment services or parking rights. National Bank rules identify regulated payment-service activities (S14); use an authorized provider and review Parkly's actual flow. Do not build an unapproved stored-value wallet.

The Personal Data Law sets rules for legal basis/consent, minimum necessary data, confidentiality, Kazakhstan database storage and cross-border transfers (S15). A production service needs a data inventory, privacy notice, access controls, retention/deletion policy and incident process. Minimize location and plate data; fictional data is sufficient for the demo.

Astana Hub participation and preferences are **not assumed**. Article 17 of the 2026 Tax Code requires registration and at least 90% qualifying ICT income, among relevant conditions (S16); the official Hub FAQ describes preferences broadly (S17). Ask whether Parkly's actual commission and software income qualify under the current activity list and contract. Model ordinary taxes until status and treatment are confirmed. A website built in Astana does not establish eligibility.

## 10. MVP and development strategy

University Must scope: landing page, interactive Astana demo map/list, filters/details, server-validated demo booking/cancellation/history, driver dashboard, operator allocation/pricing, basic admin roles and financial simulator. Use English/Russian interface, KZT amounts and an always-visible demo/source indicator. Prefer a simple operating workflow to speculative automation.

Future scope: authorized bank payments, barrier integration, IoT sensors, camera occupancy, native apps, dynamic pricing and corporate solutions. Each requires a separate business case, supplier agreement, tests and legal/privacy review. Production authentication, fraud controls, backup/recovery and deployment hardening are launch gates even if the university demo uses named demo roles.

Pilot recommendation: three staffed sites, limited booking hours, a small reserved allocation and a manual fallback. Operators confirm capacity at opening and report unexpected closures immediately. Never reserve municipal or venue spaces without authority. Evaluate a four-week pilot before adding locations.

## 11. Twelve-month roadmap

Months are relative to project approval, not promised calendar commitments. Costs below are **illustrative allocations of recurring fixed OPEX**, not extra amounts to add again to the financial workbook. M1–M8 at 500,000/month and M9–M12 at 750,000/month give a planning envelope of 7,000,000 KZT; reconcile with the selected financial scenario before funding. Setup investment is separate. Work may stop if validation fails.

| Stage | Objective / activities | Deliverables | Responsible/accountable | Estimated fixed cost | Proposed KPIs and success criteria | Dependencies |
|---|---|---|---|---:|---|---|
| M1–2: validate | Interview 30 drivers/10 operators; observe parking; verify law and rights | Evidence log, revised problem, three conditional letters of intent | BA/product; founder A | 1,000,000 | ≥12 repeated-problem reports; ≥3 feasible allocations | Access to respondents; no fabricated surveys |
| M3–4: MVP | Build/test booking, dashboards and calculator; usability sessions | University demo, requirements and test log | Engineering/design; founder A | 1,000,000 | All critical booking tests pass; ≥8/10 task completion | Stable scope and fictional dataset |
| M5–6: supervised pilot | Sign terms; train staff; restricted bookings; manual recovery | Three-site pilot and fulfillment report | Operations/support; founder A | 1,000,000 | ≥95% fulfillment; zero confirmed double bookings | Legal/payment/privacy gates for real use |
| M7–8: improve | Fix incidents, measure cohorts, test paid B2B value | Version 2 and measured unit economics | Product/engineering; founder A | 1,000,000 | ≥25% 30-day repeat; three operators accept a paid-plan trial | Sufficient valid pilot sample |
| M9–10: monetization | Roll out reviewed charging and reconciliation; acquire selected sites | Provider integration and paid-plan contracts | Finance/sales/engineering; founder A | 1,500,000 | Positive contribution; ≥5 paid accounts; sustainable support load | Provider acceptance; demand evidence |
| M11–12: expansion decision | Compare cohorts, acquisition cost and supply reliability | Go/hold/stop decision; next-year plan | Founders/investors; founder A | 1,500,000 | Three months of improving contribution and ≥90% partner retention | Funding and service quality gates |

## 12. Risk register and probability–impact matrix

Scores are planning judgments: probability 1 unlikely–5 frequent; impact 1 small–5 critical. Score ≥15 high, 8–14 medium, ≤7 low. Residual scores are targets after mitigation, not observed risk reduction.

| ID | Risk / trigger | P | I | Score | Mitigation and contingency | Owner | Residual target |
|---|---|---:|---:|---:|---|---|---:|
| R01 | Few partners; fewer than three allocation commitments | 4 | 5 | 20 | Interview owners early; narrow geography; stop driver acquisition without supply | Founder | 10 |
| R02 | Wrong availability; any denied valid booking | 4 | 5 | 20 | Contract allocated stock; daily check; freeze site and offer agreed remedy | Operations | 10 |
| R03 | Double booking; two accepted bookings exceed overlap capacity | 3 | 5 | 15 | Atomic checks/transactions, idempotency, concurrency tests; suspend affected sales | Technical lead | 5 |
| R04 | Weak demand; <12/30 interviews report repeated need | 4 | 4 | 16 | Test visits segment; revise proposition or stop pilot | Product | 8 |
| R05 | Low conversion; <10% valid search-to-confirm pilot conversion | 4 | 3 | 12 | Analyze price/coverage/UX drop-off; avoid blanket discounts | Product | 6 |
| R06 | High CAC; assumed payback exceeds six months | 4 | 4 | 16 | Partner referrals, capped experiments; stop unprofitable channels | Growth/finance | 8 |
| R07 | Payment failures; unreconciled charge or provider outage | 3 | 4 | 12 | Future idempotent PSP flow, callbacks/reconciliation; release unpaid holds | Technical/finance | 4 |
| R08 | Privacy breach; unauthorized access to plate/location | 3 | 5 | 15 | Minimize data, access tests, local storage review, incident runbook | Founder/privacy lead | 5 |
| R09 | Outage; booking service unavailable | 3 | 4 | 12 | Monitoring, backups and recovery drill; staff list fallback | Technical lead | 6 |
| R10 | Funding gap; runway below three months | 4 | 5 | 20 | Monthly cash review, stage gates and hiring freeze | Founder/finance | 10 |
| R11 | Incumbent adds booking at selected sites | 3 | 4 | 12 | Focus on fulfillment and operator relationships; revisit pricing | Product | 8 |
| R12 | Operator dispute over access, cancellation or settlement | 4 | 4 | 16 | Signed policy, timestamped ledger, owner escalation and pause option | Operations | 8 |
| R13 | Staff override sells reserved stock to walk-in | 3 | 5 | 15 | Separate quota, staff training, arrivals list; reduce unsafe allocation | Operator | 5 |
| R14 | Wrong tax/payment classification delays launch | 3 | 5 | 15 | Review contracts with accountant/provider; keep demo uncharged | Founder | 5 |
| R15 | Map supplier outage/limits | 3 | 2 | 6 | License-compliant caching where allowed and working list view | Technical lead | 3 |

Matrix cells contain risk IDs; blank means none assessed.

| Probability \ Impact | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| 5 | — | — | — | — | — |
| 4 | — | — | R05 | R04,R06,R12 | R01,R02,R10 |
| 3 | — | R15 | — | R07,R09,R11 | R03,R08,R13,R14 |
| 2 | — | — | — | — | — |
| 1 | — | — | — | — | — |

## 13. KPI framework

Every target below is a **pilot hypothesis**, not actual performance or a market benchmark. Report sample counts beside percentages. Exclude test/demo events from production metrics. Analytics must use privacy-aware IDs and a documented event dictionary.

| KPI | Formula | Data source | Frequency / owner | Initial target hypothesis |
|---|---|---|---|---|
| Monthly active users | Unique non-test users with search or booking event in 30 days | Product events | Monthly / product | 300 by pilot month 3 |
| Completed reservations | Count status=completed, excluding tests and reversals | Booking ledger | Weekly / operations | 300/month across three pilot sites |
| Booking conversion | Confirmed bookings ÷ unique eligible search sessions | Search/confirm events | Weekly / product | ≥10% with displayed eligible supply |
| Repeat booking rate | First-time bookers with second completed booking in 30 days ÷ first-time cohort with full 30-day observation | Cohort ledger | Monthly / product | ≥25% |
| Partner retention | Start-of-period live partners still live at end ÷ start live partners | Partner register | Monthly / operations | ≥90% after pilot |
| Revenue per booking | Recognized booking commission ÷ eligible completed bookings | Reconciled finance ledger | Monthly / finance | 80 KZT at classroom ABV/rate; report B2B separately |
| Contribution per booking | (Commission − attributable processing − variable operations) ÷ eligible completions | Cost and booking ledger | Monthly / finance | ≥67.4 KZT at baseline assumptions |
| Driver CAC | Attributable driver-acquisition spend ÷ new paying drivers | Campaign spend + first-paid event | Monthly cohort / growth | ≤1,000 KZT; validate payback |
| B2B conversion | Paid operator accounts ÷ eligible active operator accounts | Subscription/partner ledger | Monthly / sales | ≥30%; baseline scenario assumes 50% |
| Reservation fulfillment | Valid arriving reservations admitted under terms ÷ valid arriving reservations | Check-in + incidents | Weekly / operations | ≥95%; exclude no-shows but show count |
| Cancellation rate | Canceled confirmed bookings ÷ confirmed bookings of same booking cohort | Status history | Weekly / operations | ≤10%; split driver/operator |
| Allocated inventory utilization | Occupied reserved space-hours ÷ saleable platform-allocated space-hours | Intervals and allocation history | Weekly / operations | +10 percentage points versus measured pre-pilot baseline |
| Support recovery | Cases resolved within agreed window ÷ eligible cases | Support ledger | Weekly / support | ≥90% within one working day; failed access handled immediately |

Decision recommendation: demonstrate a functioning workflow and transparent economics first. Approve a real pilot only when owners can honor allocated stock and the payment/data setup is ready. Continue commercial development only if measured fulfillment, repeat use and contribution justify the cost.
