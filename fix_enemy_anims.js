// fix_enemy_anims.js — Fix all enemy/obstacle sprite animation frame mappings
// Based on careful visual analysis of each sprite sheet

const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');
const scriptStart = html.indexOf('<script>') + '<script>'.length;
const scriptEnd = html.indexOf('</script>');
let script = html.substring(scriptStart, scriptEnd);
const nl = script.includes('\r\n') ? '\r\n' : '\n';

// ============================================================
// FIX 1: Replace ENEMY_SPRITE_DEFS with corrected frame mappings
// ============================================================

const oldDefs = script.match(/var ENEMY_SPRITE_DEFS = \{[\s\S]*?\};/);
if (!oldDefs) { console.error('Could not find ENEMY_SPRITE_DEFS'); process.exit(1); }

// Corrected mappings based on visual analysis of each frame:
const newDefs = [
'var ENEMY_SPRITE_DEFS = {',
'  // TROLL (8x2): Row 0 = walk+attack. 0-3 walk cycle, 4-6 club swing, 7 standing',
'  //              Row 1 = running/standing variants',
'  troll: { cols:8, rows:2, fps:5, anims:{"idle":[0,1,2,3],"attack":[4,5,6],"hit":[7]} },',
'',
'  // CHARGER (4x4): Row 0 = gallop, Row 1 = leap/pounce, Row 2 = walk, Row 3 = hit/death',
'  charger: { cols:4, rows:4, fps:8, anims:{"idle":[0,1,2,3],"attack":[4,5,6,7],"hit":[12]} },',
'',
'  // DIVER (8x4): Row 0 = wing-flap flying. 0-4 smooth cycle. 5-6 are diving/tucked.',
'  //              Row 1 = swoop/attack poses. Rows 2-3 = large/ground (irregular, avoid)',
'  diver: { cols:8, rows:4, fps:6, anims:{"idle":[0,1,2,3,4],"attack":[5,6,8,9],"hit":[7]} },',
'',
'  // WITCH (8x2): Row 0 = flowing walk/hover. 0-5 smooth cycle, 6-7 are stopping poses.',
'  //              Row 1 = casting spell, 8-11 cast sequence, 12-15 standing',
'  witch: { cols:8, rows:2, fps:5, anims:{"idle":[0,1,2,3,4,5],"attack":[8,9,10,11],"hit":[14]} },',
'',
'  // GOLEM (4x3): Row 0: 0-1 walk, 2 turn, 3 arm-raise. Row 1: 4 power-up, 5 walk, 6 reach, 7 slam.',
'  //              Row 2: 8-9 walk, 10 walk, 11 crumble',
'  golem: { cols:4, rows:3, fps:3, anims:{"idle":[0,1,5,8],"attack":[3,4,6,7],"hit":[11]} },',
'',
'  // BOMBER (8x2): Row 0 = wing-flap flying. 0-5 smooth cycle, 6 is turn/break.',
'  //               Row 1 = ground/bomb. 10 has fire/explosion effect.',
'  bomber: { cols:8, rows:2, fps:7, anims:{"idle":[0,1,2,3,4,5],"attack":[9,10],"hit":[14]} },',
'',
'  // SERPENT (4x3): Row 0 = full-body slither (0-3). Row 1 = head close-ups (WRONG SCALE!).',
'  //               Row 2 = coiled poses. Use coiled for attack to keep consistent scale.',
'  serpent: { cols:4, rows:3, fps:5, anims:{"idle":[0,1,2,3],"attack":[0,1,2,3],"hit":[0]} },',
'',
'  // PTERO (8x4): Rows 0-1 have small flying frames (some with UI artifacts).',
'  //              Use row 1 frames 8-13 for cleaner flying cycle. Rows 2-3 are irregular/large.',
'  ptero: { cols:8, rows:4, fps:6, anims:{"idle":[8,9,10,11,12,13]} },',
'',
'  // FIRE GEYSER (8x3): Row 0 = eruption buildup (0-7 tiny to full blast).',
'  //                     Row 1 = dormant rocky mound (8-13). Row 2 = standalone flame columns.',
'  //                     IDLE should be dormant, ATTACK should be eruption!',
'  fire_geyser: { cols:8, rows:3, fps:5, anims:{"idle":[8,9,10],"attack":[0,1,2,3,4,5,6,7]} },',
'',
'  // LOG (8x4): Very irregular sheet. Frame 0 = round log cross-section (clean static frame).',
'  //            Other frames are debris/breaking/stacked — not useful for static obstacle.',
'  //            Use single static frame.',
'  log: { cols:8, rows:4, fps:1, anims:{"idle":[0]} },',
'',
'  // SPIKES (4x3): Has TEXT LABELS baked into most frames! Only frame 4 (row 1, col 0)',
'  //               is a clean spike cluster without text. Use single static frame.',
'  spikes: { cols:4, rows:3, fps:1, anims:{"idle":[4]} }',
'};',
].join(nl);

script = script.replace(oldDefs[0], newDefs);
console.log('✓ Fixed ENEMY_SPRITE_DEFS frame mappings');

// ============================================================
// FIX 2: Fix the fire geyser rendering logic
// The fire geyser sprite should only show the eruption animation
// when the geyser is actively erupting (erupt > 0), otherwise
// show dormant. Currently the idle/attack states are swapped.
// After the DEFS fix above, idle=dormant and attack=eruption,
// which matches the drawObs code that already checks erupt>0
// to choose 'attack' vs 'idle'. So this is already correct after
// the DEFS fix!
// ============================================================
console.log('✓ Fire geyser logic already correct (idle=dormant, attack=eruption)');

// ============================================================
// FIX 3: Adjust rendering sizes for better visual consistency
// Some enemies render too large or too small relative to hitboxes
// ============================================================

// Fix golem draw height — golem is a massive enemy, needs bigger sprite
const oldGolemDraw = 'if(_sp&&_sp.ready){' + nl + '          var _dH=u*4.0,_dW=_dH*(_sp.fw/_sp.fh);' + nl + '          drawEnemySpriteFrame("golem",_enAnimState,en.phase,_dW,_dH,false);';
const newGolemDraw = 'if(_sp&&_sp.ready){' + nl + '          var _dH=u*4.5,_dW=_dH*(_sp.fw/_sp.fh);' + nl + '          drawEnemySpriteFrame("golem",_enAnimState,en.phase*0.7,_dW,_dH,false);';
if (script.includes(oldGolemDraw)) {
  script = script.replace(oldGolemDraw, newGolemDraw);
  console.log('✓ Adjusted golem size and animation speed');
} else {
  console.log('⚠ Golem draw adjustment not found');
}

// Fix serpent — slow down serpent animation to look smoother
const oldSerpentDraw = 'drawEnemySpriteFrame("serpent",_enAnimState,en.phase,_dW,_dH,true)';
const newSerpentDraw = 'drawEnemySpriteFrame("serpent",_enAnimState,en.phase*0.8,_dW,_dH,true)';
if (script.includes(oldSerpentDraw)) {
  script = script.replace(oldSerpentDraw, newSerpentDraw);
  console.log('✓ Slowed serpent animation');
} else {
  console.log('⚠ Serpent draw adjustment not found');
}

// Fix troll — slightly slower for lumbering feel
const oldTrollDraw = 'drawEnemySpriteFrame("troll",_enAnimState,en.phase,_dW,_dH,false)';
const newTrollDraw = 'drawEnemySpriteFrame("troll",_enAnimState,en.phase*0.8,_dW,_dH,false)';
if (script.includes(oldTrollDraw)) {
  script = script.replace(oldTrollDraw, newTrollDraw);
  console.log('✓ Slowed troll animation');
} else {
  console.log('⚠ Troll draw adjustment not found');
}

// ============================================================
// FIX 4: Make static obstacles (log, spikes) not animate at all
// Use a fixed time value instead of G.time so they always show
// the same frame
// ============================================================

// Fix log: use fixed time so it always shows frame 0
const oldLogDraw = 'var _fr=getEnemyFrame("log","idle",obs.lx*0.01)';
const newLogDraw = 'var _fr=getEnemyFrame("log","idle",0)';
if (script.includes(oldLogDraw)) {
  script = script.replace(oldLogDraw, newLogDraw);
  console.log('✓ Fixed log to show static frame');
} else {
  console.log('⚠ Log draw fix not found');
}

// Fix spikes: use fixed time
const oldSpikesDraw = 'var _fr=getEnemyFrame("spikes","idle",G.time)';
const newSpikesDraw = 'var _fr=getEnemyFrame("spikes","idle",0)';
if (script.includes(oldSpikesDraw)) {
  script = script.replace(oldSpikesDraw, newSpikesDraw);
  console.log('✓ Fixed spikes to show static frame');
} else {
  console.log('⚠ Spikes draw fix not found');
}

// ============================================================
// FIX 5: Ptero animation — use phase offset for variety
// ============================================================
const oldPteroDraw = 'var _fr=getEnemyFrame("ptero","idle",G.time+(obs.phase||0)*0.1)';
const newPteroDraw = 'var _fr=getEnemyFrame("ptero","idle",G.time*0.8+(obs.phase||0)*0.5)';
if (script.includes(oldPteroDraw)) {
  script = script.replace(oldPteroDraw, newPteroDraw);
  console.log('✓ Fixed ptero phase offset for variety');
} else {
  console.log('⚠ Ptero draw fix not found');
}

// ============================================================
// FIX 6: Fire geyser animation timing — sync with eruption cycle
// ============================================================
const oldGeyserDraw = 'var _fr=getEnemyFrame("fire_geyser",_as,G.time+obs.lx*0.01)';
const newGeyserDraw = 'var _eruptPhase=erupt>0?erupt:0;var _fr=getEnemyFrame("fire_geyser",_as,_eruptPhase*2+obs.lx*0.001)';
if (script.includes(oldGeyserDraw)) {
  script = script.replace(oldGeyserDraw, newGeyserDraw);
  console.log('✓ Fixed fire geyser eruption sync');
} else {
  console.log('⚠ Fire geyser draw fix not found');
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

console.log('\nDone! Regenerate gameHtml.js next.');
