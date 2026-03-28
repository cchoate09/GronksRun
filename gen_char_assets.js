const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');
const sharp = require('sharp');

const ROOT = __dirname;
const SHEET_DIR = path.join(ROOT, 'assets', 'spritesheets');
const NORMALIZED_DIR = path.join(SHEET_DIR, 'normalized');
const OUTPUT_PATH = path.join(ROOT, 'assets.js');

const FRAME_SIZE = 128;
const FRAME_COLS = 8;
const FRAME_ROWS = 2;
const SHEET_WIDTH = FRAME_SIZE * FRAME_COLS;
const SHEET_HEIGHT = FRAME_SIZE * FRAME_ROWS;

const CHARS = [
  { id: 'gronk', name: 'Gronk', col: '#7EC8EC', dk: '#4A9ABE', accent: '#C7F1FF', boot: '#2A5A80', scale: 1.0, feature: 'horns' },
  { id: 'pip', name: 'Pip', col: '#F4C542', dk: '#B89020', accent: '#FFF1A8', boot: '#8A641A', scale: 0.93, feature: 'fin' },
  { id: 'bruk', name: 'Bruk', col: '#A06840', dk: '#6A4020', accent: '#D9B574', boot: '#4A3020', scale: 1.08, feature: 'brow' },
  { id: 'zara', name: 'Zara', col: '#CC55DD', dk: '#882299', accent: '#FF99F2', boot: '#5B256A', scale: 1.0, feature: 'spikes' },
  { id: 'rex', name: 'Rex', col: '#FF5544', dk: '#BB2211', accent: '#FFD35A', boot: '#7A2A1A', scale: 0.95, feature: 'dino' },
  { id: 'mog', name: 'Mog', col: '#44BBAA', dk: '#228877', accent: '#8CFFE3', boot: '#1D6A62', scale: 1.02, feature: 'mystic' }
];

const FRAMES = [
  { kind: 'run', step: 0 },
  { kind: 'run', step: 1 },
  { kind: 'run', step: 2 },
  { kind: 'run', step: 3 },
  { kind: 'run', step: 4 },
  { kind: 'run', step: 5 },
  { kind: 'wave' },
  { kind: 'worried' },
  { kind: 'slide' },
  { kind: 'crouch' },
  { kind: 'jump' },
  { kind: 'idle' },
  { kind: 'dash' },
  { kind: 'hit' },
  { kind: 'idleStand' },
  { kind: 'idleBlink' }
];

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

function rgba(hex, alpha) {
  const c = hexToRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

function ellipse(ctx, x, y, rx, ry, fill, stroke, lineWidth, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lineWidth || 1;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function polygon(ctx, points, fill, stroke, lineWidth) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.lineWidth = lineWidth || 1;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function strokeLine(ctx, points, stroke, lineWidth) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function quadratic(ctx, points, stroke, lineWidth) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  ctx.quadraticCurveTo(points[1][0], points[1][1], points[2][0], points[2][1]);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function getPose(def) {
  if (def.kind === 'run') {
    const swings = [-0.72, -0.42, 0.08, 0.52, 0.78, 0.28];
    const bobs = [0.02, -0.01, -0.05, -0.02, 0.01, 0.04];
    const step = swings[def.step];
    return {
      legSwing: step,
      armSwing: -step * 0.85,
      bodyTilt: step * 0.08,
      bodyY: bobs[def.step],
      stretchX: 1 - Math.abs(step) * 0.04,
      stretchY: 1 + Math.abs(step) * 0.05,
      eye: 'open',
      mouth: 'smile',
      pupilShift: step * 0.08
    };
  }
  switch (def.kind) {
    case 'wave':
      return { legSwing: 0.12, armSwing: -0.2, bodyTilt: -0.08, bodyY: -0.04, stretchY: 1.02, waveArm: true, eye: 'open', mouth: 'smile', pupilShift: 0.04 };
    case 'worried':
      return { legSwing: 0, armSwing: 0.16, bodyTilt: 0.06, bodyY: 0.02, stretchX: 1.03, stretchY: 0.98, eye: 'wide', mouth: 'o', worried: true };
    case 'slide':
      return { legSwing: 0.15, armSwing: 0.35, bodyTilt: 0.58, bodyY: 0.1, stretchX: 1.06, stretchY: 0.78, slide: true, eye: 'focus', mouth: 'line' };
    case 'crouch':
      return { legSwing: 0.06, armSwing: 0.04, bodyTilt: 0.04, bodyY: 0.16, stretchX: 1.06, stretchY: 0.82, crouch: true, eye: 'focus', mouth: 'line' };
    case 'jump':
      return { legSwing: 0, armSwing: -0.18, bodyTilt: -0.06, bodyY: -0.18, stretchX: 0.98, stretchY: 1.08, jump: true, eye: 'open', mouth: 'smile' };
    case 'idle':
      return { legSwing: 0.08, armSwing: -0.05, bodyTilt: -0.02, bodyY: 0.01, stretchY: 1.01, eye: 'open', mouth: 'smile' };
    case 'dash':
      return { legSwing: 0.45, armSwing: -0.75, bodyTilt: -0.28, bodyY: -0.03, stretchX: 1.12, stretchY: 0.9, dash: true, eye: 'focus', mouth: 'line' };
    case 'hit':
      return { legSwing: -0.18, armSwing: 0.2, bodyTilt: 0.14, bodyY: 0.03, stretchX: 1.02, stretchY: 0.94, hit: true, eye: 'x', mouth: 'o' };
    case 'idleStand':
      return { legSwing: 0.04, armSwing: 0.02, bodyTilt: 0, bodyY: 0, stretchY: 1.02, eye: 'open', mouth: 'smile', hero: true };
    case 'idleBlink':
      return { legSwing: 0.04, armSwing: 0.02, bodyTilt: 0, bodyY: 0, stretchY: 1.01, eye: 'blink', mouth: 'smile' };
    default:
      return { legSwing: 0, armSwing: 0, bodyTilt: 0, bodyY: 0, stretchX: 1, stretchY: 1, eye: 'open', mouth: 'smile' };
  }
}

function drawEyes(ctx, char, pose, u, outline) {
  const eyeScale = char.id === 'pip' ? 1.18 : char.id === 'bruk' ? 0.88 : 1;
  const leftX = -u * 0.28;
  const rightX = u * 0.28;
  const eyeY = -u * 1.18;

  if (pose.eye === 'blink') {
    strokeLine(ctx, [[leftX - u * 0.15, eyeY], [leftX + u * 0.15, eyeY]], outline, u * 0.08);
    strokeLine(ctx, [[rightX - u * 0.15, eyeY], [rightX + u * 0.15, eyeY]], outline, u * 0.08);
    return;
  }

  if (pose.eye === 'x') {
    const w = u * 0.13;
    strokeLine(ctx, [[leftX - w, eyeY - w], [leftX + w, eyeY + w]], outline, u * 0.07);
    strokeLine(ctx, [[leftX - w, eyeY + w], [leftX + w, eyeY - w]], outline, u * 0.07);
    strokeLine(ctx, [[rightX - w, eyeY - w], [rightX + w, eyeY + w]], outline, u * 0.07);
    strokeLine(ctx, [[rightX - w, eyeY + w], [rightX + w, eyeY - w]], outline, u * 0.07);
    return;
  }

  const eyeFill = pose.eye === 'wide' ? '#FDFEFF' : '#FFFFFF';
  const eyeRy = pose.eye === 'wide' ? u * 0.32 * eyeScale : pose.eye === 'focus' ? u * 0.25 * eyeScale : u * 0.28 * eyeScale;
  const eyeRx = pose.eye === 'wide' ? u * 0.25 * eyeScale : u * 0.22 * eyeScale;
  ellipse(ctx, leftX, eyeY, eyeRx, eyeRy, eyeFill, outline, u * 0.04);
  ellipse(ctx, rightX, eyeY, eyeRx, eyeRy, eyeFill, outline, u * 0.04);

  const shift = (pose.pupilShift || 0) * u;
  ellipse(ctx, leftX + shift * 0.7, eyeY + u * 0.01, u * 0.11, u * 0.15, '#1A2230', null, 0);
  ellipse(ctx, rightX + shift, eyeY + u * 0.01, u * 0.11, u * 0.15, '#1A2230', null, 0);
  ellipse(ctx, leftX + shift * 0.7 + u * 0.03, eyeY - u * 0.05, u * 0.035, u * 0.04, '#FFFFFF', null, 0);
  ellipse(ctx, rightX + shift + u * 0.03, eyeY - u * 0.05, u * 0.035, u * 0.04, '#FFFFFF', null, 0);
}

function drawMouth(ctx, pose, u, outline) {
  ctx.strokeStyle = outline;
  ctx.lineWidth = u * 0.06;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (pose.mouth === 'o') {
    ellipse(ctx, 0, -u * 0.88, u * 0.13, u * 0.17, rgba('#1A2230', 0.9), outline, u * 0.04);
    return;
  }
  if (pose.mouth === 'line') {
    strokeLine(ctx, [[-u * 0.16, -u * 0.9], [u * 0.16, -u * 0.9]], outline, u * 0.06);
    return;
  }
  ctx.beginPath();
  ctx.arc(0, -u * 0.92, u * 0.24, 0.2, Math.PI - 0.2);
  ctx.stroke();
}

function drawAccessory(ctx, char, pose, u, outline) {
  const accent = char.accent;
  switch (char.feature) {
    case 'fin':
      ellipse(ctx, 0, -u * 1.03, u * 0.18, u * 0.1, accent, outline, u * 0.03);
      ellipse(ctx, -u * 0.34, -u * 0.8, u * 0.11, u * 0.07, accent, outline, u * 0.03, -0.4);
      ellipse(ctx, u * 0.34, -u * 0.8, u * 0.11, u * 0.07, accent, outline, u * 0.03, 0.4);
      break;
    case 'brow':
      ctx.fillStyle = rgba('#3E2410', 0.92);
      ctx.fillRect(-u * 0.54, -u * 1.5, u * 0.42, u * 0.08);
      ctx.fillRect(u * 0.12, -u * 1.5, u * 0.42, u * 0.08);
      ctx.fillStyle = rgba(accent, 0.85);
      ctx.fillRect(-u * 0.48, -u * 1.05, u * 0.96, u * 0.08);
      break;
    case 'spikes':
      for (let i = -1; i <= 2; i++) {
        polygon(ctx, [
          [u * (i * 0.18), -u * (1.82 + Math.abs(i) * 0.06)],
          [u * (i * 0.18 + 0.14), -u * 1.5],
          [u * (i * 0.18 - 0.14), -u * 1.54]
        ], accent, outline, u * 0.03);
      }
      polygon(ctx, [[-u * 0.18, -u * 1.24], [u * 0.26, -u * 1.06], [u * 0.04, -u * 0.9]], accent, outline, u * 0.03);
      break;
    case 'dino':
      for (let i = 0; i < 4; i++) {
        const x = -u * 0.12 + i * u * 0.14;
        polygon(ctx, [[x, -u * (1.82 + i * 0.04)], [x + u * 0.08, -u * 1.56], [x - u * 0.08, -u * 1.56]], '#FF2200', outline, u * 0.03);
      }
      ellipse(ctx, u * 0.48, -u * 1.04, u * 0.22, u * 0.15, rgba('#FFF5D6', 0.3), null, 0, 0.2);
      break;
    case 'mystic':
      quadratic(ctx, [[-u * 0.18, -u * 1.66], [-u * 0.48, -u * 2.28], [-u * 0.3, -u * 2.18]], accent, u * 0.06);
      quadratic(ctx, [[u * 0.18, -u * 1.66], [u * 0.48, -u * 2.28], [u * 0.3, -u * 2.18]], accent, u * 0.06);
      ellipse(ctx, -u * 0.3, -u * 2.18, u * 0.07, u * 0.07, '#66FFCC', rgba('#44FFAA', 0.55), u * 0.04);
      ellipse(ctx, u * 0.3, -u * 2.18, u * 0.07, u * 0.07, '#66FFCC', rgba('#44FFAA', 0.55), u * 0.04);
      ctx.strokeStyle = rgba('#8CFFE3', 0.38);
      ctx.lineWidth = u * 0.05;
      ctx.beginPath();
      ctx.arc(0, -u * 0.88, u * 0.36, 0, Math.PI * 1.5);
      ctx.stroke();
      break;
    default:
      polygon(ctx, [[-u * 0.3, -u * 1.8], [-u * 0.08, -u * 1.52], [-u * 0.48, -u * 1.56]], accent, outline, u * 0.03);
      polygon(ctx, [[u * 0.08, -u * 1.86], [u * 0.3, -u * 1.58], [-u * 0.08, -u * 1.6]], accent, outline, u * 0.03);
      break;
  }
}

function drawCharacterFrame(ctx, char, frameSpec) {
  const pose = getPose(frameSpec);
  const u = 25;
  const outline = rgba('#152033', 0.58);
  const shadowCol = rgba('#08111F', 0.22);
  const bodyCol = pose.hit ? '#FF7474' : char.col;
  const darkCol = pose.hit ? '#CC3030' : char.dk;
  const bellyCol = rgba('#FFFFFF', 0.18);
  const highlightCol = mixColor(char.col, '#FFFFFF', 0.24);

  ctx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE);
  ctx.save();
  ctx.translate(FRAME_SIZE / 2, FRAME_SIZE * 0.9 + pose.bodyY * u * 0.9);
  ctx.scale(char.scale, char.scale);
  ctx.rotate(pose.bodyTilt || 0);

  if (pose.dash) {
    for (let i = 0; i < 3; i++) {
      const alpha = 0.16 - i * 0.04;
      ellipse(ctx, -u * (1.2 + i * 0.42), -u * (0.96 - i * 0.05), u * (0.34 - i * 0.04), u * (0.78 - i * 0.06), rgba(char.accent, alpha), null, 0, -0.2);
    }
  }

  ellipse(ctx, 0, u * 0.2, u * 0.96, u * 0.18, shadowCol, null, 0);

  for (const side of [-1, 1]) {
    ctx.save();
    const legBaseY = pose.crouch ? -u * 0.1 : pose.jump ? -u * 0.18 : -u * 0.08;
    ctx.translate(side * u * 0.34, legBaseY);
    const legSwing = side * (pose.legSwing || 0) * (pose.slide ? 0.2 : 0.92);
    ctx.rotate(-legSwing);
    ellipse(ctx, 0, u * 0.38, u * 0.17, u * (pose.crouch ? 0.3 : 0.4), darkCol, outline, u * 0.03);
    ellipse(ctx, side * u * 0.05, pose.crouch ? u * 0.58 : u * 0.78, u * 0.2, u * 0.1, char.boot, outline, u * 0.03, 0.18 * side);
    ctx.restore();
  }

  ellipse(ctx, -u * 0.74, -u * 0.58, u * 0.28, u * 0.15, darkCol, outline, u * 0.03, -0.58);

  ctx.save();
  ctx.scale(pose.stretchX || 1, pose.stretchY || 1);
  ellipse(ctx, 0, -u * 0.9, u * 0.88, u * 1.05, bodyCol, outline, u * 0.035);
  ellipse(ctx, 0, -u * 0.68, u * 0.5, u * 0.58, bellyCol, null, 0);
  ellipse(ctx, -u * 0.18, -u * 1.22, u * 0.5, u * 0.34, rgba(highlightCol, 0.2), null, 0, -0.35);
  ctx.restore();

  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * u * 0.72, pose.slide ? -u * 1.02 : -u * 0.98);
    let armRot = side * (pose.armSwing || 0) * 0.55;
    if (pose.waveArm && side === 1) armRot = -1.35;
    if (pose.jump) armRot = side === -1 ? -0.8 : 0.65;
    if (pose.slide && side === 1) armRot = -0.55;
    ctx.rotate(armRot);
    ellipse(ctx, 0, 0, u * 0.3, u * 0.16, darkCol, outline, u * 0.03, side * 0.3);
    ctx.restore();
  }

  if (char.feature === 'dino') {
    ellipse(ctx, u * 0.52, -u * 1.08, u * 0.26, u * 0.18, bodyCol, outline, u * 0.03, 0.22);
    polygon(ctx, [[u * 0.64, -u * 0.96], [u * 0.7, -u * 0.8], [u * 0.58, -u * 0.82]], '#FFFFFF', outline, u * 0.02);
    polygon(ctx, [[u * 0.54, -u * 0.98], [u * 0.6, -u * 0.82], [u * 0.48, -u * 0.84]], '#FFFFFF', outline, u * 0.02);
  }

  drawAccessory(ctx, char, pose, u, outline);
  drawEyes(ctx, char, pose, u, outline);
  drawMouth(ctx, pose, u, outline);

  ellipse(ctx, -u * 0.54, -u * 1.06, u * 0.13, u * 0.08, rgba('#FFA0A0', 0.34), null, 0);
  ellipse(ctx, u * 0.54, -u * 1.06, u * 0.13, u * 0.08, rgba('#FFA0A0', 0.34), null, 0);

  if (char.feature === 'mystic') {
    ellipse(ctx, 0, -u * 0.88, u * 0.42, u * 0.42, rgba('#8CFFE3', 0.08), null, 0);
  }

  if (char.id === 'zara') {
    ellipse(ctx, -u * 0.22, -u * 1.06, u * 0.15, u * 0.09, rgba(char.accent, 0.92), outline, u * 0.025, -0.25);
    ellipse(ctx, u * 0.28, -u * 0.94, u * 0.14, u * 0.08, rgba(char.accent, 0.92), outline, u * 0.025, 0.18);
  }

  if (char.id === 'gronk') {
    ellipse(ctx, -u * 0.18, -u * 1.06, u * 0.16, u * 0.09, rgba(char.accent, 0.9), outline, u * 0.025, -0.18);
    ellipse(ctx, u * 0.2, -u * 0.88, u * 0.15, u * 0.08, rgba(char.accent, 0.9), outline, u * 0.025, 0.18);
  }

  if (char.id === 'bruk') {
    ctx.fillStyle = rgba('#3B2416', 0.22);
    ctx.fillRect(-u * 0.6, -u * 1.12, u * 1.2, u * 0.16);
  }

  if (pose.hero) {
    ellipse(ctx, 0, -u * 1.86, u * 0.18, u * 0.08, rgba('#FFD85C', 0.85), rgba('#FFF0A5', 0.35), u * 0.03);
  }

  ctx.restore();
}

async function renderSheet(char) {
  const canvas = createCanvas(SHEET_WIDTH, SHEET_HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, SHEET_WIDTH, SHEET_HEIGHT);
  ctx.imageSmoothingEnabled = true;

  for (let i = 0; i < FRAMES.length; i++) {
    const col = i % FRAME_COLS;
    const row = Math.floor(i / FRAME_COLS);
    ctx.save();
    ctx.translate(col * FRAME_SIZE, row * FRAME_SIZE);
    drawCharacterFrame(ctx, char, FRAMES[i]);
    ctx.restore();
  }

  const raw = canvas.toBuffer('image/png');
  return sharp(raw)
    .png({
      compressionLevel: 9,
      palette: true,
      quality: 90,
      colours: 192,
      effort: 10
    })
    .toBuffer();
}

async function main() {
  fs.mkdirSync(NORMALIZED_DIR, { recursive: true });

  const lines = [
    '// Generated by gen_char_assets.js',
    '',
    'var SPRITE_B64 = {'
  ];

  for (const char of CHARS) {
    const outPath = path.join(NORMALIZED_DIR, char.id + '.png');
    const buffer = await renderSheet(char);
    fs.writeFileSync(outPath, buffer);
    lines.push(`  ${char.id}: 'data:image/png;base64,${buffer.toString('base64')}',`);
    console.log(`Generated ${char.id} -> ${path.relative(ROOT, outPath)}`);
  }

  lines.push('};', '');
  fs.writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf8');
  console.log('Updated assets.js with generated character sprite sheets.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
