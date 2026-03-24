/**
 * Fix remaining Phase 1 patches that failed due to CRLF line endings
 */
const fs = require('fs');
const path = require('path');

let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
let changeCount = 0;
const N = '\r\n'; // CRLF

function replace(oldStr, newStr, label) {
  if (!html.includes(oldStr)) {
    console.error(`FAILED: ${label}`);
    console.error(`  Looking for: ${oldStr.substring(0, 100).replace(/\r/g,'\\r').replace(/\n/g,'\\n')}...`);
    return false;
  }
  html = html.replace(oldStr, newStr);
  changeCount++;
  console.log(`  ✓ ${label}`);
  return true;
}

// ============================================================
// 1. Insert env deco layers into drawBg
// ============================================================
console.log('\n=== 1. Env deco layers in drawBg ===');

replace(
  `  // Mountain layers with gradient${N}  drawLayerGrad(bgMtPts,bgTotalW,theme.mt,.08);${N}  drawLayerGrad(bgHlPts,bgTotalW,theme.hl,.25);${N}  drawTerrain(theme);${N}}`,
  `  // Mountain layers with gradient${N}  drawLayerGrad(bgMtPts,bgTotalW,theme.mt,.08);${N}${N}  // Far environment decorations${N}  var _tn = Object.keys(THEMES).find(function(k){return THEMES[k]===theme;}) || 'JUNGLE';${N}  if (_perfLevel > 0) drawEnvDecoLayer(theme, _tn, 0);${N}${N}  drawLayerGrad(bgHlPts,bgTotalW,theme.hl,.25);${N}${N}  // Mid environment decorations${N}  if (_perfLevel > 0) drawEnvDecoLayer(theme, _tn, 1);${N}${N}  // Near environment decorations (just behind terrain)${N}  drawEnvDecoLayer(theme, _tn, 2);${N}${N}  drawTerrain(theme);${N}}`,
  'Insert env deco layers into drawBg'
);

// ============================================================
// 2. Textured ground
// ============================================================
console.log('\n=== 2. Textured ground ===');

const oldTerrain = `function drawTerrain(theme){${N}  if(!chunks.length)return;${N}  const step=6, u=UNIT;${N}  // Gradient terrain fill${N}  const grd=ctx.createLinearGradient(0,GROUND_BASE-u*2,0,H);${N}  grd.addColorStop(0,theme.gf);${N}  grd.addColorStop(0.5,darkenColor(theme.gf,15));${N}  grd.addColorStop(1,darkenColor(theme.gf,35));${N}  ctx.fillStyle=grd;ctx.beginPath();ctx.moveTo(0,H);${N}  for(let sx=0;sx<=W;sx+=step)ctx.lineTo(sx,getGroundAt(sx+worldOffset));${N}  ctx.lineTo(W,H);ctx.closePath();ctx.fill();${N}  // Edge highlight (1px lighter line on top)${N}  ctx.strokeStyle=lightenColor(theme.gt,40);ctx.lineWidth=1.5;ctx.lineCap='round';${N}  ctx.beginPath();${N}  for(let sx=0;sx<=W;sx+=step){const gy=getGroundAt(sx+worldOffset);sx===0?ctx.moveTo(sx,gy):ctx.lineTo(sx,gy);}${N}  ctx.stroke();${N}  // Main terrain edge${N}  ctx.strokeStyle=theme.gt;ctx.lineWidth=u*.22;ctx.lineCap='round';${N}  ctx.beginPath();${N}  for(let sx=0;sx<=W;sx+=step){const gy=getGroundAt(sx+worldOffset);sx===0?ctx.moveTo(sx,gy):ctx.lineTo(sx,gy);}${N}  ctx.stroke();${N}  // Grass tufts removed (looked bad on device)${N}}`;

const newTerrain = `function drawTerrain(theme){${N}  if(!chunks.length)return;${N}  const step=6, u=UNIT;${N}  var _tn = Object.keys(THEMES).find(function(k){return THEMES[k]===theme;}) || 'JUNGLE';${N}  // Gradient terrain fill${N}  const grd=ctx.createLinearGradient(0,GROUND_BASE-u*2,0,H);${N}  grd.addColorStop(0,theme.gf);${N}  grd.addColorStop(0.5,darkenColor(theme.gf,15));${N}  grd.addColorStop(1,darkenColor(theme.gf,35));${N}  ctx.fillStyle=grd;ctx.beginPath();ctx.moveTo(0,H);${N}  for(let sx=0;sx<=W;sx+=step)ctx.lineTo(sx,getGroundAt(sx+worldOffset));${N}  ctx.lineTo(W,H);ctx.closePath();ctx.fill();${N}  // Terrain texture details${N}  if (_perfLevel > 0) {${N}    ctx.save();${N}    var texStep = u * 1.2;${N}    for (var tx = -texStep; tx < W + texStep; tx += texStep) {${N}      var gy = getGroundAt(tx + worldOffset);${N}      var seed = Math.floor((tx + worldOffset) / texStep);${N}      var rr = ((seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;${N}      if (_tn === 'JUNGLE' || _tn === 'SWAMP') {${N}        if (rr > 0.4) {${N}          ctx.strokeStyle = lightenColor(theme.gt, 15 + rr * 20);${N}          ctx.lineWidth = 1 + rr;${N}          ctx.beginPath();${N}          ctx.moveTo(tx, gy);${N}          ctx.quadraticCurveTo(tx + u * (rr - 0.5) * 0.6, gy - u * (0.2 + rr * 0.35), tx + u * (rr - 0.5) * 0.3, gy - u * (0.15 + rr * 0.25));${N}          ctx.stroke();${N}        }${N}      } else if (_tn === 'VOLCANO') {${N}        if (rr > 0.7) {${N}          ctx.fillStyle = 'rgba(255,80,0,' + (0.15 + rr * 0.15) + ')';${N}          ctx.beginPath(); ctx.arc(tx, gy + u * 0.3, u * 0.08, 0, PI2); ctx.fill();${N}        }${N}      } else if (_tn === 'GLACIER') {${N}        if (rr > 0.6) {${N}          ctx.fillStyle = 'rgba(200,240,255,' + (0.2 + rr * 0.3) + ')';${N}          ctx.beginPath(); ctx.arc(tx, gy + u * 0.15, u * 0.04, 0, PI2); ctx.fill();${N}        }${N}      } else if (_tn === 'SKY') {${N}        if (rr > 0.65) {${N}          ctx.fillStyle = 'rgba(255,255,255,0.08)';${N}          ctx.beginPath(); ctx.ellipse(tx, gy + u * 0.1, u * 0.5, u * 0.15, 0, 0, PI2); ctx.fill();${N}        }${N}      }${N}    }${N}    ctx.restore();${N}  }${N}  // Edge highlight${N}  ctx.strokeStyle=lightenColor(theme.gt,40);ctx.lineWidth=1.5;ctx.lineCap='round';${N}  ctx.beginPath();${N}  for(let sx=0;sx<=W;sx+=step){const gy=getGroundAt(sx+worldOffset);sx===0?ctx.moveTo(sx,gy):ctx.lineTo(sx,gy);}${N}  ctx.stroke();${N}  // Main terrain edge${N}  ctx.strokeStyle=theme.gt;ctx.lineWidth=u*.22;ctx.lineCap='round';${N}  ctx.beginPath();${N}  for(let sx=0;sx<=W;sx+=step){const gy=getGroundAt(sx+worldOffset);sx===0?ctx.moveTo(sx,gy):ctx.lineTo(sx,gy);}${N}  ctx.stroke();${N}  // Darker sub-edge${N}  ctx.strokeStyle=darkenColor(theme.gt,20);ctx.lineWidth=u*.12;${N}  ctx.beginPath();${N}  for(let sx=0;sx<=W;sx+=step){const gy=getGroundAt(sx+worldOffset);sx===0?ctx.moveTo(sx,gy+u*.15):ctx.lineTo(sx,gy+u*.15);}${N}  ctx.stroke();${N}}`;

replace(oldTerrain, newTerrain, 'Textured ground with theme-specific details');

// ============================================================
// 3. Menu screen redesign
// ============================================================
console.log('\n=== 3. Menu redesign ===');

const oldMenu = `function drawMenu(){${N}  const u=UNIT;${N}  // Animate BG${N}  worldOffset+=80*DT;`;
const newMenu = `function drawMenu(){${N}  const u=UNIT;${N}  // Animate BG with faster scroll${N}  worldOffset+=120*DT;`;
replace(oldMenu, newMenu, 'Speed up menu background scroll');

replace(
  `  ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(0,0,W,H);`,
  `  // Atmospheric gradient overlay${N}  var menuGrad = ctx.createLinearGradient(0,0,0,H);${N}  menuGrad.addColorStop(0,'rgba(0,0,0,0.7)');menuGrad.addColorStop(0.35,'rgba(0,0,0,0.35)');${N}  menuGrad.addColorStop(0.65,'rgba(0,0,0,0.3)');menuGrad.addColorStop(1,'rgba(0,0,0,0.65)');${N}  ctx.fillStyle=menuGrad;ctx.fillRect(0,0,W,H);`,
  'Menu gradient overlay'
);

replace(
  `  ctx.shadowColor='#FFD700';ctx.shadowBlur=20;${N}  ctx.font=\`bold \${u*2.5}px monospace\`;ctx.fillStyle='#FFD700';${N}  ctx.fillText("GRONK'S RUN",W/2,H*.24);ctx.shadowBlur=0;`,
  `  // Animated bouncing title${N}  var titleBounce = Math.sin(Date.now()*.003)*u*0.15;${N}  var titleScale = 1 + Math.sin(Date.now()*.002)*0.03;${N}  ctx.save(); ctx.translate(W/2, H*.22 + titleBounce); ctx.scale(titleScale, titleScale);${N}  ctx.shadowColor='rgba(0,0,0,0.8)';ctx.shadowBlur=15;ctx.shadowOffsetY=4;${N}  ctx.font=\`bold \${u*2.5}px monospace\`;ctx.fillStyle='#B8860B';${N}  ctx.fillText("GRONK'S RUN",0,u*0.1);${N}  ctx.shadowColor='#FFD700';ctx.shadowBlur=25;ctx.shadowOffsetY=0;${N}  ctx.fillStyle='#FFD700';ctx.fillText("GRONK'S RUN",0,0);${N}  ctx.shadowBlur=0;ctx.globalAlpha=0.3;ctx.fillStyle='#FFFFAA';${N}  ctx.fillText("GRONK'S RUN",0,-u*0.08);ctx.globalAlpha=1;${N}  ctx.restore();`,
  'Animated bouncing title with shadow'
);

replace(
  `  ctx.font=\`\${u*.85}px monospace\`;ctx.fillStyle='#88CCFF';${N}  ctx.fillText('Prehistoric Survival!',W/2,H*.24+u*2.2);`,
  `  ctx.font=\`\${u*.85}px monospace\`;ctx.fillStyle='#88CCFF';${N}  ctx.fillText('Prehistoric Survival!',W/2,H*.24+u*2.5);`,
  'Adjust subtitle position'
);

replace(
  `  if(Math.sin(Date.now()*.004)>0){${N}    ctx.font=\`bold \${u*1.1}px monospace\`;ctx.fillStyle='white';${N}    ctx.fillText('TAP TO START',W/2,H*.55);${N}  }`,
  `  var tapAlpha = 0.5 + Math.sin(Date.now()*.004)*0.5;${N}  ctx.globalAlpha = Math.max(0.05, tapAlpha);${N}  ctx.font=\`bold \${u*1.1}px monospace\`;ctx.fillStyle='white';${N}  ctx.shadowColor='rgba(255,255,255,0.5)';ctx.shadowBlur=10;${N}  ctx.fillText('TAP TO START',W/2,H*.55);${N}  ctx.shadowBlur=0;ctx.globalAlpha=1;`,
  'Smooth TAP TO START fade pulse'
);

// ============================================================
// 4. Fix transitions
// ============================================================
console.log('\n=== 4. Transitions ===');

replace(
  `    stopMusic(); G.phase='LEVEL_MAP'; G._nextLevelNum=0;${N}    var _cl=save.highestLevel+1; G.mapTargetScrollY=Math.max(0,_cl*UNIT*4-H/2); G.mapScrollY=G.mapTargetScrollY;`,
  `    stopMusic();${N}    transitionTo('LEVEL_MAP', function(){G._nextLevelNum=0;var _cl=save.highestLevel+1;G.mapTargetScrollY=Math.max(0,_cl*UNIT*4-H/2);G.mapScrollY=G.mapTargetScrollY;});`,
  'Transition: death → level map'
);

// Find the pause → level map transition
replace(
  `    G.phase='LEVEL_MAP'; sfxUITap(); return;${N}  }${N}}${N}${N}// ============================================================${N}// TUTORIAL`,
  `    transitionTo('LEVEL_MAP'); sfxUITap(); return;${N}  }${N}}${N}${N}// ============================================================${N}// TUTORIAL`,
  'Transition: pause → level map'
);

// Shop → level map (look for it more specifically)
// Find the shop tap handler
const shopBackIdx = html.indexOf("G.phase='LEVEL_MAP'; sfxUITap();\r\n}");
if (shopBackIdx > -1 && html.substring(shopBackIdx - 200, shopBackIdx).includes('shop')) {
  html = html.substring(0, shopBackIdx) + "transitionTo('LEVEL_MAP'); sfxUITap();\r\n}" + html.substring(shopBackIdx + "G.phase='LEVEL_MAP'; sfxUITap();\r\n}".length);
  changeCount++;
  console.log('  ✓ Transition: shop → level map');
}

// ============================================================
// 5. Enhanced level map
// ============================================================
console.log('\n=== 5. Level map ===');

replace(
  `  ctx.fillStyle='#0a1628'; ctx.fillRect(0,0,W,H);`,
  `  // Rich gradient background${N}  var lmGrad = ctx.createLinearGradient(0,0,0,H);${N}  lmGrad.addColorStop(0,'#050d1e');lmGrad.addColorStop(0.3,'#0a1628');lmGrad.addColorStop(0.7,'#101830');lmGrad.addColorStop(1,'#0a0f20');${N}  ctx.fillStyle=lmGrad; ctx.fillRect(0,0,W,H);${N}  // Nebula effect${N}  if (_perfLevel > 0) {${N}    ctx.save();ctx.globalCompositeOperation='lighter';${N}    var nt = (G.time||Date.now()*.001)*0.3;${N}    for(var ni=0;ni<3;ni++){${N}      var nnx = W*(0.3+ni*0.2) + Math.sin(nt+ni*2.1)*W*0.15;${N}      var nny = H*(0.2+ni*0.15) + Math.cos(nt*0.7+ni*1.3)*H*0.1;${N}      var nGrad = ctx.createRadialGradient(nnx,nny,0,nnx,nny,H*0.3);${N}      var hue = (nt*20+ni*60)%360;${N}      nGrad.addColorStop(0,'hsla('+hue+',60%,40%,0.04)');${N}      nGrad.addColorStop(0.5,'hsla('+hue+',50%,30%,0.02)');${N}      nGrad.addColorStop(1,'transparent');${N}      ctx.fillStyle=nGrad;ctx.fillRect(0,0,W,H);${N}    }${N}    ctx.globalCompositeOperation='source-over';ctx.restore();${N}  }`,
  'Enhanced level map background'
);

// Twinkling stars
replace(
  `  // Draw decorative background elements (stars, dots)${N}  for(let i=0;i<50;i++){`,
  `  // Draw decorative background elements (twinkling stars)${N}  var _starT = (G.time||Date.now()*.001);${N}  for(let i=0;i<50;i++){`,
  'Animate map stars'
);

replace(
  `    ctx.fillStyle=\`rgba(255,255,255,\${0.1+((i*7)%5)*0.06})\`;`,
  `    var _tw = 0.1+((i*7)%5)*0.06 + Math.sin(_starT*2+i*1.7)*0.08;${N}    ctx.fillStyle=\`rgba(255,255,255,\${_tw})\`;`,
  'Add twinkling to stars'
);

// ============================================================
// 6. Hook death tumble trigger
// ============================================================
console.log('\n=== 6. Death tumble trigger ===');

replace(
  `function spawnDeathFX(x,y) {${N}  const _deathParts`,
  `function spawnDeathFX(x,y) {${N}  startDeathTumble(x, y);${N}  const _deathParts`,
  'Trigger death tumble on death'
);

// ============================================================
// 7. Hook updates into main loop
// ============================================================
console.log('\n=== 7. Main loop hooks ===');

// Find updateFade(dt) call in the main loop and add hooks after it
replace(
  `  updateFade(dt);`,
  `  updateFade(dt);updateDeathTumble(DT);updateAnnouncement(DT);`,
  'Hook updates into main loop'
);

// Hook speed lines - find drawPostEffects in PLAYING phase
replace(
  `      drawPostEffects(themeName);`,
  `      drawSpeedLines();drawPostEffects(themeName);`,
  'Hook speed lines (first)'
);

// Second drawPostEffects (boss fight)
const secondPostIdx = html.indexOf('drawPostEffects(themeName);', html.indexOf('drawSpeedLines();drawPostEffects(themeName);') + 50);
if (secondPostIdx > -1) {
  html = html.substring(0, secondPostIdx) + 'drawSpeedLines();' + html.substring(secondPostIdx);
  changeCount++;
  console.log('  ✓ Hook speed lines (second)');
}

// ============================================================
// DONE
// ============================================================
console.log(`\n=== Applied ${changeCount} additional fixes ===`);
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
const stat = fs.statSync(path.join(__dirname, 'index.html'));
console.log(`File size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
