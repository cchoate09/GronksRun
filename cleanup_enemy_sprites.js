// cleanup_enemy_sprites.js — Remove broken sprite sheets, keep only verified clean ones
// Based on frame-by-frame visual inspection:
//   KEEP: bomber (8x2), charger (4x4), fire_geyser (8x3, row 0 only)
//   REVERT: troll, witch, golem, diver, serpent, ptero, log, spikes

const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');
const scriptStart = html.indexOf('<script>') + '<script>'.length;
const scriptEnd = html.indexOf('</script>');
let script = html.substring(scriptStart, scriptEnd);
const nl = script.includes('\r\n') ? '\r\n' : '\n';

// ============================================================
// 1. Replace ENEMY_SPRITE_B64 — remove broken sprites
// ============================================================

// Find the B64 block boundaries
const b64Start = script.indexOf('var ENEMY_SPRITE_B64 = {');
const b64End = script.indexOf('};', b64Start) + 2;
const oldB64 = script.substring(b64Start, b64End);

// Extract only the 3 working sprites' B64 lines
const b64Lines = oldB64.split(nl);
const keepIds = ['bomber', 'charger', 'fire_geyser'];
const keptLines = ['var ENEMY_SPRITE_B64 = {'];

for (const line of b64Lines) {
  for (const id of keepIds) {
    // Match lines like "  bomber: 'data:image/png..."
    if (line.trimStart().startsWith(id + ':') || line.trimStart().startsWith(id + ' :')) {
      // Remove trailing comma if it's the last entry
      let cleaned = line;
      keptLines.push(cleaned);
      break;
    }
  }
}

// Ensure last entry doesn't have trailing comma before closing brace
let lastDataLine = keptLines[keptLines.length - 1];
if (lastDataLine.trimEnd().endsWith(',')) {
  keptLines[keptLines.length - 1] = lastDataLine.replace(/,\s*$/, '');
}
keptLines.push('};');
const newB64 = keptLines.join(nl);

script = script.replace(oldB64, newB64);

// Count removed bytes
const removedBytes = oldB64.length - newB64.length;
console.log('✓ Removed ' + Math.round(removedBytes / 1024) + 'KB of broken sprite B64 data');
console.log('  Kept: bomber, charger, fire_geyser');
console.log('  Removed: troll, witch, golem, diver, serpent, ptero, log, spikes');

// ============================================================
// 2. Replace ENEMY_SPRITE_DEFS — only define the 3 working sprites
// ============================================================

const defsMatch = script.match(/var ENEMY_SPRITE_DEFS = \{[\s\S]*?\};/);
if (!defsMatch) { console.error('Could not find ENEMY_SPRITE_DEFS'); process.exit(1); }

const newDefs = [
  'var ENEMY_SPRITE_DEFS = {',
  '  // BOMBER (8x2): Row 0 = wing-flap flying cycle (0-5), fold (6-7).',
  '  //               Row 1 = ground poses (8-11), attack glow (12-13), standing (14-15).',
  '  bomber: { cols:8, rows:2, fps:7, anims:{"idle":[0,1,2,3,4,5],"attack":[8,9,10,11],"hit":[14]} },',
  '',
  '  // CHARGER (4x4): Row 0 = gallop (0-3), Row 1 = leap/pounce (4-7),',
  '  //                Row 2 = stalking walk (8-11), Row 3 = hit/rage (12-15).',
  '  charger: { cols:4, rows:4, fps:8, anims:{"idle":[0,1,2,3],"attack":[4,5,6,7],"hit":[12,13]} },',
  '',
  '  // FIRE GEYSER (8x3): Row 0 = eruption sequence (0=dormant mound, 1-7=building to full blast).',
  '  //                     Rows 1-2 have grid bleeding — DO NOT USE.',
  '  //                     Idle = dormant mound, Attack = eruption buildup.',
  '  fire_geyser: { cols:8, rows:3, fps:5, anims:{"idle":[0],"attack":[0,1,2,3,4,5,6,7]} }',
  '};',
].join(nl);

script = script.replace(defsMatch[0], newDefs);
console.log('✓ Updated ENEMY_SPRITE_DEFS (3 sprites with verified frame mappings)');

// ============================================================
// 3. Fix fire geyser rendering — use eruption phase for attack timing
// ============================================================

// The fire geyser draw code uses getEnemyFrame with time param.
// Since we now use frame 0 for idle (dormant) and 0-7 for attack (eruption),
// we want the eruption to play through frames sequentially based on erupt timer.
// Look for the geyser-specific draw call and fix its timing.
const geyserDrawPatterns = [
  'var _eruptPhase=erupt>0?erupt:0;var _fr=getEnemyFrame("fire_geyser",_as,_eruptPhase*2+obs.lx*0.001)',
  'var _fr=getEnemyFrame("fire_geyser",_as,G.time+obs.lx*0.01)',
];

let geyserFixed = false;
for (const pat of geyserDrawPatterns) {
  if (script.includes(pat)) {
    // Use erupt value directly to drive animation — when erupt goes from 1->0,
    // the animation should play through the eruption sequence
    script = script.replace(pat, 'var _fr=getEnemyFrame("fire_geyser",_as,erupt>0?(1.0-erupt)*2.5:0)');
    geyserFixed = true;
    break;
  }
}
if (geyserFixed) {
  console.log('✓ Fixed fire geyser eruption animation timing');
} else {
  console.log('⚠ Fire geyser draw pattern not found (may already be correct)');
}

// ============================================================
// 4. Fix bomber animation — ensure clean idle cycle
// ============================================================
const bomberDrawPatterns = [
  'drawEnemySpriteFrame("bomber",_enAnimState,en.phase,_dW,_dH,false)',
  'drawEnemySpriteFrame("bomber",_enAnimState,en.phase,_dW,_dH,true)',
];
// Bomber looks good as-is, no changes needed

// ============================================================
// 5. Fix charger animation — ensure proper attack state
// ============================================================
// Charger draw should already work with the DEFS update

// ============================================================
// 6. Revert animation speed tweaks from fix_enemy_anims.js
//    (golem phase*0.7, serpent phase*0.8, troll phase*0.8)
//    These sprites are being reverted to procedural anyway,
//    but clean up in case the phase multipliers affect fallback code
// ============================================================

// Golem size/speed tweak
const golemTweakOld = 'var _dH=u*4.5,_dW=_dH*(_sp.fw/_sp.fh);' + nl + '          drawEnemySpriteFrame("golem",_enAnimState,en.phase*0.7,_dW,_dH,false)';
const golemTweakNew = 'var _dH=u*4.0,_dW=_dH*(_sp.fw/_sp.fh);' + nl + '          drawEnemySpriteFrame("golem",_enAnimState,en.phase,_dW,_dH,false)';
if (script.includes(golemTweakOld)) {
  script = script.replace(golemTweakOld, golemTweakNew);
  console.log('✓ Reverted golem animation speed tweak');
}

// Serpent speed tweak
const serpentTweakOld = 'drawEnemySpriteFrame("serpent",_enAnimState,en.phase*0.8,_dW,_dH,true)';
const serpentTweakNew = 'drawEnemySpriteFrame("serpent",_enAnimState,en.phase,_dW,_dH,true)';
if (script.includes(serpentTweakOld)) {
  script = script.replace(serpentTweakOld, serpentTweakNew);
  console.log('✓ Reverted serpent animation speed tweak');
}

// Troll speed tweak
const trollTweakOld = 'drawEnemySpriteFrame("troll",_enAnimState,en.phase*0.8,_dW,_dH,false)';
const trollTweakNew = 'drawEnemySpriteFrame("troll",_enAnimState,en.phase,_dW,_dH,false)';
if (script.includes(trollTweakOld)) {
  script = script.replace(trollTweakOld, trollTweakNew);
  console.log('✓ Reverted troll animation speed tweak');
}

// Ptero phase offset tweak
const pteroTweakOld = 'var _fr=getEnemyFrame("ptero","idle",G.time*0.8+(obs.phase||0)*0.5)';
const pteroTweakNew = 'var _fr=getEnemyFrame("ptero","idle",G.time+(obs.phase||0)*0.1)';
if (script.includes(pteroTweakOld)) {
  script = script.replace(pteroTweakOld, pteroTweakNew);
  console.log('✓ Reverted ptero animation speed tweak');
}

// Log static frame tweak
const logTweakOld = 'var _fr=getEnemyFrame("log","idle",0)';
const logTweakNew = 'var _fr=getEnemyFrame("log","idle",obs.lx*0.01)';
if (script.includes(logTweakOld)) {
  script = script.replace(logTweakOld, logTweakNew);
  console.log('✓ Reverted log static frame tweak');
}

// Spikes static frame tweak
const spikesTweakOld = 'var _fr=getEnemyFrame("spikes","idle",0)';
const spikesTweakNew = 'var _fr=getEnemyFrame("spikes","idle",G.time)';
if (script.includes(spikesTweakOld)) {
  script = script.replace(spikesTweakOld, spikesTweakNew);
  console.log('✓ Reverted spikes static frame tweak');
}

// ============================================================
// Write back
// ============================================================
html = html.substring(0, scriptStart) + script + html.substring(scriptEnd);
fs.writeFileSync('index.html', html, 'utf8');

// Validate
try {
  new Function(script);
  console.log('\n✓ JavaScript syntax valid');
} catch(e) {
  console.log('\n✗ Syntax error: ' + e.message);
}

// Report file size
const stats = fs.statSync('index.html');
console.log('\nindex.html size: ' + Math.round(stats.size / 1024) + 'KB');
console.log('\nDone! Run gen-gamehtmljs.js next to regenerate gameHtml.js.');
