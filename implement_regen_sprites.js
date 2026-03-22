/**
 * Implement regenerated enemy/obstacle sprite sheets.
 * Resizes, converts to Base64, and patches index.html with correct definitions.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const regenDir = path.join(__dirname, 'assets', 'spritesheets', 'enemies', 'regenerated');

// Sprite definitions based on visual inspection of each sheet
const SPRITE_CONFIGS = {
  troll: {
    file: 'troll.png',
    cols: 4, rows: 2,
    fps: 5,
    anims: { idle: [0,1,2,3], attack: [4,5,6], hit: [7] },
    maxW: 720  // 4 frames at 180px each
  },
  witch: {
    file: 'witch.png',
    cols: 4, rows: 2,
    fps: 5,
    anims: { idle: [0,1,2,3], attack: [4,5,6], hit: [7] },
    maxW: 720
  },
  golem: {
    file: 'golem.png',
    cols: 4, rows: 2,
    fps: 3,
    anims: { idle: [0,1,2,3], attack: [4,5,6], hit: [7] },
    maxW: 720
  },
  diver: {
    file: 'diver.png',
    cols: 4, rows: 2,
    fps: 6,
    anims: { idle: [0,1,2,3], attack: [4,5,6], hit: [7] },
    maxW: 720
  },
  serpent: {
    file: 'serpent.png',
    cols: 4, rows: 4,
    fps: 6,
    // Row 0: emerge/ghostly (0-3), Row 1: slither (4-7), Row 2: slither (8-11), Row 3: attack+coil (12-15)
    // Use rows 1-2 for idle (smooth slither), row 3 for attack, frame 0/1 for hit (ghostly)
    anims: { idle: [4,5,6,7,8,9,10,11], attack: [12,13,14], hit: [0] },
    maxW: 720
  },
  ptero: {
    file: 'ptero.png',
    cols: 4, rows: 1,
    fps: 6,
    anims: { idle: [0,1,2,3] },
    maxW: 720
  },
  log: {
    file: 'log.png',
    cols: 3, rows: 3,
    fps: 4,
    // Full rotation cycle for rolling log
    anims: { idle: [0,1,2,5,4,3,6,7,8] },
    maxW: 540  // 3 frames at 180px each
  },
  spikes: {
    file: 'spikes.png',
    cols: 1, rows: 1,
    fps: 1,
    anims: { idle: [0] },
    maxW: 256
  }
};

async function main() {
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const eol = html.includes('\r\n') ? '\r\n' : '\n';

  // First, remove ALL existing ENEMY_SPRITE_B64 lines for regenerated sprites
  for (const name of Object.keys(SPRITE_CONFIGS)) {
    const pattern = new RegExp(`ENEMY_SPRITE_B64\\.${name}="[^"]*";[\\r\\n]*`, 'g');
    const before = html.length;
    html = html.replace(pattern, '');
    if (html.length < before) {
      console.log(`  Removed old B64 for ${name} (saved ${((before - html.length)/1024).toFixed(1)}KB)`);
    }
  }

  // Process each regenerated sprite sheet
  const b64Lines = [];
  for (const [name, config] of Object.entries(SPRITE_CONFIGS)) {
    const filePath = path.join(regenDir, config.file);
    if (!fs.existsSync(filePath)) {
      console.log(`WARNING: ${config.file} not found, skipping`);
      continue;
    }

    const buf = fs.readFileSync(filePath);
    const meta = await sharp(buf).metadata();
    console.log(`${name}: ${meta.width}x${meta.height} -> resize to maxW=${config.maxW}`);

    // Resize maintaining aspect ratio
    const scale = config.maxW / meta.width;
    const targetW = config.maxW;
    const targetH = Math.round(meta.height * scale);

    const resized = await sharp(buf)
      .resize(targetW, targetH, { kernel: 'lanczos3' })
      .png({ quality: 80, compressionLevel: 9 })
      .toBuffer();

    const b64 = resized.toString('base64');
    console.log(`  Resized to ${targetW}x${targetH}, B64: ${(b64.length/1024).toFixed(1)}KB`);

    b64Lines.push(`ENEMY_SPRITE_B64.${name}="data:image/png;base64,${b64}";`);
  }

  // Insert all B64 lines before ENEMY_SPRITE_DEFS
  const defsMarker = 'var ENEMY_SPRITE_DEFS';
  const defsIdx = html.indexOf(defsMarker);
  if (defsIdx === -1) {
    console.error('Could not find ENEMY_SPRITE_DEFS!');
    process.exit(1);
  }

  const b64Block = b64Lines.join(eol) + eol;
  html = html.slice(0, defsIdx) + b64Block + html.slice(defsIdx);
  console.log(`Inserted ${b64Lines.length} B64 entries`);

  // Now replace ENEMY_SPRITE_DEFS (find opening brace, match to closing)
  const newDefsIdx = html.indexOf('var ENEMY_SPRITE_DEFS = {');
  if (newDefsIdx === -1) {
    // Try without space
    console.error('Could not find ENEMY_SPRITE_DEFS block start');
    process.exit(1);
  }

  let braceDepth = 0, defsEnd = -1;
  for (let i = newDefsIdx; i < html.length; i++) {
    if (html[i] === '{') braceDepth++;
    if (html[i] === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        defsEnd = i + 1;
        if (html[defsEnd] === ';') defsEnd++;
        break;
      }
    }
  }

  if (defsEnd === -1) {
    console.error('Could not find end of ENEMY_SPRITE_DEFS');
    process.exit(1);
  }

  // Build new defs - include both originals (bomber, charger, fire_geyser) and regenerated
  const allDefs = {
    bomber: { cols:8, rows:2, fps:7, anims:{"idle":[0,1,2,3,4,5],"attack":[8,9,10,11],"hit":[14]} },
    charger: { cols:4, rows:4, fps:8, anims:{"idle":[0,1,2,3],"attack":[4,5,6,7],"hit":[12,13]} },
    fire_geyser: { cols:8, rows:3, fps:5, anims:{"idle":[0],"attack":[0,1,2,3,4,5,6,7]} },
  };

  for (const [name, config] of Object.entries(SPRITE_CONFIGS)) {
    allDefs[name] = { cols: config.cols, rows: config.rows, fps: config.fps, anims: config.anims };
  }

  const newDefs = 'var ENEMY_SPRITE_DEFS = ' + JSON.stringify(allDefs, null, 2)
    .replace(/"(\w+)":/g, '$1:')  // remove quotes from keys
    .replace(/\n/g, eol) + ';';

  html = html.slice(0, newDefsIdx) + newDefs + html.slice(defsEnd);
  console.log('Replaced ENEMY_SPRITE_DEFS');

  // Verify counts
  const b64Count = (html.match(/ENEMY_SPRITE_B64\.\w+\s*=/g) || []).length;
  console.log(`Total B64 entries: ${b64Count}`);

  // Write
  fs.writeFileSync(path.join(__dirname, 'index.html'), html);
  const stat = fs.statSync(path.join(__dirname, 'index.html'));
  console.log(`index.html size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);

  // Validate JS syntax
  const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  if (scriptMatch) {
    try {
      new Function(scriptMatch[1]);
      console.log('JS syntax: OK');
    } catch (e) {
      console.error('JS SYNTAX ERROR:', e.message);
      process.exit(1);
    }
  }

  // Regenerate gameHtml.js
  console.log('\nRegenerating gameHtml.js...');
  require('child_process').execSync('node gen-gamehtmljs.js', { cwd: __dirname, stdio: 'inherit' });
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
