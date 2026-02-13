"""
prompt_builder.py — Construct DALL-E 3 prompts from item metadata.

Strategy V4: "Disposable camera photo" + radical brevity.
DALL-E has trained on millions of real disposable camera photos and knows
what they look like — overexposed flash, washed-out colors, grain, no
composition. This single concept does more than pages of technical specs.

Keep prompts under 40 words. Every extra word is something DALL-E's
rewriter can romanticize into cinematic language.
"""

import re

# ─── Room → Location Context ───

ROOM_LOCATIONS = {
    "kitchen": [
        "on the kitchen counter next to a dish towel, some mail, and a coffee mug",
        "on the kitchen counter with a sponge and some crumbs nearby",
        "crammed on a kitchen shelf next to mismatched jars and a box of cereal",
        "on the kitchen island with a paper towel roll and some fruit nearby",
    ],
    "bedroom": [
        "on a nightstand next to a lamp and a phone charger cord",
        "on the bed with rumpled sheets and a pillow visible",
        "in the corner of a bedroom with some clothes on the floor",
        "on top of a dresser with a water glass and loose change",
    ],
    "bathroom": [
        "on the bathroom counter next to the sink and a toothbrush",
        "in a bathroom cabinet with the door open, other stuff crammed around it",
        "on the edge of the bathtub with shampoo bottles nearby",
        "on a bathroom shelf with other toiletries and a roll of toilet paper visible",
    ],
    "living_room": [
        "in the living room with a remote control and some magazines on the coffee table",
        "next to the sofa with a throw blanket bunched up",
        "on the living room floor near the couch with some shoes nearby",
        "in the corner of the living room with a lamp cord visible",
    ],
    "garage": [
        "on a messy garage shelf with paint cans and random stuff",
        "on the garage floor next to some boxes and a broom",
        "hanging on a garage pegboard wall with tools around it",
        "on a workbench in the garage with sawdust and screws scattered around",
    ],
    "closet": [
        "hanging in a closet crammed between other clothes",
        "folded on a closet shelf with other stuff piled around",
        "on the closet floor with shoes and a box nearby",
        "stuffed on a crowded closet shelf",
    ],
    "office": [
        "on a desk next to a keyboard and some sticky notes",
        "on an office shelf with papers and binders around it",
        "on the desk with some pens, a mug, and papers scattered around",
        "next to a computer monitor with cables visible",
    ],
    "dining_room": [
        "on the dining table with a placemat and some napkins",
        "on a sideboard in the dining room with some candles and clutter",
        "in the dining room with chairs pushed out from the table",
        "on the dining table next to a centerpiece and some mail",
    ],
    "laundry": [
        "on top of the washing machine with a detergent bottle nearby",
        "on a shelf in the laundry room with dryer sheets and cleaning supplies",
        "in the laundry area with a basket of clothes nearby",
        "next to the dryer with some lint and a sock on the floor",
    ],
    "storage": [
        "on a shelf in a storage room with cardboard boxes stacked around it",
        "in a storage area with other random stuff piled nearby",
        "on the floor of a storage closet with a vacuum and bags",
        "sitting in a cardboard box in a dimly lit storage area",
    ],
    "entryway": [
        "near the front door on a small table with keys and mail",
        "on a bench in the entryway with shoes underneath",
        "hanging on hooks by the front door with coats and bags",
        "on the floor near the door with shoes and an umbrella",
    ],
}

SUBCATEGORY_LOCATIONS = {
    "outerwear": "hanging in a closet crammed between other jackets",
    "casual": "folded in a messy pile on a dresser",
    "formal": "hanging on a closet rod with other clothes shoved to the side",
    "activewear": "tossed on a bedroom chair with other clothes",
    "accessories": "laid out on a dresser top with some loose coins and a receipt",
    "footwear": "on the closet floor with other shoes",
    "underwear": "folded in an open dresser drawer",
    "loungewear": "draped over the arm of the sofa with a blanket",
    "swimwear": "in a drawer with other summer stuff",
    "major": "in its installed position in the kitchen with magnets and a towel on the handle",
    "countertop": "on the kitchen counter with crumbs and a towel nearby",
    "cookware": "on the stovetop with a spatula and some oil splatters nearby",
    "bakeware": "stacked in a kitchen cabinet with the door open",
    "prep": "on the kitchen counter next to a cutting board with food residue",
    "utensils": "in a utensil holder on the counter with other stuff around",
    "drinkware": "on the kitchen counter next to the sink",
    "dinnerware": "stacked on a kitchen shelf, a bit uneven",
    "pantry": "on a pantry shelf with other boxes and cans",
    "seating": "in its usual spot in the room with a throw pillow and remote nearby",
    "bed": "in the bedroom with messy sheets",
    "tables": "in its usual position with some stuff sitting on it",
    "entertainment": "in its spot with some cables visible",
    "audio": "on a shelf near other electronics and some dust",
    "gaming": "near the TV with controllers and some game cases around",
    "cables": "tangled in a drawer or piled on a desk",
    "lighting": "in its usual position, turned off, with some dust",
    "wall_art": "hanging on the wall, slightly crooked",
    "textiles": "on a sofa, a bit bunched up",
    "plants": "on a windowsill with some dead leaves around it",
    "rugs": "on the floor with furniture legs visible",
    "cookbooks": "on a kitchen shelf leaning against each other",
    "current": "on a nightstand next to a lamp and phone charger",
    "reference": "on a bookshelf, spine-out, crammed between other books",
    "bedding": "folded on the bed or stuffed in a linen closet",
    "blankets": "folded on a shelf or tossed on a chair",
    "towels": "on a shelf or hanging on a rack, a bit wrinkled",
    "cleaning": "under the sink or in a closet with other cleaning supplies",
    "holiday": "in a cardboard storage box with other decorations visible",
    "camping": "on a garage shelf with other outdoor gear",
}


def core_description(item):
    """Build a generic visual description — no brand names or model numbers."""
    det = item.get("detail") or {}
    name = item.get("name", "")

    group_match = re.search(r"\((\d+)\)", name)

    if group_match:
        count = int(group_match.group(1))
        base_name = re.sub(r"\s*\(\d+\)", "", name).lower()
        if det.get("contents"):
            return f"{count} {base_name}: {det['contents'][:60]}"
        return f"{count} {base_name}"

    lower_name = name.lower()
    color = det.get("color", "")
    material = det.get("material", "")
    parts = []

    if color:
        article = "an" if color.lower()[0] in "aeiou" else "a"
        parts.append(f"{article} {color.lower()} {lower_name}")
    else:
        article = "an" if lower_name[0] in "aeiou" else "a"
        parts.append(f"{article} {lower_name}")

    if material and material.lower() not in lower_name:
        parts.append(f"made of {material.lower()}")

    return ", ".join(parts)


def location_context(item):
    room = item["tags"]["room"]
    category = item["tags"].get("category", "")
    subcategory = item["tags"].get("subcategory", "")

    if category != "furniture" and subcategory and subcategory in SUBCATEGORY_LOCATIONS:
        return SUBCATEGORY_LOCATIONS[subcategory]

    locations = ROOM_LOCATIONS.get(room, ROOM_LOCATIONS["storage"])
    id_num = int(item["id"].replace("obj-", ""))
    return locations[id_num % len(locations)]


def build_prompt(item):
    """Build a DALL-E 3 prompt. Target: ~30 words.

    "Disposable camera photo" does all the heavy lifting — DALL-E knows
    what those look like from training data. No technical specs needed.
    """
    core = core_description(item)
    location = location_context(item)

    return f"Disposable camera photo. {core[0].upper()}{core[1:]}, {location}. Tilted slightly. No people visible."
