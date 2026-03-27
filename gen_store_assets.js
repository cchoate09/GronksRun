/**
 * Generate Google Play Store listing assets:
 * - App icon (512x512)
 * - Feature graphic (1024x500)
 * - Phone screenshots (1080x1920) x 4
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const PI2 = Math.PI * 2;
const outDir = path.join(__dirname, 'store_assets');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

// ========== GRONK DRAWING ==========
function drawGronk(ctx, x, y, u, opts = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (opts.scale) ctx.scale(opts.scale, opts.scale);

  const col = '#4a9a4a';
  const dk = '#2a6a2a';

  // Shadow
  if (!opts.noShadow) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 4, u*.9, u*.18, 0, 0, PI2); ctx.fill();
  }

  // Legs
  const swing = opts.legSwing || 0;
  ctx.fillStyle = dk;
  for (let s = -1; s <= 1; s += 2) {
    ctx.save(); ctx.translate(s*u*.35, -u*.08); ctx.rotate(-s*swing);
    ctx.beginPath(); ctx.ellipse(0, u*.3, u*.18, u*.38, 0, 0, PI2); ctx.fill();
    ctx.fillStyle = '#2a5a80';
    ctx.beginPath(); ctx.ellipse(s*u*.05, u*.72, u*.22, u*.12, .2*s, 0, PI2); ctx.fill();
    ctx.fillStyle = dk;
    ctx.restore();
  }

  // Tail
  ctx.fillStyle = dk;
  ctx.beginPath(); ctx.ellipse(-u*.75, -u*.55, u*.32, u*.18, -.6, 0, PI2); ctx.fill();

  // Body
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.ellipse(0, -u*.85, u*.88, u*1.05, 0, 0, PI2); ctx.fill();
  // Belly
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath(); ctx.ellipse(0, -u*.65, u*.5, u*.6, 0, 0, PI2); ctx.fill();

  // Arms
  ctx.fillStyle = dk;
  ctx.beginPath(); ctx.ellipse(-u*.85, -u*.95, u*.3, u*.18, -.5, 0, PI2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(u*.85, -u*.95, u*.3, u*.18, .5, 0, PI2); ctx.fill();

  // Horns
  ctx.fillStyle = dk;
  ctx.beginPath(); ctx.moveTo(-u*.28, -u*1.82); ctx.lineTo(-u*.08, -u*1.52); ctx.lineTo(-u*.52, -u*1.57); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(u*.08, -u*1.88); ctx.lineTo(u*.32, -u*1.58); ctx.lineTo(-u*.12, -u*1.62); ctx.closePath(); ctx.fill();

  // Eyes
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.ellipse(-u*.3, -u*1.28, u*.29, u*.33, 0, 0, PI2);
  ctx.ellipse(u*.3, -u*1.28, u*.29, u*.33, 0, 0, PI2); ctx.fill();
  ctx.fillStyle = '#1a1a30';
  ctx.beginPath(); ctx.ellipse(-u*.2, -u*1.28, u*.17, u*.21, 0, 0, PI2);
  ctx.ellipse(u*.4, -u*1.28, u*.17, u*.21, 0, 0, PI2); ctx.fill();
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(-u*.14, -u*1.36, u*.065, 0, PI2); ctx.arc(u*.46, -u*1.36, u*.065, 0, PI2); ctx.fill();

  // Mouth
  ctx.strokeStyle = '#1a3a5a'; ctx.lineWidth = u*.1; ctx.lineCap = 'round';
  ctx.beginPath();
  if (opts.jumping) {
    ctx.arc(0, -u*.82, u*.22, Math.PI+.35, PI2-.35); // open mouth (jumping)
  } else {
    ctx.arc(0, -u*.92, u*.28, .15, Math.PI-.15); // smile
  }
  ctx.stroke();

  ctx.restore();
}

// ========== GROUND / BG HELPERS ==========
function drawForestBg(ctx, W, H) {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1a3a2a');
  grad.addColorStop(0.5, '#2a5a3a');
  grad.addColorStop(1, '#1a4a2a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  for (let i = 0; i < 30; i++) {
    ctx.beginPath();
    ctx.arc((i*137+42)%W, (i*73+19)%(H*0.5), 1 + (i%3)*0.5, 0, PI2);
    ctx.fill();
  }

  // Mountains
  ctx.fillStyle = '#1a3a28';
  ctx.beginPath();
  ctx.moveTo(0, H*0.6);
  for (let x = 0; x <= W; x += W/6) {
    ctx.lineTo(x, H*0.6 - Math.sin(x*0.003)*H*0.15 - Math.random()*H*0.05);
  }
  ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();

  // Trees silhouette
  ctx.fillStyle = '#0a2a18';
  for (let i = 0; i < 8; i++) {
    const tx = i * W/7 + W*0.05;
    const ty = H*0.65;
    ctx.beginPath();
    ctx.moveTo(tx - W*0.03, ty); ctx.lineTo(tx, ty - H*0.15); ctx.lineTo(tx + W*0.03, ty);
    ctx.closePath(); ctx.fill();
  }
}

function drawGround(ctx, W, groundY, groundH) {
  ctx.fillStyle = '#3a6a28';
  ctx.fillRect(0, groundY, W, groundH);
  ctx.fillStyle = '#2a5a18';
  ctx.fillRect(0, groundY, W, 4);
  // Grass tufts
  ctx.fillStyle = '#5a8a38';
  for (let x = 0; x < W; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, groundY); ctx.lineTo(x+5, groundY-8); ctx.lineTo(x+10, groundY);
    ctx.fill();
  }
}

function drawGem(ctx, x, y, r) {
  ctx.save(); ctx.translate(x, y);
  ctx.shadowColor = 'hsl(120,100%,70%)'; ctx.shadowBlur = 8;
  ctx.fillStyle = 'hsl(120,100%,65%)';
  ctx.beginPath(); ctx.moveTo(0,-r); ctx.lineTo(r*.6,-r*.2); ctx.lineTo(r*.6,r*.4);
  ctx.lineTo(0,r); ctx.lineTo(-r*.6,r*.4); ctx.lineTo(-r*.6,-r*.2); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath(); ctx.moveTo(0,-r*.75); ctx.lineTo(r*.22,-.08*r); ctx.lineTo(0,.1*r); ctx.lineTo(-r*.12,-.25*r); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawSpike(ctx, x, y, u) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#555';
  ctx.beginPath(); ctx.moveTo(-u*.45, 0); ctx.lineTo(-u*.15, 0); ctx.lineTo(-u*.35, -u*.85); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(u*.15, 0); ctx.lineTo(u*.45, 0); ctx.lineTo(u*.35, -u*.9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#888';
  ctx.beginPath(); ctx.moveTo(-u*.25, 0); ctx.lineTo(u*.25, 0); ctx.lineTo(u*.05, -u*1.35); ctx.lineTo(-u*.05, -u*1.35); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath(); ctx.arc(0, -u*1.3, u*.06, 0, PI2); ctx.fill();
  ctx.restore();
}

function drawTroll(ctx, x, y, u) {
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = '#3a7a3a';
  ctx.beginPath(); ctx.ellipse(0, -u*1.3, u*1.1, u*1.4, 0, 0, PI2); ctx.fill();
  ctx.fillStyle = '#5a9a5a';
  ctx.beginPath(); ctx.ellipse(0, -u*1, u*.6, u*.7, 0, 0, PI2); ctx.fill();
  ctx.fillStyle = '#ff0';
  ctx.beginPath(); ctx.ellipse(-u*.35, -u*1.9, u*.22, u*.18, -.3, 0, PI2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(u*.35, -u*1.9, u*.22, u*.18, .3, 0, PI2); ctx.fill();
  ctx.fillStyle = '#200';
  ctx.beginPath(); ctx.arc(-u*.3, -u*1.88, u*.1, 0, PI2); ctx.fill();
  ctx.beginPath(); ctx.arc(u*.4, -u*1.88, u*.1, 0, PI2); ctx.fill();
  ctx.fillStyle = '#ffe';
  ctx.beginPath(); ctx.moveTo(-u*.5, -u*.9); ctx.lineTo(-u*.35, -u*.5); ctx.lineTo(-u*.2, -u*.9); ctx.fill();
  ctx.beginPath(); ctx.moveTo(u*.5, -u*.9); ctx.lineTo(u*.35, -u*.5); ctx.lineTo(u*.2, -u*.9); ctx.fill();
  ctx.restore();
}

// ========== APP ICON (512x512) ==========
function genAppIcon() {
  const S = 512;
  const canvas = createCanvas(S, S);
  const ctx = canvas.getContext('2d');

  // Rounded square background
  const r = 80;
  const grad = ctx.createLinearGradient(0, 0, S, S);
  grad.addColorStop(0, '#1a4a2a');
  grad.addColorStop(0.5, '#2a6a3a');
  grad.addColorStop(1, '#0a3a1a');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(r, 0); ctx.lineTo(S-r, 0); ctx.quadraticCurveTo(S, 0, S, r);
  ctx.lineTo(S, S-r); ctx.quadraticCurveTo(S, S, S-r, S);
  ctx.lineTo(r, S); ctx.quadraticCurveTo(0, S, 0, S-r);
  ctx.lineTo(0, r); ctx.quadraticCurveTo(0, 0, r, 0);
  ctx.closePath(); ctx.fill();

  // Decorative dots
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 20; i++) {
    ctx.beginPath(); ctx.arc((i*97+30)%S, (i*61+40)%S, 3+i%4, 0, PI2); ctx.fill();
  }

  // Draw Gronk centered and large
  drawGronk(ctx, S/2, S*0.72, S*0.2, { noShadow: false, jumping: true });

  // Title text at bottom
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
  ctx.font = 'bold 52px monospace'; ctx.fillStyle = '#FFD700';
  ctx.fillText("GRONK'S", S/2, S*0.88);
  ctx.font = 'bold 40px monospace'; ctx.fillStyle = '#FFAA00';
  ctx.fillText('RUN', S/2, S*0.96);
  ctx.shadowBlur = 0;

  return canvas;
}

// ========== FEATURE GRAPHIC (1024x500) ==========
function genFeatureGraphic() {
  const W = 1024, H = 500;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  drawForestBg(ctx, W, H);

  // Ground
  const groundY = H * 0.78;
  drawGround(ctx, W, groundY, H - groundY);

  // Gems scattered
  for (let i = 0; i < 6; i++) {
    drawGem(ctx, W*0.15 + i*W*0.12, groundY - 80 - Math.sin(i*1.2)*30, 12);
  }

  // Spikes
  drawSpike(ctx, W*0.7, groundY, 25);
  drawSpike(ctx, W*0.75, groundY, 25);

  // Troll in background
  drawTroll(ctx, W*0.85, groundY, 22);

  // Gronk running (jumping pose)
  drawGronk(ctx, W*0.32, groundY - 40, 45, { jumping: true, legSwing: 0.3 });

  // Title
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 12;
  ctx.font = 'bold 72px monospace'; ctx.fillStyle = '#FFD700';
  ctx.fillText("GRONK'S RUN", W/2, H*0.22);
  ctx.shadowBlur = 0;

  // Tagline
  ctx.font = 'bold 28px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('Run. Jump. Smash!', W/2, H*0.36);

  // Action lines behind Gronk
  ctx.strokeStyle = 'rgba(255,215,0,0.3)'; ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const ly = groundY - 80 + i*15;
    ctx.beginPath(); ctx.moveTo(W*0.05, ly); ctx.lineTo(W*0.2, ly); ctx.stroke();
  }

  return canvas;
}

// ========== SCREENSHOTS (1080x1920) ==========

// Screenshot 1: Gameplay action
function genScreenshot1() {
  const W = 1080, H = 1920;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const u = 40;

  // Forest BG
  drawForestBg(ctx, W, H);

  // Ground
  const groundY = H * 0.7;
  drawGround(ctx, W, groundY, H - groundY);

  // Platforms
  ctx.fillStyle = '#3a6a28';
  ctx.fillRect(W*0.1, groundY - 180, W*0.3, 20);
  ctx.fillRect(W*0.55, groundY - 300, W*0.35, 20);

  // Gems
  for (let i = 0; i < 8; i++) {
    drawGem(ctx, W*0.15 + i*W*0.1, groundY - 60 - Math.sin(i*0.8)*40, 14);
  }

  // Spikes on ground
  drawSpike(ctx, W*0.6, groundY, u);
  drawSpike(ctx, W*0.65, groundY, u);

  // Gronk jumping
  drawGronk(ctx, W*0.35, groundY - 120, u*1.2, { jumping: true, legSwing: 0.4 });

  // Troll enemy
  drawTroll(ctx, W*0.78, groundY, u*.8);

  // HUD
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = 'bold 36px monospace'; ctx.fillStyle = '#FFD700';
  ctx.fillText('Score: 1,250', 30, 60);
  ctx.fillStyle = '#44FF44';
  ctx.fillText('Level 3', 30, 105);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFD700';
  ctx.fillText('Gems: 47', W-30, 60);
  ctx.fillStyle = '#FF4444';
  ctx.fillText('\u2764 \u2764 \u2764', W-30, 105);

  // Speed lines
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    const ly = H*0.2 + i * H*0.05;
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W*0.08 + Math.random()*W*0.05, ly); ctx.stroke();
  }

  // Banner text
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
  ctx.font = 'bold 56px monospace'; ctx.fillStyle = '#FFD700';
  ctx.fillText('ACTION-PACKED', W/2, H*0.08);
  ctx.font = 'bold 44px monospace'; ctx.fillStyle = 'white';
  ctx.fillText('RUNNER GAMEPLAY', W/2, H*0.12);
  ctx.shadowBlur = 0;

  return canvas;
}

// Screenshot 2: Character selection
function genScreenshot2() {
  const W = 1080, H = 1920;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Dark BG
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a1628');
  grad.addColorStop(1, '#1a2a48');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // Title
  ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 10;
  ctx.font = 'bold 52px monospace'; ctx.fillStyle = '#FFD700';
  ctx.fillText('CHOOSE YOUR HERO', W/2, H*0.07);
  ctx.shadowBlur = 0;

  // Character cards
  const chars = [
    { name: 'GRONK', col: '#4a9a4a', dk: '#2a6a2a', desc: 'The Original', y: H*0.18 },
    { name: 'PIP', col: '#5abada', dk: '#3a8aaa', desc: 'Speed Demon', y: H*0.35 },
    { name: 'BRUK', col: '#8a6a3a', dk: '#5a4a2a', desc: 'Tank', y: H*0.52 },
    { name: 'ZARA', col: '#aa44aa', dk: '#772277', desc: 'Agile', y: H*0.69 },
    { name: 'REX', col: '#cc4422', dk: '#992211', desc: 'Fierce', y: H*0.86 },
  ];

  chars.forEach((ch, i) => {
    const cardW = W*0.85, cardH = H*0.13;
    const cx = W/2 - cardW/2, cy = ch.y;

    // Card bg
    ctx.fillStyle = i === 0 ? 'rgba(100,200,100,0.2)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(cx, cy, cardW, cardH);
    ctx.strokeStyle = i === 0 ? '#4a9a4a' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = i === 0 ? 3 : 1;
    ctx.strokeRect(cx, cy, cardW, cardH);

    // Character body (simplified)
    const charX = cx + cardH*0.6, charY = cy + cardH*0.85;
    const u = cardH * 0.2;
    ctx.fillStyle = ch.col;
    ctx.beginPath(); ctx.ellipse(charX, charY - u*2, u*1.5, u*2, 0, 0, PI2); ctx.fill();
    ctx.fillStyle = 'white';
    ctx.beginPath(); ctx.ellipse(charX - u*.5, charY - u*2.8, u*.5, u*.6, 0, 0, PI2);
    ctx.ellipse(charX + u*.5, charY - u*2.8, u*.5, u*.6, 0, 0, PI2); ctx.fill();
    ctx.fillStyle = '#1a1a30';
    ctx.beginPath(); ctx.arc(charX - u*.3, charY - u*2.8, u*.3, 0, PI2);
    ctx.arc(charX + u*.7, charY - u*2.8, u*.3, 0, PI2); ctx.fill();

    // Name and desc
    ctx.textAlign = 'left';
    ctx.font = 'bold 38px monospace'; ctx.fillStyle = '#FFD700';
    ctx.fillText(ch.name, cx + cardH*1.2, cy + cardH*0.4);
    ctx.font = '26px monospace'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText(ch.desc, cx + cardH*1.2, cy + cardH*0.7);
    ctx.textAlign = 'center';

    // Selected indicator
    if (i === 0) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 32px monospace'; ctx.fillStyle = '#44FF44';
      ctx.fillText('SELECTED \u2714', cx + cardW - 20, cy + cardH*0.5);
      ctx.textAlign = 'center';
    }
  });

  return canvas;
}

// Screenshot 3: Level map
function genScreenshot3() {
  const W = 1080, H = 1920;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Dark bg
  ctx.fillStyle = '#0a1628'; ctx.fillRect(0, 0, W, H);

  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i = 0; i < 60; i++) {
    ctx.beginPath(); ctx.arc((i*137+42)%W, (i*73+19)%H, 1+(i%3)*0.4, 0, PI2); ctx.fill();
  }

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';

  // Title
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, W, 140);
  ctx.font = 'bold 48px monospace'; ctx.fillStyle = '#FFD700';
  ctx.fillText("GRONK'S JOURNEY", W/2, 70);

  // Level nodes
  const themes = ['#2a5a28', '#4a8aaa', '#8a3a1a', '#5a6aaa', '#3a2a4a'];
  const themeNames = ['Forest', 'Glacier', 'Volcano', 'Sky', 'Shadow'];
  for (let lvl = 1; lvl <= 15; lvl++) {
    const ny = H - 180 - (lvl-1) * 110;
    const nx = (lvl%2 === 0) ? W*0.32 : W*0.68;
    if (ny < 150 || ny > H-50) continue;

    const themeIdx = Math.floor((lvl-1)/5) % 5;
    const isBoss = lvl % 5 === 0;
    const completed = lvl <= 7;
    const current = lvl === 8;

    // Path line
    if (lvl < 15) {
      const ny2 = H - 180 - lvl * 110;
      const nx2 = ((lvl+1)%2 === 0) ? W*0.32 : W*0.68;
      ctx.strokeStyle = completed ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 3; ctx.setLineDash(completed ? [] : [8,8]);
      ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx2, ny2); ctx.stroke();
      ctx.setLineDash([]);
    }

    // Node
    const r = isBoss ? 45 : 35;
    if (current) {
      ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 15;
    }
    ctx.fillStyle = completed ? themes[themeIdx] : current ? '#FFD700' : 'rgba(255,255,255,0.1)';
    ctx.beginPath(); ctx.arc(nx, ny, r, 0, PI2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = completed ? '#FFD700' : 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(nx, ny, r, 0, PI2); ctx.stroke();

    // Level number
    ctx.font = `bold ${isBoss ? 28 : 22}px monospace`;
    ctx.fillStyle = completed || current ? 'white' : 'rgba(255,255,255,0.3)';
    ctx.fillText(lvl.toString(), nx, ny);

    // Stars for completed
    if (completed) {
      const stars = Math.min(3, Math.floor(Math.random()*3)+1);
      ctx.font = '16px monospace'; ctx.fillStyle = '#FFD700';
      ctx.fillText('\u2B50'.repeat(stars), nx, ny + r + 16);
    }

    // Boss label
    if (isBoss) {
      ctx.font = 'bold 16px monospace'; ctx.fillStyle = '#FF4444';
      ctx.fillText('BOSS', nx, ny - r - 14);
    }
  }

  // Banner
  ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
  ctx.font = 'bold 52px monospace'; ctx.fillStyle = '#FFD700';
  ctx.fillText('40 LEVELS', W/2, H*0.06);
  ctx.font = 'bold 38px monospace'; ctx.fillStyle = 'white';
  ctx.fillText('5 UNIQUE WORLDS', W/2, H*0.10);
  ctx.shadowBlur = 0;

  return canvas;
}

// Screenshot 4: Boss fight
function genScreenshot4() {
  const W = 1080, H = 1920;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const u = 40;

  // Volcano BG
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#2a0a0a');
  grad.addColorStop(0.4, '#4a1a0a');
  grad.addColorStop(1, '#1a0a0a');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  // Lava particles
  ctx.fillStyle = 'rgba(255,100,0,0.2)';
  for (let i = 0; i < 25; i++) {
    ctx.beginPath(); ctx.arc((i*147+30)%W, (i*89+50)%H, 2+i%5, 0, PI2); ctx.fill();
  }

  // Ground (volcanic)
  const groundY = H * 0.7;
  ctx.fillStyle = '#4a1a08'; ctx.fillRect(0, groundY, W, H-groundY);
  ctx.fillStyle = '#3a0a04'; ctx.fillRect(0, groundY, W, 4);

  // Boss golem (large)
  const bossX = W*0.65, bossY = groundY;
  ctx.fillStyle = '#5a5a5a';
  ctx.beginPath(); ctx.ellipse(bossX, bossY - u*3.5, u*3, u*4, 0, 0, PI2); ctx.fill();
  ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(bossX - u, bossY - u*5.5); ctx.lineTo(bossX - u*.3, bossY - u*4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bossX + u*.8, bossY - u*5); ctx.lineTo(bossX + u*1.3, bossY - u*3.5); ctx.stroke();
  ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 15;
  ctx.fillStyle = '#ff6600';
  ctx.beginPath(); ctx.arc(bossX - u, bossY - u*4.8, u*.4, 0, PI2); ctx.fill();
  ctx.beginPath(); ctx.arc(bossX + u, bossY - u*4.8, u*.4, 0, PI2); ctx.fill();
  ctx.shadowBlur = 0;
  // Arms
  ctx.fillStyle = '#4a4a4a';
  ctx.beginPath(); ctx.ellipse(bossX - u*3, bossY - u*3.5, u*1.2, u*.7, -.4, 0, PI2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(bossX + u*3, bossY - u*3.5, u*1.2, u*.7, .4, 0, PI2); ctx.fill();
  // Mouth
  ctx.strokeStyle = '#ff4400'; ctx.lineWidth = u*.2;
  ctx.beginPath(); ctx.moveTo(bossX - u*.8, bossY - u*3.5); ctx.lineTo(bossX - u*.3, bossY - u*3);
  ctx.lineTo(bossX + u*.3, bossY - u*3.5); ctx.lineTo(bossX + u*.8, bossY - u*3); ctx.stroke();

  // HP bar for boss
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bossX - u*3, bossY - u*7, u*6, u*.5);
  ctx.fillStyle = '#F44336'; ctx.fillRect(bossX - u*3, bossY - u*7, u*4, u*.5);
  ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = 'white'; ctx.fillText('STONE GOLEM', bossX, bossY - u*7.8);

  // Gronk
  drawGronk(ctx, W*0.25, groundY, u*1.1, { jumping: true, legSwing: 0.2 });

  // Shockwave projectile
  ctx.fillStyle = 'rgba(255,120,0,0.8)';
  ctx.beginPath(); ctx.ellipse(W*0.45, groundY - u*.3, u*1.2, u*.5, 0, 0, PI2); ctx.fill();
  ctx.fillStyle = 'rgba(255,200,50,0.5)';
  ctx.beginPath(); ctx.ellipse(W*0.45, groundY - u*.6, u*.6, u*.25, 0, 0, PI2); ctx.fill();

  // HUD
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = 'bold 36px monospace'; ctx.fillStyle = '#FFD700';
  ctx.fillText('Score: 3,780', 30, 60);
  ctx.fillStyle = '#FF4444';
  ctx.fillText('BOSS FIGHT!', 30, 105);

  // Banner
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#FF4400'; ctx.shadowBlur = 15;
  ctx.font = 'bold 56px monospace'; ctx.fillStyle = '#FF4444';
  ctx.fillText('EPIC BOSS BATTLES', W/2, H*0.08);
  ctx.font = 'bold 38px monospace'; ctx.fillStyle = '#FFAA00';
  ctx.fillText('EVERY 5 LEVELS', W/2, H*0.12);
  ctx.shadowBlur = 0;

  return canvas;
}

// ========== GENERATE ALL ==========
function main() {
  console.log('Generating store assets...');

  const icon = genAppIcon();
  fs.writeFileSync(path.join(outDir, 'app-icon-512.png'), icon.toBuffer('image/png'));
  console.log('  app-icon-512.png (512x512)');

  const feature = genFeatureGraphic();
  fs.writeFileSync(path.join(outDir, 'feature-graphic-1024x500.png'), feature.toBuffer('image/png'));
  console.log('  feature-graphic-1024x500.png');

  const ss1 = genScreenshot1();
  fs.writeFileSync(path.join(outDir, 'screenshot-1-gameplay.png'), ss1.toBuffer('image/png'));
  console.log('  screenshot-1-gameplay.png (1080x1920)');

  const ss2 = genScreenshot2();
  fs.writeFileSync(path.join(outDir, 'screenshot-2-characters.png'), ss2.toBuffer('image/png'));
  console.log('  screenshot-2-characters.png (1080x1920)');

  const ss3 = genScreenshot3();
  fs.writeFileSync(path.join(outDir, 'screenshot-3-levelmap.png'), ss3.toBuffer('image/png'));
  console.log('  screenshot-3-levelmap.png (1080x1920)');

  const ss4 = genScreenshot4();
  fs.writeFileSync(path.join(outDir, 'screenshot-4-bossfight.png'), ss4.toBuffer('image/png'));
  console.log('  screenshot-4-bossfight.png (1080x1920)');

  console.log(`\nAll assets saved to ${outDir}`);
}

main();
