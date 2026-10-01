# Storefront design

The look of the public online shop (everything outside `/app`, `/login` and `/setup`). The staff
screens keep their own plainer style. References: goodies.la, luluandgeorgia.com, amara.com.

## 1. Visual theme

**Warm editorial.** A calm, paper-coloured page where photographs do the talking. Serif headlines
with an italic hero line, small widely-spaced capitals for labels, square corners, thin hairlines
instead of boxes and shadows. It should feel like a homeware magazine, not a marketplace.

Keywords: warm, quiet, generous, photographic, confident.

## 2. Colour

All colours are CSS variables, set on `.shop` in `src/app/globals.css`. No hex values in components.

| Token | Value | RGB | Used for |
|---|---|---|---|
| `--background` | `#f6f4ee` | 246 244 238 | Page |
| `--surface` | `#ffffff` | 255 255 255 | Inputs, image wells, cards on tint |
| `--tint` | `#ece7dd` | 236 231 221 | Feature bands, image placeholders |
| `--foreground` | `#1c1915` | 28 25 21 | Text, primary buttons, footer |
| `--muted` | `#6b665f` | 107 102 95 | Secondary text |
| `--border` | `#e2ded4` | 226 222 212 | Hairlines |
| `--accent` | `#1d4fa3` | 29 79 163 | Brand blue: logo mark, eyebrow labels, focus ring, links on hover |
| `--navy` | `#16335f` | 22 51 95 | Announcement bar, wordmark |
| `--sale` | `#a8261c` | 168 38 28 | Sale prices and the Sale link only |
| `--success` | `#2f6b45` | 47 107 69 | "In stock" dot, paid/confirmed states |
| `--on-dark` | `#f3efe6` | 243 239 230 | Text on ink, navy and photographs |

Blue is the brand colour (from the Modasa logo) and is used sparingly. Buttons are ink, not blue.

## 3. Typography

- **Headings:** Playfair Display 400 (italic for the hero line). Fallback: Georgia, serif.
- **Body and UI:** Inter 400/500. Fallback: system-ui, sans-serif.
- Loaded with `next/font/google` in the shop layout (self-hosted, no layout shift).
- Never: bold serif headings, all-caps serif, more than these two families.

| Role | Size / line height | Notes |
|---|---|---|
| Hero | clamp(40px, 6vw, 76px) / 1.02 | serif italic |
| Page title (h1) | clamp(32px, 4vw, 48px) / 1.1 | serif |
| Section title (h2) | clamp(26px, 3vw, 34px) / 1.15 | serif |
| Card title (h3) | 20px / 1.3 | serif (category, shop) |
| Body | 15px / 1.6 | |
| Small | 13px / 1.5 | meta, availability |
| Label ("caps") | 12px / 1.4, tracking .14em, uppercase | nav, buttons, eyebrows |

## 4. Components

Defined as utilities in `globals.css` (`shop-*`). Every interactive element has hover and a visible
focus ring (`outline: 2px solid var(--accent); outline-offset: 2px`).

- **Primary button** `shop-btn`: ink background, on-dark caps label, 15px × 30px padding, square.
  Hover: navy background. Active: slightly darker. Disabled: 50% opacity, not-allowed.
- **Light button** `shop-btn-light`: for use on photographs. Cream background, ink text. Hover: white.
- **Outline button** `shop-btn-outline`: transparent, 1px ink border. Hover: ink fill, on-dark text.
- **Text link** `shop-link`: 1px underline, 3px offset. Hover: accent colour.
- **Input** `shop-input`: white, 1px hairline, square, 12px × 14px. Focus: ink border + accent ring.
  Error: sale-red border and message beneath.
- **Product card:** square image well (white), name 15px, variant summary in muted 13px, price,
  availability line with a green dot. Hover: image scales to 1.03 over 600ms; name underlines.
  Tags ("Sale", "New") sit top-left: caps 11px on white, or white on sale red.
- **Option chips** (sizes, designs): 1px hairline rectangle. Selected: ink border + ink text weight
  500. Unavailable: muted with a diagonal strike, still focusable but disabled.
- **Header:** navy announcement bar; logo centred between search (left) and links (right); category
  row in caps beneath. Sticks to the top on scroll with a hairline under it. On phones: menu
  button, logo, cart; categories in a slide-down panel.
- **Footer:** ink background, on-dark text, four columns collapsing to one.
- **Status notes:** tint background, 2px left border (success, accent or sale colour), no icons-as-emoji.

## 5. Layout

- Container: max 1360px, 40px gutters (20px on phones). Checkout and text pages: max 1040px.
- Spacing scale: 4, 8, 12, 16, 20, 28, 40, 56, 84px. Sections are separated by 84px (56px on phones).
- Product grids: 4 columns ≥1024px, 3 at ≥768px, 2 on phones; 20px gap (12px on phones).
- Category tiles are 4:5 portrait; product images are square; the hero is 620px tall (70vh on phones).

## 6. Depth

Flat. No shadows on cards. Depth comes from photographs, the tint bands and hairlines. The only
shadow is under the sticky header's mobile menu panel: `0 12px 24px rgb(28 25 21 / .08)`.

## 7. Motion — level 1/2, subtle

- Hero text fades up on load (600ms, 80ms stagger).
- Sections fade up as they scroll into view, using CSS scroll-driven animation
  (`animation-timeline: view()`); browsers without it simply show the content.
- Product and category images scale to 1.03 on hover (600ms ease-out).
- Buttons and links transition colour over 200ms.
- Everything is disabled under `prefers-reduced-motion: reduce`.
- No parallax, no scroll hijacking, no carousels that move on their own, no custom cursor.

## 8. Do and don't

Do
- Let photographs fill their frames edge to edge; keep text off busy parts of an image.
- Keep one primary button per view.
- Say where an item is ("In stock at Lekki, Ikeja") rather than how many there are.
- Write prices in full with the ₦ sign and thousands separators.

Don't
- Round corners, add drop shadows or use gradients (except the dark fade under hero text).
- Use blue for buttons or large areas; it is an accent.
- Use red for anything other than sale prices and errors.
- Show stock quantities, cost prices or staff-only location names to customers.
- Use emoji as icons, or stock-photo people.
- Centre long paragraphs; only short hero and statement lines are centred.
- Add pop-ups, newsletter modals or countdown timers.

## 9. Responsive

- Breakpoints: 640px, 768px, 1024px (Tailwind `sm`, `md`, `lg`).
- Touch targets at least 44 × 44px; quantity steppers and option chips are 44px tall.
- No horizontal scrolling at 360px wide. The category row becomes a menu panel below 1024px.
- Cart and checkout stack into one column on phones with the order summary first collapsed to a
  total line, then the form.
