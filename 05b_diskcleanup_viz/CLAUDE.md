# Declutter App — Database Generation Guide

## Quick Start

To generate a new database for a different persona, replace the `RAW` array in `js/data.js`.
Keep `TAG_DEFINITIONS` and the expansion logic (`OBJECTS = RAW.map(...)`) unchanged.

Usage: "Generate a declutter database for: [persona description]"

Example personas:
- "retired couple downsizing from a 4-bedroom house"
- "minimalist software engineer in a studio apartment"
- "family of 5 with kids ages 3, 7, 12 in suburban home"
- "college student moving out of a dorm"

## RAW Entry Schema

Each entry is one line, one JS object in the `RAW` array:

```js
{ n: "Item Name", t: { room: "kitchen", category: "appliances", subcategory: "countertop" }, v: 15, d: "2023-12-25", l: "2026-02-05", u: "weekly", a: "low", i: "🍟", desc: "Short description", det: {"brand": "Ninja", "model": "AF161", "color": "Grey"}},
```

### Field Reference

| Key | Expanded To | Type | Description |
|-----|------------|------|-------------|
| `n` | `name` | string | Display name. Use "(N)" suffix for grouped items: `"Winter Jackets (3)"` |
| `t` | `tags` | object | `{ room, category, subcategory }` — must use values from TAG_DEFINITIONS |
| `v` | `volume_liters` | number | Physical size in liters. Drives `size` tag (XS/S/M/L/XL) via `deriveSize()` |
| `d` | `dateObtained` | string | ISO date `"YYYY-MM-DD"` — when acquired |
| `l` | `lastUsed` | string\|null | ISO date or `null` if never used |
| `u` | `usageFrequency` | string | `"daily"` \| `"weekly"` \| `"monthly"` \| `"rarely"` \| `"never"` |
| `a` | `attachment` | string | `"none"` \| `"low"` \| `"medium"` \| `"high"` |
| `i` | `icon` | string | Single emoji |
| `desc` | `description` | string | Short (2-8 words), conversational |
| `det` | `detail` | object\|null | Category-specific detail (see below) |

### Volume Reference (liters → size)

| Size | Liters | Examples |
|------|--------|----------|
| XS | 0–1 | Keys, earbuds, cables, socks |
| S | 1–10 | Books, shoes, small appliances |
| M | 10–50 | Suitcase, stand mixer, monitor |
| L | 50–200 | Dresser, shelving unit, bike |
| XL | 200+ | Couch, refrigerator, bed frame |

### TAG_DEFINITIONS (valid values)

```
room: kitchen, bedroom, bathroom, living_room, garage, closet, office, dining_room, laundry, storage, entryway
category: appliances, clothing, furniture, electronics, kitchenware, books, decor, tools, food, toiletries, linens, toys, sports, media, gifts, supplies, seasonal
usageFrequency: daily, weekly, monthly, rarely, never
attachment: none, low, medium, high
status: keeping, considering, removed  (always starts as "keeping")
size: XS, S, M, L, XL  (derived from volume, not set manually)
```

Subcategory is freeform but should be consistent within a category (e.g. clothing → "outerwear", "casual", "formal", "accessories").

### Detail Field (`det`) by Category

| Category | Keys | Example |
|----------|------|---------|
| appliances | `brand`, `model`, `color` | `{"brand": "KitchenAid", "model": "Artisan KSM150PS", "color": "Empire Red"}` |
| electronics | `brand`, `model`, `color` | `{"brand": "Apple", "model": "AirPods Pro 2nd gen", "color": "White"}` |
| clothing | `brand`, `color`, `material` | `{"brand": "Levi's 501 (2), Gap (1)", "color": "Indigo (3), black (1)"}` |
| furniture | `brand`, `model`, `color`/`material` | `{"brand": "Intex", "model": "Comfort Plush Queen", "color": "Grey"}` |
| books | `titles` (array) | `{"titles": [{"title": "Salt Fat Acid Heat", "author": "Samin Nosrat"}]}` |
| media | `titles` (array of strings) | `{"titles": ["Inception", "Interstellar", "The Dark Knight"]}` |
| kitchenware | `brand`, `material`, `contents` | `{"brand": "Lodge", "material": "Cast iron", "contents": "12-inch skillet, 10-inch"}` |
| tools | `brand`, `contents` | `{"brand": "DeWalt", "contents": "Drill, impact driver, 2 batteries"}` |
| toiletries | `brand`, `scent`, `contents` | `{"brand": "Dr. Jart+ (3), TonyMoly (3)", "contents": "Sheet masks"}` |
| linens | `brand`, `material`, `color` | `{"brand": "Buffy", "material": "Eucalyptus fiber", "color": "White"}` |
| decor | `material`, `color` | `{"material": "Ceramic", "color": "Pale blue"}` |
| supplies | `brand`, `model`, `contents` | `{"brand": "3M", "model": "Command", "contents": "Medium strips (8)"}` |
| seasonal | `brand`, `contents`, `color` | `{"contents": "Glass ornaments (40+), LED lights (3 strands)"}` |
| sports | `brand`, `model`, `color` | `{"brand": "Trek", "model": "FX 3", "color": "Matte black"}` |
| toys | `brand`, `contents` | `{"brand": "Ravensburger", "contents": "1000-piece ocean reef"}` |
| food | `contents` | `{"contents": "Rice, lentils, quinoa, chickpeas, black beans"}` |
| gifts | `brand`, `contents` | `{"brand": "Diptyque", "scent": "Baies"}` |

For grouped items like "Winter Jackets (3)", list brands/colors with counts: `"North Face (parka), Patagonia (puffer)"`.

## Generation Rules

1. **Target 400-500 items.** Group similar small items: "Socks (12 pairs)" not 12 sock entries.
2. **Organize by room** with section comments: `// ─── KITCHEN (~65 items) ───`
3. **Room distribution** should match the persona's living situation. A studio has no garage; a house has more rooms.
4. **Dates must be realistic.** A college student's items are 0-4 years old. A retiree's span decades. `lastUsed` should correlate with `usageFrequency`.
5. **Attachment is emotional**, not practical. A daily-use microwave can be `"none"`. A rarely-worn grandmother's necklace is `"high"`.
6. **Descriptions are conversational**, like someone talking about their stuff: "Gift from mom, still in box", "Barely fits, keeps anyway".
7. **Detail should use real brands/models** that match the persona's budget and taste. A minimalist buys Muji; a tech worker buys Apple; a family buys IKEA.
8. **Include clutter patterns:** expired pantry items, duplicate chargers, things kept "just in case", impulse buys with tags on, gifts you can't throw away.
9. **Escape quotes** in names with backslash: `n: "TV (55\")"` or use smart quotes / parenthetical descriptions to avoid.
10. **Every item needs a `det` field.** Use `null` only if genuinely nothing applies (very rare).
