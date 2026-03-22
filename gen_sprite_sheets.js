/**
 * Generate clean sprite sheets for enemies/obstacles that had broken AI-generated sheets.
 * Renders the procedural drawing code from the game into properly gridded sprite sheet PNGs.
 * Then converts them to Base64 and patches index.html.
 */
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

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

// ========== MAIN ==========
async function main() {
  const outputDir = path.join(__dirname, 'assets', 'spritesheets', 'enemies', 'generated');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const generators = {
    troll: genTrollSheet,
    witch: genWitchSheet,
    golem: genGolemSheet,
    diver: genDiverSheet,
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

    // Resize to reasonable size for Base64 embedding (max 512px wide for single-row sheets)
    const maxW = cols <= 2 ? 256 : 512;
    const scale = maxW / canvas.width;
    const targetW = Math.round(canvas.width * scale);
    const targetH = Math.round(canvas.height * scale);

    const resized = await sharp(buf).resize(targetW, targetH, { kernel: 'lanczos3' }).png().toBuffer();
    const b64 = resized.toString('base64');
    console.log(`  Resized to ${targetW}x${targetH}, Base64: ${(b64.length/1024).toFixed(1)}KB`);

    results[name] = { b64, cols, rows, fps, anims, w: targetW, h: targetH };
  }

  // Now patch index.html
  console.log('\nPatching index.html...');
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const eol = html.includes('\r\n') ? '\r\n' : '\n';

  // Find and replace ENEMY_SPRITE_B64 entries for the generated sprites
  for (const [name, data] of Object.entries(results)) {
    const b64Key = name === 'fire_geyser' ? 'fire_geyser' : name;

    // Check if this sprite already has B64 data - replace it
    const b64Pattern = new RegExp(`ENEMY_SPRITE_B64\\.${b64Key}\\s*=\\s*"[^"]*";`);
    if (b64Pattern.test(html)) {
      html = html.replace(b64Pattern, `ENEMY_SPRITE_B64.${b64Key}="data:image/png;base64,${data.b64}";`);
      console.log(`  Replaced B64 for ${name}`);
    } else {
      // Need to insert it - find the ENEMY_SPRITE_B64 block
      const insertPoint = html.indexOf('var ENEMY_SPRITE_DEFS');
      if (insertPoint > -1) {
        const insertion = `ENEMY_SPRITE_B64.${b64Key}="data:image/png;base64,${data.b64}";${eol}`;
        html = html.slice(0, insertPoint) + insertion + html.slice(insertPoint);
        console.log(`  Inserted B64 for ${name}`);
      }
    }
  }

  // Now update ENEMY_SPRITE_DEFS for these sprites
  // We need to keep bomber, charger, fire_geyser defs as they were (they work), and update the rest
  const defsPattern = /var ENEMY_SPRITE_DEFS\s*=\s*\{[^}]+\};/;
  const defsMatch = html.match(defsPattern);

  if (defsMatch) {
    // Build new defs including all sprites
    const allDefs = {};

    // Keep working original sprites
    allDefs.bomber = { cols:8, rows:2, fps:7, anims:{"idle":[0,1,2,3,4,5],"attack":[9,10],"hit":[14]} };
    allDefs.charger = { cols:4, rows:4, fps:8, anims:{"idle":[0,1,2,3],"attack":[4,5,6,7],"hit":[12]} };
    allDefs.fire_geyser = { cols:8, rows:3, fps:5, anims:{"idle":[8,9,10],"attack":[0,1,2,3,4,5,6,7]} };

    // Add generated sprites
    for (const [name, data] of Object.entries(results)) {
      allDefs[name] = { cols: data.cols, rows: data.rows, fps: data.fps, anims: data.anims };
    }

    const newDefs = 'var ENEMY_SPRITE_DEFS = ' + JSON.stringify(allDefs) + ';';
    html = html.replace(defsPattern, newDefs);
    console.log('  Updated ENEMY_SPRITE_DEFS');
  }

  fs.writeFileSync(path.join(__dirname, 'index.html'), html);
  console.log('index.html patched successfully!');

  // Report file size
  const stat = fs.statSync(path.join(__dirname, 'index.html'));
  console.log(`index.html size: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);

  // Generate gameHtml.js
  console.log('\nRegenerating gameHtml.js...');
  require('child_process').execSync('node gen-gamehtmljs.js', { cwd: __dirname, stdio: 'inherit' });
  console.log('Done!');
}

main().catch(e => { console.error(e); process.exit(1); });
