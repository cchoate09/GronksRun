/**
 * Implement regenerated bomber, charger, and fire_geyser sprite sheets.
 * Removes old B64 data, adds new, updates ENEMY_SPRITE_DEFS.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const regenDir = path.join(__dirname, 'assets', 'spritesheets', 'enemies', 'regenerated');

const SPRITE_CONFIGS = {
  bomber: {
    file: 'bomber.png',
    cols: 4, rows: 3,
    fps: 7,
    // Row 0: idle flap (0-3), Row 1: attack (4-6) + hit (7), Row 2: more attack (8-10) + explode hit (11)
    anims: { idle: [0,1,2,3], attack: [4,5,6,8,9,10], hit: [7] },
    maxW: 720
  },
  charger: {
    file: 'charger.png',
    cols: 4, rows: 3,
    fps: 8,
    // Row 0: gallop idle (0-3), Row 1: charge (4-7), Row 2: charge cont (8-10) + hit (11)
    anims: { idle: [0,1,2,3], attack: [4,5,6,7,8,9,10], hit: [11] },
    maxW: 720
  },
  fire_geyser: {
    file: 'fire_geyser.png',
    cols: 4, rows: 2,
    fps: 5,
    // Row 0: dormant (0) + eruption buildup (1-3), Row 1: full eruption (4-6) + cooling (7)
    // idle = dormant, attack = eruption sequence
    anims: { idle: [0], attack: [0,1,2,3,4,5,6,7] },
    maxW: 720
  }
};

async function main() {
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const eol = html.includes('\r\n') ? '\r\n' : '\n';

  // Remove old B64 for these 3
  for (const name of Object.keys(SPRITE_CONFIGS)) {
    const pattern = new RegExp(`ENEMY_SPRITE_B64\\.${name}="[^"]*";[\\r\\n]*`, 'g');
    const before = html.length;
    html = html.replace(pattern, '');
    if (html.length < before) {
      console.log(`Removed old B64 for ${name} (saved ${((before - html.length)/1024).toFixed(1)}KB)`);
    }
  }

  // Process and insert new B64
  const b64Lines = [];
  for (const [name, config] of Object.entries(SPRITE_CONFIGS)) {
    const filePath = path.join(regenDir, config.file);
    const buf = fs.readFileSync(filePath);
    const meta = await sharp(buf).metadata();
    console.log(`${name}: ${meta.width}x${meta.height}`);

    const scale = config.maxW / meta.width;
    const targetW = config.maxW;
    const targetH = Math.round(meta.height * scale);

    const resized = await sharp(buf)
      .resize(targetW, targetH, { kernel: 'lanczos3' })
      .png({ compressionLevel: 9 })
      .toBuffer();

    const b64 = resized.toString('base64');
    console.log(`  -> ${targetW}x${targetH}, B64: ${(b64.length/1024).toFixed(1)}KB`);
    b64Lines.push(`ENEMY_SPRITE_B64.${name}="data:image/png;base64,${b64}";`);
  }

  // Insert before ENEMY_SPRITE_DEFS
  const defsMarker = 'var ENEMY_SPRITE_DEFS';
  const defsIdx = html.indexOf(defsMarker);
  if (defsIdx === -1) { console.error('ENEMY_SPRITE_DEFS not found!'); process.exit(1); }
  html = html.slice(0, defsIdx) + b64Lines.join(eol) + eol + html.slice(defsIdx);
  console.log(`Inserted ${b64Lines.length} B64 entries`);

  // Update ENEMY_SPRITE_DEFS for these 3 sprites
  for (const [name, config] of Object.entries(SPRITE_CONFIGS)) {
    // Find the existing def line for this sprite and replace it
    const defPattern = new RegExp(
      `${name}:\\s*\\{[\\s\\S]*?\\}\\s*\\}\\s*\\}`,
      'm'
    );
    // Simpler approach: find "  bomber: {" and replace until next sprite or closing
    // Let's use line-by-line approach
  }

  // Instead of complex regex, find and replace the entire ENEMY_SPRITE_DEFS block
  const newDefsStart = html.indexOf('var ENEMY_SPRITE_DEFS = {');
  let braceDepth = 0, defsEnd = -1;
  for (let i = newDefsStart; i < html.length; i++) {
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

  // Parse existing defs to keep the non-changed ones
  const existingBlock = html.slice(newDefsStart, defsEnd);

  // Build complete new defs
  const allDefs = {};

  // Add the 3 updated sprites
  for (const [name, config] of Object.entries(SPRITE_CONFIGS)) {
    allDefs[name] = { cols: config.cols, rows: config.rows, fps: config.fps, anims: config.anims };
  }

  // Keep existing defs for other sprites (parse from current block)
  const otherSprites = ['troll', 'witch', 'golem', 'diver', 'serpent', 'ptero', 'log', 'spikes'];
  for (const name of otherSprites) {
    const match = existingBlock.match(new RegExp(`${name}:\\s*\\{([\\s\\S]*?)\\n  \\}`, 'm'));
    if (match) {
      // Extract cols, rows, fps, anims from the match
      const colsM = match[1].match(/cols:\s*(\d+)/);
      const rowsM = match[1].match(/rows:\s*(\d+)/);
      const fpsM = match[1].match(/fps:\s*(\d+)/);
      const animsM = match[1].match(/anims:\s*(\{[\s\S]*?\})\s*$/m);
      if (colsM && rowsM && fpsM) {
        // Build anims from the text
        const idleM = match[1].match(/idle:\s*\[([\d,\s]*)\]/);
        const attackM = match[1].match(/attack:\s*\[([\d,\s]*)\]/);
        const hitM = match[1].match(/hit:\s*\[([\d,\s]*)\]/);
        const anims = {};
        if (idleM) anims.idle = idleM[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        if (attackM) anims.attack = attackM[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        if (hitM) anims.hit = hitM[1].split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        allDefs[name] = {
          cols: parseInt(colsM[1]),
          rows: parseInt(rowsM[1]),
          fps: parseInt(fpsM[1]),
          anims
        };
      }
    }
  }

  const newDefs = 'var ENEMY_SPRITE_DEFS = ' + JSON.stringify(allDefs, null, 2)
    .replace(/"(\w+)":/g, '$1:')
    .replace(/\n/g, eol) + ';';

  html = html.slice(0, newDefsStart) + newDefs + html.slice(defsEnd);
  console.log('Updated ENEMY_SPRITE_DEFS');

  // Verify
  const b64Count = (html.match(/ENEMY_SPRITE_B64\.\w+\s*=/g) || []).length;
  console.log(`Total B64 entries: ${b64Count}`);

  // Write
  fs.writeFileSync(path.join(__dirname, 'index.html'), html);
  console.log(`index.html: ${(fs.statSync(path.join(__dirname, 'index.html')).size / 1024 / 1024).toFixed(2)} MB`);

  // Validate
  const scriptMatch = html.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  try { new Function(scriptMatch[1]); console.log('JS syntax: OK'); } catch(e) { console.error('SYNTAX ERROR:', e.message); process.exit(1); }

  // Regen gameHtml.js
  console.log('\nRegenerating gameHtml.js...');
  require('child_process').execSync('node gen-gamehtmljs.js', { cwd: __dirname, stdio: 'inherit' });
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
