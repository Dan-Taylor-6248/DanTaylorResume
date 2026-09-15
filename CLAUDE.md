# Dan Taylor Resume Site

A personal resume / portfolio static site. Plain HTML, CSS, and vanilla JS —
no build step, no framework, no package.json. Everything served directly
from `public/`.

## Deployment

Azure Static Web Apps (`.github/workflows/azure-static-web-apps.yml`) builds
from `app_location: /public` and **deploys automatically on every push to
`main`** — there is no staging step. Treat pushes to `main` as publishing to
production: don't push without the user's explicit go-ahead in that moment,
even if a prior push was approved.

## Page inventory

- **Live pages** (linked from nav, share `css/styles.css`): `index.html`
  (home), `resume.html`, `skills.html`, `projects.html`.
- **`*_back.html` files** (`index_back.html`, `resume_back.html`, etc.) are
  intentional backup snapshots taken before larger edits — not dead code,
  not duplicates to clean up. Leave them alone unless the user asks.
- **`landing-preview.html`** is a WIP redesign of the home page, styled
  entirely by its own `css/landing-preview.css` (scoped with an `lp-`
  class prefix so it can't leak into the other pages). Not linked from the
  live nav yet. When it's ready to go live, the plan (noted in its own
  header comment) is: back up the current `index.html`, rename
  `landing-preview.html` to `index.html`, wire it into the nav, and drop
  the WIP banner.
- **`Resources/`** holds source design references (e.g. the original
  landing-page mockup) — not served, just working material.
- **`public/images/`** has ~57 images; many are unused stock photos left
  over from earlier drafts. Don't assume a file is live — grep for its
  filename in the HTML/CSS before touching or deleting it.

## CSS conventions

- Color palette is documented at the top of `css/styles.css` — reuse those
  hex values (`#3c8453` dark green, `#bcaa96` sandy beige, `#222222` dark
  gray, `#d3d4d6` light gray, `#f6f6f6` off-white, `#f7f3ef` linen body bg)
  rather than introducing new colors.
- **Write mobile-first.** Base/unqualified rules are the mobile styles;
  larger-screen behavior is layered on with `min-width` media queries.
  (The stylesheet used to mix this with older `max-width`-override rules;
  those have been converted where touched. If you add something new,
  follow the `min-width` pattern rather than the old one.)
- Common breakpoints already in use: `601px`, `651px`, `800px`, `860px`.
  Reuse one of these instead of inventing a new one unless there's a real
  reason to.
- Responsive background images follow a `-800.jpg` / `-1600.jpg` suffix
  convention (mobile / desktop variants, swapped via a `min-width: 800px`
  query). Keep the original full-resolution source images in place as
  masters even though the pages don't reference them directly.
- The mobile nav (`js/nav.js` + `.nav-toggle` / `.navbar[hidden]` in
  `styles.css`) is progressive enhancement: the toggle button ships
  `hidden` in the HTML and the menu has no hidden state until JS reveals
  it, so a no-JS visitor always gets a working, fully-visible nav. Don't
  "simplify" this by baking `hidden` onto the menu itself.

## Working agreements

- **Verify responsive/CSS changes visually before calling them done** —
  screenshot mobile (~375px), tablet (~768px), and desktop (~1440px), not
  just one width. This caught a real regression during development (a
  flex layout change on one page silently broke a border that looked fine
  everywhere else) that reading the CSS alone would have missed.
- Ask before deleting anything (old images, backup files, dead CSS) —
  offer to keep it around unless the user confirms.
- Keep it dependency-free. Don't introduce a bundler, framework, or npm
  dependency to solve a styling/layout problem — this project has none
  today and that's intentional for a simple static resume site.
