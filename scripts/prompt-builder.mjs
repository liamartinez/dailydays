// prompt-builder.mjs — Construct DALL-E 3 prompts from item metadata
// Produces "authentic messy phone photo" aesthetic per item.

// ─── Room → Location Context ───

const ROOM_LOCATIONS = {
  kitchen: [
    'sitting on a cluttered kitchen counter with other items visible nearby',
    'on the kitchen counter next to the stove',
    'on a kitchen shelf among other kitchen items',
    'on the kitchen island with a few crumbs and a dish towel nearby',
  ],
  bedroom: [
    'on a nightstand next to a lamp',
    'on the bed with rumpled sheets visible',
    'in the corner of a bedroom',
    'on top of a dresser with other personal items around it',
  ],
  bathroom: [
    'on the bathroom counter next to the sink',
    'in a bathroom cabinet with the door open',
    'on the edge of the bathtub',
    'on a bathroom shelf with other toiletries nearby',
  ],
  living_room: [
    'in a living room setting with other furniture visible',
    'next to the sofa with a coffee table in the background',
    'on the living room floor near the couch',
    'in the corner of a living room with natural light from a window',
  ],
  garage: [
    'on a cluttered garage shelf',
    'on the garage floor with tools and boxes around it',
    'hanging on a garage pegboard wall',
    'on a workbench in the garage',
  ],
  closet: [
    'hanging in a closet among other clothes',
    'folded on a closet shelf',
    'on the closet floor with shoes and boxes nearby',
    'stuffed on a closet shelf with other items',
  ],
  office: [
    'on a desk next to a keyboard and monitor',
    'on an office shelf among books and supplies',
    'on the desk with papers and pens scattered around',
    'next to a computer setup in a home office',
  ],
  dining_room: [
    'on a dining room table with placemats visible',
    'on a sideboard in the dining room',
    'in the dining room with chairs and a table in the background',
    'on the dining room table with a centerpiece nearby',
  ],
  laundry: [
    'on top of a washing machine',
    'on a shelf in the laundry room',
    'in a laundry basket area',
    'next to the dryer with some lint visible',
  ],
  storage: [
    'on a shelf in a storage room among boxes',
    'in a storage area with other items stacked around it',
    'on the floor of a storage closet',
    'sitting in a cardboard box in a storage area',
  ],
  entryway: [
    'near the front door on an entryway table',
    'on a bench in the entryway',
    'hanging on hooks by the front door',
    'on the floor near the door with shoes and coats nearby',
  ],
};

// ─── Subcategory-Specific Location Overrides ───

const SUBCATEGORY_LOCATIONS = {
  // Clothing subcategories
  outerwear: 'hanging in a closet next to other jackets',
  casual: 'folded in a pile on a dresser',
  formal: 'hanging on a closet rod with other dress clothes',
  activewear: 'tossed on a bedroom chair',
  accessories: 'laid out on a dresser top',
  footwear: 'on the closet floor with other shoes',
  underwear: 'folded in an open dresser drawer',
  loungewear: 'draped over the arm of a sofa',
  swimwear: 'in a drawer among other summer items',

  // Kitchen subcategories
  major: 'in its installed position in the kitchen',
  countertop: 'on the kitchen counter with other appliances nearby',
  cookware: 'on the kitchen counter or stovetop',
  bakeware: 'stacked in a kitchen cabinet with the door open',
  prep: 'on the kitchen counter near the cutting board',
  utensils: 'in a utensil holder on the counter',
  drinkware: 'on the kitchen counter or in an open cabinet',
  dinnerware: 'stacked on a kitchen shelf or counter',
  storage: 'stuffed in a kitchen cabinet or drawer',
  pantry: 'on a pantry shelf',

  // Furniture
  seating: 'in its usual spot in the room',
  bed: 'in the bedroom with sheets and pillows',
  tables: 'in its usual position in the room',

  // Electronics
  entertainment: 'on its stand or mounted, with cables visible',
  audio: 'on a shelf near other electronics',
  gaming: 'near the TV setup with controllers',
  cables: 'tangled in a drawer or on a desk',

  // Decor
  lighting: 'in its usual position, turned off',
  wall_art: 'hanging on the wall with part of the room visible',
  textiles: 'on a sofa or draped over furniture',
  plants: 'on a windowsill or shelf with natural light',
  rugs: 'on the floor with furniture legs visible at the edges',

  // Books
  cookbooks: 'on a kitchen shelf or counter',
  current: 'on a nightstand next to a lamp',
  reference: 'on a bookshelf spine-out',

  // Bedding
  bedding: 'folded on the bed or in a linen closet',
  blankets: 'folded on a shelf or draped over a chair',
  towels: 'folded on a shelf or hanging on a rack',

  // Cleaning
  cleaning: 'in a closet or under the sink',

  // Seasonal
  holiday: 'in a storage box with decorations visible',
  camping: 'on a garage shelf or in a closet',
};

// ─── Size → Framing Directives ───

function framingDirective(size, volume) {
  if (size === 'XS' || volume <= 1) {
    return 'Close-up shot from about 1 foot away, item fills most of the frame.';
  } else if (size === 'S' || volume <= 10) {
    return 'Shot from about 2-3 feet away.';
  } else if (size === 'M' || volume <= 50) {
    return 'Shot from about 4-5 feet away, showing the item with some surrounding context.';
  } else if (size === 'L' || volume <= 200) {
    return 'Wider shot from about 6-8 feet away, showing the item in the room.';
  } else {
    return 'Wide-angle shot showing the full item in its room setting.';
  }
}

// ─── Condition Hints ───

function conditionHints(item) {
  const hints = [];
  const desc = (item.description || '').toLowerCase();

  // Usage-based condition
  if (item.usageFrequency === 'never') {
    if (desc.includes('still in box') || desc.includes('unopened') || desc.includes('tags on') || desc.includes('new')) {
      hints.push('The item looks brand new, possibly still in original packaging.');
    } else {
      hints.push('The item appears unused but may have collected some dust.');
    }
  } else if (item.usageFrequency === 'daily') {
    hints.push('The item shows signs of regular daily use — some minor wear and patina.');
  } else if (item.usageFrequency === 'rarely') {
    hints.push('The item looks lightly used but has been sitting for a while.');
  }

  // Description-based hints
  if (desc.includes('expired')) hints.push('Some labels look faded or show expired dates.');
  if (desc.includes('warped') || desc.includes('bent')) hints.push('The item appears slightly warped or bent from use.');
  if (desc.includes('chipped')) hints.push('There are visible chips or small damage.');
  if (desc.includes('stained') || desc.includes('splattered')) hints.push('There are visible stains or splatters.');
  if (desc.includes('worn') || desc.includes('faded')) hints.push('The colors look slightly faded from use.');
  if (desc.includes('barely') || desc.includes('unused') || desc.includes('used 3 times')) hints.push('The item looks nearly new despite being owned for a while.');
  if (desc.includes('overstuffed') || desc.includes('overflowing')) hints.push('The item is visibly overstuffed and overflowing.');
  if (desc.includes('broken') || desc.includes('cracked')) hints.push('There is visible damage — a crack or break.');
  if (desc.includes('dusty')) hints.push('There is a thin layer of dust on the surface.');
  if (desc.includes('rusty') || desc.includes('rust')) hints.push('There are visible rust spots.');
  if (desc.includes('pilled') || desc.includes('flat')) hints.push('The fabric looks pilled or flattened from use.');

  // Attachment + age based
  if (item.attachment === 'high' && item.dateObtained) {
    const age = new Date().getFullYear() - parseInt(item.dateObtained.slice(0, 4));
    if (age > 5) {
      hints.push('This is clearly a cherished, well-cared-for older item.');
    }
  }

  // Staleness
  if (item.lastUsed) {
    const daysSince = Math.floor((new Date() - new Date(item.lastUsed)) / (1000 * 60 * 60 * 24));
    if (daysSince > 365) {
      hints.push('The item looks like it hasn\'t been touched in a long time.');
    }
  }

  return hints.join(' ');
}

// ─── Core Description ───

function coreDescription(item) {
  const parts = [];
  const det = item.detail || {};

  // Check if grouped item (name contains "(N)")
  const groupMatch = item.name.match(/\((\d+)\)/);
  const isGrouped = !!groupMatch;
  const count = groupMatch ? parseInt(groupMatch[1]) : 1;

  if (isGrouped) {
    // Grouped items: describe as a collection
    const baseName = item.name.replace(/\s*\(\d+\)/, '').toLowerCase();
    if (det.brand) {
      parts.push(`a group of ${count} ${baseName} including ${det.brand}`);
    } else if (det.contents) {
      parts.push(`a group of ${count} ${baseName}: ${det.contents}`);
    } else {
      parts.push(`a group of ${count} ${baseName} spread out`);
    }
  } else {
    // Single item
    if (det.color && det.brand && det.model) {
      parts.push(`a ${det.color} ${det.brand} ${det.model} ${item.name.toLowerCase()}`);
    } else if (det.color && det.brand) {
      parts.push(`a ${det.color} ${det.brand} ${item.name.toLowerCase()}`);
    } else if (det.brand && det.model) {
      parts.push(`a ${det.brand} ${det.model} ${item.name.toLowerCase()}`);
    } else if (det.brand) {
      parts.push(`a ${det.brand} ${item.name.toLowerCase()}`);
    } else if (det.color) {
      parts.push(`a ${det.color} ${item.name.toLowerCase()}`);
    } else {
      parts.push(`a ${item.name.toLowerCase()}`);
    }
  }

  // Add material if present and not already mentioned
  if (det.material && !parts[0].includes(det.material.toLowerCase())) {
    parts.push(`made of ${det.material.toLowerCase()}`);
  }

  return parts.join(', ');
}

// ─── Location Context ───

function locationContext(item) {
  const room = item.tags.room;
  const subcategory = item.tags.subcategory;

  // Check subcategory-specific override first
  if (subcategory && SUBCATEGORY_LOCATIONS[subcategory]) {
    return SUBCATEGORY_LOCATIONS[subcategory];
  }

  // Fall back to room-level locations
  const locations = ROOM_LOCATIONS[room] || ROOM_LOCATIONS.storage;
  // Use a deterministic "random" pick based on item id
  const idNum = parseInt(item.id.replace('obj-', ''));
  return locations[idNum % locations.length];
}

// ─── Detail Specifics ───

function detailSpecifics(item) {
  const det = item.detail || {};
  const parts = [];

  // For items with specific contents, describe what should be visible
  if (det.contents && typeof det.contents === 'string') {
    const shortContents = det.contents.length > 100
      ? det.contents.slice(0, 100).replace(/,([^,]*)$/, '')
      : det.contents;
    parts.push(`Visible contents include: ${shortContents}.`);
  }

  // For books/media with titles
  if (det.titles && Array.isArray(det.titles)) {
    const titleNames = det.titles.slice(0, 3).map(t =>
      typeof t === 'string' ? t : t.title
    );
    parts.push(`Visible titles: ${titleNames.join(', ')}.`);
  }

  return parts.join(' ');
}

// ─── Style Directive (constant) ───

const STYLE_DIRECTIVE = `Shot with an iPhone in natural household lighting. Slightly off-angle, casual framing as if quickly documenting possessions for a home inventory app. Not a product photo — this is a real item in a real, lived-in home. No text overlays. No watermarks. Photorealistic.`;

// ─── Main Export ───

export function buildPrompt(item) {
  const core = coreDescription(item);
  const location = locationContext(item);
  const condition = conditionHints(item);
  const framing = framingDirective(item.size, item.volume_liters);
  const details = detailSpecifics(item);

  const prompt = [
    `A casual smartphone photo of ${core}, ${location}.`,
    condition,
    framing,
    STYLE_DIRECTIVE,
    details,
  ].filter(Boolean).join(' ');

  return prompt;
}

// Export for testing
export { coreDescription, locationContext, conditionHints, framingDirective, detailSpecifics };
