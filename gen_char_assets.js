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
const PI2 = Math.PI * 2;

const CHARS = [
  { id: 'gronk', name: 'Gronk', col: '#7EC8EC', dk: '#4A9ABE', accent: '#C7F1FF', boot: '#244C70', scale: 1.0, feature: 'horns', trim: '#F6FAFF' },
  { id: 'pip', name: 'Pip', col: '#F4C542', dk: '#B89020', accent: '#FFF1A8', boot: '#7E5B17', scale: 0.93, feature: 'fin', trim: '#FFF6D5' },
  { id: 'bruk', name: 'Bruk', col: '#A06840', dk: '#6A4020', accent: '#D9B574', boot: '#452719', scale: 1.08, feature: 'brow', trim: '#F6E1C2' },
  { id: 'zara', name: 'Zara', col: '#CC55DD', dk: '#882299', accent: '#FF99F2', boot: '#4A1F58', scale: 1.0, feature: 'spikes', trim: '#FFE5FF' },
  { id: 'rex', name: 'Rex', col: '#FF5544', dk: '#BB2211', accent: '#FFD35A', boot: '#682015', scale: 0.95, feature: 'dino', trim: '#FFE8CC' },
  { id: 'mog', name: 'Mog', col: '#44BBAA', dk: '#228877', accent: '#8CFFE3', boot: '#19574F', scale: 1.02, feature: 'mystic', trim: '#E1FFF7' }
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

function rgba(hex, alpha) {
  const c = hexToRgb(hex);
  return `rgba(${c.r},${c.g},${c.b},${alpha})`;
}

function mixColor(a, b, amount) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const t = Math.max(0, Math.min(1, amount));
  return `rgb(${Math.round(ca.r + (cb.r - ca.r) * t)},${Math.round(ca.g + (cb.g - ca.g) * t)},${Math.round(ca.b + (cb.b - ca.b) * t)})`;
}

function ellipse(ctx, x, y, rx, ry, fill, stroke, lineWidth, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, PI2);
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
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
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
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function bodyPath(ctx, u) {
  ctx.beginPath();
  ctx.moveTo(0, -u * 2.0);
  ctx.bezierCurveTo(u * 0.88, -u * 1.85, u * 1.0, -u * 0.56, u * 0.72, u * 0.24);
  ctx.bezierCurveTo(u * 0.46, u * 0.9, u * 0.16, u * 1.16, 0, u * 1.18);
  ctx.bezierCurveTo(-u * 0.16, u * 1.16, -u * 0.46, u * 0.9, -u * 0.72, u * 0.24);
  ctx.bezierCurveTo(-u * 1.0, -u * 0.56, -u * 0.88, -u * 1.85, 0, -u * 2.0);
  ctx.closePath();
}

function facePanelPath(ctx, u) {
  ctx.beginPath();
  ctx.moveTo(-u * 0.56, -u * 1.12);
  ctx.quadraticCurveTo(0, -u * 1.62, u * 0.56, -u * 1.12);
  ctx.lineTo(u * 0.42, u * 0.28);
  ctx.quadraticCurveTo(0, u * 0.8, -u * 0.42, u * 0.28);
  ctx.closePath();
}

function getPose(def) {
  if (def.kind === 'run') {
    const swings = [-0.82, -0.46, 0.06, 0.58, 0.82, 0.34];
    const bobs = [0.02, -0.02, -0.06, -0.04, 0.02, 0.05];
    const step = swings[def.step];
    return {
      legSwing: step,
      armSwing: -step * 0.78,
      bodyTilt: step * 0.1,
      bodyY: bobs[def.step],
      stretchX: 1 - Math.abs(step) * 0.05,
      stretchY: 1 + Math.abs(step) * 0.06,
      eye: 'open',
      mouth: 'smile',
      pupilShift: step * 0.08
    };
  }
  switch (def.kind) {
    case 'wave':
      return { legSwing: 0.14, armSwing: -0.24, bodyTilt: -0.08, bodyY: -0.02, stretchY: 1.02, waveArm: true, eye: 'open', mouth: 'smile', pupilShift: 0.04 };
    case 'worried':
      return { legSwing: 0.04, armSwing: 0.14, bodyTilt: 0.06, bodyY: 0.04, stretchX: 1.04, stretchY: 0.96, eye: 'wide', mouth: 'o' };
    case 'slide':
      return { legSwing: 0.08, armSwing: 0.26, bodyTilt: 0.56, bodyY: 0.12, stretchX: 1.08, stretchY: 0.78, slide: true, eye: 'focus', mouth: 'line' };
    case 'crouch':
      return { legSwing: 0.06, armSwing: 0.06, bodyTilt: 0.08, bodyY: 0.18, stretchX: 1.08, stretchY: 0.82, crouch: true, eye: 'focus', mouth: 'line' };
    case 'jump':
      return { legSwing: 0, armSwing: -0.18, bodyTilt: -0.05, bodyY: -0.22, stretchX: 0.98, stretchY: 1.08, jump: true, eye: 'open', mouth: 'smile' };
    case 'idle':
      return { legSwing: 0.05, armSwing: -0.03, bodyTilt: -0.01, bodyY: 0.02, stretchY: 1.01, eye: 'open', mouth: 'smile' };
    case 'dash':
      return { legSwing: 0.52, armSwing: -0.8, bodyTilt: -0.3, bodyY: -0.04, stretchX: 1.12, stretchY: 0.9, dash: true, eye: 'focus', mouth: 'line' };
    case 'hit':
      return { legSwing: -0.16, armSwing: 0.22, bodyTilt: 0.16, bodyY: 0.04, stretchX: 1.02, stretchY: 0.94, hit: true, eye: 'x', mouth: 'o' };
    case 'idleStand':
      return { legSwing: 0.03, armSwing: 0.02, bodyTilt: 0, bodyY: 0, stretchY: 1.02, eye: 'open', mouth: 'smile', hero: true };
    case 'idleBlink':
      return { legSwing: 0.03, armSwing: 0.02, bodyTilt: 0, bodyY: 0, stretchY: 1.01, eye: 'blink', mouth: 'smile' };
    default:
      return { legSwing: 0, armSwing: 0, bodyTilt: 0, bodyY: 0, stretchX: 1, stretchY: 1, eye: 'open', mouth: 'smile' };
  }
}

function drawEyes(ctx, pose, u, outline) {
  const eyeY = -u * 0.72;
  const lx = -u * 0.26;
  const rx = u * 0.26;
  if (pose.eye === 'blink') {
    strokeLine(ctx, [[lx - u * 0.14, eyeY], [lx + u * 0.14, eyeY]], outline, u * 0.06);
    strokeLine(ctx, [[rx - u * 0.14, eyeY], [rx + u * 0.14, eyeY]], outline, u * 0.06);
    return;
  }
  if (pose.eye === 'x') {
    const w = u * 0.1;
    strokeLine(ctx, [[lx - w, eyeY - w], [lx + w, eyeY + w]], outline, u * 0.06);
    strokeLine(ctx, [[lx - w, eyeY + w], [lx + w, eyeY - w]], outline, u * 0.06);
    strokeLine(ctx, [[rx - w, eyeY - w], [rx + w, eyeY + w]], outline, u * 0.06);
    strokeLine(ctx, [[rx - w, eyeY + w], [rx + w, eyeY - w]], outline, u * 0.06);
    return;
  }
  const eyeFill = pose.eye === 'wide' ? '#FFFFFF' : '#F6FBFF';
  const eyeRx = pose.eye === 'focus' ? u * 0.18 : u * 0.2;
  const eyeRy = pose.eye === 'wide' ? u * 0.22 : pose.eye === 'focus' ? u * 0.18 : u * 0.2;
  ellipse(ctx, lx, eyeY, eyeRx, eyeRy, eyeFill, outline, u * 0.04);
  ellipse(ctx, rx, eyeY, eyeRx, eyeRy, eyeFill, outline, u * 0.04);
  const shift = (pose.pupilShift || 0) * u;
  ellipse(ctx, lx + shift * 0.75, eyeY + u * 0.01, u * 0.09, u * 0.12, '#162132', null, 0);
  ellipse(ctx, rx + shift, eyeY + u * 0.01, u * 0.09, u * 0.12, '#162132', null, 0);
  ellipse(ctx, lx + shift * 0.75 + u * 0.025, eyeY - u * 0.04, u * 0.03, u * 0.035, '#FFFFFF', null, 0);
  ellipse(ctx, rx + shift + u * 0.025, eyeY - u * 0.04, u * 0.03, u * 0.035, '#FFFFFF', null, 0);
}

function drawMouth(ctx, pose, u, outline) {
  if (pose.mouth === 'o') {
    ellipse(ctx, 0, -u * 0.34, u * 0.11, u * 0.15, rgba('#182336', 0.9), outline, u * 0.03);
    return;
  }
  if (pose.mouth === 'line') {
    strokeLine(ctx, [[-u * 0.14, -u * 0.34], [u * 0.14, -u * 0.34]], outline, u * 0.05);
    return;
  }
  ctx.beginPath();
  ctx.arc(0, -u * 0.36, u * 0.18, 0.2, Math.PI - 0.2);
  ctx.strokeStyle = outline;
  ctx.lineWidth = u * 0.05;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawAccessory(ctx, char, pose, u, outline) {
  switch (char.feature) {
    case 'horns':
      polygon(ctx, [[-u * 0.48, -u * 1.8], [-u * 0.18, -u * 1.36], [-u * 0.54, -u * 1.4]], char.trim, outline, u * 0.03);
      polygon(ctx, [[u * 0.18, -u * 1.82], [u * 0.5, -u * 1.42], [u * 0.14, -u * 1.44]], char.trim, outline, u * 0.03);
      break;
    case 'fin':
      polygon(ctx, [[0, -u * 1.86], [u * 0.18, -u * 1.3], [-u * 0.18, -u * 1.3]], char.accent, outline, u * 0.03);
      ellipse(ctx, -u * 0.52, -u * 0.38, u * 0.14, u * 0.08, char.accent, outline, u * 0.02, -0.5);
      ellipse(ctx, u * 0.52, -u * 0.38, u * 0.14, u * 0.08, char.accent, outline, u * 0.02, 0.5);
      break;
    case 'brow':
      polygon(ctx, [[-u * 0.66, -u * 0.94], [u * 0.66, -u * 0.94], [u * 0.5, -u * 1.12], [-u * 0.5, -u * 1.12]], rgba('#402414', 0.9), outline, u * 0.03);
      break;
    case 'spikes':
      for (let i = -1; i <= 2; i++) {
        polygon(ctx, [
          [u * (i * 0.16), -u * (1.84 + Math.abs(i) * 0.04)],
          [u * (i * 0.16 + 0.12), -u * 1.38],
          [u * (i * 0.16 - 0.12), -u * 1.42]
        ], char.accent, outline, u * 0.03);
      }
      break;
    case 'dino':
      for (let i = 0; i < 4; i++) {
        const x = -u * 0.16 + i * u * 0.12;
        polygon(ctx, [[x, -u * (1.76 + i * 0.05)], [x + u * 0.07, -u * 1.42], [x - u * 0.07, -u * 1.42]], char.accent, outline, u * 0.03);
      }
      break;
    case 'mystic':
      strokeLine(ctx, [[-u * 0.18, -u * 1.52], [-u * 0.42, -u * 2.12], [-u * 0.26, -u * 2.04]], char.accent, u * 0.06);
      strokeLine(ctx, [[u * 0.18, -u * 1.52], [u * 0.42, -u * 2.12], [u * 0.26, -u * 2.04]], char.accent, u * 0.06);
      ellipse(ctx, -u * 0.26, -u * 2.04, u * 0.06, u * 0.06, '#72FFE0', rgba('#72FFE0', 0.35), u * 0.03);
      ellipse(ctx, u * 0.26, -u * 2.04, u * 0.06, u * 0.06, '#72FFE0', rgba('#72FFE0', 0.35), u * 0.03);
      break;
  }
}

function drawCharacterFrame(ctx, char, frameSpec) {
  const pose = getPose(frameSpec);
  const u = 22;
  const outline = rgba('#162033', 0.6);
  const bodyCol = pose.hit ? '#FF7A7A' : char.col;
  const darkCol = pose.hit ? '#D34040' : char.dk;
  const trimCol = char.trim || mixColor(char.col, '#FFFFFF', 0.65);
  const cheekCol = rgba('#FFB6B6', 0.3);

  ctx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE);
  ctx.save();
  ctx.translate(FRAME_SIZE / 2, FRAME_SIZE * 0.85 + pose.bodyY * u);
  ctx.scale(char.scale, char.scale);
  ctx.rotate(pose.bodyTilt || 0);

  if (pose.dash) {
    for (let i = 0; i < 3; i++) {
      ellipse(ctx, -u * (1.2 + i * 0.45), -u * (0.42 - i * 0.06), u * (0.46 - i * 0.06), u * (0.88 - i * 0.08), rgba(char.accent, 0.16 - i * 0.04), null, 0, -0.25);
    }
  }

  ellipse(ctx, 0, u * 0.26, u * 1.0, u * 0.18, rgba('#08111F', 0.22), null, 0);

  for (const side of [-1, 1]) {
    ctx.save();
    const legBaseY = pose.crouch ? u * 0.22 : pose.jump ? -u * 0.08 : u * 0.12;
    ctx.translate(side * u * 0.34, legBaseY);
    const legSwing = side * (pose.legSwing || 0) * (pose.slide ? 0.24 : 0.82);
    ctx.rotate(-legSwing);
    ellipse(ctx, 0, u * 0.38, u * 0.16, u * 0.42, darkCol, outline, u * 0.03);
    ellipse(ctx, side * u * 0.05, u * 0.82, u * 0.22, u * 0.1, char.boot, outline, u * 0.03, side * 0.2);
    ctx.restore();
  }

  ctx.save();
  ctx.scale(pose.stretchX || 1, pose.stretchY || 1);
  bodyPath(ctx, u);
  ctx.fillStyle = bodyCol;
  ctx.fill();
  ctx.lineWidth = u * 0.04;
  ctx.strokeStyle = outline;
  ctx.stroke();

  ctx.save();
  facePanelPath(ctx, u);
  ctx.fillStyle = trimCol;
  ctx.fill();
  ctx.lineWidth = u * 0.03;
  ctx.strokeStyle = rgba('#FFFFFF', 0.26);
  ctx.stroke();
  ctx.restore();

  ellipse(ctx, -u * 0.18, -u * 1.38, u * 0.52, u * 0.28, rgba('#FFFFFF', 0.16), null, 0, -0.35);
  ellipse(ctx, 0, u * 0.14, u * 0.38, u * 0.18, rgba(darkCol, 0.2), null, 0);
  ctx.restore();

  if (char.feature === 'dino') {
    ellipse(ctx, u * 0.48, -u * 0.78, u * 0.28, u * 0.18, bodyCol, outline, u * 0.03, 0.16);
    polygon(ctx, [[u * 0.58, -u * 0.72], [u * 0.66, -u * 0.52], [u * 0.52, -u * 0.54]], '#FFFFFF', outline, u * 0.02);
    polygon(ctx, [[u * 0.46, -u * 0.74], [u * 0.54, -u * 0.54], [u * 0.4, -u * 0.56]], '#FFFFFF', outline, u * 0.02);
  }

  drawAccessory(ctx, char, pose, u, outline);

  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(side * u * 0.78, pose.slide ? -u * 0.16 : -u * 0.24);
    let armRot = side * (pose.armSwing || 0) * 0.55;
    if (pose.waveArm && side === 1) armRot = -1.3;
    if (pose.jump) armRot = side === -1 ? -0.72 : 0.64;
    if (pose.slide) armRot = side === 1 ? -0.54 : 0.24;
    ctx.rotate(armRot);
    ellipse(ctx, 0, 0, u * 0.3, u * 0.14, darkCol, outline, u * 0.03, side * 0.18);
    ellipse(ctx, side * u * 0.18, u * 0.02, u * 0.09, u * 0.07, trimCol, outline, u * 0.02);
    ctx.restore();
  }

  ellipse(ctx, -u * 0.46, -u * 0.56, u * 0.12, u * 0.08, cheekCol, null, 0);
  ellipse(ctx, u * 0.46, -u * 0.56, u * 0.12, u * 0.08, cheekCol, null, 0);
  drawEyes(ctx, pose, u, outline);
  drawMouth(ctx, pose, u, outline);

  if (pose.hero) {
    ellipse(ctx, 0, -u * 2.04, u * 0.14, u * 0.08, '#FFD85C', rgba('#FFF0A5', 0.35), u * 0.03);
  }
  if (char.feature === 'mystic') {
    ellipse(ctx, 0, -u * 0.54, u * 0.48, u * 0.48, rgba('#8CFFE3', 0.08), null, 0);
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
