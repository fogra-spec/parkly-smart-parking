# Parkly blue design system

The existing application now uses one blue/slate palette across the landing page,
driver/operator/admin workspaces, geographic markers, interactive floors and PWA.

| Role | Color | Use |
|---|---|---|
| Primary | `#0066FF` | P mark, CTA buttons, selected spaces, active navigation |
| Primary hover | `#0052CC` | Hover/selected borders |
| Primary soft | `#EFF6FF` | Informational panels and light blue surfaces |
| Ink | `#0F172A` | Headings and high-contrast labels |
| Body / muted | `#334155` / `#64748B` | Body text / supporting text |
| Surface / section | `#FFFFFF` / `#F8FAFC` | Cards / section backgrounds |
| Border | `#E2E8F0` | Cards, dividers and inputs |
| Available | `#22C55E` | Available bays and positive availability badges only |
| Unavailable | `#E5E7EB` | Reserved, blocked or unavailable bays |
| Held | `#FBBF24` | Temporary backend holds |

Available bays use dark labels for contrast. Selected bays use white labels on
blue. Unavailable bays use slate labels on light gray. Generic booking statuses,
positive financial results, information banners and support replies use blue or
slate; they do not reuse availability green. Gray never claims verified vehicle
occupancy. Availability and hold logic are unchanged.

The landing-page DOM order is Hero → Three steps → trust information → featured
parking listings. The guide appears once, directly under the hero on all screen
sizes. Header navigation styles are scoped to `#primary-navigation` so mobile menu
positioning does not affect driver tabs or bottom navigation.

PWA manifest/theme metadata, favicon, generated PNG icons and the public offline
page match the palette. The public-only service worker cache version is bumped so
installed clients can refresh those assets. Private API caching remains disabled.

## Verification

- Desktop browser (1280 px): DOM order is hero, guide, trust information, listings.
- Phone browser (390 px): no horizontal overflow; guide immediately follows hero.
- Computed floor colors: selected `rgb(0,102,255)`, available `rgb(34,197,94)`,
  unavailable `rgb(229,231,235)`; selected text is white, available text dark slate.
- Phone floor tabs and the main reservation CTA both render `rgb(0,102,255)`.
- TypeScript, strict lint, production build, 17 website tests and five
  service-worker tests passed. No booking/auth/database implementation changed.
- Screenshot artifacts: `outputs/parkly-blue-home.png` and
  `outputs/parkly-blue-mobile-floor.png` (ignored build/review artifacts).
