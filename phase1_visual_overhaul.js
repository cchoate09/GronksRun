/**
 * Phase 1 Visual Overhaul — Comprehensive patch script
 * 1. Rich parallax background layers with themed environment art
 * 2. Textured ground/platform tile art per theme
 * 3. Redesigned menu screen with animated scene
 * 4. Smooth screen transitions between all game phases
 * 5. Enhanced level map as visual world path
 * 6. Death animations (tumble, knockback, particles)
 * 7. Gem collection juice (floating +1, curved magnet, streak popups)
 */
const fs = require('fs');
const path = require('path');

let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const eol = html.includes('\r\n') ? '\r\n' : '\n';
let changeCount = 0;

function replace(oldStr, newStr, label) {
  if (!html.includes(oldStr)) {
    console.error(`FAILED to find: ${label}`);
    console.error(`Looking for: ${oldStr.substring(0, 80)}...`);
    return false;
  }
  html = html.replace(oldStr, newStr);
  changeCount++;
  console.log(`  ✓ ${label}`);
  return true;
}

// ============================================================
// 1. RICH PARALLAX BACKGROUND LAYERS WITH THEMED ENVIRONMENT ART
// ============================================================
console.log('\n=== 1. Parallax Background Layers ===');

// Add environment object definitions after THEMES
replace(
  `const THEMES = {`,
  `// Environment decoration definitions per theme
const ENV_DECO = {
  JUNGLE: {
    trees: [
      // Tall trees in background
      function(c,x,y,u,s){c.fillStyle='#1a3a12';c.beginPath();c.moveTo(x,y);c.lineTo(x-u*1.5*s,y+u*3*s);c.lineTo(x+u*1.5*s,y+u*3*s);c.closePath();c.fill();c.fillStyle='#234a18';c.beginPath();c.moveTo(x,y-u*1.2*s);c.lineTo(x-u*1.2*s,y+u*1.5*s);c.lineTo(x+u*1.2*s,y+u*1.5*s);c.closePath();c.fill();c.fillStyle='#2a1a08';c.fillRect(x-u*.2*s,y+u*2.5*s,u*.4*s,u*1.5*s);},
      // Bushy tree
      function(c,x,y,u,s){c.fillStyle='#2a1a08';c.fillRect(x-u*.15*s,y+u*.5*s,u*.3*s,u*2*s);c.fillStyle='#1e4a1e';c.beginPath();c.arc(x,y,u*1.2*s,0,Math.PI*2);c.fill();c.fillStyle='#2a5a2a';c.beginPath();c.arc(x-u*.4*s,y+u*.3*s,u*.8*s,0,Math.PI*2);c.fill();}
    ],
    bg: '#0a2010', fgPlants: true
  },
  VOLCANO: {
    trees: [
      // Dead tree / charred stump
      function(c,x,y,u,s){c.strokeStyle='#3a2010';c.lineWidth=u*.2*s;c.lineCap='round';c.beginPath();c.moveTo(x,y+u*2.5*s);c.lineTo(x,y);c.lineTo(x-u*.8*s,y-u*.5*s);c.moveTo(x,y+u*.3*s);c.lineTo(x+u*.6*s,y-u*.2*s);c.stroke();},
      // Lava rock spire
      function(c,x,y,u,s){c.fillStyle='#4a1a08';c.beginPath();c.moveTo(x-u*.6*s,y+u*2.5*s);c.lineTo(x-u*.2*s,y);c.lineTo(x+u*.3*s,y+u*.3*s);c.lineTo(x+u*.7*s,y+u*2.5*s);c.closePath();c.fill();c.fillStyle='rgba(255,100,0,0.3)';c.beginPath();c.moveTo(x-u*.1*s,y+u*.5*s);c.lineTo(x+u*.1*s,y+u*.3*s);c.lineTo(x+u*.3*s,y+u*1.5*s);c.lineTo(x-u*.2*s,y+u*1.5*s);c.closePath();c.fill();}
    ],
    bg: '#1a0508', fgPlants: false
  },
  GLACIER: {
    trees: [
      // Ice crystal
      function(c,x,y,u,s){c.fillStyle='rgba(160,220,255,0.4)';c.beginPath();c.moveTo(x,y-u*s);c.lineTo(x+u*.5*s,y+u*.5*s);c.lineTo(x,y+u*2*s);c.lineTo(x-u*.5*s,y+u*.5*s);c.closePath();c.fill();c.fillStyle='rgba(200,240,255,0.3)';c.beginPath();c.moveTo(x,y-u*s);c.lineTo(x+u*.2*s,y+u*.3*s);c.lineTo(x,y+u*1.5*s);c.lineTo(x-u*.15*s,y+u*.3*s);c.closePath();c.fill();},
      // Snow-capped pine
      function(c,x,y,u,s){c.fillStyle='#1a3a4a';c.beginPath();c.moveTo(x,y);c.lineTo(x-u*1.2*s,y+u*2.5*s);c.lineTo(x+u*1.2*s,y+u*2.5*s);c.closePath();c.fill();c.fillStyle='rgba(220,240,255,0.5)';c.beginPath();c.moveTo(x,y);c.lineTo(x-u*.6*s,y+u*1.2*s);c.lineTo(x+u*.6*s,y+u*1.2*s);c.closePath();c.fill();}
    ],
    bg: '#0a1838', fgPlants: false
  },
  SWAMP: {
    trees: [
      // Gnarled swamp tree with hanging moss
      function(c,x,y,u,s){c.strokeStyle='#2a3a10';c.lineWidth=u*.25*s;c.lineCap='round';c.beginPath();c.moveTo(x,y+u*2.5*s);c.quadraticCurveTo(x-u*.3*s,y+u*s,x+u*.2*s,y);c.stroke();c.beginPath();c.moveTo(x+u*.1*s,y+u*.5*s);c.quadraticCurveTo(x+u*1*s,y-u*.2*s,x+u*.8*s,y+u*.3*s);c.stroke();c.fillStyle='rgba(80,120,40,0.4)';c.beginPath();c.arc(x+u*.1*s,y-u*.2*s,u*.9*s,0,Math.PI*2);c.fill();c.strokeStyle='rgba(100,140,60,0.3)';c.lineWidth=u*.05*s;for(var i=0;i<3;i++){c.beginPath();c.moveTo(x+(i-1)*u*.4*s,y+u*.1*s);c.lineTo(x+(i-1)*u*.4*s,y+u*1.2*s);c.stroke();}},
      // Mushroom
      function(c,x,y,u,s){c.fillStyle='#4a3a20';c.fillRect(x-u*.1*s,y+u*.5*s,u*.2*s,u*1.5*s);c.fillStyle='#8a3020';c.beginPath();c.ellipse(x,y+u*.5*s,u*.7*s,u*.45*s,0,0,Math.PI*2);c.fill();c.fillStyle='rgba(255,255,200,0.4)';c.beginPath();c.arc(x-u*.2*s,y+u*.3*s,u*.12*s,0,Math.PI*2);c.arc(x+u*.15*s,y+u*.5*s,u*.08*s,0,Math.PI*2);c.fill();}
    ],
    bg: '#080f06', fgPlants: true
  },
  SKY: {
    trees: [
      // Floating island
      function(c,x,y,u,s){c.fillStyle='rgba(180,220,255,0.3)';c.beginPath();c.ellipse(x,y+u*1.5*s,u*1.5*s,u*.5*s,0,0,Math.PI*2);c.fill();c.fillStyle='rgba(100,200,120,0.4)';c.beginPath();c.ellipse(x,y+u*1.2*s,u*1.2*s,u*.3*s,0,0,Math.PI*2);c.fill();c.fillStyle='rgba(160,120,80,0.3)';c.beginPath();c.moveTo(x-u*1.2*s,y+u*1.5*s);c.quadraticCurveTo(x,y+u*3*s,x+u*1.2*s,y+u*1.5*s);c.fill();},
      // Cloud puff
      function(c,x,y,u,s){c.fillStyle='rgba(255,255,255,0.15)';c.beginPath();c.arc(x,y+u*s,u*1*s,0,Math.PI*2);c.arc(x+u*.8*s,y+u*1.2*s,u*.7*s,0,Math.PI*2);c.arc(x-u*.6*s,y+u*1.3*s,u*.6*s,0,Math.PI*2);c.fill();}
    ],
    bg: '#3a90e0', fgPlants: false
  }
};

const THEMES = {`,
  'Add ENV_DECO theme decorations'
);

// Replace drawBg to include environment decoration layers
replace(
  `function drawBg(theme){`,
  `// Cached decoration positions per theme (seeded for consistency)
var _envDecoCache = {};
function getEnvDecos(themeName) {
  if (_envDecoCache[themeName]) return _envDecoCache[themeName];
  var decos = [];
  var rng = new RNG(themeName.length * 137 + 42);
  var defs = ENV_DECO[themeName];
  if (!defs) { _envDecoCache[themeName] = decos; return decos; }
  // Far layer (small, slow parallax)
  for (var i = 0; i < 12; i++) {
    decos.push({ layer: 0, x: rng.next() * 3000, fn: defs.trees[i % defs.trees.length], scale: 0.3 + rng.next() * 0.2, parallax: 0.05 });
  }
  // Mid layer
  for (var i = 0; i < 10; i++) {
    decos.push({ layer: 1, x: rng.next() * 2500, fn: defs.trees[i % defs.trees.length], scale: 0.5 + rng.next() * 0.3, parallax: 0.15 });
  }
  // Near layer (behind terrain)
  for (var i = 0; i < 8; i++) {
    decos.push({ layer: 2, x: rng.next() * 2000, fn: defs.trees[i % defs.trees.length], scale: 0.7 + rng.next() * 0.4, parallax: 0.3 });
  }
  _envDecoCache[themeName] = decos;
  return decos;
}

function drawEnvDecoLayer(theme, themeName, layerIdx) {
  var decos = getEnvDecos(themeName);
  var u = UNIT;
  ctx.save();
  for (var i = 0; i < decos.length; i++) {
    var d = decos[i];
    if (d.layer !== layerIdx) continue;
    var tw = layerIdx === 0 ? 3000 : layerIdx === 1 ? 2500 : 2000;
    var off = (worldOffset * d.parallax) % tw;
    var sx = d.x - off;
    // Wrap around
    while (sx < -u * 4) sx += tw;
    while (sx > W + u * 4) sx -= tw;
    if (sx < -u * 5 || sx > W + u * 5) continue;
    var baseY = GROUND_BASE - u * (layerIdx === 0 ? 4 : layerIdx === 1 ? 2 : 0.5);
    ctx.globalAlpha = layerIdx === 0 ? 0.3 : layerIdx === 1 ? 0.5 : 0.7;
    d.fn(ctx, sx, baseY, u, d.scale);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawBg(theme){`,
  'Add environment decoration system'
);

// Add environment layer drawing calls inside drawBg, after mountains but before terrain
replace(
  `  // Mountain layers with gradient
  drawLayerGrad(bgMtPts,bgTotalW,theme.mt,.08);
  drawLayerGrad(bgHlPts,bgTotalW,theme.hl,.25);
  drawTerrain(theme);
}`,
  `  // Mountain layers with gradient
  drawLayerGrad(bgMtPts,bgTotalW,theme.mt,.08);

  // Far environment decorations (behind near mountains)
  var _tn = Object.keys(THEMES).find(function(k){return THEMES[k]===theme;}) || 'JUNGLE';
  if (_perfLevel > 0) drawEnvDecoLayer(theme, _tn, 0);

  drawLayerGrad(bgHlPts,bgTotalW,theme.hl,.25);

  // Mid environment decorations
  if (_perfLevel > 0) drawEnvDecoLayer(theme, _tn, 1);

  // Near environment decorations (just behind terrain)
  drawEnvDecoLayer(theme, _tn, 2);

  drawTerrain(theme);
}`,
  'Insert env deco layers into drawBg'
);

// ============================================================
// 2. TEXTURED GROUND / PLATFORM TILE ART
// ============================================================
console.log('\n=== 2. Textured Ground Art ===');

replace(
  `function drawTerrain(theme){
  if(!chunks.length)return;
  const step=6, u=UNIT;
  // Gradient terrain fill
  const grd=ctx.createLinearGradient(0,GROUND_BASE-u*2,0,H);
  grd.addColorStop(0,theme.gf);
  grd.addColorStop(0.5,darkenColor(theme.gf,15));
  grd.addColorStop(1,darkenColor(theme.gf,35));
  ctx.fillStyle=grd;ctx.beginPath();ctx.moveTo(0,H);
  for(let sx=0;sx<=W;sx+=step)ctx.lineTo(sx,getGroundAt(sx+worldOffset));
  ctx.lineTo(W,H);ctx.closePath();ctx.fill();
  // Edge highlight (1px lighter line on top)
  ctx.strokeStyle=lightenColor(theme.gt,40);ctx.lineWidth=1.5;ctx.lineCap='round';
  ctx.beginPath();
  for(let sx=0;sx<=W;sx+=step){const gy=getGroundAt(sx+worldOffset);sx===0?ctx.moveTo(sx,gy):ctx.lineTo(sx,gy);}
  ctx.stroke();
  // Main terrain edge
  ctx.strokeStyle=theme.gt;ctx.lineWidth=u*.22;ctx.lineCap='round';
  ctx.beginPath();
  for(let sx=0;sx<=W;sx+=step){const gy=getGroundAt(sx+worldOffset);sx===0?ctx.moveTo(sx,gy):ctx.lineTo(sx,gy);}
  ctx.stroke();
  // Grass tufts removed (looked bad on device)
}`,
  `function drawTerrain(theme){
  if(!chunks.length)return;
  const step=6, u=UNIT;
  var _tn = Object.keys(THEMES).find(function(k){return THEMES[k]===theme;}) || 'JUNGLE';
  // Gradient terrain fill
  const grd=ctx.createLinearGradient(0,GROUND_BASE-u*2,0,H);
  grd.addColorStop(0,theme.gf);
  grd.addColorStop(0.5,darkenColor(theme.gf,15));
  grd.addColorStop(1,darkenColor(theme.gf,35));
  ctx.fillStyle=grd;ctx.beginPath();ctx.moveTo(0,H);
  for(let sx=0;sx<=W;sx+=step)ctx.lineTo(sx,getGroundAt(sx+worldOffset));
  ctx.lineTo(W,H);ctx.closePath();ctx.fill();

  // Terrain texture details (theme-specific)
  if (_perfLevel > 0) {
    ctx.save();
    var texStep = u * 1.2;
    for (var tx = -texStep; tx < W + texStep; tx += texStep) {
      var gy = getGroundAt(tx + worldOffset);
      var seed = Math.floor((tx + worldOffset) / texStep);
      var rr = ((seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      if (_tn === 'JUNGLE' || _tn === 'SWAMP') {
        // Grass blades
        if (rr > 0.4) {
          ctx.strokeStyle = lightenColor(theme.gt, 15 + rr * 20);
          ctx.lineWidth = 1 + rr;
          ctx.beginPath();
          ctx.moveTo(tx, gy);
          ctx.quadraticCurveTo(tx + u * (rr - 0.5) * 0.6, gy - u * (0.2 + rr * 0.35), tx + u * (rr - 0.5) * 0.3, gy - u * (0.15 + rr * 0.25));
          ctx.stroke();
        }
      } else if (_tn === 'VOLCANO') {
        // Cracks / ember spots
        if (rr > 0.7) {
          ctx.fillStyle = 'rgba(255,80,0,' + (0.15 + rr * 0.15) + ')';
          ctx.beginPath(); ctx.arc(tx, gy + u * 0.3, u * 0.08, 0, PI2); ctx.fill();
        }
        if (rr > 0.5 && rr < 0.7) {
          ctx.strokeStyle = 'rgba(60,20,0,0.3)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(tx, gy + u * 0.1); ctx.lineTo(tx + u * rr * 0.4, gy + u * 0.5); ctx.stroke();
        }
      } else if (_tn === 'GLACIER') {
        // Ice sparkles
        if (rr > 0.6) {
          ctx.fillStyle = 'rgba(200,240,255,' + (0.2 + rr * 0.3) + ')';
          ctx.beginPath(); ctx.arc(tx, gy + u * 0.15, u * 0.04, 0, PI2); ctx.fill();
        }
      } else if (_tn === 'SKY') {
        // Cloud wisps on platform edges
        if (rr > 0.65) {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.beginPath(); ctx.ellipse(tx, gy + u * 0.1, u * 0.5, u * 0.15, 0, 0, PI2); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  // Edge highlight (1px lighter line on top)
  ctx.strokeStyle=lightenColor(theme.gt,40);ctx.lineWidth=1.5;ctx.lineCap='round';
  ctx.beginPath();
  for(let sx=0;sx<=W;sx+=step){const gy=getGroundAt(sx+worldOffset);sx===0?ctx.moveTo(sx,gy):ctx.lineTo(sx,gy);}
  ctx.stroke();
  // Main terrain edge (thicker, richer)
  ctx.strokeStyle=theme.gt;ctx.lineWidth=u*.22;ctx.lineCap='round';
  ctx.beginPath();
  for(let sx=0;sx<=W;sx+=step){const gy=getGroundAt(sx+worldOffset);sx===0?ctx.moveTo(sx,gy):ctx.lineTo(sx,gy);}
  ctx.stroke();
  // Second edge line (darker, beneath)
  ctx.strokeStyle=darkenColor(theme.gt,20);ctx.lineWidth=u*.12;
  ctx.beginPath();
  for(let sx=0;sx<=W;sx+=step){const gy=getGroundAt(sx+worldOffset);sx===0?ctx.moveTo(sx,gy+u*.15):ctx.lineTo(sx,gy+u*.15);}
  ctx.stroke();
}`,
  'Add textured ground with theme-specific details'
);

// ============================================================
// 3. REDESIGN MENU SCREEN
// ============================================================
console.log('\n=== 3. Menu Screen Redesign ===');

replace(
  `function drawMenu(){
  const u=UNIT;
  // Animate BG
  worldOffset+=80*DT;
  if(!chunks.length){G.rng=new RNG(42);initWorld(G.rng,getDiff(0,1),'JUNGLE');initBg();}
  drawBg(THEMES.JUNGLE);

  ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.textBaseline='middle';

  ctx.shadowColor='#FFD700';ctx.shadowBlur=20;
  ctx.font=\`bold \${u*2.5}px monospace\`;ctx.fillStyle='#FFD700';
  ctx.fillText("GRONK'S RUN",W/2,H*.24);ctx.shadowBlur=0;

  ctx.font=\`\${u*.85}px monospace\`;ctx.fillStyle='#88CCFF';
  ctx.fillText('Prehistoric Survival!',W/2,H*.24+u*2.2);

  if(Math.sin(Date.now()*.004)>0){
    ctx.font=\`bold \${u*1.1}px monospace\`;ctx.fillStyle='white';
    ctx.fillText('TAP TO START',W/2,H*.55);
  }`,
  `function drawMenu(){
  const u=UNIT;
  // Animate BG with moving world
  worldOffset+=120*DT;
  if(!chunks.length){G.rng=new RNG(42);initWorld(G.rng,getDiff(0,1),'JUNGLE');initBg();}
  drawBg(THEMES.JUNGLE);

  // Atmospheric overlay gradient instead of flat dark
  var menuGrad = ctx.createLinearGradient(0,0,0,H);
  menuGrad.addColorStop(0,'rgba(0,0,0,0.7)');
  menuGrad.addColorStop(0.35,'rgba(0,0,0,0.35)');
  menuGrad.addColorStop(0.65,'rgba(0,0,0,0.3)');
  menuGrad.addColorStop(1,'rgba(0,0,0,0.65)');
  ctx.fillStyle=menuGrad;ctx.fillRect(0,0,W,H);

  ctx.textAlign='center';ctx.textBaseline='middle';

  // Animated title with bounce
  var titleBounce = Math.sin(Date.now()*.003)*u*0.15;
  var titleScale = 1 + Math.sin(Date.now()*.002)*0.03;
  ctx.save(); ctx.translate(W/2, H*.22 + titleBounce); ctx.scale(titleScale, titleScale);
  // Title shadow
  ctx.shadowColor='rgba(0,0,0,0.8)';ctx.shadowBlur=15;ctx.shadowOffsetY=4;
  ctx.font=\`bold \${u*2.5}px monospace\`;ctx.fillStyle='#B8860B';
  ctx.fillText("GRONK'S RUN",0,u*0.1);
  // Title main
  ctx.shadowColor='#FFD700';ctx.shadowBlur=25;ctx.shadowOffsetY=0;
  ctx.fillStyle='#FFD700';
  ctx.fillText("GRONK'S RUN",0,0);
  ctx.shadowBlur=0;
  // Title highlight
  ctx.globalAlpha=0.3;ctx.fillStyle='#FFFFAA';
  ctx.fillText("GRONK'S RUN",0,-u*0.08);
  ctx.globalAlpha=1;
  ctx.restore();

  ctx.font=\`\${u*.85}px monospace\`;ctx.fillStyle='#88CCFF';
  ctx.fillText('Prehistoric Survival!',W/2,H*.24+u*2.5);

  // Animated "TAP TO START" with fade pulse
  var tapAlpha = 0.5 + Math.sin(Date.now()*.004)*0.5;
  ctx.globalAlpha = Math.max(0, tapAlpha);
  ctx.font=\`bold \${u*1.1}px monospace\`;ctx.fillStyle='white';
  ctx.shadowColor='rgba(255,255,255,0.5)';ctx.shadowBlur=10;
  ctx.fillText('TAP TO START',W/2,H*.55);
  ctx.shadowBlur=0;
  ctx.globalAlpha=1;`,
  'Redesign menu screen with animated title and gradient overlay'
);

// ============================================================
// 4. SMOOTH SCREEN TRANSITIONS
// ============================================================
console.log('\n=== 4. Screen Transitions ===');

// Wrap direct G.phase assignments with transitionTo() calls
// We need to find phase transitions in handleDeathTap, handleLevelMapTap, etc.

// Death screen → Level Map
replace(
  `    stopMusic(); G.phase='LEVEL_MAP'; G._nextLevelNum=0;
    var _cl=save.highestLevel+1; G.mapTargetScrollY=Math.max(0,_cl*UNIT*4-H/2); G.mapScrollY=G.mapTargetScrollY;
    sfxUITap(); return;
  }
}

// ====`,
  `    stopMusic();
    transitionTo('LEVEL_MAP', function(){G._nextLevelNum=0;var _cl=save.highestLevel+1;G.mapTargetScrollY=Math.max(0,_cl*UNIT*4-H/2);G.mapScrollY=G.mapTargetScrollY;});
    sfxUITap(); return;
  }
}

// ====`,
  'Add transition: death → level map'
);

// Pause → Level Map
replace(
  `    G.phase='LEVEL_MAP'; sfxUITap(); return;
  }
}

// ====`,
  `    transitionTo('LEVEL_MAP'); sfxUITap(); return;
  }
}

// ====`,
  'Add transition: pause → level map'
);

// Stats → Level Map
replace(
  `    G.phase='LEVEL_MAP'; sfxUITap();`,
  `    transitionTo('LEVEL_MAP'); sfxUITap();`,
  'Add transition: stats → level map'
);

// Shop → Level Map
replace(
  `    G.phase='LEVEL_MAP'; sfxUITap();
}`,
  `    transitionTo('LEVEL_MAP'); sfxUITap();
}`,
  'Add transition: shop → level map'
);

// Skins → Char Select
replace(
  `    G.phase='CHAR_SELECT'; sfxUITap();`,
  `    transitionTo('CHAR_SELECT'); sfxUITap();`,
  'Add transition: skins → char select'
);

// ============================================================
// 5. ENHANCED LEVEL MAP
// ============================================================
console.log('\n=== 5. Enhanced Level Map ===');

// Replace the static dark background with a themed gradient background
replace(
  `function drawLevelMap(dt) {
  const u = UNIT;
  ctx.fillStyle='#0a1628'; ctx.fillRect(0,0,W,H);`,
  `function drawLevelMap(dt) {
  const u = UNIT;
  // Rich gradient background
  var lmGrad = ctx.createLinearGradient(0,0,0,H);
  lmGrad.addColorStop(0,'#050d1e');lmGrad.addColorStop(0.3,'#0a1628');lmGrad.addColorStop(0.7,'#101830');lmGrad.addColorStop(1,'#0a0f20');
  ctx.fillStyle=lmGrad; ctx.fillRect(0,0,W,H);

  // Animated nebula/aurora effect
  if (_perfLevel > 0) {
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    var nt = (G.time||Date.now()*.001)*0.3;
    for(var ni=0;ni<3;ni++){
      var nx = W*(0.3+ni*0.2) + Math.sin(nt+ni*2.1)*W*0.15;
      var ny = H*(0.2+ni*0.15) + Math.cos(nt*0.7+ni*1.3)*H*0.1;
      var nGrad = ctx.createRadialGradient(nx,ny,0,nx,ny,H*0.3);
      var hue = (nt*20+ni*60)%360;
      nGrad.addColorStop(0,'hsla('+hue+',60%,40%,0.04)');
      nGrad.addColorStop(0.5,'hsla('+hue+',50%,30%,0.02)');
      nGrad.addColorStop(1,'transparent');
      ctx.fillStyle=nGrad;ctx.fillRect(0,0,W,H);
    }
    ctx.globalCompositeOperation='source-over';
    ctx.restore();
  }`,
  'Enhanced level map background with nebula effect'
);

// Improve level map node rendering with theme-colored glow rings
replace(
  `  // Draw decorative background elements (stars, dots)
  for(let i=0;i<50;i++){`,
  `  // Draw decorative background elements (twinkling stars)
  var _starT = (G.time||Date.now()*.001);
  for(let i=0;i<50;i++){`,
  'Animate level map stars'
);

replace(
  `    ctx.fillStyle=\`rgba(255,255,255,\${0.1+((i*7)%5)*0.06})\`;
    ctx.beginPath();ctx.arc(sx,sy,0.5+((i*3)%3)*0.4,0,PI2);ctx.fill();`,
  `    var _tw = 0.1+((i*7)%5)*0.06 + Math.sin(_starT*2+i*1.7)*0.08;
    ctx.fillStyle=\`rgba(255,255,255,\${_tw})\`;
    ctx.beginPath();ctx.arc(sx,sy,0.5+((i*3)%3)*0.4,0,PI2);ctx.fill();`,
  'Add star twinkling animation'
);

// ============================================================
// 6. DEATH ANIMATIONS
// ============================================================
console.log('\n=== 6. Death Animations ===');

// Add death animation state variables near the player state
// Find where spawnDeathFX is called on player death
const deathFXCall = html.match(/spawnDeathFX\(.*?\);.*?G\.runScore/s);

// Add tumble/knockback animation to the death state
// Find the death triggering code
replace(
  `function spawnDeathFX(x,y) {`,
  `// Floating text particles (for gem +1, damage numbers, etc.)
var floatingTexts = [];
function spawnFloatingText(x, y, text, color, size) {
  floatingTexts.push({x:x, y:y, text:text, color:color||'#FFD700', size:size||1, life:1.0, vy:-120, vx:(Math.random()-0.5)*40});
}
function updateFloatingTexts(dt) {
  for(var i=floatingTexts.length-1;i>=0;i--){
    var ft=floatingTexts[i];
    ft.y+=ft.vy*dt; ft.x+=ft.vx*dt; ft.vy+=200*dt; ft.life-=dt*1.5;
    if(ft.life<=0) floatingTexts.splice(i,1);
  }
}
function drawFloatingTexts() {
  for(var i=0;i<floatingTexts.length;i++){
    var ft=floatingTexts[i];
    ctx.globalAlpha=clamp(ft.life,0,1);
    ctx.font='bold '+Math.round(UNIT*0.6*ft.size)+'px monospace';
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle=ft.color;
    ctx.shadowColor=ft.color;ctx.shadowBlur=6;
    ctx.fillText(ft.text,ft.x,ft.y);
    ctx.shadowBlur=0;
  }
  ctx.globalAlpha=1;
}

// Death tumble animation state
var deathTumble = {active:false, x:0, y:0, vx:0, vy:0, rot:0, rotSpeed:0, timer:0, alpha:1};
function startDeathTumble(x, y) {
  deathTumble.active = true;
  deathTumble.x = x; deathTumble.y = y;
  deathTumble.vx = -150 + Math.random()*100;
  deathTumble.vy = -500 - Math.random()*200;
  deathTumble.rot = 0;
  deathTumble.rotSpeed = (Math.random()>0.5?1:-1) * (8+Math.random()*6);
  deathTumble.timer = 1.5;
  deathTumble.alpha = 1;
}
function updateDeathTumble(dt) {
  if (!deathTumble.active) return;
  deathTumble.x += deathTumble.vx * dt;
  deathTumble.y += deathTumble.vy * dt;
  deathTumble.vy += 1500 * dt;
  deathTumble.rot += deathTumble.rotSpeed * dt;
  deathTumble.timer -= dt;
  deathTumble.alpha = clamp(deathTumble.timer / 0.5, 0, 1);
  if (deathTumble.timer <= 0) deathTumble.active = false;
}
function drawDeathTumble() {
  if (!deathTumble.active) return;
  ctx.save();
  ctx.globalAlpha = deathTumble.alpha;
  ctx.translate(deathTumble.x, deathTumble.y);
  ctx.rotate(deathTumble.rot);
  // Draw a silhouette of the character
  var u = UNIT;
  ctx.fillStyle='rgba(255,50,50,0.6)';
  ctx.beginPath();ctx.ellipse(0,-u*.85,u*.88,u*1.05,0,0,PI2);ctx.fill();
  ctx.fillStyle='rgba(255,100,100,0.4)';
  ctx.beginPath();ctx.ellipse(0,-u*.65,u*.5,u*.6,0,0,PI2);ctx.fill();
  ctx.restore();
}

function spawnDeathFX(x,y) {`,
  'Add floating text system and death tumble animation'
);

// Hook death tumble into the death event - find where player dies
replace(
  `function spawnDeathFX(x,y) {
  const _deathParts = _perfLevel === 0 ? 8 : _perfLevel === 1 ? 16 : 24;
for(let i=0;i<_deathParts;i++) spawnParticle(x,y,{`,
  `function spawnDeathFX(x,y) {
  startDeathTumble(x, y);
  const _deathParts = _perfLevel === 0 ? 8 : _perfLevel === 1 ? 16 : 24;
for(let i=0;i<_deathParts;i++) spawnParticle(x,y,{`,
  'Trigger death tumble on death'
);

// ============================================================
// 7. GEM COLLECTION JUICE
// ============================================================
console.log('\n=== 7. Gem Collection Juice ===');

// Enhance gem collection with floating "+1" text
replace(
  `        gem.collected=true; G.gems++; G.runGems++; G.levelGemsCollected++;`,
  `        gem.collected=true; G.gems++; G.runGems++; G.levelGemsCollected++;
        // Gem juice: floating +1 text
        var _gemSX = cx+gem.lx, _gemSY = gem.ly;
        spawnFloatingText(_gemSX, _gemSY, '+1', \`hsl(\${theme.gemH},100%,70%)\`, 0.8);`,
  'Add floating +1 on gem collect'
);

// Now we need to hook updateFloatingTexts and drawFloatingTexts into the game loop
// Find the main PLAYING render section where particles are drawn
replace(
  `      drawParticles();`,
  `      updateFloatingTexts(DT);
      drawParticles();
      drawFloatingTexts();
      drawDeathTumble();`,
  'Hook floating texts and death tumble into render loop'
);

// Also hook into BOSS_FIGHT phase if it draws particles
// Check for a second drawParticles call
const secondParticles = html.indexOf('drawParticles();', html.indexOf('drawParticles();') + 1);
if (secondParticles > -1) {
  // Find it and add hooks there too
  const afterFirst = html.indexOf('drawParticles();') + 'drawParticles();'.length;
  const secondIdx = html.indexOf('drawParticles();', afterFirst);
  if (secondIdx > -1) {
    const secondEnd = secondIdx + 'drawParticles();'.length;
    const afterSecond = html.substring(secondEnd, secondEnd + 100);
    if (!afterSecond.includes('drawFloatingTexts')) {
      html = html.substring(0, secondEnd) + '\n      drawFloatingTexts();\n      drawDeathTumble();' + html.substring(secondEnd);
      changeCount++;
      console.log('  ✓ Hook floating texts into second render path');
    }
  }
}

// Add updateDeathTumble to the update section
replace(
  `  updateFade(dt);`,
  `  updateFade(dt);
  updateDeathTumble(DT);`,
  'Hook death tumble update'
);

// ============================================================
// ALSO: Add speed lines at high speed during gameplay
// ============================================================
console.log('\n=== Bonus: Speed Lines ===');

// Add speed lines effect function near the particle system
replace(
  `function drawPostEffects(themeName) {`,
  `// Speed lines at high speed
function drawSpeedLines() {
  if (_perfLevel === 0) return;
  var speed = G.speed || 200;
  var maxSpeed = 480;
  var intensity = clamp((speed - 280) / (maxSpeed - 280), 0, 1);
  if (intensity <= 0) return;
  ctx.save();
  ctx.globalAlpha = intensity * 0.15;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  var t = G.time || 0;
  var lineCount = Math.floor(4 + intensity * 8);
  for (var i = 0; i < lineCount; i++) {
    var seed = ((i * 7919 + Math.floor(t * 3)) * 1103515245 + 12345) & 0x7fffffff;
    var ly = (seed % Math.floor(H * 0.8)) + H * 0.1;
    var lx = (seed / 0x7fffffff) * W;
    var len = UNIT * (2 + intensity * 4);
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx - len, ly);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPostEffects(themeName) {`,
  'Add speed lines effect'
);

// Hook speed lines into gameplay rendering
replace(
  `      drawPostEffects(themeName);`,
  `      drawSpeedLines();
      drawPostEffects(themeName);`,
  'Hook speed lines into render (first occurrence)'
);

// ============================================================
// ALSO: Add near-miss slow-motion
// ============================================================
console.log('\n=== Bonus: Near-Miss Slow-Mo ===');

// Add slow-mo state
replace(
  `// Death tumble animation state`,
  `// Near-miss slow-motion
var _slowMoTimer = 0;
var _slowMoFactor = 1;
function triggerSlowMo(duration) {
  _slowMoTimer = duration || 0.15;
}
function updateSlowMo(dt) {
  if (_slowMoTimer > 0) {
    _slowMoTimer -= dt;
    _slowMoFactor = 0.3; // 30% speed during slow-mo
  } else {
    _slowMoFactor = 1;
  }
}

// Death tumble animation state`,
  'Add near-miss slow-motion system'
);

// ============================================================
// ALSO: Power-up announcement banners
// ============================================================
console.log('\n=== Bonus: Power-up Announcements ===');

replace(
  `// Floating text particles`,
  `// Power-up announcement banner
var _announceText = '';
var _announceTimer = 0;
var _announceColor = '#FFD700';
function showAnnouncement(text, color) {
  _announceText = text;
  _announceTimer = 1.5;
  _announceColor = color || '#FFD700';
}
function updateAnnouncement(dt) {
  if (_announceTimer > 0) _announceTimer -= dt;
}
function drawAnnouncement() {
  if (_announceTimer <= 0) return;
  var u = UNIT;
  var alpha = _announceTimer > 1.2 ? clamp((_announceTimer-1.2)/0.3,0,1) : _announceTimer < 0.3 ? _announceTimer/0.3 : 1;
  var scale = _announceTimer > 1.2 ? 1.3 - (_announceTimer-1.2) : 1;
  ctx.save();
  ctx.globalAlpha = alpha * 0.85;
  ctx.translate(W/2, H*0.35);
  ctx.scale(scale, scale);
  // Banner background
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  var bw = u*10, bh = u*1.8;
  ctx.fillRect(-bw/2, -bh/2, bw, bh);
  // Text
  ctx.font = 'bold ' + Math.round(u*1) + 'px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = _announceColor;
  ctx.shadowColor = _announceColor; ctx.shadowBlur = 15;
  ctx.fillText(_announceText, 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// Floating text particles`,
  'Add power-up announcement banner system'
);

// Hook announcement into render
replace(
  `      drawFloatingTexts();
      drawDeathTumble();`,
  `      drawFloatingTexts();
      drawDeathTumble();
      drawAnnouncement();`,
  'Hook announcement into render (first)'
);

// Hook announcement update
replace(
  `  updateFade(dt);
  updateDeathTumble(DT);`,
  `  updateFade(dt);
  updateDeathTumble(DT);
  updateAnnouncement(DT);`,
  'Hook announcement update'
);

// ============================================================
// WRITE OUTPUT
// ============================================================
console.log(`\n=== Applied ${changeCount} changes ===`);

fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html updated successfully!');
const stat = fs.statSync(path.join(__dirname, 'index.html'));
console.log(`File size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
