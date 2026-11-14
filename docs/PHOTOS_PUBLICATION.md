# Location photographs and public presentation

The main interface now presents Parkly without the repeated university/prototype
strip or demo labels. Navigation, booking controls, stored reservations, roles,
pricing logic and project downloads are preserved. Downloadable coursework is
under Help → Project resources.

## Images and provenance

Six locally hosted photographs replace decorative building placeholders on cards,
saved locations, operator listing cards, admin moderation rows and facility details.
`lib/parking-photos.ts` maps the stable backend facility code to the corresponding
licensed asset. Unknown/new facilities receive a clearly labelled Astana city view;
this is not a guessed photograph of their premises. Image errors have a readable
fallback and images use lazy loading and fixed dimensions to limit layout shifts.

Sources, authors and license URLs are stored in `public/photos/credits.json` and
shown in Help → Photo credits. Images were retrieved from Wikimedia Commons using
its official API/imageinfo metadata. Thumbnail copies are hosted locally; the app
does not depend on a third-party image request for each visit. All images retain
CC0 or their original CC BY-SA licensing. CSS provides the responsive crop.

| Facility code | Photograph |
|---|---|
| p1 | Astana Botanical Garden — Demir Berisha, CC BY-SA 4.0 |
| p2 | Square near Bayterek — Vyacheslav Bukharov, CC BY-SA 4.0 |
| p3 | Ishim River — Nikolamikovic82, CC0 |
| p4 | Astana skyline viewed from Nur Alem — Nikolamikovic82, CC0 |
| p5 | Nazarbayev University main atrium — Dinononozavr1, CC BY-SA 4.0 |
| p6 | Right Bank buildings by Hazrat Sultan Mosque — t_y_l, CC BY-SA 2.0 |

These are area/campus photographs. They are not verified photographs of parking
entrances. Existing database facilities remain illustrative; removing repeated
labels does not create partner agreements or physical parking access. This is
explained in the service policies and before reservation confirmation. No real
payment integration or physical occupancy verification was added or claimed.

## Public access

The user explicitly chose a public link served from their Mac rather than a
permanent hosting account. Keep the existing API, PostgreSQL and reminder worker
running. Build the frontend, reload only the compiled preview and gateway, and
verify the current HTTPS tunnel. Do not publish the old D1/shared-identity version
as a substitute for the current PostgreSQL application. This link depends on the
Mac and its internet connection; it is not 24/7 managed hosting.

## Verified publication

- TypeScript, strict application lint and production build passed.
- All17 existing website unit tests passed.
- Desktop browser: all five approved facility photographs loaded, and the main
  screen contains no visible prototype/demo wording or educational top banner.
- Phone browser at390px: detail photo loads and page/dialog width stays390px.
- The facility policy button opens Help and all six attribution/license records.
- Public HTTPS browser check: all five approved image URLs load from the published
  host, with no visible prototype/demo text. The unapproved sixth facility retains
  its area photo for operator/admin views and direct asset verification.
- The public Mac-backed link and existing API/database were preserved. Only the
  compiled frontend and gateway were restarted. No payment, occupancy, account,
  reservation or authorization implementation was replaced.
