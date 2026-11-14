# Course Requirements Traceability Matrix

Current local scope: 13 November 2026. Stable IDs and baseline meanings are preserved from REQUIREMENTS_TRACEABILITY.md; the older FR-001 numbering crosswalk remains there. All API paths below have prefix `/api/v1`. Implemented means local execution evidence, not a live service or real-device certification. Acceptance steps, invented data, expected/actual results and status are recorded in COURSE_PROTOTYPE.md.

| FR ID | Business objective | Use case | Screen | Backend / database operation | Test evidence | Status |
|---|---|---|---|---|---|---|
| FR-01 | Find suitable inventory | UC-01 Search area/name | Discovery | GET facilities, compat/state | AT-03; parking.test.ts | Implemented |
| FR-02 | Compare affordable options | UC-01 Filter price/type/availability | Discovery | SQL allocation availability + client filters | AT-03 | Implemented |
| FR-03 | Understand conditions and quote | UC-02 Inspect facility | Facility details | GET facilities/:id/spaces; pricing records | AT-04 | Implemented |
| FR-04a | Reserve a future space | UC-03 Hold and confirm | Floor map, review, confirmation | POST holds; holds/:id/confirm; atomic allocation/reservation | AT-04/05; bridge/browser | Implemented |
| FR-04b | Release an eligible booking | UC-04 Cancel reservation | Booking history | POST reservations/:id/cancel; cancel_reservation | AT-07; operator browser cancellation | Implemented |
| FR-05 | Prevent overbooking | UC-03 Concurrent reservation | Confirmation | GiST exclusion, per-space lock, idempotency | AT-06; privileged SQL constraint test | Implemented |
| FR-06 | Restrict operator inventory | UC-05 Manage capacity and price | Operator workspace | PATCH operator/facilities/:id/inventory; RLS membership | AT-08/09 | Implemented |
| FR-07 | See authorized fictional performance | UC-06 Review reports/history | Operator reports | GET reports/reservations; scoped aggregates | workspaces.test.ts aggregate/paging; postgres.test.ts report | Implemented |
| FR-08 | Inspect geographic options | UC-01 Map/list navigation | Discovery map | Approved facility coordinates; OSM attribution | Browser discovery/map controls; external tiles require internet | Partial |
| FR-09 | Record a fictional parking session | UC-07 Staff check-in/out | Operator session tools | POST reservations/:id/check-in/check-out; record_session | postgres.test.ts sessions/tenant checks | Implemented |
| FR-10 | Extend without conflict | UC-08 Extend reservation | Extension dialog | POST reservations/:id/extend; atomic allocation/price update | AT-10; bridge | Implemented |
| FR-11 | Receive booking updates | UC-09 Notifications | Notification Center/settings | notification_deliveries; reminder_jobs/push_devices | AT-11/12; immediate booking-change Web Push for both roles remains | Partial |
| FR-12 | Authenticate test roles securely | UC-10 Sign in/out | Account dialog | POST auth/login/logout; HttpOnly session; default signup 403 | AT-01/02/09 | Implemented |
| FR-13 | Assign reviewed access | UC-11 Administration | Admin access | admin/operators, members, user roles/active, approval; audit | postgres.test.ts admin/disabled accounts/onboarding | Implemented |
| FR-14 | Retain own preferences | UC-12 Profile/favorites | Profile, saved parking | POST compat/action profile/favorite; RLS | Bridge: persistence after logout/login | Implemented |
| FR-15 | Explain classroom economics | UC-13 Simulate finances | Business model | lib/finance.ts; no payment ledger | Four finance.test.ts tests | Implemented |
| FR-16 | Show local currency/time/language | UC-14 Localized interface | All workspaces | timestamptz, Intl Asia/Almaty and KZT | Backend/bridge timestamps; full Russian labels remain | Partial |
| FR-17 | Select an exact floor/bay | UC-03 Floor booking | Interactive SVG floor map | GET facilities/:id/layout; floors/spaces | AT-04; geometry tests; browser Floor 2/A-12 | Implemented |
| FR-18 | Maintain assigned layout safely | UC-05 Edit and publish layout | Operator floor editor | operator/floors/:id/layout,publish,spaces; draft versions | postgres.test.ts publication/tenant/500-space validation | Implemented |
| FR-19 | Schedule reminders durably | UC-09 Reservation reminders | Parking reminders | schedule_parking_reminders; local durable worker | AT-11; actual short timer test | Implemented |
| FR-20 | Retry delivery safely | UC-09 Reminder delivery | Delivery history | claim/finish_push_delivery; leases, encrypted capabilities | AT-11; retry/ack-loss/expired-device tests | Implemented |
| FR-21 | Display true browser push | UC-09 Subscribe and background display | Notification settings, service worker | push-subscriptions; protected push/events | Service-worker/IndexedDB tests; physical display unverified | Partial |
| FR-22 | Show current reservation and extension options | UC-08 Manage reservation time | Parking session panel | GET parking-session, reservations/:id/extension-options | AT-10; bridge/browser countdown | Implemented |
| FR-23 | Read complete scoped booking history | UC-06 Browse bookings | Driver/operator history | GET reservations with scope/bucket/search/page | AT-05/07; 205-record paging test | Implemented |
| FR-24 | Resolve fictional support questions | UC-15 Support case | Support Center | support/:id/messages; private support tables | workspaces.test.ts ownership/retry/reply; bridge | Implemented |
| FR-25 | Approve an operator application | UC-11 Onboard operator | Applications/admin | operator-applications; admin/operator-applications/:id | workspaces.test.ts concurrent approval | Implemented |
| FR-26 | Maintain assigned listing metadata | UC-05 Edit conditions | Operator facility tools | PATCH operator/facilities/:id/details; edit_facility | workspaces.test.ts foreign rejection/persistence | Implemented |
| FR-27 | Read own event history | UC-09 Read notifications | Notification Center | GET notifications; notifications/:id/read | AT-12 | Implemented |
| FR-28 | Inspect authorized audit/status/users | UC-11 Administration audit | Admin operations | GET admin/users,audit,system | workspaces.test.ts admin-only operations/paging | Implemented |
| FR-29 | Change a fictional password safely | UC-10 Account security | Password settings | POST auth/password; change_password; session/device revocation | AT-13 | Implemented |
| FR-30 | Navigate usable responsive workspaces | UC-14 Responsive navigation | Mobile/desktop navigation/help/reports | Existing scope-protected APIs + Help | Browser 375px operator: documentWidth=viewportWidth; full accessibility/usability pending | Partial |

The following master-prompt outcomes are deliberately not claimed: public/cloud availability (superseded by professor), Supabase migration (existing native PostgreSQL/auth retained), immediate booking-change pushes for both roles, physical-device background push and three-participant usability results. The first two decisions and the outstanding acceptance work are documented in COURSE_PROTOTYPE.md.
