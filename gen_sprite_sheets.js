const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const FRAME_W = 256;
const FRAME_H = 256;
const PI2 = Math.PI * 2;

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const value = parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
}

function mixColor(a, b, amount) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const t = Math.max(0, Math.min(1, amount));
  return `rgb(${Math.round(ca.r + (cb.r - ca.r) * t)},${Math.round(ca.g + (cb.g - ca.g) * t)},${Math.round(ca.b + (cb.b - ca.b) * t)})`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function ellipse(ctx, x, y, rx, ry, fill, stroke, lineWidth, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, PI2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth || 1;
    ctx.stroke();
  }
}

function polygon(ctx, points, fill, stroke, lineWidth) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth || 1;
    ctx.stroke();
  }
}

function strokeLine(ctx, points, stroke, lineWidth) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function bodyGradient(ctx, x, y, h, top, bottom) {
  const g = ctx.createLinearGradient(x, y - h, x, y + h * 0.2);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  return g;
}

function glowCircle(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, `rgba(255,255,255,0)`);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, PI2);
  ctx.fill();
  ctx.restore();
}

function withFrame(drawFn, unit, options) {
  const canvas = createCanvas(FRAME_W, FRAME_H);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, FRAME_W, FRAME_H);
  ctx.imageSmoothingEnabled = true;
  ctx.save();
  ctx.translate(FRAME_W / 2, FRAME_H * ((options && options.anchorY) || 0.84));
  drawFn(ctx, unit || 46);
  ctx.restore();
  return canvas;
}

function composeSheet(frames, cols, rows) {
  const canvas = createCanvas(FRAME_W * cols, FRAME_H * rows);
  const ctx = canvas.getContext('2d');
  frames.forEach((frame, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    ctx.drawImage(frame, col * FRAME_W, row * FRAME_H);
  });
  return canvas;
}

function drawShadow(ctx, u, w = 1.0) {
  ellipse(ctx, 0, u * 0.16, u * w, u * 0.18, 'rgba(6,10,18,0.22)', null, 0);
}

function drawTrollFrame(ctx, u, phase, mode) {
  const bob = Math.sin(phase) * u * 0.05;
  const swing = Math.sin(phase) * 0.26;
  const attack = mode === 'attack';
  const hit = mode === 'hit';
  const fill = hit ? '#8BE7A4' : bodyGradient(ctx, 0, -u * 1.0, u * 1.4, '#8AD06D', '#356F38');
  const dark = hit ? '#4AA966' : '#224B29';
  drawShadow(ctx, u, 1.2);
  ctx.save();
  ctx.translate(0, bob);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * u * 0.62, -u * 0.18);
    ctx.rotate(side * -swing * 0.5);
    ellipse(ctx, 0, u * 0.32, u * 0.18, u * 0.5, dark, '#16211A', u * 0.05);
    ellipse(ctx, side * u * 0.06, u * 0.82, u * 0.24, u * 0.12, '#4A2B18', '#24140E', u * 0.04, side * 0.14);
    ctx.restore();
  }
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * u * 1.0, -u * 1.26);
    let armRot = side * (attack ? (side === 1 ? -0.8 : 0.45) : swing * 0.8);
    if (hit) armRot = side * 0.2;
    ctx.rotate(armRot);
    ellipse(ctx, 0, 0, u * 0.32, u * 0.18, dark, '#16211A', u * 0.05, side * 0.2);
    if (attack && side === 1) {
      ctx.fillStyle = '#6F4B2A';
      ctx.fillRect(-u * 0.08, -u * 0.8, u * 0.16, u * 0.9);
      ellipse(ctx, 0, -u * 0.86, u * 0.22, u * 0.2, '#7B5A35', '#3F2C1A', u * 0.04);
    }
    ctx.restore();
  }
  ellipse(ctx, 0, -u * 1.0, u * 0.94, u * 1.18, fill, '#16211A', u * 0.06);
  ellipse(ctx, 0, -u * 0.62, u * 0.5, u * 0.56, 'rgba(220,255,225,0.18)', null, 0);
  ellipse(ctx, -u * 0.16, -u * 1.36, u * 0.46, u * 0.24, 'rgba(255,255,255,0.14)', null, 0, -0.35);
  for (const side of [-1, 1]) {
    polygon(ctx, [[side * u * 0.32, -u * 2.06], [side * u * 0.08, -u * 1.56], [side * u * 0.42, -u * 1.54]], '#F0E9CF', '#655B44', u * 0.03);
  }
  ellipse(ctx, -u * 0.34, -u * 1.2, u * 0.18, u * 0.22, '#FFF4B5', '#22301F', u * 0.04);
  ellipse(ctx, u * 0.34, -u * 1.18, u * 0.18, u * 0.22, '#FFF4B5', '#22301F', u * 0.04);
  ellipse(ctx, -u * 0.31, -u * 1.16, u * 0.08, u * 0.1, '#1D1A12', null, 0);
  ellipse(ctx, u * 0.37, -u * 1.16, u * 0.08, u * 0.1, '#1D1A12', null, 0);
  strokeLine(ctx, [[-u * 0.56, -u * 1.5], [-u * 0.2, -u * 1.38]], '#1C2A19', u * 0.08);
  strokeLine(ctx, [[u * 0.2, -u * 1.36], [u * 0.56, -u * 1.5]], '#1C2A19', u * 0.08);
  polygon(ctx, [[-u * 0.42, -u * 0.5], [-u * 0.22, -u * 0.12], [-u * 0.04, -u * 0.52]], '#F7EED8', '#6A5E49', u * 0.03);
  polygon(ctx, [[u * 0.42, -u * 0.5], [u * 0.22, -u * 0.12], [u * 0.04, -u * 0.52]], '#F7EED8', '#6A5E49', u * 0.03);
  strokeLine(ctx, [[-u * 0.24, -u * 0.2], [0, attack ? u * 0.08 : -u * 0.02], [u * 0.24, -u * 0.2]], '#1C2A19', u * 0.07);
  ctx.restore();
}

function drawChargerFrame(ctx, u, phase, mode) {
  const run = Math.sin(phase) * 0.22;
  const lean = mode === 'attack' ? -0.16 : 0;
  const hit = mode === 'hit';
  drawShadow(ctx, u, 1.26);
  ctx.save();
  ctx.rotate(lean);
  const bodyFill = hit ? '#F1B66D' : bodyGradient(ctx, 0, -u * 1.0, u, '#D99A57', '#7A4A25');
  ellipse(ctx, 0, -u * 0.9, u * 1.18, u * 0.72, bodyFill, '#372012', u * 0.06);
  ellipse(ctx, -u * 0.88, -u * 1.02, u * 0.46, u * 0.4, '#8A552D', '#372012', u * 0.05);
  ellipse(ctx, u * 0.52, -u * 1.0, u * 0.34, u * 0.16, 'rgba(255,216,164,0.24)', null, 0, 0.12);
  for (const side of [-1, 1]) {
    polygon(ctx, [[-u * 1.1, -u * 0.9 + side * u * 0.02], [-u * 0.96, -u * 0.3], [-u * 0.82, -u * 0.82]], '#F6EFDE', '#6A5E49', u * 0.03);
  }
  ellipse(ctx, -u * 0.86, -u * 1.12, u * 0.08, u * 0.08, '#FF5A4E', null, 0);
  ellipse(ctx, -u * 0.84, -u * 1.1, u * 0.03, u * 0.03, '#1D1410', null, 0);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * u * 0.42, -u * 0.14);
    ctx.rotate(side * run * 0.9 + lean * 0.45);
    ctx.fillStyle = '#4F2F18';
    ctx.fillRect(-u * 0.11, 0, u * 0.22, u * 0.56);
    ellipse(ctx, side * u * 0.04, u * 0.6, u * 0.22, u * 0.1, '#3A2214', '#1A110B', u * 0.03, side * 0.1);
    ctx.restore();
  }
  strokeLine(ctx, [[u * 0.82, -u * 0.98], [u * 1.22, -u * 1.48], [u * 1.1, -u * 1.18]], '#C58C54', u * 0.1);
  ctx.restore();
}

function drawWitchFrame(ctx, u, phase, mode) {
  const hit = mode === 'hit';
  const cast = mode === 'attack';
  const sway = Math.sin(phase) * 0.06;
  drawShadow(ctx, u, 0.9);
  ctx.save();
  ctx.translate(0, Math.sin(phase) * u * 0.04);
  polygon(ctx, [[-u * 0.7, 0], [-u * 0.4, -u * 1.6], [u * 0.4, -u * 1.6], [u * 0.7, 0]], hit ? '#A98CCB' : bodyGradient(ctx, 0, -u, u * 1.3, '#5D347A', '#241237'), '#130A1E', u * 0.05);
  polygon(ctx, [[-u * 0.64, -u * 1.58], [0, -u * 2.38], [u * 0.64, -u * 1.58]], '#3A1A52', '#130A1E', u * 0.05);
  polygon(ctx, [[-u * 0.82, -u * 1.58], [u * 0.82, -u * 1.58], [u * 0.62, -u * 1.72], [-u * 0.62, -u * 1.72]], '#26113A', '#130A1E', u * 0.04);
  ellipse(ctx, -u * 0.22, -u * 1.08, u * 0.12, u * 0.14, '#F6EEFF', '#1D1428', u * 0.03);
  ellipse(ctx, u * 0.22, -u * 1.06, u * 0.12, u * 0.14, '#F6EEFF', '#1D1428', u * 0.03);
  ellipse(ctx, -u * 0.2, -u * 1.08, u * 0.05, u * 0.06, '#26113A', null, 0);
  ellipse(ctx, u * 0.24, -u * 1.06, u * 0.05, u * 0.06, '#26113A', null, 0);
  strokeLine(ctx, [[-u * 0.16, -u * 0.76], [0, -u * 0.64], [u * 0.16, -u * 0.76]], '#1A0D22', u * 0.06);
  ctx.save();
  ctx.translate(u * 0.68, -u * 0.82);
  ctx.rotate(cast ? -0.6 : sway);
  ctx.fillStyle = '#7B5836';
  ctx.fillRect(-u * 0.06, -u * 0.64, u * 0.12, u * 1.16);
  glowCircle(ctx, 0, -u * 0.78, u * 0.34, '#A95BFF', cast ? 0.34 : 0.24);
  ellipse(ctx, 0, -u * 0.78, u * 0.14, u * 0.14, '#EED8FF', '#A95BFF', u * 0.04);
  ctx.restore();
  if (cast) {
    const offsets = [[-0.88, -1.06], [0.84, -1.14], [0.06, -1.54]];
    for (const [ox, oy] of offsets) {
      glowCircle(ctx, ox * u, oy * u, u * 0.28, '#8D43FF', 0.22);
    }
  }
  ctx.restore();
}

function drawGolemFrame(ctx, u, phase, mode) {
  const smash = mode === 'attack';
  const hit = mode === 'hit';
  const swing = Math.sin(phase) * 0.14;
  drawShadow(ctx, u, 1.24);
  ctx.save();
  ellipse(ctx, 0, -u * 1.12, u * 1.08, u * 1.22, hit ? '#B6B0A7' : bodyGradient(ctx, 0, -u * 1.2, u * 1.4, '#8D867F', '#504A46'), '#292523', u * 0.06);
  strokeLine(ctx, [[-u * 0.42, -u * 1.8], [-u * 0.12, -u * 1.24], [-u * 0.28, -u * 0.48]], '#3C3532', u * 0.05);
  strokeLine(ctx, [[u * 0.3, -u * 1.72], [u * 0.5, -u * 1.1]], '#3C3532', u * 0.05);
  ellipse(ctx, -u * 0.28, -u * 1.42, u * 0.12, u * 0.12, '#FFAC59', '#5A2B11', u * 0.04);
  ellipse(ctx, u * 0.28, -u * 1.42, u * 0.12, u * 0.12, '#FFAC59', '#5A2B11', u * 0.04);
  strokeLine(ctx, [[-u * 0.24, -u * 1.02], [-u * 0.06, -u * 0.84], [u * 0.06, -u * 1.02], [u * 0.24, -u * 0.84]], '#FF7A38', u * 0.06);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * u * 1.04, -u * 1.0);
    ctx.rotate(side * (smash ? (side === -1 ? -0.76 : 0.42) : swing));
    ellipse(ctx, 0, 0, u * 0.36, u * 0.24, '#5A534E', '#292523', u * 0.05);
    ctx.fillStyle = '#4C4642';
    ctx.fillRect(-u * 0.14, 0, u * 0.28, u * 0.82);
    ellipse(ctx, 0, u * 0.88, u * 0.26, u * 0.18, '#4A443F', '#292523', u * 0.04);
    ctx.restore();
  }
  ctx.fillStyle = '#4D4843';
  ctx.fillRect(-u * 0.68, -u * 0.02, u * 0.32, u * 0.46);
  ctx.fillRect(u * 0.36, -u * 0.02, u * 0.32, u * 0.46);
  if (smash) ellipse(ctx, 0, u * 0.14, u * 1.28, u * 0.16, 'rgba(255,130,60,0.24)', null, 0);
  ctx.restore();
}

function drawBirdFrame(ctx, u, cfg) {
  const wing = cfg.wing;
  const attack = cfg.attack;
  const hit = cfg.hit;
  drawShadow(ctx, u, 0.96);
  ctx.save();
  ctx.translate(0, cfg.bob || 0);
  ellipse(ctx, 0, -u * 0.22, u * 0.8, u * 0.46, hit ? mixColor(cfg.body, '#FFFFFF', 0.35) : bodyGradient(ctx, 0, -u * 0.28, u, cfg.bodyLight, cfg.body), '#231A12', u * 0.05);
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * u * 0.34, -u * 0.12);
    ctx.rotate(side * (-0.18 - wing));
    polygon(ctx, [
      [0, 0],
      [side * u * 1.18, -u * (0.5 + wing)],
      [side * u * 1.44, u * 0.12],
      [side * u * 0.42, u * 0.1]
    ], cfg.wingFill, '#3A2413', u * 0.04);
    ctx.restore();
  }
  ellipse(ctx, -u * 0.54, -u * 0.24, u * 0.28, u * 0.24, cfg.head, '#231A12', u * 0.04);
  polygon(ctx, [[-u * 0.78, -u * 0.24], [-u * 1.12, -u * 0.1], [-u * 0.78, -u * 0.02]], cfg.beak, '#5A4114', u * 0.03);
  ellipse(ctx, -u * 0.5, -u * 0.28, u * 0.06, u * 0.06, '#FFF0A8', '#231A12', u * 0.02);
  ellipse(ctx, -u * 0.49, -u * 0.28, u * 0.025, u * 0.025, '#1B140F', null, 0);
  if (attack) {
    ctx.fillStyle = cfg.payload;
    ellipse(ctx, u * 0.12, u * 0.3, u * 0.24, u * 0.14, cfg.payload, '#2A1D17', u * 0.03);
  }
  ctx.restore();
}

function drawSerpentFrame(ctx, u, phase, mode) {
  const rise = mode === 'attack' ? 0.18 : 0;
  const hit = mode === 'hit';
  drawShadow(ctx, u, 1.0);
  ctx.save();
  ctx.translate(0, Math.sin(phase) * u * 0.03);
  ctx.strokeStyle = hit ? '#B8FFDB' : '#1C3A22';
  ctx.lineWidth = u * 0.26;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-u * 0.8, u * 0.06);
  ctx.bezierCurveTo(-u * 1.1, -u * 0.7, u * 0.2, -u * 1.12, u * 0.04, -u * 1.92 - u * rise);
  ctx.stroke();
  ellipse(ctx, 0, -u * 1.96 - u * rise, u * 0.42, u * 0.46, hit ? '#84F7B0' : bodyGradient(ctx, 0, -u * 2.0, u * 0.8, '#6FE08A', '#2F8651'), '#17331E', u * 0.05);
  polygon(ctx, [[-u * 0.28, -u * 2.2 - u * rise], [0, -u * 2.56 - u * rise], [u * 0.28, -u * 2.2 - u * rise]], '#A1F1B7', '#17331E', u * 0.03);
  ellipse(ctx, -u * 0.12, -u * 2.0 - u * rise, u * 0.06, u * 0.08, '#F9FFDE', '#17331E', u * 0.02);
  ellipse(ctx, u * 0.12, -u * 2.0 - u * rise, u * 0.06, u * 0.08, '#F9FFDE', '#17331E', u * 0.02);
  ellipse(ctx, -u * 0.11, -u * 1.98 - u * rise, u * 0.025, u * 0.03, '#172012', null, 0);
  ellipse(ctx, u * 0.13, -u * 1.98 - u * rise, u * 0.025, u * 0.03, '#172012', null, 0);
  strokeLine(ctx, [[0, -u * 1.78 - u * rise], [0, -u * 1.52 - u * rise], [u * 0.14, -u * 1.36 - u * rise]], '#FF7060', u * 0.04);
  strokeLine(ctx, [[0, -u * 1.52 - u * rise], [-u * 0.14, -u * 1.36 - u * rise]], '#FF7060', u * 0.04);
  ctx.restore();
}

function drawPteroFrame(ctx, u, phase) {
  const flap = Math.sin(phase) * 0.44;
  drawShadow(ctx, u, 0.84);
  ctx.save();
  ctx.translate(0, Math.cos(phase) * u * 0.04);
  ellipse(ctx, 0, -u * 0.12, u * 0.56, u * 0.26, bodyGradient(ctx, 0, -u * 0.2, u * 0.6, '#7B5BC6', '#452D78'), '#1B1630', u * 0.05);
  for (const side of [-1, 1]) {
    polygon(ctx, [
      [side * u * 0.22, -u * 0.16],
      [side * u * 1.3, -u * (0.92 + flap)],
      [side * u * 1.52, -u * 0.06],
      [side * u * 0.48, u * 0.08]
    ], '#5D43A6', '#1B1630', u * 0.04);
  }
  polygon(ctx, [[u * 0.08, -u * 0.36], [u * 0.42, -u * 0.74], [u * 0.26, -u * 0.16]], '#AA88F0', '#1B1630', u * 0.03);
  ellipse(ctx, -u * 0.48, -u * 0.16, u * 0.22, u * 0.18, '#5D43A6', '#1B1630', u * 0.03);
  polygon(ctx, [[-u * 0.64, -u * 0.14], [-u * 0.94, -u * 0.02], [-u * 0.64, 0]], '#F1D8B3', '#5A4114', u * 0.02);
  ellipse(ctx, -u * 0.44, -u * 0.18, u * 0.05, u * 0.05, '#FFF4B8', '#1B1630', u * 0.02);
  ellipse(ctx, -u * 0.43, -u * 0.18, u * 0.02, u * 0.02, '#1A131B', null, 0);
  ctx.restore();
}

function drawLogFrame(ctx, u) {
  drawShadow(ctx, u, 0.92);
  ctx.save();
  ellipse(ctx, 0, -u * 0.42, u * 1.0, u * 0.42, bodyGradient(ctx, 0, -u * 0.5, u * 0.6, '#9E6D39', '#5A341B'), '#2B180D', u * 0.05);
  ellipse(ctx, -u * 0.92, -u * 0.42, u * 0.18, u * 0.3, '#6F4526', '#2B180D', u * 0.04);
  ellipse(ctx, u * 0.92, -u * 0.42, u * 0.18, u * 0.3, '#6F4526', '#2B180D', u * 0.04);
  ellipse(ctx, 0, -u * 0.42, u * 0.46, u * 0.2, 'rgba(255,224,178,0.18)', null, 0);
  strokeLine(ctx, [[-u * 0.62, -u * 0.74], [-u * 0.32, -u * 0.18]], '#3A2413', u * 0.04);
  strokeLine(ctx, [[u * 0.14, -u * 0.72], [u * 0.38, -u * 0.12]], '#3A2413', u * 0.04);
  polygon(ctx, [[-u * 0.34, -u * 0.86], [-u * 0.12, -u * 1.36], [u * 0.04, -u * 0.8]], '#8BC26E', '#27411F', u * 0.03);
  polygon(ctx, [[u * 0.2, -u * 0.9], [u * 0.4, -u * 1.28], [u * 0.5, -u * 0.72]], '#8BC26E', '#27411F', u * 0.03);
  ctx.restore();
}

function drawSpikesFrame(ctx, u) {
  drawShadow(ctx, u, 0.84);
  const baseY = -u * 0.1;
  polygon(ctx, [[-u * 0.86, baseY], [-u * 0.52, -u * 1.24], [-u * 0.18, baseY]], '#92A4B8', '#1E2B38', u * 0.04);
  polygon(ctx, [[-u * 0.18, baseY], [0, -u * 1.64], [u * 0.18, baseY]], '#D7E4F1', '#1E2B38', u * 0.04);
  polygon(ctx, [[u * 0.18, baseY], [u * 0.52, -u * 1.24], [u * 0.86, baseY]], '#92A4B8', '#1E2B38', u * 0.04);
  ellipse(ctx, 0, -u * 0.08, u * 0.94, u * 0.12, 'rgba(255,255,255,0.08)', null, 0);
}

function drawFireGeyserFrame(ctx, u, progress) {
  drawShadow(ctx, u, 0.9);
  ellipse(ctx, 0, -u * 0.08, u * 0.42, u * 0.14, '#4E2614', '#201008', u * 0.04);
  ellipse(ctx, 0, -u * 0.18, u * 0.3, u * 0.08, '#6A331A', null, 0);
  if (progress <= 0.02) return;
  const flameH = u * (0.4 + progress * 2.2);
  polygon(ctx, [[-u * 0.24, -u * 0.1], [0, -flameH], [u * 0.24, -u * 0.12], [u * 0.12, -u * 0.56], [0, -u * 0.24], [-u * 0.12, -u * 0.56]], '#FF8B2A', '#6E2B10', u * 0.03);
  polygon(ctx, [[-u * 0.1, -u * 0.08], [0, -flameH * 0.72], [u * 0.1, -u * 0.08]], '#FFE07A', null, 0);
  if (progress > 0.45) {
    glowCircle(ctx, 0, -flameH * 0.56, u * 0.46, '#FF7724', 0.18);
  }
}

function genHumanoidSheet(drawer, fps) {
  const frames = [];
  for (let i = 0; i < 4; i++) frames.push(withFrame((ctx, u) => drawer(ctx, u, i * (Math.PI / 2), 'idle'), 46));
  for (let i = 0; i < 3; i++) frames.push(withFrame((ctx, u) => drawer(ctx, u, i * 0.8, 'attack'), 46));
  frames.push(withFrame((ctx, u) => drawer(ctx, u, 0.2, 'hit'), 46));
  return { canvas: composeSheet(frames, 4, 2), cols: 4, rows: 2, fps, anims: { idle: [0,1,2,3], attack: [4,5,6], hit: [7] } };
}

function genBirdSheet(drawer, cfg, fps) {
  const frames = [];
  for (let i = 0; i < 4; i++) {
    frames.push(withFrame((ctx, u) => drawer(ctx, u, { ...cfg, wing: Math.sin(i * Math.PI / 2) * 0.44, bob: Math.cos(i * Math.PI / 2) * u * 0.04, attack: false, hit: false }), 44));
  }
  for (let i = 0; i < 3; i++) {
    frames.push(withFrame((ctx, u) => drawer(ctx, u, { ...cfg, wing: -0.18 + i * 0.16, bob: -u * 0.04, attack: true, hit: false }), 44));
  }
  frames.push(withFrame((ctx, u) => drawer(ctx, u, { ...cfg, wing: 0.12, bob: 0, attack: false, hit: true }), 44));
  return { canvas: composeSheet(frames, 4, 2), cols: 4, rows: 2, fps, anims: { idle: [0,1,2,3], attack: [4,5,6], hit: [7] } };
}

function genSerpentSheet() {
  return genHumanoidSheet(drawSerpentFrame, 5);
}

function genPteroSheet() {
  const frames = [];
  for (let i = 0; i < 4; i++) frames.push(withFrame((ctx, u) => drawPteroFrame(ctx, u, i * Math.PI / 2), 42, { anchorY: 0.72 }));
  return { canvas: composeSheet(frames, 4, 1), cols: 4, rows: 1, fps: 6, anims: { idle: [0,1,2,3] } };
}

function genLogSheet() {
  const frame = withFrame((ctx, u) => drawLogFrame(ctx, u), 46);
  return { canvas: composeSheet([frame], 1, 1), cols: 1, rows: 1, fps: 1, anims: { idle: [0] } };
}

function genSpikesSheet() {
  const frame = withFrame((ctx, u) => drawSpikesFrame(ctx, u), 46);
  return { canvas: composeSheet([frame], 1, 1), cols: 1, rows: 1, fps: 1, anims: { idle: [0] } };
}

function genFireGeyserSheet() {
  const frames = [];
  const phases = [0, 0.16, 0.32, 0.52, 0.72, 0.92, 0.66, 0.3];
  phases.forEach((phase) => {
    frames.push(withFrame((ctx, u) => drawFireGeyserFrame(ctx, u, phase), 42));
  });
  return { canvas: composeSheet(frames, 4, 2), cols: 4, rows: 2, fps: 5, anims: { idle: [0], attack: [0,1,2,3,4,5,6,7] } };
}

function genSheets() {
  return {
    bomber: genBirdSheet(drawBirdFrame, {
      body: '#744422',
      bodyLight: '#C98B54',
      wingFill: '#9E6235',
      head: '#6A3D1F',
      beak: '#E0A52B',
      payload: '#E04A1A'
    }, 7),
    charger: genHumanoidSheet(drawChargerFrame, 8),
    troll: genHumanoidSheet(drawTrollFrame, 5),
    witch: genHumanoidSheet(drawWitchFrame, 5),
    golem: genHumanoidSheet(drawGolemFrame, 3),
    diver: genBirdSheet(drawBirdFrame, {
      body: '#5D7B3B',
      bodyLight: '#A8C861',
      wingFill: '#7B9B4E',
      head: '#49602F',
      beak: '#E5AA3B',
      payload: '#78B94D'
    }, 6),
    fire_geyser: genFireGeyserSheet(),
    serpent: genSerpentSheet(),
    ptero: genPteroSheet(),
    log: genLogSheet(),
    spikes: genSpikesSheet()
  };
}

async function main() {
  const outputDir = path.join(__dirname, 'assets', 'spritesheets', 'enemies', 'generated');
  ensureDir(outputDir);

  const sheets = genSheets();
  const manifest = {};

  for (const [id, meta] of Object.entries(sheets)) {
    const pngPath = path.join(outputDir, `${id}.png`);
    fs.writeFileSync(pngPath, meta.canvas.toBuffer('image/png'));
    manifest[id] = {
      cols: meta.cols,
      rows: meta.rows,
      fps: meta.fps,
      anims: meta.anims,
      width: meta.canvas.width,
      height: meta.canvas.height
    };
    console.log(`Generated ${id} -> ${pngPath}`);
  }

  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`\nWrote sprite manifest to ${manifestPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
