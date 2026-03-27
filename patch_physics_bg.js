// Patch script: Enemy Physics & Background Improvements
// Applies changes A1-A5 (enemy physics) and B1-B4 (background)
const fs = require('fs');

const FILE = __dirname + '/index.html';
let src = fs.readFileSync(FILE, 'utf8');
let applied = 0, failed = 0;

function patch(name, find, replace) {
  if (src.includes(find)) {
    src = src.replace(find, replace);
    console.log(`  ✓ ${name}`);
    applied++;
  } else {
    console.log(`  ✗ FAILED: ${name}`);
    failed++;
  }
}

console.log('=== Part A: Enemy Physics ===');

// A1a: Reduce TROLL bobbing from 0.6 to 0.15
patch('A1a: Reduce TROLL bob',
  "if (this.type==='TROLL') return this.y + Math.sin(this.phase*2)*UNIT*.6;",
  "if (this.type==='TROLL') return this.y + Math.sin(this.phase*2)*UNIT*.15;"
);

// A1b: TROLL ground tracking
patch('A1b: TROLL ground tracking',
  "case 'TROLL': {\r\n        const sx = this.sx;\r\n        if (sx < -UNIT*5) { this.alive=false; break; }",
  "case 'TROLL': {\r\n        this.y = getGroundAt(this.worldX);\r\n        const sx = this.sx;\r\n        if (sx < -UNIT*5) { this.alive=false; break; }"
);

// A2a: GOLEM ground tracking
patch('A2a: GOLEM ground tracking',
  "case 'GOLEM': {\r\n        const sx = this.sx;\r\n        if (sx < -UNIT*5) { this.alive=false; break; }",
  "case 'GOLEM': {\r\n        this.y = getGroundAt(this.worldX);\r\n        const sx = this.sx;\r\n        if (sx < -UNIT*5) { this.alive=false; break; }"
);

// A2b: GOLEM shockwave uses dynamic ground Y
patch('A2b: GOLEM shockwave Y',
  "this.projectiles.push({ x:sx-UNIT*1.5, y:GROUND_BASE-UNIT*.3,\r\n                vx:-420, vy:0, life:3, type:'SHOCKWAVE', grav:0 });",
  "this.projectiles.push({ x:sx-UNIT*1.5, y:this.y-UNIT*.3,\r\n                vx:-420, vy:0, life:3, type:'SHOCKWAVE', grav:0 });"
);

// A3: Bouncing boulders in enemy projectile loop
patch('A3: Bouncing boulders (enemy loop)',
  "} else if (p.grav) { p.vy += p.grav*dt; }\r\n      p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt;\r\n      if(p.x<-UNIT*3||p.y>H+UNIT*3||p.life<=0) this.projectiles.splice(i,1);",
  "} else if (p.grav) { p.vy += p.grav*dt; }\r\n      p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt;\r\n      if(p.type==='BOULDER_P'&&p.vy>0){var _bGY=getGroundAt(p.x+worldOffset);if(p.y>=_bGY){p.y=_bGY;if(Math.abs(p.vy)>40){p.vy*=-0.45;}else{p.vy=0;p.grav=0;p.vx*=0.95;}}}\r\n      if(p.type==='BOULDER_P'&&p._rolling){var _rGY=getGroundAt(p.x+worldOffset);if(_rGY<H*0.95)p.y=_rGY-UNIT*.1;}\r\n      if(p.x<-UNIT*3||p.y>H+UNIT*3||p.life<=0) this.projectiles.splice(i,1);"
);

// A3b: Bouncing boulders in boss projectile loop
patch('A3b: Bouncing boulders (boss loop)',
  "if (p.grav) p.vy += p.grav * dt;\r\n      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;",
  "if (p.grav) p.vy += p.grav * dt;\r\n      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;\r\n      if(p.type==='BOULDER_P'&&p.vy>0){var _bGY=getGroundAt(p.x+worldOffset);if(p.y>=_bGY){p.y=_bGY;if(Math.abs(p.vy)>40){p.vy*=-0.45;}else{p.vy=0;p.grav=0;p.vx*=0.95;}}}"
);

// A4: Rolling boulder attack for GOLEM (3-way attack)
patch('A4: Rolling boulder attack',
  "this.fireCD = 0; this.fireInterval = 2.5+Math.random()*1.5;\r\n            // Alternate between shockwave and boulder toss\r\n            if (Math.random() < 0.5) {\r\n              this.projectiles.push({ x:sx-UNIT*1.5, y:this.y-UNIT*.3,\r\n                vx:-420, vy:0, life:3, type:'SHOCKWAVE', grav:0 });\r\n            } else {\r\n              this.projectiles.push({ x:sx-UNIT*1.2, y:this.sy-UNIT*2.5,\r\n                vx:-220, vy:-200, life:4, type:'BOULDER_P', grav:450 });\r\n            }",
  "this.fireCD = 0; this.fireInterval = 2.5+Math.random()*1.5;\r\n            var _atkR=Math.random();\r\n            if (_atkR < 0.35) {\r\n              this.projectiles.push({ x:sx-UNIT*1.5, y:this.y-UNIT*.3,\r\n                vx:-420, vy:0, life:3, type:'SHOCKWAVE', grav:0 });\r\n            } else if (_atkR < 0.7) {\r\n              this.projectiles.push({ x:sx-UNIT*1.2, y:this.sy-UNIT*2.5,\r\n                vx:-220, vy:-200, life:4, type:'BOULDER_P', grav:450 });\r\n            } else {\r\n              this.projectiles.push({ x:sx-UNIT*1.5, y:this.y-UNIT*.3,\r\n                vx:-300, vy:0, life:5, type:'BOULDER_P', grav:0, _rolling:true });\r\n            }"
);

// A5a: Serpent constructor — add _lastGoodY
patch('A5a: Serpent _lastGoodY init',
  "this.screenX = W+UNIT*3; this.y = GROUND_BASE;\r\n      this.state = 'SLITHER'; this.slitherPhase = 0;",
  "this.screenX = W+UNIT*3; this.y = GROUND_BASE;\r\n      this.state = 'SLITHER'; this.slitherPhase = 0; this._lastGoodY = GROUND_BASE;"
);

// A5b: Serpent update — terrain memory
patch('A5b: Serpent terrain memory',
  "this.y = getGroundAt(this.screenX+worldOffset) + Math.sin(this.slitherPhase)*UNIT*.15;",
  "var _sgY=getGroundAt(this.screenX+worldOffset);if(_sgY<H*0.9)this._lastGoodY=_sgY;this.y=(this._lastGoodY||_sgY)+Math.sin(this.slitherPhase)*UNIT*.15;"
);

console.log('\n=== Part B: Background Improvements ===');

// B1: Add 3rd decoration type per theme
// JUNGLE: fern cluster
patch('B1a: JUNGLE fern',
  "function(c,x,y,u,s){c.fillStyle='#2a1a08';c.fillRect(x-u*.15*s,y+u*.5*s,u*.3*s,u*2*s);c.fillStyle='#1e4a1e';c.beginPath();c.arc(x,y,u*1.2*s,0,Math.PI*2);c.fill();c.fillStyle='#2a5a2a';c.beginPath();c.arc(x-u*.4*s,y+u*.3*s,u*.8*s,0,Math.PI*2);c.fill();}\r\n    ],",
  "function(c,x,y,u,s){c.fillStyle='#2a1a08';c.fillRect(x-u*.15*s,y+u*.5*s,u*.3*s,u*2*s);c.fillStyle='#1e4a1e';c.beginPath();c.arc(x,y,u*1.2*s,0,Math.PI*2);c.fill();c.fillStyle='#2a5a2a';c.beginPath();c.arc(x-u*.4*s,y+u*.3*s,u*.8*s,0,Math.PI*2);c.fill();},\r\n      // Fern cluster\r\n      function(c,x,y,u,s){c.strokeStyle='#1a5a18';c.lineWidth=u*.06*s;c.lineCap='round';for(var f=-2;f<=2;f++){c.beginPath();c.moveTo(x,y+u*2.5*s);c.quadraticCurveTo(x+f*u*.7*s,y+u*s,x+f*u*1.1*s,y+u*1.8*s);c.stroke();}}\r\n    ],"
);

// VOLCANO: cracked boulder
patch('B1b: VOLCANO boulder',
  "function(c,x,y,u,s){c.fillStyle='#4a1a08';c.beginPath();c.moveTo(x-u*.6*s,y+u*2.5*s);c.lineTo(x-u*.2*s,y);c.lineTo(x+u*.3*s,y+u*.3*s);c.lineTo(x+u*.7*s,y+u*2.5*s);c.closePath();c.fill();c.fillStyle='rgba(255,100,0,0.3)';c.beginPath();c.moveTo(x-u*.1*s,y+u*.5*s);c.lineTo(x+u*.1*s,y+u*.3*s);c.lineTo(x+u*.3*s,y+u*1.5*s);c.lineTo(x-u*.2*s,y+u*1.5*s);c.closePath();c.fill();}\r\n    ],",
  "function(c,x,y,u,s){c.fillStyle='#4a1a08';c.beginPath();c.moveTo(x-u*.6*s,y+u*2.5*s);c.lineTo(x-u*.2*s,y);c.lineTo(x+u*.3*s,y+u*.3*s);c.lineTo(x+u*.7*s,y+u*2.5*s);c.closePath();c.fill();c.fillStyle='rgba(255,100,0,0.3)';c.beginPath();c.moveTo(x-u*.1*s,y+u*.5*s);c.lineTo(x+u*.1*s,y+u*.3*s);c.lineTo(x+u*.3*s,y+u*1.5*s);c.lineTo(x-u*.2*s,y+u*1.5*s);c.closePath();c.fill();},\r\n      // Cracked boulder\r\n      function(c,x,y,u,s){c.fillStyle='#3a1808';c.beginPath();c.ellipse(x,y+u*2*s,u*.9*s,u*.6*s,0,0,Math.PI*2);c.fill();c.strokeStyle='rgba(255,80,0,0.4)';c.lineWidth=u*.04*s;c.beginPath();c.moveTo(x-u*.3*s,y+u*1.6*s);c.lineTo(x,y+u*2.1*s);c.lineTo(x+u*.2*s,y+u*1.7*s);c.stroke();}\r\n    ],"
);

// GLACIER: snowdrift
patch('B1c: GLACIER snowdrift',
  "function(c,x,y,u,s){c.fillStyle='#1a3a4a';c.beginPath();c.moveTo(x,y);c.lineTo(x-u*1.2*s,y+u*2.5*s);c.lineTo(x+u*1.2*s,y+u*2.5*s);c.closePath();c.fill();c.fillStyle='rgba(220,240,255,0.5)';c.beginPath();c.moveTo(x,y);c.lineTo(x-u*.6*s,y+u*1.2*s);c.lineTo(x+u*.6*s,y+u*1.2*s);c.closePath();c.fill();}\r\n    ],",
  "function(c,x,y,u,s){c.fillStyle='#1a3a4a';c.beginPath();c.moveTo(x,y);c.lineTo(x-u*1.2*s,y+u*2.5*s);c.lineTo(x+u*1.2*s,y+u*2.5*s);c.closePath();c.fill();c.fillStyle='rgba(220,240,255,0.5)';c.beginPath();c.moveTo(x,y);c.lineTo(x-u*.6*s,y+u*1.2*s);c.lineTo(x+u*.6*s,y+u*1.2*s);c.closePath();c.fill();},\r\n      // Snowdrift mound\r\n      function(c,x,y,u,s){c.fillStyle='rgba(230,245,255,0.35)';c.beginPath();c.ellipse(x,y+u*2.3*s,u*1.3*s,u*.4*s,0,0,Math.PI*2);c.fill();c.fillStyle='rgba(200,230,250,0.2)';c.beginPath();c.ellipse(x+u*.3*s,y+u*2.1*s,u*.6*s,u*.25*s,0,0,Math.PI*2);c.fill();}\r\n    ],"
);

// SWAMP: cattail reeds
patch('B1d: SWAMP cattails',
  "function(c,x,y,u,s){c.fillStyle='#4a3a20';c.fillRect(x-u*.1*s,y+u*.5*s,u*.2*s,u*1.5*s);c.fillStyle='#8a3020';c.beginPath();c.ellipse(x,y+u*.5*s,u*.7*s,u*.45*s,0,0,Math.PI*2);c.fill();c.fillStyle='rgba(255,255,200,0.4)';c.beginPath();c.arc(x-u*.2*s,y+u*.3*s,u*.12*s,0,Math.PI*2);c.arc(x+u*.15*s,y+u*.5*s,u*.08*s,0,Math.PI*2);c.fill();}\r\n    ],",
  "function(c,x,y,u,s){c.fillStyle='#4a3a20';c.fillRect(x-u*.1*s,y+u*.5*s,u*.2*s,u*1.5*s);c.fillStyle='#8a3020';c.beginPath();c.ellipse(x,y+u*.5*s,u*.7*s,u*.45*s,0,0,Math.PI*2);c.fill();c.fillStyle='rgba(255,255,200,0.4)';c.beginPath();c.arc(x-u*.2*s,y+u*.3*s,u*.12*s,0,Math.PI*2);c.arc(x+u*.15*s,y+u*.5*s,u*.08*s,0,Math.PI*2);c.fill();},\r\n      // Cattail reeds\r\n      function(c,x,y,u,s){c.strokeStyle='#3a4a18';c.lineWidth=u*.04*s;c.lineCap='round';for(var r=-1;r<=1;r++){c.beginPath();c.moveTo(x+r*u*.3*s,y+u*2.5*s);c.lineTo(x+r*u*.25*s,y+u*.3*s);c.stroke();c.fillStyle='#5a3a18';c.beginPath();c.ellipse(x+r*u*.25*s,y+u*.2*s,u*.08*s,u*.25*s,0,0,Math.PI*2);c.fill();}}\r\n    ],"
);

// SKY: wispy cloud streak
patch('B1e: SKY cloud streak',
  "function(c,x,y,u,s){c.fillStyle='rgba(255,255,255,0.15)';c.beginPath();c.arc(x,y+u*s,u*1*s,0,Math.PI*2);c.arc(x+u*.8*s,y+u*1.2*s,u*.7*s,0,Math.PI*2);c.arc(x-u*.6*s,y+u*1.3*s,u*.6*s,0,Math.PI*2);c.fill();}\r\n    ],",
  "function(c,x,y,u,s){c.fillStyle='rgba(255,255,255,0.15)';c.beginPath();c.arc(x,y+u*s,u*1*s,0,Math.PI*2);c.arc(x+u*.8*s,y+u*1.2*s,u*.7*s,0,Math.PI*2);c.arc(x-u*.6*s,y+u*1.3*s,u*.6*s,0,Math.PI*2);c.fill();},\r\n      // Wispy cloud streak\r\n      function(c,x,y,u,s){c.fillStyle='rgba(255,255,255,0.08)';c.beginPath();c.ellipse(x,y+u*1.5*s,u*2.5*s,u*.2*s,0.1,0,Math.PI*2);c.fill();c.fillStyle='rgba(255,255,255,0.05)';c.beginPath();c.ellipse(x+u*s,y+u*1.8*s,u*1.5*s,u*.15*s,-0.05,0,Math.PI*2);c.fill();}\r\n    ],"
);

// B2a: Add fg draw functions to JUNGLE
patch('B2a: JUNGLE fg functions',
  "bg: '#0a2010', fgPlants: true\r\n  },",
  "bg: '#0a2010', fgPlants: true,\r\n    fg: [\r\n      function(c,x,y,u,s){c.fillStyle='rgba(20,80,15,0.25)';c.beginPath();c.moveTo(x-u*s,y);c.quadraticCurveTo(x-u*.3*s,y-u*1.5*s,x,y-u*.2*s);c.quadraticCurveTo(x+u*.3*s,y-u*1.5*s,x+u*s,y);c.fill();},\r\n      function(c,x,y,u,s){c.strokeStyle='rgba(30,90,20,0.2)';c.lineWidth=u*.08*s;c.lineCap='round';for(var i=-1;i<=1;i++){c.beginPath();c.moveTo(x+i*u*.4*s,y);c.lineTo(x+i*u*.3*s,y-u*1.2*s);c.stroke();}}\r\n    ]\r\n  },"
);

// B2b: Add fg draw functions to SWAMP
patch('B2b: SWAMP fg functions',
  "bg: '#080f06', fgPlants: true\r\n  },",
  "bg: '#080f06', fgPlants: true,\r\n    fg: [\r\n      function(c,x,y,u,s){c.fillStyle='rgba(40,70,15,0.2)';c.beginPath();c.moveTo(x-u*.8*s,y);c.quadraticCurveTo(x-u*.2*s,y-u*1.2*s,x+u*.1*s,y-u*.1*s);c.quadraticCurveTo(x+u*.4*s,y-u*1*s,x+u*.8*s,y);c.fill();},\r\n      function(c,x,y,u,s){c.strokeStyle='rgba(60,90,25,0.18)';c.lineWidth=u*.06*s;c.lineCap='round';for(var i=-1;i<=1;i++){c.beginPath();c.moveTo(x+i*u*.35*s,y);c.quadraticCurveTo(x+i*u*.5*s,y-u*.6*s,x+i*u*.2*s,y-u*1*s);c.stroke();}}\r\n    ]\r\n  },"
);

// B2c: Add layer 3 (foreground) generation in getEnvDecos
patch('B2c: Foreground layer generation',
  "  _envDecoCache[themeName] = decos;\r\n  return decos;\r\n}",
  "  // Foreground layer (in front of player)\r\n  if (defs.fg) {\r\n    for (var i = 0; i < 6; i++) {\r\n      decos.push({ layer: 3, x: rng.next() * 1500, fn: defs.fg[i % defs.fg.length], scale: 0.9 + rng.next() * 0.5, parallax: 0.55 });\r\n    }\r\n  }\r\n  _envDecoCache[themeName] = decos;\r\n  return decos;\r\n}"
);

// B2d: Update drawEnvDecoLayer to handle layer 3
patch('B2d: drawEnvDecoLayer layer 3 support',
  "var tw = layerIdx === 0 ? 3000 : layerIdx === 1 ? 2500 : 2000;",
  "var tw = layerIdx === 0 ? 3000 : layerIdx === 1 ? 2500 : layerIdx === 2 ? 2000 : 1500;"
);

patch('B2e: drawEnvDecoLayer layer 3 baseY+alpha',
  "var baseY = GROUND_BASE - u * (layerIdx === 0 ? 4 : layerIdx === 1 ? 2 : 0.5);\r\n    ctx.globalAlpha = layerIdx === 0 ? 0.3 : layerIdx === 1 ? 0.5 : 0.7;",
  "var baseY = GROUND_BASE - u * (layerIdx === 0 ? 4 : layerIdx === 1 ? 2 : layerIdx === 2 ? 0.5 : -0.5);\r\n    ctx.globalAlpha = layerIdx === 0 ? 0.2 : layerIdx === 1 ? 0.45 : layerIdx === 2 ? 0.7 : 0.25;"
);

// B2f: Insert foreground draw call after enemies in PLAYING render
patch('B2f: Foreground draw (PLAYING)',
  "drawPteros(G.theme);drawEnemies();\r\n      ctx.restore();\r\n      updateFloatingTexts(DT);",
  "drawPteros(G.theme);drawEnemies();\r\n      if(_perfLevel>=1){var _tn2=Object.keys(THEMES).find(function(k){return THEMES[k]===G.theme;})||'JUNGLE';drawEnvDecoLayer(G.theme,_tn2,3);}\r\n      ctx.restore();\r\n      updateFloatingTexts(DT);"
);

// B2g: Insert foreground draw call after enemies in PAUSED render
patch('B2g: Foreground draw (PAUSED)',
  "drawPteros(G.theme);drawEnemies();\r\n      ctx.restore();\r\n      drawParticles();",
  "drawPteros(G.theme);drawEnemies();\r\n      if(_perfLevel>=1){var _tn2=Object.keys(THEMES).find(function(k){return THEMES[k]===G.theme;})||'JUNGLE';drawEnvDecoLayer(G.theme,_tn2,3);}\r\n      ctx.restore();\r\n      drawParticles();"
);

// B3: Ground detail rocks/stones
patch('B3: Ground detail rocks',
  "    ctx.restore();\r\n  }\r\n  // Edge highlight",
  "    // Larger ground details (rocks, stones)\r\n    var detStep = u * 4;\r\n    for (var dx = -detStep; dx < W + detStep; dx += detStep) {\r\n      var dgy = getGroundAt(dx + worldOffset);\r\n      var dseed = Math.floor((dx + worldOffset) / detStep);\r\n      var drr = ((dseed * 48271 + 1) & 0x7fffffff) / 0x7fffffff;\r\n      if (drr > 0.6) {\r\n        ctx.fillStyle = darkenColor(theme.gf, 10 + drr * 15);\r\n        ctx.beginPath();ctx.ellipse(dx, dgy + u * 0.2, u * (0.3 + drr * 0.3), u * 0.12, drr * 0.5, 0, PI2);ctx.fill();\r\n      }\r\n    }\r\n    ctx.restore();\r\n  }\r\n  // Edge highlight"
);

console.log(`\nDone: ${applied} applied, ${failed} failed`);
fs.writeFileSync(FILE, src, 'utf8');
