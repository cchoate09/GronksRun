// add_all_sprites.js — Combined script: character + enemy/obstacle sprites
// Handles CRLF line endings properly

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// ============================================================
// CONFIG
// ============================================================

const CHAR_SHEETS = [
  { id: 'gronk', file: 'GronkSpritesheet.png' },
  { id: 'pip',   file: 'PipSpriteSheet.png' },
  { id: 'bruk',  file: 'brukspritesheet.png' },
  { id: 'zara',  file: 'zaraspritesheet.png' },
  { id: 'rex',   file: 'rexspritesheet.png' },
  { id: 'mog',   file: 'MogSpriteSheet.png' },
];
const CHAR_TARGET_W = 1024, CHAR_TARGET_H = 256;

const ENEMY_SHEETS = [
  { id: 'troll',       file: 'enemies/trollspritesheet.png',       cols:8, rows:2, tW:1024, tH:256,
    anims: { idle:[0,1,2,3,4,5,6,7], attack:[8,9,10,11], hit:[14] }, fps:6 },
  { id: 'charger',     file: 'enemies/chargerspritesheet.png',     cols:4, rows:4, tW:512, tH:512,
    anims: { idle:[0,1,2,3], attack:[4,5,6,7], hit:[15] }, fps:8 },
  { id: 'diver',       file: 'enemies/diverspritesheet.png',       cols:8, rows:4, tW:1024, tH:512,
    anims: { idle:[0,1,2,3,4,5,6], attack:[8,9,10,11,12], hit:[13] }, fps:7 },
  { id: 'witch',       file: 'enemies/witchspritesheet.png',       cols:8, rows:2, tW:1024, tH:256,
    anims: { idle:[0,1,2,3,4,5,6,7], attack:[8,9,10,11,12], hit:[14] }, fps:6 },
  { id: 'golem',       file: 'enemies/golemspritesheet.png',       cols:4, rows:3, tW:512, tH:384,
    anims: { idle:[0,1,2,3], attack:[4,5,6,7], hit:[11] }, fps:4 },
  { id: 'bomber',      file: 'enemies/bomberspritesheet.png',      cols:8, rows:2, tW:1024, tH:256,
    anims: { idle:[0,1,2,3,4,5,6], attack:[8,9,10,11], hit:[14] }, fps:7 },
  { id: 'serpent',     file: 'enemies/serpentspritesheet.png',     cols:4, rows:3, tW:512, tH:384,
    anims: { idle:[0,1,2,3], attack:[4,5,6], hit:[7] }, fps:5 },
  { id: 'ptero',       file: 'enemies/pterospritesheet.png',       cols:8, rows:4, tW:1024, tH:512,
    anims: { idle:[0,1,2,3,4,5,6] }, fps:7 },
  { id: 'fire_geyser', file: 'enemies/firegeyserspritesheet.png', cols:8, rows:3, tW:1024, tH:384,
    anims: { idle:[0,1,2,3,4,5,6,7], attack:[16,17,18,19,20,21,22] }, fps:6 },
  { id: 'log',         file: 'enemies/logspritesheet.png',         cols:8, rows:4, tW:1024, tH:512,
    anims: { idle:[0,1,2,3,4,5] }, fps:3 },
  { id: 'spikes',      file: 'enemies/spikesspritesheet.png',     cols:4, rows:3, tW:512, tH:384,
    anims: { idle:[4,5,8,9,10,11] }, fps:4 },
];

async function processImage(filePath, targetW, targetH) {
  const buf = fs.readFileSync(filePath);
  const meta = await sharp(buf).metadata();
  let finalBuf;
  if (meta.width !== targetW || meta.height !== targetH) {
    finalBuf = await sharp(buf)
      .resize(targetW, targetH, { fit: 'fill', kernel: 'lanczos3' })
      .png({ compressionLevel: 9 }).toBuffer();
  } else {
    finalBuf = await sharp(buf).png({ compressionLevel: 9 }).toBuffer();
  }
  return 'data:image/png;base64,' + finalBuf.toString('base64');
}

function findFunction(script, sig) {
  const idx = script.indexOf(sig);
  if (idx === -1) return null;
  let depth = 0, started = false, end = idx;
  for (let i = idx; i < script.length; i++) {
    if (script[i] === '{') { depth++; started = true; }
    if (script[i] === '}') { depth--; if (started && depth === 0) { end = i + 1; break; } }
  }
  return { text: script.substring(idx, end), start: idx, end: end };
}

async function main() {
  // ============================================================
  // STEP 1: Process all sprite images
  // ============================================================
  console.log('=== Processing Character Sprites ===');
  const charB64 = {};
  for (const ch of CHAR_SHEETS) {
    const fp = path.join('./assets/spritesheets', ch.file);
    charB64[ch.id] = await processImage(fp, CHAR_TARGET_W, CHAR_TARGET_H);
    console.log(`  ${ch.id}: ${(charB64[ch.id].length/1024).toFixed(0)}KB`);
  }

  console.log('\n=== Processing Enemy/Obstacle Sprites ===');
  const enemyB64 = {};
  for (const en of ENEMY_SHEETS) {
    const fp = path.join('./assets/spritesheets', en.file);
    enemyB64[en.id] = await processImage(fp, en.tW, en.tH);
    console.log(`  ${en.id}: ${(enemyB64[en.id].length/1024).toFixed(0)}KB`);
  }

  // ============================================================
  // STEP 2: Load and parse index.html
  // ============================================================
  let html = fs.readFileSync('index.html', 'utf8');
  const scriptStart = html.indexOf('<script>') + '<script>'.length;
  const scriptEnd = html.indexOf('</script>');
  let script = html.substring(scriptStart, scriptEnd);

  // Detect line ending
  const nl = script.includes('\r\n') ? '\r\n' : '\n';
  console.log('\nLine ending: ' + (nl === '\r\n' ? 'CRLF' : 'LF'));

  // ============================================================
  // STEP 3: Replace character sprite system
  // ============================================================
  const spriteStartMarker = '// ============================================================' + nl + 'const SPRITE_COLS';
  const spriteEndMarker = '// ============================================================' + nl + '// COSMETIC SKINS';

  const ssIdx = script.indexOf(spriteStartMarker);
  const seIdx = script.indexOf(spriteEndMarker);
  if (ssIdx === -1 || seIdx === -1) {
    console.error('✗ Could not find sprite system boundaries (start:', ssIdx, 'end:', seIdx, ')');
    process.exit(1);
  }

  // Build character sprite B64 entries
  const charB64Entries = Object.keys(charB64).map(id => `  ${id}: '${charB64[id]}'`).join(',' + nl);

  const newCharSpriteSystem = [
    '// ============================================================',
    '// SPRITE SYSTEM (unified for all characters)',
    '// ============================================================',
    'const SPRITE_COLS = 8, SPRITE_ROWS = 2;',
    'const SPRITE_FRAMES = {',
    '  run: [0,1,2,3,4,5],',
    '  wave: 6, worried: 7,',
    '  slide: 8, crouch: 9, jump: 10, idle: 11,',
    '  dash: 12, hit: 13, idleStand: 14, idleBlink: 15',
    '};',
    'const SPRITE_RUN_FPS = 5;',
    '',
    'var SPRITE_B64 = {',
    charB64Entries,
    '};',
    '',
    '// Sprite memory: each character = 16 frames × 128×128 pixels × 4 bytes = ~1MB decoded',
    '// Total with 6 characters: ~6MB — acceptable for modern devices',
    'var charSprites = {};',
    "['gronk','pip','bruk','zara','rex','mog'].forEach(function(id) {",
    '  charSprites[id] = { ready: false, loading: false, frames: null, fw: 0, fh: 0 };',
    '});',
    '',
    '// Backwards compatibility aliases',
    'var gronkSpriteReady = false, gronkSpriteLoading = false;',
    'var gronkSpriteFrames = null, gronkFrameW = 0, gronkFrameH = 0;',
    'var pipSpriteReady = false, pipSpriteLoading = false;',
    'var pipSpriteFrames = null, pipFrameW = 0, pipFrameH = 0;',
    '',
    'function initCharSprite(charId) {',
    '  var sp = charSprites[charId];',
    '  if (!sp || sp.loading) return;',
    '  sp.loading = true;',
    "  if (charId === 'gronk') gronkSpriteLoading = true;",
    "  if (charId === 'pip') pipSpriteLoading = true;",
    '  var b64 = SPRITE_B64[charId];',
    "  if (!b64) { console.warn('No sprite data for ' + charId); return; }",
    '  var img = new Image();',
    '  img.onload = function() {',
    '    var fw = Math.floor(img.width / SPRITE_COLS);',
    '    var fh = Math.floor(img.height / SPRITE_ROWS);',
    '    sp.fw = fw; sp.fh = fh;',
    "    var tmp = document.createElement('canvas');",
    '    tmp.width = img.width; tmp.height = img.height;',
    "    var tc = tmp.getContext('2d');",
    '    tc.drawImage(img, 0, 0);',
    '    var idata = tc.getImageData(0, 0, tmp.width, tmp.height);',
    '    var d = idata.data;',
    '    var bgR = d[0], bgG = d[1], bgB = d[2];',
    '    var tol = 35;',
    '    for (var i = 0; i < d.length; i += 4) {',
    '      if (Math.abs(d[i]-bgR) < tol && Math.abs(d[i+1]-bgG) < tol && Math.abs(d[i+2]-bgB) < tol) {',
    '        d[i+3] = 0;',
    '      }',
    '    }',
    '    tc.putImageData(idata, 0, 0);',
    '    sp.frames = [];',
    '    for (var r = 0; r < SPRITE_ROWS; r++) {',
    '      for (var c = 0; c < SPRITE_COLS; c++) {',
    "        var fc = document.createElement('canvas');",
    '        fc.width = fw; fc.height = fh;',
    "        var fctx = fc.getContext('2d');",
    '        fctx.drawImage(tmp, c*fw, r*fh, fw, fh, 0, 0, fw, fh);',
    '        sp.frames.push(fc);',
    '      }',
    '    }',
    '    sp.ready = true;',
    "    if (charId === 'gronk') { gronkSpriteReady = true; gronkSpriteFrames = sp.frames; gronkFrameW = fw; gronkFrameH = fh; }",
    "    if (charId === 'pip') { pipSpriteReady = true; pipSpriteFrames = sp.frames; pipFrameW = fw; pipFrameH = fh; }",
    '    tmp = null; tc = null; idata = null;',
    '  };',
    "  img.onerror = function() { console.warn('Sprite load failed for ' + charId); };",
    '  img.src = b64;',
    '}',
    '',
    "function initGronkSprite() { initCharSprite('gronk'); }",
    "function initPipSprite() { initCharSprite('pip'); }",
    '',
    'function getSpriteFrame(p, mini) {',
    '  if (mini) return SPRITE_FRAMES.idleStand;',
    '  if (p.hpFlash > 0 && Math.sin(p.hpFlash * 30) > 0) return SPRITE_FRAMES.hit;',
    '  if (p.dashTimer > 0) return SPRITE_FRAMES.dash;',
    '  if (p.slideTimer > 0) return SPRITE_FRAMES.slide;',
    '  if (p.pounding) return SPRITE_FRAMES.crouch;',
    '  if (!p.onGround && p.vy < 0) return SPRITE_FRAMES.jump;',
    '  if (!p.onGround && p.vy >= 0) return SPRITE_FRAMES.crouch;',
    '  var runFrames = SPRITE_FRAMES.run;',
    '  var idx = Math.floor(p.legAnim * SPRITE_RUN_FPS / (2 * Math.PI) * runFrames.length) % runFrames.length;',
    '  return runFrames[Math.abs(idx) % runFrames.length];',
    '}',
    '',
  ].join(nl);

  script = script.substring(0, ssIdx) + newCharSpriteSystem + script.substring(seIdx);
  console.log('✓ Replaced character sprite system');

  // ============================================================
  // STEP 4: Update drawChar to use charSprites
  // ============================================================
  const oldSprCheck = "const _sprReady = (ch.id === 'gronk' && gronkSpriteReady && gronkSpriteFrames) || (ch.id === 'pip' && pipSpriteReady && pipSpriteFrames);";
  if (script.includes(oldSprCheck)) {
    // Replace the 4 lines of old sprite lookup
    const oldBlock = oldSprCheck + nl +
      "  if (_sprReady) {" + nl +
      "    const _sprFrames = ch.id === 'gronk' ? gronkSpriteFrames : pipSpriteFrames;" + nl +
      "    const _sprFW = ch.id === 'gronk' ? gronkFrameW : pipFrameW;" + nl +
      "    const _sprFH = ch.id === 'gronk' ? gronkFrameH : pipFrameH;";
    const newBlock = "const _charSpr = charSprites[ch.id];" + nl +
      "  const _sprReady = _charSpr && _charSpr.ready && _charSpr.frames;" + nl +
      "  if (_sprReady) {" + nl +
      "    const _sprFrames = _charSpr.frames;" + nl +
      "    const _sprFW = _charSpr.fw;" + nl +
      "    const _sprFH = _charSpr.fh;";
    script = script.replace(oldBlock, newBlock);
    console.log('✓ Updated drawChar sprite rendering');
  } else {
    console.log('⚠ drawChar sprite check not found (may already be updated)');
  }

  // ============================================================
  // STEP 5: Update LOADING phase sprite init
  // ============================================================
  // Find the old loading init code
  const oldLoadPatterns = [
    // Pattern 1: original code
    "const _sel = safeSelectedChar();" + nl +
    "        if (_sel === 0 && !gronkSpriteLoading) initGronkSprite();" + nl +
    "        else if (_sel === 1 && !pipSpriteLoading) initPipSprite();" + nl +
    "        else if (!gronkSpriteLoading) initGronkSprite();",
  ];

  let loadReplaced = false;
  for (const pat of oldLoadPatterns) {
    if (script.includes(pat)) {
      script = script.replace(pat,
        "const _sel = safeSelectedChar();" + nl +
        "        const _selId = CHARS[_sel] ? CHARS[_sel].id : 'gronk';" + nl +
        "        if (!charSprites[_selId].loading) initCharSprite(_selId);" + nl +
        "        CHARS.forEach(function(ch) { if (!charSprites[ch.id].loading) initCharSprite(ch.id); });" + nl +
        "        if (!_enemySpritesLoading) initEnemySprites();");
      loadReplaced = true;
      console.log('✓ Updated LOADING sprite init + enemy sprites trigger');
      break;
    }
  }
  if (!loadReplaced) console.log('⚠ LOADING sprite init not found');

  // Update loading ready check
  const oldReady = "if (lt >= 1.5 && ((gronkSpriteReady && pipSpriteReady) || lt >= 5)) {";
  if (script.includes(oldReady)) {
    script = script.replace(oldReady,
      "if (lt >= 1.5 && (charSprites[CHARS[safeSelectedChar()] ? CHARS[safeSelectedChar()].id : 'gronk'].ready || lt >= 5)) {");
    console.log('✓ Updated loading ready check');
  }

  // Update selected char ready check
  const oldSelReady = "const _selReady = (safeSelectedChar()===0 ? gronkSpriteReady : safeSelectedChar()===1 ? pipSpriteReady : gronkSpriteReady);";
  if (script.includes(oldSelReady)) {
    script = script.replace(oldSelReady,
      "const _selCharId = CHARS[safeSelectedChar()] ? CHARS[safeSelectedChar()].id : 'gronk';" + nl +
      "      const _selReady = charSprites[_selCharId].ready;");
    console.log('✓ Updated selected char ready check');
  }

  // Replace lazy-load calls in other phases
  const oldLazy1 = "if (!gronkSpriteLoading) initGronkSprite();" + nl + "      if (!pipSpriteLoading) initPipSprite();";
  while (script.includes(oldLazy1)) {
    script = script.replace(oldLazy1,
      "CHARS.forEach(function(ch) { if (!charSprites[ch.id].loading) initCharSprite(ch.id); });");
  }
  // Single remaining lazy loads
  const pats = [
    /if \(!gronkSpriteLoading\) initGronkSprite\(\);/g,
    /if \(!pipSpriteLoading\) initPipSprite\(\);/g,
  ];
  pats.forEach(p => {
    script = script.replace(p, "CHARS.forEach(function(ch) { if (!charSprites[ch.id].loading) initCharSprite(ch.id); });");
  });
  console.log('✓ Updated lazy-load calls');

  // Update debug display
  const oldDebug = 'Sprites: G=${gronkSpriteReady} P=${pipSpriteReady}';
  if (script.includes(oldDebug)) {
    script = script.replace(oldDebug,
      "Sprites: ${Object.keys(charSprites).map(function(k){return k[0].toUpperCase()+'='+charSprites[k].ready;}).join(' ')}");
    console.log('✓ Updated debug display');
  }

  // ============================================================
  // STEP 6: Insert enemy sprite system
  // ============================================================
  const enemyB64Entries = Object.keys(enemyB64).map(id => `  ${id}: '${enemyB64[id]}'`).join(',' + nl);
  const enemyDefEntries = ENEMY_SHEETS.map(s =>
    `  ${s.id}: { cols:${s.cols}, rows:${s.rows}, fps:${s.fps}, anims:${JSON.stringify(s.anims)} }`
  ).join(',' + nl);

  const enemySpriteSystem = [
    '',
    '// ============================================================',
    '// ENEMY & OBSTACLE SPRITE SYSTEM',
    '// ============================================================',
    'var ENEMY_SPRITE_B64 = {',
    enemyB64Entries,
    '};',
    '',
    'var ENEMY_SPRITE_DEFS = {',
    enemyDefEntries,
    '};',
    '',
    'var enemySprites = {};',
    'var _enemySpritesLoading = false;',
    'var _enemySpritesReady = false;',
    '',
    'function initEnemySprites() {',
    '  if (_enemySpritesLoading) return;',
    '  _enemySpritesLoading = true;',
    '  var ids = Object.keys(ENEMY_SPRITE_B64);',
    '  var loaded = 0;',
    '  var total = ids.length;',
    '  ids.forEach(function(id) {',
    '    var def = ENEMY_SPRITE_DEFS[id];',
    '    if (!def) { loaded++; return; }',
    '    var sp = { ready: false, frames: null, fw: 0, fh: 0 };',
    '    enemySprites[id] = sp;',
    '    var img = new Image();',
    '    img.onload = function() {',
    '      var fw = Math.floor(img.width / def.cols);',
    '      var fh = Math.floor(img.height / def.rows);',
    '      sp.fw = fw; sp.fh = fh;',
    "      var tmp = document.createElement('canvas');",
    '      tmp.width = img.width; tmp.height = img.height;',
    "      var tc = tmp.getContext('2d');",
    '      tc.drawImage(img, 0, 0);',
    '      var idata = tc.getImageData(0, 0, tmp.width, tmp.height);',
    '      var d = idata.data;',
    '      var bgR = d[0], bgG = d[1], bgB = d[2];',
    '      var tol = 38;',
    '      for (var i = 0; i < d.length; i += 4) {',
    '        if (Math.abs(d[i]-bgR) < tol && Math.abs(d[i+1]-bgG) < tol && Math.abs(d[i+2]-bgB) < tol) {',
    '          d[i+3] = 0;',
    '        }',
    '      }',
    '      tc.putImageData(idata, 0, 0);',
    '      sp.frames = [];',
    '      for (var r = 0; r < def.rows; r++) {',
    '        for (var c = 0; c < def.cols; c++) {',
    "          var fc = document.createElement('canvas');",
    '          fc.width = fw; fc.height = fh;',
    "          var fctx = fc.getContext('2d');",
    '          fctx.drawImage(tmp, c*fw, r*fh, fw, fh, 0, 0, fw, fh);',
    '          sp.frames.push(fc);',
    '        }',
    '      }',
    '      sp.ready = true;',
    '      loaded++;',
    "      if (loaded >= total) { _enemySpritesReady = true; console.log('All enemy sprites loaded'); }",
    '      tmp = null; tc = null; idata = null;',
    '    };',
    "    img.onerror = function() { console.warn('Enemy sprite failed: ' + id); loaded++; if (loaded >= total) _enemySpritesReady = true; };",
    '    img.src = ENEMY_SPRITE_B64[id];',
    '  });',
    '}',
    '',
    'function getEnemyFrame(id, animState, time) {',
    '  var sp = enemySprites[id];',
    '  var def = ENEMY_SPRITE_DEFS[id];',
    '  if (!sp || !sp.ready || !sp.frames || !def) return null;',
    '  var anim = def.anims[animState] || def.anims.idle;',
    '  if (!anim || anim.length === 0) return null;',
    '  var fps = def.fps || 5;',
    '  var frameIdx = Math.floor(time * fps) % anim.length;',
    '  var globalIdx = anim[Math.abs(frameIdx)];',
    '  if (globalIdx >= sp.frames.length) globalIdx = anim[0];',
    '  return { canvas: sp.frames[globalIdx], fw: sp.fw, fh: sp.fh };',
    '}',
    '',
    'function drawEnemySpriteFrame(id, animState, time, drawW, drawH, flipX) {',
    '  var frame = getEnemyFrame(id, animState, time);',
    '  if (!frame) return false;',
    '  ctx.save();',
    '  if (flipX) ctx.scale(-1, 1);',
    '  ctx.drawImage(frame.canvas, -drawW/2, -drawH, drawW, drawH);',
    '  ctx.restore();',
    '  return true;',
    '}',
    '',
  ].join(nl);

  // Insert before CHARACTER RENDERING section
  const charRenderMarker = '// ============================================================' + nl + '// CHARACTER RENDERING';
  const crIdx = script.indexOf(charRenderMarker);
  if (crIdx === -1) {
    console.error('✗ Could not find CHARACTER RENDERING marker');
    process.exit(1);
  }
  script = script.substring(0, crIdx) + enemySpriteSystem + script.substring(crIdx);
  console.log('✓ Inserted enemy sprite system');

  // ============================================================
  // STEP 7: Replace drawEnemies with sprite-aware version
  // ============================================================
  const oldDE = findFunction(script, 'function drawEnemies()');
  if (!oldDE) { console.error('✗ drawEnemies not found'); process.exit(1); }

  const newDrawEnemies = [
'function drawEnemies(){',
'  for(var _ei=0;_ei<activeEnemies.length;_ei++){',
'    var en=activeEnemies[_ei];',
'    if(!en.alive)continue;',
'    var sx=en.sx, sy=en.sy, u=UNIT;',
'    ctx.save();',
'    var _enAnimState = "idle";',
'    if (en.telegraphing || (en.fireCD !== undefined && en.fireCD <= 0.3)) _enAnimState = "attack";',
'    if (en.hpFlash > 0) _enAnimState = "hit";',
'    switch(en.type){',
'      case "TROLL":{',
'        ctx.translate(sx,sy);',
'        var _sp=enemySprites.troll;',
'        if(_sp&&_sp.ready){',
'          var _dH=u*3.2,_dW=_dH*(_sp.fw/_sp.fh);',
'          drawEnemySpriteFrame("troll",_enAnimState,en.phase,_dW,_dH,false);',
'        }else{',
'          ctx.fillStyle="#3a7a3a";ctx.beginPath();ctx.ellipse(0,-u*1.3,u*1.1,u*1.4,0,0,PI2);ctx.fill();',
'          ctx.fillStyle="#5a9a5a";ctx.beginPath();ctx.ellipse(0,-u*1,u*.6,u*.7,0,0,PI2);ctx.fill();',
'          ctx.fillStyle="#ff0";ctx.beginPath();ctx.ellipse(-u*.35,-u*1.9,u*.22,u*.18,-.3,0,PI2);ctx.fill();',
'          ctx.beginPath();ctx.ellipse(u*.35,-u*1.9,u*.22,u*.18,.3,0,PI2);ctx.fill();',
'          ctx.fillStyle="#200";ctx.beginPath();ctx.arc(-u*.3,-u*1.88,u*.1,0,PI2);ctx.arc(u*.4,-u*1.88,u*.1,0,PI2);ctx.fill();',
'          ctx.fillStyle="#ffe";ctx.beginPath();ctx.moveTo(-u*.5,-u*.9);ctx.lineTo(-u*.35,-u*.5);ctx.lineTo(-u*.2,-u*.9);ctx.fill();',
'          ctx.beginPath();ctx.moveTo(u*.5,-u*.9);ctx.lineTo(u*.35,-u*.5);ctx.lineTo(u*.2,-u*.9);ctx.fill();',
'          ctx.strokeStyle="#2a4a2a";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-u*.55,-u*2.1);ctx.lineTo(-u*.25,-u*2);ctx.stroke();',
'          ctx.beginPath();ctx.moveTo(u*.55,-u*2.1);ctx.lineTo(u*.25,-u*2);ctx.stroke();',
'        }',
'        break;',
'      }',
'      case "CHARGER":{',
'        if(en.state==="WARN"){',
'          var blink=Math.sin(G.time*12)>.2;',
'          if(blink){',
'            ctx.fillStyle="#FF4444";ctx.font="bold "+Math.round(u*2)+"px monospace";',
'            ctx.textAlign="center";ctx.textBaseline="middle";',
'            ctx.fillText("!",W-u*2,GROUND_BASE-u*3);',
'          }',
'          break;',
'        }',
'        ctx.translate(en.screenX,en.y);',
'        var _sp=enemySprites.charger;',
'        if(_sp&&_sp.ready){',
'          var _anim=en.state==="CHARGE"?"idle":_enAnimState;',
'          var _dH=u*2.8,_dW=_dH*(_sp.fw/_sp.fh);',
'          drawEnemySpriteFrame("charger",_anim,en.phase,_dW,_dH,true);',
'        }else{',
'          ctx.fillStyle="#CC8833";ctx.beginPath();ctx.ellipse(0,-u*.9,u*1.3,u*.85,0,0,PI2);ctx.fill();',
'          ctx.fillStyle="#BB7722";ctx.beginPath();ctx.ellipse(-u*1,-u*1.1,u*.55,u*.5,-.2,0,PI2);ctx.fill();',
'          ctx.fillStyle="#fff";ctx.beginPath();ctx.moveTo(-u*1.3,-u*.8);ctx.lineTo(-u*1.2,-u*.35);ctx.lineTo(-u*1.1,-u*.8);ctx.fill();',
'          ctx.beginPath();ctx.moveTo(-u*1.0,-u*.75);ctx.lineTo(-u*.9,-u*.3);ctx.lineTo(-u*.8,-u*.75);ctx.fill();',
'          ctx.fillStyle="#f00";ctx.beginPath();ctx.arc(-u*1.1,-u*1.2,u*.12,0,PI2);ctx.fill();',
'          var lAnim=Math.sin(G.time*14)*.3;',
'          ctx.fillStyle="#AA6622";',
'          for(var i=-1;i<=1;i+=2){ctx.save();ctx.translate(i*u*.5,-u*.08);ctx.rotate(i*lAnim);ctx.fillRect(-u*.12,0,u*.24,u*.55);ctx.restore();}',
'          ctx.strokeStyle="#CC8833";ctx.lineWidth=u*.15;ctx.lineCap="round";',
'          ctx.beginPath();ctx.moveTo(u*1.1,-u*.9);ctx.quadraticCurveTo(u*1.6,-u*1.8,u*1.3,-u*1.5);ctx.stroke();',
'        }',
'        break;',
'      }',
'      case "DIVER":{',
'        ctx.translate(en.screenX,en.y);',
'        var _sp=enemySprites.diver;',
'        if(_sp&&_sp.ready){',
'          var _dH=u*2.6,_dW=_dH*(_sp.fw/_sp.fh);',
'          drawEnemySpriteFrame("diver",_enAnimState,en.phase,_dW,_dH,true);',
'        }else{',
'          var wf=Math.sin(G.time*5)*.6;',
'          ctx.fillStyle="#6a3a20";ctx.beginPath();ctx.ellipse(0,0,u*.7,u*.45,0,0,PI2);ctx.fill();',
'          ctx.fillStyle="#8a5a30";',
'          for(var s=-1;s<=1;s+=2){ctx.beginPath();ctx.moveTo(s*u*.4,0);ctx.bezierCurveTo(s*u*1.8,-u*wf,s*u*2.4,u*(.4-wf),s*u*2.2,u*.6);ctx.bezierCurveTo(s*u*1.2,u*.35,s*u*.6,u*.18,s*u*.4,0);ctx.fill();}',
'          ctx.fillStyle="#5a2a10";ctx.beginPath();ctx.ellipse(-u*.8,u*-.15,u*.4,u*.3,.3,0,PI2);ctx.fill();',
'          ctx.fillStyle="#cc8800";ctx.beginPath();ctx.moveTo(-u*1,-u*.15);ctx.lineTo(-u*1.6,0);ctx.lineTo(-u*1,-u*.05);ctx.fill();',
'          ctx.fillStyle="#ff0";ctx.beginPath();ctx.arc(-u*.75,-u*.25,u*.08,0,PI2);ctx.fill();',
'        }',
'        break;',
'      }',
'      case "WITCH":{',
'        ctx.translate(sx,sy);',
'        var _sp=enemySprites.witch;',
'        if(_sp&&_sp.ready){',
'          var _dH=u*3.0,_dW=_dH*(_sp.fw/_sp.fh);',
'          drawEnemySpriteFrame("witch",_enAnimState,en.phase,_dW,_dH,false);',
'        }else{',
'          ctx.fillStyle="#2a0a3a";ctx.beginPath();ctx.moveTo(-u*.5,0);ctx.lineTo(-u*.7,u*.5);ctx.lineTo(u*.7,u*.5);ctx.lineTo(u*.5,0);ctx.lineTo(u*.3,-u*1.2);ctx.lineTo(-u*.3,-u*1.2);ctx.closePath();ctx.fill();',
'          ctx.fillStyle="#3a1a4a";ctx.beginPath();ctx.moveTo(-u*.5,-u*1.2);ctx.lineTo(u*.5,-u*1.2);ctx.lineTo(0,-u*2.5);ctx.closePath();ctx.fill();',
'          ctx.shadowColor="#aa00ff";ctx.shadowBlur=10;ctx.fillStyle="#cc44ff";ctx.beginPath();ctx.arc(-u*.18,-u*.9,u*.1,0,PI2);ctx.arc(u*.18,-u*.9,u*.1,0,PI2);ctx.fill();ctx.shadowBlur=0;',
'          ctx.strokeStyle="#6a4a2a";ctx.lineWidth=u*.1;ctx.beginPath();ctx.moveTo(u*.6,-u*.5);ctx.lineTo(u*.8,u*.5);ctx.stroke();',
'          ctx.fillStyle="#aa00ff";ctx.shadowColor="#aa00ff";ctx.shadowBlur=8;ctx.beginPath();ctx.arc(u*.55,-u*.6,u*.18,0,PI2);ctx.fill();ctx.shadowBlur=0;',
'        }',
'        break;',
'      }',
'      case "GOLEM":{',
'        ctx.translate(sx,sy);',
'        var _sp=enemySprites.golem;',
'        if(_sp&&_sp.ready){',
'          var _dH=u*4.0,_dW=_dH*(_sp.fw/_sp.fh);',
'          drawEnemySpriteFrame("golem",_enAnimState,en.phase,_dW,_dH,false);',
'        }else{',
'          ctx.fillStyle="#5a5a5a";ctx.beginPath();ctx.ellipse(0,-u*1.6,u*1.3,u*1.7,0,0,PI2);ctx.fill();',
'          ctx.strokeStyle="#3a3a3a";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-u*.4,-u*2.5);ctx.lineTo(-u*.1,-u*1.8);ctx.lineTo(-u*.3,-u*1);ctx.stroke();',
'          ctx.beginPath();ctx.moveTo(u*.3,-u*2.3);ctx.lineTo(u*.5,-u*1.5);ctx.stroke();',
'          ctx.shadowColor="#ff4400";ctx.shadowBlur=12;ctx.fillStyle="#ff6600";ctx.beginPath();ctx.arc(-u*.35,-u*2.2,u*.15,0,PI2);ctx.arc(u*.35,-u*2.2,u*.15,0,PI2);ctx.fill();ctx.shadowBlur=0;',
'          ctx.fillStyle="#4a4a4a";ctx.beginPath();ctx.ellipse(-u*1.3,-u*1.5,u*.5,u*.3,-.4,0,PI2);ctx.fill();ctx.beginPath();ctx.ellipse(u*1.3,-u*1.5,u*.5,u*.3,.4,0,PI2);ctx.fill();',
'          ctx.fillRect(-u*.8,-u*.15,u*.5,u*.5);ctx.fillRect(u*.3,-u*.15,u*.5,u*.5);',
'          ctx.strokeStyle="#ff4400";ctx.lineWidth=u*.08;ctx.beginPath();ctx.moveTo(-u*.3,-u*1.7);ctx.lineTo(-u*.1,-u*1.5);ctx.lineTo(u*.1,-u*1.7);ctx.lineTo(u*.3,-u*1.5);ctx.stroke();',
'        }',
'        break;',
'      }',
'      case "BOMBER":{',
'        ctx.translate(en.screenX,en.y);',
'        var _sp=enemySprites.bomber;',
'        if(_sp&&_sp.ready){',
'          var _dH=u*2.6,_dW=_dH*(_sp.fw/_sp.fh);',
'          drawEnemySpriteFrame("bomber",_enAnimState,en.phase,_dW,_dH,true);',
'        }else{',
'          ctx.fillStyle="#8a4a2a";ctx.beginPath();ctx.ellipse(0,0,u*.9,u*.5,0,0,PI2);ctx.fill();',
'          var wf2=Math.sin(G.time*7)*.4;ctx.fillStyle="#aa6a3a";',
'          for(var s=-1;s<=1;s+=2){ctx.beginPath();ctx.moveTo(s*u*.5,0);ctx.bezierCurveTo(s*u*1.5,-u*wf2,s*u*2,-u*(.3+wf2),s*u*1.8,u*.3);ctx.bezierCurveTo(s*u*1,u*.2,s*u*.6,u*.1,s*u*.5,0);ctx.fill();}',
'          ctx.fillStyle="#cc3300";ctx.beginPath();ctx.ellipse(0,u*.25,u*.3,u*.15,0,0,PI2);ctx.fill();',
'          ctx.fillStyle="#ff0";ctx.beginPath();ctx.arc(-u*.5,-u*.1,u*.1,0,PI2);ctx.fill();',
'          ctx.fillStyle="#6a3a1a";ctx.beginPath();ctx.moveTo(u*.7,0);ctx.lineTo(u*1.4,-u*.4);ctx.lineTo(u*1.4,u*.2);ctx.closePath();ctx.fill();',
'        }',
'        break;',
'      }',
'      case "SERPENT":{',
'        ctx.translate(en.screenX,en.y);',
'        var _sp=enemySprites.serpent;',
'        if(_sp&&_sp.ready){',
'          var _dH=u*3.0,_dW=_dH*(_sp.fw/_sp.fh);',
'          drawEnemySpriteFrame("serpent",_enAnimState,en.phase,_dW,_dH,true);',
'        }else{',
'          ctx.fillStyle="#2a8a3a";var segCount=6;',
'          for(var i=0;i<segCount;i++){var sx2=i*u*.55,sy2=Math.sin(en.slitherPhase+i*1.2)*u*.3;var r2=u*(.35-i*.03);ctx.beginPath();ctx.arc(sx2,sy2-u*.4,r2,0,PI2);ctx.fill();}',
'          ctx.fillStyle="#1a6a2a";ctx.beginPath();ctx.ellipse(-u*.3,-u*.4,u*.45,u*.35,.2,0,PI2);ctx.fill();',
'          ctx.fillStyle="#ffcc00";ctx.beginPath();ctx.arc(-u*.5,-u*.55,u*.08,0,PI2);ctx.fill();',
'          ctx.fillStyle="#fff";ctx.beginPath();ctx.moveTo(-u*.7,-u*.35);ctx.lineTo(-u*.65,-u*.1);ctx.lineTo(-u*.6,-u*.35);ctx.fill();',
'          ctx.strokeStyle="#ff3366";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-u*.75,-u*.4);ctx.lineTo(-u*1.1,-u*.5);ctx.moveTo(-u*.9,-u*.42);ctx.lineTo(-u*1.1,-u*.3);ctx.stroke();',
'        }',
'        break;',
'      }',
'    }',
'    ctx.restore();',
'    if(en.hpFlash>0){ctx.globalAlpha=en.hpFlash*2;ctx.fillStyle="#FFF";var hb=en.hitbox;ctx.fillRect(hb.x,hb.y,hb.w,hb.h);ctx.globalAlpha=1;}',
'    if(en.dying){ctx.globalAlpha=en.deathTimer/0.4;}',
'    if(en.hp<en.maxHP&&!en.dying){var barW=u*2,barH=u*0.2;var barX=sx-barW/2,barY=sy-u*3.2;ctx.fillStyle="rgba(0,0,0,0.5)";ctx.fillRect(barX-1,barY-1,barW+2,barH+2);ctx.fillStyle="#444";ctx.fillRect(barX,barY,barW,barH);var hpFrac=clamp(en.hp/en.maxHP,0,1);ctx.fillStyle=hpFrac>0.5?"#4CAF50":hpFrac>0.25?"#FF9800":"#F44336";ctx.fillRect(barX,barY,barW*hpFrac,barH);}',
'    if(en.telegraphing){var tPulse=Math.sin(G.time*16)*0.5+0.5;ctx.globalAlpha=0.4+tPulse*0.5;ctx.fillStyle="#FF4444";ctx.font="bold "+Math.round(u*1.2)+"px monospace";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("!",sx,sy-u*3.5);ctx.globalAlpha=1;}',
'    ctx.globalAlpha=1;',
'    for(var _pi=0;_pi<en.projectiles.length;_pi++){var pr=en.projectiles[_pi];',
'      ctx.save();ctx.translate(pr.x,pr.y);',
'      if(pr.type==="ROCK_P"){ctx.fillStyle="#6a5a3a";ctx.beginPath();ctx.arc(0,0,UNIT*.35,0,PI2);ctx.fill();}',
'      else if(pr.type==="SKULL"){ctx.fillStyle="#aa88ff";ctx.shadowColor="#aa00ff";ctx.shadowBlur=10;ctx.beginPath();ctx.arc(0,0,UNIT*.3,0,PI2);ctx.fill();ctx.fillStyle="#220033";ctx.beginPath();ctx.arc(-UNIT*.08,-UNIT*.05,UNIT*.06,0,PI2);ctx.arc(UNIT*.08,-UNIT*.05,UNIT*.06,0,PI2);ctx.fill();ctx.shadowBlur=0;}',
'      else if(pr.type==="SHOCKWAVE"){ctx.fillStyle="rgba(255,120,0,0.8)";ctx.beginPath();ctx.ellipse(0,0,UNIT*.6,UNIT*.25,0,0,PI2);ctx.fill();ctx.fillStyle="rgba(255,200,50,0.5)";ctx.beginPath();ctx.ellipse(0,-UNIT*.15,UNIT*.3,UNIT*.12,0,0,PI2);ctx.fill();}',
'      else if(pr.type==="BOMB"){ctx.fillStyle="#333";ctx.beginPath();ctx.arc(0,0,UNIT*.3,0,PI2);ctx.fill();ctx.fillStyle="#ff4400";ctx.beginPath();ctx.arc(0,-UNIT*.3,UNIT*.1,0,PI2);ctx.fill();}',
'      else if(pr.type==="VENOM"){ctx.fillStyle="rgba(80,220,50,0.8)";ctx.beginPath();ctx.arc(0,0,UNIT*.28,0,PI2);ctx.fill();ctx.fillStyle="rgba(40,180,20,0.5)";ctx.beginPath();ctx.arc(UNIT*.05,-UNIT*.08,UNIT*.12,0,PI2);ctx.fill();}',
'      else if(pr.type==="FEATHER"){ctx.fillStyle="#aa7744";ctx.beginPath();ctx.moveTo(-UNIT*.25,0);ctx.lineTo(UNIT*.25,0);ctx.lineTo(UNIT*.05,-UNIT*.15);ctx.lineTo(-UNIT*.15,-UNIT*.1);ctx.closePath();ctx.fill();ctx.strokeStyle="#664422";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-UNIT*.2,0);ctx.lineTo(UNIT*.2,0);ctx.stroke();}',
'      else if(pr.type==="DEBRIS"){ctx.save();ctx.rotate(G.time*8);ctx.fillStyle="#7a6a4a";ctx.fillRect(-UNIT*.18,-UNIT*.18,UNIT*.36,UNIT*.36);ctx.fillStyle="#5a4a2a";ctx.fillRect(-UNIT*.12,-UNIT*.12,UNIT*.15,UNIT*.24);ctx.restore();}',
'      else if(pr.type==="BOULDER_P"){ctx.fillStyle="#5a5a5a";ctx.beginPath();ctx.arc(0,0,UNIT*.4,0,PI2);ctx.fill();ctx.fillStyle="#3a3a3a";ctx.beginPath();ctx.arc(UNIT*.05,-UNIT*.08,UNIT*.25,-.3,Math.PI*.6);ctx.fill();ctx.strokeStyle="rgba(0,0,0,0.3)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(UNIT*.1,-UNIT*.15);ctx.lineTo(-UNIT*.05,UNIT*.1);ctx.stroke();}',
'      ctx.restore();',
'    }',
'  }',
'}',
  ].join(nl);

  script = script.substring(0, oldDE.start) + newDrawEnemies + script.substring(oldDE.end);
  console.log('✓ Replaced drawEnemies');

  // ============================================================
  // STEP 8: Replace drawObs with sprite-aware version
  // ============================================================
  const oldDO = findFunction(script, 'function drawObs(');
  if (!oldDO) { console.error('✗ drawObs not found'); process.exit(1); }

  const newDrawObs = [
'function drawObs(obs,sx,sy,theme){',
'  ctx.save();ctx.translate(sx,sy);var u=UNIT;',
'  switch(obs.type){',
'    case"ROCK":{',
'      var rkCol=theme===THEMES.GLACIER?"#6090b0":theme===THEMES.VOLCANO?"#6a2a1a":"#5a4a3a";',
'      var rkDk=theme===THEMES.GLACIER?"#4070a0":theme===THEMES.VOLCANO?"#4a1a0a":"#3a2a1a";',
'      ctx.fillStyle="rgba(0,0,0,0.25)";ctx.beginPath();ctx.ellipse(u*.1,0,u*.85,u*.15,0,0,PI2);ctx.fill();',
'      ctx.fillStyle=rkCol;ctx.beginPath();ctx.moveTo(-u*.9,-u*.3);ctx.quadraticCurveTo(-u*.85,-u*1.1,-u*.2,-u*1.2);ctx.quadraticCurveTo(u*.3,-u*1.35,u*.7,-u*.9);ctx.quadraticCurveTo(u*1,-u*.4,u*.85,0);ctx.lineTo(-u*.9,0);ctx.closePath();ctx.fill();',
'      ctx.fillStyle=rkDk;ctx.beginPath();ctx.moveTo(u*.2,-u*1.25);ctx.quadraticCurveTo(u*.7,-u*.9,u*.85,0);ctx.lineTo(u*.1,0);ctx.quadraticCurveTo(u*.3,-u*.6,u*.2,-u*1.25);ctx.closePath();ctx.fill();',
'      ctx.fillStyle="rgba(255,255,255,0.15)";ctx.beginPath();ctx.ellipse(-u*.3,-u*.95,u*.22,u*.16,-.3,0,PI2);ctx.fill();',
'      ctx.fillStyle="rgba(80,140,60,0.3)";ctx.beginPath();ctx.arc(-u*.5,-u*.2,u*.08,0,PI2);ctx.arc(-u*.3,-u*.1,u*.06,0,PI2);ctx.fill();',
'      break;}',
'    case"SPIKE":{',
'      var _sp=enemySprites.spikes;',
'      if(_sp&&_sp.ready){var _dH=u*2.0,_dW=_dH*(_sp.fw/_sp.fh);var _fr=getEnemyFrame("spikes","idle",G.time);if(_fr){ctx.drawImage(_fr.canvas,-_dW/2,-_dH,_dW,_dH);break;}}',
'      var spkCol=theme===THEMES.GLACIER?"#a0d0f0":theme===THEMES.VOLCANO?"#cc4400":"#888";',
'      var spkDk=theme===THEMES.GLACIER?"#6098b8":theme===THEMES.VOLCANO?"#882200":"#555";',
'      ctx.fillStyle=spkDk;ctx.beginPath();ctx.moveTo(-u*.45,0);ctx.lineTo(-u*.15,0);ctx.lineTo(-u*.35,-u*.85);ctx.closePath();ctx.fill();',
'      ctx.beginPath();ctx.moveTo(u*.15,0);ctx.lineTo(u*.45,0);ctx.lineTo(u*.35,-u*.9);ctx.closePath();ctx.fill();',
'      ctx.fillStyle=spkCol;ctx.beginPath();ctx.moveTo(-u*.25,0);ctx.lineTo(u*.25,0);ctx.lineTo(u*.05,-u*1.35);ctx.lineTo(-u*.05,-u*1.35);ctx.closePath();ctx.fill();',
'      ctx.fillStyle="rgba(255,255,255,0.25)";ctx.beginPath();ctx.moveTo(-u*.15,0);ctx.lineTo(-u*.05,0);ctx.lineTo(-u*.02,-u*1.3);ctx.closePath();ctx.fill();',
'      ctx.fillStyle="rgba(255,255,255,0.5)";ctx.beginPath();ctx.arc(0,-u*1.3,u*.06,0,PI2);ctx.fill();',
'      break;}',
'    case"BOULDER":{',
'      var r=u*1.1;',
'      var bCol=theme===THEMES.GLACIER?"#5080a0":theme===THEMES.VOLCANO?"#5a2a10":"#4a3828";',
'      var bDk=theme===THEMES.GLACIER?"#3a6080":theme===THEMES.VOLCANO?"#3a1a08":"#2a2018";',
'      var bLt=theme===THEMES.GLACIER?"#80b0d0":theme===THEMES.VOLCANO?"#8a4a20":"#6a5838";',
'      ctx.fillStyle="rgba(0,0,0,0.3)";ctx.beginPath();ctx.ellipse(0,r*.08,r*.9,r*.2,0,0,PI2);ctx.fill();',
'      ctx.fillStyle=bCol;ctx.beginPath();ctx.arc(0,-r*.88,r,0,PI2);ctx.fill();',
'      ctx.fillStyle=bDk;ctx.beginPath();ctx.arc(r*.15,-r*.82,r*.85,-.3,Math.PI*.6);ctx.lineTo(r*.15,-r*.82);ctx.closePath();ctx.fill();',
'      ctx.fillStyle=bLt;ctx.beginPath();ctx.arc(-r*.25,-r*1.1,r*.45,Math.PI*1.2,PI2);ctx.lineTo(-r*.25,-r*1.1);ctx.closePath();ctx.fill();',
'      ctx.strokeStyle="rgba(0,0,0,0.35)";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(r*.25,-r*.45);ctx.lineTo(r*.05,-r*.8);ctx.lineTo(-r*.15,-r*1.2);ctx.stroke();',
'      ctx.beginPath();ctx.moveTo(-r*.4,-r*.5);ctx.lineTo(-r*.2,-r*.75);ctx.stroke();',
'      if(obs.vx){var rot=(G.time*3+obs.lx*.01)%PI2;ctx.strokeStyle="rgba(0,0,0,0.15)";ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,-r*.88,r*.6,rot,rot+1.2);ctx.stroke();}',
'      break;}',
'    case"LOG":{',
'      var _sp=enemySprites.log;',
'      if(_sp&&_sp.ready){var _dH=u*1.6,_dW=_dH*(_sp.fw/_sp.fh);var _fr=getEnemyFrame("log","idle",obs.lx*0.01);if(_fr){ctx.drawImage(_fr.canvas,-_dW/2,-_dH*0.7,_dW,_dH);break;}}',
'      ctx.fillStyle="#6a4a28";ctx.beginPath();ctx.ellipse(0,-u*.5,u*.9,u*.55,0,0,PI2);ctx.fill();',
'      ctx.strokeStyle="#4a3018";ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,-u*.5,u*.55,u*.35,0,0,PI2);ctx.stroke();',
'      ctx.beginPath();ctx.ellipse(0,-u*.5,u*.25,u*.15,0,0,PI2);ctx.stroke();',
'      ctx.fillStyle="#5a3a18";ctx.fillRect(-u*.9,-u*.15,u*1.8,u*.15);',
'      break;}',
'    case"FIRE_GEYSER":{',
'      var _sp=enemySprites.fire_geyser;',
'      var erupt=Math.sin(G.time*4+obs.lx*.02);',
'      if(_sp&&_sp.ready){var _as=erupt>0?"attack":"idle";var _dH=u*3.5,_dW=_dH*(_sp.fw/_sp.fh);var _fr=getEnemyFrame("fire_geyser",_as,G.time+obs.lx*0.01);if(_fr){ctx.drawImage(_fr.canvas,-_dW/2,-_dH,_dW,_dH);break;}}',
'      ctx.shadowColor="rgba(255,100,0,0.6)";ctx.shadowBlur=10;ctx.fillStyle="#3a1a08";ctx.beginPath();ctx.ellipse(0,-u*.1,u*.5,u*.2,0,0,PI2);ctx.fill();ctx.shadowBlur=0;',
'      if(erupt>0){var fH=erupt*u*2.5;ctx.shadowColor="rgba(255,150,0,0.8)";ctx.shadowBlur=15*erupt;ctx.fillStyle="rgba(255,100,0,0.7)";ctx.beginPath();ctx.moveTo(-u*.3,-u*.1);ctx.lineTo(u*.3,-u*.1);ctx.lineTo(u*.15,-u*.1-fH);ctx.lineTo(-u*.15,-u*.1-fH);ctx.closePath();ctx.fill();ctx.fillStyle="rgba(255,200,50,0.5)";ctx.beginPath();ctx.moveTo(-u*.15,-u*.1);ctx.lineTo(u*.15,-u*.1);ctx.lineTo(u*.05,-u*.1-fH*.7);ctx.lineTo(-u*.05,-u*.1-fH*.7);ctx.closePath();ctx.fill();ctx.shadowBlur=0;}',
'      break;}',
'    case"PTERO":{',
'      var _sp=enemySprites.ptero;',
'      if(_sp&&_sp.ready){var _dH=u*2.2,_dW=_dH*(_sp.fw/_sp.fh);var _fr=getEnemyFrame("ptero","idle",G.time+(obs.phase||0)*0.1);if(_fr){ctx.drawImage(_fr.canvas,-_dW/2,-_dH*0.5,_dW,_dH);break;}}',
'      var wf=Math.sin(G.time*6+(obs.phase||0))*.5;',
'      ctx.fillStyle=theme===THEMES.VOLCANO?"#6a2010":theme===THEMES.SKY?"#3a5090":"#4a2050";',
'      ctx.beginPath();ctx.ellipse(0,0,u*.65,u*.42,0,0,PI2);ctx.fill();',
'      ctx.fillStyle=theme===THEMES.VOLCANO?"#aa4020":theme===THEMES.SKY?"#5a70b0":"#6a3070";',
'      for(var s=-1;s<=1;s+=2){ctx.beginPath();ctx.moveTo(s*u*.35,0);ctx.bezierCurveTo(s*u*1.6,-u*wf,s*u*2.1,u*(.4-wf),s*u*1.9,u*.55);ctx.bezierCurveTo(s*u*1,u*.3,s*u*.55,u*.15,s*u*.35,0);ctx.fill();}',
'      ctx.fillStyle="#ff3333";ctx.beginPath();ctx.arc(u*.8,-u*.22,u*.07,0,PI2);ctx.fill();',
'      break;}',
'  }',
'  ctx.restore();',
'}',
  ].join(nl);

  script = script.substring(0, oldDO.start) + newDrawObs + script.substring(oldDO.end);
  console.log('✓ Replaced drawObs');

  // ============================================================
  // STEP 9: Write output
  // ============================================================
  html = html.substring(0, scriptStart) + script + html.substring(scriptEnd);
  fs.writeFileSync('index.html', html, 'utf8');
  const fsize = (fs.statSync('index.html').size / 1024 / 1024).toFixed(2);
  console.log('\n✓ index.html updated: ' + fsize + 'MB');

  // Validate syntax
  try {
    new Function(script);
    console.log('✓ JavaScript syntax valid');
  } catch(e) {
    console.log('✗ Syntax error: ' + e.message);
    // Find location
    const m = e.message.match(/position (\d+)/);
    if (m) {
      const pos = parseInt(m[1]);
      console.log('Near: ' + script.substring(Math.max(0,pos-80),pos) + ' >>>HERE>>> ' + script.substring(pos,pos+80));
    }
  }

  // Regenerate gameHtml.js
  console.log('\nRegenerating gameHtml.js...');
  require('child_process').execSync('node gen-gamehtmljs.js', { stdio: 'inherit' });
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
