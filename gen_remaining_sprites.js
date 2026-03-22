/**
 * Generate sprite sheets for bomber, charger, and fire_geyser
 * to match the style/format of the regenerated folder.
 * Output to assets/spritesheets/enemies/generated/
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const FRAME_W = 720;
const FRAME_H = 720;
const PI2 = Math.PI * 2;

function makeFrame(w, h, drawFn, unit, originY) {
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h * (originY || 0.85));
  drawFn(ctx, unit || 80);
  ctx.restore();
  return canvas;
}

// ========== BOMBER (flying creature with bomb pouch) ==========
function drawBomberFrame(ctx, u, wingPhase, bombState) {
  // Body - large oval
  ctx.fillStyle = "#8a4a2a";
  ctx.beginPath(); ctx.ellipse(0, 0, u*0.9, u*0.5, 0, 0, PI2); ctx.fill();

  // Wings with phase
  const wf = wingPhase;
  ctx.fillStyle = "#aa6a3a";
  for (let s = -1; s <= 1; s += 2) {
    ctx.beginPath();
    ctx.moveTo(s*u*0.5, 0);
    ctx.bezierCurveTo(s*u*1.5, -u*wf, s*u*2, -u*(0.3+wf), s*u*1.8, u*0.3);
    ctx.bezierCurveTo(s*u*1, u*0.2, s*u*0.6, u*0.1, s*u*0.5, 0);
    ctx.fill();
  }

  // Wing feather details
  ctx.strokeStyle = "#8a5a2a";
  ctx.lineWidth = 1.5;
  for (let s = -1; s <= 1; s += 2) {
    for (let f = 0; f < 3; f++) {
      const fx = s * (u*0.8 + f*u*0.35);
      const fy = -u*wf*0.5 + f*u*0.08;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx + s*u*0.25, fy + u*0.15);
      ctx.stroke();
    }
  }

  // Bomb pouch / belly
  ctx.fillStyle = "#cc3300";
  ctx.beginPath(); ctx.ellipse(0, u*0.25, u*0.3, u*0.15, 0, 0, PI2); ctx.fill();

  // Bomb detail
  if (bombState === 'armed') {
    ctx.fillStyle = "#333";
    ctx.beginPath(); ctx.arc(0, u*0.35, u*0.12, 0, PI2); ctx.fill();
    // Fuse spark
    ctx.fillStyle = "#ff8800";
    ctx.shadowColor = "#ff4400";
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(0, u*0.22, u*0.05, 0, PI2); ctx.fill();
    ctx.shadowBlur = 0;
  } else if (bombState === 'drop') {
    ctx.fillStyle = "#333";
    ctx.beginPath(); ctx.arc(0, u*0.55, u*0.12, 0, PI2); ctx.fill();
    ctx.fillStyle = "#ff4400";
    ctx.beginPath(); ctx.arc(0, u*0.42, u*0.06, 0, PI2); ctx.fill();
  }

  // Eye
  ctx.fillStyle = "#ff0";
  ctx.beginPath(); ctx.arc(-u*0.5, -u*0.1, u*0.1, 0, PI2); ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.arc(-u*0.48, -u*0.1, u*0.04, 0, PI2); ctx.fill();

  // Beak/tail
  ctx.fillStyle = "#6a3a1a";
  ctx.beginPath();
  ctx.moveTo(u*0.7, 0);
  ctx.lineTo(u*1.4, -u*0.4);
  ctx.lineTo(u*1.4, u*0.2);
  ctx.closePath();
  ctx.fill();

  // Head tuft
  ctx.fillStyle = "#aa6a3a";
  ctx.beginPath();
  ctx.moveTo(-u*0.6, -u*0.35);
  ctx.lineTo(-u*0.75, -u*0.6);
  ctx.lineTo(-u*0.45, -u*0.4);
  ctx.fill();
}

function genBomberSheet() {
  // 4x2: Row 0 = idle wing flap (4 frames), Row 1 = attack (3) + hit (1)
  const cols = 4, rows = 2;
  const canvas = createCanvas(FRAME_W * cols, FRAME_H * rows);
  const ctx = canvas.getContext('2d');

  // Idle: wing flap cycle
  for (let i = 0; i < 4; i++) {
    const wf = Math.sin(i * Math.PI / 2) * 0.4;
    const f = makeFrame(FRAME_W, FRAME_H, (c, u) => drawBomberFrame(c, u, wf, null), 80, 0.5);
    ctx.drawImage(f, i * FRAME_W, 0);
  }

  // Attack: bomb arming and dropping
  const attackStates = [
    { wf: 0.2, bomb: 'armed' },
    { wf: -0.1, bomb: 'armed' },
    { wf: -0.3, bomb: 'drop' },
  ];
  for (let i = 0; i < 3; i++) {
    const { wf, bomb } = attackStates[i];
    const f = makeFrame(FRAME_W, FRAME_H, (c, u) => drawBomberFrame(c, u, wf, bomb), 80, 0.5);
    ctx.drawImage(f, i * FRAME_W, FRAME_H);
  }

  // Hit frame
  {
    const f = makeFrame(FRAME_W, FRAME_H, (c, u) => {
      c.globalAlpha = 0.7;
      drawBomberFrame(c, u, 0.1, null);
      c.globalAlpha = 0.4;
      c.fillStyle = "#fff";
      c.beginPath(); c.ellipse(0, 0, u*1.2, u*0.7, 0, 0, PI2); c.fill();
      c.globalAlpha = 1;
    }, 80, 0.5);
    ctx.drawImage(f, 3 * FRAME_W, FRAME_H);
  }

  return canvas;
}

// ========== CHARGER (rhino/beast) ==========
function drawChargerFrame(ctx, u, legPhase, state) {
  const lAnim = legPhase;

  // Main body
  ctx.fillStyle = "#CC8833";
  ctx.beginPath(); ctx.ellipse(0, -u*0.9, u*1.3, u*0.85, 0, 0, PI2); ctx.fill();

  // Body shading
  ctx.fillStyle = "#BB7722";
  ctx.beginPath(); ctx.ellipse(u*0.2, -u*0.7, u*0.8, u*0.5, 0.1, 0, PI2); ctx.fill();

  // Head
  ctx.fillStyle = "#BB7722";
  ctx.beginPath(); ctx.ellipse(-u*1, -u*1.1, u*0.55, u*0.5, -0.2, 0, PI2); ctx.fill();

  // Horns/tusks
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.moveTo(-u*1.3, -u*0.8); ctx.lineTo(-u*1.2, -u*0.35); ctx.lineTo(-u*1.1, -u*0.8); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-u*1.0, -u*0.75); ctx.lineTo(-u*0.9, -u*0.3); ctx.lineTo(-u*0.8, -u*0.75); ctx.fill();

  // Eye
  ctx.fillStyle = state === 'charge' ? "#ff0000" : "#f00";
  ctx.shadowColor = state === 'charge' ? "#ff0000" : "transparent";
  ctx.shadowBlur = state === 'charge' ? 10 : 0;
  ctx.beginPath(); ctx.arc(-u*1.1, -u*1.2, u*0.12, 0, PI2); ctx.fill();
  ctx.shadowBlur = 0;

  // Legs with animation
  ctx.fillStyle = "#AA6622";
  for (let i = -1; i <= 1; i += 2) {
    ctx.save();
    ctx.translate(i*u*0.5, -u*0.08);
    ctx.rotate(i * lAnim);
    ctx.fillRect(-u*0.12, 0, u*0.24, u*0.55);
    // Hoof
    ctx.fillStyle = "#886620";
    ctx.fillRect(-u*0.15, u*0.45, u*0.3, u*0.1);
    ctx.fillStyle = "#AA6622";
    ctx.restore();
  }

  // Tail
  ctx.strokeStyle = "#CC8833";
  ctx.lineWidth = u*0.15;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(u*1.1, -u*0.9);
  ctx.quadraticCurveTo(u*1.6, -u*1.8, u*1.3, -u*1.5);
  ctx.stroke();

  // Tail tuft
  ctx.fillStyle = "#AA6622";
  ctx.beginPath(); ctx.arc(u*1.3, -u*1.55, u*0.12, 0, PI2); ctx.fill();

  // Dust cloud for charging
  if (state === 'charge') {
    ctx.fillStyle = "rgba(180,150,100,0.4)";
    for (let d = 0; d < 4; d++) {
      ctx.beginPath();
      ctx.arc(u*1.0 + d*u*0.3, u*0.1 + Math.sin(d*2)*u*0.1, u*(0.15 + d*0.05), 0, PI2);
      ctx.fill();
    }
  }
}

function genChargerSheet() {
  // 4x2: Row 0 = idle/gallop (4 frames), Row 1 = charge attack (3) + hit (1)
  const cols = 4, rows = 2;
  const canvas = createCanvas(FRAME_W * cols, FRAME_H * rows);
  const ctx = canvas.getContext('2d');

  // Idle: galloping cycle
  for (let i = 0; i < 4; i++) {
    const leg = Math.sin(i * Math.PI / 2) * 0.3;
    const f = makeFrame(FRAME_W, FRAME_H, (c, u) => drawChargerFrame(c, u, leg, 'idle'), 80, 0.75);
    ctx.drawImage(f, i * FRAME_W, 0);
  }

  // Attack: charging
  for (let i = 0; i < 3; i++) {
    const leg = Math.sin(i * Math.PI * 0.8) * 0.5;
    const f = makeFrame(FRAME_W, FRAME_H, (c, u) => drawChargerFrame(c, u, leg, 'charge'), 80, 0.75);
    ctx.drawImage(f, i * FRAME_W, FRAME_H);
  }

  // Hit
  {
    const f = makeFrame(FRAME_W, FRAME_H, (c, u) => {
      c.globalAlpha = 0.7;
      drawChargerFrame(c, u, 0, 'idle');
      c.globalAlpha = 0.4;
      c.fillStyle = "#fff";
      c.beginPath(); c.ellipse(0, -u*0.9, u*1.5, u*1.0, 0, 0, PI2); c.fill();
      c.globalAlpha = 1;
    }, 80, 0.75);
    ctx.drawImage(f, 3 * FRAME_W, FRAME_H);
  }

  return canvas;
}

// ========== FIRE GEYSER (ground eruption) ==========
function drawFireGeyserFrame(ctx, u, eruptPhase) {
  // Ground mound base
  ctx.fillStyle = "#3a1a08";
  ctx.beginPath(); ctx.ellipse(0, -u*0.1, u*0.6, u*0.25, 0, 0, PI2); ctx.fill();

  // Cracks in ground
  ctx.strokeStyle = "#ff4400";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-u*0.3, -u*0.05); ctx.lineTo(-u*0.1, -u*0.15); ctx.lineTo(u*0.15, -u*0.05); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(u*0.1, -u*0.1); ctx.lineTo(u*0.3, -u*0.2); ctx.stroke();

  // Rock rim
  ctx.fillStyle = "#4a2a10";
  ctx.beginPath(); ctx.ellipse(0, -u*0.15, u*0.45, u*0.15, 0, 0, PI2); ctx.fill();

  // Inner glow
  ctx.fillStyle = "rgba(255,100,0,0.5)";
  ctx.beginPath(); ctx.ellipse(0, -u*0.15, u*0.25, u*0.08, 0, 0, PI2); ctx.fill();

  if (eruptPhase > 0) {
    const fH = eruptPhase * u * 2.8;
    const intensity = eruptPhase;

    // Outer fire column
    ctx.shadowColor = "rgba(255,150,0,0.8)";
    ctx.shadowBlur = 15 * intensity;
    ctx.fillStyle = `rgba(255,${Math.round(60 + 40*intensity)},0,${0.5 + intensity*0.3})`;
    ctx.beginPath();
    ctx.moveTo(-u*0.35, -u*0.15);
    ctx.lineTo(u*0.35, -u*0.15);
    ctx.quadraticCurveTo(u*0.25, -u*0.15 - fH*0.6, u*0.12, -u*0.15 - fH);
    ctx.lineTo(-u*0.12, -u*0.15 - fH);
    ctx.quadraticCurveTo(-u*0.25, -u*0.15 - fH*0.6, -u*0.35, -u*0.15);
    ctx.closePath();
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = `rgba(255,${Math.round(180 + 50*intensity)},50,${0.4 + intensity*0.3})`;
    ctx.beginPath();
    ctx.moveTo(-u*0.18, -u*0.15);
    ctx.lineTo(u*0.18, -u*0.15);
    ctx.quadraticCurveTo(u*0.1, -u*0.15 - fH*0.5, u*0.05, -u*0.15 - fH*0.8);
    ctx.lineTo(-u*0.05, -u*0.15 - fH*0.8);
    ctx.quadraticCurveTo(-u*0.1, -u*0.15 - fH*0.5, -u*0.18, -u*0.15);
    ctx.closePath();
    ctx.fill();

    // Ember particles
    ctx.fillStyle = "#ffcc00";
    const numEmbers = Math.floor(3 + intensity * 5);
    for (let e = 0; e < numEmbers; e++) {
      const angle = (e / numEmbers) * PI2 + intensity * 2;
      const dist = u * 0.2 + Math.sin(angle * 3) * u * 0.15;
      const height = u * 0.15 + fH * (0.3 + Math.sin(angle * 2) * 0.4);
      ctx.beginPath();
      ctx.arc(Math.cos(angle) * dist, -height, u * 0.04, 0, PI2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
  }
}

function genFireGeyserSheet() {
  // 4x2: Row 0 = idle/dormant (1) + eruption buildup (3), Row 1 = full eruption (3) + dormant glow (1)
  const cols = 4, rows = 2;
  const canvas = createCanvas(FRAME_W * cols, FRAME_H * rows);
  const ctx = canvas.getContext('2d');

  // Row 0: Dormant mound (idle) + eruption start
  // Frame 0: dormant
  let f = makeFrame(FRAME_W, FRAME_H, (c, u) => drawFireGeyserFrame(c, u, 0), 80, 0.85);
  ctx.drawImage(f, 0, 0);
  // Frame 1: small eruption beginning
  f = makeFrame(FRAME_W, FRAME_H, (c, u) => drawFireGeyserFrame(c, u, 0.15), 80, 0.85);
  ctx.drawImage(f, FRAME_W, 0);
  // Frame 2: building
  f = makeFrame(FRAME_W, FRAME_H, (c, u) => drawFireGeyserFrame(c, u, 0.35), 80, 0.85);
  ctx.drawImage(f, 2 * FRAME_W, 0);
  // Frame 3: medium
  f = makeFrame(FRAME_W, FRAME_H, (c, u) => drawFireGeyserFrame(c, u, 0.55), 80, 0.85);
  ctx.drawImage(f, 3 * FRAME_W, 0);

  // Row 1: Full eruption + winding down
  // Frame 4: strong
  f = makeFrame(FRAME_W, FRAME_H, (c, u) => drawFireGeyserFrame(c, u, 0.75), 80, 0.85);
  ctx.drawImage(f, 0, FRAME_H);
  // Frame 5: peak eruption
  f = makeFrame(FRAME_W, FRAME_H, (c, u) => drawFireGeyserFrame(c, u, 1.0), 80, 0.85);
  ctx.drawImage(f, FRAME_W, FRAME_H);
  // Frame 6: winding down
  f = makeFrame(FRAME_W, FRAME_H, (c, u) => drawFireGeyserFrame(c, u, 0.6), 80, 0.85);
  ctx.drawImage(f, 2 * FRAME_W, FRAME_H);
  // Frame 7: almost done
  f = makeFrame(FRAME_W, FRAME_H, (c, u) => drawFireGeyserFrame(c, u, 0.2), 80, 0.85);
  ctx.drawImage(f, 3 * FRAME_W, FRAME_H);

  return canvas;
}

// ========== MAIN ==========
async function main() {
  const outputDir = path.join(__dirname, 'assets', 'spritesheets', 'enemies', 'generated');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const sheets = {
    bomber: genBomberSheet(),
    charger: genChargerSheet(),
    fire_geyser: genFireGeyserSheet(),
  };

  for (const [name, canvas] of Object.entries(sheets)) {
    const pngPath = path.join(outputDir, `${name}.png`);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(pngPath, buf);
    console.log(`${name}: saved ${canvas.width}x${canvas.height} (${(buf.length/1024).toFixed(1)}KB) -> ${pngPath}`);
  }

  console.log('\nDone! Sprite sheets saved to', outputDir);
  console.log('You can now review and improve these, then place them in the regenerated/ folder.');
}

main().catch(e => { console.error(e); process.exit(1); });
