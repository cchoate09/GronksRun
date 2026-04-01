/**
 * Generate clean sprite sheets for enemies/obstacles that had broken AI-generated sheets.
 * Renders the procedural drawing code from the game into properly gridded sprite sheet PNGs
 * and writes a manifest that the enemy asset builder can consume.
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const FRAME_W = 256;
const FRAME_H = 256;
const PI2 = Math.PI * 2;

// Helper: create a canvas context centered at (FRAME_W/2, FRAME_H*0.85) with unit size
function makeFrame(drawFn, unit) {
  const canvas = createCanvas(FRAME_W, FRAME_H);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, FRAME_W, FRAME_H);
  ctx.save();
  ctx.translate(FRAME_W / 2, FRAME_H * 0.85);
  drawFn(ctx, unit || 50);
  ctx.restore();
  return canvas;
}

// ========== TROLL ==========
function drawTrollFrame(ctx, u, phase) {
  // Body
  ctx.fillStyle = "#3a7a3a";
  ctx.beginPath(); ctx.ellipse(0, -u*1.3, u*1.1, u*1.4, 0, 0, PI2); ctx.fill();
  // Belly
  ctx.fillStyle = "#5a9a5a";
  ctx.beginPath(); ctx.ellipse(0, -u*1, u*0.6, u*0.7, 0, 0, PI2); ctx.fill();
  // Eyes
  ctx.fillStyle = "#ff0";
  ctx.beginPath(); ctx.ellipse(-u*0.35, -u*1.9, u*0.22, u*0.18, -0.3, 0, PI2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(u*0.35, -u*1.9, u*0.22, u*0.18, 0.3, 0, PI2); ctx.fill();
  // Pupils
  ctx.fillStyle = "#200";
  ctx.beginPath(); ctx.arc(-u*0.3, -u*1.88, u*0.1, 0, PI2); ctx.fill();
  ctx.beginPath(); ctx.arc(u*0.4, -u*1.88, u*0.1, 0, PI2); ctx.fill();
  // Tusks
  ctx.fillStyle = "#ffe";
  ctx.beginPath(); ctx.moveTo(-u*0.5, -u*0.9); ctx.lineTo(-u*0.35, -u*0.5); ctx.lineTo(-u*0.2, -u*0.9); ctx.fill();
  ctx.beginPath(); ctx.moveTo(u*0.5, -u*0.9); ctx.lineTo(u*0.35, -u*0.5); ctx.lineTo(u*0.2, -u*0.9); ctx.fill();
  // Brows
  ctx.strokeStyle = "#2a4a2a"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(-u*0.55, -u*2.1); ctx.lineTo(-u*0.25, -u*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(u*0.55, -u*2.1); ctx.lineTo(u*0.25, -u*2); ctx.stroke();
  // Arms with phase-based animation
  const armAngle = Math.sin(phase) * 0.3;
  ctx.fillStyle = "#3a7a3a";
  ctx.save(); ctx.translate(-u*1.0, -u*1.3); ctx.rotate(-0.5 + armAngle);
  ctx.fillRect(-u*0.2, 0, u*0.4, u*0.8); ctx.restore();
  ctx.save(); ctx.translate(u*1.0, -u*1.3); ctx.rotate(0.5 - armAngle);
  ctx.fillRect(-u*0.2, 0, u*0.4, u*0.8); ctx.restore();
}

function genTrollSheet() {
  // 4 cols x 2 rows = 8 frames: row0=idle(4), row1=attack(3)+hit(1)
  const cols = 4, rows = 2;
  const canvas = createCanvas(FRAME_W * cols, FRAME_H * rows);
  const ctx = canvas.getContext('2d');

  // Idle frames (row 0): gentle sway
  for (let i = 0; i < 4; i++) {
    const f = makeFrame((c, u) => drawTrollFrame(c, u, i * Math.PI / 2), 50);
    ctx.drawImage(f, i * FRAME_W, 0);
  }
  // Attack frames (row 1, cols 0-2): arms raised
  for (let i = 0; i < 3; i++) {
    const f = makeFrame((c, u) => {
      drawTrollFrame(c, u, 0);
      // Attack overlay - raised club
      c.fillStyle = "#6a4a2a"; c.lineWidth = 3;
      const raise = [0.8, 1.2, 0.5][i];
      c.save(); c.translate(u*0.8, -u*1.5);
      c.rotate(-0.8 - raise);
      c.fillRect(-u*0.12, -u*0.8, u*0.24, u*1.0);
      c.fillStyle = "#5a3a1a";
      c.beginPath(); c.arc(0, -u*0.8, u*0.25, 0, PI2); c.fill();
      c.restore();
    }, 50);
    ctx.drawImage(f, i * FRAME_W, FRAME_H);
  }
  // Hit frame (row 1, col 3)
  {
    const f = makeFrame((c, u) => {
      c.globalAlpha = 0.7;
      drawTrollFrame(c, u, 0);
      c.globalAlpha = 0.4;
      c.fillStyle = "#fff";
      c.beginPath(); c.ellipse(0, -u*1.3, u*1.1, u*1.4, 0, 0, PI2); c.fill();
      c.globalAlpha = 1;
    }, 50);
    ctx.drawImage(f, 3 * FRAME_W, FRAME_H);
  }
  return { canvas, cols, rows, fps: 5, anims: { idle: [0,1,2,3], attack: [4,5,6], hit: [7] } };
}

// ========== CHARGER ==========
function drawChargerFrame(ctx, u, stepPhase, chargeLean) {
  var stride = stepPhase || 0;
  var lean = chargeLean || 0;
  var bodyY = Math.sin(stride) * u * 0.06;

  ctx.save();
  ctx.translate(0, bodyY);
  ctx.rotate(lean);

  ctx.fillStyle = "#B87934";
  ctx.beginPath(); ctx.ellipse(0, -u*0.95, u*1.3, u*0.78, 0, 0, PI2); ctx.fill();
  ctx.strokeStyle = "#6B3D1C"; ctx.lineWidth = u*0.07; ctx.stroke();

  ctx.fillStyle = "#D59842";
  ctx.beginPath(); ctx.ellipse(u*0.1, -u*1.1, u*0.48, u*0.18, 0.08, 0, PI2); ctx.fill();

  ctx.fillStyle = "#95582B";
  ctx.beginPath(); ctx.ellipse(-u*0.92, -u*1.05, u*0.56, u*0.46, -0.15, 0, PI2); ctx.fill();
  ctx.strokeStyle = "#6B3D1C"; ctx.lineWidth = u*0.06; ctx.stroke();

  ctx.fillStyle = "#F7F1E4";
  ctx.beginPath(); ctx.moveTo(-u*1.22, -u*0.9); ctx.lineTo(-u*1.12, -u*0.35); ctx.lineTo(-u*0.98, -u*0.86); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-u*0.92, -u*0.8); ctx.lineTo(-u*0.8, -u*0.3); ctx.lineTo(-u*0.68, -u*0.74); ctx.closePath(); ctx.fill();

  ctx.fillStyle = "#FF3B30";
  ctx.beginPath(); ctx.arc(-u*0.88, -u*1.18, u*0.09, 0, PI2); ctx.fill();
  ctx.fillStyle = "#231A12";
  ctx.beginPath(); ctx.arc(-u*0.88, -u*1.18, u*0.04, 0, PI2); ctx.fill();

  ctx.strokeStyle = "#C8883F"; ctx.lineWidth = u*0.11; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(u*0.94, -u*0.98); ctx.quadraticCurveTo(u*1.48, -u*1.74, u*1.2, -u*1.34); ctx.stroke();

  var legs = [
    { x: -u*0.46, y: -u*0.08, dir: -1 },
    { x: u*0.5, y: -u*0.08, dir: 1 }
  ];
  for (var li = 0; li < legs.length; li++) {
    var leg = legs[li];
    var swing = Math.sin(stride + li * Math.PI) * 0.28;
    ctx.save();
    ctx.translate(leg.x, leg.y);
    ctx.rotate(swing + lean * 0.35);
    ctx.fillStyle = "#6B3D1C";
    ctx.fillRect(-u*0.12, 0, u*0.24, u*0.58);
    ctx.beginPath(); ctx.ellipse(0, u*0.6, u*0.22, u*0.1, 0, 0, PI2); ctx.fill();
    ctx.restore();
  }

  if (lean < -0.1) {
    ctx.fillStyle = "rgba(210,140,60,0.18)";
    ctx.beginPath(); ctx.ellipse(u*1.1, -u*0.66, u*0.52, u*0.22, 0, 0, PI2); ctx.fill();
  }

  ctx.restore();
}

function genChargerSheet() {
  const cols = 4, rows = 2;
  const canvas = createCanvas(FRAME_W * cols, FRAME_H * rows);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < 4; i++) {
    const f = makeFrame((c, u) => drawChargerFrame(c, u, i * Math.PI / 2, 0), 48);
    ctx.drawImage(f, i * FRAME_W, 0);
  }

  for (let i = 0; i < 3; i++) {
    const f = makeFrame((c, u) => drawChargerFrame(c, u, i * 0.9, -0.12 - i * 0.08), 48);
    ctx.drawImage(f, i * FRAME_W, FRAME_H);
  }

  {
    const f = makeFrame((c, u) => {
      c.globalAlpha = 0.72;
      drawChargerFrame(c, u, 0.4, -0.08);
      c.globalAlpha = 0.36;
      c.fillStyle = "#fff";
      c.beginPath(); c.ellipse(0, -u*0.95, u*1.35, u*0.82, 0, 0, PI2); c.fill();
      c.globalAlpha = 1;
    }, 48);
    ctx.drawImage(f, 3 * FRAME_W, FRAME_H);
  }

  return { canvas, cols, rows, fps: 8, anims: { idle: [0,1,2,3], attack: [4,5,6], hit: [7] } };
}

// ========== WITCH ==========
function drawWitchFrame(ctx, u, armPhase) {
  // Robe body
  ctx.fillStyle = "#2a0a3a";
  ctx.beginPath(); ctx.moveTo(-u*0.5, 0); ctx.lineTo(-u*0.7, u*0.5); ctx.lineTo(u*0.7, u*0.5);
  ctx.lineTo(u*0.5, 0); ctx.lineTo(u*0.3, -u*1.2); ctx.lineTo(-u*0.3, -u*1.2); ctx.closePath(); ctx.fill();
  // Hat
  ctx.fillStyle = "#3a1a4a";
  ctx.beginPath(); ctx.moveTo(-u*0.5, -u*1.2); ctx.lineTo(u*0.5, -u*1.2); ctx.lineTo(0, -u*2.5); ctx.closePath(); ctx.fill();
  // Eyes
  ctx.shadowColor = "#aa00ff"; ctx.shadowBlur = 10;
  ctx.fillStyle = "#cc44ff";
  ctx.beginPath(); ctx.arc(-u*0.18, -u*0.9, u*0.1, 0, PI2); ctx.fill();
  ctx.beginPath(); ctx.arc(u*0.18, -u*0.9, u*0.1, 0, PI2); ctx.fill();
  ctx.shadowBlur = 0;
  // Staff
  const staffAngle = armPhase || 0;
  ctx.save(); ctx.translate(u*0.6, -u*0.5); ctx.rotate(staffAngle);
  ctx.strokeStyle = "#6a4a2a"; ctx.lineWidth = u*0.1;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, u*1.0); ctx.stroke();
  // Orb
  ctx.fillStyle = "#aa00ff"; ctx.shadowColor = "#aa00ff"; ctx.shadowBlur = 8;
  ctx.beginPath(); ctx.arc(0, -u*0.1, u*0.18, 0, PI2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
}

function genWitchSheet() {
  const cols = 4, rows = 2;
  const canvas = createCanvas(FRAME_W * cols, FRAME_H * rows);
  const ctx = canvas.getContext('2d');

  // Idle (4 frames): subtle staff sway
  for (let i = 0; i < 4; i++) {
    const f = makeFrame((c, u) => drawWitchFrame(c, u, Math.sin(i * Math.PI / 2) * 0.15), 50);
    ctx.drawImage(f, i * FRAME_W, 0);
  }
  // Attack (3 frames): staff raised, casting
  for (let i = 0; i < 3; i++) {
    const f = makeFrame((c, u) => {
      drawWitchFrame(c, u, -0.5 - i * 0.3);
      // Magic particles
      c.fillStyle = "#cc44ff"; c.shadowColor = "#aa00ff"; c.shadowBlur = 12;
      const spread = (i + 1) * 0.4;
      for (let p = 0; p < 3 + i; p++) {
        const px = u * 0.6 + Math.cos(p * 2.1) * u * spread;
        const py = -u * 1.2 + Math.sin(p * 1.7) * u * spread * 0.5;
        c.beginPath(); c.arc(px, py, u * 0.08, 0, PI2); c.fill();
      }
      c.shadowBlur = 0;
    }, 50);
    ctx.drawImage(f, i * FRAME_W, FRAME_H);
  }
  // Hit frame
  {
    const f = makeFrame((c, u) => {
      c.globalAlpha = 0.7;
      drawWitchFrame(c, u, 0.4);
      c.globalAlpha = 0.4; c.fillStyle = "#fff";
      c.beginPath(); c.ellipse(0, -u*0.8, u*0.8, u*1.2, 0, 0, PI2); c.fill();
      c.globalAlpha = 1;
    }, 50);
    ctx.drawImage(f, 3 * FRAME_W, FRAME_H);
  }
  return { canvas, cols, rows, fps: 5, anims: { idle: [0,1,2,3], attack: [4,5,6], hit: [7] } };
}

// ========== GOLEM ==========
function drawGolemFrame(ctx, u, armPhase) {
  // Main body
  ctx.fillStyle = "#5a5a5a";
  ctx.beginPath(); ctx.ellipse(0, -u*1.6, u*1.3, u*1.7, 0, 0, PI2); ctx.fill();
  // Cracks
  ctx.strokeStyle = "#3a3a3a"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-u*0.4, -u*2.5); ctx.lineTo(-u*0.1, -u*1.8); ctx.lineTo(-u*0.3, -u*1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(u*0.3, -u*2.3); ctx.lineTo(u*0.5, -u*1.5); ctx.stroke();
  // Eyes
  ctx.shadowColor = "#ff4400"; ctx.shadowBlur = 12;
  ctx.fillStyle = "#ff6600";
  ctx.beginPath(); ctx.arc(-u*0.35, -u*2.2, u*0.15, 0, PI2); ctx.fill();
  ctx.beginPath(); ctx.arc(u*0.35, -u*2.2, u*0.15, 0, PI2); ctx.fill();
  ctx.shadowBlur = 0;
  // Arms
  const aPhase = armPhase || 0;
  ctx.fillStyle = "#4a4a4a";
  ctx.save(); ctx.translate(-u*1.3, -u*1.5); ctx.rotate(-0.4 + aPhase);
  ctx.beginPath(); ctx.ellipse(0, 0, u*0.5, u*0.3, 0, 0, PI2); ctx.fill();
  ctx.fillRect(-u*0.15, u*0.1, u*0.3, u*0.6);
  ctx.beginPath(); ctx.ellipse(0, u*0.7, u*0.3, u*0.25, 0, 0, PI2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(u*1.3, -u*1.5); ctx.rotate(0.4 - aPhase);
  ctx.beginPath(); ctx.ellipse(0, 0, u*0.5, u*0.3, 0, 0, PI2); ctx.fill();
  ctx.fillRect(-u*0.15, u*0.1, u*0.3, u*0.6);
  ctx.beginPath(); ctx.ellipse(0, u*0.7, u*0.3, u*0.25, 0, 0, PI2); ctx.fill();
  ctx.restore();
  // Legs
  ctx.fillStyle = "#4a4a4a";
  ctx.fillRect(-u*0.8, -u*0.15, u*0.5, u*0.5);
  ctx.fillRect(u*0.3, -u*0.15, u*0.5, u*0.5);
  // Mouth
  ctx.strokeStyle = "#ff4400"; ctx.lineWidth = u*0.08;
  ctx.beginPath(); ctx.moveTo(-u*0.3, -u*1.7); ctx.lineTo(-u*0.1, -u*1.5); ctx.lineTo(u*0.1, -u*1.7); ctx.lineTo(u*0.3, -u*1.5); ctx.stroke();
}

function genGolemSheet() {
  const cols = 4, rows = 2;
  const canvas = createCanvas(FRAME_W * cols, FRAME_H * rows);
  const ctx = canvas.getContext('2d');

  // Idle (4 frames): slow breathing/sway
  for (let i = 0; i < 4; i++) {
    const f = makeFrame((c, u) => drawGolemFrame(c, u, Math.sin(i * Math.PI / 2) * 0.15), 45);
    ctx.drawImage(f, i * FRAME_W, 0);
  }
  // Attack (3 frames): arm slam
  for (let i = 0; i < 3; i++) {
    const f = makeFrame((c, u) => {
      const smashPhase = [-0.8, -1.2, 0.3][i];
      drawGolemFrame(c, u, smashPhase);
      if (i === 2) { // Ground impact
        c.fillStyle = "rgba(255,120,0,0.4)";
        c.beginPath(); c.ellipse(0, u*0.1, u*1.5, u*0.3, 0, 0, PI2); c.fill();
      }
    }, 45);
    ctx.drawImage(f, i * FRAME_W, FRAME_H);
  }
  // Hit
  {
    const f = makeFrame((c, u) => {
      c.globalAlpha = 0.7;
      drawGolemFrame(c, u, 0.2);
      c.globalAlpha = 0.4; c.fillStyle = "#fff";
      c.beginPath(); c.ellipse(0, -u*1.6, u*1.3, u*1.7, 0, 0, PI2); c.fill();
      c.globalAlpha = 1;
    }, 45);
    ctx.drawImage(f, 3 * FRAME_W, FRAME_H);
  }
  return { canvas, cols, rows, fps: 3, anims: { idle: [0,1,2,3], attack: [4,5,6], hit: [7] } };
}

// ========== DIVER (Eagle) ==========
function drawDiverFrame(ctx, u, wingPhase) {
  const wf = wingPhase;
  // Body
  ctx.fillStyle = "#6a3a20";
  ctx.beginPath(); ctx.ellipse(0, 0, u*0.7, u*0.45, 0, 0, PI2); ctx.fill();
  // Wings
  ctx.fillStyle = "#8a5a30";
  for (let s = -1; s <= 1; s += 2) {
    ctx.beginPath(); ctx.moveTo(s*u*0.4, 0);
    ctx.bezierCurveTo(s*u*1.8, -u*wf, s*u*2.4, u*(0.4-wf), s*u*2.2, u*0.6);
    ctx.bezierCurveTo(s*u*1.2, u*0.35, s*u*0.6, u*0.18, s*u*0.4, 0);
    ctx.fill();
  }
  // Head
  ctx.fillStyle = "#5a2a10";
  ctx.beginPath(); ctx.ellipse(-u*0.8, -u*0.15, u*0.4, u*0.3, 0.3, 0, PI2); ctx.fill();
  // Beak
  ctx.fillStyle = "#cc8800";
  ctx.beginPath(); ctx.moveTo(-u*1, -u*0.15); ctx.lineTo(-u*1.6, 0); ctx.lineTo(-u*1, -u*0.05); ctx.fill();
  // Eye
  ctx.fillStyle = "#ff0";
  ctx.beginPath(); ctx.arc(-u*0.75, -u*0.25, u*0.08, 0, PI2); ctx.fill();
}

function genDiverSheet() {
  const cols = 4, rows = 2;
  const canvas = createCanvas(FRAME_W * cols, FRAME_H * rows);
  const ctx = canvas.getContext('2d');

  // Idle: wing flap cycle
  for (let i = 0; i < 4; i++) {
    const wf = Math.sin(i * Math.PI / 2) * 0.6;
    const f = makeFrame((c, u) => drawDiverFrame(c, u, wf), 50);
    ctx.drawImage(f, i * FRAME_W, 0);
  }
  // Attack: dive pose (3 frames)
  for (let i = 0; i < 3; i++) {
    const f = makeFrame((c, u) => {
      c.rotate(-0.3 - i * 0.15); // Diving angle
      drawDiverFrame(c, u, -0.3 + i * 0.2);
    }, 50);
    ctx.drawImage(f, i * FRAME_W, FRAME_H);
  }
  // Hit
  {
    const f = makeFrame((c, u) => {
      c.globalAlpha = 0.7;
      drawDiverFrame(c, u, 0.3);
      c.globalAlpha = 0.4; c.fillStyle = "#fff";
      c.beginPath(); c.ellipse(0, 0, u*1.0, u*0.6, 0, 0, PI2); c.fill();
      c.globalAlpha = 1;
    }, 50);
    ctx.drawImage(f, 3 * FRAME_W, FRAME_H);
  }
  return { canvas, cols, rows, fps: 6, anims: { idle: [0,1,2,3], attack: [4,5,6], hit: [7] } };
}

// ========== BOMBER ==========
function drawBomberFrame(ctx, u, wingPhase, bombDrop) {
  const wf = wingPhase || 0;
  ctx.fillStyle = "#9C5D31";
  ctx.beginPath(); ctx.ellipse(0, -u*0.08, u*0.95, u*0.5, 0, 0, PI2); ctx.fill();
  ctx.strokeStyle = "#6A3D1B"; ctx.lineWidth = u*0.06; ctx.stroke();

  ctx.fillStyle = "#B97844";
  for (let s = -1; s <= 1; s += 2) {
    ctx.beginPath(); ctx.moveTo(s*u*0.42, -u*0.02);
    ctx.bezierCurveTo(s*u*1.2, -u*(0.4+wf), s*u*1.55, -u*(0.1+wf), s*u*1.45, u*0.22);
    ctx.bezierCurveTo(s*u*0.85, u*0.1, s*u*0.55, u*0.06, s*u*0.42, -u*0.02);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#7A4721"; ctx.lineWidth = u*0.05; ctx.stroke();
  }

  ctx.fillStyle = "#78411F";
  ctx.beginPath(); ctx.moveTo(-u*0.12, -u*0.56); ctx.lineTo(u*0.12, -u*0.3); ctx.lineTo(-u*0.04, -u*0.28); ctx.closePath(); ctx.fill();

  ctx.fillStyle = "#6A3D1B";
  ctx.beginPath(); ctx.ellipse(-u*0.6, -u*0.12, u*0.28, u*0.24, 0.15, 0, PI2); ctx.fill();
  ctx.fillStyle = "#FFE27A";
  ctx.beginPath(); ctx.arc(-u*0.58, -u*0.16, u*0.08, 0, PI2); ctx.fill();
  ctx.fillStyle = "#231A12";
  ctx.beginPath(); ctx.arc(-u*0.58, -u*0.16, u*0.035, 0, PI2); ctx.fill();

  ctx.fillStyle = "#D9480F";
  ctx.beginPath(); ctx.ellipse(u*0.02, u*0.16, u*0.34, u*0.16, 0, 0, PI2); ctx.fill();

  if (bombDrop) {
    var drop = bombDrop;
    ctx.fillStyle = "#333";
    ctx.beginPath(); ctx.arc(u*0.08, u*(0.34 + drop), u*0.12, 0, PI2); ctx.fill();
    ctx.fillStyle = "#FF6A2E";
    ctx.beginPath(); ctx.arc(u*0.12, u*(0.18 + drop), u*0.04, 0, PI2); ctx.fill();
  }
}

function genBomberSheet() {
  const cols = 4, rows = 2;
  const canvas = createCanvas(FRAME_W * cols, FRAME_H * rows);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < 4; i++) {
    const wf = Math.sin(i * Math.PI / 2) * 0.3;
    const f = makeFrame((c, u) => drawBomberFrame(c, u, wf, 0), 50);
    ctx.drawImage(f, i * FRAME_W, 0);
  }

  for (let i = 0; i < 3; i++) {
    const drop = [0.15, 0.32, 0.44][i];
    const f = makeFrame((c, u) => drawBomberFrame(c, u, -0.08 + i * 0.08, drop), 50);
    ctx.drawImage(f, i * FRAME_W, FRAME_H);
  }

  {
    const f = makeFrame((c, u) => {
      c.globalAlpha = 0.72;
      drawBomberFrame(c, u, 0.12, 0);
      c.globalAlpha = 0.4;
      c.fillStyle = "#fff";
      c.beginPath(); c.ellipse(0, -u*0.08, u*1.0, u*0.54, 0, 0, PI2); c.fill();
      c.globalAlpha = 1;
    }, 50);
    ctx.drawImage(f, 3 * FRAME_W, FRAME_H);
  }

  return { canvas, cols, rows, fps: 7, anims: { idle: [0,1,2,3], attack: [4,5,6], hit: [7] } };
}

// ========== SERPENT ==========
function drawSerpentFrame(ctx, u, slitherPhase) {
  ctx.fillStyle = "#2a8a3a";
  const segCount = 6;
  for (let i = 0; i < segCount; i++) {
    const sx = i * u * 0.55;
    const sy = Math.sin(slitherPhase + i * 1.2) * u * 0.3;
    const r = u * (0.35 - i * 0.03);
    ctx.beginPath(); ctx.arc(sx, sy - u*0.4, r, 0, PI2); ctx.fill();
  }
  // Head
  ctx.fillStyle = "#1a6a2a";
  ctx.beginPath(); ctx.ellipse(-u*0.3, -u*0.4, u*0.45, u*0.35, 0.2, 0, PI2); ctx.fill();
  // Eye
  ctx.fillStyle = "#ffcc00";
  ctx.beginPath(); ctx.arc(-u*0.5, -u*0.55, u*0.08, 0, PI2); ctx.fill();
  // Fang
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.moveTo(-u*0.7, -u*0.35); ctx.lineTo(-u*0.65, -u*0.1); ctx.lineTo(-u*0.6, -u*0.35); ctx.fill();
  // Tongue
  ctx.strokeStyle = "#ff3366"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-u*0.75, -u*0.4); ctx.lineTo(-u*1.1, -u*0.5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-u*0.9, -u*0.42); ctx.lineTo(-u*1.1, -u*0.3); ctx.stroke();
}

function genSerpentSheet() {
  const cols = 4, rows = 2;
  const canvas = createCanvas(FRAME_W * cols, FRAME_H * rows);
  const ctx = canvas.getContext('2d');

  // Idle: slithering
  for (let i = 0; i < 4; i++) {
    const f = makeFrame((c, u) => drawSerpentFrame(c, u, i * 1.5), 50);
    ctx.drawImage(f, i * FRAME_W, 0);
  }
  // Attack: rearing up / striking
  for (let i = 0; i < 3; i++) {
    const f = makeFrame((c, u) => {
      const rearAngle = [0.2, 0.4, 0.1][i];
      c.rotate(rearAngle);
      c.translate(0, -u * [0.3, 0.5, 0.1][i]);
      drawSerpentFrame(c, u, i * 0.8);
      // Venom drip
      if (i >= 1) {
        c.fillStyle = "rgba(80,220,50,0.7)";
        for (let v = 0; v < i + 1; v++) {
          c.beginPath(); c.arc(-u*0.7 - v*u*0.15, -u*0.1 + v*u*0.2, u*0.06, 0, PI2); c.fill();
        }
      }
    }, 50);
    ctx.drawImage(f, i * FRAME_W, FRAME_H);
  }
  // Hit
  {
    const f = makeFrame((c, u) => {
      c.globalAlpha = 0.7;
      drawSerpentFrame(c, u, 0);
      c.globalAlpha = 0.4; c.fillStyle = "#fff";
      c.beginPath(); c.ellipse(u*0.5, -u*0.3, u*1.5, u*0.6, 0, 0, PI2); c.fill();
      c.globalAlpha = 1;
    }, 50);
    ctx.drawImage(f, 3 * FRAME_W, FRAME_H);
  }
  return { canvas, cols, rows, fps: 5, anims: { idle: [0,1,2,3], attack: [4,5,6], hit: [7] } };
}

// ========== PTERO ==========
function drawPteroFrame(ctx, u, wingPhase) {
  const wf = wingPhase;
  // Body
  ctx.fillStyle = "#4a2050";
  ctx.beginPath(); ctx.ellipse(0, 0, u*0.65, u*0.42, 0, 0, PI2); ctx.fill();
  // Wings
  ctx.fillStyle = "#6a3070";
  for (let s = -1; s <= 1; s += 2) {
    ctx.beginPath(); ctx.moveTo(s*u*0.35, 0);
    ctx.bezierCurveTo(s*u*1.6, -u*wf, s*u*2.1, u*(0.4-wf), s*u*1.9, u*0.55);
    ctx.bezierCurveTo(s*u*1, u*0.3, s*u*0.55, u*0.15, s*u*0.35, 0);
    ctx.fill();
  }
  // Crest
  ctx.fillStyle = "#8a4070";
  ctx.beginPath(); ctx.moveTo(-u*0.3, -u*0.3); ctx.lineTo(0, -u*0.8); ctx.lineTo(u*0.2, -u*0.3); ctx.fill();
  // Eye
  ctx.fillStyle = "#ff3333";
  ctx.beginPath(); ctx.arc(u*0.3, -u*0.15, u*0.07, 0, PI2); ctx.fill();
  // Beak
  ctx.fillStyle = "#aa6050";
  ctx.beginPath(); ctx.moveTo(u*0.5, 0); ctx.lineTo(u*0.9, 0.05*u); ctx.lineTo(u*0.5, u*0.1); ctx.fill();
}

function genPteroSheet() {
  const cols = 4, rows = 1;
  const canvas = createCanvas(FRAME_W * cols, FRAME_H * rows);
  const ctx = canvas.getContext('2d');

  // Idle: wing flap cycle (4 frames)
  for (let i = 0; i < 4; i++) {
    const wf = Math.sin(i * Math.PI / 2) * 0.5;
    const f = makeFrame((c, u) => drawPteroFrame(c, u, wf), 50);
    ctx.drawImage(f, i * FRAME_W, 0);
  }
  return { canvas, cols, rows, fps: 6, anims: { idle: [0,1,2,3] } };
}

// ========== LOG ==========
function drawLogFrame(ctx, u) {
  // Cross section
  ctx.fillStyle = "#6a4a28";
  ctx.beginPath(); ctx.ellipse(0, -u*0.5, u*0.9, u*0.55, 0, 0, PI2); ctx.fill();
  // Rings
  ctx.strokeStyle = "#4a3018"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0, -u*0.5, u*0.55, u*0.35, 0, 0, PI2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(0, -u*0.5, u*0.25, u*0.15, 0, 0, PI2); ctx.stroke();
  // Base
  ctx.fillStyle = "#5a3a18";
  ctx.fillRect(-u*0.9, -u*0.15, u*1.8, u*0.15);
  // Bark texture
  ctx.strokeStyle = "#3a2a10"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-u*0.85, -u*0.08); ctx.lineTo(-u*0.85, -u*0.14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(u*0.7, -u*0.06); ctx.lineTo(u*0.7, -u*0.13); ctx.stroke();
}

function genLogSheet() {
  const cols = 1, rows = 1;
  const canvas = createCanvas(FRAME_W * cols, FRAME_H * rows);
  const ctx = canvas.getContext('2d');
  const f = makeFrame((c, u) => drawLogFrame(c, u), 50);
  ctx.drawImage(f, 0, 0);
  return { canvas, cols, rows, fps: 1, anims: { idle: [0] } };
}

// ========== SPIKES ==========
function drawSpikesFrame(ctx, u) {
  const spkCol = "#888";
  const spkDk = "#555";
  // Back spikes
  ctx.fillStyle = spkDk;
  ctx.beginPath(); ctx.moveTo(-u*0.45, 0); ctx.lineTo(-u*0.15, 0); ctx.lineTo(-u*0.35, -u*0.85); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(u*0.15, 0); ctx.lineTo(u*0.45, 0); ctx.lineTo(u*0.35, -u*0.9); ctx.closePath(); ctx.fill();
  // Main spike
  ctx.fillStyle = spkCol;
  ctx.beginPath(); ctx.moveTo(-u*0.25, 0); ctx.lineTo(u*0.25, 0); ctx.lineTo(u*0.05, -u*1.35); ctx.lineTo(-u*0.05, -u*1.35); ctx.closePath(); ctx.fill();
  // Highlight
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.beginPath(); ctx.moveTo(-u*0.15, 0); ctx.lineTo(-u*0.05, 0); ctx.lineTo(-u*0.02, -u*1.3); ctx.closePath(); ctx.fill();
  // Tip glow
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath(); ctx.arc(0, -u*1.3, u*0.06, 0, PI2); ctx.fill();
}

function genSpikesSheet() {
  const cols = 1, rows = 1;
  const canvas = createCanvas(FRAME_W * cols, FRAME_H * rows);
  const ctx = canvas.getContext('2d');
  const f = makeFrame((c, u) => drawSpikesFrame(c, u), 50);
  ctx.drawImage(f, 0, 0);
  return { canvas, cols, rows, fps: 1, anims: { idle: [0] } };
}

// ========== FIRE GEYSER ==========
function drawFireGeyserFrame(ctx, u, stage) {
  var glow = [0.12, 0.18, 0.26, 0.34, 0.44, 0.7, 0.46, 0.22][stage];
  var flameH = [0.02, 0.3, 0.65, 1.0, 1.28, 1.65, 1.02, 0.4][stage];

  ctx.fillStyle = "#4A240E";
  ctx.beginPath(); ctx.ellipse(0, 0, u*0.62, u*0.22, 0, 0, PI2); ctx.fill();
  ctx.fillStyle = "#6B3212";
  ctx.beginPath(); ctx.ellipse(0, -u*0.02, u*0.38, u*0.12, 0, 0, PI2); ctx.fill();
  ctx.fillStyle = "rgba(255,180,40,0.35)";
  ctx.beginPath(); ctx.ellipse(0, u*0.02, u*(0.42 + glow*0.4), u*0.14, 0, 0, PI2); ctx.fill();

  if (flameH > 0.08) {
    ctx.fillStyle = "#FF7A00";
    ctx.beginPath();
    ctx.moveTo(-u*0.22, 0);
    ctx.bezierCurveTo(-u*0.18, -u*flameH*0.65, -u*0.08, -u*flameH, 0, -u*flameH);
    ctx.bezierCurveTo(u*0.08, -u*flameH, u*0.18, -u*flameH*0.65, u*0.22, 0);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#FFB323";
    ctx.beginPath();
    ctx.moveTo(-u*0.1, -u*0.02);
    ctx.bezierCurveTo(-u*0.08, -u*flameH*0.45, -u*0.03, -u*flameH*0.82, 0, -u*flameH*0.82);
    ctx.bezierCurveTo(u*0.03, -u*flameH*0.82, u*0.08, -u*flameH*0.45, u*0.1, -u*0.02);
    ctx.closePath();
    ctx.fill();
  }

  if (stage >= 1 && stage <= 6) {
    ctx.fillStyle = "rgba(255,200,60,0.85)";
    for (let i = 0; i < Math.max(2, stage); i++) {
      let offset = -u*0.28 + i * u * 0.18;
      ctx.beginPath(); ctx.arc(offset, u*0.02 - i*u*0.01, u*0.03, 0, PI2); ctx.fill();
    }
  }
}

function genFireGeyserSheet() {
  const cols = 4, rows = 2;
  const canvas = createCanvas(FRAME_W * cols, FRAME_H * rows);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < 8; i++) {
    const f = makeFrame((c, u) => drawFireGeyserFrame(c, u, i), 62);
    const x = (i % cols) * FRAME_W;
    const y = Math.floor(i / cols) * FRAME_H;
    ctx.drawImage(f, x, y);
  }

  return { canvas, cols, rows, fps: 5, anims: { idle: [0], attack: [0,1,2,3,4,5,6,7] } };
}

// ========== MAIN ==========
async function main() {
  const outputDir = path.join(__dirname, 'assets', 'spritesheets', 'enemies', 'generated');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const generators = {
    bomber: genBomberSheet,
    charger: genChargerSheet,
    troll: genTrollSheet,
    witch: genWitchSheet,
    golem: genGolemSheet,
    diver: genDiverSheet,
    fire_geyser: genFireGeyserSheet,
    serpent: genSerpentSheet,
    ptero: genPteroSheet,
    log: genLogSheet,
    spikes: genSpikesSheet,
  };

  const results = {};

  for (const [name, genFn] of Object.entries(generators)) {
    console.log(`Generating ${name} sprite sheet...`);
    const { canvas, cols, rows, fps, anims } = genFn();

    // Save full-size PNG
    const pngPath = path.join(outputDir, `${name}.png`);
    const buf = canvas.toBuffer('image/png');
    fs.writeFileSync(pngPath, buf);
    console.log(`  Saved ${pngPath} (${canvas.width}x${canvas.height}, ${(buf.length/1024).toFixed(1)}KB)`);

    results[name] = { cols, rows, fps, anims, width: canvas.width, height: canvas.height };
  }

  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(results, null, 2) + '\n');
  console.log(`\nWrote sprite manifest to ${manifestPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });
