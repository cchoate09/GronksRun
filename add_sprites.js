// add_sprites.js — Resize new sprite sheets, convert to Base64, embed in game
// Also refactors sprite system to be generic for all 6 characters

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SHEET_DIR = './assets/spritesheets';
const TARGET_W = 1024;  // Match Gronk/Pip dimensions
const TARGET_H = 256;

// Character sprite sheets in order matching CHARS array
const CHARS = [
  { id: 'gronk', file: 'GronkSpritesheet.png' },
  { id: 'pip',   file: 'PipSpriteSheet.png' },
  { id: 'bruk',  file: 'brukspritesheet.png' },
  { id: 'zara',  file: 'zaraspritesheet.png' },
  { id: 'rex',   file: 'rexspritesheet.png' },
  { id: 'mog',   file: 'MogSpriteSheet.png' },
];

async function processSheets() {
  const b64Map = {};

  for (const ch of CHARS) {
    const filePath = path.join(SHEET_DIR, ch.file);
    const buf = fs.readFileSync(filePath);
    const meta = await sharp(buf).metadata();

    let finalBuf;
    if (meta.width !== TARGET_W || meta.height !== TARGET_H) {
      console.log(`Resizing ${ch.file}: ${meta.width}x${meta.height} → ${TARGET_W}x${TARGET_H}`);
      finalBuf = await sharp(buf)
        .resize(TARGET_W, TARGET_H, { fit: 'fill', kernel: 'lanczos3' })
        .png({ quality: 80, compressionLevel: 9 })
        .toBuffer();
    } else {
      console.log(`${ch.file}: already ${TARGET_W}x${TARGET_H}, optimizing...`);
      finalBuf = await sharp(buf)
        .png({ compressionLevel: 9 })
        .toBuffer();
    }

    const b64 = 'data:image/png;base64,' + finalBuf.toString('base64');
    b64Map[ch.id] = b64;
    console.log(`  ${ch.id}: ${(finalBuf.length/1024).toFixed(1)}KB PNG → ${(b64.length/1024).toFixed(1)}KB Base64`);
  }

  // Now patch index.html
  let html = fs.readFileSync('index.html', 'utf8');
  const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
  if (!scriptMatch) { console.error('No script tag found!'); process.exit(1); }
  let script = scriptMatch[1];

  // ============================================================
  // STEP 1: Replace the entire sprite system (lines 213-339)
  // Find the old sprite block and replace it
  // ============================================================

  // Find start marker
  const spriteStart = script.indexOf('// ============================================================\nconst SPRITE_COLS');
  if (spriteStart === -1) {
    console.error('Could not find sprite system start');
    process.exit(1);
  }

  // Find end marker (the COSMETIC SKINS section)
  const spriteEnd = script.indexOf('// ============================================================\n// COSMETIC SKINS');
  if (spriteEnd === -1) {
    console.error('Could not find sprite system end');
    process.exit(1);
  }

  const newSpriteSystem = `// ============================================================
// SPRITE SYSTEM (unified for all characters)
// ============================================================
const SPRITE_COLS = 8, SPRITE_ROWS = 2;
const SPRITE_FRAMES = {
  run: [0,1,2,3,4,5],
  wave: 6, worried: 7,
  slide: 8, crouch: 9, jump: 10, idle: 11,
  dash: 12, hit: 13, idleStand: 14, idleBlink: 15
};
const SPRITE_RUN_FPS = 5;

// Base64 sprite data per character
const SPRITE_B64 = {
  gronk: '${b64Map.gronk}',
  pip: '${b64Map.pip}',
  bruk: '${b64Map.bruk}',
  zara: '${b64Map.zara}',
  rex: '${b64Map.rex}',
  mog: '${b64Map.mog}'
};

// Sprite memory: each character = 16 frames × 128×128 pixels × 4 bytes = ~1MB decoded
// Total with 6 characters: ~6MB — acceptable for modern devices
const charSprites = {};
['gronk','pip','bruk','zara','rex','mog'].forEach(function(id) {
  charSprites[id] = { ready: false, loading: false, frames: null, fw: 0, fh: 0 };
});

// Backwards compatibility aliases
let gronkSpriteReady = false, gronkSpriteLoading = false;
let gronkSpriteFrames = null, gronkFrameW = 0, gronkFrameH = 0;
let pipSpriteReady = false, pipSpriteLoading = false;
let pipSpriteFrames = null, pipFrameW = 0, pipFrameH = 0;

function initCharSprite(charId) {
  const sp = charSprites[charId];
  if (!sp || sp.loading) return;
  sp.loading = true;
  // Backwards compat
  if (charId === 'gronk') gronkSpriteLoading = true;
  if (charId === 'pip') pipSpriteLoading = true;

  const b64 = SPRITE_B64[charId];
  if (!b64) { console.warn('No sprite data for ' + charId); return; }

  const img = new Image();
  img.onload = function() {
    const fw = Math.floor(img.width / SPRITE_COLS);
    const fh = Math.floor(img.height / SPRITE_ROWS);
    sp.fw = fw; sp.fh = fh;
    // Draw to offscreen canvas for background removal
    var tmp = document.createElement('canvas');
    tmp.width = img.width; tmp.height = img.height;
    var tc = tmp.getContext('2d');
    tc.drawImage(img, 0, 0);
    var idata = tc.getImageData(0, 0, tmp.width, tmp.height);
    var d = idata.data;
    // Sample background color from top-left corner pixel
    var bgR = d[0], bgG = d[1], bgB = d[2];
    var tol = 35;
    for (var i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i]-bgR) < tol && Math.abs(d[i+1]-bgG) < tol && Math.abs(d[i+2]-bgB) < tol) {
        d[i+3] = 0;
      }
    }
    tc.putImageData(idata, 0, 0);
    // Slice into individual frame canvases
    sp.frames = [];
    for (var r = 0; r < SPRITE_ROWS; r++) {
      for (var c = 0; c < SPRITE_COLS; c++) {
        var fc = document.createElement('canvas');
        fc.width = fw; fc.height = fh;
        var fctx = fc.getContext('2d');
        fctx.drawImage(tmp, c*fw, r*fh, fw, fh, 0, 0, fw, fh);
        sp.frames.push(fc);
      }
    }
    sp.ready = true;
    // Backwards compat
    if (charId === 'gronk') { gronkSpriteReady = true; gronkSpriteFrames = sp.frames; gronkFrameW = fw; gronkFrameH = fh; }
    if (charId === 'pip') { pipSpriteReady = true; pipSpriteFrames = sp.frames; pipFrameW = fw; pipFrameH = fh; }
    console.log('Sprite loaded: ' + charId + ' (' + fw + 'x' + fh + ' per frame)');
    // Clean up
    tmp = null; tc = null; idata = null; d = null;
  };
  img.onerror = function() { console.warn('Sprite load failed for ' + charId + ', using procedural fallback'); };
  img.src = b64;
}

// Convenience wrappers for backward compat
function initGronkSprite() { initCharSprite('gronk'); }
function initPipSprite() { initCharSprite('pip'); }

function getSpriteFrame(p, mini) {
  if (mini) return SPRITE_FRAMES.idleStand;
  if (p.hpFlash > 0 && Math.sin(p.hpFlash * 30) > 0) return SPRITE_FRAMES.hit;
  if (p.dashTimer > 0) return SPRITE_FRAMES.dash;
  if (p.slideTimer > 0) return SPRITE_FRAMES.slide;
  if (p.pounding) return SPRITE_FRAMES.crouch;
  if (!p.onGround && p.vy < 0) return SPRITE_FRAMES.jump;
  if (!p.onGround && p.vy >= 0) return SPRITE_FRAMES.crouch;
  var runFrames = SPRITE_FRAMES.run;
  var idx = Math.floor(p.legAnim * SPRITE_RUN_FPS / (2 * Math.PI) * runFrames.length) % runFrames.length;
  return runFrames[Math.abs(idx) % runFrames.length];
}
`;

  script = script.substring(0, spriteStart) + newSpriteSystem + script.substring(spriteEnd);

  // ============================================================
  // STEP 2: Update drawChar to use charSprites for ALL characters
  // ============================================================

  // Replace the sprite rendering check in drawChar
  const oldSprCheck = `const _sprReady = (ch.id === 'gronk' && gronkSpriteReady && gronkSpriteFrames) || (ch.id === 'pip' && pipSpriteReady && pipSpriteFrames);
  if (_sprReady) {
    const _sprFrames = ch.id === 'gronk' ? gronkSpriteFrames : pipSpriteFrames;
    const _sprFW = ch.id === 'gronk' ? gronkFrameW : pipFrameW;
    const _sprFH = ch.id === 'gronk' ? gronkFrameH : pipFrameH;`;

  const newSprCheck = `const _charSpr = charSprites[ch.id];
  const _sprReady = _charSpr && _charSpr.ready && _charSpr.frames;
  if (_sprReady) {
    const _sprFrames = _charSpr.frames;
    const _sprFW = _charSpr.fw;
    const _sprFH = _charSpr.fh;`;

  if (script.includes(oldSprCheck)) {
    script = script.replace(oldSprCheck, newSprCheck);
    console.log('✓ Updated drawChar sprite rendering');
  } else {
    console.error('✗ Could not find drawChar sprite check to replace');
    // Try a more flexible match
    const altOld = `const _sprReady = (ch.id === 'gronk' && gronkSpriteReady && gronkSpriteFrames) || (ch.id === 'pip' && pipSpriteReady && pipSpriteFrames)`;
    if (script.includes(altOld)) {
      console.log('  Found partial match, attempting flexible replacement...');
    }
  }

  // ============================================================
  // STEP 3: Update LOADING screen to load selected char sprite
  // ============================================================

  // Replace the sprite loading initiation in LOADING phase
  const oldLoadInit = `const _sel = safeSelectedChar();
        if (_sel === 0 && !gronkSpriteLoading) initGronkSprite();
        else if (_sel === 1 && !pipSpriteLoading) initPipSprite();
        else if (!gronkSpriteLoading) initGronkSprite();`;

  const newLoadInit = `const _sel = safeSelectedChar();
        const _selId = CHARS[_sel] ? CHARS[_sel].id : 'gronk';
        if (!charSprites[_selId].loading) initCharSprite(_selId);
        // Also start loading other characters in background
        CHARS.forEach(function(ch) { if (!charSprites[ch.id].loading) initCharSprite(ch.id); });`;

  if (script.includes(oldLoadInit)) {
    script = script.replace(oldLoadInit, newLoadInit);
    console.log('✓ Updated LOADING sprite init');
  } else {
    console.error('✗ Could not find LOADING sprite init');
  }

  // Replace the loading ready check
  const oldReadyCheck = `if (lt >= 1.5 && ((gronkSpriteReady && pipSpriteReady) || lt >= 5)) {`;
  const newReadyCheck = `if (lt >= 1.5 && (charSprites[CHARS[safeSelectedChar()] ? CHARS[safeSelectedChar()].id : 'gronk'].ready || lt >= 5)) {`;

  if (script.includes(oldReadyCheck)) {
    script = script.replace(oldReadyCheck, newReadyCheck);
    console.log('✓ Updated loading ready check');
  } else {
    console.error('✗ Could not find loading ready check');
  }

  // Replace the selected char ready check
  const oldSelReady = `const _selReady = (safeSelectedChar()===0 ? gronkSpriteReady : safeSelectedChar()===1 ? pipSpriteReady : gronkSpriteReady);`;
  const newSelReady = `const _selCharId = CHARS[safeSelectedChar()] ? CHARS[safeSelectedChar()].id : 'gronk';
      const _selReady = charSprites[_selCharId].ready;`;

  if (script.includes(oldSelReady)) {
    script = script.replace(oldSelReady, newSelReady);
    console.log('✓ Updated selected char ready check');
  } else {
    console.error('✗ Could not find selected char ready check');
  }

  // ============================================================
  // STEP 4: Update lazy loading in other phases (MENU, CHAR_SELECT, etc.)
  // ============================================================

  // Find and replace any remaining initGronkSprite/initPipSprite calls in MENU/CHAR_SELECT
  // These are the lazy-load triggers
  const oldMenuLoad1 = `if (!gronkSpriteLoading) initGronkSprite();`;
  const oldMenuLoad2 = `if (!pipSpriteLoading) initPipSprite();`;

  // Replace all remaining lazy-load calls with generic versions
  // Count occurrences first
  let count1 = (script.match(/if \(!gronkSpriteLoading\) initGronkSprite\(\);/g) || []).length;
  let count2 = (script.match(/if \(!pipSpriteLoading\) initPipSprite\(\);/g) || []).length;
  console.log(`Found ${count1} gronk lazy-load calls, ${count2} pip lazy-load calls`);

  // Replace them with loading all sprites
  script = script.replace(/if \(!gronkSpriteLoading\) initGronkSprite\(\);\n\s*if \(!pipSpriteLoading\) initPipSprite\(\);/g,
    `CHARS.forEach(function(ch) { if (!charSprites[ch.id].loading) initCharSprite(ch.id); });`);
  console.log('✓ Replaced paired lazy-load calls');

  // Any remaining solo calls
  script = script.replace(/if \(!gronkSpriteLoading\) initGronkSprite\(\);/g,
    `CHARS.forEach(function(ch) { if (!charSprites[ch.id].loading) initCharSprite(ch.id); });`);
  script = script.replace(/if \(!pipSpriteLoading\) initPipSprite\(\);/g, '');

  // ============================================================
  // STEP 5: Update debug display
  // ============================================================
  const oldDebugSprites = /Sprites: G=\$\{gronkSpriteReady\} P=\$\{pipSpriteReady\}/;
  const newDebugSprites = `Sprites: ${['gronk','pip','bruk','zara','rex','mog'].map(function(id){return id[0].toUpperCase()+'='+`\${charSprites['${id}'].ready}`;}).join(' ')}`;

  // Actually, do this with a simpler approach
  if (script.includes('Sprites: G=${gronkSpriteReady} P=${pipSpriteReady}')) {
    script = script.replace(
      'Sprites: G=${gronkSpriteReady} P=${pipSpriteReady}',
      "Sprites: ${Object.keys(charSprites).map(function(k){return k[0].toUpperCase()+'='+charSprites[k].ready;}).join(' ')}"
    );
    console.log('✓ Updated debug display');
  }

  // ============================================================
  // STEP 6: Update sprite memory comment
  // ============================================================
  if (script.includes('Total with 2 characters')) {
    script = script.replace('Total with 2 characters: ~2MB', 'Total with 6 characters: ~6MB');
    console.log('✓ Updated memory comment');
  }

  // ============================================================
  // Write back
  // ============================================================
  html = html.replace(scriptMatch[1], script);
  fs.writeFileSync('index.html', html, 'utf8');
  console.log('\n✓ index.html updated successfully');
  console.log('  File size: ' + (fs.statSync('index.html').size / 1024 / 1024).toFixed(2) + 'MB');

  // Now regenerate gameHtml.js
  console.log('\nRegenerating gameHtml.js...');
}

processSheets().catch(function(err) {
  console.error('Error:', err);
  process.exit(1);
});
