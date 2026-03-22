/**
 * Fix:
 * 1. Re-add bomber, charger, fire_geyser B64 from original sprite sheets
 * 2. Replace ENEMY_SPRITE_DEFS with complete definitions for ALL sprites
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const enemyDir = path.join(__dirname, 'assets', 'spritesheets', 'enemies');

async function main() {
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const eol = html.includes('\r\n') ? '\r\n' : '\n';

  // Process the 3 original working sprite sheets
  const originals = {
    bomber: { file: 'bomberspritesheet.png', maxW: 1024 },
    charger: { file: 'chargerspritesheet.png', maxW: 512 },
    fire_geyser: { file: 'firegeyserspritesheet.png', maxW: 688 },
  };

  for (const [name, info] of Object.entries(originals)) {
    const filePath = path.join(enemyDir, info.file);
    if (!fs.existsSync(filePath)) {
      console.log(`WARNING: ${filePath} not found, skipping ${name}`);
      continue;
    }

    const buf = fs.readFileSync(filePath);
    const meta = await sharp(buf).metadata();
    console.log(`${name}: original ${meta.width}x${meta.height}`);

    // Resize
    const scale = info.maxW / meta.width;
    const targetW = Math.round(meta.width * scale);
    const targetH = Math.round(meta.height * scale);

    const resized = await sharp(buf).resize(targetW, targetH, { kernel: 'lanczos3' }).png().toBuffer();
    const b64 = resized.toString('base64');
    console.log(`  Resized to ${targetW}x${targetH}, B64: ${(b64.length/1024).toFixed(1)}KB`);

    // Insert B64 before ENEMY_SPRITE_DEFS
    const insertMarker = 'var ENEMY_SPRITE_DEFS';
    const insertIdx = html.indexOf(insertMarker);
    if (insertIdx > -1) {
      const line = `ENEMY_SPRITE_B64.${name}="data:image/png;base64,${b64}";${eol}`;
      html = html.slice(0, insertIdx) + line + html.slice(insertIdx);
      console.log(`  Inserted B64 for ${name}`);
    }
  }

  // Now replace the entire ENEMY_SPRITE_DEFS block
  // Find from "var ENEMY_SPRITE_DEFS = {" to the closing "};"
  const defsStart = html.indexOf('var ENEMY_SPRITE_DEFS = {');
  if (defsStart === -1) {
    console.error('Could not find ENEMY_SPRITE_DEFS!');
    process.exit(1);
  }

  // Find the matching closing - it's "};' followed by a newline
  // Need to find the right closing brace - count nesting
  let braceDepth = 0;
  let defsEnd = -1;
  for (let i = defsStart; i < html.length; i++) {
    if (html[i] === '{') braceDepth++;
    if (html[i] === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        // Find the semicolon
        defsEnd = i + 1;
        if (html[defsEnd] === ';') defsEnd++;
        break;
      }
    }
  }

  if (defsEnd === -1) {
    console.error('Could not find end of ENEMY_SPRITE_DEFS!');
    process.exit(1);
  }

  const newDefs = `var ENEMY_SPRITE_DEFS = {${eol}` +
    `  bomber: { cols:8, rows:2, fps:7, anims:{"idle":[0,1,2,3,4,5],"attack":[8,9,10,11],"hit":[14]} },${eol}` +
    `  charger: { cols:4, rows:4, fps:8, anims:{"idle":[0,1,2,3],"attack":[4,5,6,7],"hit":[12,13]} },${eol}` +
    `  fire_geyser: { cols:8, rows:3, fps:5, anims:{"idle":[0],"attack":[0,1,2,3,4,5,6,7]} },${eol}` +
    `  troll: { cols:4, rows:2, fps:5, anims:{"idle":[0,1,2,3],"attack":[4,5,6],"hit":[7]} },${eol}` +
    `  witch: { cols:4, rows:2, fps:5, anims:{"idle":[0,1,2,3],"attack":[4,5,6],"hit":[7]} },${eol}` +
    `  golem: { cols:4, rows:2, fps:3, anims:{"idle":[0,1,2,3],"attack":[4,5,6],"hit":[7]} },${eol}` +
    `  diver: { cols:4, rows:2, fps:6, anims:{"idle":[0,1,2,3],"attack":[4,5,6],"hit":[7]} },${eol}` +
    `  serpent: { cols:4, rows:2, fps:5, anims:{"idle":[0,1,2,3],"attack":[4,5,6],"hit":[7]} },${eol}` +
    `  ptero: { cols:4, rows:1, fps:6, anims:{"idle":[0,1,2,3]} },${eol}` +
    `  log: { cols:1, rows:1, fps:1, anims:{"idle":[0]} },${eol}` +
    `  spikes: { cols:1, rows:1, fps:1, anims:{"idle":[0]} }${eol}` +
    `};`;

  html = html.slice(0, defsStart) + newDefs + html.slice(defsEnd);
  console.log('Replaced ENEMY_SPRITE_DEFS with complete definitions');

  // Verify
  const b64Count = (html.match(/ENEMY_SPRITE_B64\./g) || []).length;
  console.log(`Total ENEMY_SPRITE_B64 entries: ${b64Count}`);

  fs.writeFileSync(path.join(__dirname, 'index.html'), html);
  const stat = fs.statSync(path.join(__dirname, 'index.html'));
  console.log(`index.html size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);

  // Regenerate gameHtml.js
  console.log('\nRegenerating gameHtml.js...');
  require('child_process').execSync('node gen-gamehtmljs.js', { cwd: __dirname, stdio: 'inherit' });
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
