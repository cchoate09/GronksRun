/**
 * Phase 2: Gameplay Feel — "Make it feel amazing"
 * 1. Near-miss slow-motion
 * 2. Floating damage numbers on enemy hits
 * 3. Power-up announcement banners
 * 4. Combo escalation visuals
 * 5. Camera shake variety
 * 6. Improved onboarding
 */
const fs = require('fs');
const path = require('path');

let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const N = '\r\n';
let changeCount = 0;

function replace(oldStr, newStr, label) {
  if (!html.includes(oldStr)) {
    console.error(`FAILED: ${label}`);
    console.error(`  Looking for: ${oldStr.substring(0, 120).replace(/\r/g,'\\r').replace(/\n/g,'\\n')}...`);
    return false;
  }
  html = html.replace(oldStr, newStr);
  changeCount++;
  console.log(`  ✓ ${label}`);
  return true;
}

// ============================================================
// 1. NEAR-MISS SLOW-MOTION
// ============================================================
console.log('\n=== 1. Near-Miss Slow-Motion ===');

// Hook slow-mo into near-miss detection
replace(
  `          obs._missed=true; nearMissCD=0.8;${N}          G.combo += 2; // near-miss gives +2 combo`,
  `          obs._missed=true; nearMissCD=0.8;${N}          triggerSlowMo(0.15);${N}          G.combo += 2; // near-miss gives +2 combo`,
  'Trigger slow-mo on near-miss'
);

// Apply slow-mo factor to DT in the main loop
// Find where DT is set
replace(
  `  var DT=Math.min(Math.max(dt,0.001),0.05);`,
  `  var DT=Math.min(Math.max(dt,0.001),0.05);${N}  updateSlowMo(DT);${N}  DT *= _slowMoFactor;`,
  'Apply slow-mo to DT'
);

// Add visual indicator during slow-mo (radial blue tint)
replace(
  `function drawSpeedLines() {`,
  `function drawSlowMoEffect() {${N}  if (_slowMoTimer <= 0) return;${N}  ctx.save();${N}  var alpha = clamp(_slowMoTimer / 0.15, 0, 0.25);${N}  var grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.7);${N}  grad.addColorStop(0, 'rgba(100,180,255,0)');${N}  grad.addColorStop(0.6, 'rgba(100,180,255,0)');${N}  grad.addColorStop(1, 'rgba(80,150,255,' + alpha + ')');${N}  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);${N}  // Time distortion lines${N}  ctx.strokeStyle = 'rgba(150,200,255,' + (alpha*0.5) + ')';${N}  ctx.lineWidth = 2;${N}  for (var i = 0; i < 4; i++) {${N}    var ly = H * (0.2 + i * 0.2);${N}    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly + Math.sin(G.time*10+i)*5); ctx.stroke();${N}  }${N}  ctx.restore();${N}}${N}${N}function drawSpeedLines() {`,
  'Add slow-mo visual effect'
);

// Hook slow-mo visual into render
replace(
  `      drawSpeedLines();drawPostEffects(G.levelDef.theme);`,
  `      drawSlowMoEffect();drawSpeedLines();drawPostEffects(G.levelDef.theme);`,
  'Hook slow-mo visual into render'
);

// ============================================================
// 2. FLOATING DAMAGE NUMBERS ON ENEMY HITS
// ============================================================
console.log('\n=== 2. Floating Damage Numbers ===');

// Add damage number when enemy takes damage
replace(
  `  takeDamage(amt) {${N}    if(this.dying||!this.alive) return;${N}    this.hp -= amt;${N}    this.hpFlash = 0.3;`,
  `  takeDamage(amt) {${N}    if(this.dying||!this.alive) return;${N}    this.hp -= amt;${N}    this.hpFlash = 0.3;${N}    // Floating damage number${N}    var _sx = this.sx || this.screenX || 0, _sy = this.sy || this.y || 0;${N}    spawnFloatingText(_sx, _sy - UNIT*2, '-' + amt, '#FF6644', 0.9);`,
  'Add damage numbers on enemy hit'
);

// Add "ENEMY DOWN!" floating text on kill
replace(
  `      this.dying=true; this.deathTimer=0.4;${N}      comboAction(50,'enemy_kill');${N}      G.score+=50; G.runScore+=50;${N}      G.announce={text:'ENEMY DOWN! +50',life:0.6};`,
  `      this.dying=true; this.deathTimer=0.4;${N}      comboAction(50,'enemy_kill');${N}      G.score+=50; G.runScore+=50;${N}      spawnFloatingText(_sx, _sy - UNIT*3, 'ENEMY DOWN! +50', '#FFD700', 1.2);${N}      spawnDeathFX(_sx, _sy - UNIT);`,
  'Add floating kill text and death FX on enemy kill'
);

// Add floating damage number when PLAYER takes damage
replace(
  `    this.hp -= amount;${N}    this.hpFlash = 0.4;${N}    sfxHit();${N}    comboBreak();${N}    this.iframes = 0.8; // brief invincibility after taking damage${N}    addTrauma(clamp(amount/50, 0.15, 0.6));${N}    // Damage number popup${N}    G.announce={text:\`-\${amount} HP\`,life:0.7};`,
  `    this.hp -= amount;${N}    this.hpFlash = 0.4;${N}    sfxHit();${N}    comboBreak();${N}    this.iframes = 0.8;${N}    addTrauma(clamp(amount/50, 0.15, 0.6));${N}    // Floating damage number on player${N}    spawnFloatingText(this.screenX, this.y - UNIT*2, '-' + amount, '#FF4444', 1.1);`,
  'Add floating damage number on player hit'
);

// ============================================================
// 3. POWER-UP ANNOUNCEMENT BANNERS
// ============================================================
console.log('\n=== 3. Power-up Announcements ===');

// Hook announcements into applyWheelPowerup
replace(
  `function applyWheelPowerup(type) {${N}  const p = G.player;${N}  if (!p) return;${N}  switch(type) {${N}    case 'SHIELD': p.shield=true; break;${N}    case 'SPEED': p.speedBoost=true; break;${N}    case 'MAGNET': p.magnetTimer=999; break;${N}    case 'EXTRA_LIFE': p.extraLife=true; break;${N}    case 'STAR': p.starTimer=12; p.starHue=0; break;${N}    case 'TIME': G.timeLeft=Math.min(G.timeLeft+10,99); break;${N}    case 'DOUBLE': p.doubleScore=true; break;${N}    case 'TINY': p.tinyTimer=30; break; // 30 seconds of tiny hitbox${N}  }${N}}`,
  `function applyWheelPowerup(type) {${N}  const p = G.player;${N}  if (!p) return;${N}  var _pName = '', _pColor = '#FFD700';${N}  switch(type) {${N}    case 'SHIELD': p.shield=true; _pName='SHIELD ACTIVATED'; _pColor='#44AAFF'; break;${N}    case 'SPEED': p.speedBoost=true; _pName='SPEED BOOST!'; _pColor='#FF8800'; break;${N}    case 'MAGNET': p.magnetTimer=999; _pName='GEM MAGNET!'; _pColor='#CC44FF'; break;${N}    case 'EXTRA_LIFE': p.extraLife=true; _pName='EXTRA LIFE!'; _pColor='#44FF66'; break;${N}    case 'STAR': p.starTimer=12; p.starHue=0; _pName='STAR POWER!'; _pColor='#FFD700'; break;${N}    case 'TIME': G.timeLeft=Math.min(G.timeLeft+10,99); _pName='+10 SECONDS!'; _pColor='#4488FF'; break;${N}    case 'DOUBLE': p.doubleScore=true; _pName='DOUBLE SCORE!'; _pColor='#FF4466'; break;${N}    case 'TINY': p.tinyTimer=30; _pName='TINY HITBOX!'; _pColor='#00FFCC'; break;${N}  }${N}  if (_pName && G.phase === 'PLAYING') showAnnouncement(_pName, _pColor);${N}}`,
  'Add power-up announcements'
);

// Also announce gem milestone upgrades
replace(
  `    if (now > prev) {${N}      applyUpgrade(m, p);`,
  `    if (now > prev) {${N}      applyUpgrade(m, p);${N}      var _mName = {SHIELD:'SHIELD UNLOCKED!',MAGNET:'GEM MAGNET!',EXTRA_LIFE:'EXTRA LIFE!',STAR:'STAR POWER!'}[m.type];${N}      if (_mName) showAnnouncement(_mName, '#FFD700');`,
  'Announce gem milestone upgrades'
);

// ============================================================
// 4. COMBO ESCALATION VISUALS
// ============================================================
console.log('\n=== 4. Combo Escalation Visuals ===');

// Replace the combo display with enhanced visuals
replace(
  `  // Combo display${N}  if(G.combo > 0){${N}    const comboY = pad+u*2.2;${N}    const colors = ['#FFFFFF','#FFD700','#FF8800','#FF4444','#FF00FF','#00FFFF','#FF0088'];${N}    const cIdx = Math.min(Math.floor(G.combo/5), colors.length-1);${N}    let comboCol = colors[cIdx];${N}    if(G.combo >= 30) comboCol = \`hsl(\${(G.time*360)%360},100%,60%)\`; // rainbow at high combos${N}    const cPulse = 1 + (G.comboPulse > 0 ? G.comboPulse * 0.3 : 0);${N}    if(G.comboPulse > 0) G.comboPulse -= dt * 2;${N}    ctx.save();ctx.translate(pad + u*2.5, comboY);ctx.scale(cPulse,cPulse);${N}    ctx.font=\`bold \${u*.65}px monospace\`;ctx.textAlign='left';ctx.textBaseline='top';${N}    ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillText(\`COMBO x\${G.combo}! (\${G.comboMult}.0x)\`,2,2);${N}    ctx.fillStyle=comboCol;ctx.fillText(\`COMBO x\${G.combo}! (\${G.comboMult}.0x)\`,0,0);${N}    ctx.restore();${N}  }`,
  `  // Combo display with escalation effects${N}  if(G.combo > 0){${N}    const comboY = pad+u*2.2;${N}    const colors = ['#FFFFFF','#FFD700','#FF8800','#FF4444','#FF00FF','#00FFFF','#FF0088'];${N}    const cIdx = Math.min(Math.floor(G.combo/5), colors.length-1);${N}    let comboCol = colors[cIdx];${N}    if(G.combo >= 30) comboCol = \`hsl(\${(G.time*360)%360},100%,60%)\`;${N}    const cPulse = 1 + (G.comboPulse > 0 ? G.comboPulse * 0.3 : 0);${N}    if(G.comboPulse > 0) G.comboPulse -= dt * 2;${N}    ctx.save();ctx.translate(pad + u*2.5, comboY);ctx.scale(cPulse,cPulse);${N}    // Glow effect at high combos${N}    if(G.combo >= 10){${N}      var glowInt = Math.min((G.combo-10)/40, 1);${N}      ctx.shadowColor = comboCol;${N}      ctx.shadowBlur = 8 + glowInt * 20;${N}    }${N}    // Size escalation${N}    var comboSize = Math.min(u*0.65 + G.combo*u*0.005, u*0.95);${N}    ctx.font=\`bold \${comboSize}px monospace\`;ctx.textAlign='left';ctx.textBaseline='top';${N}    ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillText(\`COMBO x\${G.combo}! (\${G.comboMult}.0x)\`,2,2);${N}    ctx.fillStyle=comboCol;ctx.fillText(\`COMBO x\${G.combo}! (\${G.comboMult}.0x)\`,0,0);${N}    ctx.shadowBlur=0;${N}    // Fire particles at 20+ combo${N}    if(G.combo >= 20 && _perfLevel > 0 && Math.random() < 0.3){${N}      var _fhue = G.combo >= 50 ? (G.time*360)%360 : G.combo >= 30 ? 40 : 20;${N}      spawnParticle(pad+u*2.5+Math.random()*u*4, comboY+Math.random()*u*0.5, {${N}        vx:(Math.random()-0.5)*60, vy:-60-Math.random()*80,${N}        color:\`hsl(\${_fhue},100%,\${50+Math.random()*30}%)\`,${N}        r:UNIT*(0.08+Math.random()*0.1), decay:2, grav:100${N}      });${N}    }${N}    ctx.restore();${N}  }`,
  'Enhanced combo display with glow, scaling, and fire particles'
);

// ============================================================
// 5. CAMERA SHAKE VARIETY
// ============================================================
console.log('\n=== 5. Camera Shake Variety ===');

// Enhance the shake system with directional bias
replace(
  `function addTrauma(v) { if(save.screenShake===false) return; trauma=Math.min(trauma+v,1); }${N}function updateShake(dt) {${N}  trauma=Math.max(0,trauma-1.8*dt);${N}  const s=trauma*trauma, m=UNIT*1.8;${N}  shX=(Math.random()-.5)*2*m*s; shY=(Math.random()-.5)*2*m*s;${N}}`,
  `var _shakeBiasX = 0, _shakeBiasY = 0;${N}function addTrauma(v, biasX, biasY) { if(save.screenShake===false) return; trauma=Math.min(trauma+v,1); _shakeBiasX=(biasX||0); _shakeBiasY=(biasY||0); }${N}function updateShake(dt) {${N}  trauma=Math.max(0,trauma-1.8*dt);${N}  _shakeBiasX *= 0.9; _shakeBiasY *= 0.9;${N}  const s=trauma*trauma, m=UNIT*1.8;${N}  shX=(Math.random()-.5)*2*m*s + _shakeBiasX*s*UNIT*3;${N}  shY=(Math.random()-.5)*2*m*s + _shakeBiasY*s*UNIT*3;${N}}`,
  'Enhanced shake with directional bias'
);

// Add downward shake bias on ground pound
replace(
  `    addTrauma(.3);${N}    // Damage nearby enemies with pound`,
  `    addTrauma(.4, 0, 1);${N}    // Damage nearby enemies with pound`,
  'Directional shake on ground pound'
);

// ============================================================
// 6. IMPROVED ONBOARDING
// ============================================================
console.log('\n=== 6. Improved Onboarding ===');

// Enhance tutorial tips with animated hand/arrow indicators
replace(
  `const TUTORIAL_TIPS = [${N}  { level:1, delay:0.5, text:'Swipe UP to jump!', duration:4 },${N}  { level:1, delay:6, text:'Swipe RIGHT to dash forward!', duration:4 },${N}  { level:1, delay:12, text:'Collect gems for powerups!', duration:3.5 },${N}  { level:2, delay:1, text:'Swipe DOWN to slide under obstacles!', duration:4 },${N}  { level:2, delay:8, text:'Stomp in the air to ground pound!', duration:4 },${N}  { level:3, delay:1, text:'Enemies have HP — attack them!', duration:4 },${N}  { level:3, delay:8, text:'Dash into enemies to deal damage!', duration:4 },${N}  { level:4, delay:1, text:'Watch for red "!" — enemies are about to attack!', duration:4.5 },${N}  { level:4, delay:8, text:'Dash into projectiles to parry them!', duration:4 },${N}  { level:5, delay:1, text:'Boss fight at level 5! Good luck!', duration:4 },${N}];`,
  `const TUTORIAL_TIPS = [${N}  { level:1, delay:0.5, text:'Swipe UP to jump!', duration:4, icon:'up' },${N}  { level:1, delay:6, text:'Swipe RIGHT to dash forward!', duration:4, icon:'right' },${N}  { level:1, delay:12, text:'Collect gems for powerups!', duration:3.5, icon:'gem' },${N}  { level:2, delay:1, text:'Swipe DOWN to slide under obstacles!', duration:4, icon:'down' },${N}  { level:2, delay:7, text:'Stomp DOWN in the air to ground pound!', duration:4, icon:'down' },${N}  { level:3, delay:1, text:'Enemies have HP — attack them!', duration:4, icon:'right' },${N}  { level:3, delay:7, text:'Dash INTO enemies to deal damage!', duration:4, icon:'right' },${N}  { level:4, delay:1, text:'Watch for red "!" — enemy attacking!', duration:4, icon:'warn' },${N}  { level:4, delay:7, text:'Dash into projectiles to parry them!', duration:4, icon:'right' },${N}  { level:5, delay:1, text:'BOSS FIGHT! Attack it to win!', duration:4, icon:'warn' },${N}  { level:1, delay:18, text:'Near-misses give bonus combo points!', duration:3.5 },${N}  { level:6, delay:1, text:'Try different characters in the menu!', duration:4 },${N}];`,
  'Enhanced tutorial tips with icons and more tips'
);

// Enhance the tooltip drawing with animated arrows
replace(
  `function drawTooltip(){${N}  if(!tooltipState.active || tooltipState.alpha <= 0) return;${N}  const u = UNIT, a = tooltipState.alpha;${N}  const tw = ctx.measureText(tooltipState.text).width;${N}  const padX = u*0.8, padY = u*0.4;${N}  const bw = tw + padX*2, bh = u*1.2;${N}  const bx = W/2 - bw/2, by = H*0.22;${N}  ctx.save();${N}  ctx.globalAlpha = a * 0.85;${N}  ctx.fillStyle = 'rgba(0,0,0,0.75)';${N}  fillRR(bx, by, bw, bh, u*0.3, 'rgba(0,0,0,0.75)', 'rgba(255,215,0,0.6)', 2);${N}  ctx.globalAlpha = a;`,
  `function drawTooltip(){${N}  if(!tooltipState.active || tooltipState.alpha <= 0) return;${N}  const u = UNIT, a = tooltipState.alpha;${N}  ctx.font=\`bold \${u*0.55}px monospace\`;${N}  const tw = ctx.measureText(tooltipState.text).width;${N}  const padX = u*0.8, padY = u*0.4;${N}  const bw = tw + padX*2 + u*1.5, bh = u*1.4;${N}  const bx = W/2 - bw/2, by = H*0.2;${N}  ctx.save();${N}  ctx.globalAlpha = a * 0.9;${N}  ctx.fillStyle = 'rgba(0,0,0,0.8)';${N}  fillRR(bx, by, bw, bh, u*0.3, 'rgba(0,0,0,0.8)', 'rgba(255,215,0,0.7)', 2.5);${N}  ctx.globalAlpha = a;${N}  // Draw animated arrow indicator${N}  var _tipIcon = tooltipState.icon || '';${N}  if (_tipIcon) {${N}    var arrowX = bx + u*0.8, arrowY = by + bh/2;${N}    var bounce = Math.sin(G.time*6)*u*0.15;${N}    ctx.fillStyle = '#FFD700'; ctx.strokeStyle = '#FFD700'; ctx.lineWidth = u*0.08;${N}    ctx.lineCap = 'round';${N}    if (_tipIcon === 'up') {${N}      ctx.beginPath(); ctx.moveTo(arrowX, arrowY+bounce-u*0.2); ctx.lineTo(arrowX-u*0.2, arrowY+bounce+u*0.15); ctx.lineTo(arrowX+u*0.2, arrowY+bounce+u*0.15); ctx.closePath(); ctx.fill();${N}    } else if (_tipIcon === 'down') {${N}      ctx.beginPath(); ctx.moveTo(arrowX, arrowY-bounce+u*0.2); ctx.lineTo(arrowX-u*0.2, arrowY-bounce-u*0.15); ctx.lineTo(arrowX+u*0.2, arrowY-bounce-u*0.15); ctx.closePath(); ctx.fill();${N}    } else if (_tipIcon === 'right') {${N}      ctx.beginPath(); ctx.moveTo(arrowX+bounce+u*0.2, arrowY); ctx.lineTo(arrowX+bounce-u*0.15, arrowY-u*0.2); ctx.lineTo(arrowX+bounce-u*0.15, arrowY+u*0.2); ctx.closePath(); ctx.fill();${N}    } else if (_tipIcon === 'gem') {${N}      ctx.beginPath(); ctx.moveTo(arrowX, arrowY-u*0.25+bounce*0.5); ctx.lineTo(arrowX+u*0.15, arrowY-u*0.05); ctx.lineTo(arrowX+u*0.15, arrowY+u*0.1); ctx.lineTo(arrowX, arrowY+u*0.25); ctx.lineTo(arrowX-u*0.15, arrowY+u*0.1); ctx.lineTo(arrowX-u*0.15, arrowY-u*0.05); ctx.closePath(); ctx.fill();${N}    } else if (_tipIcon === 'warn') {${N}      ctx.font=\`bold \${u*0.7}px monospace\`; ctx.textAlign='center'; ctx.textBaseline='middle';${N}      ctx.fillStyle = '#FF4444'; ctx.fillText('!', arrowX, arrowY+bounce*0.5);${N}    }${N}  }`,
  'Enhanced tooltip with animated directional arrows'
);

// Store icon in tooltipState when triggering
replace(
  `      tooltipState.active = true;${N}      tooltipState.text = next.text;${N}      tooltipState.timer = next.duration;${N}      tooltipState.alpha = 0;`,
  `      tooltipState.active = true;${N}      tooltipState.text = next.text;${N}      tooltipState.timer = next.duration;${N}      tooltipState.alpha = 0;${N}      tooltipState.icon = next.icon || '';`,
  'Pass icon to tooltip state'
);

// ============================================================
// BONUS: Screen flash on big hits
// ============================================================
console.log('\n=== Bonus: Hit feedback ===');

// Add screen flash when shield breaks
replace(
  `      this.shield=false; this.iframes=1.5; addTrauma(.4);${N}      sfxShield();`,
  `      this.shield=false; this.iframes=1.5; addTrauma(.5, 0, 0);${N}      sfxShield();${N}      G.flashColor='rgba(100,180,255,0.3)'; G.flashLife=0.25;`,
  'Blue flash when shield breaks'
);

// ============================================================
// DONE
// ============================================================
console.log(`\n=== Applied ${changeCount} changes ===`);
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
const stat = fs.statSync(path.join(__dirname, 'index.html'));
console.log(`File size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
