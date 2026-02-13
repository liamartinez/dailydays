#!/usr/bin/env python3
"""
generate-photos.py — Generate DALL-E 3 photos for household inventory items.

Usage:
  python3 generate-photos.py --dry-run              # Print prompts without calling API
  python3 generate-photos.py --sample 25             # Generate 25 random diverse items
  python3 generate-photos.py --room kitchen          # Generate for a specific room
  python3 generate-photos.py --category clothing     # Generate for a specific category
  python3 generate-photos.py --ids obj-001,obj-005   # Generate specific items
  python3 generate-photos.py                         # Generate all missing items

Requires OPENAI_API_KEY environment variable.
"""

import argparse
import base64
import json
import os
import re
import random
import sys
import time
from io import BytesIO
from pathlib import Path

from openai import OpenAI
from PIL import Image

# ─── Paths ───

SCRIPT_DIR = Path(__file__).parent
SHARED_DIR = SCRIPT_DIR.parent / "shared"
IMAGES_DIR = SHARED_DIR / "images"
DATA_FILE = SHARED_DIR / "js" / "data.js"
MANIFEST_FILE = IMAGES_DIR / "manifest.json"

# ─── Import prompt builder ───

sys.path.insert(0, str(SCRIPT_DIR))
from prompt_builder import build_prompt

# ─── Data Loading ───

def _remove_line_comment(line):
    """Remove // comments but only if they're outside of strings."""
    in_string = False
    escape = False
    for i, ch in enumerate(line):
        if escape:
            escape = False
            continue
        if ch == '\\':
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
        if not in_string and ch == '/' and i + 1 < len(line) and line[i + 1] == '/':
            return line[:i]
    return line


def _quote_js_keys(s):
    """
    Add double quotes around unquoted JS object keys.
    Walks the string character by character to skip string contents.
    """
    result = []
    i = 0
    n = len(s)
    in_string = False
    escape = False

    while i < n:
        ch = s[i]

        if escape:
            result.append(ch)
            escape = False
            i += 1
            continue

        if ch == '\\' and in_string:
            result.append(ch)
            escape = True
            i += 1
            continue

        if ch == '"':
            in_string = not in_string
            result.append(ch)
            i += 1
            continue

        if in_string:
            result.append(ch)
            i += 1
            continue

        # Outside of strings: look for unquoted key pattern
        # An unquoted key is a word char sequence followed by optional whitespace then ':'
        if ch.isalpha() or ch == '_':
            # Check if this is an unquoted key
            j = i
            while j < n and (s[j].isalnum() or s[j] == '_'):
                j += 1
            # Skip whitespace after the word
            k = j
            while k < n and s[k] in ' \t':
                k += 1
            # If followed by ':', this is a key — quote it
            if k < n and s[k] == ':':
                key = s[i:j]
                result.append(f'"{key}"')
                i = j  # continue from after the key (before the colon)
                continue

        result.append(ch)
        i += 1

    return ''.join(result)


def derive_size(volume):
    if volume <= 1: return "XS"
    if volume <= 10: return "S"
    if volume <= 50: return "M"
    if volume <= 200: return "L"
    return "XL"


def load_items():
    """Parse data.js and expand RAW array into item objects."""
    source = DATA_FILE.read_text(encoding="utf-8")

    # Extract RAW array content
    match = re.search(r'const RAW\s*=\s*\[([\s\S]*?)\n\];', source)
    if not match:
        raise RuntimeError("Could not find RAW array in data.js")

    raw_content = match.group(1)

    # Clean up JS to valid JSON: remove comments, quote unquoted keys
    # Must be string-aware to avoid modifying content inside "..."
    lines = []
    for line in raw_content.split('\n'):
        # Remove single-line comments (only outside strings)
        stripped = _remove_line_comment(line)
        if stripped.strip():
            lines.append(stripped)
    cleaned = '\n'.join(lines)

    # Quote unquoted JS keys (string-aware)
    cleaned = _quote_js_keys(cleaned)

    # Wrap in array
    json_str = f'[{cleaned}]'

    # Fix trailing commas (valid in JS, not in JSON)
    json_str = re.sub(r',\s*}', '}', json_str)
    json_str = re.sub(r',\s*\]', ']', json_str)

    try:
        raw_items = json.loads(json_str)
    except json.JSONDecodeError as e:
        # Try to find the error location
        line_num = json_str[:e.pos].count('\n') + 1
        context = json_str[max(0, e.pos - 100):e.pos + 100]
        print(f"JSON parse error at line {line_num}, pos {e.pos}:")
        print(f"  {e.msg}")
        print(f"  Context: ...{context}...")
        sys.exit(1)

    # Expand to full objects
    objects = []
    for i, raw in enumerate(raw_items):
        item_id = f"obj-{i + 1:03d}"
        volume = raw["v"]
        obj = {
            "id": item_id,
            "name": raw["n"],
            "tags": raw["t"],
            "volume_liters": volume,
            "size": derive_size(volume),
            "dateObtained": raw["d"],
            "lastUsed": raw["l"],
            "usageFrequency": raw["u"],
            "attachment": raw["a"],
            "status": "keeping",
            "description": raw.get("desc", ""),
            "icon": raw["i"],
            "detail": raw.get("det"),
        }
        objects.append(obj)

    print(f"Loaded {len(objects)} items from data.js")
    return objects


# ─── Manifest ───

def load_manifest():
    if MANIFEST_FILE.exists():
        return json.loads(MANIFEST_FILE.read_text())
    return {"generated": None, "count": 0, "items": {}}


def save_manifest(manifest):
    manifest["generated"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    manifest["count"] = len(manifest["items"])
    MANIFEST_FILE.write_text(json.dumps(manifest, indent=2))


# ─── Item Filtering ───

def filter_items(items, args, manifest):
    filtered = items[:]

    if args.room:
        filtered = [i for i in filtered if i["tags"]["room"] == args.room]
        print(f"Filtered to {len(filtered)} items in room: {args.room}")

    if args.category:
        filtered = [i for i in filtered if i["tags"]["category"] == args.category]
        print(f"Filtered to {len(filtered)} items in category: {args.category}")

    if args.ids:
        id_list = [s.strip() for s in args.ids.split(",")]
        filtered = [i for i in filtered if i["id"] in id_list]
        print(f"Filtered to {len(filtered)} items by ID")

    # Skip already-generated (unless specific IDs requested)
    if not args.ids:
        before = len(filtered)
        filtered = [i for i in filtered if i["id"] not in manifest["items"]]
        skipped = before - len(filtered)
        if skipped > 0:
            print(f"Skipping {skipped} already-generated items")

    # Sample diverse items
    if args.sample and args.sample > 0 and len(filtered) > args.sample:
        filtered = select_diverse_sample(filtered, args.sample)
        print(f"Selected diverse sample of {len(filtered)} items")

    return filtered


def select_diverse_sample(items, count):
    """Pick items spanning different rooms and categories."""
    by_room = {}
    for item in items:
        room = item["tags"]["room"]
        by_room.setdefault(room, []).append(item)

    rooms = list(by_room.keys())
    per_room = max(1, count // len(rooms))
    selected = []

    for room in rooms:
        room_items = by_room[room][:]
        # Group by category
        by_cat = {}
        for item in room_items:
            cat = item["tags"]["category"]
            by_cat.setdefault(cat, []).append(item)

        cats = list(by_cat.keys())
        picked = 0
        cat_idx = 0

        while picked < per_room and any(by_cat.values()):
            cat = cats[cat_idx % len(cats)]
            if by_cat.get(cat):
                item = random.choice(by_cat[cat])
                by_cat[cat].remove(item)
                selected.append(item)
                picked += 1
            cat_idx += 1
            if cat_idx > len(cats) * 3:
                break

    # Fill remaining
    selected_ids = {i["id"] for i in selected}
    remaining = [i for i in items if i["id"] not in selected_ids]
    random.shuffle(remaining)
    while len(selected) < count and remaining:
        selected.append(remaining.pop())

    return selected[:count]


# ─── Image Generation ───

def generate_image(item, manifest, args):
    prompt = build_prompt(item)

    if args.dry_run:
        print(f"\n─── {item['id']}: {item['name']} ───")
        print(f"Room: {item['tags']['room']} | Category: {item['tags']['category']} | Size: {item['size']}")
        print(f"Prompt ({len(prompt)} chars):")
        print(prompt)
        return True

    print(f"\nGenerating {item['id']}: {item['name']}...")

    try:
        client = OpenAI()

        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            n=1,
            size="1024x1024",
            quality="standard",
            style="natural",
            response_format="b64_json",
        )

        image_data = base64.b64decode(response.data[0].b64_json)
        img = Image.open(BytesIO(image_data))

        # Save full-size (512x512) WebP
        full_path = IMAGES_DIR / f"{item['id']}.webp"
        full_img = img.resize((512, 512), Image.LANCZOS)
        full_img.save(str(full_path), "WEBP", quality=85)

        # Save thumbnail (128x128) WebP
        thumb_path = IMAGES_DIR / f"{item['id']}-thumb.webp"
        thumb_img = img.resize((128, 128), Image.LANCZOS)
        thumb_img.save(str(thumb_path), "WEBP", quality=80)

        full_size = full_path.stat().st_size
        thumb_size = thumb_path.stat().st_size

        # Update manifest
        manifest["items"][item["id"]] = {
            "name": item["name"],
            "prompt": prompt,
            "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "fullSize": full_size,
            "thumbSize": thumb_size,
            "revisedPrompt": getattr(response.data[0], 'revised_prompt', None),
        }
        save_manifest(manifest)

        print(f"  Full: {full_size / 1024:.1f}KB | Thumb: {thumb_size / 1024:.1f}KB")
        return True

    except Exception as e:
        if "429" in str(e) or "rate" in str(e).lower():
            print("  Rate limited. Waiting 30 seconds...")
            time.sleep(30)
            return generate_image(item, manifest, args)
        print(f"  Error generating {item['id']}: {e}")
        return False


# ─── Main ───

def main():
    parser = argparse.ArgumentParser(description="Generate DALL-E 3 photos for inventory items")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts without calling API")
    parser.add_argument("--sample", type=int, default=0, help="Generate N random diverse items")
    parser.add_argument("--room", help="Filter by room (e.g., kitchen)")
    parser.add_argument("--category", help="Filter by category (e.g., clothing)")
    parser.add_argument("--ids", help="Comma-separated item IDs (e.g., obj-001,obj-005)")
    args = parser.parse_args()

    print("=== Dailydays Photo Generator ===\n")

    items = load_items()
    manifest = load_manifest()

    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    to_generate = filter_items(items, args, manifest)

    if not to_generate:
        print("No items to generate. All done!")
        return

    print(f"\nWill generate {len(to_generate)} images.")

    if not args.dry_run:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            print("\nError: OPENAI_API_KEY environment variable is required.")
            print("Set it with: export OPENAI_API_KEY=sk-...")
            sys.exit(1)
        estimated_cost = len(to_generate) * 0.04
        print(f"Estimated cost: ~${estimated_cost:.2f}")
        print("Starting in 3 seconds... (Ctrl+C to cancel)\n")
        time.sleep(3)

    success = 0
    failed = 0

    for i, item in enumerate(to_generate):
        print(f"[{i + 1}/{len(to_generate)}]", end="")

        ok = generate_image(item, manifest, args)
        if ok:
            success += 1
        else:
            failed += 1

        # Rate limiting
        if not args.dry_run and i < len(to_generate) - 1:
            time.sleep(1.5)

    print(f"\n=== Done ===")
    print(f"Generated: {success} | Failed: {failed}")

    if not args.dry_run and success > 0:
        print(f"Images saved to: {IMAGES_DIR}")
        print(f"Manifest updated: {MANIFEST_FILE}")


if __name__ == "__main__":
    main()
