#!/usr/bin/env node
// generate-photos.mjs — Generate DALL-E 3 photos for household inventory items
//
// Usage:
//   node generate-photos.mjs --dry-run              # Print prompts without calling API
//   node generate-photos.mjs --sample 25             # Generate 25 random diverse items
//   node generate-photos.mjs --room kitchen          # Generate for a specific room
//   node generate-photos.mjs --category clothing     # Generate for a specific category
//   node generate-photos.mjs --ids obj-001,obj-005   # Generate specific items
//   node generate-photos.mjs                         # Generate all missing items
//
// Requires OPENAI_API_KEY environment variable.

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { buildPrompt } from './prompt-builder.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHARED_DIR = join(__dirname, '..', 'shared');
const IMAGES_DIR = join(SHARED_DIR, 'images');
const DATA_FILE = join(SHARED_DIR, 'js', 'data.js');
const MANIFEST_FILE = join(IMAGES_DIR, 'manifest.json');

// ─── Parse Data ───

function deriveSize(volume) {
  if (volume <= 1) return 'XS';
  if (volume <= 10) return 'S';
  if (volume <= 50) return 'M';
  if (volume <= 200) return 'L';
  return 'XL';
}

function loadItems() {
  const source = readFileSync(DATA_FILE, 'utf-8');

  // Extract the RAW array from data.js
  // Find "const RAW = [" and match until the closing "];"
  const rawMatch = source.match(/const RAW\s*=\s*\[([\s\S]*?)\n\];/);
  if (!rawMatch) {
    throw new Error('Could not find RAW array in data.js');
  }

  // The RAW entries use shorthand keys. We need to evaluate them.
  // Wrap in an array and use Function constructor for safe-ish evaluation.
  const rawArrayStr = `[${rawMatch[1]}]`;

  // Use Function to evaluate (safer than eval, no access to scope)
  const RAW = new Function(`return ${rawArrayStr}`)();

  // Expand to full objects (same logic as data.js lines 546-566)
  let idCounter = 0;
  const objects = RAW.map(raw => {
    idCounter++;
    const id = `obj-${String(idCounter).padStart(3, '0')}`;
    const volume = raw.v;
    return {
      id,
      name: raw.n,
      tags: raw.t,
      volume_liters: volume,
      size: deriveSize(volume),
      dateObtained: raw.d,
      lastUsed: raw.l,
      usageFrequency: raw.u,
      attachment: raw.a,
      status: 'keeping',
      description: raw.desc,
      icon: raw.i,
      detail: raw.det || null,
    };
  });

  console.log(`Loaded ${objects.length} items from data.js`);
  return objects;
}

// ─── Manifest ───

function loadManifest() {
  if (existsSync(MANIFEST_FILE)) {
    return JSON.parse(readFileSync(MANIFEST_FILE, 'utf-8'));
  }
  return { generated: null, count: 0, items: {} };
}

function saveManifest(manifest) {
  manifest.generated = new Date().toISOString();
  manifest.count = Object.keys(manifest.items).length;
  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
}

// ─── CLI Args ───

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    dryRun: false,
    sample: 0,
    room: null,
    category: null,
    ids: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        opts.dryRun = true;
        break;
      case '--sample':
        opts.sample = parseInt(args[++i]) || 25;
        break;
      case '--room':
        opts.room = args[++i];
        break;
      case '--category':
        opts.category = args[++i];
        break;
      case '--ids':
        opts.ids = args[++i].split(',').map(s => s.trim());
        break;
    }
  }

  return opts;
}

// ─── Filter Items ───

function filterItems(items, opts, manifest) {
  let filtered = items;

  // Filter by room
  if (opts.room) {
    filtered = filtered.filter(item => item.tags.room === opts.room);
    console.log(`Filtered to ${filtered.length} items in room: ${opts.room}`);
  }

  // Filter by category
  if (opts.category) {
    filtered = filtered.filter(item => item.tags.category === opts.category);
    console.log(`Filtered to ${filtered.length} items in category: ${opts.category}`);
  }

  // Filter by specific IDs
  if (opts.ids) {
    filtered = filtered.filter(item => opts.ids.includes(item.id));
    console.log(`Filtered to ${filtered.length} items by ID`);
  }

  // Skip already-generated items (unless specific IDs requested)
  if (!opts.ids) {
    const before = filtered.length;
    filtered = filtered.filter(item => !manifest.items[item.id]);
    const skipped = before - filtered.length;
    if (skipped > 0) {
      console.log(`Skipping ${skipped} already-generated items`);
    }
  }

  // Sample random diverse items
  if (opts.sample > 0 && filtered.length > opts.sample) {
    filtered = selectDiverseSample(filtered, opts.sample);
    console.log(`Selected diverse sample of ${filtered.length} items`);
  }

  return filtered;
}

// Select a diverse sample across rooms and categories
function selectDiverseSample(items, count) {
  // Group by room
  const byRoom = {};
  for (const item of items) {
    const room = item.tags.room;
    if (!byRoom[room]) byRoom[room] = [];
    byRoom[room].push(item);
  }

  const rooms = Object.keys(byRoom);
  const selected = [];
  const perRoom = Math.max(1, Math.floor(count / rooms.length));

  // Pick items from each room, trying to vary categories
  for (const room of rooms) {
    const roomItems = byRoom[room];
    // Group by category within room
    const byCat = {};
    for (const item of roomItems) {
      const cat = item.tags.category;
      if (!byCat[cat]) byCat[cat] = [];
      byCat[cat].push(item);
    }

    const cats = Object.keys(byCat);
    let picked = 0;
    let catIdx = 0;

    while (picked < perRoom && picked < roomItems.length) {
      const cat = cats[catIdx % cats.length];
      if (byCat[cat].length > 0) {
        // Pick a random item from this category
        const randIdx = Math.floor(Math.random() * byCat[cat].length);
        selected.push(byCat[cat].splice(randIdx, 1)[0]);
        picked++;
      }
      catIdx++;
      // Safety: break if we've gone through all categories without finding items
      if (catIdx > cats.length * 2) break;
    }
  }

  // If we need more, fill from remaining items
  const selectedIds = new Set(selected.map(i => i.id));
  const remaining = items.filter(i => !selectedIds.has(i.id));
  while (selected.length < count && remaining.length > 0) {
    const randIdx = Math.floor(Math.random() * remaining.length);
    selected.push(remaining.splice(randIdx, 1)[0]);
  }

  return selected.slice(0, count);
}

// ─── Image Generation ───

async function generateImage(item, manifest, opts) {
  const prompt = buildPrompt(item);

  if (opts.dryRun) {
    console.log(`\n─── ${item.id}: ${item.name} ───`);
    console.log(`Room: ${item.tags.room} | Category: ${item.tags.category} | Size: ${item.size}`);
    console.log(`Prompt (${prompt.length} chars):`);
    console.log(prompt);
    return true;
  }

  console.log(`\nGenerating ${item.id}: ${item.name}...`);

  try {
    // Dynamic import of OpenAI
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI();

    const response = await client.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'b64_json',
    });

    const imageData = response.data[0].b64_json;
    const buffer = Buffer.from(imageData, 'base64');

    // Import sharp for resizing
    const sharp = (await import('sharp')).default;

    // Save full-size (512x512) WebP
    const fullPath = join(IMAGES_DIR, `${item.id}.webp`);
    await sharp(buffer)
      .resize(512, 512)
      .webp({ quality: 85 })
      .toFile(fullPath);

    // Save thumbnail (128x128) WebP
    const thumbPath = join(IMAGES_DIR, `${item.id}-thumb.webp`);
    await sharp(buffer)
      .resize(128, 128)
      .webp({ quality: 80 })
      .toFile(thumbPath);

    const fullSize = statSync(fullPath).size;
    const thumbSize = statSync(thumbPath).size;

    // Update manifest
    manifest.items[item.id] = {
      name: item.name,
      prompt,
      generated: new Date().toISOString(),
      fullSize,
      thumbSize,
      revisedPrompt: response.data[0].revised_prompt || null,
    };
    saveManifest(manifest);

    console.log(`  Full: ${(fullSize / 1024).toFixed(1)}KB | Thumb: ${(thumbSize / 1024).toFixed(1)}KB`);
    return true;

  } catch (err) {
    if (err.status === 429) {
      console.error(`  Rate limited. Waiting 30 seconds...`);
      await sleep(30000);
      return generateImage(item, manifest, opts); // Retry
    }
    console.error(`  Error generating ${item.id}: ${err.message}`);
    return false;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main ───

async function main() {
  const opts = parseArgs();

  console.log('=== Dailydays Photo Generator ===\n');

  // Load data
  const items = loadItems();
  const manifest = loadManifest();

  // Ensure images directory exists
  if (!existsSync(IMAGES_DIR)) {
    mkdirSync(IMAGES_DIR, { recursive: true });
  }

  // Filter items
  const toGenerate = filterItems(items, opts, manifest);

  if (toGenerate.length === 0) {
    console.log('No items to generate. All done!');
    return;
  }

  console.log(`\nWill generate ${toGenerate.length} images.`);

  if (!opts.dryRun) {
    if (!process.env.OPENAI_API_KEY) {
      console.error('\nError: OPENAI_API_KEY environment variable is required.');
      console.error('Set it with: export OPENAI_API_KEY=sk-...');
      process.exit(1);
    }
    const estimatedCost = (toGenerate.length * 0.04).toFixed(2);
    console.log(`Estimated cost: ~$${estimatedCost}`);
    console.log('Starting in 3 seconds... (Ctrl+C to cancel)\n');
    await sleep(3000);
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < toGenerate.length; i++) {
    const item = toGenerate[i];
    console.log(`[${i + 1}/${toGenerate.length}]`);

    const ok = await generateImage(item, manifest, opts);
    if (ok) success++;
    else failed++;

    // Rate limiting: wait between API calls
    if (!opts.dryRun && i < toGenerate.length - 1) {
      await sleep(1500);
    }
  }

  console.log(`\n=== Done ===`);
  console.log(`Generated: ${success} | Failed: ${failed}`);

  if (!opts.dryRun && success > 0) {
    console.log(`Images saved to: ${IMAGES_DIR}`);
    console.log(`Manifest updated: ${MANIFEST_FILE}`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
