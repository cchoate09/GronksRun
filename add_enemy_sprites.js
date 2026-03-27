// add_enemy_sprites.js — Process enemy/obstacle sprite sheets and integrate into game
// Resizes, converts to Base64, adds sprite system, replaces procedural drawing

const fs = require('fs');
const sharp = require('sharp');

// ============================================================
// SPRITE SHEET DEFINITIONS
// ============================================================
// Each entry: file, game entity name, grid cols×rows, target resize dims,
// and frame mappings for animation states

const ENEMY_SHEETS = [
  // --- ENEMIES (7 types) ---
  {
    id: 'troll', file: 'trollspritesheet.png',
    srcW: 4128, srcH: 1024, cols: 8, rows: 2,
    targetW: 1024, targetH: 256,
    // Top row: walking/idle cycle. Bottom row: attack/hit poses
    anims: {
      idle: [0,1,2,3,4,5,6,7],  // walk cycle
      attack: [8,9,10,11],       // attack with club
      hit: [14],                  // hurt/stagger
    },
    fps: 6,
  },
  {
    id: 'charger', file: 'chargerspritesheet.png',
    srcW: 2048, srcH: 2048, cols: 4, rows: 4,
    targetW: 512, targetH: 512,
    // Row 0: running. Row 1: leaping/pouncing. Row 2: walking. Row 3: attack/death
    anims: {
      idle: [0,1,2,3],      // running cycle
      attack: [4,5,6,7],    // leaping/pounce
      hit: [15],             // death/hurt
    },
    fps: 8,
  },
  {
    id: 'diver', file: 'diverspritesheet.png',
    srcW: 2752, srcH: 1536, cols: 8, rows: 4,
    targetW: 1024, targetH: 512,
    // Rows 0-1: flying poses (16 frames), Rows 2-3: large diving/attack poses
    anims: {
      idle: [0,1,2,3,4,5,6],   // flying cycle (top row)
      attack: [8,9,10,11,12],  // diving poses (second row)
      hit: [13],
    },
    fps: 7,
  },
  {
    id: 'witch', file: 'witchspritesheet.png',
    srcW: 4128, srcH: 1024, cols: 8, rows: 2,
    targetW: 1024, targetH: 256,
    // Top row: hovering/walking. Bottom row: casting/attack
    anims: {
      idle: [0,1,2,3,4,5,6,7],
      attack: [8,9,10,11,12],
      hit: [14],
    },
    fps: 6,
  },
  {
    id: 'golem', file: 'golemspritesheet.png',
    srcW: 2752, srcH: 1536, cols: 4, rows: 3,
    targetW: 512, targetH: 384,
    // Row 0: walking (4 frames). Row 1: attack/slam. Row 2: idle/damage
    anims: {
      idle: [0,1,2,3],
      attack: [4,5,6,7],
      hit: [11],
    },
    fps: 4,
  },
  {
    id: 'bomber', file: 'bomberspritesheet.png',
    srcW: 4128, srcH: 1024, cols: 8, rows: 2,
    targetW: 1024, targetH: 256,
    // Top row: flying cycle. Bottom row: bombing/ground poses
    anims: {
      idle: [0,1,2,3,4,5,6],
      attack: [8,9,10,11],
      hit: [14],
    },
    fps: 7,
  },
  {
    id: 'serpent', file: 'serpentspritesheet.png',
    srcW: 2752, srcH: 1536, cols: 4, rows: 3,
    targetW: 512, targetH: 384,
    // Row 0: slithering (4 frames). Row 1: head poses/fire. Row 2: coiled
    anims: {
      idle: [0,1,2,3],
      attack: [4,5,6],
      hit: [7],
    },
    fps: 5,
  },
  // --- OBSTACLES (4 types with sprite sheets) ---
  {
    id: 'ptero', file: 'pterospritesheet.png',
    srcW: 2752, srcH: 1536, cols: 8, rows: 4,
    targetW: 1024, targetH: 512,
    // Rows 0-1: small flying frames, Rows 2-3: larger poses
    anims: {
      idle: [0,1,2,3,4,5,6],  // flying cycle
    },
    fps: 7,
  },
  {
    id: 'fire_geyser', file: 'firegeyserspritesheet.png',
    srcW: 2752, srcH: 1536, cols: 8, rows: 3,
    targetW: 1024, targetH: 384,
    // Row 0: buildup (8 frames). Row 1: eruption. Row 2: flame columns
    anims: {
      idle: [0,1,2,3,4,5,6,7],       // volcano buildup cycle
      attack: [16,17,18,19,20,21,22], // flame columns (row 2)
    },
    fps: 6,
  },
  {
    id: 'log', file: 'logspritesheet.png',
    srcW: 2752, srcH: 1536, cols: 8, rows: 4,
    targetW: 1024, targetH: 512,
    // Various log poses - pick the cleanest static ones
    anims: {
      idle: [0,1,2,3,4,5],  // log variants
    },
    fps: 3,
  },
  {
    id: 'spikes', file: 'spikesspritesheet.png',
    srcW: 2752, srcH: 1536, cols: 4, rows: 3,
    targetW: 512, targetH: 384,
    // Has text labels - pick usable spike frames
    anims: {
      idle: [4,5,8,9,10,11],   // spike growth/emergence frames
    },
    fps: 4,
  },
];

async function main() {
  const b64Map = {};

  // Step 1: Process all sprite sheets
  console.log('=== Processing enemy/obstacle sprite sheets ===\n');
  for (const sheet of ENEMY_SHEETS) {
    const filePath = `./assets/spritesheets/enemies/${sheet.file}`;
    if (!fs.existsSync(filePath)) {
      console.log(`✗ Missing: ${sheet.file}`);
      continue;
    }
    const buf = fs.readFileSync(filePath);
    let finalBuf;
    if (sheet.srcW !== sheet.targetW || sheet.srcH !== sheet.targetH) {
      console.log(`Resizing ${sheet.id}: ${sheet.srcW}x${sheet.srcH} → ${sheet.targetW}x${sheet.targetH}`);
      finalBuf = await sharp(buf)
        .resize(sheet.targetW, sheet.targetH, { fit: 'fill', kernel: 'lanczos3' })
        .png({ compressionLevel: 9 })
        .toBuffer();
    } else {
      finalBuf = await sharp(buf).png({ compressionLevel: 9 }).toBuffer();
    }
    b64Map[sheet.id] = 'data:image/png;base64,' + finalBuf.toString('base64');
    console.log(`  ${sheet.id}: ${(finalBuf.length/1024).toFixed(1)}KB PNG → ${(b64Map[sheet.id].length/1024).toFixed(1)}KB B64`);
  }

  // Step 2: Build the JavaScript code for the enemy sprite system
  console.log('\n=== Building enemy sprite system ===\n');

  // Generate ENEMY_SPRITE_B64 object entries
  const b64Entries = Object.keys(b64Map).map(id => `  ${id}: '${b64Map[id]}'`).join(',\n');

  // Generate ENEMY_SPRITE_DEFS entries
  const defEntries = ENEMY_SHEETS.filter(s => b64Map[s.id]).map(s => {
    return `  ${s.id}: { cols:${s.cols}, rows:${s.rows}, fps:${s.fps}, anims:${JSON.stringify(s.anims)} }`;
  }).join(',\n');

  const enemySpriteSystem = `
// ============================================================
// ENEMY & OBSTACLE SPRITE SYSTEM
// ============================================================
var ENEMY_SPRITE_B64 = {
${b64Entries}
};

var ENEMY_SPRITE_DEFS = {
${defEntries}
};

var enemySprites = {};
var _enemySpritesLoading = false;
var _enemySpritesReady = false;

function initEnemySprites() {
  if (_enemySpritesLoading) return;
  _enemySpritesLoading = true;
  var ids = Object.keys(ENEMY_SPRITE_B64);
  var loaded = 0;
  var total = ids.length;

  ids.forEach(function(id) {
    var def = ENEMY_SPRITE_DEFS[id];
    if (!def) { loaded++; return; }
    var sp = { ready: false, frames: null, fw: 0, fh: 0 };
    enemySprites[id] = sp;

    var img = new Image();
    img.onload = function() {
      var fw = Math.floor(img.width / def.cols);
      var fh = Math.floor(img.height / def.rows);
      sp.fw = fw; sp.fh = fh;
      // Background removal
      var tmp = document.createElement('canvas');
      tmp.width = img.width; tmp.height = img.height;
      var tc = tmp.getContext('2d');
      tc.drawImage(img, 0, 0);
      var idata = tc.getImageData(0, 0, tmp.width, tmp.height);
      var d = idata.data;
      var bgR = d[0], bgG = d[1], bgB = d[2];
      var tol = 38;
      for (var i = 0; i < d.length; i += 4) {
        if (Math.abs(d[i]-bgR) < tol && Math.abs(d[i+1]-bgG) < tol && Math.abs(d[i+2]-bgB) < tol) {
          d[i+3] = 0;
        }
      }
      tc.putImageData(idata, 0, 0);
      // Slice into frames
      sp.frames = [];
      for (var r = 0; r < def.rows; r++) {
        for (var c = 0; c < def.cols; c++) {
          var fc = document.createElement('canvas');
          fc.width = fw; fc.height = fh;
          var fctx = fc.getContext('2d');
          fctx.drawImage(tmp, c*fw, r*fh, fw, fh, 0, 0, fw, fh);
          sp.frames.push(fc);
        }
      }
      sp.ready = true;
      loaded++;
      if (loaded >= total) {
        _enemySpritesReady = true;
        console.log('All enemy sprites loaded (' + total + ')');
      }
      tmp = null; tc = null; idata = null;
    };
    img.onerror = function() {
      console.warn('Enemy sprite failed: ' + id);
      loaded++;
      if (loaded >= total) _enemySpritesReady = true;
    };
    img.src = ENEMY_SPRITE_B64[id];
  });
}

function getEnemyFrame(id, animState, time) {
  var sp = enemySprites[id];
  var def = ENEMY_SPRITE_DEFS[id];
  if (!sp || !sp.ready || !sp.frames || !def) return null;
  var anim = def.anims[animState] || def.anims.idle;
  if (!anim || anim.length === 0) return null;
  var fps = def.fps || 5;
  var frameIdx = Math.floor(time * fps) % anim.length;
  var globalIdx = anim[Math.abs(frameIdx)];
  if (globalIdx >= sp.frames.length) globalIdx = anim[0]; // safety fallback
  return { canvas: sp.frames[globalIdx], fw: sp.fw, fh: sp.fh };
}

function drawEnemySpriteFrame(id, animState, time, drawW, drawH, flipX) {
  var frame = getEnemyFrame(id, animState, time);
  if (!frame) return false;
  ctx.save();
  if (flipX) ctx.scale(-1, 1);
  var dx = -drawW / 2;
  var dy = -drawH;
  ctx.drawImage(frame.canvas, dx, dy, drawW, drawH);
  ctx.restore();
  return true;
}
`;

  // Step 3: Patch index.html
  let html = fs.readFileSync('index.html', 'utf8');
  let script = html.match(/<script>([\s\S]*)<\/script>/)[1];

  // Insert enemy sprite system right after the character SKINS block
  // Handle both LF and CRLF line endings
  const nl = script.includes('\r\n') ? '\r\n' : '\n';
  const skinsEndMarker = '// ============================================================' + nl + '// CHARACTER RENDERING';
  const skinsEndIdx = script.indexOf(skinsEndMarker);
  if (skinsEndIdx === -1) {
    console.error('✗ Could not find CHARACTER RENDERING marker');
    process.exit(1);
  }
  // Replace LF with appropriate line ending in inserted code
  const insertCode = enemySpriteSystem.replace(/\n/g, nl);
  script = script.substring(0, skinsEndIdx) + insertCode + nl + script.substring(skinsEndIdx);
  console.log('✓ Inserted enemy sprite system');

  // Step 4: Trigger enemy sprite loading in LOADING phase
  // Find where character sprites start loading and add enemy sprites
  const charLoadMarker = "CHARS.forEach(function(ch) { if (!charSprites[ch.id].loading) initCharSprite(ch.id); });";
  const firstCharLoad = script.indexOf(charLoadMarker);
  if (firstCharLoad !== -1) {
    // Add enemy sprite loading after first character sprite load call
    script = script.replace(charLoadMarker,
      charLoadMarker + '\n        if (!_enemySpritesLoading) initEnemySprites();');
    console.log('✓ Added enemy sprite loading trigger');
  } else {
    console.error('✗ Could not find character sprite loading marker');
  }

  // Step 5: Replace drawEnemies function with sprite-aware version
  const oldDrawEnemies = findFunction(script, 'function drawEnemies()');
  if (!oldDrawEnemies) {
    console.error('✗ Could not find drawEnemies function');
    process.exit(1);
  }

  const newDrawEnemies = `function drawEnemies(){
  for(const en of activeEnemies){
    if(!en.alive)continue;
    const sx=en.sx, sy=en.sy, u=UNIT;
    ctx.save();
    // Determine animation state
    var _enAnimState = 'idle';
    if (en.telegraphing || en.fireCD <= 0.3) _enAnimState = 'attack';
    if (en.hpFlash > 0) _enAnimState = 'hit';

    switch(en.type){
      case 'TROLL':{
        ctx.translate(sx,sy);
        var _sprId = 'troll';
        var _sp = enemySprites[_sprId];
        if (_sp && _sp.ready) {
          var _drawH = u * 3.2;
          var _drawW = _drawH * (_sp.fw / _sp.fh);
          drawEnemySpriteFrame(_sprId, _enAnimState, en.phase, _drawW, _drawH, false);
        } else {
          // Procedural fallback
          ctx.fillStyle='#3a7a3a';ctx.beginPath();ctx.ellipse(0,-u*1.3,u*1.1,u*1.4,0,0,PI2);ctx.fill();
          ctx.fillStyle='#5a9a5a';ctx.beginPath();ctx.ellipse(0,-u*1,u*.6,u*.7,0,0,PI2);ctx.fill();
          ctx.fillStyle='#ff0';ctx.beginPath();ctx.ellipse(-u*.35,-u*1.9,u*.22,u*.18,-.3,0,PI2);ctx.fill();
          ctx.beginPath();ctx.ellipse(u*.35,-u*1.9,u*.22,u*.18,.3,0,PI2);ctx.fill();
          ctx.fillStyle='#200';ctx.beginPath();ctx.arc(-u*.3,-u*1.88,u*.1,0,PI2);ctx.arc(u*.4,-u*1.88,u*.1,0,PI2);ctx.fill();
          ctx.fillStyle='#ffe';ctx.beginPath();ctx.moveTo(-u*.5,-u*.9);ctx.lineTo(-u*.35,-u*.5);ctx.lineTo(-u*.2,-u*.9);ctx.fill();
          ctx.beginPath();ctx.moveTo(u*.5,-u*.9);ctx.lineTo(u*.35,-u*.5);ctx.lineTo(u*.2,-u*.9);ctx.fill();
          ctx.strokeStyle='#2a4a2a';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-u*.55,-u*2.1);ctx.lineTo(-u*.25,-u*2);ctx.stroke();
          ctx.beginPath();ctx.moveTo(u*.55,-u*2.1);ctx.lineTo(u*.25,-u*2);ctx.stroke();
        }
        break;
      }
      case 'CHARGER':{
        if(en.state==='WARN'){
          var blink=Math.sin(G.time*12)>.2;
          if(blink){
            ctx.fillStyle='#FF4444';ctx.font='bold '+Math.round(u*2)+'px monospace';
            ctx.textAlign='center';ctx.textBaseline='middle';
            ctx.fillText('!',W-u*2,GROUND_BASE-u*3);
          }
          break;
        }
        ctx.translate(en.screenX,en.y);
        var _sprId = 'charger';
        var _sp = enemySprites[_sprId];
        if (_sp && _sp.ready) {
          var _enAnim = en.state === 'CHARGE' ? 'idle' : _enAnimState;
          var _drawH = u * 2.8;
          var _drawW = _drawH * (_sp.fw / _sp.fh);
          drawEnemySpriteFrame(_sprId, _enAnim, en.phase, _drawW, _drawH, true);
        } else {
          ctx.fillStyle='#CC8833';ctx.beginPath();ctx.ellipse(0,-u*.9,u*1.3,u*.85,0,0,PI2);ctx.fill();
          ctx.fillStyle='#BB7722';ctx.beginPath();ctx.ellipse(-u*1,-u*1.1,u*.55,u*.5,-.2,0,PI2);ctx.fill();
          ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(-u*1.3,-u*.8);ctx.lineTo(-u*1.2,-u*.35);ctx.lineTo(-u*1.1,-u*.8);ctx.fill();
          ctx.beginPath();ctx.moveTo(-u*1.0,-u*.75);ctx.lineTo(-u*.9,-u*.3);ctx.lineTo(-u*.8,-u*.75);ctx.fill();
          ctx.fillStyle='#f00';ctx.beginPath();ctx.arc(-u*1.1,-u*1.2,u*.12,0,PI2);ctx.fill();
          var lAnim=Math.sin(G.time*14)*.3;
          ctx.fillStyle='#AA6622';
          for(var i=-1;i<=1;i+=2){
            ctx.save();ctx.translate(i*u*.5,-u*.08);ctx.rotate(i*lAnim);
            ctx.fillRect(-u*.12,0,u*.24,u*.55);ctx.restore();
          }
          ctx.strokeStyle='#CC8833';ctx.lineWidth=u*.15;ctx.lineCap='round';
          ctx.beginPath();ctx.moveTo(u*1.1,-u*.9);ctx.quadraticCurveTo(u*1.6,-u*1.8,u*1.3,-u*1.5);ctx.stroke();
        }
        break;
      }
      case 'DIVER':{
        ctx.translate(en.screenX,en.y);
        var _sprId = 'diver';
        var _sp = enemySprites[_sprId];
        if (_sp && _sp.ready) {
          var _drawH = u * 2.6;
          var _drawW = _drawH * (_sp.fw / _sp.fh);
          drawEnemySpriteFrame(_sprId, _enAnimState, en.phase, _drawW, _drawH, true);
        } else {
          var wf=Math.sin(G.time*5)*.6;
          ctx.fillStyle='#6a3a20';ctx.beginPath();ctx.ellipse(0,0,u*.7,u*.45,0,0,PI2);ctx.fill();
          ctx.fillStyle='#8a5a30';
          for(var s=-1;s<=1;s+=2){
            ctx.beginPath();ctx.moveTo(s*u*.4,0);
            ctx.bezierCurveTo(s*u*1.8,-u*wf,s*u*2.4,u*(.4-wf),s*u*2.2,u*.6);
            ctx.bezierCurveTo(s*u*1.2,u*.35,s*u*.6,u*.18,s*u*.4,0);ctx.fill();
          }
          ctx.fillStyle='#5a2a10';ctx.beginPath();ctx.ellipse(-u*.8,u*-.15,u*.4,u*.3,.3,0,PI2);ctx.fill();
          ctx.fillStyle='#cc8800';ctx.beginPath();ctx.moveTo(-u*1,-u*.15);ctx.lineTo(-u*1.6,0);ctx.lineTo(-u*1,-u*.05);ctx.fill();
          ctx.fillStyle='#ff0';ctx.beginPath();ctx.arc(-u*.75,-u*.25,u*.08,0,PI2);ctx.fill();
        }
        break;
      }
      case 'WITCH':{
        ctx.translate(sx,sy);
        var _sprId = 'witch';
        var _sp = enemySprites[_sprId];
        if (_sp && _sp.ready) {
          var _drawH = u * 3.0;
          var _drawW = _drawH * (_sp.fw / _sp.fh);
          drawEnemySpriteFrame(_sprId, _enAnimState, en.phase, _drawW, _drawH, false);
        } else {
          ctx.fillStyle='#2a0a3a';ctx.beginPath();
          ctx.moveTo(-u*.5,0);ctx.lineTo(-u*.7,u*.5);ctx.lineTo(u*.7,u*.5);ctx.lineTo(u*.5,0);
          ctx.lineTo(u*.3,-u*1.2);ctx.lineTo(-u*.3,-u*1.2);ctx.closePath();ctx.fill();
          ctx.fillStyle='#3a1a4a';ctx.beginPath();
          ctx.moveTo(-u*.5,-u*1.2);ctx.lineTo(u*.5,-u*1.2);ctx.lineTo(0,-u*2.5);ctx.closePath();ctx.fill();
          ctx.shadowColor='#aa00ff';ctx.shadowBlur=10;
          ctx.fillStyle='#cc44ff';ctx.beginPath();ctx.arc(-u*.18,-u*.9,u*.1,0,PI2);ctx.arc(u*.18,-u*.9,u*.1,0,PI2);ctx.fill();
          ctx.shadowBlur=0;
          ctx.strokeStyle='#6a4a2a';ctx.lineWidth=u*.1;ctx.beginPath();
          ctx.moveTo(u*.6,-u*.5);ctx.lineTo(u*.8,u*.5);ctx.stroke();
          ctx.fillStyle='#aa00ff';ctx.shadowColor='#aa00ff';ctx.shadowBlur=8;
          ctx.beginPath();ctx.arc(u*.55,-u*.6,u*.18,0,PI2);ctx.fill();ctx.shadowBlur=0;
        }
        break;
      }
      case 'GOLEM':{
        ctx.translate(sx,sy);
        var _sprId = 'golem';
        var _sp = enemySprites[_sprId];
        if (_sp && _sp.ready) {
          var _drawH = u * 4.0;
          var _drawW = _drawH * (_sp.fw / _sp.fh);
          drawEnemySpriteFrame(_sprId, _enAnimState, en.phase, _drawW, _drawH, false);
        } else {
          ctx.fillStyle='#5a5a5a';ctx.beginPath();ctx.ellipse(0,-u*1.6,u*1.3,u*1.7,0,0,PI2);ctx.fill();
          ctx.strokeStyle='#3a3a3a';ctx.lineWidth=2;
          ctx.beginPath();ctx.moveTo(-u*.4,-u*2.5);ctx.lineTo(-u*.1,-u*1.8);ctx.lineTo(-u*.3,-u*1);ctx.stroke();
          ctx.beginPath();ctx.moveTo(u*.3,-u*2.3);ctx.lineTo(u*.5,-u*1.5);ctx.stroke();
          ctx.shadowColor='#ff4400';ctx.shadowBlur=12;
          ctx.fillStyle='#ff6600';ctx.beginPath();ctx.arc(-u*.35,-u*2.2,u*.15,0,PI2);ctx.ac(u*.35,-u*2.2,u*.15,0,PI2);ctx.fill();
          ctx.shadowBlur=0;
          ctx.fillStyle='#4a4a4a';
          ctx.beginPath();ctx.ellipse(-u*1.3,-u*1.5,u*.5,u*.3,-.4,0,PI2);ctx.fill();
          ctx.beginPath();ctx.ellipse(u*1.3,-u*1.5,u*.5,u*.3,.4,0,PI2);ctx.fill();
          ctx.fillRect(-u*.8,-u*.15,u*.5,u*.5);ctx.fillRect(u*.3,-u*.15,u*.5,u*.5);
          ctx.strokeStyle='#ff4400';ctx.lineWidth=u*.08;ctx.beginPath();
          ctx.moveTo(-u*.3,-u*1.7);ctx.lineTo(-u*.1,-u*1.5);ctx.lineTo(u*.1,-u*1.7);ctx.lineTo(u*.3,-u*1.5);ctx.stroke();
        }
        break;
      }
      case 'BOMBER':{
        ctx.translate(en.screenX,en.y);
        var _sprId = 'bomber';
        var _sp = enemySprites[_sprId];
        if (_sp && _sp.ready) {
          var _drawH = u * 2.6;
          var _drawW = _drawH * (_sp.fw / _sp.fh);
          drawEnemySpriteFrame(_sprId, _enAnimState, en.phase, _drawW, _drawH, true);
        } else {
          ctx.fillStyle='#8a4a2a';ctx.beginPath();ctx.ellipse(0,0,u*.9,u*.5,0,0,PI2);ctx.fill();
          var wf2=Math.sin(G.time*7)*.4;
          ctx.fillStyle='#aa6a3a';
          for(var s=-1;s<=1;s+=2){
            ctx.beginPath();ctx.moveTo(s*u*.5,0);
            ctx.bezierCurveTo(s*u*1.5,-u*wf2,s*u*2,-u*(.3+wf2),s*u*1.8,u*.3);
            ctx.bezierCurveTo(s*u*1,u*.2,s*u*.6,u*.1,s*u*.5,0);ctx.fill();
          }
          ctx.fillStyle='#cc3300';ctx.beginPath();ctx.ellipse(0,u*.25,u*.3,u*.15,0,0,PI2);ctx.fill();
          ctx.fillStyle='#ff0';ctx.beginPath();ctx.arc(-u*.5,-u*.1,u*.1,0,PI2);ctx.fill();
          ctx.fillStyle='#6a3a1a';ctx.beginPath();ctx.moveTo(u*.7,0);ctx.lineTo(u*1.4,-u*.4);ctx.lineTo(u*1.4,u*.2);ctx.closePath();ctx.fill();
        }
        break;
      }
      case 'SERPENT':{
        ctx.translate(en.screenX,en.y);
        var _sprId = 'serpent';
        var _sp = enemySprites[_sprId];
        if (_sp && _sp.ready) {
          var _drawH = u * 3.0;
          var _drawW = _drawH * (_sp.fw / _sp.fh);
          drawEnemySpriteFrame(_sprId, _enAnimState, en.phase, _drawW, _drawH, true);
        } else {
          ctx.fillStyle='#2a8a3a';
          var segCount=6;
          for(var i=0;i<segCount;i++){
            var sx2=i*u*.55, sy2=Math.sin(en.slitherPhase+i*1.2)*u*.3;
            var r2=u*(.35-i*.03);
            ctx.beginPath();ctx.arc(sx2,sy2-u*.4,r2,0,PI2);ctx.fill();
          }
          ctx.fillStyle='#1a6a2a';ctx.beginPath();ctx.ellipse(-u*.3,-u*.4,u*.45,u*.35,.2,0,PI2);ctx.fill();
          ctx.fillStyle='#ffcc00';ctx.beginPath();ctx.arc(-u*.5,-u*.55,u*.08,0,PI2);ctx.fill();
          ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(-u*.7,-u*.35);ctx.lineTo(-u*.65,-u*.1);ctx.lineTo(-u*.6,-u*.35);ctx.fill();
          ctx.strokeStyle='#ff3366';ctx.lineWidth=2;ctx.beginPath();
          ctx.moveTo(-u*.75,-u*.4);ctx.lineTo(-u*1.1,-u*.5);ctx.moveTo(-u*.9,-u*.42);ctx.lineTo(-u*1.1,-u*.3);ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();

    // HP flash overlay
    if(en.hpFlash>0){
      ctx.globalAlpha=en.hpFlash*2;
      ctx.fillStyle='#FFF';
      var hb=en.hitbox;
      ctx.fillRect(hb.x,hb.y,hb.w,hb.h);
      ctx.globalAlpha=1;
    }
    // Dying fade
    if(en.dying){
      ctx.globalAlpha=en.deathTimer/0.4;
    }

    // HP bar (show when damaged)
    if(en.hp<en.maxHP && !en.dying){
      var barW=u*2, barH=u*0.2;
      var barX=sx-barW/2, barY=sy-u*3.2;
      ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(barX-1,barY-1,barW+2,barH+2);
      ctx.fillStyle='#444';ctx.fillRect(barX,barY,barW,barH);
      var hpFrac=clamp(en.hp/en.maxHP,0,1);
      ctx.fillStyle=hpFrac>0.5?'#4CAF50':hpFrac>0.25?'#FF9800':'#F44336';
      ctx.fillRect(barX,barY,barW*hpFrac,barH);
    }

    // Telegraph warning indicator
    if(en.telegraphing){
      var tPulse=Math.sin(G.time*16)*0.5+0.5;
      ctx.globalAlpha=0.4+tPulse*0.5;
      ctx.fillStyle='#FF4444';
      ctx.font='bold '+Math.round(u*1.2)+'px monospace';
      ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText('!',sx,sy-u*3.5);
      ctx.globalAlpha=1;
    }

    ctx.globalAlpha=1;
    // Projectiles
    for(const pr of en.projectiles){
      ctx.save();ctx.translate(pr.x,pr.y);
      if(pr.type==='ROCK_P'){
        ctx.fillStyle='#6a5a3a';ctx.beginPath();ctx.arc(0,0,UNIT*.35,0,PI2);ctx.fill();
      } else if(pr.type==='SKULL'){
        ctx.fillStyle='#aa88ff';ctx.shadowColor='#aa00ff';ctx.shadowBlur=10;
        ctx.beginPath();ctx.arc(0,0,UNIT*.3,0,PI2);ctx.fill();
        ctx.fillStyle='#220033';
        ctx.beginPath();ctx.arc(-UNIT*.08,-UNIT*.05,UNIT*.06,0,PI2);ctx.arc(UNIT*.08,-UNIT*.05,UNIT*.06,0,PI2);ctx.fill();
        ctx.shadowBlur=0;
      } else if(pr.type==='SHOCKWAVE'){
        ctx.fillStyle='rgba(255,120,0,0.8)';
        ctx.beginPath();ctx.ellipse(0,0,UNIT*.6,UNIT*.25,0,0,PI2);ctx.fill();
        ctx.fillStyle='rgba(255,200,50,0.5)';
        ctx.beginPath();ctx.ellipse(0,-UNIT*.15,UNIT*.3,UNIT*.12,0,0,PI2);ctx.fill();
      } else if(pr.type==='BOMB'){
        ctx.fillStyle='#333';ctx.beginPath();ctx.arc(0,0,UNIT*.3,0,PI2);ctx.fill();
        ctx.fillStyle='#ff4400';ctx.beginPath();ctx.arc(0,-UNIT*.3,UNIT*.1,0,PI2);ctx.fill();
      } else if(pr.type==='VENOM'){
        ctx.fillStyle='rgba(80,220,50,0.8)';ctx.beginPath();ctx.arc(0,0,UNIT*.28,0,PI2);ctx.fill();
        ctx.fillStyle='rgba(40,180,20,0.5)';ctx.beginPath();ctx.arc(UNIT*.05,-UNIT*.08,UNIT*.12,0,PI2);ctx.fill();
      } else if(pr.type==='FEATHER'){
        ctx.fillStyle='#aa7744';ctx.beginPath();
        ctx.moveTo(-UNIT*.25,0);ctx.lineTo(UNIT*.25,0);ctx.lineTo(UNIT*.05,-UNIT*.15);ctx.lineTo(-UNIT*.15,-UNIT*.1);ctx.closePath();ctx.fill();
        ctx.strokeStyle='#664422';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-UNIT*.2,0);ctx.lineTo(UNIT*.2,0);ctx.stroke();
      } else if(pr.type==='DEBRIS'){
        ctx.save();ctx.rotate(G.time*8);
        ctx.fillStyle='#7a6a4a';ctx.fillRect(-UNIT*.18,-UNIT*.18,UNIT*.36,UNIT*.36);
        ctx.fillStyle='#5a4a2a';ctx.fillRect(-UNIT*.12,-UNIT*.12,UNIT*.15,UNIT*.24);
        ctx.restore();
      } else if(pr.type==='BOULDER_P'){
        ctx.fillStyle='#5a5a5a';ctx.beginPath();ctx.arc(0,0,UNIT*.4,0,PI2);ctx.fill();
        ctx.fillStyle='#3a3a3a';ctx.beginPath();ctx.arc(UNIT*.05,-UNIT*.08,UNIT*.25,-.3,Math.PI*.6);ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,0.3)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(UNIT*.1,-UNIT*.15);ctx.lineTo(-UNIT*.05,UNIT*.1);ctx.stroke();
      }
      ctx.restore();
    }
  }
}`;

  script = script.substring(0, script.indexOf(oldDrawEnemies.text)) +
           newDrawEnemies +
           script.substring(script.indexOf(oldDrawEnemies.text) + oldDrawEnemies.text.length);
  console.log('✓ Replaced drawEnemies with sprite-aware version');

  // Step 6: Replace drawObs with sprite-aware version for obstacles
  const oldDrawObs = findFunction(script, 'function drawObs(');
  if (!oldDrawObs) {
    console.error('✗ Could not find drawObs function');
    process.exit(1);
  }

  const newDrawObs = `function drawObs(obs,sx,sy,theme){
  ctx.save();ctx.translate(sx,sy);var u=UNIT;
  switch(obs.type){
    case'ROCK':{
      var rkCol=theme===THEMES.GLACIER?'#6090b0':theme===THEMES.VOLCANO?'#6a2a1a':'#5a4a3a';
      var rkDk=theme===THEMES.GLACIER?'#4070a0':theme===THEMES.VOLCANO?'#4a1a0a':'#3a2a1a';
      ctx.fillStyle='rgba(0,0,0,0.25)';ctx.beginPath();ctx.ellipse(u*.1,0,u*.85,u*.15,0,0,PI2);ctx.fill();
      ctx.fillStyle=rkCol;ctx.beginPath();
      ctx.moveTo(-u*.9,-u*.3);ctx.quadraticCurveTo(-u*.85,-u*1.1,-u*.2,-u*1.2);
      ctx.quadraticCurveTo(u*.3,-u*1.35,u*.7,-u*.9);
      ctx.quadraticCurveTo(u*1,-u*.4,u*.85,0);ctx.lineTo(-u*.9,0);ctx.closePath();ctx.fill();
      ctx.fillStyle=rkDk;ctx.beginPath();
      ctx.moveTo(u*.2,-u*1.25);ctx.quadraticCurveTo(u*.7,-u*.9,u*.85,0);
      ctx.lineTo(u*.1,0);ctx.quadraticCurveTo(u*.3,-u*.6,u*.2,-u*1.25);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.15)';ctx.beginPath();
      ctx.ellipse(-u*.3,-u*.95,u*.22,u*.16,-.3,0,PI2);ctx.fill();
      ctx.fillStyle='rgba(80,140,60,0.3)';
      ctx.beginPath();ctx.arc(-u*.5,-u*.2,u*.08,0,PI2);ctx.ac(-u*.3,-u*.1,u*.06,0,PI2);ctx.fill();
      break;}
    case'SPIKE':{
      var _sprId='spikes';
      var _sp=enemySprites[_sprId];
      if(_sp && _sp.ready){
        var _drawH=u*2.0;
        var _drawW=_drawH*(_sp.fw/_sp.fh);
        var _frame=getEnemyFrame(_sprId,'idle',G.time);
        if(_frame){
          ctx.drawImage(_frame.canvas,-_drawW/2,-_drawH,_drawW,_drawH);
          break;
        }
      }
      var spkCol=theme===THEMES.GLACIER?'#a0d0f0':theme===THEMES.VOLCANO?'#cc4400':'#888';
      var spkDk=theme===THEMES.GLACIER?'#6098b8':theme===THEMES.VOLCANO?'#882200':'#555';
      ctx.fillStyle=spkDk;
      ctx.beginPath();ctx.moveTo(-u*.45,0);ctx.lineTo(-u*.15,0);ctx.lineTo(-u*.35,-u*.85);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(u*.15,0);ctx.lineTo(u*.45,0);ctx.lineTo(u*.35,-u*.9);ctx.closePath();ctx.fill();
      ctx.fillStyle=spkCol;
      ctx.beginPath();ctx.moveTo(-u*.25,0);ctx.lineTo(u*.25,0);ctx.lineTo(u*.05,-u*1.35);ctx.lineTo(-u*.05,-u*1.35);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.25)';
      ctx.beginPath();ctx.moveTo(-u*.15,0);ctx.lineTo(-u*.05,0);ctx.lineTo(-u*.02,-u*1.3);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.5)';ctx.beginPath();ctx.arc(0,-u*1.3,u*.06,0,PI2);ctx.fill();
      break;}
    case'BOULDER':{
      var r=u*1.1;
      var bCol=theme===THEMES.GLACIER?'#5080a0':theme===THEMES.VOLCANO?'#5a2a10':'#4a3828';
      var bDk=theme===THEMES.GLACIER?'#3a6080':theme===THEMES.VOLCANO?'#3a1a08':'#2a2018';
      var bLt=theme===THEMES.GLACIER?'#80b0d0':theme===THEMES.VOLCANO?'#8a4a20':'#6a5838';
      ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.ellipse(0,r*.08,r*.9,r*.2,0,0,PI2);ctx.fill();
      ctx.fillStyle=bCol;ctx.beginPath();ctx.arc(0,-r*.88,r,0,PI2);ctx.fill();
      ctx.fillStyle=bDk;ctx.beginPath();ctx.arc(r*.15,-r*.82,r*.85,-.3,Math.PI*.6);ctx.lineTo(r*.15,-r*.82);ctx.closePath();ctx.fill();
      ctx.fillStyle=bLt;ctx.beginPath();ctx.arc(-r*.25,-r*1.1,r*.45,Math.PI*1.2,PI2);ctx.lineTo(-r*.25,-r*1.1);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.35)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(r*.25,-r*.45);ctx.lineTo(r*.05,-r*.8);ctx.lineTo(-r*.15,-r*1.2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-r*.4,-r*.5);ctx.lineTo(-r*.2,-r*.75);ctx.stroke();
      if(obs.vx){
        var rot=(G.time*3+obs.lx*.01)%PI2;
        ctx.strokeStyle='rgba(0,0,0,0.15)';ctx.lineWidth=1;
        ctx.beginPath();ctx.arc(0,-r*.88,r*.6,rot,rot+1.2);ctx.stroke();
      }
      break;}
    case'LOG':{
      var _sprId='log';
      var _sp=enemySprites[_sprId];
      if(_sp && _sp.ready){
        var _drawH=u*1.6;
        var _drawW=_drawH*(_sp.fw/_sp.fh);
        var _frame=getEnemyFrame(_sprId,'idle',obs.lx*0.01);
        if(_frame){
          ctx.drawImage(_frame.canvas,-_drawW/2,-_drawH*0.7,_drawW,_drawH);
          break;
        }
      }
      ctx.fillStyle='#6a4a28';
      ctx.beginPath();ctx.ellipse(0,-u*.5,u*.9,u*.55,0,0,PI2);ctx.fill();
      ctx.strokeStyle='#4a3018';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.ellipse(0,-u*.5,u*.55,u*.35,0,0,PI2);ctx.stroke();
      ctx.beginPath();ctx.ellipse(0,-u*.5,u*.25,u*.15,0,0,PI2);ctx.stroke();
      ctx.fillStyle='#5a3a18';ctx.fillRect(-u*.9,-u*.15,u*1.8,u*.15);
      break;}
    case'FIRE_GEYSER':{
      var _sprId='fire_geyser';
      var _sp=enemySprites[_sprId];
      var erupt=Math.sin(G.time*4+obs.lx*.02);
      if(_sp && _sp.ready){
        var _animState = erupt > 0 ? 'attack' : 'idle';
        var _drawH=u*3.5;
        var _drawW=_drawH*(_sp.fw/_sp.fh);
        var _frame=getEnemyFrame(_sprId,_animState,G.time+obs.lx*0.01);
        if(_frame){
          ctx.drawImage(_frame.canvas,-_drawW/2,-_drawH,_drawW,_drawH);
          break;
        }
      }
      ctx.shadowColor='rgba(255,100,0,0.6)';ctx.shadowBlur=10;
      ctx.fillStyle='#3a1a08';ctx.beginPath();ctx.ellipse(0,-u*.1,u*.5,u*.2,0,0,PI2);ctx.fill();ctx.shadowBlur=0;
      if(erupt>0){
        var fH=erupt*u*2.5;
        ctx.shadowColor='rgba(255,150,0,0.8)';ctx.shadowBlur=15*erupt;
        ctx.fillStyle='rgba(255,100,0,0.7)';ctx.beginPath();
        ctx.moveTo(-u*.3,-u*.1);ctx.lineTo(u*.3,-u*.1);ctx.lineTo(u*.15,-u*.1-fH);ctx.lineTo(-u*.15,-u*.1-fH);ctx.closePath();ctx.fill();
        ctx.fillStyle='rgba(255,200,50,0.5)';ctx.beginPath();
        ctx.moveTo(-u*.15,-u*.1);ctx.lineTo(u*.15,-u*.1);ctx.lineTo(u*.05,-u*.1-fH*.7);ctx.lineTo(-u*.05,-u*.1-fH*.7);ctx.closePath();ctx.fill();
        ctx.shadowBlur=0;
      }
      break;}
    case'PTERO':{
      var _sprId='ptero';
      var _sp=enemySprites[_sprId];
      if(_sp && _sp.ready){
        var _drawH=u*2.2;
        var _drawW=_drawH*(_sp.fw/_sp.fh);
        var _frame=getEnemyFrame(_sprId,'idle',G.time+(obs.phase||0)*0.1);
        if(_frame){
          ctx.drawImage(_frame.canvas,-_drawW/2,-_drawH*0.5,_drawW,_drawH);
          break;
        }
      }
      var wf=Math.sin(G.time*6+(obs.phase||0))*.5;
      ctx.fillStyle=theme===THEMES.VOLCANO?'#6a2010':theme===THEMES.SKY?'#3a5090':'#4a2050';
      ctx.beginPath();ctx.ellipse(0,0,u*.65,u*.42,0,0,PI2);ctx.fill();
      ctx.fillStyle=theme===THEMES.VOLCANO?'#aa4020':theme===THEMES.SKY?'#5a70b0':'#6a3070';
      for(var s=-1;s<=1;s+=2){
        ctx.beginPath();ctx.moveTo(s*u*.35,0);
        ctx.bezierCurveTo(s*u*1.6,-u*wf,s*u*2.1,u*(.4-wf),s*u*1.9,u*.55);
        ctx.bezierCurveTo(s*u*1,u*.3,s*u*.55,u*.15,s*u*.35,0);ctx.fill();
      }
      ctx.fillStyle='#ff3333';ctx.beginPath();ctx.arc(u*.8,-u*.22,u*.07,0,PI2);ctx.fill();
      break;}
  }
  ctx.restore();
}`;

  script = script.substring(0, script.indexOf(oldDrawObs.text)) +
           newDrawObs +
           script.substring(script.indexOf(oldDrawObs.text) + oldDrawObs.text.length);
  console.log('✓ Replaced drawObs with sprite-aware version');

  // Write back — reconstruct HTML with modified script
  const scriptStart = html.indexOf('<script>') + '<script>'.length;
  const scriptEnd = html.indexOf('</script>');
  html = html.substring(0, scriptStart) + script + html.substring(scriptEnd);

  fs.writeFileSync('index.html', html, 'utf8');
  console.log('\n✓ index.html updated');
  console.log('  File size: ' + (fs.statSync('index.html').size / 1024 / 1024).toFixed(2) + 'MB');
}

// Helper: extract a function body from script text
function findFunction(script, signature) {
  const idx = script.indexOf(signature);
  if (idx === -1) return null;
  let depth = 0, started = false;
  let end = idx;
  for (let i = idx; i < script.length; i++) {
    if (script[i] === '{') { depth++; started = true; }
    if (script[i] === '}') {
      depth--;
      if (started && depth === 0) { end = i + 1; break; }
    }
  }
  return { text: script.substring(idx, end), start: idx, end: end };
}

main().catch(function(err) {
  console.error('Error:', err);
  process.exit(1);
});
