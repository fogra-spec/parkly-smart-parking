# Parkly process models and exception policy

The canonical file is [processes.bpmn](processes.bpmn). It contains two non-executable BPMN 2.0 process models, each with Diagram Interchange coordinates. Import it into a BPMN editor that supports multiple diagrams. Companion previews: [AS-IS](asis-process.svg) and [TO-BE](tobe-process.svg). The XML models workflows; they are not a workflow engine or proof that all paths are automated.

## AS-IS

One driver lane: need to park → travel → search → inspect price and space → exclusive decision. If suitable, enter, pay through the available method and finish. Otherwise the driver chooses to search again or leave without parking. Search loops represent possible delay, extra driving, unexpected cost and unsuccessful attempts. Their frequency and duration have not been measured.

## TO-BE

Four responsibility lanes: driver; Parkly system/future provider; operator; support. These lanes describe a shared analytical workflow, not independent technical services. No cross-pool message flows are needed in this single-process model.

1. The driver provides destination and interval. Search checks eligible allocated inventory. A no-space result returns to search rather than creating a booking.
2. The driver compares sites. The server validates interval, inventory and total price. A production flow may use an expiring hold and authorized payment provider; the demo confirms without charging money.
3. Confirmation commits inventory and returns a reference. The driver views conditions and navigates.
4. An event-based gateway waits for arrival, driver cancellation, operator cancellation or the booking's arrival deadline. Only the first event continues the process.
5. The operator checks arrival. Matching access leads to parking, completion and a ledger record. A mismatch opens a support case and pauses unsafe sales.
6. Cancellation, no-show and mismatch paths release only eligible unconsumed allocation, assess the agreed policy and resolve any refund request. A post-completion refund request also enters support.

## Proposed exception rules

These rules are design recommendations. Publish final terms before a real pilot. Only implemented prototype paths should be demonstrated as working.

| Exception | State and inventory rule | User outcome / owner | Demo versus future |
|---|---|---|---|
| No available spaces | No booking or inventory mutation | Show empty state; change time/area / product | Core demo search |
| Stale stock or invalid interval | Validation rejects before commit; no negative stock | Explain conflict and refresh choices / system | Core booking validation |
| Payment failure | No confirmed booking; release any hold once | Clear failure and safe retry / provider + support | No real PSP; production branch |
| Expired reservation hold | Unconfirmed hold expires after proposed five minutes; release once | New quote required / system | Policy design unless a hold engine is implemented |
| Driver cancellation | Preserve canceled record; release eligible booked capacity once | Explain cancellation terms / support | Core demo cancellation; no monetary refund |
| Driver no-show | At booked start plus proposed 15-minute grace, record no-show and release remaining stock where safe | Explain agreed fee policy / operator | Proposed operational policy; no automatic real fee |
| Operator cancellation | Stop affected booking and unsafe listing; restore only valid stock | Notify driver; full refund of any captured charge in future / operator + support | Proposed recovery; demo uses no charge |
| Availability mismatch | Record valid booking denied access; pause listing | Support seeks an agreed alternative or refunds captured payment / operations | Proposed recovery; no guaranteed alternative inventory |
| Refund request | Record reason, original amount and case; verify captured funds; prevent duplicate refund | Outcome and timeline from published/provider terms / finance + support | No money moves in demo |
| Booking expiry after end | Completed access becomes history; it must not consume future intervals | Past status and clear record / system | Depends on implemented time/status handling |

A completed booking is not automatically refundable. A no-show is distinct from a canceled booking. The classroom financial scenarios count eligible completed bookings; they do not include no-show fees. A request for a refund is not the same as a completed bank refund.

## BPMN notation and model limits

Circles are events; rounded rectangles are activities; diamonds are decisions or event-based waits. Sequence-flow arrows show process order. The authorization activity has interrupting error and timer boundary events. Incoming arrival/cancellation events represent external triggers; the diagram does not claim email/SMS or live operator integrations exist. The no-show timer uses a booking-derived deadline expression, not a fixed duration from confirmation. The models are non-executable, so an engine must bind this expression and replace design activities before deployment.

Checks performed: XML parsed; all IDs are unique; flow endpoints, lane references, boundary attachments, message references and diagram references resolve. Two BPMN diagrams and layout coordinates are present. This is a structural check, not BPMN XSD validation or an external editor render check. SVG previews are companion visualizations; the BPMN XML is the source for editing.
