
'use strict';

// ============================================================
// CANVAS
// ============================================================
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let W = 0, H = 0, UNIT = 1, GROUND_BASE = 0, PLAYER_SX = 0;
let _slowMoTimer = 0, _slowMoFactor = 1;

// Global Ad State (Recovered)
let adPendingReward = null;
let adDoubleGemsUsed = false;
let adDeathCount = 0;
let adLastShownTime = 0;
const AD_DEATH_INTERVAL = 3;
const AD_COOLDOWN_MS = 60000;

// Pre-cached font strings (rebuilt on resize to avoid per-frame template literals)
const FONTS = {};
function rebuildFonts(u) {
  const sizes = [0.4, 0.5, 0.55, 0.6, 0.65, 0.7, 0.8, 0.9, 1, 1.2, 1.5, 2, 2.5, 3, 4, 5];
  for (const s of sizes) {
    const px = Math.round(u * s);
    FONTS[`b${s}`] = `bold ${px}px monospace`;
    FONTS[`n${s}`] = `${px}px monospace`;
  }
}
// lightenColor helper: takes hex color, returns lighter version
function lightenColor(hex, amount) {
  hex = hex.replace('#','');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  const r = Math.max(0, Math.min(255, parseInt(hex.substring(0,2),16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substring(2,4),16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substring(4,6),16) + amount));
  return '#' + ((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);
}
function darkenColor(hex, amount) { return lightenColor(hex, -amount); }

// Safe area insets for Android notch/nav bar
let SAFE_TOP = 0, SAFE_BOTTOM = 0, SAFE_LEFT = 0, SAFE_RIGHT = 0;
function updateSafeAreas() {
  const u = UNIT;
  // CSS env() safe area insets (enabled by viewport-fit=cover)
  const root = document.documentElement;
  const cs = getComputedStyle(root);
  const sat = parseFloat(cs.getPropertyValue('--sat')) || 0;
  const sab = parseFloat(cs.getPropertyValue('--sab')) || 0;
  const sal = parseFloat(cs.getPropertyValue('--sal')) || 0;
  const sar = parseFloat(cs.getPropertyValue('--sar')) || 0;
  SAFE_TOP = Math.max(sat, u * 0.5);
  SAFE_BOTTOM = Math.max(sab, u * 0.5);
  SAFE_LEFT = Math.max(sal, u * 0.3);
  SAFE_RIGHT = Math.max(sar, u * 0.3);
}

function resize() {
  // Clear cached canvases on resize to free memory
  _vignetteCache = null;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  W = canvas.width; H = canvas.height;
  UNIT = Math.min(W, H) / 20;
  GROUND_BASE = H * 0.73;
  PLAYER_SX = W * 0.18;
  rebuildFonts(UNIT);
  updateSafeAreas();
}
let _resizeTimer = 0;
function debouncedResize() { clearTimeout(_resizeTimer); _resizeTimer = setTimeout(resize, 150); }
window.addEventListener('resize', debouncedResize);
window.addEventListener('orientationchange', debouncedResize);
// Auto-pause when app loses focus / user switches away
document.addEventListener('visibilitychange', () => {
  if (document.hidden && typeof G !== 'undefined' && G.phase === 'PLAYING') G.phase = 'PAUSED';
});
// blur handler removed — Android WebView fires spurious blur events
// visibilitychange (above) already covers the real use case

// ============================================================
// UTILS
// ============================================================
const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const smooth = t => t * t * (3 - 2 * t);
const PI2   = Math.PI * 2;

// Rounded rectangle path (uses arcTo for WebView compat)
function rrPath(x,y,w,h,r){
  r=Math.min(r,w/2,h/2);
  ctx.beginPath();ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
function fillRR(x,y,w,h,r,fill,stroke,lw){
  rrPath(x,y,w,h,r);
  if(fill){ctx.fillStyle=fill;ctx.fill();}
  if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw||2;ctx.stroke();}
}
function drawNotifDot(x, y, count, u) {
  if (count <= 0) return;
  const r = u * 0.35;
  ctx.beginPath(); ctx.arc(x, y, r, 0, PI2);
  ctx.fillStyle = '#FF2244'; ctx.fill();
  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.font = 'bold '+Math.round(u*0.3)+'px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFF';
  ctx.fillText(count > 9 ? '9+' : ''+count, x, y);
}

function drawButton(x,y,w,h,label,opts){
  opts=opts||{};
  const r=opts.radius||UNIT*0.3;
  const pressed=inp.pressing&&inp.tapX>=x&&inp.tapX<=x+w&&inp.tapY>=y&&inp.tapY<=y+h;
  const cx=x+w/2,cy=y+h/2;
  if(pressed){ctx.save();ctx.translate(cx,cy);ctx.scale(0.95,0.95);ctx.translate(-cx,-cy);}
  fillRR(x,y,w,h,r,opts.fill||'rgba(30,60,90,0.8)',opts.stroke||'rgba(255,255,255,0.4)',opts.lw||2);
  if(pressed){fillRR(x,y,w,h,r,'rgba(0,0,0,0.2)',null,0);}
  ctx.font=opts.font||FONTS['b1']||('bold '+UNIT+'px monospace');
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle=opts.textColor||'#FFF';
  ctx.fillText(label,cx,cy);
  if(pressed)ctx.restore();
  return{x,y,w,h,pressed};
}

function drawPanel(x, y, w, h, opts) {
  opts = opts || {};
  const radius = opts.radius || UNIT * 0.35;
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, opts.top || 'rgba(20,32,52,0.92)');
  grad.addColorStop(1, opts.bottom || 'rgba(8,14,28,0.84)');
  ctx.save();
  ctx.shadowColor = opts.shadow || 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = opts.blur || 18;
  fillRR(x, y, w, h, radius, grad, opts.stroke || 'rgba(255,255,255,0.12)', opts.lw || 2);
  ctx.shadowBlur = 0;
  if (opts.gloss !== false) {
    ctx.globalAlpha = opts.glossAlpha || 0.18;
    fillRR(x + 2, y + 2, w - 4, Math.max(6, h * 0.34), Math.max(6, radius - 2), 'rgba(255,255,255,0.18)', null, 0);
    ctx.globalAlpha = 1;
  }
  if (opts.accent) {
    fillRR(x, y, w, Math.max(4, h * 0.13), radius, opts.accent, null, 0);
  }
  ctx.restore();
}

function drawMiniChip(x, y, w, h, label, opts) {
  opts = opts || {};
  drawPanel(x, y, w, h, {
    radius: opts.radius || UNIT * 0.28,
    top: opts.top || 'rgba(18,28,46,0.9)',
    bottom: opts.bottom || 'rgba(10,16,30,0.86)',
    stroke: opts.stroke || 'rgba(255,255,255,0.1)',
    shadow: opts.shadow || 'rgba(0,0,0,0.18)',
    blur: opts.blur || 14,
    accent: opts.accent || null,
    glossAlpha: opts.glossAlpha || 0.15
  });
  ctx.font = opts.font || FONTS['b0.45'] || ('bold ' + Math.round(UNIT * 0.45) + 'px monospace');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = opts.textColor || '#F5F7FF';
  // Auto-shrink text to fit chip width with padding
  const _chipPad = UNIT * 0.35;
  const _maxTW = w - _chipPad * 2;
  if (ctx.measureText(label).width > _maxTW && _maxTW > 10) {
    const _m = ctx.measureText(label).width;
    const _scale = _maxTW / _m;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(_scale, 1);
    ctx.fillText(label, 0, 0); ctx.restore();
  } else {
    ctx.fillText(label, x + w / 2, y + h / 2);
  }
}

function drawProgressBar(x, y, w, h, frac, colors) {
  frac = clamp(frac, 0, 1);
  drawPanel(x, y, w, h, {
    radius: h / 2,
    top: 'rgba(7,12,24,0.92)',
    bottom: 'rgba(4,8,18,0.92)',
    stroke: 'rgba(255,255,255,0.08)',
    blur: 10,
    gloss: false
  });
  if (frac <= 0) return;
  const fill = ctx.createLinearGradient(x, y, x + w, y);
  fill.addColorStop(0, colors[0]);
  fill.addColorStop(1, colors[1]);
  ctx.save();
  rrPath(x + 2, y + 2, Math.max(2, (w - 4) * frac), Math.max(2, h - 4), Math.max(2, h / 2 - 2));
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

function drawTextBlock(text, x, y, maxWidth, lineHeight, opts) {
  opts = opts || {};
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const test = line ? (line + ' ' + words[i]) : words[i];
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = words[i];
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const align = opts.align || 'center';
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * lineHeight);
  }
  return lines.length * lineHeight;
}

function drawStarShape(x, y, r, fill, stroke) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + i * Math.PI / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, r * 0.18);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDiamondShape(x, y, r, fill, stroke) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.72, -r * 0.24);
  ctx.lineTo(r * 0.72, r * 0.34);
  ctx.lineTo(0, r);
  ctx.lineTo(-r * 0.72, r * 0.34);
  ctx.lineTo(-r * 0.72, -r * 0.24);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, r * 0.16);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.7);
  ctx.lineTo(r * 0.22, -r * 0.08);
  ctx.lineTo(0, r * 0.12);
  ctx.lineTo(-r * 0.12, -r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHeartShape(x, y, s, fill, stroke) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, s * 0.9);
  ctx.bezierCurveTo(s * 0.9, s * 0.25, s * 0.95, -s * 0.45, 0, -s * 0.1);
  ctx.bezierCurveTo(-s * 0.95, -s * 0.45, -s * 0.9, s * 0.25, 0, s * 0.9);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = Math.max(1, s * 0.14);
    ctx.stroke();
  }
  ctx.restore();
}

// ============================================================
// RNG (Park-Miller)
// ============================================================
class RNG {
  constructor(s) { this.s = (Math.abs(s|0) % 2147483647) || 1; }
  next()      { this.s = (this.s * 16807) % 2147483647; return (this.s - 1) / 2147483646; }
  range(a, b) { return a + this.next() * (b - a); }
  int(a, b)   { return Math.floor(this.range(a, b + 1)); }
  bool(p)     { return this.next() < p; }
  pick(a)     { return a[this.int(0, a.length - 1)]; }
}

// ============================================================
// SAVE DATA
// ============================================================
const save = {
  highestLevel: 0, bestScore: 0, totalGems: 0, selectedChar: 0,
  savedLevel: 1, savedScore: 0, savedGems: 0,
  cooldownEnd: 0, // timestamp when cooldown expires (0 = no cooldown)
  lastLoginDate: '', // YYYY-MM-DD of last daily reward
  dailyStreak: 0,    // consecutive daily logins
  tutorialSeen: false,
  stats: { totalRuns:0, totalGems:0, totalScore:0, highestLevel:0, longestRun:0, enemiesDodged:0, obstaclesSmashed:0, dashesUsed:0, slidesUsed:0 },
  achievements: {},
  unlockedChars: [0], // Gronk starts unlocked; others unlocked via milestones or shop
  shopUpgrades: {},    // permanent upgrades bought from shop
  nextRunPowerups: [], // per-run powerups consumed on next level start
  levelStars: {},      // level# → 0-3 star rating
  endlessBest: 0,      // endless mode high score
  challengeBest: 0,    // daily challenge best score
  lastChallengeDate: '', // YYYY-MM-DD of last daily challenge played
};
function loadSave() {
  try {
    const d = JSON.parse(localStorage.getItem('gronk2') || '{}');
    Object.assign(save, d);
    // Type coercion — ensure numeric fields are actually numbers
    const numKeys = ['highestLevel','bestScore','totalGems','selectedChar','savedLevel','savedScore','savedGems','cooldownEnd','dailyStreak'];
    for (const k of numKeys) save[k] = Number(save[k]) || 0;
    save.tutorialSeen = !!save.tutorialSeen;
    save.lastLoginDate = save.lastLoginDate || '';
    // Ensure nested objects have all keys (migration-safe)
    if (!save.stats || typeof save.stats !== 'object') save.stats = {};
    const defStats = { totalRuns:0, totalGems:0, totalScore:0, highestLevel:0, longestRun:0, enemiesDodged:0, obstaclesSmashed:0, dashesUsed:0, slidesUsed:0 };
    for (const k in defStats) { if (save.stats[k] === undefined) save.stats[k] = defStats[k]; else save.stats[k] = Number(save.stats[k]) || 0; }
    if (!save.achievements || typeof save.achievements !== 'object') save.achievements = {};
    // Achievement bonuses migration
    if (!save.achievementBonuses || typeof save.achievementBonuses !== 'object') save.achievementBonuses = {};
    // Shop migration
    if (!save.shopUpgrades || typeof save.shopUpgrades !== 'object') save.shopUpgrades = {};
    if (!Array.isArray(save.nextRunPowerups)) save.nextRunPowerups = [];
    // Star rating migration
    if (!save.levelStars || typeof save.levelStars !== 'object') save.levelStars = {};
    // Endless mode migration
    save.endlessBest = Number(save.endlessBest) || 0;
    // Daily challenge migration
    save.challengeBest = Number(save.challengeBest) || 0;
    save.lastChallengeDate = save.lastChallengeDate || '';
    // Missions migration
    if (!save.missions) save.missions = { daily: [], weekly: [], lastDailyReset: '', lastWeeklyReset: '' };
    // Audio settings migration
    if (save.musicVolume !== undefined) musicVolume = Number(save.musicVolume);
    if (save.sfxVolume !== undefined) sfxVolume = Number(save.sfxVolume);
    if (save.screenShake === undefined) save.screenShake = true;
    // Character unlock migration
    if (!Array.isArray(save.unlockedChars)) save.unlockedChars = [0];
    if (!save.unlockedChars.includes(0)) save.unlockedChars.unshift(0);
    // Daily calendar migration
    if (!Array.isArray(save.calendarClaimed)) save.calendarClaimed = [];
    save.calendarWeekStart = save.calendarWeekStart || '';
    // Skins migration
    if (!Array.isArray(save.ownedSkins)) save.ownedSkins = [];
    if (!save.activeSkins || typeof save.activeSkins !== 'object') save.activeSkins = {};
  } catch(e) { /* corrupted save — defaults remain */ }
}
let _saveFailWarning = 0;
function persistSave() {
  try { localStorage.setItem('gronk2', JSON.stringify(save)); _saveFailWarning = 0; } catch(e) { _saveFailWarning = 5; }
}
function _hitStop(dur) { G.hitStop = Math.max(G.hitStop || 0, dur); }
function safeSelectedChar() {
  return save.unlockedChars.includes(save.selectedChar) ? save.selectedChar : 0;
}

// ============================================================
// NATIVE BRIDGES
// ============================================================
let isOnline = navigator.onLine !== false;
let adReady = false;
let ratePromptShown = false;

window.addEventListener('online', function() {
  isOnline = true;
  checkAdReady();
});

window.addEventListener('offline', function() {
  isOnline = false;
  adReady = false;
});

function checkRatePrompt() {
  if (ratePromptShown) return false;
  if (save._ratePromptDismissed) return false;
  const stats = save.stats || {};
  if (stats.totalRuns >= 5 || (stats.highestLevel || 0) >= 10) {
    ratePromptShown = true;
    return true;
  }
  return false;
}

function triggerRateApp() {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'rateApp' }));
  }
  save._ratePromptDismissed = true;
  persistSave();
}

function canShowAd() {
  if (!isOnline) return false;
  const now = Date.now();
  if (adDeathCount < AD_DEATH_INTERVAL && adLastShownTime > 0) return false;
  if (now - adLastShownTime < AD_COOLDOWN_MS && adLastShownTime > 0) return false;
  return true;
}

function requestAd(rewardType) {
  trackAdShow(rewardType);
  adPendingReward = rewardType;
  adLastShownTime = Date.now();
  adDeathCount = 0;
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'showAd', rewardType }));
  }
}

function shareScore(text, imageDataUrl) {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'share',
      text,
      image: imageDataUrl || null,
    }));
  }
}

function captureAndShare(text) {
  trackShare('death_or_complete');
  try {
    const dataUrl = canvas.toDataURL('image/png');
    shareScore(text, dataUrl);
  } catch (e) {
    shareScore(text, null);
  }
}

function getEventContext(params) {
  const charIdx = typeof safeSelectedChar === 'function' ? safeSelectedChar() : (save.selectedChar || 0);
  const char = CHARS[charIdx] || null;
  const base = {
    biome: G.levelDef && G.levelDef.theme ? G.levelDef.theme : null,
    character: char ? char.id : null,
    daily_challenge: !!G.dailyChallenge,
    endless_mode: !!G.endless,
    level: Number.isFinite(G.levelNum) ? G.levelNum : null,
    phase: G.phase || null,
    run_gems: Number.isFinite(G.runGems) ? G.runGems : 0,
    run_score: Number.isFinite(G.runScore) ? G.runScore : 0,
  };
  return Object.assign(base, params || {});
}

function logEvent(eventName, params) {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'analytics',
      event: eventName,
      params: getEventContext(params),
    }));
  }
}

function trackLevelStart(levelNum) { logEvent('level_start', { level: levelNum }); }
function trackLevelComplete(levelNum, score, stars, timeLeft) {
  logEvent('level_complete', {
    level: levelNum,
    score: score,
    stars: stars,
    time_left: Math.round(timeLeft),
  });
}
function trackDeath(levelNum, cause, score) {
  logEvent('death', { level: levelNum, cause: cause || 'unknown', score: score });
}
function trackAdShow(rewardType) { logEvent('ad_show', { reward_type: rewardType }); }
function trackPurchase(itemId, cost) { logEvent('shop_purchase', { item: itemId, cost: cost }); }
function trackAchievement(achId) { logEvent('achievement_unlocked', { achievement: achId }); }
function trackSessionStart() { logEvent('session_start', { highest_level: save.highestLevel, total_gems: save.totalGems }); }
function trackShare(context) { logEvent('share', { context: context }); }
function trackTutorialStep(step, params) { logEvent('tutorial_step', Object.assign({ step: step }, params || {})); }
function trackTutorialComplete() { logEvent('tutorial_complete', { tutorial_seen: true }); }
function trackContinueOffer() { logEvent('continue_offer', { continues_left: G.continuesLeft }); }
function trackRetry(source) { logEvent('retry', { retry_source: source || 'unknown' }); }
function trackNextLevel(levelNum) { logEvent('next_level', { next_level: levelNum }); }
function trackPhaseView(phase) {
  switch (phase) {
    case 'MENU':
      logEvent('menu_view');
      break;
    case 'LEVEL_MAP':
      logEvent('map_view');
      break;
    case 'CHAR_SELECT':
      logEvent('char_select_view');
      break;
    case 'CONTINUE_PROMPT':
      trackContinueOffer();
      break;
    case 'TUTORIAL':
      trackTutorialStep('tutorial_modal');
      break;
  }
}

function haptic(pattern) {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'haptic', pattern: pattern }));
  }
}

function checkAdReady() {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'checkAd' }));
  }
}

function handleNativeMessage(event) {
  try {
    const rawData = event && event.data !== undefined ? event.data : event;
    const msg = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'adReady') {
      adReady = !!msg.ready;
    } else if (msg.type === 'adRewarded') {
      if (msg.rewardType === 'continue') {
        adGrantContinue();
      } else if (msg.rewardType === 'doubleGems') {
        adGrantDoubleGems();
      }
    } else if (msg.type === 'adNotReady' || msg.type === 'adError') {
      adReady = false;
    } else if (msg.type === 'backButton') {
      handleBackButton();
    }
  } catch (ex) {}
}

window.addEventListener('message', handleNativeMessage);
document.addEventListener('message', handleNativeMessage);

function adGrantContinue() {
  G.phase = 'LEVEL_INTRO';
  G.introTimer = 0;
  G.time = 0;
  G.timeLeft = 28;
  G.deathDelay = 0;
  G.diff = getDiff(0, getLevelOpeningMultiplier(G.levelDef));
  G.speed = G.diff.speed * CHARS[G.selectedChar].spdM;
  G.rng = new RNG(Date.now() ^ (Math.random() * 0x7FFFFFFF | 0));
  G.announce = { text: 'AD CONTINUE!', life: 2 };
  G.flashColor = null;
  G.flashLife = 0;
  inp.jp = false;
  inp.jh = false;
  inp.tapped = false;
  particles.length = 0;
  activeEnemies.length = 0;
  ambients.length = 0;
  trauma = 0;
  enemySpawnCD = getLevelEnemyDelay(G.levelDef);
  initWorld(G.rng, G.diff, G.levelDef.theme);
  G.player = new Player(G.selectedChar);
  checkGemUpgrades(true);
  if (G.wheelResult) applyWheelPowerup(G.wheelResult);
  initBg();
}

function handleBackButton() {
  switch (G.phase) {
    case 'PLAYING':
      G.phase = 'PAUSED';
      break;
    case 'PAUSED':
      G.phase = 'LEVEL_MAP';
      break;
    case 'SETTINGS':
      G.phase = G._settingsReturnPhase || 'LEVEL_MAP';
      break;
    case 'MISSIONS':
    case 'STATS':
    case 'SHOP':
    case 'SKINS':
    case 'TUTORIAL':
    case 'CHAR_SELECT':
    case 'DEATH':
    case 'DEAD':
    case 'DAILY_REWARD':
      G.phase = 'LEVEL_MAP';
      break;
    case 'LEVEL_MAP':
      G.phase = 'MENU';
      break;
    case 'MENU':
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'exitApp' }));
      }
      break;
    default:
      G.phase = 'MENU';
      break;
  }
}

function adGrantDoubleGems() {
  if (!adDoubleGemsUsed) {
    const bonus = G.runGems;
    save.totalGems += bonus;
    adDoubleGemsUsed = true;
    G.announce = { text: `+${bonus} BONUS GEMS!`, life: 2.5 };
    persistSave();
  }
}

// ============================================================
// TUTORIAL TOOLTIPS
// ============================================================
const TUTORIAL_TIPS = [
  { level: 1, delay: 0.5, text: 'Swipe UP to jump!', duration: 4, icon: 'up' },
  { level: 1, delay: 6, text: 'Swipe RIGHT to dash forward!', duration: 4, icon: 'right' },
  { level: 1, delay: 12, text: 'Collect gems for powerups!', duration: 3.5, icon: 'gem' },
  { level: 2, delay: 1, text: 'Swipe DOWN to slide under obstacles!', duration: 4, icon: 'down' },
  { level: 2, delay: 7, text: 'Stomp DOWN in the air to ground pound!', duration: 4, icon: 'down' },
  { level: 3, delay: 1, text: 'Enemies have HP - attack them!', duration: 4, icon: 'right' },
  { level: 3, delay: 7, text: 'Dash INTO enemies to deal damage!', duration: 4, icon: 'right' },
  { level: 4, delay: 1, text: 'Watch for red \"!\" - enemy attacking!', duration: 4, icon: 'warn' },
  { level: 4, delay: 7, text: 'Dash into projectiles to parry them!', duration: 4, icon: 'right' },
  { level: 5, delay: 1, text: 'BOSS FIGHT! Attack it to win!', duration: 4, icon: 'warn' },
  { level: 1, delay: 18, text: 'Near-misses give bonus combo points!', duration: 3.5 },
  { level: 6, delay: 1, text: 'Try different characters in the menu!', duration: 4 },
];

let tooltipState = { active: false, text: '', timer: 0, alpha: 0, queue: [], icon: '' };

const GUIDED_LEVELS = {
  1: {
    header: 'LESSON 1 OF 3',
    title: 'Jump + dash',
    intro: 'Learn the lane first: jump cleanly, then dash to steal space back.',
    rewardHint: 'Healthy clears plus most gems earn the best star rating.',
    mapHint: 'Start with the two core movement verbs.',
    afterClear: 'Next lesson: slide low hazards and stomp down from the air.',
    cta: 'START LEVEL 1',
    steps: [
      { action: 'jump', short: 'JUMP', label: 'Jump once', remind: 'Swipe UP to clear the first ridge.', accent: '#66B3FF', completeText: 'JUMP LOCKED IN' },
      { action: 'dash', short: 'DASH', label: 'Dash once', remind: 'Swipe RIGHT when the lane tightens.', accent: '#7FFFD4', completeText: 'DASH LOCKED IN' },
    ],
  },
  2: {
    header: 'LESSON 2 OF 3',
    title: 'Slide + stomp',
    intro: 'Stay low under ground hazards, then spike back down when you are airborne.',
    rewardHint: 'Level 2 is about lane reading, not raw speed. Stay calm and stay centered.',
    mapHint: 'Practice low hazards and air recovery.',
    afterClear: 'Next lesson: dash through enemies instead of only dodging them.',
    cta: 'START LEVEL 2',
    steps: [
      { action: 'slide', short: 'SLIDE', label: 'Slide once', remind: 'Swipe DOWN on the ground to duck under danger.', accent: '#F5B14B', completeText: 'SLIDE LOCKED IN' },
      { action: 'pound', short: 'STOMP', label: 'Ground pound once', remind: 'Swipe DOWN in the air to slam back to the lane.', accent: '#FF8D5A', completeText: 'STOMP LOCKED IN' },
    ],
  },
  3: {
    header: 'LESSON 3 OF 3',
    title: 'Dash through enemies',
    intro: 'Enemies are part of the lane. Burst through one while dashing instead of giving up space.',
    rewardHint: 'Once this clicks, missions, new runners, and later biomes start opening up.',
    mapHint: 'Learn offensive dash timing.',
    afterClear: 'After this, use missions, login rewards, and runners to shape the next run.',
    cta: 'START LEVEL 3',
    steps: [
      { action: 'dash', short: 'DASH', label: 'Dash once', remind: 'Swipe RIGHT before the first enemy closes in.', accent: '#7FFFD4', completeText: 'DASH READY' },
      { action: 'dash_hit', short: 'HIT', label: 'Dash through one enemy', remind: 'Stay committed and hit an enemy while the dash glow is active.', accent: '#FF8B72', completeText: 'ENEMY BROKEN' },
    ],
  },
};

const GUIDED_CHUNK_PLANS = {
  1: [
    { type: 'GEM_RUN', allowObstacles: false, allowPteros: false },
    { type: 'FLAT', allowObstacles: false, allowPteros: false },
    { type: 'RIDGE', allowObstacles: false, allowPteros: false },
    { type: 'FLAT', allowObstacles: false, allowPteros: false },
    { type: 'GEM_RUN', allowObstacles: false, allowPteros: false },
    { type: 'RIDGE', allowObstacles: false, allowPteros: false },
    { type: 'FLAT', allowObstacles: false, allowPteros: false },
    { type: 'GEM_RUN', allowObstacles: false, allowPteros: false },
  ],
  2: [
    { type: 'GEM_RUN', allowObstacles: false, allowPteros: false },
    { type: 'FLAT', allowObstacles: false, allowPteros: false },
    { type: 'VALLEY', allowObstacles: false, allowPteros: false },
    { type: 'FLAT', allowObstacles: false, allowPteros: false },
    { type: 'RIDGE', allowObstacles: false, allowPteros: false },
    { type: 'FLAT', allowObstacles: false, allowPteros: false },
    { type: 'VALLEY', allowObstacles: false, allowPteros: false },
    { type: 'GEM_RUN', allowObstacles: false, allowPteros: false },
    { type: 'FLAT', allowObstacles: false, allowPteros: false },
  ],
  3: [
    { type: 'GEM_RUN', allowObstacles: false, allowPteros: false },
    { type: 'FLAT', allowObstacles: false, allowPteros: false },
    { type: 'FLAT', allowObstacles: false, allowPteros: false },
    { type: 'RIDGE', allowObstacles: false, allowPteros: false },
    { type: 'GEM_RUN', allowObstacles: false, allowPteros: false },
    { type: 'FLAT', allowObstacles: false, allowPteros: false },
    { type: 'VALLEY', allowObstacles: false, allowPteros: false },
    { type: 'FLAT', allowObstacles: false, allowPteros: false },
    { type: 'GEM_RUN', allowObstacles: false, allowPteros: false },
  ],
};

function getGuidedLevel(levelNum) {
  return GUIDED_LEVELS[levelNum] || null;
}

function shouldRunGuidedLevel(levelNum) {
  if (levelNum > 3) return false;
  if (typeof G === 'undefined') return false;
  if (G.endless || G.dailyChallenge) return false;
  return save.highestLevel < 3;
}

function configureGuidedLevel(levelNum) {
  const guide = getGuidedLevel(levelNum);
  if (!guide || !shouldRunGuidedLevel(levelNum)) {
    G.onboarding = null;
    return null;
  }
  G.onboarding = {
    level: levelNum,
    header: guide.header,
    title: guide.title,
    intro: guide.intro,
    rewardHint: guide.rewardHint,
    mapHint: guide.mapHint,
    afterClear: guide.afterClear,
    cta: guide.cta,
    completed: false,
    completedAt: 0,
    steps: guide.steps.map(function(step) {
      return {
        action: step.action,
        short: step.short,
        label: step.label,
        remind: step.remind,
        accent: step.accent,
        completeText: step.completeText,
        done: false,
      };
    }),
  };
  return G.onboarding;
}

function getGuidedPendingStep() {
  const guide = G.onboarding;
  if (!guide || !Array.isArray(guide.steps)) return null;
  for (let i = 0; i < guide.steps.length; i++) {
    if (!guide.steps[i].done) return guide.steps[i];
  }
  return null;
}

function noteGuidedAction(action, params) {
  const guide = G.onboarding;
  if (!guide || guide.level !== G.levelNum || G.phase !== 'PLAYING') return false;

  let matched = null;
  for (let i = 0; i < guide.steps.length; i++) {
    const step = guide.steps[i];
    if (!step.done && step.action === action) {
      step.done = true;
      matched = step;
      break;
    }
  }
  if (!matched) return false;

  showAnnouncement(matched.completeText || matched.label.toUpperCase(), matched.accent || '#FFD700');
  trackTutorialStep('guided_' + action, Object.assign({
    guided_level: guide.level,
    guided_title: guide.title,
  }, params || {}));

  if (!getGuidedPendingStep()) {
    guide.completed = true;
    guide.completedAt = G.time || 0;
    showAnnouncement('LESSON CLEAR', '#7DF09B');
    trackTutorialStep('guided_level_complete', {
      guided_level: guide.level,
      guided_title: guide.title,
    });
  }
  return true;
}

function getGuidedGoalForLevel(levelNum) {
  const guide = getGuidedLevel(levelNum);
  if (!guide || !shouldRunGuidedLevel(levelNum)) return null;
  return guide;
}

function getUpcomingGuidedGoal(levelNum) {
  return getGuidedGoalForLevel(levelNum);
}

function getPostLevelGuidance(levelNum) {
  const guide = G.onboarding && G.onboarding.level === levelNum ? G.onboarding : getGuidedGoalForLevel(levelNum);
  if (guide && guide.afterClear) return guide.afterClear;
  const nextGuide = getUpcomingGuidedGoal(levelNum + 1);
  return nextGuide ? nextGuide.mapHint : '';
}

function getUnclaimedMissionCount() {
  const daily = save.missions && save.missions.daily || [];
  const weekly = save.missions && save.missions.weekly || [];
  let count = 0;
  for (let i = 0; i < daily.length; i++) {
    const mission = daily[i];
    if (!mission.claimed && (mission.progress || 0) >= mission.target) count++;
  }
  for (let i = 0; i < weekly.length; i++) {
    const mission = weekly[i];
    if (!mission.claimed && (mission.progress || 0) >= mission.target) count++;
  }
  return count;
}

function getRewardReadyHint(levelNum) {
  const unclaimed = getUnclaimedMissionCount();
  if (!unclaimed || G.endless || G.dailyChallenge) return '';
  if (levelNum > 3 && save.highestLevel > 3) return '';
  return unclaimed === 1
    ? 'Mission reward ready - open missions for bonus gems.'
    : `${unclaimed} mission rewards ready - open missions for bonus gems.`;
}

function shouldUseGuidedChunkPlan() {
  return !!(G.onboarding && G.onboarding.level === G.levelNum && !G.endless && !G.dailyChallenge);
}

function getGuidedChunkSpec(levelNum, index) {
  const plan = GUIDED_CHUNK_PLANS[levelNum];
  if (!plan || index < 0 || index >= plan.length) return null;
  const spec = plan[index];
  return typeof spec === 'string' ? { type: spec } : Object.assign({}, spec);
}

function triggerLevelTooltips(levelNum) {
  tooltipState.queue = [];
  tooltipState.active = false;
  tooltipState.alpha = 0;
  tooltipState.icon = '';
  if (getGuidedGoalForLevel(levelNum)) return;
  if (save.highestLevel > levelNum + 2) return;
  const tips = TUTORIAL_TIPS.filter(function(t) { return t.level === levelNum; });
  for (let i = 0; i < tips.length; i++) {
    tooltipState.queue.push({
      level: tips[i].level,
      text: tips[i].text,
      delay: tips[i].delay,
      duration: tips[i].duration,
      icon: tips[i].icon || '',
    });
  }
}

function updateTooltip(dt) {
  if (tooltipState.active) {
    tooltipState.timer -= dt;
    if (tooltipState.timer <= 0) {
      tooltipState.active = false;
    } else {
      tooltipState.alpha = Math.min(1, tooltipState.alpha + dt * 4);
    }
    if (tooltipState.timer < 0.5) tooltipState.alpha = Math.max(0, tooltipState.timer * 2);
  } else if (tooltipState.queue.length > 0) {
    const next = tooltipState.queue[0];
    next.delay -= dt;
    if (next.delay <= 0) {
      tooltipState.queue.shift();
      tooltipState.active = true;
      tooltipState.text = next.text;
      tooltipState.timer = next.duration;
      tooltipState.alpha = 0;
      tooltipState.icon = next.icon || '';
      trackTutorialStep(next.text, {
        tip_icon: next.icon || '',
        tutorial_level: next.level || G.levelNum || 1,
      });
    }
  }
}

function drawTooltip() {
  if (!tooltipState.active || tooltipState.alpha <= 0) return;
  const u = UNIT;
  const compact = W < 1100 || H < 560;
  const a = tooltipState.alpha;
  ctx.font = `bold ${u * (compact ? 0.36 : 0.42)}px monospace`;
  const tw = ctx.measureText(tooltipState.text).width;
  const padX = u * (compact ? 0.44 : 0.55);
  const bw = Math.min(W - SAFE_LEFT - SAFE_RIGHT - u * 1.3, tw + padX * 2 + u * 1.0);
  const bh = u * (compact ? 0.82 : 0.92);
  const bx = W / 2 - bw / 2;
  const by = Math.max(SAFE_TOP + u * 3.05, H * (compact ? 0.29 : 0.25));

  ctx.save();
  ctx.globalAlpha = a * 0.9;
  fillRR(bx, by, bw, bh, u * 0.26, 'rgba(8,12,22,0.9)', 'rgba(255,215,0,0.58)', 2);
  ctx.globalAlpha = a;

  const icon = tooltipState.icon || '';
  if (icon) {
    const arrowX = bx + u * 0.62;
    const arrowY = by + bh / 2;
    const bounce = Math.sin((G.time || 0) * 6) * u * 0.12;
    ctx.fillStyle = '#FFD700';
    ctx.strokeStyle = '#FFD700';
    ctx.lineWidth = u * 0.06;
    ctx.lineCap = 'round';
    if (icon === 'up') {
      ctx.beginPath(); ctx.moveTo(arrowX, arrowY + bounce - u * 0.17); ctx.lineTo(arrowX - u * 0.17, arrowY + bounce + u * 0.12); ctx.lineTo(arrowX + u * 0.17, arrowY + bounce + u * 0.12); ctx.closePath(); ctx.fill();
    } else if (icon === 'down') {
      ctx.beginPath(); ctx.moveTo(arrowX, arrowY - bounce + u * 0.17); ctx.lineTo(arrowX - u * 0.17, arrowY - bounce - u * 0.12); ctx.lineTo(arrowX + u * 0.17, arrowY - bounce - u * 0.12); ctx.closePath(); ctx.fill();
    } else if (icon === 'right') {
      ctx.beginPath(); ctx.moveTo(arrowX + bounce + u * 0.17, arrowY); ctx.lineTo(arrowX + bounce - u * 0.12, arrowY - u * 0.17); ctx.lineTo(arrowX + bounce - u * 0.12, arrowY + u * 0.17); ctx.closePath(); ctx.fill();
    } else if (icon === 'gem') {
      ctx.beginPath(); ctx.moveTo(arrowX, arrowY - u * 0.2 + bounce * 0.5); ctx.lineTo(arrowX + u * 0.12, arrowY - u * 0.04); ctx.lineTo(arrowX + u * 0.12, arrowY + u * 0.08); ctx.lineTo(arrowX, arrowY + u * 0.2); ctx.lineTo(arrowX - u * 0.12, arrowY + u * 0.08); ctx.lineTo(arrowX - u * 0.12, arrowY - u * 0.04); ctx.closePath(); ctx.fill();
    } else if (icon === 'warn') {
      ctx.font = `bold ${u * 0.54}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FF4444';
      ctx.fillText('!', arrowX, arrowY + bounce * 0.5);
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${u * (compact ? 0.42 : 0.48)}px monospace`;
  ctx.fillStyle = '#FFD700';
  ctx.fillText(tooltipState.text, W / 2, by + bh / 2);
  ctx.restore();
}

// ============================================================
// CHARACTER DATA
// ============================================================
const CHARS = [
  { id:'gronk', name:'Gronk', desc:'Balanced (HP:100)',
    col:'#7EC8EC', dk:'#4A9ABE', jumpV:-800, jumpV2:-640, grav:2000,
    spdM:1, hitM:1, startShield:false, startGems:0, sc:1, maxHP:100 },
  { id:'pip', name:'Pip', desc:'Agile (HP:70)',
    col:'#F4C542', dk:'#B89020', jumpV:-960, jumpV2:-790, grav:2300,
    spdM:1.05, hitM:0.72, startShield:false, startGems:0, sc:0.75, maxHP:70 },
  { id:'bruk', name:'Bruk', desc:'Tank (HP:150)',
    col:'#A06840', dk:'#6A4020', jumpV:-720, jumpV2:-580, grav:1800,
    spdM:0.93, hitM:1.25, startShield:true, startGems:0, sc:1.2, maxHP:150 },
  { id:'zara', name:'Zara', desc:'Fast (HP:80, +5 gems)',
    col:'#CC55DD', dk:'#882299', jumpV:-770, jumpV2:-620, grav:2100,
    spdM:1.12, hitM:0.88, startShield:false, startGems:5, sc:1, maxHP:80 },
  { id:'rex', name:'Rex', desc:'Speed (HP:60)',
    col:'#FF5544', dk:'#BB2211', jumpV:-850, jumpV2:-700, grav:2400,
    spdM:1.2, hitM:0.65, startShield:false, startGems:0, sc:0.7, maxHP:60 },
  { id:'mog', name:'Mog', desc:'Mystic (HP:90, magnet)',
    col:'#44BBAA', dk:'#228877', jumpV:-780, jumpV2:-630, grav:1900,
    spdM:0.97, hitM:1, startShield:false, startGems:0, sc:1.05, startMagnet:true, maxHP:90 },
];

// ============================================================
// SPRITE SHEET SYSTEM
// ============================================================
// SPRITE SYSTEM (unified for all characters)
// ============================================================
const SPRITE_COLS = 8, SPRITE_ROWS = 2;
const SPRITE_FRAMES = {
  run: [0,1,2,3,4,5],
  wave: 6, worried: 7,
  slide: 8, crouch: 9, jump: 10, idle: 11,
  dash: 12, hit: 13, idleStand: 14, idleBlink: 15
};
const SPRITE_RUN_FPS = 5;
const ENEMY_SPRITES_ENABLED = true;

var SPRITE_B64 = typeof window.SPRITE_B64 === 'object' ? window.SPRITE_B64 : {};

var charSprites = {};
['gronk', 'pip', 'bruk', 'zara', 'rex', 'mog'].forEach(function(id) {
  charSprites[id] = {
    ready: false,
    loading: false,
    blocked: false,
    frames: null,
    fw: 0,
    fh: 0
  };
});

function getSpriteBackgroundColor(pixels, width, height) {
  var samples = [
    0,
    (width - 1) * 4,
    ((height - 1) * width) * 4,
    (((height - 1) * width) + (width - 1)) * 4
  ];
  var sumR = 0, sumG = 0, sumB = 0, sumA = 0;
  for (var si = 0; si < samples.length; si++) {
    var idx = samples[si];
    sumR += pixels[idx];
    sumG += pixels[idx + 1];
    sumB += pixels[idx + 2];
    sumA += pixels[idx + 3];
  }
  return {
    r: Math.round(sumR / samples.length),
    g: Math.round(sumG / samples.length),
    b: Math.round(sumB / samples.length),
    a: Math.round(sumA / samples.length)
  };
}

function initCharSprite(charId) {
  var sprite = charSprites[charId];
  if (!sprite || sprite.loading || sprite.ready) return;
  sprite.loading = true;

  var b64 = SPRITE_B64[charId];
  if (!b64) {
    console.warn('No sprite data for ' + charId);
    sprite.loading = false;
    sprite.blocked = true;
    return;
  }

  var img = new Image();
  img.onload = function() {
    var fw = Math.floor(img.width / SPRITE_COLS);
    var fh = Math.floor(img.height / SPRITE_ROWS);
    var tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    var tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0);

    var imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    var pixels = imageData.data;
    var bg = getSpriteBackgroundColor(pixels, tempCanvas.width, tempCanvas.height);
    var tolerance = 42;

    if (bg.a > 200) {
      for (var i = 0; i < pixels.length; i += 4) {
        if (
          Math.abs(pixels[i] - bg.r) < tolerance &&
          Math.abs(pixels[i + 1] - bg.g) < tolerance &&
          Math.abs(pixels[i + 2] - bg.b) < tolerance
        ) {
          pixels[i + 3] = 0;
        }
      }
    }

    tempCtx.putImageData(imageData, 0, 0);
    sprite.frames = [];
    sprite.fw = fw;
    sprite.fh = fh;

    for (var row = 0; row < SPRITE_ROWS; row++) {
      for (var col = 0; col < SPRITE_COLS; col++) {
        var frameCanvas = document.createElement('canvas');
        frameCanvas.width = fw;
        frameCanvas.height = fh;
        var frameCtx = frameCanvas.getContext('2d');
        frameCtx.drawImage(tempCanvas, col * fw, row * fh, fw, fh, 0, 0, fw, fh);
        sprite.frames.push(frameCanvas);
      }
    }

    sprite.ready = true;
    sprite.loading = false;
  };

  img.onerror = function() {
    console.warn('Sprite load failed for ' + charId);
    sprite.loading = false;
    sprite.blocked = true;
  };

  img.src = b64;
}

function getSpriteFrame(player, mini) {
  if (mini) return SPRITE_FRAMES.idleStand;
  if (player.hpFlash > 0 && Math.sin(player.hpFlash * 30) > 0) return SPRITE_FRAMES.hit;
  if (player.dashTimer > 0) return SPRITE_FRAMES.dash;
  if (player.slideTimer > 0) return SPRITE_FRAMES.slide;
  if (player.pounding) return SPRITE_FRAMES.crouch;
  if (!player.onGround && player.vy < 0) return SPRITE_FRAMES.jump;
  if (!player.onGround && player.vy >= 0) return SPRITE_FRAMES.crouch;

  var runFrames = SPRITE_FRAMES.run;
  var idx = Math.floor(player.legAnim * SPRITE_RUN_FPS / (2 * Math.PI) * runFrames.length) % runFrames.length;
  return runFrames[Math.abs(idx) % runFrames.length];
}

// ============================================================
// COSMETIC SKINS
// ============================================================
const SKINS = {
  gronk: [
    { id: 'gronk_default', name: 'Classic', col: '#7EC8EC', dk: '#4A9ABE', cost: 0 },
    { id: 'gronk_golden', name: 'Golden', col: '#FFD700', dk: '#B8960F', cost: 80, trail: 'gold' },
    { id: 'gronk_shadow', name: 'Shadow', col: '#3A3A5C', dk: '#1A1A2E', cost: 120, trail: 'shadow' },
    { id: 'gronk_neon', name: 'Neon', col: '#00FF88', dk: '#009955', cost: 200, trail: 'neon' },
    { id: 'gronk_streak', name: 'Streak', col: '#FF4488', dk: '#CC1155', cost: 0, trail: 'flame', exclusive: true },
  ],
  pip: [
    { id: 'pip_default', name: 'Classic', col: '#F4C542', dk: '#B89020', cost: 0 },
    { id: 'pip_bubblegum', name: 'Bubblegum', col: '#FF88CC', dk: '#CC5599', cost: 80, trail: 'sparkle' },
    { id: 'pip_arctic', name: 'Arctic', col: '#88DDFF', dk: '#4499CC', cost: 120, trail: 'frost' },
    { id: 'pip_solar', name: 'Solar', col: '#FF6622', dk: '#CC3300', cost: 200, trail: 'flame' },
  ],
  bruk: [
    { id: 'bruk_default', name: 'Classic', col: '#A06840', dk: '#6A4020', cost: 0 },
    { id: 'bruk_iron', name: 'Iron', col: '#8899AA', dk: '#556677', cost: 80, trail: 'sparks' },
    { id: 'bruk_magma', name: 'Magma', col: '#FF4400', dk: '#AA2200', cost: 120, trail: 'flame' },
    { id: 'bruk_jade', name: 'Jade', col: '#44BB77', dk: '#228855', cost: 200, trail: 'neon' },
  ],
  zara: [
    { id: 'zara_default', name: 'Classic', col: '#CC55DD', dk: '#882299', cost: 0 },
    { id: 'zara_crystal', name: 'Crystal', col: '#AADDFF', dk: '#6699CC', cost: 80, trail: 'frost' },
    { id: 'zara_void', name: 'Void', col: '#6633AA', dk: '#331166', cost: 120, trail: 'shadow' },
    { id: 'zara_cherry', name: 'Cherry', col: '#FF3366', dk: '#CC1144', cost: 200, trail: 'sparkle' },
  ],
  rex: [
    { id: 'rex_default', name: 'Classic', col: '#FF5544', dk: '#BB2211', cost: 0 },
    { id: 'rex_electric', name: 'Electric', col: '#44DDFF', dk: '#1199CC', cost: 80, trail: 'neon' },
    { id: 'rex_inferno', name: 'Inferno', col: '#FF8800', dk: '#CC5500', cost: 120, trail: 'flame' },
    { id: 'rex_phantom', name: 'Phantom', col: '#BB99FF', dk: '#7744CC', cost: 200, trail: 'shadow' },
  ],
  mog: [
    { id: 'mog_default', name: 'Classic', col: '#44BBAA', dk: '#228877', cost: 0 },
    { id: 'mog_aurora', name: 'Aurora', col: '#77FF99', dk: '#33BB66', cost: 80, trail: 'sparkle' },
    { id: 'mog_ember', name: 'Ember', col: '#FF6644', dk: '#CC3322', cost: 120, trail: 'flame' },
    { id: 'mog_cosmic', name: 'Cosmic', col: '#8855FF', dk: '#5522CC', cost: 200, trail: 'neon' },
  ],
};

const SKIN_TRAILS = {
  gold: { colors: ['#FFD700', '#FFAA00', '#FF8800'], size: 0.12 },
  shadow: { colors: ['#3A3A5C', '#1A1A2E', '#000000'], size: 0.1 },
  neon: { colors: ['#00FF88', '#00FFCC', '#88FFFF'], size: 0.14 },
  sparkle: { colors: ['#FFFFFF', '#FFDDEE', '#FFD700'], size: 0.08 },
  frost: { colors: ['#AADDFF', '#88CCFF', '#FFFFFF'], size: 0.1 },
  flame: { colors: ['#FF4400', '#FF8800', '#FFCC00'], size: 0.12 },
  sparks: { colors: ['#FFDD44', '#FF8844', '#FFFFFF'], size: 0.08 },
};

function getCharSkins(charId) {
  return SKINS[charId] || [];
}

function getActiveSkin(charId) {
  const skinId = save.activeSkins && save.activeSkins[charId];
  const skins = getCharSkins(charId);
  if (skinId) {
    const match = skins.find(function(skin) { return skin.id === skinId; });
    if (match) return match;
  }
  return skins[0] || null;
}

function ownsSkin(skinId) {
  return save.ownedSkins && save.ownedSkins.includes(skinId);
}

function buySkin(skinId, charId) {
  const skins = getCharSkins(charId);
  const skin = skins.find(function(entry) { return entry.id === skinId; });
  if (!skin || skin.cost === 0 || ownsSkin(skinId)) return false;
  if (save.totalGems < skin.cost) return false;
  save.totalGems -= skin.cost;
  if (!save.ownedSkins) save.ownedSkins = [];
  save.ownedSkins.push(skinId);
  save.activeSkins[charId] = skinId;
  trackPurchase(`skin_${skinId}`, skin.cost);
  persistSave();
  return true;
}

function equipSkin(skinId, charId) {
  save.activeSkins[charId] = skinId;
  persistSave();
}

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
  var alpha = _announceTimer > 1.2 ? clamp((_announceTimer - 1.2) / 0.3, 0, 1) : _announceTimer < 0.3 ? _announceTimer / 0.3 : 1;
  var scale = _announceTimer > 1.2 ? 1.15 - (_announceTimer - 1.2) * 0.28 : 1;
  var bannerY = tooltipState && tooltipState.active ? H * 0.46 : H * 0.38;

  ctx.save();
  ctx.globalAlpha = alpha * 0.92;
  ctx.translate(W / 2, bannerY);
  ctx.scale(scale, scale);
  ctx.font = FONTS['b0.52'] || ('bold ' + Math.round(u * 0.52) + 'px monospace');
  var bannerW = clamp(ctx.measureText(_announceText).width + u * 1.4, u * 4.8, u * 9.8);
  var bannerH = u * 1.08;
  drawPanel(-bannerW / 2, -bannerH / 2, bannerW, bannerH, {
    radius: u * 0.28,
    top: 'rgba(18,28,46,0.96)',
    bottom: 'rgba(8,12,22,0.94)',
    stroke: 'rgba(255,255,255,0.08)',
    accent: _announceColor,
    blur: 16
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = _announceColor;
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 8;
  ctx.fillText(_announceText, 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();
}

var floatingTexts = [];

function spawnFloatingText(x, y, text, color, size) {
  floatingTexts.push({
    x: x,
    y: y,
    text: text,
    color: color || '#FFD700',
    size: size || 1,
    life: 1.0,
    vy: -120,
    vx: (Math.random() - 0.5) * 40,
  });
}

function updateFloatingTexts(dt) {
  for (var i = floatingTexts.length - 1; i >= 0; i--) {
    var item = floatingTexts[i];
    item.y += item.vy * dt;
    item.x += item.vx * dt;
    item.vy += 200 * dt;
    item.life -= dt * 1.5;
    if (item.life <= 0) floatingTexts.splice(i, 1);
  }
}

function drawFloatingTexts() {
  for (var i = 0; i < floatingTexts.length; i++) {
    var item = floatingTexts[i];
    var life = clamp(item.life, 0, 1);
    var riseScale = 1 + (1 - life) * 0.18;
    ctx.globalAlpha = life;
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.scale(riseScale, riseScale);
    ctx.font = 'bold ' + Math.round(UNIT * 0.54 * item.size) + 'px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, UNIT * 0.05 * item.size);
    ctx.strokeStyle = 'rgba(8,10,16,0.55)';
    ctx.strokeText(item.text, 0, 0);
    ctx.fillStyle = item.color;
    ctx.shadowColor = 'rgba(255,255,255,0.28)';
    ctx.shadowBlur = 4;
    ctx.fillText(item.text, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function triggerSlowMo(duration) {
  _slowMoTimer = duration || 0.15;
  _slowMoFactor = 0.3;
}

function updateSlowMo(dt) {
  if (_slowMoTimer > 0) {
    _slowMoTimer -= dt;
    _slowMoFactor = 0.3;
  } else {
    _slowMoFactor = 1;
  }
}

// ============================================================
// LEVEL DATA  (5 unique themes, then repeat harder)
// ============================================================
const LEVEL_DEFS = [
  { name:'Jungle Ruins',   theme:'JUNGLE',  targetTime:36, enemies:[], paceScale:0.88, enemyDelay:999, focus:'Jump + dash' },
  { name:'Volcanic Caves', theme:'VOLCANO', targetTime:44, enemies:[], paceScale:0.98, enemyDelay:999, focus:'Slide + stomp' },
  { name:'Glacier Peaks',  theme:'GLACIER', targetTime:54, enemies:['SERPENT'], paceScale:1.08, enemyDelay:8.5, focus:'Dash through enemies' },
  { name:'Murky Swamp',    theme:'SWAMP',   targetTime:75, enemies:['TROLL','WITCH','SERPENT','GOLEM'], focus:'Pressure and route reading' },
  { name:'Sky Sanctuary',  theme:'SKY',     targetTime:85, enemies:['DIVER','WITCH','CHARGER','BOMBER'], focus:'Fast reactions and air space' },
];

function getLevelDef(n) {
  const idx = (n - 1) % LEVEL_DEFS.length;
  const d = { ...LEVEL_DEFS[idx], id: n };
  const cycle = Math.floor((n - 1) / LEVEL_DEFS.length);
  d.targetTime = Math.round(d.targetTime * (1 + cycle * 0.3));
  if (cycle > 0) { const numerals = ['II','III','IV','V','VI','VII','VIII','IX','X']; d.name = d.name + ' ' + (cycle <= numerals.length ? numerals[cycle - 1] : 'C' + (cycle + 1)); }
  if (cycle >= 1 && !d.enemies.includes('BOMBER')) d.enemies = [...d.enemies, 'BOMBER'];
  if (cycle >= 2 && !d.enemies.includes('WITCH')) d.enemies = [...d.enemies, 'WITCH'];
  return d;
}

function getLevelOpeningMultiplier(levelDef) {
  if (levelDef && Number.isFinite(levelDef.paceScale)) return levelDef.paceScale;
  return levelDiffMult(levelDef && levelDef.id ? levelDef.id : 1);
}

function getLevelEnemyDelay(levelDef) {
  if (levelDef && Number.isFinite(levelDef.enemyDelay)) return levelDef.enemyDelay;
  return 6;
}

function levelDiffMult(n) {
  return 1 + (n - 1) * 0.2;
}

// ============================================================
// THEME DATA
// ============================================================
const ENV_DECO = {
  JUNGLE: {
    trees: [
      function(c, x, y, u, s) { c.fillStyle = '#1a3a12'; c.beginPath(); c.moveTo(x, y); c.lineTo(x - u * 1.5 * s, y + u * 3 * s); c.lineTo(x + u * 1.5 * s, y + u * 3 * s); c.closePath(); c.fill(); c.fillStyle = '#234a18'; c.beginPath(); c.moveTo(x, y - u * 1.2 * s); c.lineTo(x - u * 1.2 * s, y + u * 1.5 * s); c.lineTo(x + u * 1.2 * s, y + u * 1.5 * s); c.closePath(); c.fill(); c.fillStyle = '#2a1a08'; c.fillRect(x - u * .2 * s, y + u * 2.5 * s, u * .4 * s, u * 1.5 * s); },
      function(c, x, y, u, s) { c.fillStyle = '#2a1a08'; c.fillRect(x - u * .15 * s, y + u * .5 * s, u * .3 * s, u * 2 * s); c.fillStyle = '#1e4a1e'; c.beginPath(); c.arc(x, y, u * 1.2 * s, 0, Math.PI * 2); c.fill(); c.fillStyle = '#2a5a2a'; c.beginPath(); c.arc(x - u * .4 * s, y + u * .3 * s, u * .8 * s, 0, Math.PI * 2); c.fill(); },
      function(c, x, y, u, s) { c.strokeStyle = '#1a5a18'; c.lineWidth = u * .06 * s; c.lineCap = 'round'; for (var f = -2; f <= 2; f++) { c.beginPath(); c.moveTo(x, y + u * 2.5 * s); c.quadraticCurveTo(x + f * u * .7 * s, y + u * s, x + f * u * 1.1 * s, y + u * 1.8 * s); c.stroke(); } },
    ],
    bg: '#0a2010',
    fgPlants: true,
    fg: [
      function(c, x, y, u, s) { c.fillStyle = 'rgba(20,80,15,0.25)'; c.beginPath(); c.moveTo(x - u * s, y); c.quadraticCurveTo(x - u * .3 * s, y - u * 1.5 * s, x, y - u * .2 * s); c.quadraticCurveTo(x + u * .3 * s, y - u * 1.5 * s, x + u * s, y); c.fill(); },
      function(c, x, y, u, s) { c.strokeStyle = 'rgba(30,90,20,0.2)'; c.lineWidth = u * .08 * s; c.lineCap = 'round'; for (var i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x + i * u * .4 * s, y); c.lineTo(x + i * u * .3 * s, y - u * 1.2 * s); c.stroke(); } },
    ],
  },
  VOLCANO: {
    trees: [
      function(c, x, y, u, s) { c.strokeStyle = '#3a2010'; c.lineWidth = u * .2 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y + u * 2.5 * s); c.lineTo(x, y); c.lineTo(x - u * .8 * s, y - u * .5 * s); c.moveTo(x, y + u * .3 * s); c.lineTo(x + u * .6 * s, y - u * .2 * s); c.stroke(); },
      function(c, x, y, u, s) { c.fillStyle = '#4a1a08'; c.beginPath(); c.moveTo(x - u * .6 * s, y + u * 2.5 * s); c.lineTo(x - u * .2 * s, y); c.lineTo(x + u * .3 * s, y + u * .3 * s); c.lineTo(x + u * .7 * s, y + u * 2.5 * s); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,100,0,0.3)'; c.beginPath(); c.moveTo(x - u * .1 * s, y + u * .5 * s); c.lineTo(x + u * .1 * s, y + u * .3 * s); c.lineTo(x + u * .3 * s, y + u * 1.5 * s); c.lineTo(x - u * .2 * s, y + u * 1.5 * s); c.closePath(); c.fill(); },
      function(c, x, y, u, s) { c.fillStyle = '#3a1808'; c.beginPath(); c.ellipse(x, y + u * 2 * s, u * .9 * s, u * .6 * s, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(255,80,0,0.4)'; c.lineWidth = u * .04 * s; c.beginPath(); c.moveTo(x - u * .3 * s, y + u * 1.6 * s); c.lineTo(x, y + u * 2.1 * s); c.lineTo(x + u * .2 * s, y + u * 1.7 * s); c.stroke(); },
    ],
    bg: '#1a0508',
    fgPlants: false,
  },
  GLACIER: {
    trees: [
      function(c, x, y, u, s) { c.fillStyle = 'rgba(160,220,255,0.4)'; c.beginPath(); c.moveTo(x, y - u * s); c.lineTo(x + u * .5 * s, y + u * .5 * s); c.lineTo(x, y + u * 2 * s); c.lineTo(x - u * .5 * s, y + u * .5 * s); c.closePath(); c.fill(); c.fillStyle = 'rgba(200,240,255,0.3)'; c.beginPath(); c.moveTo(x, y - u * s); c.lineTo(x + u * .2 * s, y + u * .3 * s); c.lineTo(x, y + u * 1.5 * s); c.lineTo(x - u * .15 * s, y + u * .3 * s); c.closePath(); c.fill(); },
      function(c, x, y, u, s) { c.fillStyle = '#1a3a4a'; c.beginPath(); c.moveTo(x, y); c.lineTo(x - u * 1.2 * s, y + u * 2.5 * s); c.lineTo(x + u * 1.2 * s, y + u * 2.5 * s); c.closePath(); c.fill(); c.fillStyle = 'rgba(220,240,255,0.5)'; c.beginPath(); c.moveTo(x, y); c.lineTo(x - u * .6 * s, y + u * 1.2 * s); c.lineTo(x + u * .6 * s, y + u * 1.2 * s); c.closePath(); c.fill(); },
      function(c, x, y, u, s) { c.fillStyle = 'rgba(230,245,255,0.35)'; c.beginPath(); c.ellipse(x, y + u * 2.3 * s, u * 1.3 * s, u * .4 * s, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(200,230,250,0.2)'; c.beginPath(); c.ellipse(x + u * .3 * s, y + u * 2.1 * s, u * .6 * s, u * .25 * s, 0, 0, Math.PI * 2); c.fill(); },
    ],
    bg: '#0a1838',
    fgPlants: false,
  },
  SWAMP: {
    trees: [
      function(c, x, y, u, s) { c.strokeStyle = '#2a3a10'; c.lineWidth = u * .25 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y + u * 2.5 * s); c.quadraticCurveTo(x - u * .3 * s, y + u * s, x + u * .2 * s, y); c.stroke(); c.beginPath(); c.moveTo(x + u * .1 * s, y + u * .5 * s); c.quadraticCurveTo(x + u * 1 * s, y - u * .2 * s, x + u * .8 * s, y + u * .3 * s); c.stroke(); c.fillStyle = 'rgba(80,120,40,0.4)'; c.beginPath(); c.arc(x + u * .1 * s, y - u * .2 * s, u * .9 * s, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(100,140,60,0.3)'; c.lineWidth = u * .05 * s; for (var i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + (i - 1) * u * .4 * s, y + u * .1 * s); c.lineTo(x + (i - 1) * u * .4 * s, y + u * 1.2 * s); c.stroke(); } },
      function(c, x, y, u, s) { c.fillStyle = '#4a3a20'; c.fillRect(x - u * .1 * s, y + u * .5 * s, u * .2 * s, u * 1.5 * s); c.fillStyle = '#8a3020'; c.beginPath(); c.ellipse(x, y + u * .5 * s, u * .7 * s, u * .45 * s, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,200,0.4)'; c.beginPath(); c.arc(x - u * .2 * s, y + u * .3 * s, u * .12 * s, 0, Math.PI * 2); c.arc(x + u * .15 * s, y + u * .5 * s, u * .08 * s, 0, Math.PI * 2); c.fill(); },
      function(c, x, y, u, s) { c.strokeStyle = '#3a4a18'; c.lineWidth = u * .04 * s; c.lineCap = 'round'; for (var r = -1; r <= 1; r++) { c.beginPath(); c.moveTo(x + r * u * .3 * s, y + u * 2.5 * s); c.lineTo(x + r * u * .25 * s, y + u * .3 * s); c.stroke(); c.fillStyle = '#5a3a18'; c.beginPath(); c.ellipse(x + r * u * .25 * s, y + u * .2 * s, u * .08 * s, u * .25 * s, 0, 0, Math.PI * 2); c.fill(); } },
    ],
    bg: '#080f06',
    fgPlants: true,
    fg: [
      function(c, x, y, u, s) { c.fillStyle = 'rgba(40,70,15,0.2)'; c.beginPath(); c.moveTo(x - u * .8 * s, y); c.quadraticCurveTo(x - u * .2 * s, y - u * 1.2 * s, x + u * .1 * s, y - u * .1 * s); c.quadraticCurveTo(x + u * .4 * s, y - u * 1 * s, x + u * .8 * s, y); c.fill(); },
      function(c, x, y, u, s) { c.strokeStyle = 'rgba(60,90,25,0.18)'; c.lineWidth = u * .06 * s; c.lineCap = 'round'; for (var i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x + i * u * .35 * s, y); c.quadraticCurveTo(x + i * u * .5 * s, y - u * .6 * s, x + i * u * .2 * s, y - u * 1 * s); c.stroke(); } },
    ],
  },
  SKY: {
    trees: [
      function(c, x, y, u, s) { c.fillStyle = 'rgba(180,220,255,0.3)'; c.beginPath(); c.ellipse(x, y + u * 1.5 * s, u * 1.5 * s, u * .5 * s, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(100,200,120,0.4)'; c.beginPath(); c.ellipse(x, y + u * 1.2 * s, u * 1.2 * s, u * .3 * s, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(160,120,80,0.3)'; c.beginPath(); c.moveTo(x - u * 1.2 * s, y + u * 1.5 * s); c.quadraticCurveTo(x, y + u * 3 * s, x + u * 1.2 * s, y + u * 1.5 * s); c.fill(); },
      function(c, x, y, u, s) { c.fillStyle = 'rgba(255,255,255,0.15)'; c.beginPath(); c.arc(x, y + u * s, u * 1 * s, 0, Math.PI * 2); c.arc(x + u * .8 * s, y + u * 1.2 * s, u * .7 * s, 0, Math.PI * 2); c.arc(x - u * .6 * s, y + u * 1.3 * s, u * .6 * s, 0, Math.PI * 2); c.fill(); },
      function(c, x, y, u, s) { c.fillStyle = 'rgba(255,255,255,0.08)'; c.beginPath(); c.ellipse(x, y + u * 1.5 * s, u * 2.5 * s, u * .2 * s, 0.1, 0, Math.PI * 2); c.fill(); c.fillStyle = 'rgba(255,255,255,0.05)'; c.beginPath(); c.ellipse(x + u * s, y + u * 1.8 * s, u * 1.5 * s, u * .15 * s, -0.05, 0, Math.PI * 2); c.fill(); },
    ],
    bg: '#3a90e0',
    fgPlants: false,
  },
};

const THEMES = {
  JUNGLE:  { sky:['#0a1628','#152844','#1e4a2a'], mt:'#1e3a5a', hl:'#2d5a3a', gt:'#3a7a28', gf:'#4a3020', gemH:185, amb:null },
  VOLCANO: { sky:['#1a0508','#3a1008','#5a2008'], mt:'#4a1510', hl:'#6a2810', gt:'#bb3300', gf:'#3a1808', gemH:30, amb:'EMBERS' },
  GLACIER: { sky:['#0a1838','#1a3868','#2a58a0'], mt:'#4a80b0', hl:'#8ac0e0', gt:'#b0dff0', gf:'#5a90b0', gemH:210, amb:'SNOW' },
  SWAMP:   { sky:['#080f06','#122010','#1a3010'], mt:'#1a3010', hl:'#2a4a18', gt:'#3a5a20', gf:'#1e2e10', gemH:100, amb:'FIREFLY' },
  SKY:     { sky:['#3a90e0','#5ab0f8','#a0d8ff'], mt:'#d0e8ff', hl:'#e8f4ff', gt:'#a8d8f8', gf:'#7ab8e8', gemH:50, amb:null },
};

// ============================================================
// DAMAGE VALUES
// ============================================================
const DMG = {
  ROCK: 15, SPIKE: 25, LOG: 10, BOULDER: 35, FIRE_GEYSER: 30, PTERO: 20,
  TROLL: 20, CHARGER: 40, DIVER: 25, WITCH: 15, GOLEM: 30, BOMBER: 10, SERPENT: 20,
  ROCK_P: 15, SKULL: 20, SHOCKWAVE: 25, BOMB: 35, VENOM: 20, FEATHER: 10, DEBRIS: 12, BOULDER_P: 30,
  FALL: 999,
};

// ============================================================
// DIFFICULTY
// ============================================================
function getDiff(prog, mult) {
  const spd = lerp(200, 480, prog) * mult;
  const oC = lerp(0.25, 0.65, prog);
  const gC = lerp(0.40, 0.12, prog);
  const gapC = lerp(0.06, 0.35, prog);
  return { speed: spd, oChance: oC, gChance: gC, gapChance: gapC, boulder: prog > 0.25, ptero: prog > 0.40 };
}

// ============================================================
// GEM UPGRADE THRESHOLDS (per-run)
// ============================================================
const GEM_MILESTONES = [
  { first: 5, repeat: 25, type: 'SHIELD', label: 'Shield Unlocked!' },
  { first: 15, repeat: 0, type: 'MAGNET', label: 'Gem Magnet Active!' },
  { first: 30, repeat: 35, type: 'EXTRA_LIFE', label: 'Extra Life Earned!' },
  { first: 50, repeat: 50, type: 'STAR', label: 'Invincible!' },
];

// ============================================================
// PARTICLES
// ============================================================
const particles = [];
let MAX_PARTICLES = 200;

function updateMaxParticles() {
  MAX_PARTICLES = _perfLevel === 0 ? 60 : _perfLevel === 1 ? 120 : 200;
}

const _particlePool = [];
const _particlePoolMax = 300;

class Particle {
  constructor(x, y, c) {
    this.init(x, y, c);
  }

  init(x, y, c) {
    this.x = x;
    this.y = y;
    this.vx = c.vx ?? (Math.random() - .5) * 280;
    this.vy = c.vy ?? -(Math.random() * 180 + 80);
    this.grav = c.grav ?? 550;
    this.life = 1;
    this.decay = c.decay ?? 1.8;
    this.r = c.r ?? UNIT * .28;
    this.color = c.color ?? '#FFD700';
    this.sq = c.sq ?? false;
    return this;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += this.grav * dt;
    this.life -= this.decay * dt;
  }

  get alive() {
    return this.life > 0;
  }
}

function spawnParticle(x, y, cfg) {
  if (particles.length >= MAX_PARTICLES) return;
  const p = _particlePool.length > 0 ? _particlePool.pop().init(x, y, cfg) : new Particle(x, y, cfg);
  particles.push(p);
}

function spawnParts(x, y, n, cfg) {
  for (let i = 0; i < n; i++) spawnParticle(x, y, cfg);
}

function spawnGemFX(x, y, hue) {
  const count = _perfLevel === 0 ? 4 : _perfLevel === 1 ? 8 : 12;
  for (let i = 0; i < count; i++) {
    spawnParticle(x, y, {
      color: `hsl(${hue + Math.random() * 40},100%,70%)`,
      r: UNIT * (.15 + Math.random() * .2),
      decay: 1.4 + Math.random() * .8,
      grav: 350,
    });
  }
}

function spawnImpactBurst(x, y, color, opts) {
  opts = opts || {};
  const count = opts.count || (_perfLevel === 0 ? 6 : _perfLevel === 1 ? 10 : 14);
  const speed = opts.speed || UNIT * 9;
  const spreadY = opts.spreadY || 0.6;
  const grav = opts.grav == null ? 360 : opts.grav;
  const size = opts.size || 0.14;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * PI2 + Math.random() * 0.28;
    const mag = speed * (0.45 + Math.random() * 0.7);
    spawnParticle(x, y, {
      vx: Math.cos(angle) * mag,
      vy: Math.sin(angle) * mag * spreadY - mag * 0.18,
      color: color,
      r: UNIT * (size + Math.random() * size * 0.85),
      decay: 1.6 + Math.random() * 0.8,
      grav: grav
    });
  }
  if (!opts.noRing) {
    for (let i = 0; i < 8; i++) {
      const ringAngle = (i / 8) * PI2;
      spawnParticle(x, y, {
        vx: Math.cos(ringAngle) * speed * 0.55,
        vy: Math.sin(ringAngle) * speed * 0.18,
        color: opts.ringColor || 'rgba(255,255,255,0.36)',
        r: UNIT * 0.08,
        decay: 2.4,
        grav: 0
      });
    }
  }
}

// ============================================================
// SCREEN SHAKE
// ============================================================
let trauma = 0, shX = 0, shY = 0;
var _shakeBiasX = 0, _shakeBiasY = 0;

function addTrauma(v, biasX, biasY) {
  if (save.screenShake === false) return;
  trauma = Math.min(trauma + v, 1);
  _shakeBiasX = biasX || 0;
  _shakeBiasY = biasY || 0;
}

function updateShake(dt) {
  trauma = Math.max(0, trauma - 1.8 * dt);
  _shakeBiasX *= 0.9;
  _shakeBiasY *= 0.9;
  const s = trauma * trauma;
  const m = UNIT * 1.8;
  shX = (Math.random() - .5) * 2 * m * s + _shakeBiasX * s * UNIT * 3;
  shY = (Math.random() - .5) * 2 * m * s + _shakeBiasY * s * UNIT * 3;
}
// ============================================================
// AUDIO MANAGER (Asset-based)
// ============================================================
const AudioManager = {
  ctx: null,
  sfxBuffers: {},
  musicBuffers: {},
  sfxGain: null,
  musicGain: null,
  masterGain: null,
  initialized: false,
  loading: false,

  async init() {
    if (this.initialized || this.loading) return;
    this.loading = true;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      
      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);
      
      this.updateVolumes();

      // Decode SFX from audio_assets.js (SFX_ASSETS)
      if (typeof SFX_ASSETS !== 'undefined') {
        const sfxKeys = Object.keys(SFX_ASSETS);
        for (const key of sfxKeys) {
          try {
            this.sfxBuffers[key] = await this.decodeBase64(SFX_ASSETS[key]);
          } catch(e) { console.warn("Failed to decode SFX:", key); }
        }
      }

      // Decode Music from audio_assets.js (MUSIC_ASSETS)
      if (typeof MUSIC_ASSETS !== 'undefined') {
        const musKeys = Object.keys(MUSIC_ASSETS);
        for (const key of musKeys) {
          try {
            this.musicBuffers[key] = await this.decodeBase64(MUSIC_ASSETS[key]);
          } catch(e) { console.warn("Failed to decode Music:", key); }
        }
      }
      
      this.initialized = true;
      console.log("AudioManager initialized");
    } catch (e) {
      console.error("AudioManager init failed", e);
    } finally {
      this.loading = false;
    }
  },

  async decodeBase64(b64) {
    const bin = atob(b64.split(',')[1]);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return await this.ctx.decodeAudioData(bytes.buffer);
  },

  updateVolumes() {
    if (!this.ctx) return;
    const sfxVol = (typeof sfxVolume !== 'undefined' ? sfxVolume : 1) * (soundMuted ? 0 : 1);
    const musVol = (typeof musicVolume !== 'undefined' ? musicVolume : 1) * (soundMuted ? 0 : 1);
    this.sfxGain.gain.setTargetAtTime(sfxVol, this.ctx.currentTime, 0.05);
    this.musicGain.gain.setTargetAtTime(musVol * 0.7, this.ctx.currentTime, 0.05);
  },

  playSFX(name, opts = {}) {
    if (!this.initialized || !this.ctx || soundMuted || sfxVolume <= 0) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(()=>{});
    
    const buffer = this.sfxBuffers[name];
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    
    const gain = this.ctx.createGain();
    gain.gain.value = opts.volume || 1;
    
    if (opts.detune) source.detune.value = opts.detune;
    if (opts.playbackRate) source.playbackRate.value = opts.playbackRate;

    source.connect(gain);
    gain.connect(this.sfxGain);
    source.start(0);
  },

  currentMusicSource: null,
  currentMusicTheme: null,

  playMusic(theme) {
    if (!this.initialized || !this.ctx || musicVolume <= 0) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(()=>{});
    if (this.currentMusicTheme === theme) return;
    
    this.stopMusic();

    const buffer = this.musicBuffers[theme];
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const fadeGain = this.ctx.createGain();
    fadeGain.gain.setValueAtTime(0, this.ctx.currentTime);
    fadeGain.gain.linearRampToValueAtTime(1, this.ctx.currentTime + 1.5);

    source.connect(fadeGain);
    fadeGain.connect(this.musicGain);
    source.start(0);

    this.currentMusicSource = { source, fadeGain };
    this.currentMusicTheme = theme;
  },

  stopMusic() {
    if (this.currentMusicSource) {
      const { source, fadeGain } = this.currentMusicSource;
      try {
        fadeGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.8);
        setTimeout(() => {
          try { source.stop(); } catch(e) {}
        }, 900);
      } catch(e) { try { source.stop(); } catch(ex) {} }
      this.currentMusicSource = null;
    }
    this.currentMusicTheme = null;
  }
};

// SOUND EFFECTS (Refactored to use AudioManager)
// ============================================================
let soundMuted = false;
function ensureAudio() {
  if (!AudioManager.initialized) {
    AudioManager.init();
  } else if (AudioManager.ctx && AudioManager.ctx.state === 'suspended') {
    AudioManager.ctx.resume().catch(()=>{});
  }
}
function sfxJump() { AudioManager.playSFX('jump'); }
function sfxLand() { AudioManager.playSFX('land'); }
function sfxGem() { haptic('light'); AudioManager.playSFX('gem'); }
function sfxHit() { haptic('medium'); AudioManager.playSFX('hit'); }
function sfxDeath() { haptic('heavy'); AudioManager.playSFX('death'); }
function sfxDash() { AudioManager.playSFX('dash'); }
function sfxSlide() { AudioManager.playSFX('slide'); }
function sfxShield() { AudioManager.playSFX('shield'); }
function sfxSpin() { AudioManager.playSFX('spin'); }
function sfxTap() { AudioManager.playSFX('ui_tap'); }
function sfxLevel() { AudioManager.playSFX('level_complete'); }
function sfxLevelComplete() { AudioManager.playSFX('level_complete'); }
function sfxUITap() { AudioManager.playSFX('ui_tap'); }
function sfxSpin() { AudioManager.playSFX('spin'); }

// ============================================================
// MUSIC SYSTEM (Asset-based)
// ============================================================
let musicVolume = 0.35;
let sfxVolume = 0.7;

function startMusic(themeName) {
  AudioManager.playMusic(themeName);
}

function stopMusic() {
  AudioManager.stopMusic();
}

// ============================================================
// SETTINGS SCREEN
// ============================================================
function drawSettingsScreen(dt) {
  const u = UNIT;
  const layout = drawMetaScreenScaffold({
    theme: THEMES.SKY,
    accent: 'rgba(120,196,255,0.24)',
    title: 'SETTINGS',
    subtitle: 'Tune audio, shake, and comfort before the next run.',
    leftChip: { label: 'AUDIO + FEEL', w: u * 4.8, accent: 'rgba(120,188,255,0.22)' },
    rightChip: { label: soundMuted ? 'MUTED' : 'LIVE AUDIO', w: u * 4.2, accent: soundMuted ? 'rgba(110,120,150,0.18)' : 'rgba(110,210,130,0.22)' }
  });
  const contentX = layout.bodyX + u * 0.42;
  const contentY = layout.bodyY + u * 0.38;
  const contentW = layout.bodyW - u * 0.84;
  const rowH = u * 1.54;
  const rowGap = u * 0.24;
  const sliderW = contentW * 0.32;
  const sliderH = u * 0.26;
  const sliderX = contentX + contentW - sliderW - u * 0.4;
  const musicY = contentY + u * 0.1;
  const sfxY = musicY + rowH + rowGap;
  const shakeY = sfxY + rowH + rowGap;
  const creditsY = shakeY + rowH + u * 0.42;

  drawPanel(layout.bodyX, layout.bodyY, layout.bodyW, layout.bodyH, {
    radius: u * 0.42,
    top: 'rgba(18,28,46,0.94)',
    bottom: 'rgba(8,12,24,0.9)',
    stroke: 'rgba(255,255,255,0.1)',
    accent: 'rgba(120,188,255,0.16)',
    blur: 20
  });

  function drawSettingRow(y, title, desc, value, accent) {
    drawPanel(contentX, y, contentW, rowH, {
      radius: u * 0.28,
      top: 'rgba(20,28,42,0.92)',
      bottom: 'rgba(10,14,24,0.9)',
      stroke: 'rgba(255,255,255,0.08)',
      accent: accent,
      blur: 10
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = FONTS['b0.48'] || ('bold ' + Math.round(u * 0.48) + 'px monospace');
    ctx.fillStyle = '#F5F7FF';
    ctx.fillText(title, contentX + u * 0.34, y + u * 0.22);
    ctx.font = FONTS['n0.32'] || (Math.round(u * 0.32) + 'px monospace');
    ctx.fillStyle = 'rgba(202,216,236,0.66)';
    ctx.fillText(desc, contentX + u * 0.34, y + u * 0.74);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = FONTS['b0.36'] || ('bold ' + Math.round(u * 0.36) + 'px monospace');
    ctx.fillStyle = 'rgba(245,247,255,0.82)';
    ctx.fillText(value, contentX + contentW - u * 0.34, y + rowH * 0.5);
  }

  drawSettingRow(musicY, 'Music Volume', 'Theme loops and menu atmosphere', Math.round(musicVolume * 100) + '%', 'rgba(110,210,130,0.16)');
  drawSettingRow(sfxY, 'SFX Volume', 'Hits, gems, dashes, and UI taps', Math.round(sfxVolume * 100) + '%', 'rgba(120,188,255,0.16)');
  drawSettingRow(shakeY, 'Screen Shake', 'Controls impact camera response', save.screenShake === false ? 'OFF' : 'ON', 'rgba(255,194,70,0.16)');

  drawProgressBar(sliderX, musicY + rowH * 0.46, sliderW, sliderH, musicVolume, ['#6BE28A', '#2F7A48']);
  ctx.beginPath(); ctx.arc(sliderX + sliderW * musicVolume, musicY + rowH * 0.59, u * 0.22, 0, PI2);
  ctx.fillStyle = '#F5F7FF'; ctx.fill();
  ctx.strokeStyle = '#76DEA0'; ctx.lineWidth = 2; ctx.stroke();

  drawProgressBar(sliderX, sfxY + rowH * 0.46, sliderW, sliderH, sfxVolume, ['#8FD3FF', '#3B82C7']);
  ctx.beginPath(); ctx.arc(sliderX + sliderW * sfxVolume, sfxY + rowH * 0.59, u * 0.22, 0, PI2);
  ctx.fillStyle = '#F5F7FF'; ctx.fill();
  ctx.strokeStyle = '#8FD3FF'; ctx.lineWidth = 2; ctx.stroke();

  const shakeBtn = { x: sliderX + sliderW - u * 2.6, y: shakeY + rowH * 0.24, w: u * 2.6, h: u * 0.76 };
  drawMiniChip(shakeBtn.x, shakeBtn.y, shakeBtn.w, shakeBtn.h, save.screenShake === false ? 'OFF' : 'ON', {
    font: FONTS['b0.34'] || ('bold ' + Math.round(u * 0.34) + 'px monospace'),
    accent: save.screenShake === false ? 'rgba(110,120,150,0.18)' : 'rgba(110,210,130,0.22)',
    textColor: save.screenShake === false ? 'rgba(182,190,210,0.72)' : '#E8FFF0'
  });

  drawPanel(contentX, creditsY, contentW, layout.bodyBottom - creditsY - u * 0.18, {
    radius: u * 0.3,
    top: 'rgba(18,22,34,0.92)',
    bottom: 'rgba(10,12,20,0.9)',
    stroke: 'rgba(255,255,255,0.08)',
    accent: 'rgba(255,215,90,0.12)',
    blur: 8
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = FONTS['b0.38'] || ('bold ' + Math.round(u * 0.38) + 'px monospace');
  ctx.fillStyle = '#FFD46C';
  ctx.fillText('CREDITS', W / 2, creditsY + u * 0.38);
  ctx.font = FONTS['n0.32'] || (Math.round(u * 0.32) + 'px monospace');
  ctx.fillStyle = 'rgba(216,226,240,0.74)';
  ctx.fillText('Game design, gameplay systems, and packaging', W / 2, creditsY + u * 0.92);
  ctx.fillStyle = 'rgba(180,194,216,0.6)';
  ctx.fillText('HTML5 Canvas runtime inside Expo / WebView shell', W / 2, creditsY + u * 1.35);

  const backBtn = drawMetaFooterButton(layout, 'BACK', 'Level map', {
    top: 'rgba(24,30,42,0.95)',
    bottom: 'rgba(10,15,26,0.92)',
    stroke: 'rgba(221,229,245,0.16)',
    accent: '#8593A8',
    labelColor: '#F1F5FF'
  });
  G._settingsLayout = {
    musicBar: { x: sliderX, y: musicY + rowH * 0.46, w: sliderW, h: sliderH },
    sfxBar: { x: sliderX, y: sfxY + rowH * 0.46, w: sliderW, h: sliderH },
    shakeBtn: shakeBtn,
    backBtn: backBtn
  };
}

function handleSettingsTap() {
  const tx = inp.tapX, ty = inp.tapY;
  const L = G._settingsLayout;
  if (!L) return;

  if (tx >= L.musicBar.x - UNIT * 0.35 && tx <= L.musicBar.x + L.musicBar.w + UNIT * 0.35 && ty >= L.musicBar.y - UNIT * 0.45 && ty <= L.musicBar.y + UNIT * 0.55) {
    musicVolume = clamp((tx - L.musicBar.x) / L.musicBar.w, 0, 1);
    AudioManager.updateVolumes();
    save.musicVolume = musicVolume; persistSave();
    return;
  }
  if (tx >= L.sfxBar.x - UNIT * 0.35 && tx <= L.sfxBar.x + L.sfxBar.w + UNIT * 0.35 && ty >= L.sfxBar.y - UNIT * 0.45 && ty <= L.sfxBar.y + UNIT * 0.55) {
    sfxVolume = clamp((tx - L.sfxBar.x) / L.sfxBar.w, 0, 1);
    AudioManager.updateVolumes();
    save.sfxVolume = sfxVolume; persistSave();
    sfxUITap();
    return;
  }
  if (tx >= L.shakeBtn.x && tx <= L.shakeBtn.x + L.shakeBtn.w && ty >= L.shakeBtn.y && ty <= L.shakeBtn.y + L.shakeBtn.h) {
    save.screenShake = save.screenShake === false ? true : false;
    persistSave(); sfxUITap();
    return;
  }
  if (tx >= L.backBtn.x && tx <= L.backBtn.x + L.backBtn.w && ty >= L.backBtn.y && ty <= L.backBtn.y + L.backBtn.h) {
    G.phase = G._settingsReturnPhase || 'LEVEL_MAP'; sfxUITap();
    return;
  }
}

function drawSpeakerIcon(x, y, size) {
  ctx.font = `${size}px sans-serif`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(soundMuted ? '\uD83D\uDD07' : '\uD83D\uDD0A', x, y);
}
function checkSpeakerTap(tx, ty, x, y, size) {
  return tx >= x && tx <= x + size*1.2 && ty >= y && ty <= y + size*1.2;
}

// ============================================================
// COMBO SYSTEM
// ============================================================
function comboAction(points, type) {
  G.combo++;
  G.comboTimer = 3;
  // Combo tiers: 5→2x, 10→3x, 15→4x, 20→5x, 30→6x, 40→7x, 50+→8x
  const ct = G.combo;
  G.comboMult = ct>=50?8 : ct>=40?7 : ct>=30?6 : ct>=20?5 : 1+Math.min(Math.floor(ct/5),4);
  const bonus = points * G.comboMult;
  G.score += bonus; G.runScore += bonus;
  G.comboPulse = 0.3;
  if (type === 'chain' || type === 'perfect_land' || type === 'perfect_parry' || type === 'destroy_obstacle') {
    const pitch = Math.min(1200, (G.combo % 10) * 100);
    AudioManager.playSFX('gem', {detune: pitch, volume: 0.6});
    if (type === 'chain') AudioManager.playSFX('dash', {playbackRate: 1.5, volume: 0.4});
  }
  updateMissionProgress('scoreEarned', bonus);
  updateMissionProgress('maxCombo', G.combo);
  return bonus;
}
function comboBreak() {
  G.combo = 0; G.comboTimer = 0; G.comboMult = 1;
}

// ============================================================
// ACHIEVEMENTS
// ============================================================
const ACHIEVEMENTS = [
  // Beginner tier
  { id:'first_run', name:'First Steps', desc:'Complete your first run', check: s => s.totalRuns >= 1, gems:10 },
  { id:'level5', name:'Adventurer', desc:'Reach Level 5', check: s => s.highestLevel >= 5, gems:20 },
  { id:'level10', name:'Explorer', desc:'Reach Level 10', check: s => s.highestLevel >= 10, gems:50 },
  { id:'level20', name:'Trailblazer', desc:'Reach Level 20', check: s => s.highestLevel >= 20, gems:100 },
  { id:'level30', name:'Unstoppable', desc:'Reach Level 30', check: s => s.highestLevel >= 30, gems:200 },
  // Gem collection
  { id:'gem_hunter', name:'Gem Hunter', desc:'Collect 100 total gems', check: s => s.totalGems >= 100, gems:25 },
  { id:'gem_master', name:'Gem Master', desc:'Collect 500 total gems', check: s => s.totalGems >= 500, gems:50, bonus:'magnetRange' },
  { id:'gem_baron', name:'Gem Baron', desc:'Collect 2000 total gems', check: s => s.totalGems >= 2000, gems:150 },
  { id:'gem_tycoon', name:'Gem Tycoon', desc:'Collect 5000 total gems', check: s => s.totalGems >= 5000, gems:300 },
  // Score milestones
  { id:'score10k', name:'High Scorer', desc:'Get 10,000 total score', check: s => s.totalScore >= 10000, gems:30 },
  { id:'score50k', name:'Score Legend', desc:'Get 50,000 total score', check: s => s.totalScore >= 50000, gems:100 },
  { id:'score100k', name:'Score Titan', desc:'Get 100,000 total score', check: s => s.totalScore >= 100000, gems:200 },
  // Combat & skills
  { id:'smasher', name:'Smasher', desc:'Destroy 50 obstacles', check: s => s.obstaclesSmashed >= 50, bonus:'poundRadius' },
  { id:'demolisher', name:'Demolisher', desc:'Destroy 200 obstacles', check: s => s.obstaclesSmashed >= 200, gems:75 },
  { id:'dasher', name:'Speed Demon', desc:'Use dash 100 times', check: s => s.dashesUsed >= 100, bonus:'dashCD' },
  { id:'slider', name:'Smooth Operator', desc:'Use slide 100 times', check: s => s.slidesUsed >= 100, gems:40 },
  { id:'dodger', name:'Untouchable', desc:'Dodge 100 enemies', check: s => s.enemiesDodged >= 100, gems:60 },
  { id:'dodger_pro', name:'Ghost Runner', desc:'Dodge 500 enemies', check: s => s.enemiesDodged >= 500, gems:150 },
  // Persistence
  { id:'runs10', name:'Dedicated', desc:'Complete 10 runs', check: s => s.totalRuns >= 10, gems:25 },
  { id:'runs50', name:'Veteran', desc:'Complete 50 runs', check: s => s.totalRuns >= 50, gems:100 },
  { id:'runs100', name:'Centurion', desc:'Complete 100 runs', check: s => s.totalRuns >= 100, gems:250 },
  // Streak
  { id:'streak5', name:'Loyal Player', desc:'5-day login streak', check: s => s.dailyStreak >= 5, gems:75 },
  { id:'streak14', name:'Devoted', desc:'14-day login streak', check: s => s.dailyStreak >= 14, gems:200 },
  { id:'streak30', name:'Die-Hard Fan', desc:'30-day login streak', check: s => s.dailyStreak >= 30, gems:500 },
];
let achievementPopup = null; // {name, life}

function checkAchievements() {
  if (!save.stats) return;
  if (!save.achievements) save.achievements = {};
  if (!save.achievementBonuses) save.achievementBonuses = {};
  for (const a of ACHIEVEMENTS) {
    if (!save.achievements[a.id] && a.check(save.stats)) {
      save.achievements[a.id] = true;
      // Award gem reward
      if (a.gems) { save.totalGems += a.gems; }
      // Award permanent bonus
      if (a.bonus) { save.achievementBonuses[a.bonus] = true; }
      const rewardText = a.gems ? ` (+${a.gems} gems)` : '';
      trackAchievement(a.id);
      achievementPopup = { name: a.name, desc: a.desc + rewardText, life: 3 };
    }
  }
  checkCharUnlocks();
  persistSave();
}

// Character unlock conditions (index → requirement)
const CHAR_UNLOCK = [
  null,                                                    // 0: Gronk — always unlocked
  { req: 'Reach Level 5', check: () => save.highestLevel >= 5 },   // 1: Pip
  { req: 'Reach Level 10', check: () => save.highestLevel >= 10 }, // 2: Bruk
  { req: 'Collect 200 gems', check: () => save.totalGems >= 200 }, // 3: Zara
  { req: 'Reach Level 20', check: () => save.highestLevel >= 20 }, // 4: Rex
  { req: 'Beat all 40 levels', check: () => save.highestLevel >= 40 }, // 5: Mog
];
let charUnlockPopup = null; // {name, life}

function checkCharUnlocks() {
  if (!Array.isArray(save.unlockedChars)) save.unlockedChars = [0];
  for (let i = 1; i < CHARS.length; i++) {
    if (save.unlockedChars.includes(i)) continue;
    if (CHAR_UNLOCK[i] && CHAR_UNLOCK[i].check()) {
      save.unlockedChars.push(i);
      charUnlockPopup = { name: CHARS[i].name, life: 3 };
    }
  }
}

function updateStatsEndRun() {
  if (!save.stats) save.stats = { totalRuns:0, totalGems:0, totalScore:0, highestLevel:0, longestRun:0, enemiesDodged:0, obstaclesSmashed:0, dashesUsed:0, slidesUsed:0 };
  save.stats.totalRuns++;
  save.stats.totalGems += G.runGems;
  save.stats.totalScore += G.runScore;
  save.stats.highestLevel = Math.max(save.stats.highestLevel, G.levelNum);
  save.stats.longestRun = Math.max(save.stats.longestRun, Math.floor(G.time));
  persistSave();
  checkAchievements();
  updateMissionProgress('runsCompleted', 1);
}

// ============================================================
// MISSIONS SYSTEM
// ============================================================
const MISSION_TEMPLATES = {
  daily: [
    { id:'collect_gems', desc:'Collect {n} gems', targets:[30,50,75], reward:[10,15,25], stat:'gemsCollected' },
    { id:'dash_count', desc:'Dash {n} times', targets:[15,25,40], reward:[10,15,20], stat:'dashesUsed' },
    { id:'kill_enemies', desc:'Defeat {n} enemies', targets:[5,10,15], reward:[15,20,30], stat:'enemiesKilled' },
    { id:'score_points', desc:'Score {n} points', targets:[2000,5000,10000], reward:[10,20,35], stat:'scoreEarned' },
    { id:'complete_levels', desc:'Complete {n} levels', targets:[2,3,5], reward:[15,25,40], stat:'levelsCompleted' },
    { id:'smash_obstacles', desc:'Smash {n} obstacles', targets:[10,20,30], reward:[10,15,20], stat:'obstaclesSmashed' },
  ],
  weekly: [
    { id:'w_gems', desc:'Collect {n} gems this week', targets:[200,400], reward:[50,100], stat:'gemsCollected' },
    { id:'w_kills', desc:'Defeat {n} enemies this week', targets:[30,60], reward:[60,120], stat:'enemiesKilled' },
    { id:'w_levels', desc:'Complete {n} levels this week', targets:[10,20], reward:[50,100], stat:'levelsCompleted' },
    { id:'w_runs', desc:'Complete {n} runs this week', targets:[5,10], reward:[40,80], stat:'runsCompleted' },
    { id:'w_combo', desc:'Reach a {n}x combo', targets:[10,20], reward:[50,80], stat:'maxCombo' },
  ],
};

function getWeekId() {
  const d = new Date();
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return d.getFullYear() + '-W' + weekNo;
}

function generateMissions(type, count, seed) {
  const templates = MISSION_TEMPLATES[type];
  const picked = [];
  let s = seed;
  const used = new Set();
  for (let i = 0; i < count && i < templates.length; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    let idx = s % templates.length;
    while (used.has(idx)) idx = (idx + 1) % templates.length;
    used.add(idx);
    const t = templates[idx];
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const diffIdx = s % t.targets.length;
    const target = t.targets[diffIdx];
    const reward = t.reward[diffIdx];
    picked.push({ id: t.id, desc: t.desc.replace('{n}', target), target, reward, stat: t.stat, progress: 0, claimed: false });
  }
  return picked;
}

function checkMissionResets() {
  const today = localDateStr(new Date());
  if (!save.missions) save.missions = { daily: [], weekly: [], lastDailyReset: '', lastWeeklyReset: '' };
  if (save.missions.lastDailyReset !== today) {
    let seed = 0;
    for (let i = 0; i < today.length; i++) seed = ((seed << 5) - seed + today.charCodeAt(i)) | 0;
    save.missions.daily = generateMissions('daily', 3, Math.abs(seed));
    save.missions.lastDailyReset = today;
    persistSave();
  }
  const weekId = getWeekId();
  if (save.missions.lastWeeklyReset !== weekId) {
    let seed = 0;
    for (let i = 0; i < weekId.length; i++) seed = ((seed << 5) - seed + weekId.charCodeAt(i)) | 0;
    save.missions.weekly = generateMissions('weekly', 3, Math.abs(seed));
    save.missions.lastWeeklyReset = weekId;
    persistSave();
  }
}

function updateMissionProgress(stat, amount) {
  if (!save.missions) return;
  const allMissions = [].concat(save.missions.daily || [], save.missions.weekly || []);
  for (const m of allMissions) {
    if (m.stat === stat && !m.claimed) {
      if (stat === 'maxCombo') {
        m.progress = Math.max(m.progress || 0, amount);
      } else {
        m.progress = Math.min((m.progress || 0) + amount, m.target);
      }
    }
  }
  persistSave();
}

function claimMissionReward(mission) {
  if (mission.claimed || (mission.progress || 0) < mission.target) return false;
  mission.claimed = true;
  save.totalGems += mission.reward;
  persistSave();
  return true;
}

// MISSIONS SCREEN
function getMissionResetCountdown(type) {
  const now = new Date();
  if (type === 'daily') {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
    const diff = Math.max(0, Math.floor((tomorrow - now)/1000));
    const h = Math.floor(diff/3600), m = Math.floor((diff%3600)/60);
    return h+'h '+m+'m';
  } else {
    const day = now.getDay() || 7;
    const daysLeft = 8 - day;
    return daysLeft+'d';
  }
}

function drawMissionsScreen(dt) {
  checkMissionResets();
  if (!G._missionClaimFX) G._missionClaimFX = [];
  const u = UNIT;
  const compact = W < 1180 || H < 620;
  const daily = save.missions && save.missions.daily || [];
  const weekly = save.missions && save.missions.weekly || [];
  const allMissions = daily.concat(weekly);
  const readyCount = allMissions.filter(function(m) {
    return !m.claimed && (m.progress || 0) >= m.target;
  }).length;
  const claimableGems = allMissions.reduce(function(sum, m) {
    return sum + ((!m.claimed && (m.progress || 0) >= m.target) ? m.reward : 0);
  }, 0);
  const layout = drawMetaScreenScaffold({
    theme: THEMES.SWAMP,
    accent: 'rgba(108,215,176,0.22)',
    title: 'MISSIONS',
    subtitle: 'Short goals that keep the economy moving without crowding the main progression loop.',
    leftChip: {
      label: readyCount > 0 ? `${readyCount} READY` : 'TRACKING',
      w: u * 3.8,
      accent: readyCount > 0 ? 'rgba(118,222,136,0.24)' : 'rgba(110,120,150,0.14)',
      textColor: readyCount > 0 ? '#E9FFF0' : '#E2E8F5'
    },
    rightChip: {
      label: claimableGems > 0 ? `${claimableGems}g CLAIMABLE` : `${allMissions.length} LIVE`,
      w: u * 5,
      accent: claimableGems > 0 ? 'rgba(255,208,90,0.24)' : 'rgba(120,188,255,0.2)',
      textColor: claimableGems > 0 ? '#FFF3C8' : '#DCEEFF'
    }
  });
  const outerX = layout.bodyX;
  const outerY = layout.bodyY;
  const outerW = layout.bodyW;
  const outerH = layout.bodyH;
  const sectionGap = compact ? u * 0.24 : u * 0.28;
  const sectionH = compact ? (outerH - sectionGap) / 2 : outerH;
  const sectionW = compact ? outerW : (outerW - sectionGap) / 2;
  const dailyX = outerX;
  const dailyY = outerY;
  const weeklyX = compact ? outerX : (outerX + sectionW + sectionGap);
  const weeklyY = compact ? (outerY + sectionH + sectionGap) : outerY;
  const buttons = [];

  function drawMissionSection(x, y, w, h, title, resetText, missions, accent, textColor) {
    drawPanel(x, y, w, h, {
      radius: u * 0.42,
      top: 'rgba(18,28,46,0.94)',
      bottom: 'rgba(8,12,24,0.9)',
      stroke: 'rgba(255,255,255,0.1)',
      accent: accent,
      blur: 18
    });
    drawMiniChip(x + u * 0.24, y + u * 0.18, Math.min(u * 4.4, w * 0.56), u * 0.56, title, {
      font: FONTS['b0.3'] || ('bold ' + Math.round(u * 0.3) + 'px monospace'),
      accent: accent,
      textColor: textColor
    });
    drawMiniChip(x + w - Math.min(u * 3.5, w * 0.32) - u * 0.24, y + u * 0.18, Math.min(u * 3.5, w * 0.32), u * 0.56, resetText, {
      font: FONTS['b0.26'] || ('bold ' + Math.round(u * 0.26) + 'px monospace'),
      accent: 'rgba(110,120,150,0.16)',
      textColor: 'rgba(221,229,245,0.78)'
    });

    if (!missions.length) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = FONTS['n0.34'] || (Math.round(u * 0.34) + 'px monospace');
      ctx.fillStyle = 'rgba(188,198,214,0.58)';
      ctx.fillText('No missions ready yet', x + w / 2, y + h * 0.55);
      return;
    }

    const cardX = x + u * 0.2;
    const cardW = w - u * 0.4;
    const cardH = compact ? u * 1.72 : u * 1.84;
    const cardGap = u * 0.18;
    let cy = y + u * 0.92;
    for (let i = 0; i < missions.length; i++) {
      const claimRect = drawMissionCard(cardX, cy, cardW, cardH, missions[i], u, dt, {
        accent: accent,
        textColor: textColor
      });
      if (claimRect) buttons.push(claimRect);
      cy += cardH + cardGap;
    }
  }

  drawMissionSection(dailyX, dailyY, sectionW, sectionH, 'DAILY MISSIONS', getMissionResetCountdown('daily'), daily, 'rgba(255,208,90,0.18)', '#FFF3C8');
  drawMissionSection(weeklyX, weeklyY, sectionW, sectionH, 'WEEKLY MISSIONS', getMissionResetCountdown('weekly'), weekly, 'rgba(120,188,255,0.18)', '#DBECFF');

  // Claim animation particles
  for (var fi=G._missionClaimFX.length-1; fi>=0; fi--) {
    var fx = G._missionClaimFX[fi];
    fx.life -= dt;
    if (fx.life <= 0) { G._missionClaimFX.splice(fi,1); continue; }
    fx.x += fx.vx * dt; fx.y += fx.vy * dt; fx.vy += 300*dt;
    var fa = clamp(fx.life/fx.maxLife, 0, 1);
    ctx.globalAlpha = fa;
    ctx.fillStyle = fx.color;
    ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, PI2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  G._missionButtons = buttons;
  G._missionsBackBtn = drawMetaFooterButton(layout, 'BACK', 'Level map', {
    top: 'rgba(24,30,42,0.95)',
    bottom: 'rgba(10,15,26,0.92)',
    stroke: 'rgba(221,229,245,0.16)',
    accent: '#8593A8',
    labelColor: '#F1F5FF'
  });
}

function drawMissionCard(x, y, w, h, mission, u, dt, opts) {
  opts = opts || {};
  const done = mission.claimed;
  const ready = !done && (mission.progress || 0) >= mission.target;
  const prog = clamp((mission.progress || 0) / mission.target, 0, 1);

  // Animate progress bar fill (smooth lerp)
  if (mission._displayProg === undefined) mission._displayProg = prog;
  mission._displayProg += (prog - mission._displayProg) * Math.min(1, (dt||0.016) * 4);

  const accent = opts.accent || 'rgba(255,208,90,0.16)';
  const statusAccent = done ? 'rgba(110,210,130,0.22)' : ready ? 'rgba(255,208,90,0.22)' : accent;
  const actionW = Math.min(u * 2.35, w * 0.24);
  const actionX = x + w - actionW - u * 0.22;
  const leftW = w - actionW - u * 0.72;

  if (ready) {
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 8 + Math.sin(G.time*4)*3;
  }
  drawPanel(x, y, w, h, {
    radius: u * 0.22,
    top: done ? 'rgba(24,38,28,0.94)' : ready ? 'rgba(40,30,14,0.94)' : 'rgba(20,28,42,0.92)',
    bottom: done ? 'rgba(10,18,14,0.92)' : ready ? 'rgba(18,12,10,0.9)' : 'rgba(10,14,24,0.9)',
    stroke: done ? 'rgba(110,210,130,0.18)' : ready ? 'rgba(255,215,90,0.18)' : 'rgba(255,255,255,0.06)',
    accent: ready ? 'rgba(255,208,90,0.16)' : done ? 'rgba(110,210,130,0.14)' : 'rgba(110,120,150,0.08)',
    blur: ready ? 14 : 8
  });
  ctx.shadowBlur = 0;

  drawMiniChip(x + u * 0.22, y + u * 0.16, u * 2.2, u * 0.42, done ? 'DONE' : ready ? 'READY' : 'IN PLAY', {
    font: FONTS['b0.24'] || ('bold ' + Math.round(u * 0.24) + 'px monospace'),
    accent: statusAccent,
    textColor: done ? '#E7FFF0' : ready ? '#FFF3C8' : '#E6EEF9'
  });
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = FONTS['b0.32'] || ('bold ' + Math.round(u * 0.32) + 'px monospace');
  ctx.fillStyle = done ? 'rgba(208,236,214,0.74)' : '#F5F7FF';
  drawTextBlock(mission.desc, x + u * 0.24, y + u * 0.66, leftW, u * 0.28, { align: 'left' });

  const barX = x + u * 0.24;
  const barY = y + h - u * 0.48;
  const barW = leftW;
  const barH = u * 0.22;
  drawProgressBar(barX, barY, barW, barH, mission._displayProg, done ? ['#4FAE60', '#2C6B39'] : ready ? ['#FFD86A', '#C88618'] : ['#7FC9FF', '#327FC2']);
  var dp = mission._displayProg;
  if (dp > 0.005 && !done) {
    ctx.globalAlpha = 0.18;
    fillRR(barX + u * 0.04, barY + u * 0.03, Math.max(barH, barW * dp * 0.55), barH * 0.42, barH / 3, 'rgba(255,255,255,0.5)', null, 0);
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = FONTS['n0.24'] || (Math.round(u * 0.24) + 'px monospace');
  ctx.fillStyle = 'rgba(214,226,244,0.68)';
  ctx.fillText(Math.min(mission.progress || 0, mission.target) + '/' + mission.target, barX, barY - u * 0.14);
  ctx.textAlign = 'right';
  ctx.fillStyle = done ? '#9CF0AF' : ready ? '#FFD86A' : 'rgba(214,226,244,0.6)';
  ctx.fillText(Math.round(prog * 100) + '%', barX + barW, barY - u * 0.14);

  if (done) {
    drawMiniChip(actionX, y + h * 0.22, actionW, u * 0.62, 'DONE', {
      font: FONTS['b0.28'] || ('bold ' + Math.round(u * 0.28) + 'px monospace'),
      accent: 'rgba(110,210,130,0.22)',
      textColor: '#E9FFF0'
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = FONTS['n0.24'] || (Math.round(u * 0.24) + 'px monospace');
    ctx.fillStyle = 'rgba(158,222,172,0.68)';
    ctx.fillText('Reward sent', actionX + actionW / 2, y + h * 0.72);
    return null;
  } else if (ready) {
    const pulse = 1+Math.sin(G.time*5)*0.04;
    const btnH = u * 0.72;
    const btnY = y + h * 0.18;
    const btnCX = actionX + actionW / 2;
    const btnCY = btnY + btnH / 2;
    ctx.save();
    ctx.translate(btnCX, btnCY);
    ctx.scale(pulse, pulse);
    ctx.translate(-btnCX, -btnCY);
    drawMiniChip(actionX, btnY, actionW, btnH, 'CLAIM', {
      font: FONTS['b0.26'] || ('bold ' + Math.round(u * 0.26) + 'px monospace'),
      accent: 'rgba(255,208,90,0.28)',
      textColor: '#FFF4C8',
      top: 'rgba(52,38,12,0.98)',
      bottom: 'rgba(28,18,8,0.96)',
      stroke: 'rgba(255,215,90,0.28)'
    });
    ctx.restore();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = FONTS['b0.26'] || ('bold ' + Math.round(u * 0.26) + 'px monospace');
    ctx.fillStyle = '#FFE27A';
    ctx.fillText('+' + mission.reward + 'g', actionX + actionW / 2, y + h * 0.72);
    return { x: actionX, y: btnY, w: actionW, h: btnH, mission: mission };
  } else {
    drawMiniChip(actionX, y + h * 0.22, actionW, u * 0.62, '+' + mission.reward + 'g', {
      font: FONTS['b0.28'] || ('bold ' + Math.round(u * 0.28) + 'px monospace'),
      accent: 'rgba(120,188,255,0.18)',
      textColor: '#EAF4FF'
    });
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = FONTS['n0.22'] || (Math.round(u * 0.22) + 'px monospace');
    ctx.fillStyle = 'rgba(188,198,214,0.6)';
    ctx.fillText('Keep pushing', actionX + actionW / 2, y + h * 0.72);
    return null;
  }
}

function spawnClaimFX(cx, cy) {
  if (!G._missionClaimFX) G._missionClaimFX = [];
  var colors = ['#FFD700','#FFAA00','#FF8800','#44FF88','#FFFFFF'];
  for (var i=0; i<15; i++) {
    var angle = (i/15)*Math.PI*2 + Math.random()*0.3;
    var speed = 100+Math.random()*200;
    G._missionClaimFX.push({
      x:cx, y:cy, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed-50,
      r:UNIT*(0.08+Math.random()*0.12), color:colors[i%colors.length],
      life:0.6+Math.random()*0.4, maxLife:1.0
    });
  }
}

function handleMissionsTap() {
  const tx = inp.tapX, ty = inp.tapY;
  const buttons = G._missionButtons || [];
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    if (tx >= btn.x && tx <= btn.x + btn.w && ty >= btn.y && ty <= btn.y + btn.h) {
      if (claimMissionReward(btn.mission)) {
        sfxGem();
        spawnClaimFX(btn.x + btn.w / 2, btn.y + btn.h / 2);
        showAnnouncement('+' + btn.mission.reward + ' GEMS', '#FFD700');
      }
      return;
    }
  }

  const backBtn = G._missionsBackBtn;
  if (backBtn && tx >= backBtn.x && tx <= backBtn.x + backBtn.w && ty >= backBtn.y && ty <= backBtn.y + backBtn.h) {
    G.phase = 'LEVEL_MAP'; sfxUITap();
  }
}

// ============================================================
// BOSS FIGHT DATA
// ============================================================
const BOSS_TYPES = [
  { name:'Jungle Troll King', theme:'JUNGLE', color:'#3a7a3a', hp:100, attacks:['ROCK_CLUSTER','GROUND_POUND'], phase3atk:'VINE_ERUPTION' },
  { name:'Volcano Golem', theme:'VOLCANO', color:'#cc4400', hp:150, attacks:['BOULDER_RAIN','FIRE_BEAM'], phase3atk:'MAGMA_POOL' },
  { name:'Ice Dragon', theme:'GLACIER', color:'#88ccff', hp:120, attacks:['ICE_SHARD','ICE_PILLAR'], phase3atk:'FROST_CONE' },
  { name:'Swamp Witch Queen', theme:'SWAMP', color:'#aa44cc', hp:100, attacks:['HOMING_SKULLS','POISON_CLOUD'], phase3atk:'SHADOW_BURST' },
  { name:'Sky Phoenix', theme:'SKY', color:'#ffaa22', hp:130, attacks:['SWOOP','FEATHER_STORM'], phase3atk:'DIVE_BOMB' },
];

let boss = null;
class Boss {
  constructor(levelNum) {
    const idx = Math.floor(((levelNum / 5) - 1) % BOSS_TYPES.length);
    const safeIdx = Math.max(0, Math.min(idx, BOSS_TYPES.length - 1));
    const def = BOSS_TYPES[safeIdx];
    this.name = def.name; this.color = def.color;
    this.maxHP = def.hp; this.hp = def.hp;
    this.attacks = def.attacks;
    this.x = W * 0.82; this.y = GROUND_BASE - UNIT * 4;
    this.baseY = this.y;
    this.phase = 0; this.timer = 0; this.attackTimer = 0;
    this.attackIdx = 0; this.windUp = 0;
    this.projectiles = [];
    this.bobPhase = 0;
    this.defeated = false;
    this.flashTimer = 0;
    this.bossTimer = 15; // 15 second fight
    this.typeIdx = safeIdx;
    this.phase3atk = def.phase3atk;
    this.bossPhase = 1; // HP-based phases: 1 (100-66%), 2 (66-33%), 3 (33-0%)
    this.shockwaveCD = 0; // phase 3 periodic shockwave
    // Difficulty scaling: later bosses attack faster and hit harder
    this.diffMult = 1 + (levelNum - 5) * 0.06;
    this.speedMult = 1 + (levelNum - 5) * 0.04;
  }
  update(dt, player) {
    this.bobPhase += dt * 2;
    this.y = this.baseY + Math.sin(this.bobPhase) * UNIT * 0.5;
    this.bossTimer -= dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;

    // Phase tracking based on HP percentage
    const hpPct = this.hp / this.maxHP;
    const newPhase = hpPct > 0.66 ? 1 : hpPct > 0.33 ? 2 : 3;
    if(newPhase > this.bossPhase){
      this.bossPhase = newPhase;
      addTrauma(0.4);
      G.announce={text:newPhase===2?'BOSS ENRAGED!':'BOSS FURY!',life:1.5};
    }

    // Phase-based speed multiplier
    const phaseSpdMult = this.bossPhase===3 ? 1.5 : this.bossPhase===2 ? 1.25 : 1;

    // Attack pattern — interval decreases with phase and difficulty
    this.attackTimer += dt;
    const attackInterval = Math.max(0.8, 2.5 / (this.diffMult * phaseSpdMult));
    if (this.attackTimer >= attackInterval && this.windUp <= 0) {
      this.windUp = 0.6;
      this.attackTimer = 0;
    }
    if (this.windUp > 0) {
      this.windUp -= dt;
      if (this.windUp <= 0) {
        // In phase 2+, cycle through base attacks + phase 3 attack
        const atkPool = this.bossPhase >= 2
          ? [...this.attacks, this.phase3atk]
          : this.attacks;
        this.attackIdx = this.attackIdx % atkPool.length;
        this._doAttack(player, atkPool[this.attackIdx]);
        this.attackIdx = (this.attackIdx + 1) % atkPool.length;
      }
    }

    // Phase 3: periodic screen-wide shockwave
    if(this.bossPhase >= 3){
      this.shockwaveCD -= dt;
      if(this.shockwaveCD <= 0){
        this.shockwaveCD = 4;
        this.projectiles.push({x:W+UNIT,y:GROUND_BASE-UNIT*.3,vx:-600*this.speedMult,vy:0,grav:0,life:2.5,type:'SHOCKWAVE'});
        this.projectiles.push({x:-UNIT,y:GROUND_BASE-UNIT*.3,vx:600*this.speedMult,vy:0,grav:0,life:2.5,type:'SHOCKWAVE'});
      }
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      if (p.grav) p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      if((p.type==='BOULDER_P'||p.type==='ROCK_P'||p.type==='BOMB')&&p.vy>0&&p.grav){var _bGY=getGroundAt(p.x+worldOffset);if(p.y>=_bGY){p.y=_bGY;if(Math.abs(p.vy)>40){p.vy*=-0.45;p.vx*=0.85;}else{p.vy=0;p.grav=0;p.vx*=0.92;}}}
      // Vine warn → spawn vine eruption after delay
      if(p.type==='VINE_WARN' && p._spawnVine && p.life < 0.4){
        p._spawnVine=false;
        this.projectiles.push({x:p.x,y:GROUND_BASE-UNIT*3,vx:0,vy:-300,grav:0,life:1.5,type:'ROCK_P'});
      }
      if (p.x < -UNIT * 3 || p.y > H + UNIT * 3 || p.life <= 0) this.projectiles.splice(i, 1);
    }
  }
  _doAttack(player, atk) {
    if(!atk) atk = this.attacks[this.attackIdx % this.attacks.length];
    const px = player.screenX, py = player.y;
    const sm = this.speedMult; // projectile speed scaling
    switch (atk) {
      case 'ROCK_CLUSTER':
        for (let i = 0; i < 3; i++) this.projectiles.push({ x: this.x - UNIT, y: this.y + UNIT * (i - 1), vx: (-280 - i * 40)*sm, vy: (-80 + i * 30)*sm, grav: 300, life: 4, type: 'ROCK_P' });
        break;
      case 'GROUND_POUND':
        this.projectiles.push({ x: this.x - UNIT * 2, y: GROUND_BASE - UNIT * 0.3, vx: -450*sm, vy: 0, grav: 0, life: 3, type: 'SHOCKWAVE' });
        break;
      case 'BOULDER_RAIN':
        for (let i = 0; i < 3; i++) this.projectiles.push({ x: W * (0.2 + i * 0.25), y: -UNIT, vx: 0, vy: (150 + i * 30)*sm, grav: 400, life: 4, type: 'BOULDER_P' });
        break;
      case 'FIRE_BEAM':
        this.projectiles.push({ x: this.x - UNIT, y: this.y + UNIT, vx: -600*sm, vy: 0, grav: 0, life: 2, type: 'FIRE_BEAM' });
        break;
      case 'ICE_SHARD':
        for (let i = -2; i <= 2; i++) this.projectiles.push({ x: this.x - UNIT, y: this.y, vx: -250*sm, vy: i * 80 * sm, grav: 0, life: 3, type: 'ICE' });
        break;
      case 'ICE_PILLAR':
        this.projectiles.push({ x: px + UNIT * 2, y: GROUND_BASE + UNIT, vx: 0, vy: -400*sm, grav: 0, life: 1.5, type: 'ICE_PILLAR' });
        break;
      case 'HOMING_SKULLS':
        for (let i = 0; i < 3; i++) this.projectiles.push({ x: this.x - UNIT, y: this.y - UNIT + i * UNIT, vx: -160*sm, vy: 0, grav: 0, life: 5, type: 'SKULL', homing: true, _px: px, _py: py });
        break;
      case 'POISON_CLOUD':
        this.projectiles.push({ x: px, y: GROUND_BASE - UNIT * 2, vx: 0, vy: 0, grav: 0, life: 3, type: 'POISON_CLOUD', r: UNIT * 2 });
        break;
      case 'SWOOP':
        this.projectiles.push({ x: W + UNIT, y: py - UNIT, vx: -700*sm, vy: 0, grav: 0, life: 2, type: 'SWOOP_TRAIL' });
        break;
      case 'FEATHER_STORM':
        for (let i = 0; i < 5; i++) this.projectiles.push({ x: W * (0.1 + i * 0.18), y: -UNIT, vx: -30*sm, vy: (200 + Math.random() * 100)*sm, grav: 100, life: 3, type: 'FEATHER' });
        break;
      // Phase 3 unique attacks
      case 'VINE_ERUPTION':
        // Ground markers → delayed vine eruption
        for(let i=0;i<3;i++) this.projectiles.push({x:px+(i-1)*UNIT*3, y:GROUND_BASE-UNIT*.2, vx:0, vy:0, grav:0, life:1.2, type:'VINE_WARN', _delay:0.8, _spawnVine:true});
        break;
      case 'MAGMA_POOL':
        // Persistent magma area denial
        this.projectiles.push({x:px, y:GROUND_BASE-UNIT*.3, vx:0, vy:0, grav:0, life:3, type:'MAGMA_POOL', r:UNIT*2.5});
        break;
      case 'FROST_CONE':
        // Wide frost cone spread
        for(let i=-3;i<=3;i++) this.projectiles.push({x:this.x-UNIT, y:this.y, vx:-350*sm, vy:i*60*sm, grav:0, life:2.5, type:'ICE'});
        break;
      case 'SHADOW_BURST':
        // Ring of 8 outward projectiles
        for(let i=0;i<8;i++){const a=(i/8)*Math.PI*2; this.projectiles.push({x:this.x,y:this.y,vx:Math.cos(a)*250*sm,vy:Math.sin(a)*250*sm,grav:0,life:3,type:'SKULL'});}
        break;
      case 'DIVE_BOMB':
        // Targeted dive across screen
        this.projectiles.push({x:W+UNIT*2, y:py-UNIT, vx:-900*sm, vy:0, grav:0, life:2, type:'SWOOP_TRAIL'});
        this.projectiles.push({x:W+UNIT*2, y:py+UNIT*2, vx:-800*sm, vy:0, grav:0, life:2, type:'SWOOP_TRAIL'});
        break;
    }
  }
  takeDamage(amount) {
    this.hp -= amount;
    this.flashTimer = 0.2;
    if (this.hp <= 0) { this.hp = 0; this.defeated = true; }
  }
  get hitbox() {
    return { x: this.x - UNIT * 2, y: this.y - UNIT * 2, w: UNIT * 4, h: UNIT * 5 };
  }
}

// ============================================================
// AMBIENT PARTICLES (theme-based)
// ============================================================
const ambients = [];
function updateAmbient(dt, type) {
  if (!type) { ambients.length = 0; return; }
  // Spawn new
  const _ambMax = _perfLevel === 0 ? 10 : _perfLevel === 1 ? 20 : 30;
  if (ambients.length < _ambMax && Math.random() < 0.3) {
    const a = { x: W + Math.random()*50, y: Math.random()*H*0.9, type };
    if (type==='SNOW') { a.vx = -40-Math.random()*60; a.vy = 40+Math.random()*50; a.r = 1+Math.random()*3; }
    else if (type==='EMBERS') { a.vx = -20-Math.random()*40; a.vy = -(30+Math.random()*60); a.r = 1+Math.random()*2; a.life=1; }
    else if (type==='FIREFLY') { a.vx = (Math.random()-.5)*30; a.vy = (Math.random()-.5)*20; a.r = 2; a.phase=Math.random()*PI2; }
    ambients.push(a);
  }
  for (let i = ambients.length-1; i >= 0; i--) {
    const a = ambients[i];
    a.x += (a.vx||0)*dt; a.y += (a.vy||0)*dt;
    if (a.phase !== undefined) a.phase += dt*3;
    if (a.life !== undefined) { a.life -= dt*0.4; if (a.life<=0) { ambients.splice(i,1); continue; } }
    if (a.x < -20 || a.y < -20 || a.y > H+20) { ambients.splice(i,1); }
  }
}
function drawAmbient(type) {
  for (const a of ambients) {
    if (type==='SNOW') { ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(a.x,a.y,a.r,0,PI2); ctx.fill(); }
    else if (type==='EMBERS') { ctx.fillStyle=`rgba(255,${100+Math.random()*80},0,${a.life||.7})`; ctx.beginPath(); ctx.arc(a.x,a.y,a.r,0,PI2); ctx.fill(); }
    else if (type==='FIREFLY') { const br=0.3+Math.sin(a.phase)*0.7; ctx.fillStyle=`rgba(180,255,50,${Math.max(0,br)})`; ctx.shadowColor='#AAFF33'; ctx.shadowBlur=8; ctx.beginPath(); ctx.arc(a.x,a.y,a.r,0,PI2); ctx.fill(); ctx.shadowBlur=0; }
  }
}

// ============================================================
// WORLD / CHUNKS
// ============================================================
const SAMPLE_D = 55;
let chunks = [], worldOffset = 0;

class Chunk {
  constructor(worldX, type, rng, diff, theme, script) {
    this.worldX = worldX; this.type = type;
    this.w = Math.round(W * 1.5);
    this.sampleCount = Math.ceil(this.w / SAMPLE_D) + 2;
    this.heights = []; this.obstacles = []; this.gems = []; this.powerup = null;
    this.script = script || null;
    this._gen(rng, diff, theme);
  }
  _gen(rng, diff, themeKey) {
    const sc = this.sampleCount, bY = GROUND_BASE;
    const script = this.script || null;
    // Heights
    if (this.type==='GAP') {
      const gs=rng.range(.32,.52), ge=gs+rng.range(.14,.26);
      for(let i=0;i<sc;i++){const t=i/(sc-1); this.heights.push((t>gs&&t<ge)?H+200:bY+rng.range(-UNIT*.3,UNIT*.3));}
    } else if (this.type==='HILLS') {
      const freq1=rng.range(1.5,3.5), freq2=rng.range(3,6), amp1=UNIT*rng.range(1.2,3), amp2=UNIT*rng.range(.4,1.2);
      for(let i=0;i<sc;i++){const t=i/(sc-1);
        this.heights.push(bY+Math.sin(t*Math.PI*freq1)*amp1+Math.sin(t*Math.PI*freq2+1.7)*amp2);}
    } else if (this.type==='VALLEY') {
      // Dips down in the middle, creating a valley
      for(let i=0;i<sc;i++){const t=i/(sc-1);
        const valley=Math.sin(t*Math.PI)*UNIT*rng.range(2,4);
        this.heights.push(bY+valley+rng.range(-UNIT*.15,UNIT*.15));}
    } else if (this.type==='RIDGE') {
      // Rises up in the middle, creating a ridge to jump over
      for(let i=0;i<sc;i++){const t=i/(sc-1);
        const ridge=-Math.sin(t*Math.PI)*UNIT*rng.range(1.5,3.5);
        this.heights.push(bY+ridge+rng.range(-UNIT*.1,UNIT*.1));}
    } else {
      // FLAT but with gentle undulations
      const drift=rng.range(-UNIT*.8,UNIT*.8);
      for(let i=0;i<sc;i++){const t=i/(sc-1);
        this.heights.push(bY+Math.sin(t*Math.PI*.8)*drift+rng.range(-UNIT*.25,UNIT*.25));}
    }
    for(let p=0;p<3;p++) for(let i=1;i<this.heights.length-1;i++)
      this.heights[i]=(this.heights[i-1]+this.heights[i]*2+this.heights[i+1])/4;

    // Obstacles
    if (this.type!=='GAP'&&this.type!=='GEM_RUN') {
      if (script && Array.isArray(script.obstacles)) {
        for (let i = 0; i < script.obstacles.length; i++) {
          const entry = script.obstacles[i];
          const lx = typeof entry.at === 'number' ? this.w * clamp(entry.at, 0.12, 0.88) : rng.range(this.w * 0.22, this.w * 0.78);
          const gnd = this.groundAt(lx);
          if (gnd > H * 0.9) continue;
          const type = entry.type || 'ROCK';
          this.obstacles.push({
            type,
            lx,
            ly: gnd,
            vx: type === 'BOULDER'
              ? rng.range(-320, -160)
              : type === 'LOG'
                ? rng.range(-180, -80)
                : 0
          });
        }
      } else if (!(script && script.allowObstacles === false)) {
        const slots = this.type==='GAUNTLET'?rng.int(3,6):rng.int(1,3);
        const sp = this.w/(slots+1);
        for(let s=0;s<slots;s++){
          const lx=sp*(s+1)+rng.range(-sp*.25,sp*.25);
          if(!rng.bool(diff.oChance))continue;
          const gnd=this.groundAt(lx); if(gnd>H*.9)continue;
          const pool=['ROCK','SPIKE','LOG']; if(diff.boulder)pool.push('BOULDER','BOULDER','FIRE_GEYSER');
          const t=rng.pick(pool);
          this.obstacles.push({type:t,lx,ly:gnd,vx:t==='BOULDER'?rng.range(-320,-160):t==='LOG'?rng.range(-180,-80):0});
        }
      }
      if((!script || script.allowPteros !== false) && diff.ptero&&rng.bool(.4))
        this.obstacles.push({type:'PTERO',lx:rng.range(this.w*.25,this.w*.75),
          ly:GROUND_BASE-UNIT*rng.range(2.8,5.5),phase:rng.range(0,PI2),amp:UNIT*rng.range(.9,2)});
    }
    // Gems
    if (this.type==='GEM_RUN') {
      const n=rng.int(4,7);
      for(let i=0;i<n;i++){const t=n>1?i/(n-1):0.5; const lx=this.w*.1+t*this.w*.8;
        const arc=Math.sin(t*Math.PI)*UNIT*rng.range(2,4.5);
        this.gems.push({lx,ly:this.groundAt(lx)-UNIT*.9-arc,collected:false});}
    } else if (this.type!=='GAP') {
      const n=rng.int(1,3);
      for(let i=0;i<n;i++){if(!rng.bool(diff.gChance))continue;
        const lx=rng.range(UNIT*2,this.w-UNIT*2); const gnd=this.groundAt(lx); if(gnd>H*.9)continue;
        this.gems.push({lx,ly:gnd-UNIT*rng.range(.9,2.8),collected:false});}
    }
  }
  groundAt(lx){
    const i=lx/SAMPLE_D; const i0=clamp(Math.floor(i),0,this.heights.length-1);
    const i1=clamp(i0+1,0,this.heights.length-1);
    return lerp(this.heights[i0],this.heights[i1],smooth(i-i0));
  }
  worldGroundAt(wx){ return this.groundAt(wx-this.worldX); }
  get rightEdge(){ return this.worldX+this.w; }
}

function pickChunkType(rng, diff, last) {
  const w={FLAT:Math.max(.3,2-diff.oChance*2),HILLS:1.5,GAP:last==='GAP'?0:diff.gapChance*4,
    GEM_RUN:diff.gChance*2,GAUNTLET:diff.oChance*2,VALLEY:1,RIDGE:diff.oChance*1.5};
  const total=Object.values(w).reduce((s,v)=>s+v,0);
  let r=rng.next()*total;
  for(const[type,wt]of Object.entries(w)){r-=wt;if(r<=0)return type;}
  return'FLAT';
}
function getNextChunkSpec(rng, diff, lastType) {
  if (shouldUseGuidedChunkPlan()) {
    const idx = G.guidedChunkCursor || 0;
    const guidedSpec = getGuidedChunkSpec(G.onboarding.level, idx);
    if (guidedSpec) {
      G.guidedChunkCursor = idx + 1;
      return guidedSpec;
    }
  }
  return { type: pickChunkType(rng, diff, lastType) };
}
function appendChunk(worldX, spec, rng, diff, theme) {
  const chunk = new Chunk(worldX, spec.type, rng, diff, theme, spec);
  chunks.push(chunk);
  return chunk;
}
function getGroundAt(wx){
  for(const c of chunks)if(wx>=c.worldX&&wx<=c.rightEdge)return c.worldGroundAt(wx);
  return GROUND_BASE;
}
function initWorld(rng,diff,theme){
  chunks=[]; worldOffset=0;
  G.guidedChunkCursor = 0;
  let x=0;
  if (shouldUseGuidedChunkPlan()) {
    while (chunks.length < 5) {
      const lastType = chunks.length ? chunks[chunks.length - 1].type : 'FLAT';
      const chunk = appendChunk(x, getNextChunkSpec(rng, diff, lastType), rng, diff, theme);
      x += chunk.w;
    }
    return;
  }
  // First chunk: safe (no obstacles)
  const safeC=new Chunk(x,'GEM_RUN',rng,diff,theme);chunks.push(safeC);x+=safeC.w;
  for(let i=0;i<2;i++){const c=new Chunk(x,'FLAT',rng,diff,theme);chunks.push(c);x+=c.w;}
  for(let i=0;i<2;i++){const t=pickChunkType(rng,diff,'FLAT');chunks.push(new Chunk(x,t,rng,diff,theme));x+=chunks[chunks.length-1].w;}
}
function updateWorld(dt,diff,speed,rng,theme){
  worldOffset+=speed*dt;
  while(chunks.length>1&&chunks[0].rightEdge<worldOffset-W*.3)chunks.shift();
  while(true){
    const last=chunks[chunks.length-1];
    if(last.rightEdge-worldOffset>=W*3.5)break;
    const spec = getNextChunkSpec(rng, diff, last.type);
    const nc=new Chunk(last.rightEdge,spec.type,rng,diff,theme,spec);
    chunks.push(nc);
    if(typeof G!=='undefined') G.levelTotalGems=(G.levelTotalGems||0)+nc.gems.length;
  }
}

// ============================================================
// ENEMIES  (personified, attack the player)
// ============================================================
const activeEnemies = [];
let enemySpawnCD = 0;

const ENEMY_HP = {TROLL:40,CHARGER:30,DIVER:20,WITCH:25,GOLEM:60,BOMBER:15,SERPENT:35};
class Enemy {
  constructor(type) {
    this.type = type; this.alive = true; this.phase = Math.random()*PI2;
    this.projectiles = [];
    this.screenX = 0; this.worldX = 0; this.y = 0;
    this.state = 'IDLE'; this.timer = 0; this.fireCD = 0;
    // HP system
    const baseHP = ENEMY_HP[type] || 30;
    const diffScale = G.levelDef ? levelDiffMult(G.levelDef.id) : 1;
    this.maxHP = Math.round(baseHP * (1 + (diffScale - 1) * 0.5));
    this.hp = this.maxHP;
    this.hpFlash = 0;
    this.dying = false;
    this.deathTimer = 0;
    // Telegraph system
    this.telegraphing = false;
    this.telegraphTimer = 0;
    // Type-specific
    if (type==='TROLL') {
      this.worldX = worldOffset + W*1.4 + Math.random()*W*.5;
      this.y = GROUND_BASE;
      this.fireInterval = 2.5+Math.random()*2;
    } else if (type==='CHARGER') {
      this.screenX = W+UNIT*3; this.y = GROUND_BASE;
      this.state = 'WARN'; this.timer = 0;
    } else if (type==='DIVER') {
      this.screenX = W+UNIT*4; this.y = H*.06;
      this.state = 'FLY'; this.vy = 0;
    } else if (type==='WITCH') {
      this.worldX = worldOffset + W*1.4 + Math.random()*W*.5;
      this.y = H*.32; this.fireInterval = 2+Math.random()*1.5;
    } else if (type==='GOLEM') {
      this.worldX = worldOffset + W*1.5 + Math.random()*W*.4;
      this.y = GROUND_BASE;
      this.fireInterval = 3+Math.random()*1.5; // shockwave interval
    } else if (type==='BOMBER') {
      this.screenX = W+UNIT*5; this.y = H*.12+Math.random()*H*.08;
      this.fireInterval = 1.5+Math.random()*1;
    } else if (type==='SERPENT') {
      this.screenX = W+UNIT*3; this.y = GROUND_BASE;
      this.state = 'SLITHER'; this.slitherPhase = 0; this._lastGoodY = GROUND_BASE;
    }
  }

  get sx() {
    return (this.type==='TROLL'||this.type==='WITCH'||this.type==='GOLEM') ? this.worldX-worldOffset : this.screenX;
  }
  get sy() {
    if (this.type==='TROLL') return this.y + Math.sin(this.phase*2)*UNIT*.15;
    if (this.type==='WITCH') return this.y + Math.sin(this.phase*1.2)*UNIT*1.5;
    if (this.type==='GOLEM') return this.y + Math.sin(this.phase)*UNIT*.3;
    return this.y;
  }

  update(dt, player, speed) {
    if(this.hpFlash>0) this.hpFlash-=dt;
    // Dying animation
    if(this.dying){
      this.deathTimer-=dt;
      if(this.deathTimer<=0){
        this.alive=false;
        const sx=this.sx,sy=this.sy;
        for(let i=0;i<12;i++)spawnParticle(sx,sy,{
          vx:(Math.random()-.5)*400,vy:-(Math.random()*300+50),
          color:'#FFAA44',r:UNIT*(.15+Math.random()*.15),decay:1.2,grav:500});
      }
      return; // Skip AI while dying
    }
    this.phase += dt*3;
    const psx = player.screenX, py = player.y;

    switch(this.type) {
      case 'TROLL': {
        this.y = getGroundAt(this.worldX);
        const sx = this.sx;
        if (sx < -UNIT*5) { this.alive=false; break; }
        if (sx < W+UNIT*2) {
          this.fireCD += dt;
          if (this.fireCD >= this.fireInterval && sx < W*.88) {
            if(!this.telegraphing){this.telegraphing=true;this.telegraphTimer=0.5;break;}
            this.telegraphTimer-=dt;
            if(this.telegraphTimer<=0){
              this.telegraphing=false;
              this.fireCD = 0; this.fireInterval = 2+Math.random()*2;
              this.projectiles.push({ x:sx-UNIT*1.2, y:this.sy-UNIT*1.5,
                vx:-260, vy:-50-Math.random()*30, grav:180, life:4, type:'ROCK_P' });
            }
          }
        }
        break;
      }
      case 'CHARGER': {
        if (this.state==='WARN') {
          this.timer+=dt;
          if (this.timer>1.2) { this.state='CHARGE'; this.screenX=W+UNIT*2; this.fireCD=0; }
        } else {
          this.screenX -= (speed+380)*dt;
          this.y = getGroundAt(this.screenX+worldOffset);
          // Kick debris while charging
          this.fireCD += dt;
          if (this.fireCD >= 0.6 && this.screenX < W*.9 && this.screenX > UNIT*2) {
            this.fireCD = 0;
            this.projectiles.push({ x:this.screenX-UNIT*1.5, y:this.y-UNIT*.3,
              vx:-280-Math.random()*120, vy:-180-Math.random()*80, life:2.5, type:'DEBRIS', grav:600 });
          }
          if (this.screenX < -UNIT*5) this.alive=false;
        }
        break;
      }
      case 'DIVER': {
        // Flies across the top, never dives — only shoots aimed feather darts
        this.screenX -= (speed*.5+90)*dt;
        // Bob gently up and down
        this.y = H*.1 + Math.sin(this.phase)*UNIT*1.2;
        if (this.screenX < -UNIT*6) { this.alive=false; break; }
        // Shoot aimed feather darts toward player
        this.fireCD = (this.fireCD||0) + dt;
        if (this.fireCD >= 0.9 && this.screenX < W*.9 && this.screenX > UNIT*2) {
          this.fireCD = 0;
          const dx = psx - this.screenX, dy = (py-UNIT) - this.y;
          const d = Math.sqrt(dx*dx+dy*dy);
          const spd = 280;
          this.projectiles.push({ x:this.screenX, y:this.y+UNIT*.3,
            vx: d>1 ? (dx/d)*spd : -200, vy: d>1 ? (dy/d)*spd : 100,
            life:4, type:'FEATHER', grav:80 });
        }
        break;
      }
      case 'WITCH': {
        const sx = this.sx;
        if (sx < -UNIT*5) { this.alive=false; break; }
        if (sx < W+UNIT*2) {
          this.fireCD += dt;
          if (this.fireCD >= this.fireInterval && sx < W*.85) {
            if(!this.telegraphing){this.telegraphing=true;this.telegraphTimer=0.6;break;}
            this.telegraphTimer-=dt;
            if(this.telegraphTimer<=0){
              this.telegraphing=false;
              this.fireCD = 0; this.fireInterval = 1.8+Math.random()*1.5;
              this.projectiles.push({ x:sx, y:this.sy,
                vx:-160, vy:0, life:5, type:'SKULL', homing:true });
            }
          }
        }
        break;
      }
      case 'GOLEM': {
        this.y = getGroundAt(this.worldX);
        const sx = this.sx;
        if (sx < -UNIT*5) { this.alive=false; break; }
        if (sx < W+UNIT*2) {
          this.fireCD += dt;
          if (this.fireCD >= this.fireInterval && sx < W*.9) {
            this.fireCD = 0; this.fireInterval = 2.5+Math.random()*1.5;
            var _atkR=Math.random();
            if (_atkR < 0.35) {
              this.projectiles.push({ x:sx-UNIT*1.5, y:this.y-UNIT*.3,
                vx:-420, vy:0, life:3, type:'SHOCKWAVE', grav:0 });
            } else if (_atkR < 0.7) {
              this.projectiles.push({ x:sx-UNIT*1.2, y:this.sy-UNIT*2.5,
                vx:-220, vy:-200, life:4, type:'BOULDER_P', grav:450 });
            } else {
              this.projectiles.push({ x:sx-UNIT*1.5, y:this.y-UNIT*.3,
                vx:-300, vy:0, life:5, type:'BOULDER_P', grav:0, _rolling:true });
            }
          }
        }
        break;
      }
      case 'BOMBER': {
        this.screenX -= (speed*.4+80)*dt;
        if (this.screenX < -UNIT*6) { this.alive=false; break; }
        this.fireCD += dt;
        if (this.fireCD >= this.fireInterval && this.screenX < W*.9 && this.screenX > UNIT*2) {
          this.fireCD = 0; this.fireInterval = 1.2+Math.random()*1;
          // Drop bomb downward
          this.projectiles.push({ x:this.screenX, y:this.y+UNIT*.5,
            vx:-30, vy:60, life:4, type:'BOMB', grav:500 });
        }
        break;
      }
      case 'SERPENT': {
        this.slitherPhase += dt*8;
        this.screenX -= (speed+200)*dt;
        var _sgY=getGroundAt(this.screenX+worldOffset);if(_sgY<H*0.9)this._lastGoodY=_sgY;this.y=(this._lastGoodY||_sgY)+Math.sin(this.slitherPhase)*UNIT*.15;
        if (this.screenX < -UNIT*5) { this.alive=false; break; }
        // Spit venom
        this.fireCD += dt;
        if (!this.fireInterval) this.fireInterval = 2+Math.random()*2;
        if (this.fireCD >= this.fireInterval && this.screenX < W*.85 && this.screenX > 0) {
          this.fireCD = 0; this.fireInterval = 2+Math.random()*1.5;
          this.projectiles.push({ x:this.screenX-UNIT, y:this.y-UNIT*.5,
            vx:-200, vy:-120, life:3, type:'VENOM', grav:250 });
        }
        break;
      }
    }

    // Update projectiles
    for (let i=this.projectiles.length-1;i>=0;i--) {
      const p = this.projectiles[i];
      if (p.homing) {
        const dx=psx-p.x, dy=(py-UNIT)-p.y;
        const d=Math.sqrt(dx*dx+dy*dy);
        if (d>1){
          const tA=Math.atan2(dy,dx), cA=Math.atan2(p.vy,p.vx);
          let da=tA-cA; while(da>Math.PI)da-=PI2; while(da<-Math.PI)da+=PI2;
          const nA=cA+clamp(da,-3*dt,3*dt); const spd=210;
          p.vx=Math.cos(nA)*spd; p.vy=Math.sin(nA)*spd;
        }
      } else if (p.grav) { p.vy += p.grav*dt; }
      p.x+=p.vx*dt; p.y+=p.vy*dt; p.life-=dt;
      if((p.type==='BOULDER_P'||p.type==='ROCK_P'||p.type==='BOMB')&&p.vy>0&&p.grav){var _bGY=getGroundAt(p.x+worldOffset);if(p.y>=_bGY){p.y=_bGY;if(Math.abs(p.vy)>40){p.vy*=-0.45;p.vx*=0.85;}else{p.vy=0;p.grav=0;p.vx*=0.92;}}}
      if(p.type==='BOULDER_P'&&p._rolling){var _rGY=getGroundAt(p.x+worldOffset);if(_rGY<H*0.95)p.y=_rGY-UNIT*.1;}
      if(p.x<-UNIT*3||p.y>H+UNIT*3||p.life<=0) this.projectiles.splice(i,1);
    }
  }

  get hitbox() {
    const sx=this.sx, sy=this.sy, u=UNIT;
    switch(this.type){
      case 'TROLL':   return{x:sx-u*.9,y:sy-u*2.5,w:u*1.8,h:u*2.5};
      case 'CHARGER': return{x:this.screenX-u*1.2,y:this.y-u*1.6,w:u*2.4,h:u*1.6};
      case 'DIVER':   return{x:this.screenX-u*1.5,y:this.y-u*.9,w:u*3,h:u*1.8};
      case 'WITCH':   return{x:sx-u*.8,y:sy-u*2.2,w:u*1.6,h:u*2.2};
      case 'GOLEM':   return{x:sx-u*1.2,y:sy-u*3,w:u*2.4,h:u*3};
      case 'BOMBER':  return{x:this.screenX-u*1.2,y:this.y-u*.6,w:u*2.4,h:u*1.2};
      case 'SERPENT':  return{x:this.screenX-u*1.5,y:this.y-u*.8,w:u*3,h:u*.8};
    }
    return{x:0,y:0,w:0,h:0};
  }

  takeDamage(amt) {
    if(this.dying||!this.alive) return;
    this.hp -= amt;
    this.hpFlash = 0.3;
    var _sx = this.sx || this.screenX || 0, _sy = this.sy || this.y || 0;
    _hitStop(clamp(0.028 + (amt / Math.max(20, this.maxHP || 20)) * 0.06, 0.028, 0.08));
    addTrauma(clamp(amt / Math.max(30, this.maxHP || 30), 0.06, 0.22), _sx > W * 0.55 ? 0.35 : -0.35, 0);
    spawnImpactBurst(_sx, _sy - UNIT * 1.2, '#FF8A5A', {
      count: 6 + Math.min(8, Math.round(amt / 5)),
      speed: UNIT * 7,
      size: 0.1,
      ringColor: 'rgba(255,230,180,0.28)'
    });
    spawnFloatingText(_sx, _sy - UNIT*2, '-' + amt, '#FF6644', 0.9);
    if(this.hp <= 0) {
      this.dying=true; this.deathTimer=0.4;
      comboAction(50,'enemy_kill');
      G.score+=50; G.runScore+=50;
      _hitStop(0.09);
      addTrauma(0.22, _sx > W * 0.55 ? 0.45 : -0.45, 0);
      spawnImpactBurst(_sx, _sy - UNIT, '#FFD86A', {
        count: 16,
        speed: UNIT * 10,
        size: 0.15,
        grav: 280,
        ringColor: 'rgba(255,255,255,0.32)'
      });
      spawnFloatingText(_sx, _sy - UNIT*3, 'KO +50', '#FFD700', 1.16);
      spawnDeathFX(_sx, _sy - UNIT);
      updateMissionProgress('enemiesKilled', 1);
    }
  }
}

function spawnEnemy(levelDef) {
  const t = levelDef.enemies[Math.floor(Math.random()*levelDef.enemies.length)];
  activeEnemies.push(new Enemy(t));
}

// ============================================================
// PLAYER
// ============================================================
class Player {
  constructor(charIdx) {
    const ch = CHARS[charIdx]; this.ch = ch; this.charIdx = charIdx;
    this.screenX = PLAYER_SX; this.worldX = PLAYER_SX + worldOffset;
    this.y = GROUND_BASE; this.vy = 0;
    this.onGround = false; this.jumpsLeft = 2;
    this.coyote = 0; this.jumpBuf = 0; this.downBuf = 0;
    this.squash = 1; this.stretch = 1; this.legAnim = 0;
    this.alive = true; this.deathTimer = 0;
    // Powerups
    this.shield = ch.startShield; this.magnetTimer = ch.startMagnet ? 999 : 0;
    this.starTimer = 0; this.starHue = 0; this.extraLife = false;
    this.iframes = 2.5; // start with brief invincibility on level begin
    // Slide
    this.slideTimer = 0; this.slideCD = 0;
    // Ground pound
    this.pounding = false; this.poundLanded = false;
    // Dash
    this.dashTimer = 0; this.dashCD = 0;
    // Parry
    this.parryTimer = 0; this.parryCD = 0;
    // Wheel powerups
    this.tinyTimer = 0; this.speedBoost = false; this.doubleScore = false;
    // HP system (apply shop +10 HP upgrade)
    const hpBonus = save.shopUpgrades&&save.shopUpgrades.up_hp ? 10 : 0;
    this.maxHP = ch.maxHP + hpBonus; this.hp = this.maxHP;
    this.hpFlash = 0; // red flash timer when taking damage
  }

  get hitbox() {
    let hm = this.ch.hitM;
    if (this.tinyTimer > 0) hm *= 0.6; // tiny hitbox from wheel powerup
    const hw = UNIT*.42*hm;
    let hh = UNIT*.9*hm;
    if (this.slideTimer > 0) hh *= 0.28; // very flat during slide
    return { x:this.screenX-hw, y:this.y-hh*2, w:hw*2, h:hh*2 };
  }

  update(dt) {
    if (!this.alive) { this.deathTimer+=dt; this.vy=0; return; }
    const ch = this.ch;
    if (inp.jp) { this.jumpBuf=7; inp.jp=false; }
    if (this.jumpBuf>0) this.jumpBuf--;
    if (this.coyote>0) this.coyote--;

    const gY = getGroundAt(this.worldX);
    const wasG = this.onGround;
    // Tolerance scales with fall speed to prevent pass-through on fast frames
    const landTol = Math.max(4, Math.abs(this.vy) * dt * 1.2);
    this.onGround = (this.y>=gY-landTol && this.vy>=0);
    if (this.onGround) {
      this.y=gY; this.vy=0; this.coyote=7; this.jumpsLeft=2;
      if (!wasG){
        // Perfect Land check: if player pressed jump just before landing
        if (this.jumpBuf > 0) {
          this.perfectLandTimer = 1.0;
          G.announce = {text:'PERFECT LAND! SPEED BOOST', life:0.8};
          comboAction(50, 'perfect_land');
          spawnFloatingText(this.screenX, this.y - UNIT*2, 'FAST!', '#44FF88', 0.8);
          sfxJump(); // extra boost sound
        }
        // Landing Juice
        this.squash=1.65; this.stretch=0.55; 
        addTrauma(0.12, 0, 1);
        spawnDustFX(this.screenX, this.y);
        // Landing impact rings/shockwave
        for(let i=0;i<8;i++) spawnParticle(this.screenX,this.y,{
          vx:(Math.random()-.5)*350,vy:-(Math.random()*60+20),
          color:'rgba(255,255,255,0.4)',r:UNIT*.12,decay:2.5,grav:180});
        sfxLand();
      }
    }

    if (this.jumpBuf>0) {
      if (this.coyote>0||this.jumpsLeft===2) {
        // Chain: Slide → Jump = "Launcher" (+30% height)
        let jvMult = 1;
        if (G.lastAction.type==='slide' && G.time-G.lastAction.time<1.5) {
          jvMult = 1.3; G.announce={text:'LAUNCHER!',life:0.8}; comboAction(75,'chain');
        }
        this.vy=ch.jumpV*jvMult; this.coyote=0;this.jumpBuf=0;
        if(this.jumpsLeft===2)this.jumpsLeft=1;
        this.squash=0.55; this.stretch=1.65;
        G.lastAction={type:'jump',time:G.time};
        noteGuidedAction('jump');
        sfxJump();
        // Jump dust
        spawnDustFX(this.screenX, this.y);
      } else if (this.jumpsLeft===1) {
        this.vy=ch.jumpV2; this.jumpsLeft=0;this.jumpBuf=0;
        G.lastAction={type:'doublejump',time:G.time};
        this.squash=0.6; this.stretch=1.5;
        sfxJump();
        for(let k=0;k<8;k++)spawnParticle(this.screenX,this.y-UNIT*.5,{color:'#88FFFF',r:UNIT*.18,decay:3,vx:(Math.random()-.5)*220,vy:Math.random()*80,grav:180});
      }
    }
    if (!inp.jh&&this.vy<-320) this.vy=-320;
    if (!this.onGround){ this.vy=Math.min(this.vy+ch.grav*dt,1100); this.y+=this.vy*dt; }
    if (this.y>H+UNIT*3){ this.hp=0; this.die('fall'); return; }

    this.worldX = this.screenX + worldOffset;
    // During slide, maintain compressed shape; otherwise spring back to normal
    if (this.slideTimer > 0) {
      this.squash=lerp(this.squash,2.2,8*dt); this.stretch=lerp(this.stretch,0.3,8*dt);
    } else {
      this.squash=lerp(this.squash,1,14*dt); this.stretch=lerp(this.stretch,1,14*dt);
    }
    if (this.onGround) this.legAnim+=dt*10;
    if (this.iframes>0) this.iframes-=dt;
    if (this.magnetTimer>0)this.magnetTimer-=dt;
    if (this.starTimer>0){this.starTimer-=dt;this.starHue=(this.starHue+720*dt)%360;}

    // Perfect Land timer
    if (this.perfectLandTimer > 0) this.perfectLandTimer -= dt;
    // HP flash
    if (this.hpFlash>0) this.hpFlash-=dt;
    // Wheel powerup timers
    if (this.tinyTimer>0) this.tinyTimer-=dt;
    // Slide timer & cooldown
    if (this.slideTimer>0) this.slideTimer-=dt;
    if (this.slideCD>0) this.slideCD-=dt;
    // Dash timer & cooldown
    if (this.dashTimer>0) {
      this.dashTimer-=dt; this.iframes=Math.max(this.iframes,0.05);
      // Quake Rush: destroy enemies in dash path
      if (this._quakeRush) {
        for(const en of activeEnemies){
          if(!en.alive) continue;
          const dx=en.screenX-this.screenX, dy=(en.y||0)-(this.y-UNIT);
          if(dx>-UNIT && dx<UNIT*4 && Math.abs(dy)<UNIT*2){
            en.takeDamage(en.maxHP); comboAction(50,'quake_kill');
            noteGuidedAction('dash_hit', { enemy_type: en.type, guided_source: 'quake_rush' });
            for(let j=0;j<10;j++)spawnParticle(en.screenX,en.y||this.y-UNIT,{
              vx:(Math.random()-.5)*400,vy:-(Math.random()*300+50),
              color:'#FFAA44',r:UNIT*(.15+Math.random()*.1),decay:1.8,grav:500});
          }
        }
      }
    }
    if (this.dashCD>0) this.dashCD-=dt;

    // Buffer down input for a few frames so ground pound registers more reliably
    if (inp.down) this.downBuf = 5;
    if (this.downBuf > 0) this.downBuf--;
    // Slide input (on ground, not already sliding)
    if ((inp.down || this.downBuf > 0) && this.onGround && this.slideTimer<=0 && this.slideCD<=0 && !this.pounding) {
      this.downBuf = 0;
      let slideDur = 0.6;
      // Chain: Dash → Slide = "Momentum Slide" (+50% duration, iframes)
      if (G.lastAction.type==='dash' && G.time-G.lastAction.time<1.5) {
        slideDur = 0.9; this.iframes=Math.max(this.iframes,0.9);
        G.announce={text:'MOMENTUM SLIDE!',life:0.8}; comboAction(75,'chain');
      }
      this.slideTimer=slideDur; this.slideCD=1.0;
      this.squash=2.4; this.stretch=0.25;
      spawnDustFX(this.screenX,this.y);
      sfxSlide();
      G.lastAction={type:'slide',time:G.time};
      noteGuidedAction('slide');
      if(save.stats) save.stats.slidesUsed++;
      updateMissionProgress('slidesUsed', 1);
      inp.down=false;
    }
    // Ground pound (down while airborne — also check buffer)
    else if ((inp.down || this.downBuf > 0) && !this.onGround && !this.pounding) {
      this.downBuf = 0;
      this.pounding=true; this.poundLanded=false;
      this.vy=900; // slam down fast
      inp.down=false;
    }
    // Ground pound landing
    if (this.pounding && this.onGround && !this.poundLanded) {
      this.poundLanded=true; this.pounding=false;
      addTrauma(0.4, 0, 1);
      _hitStop(0.08);
      this.squash=1.8;this.stretch=0.5;
      // Chain: Double-Jump → Pound = "Meteor" (2x shockwave radius handled in _poundSmash)
      this._meteorChain = (G.lastAction.type==='doublejump' && G.time-G.lastAction.time<2.0);
      if (this._meteorChain) { G.announce={text:'METEOR!',life:0.8}; comboAction(75,'chain'); }
      G.lastAction={type:'pound',time:G.time};
      noteGuidedAction('pound');
      spawnImpactBurst(this.screenX, this.y - UNIT * 0.2, this._meteorChain ? '#FF6C4D' : '#FFB05C', {
        count: this._meteorChain ? 20 : 14,
        speed: UNIT * (this._meteorChain ? 11 : 8.5),
        spreadY: 0.35,
        size: this._meteorChain ? 0.16 : 0.12,
        ringColor: 'rgba(255,245,230,0.28)'
      });
      // Shockwave particles
      const pNum = this._meteorChain ? 24 : 16;
      for(let i=0;i<pNum;i++){const a=(i/pNum)*PI2;
        spawnParticle(this.screenX,this.y,{vx:Math.cos(a)*300,vy:Math.sin(a)*120-80,color:this._meteorChain?'#FF4444':'#FFAA44',r:UNIT*.2,decay:2.5,grav:200});}
      // Destroy nearby ground obstacles
      this._poundSmash();
    }
    if (this.onGround) this.pounding=false;

    // Dash input — powerful forward burst, long iframes, destroys projectiles
    if (inp.dash && this.dashTimer<=0 && this.dashCD<=0) {
      let dashDur = 0.7;
      // Chain: Pound → Dash = "Quake Rush" (+0.4s duration, destroy enemies in path)
      if (G.lastAction.type==='pound' && G.time-G.lastAction.time<1.5) {
        dashDur = 1.1; this._quakeRush = true;
        G.announce={text:'QUAKE RUSH!',life:0.8}; comboAction(75,'chain');
      } else { this._quakeRush = false; }
      let baseDashCD = 1.8;
      if(save.achievementBonuses&&save.achievementBonuses.dashCD) baseDashCD -= 0.18;
      if(save.shopUpgrades&&save.shopUpgrades.up_dashcd) baseDashCD -= 0.2;
      this.dashTimer=dashDur; this.dashCD=baseDashCD;
      this.iframes=Math.max(this.iframes,dashDur+0.05);
      this.squash=0.55; this.stretch=1.85;
      addTrauma(this._quakeRush ? 0.35 : 0.2);
      _hitStop(this._quakeRush ? 0.05 : 0.03);
      spawnImpactBurst(this.screenX + UNIT * 0.4, this.y - UNIT * 0.9, this._quakeRush ? '#FFB35A' : '#8FD8FF', {
        count: this._quakeRush ? 16 : 10,
        speed: UNIT * (this._quakeRush ? 10 : 7.5),
        spreadY: 0.45,
        size: this._quakeRush ? 0.14 : 0.1,
        grav: 160,
        noRing: !this._quakeRush,
        ringColor: 'rgba(255,255,255,0.28)'
      });
      sfxDash();
      if(this._quakeRush) {
        G.flashColor='rgba(255,180,50,0.25)'; G.flashLife=0.3;
      }
      if(save.stats) save.stats.dashesUsed++;
      updateMissionProgress('dashesUsed', 1);
      // Destroy nearby enemy projectiles on dash start
      for(const en of activeEnemies){
        for(let i=en.projectiles.length-1;i>=0;i--){
          const pr=en.projectiles[i];
          const dx=pr.x-this.screenX, dy=pr.y-(this.y-UNIT);
          if(Math.sqrt(dx*dx+dy*dy)<UNIT*4){
            spawnParts(pr.x,pr.y,6,{color:'#88FFFF',r:UNIT*.15,decay:3,grav:200});
            en.projectiles.splice(i,1);
            comboAction(15, 'dash_destroy');
          }
        }
      }
      // Normal dash damages nearby enemies
      if(!this._quakeRush){
        for(const en of activeEnemies){
          if(!en.alive||en.dying) continue;
          const dx=en.sx-this.screenX, dy=(en.sy||en.y)-(this.y-UNIT);
          if(dx>-UNIT*2 && dx<UNIT*4 && Math.abs(dy)<UNIT*3){
            en.takeDamage(15);
            noteGuidedAction('dash_hit', { enemy_type: en.type, guided_source: 'dash_contact' });
          }
        }
      }
      G.lastAction={type:'dash',time:G.time};
      noteGuidedAction('dash');
      inp.dash=false;
    }

    // Parry input
    if(this.parryTimer>0) this.parryTimer-=dt;
    if(this.parryCD>0) this.parryCD-=dt;
    if(inp.parry && this.parryTimer<=0 && this.parryCD<=0){
      this.parryTimer=0.3; this.parryCD=1.5;
      this.squash=1.3; this.stretch=0.8;
      G.announce={text:'PARRY!',life:0.5};
    }
    inp.down=false; inp.dash=false; inp.parry=false;
  }

  _poundSmash() {
    // Destroy ROCK, SPIKE, LOG within range (Meteor chain = 2x radius, bonuses from achievements/shop)
    let baseRange = UNIT*3;
    if(save.achievementBonuses&&save.achievementBonuses.poundRadius) baseRange += UNIT*0.3;
    if(save.shopUpgrades&&save.shopUpgrades.up_pound) baseRange += UNIT*0.3;
    const smashRange = this._meteorChain ? baseRange*2 : baseRange;
    for(const chunk of chunks){
      const cx=chunk.worldX-worldOffset;
      for(let i=chunk.obstacles.length-1;i>=0;i--){
        const obs=chunk.obstacles[i];
        if(obs.type==='BOULDER'||obs.type==='PTERO'||obs.type==='FIRE_GEYSER')continue;
        const sx=cx+obs.lx;
        const dist=Math.abs(sx-this.screenX);
        if(dist<smashRange){
          // Destroy it with particles
          for(let j=0;j<8;j++)spawnParticle(sx,obs.ly-UNIT*.5,{
            vx:(Math.random()-.5)*350,vy:-(Math.random()*250+50),
            color:'#8a7a5a',r:UNIT*(.12+Math.random()*.15),decay:1.5,grav:600});
          chunk.obstacles.splice(i,1);
          comboAction(25, 'pound_smash');
          if(save.stats) save.stats.obstaclesSmashed++;
          updateMissionProgress('obstaclesSmashed', 1);
        }
      }
    }
    // Damage nearby enemies with pound
    for(const en of activeEnemies){
      if(!en.alive||en.dying) continue;
      const dx=en.sx-this.screenX, dy=(en.sy||en.y)-(this.y);
      if(Math.abs(dx)<smashRange && Math.abs(dy)<UNIT*3){
        en.takeDamage(20);
      }
    }
  }

  hit(dmgType) {
    const dmg = DMG[dmgType] || 20;
    this.takeDamage(dmg, dmgType);
  }

  takeDamage(amount, source) {
    if (this.starTimer>0) return;
    if (this.iframes>0) return;
    // Shield absorbs one full hit
    if (this.shield) {
      this.shield=false; this.iframes=1.5; addTrauma(.5, 0, 0);
      _hitStop(0.06);
      sfxShield();
      G.flashColor='rgba(100,180,255,0.3)'; G.flashLife=0.25;
      spawnImpactBurst(this.screenX, this.y - UNIT, '#8FD3FF', {
        count: 18,
        speed: UNIT * 8,
        grav: 0,
        size: 0.12,
        ringColor: 'rgba(255,255,255,0.42)'
      });
      for(let i=0;i<18;i++){const a=(i/18)*PI2;
        spawnParticle(this.screenX,this.y-UNIT,{vx:Math.cos(a)*200,vy:Math.sin(a)*200,color:'#88CCFF',r:UNIT*.2,decay:2.2,grav:0});}
      return;
    }
    // Apply damage
    this.hp -= amount;
    this.hpFlash = 0.4;
    sfxHit();
    comboBreak();
    this.iframes = 0.8;
    addTrauma(clamp(amount/50, 0.15, 0.6));
    _hitStop(clamp(amount / 420, 0.035, 0.085));
    G.flashColor = 'rgba(255,96,84,0.16)';
    G.flashLife = 0.16;
    spawnImpactBurst(this.screenX, this.y - UNIT, '#FF6464', {
      count: Math.min(18, 7 + Math.round(amount / 5)),
      speed: UNIT * 7.5,
      size: 0.12,
      ringColor: 'rgba(255,228,220,0.22)'
    });
    // Floating damage number on player
    spawnFloatingText(this.screenX, this.y - UNIT*2, '-' + amount, '#FF4444', 1.1);
    // Damage particles (red)
    for(let i=0;i<Math.min(amount/5,10);i++)
      spawnParticle(this.screenX,this.y-UNIT,{
        vx:(Math.random()-.5)*250,vy:-(Math.random()*200+50),
        color:'#FF4444',r:UNIT*(.1+Math.random()*.12),decay:2.5,grav:400});
    // Extra life saves from lethal
    if (this.hp <= 0 && this.extraLife) {
      this.extraLife=false; this.hp=Math.ceil(this.maxHP*0.5);
      this.iframes=2; addTrauma(.5);
      _hitStop(0.08);
      G.announce={text:'EXTRA LIFE!',life:1.5};
      spawnImpactBurst(this.screenX, this.y - UNIT, '#FF88FF', {
        count: 16,
        speed: UNIT * 8.5,
        grav: 240,
        ringColor: 'rgba(255,255,255,0.28)'
      });
      for(let i=0;i<14;i++) spawnParticle(this.screenX,this.y-UNIT,{color:'#FF88FF',r:UNIT*.22,decay:2,grav:300});
      return;
    }
    if (this.hp <= 0) { this.hp=0; this.die('damage'); }
  }
  die(cause) {
    if(!this.alive)return; this.alive=false;
    G._lastDeathCause = cause || 'unknown';
    spawnDeathFX(this.screenX,this.y-UNIT); addTrauma(1);
    sfxDeath();
  }
}

// ============================================================
// INPUT
// ============================================================
const inp = { jp:false, jh:false, tapX:0, tapY:0, tapped:false, down:false, dash:false, parry:false, pressing:false };
function jDown(){ inp.jp=true; inp.jh=true; }
function jUp(){ inp.jh=false; }
function dDown(){ inp.down=true; }

// Swipe gesture tracking
let touchSX=0, touchSY=0, touchST=0, touchActive=false;
// Swipe threshold scales with screen size (3% of smaller dimension, min 20px, max 50px)
function getSwipeThresh() { return clamp(Math.min(W, H) * 0.03, 20, 50); }
const SWIPE_TIME = 300;  // max ms for a swipe gesture

document.addEventListener('keydown',e=>{
  if(['Space','ArrowUp','KeyW'].includes(e.code)){if(!e.repeat)jDown();else inp.jh=true;e.preventDefault();}
  if(['ArrowDown','KeyS'].includes(e.code)){if(!e.repeat)dDown();e.preventDefault();}
  if(e.code==='ShiftLeft'||e.code==='ShiftRight'){if(!e.repeat)inp.dash=true;e.preventDefault();}
  if(e.code==='KeyQ'||e.code==='KeyA'){if(!e.repeat)inp.parry=true;e.preventDefault();}
  if(!e.repeat) inp.tapped=true;
});
document.addEventListener('keyup',e=>{if(['Space','ArrowUp','KeyW'].includes(e.code))jUp();});

canvas.addEventListener('touchstart',e=>{
  e.preventDefault();
  if(e.touches.length){
    touchSX=e.touches[0].clientX; touchSY=e.touches[0].clientY;
    touchST=Date.now(); touchActive=true;
    inp.tapX=touchSX; inp.tapY=touchSY;
    inp.jh=true; inp.pressing=true; // hold state for variable jump height
    ensureAudio();
    // Pause icon tap check (top-right area, enlarged touch target, offset left for Android nav)
    if(G.phase==='PLAYING' && touchSX > W - UNIT*6.5 && touchSX < W - UNIT*0.5 && touchSY < UNIT*3.5) {
      G.phase='PAUSED'; touchActive=false; inp.jh=false; return;
    }
    // Speaker icon tap check (top-left area in menus and HUD)
    if(checkSpeakerTap(touchSX, touchSY, SAFE_LEFT+UNIT*0.3, SAFE_TOP+UNIT*0.15, UNIT*1.2)) {
      soundMuted = !soundMuted; sfxUITap(); touchActive=false; return;
    }
    // Level map scroll
    if(G.phase==='LEVEL_MAP'){mapTouchStartY=touchSY;mapTouchLastY=touchSY;mapScrolling=false;}
  }
  inp.tapped=true;
},{passive:false});

canvas.addEventListener('touchmove',e=>{
  e.preventDefault();
  if(!touchActive||!e.touches.length) return;
  const curX=e.touches[0].clientX, curY=e.touches[0].clientY;
  // Level map scrolling (inverted: swipe down moves page up, swipe up moves page down)
  if(G.phase==='LEVEL_MAP'){
    const dy=curY-mapTouchLastY; // inverted direction
    G.mapTargetScrollY+=dy;
    mapTouchLastY=curY;
    if(Math.abs(curY-mapTouchStartY)>10) mapScrolling=true;
    return;
  }
  // Stats scrolling
  if(G.phase==='STATS'){
    const dy=mapTouchLastY-curY;
    const maxStatsScroll = Math.max(0, (G._statsContentH || 0) - (G._statsViewportH || 0));
    G.statsTargetScrollY = clamp((G.statsTargetScrollY||0)+dy, 0, maxStatsScroll);
    mapTouchLastY=curY;
    return;
  }
  const dx=curX-touchSX;
  const dy=curY-touchSY;
  const dt=Date.now()-touchST;
  if(dt>SWIPE_TIME) return; // too slow, not a swipe
  const st = getSwipeThresh();
  // Flick up
  if(dy < -st && Math.abs(dy)>Math.abs(dx)){
    jDown(); touchActive=false;
  }
  // Flick down
  else if(dy > st && Math.abs(dy)>Math.abs(dx)){
    dDown(); touchActive=false;
  }
  // Flick right = dash
  else if(dx > st && Math.abs(dx)>Math.abs(dy)){
    inp.dash=true; touchActive=false;
  }
  // Flick left = parry
  else if(dx < -st && Math.abs(dx)>Math.abs(dy)){
    inp.parry=true; touchActive=false;
  }
},{passive:false});

canvas.addEventListener('touchend',e=>{
  e.preventDefault();
  inp.pressing=false;
  const dt=Date.now()-touchST;
  // Level map: only register tap if not scrolling
  if(G.phase==='LEVEL_MAP'){
    if(!mapScrolling && dt<300){inp.tapped=true;inp.tapX=touchSX;inp.tapY=touchSY;}
    mapScrolling=false;touchActive=false;jUp();return;
  }
  // Short tap with no swipe = jump (fallback for quick taps)
  if(touchActive && dt<SWIPE_TIME){
    jDown();
    // Auto-release jump press after a short delay for tap jumps
    setTimeout(()=>jUp(),150);
  }
  jUp(); touchActive=false;
},{passive:false});

canvas.addEventListener('mousedown',e=>{
  inp.tapX=e.clientX;inp.tapY=e.clientY;
  ensureAudio();
  // Pause icon (top-right area, offset left to avoid Android nav)
  if(G.phase==='PLAYING' && e.clientX > W - UNIT*6.5 && e.clientX < W - UNIT*0.5 && e.clientY < UNIT*3.5) {
    G.phase='PAUSED'; return;
  }
  // Speaker icon toggle
  if(checkSpeakerTap(e.clientX, e.clientY, SAFE_LEFT+UNIT*0.3, SAFE_TOP+UNIT*0.15, UNIT*1.2)) {
    soundMuted=!soundMuted; sfxUITap(); return;
  }
  jDown();
  inp.tapped=true;
});
canvas.addEventListener('mouseup',jUp);

// (visibilitychange listener is at top of file, no duplicate needed)

// ============================================================
// GAME STATE
// ============================================================
// Phases: LOADING, MENU, DAILY_REWARD, LEVEL_MAP, CHAR_SELECT, SKINS, LEVEL_INTRO, PLAYING, PAUSED, TUTORIAL, LEVEL_COMPLETE, BOSS_FIGHT, DEAD, CONTINUE_PROMPT, SPIN_WHEEL, STATS
const G = {
  phase:'LOADING', levelNum:1, levelDef:null, theme:null,
  loadingTimer: 0,
  time:0, timeLeft:35, speed:200, diff:null, rng:null,
  player:null, gems:0, runGems:0, score:0, runScore:0,
  newHigh:false, lastUpgrade:-1, deathDelay:0,
  _deathTracked:false, _lastDeathCause:null,
  announce:null, flashColor:null, flashLife:0,
  selectedChar:0, introTimer:0,
  levelCompleteTimer:0,
  // Continue system
  continuesLeft:2, continuePromptTimer:0,
  // Spin wheel
  wheelAngle:0, wheelSpinning:false, wheelSpeed:0, wheelResult:null, wheelTimer:0,
  // Level map
  mapScrollY:0, mapTargetScrollY:0,
  // Daily reward
  dailyRewardType:null, dailyRewardTimer:0, dailyRewardClaimed:false,
  // Post-level transitions
  _nextLevelNum:0, _pendingWheelResult:null, _postWheelDest:null,
  // Combo system
  combo:0, comboTimer:0, comboMult:1, comboPulse:0,
  // Move chaining
  lastAction:{type:null, time:0},
  // Stats scroll
  statsScrollY:0, statsTargetScrollY:0,
  // Screen transition fade
  fadeAlpha:0, fadeDir:0, fadeCallback:null,
  // Hit-stop
  hitStop:0,
  // Guided onboarding for the first three levels
  onboarding:null,
  guidedChunkCursor:0,
};

// Smooth phase transition: fade out → change phase → fade in
function transitionTo(newPhase, callback) {
  G.fadeDir = 1; // fading out
  G.fadeCallback = () => {
    G.phase = newPhase;
    if (callback) callback();
    G.fadeDir = -1; // fading in
  };
}
function updateFade(dt) {
  if (G.fadeDir === 0) return;
  G.fadeAlpha += G.fadeDir * dt * 5; // 0.2s fade (snappier)
  if (G.fadeAlpha >= 1 && G.fadeDir === 1) {
    G.fadeAlpha = 1;
    G.fadeDir = 0;
    if (G.fadeCallback) { G.fadeCallback(); G.fadeCallback = null; }
  }
  if (G.fadeAlpha <= 0 && G.fadeDir === -1) {
    G.fadeAlpha = 0; G.fadeDir = 0;
  }
}
function drawFade() {
  if (G.fadeAlpha > 0.01) {
    ctx.fillStyle = `rgba(0,0,0,${G.fadeAlpha})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function calculateLevelStars() {
  const p = G.player;
  if(!p) return;
  let stars = 1; // completed = 1 star
  const hpPct = p.hp / p.maxHP;
  if(hpPct >= 0.5) stars = 2;
  const gemPct = G.levelTotalGems > 0 ? G.levelGemsCollected / G.levelTotalGems : 1;
  if(hpPct >= 0.5 && gemPct >= 0.8) stars = 3;
  const prev = save.levelStars[G.levelNum] || 0;
  if(stars > prev){
    save.levelStars[G.levelNum] = stars;
    if(stars===3 && prev<3) save.totalGems += 5; // bonus for first 3-star
    persistSave();
  }
  G._levelStarsEarned = stars; // for display on completion screen
}

function startLevel(levelNum) {
  G.phase='LEVEL_INTRO'; G.levelNum=levelNum;
  G.levelDef=getLevelDef(levelNum);
  G.theme=THEMES[G.levelDef.theme];
  trackLevelStart(levelNum);
  G.flashColor='rgba(255,255,255,0.45)'; G.flashLife=0.5;
  startMusic(G.levelDef.theme);
  G.introTimer=0;
  G.time=0; G.timeLeft=28; G.deathDelay=0;
  G._deathTracked=false; G._lastDeathCause=null;
  G.diff=getDiff(0,getLevelOpeningMultiplier(G.levelDef));
  G.selectedChar = clamp(G.selectedChar || 0, 0, CHARS.length - 1);
  G.speed=G.diff.speed*CHARS[G.selectedChar].spdM;
  G.rng=new RNG(Date.now()^(Math.random()*0x7FFFFFFF|0));
  G.announce=null; G.flashColor=null; G.flashLife=0;
  inp.jp=inp.jh=false; inp.tapped=false;
  particles.length=0; activeEnemies.length=0; ambients.length=0;
  trauma=0; enemySpawnCD=getLevelEnemyDelay(G.levelDef); nearMissCD=0;
  configureGuidedLevel(levelNum);
  initWorld(G.rng,G.diff,G.levelDef.theme);
  // Count total gems for star rating
  G.levelTotalGems=0;
  for(const c of chunks) G.levelTotalGems+=c.gems.length;
  G.levelGemsCollected=0;
  G.player=new Player(G.selectedChar);
  G.gems = CHARS[G.selectedChar].startGems;
  G.lastUpgrade=-1;
  // Re-apply gem upgrades from previous levels in this run
  checkGemUpgrades(true);
  // Apply daily powerup if any
  if(save.dailyPowerup){
    applyWheelPowerup(save.dailyPowerup);
    save.dailyPowerup=null; persistSave();
  }
  // Apply shop per-run powerups (consumed once)
  if(save.nextRunPowerups && save.nextRunPowerups.length>0){
    const p = G.player;
    for(const pw of save.nextRunPowerups){
      if(pw==='shield') p.shield=true;
      else if(pw==='magnet') p.magnetTimer=999;
      else if(pw==='extra_life') p.extraLife=true;
      else if(pw==='time_10') G.timeLeft+=10;
    }
    save.nextRunPowerups=[]; persistSave();
  }
  initBg();
  triggerLevelTooltips(levelNum);
}

function startNewRun() {
  G.endless=false; G.dailyChallenge=false;
  G.runGems=0; G.runScore=0; G.gems=0;
  G.newHigh=false; G.lastUpgrade=-1;
  G._deathTracked=false; G._lastDeathCause=null;
  adDoubleGemsUsed=false; adDeathCount=0; // reset ad state for new run
  G.continuesLeft = 2 + (save.shopUpgrades&&save.shopUpgrades.up_continue ? 1 : 0);
  G.wheelResult=null;
  G._nextLevelNum=0; G._pendingWheelResult=null;
  G.combo=0; G.comboTimer=0; G.comboMult=1; G.comboPulse=0;
  boss=null;
  startLevel(1);
}

function startDailyChallenge() {
  const today = localDateStr(new Date());
  // Generate seed from date string
  let seed = 0;
  for(let i=0;i<today.length;i++) seed = ((seed<<5)-seed+today.charCodeAt(i))|0;
  seed = Math.abs(seed);

  G.endless=false; G.dailyChallenge=true;
  G.runGems=0; G.runScore=0; G.gems=0;
  G.newHigh=false; G.lastUpgrade=-1;
  G._deathTracked=false; G._lastDeathCause=null;
  G.continuesLeft=0; // no continues in daily
  G.wheelResult=null; G._nextLevelNum=0; G._pendingWheelResult=null;
  G.combo=0; G.comboTimer=0; G.comboMult=1; G.comboPulse=0;
  boss=null;

  // Fixed character rotates daily
  const dayIdx = Math.floor(Date.now()/(24*60*60*1000));
  const charIdx = dayIdx % CHARS.length;
  G.selectedChar = charIdx;

  // Fixed theme rotates daily
  const themeKeys = ['JUNGLE','VOLCANO','GLACIER','SWAMP','SKY'];
  const themeKey = themeKeys[dayIdx % themeKeys.length];

  G.phase='LEVEL_INTRO'; G.levelNum=1;
  G.levelDef={name:'Daily Challenge', theme:themeKey, targetTime:90, enemies:['TROLL','SERPENT','CHARGER','GOLEM','DIVER','WITCH','BOMBER']};
  G.theme=THEMES[themeKey];
  G.introTimer=0;
  G.time=0; G.timeLeft=90; G.deathDelay=0;
  // Streak bonus: higher streak = more gems earned
  G._dailyStreakBonus = Math.min(2.0, 1.0 + (save.dailyStreak - 1) * 0.1); // +10% per streak day, max 2x
  G.diff=getDiff(0, 1.3); // slightly harder
  G.speed=G.diff.speed*CHARS[charIdx].spdM;
  G.rng=new RNG(seed); // deterministic seed
  G.flashColor='rgba(255,255,255,0.5)'; G.flashLife=0.6;
  G.announce=null;
  inp.jp=inp.jh=false; inp.tapped=false;
  particles.length=0; activeEnemies.length=0; ambients.length=0;
  trauma=0; enemySpawnCD=6; nearMissCD=0;
  initWorld(G.rng,G.diff,G.levelDef.theme);
  G.levelTotalGems=0; G.levelGemsCollected=0;
  for(const c of chunks) G.levelTotalGems+=c.gems.length;
  G.player=new Player(charIdx);
  G.gems=CHARS[charIdx].startGems;
  G.lastUpgrade=-1;
  checkGemUpgrades(true);
  initBg();
}

function startEndlessMode() {
  G.endless=true; G.endlessTime=0; G.endlessThemeIdx=0; G.endlessBossTimer=180;
  G.runGems=0; G.runScore=0; G.gems=0;
  G.newHigh=false; G.lastUpgrade=-1;
  G.continuesLeft=0; // no continues in endless
  G.wheelResult=null; G._nextLevelNum=0; G._pendingWheelResult=null;
  G.combo=0; G.comboTimer=0; G.comboMult=1; G.comboPulse=0;
  boss=null;
  G.selectedChar = safeSelectedChar();
  // Use first theme, start level 1 mechanics
  G.phase='LEVEL_INTRO'; G.levelNum=1;
  G.levelDef={name:'Endless', theme:'JUNGLE', targetTime:9999, enemies:['TROLL','SERPENT','CHARGER','GOLEM','DIVER','WITCH','BOMBER']};
  G.theme=THEMES['JUNGLE'];
  G.introTimer=0;
  G.time=0; G.timeLeft=60; G.deathDelay=0;
  G.diff=getDiff(0, 1.0);
  G.speed=G.diff.speed*CHARS[G.selectedChar].spdM;
  G.rng=new RNG(Date.now()^(Math.random()*0x7FFFFFFF|0));
  G.announce=null; G.flashColor=null; G.flashLife=0;
  inp.jp=inp.jh=false; inp.tapped=false;
  particles.length=0; activeEnemies.length=0; ambients.length=0;
  trauma=0; enemySpawnCD=6; nearMissCD=0;
  initWorld(G.rng,G.diff,G.levelDef.theme);
  G.levelTotalGems=0; G.levelGemsCollected=0;
  for(const c of chunks) G.levelTotalGems+=c.gems.length;
  G.player=new Player(G.selectedChar);
  G.gems=CHARS[G.selectedChar].startGems;
  G.lastUpgrade=-1;
  checkGemUpgrades(true);
  initBg();
}

function milestoneCount(m, gems) {
  if (gems < m.first) return 0;
  return 1 + (m.repeat > 0 ? Math.floor((gems - m.first) / m.repeat) : 0);
}
function applyUpgrade(m, p) {
  if (m.type==='SHIELD') p.shield=true;
  if (m.type==='MAGNET') p.magnetTimer=999;
  if (m.type==='EXTRA_LIFE') p.extraLife=true;
  if (m.type==='STAR') { p.starTimer=10; p.starHue=0; }
}
function checkGemUpgrades(silent) {
  const g = G.runGems, p = G.player;
  if (!p) return;
  if (silent) {
    // Re-apply all earned upgrades (e.g. on level start)
    for (const m of GEM_MILESTONES) { if (g >= m.first) applyUpgrade(m, p); }
    return;
  }
  // Check if a new milestone was just crossed
  for (const m of GEM_MILESTONES) {
    const now = milestoneCount(m, g), prev = milestoneCount(m, g - 1);
    if (now > prev) {
      applyUpgrade(m, p);
      var _mName = {SHIELD:'SHIELD UNLOCKED!',MAGNET:'GEM MAGNET!',EXTRA_LIFE:'EXTRA LIFE!',STAR:'STAR POWER!'}[m.type];
      if (_mName) showAnnouncement(_mName, '#FFD700');
      G.announce={text:m.label,life:2};
      G.flashColor='rgba(255,215,0,0.35)'; G.flashLife=.4;
      addTrauma(.15);
    }
  }
}

// ============================================================
// COLLISION
// ============================================================
function aabb(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}

let nearMissCD = 0; // cooldown to avoid spamming
function checkCollisions(dt) {
  const p=G.player; if(!p||!p.alive)return;
  const phb=p.hitbox;
  if (nearMissCD>0) nearMissCD-=dt;

  // Chunk obstacles
  for(const chunk of chunks){
    const cx=chunk.worldX-worldOffset;
    for(const obs of chunk.obstacles){
      const sx=obs.type==='PTERO'?cx+obs.lx:cx+obs.lx;
      if(sx<-UNIT*4||sx>W+UNIT*4)continue;
      let sy=obs.ly, ow, oh;
      if(obs.type==='PTERO'){sy=obs.ly+Math.sin(G.time*2.2+obs.phase)*obs.amp;ow=UNIT*2.2;oh=UNIT*.9;}
      else if(obs.type==='BOULDER'){ow=UNIT*1.8;oh=UNIT*1.8;}
      else if(obs.type==='ROCK'){ow=UNIT*1.4;oh=UNIT*1.1;}
      else if(obs.type==='LOG'){ow=UNIT*1.8;oh=UNIT*1.1;}
      else if(obs.type==='FIRE_GEYSER'){
        const erupt=Math.sin(G.time*4+obs.lx*.02);
        if(erupt<=0){continue;}
        ow=UNIT*.7;oh=UNIT*(0.3+erupt*2.5);
      }
      else{ow=UNIT*.7;oh=UNIT*1;}
      const obsHB={x:sx-ow/2,y:sy-oh,w:ow,h:oh};
      if(aabb(phb,obsHB)){p.hit(obs.type);return;}
      // Near-miss check (expanded hitbox, ~1.5x wider)
      if(nearMissCD<=0 && !obs._missed){
        const nearHB={x:obsHB.x-UNIT*.4,y:obsHB.y-UNIT*.4,w:obsHB.w+UNIT*.8,h:obsHB.h+UNIT*.8};
        if(aabb(phb,nearHB)){
          obs._missed=true; nearMissCD=0.8;
          triggerSlowMo(0.15);
          G.combo += 2; // near-miss gives +2 combo
          const nm = comboAction(25, 'near_miss');
          G.announce={text:`CLOSE! +${nm}`,life:0.8};
          if(save.stats) save.stats.enemiesDodged++;
        }
      }
    }
    // Gems
    for(const gem of chunk.gems){
      if(gem.collected)continue;
      let sx=cx+gem.lx; if(sx<-UNIT*2||sx>W+UNIT*2)continue;
      // Magnet pull
      if(p.magnetTimer>0){
        const dx=p.screenX-sx,dy=(p.y-UNIT*.8)-gem.ly;
        const d=Math.sqrt(dx*dx+dy*dy);
        const magR = save.achievementBonuses&&save.achievementBonuses.magnetRange ? UNIT*11.5 : UNIT*10;
        if(d<magR&&d>1){gem.lx+=(dx/d)*G.speed*3.5*dt;gem.ly+=(dy/d)*G.speed*3.5*dt;}
        gem.lx=clamp(gem.lx,0,chunk.w); gem.ly=clamp(gem.ly,0,H);
        sx=cx+gem.lx; // recalculate after pull
      }
      const sy=gem.ly+Math.sin(G.time*3+gem.lx*.01)*UNIT*.18;
      if(aabb(phb,{x:sx-UNIT*.55,y:sy-UNIT*.55,w:UNIT*1.1,h:UNIT*1.1})){
        gem.collected=true; G.gems++; G.runGems++; G.levelGemsCollected++;
        // Gem juice: floating +1 text
        var _gemSX = cx+gem.lx, _gemSY = gem.ly;
        spawnFloatingText(_gemSX, _gemSY, '+1', `hsl(${G.theme.gemH},100%,70%)`, 0.8);
        updateMissionProgress('gemsCollected', 1);
        const _prevTime = G.timeLeft;
        G.timeLeft=Math.min(G.timeLeft+(G.endless?3:5),99);
        if (G.timeLeft >= 99 && _prevTime < 99) spawnFloatingText(W/2, H*0.15, 'TIME MAX!', '#4488FF', 1.2);
        comboAction(50, 'gem');
        sfxGem();
        // Heal 5 HP per gem
        if(p.hp<p.maxHP){p.hp=Math.min(p.hp+5,p.maxHP);}
        spawnGemFX(sx,sy,G.theme.gemH); addTrauma(.06);
        checkGemUpgrades(false);
      }
    }
  }

  // Active enemies
  for(const en of activeEnemies){
    if(!en.alive)continue;
    // Body collision (charger only when charging, bomber never — only bombs hit)
    if(en.type==='BOMBER') { /* body doesn't hit, only bombs */ }
    else if(en.type==='CHARGER'&&en.state!=='CHARGE') { /* skip body during WARN, still check projectiles below */ }
    else if(aabb(phb,en.hitbox)){p.hit(en.type);return;}
    // Projectile collision (with parry deflection)
    for(let i=en.projectiles.length-1;i>=0;i--){
      const pr=en.projectiles[i];
      const prSz=pr.type==='BOULDER_P'?1.2:pr.type==='BOMB'?1.0:pr.type==='ROCK_P'?0.9:pr.type==='SKULL'?0.7:pr.type==='VENOM'?0.6:pr.type==='FEATHER'?0.5:0.8;
      const prHB={x:pr.x-UNIT*prSz*.5,y:pr.y-UNIT*prSz*.5,w:UNIT*prSz,h:UNIT*prSz};
      // Parry: deflect nearby projectiles
      if(p.parryTimer>0){
        const dx=pr.x-p.screenX, dy=pr.y-(p.y-UNIT);
        if(Math.sqrt(dx*dx+dy*dy)<UNIT*2.2){
          const isPerfect = p.parryTimer > 0.22; // very early in the window
          en.projectiles.splice(i,1);
          comboAction(isPerfect ? 200 : 100, 'parry');
          G.announce={text:isPerfect ? 'PERFECT PARRY!' : 'DEFLECT!', life:0.8};
          addTrauma(isPerfect ? 0.3 : 0.15);
          _hitStop(isPerfect ? 0.12 : 0.04);
          // Damage the enemy
          if(en.alive&&!en.dying){
            en.takeDamage(isPerfect ? Math.ceil(en.maxHP * 0.5) : Math.ceil(en.maxHP * 0.25));
            comboAction(isPerfect ? 100 : 50, 'parry_kill');
            if (isPerfect) {
               // Perfect parry shockwave (visual)
               for(let k=0;k<12;k++){const a=(k/12)*PI2;spawnParticle(pr.x,pr.y,{vx:Math.cos(a)*400,vy:Math.sin(a)*400,color:'#FFFF88',r:UNIT*.25,decay:1.5,grav:0});}
            }
          }
          spawnParts(pr.x,pr.y,8,{color:'#FFFF44',r:UNIT*.2,decay:2,grav:300});
          continue;
        }
      }
      if(aabb(phb,prHB)){en.projectiles.splice(i,1);p.hit(pr.type);return;}
    }
  }
}

// ============================================================
// BACKGROUND
// ============================================================
let bgMtPts=[], bgHlPts=[], bgTotalW=0;
function initBg(){
  const tw=W*8;bgTotalW=tw;
  bgMtPts=[{x:0,y:GROUND_BASE+10}];bgHlPts=[{x:0,y:GROUND_BASE+10}];
  const mtN=12,hlN=20;
  for(let i=0;i<=mtN;i++)bgMtPts.push({x:i*tw/mtN+(Math.random()-.5)*tw/mtN*.5,y:GROUND_BASE-H*.28-Math.random()*H*.22});
  for(let i=0;i<=hlN;i++)bgHlPts.push({x:i*tw/hlN+(Math.random()-.5)*tw/hlN*.5,y:GROUND_BASE-H*.08-Math.random()*H*.2});
  bgMtPts.push({x:tw,y:GROUND_BASE+10}); bgHlPts.push({x:tw,y:GROUND_BASE+10});
}

// Cached decoration positions per theme (seeded for consistency)
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
  // Foreground layer (in front of player)
  if (defs.fg) {
    for (var i = 0; i < 6; i++) {
      decos.push({ layer: 3, x: rng.next() * 1500, fn: defs.fg[i % defs.fg.length], scale: 0.9 + rng.next() * 0.5, parallax: 0.55 });
    }
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
    var tw = layerIdx === 0 ? 3000 : layerIdx === 1 ? 2500 : layerIdx === 2 ? 2000 : 1500;
    var off = (worldOffset * d.parallax) % tw;
    var sx = d.x - off;
    // Wrap around
    while (sx < -u * 4) sx += tw;
    while (sx > W + u * 4) sx -= tw;
    if (sx < -u * 5 || sx > W + u * 5) continue;
    var baseY = GROUND_BASE - u * (layerIdx === 0 ? 4 : layerIdx === 1 ? 2 : layerIdx === 2 ? 0.5 : -0.5);
    ctx.globalAlpha = layerIdx === 0 ? 0.2 : layerIdx === 1 ? 0.45 : layerIdx === 2 ? 0.7 : 0.25;
    d.fn(ctx, sx, baseY, u, d.scale);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawBg(theme){
  // Sky gradient
  const sk=ctx.createLinearGradient(0,0,0,H);
  sk.addColorStop(0,theme.sky[0]);sk.addColorStop(.55,theme.sky[1]);sk.addColorStop(1,theme.sky[2]);
  ctx.fillStyle=sk;ctx.fillRect(0,0,W,H);

  // Twinkling stars (all themes except SKY)
  if(theme!==THEMES.SKY){
    const t=G.time||0;
    const _starCount = _perfLevel === 0 ? 20 : _perfLevel === 1 ? 40 : 60;
    for(let i=0;i<_starCount;i++){
      const sx=(i*137.5+23)%W, sy=(i*73.3+11)%(H*.45);
      const twinkle=0.3+0.5*Math.sin(t*(0.8+i%5*0.4)+i*2.1);
      const sz=0.4+(i%4)*0.5;
      ctx.globalAlpha=twinkle;ctx.fillStyle='#fff';
      ctx.beginPath();ctx.arc(sx,sy,sz,0,PI2);ctx.fill();
    }
    ctx.globalAlpha=1;
  }

  // Cloud/mist parallax layer
  const ct=G.time||0;
  ctx.save();
  const _cloudCount = _perfLevel === 0 ? 2 : _perfLevel === 1 ? 4 : 6;
  for(let i=0;i<_cloudCount;i++){
    const cx=((i*W/4+ct*12*(1+i*.15))%(W+UNIT*8))-UNIT*4;
    const cy=H*.15+i*H*.06+Math.sin(ct*.3+i)*UNIT*.5;
    const cw=UNIT*(5+i*1.2), ch=UNIT*(1.2+i*.3);
    ctx.globalAlpha=0.06+i*0.015;
    ctx.fillStyle='#fff';
    ctx.beginPath();ctx.ellipse(cx,cy,cw,ch,0,0,PI2);ctx.fill();
  }
  ctx.globalAlpha=1;ctx.restore();

  // Mountain layers with gradient
  drawLayerGrad(bgMtPts,bgTotalW,theme.mt,.08);

  // Far environment decorations
  var _tn = Object.keys(THEMES).find(function(k){return THEMES[k]===theme;}) || 'JUNGLE';
  if (_perfLevel > 0) drawEnvDecoLayer(theme, _tn, 0);

  drawLayerGrad(bgHlPts,bgTotalW,theme.hl,.25);

  // Mid environment decorations
  if (_perfLevel > 0) drawEnvDecoLayer(theme, _tn, 1);

  // Near environment decorations (just behind terrain)
  drawEnvDecoLayer(theme, _tn, 2);

  drawTerrain(theme);
}

function drawLayer(pts,tw,color,parallax){
  const off=(worldOffset*parallax)%tw;
  ctx.fillStyle=color;
  for(let t=-1;t<=1;t++){
    const dx=t*tw-off;
    ctx.beginPath();ctx.moveTo(dx,H);
    for(const p of pts)ctx.lineTo(dx+p.x,p.y);
    ctx.lineTo(dx+tw,H);ctx.closePath();ctx.fill();
  }
}
function drawLayerGrad(pts,tw,color,parallax){
  const off=(worldOffset*parallax)%tw;
  // Find min Y of pts for gradient
  let minY=H;
  for(const p of pts) if(p.y<minY) minY=p.y;
  const grad=ctx.createLinearGradient(0,minY,0,H);
  grad.addColorStop(0,lightenColor(color,30));
  grad.addColorStop(0.4,color);
  grad.addColorStop(1,darkenColor(color,20));
  ctx.fillStyle=grad;
  for(let t=-1;t<=1;t++){
    const dx=t*tw-off;
    ctx.beginPath();ctx.moveTo(dx,H);
    for(const p of pts)ctx.lineTo(dx+p.x,p.y);
    ctx.lineTo(dx+tw,H);ctx.closePath();ctx.fill();
  }
}

function drawTerrain(theme){
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
  // Terrain texture details
  if (_perfLevel > 0) {
    ctx.save();
    var texStep = u * 1.2;
    for (var tx = -texStep; tx < W + texStep; tx += texStep) {
      var gy = getGroundAt(tx + worldOffset);
      var seed = Math.floor((tx + worldOffset) / texStep);
      var rr = ((seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      if (_tn === 'VOLCANO') {
        if (rr > 0.7) {
          ctx.fillStyle = 'rgba(255,80,0,' + (0.15 + rr * 0.15) + ')';
          ctx.beginPath(); ctx.arc(tx, gy + u * 0.3, u * 0.08, 0, PI2); ctx.fill();
        }
      } else if (_tn === 'GLACIER') {
        if (rr > 0.6) {
          ctx.fillStyle = 'rgba(200,240,255,' + (0.2 + rr * 0.3) + ')';
          ctx.beginPath(); ctx.arc(tx, gy + u * 0.15, u * 0.04, 0, PI2); ctx.fill();
        }
      } else if (_tn === 'SKY') {
        if (rr > 0.65) {
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.beginPath(); ctx.ellipse(tx, gy + u * 0.1, u * 0.5, u * 0.15, 0, 0, PI2); ctx.fill();
        }
      }
    }
    // Larger ground details (rocks, stones)
    var detStep = u * 4;
    for (var dx = -detStep; dx < W + detStep; dx += detStep) {
      var dgy = getGroundAt(dx + worldOffset);
      var dseed = Math.floor((dx + worldOffset) / detStep);
      var drr = ((dseed * 48271 + 1) & 0x7fffffff) / 0x7fffffff;
      if (drr > 0.6) {
        ctx.fillStyle = darkenColor(theme.gf, 10 + drr * 15);
        ctx.beginPath();ctx.ellipse(dx, dgy + u * 0.2, u * (0.3 + drr * 0.3), u * 0.12, drr * 0.5, 0, PI2);ctx.fill();
      }
    }
    ctx.restore();
  }
  // Edge highlight
  ctx.strokeStyle=lightenColor(theme.gt,40);ctx.lineWidth=1.5;ctx.lineCap='round';
  ctx.beginPath();
  for(let sx=0;sx<=W;sx+=step){const gy=getGroundAt(sx+worldOffset);sx===0?ctx.moveTo(sx,gy):ctx.lineTo(sx,gy);}
  ctx.stroke();
  // Main terrain edge
  ctx.strokeStyle=theme.gt;ctx.lineWidth=u*.22;ctx.lineCap='round';
  ctx.beginPath();
  for(let sx=0;sx<=W;sx+=step){const gy=getGroundAt(sx+worldOffset);sx===0?ctx.moveTo(sx,gy):ctx.lineTo(sx,gy);}
  ctx.stroke();
  // Darker sub-edge
  ctx.strokeStyle=darkenColor(theme.gt,20);ctx.lineWidth=u*.12;
  ctx.beginPath();
  for(let sx=0;sx<=W;sx+=step){const gy=getGroundAt(sx+worldOffset);sx===0?ctx.moveTo(sx,gy+u*.15):ctx.lineTo(sx,gy+u*.15);}
  ctx.stroke();
}

// ============================================================
// ATMOSPHERIC OVERLAY + VIGNETTE
// ============================================================
const ATMO_COLORS = {
  JUNGLE:  { r:40, g:60, b:20, a:0.08 },
  VOLCANO: { r:80, g:30, b:10, a:0.12 },
  GLACIER: { r:20, g:50, b:90, a:0.10 },
  SWAMP:   { r:20, g:40, b:10, a:0.14 },
  SKY:     { r:60, g:80, b:100, a:0.06 },
};
let _vignetteCache = null;
let _vignetteCacheW = 0;
let _vignetteCacheH = 0;

function drawAtmosphericOverlay(themeName) {
  if (_perfLevel === 0) return; // skip on low-end devices
  const ac = ATMO_COLORS[themeName];
  if (!ac) return;
  // Color grading overlay
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(${128+ac.r},${128+ac.g},${128+ac.b},${ac.a * 3})`;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  // Subtle warm/cool gradient from top
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, `rgba(${ac.r},${ac.g},${ac.b},${ac.a * 1.5})`);
  grad.addColorStop(0.5, `rgba(${ac.r},${ac.g},${ac.b},${ac.a * 0.3})`);
  grad.addColorStop(1, `rgba(${ac.r*2},${ac.g},${ac.b*0.5},${ac.a})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function drawVignette() {
  if (_perfLevel === 0) return; // skip on low-end devices
  // Cache the vignette as an offscreen canvas since it doesn't change per frame
  if (!_vignetteCache || _vignetteCacheW !== W || _vignetteCacheH !== H) {
    _vignetteCache = document.createElement('canvas');
    _vignetteCache.width = W;
    _vignetteCache.height = H;
    _vignetteCacheW = W;
    _vignetteCacheH = H;
    const vc = _vignetteCache.getContext('2d');
    const cx = W / 2, cy = H / 2;
    const outerR = Math.sqrt(cx * cx + cy * cy);
    const grad = vc.createRadialGradient(cx, cy, outerR * 0.4, cx, cy, outerR);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.6, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    vc.fillStyle = grad;
    vc.fillRect(0, 0, W, H);
  }
  ctx.drawImage(_vignetteCache, 0, 0);
}

// Speed lines at high speed
function drawSlowMoEffect() {
  if (_slowMoTimer <= 0) return;
  ctx.save();
  var alpha = clamp(_slowMoTimer / 0.15, 0, 0.25);
  var grad = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.7);
  grad.addColorStop(0, 'rgba(100,180,255,0)');
  grad.addColorStop(0.6, 'rgba(100,180,255,0)');
  grad.addColorStop(1, 'rgba(80,150,255,' + alpha + ')');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
  // Time distortion lines
  ctx.strokeStyle = 'rgba(150,200,255,' + (alpha*0.5) + ')';
  ctx.lineWidth = 2;
  for (var i = 0; i < 4; i++) {
    var ly = H * (0.2 + i * 0.2);
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly + Math.sin(G.time*10+i)*5); ctx.stroke();
  }
  ctx.restore();
}

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

function drawPostEffects(themeName) {
  drawAtmosphericOverlay(themeName);
  drawVignette();
}

// ============================================================
// OBSTACLE / GEM RENDERING
// ============================================================
function drawObstacles(theme){
  for(const chunk of chunks){
    const cx=chunk.worldX-worldOffset;
    for(const obs of chunk.obstacles){
      if(obs.type==='PTERO')continue;
      const sx=cx+obs.lx; if(sx<-UNIT*4||sx>W+UNIT*4)continue;
      drawObs(obs,sx,obs.ly,theme);
    }
  }
}
function drawPteros(theme){
  for(const chunk of chunks){
    const cx=chunk.worldX-worldOffset;
    for(const obs of chunk.obstacles){
      if(obs.type!=='PTERO')continue;
      const sx=cx+obs.lx; if(sx<-UNIT*4||sx>W+UNIT*4)continue;
      const sy=obs.ly+Math.sin(G.time*2.2+obs.phase)*obs.amp;
      drawObs(obs,sx,sy,theme);
    }
  }
}
function drawObs(obs,sx,sy,theme){
  ctx.save();ctx.translate(sx,sy);var u=UNIT;
  switch(obs.type){
    case"ROCK":{
      var rkCol=theme===THEMES.GLACIER?"#6090b0":theme===THEMES.VOLCANO?"#6a2a1a":"#5a4a3a";
      var rkDk=theme===THEMES.GLACIER?"#4070a0":theme===THEMES.VOLCANO?"#4a1a0a":"#3a2a1a";
      ctx.fillStyle="rgba(0,0,0,0.25)";ctx.beginPath();ctx.ellipse(u*.1,0,u*.85,u*.15,0,0,PI2);ctx.fill();
      ctx.fillStyle=rkCol;ctx.beginPath();ctx.moveTo(-u*.9,-u*.3);ctx.quadraticCurveTo(-u*.85,-u*1.1,-u*.2,-u*1.2);ctx.quadraticCurveTo(u*.3,-u*1.35,u*.7,-u*.9);ctx.quadraticCurveTo(u*1,-u*.4,u*.85,0);ctx.lineTo(-u*.9,0);ctx.closePath();ctx.fill();
      ctx.fillStyle=rkDk;ctx.beginPath();ctx.moveTo(u*.2,-u*1.25);ctx.quadraticCurveTo(u*.7,-u*.9,u*.85,0);ctx.lineTo(u*.1,0);ctx.quadraticCurveTo(u*.3,-u*.6,u*.2,-u*1.25);ctx.closePath();ctx.fill();
      ctx.fillStyle="rgba(255,255,255,0.15)";ctx.beginPath();ctx.ellipse(-u*.3,-u*.95,u*.22,u*.16,-.3,0,PI2);ctx.fill();
      if(theme!==THEMES.GLACIER && theme!==THEMES.VOLCANO){ctx.fillStyle="rgba(80,140,60,0.3)";ctx.beginPath();ctx.arc(-u*.5,-u*.2,u*.08,0,PI2);ctx.arc(-u*.3,-u*.1,u*.06,0,PI2);ctx.fill();}
      if(theme===THEMES.VOLCANO){
         var lvPulse=Math.sin(G.time*5+obs.lx*0.01)*0.5+0.5;
         ctx.shadowColor='#FF4400';ctx.shadowBlur=10*lvPulse;
         ctx.strokeStyle='#FF5500';ctx.lineWidth=u*0.06;
         ctx.beginPath();ctx.moveTo(-u*.4,-u*.8);ctx.lineTo(-u*.2,-u*.4);ctx.lineTo(-u*.5,-u*.1);ctx.stroke();
         ctx.beginPath();ctx.moveTo(u*.3,-u*.9);ctx.lineTo(u*.5,-u*.5);ctx.lineTo(u*.2,-u*.2);ctx.stroke();
         ctx.shadowBlur=0;
      } else if(theme===THEMES.GLACIER){
         ctx.fillStyle='#FFFFFF';
         ctx.beginPath();ctx.moveTo(-u*.85,-u*.8);ctx.quadraticCurveTo(-u*.2,-u*1.2,u*.3,-u*1.35);
         ctx.quadraticCurveTo(u*.7,-u*.9,u*.8,-u*.5);ctx.lineTo(u*.5,-u*.6);ctx.lineTo(u*.2,-u*.5);
         ctx.lineTo(-u*.2,-u*.7);ctx.lineTo(-u*.6,-u*.5);ctx.closePath();ctx.fill();
      }
      break;}
    case"SPIKE":{
      var _sp=enemySprites.spikes;
      if(theme===THEMES.VOLCANO){
         var lp2=Math.sin(G.time*3)*0.2+0.8;
         ctx.shadowColor='#FF6600';ctx.shadowBlur=15;
         ctx.fillStyle='rgba(255,80,0,'+lp2+')';ctx.beginPath();ctx.ellipse(0,0,u*1.2,u*0.3,0,0,PI2);ctx.fill();
         ctx.shadowBlur=0;
      }
      if(_sp&&_sp.ready){var _dH=u*2.0,_dW=_dH*(_sp.fw/_sp.fh);var _fr=getEnemyFrame("spikes","idle",G.time);if(_fr){ctx.drawImage(_fr.canvas,-_dW/2,-_dH,_dW,_dH);break;}}
      var spkCol=theme===THEMES.GLACIER?"#a0d0f0":theme===THEMES.VOLCANO?"#cc4400":"#888";
      var spkDk=theme===THEMES.GLACIER?"#6098b8":theme===THEMES.VOLCANO?"#882200":"#555";
      if(theme===THEMES.GLACIER) ctx.globalAlpha=0.8;
      ctx.fillStyle=spkDk;ctx.beginPath();ctx.moveTo(-u*.45,0);ctx.lineTo(-u*.15,0);ctx.lineTo(-u*.35,-u*.85);ctx.closePath();ctx.fill();
      ctx.beginPath();ctx.moveTo(u*.15,0);ctx.lineTo(u*.45,0);ctx.lineTo(u*.35,-u*.9);ctx.closePath();ctx.fill();
      ctx.fillStyle=spkCol;ctx.beginPath();ctx.moveTo(-u*.25,0);ctx.lineTo(u*.25,0);ctx.lineTo(u*.05,-u*1.35);ctx.lineTo(-u*.05,-u*1.35);ctx.closePath();ctx.fill();
      ctx.fillStyle="rgba(255,255,255,0.25)";ctx.beginPath();ctx.moveTo(-u*.15,0);ctx.lineTo(-u*.05,0);ctx.lineTo(-u*.02,-u*1.3);ctx.closePath();ctx.fill();
      ctx.fillStyle="rgba(255,255,255,0.5)";ctx.beginPath();ctx.arc(0,-u*1.3,u*.06,0,PI2);ctx.fill();
      ctx.globalAlpha=1.0;
      break;}
    case"BOULDER":{
      var r=u*1.1;
      var bCol=theme===THEMES.GLACIER?"#5080a0":theme===THEMES.VOLCANO?"#5a2a10":"#4a3828";
      var bDk=theme===THEMES.GLACIER?"#3a6080":theme===THEMES.VOLCANO?"#3a1a08":"#2a2018";
      var bLt=theme===THEMES.GLACIER?"#80b0d0":theme===THEMES.VOLCANO?"#8a4a20":"#6a5838";
      ctx.fillStyle="rgba(0,0,0,0.3)";ctx.beginPath();ctx.ellipse(0,r*.08,r*.9,r*.2,0,0,PI2);ctx.fill();
      if(theme===THEMES.GLACIER) {
         ctx.fillStyle=bLt;ctx.beginPath();ctx.moveTo(-r*.8,-r*.8);ctx.lineTo(-r*1.1,-r*1.1);ctx.lineTo(-r*.3,-r*.9);ctx.fill();
         ctx.beginPath();ctx.moveTo(r*.8,-r*.8);ctx.lineTo(r*1.2,-r*.5);ctx.lineTo(r*.8,-r*.3);ctx.fill();
      }
      ctx.fillStyle=bCol;ctx.beginPath();ctx.arc(0,-r*.88,r,0,PI2);ctx.fill();
      ctx.fillStyle=bDk;ctx.beginPath();ctx.arc(r*.15,-r*.82,r*.85,-.3,Math.PI*.6);ctx.lineTo(r*.15,-r*.82);ctx.closePath();ctx.fill();
      ctx.fillStyle=bLt;ctx.beginPath();ctx.arc(-r*.25,-r*1.1,r*.45,Math.PI*1.2,PI2);ctx.lineTo(-r*.25,-r*1.1);ctx.closePath();ctx.fill();
      ctx.strokeStyle="rgba(0,0,0,0.35)";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(r*.25,-r*.45);ctx.lineTo(r*.05,-r*.8);ctx.lineTo(-r*.15,-r*1.2);ctx.stroke();
      ctx.beginPath();ctx.moveTo(-r*.4,-r*.5);ctx.lineTo(-r*.2,-r*.75);ctx.stroke();
      if(obs.vx){var rot=(G.time*3+obs.lx*.01)%PI2;ctx.strokeStyle="rgba(0,0,0,0.15)";ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,-r*.88,r*.6,rot,rot+1.2);ctx.stroke();}
      if(theme===THEMES.VOLCANO){
         var hsPulse=Math.sin(G.time*6+obs.lx*0.1)*0.4+0.6;
         ctx.shadowColor='#FF3300';ctx.shadowBlur=15*hsPulse;
         ctx.fillStyle='#FFCC00';
         ctx.beginPath();ctx.arc(-r*.4,-r*1.2,r*.1,0,PI2);ctx.fill();
         ctx.beginPath();ctx.arc(r*.3,-r*.5,r*.12,0,PI2);ctx.fill();
         ctx.beginPath();ctx.arc(-r*.2,-r*.3,r*.08,0,PI2);ctx.fill();
         ctx.shadowBlur=0;
         if(obs.vx) {
            ctx.fillStyle='rgba(50,50,50,0.5)';
            ctx.beginPath();ctx.arc(r*.8, -r*.8, r*.4, 0, PI2);ctx.fill();
            ctx.beginPath();ctx.arc(r*1.2, -r*1.0, r*.3, 0, PI2);ctx.fill();
         }
      }
      break;}
    case"LOG":{
      var _sp=enemySprites.log;
      if(_sp&&_sp.ready){var _dH=u*1.8,_dW=_dH*(_sp.fw/_sp.fh);var _fr=getEnemyFrame("log","idle",G.time);if(_fr){ctx.drawImage(_fr.canvas,-_dW/2,-_dH*0.7,_dW,_dH);break;}}
      ctx.fillStyle="#6a4a28";ctx.beginPath();ctx.ellipse(0,-u*.5,u*.9,u*.55,0,0,PI2);ctx.fill();
      ctx.strokeStyle="#4a3018";ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,-u*.5,u*.55,u*.35,0,0,PI2);ctx.stroke();
      ctx.beginPath();ctx.ellipse(0,-u*.5,u*.25,u*.15,0,0,PI2);ctx.stroke();
      ctx.fillStyle="#5a3a18";ctx.fillRect(-u*.9,-u*.15,u*1.8,u*.15);
      break;}
    case"FIRE_GEYSER":{
      var _sp=enemySprites.fire_geyser;
      var erupt=Math.sin(G.time*4+obs.lx*.02);
      if(_sp&&_sp.ready){var _as=erupt>0?"attack":"idle";var _dH=u*3.5,_dW=_dH*(_sp.fw/_sp.fh);var _fr=getEnemyFrame("fire_geyser",_as,erupt>0?(1.0-erupt)*2.5:0);if(_fr){ctx.drawImage(_fr.canvas,-_dW/2,-_dH,_dW,_dH);break;}}
      ctx.shadowColor="rgba(255,100,0,0.6)";ctx.shadowBlur=10;ctx.fillStyle="#3a1a08";ctx.beginPath();ctx.ellipse(0,-u*.1,u*.5,u*.2,0,0,PI2);ctx.fill();ctx.shadowBlur=0;
      if(erupt>0){var fH=erupt*u*2.5;ctx.shadowColor="rgba(255,150,0,0.8)";ctx.shadowBlur=15*erupt;ctx.fillStyle="rgba(255,100,0,0.7)";ctx.beginPath();ctx.moveTo(-u*.3,-u*.1);ctx.lineTo(u*.3,-u*.1);ctx.lineTo(u*.15,-u*.1-fH);ctx.lineTo(-u*.15,-u*.1-fH);ctx.closePath();ctx.fill();ctx.fillStyle="rgba(255,200,50,0.5)";ctx.beginPath();ctx.moveTo(-u*.15,-u*.1);ctx.lineTo(u*.15,-u*.1);ctx.lineTo(u*.05,-u*.1-fH*.7);ctx.lineTo(-u*.05,-u*.1-fH*.7);ctx.closePath();ctx.fill();ctx.shadowBlur=0;}
      break;}
    case"PTERO":{
      var _sp=enemySprites.ptero;
      if(_sp&&_sp.ready){var _dH=u*2.2,_dW=_dH*(_sp.fw/_sp.fh);var _fr=getEnemyFrame("ptero","idle",G.time+(obs.phase||0)*0.1);if(_fr){ctx.drawImage(_fr.canvas,-_dW/2,-_dH*0.5,_dW,_dH);break;}}
      var wf=Math.sin(G.time*6+(obs.phase||0))*.5;
      ctx.fillStyle=theme===THEMES.VOLCANO?"#6a2010":theme===THEMES.SKY?"#3a5090":"#4a2050";
      ctx.beginPath();ctx.ellipse(0,0,u*.65,u*.42,0,0,PI2);ctx.fill();
      ctx.fillStyle=theme===THEMES.VOLCANO?"#aa4020":theme===THEMES.SKY?"#5a70b0":"#6a3070";
      for(var s=-1;s<=1;s+=2){ctx.beginPath();ctx.moveTo(s*u*.35,0);ctx.bezierCurveTo(s*u*1.6,-u*wf,s*u*2.1,u*(.4-wf),s*u*1.9,u*.55);ctx.bezierCurveTo(s*u*1,u*.3,s*u*.55,u*.15,s*u*.35,0);ctx.fill();}
      ctx.fillStyle="#ff3333";ctx.beginPath();ctx.arc(u*.8,-u*.22,u*.07,0,PI2);ctx.fill();
      break;}
    case"ICE_PILLAR":{
      const h = u*2.5;
      ctx.fillStyle="rgba(200,240,255,0.8)";
      ctx.beginPath();ctx.moveTo(-u*.4,0);ctx.lineTo(-u*.2,-h);ctx.lineTo(u*.2,-h);ctx.lineTo(u*.4,0);ctx.closePath();ctx.fill();
      ctx.strokeStyle="rgba(255,255,255,0.6)";ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(-u*.1,-h);ctx.lineTo(-u*.1,0);ctx.stroke();
      // Shine
      ctx.fillStyle="rgba(255,255,255,0.4)";ctx.beginPath();ctx.ellipse(-u*.1,-h*.7,u*.1,h*.2,0,0,PI2);ctx.fill();
      break;}
    case"TREASURE_CRATE":{
      ctx.fillStyle="#8b4513";ctx.fillRect(-u*.6,-u*1.2,u*1.2,u*1.2);
      ctx.strokeStyle="#5d2e0d";ctx.lineWidth=2;ctx.strokeRect(-u*.6,-u*1.2,u*1.2,u*1.2);
      // Gold trim/lock
      ctx.fillStyle="#FFD700";ctx.fillRect(-u*.1,-u*.8,u*.2,u*.2);
      ctx.beginPath();ctx.moveTo(-u*.6,-u*1.2);ctx.lineTo(u*.6,-u*1.2);ctx.stroke();
      break;}
  }
  ctx.restore();
}

function drawGems(theme){
  const hue=theme.gemH;
  for(const chunk of chunks){
    const cx=chunk.worldX-worldOffset;
    for(const gem of chunk.gems){
      if(gem.collected)continue;
      const sx=cx+gem.lx;if(sx<-UNIT*2||sx>W+UNIT*2)continue;
      const sy=gem.ly+Math.sin(G.time*3+gem.lx*.01)*UNIT*.18;
      drawGem(sx,sy,hue);
    }
  }
}
function drawGem(x,y,hue){
  const r=UNIT*.48, t=G.time||0;
  ctx.save();ctx.translate(x,y);ctx.rotate(t*1.8);
  // Pulsing glow
  const pulse=8+Math.sin(t*4+x*.01)*5;
  ctx.shadowColor=`hsl(${hue},100%,70%)`;ctx.shadowBlur=pulse;
  ctx.fillStyle=`hsl(${hue},100%,65%)`;
  ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.6,-r*.2);ctx.lineTo(r*.6,r*.4);
  ctx.lineTo(0,r);ctx.lineTo(-r*.6,r*.4);ctx.lineTo(-r*.6,-r*.2);ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;
  // Inner highlight
  ctx.fillStyle='rgba(255,255,255,0.4)';ctx.beginPath();
  ctx.moveTo(0,-r*.75);ctx.lineTo(r*.22,-.08*r);ctx.lineTo(0,.1*r);ctx.lineTo(-r*.12,-.25*r);ctx.closePath();ctx.fill();
  // Sparkle cross
  const sa=0.3+Math.sin(t*6+y*.02)*.3;
  ctx.globalAlpha=sa;ctx.strokeStyle='#fff';ctx.lineWidth=1.5;
  const sr=r*.6;
  ctx.beginPath();ctx.moveTo(0,-sr);ctx.lineTo(0,sr);ctx.moveTo(-sr,0);ctx.lineTo(sr,0);ctx.stroke();
  ctx.globalAlpha=1;
  ctx.restore();
}

// ============================================================
// ENEMY RENDERING
// ============================================================
function drawEnemies(){
  for(var _ei=0;_ei<activeEnemies.length;_ei++){
    var en=activeEnemies[_ei];
    if(!en.alive)continue;
    var sx=en.sx, sy=en.sy, u=UNIT;
    ctx.save();
    // Universal ground shadow for visual popping
    ctx.fillStyle="rgba(0,0,0,0.3)";ctx.beginPath();ctx.ellipse(sx,sy,u*1.2,u*0.3,0,0,PI2);ctx.fill();
    var _enAnimState = "idle";
    if (en.telegraphing || (en.fireCD !== undefined && en.fireCD <= 0.3)) _enAnimState = "attack";
    if (en.hpFlash > 0) _enAnimState = "hit";
    switch(en.type){
      case "TROLL":{
        ctx.translate(sx,sy);
        var _sp=enemySprites.troll;
        if(_sp&&_sp.ready){
          var _dH=u*3.2,_dW=_dH*(_sp.fw/_sp.fh);
          drawEnemySpriteFrame("troll",_enAnimState,en.phase,_dW,_dH,false);
        }else{
          ctx.fillStyle="#3a7a3a";ctx.beginPath();ctx.ellipse(0,-u*1.3,u*1.1,u*1.4,0,0,PI2);ctx.fill();
          ctx.fillStyle="#5a9a5a";ctx.beginPath();ctx.ellipse(0,-u*1,u*.6,u*.7,0,0,PI2);ctx.fill();
          ctx.fillStyle="#ff0";ctx.beginPath();ctx.ellipse(-u*.35,-u*1.9,u*.22,u*.18,-.3,0,PI2);ctx.fill();
          ctx.beginPath();ctx.ellipse(u*.35,-u*1.9,u*.22,u*.18,.3,0,PI2);ctx.fill();
          ctx.fillStyle="#200";ctx.beginPath();ctx.arc(-u*.3,-u*1.88,u*.1,0,PI2);ctx.arc(u*.4,-u*1.88,u*.1,0,PI2);ctx.fill();
          ctx.fillStyle="#ffe";ctx.beginPath();ctx.moveTo(-u*.5,-u*.9);ctx.lineTo(-u*.35,-u*.5);ctx.lineTo(-u*.2,-u*.9);ctx.fill();
          ctx.beginPath();ctx.moveTo(u*.5,-u*.9);ctx.lineTo(u*.35,-u*.5);ctx.lineTo(u*.2,-u*.9);ctx.fill();
          ctx.strokeStyle="#2a4a2a";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-u*.55,-u*2.1);ctx.lineTo(-u*.25,-u*2);ctx.stroke();
          ctx.beginPath();ctx.moveTo(u*.55,-u*2.1);ctx.lineTo(u*.25,-u*2);ctx.stroke();
        }
        break;
      }
      case "CHARGER":{
        if(en.state==="WARN"){
          var blink=Math.sin(G.time*12)>.2;
          if(blink){
            var cw=W-u*2, ch=GROUND_BASE-u*3, ctw=u*1.2, cth=u*2;
            ctx.shadowColor="#FF0000";ctx.shadowBlur=15;
            ctx.fillStyle="#FF2200";ctx.beginPath();ctx.moveTo(cw,ch-cth);ctx.lineTo(cw+ctw,ch);ctx.lineTo(cw-ctw,ch);ctx.closePath();ctx.fill();
            ctx.shadowBlur=0;
            ctx.fillStyle="#FFF";ctx.font="bold "+Math.round(u*1.6)+"px monospace";
            ctx.textAlign="center";ctx.textBaseline="middle";
            ctx.fillText("!",cw,ch-u*0.6);
          }
          break;
        }
        ctx.translate(en.screenX,en.y);
        var _sp=enemySprites.charger;
        if(_sp&&_sp.ready){
          var _anim=en.state==="CHARGE"?"idle":_enAnimState;
          var _dH=u*2.8,_dW=_dH*(_sp.fw/_sp.fh);
          drawEnemySpriteFrame("charger",_anim,en.phase,_dW,_dH,true);
        }else{
          ctx.fillStyle="#CC8833";ctx.beginPath();ctx.ellipse(0,-u*.9,u*1.3,u*.85,0,0,PI2);ctx.fill();
          ctx.fillStyle="#BB7722";ctx.beginPath();ctx.ellipse(-u*1,-u*1.1,u*.55,u*.5,-.2,0,PI2);ctx.fill();
          ctx.fillStyle="#fff";ctx.beginPath();ctx.moveTo(-u*1.3,-u*.8);ctx.lineTo(-u*1.2,-u*.35);ctx.lineTo(-u*1.1,-u*.8);ctx.fill();
          ctx.beginPath();ctx.moveTo(-u*1.0,-u*.75);ctx.lineTo(-u*.9,-u*.3);ctx.lineTo(-u*.8,-u*.75);ctx.fill();
          ctx.fillStyle="#f00";ctx.beginPath();ctx.arc(-u*1.1,-u*1.2,u*.12,0,PI2);ctx.fill();
          var lAnim=Math.sin(G.time*14)*.3;
          ctx.fillStyle="#AA6622";
          for(var i=-1;i<=1;i+=2){ctx.save();ctx.translate(i*u*.5,-u*.08);ctx.rotate(i*lAnim);ctx.fillRect(-u*.12,0,u*.24,u*.55);ctx.restore();}
          ctx.strokeStyle="#CC8833";ctx.lineWidth=u*.15;ctx.lineCap="round";
          ctx.beginPath();ctx.moveTo(u*1.1,-u*.9);ctx.quadraticCurveTo(u*1.6,-u*1.8,u*1.3,-u*1.5);ctx.stroke();
        }
        break;
      }
      case "DIVER":{
        ctx.translate(en.screenX,en.y);
        var _sp=enemySprites.diver;
        if(_sp&&_sp.ready){
          var _dH=u*2.6,_dW=_dH*(_sp.fw/_sp.fh);
          drawEnemySpriteFrame("diver",_enAnimState,en.phase,_dW,_dH,true);
        }else{
          var wf=Math.sin(G.time*5)*.6;
          ctx.fillStyle="#6a3a20";ctx.beginPath();ctx.ellipse(0,0,u*.7,u*.45,0,0,PI2);ctx.fill();
          ctx.fillStyle="#8a5a30";
          for(var s=-1;s<=1;s+=2){ctx.beginPath();ctx.moveTo(s*u*.4,0);ctx.bezierCurveTo(s*u*1.8,-u*wf,s*u*2.4,u*(.4-wf),s*u*2.2,u*.6);ctx.bezierCurveTo(s*u*1.2,u*.35,s*u*.6,u*.18,s*u*.4,0);ctx.fill();}
          ctx.fillStyle="#5a2a10";ctx.beginPath();ctx.ellipse(-u*.8,u*-.15,u*.4,u*.3,.3,0,PI2);ctx.fill();
          ctx.fillStyle="#cc8800";ctx.beginPath();ctx.moveTo(-u*1,-u*.15);ctx.lineTo(-u*1.6,0);ctx.lineTo(-u*1,-u*.05);ctx.fill();
          ctx.fillStyle="#ff0";ctx.beginPath();ctx.arc(-u*.75,-u*.25,u*.08,0,PI2);ctx.fill();
        }
        break;
      }
      case "WITCH":{
        ctx.translate(sx,sy);
        var _sp=enemySprites.witch;
        if(_sp&&_sp.ready){
          var _dH=u*3.0,_dW=_dH*(_sp.fw/_sp.fh);
          drawEnemySpriteFrame("witch",_enAnimState,en.phase,_dW,_dH,false);
        }else{
          ctx.fillStyle="#2a0a3a";ctx.beginPath();ctx.moveTo(-u*.5,0);ctx.lineTo(-u*.7,u*.5);ctx.lineTo(u*.7,u*.5);ctx.lineTo(u*.5,0);ctx.lineTo(u*.3,-u*1.2);ctx.lineTo(-u*.3,-u*1.2);ctx.closePath();ctx.fill();
          ctx.fillStyle="#3a1a4a";ctx.beginPath();ctx.moveTo(-u*.5,-u*1.2);ctx.lineTo(u*.5,-u*1.2);ctx.lineTo(0,-u*2.5);ctx.closePath();ctx.fill();
          ctx.shadowColor="#aa00ff";ctx.shadowBlur=10;ctx.fillStyle="#cc44ff";ctx.beginPath();ctx.arc(-u*.18,-u*.9,u*.1,0,PI2);ctx.arc(u*.18,-u*.9,u*.1,0,PI2);ctx.fill();ctx.shadowBlur=0;
          ctx.strokeStyle="#6a4a2a";ctx.lineWidth=u*.1;ctx.beginPath();ctx.moveTo(u*.6,-u*.5);ctx.lineTo(u*.8,u*.5);ctx.stroke();
          ctx.fillStyle="#aa00ff";ctx.shadowColor="#aa00ff";ctx.shadowBlur=8;ctx.beginPath();ctx.arc(u*.55,-u*.6,u*.18,0,PI2);ctx.fill();ctx.shadowBlur=0;
        }
        break;
      }
      case "GOLEM":{
        ctx.translate(sx,sy);
        var _sp=enemySprites.golem;
        if(_sp&&_sp.ready){
          var _dH=u*4.0,_dW=_dH*(_sp.fw/_sp.fh);
          drawEnemySpriteFrame("golem",_enAnimState,en.phase,_dW,_dH,false);
        }else{
          ctx.fillStyle="#5a5a5a";ctx.beginPath();ctx.ellipse(0,-u*1.6,u*1.3,u*1.7,0,0,PI2);ctx.fill();
          ctx.strokeStyle="#3a3a3a";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-u*.4,-u*2.5);ctx.lineTo(-u*.1,-u*1.8);ctx.lineTo(-u*.3,-u*1);ctx.stroke();
          ctx.beginPath();ctx.moveTo(u*.3,-u*2.3);ctx.lineTo(u*.5,-u*1.5);ctx.stroke();
          ctx.shadowColor="#ff4400";ctx.shadowBlur=12;ctx.fillStyle="#ff6600";ctx.beginPath();ctx.arc(-u*.35,-u*2.2,u*.15,0,PI2);ctx.arc(u*.35,-u*2.2,u*.15,0,PI2);ctx.fill();ctx.shadowBlur=0;
          ctx.fillStyle="#4a4a4a";ctx.beginPath();ctx.ellipse(-u*1.3,-u*1.5,u*.5,u*.3,-.4,0,PI2);ctx.fill();ctx.beginPath();ctx.ellipse(u*1.3,-u*1.5,u*.5,u*.3,.4,0,PI2);ctx.fill();
          ctx.fillRect(-u*.8,-u*.15,u*.5,u*.5);ctx.fillRect(u*.3,-u*.15,u*.5,u*.5);
          ctx.strokeStyle="#ff4400";ctx.lineWidth=u*.08;ctx.beginPath();ctx.moveTo(-u*.3,-u*1.7);ctx.lineTo(-u*.1,-u*1.5);ctx.lineTo(u*.1,-u*1.7);ctx.lineTo(u*.3,-u*1.5);ctx.stroke();
        }
        break;
      }
      case "BOMBER":{
        ctx.translate(en.screenX,en.y);
        var _sp=enemySprites.bomber;
        if(_sp&&_sp.ready){
          var _dH=u*2.6,_dW=_dH*(_sp.fw/_sp.fh);
          drawEnemySpriteFrame("bomber",_enAnimState,en.phase,_dW,_dH,true);
        }else{
          ctx.fillStyle="#8a4a2a";ctx.beginPath();ctx.ellipse(0,0,u*.9,u*.5,0,0,PI2);ctx.fill();
          var wf2=Math.sin(G.time*7)*.4;ctx.fillStyle="#aa6a3a";
          for(var s=-1;s<=1;s+=2){ctx.beginPath();ctx.moveTo(s*u*.5,0);ctx.bezierCurveTo(s*u*1.5,-u*wf2,s*u*2,-u*(.3+wf2),s*u*1.8,u*.3);ctx.bezierCurveTo(s*u*1,u*.2,s*u*.6,u*.1,s*u*.5,0);ctx.fill();}
          ctx.fillStyle="#cc3300";ctx.beginPath();ctx.ellipse(0,u*.25,u*.3,u*.15,0,0,PI2);ctx.fill();
          ctx.fillStyle="#ff0";ctx.beginPath();ctx.arc(-u*.5,-u*.1,u*.1,0,PI2);ctx.fill();
          ctx.fillStyle="#6a3a1a";ctx.beginPath();ctx.moveTo(u*.7,0);ctx.lineTo(u*1.4,-u*.4);ctx.lineTo(u*1.4,u*.2);ctx.closePath();ctx.fill();
        }
        break;
      }
      case "SERPENT":{
        ctx.translate(en.screenX,en.y);
        var _sp=enemySprites.serpent;
        if(_sp&&_sp.ready){
          var _dH=u*3.0,_dW=_dH*(_sp.fw/_sp.fh);
          drawEnemySpriteFrame("serpent",_enAnimState,en.phase,_dW,_dH,false);
        }else{
          ctx.fillStyle="#2a8a3a";var segCount=6;
          for(var i=0;i<segCount;i++){var sx2=i*u*.55,sy2=Math.sin(en.slitherPhase+i*1.2)*u*.3;var r2=u*(.35-i*.03);ctx.beginPath();ctx.arc(sx2,sy2-u*.4,r2,0,PI2);ctx.fill();}
          ctx.fillStyle="#1a6a2a";ctx.beginPath();ctx.ellipse(-u*.3,-u*.4,u*.45,u*.35,.2,0,PI2);ctx.fill();
          ctx.fillStyle="#ffcc00";ctx.beginPath();ctx.arc(-u*.5,-u*.55,u*.08,0,PI2);ctx.fill();
          ctx.fillStyle="#fff";ctx.beginPath();ctx.moveTo(-u*.7,-u*.35);ctx.lineTo(-u*.65,-u*.1);ctx.lineTo(-u*.6,-u*.35);ctx.fill();
          ctx.strokeStyle="#ff3366";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(-u*.75,-u*.4);ctx.lineTo(-u*1.1,-u*.5);ctx.moveTo(-u*.9,-u*.42);ctx.lineTo(-u*1.1,-u*.3);ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();
    if(en.hpFlash>0){ctx.globalAlpha=en.hpFlash*2;ctx.fillStyle="#FFF";var hb=en.hitbox;ctx.fillRect(hb.x,hb.y,hb.w,hb.h);ctx.globalAlpha=1;}
    if(en.dying){ctx.globalAlpha=en.deathTimer/0.4;}
    if(en.hp<en.maxHP&&!en.dying){var barW=u*2,barH=u*0.2;var barX=sx-barW/2,barY=sy-u*3.2;ctx.fillStyle="rgba(0,0,0,0.5)";ctx.fillRect(barX-1,barY-1,barW+2,barH+2);ctx.fillStyle="#444";ctx.fillRect(barX,barY,barW,barH);var hpFrac=clamp(en.hp/en.maxHP,0,1);ctx.fillStyle=hpFrac>0.5?"#4CAF50":hpFrac>0.25?"#FF9800":"#F44336";ctx.fillRect(barX,barY,barW*hpFrac,barH);}
    if(en.telegraphing){
      var tPulse=Math.sin(G.time*16)*0.5+0.5;
      var tw=u*0.8, th=u*1.4, ty=sy-u*4.0;
      ctx.save();ctx.translate(sx,ty);ctx.scale(1+tPulse*0.2,1+tPulse*0.2);
      ctx.shadowColor="#FF0000";ctx.shadowBlur=10;
      ctx.fillStyle="#FF2200";ctx.beginPath();ctx.moveTo(0,-th);ctx.lineTo(tw,0);ctx.lineTo(-tw,0);ctx.closePath();ctx.fill();
      ctx.shadowBlur=0;
      ctx.fillStyle="#FFF";ctx.font="bold "+Math.round(u*1.0)+"px monospace";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("!",0,-u*0.4);
      ctx.restore();
    }
    ctx.globalAlpha=1;
    for(var _pi=0;_pi<en.projectiles.length;_pi++){var pr=en.projectiles[_pi];
      ctx.save();ctx.translate(pr.x,pr.y);
      if(pr.type==="ROCK_P"){ctx.fillStyle="#6a5a3a";ctx.beginPath();ctx.arc(0,0,UNIT*.35,0,PI2);ctx.fill();}
      else if(pr.type==="SKULL"){ctx.fillStyle="#aa88ff";ctx.shadowColor="#aa00ff";ctx.shadowBlur=10;ctx.beginPath();ctx.arc(0,0,UNIT*.3,0,PI2);ctx.fill();ctx.fillStyle="#220033";ctx.beginPath();ctx.arc(-UNIT*.08,-UNIT*.05,UNIT*.06,0,PI2);ctx.arc(UNIT*.08,-UNIT*.05,UNIT*.06,0,PI2);ctx.fill();ctx.shadowBlur=0;}
      else if(pr.type==="SHOCKWAVE"){ctx.fillStyle="rgba(255,120,0,0.8)";ctx.beginPath();ctx.ellipse(0,0,UNIT*.6,UNIT*.25,0,0,PI2);ctx.fill();ctx.fillStyle="rgba(255,200,50,0.5)";ctx.beginPath();ctx.ellipse(0,-UNIT*.15,UNIT*.3,UNIT*.12,0,0,PI2);ctx.fill();}
      else if(pr.type==="BOMB"){ctx.fillStyle="#333";ctx.beginPath();ctx.arc(0,0,UNIT*.3,0,PI2);ctx.fill();ctx.fillStyle="#ff4400";ctx.beginPath();ctx.arc(0,-UNIT*.3,UNIT*.1,0,PI2);ctx.fill();}
      else if(pr.type==="VENOM"){ctx.fillStyle="rgba(80,220,50,0.8)";ctx.beginPath();ctx.arc(0,0,UNIT*.28,0,PI2);ctx.fill();ctx.fillStyle="rgba(40,180,20,0.5)";ctx.beginPath();ctx.arc(UNIT*.05,-UNIT*.08,UNIT*.12,0,PI2);ctx.fill();}
      else if(pr.type==="FEATHER"){ctx.fillStyle="#aa7744";ctx.beginPath();ctx.moveTo(-UNIT*.25,0);ctx.lineTo(UNIT*.25,0);ctx.lineTo(UNIT*.05,-UNIT*.15);ctx.lineTo(-UNIT*.15,-UNIT*.1);ctx.closePath();ctx.fill();ctx.strokeStyle="#664422";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-UNIT*.2,0);ctx.lineTo(UNIT*.2,0);ctx.stroke();}
      else if(pr.type==="DEBRIS"){ctx.save();ctx.rotate(G.time*8);ctx.fillStyle="#7a6a4a";ctx.fillRect(-UNIT*.18,-UNIT*.18,UNIT*.36,UNIT*.36);ctx.fillStyle="#5a4a2a";ctx.fillRect(-UNIT*.12,-UNIT*.12,UNIT*.15,UNIT*.24);ctx.restore();}
      else if(pr.type==="BOULDER_P"){ctx.fillStyle="#5a5a5a";ctx.beginPath();ctx.arc(0,0,UNIT*.4,0,PI2);ctx.fill();ctx.fillStyle="#3a3a3a";ctx.beginPath();ctx.arc(UNIT*.05,-UNIT*.08,UNIT*.25,-.3,Math.PI*.6);ctx.fill();ctx.strokeStyle="rgba(0,0,0,0.3)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(UNIT*.1,-UNIT*.15);ctx.lineTo(-UNIT*.05,UNIT*.1);ctx.stroke();}
      ctx.restore();
    }
  }
}


// ============================================================
// ENEMY & OBSTACLE SPRITE SYSTEM
// ============================================================
var ENEMY_SPRITE_B64 = {
  "bomber": "data:image/png;base64,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",
  "charger": "data:image/png;base64,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",
  "troll": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAEACAYAAADFkM5nAAAACXBIWXMAAAsTAAALEwEAmpwYAAAgAElEQVR42u2dB3wVVfbHB9fdVVc/rquLbXctu66AUiSQV5MA0kEJJUBCs6JIr2mE0FQghJoeseufRRTpVXR1VYr0XkKTIk0goaec/zl35oVHeC+Zl46f3/fzuZ83eW/mzkx+c+eee++552oaAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFDpqSIpNjb2lqDYoFslhYSE/E4j/p6TbLu+l31c++PfBv0B9AfQH9ykwouoROSzmHKMHIsHAfrj3wj9AfQHNwux2i1aiPY796+cEc577JH2htYIax9rpDXOFml7n9MsI70v38lvso/s636sWIiGZQigP4D+APqDSofRneOy2vwG+d1ni7K9xALPZWFPOaIdFDgqkILGBlHAqIDrknwnv8k+si8f86UcWz+i/r0uazK/2whAfwD9AfQHlcjqk8QERAf8XVl5UbYTIi4Lm+cYzsJG2Ym/y+HPqyxwjntS3+m/kewrxwSMDJCH4TjnFe8/2P+xgucB0B9AfwD9QcXhsvq0JoOb/InFGsGCngsYHUCOGEeeiMp/Z7OweSKuyZQnx8ix/DDkSV68nWmLsMXUGlzrT65uIYwPQX/8+6E/gP6gosSfpYtvi7bZWbTNgaNVN06esuoi7bk+iO45RaqHIUfylLx5e7ucSz0Es/AQQH/oD/0B9AcVZvlZw60D2dq76ox1krL2SkP4Gx+EXMk7IDZAuoiuWIZZBqkeoWvTRgD0B9AfQH9QHvM6ZcMebk8Uy8w+3J7DXTSlL3yBxA9BrpxLzsleowmaMWUEziHQH7JAfwD9QTmIL9Yfi/Ge6paJUlZfXlmLf123EJ9TjQ1F2j4ICsqfL4qHAPoD6A+gPygT8Q0PTBbhw8AxgWQ4eFBFJDm3XANvf6i5PETxEEB/AP0B9Aeli2vMh8UfZ1hfFSb+dQ+BdEHxNblfI4D+APoD6A9KQ/xZ+eK/KvMzXXM2K0nKcY50yjX1dL9WAP0B9AfQH2glDPLA2MJtz7C3Z6YK6lCeYz4mxoTUNQ23Z1mHWuu6XzOA/gD6A+gPtGI7fWj/6vuvP/I/+EeZhmFEbqLKlMQiFSvQHm1fxYtI3OZ+7QD6A+gPoD8o5riPbbgtxgjE4FF8scBc4R7ZIiMHfzqjbeQcblPbvgqqjudjJQ+HkecN57lxPEhND+GHYATGg6A/9If+UBD6gxJ2/XDQher8Tz3rtesn2k6WARayDraQM4aFG+Ega5STag8OoJoDA6jeMAcLyeJFmxA+2q72lWPkWMnDEulUeUre1sFWdS57dCFdQdH2c3LN6AqC/tAf+kNI6A+Ko7+xBCNbVjNlpabCun5qdahJ1ZtVo2pta1Odl+vR82PqUuSn1WjkZ09Sx0l16ZkhTvIP1x8Eb3nIb7KP7BsSX5diZz9J0TOrUZuxfPyr9ahG+9p8jurqXIV4heYY1zoTDwD0h/7QH0pCf1BM8S0xFgtbVC6rL89bd029/haq/UJdavrSE1SjeXV67NmnKHTgo/ThnHto+97baNG6qtRsjD/VH+b0aAnKd/XDndSc91m8virtO3wbfbb4Hnph2CP0OOdVrWl1atjtCardw4/q9bMU1q2Uf62WCIvF/V4A9AfQH0B/YNbzM8r2iWFRFTrn05+7ab5Y+yBHZdRoy67bKfGTv1Lnof+kR5vUopdGPK6+33roLmowwkpWY4zI/QGS7+S3rYfuVPuG9Huc7rPUojZ9nqDU2VUp48jt6vvZqx8kf+5eKmpuqCxDydf+MaxA6A/9oT8Ehf7AV/EjbU/zuMpVY7zFo/UnjhoyTjN5/mNKoNzcKurz6iWNUt7WqFG9O+ilrndS1jlNfR/35eM8thNIAXycKw/Zlu8mztUfFA7tTN/9dCdt23cHrf1OoxGvaRT1skarvtHzjp/7mDqn0y2PG6zAaDUmdEXuAQ8B9If+0B/CQn9gAp5GcavxAIw1PD+zvXX9WCMd1CjWSkdO36bEyc7RhR7Sowrxws306B80upc/B7+oizdvTVUe4wlQ3p3Xxn5s6rsFP1XVH55sfd+dGzV68i6N7ubj/8zpX3dotGuTRicv3kZBMVZ1bkcREaLkHtzvCUB/AP0B9AdaEfM+o+w7nCOc5G15R3Ha8BvqpG7T6rDwVQzrTaPzmRrVuUejx1i0J36v0SP8WfNu/j1boy/WPEi12LuzoAVYa1AAffaD3oV0+bKe19RRGv2Fj61xu57u4e2EMXKOW6jzxDrk52U8ybV8pLp2vge5F8wLhf7QH/pDXugPNBPzPqNsrZwxzkIjPinHDRahQ1xdupJ9S/4DkH1Fo8AnNbqfBXvyVo2q8qfz31Uojx+AgR/UoNqDru++ke063KUz8L0a6vgrV/UH4JNU3fp74lY9yfanqfoDEPy2H5/bUfjUEpkWEqMiRLXEvFDoD/2hPxSG/sBEzGd+AKYV1v3j3g1Un6du/LDzHt16u3qLGsOZ8zF32dxahR7SqrB4VejbuRqt3MHdP4O9e4HWY2ty4bqq+eNAmZlVKLRBFXqQhX+Q8+kUeIuyIlftuUf3JjW/UMRUxIiG/tAf+kNh6A+K6P7x6+n3e/7nbS2s+8e9G6gei9F+gh8dOKF7aubm6ZbgsYMafb9Io6MHNFq8+YH8MSNvD4D8Jvl9ufr+66zJtd9otO5b/e+Dp26nduP91APgjC4yRrTqBrJGWbfIPaEbCPpDf+gPmaE/0Lx7f/qH+9dmCzC7MO9PTw9Bk9EWSl76CK3LuJsyjt1Bu4/fSSt23E/9P3iaLb8ANdXDHsnOG+GcIqxioakk25LUb7xP3aEB9Eba0zRn1f20/ec76fiFO2jn8bspZdkj1HikRZ3LGW0qpKTyBpV7sURaasEbFPpDf+gPoaE/0Lx7f7Ll1MuYR2l60Qfx5LREONR0Dit/BsbwGA+LW3MAh3McJJYkB2+IdlDDUY2oxfgW9Fz8c9RmchuVZLvFuBb8W0PdOuQHoQ53Fcm4kCOK40Fz8h+m5y3ncPcgNbNIhCxfaY20vgZvUOgP/aE/lIb+oPA1n6cHjil6/MdTN47Lu9MWKQs2SLJQIMdxFtFDEkMoLC2Mur7T1WOS32Qf2TcwRj/WxnnYjOkekrcj2sdVomQcSL+X6RgHgv7QH/pDaegPvIz/aPr8z++csU75p+Xai7mSk1huNrbkmrzZhDoldVICd0nvokQOTQ1VSbYL/i37yL6dkjtS07eaqC4ie1TxVpQyHoBctYRlhO1bT/cKoD+A/gD64wEQ62+o/S7+p530uvKTD0m6dlzCh6ZdE7yoJPu6HoTW8a1Ltla0sUIUdwWdqBFb4048ANAf+kN/yA39gXajAwhbfo/zP+uyjNeYcQDxloKnBOd365QkSR6SVwkegjzDmeVSQHTAY3AEgf7QH/pDcOgPPASAYGeJIA8rK/nS5ULPT3qeus3oVmLxXUnykjz17qBiPADXrMEABISA/tAf+kNx6A88BYCItoWamf/pKclUjubjmpeK5efJEpS81XQR37uB1HxQfoA6wxEE+kN/6A/FoT/QbpwCItMlZNqEL1NAXJYf53Gdc0eppnR9bEjO4asl6JoKwp89MRUE+kN/6A/FoT/wvAJUfyMEpM8PQGmN+xRmBcq8UZ8fAL4XY03r/ngAPOOKlMVRswYY/6vfrP5uUcEAyj+A/sAtCESUr3NAeYqFCuIgVlpZie+e5Fy+PASuuaByb3gAijAAIqyRv1X9+TMC+qP8Q3+UfyheAJ4i8QfDAhzu6wMg4zLipFGW1p+7FSjn8mUsyO0BGO5+r+DGF4DZRUBuOv3lniJsSRppVfACQPmH4l4MgEjriMCxgfJ/u/pb0V/uRe5J7g09gFrh00D4n5SowkCafAGIJeYc7qROKZ3yAz2UZZJzdErupM5p1gqULiB1TxG2FEwD8QzrPoP/T1m+Rv+6GfR3HwuUe5R7heIo/8DDEECEbYivDQClf3L56+9zAyDSNhg9AF4Kfr2Ieo9LBChf53+KJdZ4bONyEd/9IZBz+mgF5vG60FIJrOJ5of/Ei+B6/R2xjk+Dxgb57PxzE+mv7i3ozSDiNcI/hf4o/9DfgxNglHWoLwaAaCDR/spbfzmnWf3zlwWOsg+FAVAQyo8A9RC/GI86Y5w+RYASEVrFtVJdM2XmAeoeJYrPIeeSc/r0AuB7knvjdETu1f3eUfBZ/2j7IF8t/5tKf/cXAd8rXgQo/yj/BRoB4Q5ZBfCML1EARYOmbzUtl+5/92EAOadp/Y1ogLx91j7EXgfGn+ZlEYjh9leMrrLcyuT96S06lE+OIHxPcm/88n8Vc0FvDADCBb+ZUUiosnn/lob++XHK5R4j7E0REATlH8pfbwTykrn38/9pra9xAEQHWcCnvHwAWk5o6VvZd8UBiLL9VD+2/gMw/jTPcaDFOcIeY//Jl4UgHLxaU0hCSLl3AXVI6ODTghByT3Jvbg4geADcCoJflN+DXECyDCMgz/zCH5Vff1cXsBET/LzcK14CKP+Q/caGgETLK04kQGmNy5K+ZT0NUAwNn4d+EAnQh0hQkbYOhgWYZ24JSAd15JWbyvsF0DGpIxnjlea6//ieLFGW9rD+Pb/8pTuctd/gq/UvGpSXA1Cx9b8+GtgGN/1RCaD8A7eyoHoBitEQKPNIgOnFjgToMvyzbINtVVHui2oFxPrdwQXmsCPG3DiQeGN2TulcboXfleScpjxBZfwnRtaUth2We8MD4GEIMDZWHwOMcrxbHA9g0aK8K4DOyax/tO+ewLz9rvs9A5R/cF1D4DauLDMMX5BihQNu9nYzVWGXZnmXPIsdBjhGGf57m/dt/kfob2ZJyCj7HGMqkCmP8PbT2+dXAPLpLfkieGF5yKec06cpQNG2L9DtqxUVBGZgSQ2A8tJfeh186QFwGQA8zW0gHABR/kEhDqE+6u/NCCj4TPiqf4krf3f9o2yfQ3/zc0FHmQ0GIsI8O+bZ/DWfQ7g70FPqlGq+lSD7esvHtVa0nNPMQ+EWBGQkXvxFOAJG2p71qVvd1QWc1LHc9fd5CEBStHoensU4IMo/KGQqYLh1tK/BoLwZARIdMCQ5RMWJMK0/7xtiDCs1f7t5sSt/6F/McUAZK3OMMD8VxMGpRXxLemvRaNpw8DtanfEVrdm3UiXZXn/gv7R4y+eqW0gKsNcpPvyb7CP7yjEF85G85Rwt41sp5yPTU0D4Xnhsqx3G/wq3/G2xtqpsKWf6Ov4XMr0DdeBCPnbBSNp4qOz0l7zlHHIuH50AXeOAmfnjgGgJoPyDUtHfUwqMCaSag2rR4I/60bYjq2jR5tmm9Zd95ZjBH/WnmgNrqbyKex3Qv5hzgvkfd850RRDJXcEjAmjQzP6UnXOGiC5zusDpIuXknidh+bb51DahXaFjQ/Kb7CP7CvqxF428Lqu8B/2nPxlOSqZf/HIvAQMC4PldRNevtIplqozymDY5/qemgfECHdJqG1gO+ss55Fy+LAri8gLnz5+0EA0OgCj/oDT1L5AChgdQ3SF1qe34NnTwxBal5bJt80zrL/sKB05spnYTglVekmcxDADoX1y4u3SJT8tCcoFsOqEp/ZixgqU7T9m5Jyg375Seck9R5Ofh1D6pA4vcpZAHoIvaR/bNzTudf7zkJXlK3k3HNzNb+POXgeT5zYuhqOlhgHSzfgDSBe/y/O0+o5sqvP/bs0y9sEtf/wsq77aJ7dS5XB7BZoYBXOP/vG86uv9R/kEZ6O/yCWLH3Ge4wn7+7dZc+W9l3S4p/XzVPzv3pDr20MltFDz+OZWnL06/0L/kkeGG+eIQJl1y9SP9aeLSceplnWcUYNnecewn6pxmfgwwlPfdeWydOlbykLxkW/KWc5jt/nNz/BqG8R8flgP1YTlgaYXL6lzKeufKOX7ZOPWyLn39z6u85RxyLl9WBFPLgY7GcqAo/9C9rPR3NQj8w/3pubdbUcYvG43em0ylZfH0z1R57D++mdqMe47qc97FdPyF/pqPYSH9I/1rsKV9RRynzHQDiTCWcAsFTwqmk1kZSrwcw4r74Ps0apPQ1tTUENmnTUKwOkaO1fPI5Dz3qrz9zT8Eeca1X/GP9a+B8I/megBYwwbG/803P4DEEKXfC+++QMcz95S6/ic4T8lb9pFz+RwIhO+JQ502QA8Ayj8oA/2jHLpBzvuv3ruSNbtKV7OPl1h/PY+rtHbvNy4nXrMGIPTXSjodiLtOfOkGEmGcvP/CTbOVeHl0mi5ePUp9Pu1NHVPMBQtRHt68b59PetPFK0dVHpLXQnYMCRgZaN76d3X/RNsXYczX/Phfncg6f+X/3Vlfxv9UFDCO0NX93e7UZnpbWrDpM6UZ0a8l1l/ykLwkT3kxdJ/RXUUc88EzOD8OOLcA7sM4IMo/KBv9A2MCqNWk1rR8+1zDb6O0yv8FWsZ5St5mHQKhfyl0A7Gl3cOYQ2nqAQieHKw8tKPnRLDlfkoV3O/3ruBxnfY+zwOVY+RYvRVwSuUp00kkBrhZxy95AOQe4P1pvtCLlcyW/2pfwsGKVR7AhT80JZT170DRX5SB/pynPFuhHHNAzuWrAyBvr3Kr+PEyQPkHpai/lMd209pRCFfeUZ8PK3X9o9gvQPKWc5gp+9C/NCzAl+x3scW910xUKNeqYN3e6aYCw8i4n3TdxC19O3/c1pewj3LMRD6WKJvzWqvylLxNrQJmRH9i62+P3ANe+j7GA4+yp/g6/ufqBZAwoGWlf3FigbtFAExB9z/KPygb/Tl2BLWMa1nm5d/UQkDQvxRjg0fbhvgSFapTYkcK5vGeT1a9S1mXDlMP7rLtzEt4dvEl9KOE+uSpXnJsJufxyaoZKs+OnLdpp69Ryut7CKy/Yq0J3sc5UvUAXFa6m54PzusCJHaqcP3dxv5z+Povyb2wI1BfOAKh/APoDzTzY8L1e9e/l8eCDpmJDS6WWYORDah9YnsKnz2EZq55n9r52P3j3g3UjqeESB6SV/vEDtRwZEMz1p+K/c0rfx3yG+SHMV/N9zUBZNWsgNgAkghaUviVNW3CH6BS6O8a9+dnQLoA1T3wvbhWAsMaACj/APoDX6zAKFs/s1PDpHuu8djG1IW7a3q820NZf8Ve8MOwAqXrR/I0GfpTj/0cY+sH6694XX/Wgda/sObLuDDNsIXbXuKW/SSjEs29CfR3Bf2ZwNfbVd0D34vcE7oCUf4B9AfFWCecu1PWqBdrlLmHoMmbTSg0NbREq0K54otLXqbEF8/PWBX4YbUWpN2KF36Jtc9fKpg96W9m/fEMoPwD6A+K7RgWYW+qulaizIWIFcEajWpEIUkh+etDh5qwBl37yDGy4Euj0Y18cfrKlSlf/hH+TeHwVRria79rPlVfQlP+pzeb/mr5z2uhfwHKP4D+QCtmcAj+B8cZ3uE5Zh8CWS629cTWujXIonZ5x/t4kPwm+8i+reNaq2PNiu+K9sbbE12VF4SD/gD6A+gPSqErKKhH0G3sFfqjWa9QV8QuETFwRKCawiXreLusPPd1n+U7+U2meXCXszrGl1CvRtCH1TzWezu6fqA/9If+kA36g1L2EOd/djXuZjkinuE899NUd5ArhKPLmpNALhLLXRw7JMm2fOd6WMwKb8w/1ed8xtiPWoZZqsPTG/pDf+gPxaA/0MrIKzTcFsj/9AtqjXWzD4GHKSMitq+CFxRfroHHpi5KDHt4fUJ/6A/9oRT0B2W9aMwQS3v+x19WD0Fk8R6CkiQ5J59b5nxe8R/m3wFOH9Af+kN/KAT9gVZOS8eG21qxCFnOEU7TjiGlJH6OnJPFP28ZankeEd6gP/SH/lAG+oPyDhs71BrE8y6PGo4h2WbDxhYrcd5yDjkXjysdla4oiA/9oT/0hyLQH1TQmBCPvzzK4nytpmFE23MNa7A0H4Q8lSfnraahRNhW1o6q/TDGfKA/9If+UAL6gwp+CPxS/X7PIkVwNKbz1z0IkfbcElh8ue7C8+d5zj9czgXxoT/0h/5QAPoDreKniORHjIq2/5M9Oz/iz6simstJxOgeyjUsw7wCFuK173TRsw0nDzKEv8J/f8xdTU+6nD0w1QP64z8P/QH0B1rlWD0qlpQo+oIyw601WdAEFu6YOGzwqmx5EktaRJV5oa4xnfwxI/5OfpN91L66Y8kxTtMlL+MsVQzhEeQB+gPoD6A/qGzWoLt15hfud7cl0tKO15iXh2E1pzNGt454capkBIqQtdvP8AOxWh4cOUaO9ZYvgP4A+gPoDyp5t5B7TGlZltU/3L+2I9LRhAUPZrHbWKOtjeU7tWSrEXdac5t3CuGhP/6j0B9Af3DzUUWmafjisCH7GlM70NUD/QH0B9AfaL+RsSKx8sSyE6FVEktRLD+C4NAfQH8A/QEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgJuUKpJiY2NvCYoNulVSSEjI7zTi7znJtut72ce1P/5t0B9Af/Db0J9i6ZbYr2NvnTVr1u+IKF9f2Zbv5DfZB9r/hoSXQu0utlnkGDkWDwP0x78R+oObD9K4YqfrK3tf9FfHagT9bzpitVu0EO137l85I5z32CPtDa0R1j7WSGucLdL2PqdZRnpfvpPfZB/Z1/1YaSEYLQMA/QH0B5VZftaqoF6xc2L/PGnOpICEBQndUpamDJ2+aPqExMWJ0yXJtnwnv8k+su91xxLnR9D/ZjD5VHeey2r3G+R3ny3K9hIX8LlcsE85oh0UOCqQgsYGUcCogOuSfCe/yT6yLx/zpRxbP6L+va7WRH63IYD+APqDyiU/t9rdK/63lr91b8LihI6JixJTUpal/C91Weo2TvvTlqcdSF2RmsGfeyQZ2wfkN9knZUnK/5IWJSWzQdDxrS/eutfdsChObwIoL6tfEhMQHfB3ZeVH2U5I4eaCnecYzgU7yk78XQ5/XuUCnuOe1Hf6byT7yjEBIwPkZXCc84r3H+z/WMHzAOgPoD+oHK1+V+U87vNxf5u+cHpk8tLk77hCz0hblrY3dXnqVv7cyH+vdyU2CjZIcv9O7aPvu1eOTV6S/F3CwoSouAVxj3gyMkDF47L6tSaDm/yJC+sILtDnAkYHkCPGkSeFmv/O5oKdJ4XbZMqTY+RYfhnkSV68nWmLsMXUGlzrT5rRLYjxQeiPfz/0BxWrv6t7Pm5p3J+41d4vaVnSaq7E93EFvtVVwXMLXyr/TWaSsa8yEFKXcq8B58XGxBoeKug7+MPBuv6zoH/lKPy6EJot2mbnQrs5cLTqxstTVn2kPdeHQu85RaqXQY7kKXnz9nY5Fx4C6A/9oT/01yp0yEe892Vz0sJJ9ZKWJM3jlvt+rrC3qBb98lTTlb7XpOex3shzf+KSxIVx8+LqyznVuTEkVPGWvzXcOpCt/avOWCcpa780Cv6NL4JcyTsgNkC6CK9YhlkGubqe8BKA/pAD+oOKGe+fsmDKy+zEJ+P7u7jFLl35Ja/4b0wb2bhYx2knn2vr1IVTX4FfQAXP65QNe7g9USxz+3B7DnfRlX7BL5D4JZAr55JzstdwguthhCUI/SEL9AflU/kble4t7MU/0nDek0p6QxlU/AXTBjYCNqneAD63+IO4XQ8or8Iv1j8XxvdUt1yUsvrzyrrwX9ctyOdUY4ORtg+CgvLnC+MhgP4A+oMy7PbX9KBOtyYsShjPLf4DhgPfxnKo/PN7AwyHwf3sFzCxZ2rP37tdGyjTwm944HIh/DBwTCAZDj5UEUnOLdfA2x9qLg9hvASgP4D+oEz0d7W0ufU9kSv/g0aX/6aKSDIkwJ8H2BCJz+8Jgv5lh2vMjwv/OMP6rrDCf91LQLog+ZrcrxFAfwD9Qenh8vbnVne4ms+vV8CbKjIZ17B/2oJpEe7XCEq78M/KL/yvyvxc15zdSpJynCOdck093a8VQH8A/YFWGuP+usPfwilh7ISXwV75Gyq68nf3C+CeiIyp86d2cb9WUJpBPhhbuO0Z9vbNVEE9ynPMz8SYoLqm4fYs61BrXfdrBtAfQH9Q8pZ//Jz4mjI3n1vdW8p5zL9In4D0Femb2TDZKNeIngCt1J1+tH/1/dcfuYD9KNNwjMhdVJmStEikFWCPtq/iRURuc792AP0B9AfF13/grIG387j/bG5p7zaC+2yqTEkZJkvTdnMsgs/ZKfAO6F/K43624bYYIxCHx8IvFrgr3Cdb5OTgT2e0jZzDbWrb1wKtjudjJQ+HkecN57lxPFBND+KXwAiMB0J/6A/9oWApjfsvnN6fu/29jvtL9D73aH9p6jsjFWts3/PxBc/jyR9ArhW9AKXY9cdBN6pzoTrrtesv2k6WARayDraQM4YL7ggHWaOcVHtwANUcGED1hjm4IHPhjTZR8KPtal85Ro6VPCyRTpWn5G0dbFXnskcX0hUYbT8n14yuQOgP/aE/hCx+fH/5nPjFxH9zKN61XLl67P9bUtAAACAASURBVPqXCjlxQeKOpIVJ29NXpG1M/yp9Q8rydzYkLn5nw/RF72xIXpKWX5kXHQZYT3KMHCt5pCxP38Bd/BskbzmHnMuLEbBRXePS1LVyze73AErwALBlPVNW6iqs669Wh5pUvVk1qta2NtV5uR49P6YuRX5ajUZ+9iR1nFSXnhniJP9w/UXgLQ/5TfaRfUPi61Ls7CcpemY1ajOWj3+1HtVoX5vPUV2dqxCv4BzjWmfiBQD9oT/0h5JasQP+yGfCkoQpsjCPMd/fY8U97oNxJ8ekjTn/1vvjj0/6bMr+97+asmvhuom7F6+P3/Xxt4lbExenc+WcvjGtiFa/7CP7yjGLN8TvWsB5fPj1tJ2TZ0/Z9/YHcb/IOcbzuQoxIuQaM+Sa3e8BFLPwW2IsFraoXVZ/nrfuunr9LVT7hbrU9KUnqEbz6vTYs09R6MBH6cM599D2vbfRonVVqdkYf6o/zOmxJSDf1Q93UnPeZ/H6qrTv8G302eJ76IVhj9DjnFe1ptWpYbcnqHYPP6rXz1JYt2L+tVoiLBZYgdAf+ldi/SONIQPoXyn1n7pgqh+3/rcWtZhPwvzEHRNnTjqY/NmozKSZ0dnJM6NzPlsWeeW7DcMubts/JHPNnpFH3luZvCVlaZpHI0C+k99kn7W8765DQ8/9uHnohS9WRFxJ+U90duL/RWcnzBx5Xs4xfX7CzqIWE5JrlmuH/iX1/I2yfWJY1IXO+fXnbrov1j7IBpdGW3bdTomf/JU6D/0nPdqkFr004nH1/dZDd1GDEVayGmOE7i8Q+U5+23roTrVvSL/H6T5LLWrT5wlKnV2VMo7crr6fvfpB8ufuxaLmBssypHztH6MVAP2hfyXTP0Kv8G0xPFQQ49Q/ox0UFMP6H4T+lan1n7QoKZ7H1gtt/SsnPO6mX7171KFjvw48t2Pf4Kyvf4q4+NnyqCsps2Ky56yMunLqbL/z2w9FnXhnRSp763s4nr+T37b/HHXi5Jl+5z9bGnll+ifDc/5vSdSVb9ZHXNxzeEjmiXODzv24a/ShlGXpRTkhSpTADLl29AKUpPBH2p5m6/yqMd7m0foXRx0Zp5s8/zFVQHNzq6jPq5c0Snlbo0b17qCXut5JWec09X3cl4/z2F4gBfBxrjxkW76bOFd/UUho5+9+upO27buD1n6n0YjXNIp6WaNV3+h5x899TJ3T6ZbHDa2AaNWyuCL3gJcA9If+Fax/pq7/BNb/6aFBFMDOfQ361qNne9ahJr2fodp9HDRtqZ5HXh70rwyt/7gv42rI1DpuUW8ubMxexum/2vzW/hNccR8+Mejc8bODzh47NfDs1yv6XvzgvX5XP/ti4OVDvww+e+rcgKxlG9/aL2P77v4Asi3fLd/Eefza//yRk4POrt819Pz2A0OzNm8bkLVobu9LC77sfWnTlgFZp8/1P7+C95NzFuZTINcsMwPkHtAL4CM8jeZW4wUw1vD8zfbW9WeNdFCjWCsdOX2bKpzZOXpBH9KjCvHCzfToHzS6lz8Hv6gX3nlrqvIYX4Dy7r029mdT3y34qar+8sjW9925UaMn79Lobj7+z5z+dYdGuzZpdPLibaq1IOd2FBEhTO7B/Z4A9AcVoP8LuqZz19xPzq7PUKem/6Awx0PUxfYgdXU8SG1t/6A3I6rSmZO3GEYg9K8oXEv8JixMGGws9OO19a+33JM3Zxwd+uvRUwMyxQA49uugc/Pn9L00eXSvnOQJr2dPf/P17Plf9r0oBsCa3bFHE3iMv6ABIOP+a/eOPHLi1wFZPx8fdO5k5qCzuzMGZKZO6pU9ZWyvHEnJ8b2yd+zuf37/ifDT6XxOTz0JBXwBZEbAIPd7ApoP836j7DucI5zkbXlPcdrxG+qkbtPqcMGvkl9wz7O1X+cejR7jQvvE7zV6hD9r3s2/Z2v0xZoHqRZ79xZsAdYaFECf/aB3IV6+rOc1dZRGf+Fja9yup3t4O2GMCvREnSfWIT8v48mu5UPVtfM9yL1gXij0h/4Vp3+dP7OuF1i/t+6ldrUepm62ByjM/lB+6mpnI4C/7/XcA7Rv560qn8mx0L+i9I99L/a25CXJi7grfYe3oD9ScSctTd84839Td0jFzy33c0dPDzp38OjAzBnT3riaPLFXdgpX4ElxvbLTp7xx9fDxfudX7Rx12FMPgLTo5bcTZwZkHfqFDYCsQWe/Wt734tQ3e+WkTu6VLUm2Vy7vc/FE1uCzn347dYecu5BeAFk+eIfcg9wL9Nd8nPcbZWvljHEWGvFLOe5wIewQV5euZF+z3LOvaBT4pEb3c4F98laNqvKn899VKI8rgIEf1KDag67vvpPtOtylN/C9Gur4K1f1l8knqbr1/8StepLtT1P1F0Dw2358bkfhU4tkWlCMihDWEvOCoT/0rxj9/8qfTf00+vL9O7mS/xt1cT6kWv/uBoCkboEPUdvaD9OADlXVMJDofxf0r5DW/8S5E5twJbqzsIh/Lse9j/87ffvPxwcrA0DSYW7Bv5/c+2rCON0AkM/3k3pfPXJqQNbcNfG7C3bfuwwA+e2XXwdkSg/ACTYA/vddvwtTxvTKSeGWvyTZ/v5//S4cPzf47EdfT9/uzaEwP3G4Yh7C2DVpwaTG6AXwMeY3vwCmFdb9594NWJ+n7vyw8x699XZVX555zsfcZXdrFXqIF5B6gj+/navRyh3c/TvYzWqPdAvwIXN/uTWxcF3V/HHgzMwqFNqgCj3IBf9BzqdT4C2qFblqzz26N7H5hUKmIkZ4JdS/QGUC/X97+otu0nqflXYL9W//AHWo9zB18VD5uxsBzz/1N1r8nz+p/Lo+q/EzpNEDSv8q0F8rn5j/CYsTYmS53aKc/1INI2DLgeG/yPg9V95nZQjgx1X9L0iXfcL4XtnJbASsX9f78vp9I48kLvYWxId7E2QYYM+II+IEePTUoLMHjg4695+Pe19OHK/nM/Oj3pePnux/Xs6VvMRUQCG1ZDAPZcRgjQAfun/8evr9ngvP1sK6/9y7AetxYWw/wY8OnNA9dXPz9JbAsYMafb9Io6MHNFq8+QFVYG0RutVu44AdVs5fkngBq+8i9Py+5HFC99bE2m80Wvet/vfBU7dTu/F+6gXgjC4yRrjqBrRGWbfIPaEbqOL1V+O2XgwA+U3pv7rk+jvEsIyA/hWu/0KNfjlahWbNvo/aPfM36ur0XvlLEuOgY/2HaWDHB2jr2rvozKlb6cevNdq4+nr9/VH+y677f1bsH3ga3Xx2pNtRVMx/fRhA9QJs231k2CkxAqQVf/zcwMy9B/qf37Chz6U9BwZkrc0YdVgP2cvHLU290amQv0sxtlftHnn46OkBmafODsiSz01b+l3YspVb/pz3nmPhpz7+Zvo2OaeJwELiwLhD7kXuCfpr5rx//cP9a3MLILsw719PL4Emoy2UvPQRWpdxN2Ucu4N2H7+TVuy4n/p/8DS3/HhaToSNbCNUpC5q0K8eNXmlNqdaaltZ7DIdiPepOzSA3kh7muasup+2/3wnHb9wB+08fjelLHuEGo+0qHM5o02FFFXewHIvlkhLLXgDV6z+VtXjw85b4TIVzCotNJVkW5L6jfcpif5S8UuyioHJ89eV0Rllh/4VpP9X26tSn09qU+OOT1O3+g947Pq/IbFTYKj17/Ryo6doSMdq9O74f9C3C++jDz5/mJrE+tMzEfwsxepTB901R/kvHe//CXMn1DK60E2H7ZXx+He/St7yzZY3D2w9EHV818/hp3Yejjqxbv/Iw3PWTN4lTn7cGpcuezYo0tYbqwluVEltp61P08ftN0pPwOc/Tt4lhsD2QxEn9p2IOLnzyPBfvt785sEZfA419m82rPBymXaYsiluftzTmA2gmfP+Zcu5lzGP1vSiH+LJbYlwqOlcVv4MjOExXn651xzA4TwHcksigoN38DKiTd6oR+2bPapb+9YHVZLt9k0f5d/81D6yb51BDk4BXLBtFMDJf6hD5WUN53NF2fILvZeCf90iIbJ8qTXS+hq8gStI/0HSkmT9+YXdcFQjajG+BT0X/xy1mdxGJdluMa4F/9ZQ7x1gQ6AODxWIX4CDtRa9/Yfpecs53GcQFExS8VvYkGzS35+eHeAvRgD0r0j9+wfQ0+FB1CKsGnXzv59CHQ8XaQCE2ngoIOBheqNVdXq92VP0QuDT7CRYk7o2qEUvtqlJod3qUOvX6lGDIVZ1btFb0nW9Pyj/WrG9/xcldOEpdPvSpKI2G7t/ubTu0zeKgx9X5hvTueKVVr0rnG+6VPJSGa9I2ZW6IvVA2sq0w+kr049Kkm35Tv3G+8i+bASo4+TvNFWJpxl5p5tp+buvD6BHBuR7gh+A+TW/pweOKXr8z1M3rsu72xYpBVKShV8GDmoxqTUH93Bwhc8evxbDA9itNSDfiTEQ0pf3nfIcBUjwkREcYISPrW+81G0jubCz5e/PvQiWEY78gq9ae5xkWMEmFn90gXFA/V6mYxywgvRnraTSD0kMobC0MOr6TlePSX6TfWTfwBj9WBvnYTOme0neBYcPXC979Xzwb1Lxh3apQ304Gl33jrXIEq3rb4f+FaK/gw2/AB6Hf76/XTf2TfQAhPLUwO6B/6A3WtZgI6AG9Wldnfo+x4k/+7SoTv04KqDo+3rrp6hHSC1q/+Iz1KyvPwWEc49StP5+sA433gMRtuyg0Sj/mg/j/0mLk2K469zU+L+nBXyu/y6FW/gpW9NWpB1I/zr9VNrXaZnp/03P8pTUb7IP75u6LGVr+vLrVx0s5sJC6+Ve5J7gB2Bi/EfT5/9+54x1SqHJtRdzJS9pudm4JddkbBPqlB5KXd98juf8cgG3eXkJOPTfuvB2j6HPUpcRzTkKmIWee53jirO1H/yqHwW/UpfavaSnDhx2NKTHM9Sxex3qxC0CeemHhdWmLqG1qVun2url/0KHWtSlc63cQDUOaPvW072CMtb/TdY/qZOq4Lukd1GVfGhqqEqyXfBv2Uf27ZTckZq+1UQNEdijblxRzr3il88WvesrzXu3qEF9OV68VB69OTXp659rH62Gn6B/RZX/lE7UJakzhTV+jMLE+C+sF4B/C+XPl5v8i3pzBa+MgAKpVys9idZiCIjest3z+adV+X++px814oWJ5BnxH27PdYyC/qb15yESdgCcyZXmTqObviTL9G7kln0GV+y/vvPfd7LSv0nP5HSOt89Kku2Cf6d9oxsI/HmaDYG9RfkgmBgCkHvYxff0f27DP9Df2wNgH2q/iwv+Sa8rf/mQpGu3K7/Qu8zoSqHtn6Kw+lWLKPyG9c/79JEXuVsBdyWx/vNTs+t/U6m53jpwHffac0/lBUTLeKHtRFBsjTvxAJSz/kbFH5p2rcIvKsm+LkOgNeehO3TZ8it+adlJxe9kf5Hn2Dh8gReHcentXknI32GhtfNsUplF2U7UgP4Vo38q6/peNwob2ojC6lXNr+g9Vv6W+6k79xL2bvIk9W5u6NnqKT0VYgwog88w/iTJdy+1q0kdu9XJazLIKj1BKP+FNv/1/0nc0rg/cff/t1xpbitu5avWDZAgPV+lHlGte6743Sv8opLsm28IyPDAUiPP4hohfC/sB/Bt3Idxf3K/V6Dd6ADElv/j/LK87NAdbIr9AgieEqwq/7B3OE1uR2EBf9db/3YzTkAP0+vNq91QyH1NqlUgBkCkcgS7FDA44DE4ApWj/ka3fkmS5BE8OVhNF7UaFX/gMBsFv1yXXgl+Wr3spfJ3rwjc0+utauQ9y61BPhb6V7T+77IR0NtOYewLEFb//uvfBzI8UPevFNb639Q9vDG98noAvc6r/73BZVgZA02rqfL8hhedvRkEAxpXy5PeQx5KZP39oX8Rsf/j5sY9xhXmOllWt9iVrlTYX6UdM1r950qUxAjgvFKXFq8HwLgHWcb4p7gFcY9gbYAiAoCws0yQh5W1TCfpsn1+0vPUbQYXdunWlUI/ppW5it8t9Wz6b+rtxeo3m+QF8FprNgAi9LFBrkQCEBCkHPUvqoKXlmFKqP6cSEop0EtgfN/1/e703LRgajjIQh142Kfn808ZFX8NrxW/6zupADp2f4YXnWHDYSj0r3D95X0Q25zC2tegsMC/6z0BTk5NH6ew120UltiJQj/oTqHca9gluTN1H9eGXhryLL3avT6X5RrKB8ClfcEK31MSA1CGA8Q/KBDl37v9R7p3/KS5kxzcA7C1uF3uytP/q7Qj3II/X+LK/1o6L70JJRkOkHuaOGei3f1egacAING2UDPzfz16YPNUrubjml+z/F0GwJutfTMAeCigZ3O2+ls/fa37zy0VbOkXZgCIo1DgUGuuQx/T7AxHoHLUv7CKXz0bvN8HPbh7uDuFvS+ph95jZPgDhPKzE8p/dxsfTK9yi7BX66fyx3u9VfqSpHKQ/cRQED8RNhxyndC/cugv2spwgOwzpT2FvcXvhgltKIwre/Uc5OvPSYaOZPiQ9+/C37ce05Sav+5HYtBJ975rmMf1TBQ0CKRn6EXej4ePVDwA6K8VOQNg2sJpwVxZ7inm+P8G8eYvlZb/jcMCWXxNB9Q5iuEHwEMAeybPmxyMmQBa4VOAZLqMTJvxZQqQy/LnPK5z7lJJCvQ09v5u8A/TQwDiLNir8b/1rj9Xaizp39SHPwuO/7vG/MVvoLeR3A2AoCHWHKfuCNQTU4HKWX9Plb8MDYlhOO55CuvrpLAX61HYy/76GLE8K9IC5H27j2lNPV+06lryM+Desvdc8evPgwwNBL/sp4YKjHgAOcY9Qf+K1j/N6PWRCp4rd2UEznBrMHgyGDh1SetCnflv5+gG4tinHA0bcY9QG+7eF8c/MfZ6F+gdkO0QNhZ4f11/lP8iDQBePCdMpgC6zwBQrfqihwNkPv8OrqzPlnblbwwFyOdZNjC2F9oTsFSmDaapeAKugEOuqYDTFk8LhQFQ9Apg/Y0QoD6/ADyO+7l6Abo9Q2F+7ADk/FvhHsA8Ptit5b/p1dec9MqrDh4LdNLLbwTSy304DWhIPfoGqlkAbV/xU4VfPH7FEaxVL0n1lTd4s771qWk/fzUlrDHPBXdE8FxguadwW3+8AMpZ/4LPghiEPCsgrFtdXXO/v+rPhSRxEHv2Uer6hp16dven3s143Lfpk9ccwQpW/Many/FTnAHlWRDnQNe0QOU0yPcSoK9pD/0rUn9vz4QJoyGUDceu6eIP0kam9qlgYq6YDzK8J1MAm/epr6YE9uDngLv+VSOhJb8PxAAIlAYA9Pc+BPB1rPqfJC1K6uFaAVAq0vTl6RuSliRtmzJvyjFJhRgCG7mb/pjh9HeujIwAcQo85nVxIq701XXOn3KMW/zb5NqN69VXBlw0vYf7vQLPQUCifJ0DLBH+JIhLWLqXAi4W/qS2ei+A/wOejQD5Tn4L4n0mtlXdhNL9G8otBNUVLH9zN3Fn/gx4sxHVj7Hr8QBirk9Wt7gA+fEBIl1zwe1ReAGUs/7uSVr+0tXbprru8KV0f/hakvFg6wPKGHg56DHdB8TTEI9hDOhdv9WpG0//E8PPfVrgdcFgoH/l0L+UkpzL5jYrxHUd7gGBGg62qmBBYhjwFGDob9IA4Olyr6UtTTvIFeda7gnYwkMCB+PnxZ9h58CsuC/jshIXJ+6WivWGLvZlKbvUPP6yqvyNJOfg890wRVGuKXFR4m5exCiTU5Zc89SFUw9xGGCOJ5C+lvc5wMZNTxgAXuApUn8wWgDDfX0ByNifOP54tf5dvQBj2Rmw0SN6q0+8fmVIwGZ4ANfj7xpy5T+mpT5GqFoGbuPFaq54Z+rGrYA28c9za956XTRAT8lDMKDh7vcKykl/97HfV/z1yt9bT5DD6AkSP5BmBRxBZZsrfBkOkBaexH6Qnh5pAXqq+KF/JdK/lJKcQ86lQkd7CQOtNI925PcCQf+i6ZnaU62VkL40vSdXlod4KGAPV6K/SsXPFeo5SbI9ad6kEx5j7q9MO1Kmrf/rewE8OgTKtbldr8sQ+HX6gul7uUfgZ+4heNX9XoGHaUA8BpgYoHeXZZvt+nMOd+rBPoxAL4VWAJPZ8efl+rrXbwBXAhzyM6wJBwh5qb7+m6vy95KPnKNTcid1TlcrwMQ15gToPgApmAZUAfqnGr4g4vQVZG46qMSDeKHBo0YvACeeFioVf6/na9LLvTik9BDu5h+udwND/5ug/JdS8qX85xsD0F8zGwVw1KxRI7givTrxy4lnJ87TK373JBUsh9XNUL0Axng7t8a3cKV8Rs3dL+segG9UtMBf1Tn1eAOb5VrkmtyNlfw0jw0Bvhe5p5GzRo5CNEAvBb9eRL3HJQKYr/N/xRJvPLaxucKvxoC76t6+EhksnuMDxLc1PIC76UMFJsYD5VxyTk+tgEIXBhquYoOv4vHDf+JFUI76i6bi5R/ZxIgEZ242SFfuJXhD5n83qUavt6tNLw1qRF2nhqhnpdGbjfVeIOh/85T/UjQCUP5LNwBQs7HNHqw1oNbYFxNe3DR5/uSLXHGeuaEyNVrWk+ZPOiUx+vMj7S1P3Vselb+7EcDOgNdmKrARINekKntP18z3MnnB5AsvTntxc61+tcY1jm38EAICFXgAOALYQ44Yx1FnjNOnCGBSCFvFtVJdc6Y8gF1OP/LCmGF4AKd38cEZKFSdS87p0wuA70nujdMRuVc8AOWov3h9y3Q/XihGOfqZWBBGzQaReBAd69CLEU2pi8wPN/xCuon+Ewz9o6H/TVX+S5hQ/rUyiQDZNL7pX+oMqvNht6ndNnNlKS3ps14MAL0XYGHC/vQVyhdgA8/7PyTT9HyJ9leC6YBn1TTDlekH5dxyDezct99j6/9aOiv31GNqj011Btb58NmIZ+9FREjNwyIgw+2vGF1luWXu/Zs/H7yY0eH4nGaHAAxHpVy5N64wXsVc4HLW39UDMKyRHgXOjAEgwwQN2V8kIUQFhlEOZoZfCPT/jZT/kkSHhP6lvgzwE32eaNxpYqct3F1+rpDKVPUCyNg6j6tLwKCNXBkfK5fxfzc/ADmn4QewRa7FGPP3es1yTx3jOm6u3qd6YywL7MUK9Ovp93t7jP0nXxYCcfCKXyH8ki7vLsAOCR18maKkAsHIvck9wvorZ/3FyJOenrhgc5W/7COhYjs8pQ8ZFWhZQn+Uf+hfNgSPD/5g/Jzxl+Pnx58prEKVFrd42asYAV+nnXIt9FNOKVPOKT4APOXv5yJa/+fkXuSe5N6gcFGRwCJtHYxIYHnmlgB1UEdeua28XwAdkzqSMV5prvuP78kSZWkP67+C9FdGAPt5dK6pDwMUEQ8irB4bAJGN9Z4DDwYA9Ef5h/6lr39IXEijcV+MuxA/N77IXgDpWudpdjtk5b4KMABOy7mNoYpCW/9yL3JPcm/Qv6hWQKzfHVxgDjtizK0GJt64nVM6l1vhdyU5p5zbTOGXe+EX22G5N1j/FaS/Kx6EOH5K17608F1z/13J9bdME+z6zLUIcdAf5R/6a+XhC8Jz5G+bMGfCNq40LxXmB+AyAqbOn3pMvPLL0wlQGRt8Tgn4U1TlL/cg9yL3JPcG3w8zS4JG2ecYU4FMRQNrP719fgtAPr0lXyz8wvKQTzmnT1MAo21fQPwK1t8VD4IXeAlr+S+9J0CWiJaZARIESmJB8HaXFzi8q8qrqwoBC/1R/qF/+a0IyDHz3+dx9RzuWj9TROWqUvJXyeVZ+Z9755t31DnNXJvcg9wLz2x4FysBaibDgUbYRpkNBiKeuM+OeTZ/zfcQ7g70lDqlmm8lyL7e8nGtFS/nNOMF7BYEZCSigFWg/qqV2OXaIkAy9XNwAx4SqEVhzz3J0QGrUVgPPwob3ZI6vRNGISnQH+Uf+msVsB5A8pLkPtyyv2jSAMicsmjKJVflnLoy1WPiLntfov15zce1j5zTROtfGQBTF0y9yA6LvbEOgMlxIBkrc4xwmB8H5NQiviW9tWg0bTj4Ha3O+IrW7FupkmyvP/BfWrzlcxXLWwqw1yk+/JvsI/vKMQXzkbzlHC3jWynnI7Pjf3IvlkhLO4z/VCL9xatfVv9zi/0g0/y68nf5+u+D/ij/0L+8DYBJCya1SlySuJ8rUFM9AOxkdyVhecL5OT99nrV+/6rLa/b9cHmtW1rH3323c+UlabmbmOZ3TvaVY9zzkDwlbzmHnEvOaeba5B7kXni4oCUMAB/mBHPBOecYbjIoCEfcco4IoEEz+1N2zhnuZbnM6QKni5STe56E5dvmU9uEdqqAe53ew7/JPrKvoB970cjrssp70H/6k+GkZCr4h7oHvpeAAQEPoguwkumfcn3sh67cQ9B2elvoj/IP/StwCGDs52Mf5Ol1P7CX/1GJ/19o5T8v/mzcvLjL8QsnXfn0h08yD53enX30TEbOkV/3qnT49J6cE5kHcn7Y8+2l5JXJMoe/0Mpf9pF9T5w7oI515SN5St6f/vhJ5iQ+lzonn7vQ1v+XaqbCUbmXCbMmPIAhAB/g+bJLfFoWlAtk0wlN6ceMFfw/Pk/ZuScoN++UnnJPUeTn4dQ+qQMX8i6FvAC6qH1k39y80/nHS16Sp+TddHwzs4VfXbvcA89vXgxFoT+A/sAcSYuT3k1ZkrKPK9LTRXS1iwFwceKCiTnTlkw7vzbj+0tHuOI+cGJH9sGTO420K3vm6plZKStTzhVlAMg+M1f/X5Yc4zpe8pI812b8cEnOIedS5yzcSVGu+bTcg9wLFPV1VbBo+zBjWdBss/OB60f608Sl45TFnmcUYNnecewnXsvb/BhgKO+789g6dazkIXnJtuQt5zDb/afG//geOL75MIz/QX/oD/2hsLlhgIQFCa9xqN19HGUvo6h59mrRnfnx2XHz467MWzfnPLfYsw+e0ivvo7y96dDaK776AGzmY+RYZQRwXpLnvPVzzss55FxyzqLiFPCCRvvSVqRlyAqH6P7XfIsN7h/pX4Mt7StGqNU8M/OBvS9HqAAAC2BJREFULeEWCp4UTCezMrjAZnIX3kn+vEQffJ9GbRLaFtr9594N2CYhWB0jx+p5ZHKee1Xe/uH+Zuf/5hnXfsU/1r8GYn9Df+gP/SGwuaiAPG++Oi/xK6F+t3As/dNe4+y7+QFMmD8hJ2l50sXdxzZf5e777AO6AZCzdPOii0krkwrt/nfvBZB9l25ZdFGOlTwkr91HN12VvOUcJsb/MyfNnXRarl3uga+9GqL/acWYDsRdZ750A4pl7uT9F26arQpvHp2mi1ePUp9Pe1PHFHPBQlSQD963zye96eKVoyoPyWvh5tkUMDLQvPXv6v6Lti/C3F/oD/2hP2T1jcRFie/xSns7uRdgT2G9ADzPXlYOvDhx/sTcSQsnX/xu10pVeR86tSt734nt2R99/1Fm6teppnsAZN+Pf/goc9/x7dmSh+T1Lecpecs55FzqnIW1/vma05el7+LWP7r/i9sNyJZ2DzWH1uQLIHhyMHVIDqHoORFsuZ9SBff7vSt4XK+9z/OA5Rg5Vm8FnFJ5hnDeEgPcbPhPeQHIPWjw/oX+0B/6A5+GAaYumtqBV9rLkFY0r7Z3smAvgHLCk+/mqRUCT/Lc/HMpXHnP4vF+GcOXinvNvu8vJ8vYv6/z/PmYNRnfX5Y8JC/JU/JOXpF8juf0n3Sd9wZHQP5OfpeFguTaeTpjB3T/F7cF8JL9Lra49xorhOWaWRWs2zvdVJQuGfcjukpxS9+mtontTHX/XecNzMdM5GOJsjmvtSpPydvUKmB8reqao+175B7QAoD+0B/6Q1bNp9kgQ78celfSkqTl3AuwlVvSuwsYAJnS0uZFdk4nLErI4Mp2Y9rKtAOyUE8qj+FvOrj2yrEz+3K+XPfF+aK8/73NBpjL/gS/cB6bDq65InkaqwDuF4NEfBP43KdUz0SB6+Lr2S3XLNcu94DZH1oJYoNH24b4EhWsU2JHCubxvk9WvUtZlw5TjxndqTNP9eriS6xvCfXJwUDk2EzO45NVM1SeHTlvs9G/AkcFivU/BNY/9If+0B+KFq8XYNqCacoZkBf9WcdL6v4iFa5R6Z6ZtnDaAf5tsywIxC3uTWwEbObW+8nEr5IyV2xbciHjl23ZM7gy98UB0N0RUI7NOL4tW/KSPCVvdR5OXMFLC3+zXAMPB/xqDFFkcU/EcV4kaJ1cs1w7Wv8ltALr965/L48FHjITG1yW52wwsgG1T2xP4bOH0Mw171M7H7v/3LsB2/GUIMlD8mqf2IEajmxY9BKgRuxvXvnrkN8gv/tg/UF/6A/9IWjxYgLEfhJ7H0cG/G/6ivQt7BOwU8beudL9mRfi2aoqYaNCNtJGrnh3SOt95qpPs1ZuW3ZBTf375p1ihfuVYyUPyUvy5Ip9h7EE8CZ3Q4B7BLbwNR2Sa5NrlGvla/5Wrh1z/0ujFRBl6ycWtZlWgHTPNR7bmLrwMq493u2hrP9iL/hhtAJk/W/J02ToTz32d4ytH6x/6A/9oT+ULLEvwEtc2e7jtD5padI2rmA3yFK8BSp/VxKjYK8s2DPj2xnFav1f3wswQy3+I3kaed9wTrkWMQTk2rg3Yj0bBNL6fxmtf6301gnn7rQ1ap3wKHMvgSZvNqHQ1FCfxv48tQIkPKjkZarwi+dvrAr8sVoL0m7F2B/0h/7QHzKWTP++U/v+kYPpzOHKdpdUsNL17qXyzzcCuFJmIyDtXAmXCVbHSl7eKv/rDAG5Nr5GDv37RUhsyB+gf2m0AkJ0C9oeYW+qutaiCncGcn8JNBrViEKSQpQFrwJ8mGgNuPaRY2TN70ajG5kq/EbKldCf/hH+Td2vHUB/AP1B8XsBePw/kBfU2ZU/3l902pC6gg2GlWmnxTHQcO47a8IB8Czvrxz+uAfgtORhpvI3DICN3PrfyUGMAtH610o/OAgXsDgjOliO2ZeArNndemJrvTXAhbrLO97HA+U32Uf2bR3XWh1rtvArxx++Nt6eqL+5NIgP/QH0ByWVn/QAOjwTIMrlEGjaCOBgPOlfpf/MlftZwxAorEcgU3n6876pX6X+zOfa4kPlrxz/pi+ZHu1+zaAUu4KCegTdxl7BP5r1CnZF7JJCHDgikFqMb6HW8XZZ+e5rfMt38lvLCS2J5yGrY4p0+HEf99ODfqy2DrTejq4f6A/9oT9kK139B84aeDtPrfuMK9w9PAyw3myrXFXiy1O3cVjeA9wjcEIZA9K1/01apiSj8j8rv6V9lXaQ896uhhHM9zbItezha/s8dl7sHRocP8suRCQXtmrczXZE5tnyuuGmugMlJKcUZpc1HxATQA1HNVSOPZJkW75zvSzMFnxV+Pka1JzfGPtRyzBLdYR8hP7QH/pDsbLRf/zs8U/wDIDvuULfboQKLrqC1n0GNrpa8ynLU7byuP5OzmOPJNmW79x6DcxW/JvkGvj4bewA+MP4+eOfgP5aOXgFh9sCudBdkPE20y8BD1OGpLD7WuALFn65Bh6bvMhxyBvA6xf6Q3/oD6W0spoaqCpWnm5nNSr1raaNgBt7BVwGgarwfWjtF3Q23MIr/m2ZPG+yzf0aQRk7BVmGWNpzwbusXgKRxXsJlCTJOfncMuf3iv8w/w5w+oH+0B/6QyGtfAIEzZvWgit/aclvMbrgN5VnEo9/VfkvTdk2Zf6UljD+tPKPFc4tgVZcCLOcI5ymHYNKqfDnyDm58J+3DLU8j6U+oT/0h/5QppyNgIXTGvFwwCYe299u1iegVBKfS87Jlf8mnu/fGB7/FfgSsA61BvG826OGY1B2UdHCSpQ4bzmHnIvHFY9KVyQKP/SH/tAfilSMESDDAex89z9uke81ZgdsLMPKf6OE+ZVz8Tm/4wBFVlT+lWBMkMffHuXC+bWahhNtzzVaA6X5IshTeXLeahpShG1l7ajaD6PbB/pDf+gPJSrWCBgze8wjHCjoI66g93MFvbmMhgTWq7yXph7gc30wdtbYh1H5V6KXgF+q3++5kEZwNK7z170IIu25JbD4c90LPn+e5/zD5Vwo/NAf+kN/KKBVCsfA2Fmxf0iYn9CLhwSkFyAjf3re8hL1CGxUFf+yNNnex3mvn75w+uus+x/g8KdVriki+RHDou3/ZM/ej/jzqhRal5OQ0T2Ya7QM8gq0EK59pxf6bMPJh4yCf4X//pi7Gp90Oftgqgf0x38e+oPKob8r8A6vyvcYL9U7kSvrzRKYhyvubfy5wTU8IHH7Pa0j4Pb9RiOojxwjx0rFvzlxceJEmYKYfz7oX/lWDzMeAhWAwTrcWpMLdAIX3GPisBM4JjBPYolLoZZ5wa4xvfwxQ/5OfpN91L66Y9ExTtMlL+MsVQzhEeQB+gPoDyrR6oFGi1xpE/dlXA1urY/ksfr/srPebq7M93PaKVMHuVLXpwIuVwGCNhjbYghsNfbZz139u+VYyUPycukv58DqfpXdGnSzzvzC/e62RFraWaOs8jJYzemM0a0nXrwqGYFCcuQ3fiGslheHHCPHessXQH8A/UHlCxvsrlPsnNg/yzS9pEVJsRxKeHbysuQfxHufk0T7k8p+p2zLd/Ibt/RnJyxKiI2fH99SjvXUywBusm5B95jiHKrzL/7h/rUdkY4mXOCDubC3sUZbG8t38psr7rjmNu8YBR/64z8K/cHN5RtQcIxedJz89eQ/j1s4rmbc/LgGkxdObsEBfFrItnwnvxXU2lM+4OaiikzT8cVhR/Y1pvagqwf6A+gPbuKhIfHUp1jzlbjsq7z7Ec//t/lAiJUvlr0UdJWkpSCWPwSH/gD6g9+0r4DqHWLdpZKXJNvyHcb2AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUDT/D4Gaemp0pFqzAAAAAElFTkSuQmCC",
  "witch": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAAEACAYAAADFkM5nAAAACXBIWXMAAAsTAAALEwEAmpwYAAAgAElEQVR42u1dB3gU1RYeICS7GxRFSgL4VCykEUqAJLvpvVNDFVTEACEEULACAZWiSAk99A4GkaZioYioFCmhSLM9lao+rAiEzdx3zp3ZsISgtBCy+f/vO99MZmdn8u1/y7mnXUUBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgFuLCroA4B8A/wD4BwAAAAAAABxV81Oa14mrG1AtsY79NQD8A+AfAP+AgyJUCXXiY6Bb3HAW+2sA+AfAPwD+AQfW/vhorp14wFw74SCdV4QWCP7BP/jHzwP+AQdGqpJaSWp/deIjLHUShaV2ogisFR9h/xkA/gHwD4B/wFEbQO2EGcF1UkRwnWTB52gA4B/8g3/8QuAfUBzb/OPnnlSdSP+JtT+pAdJ5KF2DGQj8g3/wj58J/AOK4wZ/BLgnPMnaX2DteCsLn/M1BIOAf/AP/vFLgX/AgWGpk7CuaAOwuCeswy8D/gHwD4B/wOGQVVHz/cQ1psjPCySCRNWFzy8EuMc2sb8XAP8A+AfAP6A4SvBH3GshdVuw38fWCOS5vOaW8BqCQcA/+Af/+MXAP6A4VvBHQN0AI5H9dVCdJCI+vsDWAPicr1noMz93PxOCQcA/+Af/+NnAP+BQuZ9xbYMo7cPO7GMvqvzMLb4NtEDwD/7BP3458A84BqRPx+yemBtcVwv+KNoAZDAIfWZ2T1hm/x0A/APgHwD/QBkmP6hmYj0i+QznfV5JA9RyQuPP8L1oBOAf/IN//HzgH1DKfu6n2T3+2Stpf5drgbHPIicU/IN/8I9fEPwDSlnf+CHUiTZ+2BEkyz7aB39c1gAKdB/RTuUi+QgGAf8A+AfAP6CUzdSPSN744UrEFxULRYRigwjwD/7BP/gH//glHWDjh6K5n1fWAjknNAUbRIB/8A/+wT/4B/+OsvHDFYI/Lg8GqYMNIsA/+Af/4B/8g3/FUTZ+uFoTEDaIAP/gH/yDf/AP/hXH2fjhWhsANogA//gFwT8A/gHFITZ+uNpAEGwQAf7BP/gH/+Af/CsOtPHD1WuB2CAC/IN/8A/+wT/4Vxxn44erFWwQAf7BP/gH/+Af/Dvaxg9XbQrCBhHgH/yDf/AP/sG/4hgbP1xTMAg2iAD/4B/8g3/wD/4dZuOHq9YAsUEE+Af/4B/8g3/wrzjOxg/XrgVigwjwD/7BP/gH/4BS1jd+uIYGgA0iwD/4B//gH/yDf8XBNn7ABhHgH/yDf/AP/sG/AzSAgNrxObr557yuAao3IvwMfpY0A9Gz0QDAP/gH//jFwT9wm5l/Gt8bVZuCNn7nMo5ktpEpHBYpSSJIF8s/SFCR+/j7uqhaA0j8LaBaRB2YgcA/+Af/+NnBP3AbaX/N3eNiSFvbSfJJYO3ET6kxbAp0T9gf4BZ7gio6/UhyNNAt7qg/SaBbvJ3E6cLnfE/8jwFucSf4u2Z+Ru2ET7Vnxu800zugBYJ/8A/+8cuDf+D2awikmYkKaUpOZb7WwBA+1dc1Qviawv8kOdvAFEYSIsVHF+087Cx/rt/zp69ruGhgCJuiyMjPrMLgDxAP/vFLg38A/AO3JUSFXEVUylFE5SxFGBoZozf7meJEE2NMgZ8xlo6xorEpRjQyRYuGpig6RtHf0fIaf8b3NKZ7m5hiRUNj1Cf0DGcSJxLkf4J/APwD4B+4TVEhS9no1Ec54vKeIlz6KcvdmxoSTvobk4W/sYUaaGrFR9Gc/m5qTBJNTQkkiaIZnfM9AcaWQrsnRW1O15oY4k72VObX3EGNKY0kVcmF9gf+AfAPgH/gttP9SPvTtLUdJjp3SXUaFkik5gcb2wmLSzs1wLmNsBhSRbCxvQg0thEBhjYikMRsbEvXOtBn7QTfYza0VS2mttxQ8ls6vdicnuWUTY2KNUv8yuAfAP8A+AduM7CZhk02RNad3AASXZ7uFmLsKCzO7dXkKhniyZojBB+DnDuKMOOjItjQUYQYOtF5FxHs3EmkVMmU9yRV6S3Mzm3VIGOqiKmc0ZWeVWm0kufKjYsbGX7p8sf/M+Af/R/8l1v+WakA/7c5WEPLVlSXkcr3dxNRzgkufYYzsRnu2dbNYWfEzighNoWeEb3dJ4gQ584i0vg4yRN03oXumShs92wO+0uku4+1ml3aiRiXtJc1zXLrndy4UukdLLn6MVU2DviHHI//cReK8p8jzYAX+be1AW1QwMCA/g84Gv9RGv8VbfznFuFf4x59/7YJ/phDgR9jlB+qnVZE1WjnJxfHGtPEB5Zj1v1xQmyLLBD7YoVYG/ijiDX0EFGGJ6XEGXqJ9y1Hhe0ePn5gPmqNosYR7tJ1ITUA0v5/qDZJEVVoEjDNp7/5nIXeaeR3pumTAxqDQ/Jvep4GldHEO/NvawPz9b/HUBvI1ScHDAjo/+DCUfjvVsg/P/M1RdzB3K/W28Bqve+z0sHWAQWKYOk3ACKKB+OqCxThHuTceRubcz4LP1uwI0oV2yKs4otIVWwO+VskuWaKCJduUlJc+4lPw88KeU+klY6C/v67IL5KTzIFddiynJ41SxE1WIj4mvR8t8WKqM3XZyiiFkm1mdQ4OOoUZiJH4F/V+e9B/LffQoOK2zxF3DORhI/cBvj5zL/tM5oYqvJkkIOJAP0f3DsM/+Qu2MJcM+8szLet73M74DbB7+PFQR9SBND3S9kElKV8Z6CoTfLXbLk/2ND+VIhLJzG30RfqVwlC7I65II7ECzG74Q4R5txVRBieEJEG1vIfF3Mb7xC2e/g4u9F2NcilgwiiZ7ys7KlPz64zVzn74CJFeFBDaEiNovFCRTRaqgifJYp4kBvFFEXczZOArg2iEZR5/ttzYNCpEcrOh96hzk5830fcP8Sc07sasVA78CX+H1mgqHVp8q+urwqdUxEwhP4PlHH+O3KcwKlRymFPevZ/iPuH5yrCe6He94n7hm9Re5ipjQs1V5IS+B4pAQgWVEqrEISoxCkgHLXZyikrINDYKt/skioSqvRSJ3ivE8ubHxHZXh+JxCrpRGwHEWroTPKo4EaSRMEh2j1fiWzvj0T8HT1UM0WMBhnb5feqNDfmfRr4Fyv5/tTZg+cpaigNAHF0HkNiJsKb80AwWxH3UiO5m81C0ATLPv+BhrYcIZzfrdK0yM00AMxTzjem1X4QtwGSSOI6liSI2oI/Twg0CDzAKwLdVFwZ/KP/g5Wyx/94yX9P1WJoL0KMHfIzKi2MpwWA5zwlP4gm/xDiPIz4juUj933i34+VA+r3brolyBlxIaWUBtJHec+Fz4MMHTtwfmegsbXKqR7+zq2I7E7yyH9bKMIzUE8DsVBaCHf2AOfWMiq0uXNLPT2knUorANHJaVTmRtL45itnudM/SeQvelMRW1mI/PkknagBBFLjaEAaYh3yCd2JRlC2+Q8wtOZUIZVThNo6DUsn/j3mKWejiOeWxP/rJOuJ9y3UHlaTPE1/h/BAwEoAm4TZFwkrAPo/WCmr/Lcl5a+Dyt953Cn76XWk5M1XziXThP8C8f+Ozv9H9Pdw4j+a+G/OSgAvADhOJFRagYBbjjglWzaAJqb4F7jQg58x4YK/qYUwm1prhR6MWjEILgTRTBaBYKFCESatCITtngAj3W9oZQ0jLTHV+eXJn0uCz71EZP9EwR+CzD0qC59TQzhJA0MGNwI2B9Ox+sVVAFDW+A+Q97Tk+6xBNDi0rPzSuG00ASxQznckrjetIM5X2fG/TFGtxPs0Xh3SBOBLq4DasAKg/6P/l1X+pfJPSkE7K2cKdK78es56UvDJArSQ+C9YpfPPYwCPBcT5R6T8xZMbqAm7CnK1eCBn9P1SgK1us68hfEZjVyr1aIy8QKUdqSHESWkiy0HGUOnHKFkOspEsAxmtl4GMK5SmxgRqDC2s4cauIrXykDUfKKJVrmL9gclfSgM+NwQWPudr5Av6mhpCEvuEeRWACaDs8q/dE8cVwqxcIKSly7OrP5Km/4K31ugTfi7Jmzr/xL2goCDBqwP2DdIEUI/9wRwUhMhg9H+wUtb4j5dKgdnYxhpjfEq0r/zKKprwBy3XeLbjX7XyWEDuAUF/z9WtAB4cCwQLoFJ620IyvI1Bm3xNYYI2erDykTZ5sBO+HiZ85DFUntvf09AUIZpQbWgqCVkQQRpgC+eB25cpYtzbGtHc8YW98ESwQjYMMZz8gA1oILifgsLuxABQNvnnc64RTpNAAZkBRZJLv13EbWdqAz+/pfGt2vNvmwTo803sE6aVQH3ODJijRYVDAUD/B8oQ/41MkcLPFC9dgDGGNNHeeWge9fvPV0m+5eRvz726XOv7J4n/ZOr7XpwZxG4AKACl1AB8lWhXL6P5uI8pSHibglRvUzCRrYl3oQTZiXbNp1BC5ATQnGpC8wCQ6NLnh8XK+dWrJOEFlw0A3Cg0U6C6kFYA3rQCeJDTwrJgBiqj/AfToBDOKwGVXQCxLj1PzFf+fo4GgfPLLuNeGwTe1vj/LwcGkgugPvsCx2gR4VAA0P+BMsQ/KwONaTMgdgVwnYB2zll/kPn/1PJilP9cbfJnyef4EAoQ9ZyppQ26Ihvg1kMOtvWdm9b3NAWe9zJZhJfJrJIQwRYpfH4lsd3DjaIhTQBNyT/EZSLjXHr9mlPh2IaVUssvUIsbADTToJjJGiAHgmEFUHb553NeGbBZkIOFog1P/T2mwqFXaQD4qzgFgFeF+urwME0AEbT6f8RmBoQLAP0ftJQt/lkJYNcAxwNEGh4XrV1eOD9f+eunKykAuhJwjiyBnWeQAsApobAAlAq0vZo9jeYW3nbkX6vwd9ksxP4gXgFGuTxlHVZx8zIy853JLdII9HOVVocFtPpL5wFgOuWEsw9wI/KByyT/LHIQMEbJgMBIQzfxdKVlI2iQ372iGDMgSb4WGyBy58hocfEQxwDoFcKgAKD/A2WK/2DaCjhC7hoYQTEgCS69z42vcOi71ZoCaC2q/K3UYgP2L6L0ULb+ZZP1DzEASmkEgITKABDS/gY0cA0RdLxwfROARa4AOTiEosELoskM9HjlcTk0yC99RyObA0CYfHn+rjYQrLQFgbD5NwsaYBnmX1MA2BdMUcJWHgQ6VR45cS2l+y0nznVzv+T/TT0SnNrBCVoBprIJmCcAzgfGChD9H6yUPf7ZAuQrLUDxtEtguwKOA8hwWriauP9qdaHSp8ox4G0tAJiCQcWzpPj7sPWHJv+7WPlHRcjS0gAN5pwbnQCkFij9wAnWEFNH0cLl2ZWcCrJUsS6nBnBO9/uwFniW/l5Cmn8Y/e3NFeFG6WkgWP2VXf69aBDgVSBFDFt5a9Bkl34rNlGazyKlYMTSChf+95bGv7pMM/3uJ74f5wpxvPpn8//FinAA+j9QlvjX3ACh0g1AVgArx4G0rfzScioG1ZX4P6xzr8qMgAr5v5DSP2iRVgzIg0sFs/8/Dcq/UmoRoGQC+phXcF6mQOuNTACyERijCjhvlDaF2M4kkwbYZFLND0eMfmSyGP3IJDGx1vsvL5PlIf9swKViuQgMD/6hMP+Vcf4t+iQQUcD5wsEuHbnoSyMyAzd41WPkqnHeE8WY+xacXlTx76c5/5+CxHy5EAgPALl6ChgmAPR/0FIW+bfoVgBeAMQWcDBgtEv3nVzoawFXAK3498Cx1PfH+WSLV7xefnsNlwiu/Kc3B/9x7Adcf6XYAPwUP5OXMfD4jfqALzaCUJXzSJsZEk+OqrzNm1aB9w6tP7zHwJAUMTA0WbzsndX9PUXUXWL4373c+Tn4g2pRV4b5p6zzr5kCKSJc5ZxhP0P8yRHKtkdI66/3XECnzYMiW4tnzalbWevX6sOffYAGiBps+s8u3BQEQP8Hyir/WkZAuNqEXAEBhhYnX1cO+ZLJ35NN/QPN7bYNimpJY0B7Lgx2v576x5kfBlQBVEozAtRMEaDm8zqRNzQB6IOAyv5AWgmeTzE+408du9JLTXp0fjoiUrAMatqzA10zzKn63V0c+KH7faH9OQT/sg0Q/yGcFpgfW3lgk49qi3v6h0V880JcjHjG0mrxbvL3zTGdcluk/Hb3fLltLEy/6P/g3zH4lymCqqwNYIwi/gf7U0XQe8gKVH0A9f0X4qJFZkT4V+Nr7q2VIzcg+s6APSCUsh8BfvkgYFHZHNjENaEdv6OvJbZ1ZmwzkRnbVPQNiUrha/3r5hpzQb4D8q8pAT7kU/StlJScG/dCjd4xTf8amOQvMsNDh/E7s6q9J81+aYVmf7QB9H/AcfhnJYCzQlLaiixNucugvs9jQO/YJr8/59/+fjkOKBux8lccIAK8qPCz+Jk+Jsvz/I60iKbJGQkNRUaCr0iPaRYnyQ/NAvkOzL+va6h4qGJQ+stdG3qnx/uKvkmNmPvOcujxynXGxI/+DxYcmf9Q4W0IHmh7X5+YJp37JjUU6fE+BT1jmwTLNpClwPLjGBHgxQ8AXq6BM/gdPaJ8EnoneguWXnHeMfLtqQp8vg7Mv2+VUPFAhaBRA1o93KpvcgPRK8HrQo8Yr+Zax89Cx0f/R/93cP7JtZBje1tGolfzdBoD+ib7iF7xHl01JTAUSqDiEBHARSXQys+khrCZ38GdHgNA+eLft0qweKCieXnvBK8hA1rRyi/e8/TTSY9UL/p+AP0fcFD+6dmFFoC4h2rwGPAMjwUJXllQABwsAryIqPKZRvMpfk9mkmckBoDyxb+Pa5B4pLLl66divJc904osAPFe+9LS/CpDAUD/R/8vL/wHHvdVfF01vr2ceyV47tUXA3PhAlAcMQL8YgOQR9dAq1GJqt2/pUdoBgaA8sS/DAaiZ595MsL7iK4ArMTkj/6P/l9++Odn17/DXN/2Uh4DNAXA65PirBGA4ggR4JeuAusowRHPd3wwEANA+eKfni187ggoeCra66yuAIyD2Q/9H/2//PCvW4FSChWARM+xrACQJeDHR6M1ywAUAMWxIkAvjQQPEfUqmntmdavXNCPRBwNAOeLfw2AWftUDRM84L2v/Fj7k9/PMhAKA/o/+X374l882BA6wvbcnjQH9WzRgF8CZzCjPh7VUQLgBSg2kAW68+QEgFwNBGrgGi4crB63uHe8RDR9g+eHf29Us6rtYRFDdZsS5l8qrv16xHongHf0f/b/88K8HAm60+fp7xnskaZYgL0oH9YpDOygVaClYnsYgfyKqoGT8v7oJyNUi6jtbfk/29R2ckex5LgMDQLngnxWAhytbRPRDfmrfFE8y/3uez4jx8UDgD/o/+n/54b+wHdzR1Mzv7BHn5UWWwL/ZCtAj3iMDFkGlFP0/psCJJWX+sZsIVA+XIBH6H79dmSmev2MAKB/8swLwiLNFJDdorPZv6cVugJ/TU72qKPD5of+j/5cb/i/WAwicyO9Mi/KrSrFAx2QcQJznG1AAlNJJ//C6M6CahzHwRAkGgFxqCq7T7Fx6omcBmwB7xnrHYgBwfP45BiC1WUNSADxFl2CfXxtVaVQDCgD6P/p/+eHfFgjoSe9qUDXobkVmAnh+LhWAeK+3MR4opRb80c3HtaR8P8X5gpur7PfBAFB++Gfuu4Y0EP1aehSk+jURD1QO7Gb/PwDo/2DEsfkvjAWgd3lXCejO7+4Z57lYUwA889L8UBekVOBVosEfxQaD8QCgYgAoH/xzCmDDqoHiqWhvVgCsyd7NeF+Ajfjl0f/R/8sP/7oCUCAVAJNZqwqZ4PmyrgD8r3ekxz1QAJRbG/zhW/LBH1eKBscKoBzwz5x7GCzCv5Y/m/lEn2RPNaJeU44JKGhwR/MA+/8FQP8HHJd/+3f4UEDoHUp4/WdaPtKuX0oDTgvO753k0QSBwYrjBX/80wCAICDH5t8WABh2fzORkeTJdb9FoHuzC14GemcVLRgoVf9fAPR/wHH5L1oT4sHK5pEvdnq4UXqCt8hMoraQ6JWqtQWMB4qDBX8U9QEW5oOnRfkgH9yB+belAMZ5NBF9W3iKtFhv0eiuAJXSjmRtcP4fYPZD/0f/d3z+L0sJdQn8voVfgwa9Ez3/90xLuSnQ88gEUG5d8Af5Y564db6fIgNAkueFPokNRErjhv3l/wTSHZJ/G+ctGzUi/7+neCLcR16juAAZDMQBSAgGRP9H/3d8/otIgTe9u8Gd/ul9Uzy2D2zVkBWAqVAGb+nWj5YNPqYgbgAXdA2wRIXzgGkAUC11mxeQv+c8lwMNe6DpBmwE4fj8dzL7qv1a1S/oEOBbQJO/yu/k2vD8P4B/9H/w7/j8FxGr1v/NH1JK6JqBrRuyVQhtQblFwR/ehkAzm350Ue3OS0w48IMLgYTU9Rd9kxuoJCLk3gDhrgRZEAzmuPwz750DG4q+Kd6iVUM/WgUG8TX9nUHC2xAA/tH/wb+D8395ewiiypBBv3bw992WmcIFwjw3IBXwFmmADWjrRw+DfwcPY0ArD6N/61slDzsHtApwb9apU6BPZmezT58At2aP1VP8Hwbpjs1/w6oBrULva9rBUtevE7cB7Tod6X/gbUjBf/nq/x2o73e0+GSg/5cv/ovKQ87mNpEP+oW92NnDvU/cQy6gBwAAAAAAoCRNQZx+VRrCAT/2oigCmn954D9VlyLXYfpF/wcf5Yf/4kRolgm0AwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKBcoIIuAPgHwD8A/gEAAAAAAABH1fyU5nXi6gZUS6xjfw0A/wD4Bxyffz/3pOp+7qHVwX85Q6gS6sTHQLe44Sz21wDwD4B/wHGRqqRW0viP7RLgFt/V/hpQTrQ/PpprJx4w1044SOcVoQWCf/AP/vHzlB8EuMfnsOCXKI/aX534CEudRGGpnSgCa8VHQAsE/+Af/OMXcnRkVdTcPzENA93j3gusHfcen9t/BpSHAaB2wozgOikiuE6y4HMMAOAf/IN//ELlQwEIqBXXh1b/66TQORQApXwFf1Cn/4m1f7kCoPNQugYzIPgH/+AfP5ODB39Wi7vT3y1uUaB7/LtS3OIX8jXwr5SP4J8A94QnWfsPrB1vZeFzvoZgIPAP/sE/finFoa0/zd3jYgLc49aTC2AVC5+b6RqsQOUEljoJ64oOABb3hHX4ZcA/AP4BxwZlfoxg0/9FBSB2HV/DL6M4vu+Hgj4aU+TvBRJBourC5xeoITSBLwj8g3/wj99LcUjzv7lG3INk9l9Nq/53SNbo8o4/XePP9HvBv+KwwT9xr4XUbcF+P9sgIM/lNbeE12AGAv/gH/zjF3Mw9U9X6vxrxT5Oq/4NAbXjVhYqAHROSsEG/sz+XsDBtL+AugFG6uxfB9VJoo4fX2AbAPicr1noMz93PxOCQcA/+Af/t8e/LioIkixFVExVRCWb8N98HdRePf8PKXEuFPA3M6B2/PvmOgmrSdbospqv8Wd8D/q/w+b+xrUNorQfO7OfvajyM7f4NlgFgH/wD/5Le+InqcgTfS5N+CxpiqhsE7ruxNdICaioaIIJ61/cP5Z7k4JIAfyQ0v5WNa8Rs9qvepQUPg9wo3gA+izoP8kWuIEcD5JMs3tibnBdLfin6AAgg4HoM7N7wjL4gcA/+Af/pTn52yZ+oa32nbMV1WWOIgw2oWsGvpZDyoDNKgCai/klhaiQm5srfxvfKqHPN6sRsz74vuTV8T4d17Zs2vVDFj4P/k/y6qb0Gd/D9/J3+Lv4BR2k8wfVTKxHnfwM5/1eaQWg5QTHn+F7MQmAf/AP/kvHXy3N+xV5crdN/KMV4UoKQZWZiriDZT79TZ+b+HNWENgikCUtAYD95G9zk2SmPveftOSnPxiSPmr7uKycXdNGzc2bNmrOHk3m5o0fMn3nkPTXtqW1GPDhc49l3S+/z+4XKAGKQ+T+mt3jn72S9n/5KiD2WeQEg/9bx78099oJUH77v5y02PTvpE/uJp7wafKvOkMR1eYp4h46rzZFEXcvUNQ7WRHorwij7hZAXIDd5M/HvLw8Vzpv/MHyDROnj55/ZPa4RXtmvrFgz/TR8/bkvKYJn/M1/mz6G/OPfLBiw0T+zv79p6rYPwtQyurGH6FOtPHHjiBZ9tM++OeyAaBA9xHuVC52fpAP/ks0uKuoCCgD5bj/a6Z/XtWPoYmdJ3+e7GcpokauSbi9oYjqLGQVcGNlgKwAVdk6oCsLTuW9zchVvz5h07EeSRerVfRZOPWt9VNGzv4y57W5ebaJ/3KZmzd1xOz9i6Ys22DNt2byd0keLPpcQClzqT+RvPHHlTp+UbFQRDA2CAH/JcO/FtwlLg70TkWDu2wBXlkI7ip3/T/LbvXPJn5e+S/SJ/yJNOGvqSV8VtUS3iPonFb/NdkawErCGDsrAFb/crI20ySeQf7Jm38AACAASURBVMcn9+86lEWm/n1XnvgvFb53/45DWfxdYRX8DDMm/zK+8UfR3N8rrwI4JzgFG4SA/xLg/2Jwl52J18CDt03m2AV32aK/YdYtL/2/0CLESqBhEvn8afK/m9qAXPl/Fqg+90WE+Ivl0wDx7Ej+rIqowVaASxWA8tteaKJ2Ioki6WO1WnvQ8bFVi9cuoZX9oRmj5+/+t8mf7+F7+Tv8Xf0ZffRnYi4oyxt/XCH45/JgoDrYIAT833z+7YO7HqMBngZ2Iw/yK2kFx4M4+3Rnaucm9uuyGVhcTPVCGywH/T9VT/djRZDbApv5s8n8v6S6eGR3lPhpT4wQe0l2R4uTi6qKeuwesCkAtoyAcr7654k6kybup+jY/ZefTvedPXbh1pxRc6/aAsD38ndO//R7X36G/ix2CUShWylld+OPqzUBYoMQ8H/z+deCuzbS6q6Pbt6llf6dPIBLEy/5dxe7ilo2vy4rBnq6lzOsADeb/0Rdiv+79Pr/5RYADvxj//8iF1EvL0r97mCcECx5UeKbeQbxH/68vFsA7Hz+Fn213t22+v9s/bZxU0bMPjj99Xl5V6sA8L38nU8/2jbezgrQXX+2GYGBStnc+ONaJwBsEFK++TffVP4vBnfxyv81Wt3x4M1+XFICakZTIFeaVApEDR7wxyniLg7uek8P7kI8wI3yn2A169v/2sRcO0nKpdfk6r/U+r99DICe+ld1vquoSdeqfeInOm6LEPu2hYt9G5uKDn2pjSyqIqqzpYCVxfIYA2A3+T9M0ltVVV6tp+nSfen05e9NHTnnwLUqAPwd/q4+8cvn6c/uTfIIlAClTG78cbWBQNggpFzyb1sJJqr68abxX3Rg51UbT/Q8+efWEA9tDhQDPgsUz7xVU9Rjfy9bAmzBXTnw7d4g/3JyV7VJPkkEsbgn0wSvCZ8HXaoI6PyXRv+/sqL4HLuJTMI9hySLrEfcfrgd2dUDKFdZAHaT/10kj5P05ElaX7F3++bw9y9ey8RfnCLwzcHvXuRn8TN1BaCn/q67oAQoZW/jj6tfBV66QUiokuWEAdjR+L+46rPICeCi0MrwQmjdlsLilvj6jZuBizftLlZELTrW2hom1nwVLwQLna+epVsBbIO7zQ2A9nd9/LMixzzLib92Ck34LUSwe0uSFrpo5/yZRVcE+Duls0HQlV1F1AZqsGLIwm4je1dRea4DQJMwRUXIaH25WreZ/9e+tW7u1Qb/FRcMOJm++y49w84NkKa/g98Vg56mlMWNP652FZig5wQnfhNaI72KNgjkIjXLQfi3N/tqk4JNWuiSUhBcuyWvDr9J1fm/Ed6LC+7ilf47bqonBXf9uSNStbJQcNefubVFfR7wV5CJV08FgwJw3fwn8yY/BZbayfrE30KEuLciaS1C3dtI4XO+FqzxLvhei97/A0thgyBbpoi9EsCWAFYEdKWwKp+zJSnLLk6kPJn/7Vb/95OkFzH9P3X2zNn0udlLNk8bOWf/9VgB+Dv8XX4GP4ufWcQVwNfuhxWgbG78ceUcYN03KFcC7klyEgitk9qWn/mYstHw7zna/7Z7Fwq8lD7/tpV/spz8batAbVLQJJgkyL1lQUhtOur8pyk5la+Pu0stADyYc043rd7cSBmovSVMbPg2QQiW7aFiHV9nC8AcXQGABeD6+bfIEr9JOs8ax2HubUWYW6qIcGsvJdytnbwWQsoA32OzBJTWBkH244etHDC7gvQJvwoLtwtbkCi3q/Ia/U+Tbyt7BUBfqT++4/O8UbT6P3CjLgB+xo5P80bxM21WADsFoBV6nFL2Nv74p8lfMwEm21aC1vA6bWlCaLucn/mMcqJQ407TU24umtwu3b3LVtClGKkIK0Jp82/zBafoK0J9UnBPlZNBBE8INEGQImANq9OOJ4a3tJXZRqfr3Su8OBcADeLuPNkvqyN8twSKERQDMGJNXeEzRQ8MtHcBoM1cO/+a+T/BGkT9+SLP2sQf5dZJRNbqJMJrdZDnEW4dJOcXlQCpPFJp4BaltEHQP9eLYNGtA5VD6R5RPn3/DxZd/euT9BO5s1etoMp/B29YAaBnLJu9ZgU/084NYK8EPAgrQNnb+ENc2SSsmYF1M6EaSgNGaK02f7e5K8tXVQR1xCN32gfdaJr3pdt2Xmn3LjblbtQtCEjtKj3+NbN/cqE5WJv424tIt45yMrBJmFs7lT8Ldmt1JvaenvWVG4oFkas6J70dVGHz/hStklsdigWoTQplVRrQ71xASgFbBdhFsEAz+dopAMDV8R+p8y/9+Sqb9UNoUmdzf7ic/DuL8JodRGytx0RK7Z7yPLJWR6kYhLm11RQAahv0fWk90DYIirxlGwRdyQKQpbUFKfrfBj1A1Cm1HI4nNOmm2Ef+6xP0k8d/ODWAfPg7qbTv3uud/O3KA+/lZ/Ez+dlFrACcEZCMbqeUvY0/ivP7W+wmBVr1y9VguFsHa2ztx0RyrfRh1MGc3lCOybSbrIsDc+GEzp2RtXKO3uVNOnill60Xd+Hz1dp3pAVho6a1Y1V3y/nXV//umkk4TOdZrgJrdhShNUgZqNGBjm1tSoA1ojatDmumvqjHgTjfiAJgywKw1XfnCZ/azX9yXMSDsyjXe7Ii7uXgQK0AjHrnpVkAwNXzr63+bVxLRY9W+JHMac32ost/XhBrLN+LLZHnxcTGH4roWo9KBTDcPVVaCnQFQLcC3NoNgmyLCZ13Z1vBKFscAAv/PV+PAeD7ykvBKLvVfy2SHnZ+/7T8/HyO0H9swzubp3IA342s/u2tAPys9Ws+mcbP1t+RVkRqwQqglK2NPy5fFV6cFHilECZXhNJMWMCTguWe1nteVf7rztG3PHhz55tj5w6waeq23bvYf8t+3llUqpPFtnvXJM2HhwIvpca/TQHQTMKh+qQQQSvA1nX6iMlNNohF/nmi90Oj5UQR6dahIMK9vQhxa7NbjwG5zkjryxUAjurm1T4rAHNcxP1TSaYral0oADeHf7MM/ruoANgUvdAa7cTMppvFISqo80VUgays1/PBESK4ZmsR6d5BxoDYKQC3eIOg4ncD5PFEFgWisYRz/20VAMvbeGKnAHB9/owiwX/SCrBg8rL1FMD35c1SAPhZ/Ex7F4BdRgCKAylleOOP4iYFbaVA5uBanUVcrW7i+frT1WHei8VA98Ud31MEbcH5Z80F+uCcra34ufNdtnsXb+DB9bpZZigXq7yxWRcFXkqL/4tc80CvTQpkEq7RXsxo+qk4Qql4+2OF+DziT9G2bl9y/2hxAaG1KWK8Zqeoi26Am+cCWKiI+zgWgIWu38tWAbgAbgb/F609IXZch5BCn+O3SRwhBWAnKQBcXvepeq/oCkD7IgpA4i3eIOjKuwFiPClUAiqRdCDpVcT8/8SXOw8Pu6ayv9dQHpifbR8LoL+7l/6/YJ+A22EACKgdn6Obf8/rK0D134WLhCSRr7AF+fzbqOQLVKPduqgRNToVTGm8oYBKbxYcponh87D83dQ5/zOeOh93Sts2nLYgndX67l3cWXkVx8cNHmooC3XS6nJLT7vdu1DgpTT4t+e6tUqTgkrKnhpV61F1ufmASqtBdVuEVd0dXaA+fv8glSaFAvIbnw+vkyqC3FrOuF4FoLggQB7Q55ICwMGAHz4iIj94RESwEsAKQNE6AGgn18M/WwBkDIBKlj2V/PvUtzuqYTXbqR3ufUbNDfhS3Rj6m/pagxUqxQDQZx0o5qMt3dtKtg9uJ/wMfpZ0A9CzS1oBKG43QIwnl63+6+gFedKKBP89vnrR+4s5cG/G6AW7bpYFgJ/Fz1y95P3FRWoC2IT/l9qwApSy+a/xvVG1qcP/zmU8yWwnU3gsUmgVoIulWOF0MFoRUspXeG1aJbh3Jp8g+f3deokNoT+LXVHCui3SWrA35sKF3Ae+j9bqc/9Rg31y+qYtMkLXfvcu7qBbLOL1HbQ1Bcu2YPHaGL2iFwq8lB7/fC2IPpfpnbSqD6cVX7T7o9Lc/5xHjjQJ84pwXvMdItatq2wL5AJQWQGgSeT34Lvb33vtZuDL0wBtWQBsBfjcLEZvjyRzNMln1Ga4PoC+1SvayQ3wz0cpet8Oq00ZAGTiZ77Da7GFr4tIrN1dhFEmQKQ7ufvctRgAvpfbh/4c7VlSAUj8LaBaRJ2ScwNceTdAjCdycq2oH5vZav7bTf7dfzr5S/8Zo+ft5Mmac/jZdC/rALw2by9Ljn60nWtBgnMvu247Tr34jC+nSKVi/k5+h91eA/ZugGb2/yNQCtp/c/e4GNLWd5J8Elg78VMaDDYFuifsD3CLPUEVvX4kORroFnfUnyTQLd5O6HqtpGNBtVofD63V/nhkjUePx1R//KeYak8eWtx0/3+/StCqtL0TdOz3bndld/meOuV45WQt9tGm6YF9NnOdbparnnuPqL8zSv2VCrvwzl2kRKi/vlVdPMyWgzko8FJq/JtlG0g4ZmG+a7Y8FlKzzbHwmsR5zU7Hw6q1P96xznMn0u4ffiKyeudTZAE6SG6gz8JqpW4JcWv1aZBb8i4KEo29nlVgcYWAuJ28dY/w4Hayi9tINJuk0U5uJv9mt8T9gbUSTwbVanmUuQ6tmXo8rGYH4vvR4xEkYTU7atzTNf4smO4JqpVylL9D7WS/mdtQ7YRPtWfG7zTTO0rSCnCldoLx5BJFIKmY6P8n8rYfeHXh5Nx1S3LeXrto6vIP+LhgQu7HM99YuH3W6IXbZr6+aPusNxZuY5kpZYGUwmv0ue0e/s687Dc3LZ62/P3F095+n5/Fz96749ArxbgBOBsgET3x9hgIZKEdrWiLojQwhE/1dY0QvqbwP0nONjCFkYRI8dGFr/maIs82NsWdbWZKPhtgbHMm2NhRRDv3WvjeXcJ3Y9MLoz4PEOOX1Pk17HXl1INLyE/L5jdWAPRsAEN/3QJgq9u90CDu2x0pDrBPmYXPZxvEvfZ+O6zsSoN/TXxNEWcbmqLPNjbGnvUzJp5tZmxxLsDY+lxTQ8q5xi4JZwKMLYXZkDqbgqqcn1O+qWpL+7Q992aUAkY7KXn+fQ2R0xq5RolGppg/m5jizzY1JZEknyO+zzYnaWZsSecp5/yMyeeamBJoDIjldvFnQ9dIwW1HudTlU6GE/f9oJ/8++Rtsdf+LRuPbJmWrVfSw5lv5825vzX5nybhBOQcnDZu1a+LQGXlShulSeD6dzmfm2T7ne8cNzjm4fM4aNvl3y9eedck7inEBPEbKgAt6Yek3kQp2KTSGRsbozX6mONHEGFPgZ4ylY6xobIqhASFaNDRFSWliihV+pnhBA4IINLYRFmP7gjBDVxHt0nMnBWg16EF+2n7KX+408T9CnfEhTtXibIBR+jacthiAwt27qMOyee7jBiKedu76iOUjXxFH99yFTV5Kl//G3AaI/8ZS4kRTU4LwNyaLAGMr4r6tMBvbkaQWmKkd+Btbf84BV1x5jdM7byTNqthd3tBOSox/2yqa+P60mSlRNDUmFfhT/5Y8m9qIACmt7Y6tiO+Wohm1BT9jfAGPBw2NUZttqb63KggT7eRf/f9uRdP/7EsAyyMrAGdFT5a5Y3M/HPfSjMMTh8zeN2HIrP0s2VJmFhHtMxa+d9xLOYfnjHvzA36GyKf3Wa/4TqQD3kaowNXa+ihHXCha36Wfsty9qSHhJA/w1PnVQNnJW9BEn8wDghz8m9Lg0NxIQUM0MATR4B9qIn+w8TE10vCkiHR56qfXnb62rHtIPPpOPWvH6aQAUCd7kKKz62ZrKVx36AU5ZBaAzWxn09q5g3LHzZKi7d6FbV5vD/55oG9mShH+ppa60tdOBJk6iRBTZ2oHHVVSAoW/ofWpZ5T1931AfPVXfjDys6+fq0t3eUM7KVn+uS92VXLrNDMkneRJn5Q6NdjUUQQbO4lggy5k5QvSRTvvICymdjwWqDwmNDHEneypzK+5gyZWrfJnbqVbvRsg2sml/n9aZXsWs+1vmm3lzxN1/hlrr/wzotfvJ8/1m/bqwu0TB88+OHnIvC+nDJn/5SQ6Tsyat39i1pz9k4bO3cdH/nsyi37PlKz5rAQcyBmxYNuvx870k8pEPikCV1AC7NwAHogDKM1GUphqtcNE5y6pTsMCyZSbH0yDu8WlnRrgTAO9gYK5aHDnQT/A0EYEGrTBP9T4qAg1dBEhzl1p4n9SxBt7iUjn7n+uanJi3c5woe4IF2JzczGGOmCdBcaLCkCWvhNXml4EyLZ7F/vlcqvIKN0alB1QnXN37XfvQh2A0uSfBnpe7RvouoFy/In7COMTItzwOPFPCqChqxpm6kr3pOZ3dhobfIw41ctAO93sXd7QTm4+/2NIWfuOfrt2Tq9bAo2t80Np0g916aIGO3cRES7dRIzhKRFt7E7nT4ooQ3cRaegmIo1PEu+PCYtzBxFkaK8GmVJ5YZDf0unF5kKuyI+45N6SevtoJ/8SAOhPkmkLACxWAfiDSvTSpP31ruNDJg9ZsG/KoIUHpw5eeGDyYJrc6Th1yCJ5PnkIy0K6tuDAtMGLDtjdQ4rAggOTh87b+/Xe44OlAkAKhXQtFK8EdNf/J38oAKUI3XxGZXiP3MkTQKLL091CSLO3OLdXk6tkiCdrjhB8DHLuSKv8R2kV0FGEGCgH3NhVhNLg0KrKMyKtxhjR1vV5EenUXbSpMlBsDT8ndkQI6y6K0N4ZIU5Qx/PQ87dZK3flTupHk7/N7PyYluct4wFYQVggy7tq1QC5M+tZA87lpXLX7cd/HxHsTDXgjV2kwhdGk34UTwbO3YjvZ0UP4r8V8R7m3FXle1pUfq47PcuV4wCYX+UGTMF6EaGKaCe3hH9DssuzT3I/p76tyr5dfSz17RdFtFMPEV25h4hxThcR1M/jXXqLqMppojXx373GaJFSJZPaTDuVLYIxlTO6MgfPKHlSAbwVEyzayT+6ACKLKwBU6PunyfrMaWuGoAl76zv7x09+acHhqTS5zx684vDirPe/5eMUOdkvOSgnfVIOcuT54kvumTxo4ZeTXpp/aPv7+8ayCyD/D2v6v1gAeIvgSLgAShE8CbPvbKTy/d0cvJXg0mc4D/YZ7tnWzWFnKMJaiE2hZ0Rv9wm00utMWv/jJE/IVX8f90liU8gZsZ1W+h8HnRF9a00TsTQwfGg5qVLFsALOAvgiXHzBVdu4CAeb4tj0RlG7zna7/VXUSwM7F928g7V0Pbe3MvYCKH3+Q4nzaONTIsbYQw7+/dxyxMeWM2JbqJDHzFpTrOHOj4tkl4EjhRxkf6imx3pUvNEgr3/a5AXt5Kbxb0hyeXoE89zHbbJ1E/Vp2mlRrA/4SzzrtkCMfnitWNHsWzGi3koRVzlD9K81Q/Z76uPikxBuI+OtFpf2IsYl7WXNsrD1Tl0BvAVcoJ1cbQbAJSLN/6IXKQB92AKwfuHWuRNfmP/1smEbv90+8ugfO0ed+mv7iKN/vJm14b/TBi89MH3wmwdZpgxacjB36Ibv+Z5dfA8dlw1b/+2EF+Z8/dHiz+fQc9PO/GbNuMQNYL0YF4BMgNso+GeO7Cg/VDtN5rFo5ycXxxrTxAeWY9b9VPVrW2SB2EdV3tYG/ihiDTTwGzQTYLwhXaw1HxX7KP97a1iByCMdc23zEwVxzhmid81JebvDxOpPLda17zwi4qaSC2A2BQHS5F+TgwA5C8AWfJNVZDdAm2sgTd+w49+3EgZKmn8u+7o24Chx3pvaQE8RR8cWhgHivebHRR4N/p8HFYjddHy/+XFroqGPiHPJePMImV057fM13eXDfG/UN2C5di61XSMF2kmJ8v8rmcxjnXssZVfe+wHHrXuoT28JUcX2YOrjIfkiL0YbC1ieq71ArGjyX7GX76H+z+PA++aj1ihyC4S7dF0oZKDvL1yD3y4QtKR5QTspzg1AkmpfAbA4BeAsKwCnRcbbU9avmPrC4m+3jPzvr3mjfv5756gTf/Lx8xH//W3GoGWHp7+Ue2j64GWHZg566zBfyxv1S+E9W0d9d3ryCwu/fXvKh28Lcimc+U1k8LPtJJ1dDfJ4RsYI9BbnRTuY/0t5AGD/H0fOcjW1IOfO25Kq9BafhZ8t2BGlCqrwRsVWVLE55G+R5Jop/YGRJCmu/cWnYWfF9giVTP5WsS2MVopBZwtauT4rIiv12EIrfk8ywT3EQgOMBwcCsiWAq7ZN0aLETbZtOW214u0VApuIwoEDg3qp8B9J/BPHnwT/LVJMT5OFpydP8KKt6SWxyXyWi6tok0SIEBsDzxS0Mg2kVNCeX1Ck9SOs9NksP+x7ZRPsfL0S5MbrCr6Svl60kxLinysshjg/ti25Sl/q72cLttLq//PgAvFpoFXsDFfFrhh9QUCK4egH3yeF77S0EGwJs9I4QPE+oX8XxFXpJczOHbZwxUYOxGMlgPs6Kxl9dN5Lfhc+tJMiJYA7/ZMCYJUKgMg486Paf8HoVRtokv9mx6jjv+8cdfKvHSR8/GLksT9mDV5xZPpLSw/lDM49NGvQiq/4GlsIvtDv2THq6O/TB7359cIxK9edOSn6niUFgJ8r5RfRh68VyinR59zvIvP8X6LLe32QCliqJsAs5TvDDpkTu+X+YEP7UyEuncTcRl+oXMxnd8wFmUM7u+EO9vGKCMMTFAD0BCkCj9M9O+Vnu6Ksgkr/ilkNdqpRLk/RCrHnLxOcjgUvVUSTuU6iOU0EzWhCaEqDQCOaZOrP453cuFCHtvOfS+olgUL2HRSDeWnzv4v45w1gZvvuoADPJ8kC0Iv8vxkiwTlTzPHeI/K4whopCWwlyG3ytUouBDIB9/x5gvJDc0r7fHi2cu5hVv5o8r+Pa/izQrBI25RF5mCnXneQGNrJzeJ/DvH/gdwlb3O9EEPHn8JcHmO+1YPE6Y5Qq9hDk3yu77dk8TshKz6uIWtQR9ehYrZXnjhABXZ20ALgIFkFZjX8Qg126cxxQqdGKAceWUVcsyLAwb+8yRcr/q/pWUBptyz9rny3E5rknUi6cN79P1kArLQy//W7c8/MfCV3x9SXFh3aMOLAT3tfP31296hTZ/a+/r+z64d/+XPOoKXk+19KFoDcg1MHvXmQr1285/TZ9SP2/8QxADNeWbrj12/PDTj3k8g8c0ztx4rF79+KAb8dEM//sk+8eHq/eOHXI+LZv38QA/46qT71aYq4I/QWpo0CyqVVtDgFiKN2WzllBVA6T77ZJVUkVOmlTvBeJ5Y3PyKyvT4SiVXSqWPTrl8UABhqoGBAmiSSKDhsgtd68Vazr8R4z/UUCNRXDSfFINqQlv9CxXUdKPI2cK5yIYYm/UiSMJJgmvwDF7BiQJMCp+nM1LbrdAH5tyf/bzUnbr3WSa7DKACQXUDsBoimGIAn736dSqwWyFUhV+R7z3xcTTL2o0CxHhdeqvhR+3cU4TdL+TtojqIGUF32piSNSbx5I59ZekZILjbtua34p1oO+cEuHakv91MneHwscht/KyY+8qlINQ0Wqa4viV7VJ4jWxhcoBqCPaOc6WEysv0ks8/tGjPfYQGNEH5VTBUOMnfLTK82PI6XigcXKeW/mnBV/6u8P8E6OHAzMAXq5N6QAAlepAFS+UhEgWxBg/llrLw7a+zrv6JCpQxfumzxo/sFZQ946/P4ru05uGn74NB9nDVkuAwOnDlp8MIf8/1MpAHDWkBWH1xbes/PkzMHLDk8aPP8AP+OrL04MzaeV/u9fi4GnadL/ZYc6pFDyxODTe8QgUgQG/3pI7bc8UKZrGm5dvAhwSRpQH+U9aYIJMnTs0Ixy/SkNSOVUP3/nVjTZd5JHLfUvVR618/YyJYzTxMJIKQh0plQxUgzCDd3UaIoVSHeen0UrgIg5yvnOZAl4lQaBOSRTaPXXa5GihvKEwAWCeCLgwMA0kH8b89+auG4v88FZAQyn1C+u+ZBk6ivWB/8kDnKlNbIWLPH7UsQ6p6tJLn1FZqWlw9aQ0jdXOZdCxaA6EefcDhJo0A8k8VuiK4A8EaDj3y78P9qBc/ktnP9PPHMKYCzF+kQ6pQmO7Yl3JutO5XTBVp4EQyYX/SKr4BOk8D9FGQCdZP/ndNAIyhLp7jxl4Dqp6P8dQjybKQo/gPhvRucNWRHI1Tbl4W15nRUogCWtADz2rwoApeVt/WjPGxOHzDkwhXP7OaJ/0PwveaKfPGienua38MvJgzWZOmThAU4PtN0zie6ZPHieTBOcNGT+ga3v7ss+96PofzrPOvjnbWLYyfVi1Lez1QWHxop3D2eLNd/OE3NObRHD//eFeHZFfXE/uwjZTQSFsBQQp2TLAYDKfr7AhX78jAkX/E0thJmrfRlbyoI/XAyGCwFxhbBmxkRZFIYLwvA9/DkXA+HCIJQXbk2gQLDuTlNnkwWg+2LlwuG3qBnSlq3q23SkQeA8dfxFpABEs4uATcNsGoQV4Hbkv5Xk32xsLavB+esV4Syk+LEViPP/u1Z/WcxsuFVM9v5YtL/jJRFbuXdBG8OLopfTnLmkAPRarFg/fVMRJ5cq6v/ouJ+4f50m/0hSBP30iaAam4TR8W8P/puZqI8bUy6YTVzgqwulfkqLnmClPtqlhwit/Lg+6afJYGCuBRHG6aFUA4KKgfECQPb/bk6TZpACEL1AOTeY+J7MvFN/78pWQOaexoR67AbUXUFOYKHkXABk+u98JReApgDkswLwxNrcTdOpmt9Xk4fO3TuFivzYigBN1gv9TJYFgDSxLwKk3UNC1yYNnbMv+6XZX32wcMu8fDL7n/q84JWja0T2l8PEtrynxdFd/cRJlt391R/2Dxef/7havLzIXXjwbrF6jRgnLAZuMWx1u30N4TMacw1wY+SFxsYYmgjipDSR5YC5DGyULAfM0phEu873JMhKcWZDW4oReKwgydBPdK804zOa8A+SEiCo8xe8qcsyUgTWaNfm0Lk/WQC82AqASeB25j9e45lKvRZWgTS05uIvZAFqKwIqU3EgSECAwwAAF4pJREFUp05UF+BJSgHsr7ZxeUkMcFpxgJS+48w/DfaqTQkkq5CgCWEJSTCXjObAQ14JbsQkcBvwHzmjiavs0xeayUqfbYnjjlqxL5cuItLUTaTXHi8eq/EK/d1Z1gNht6CFikRxZcBQKgUeY+hRwBkiGZXmf7FSEZ9RHxfLiXcSQf3/D+J6KrWFcHYH6bFAVaH8l3gQYIcrBgGyEqDvAbBs1pqlY1+admTi0Nl7Jg6ZtW8iTeY8oXOZX01mcWlgKbZrk4rcQ5UC92a/NOurtyevW/U3mf5//LDg9b1D1e27+4qfaOI/ShP/MT7u6i9+3N1P/Jz3vPhwcVXRmAOGbQtBWISUW78tKMPbGLTJ1xQmaNMfKx9pIxg74ethwkceQ+W57Z6Gpkg5UfAqMcLYjdLFMsWgSh+cpcG+YKliVXO1Cd8mBW/JSUH9lVYCHWgV6MN+wUmaORCTwG3If8NCiZT7QDSS+0AkCHYXBJAViF1DocbOskYAKQCivcsrIqfCDzzhk8WngBU/lSVXUa25+mRAq8FnbeZgfWMWuAFuC/55E6hIq5/c8yFR9mnmlyf4uY13ij1yVz0hBj+4UDRzoe1+TW3ZZSQrg7K1gPt+B+dXxPQKx8Qq2d9VYeP/LV0BJO4nUd9vPk9RPXl/EL00OAb9EioGRNKKJP1KCoBN5o5funb8kGkHJgydvjd7yPR92Vkz9k4g4WP2UPp7qH5u+5vumWB/j/x71t4Jg+ceWvj6Ox+f3iUGfztLXbi7f8GxXbz670ur/77qqV2ZJH3F8T3PiqNbuohvllQU7VkZxEKwFAcAXyXa1ctoPu5jChLepiDV2xRMk70m3oUSZCfaNf6cFQLeKIY3BuEMgWSXp8WYSvvkiu9NpUAUUQCEPhjwSnAwrQC9OD3wtULzD3D78R8ixUdKqOBJQtsUiqxANFHQbpDkJmgrM0QSaQJIrzyrcNB/U+Pbjn/VulqbBN6hQFA/zhRYdFHzhwJQqvxbjjO/JCrzy0oA7wnh55IoWt2TSRP/BbGV0oJ5a93Vgd+SctCG3QVC3zdAVofk2IAXnd4VKyXHrPyr9v2+YLmm/J8iC0ArVv7ZAjRfZiDA9FuCSkDcFQsB6RsCnT1zNn3yiNlbxg3J2ZdNO/1lD83hSb5QJgzL2ZNNMm6oJnwurxXek7OXFYcJQ2eQJWDugVnD3tp9bOvZl9nnzxM/r/x3Zhb8tDOTLAGkAOzOFCf2Pi9+/LSF+JHawrO8WRyniEMBuPWQmnd956b1PU2B571MFuFlMqskNOhbpPD5lcSbhCeJRrQ6ZNMwuQDkKnBcxS/F27LTF68A6KvAYbOgAJQR/i2Fyp9N6WMrUENSBmg7WLkrZDiZgOMoaOyZysvEsourv6L8F6zU2sVWcgFYWAHgFDEoALcD/+bzmmIfojK37OprSu492hxKhN3xqPgo+JRM9+X00CkNPxaNXeKI9yTJPSuAnCGS4jLgH/t+ruYS4uOzMyqf9mXTL/p+yZYCpomfEjlFn+L3ApBb9T757ZHvn6NJffe4rJy9tkn+WoUVAlIA9k4aMvfLaUOWHji07qfRHPC3s2/BqTzdAsAKgKYEkALwovhxU4z6XxoHBkynvWL0miFQAG4ttL26PY3mFt52g/+1CE8KbCLm4EBOFeM0saxK63gVoBbjAlCXkVFqWYWC82QB6MJmwEtXAcDty/+lSoDNOkAmY8k95ZDL4LCelWeQAlDs5F9oAciVFoB8DgR8iC0AuVo0OBSAUuWfubWoNgWPlTuO/WFuebJvW6O/mOS7TozwXC4i7nyUdv6LlQqCljnSRm4Q1MJloMiueERXANTiFACb9e+l92ny511Cx1XdfRf6foluBtTkXxSAx7d/snPkmCFT91/v5F9oFWAFgGICpgxacHj7siPTflwoZknzvwwALDiRR6Z/8v2fIFfAsX2kAKw3iy9nK2rrBdXUurxNs75JE9xByi0LAAqVHY9WfwMauIYIOl64VgXAiwYOXjFwHABvBhJN0cEdnUeI+RV+k35gWgkUaP5f1crnmm9QrKKJvxnnB+fofkBofmWFf0uhdcBb574JWQEoh1yuAtu4vCBmVDwmtKwPa0Gu9P9L4fMLK6g46Tzj8deoTkC9WS6/1eOd2xADcHvwT9xe8JEKXohU6hsZtWDfpqQENHKJEQ2cI4WPc4Sc/P0oOLSxMVYGh3K2CFv/2AL0SqVPbC6AosqftAAtrXRevOI97Jss3wEDyPxbS9/MxykrNBRKQMlsBlTvSkGA+fn5HADY9YMVG6a+8dLUQ9nDZuy+XgVgPLsNsqbvnURxABNfnP31R7O+WPLHdpG1/2Wx5YvMc79+nvm/M1/0+/sXUgZ+3P20+J6CAX/+oJmYTdsz1+fdYnO0MvHO2MejNFYABnPO9SsAFukbbkR+Q39yA5AVQKVqgKKf0+LDNBD8wCu+1VoAkNT+p9+9Q0yptblbrpz8//4P7w+AFWBZ5d8iJwvKHJCZILxFNEWCix6Vc2gCOC8DwdgawC6Bt+nI7WBqrQ3ief8ux16rNzuBtw0edfdHVXOh/N0W/BOnugJw0Qogs37IEtCUJnpOA9ZSRWOJ8yjZ5zn+h60AnBHA2wZ3dX5DLK5wRiwvovwvrWCVQYAz3T8Rg0I7iIHhiSIzInhHRnhoxzS/tMpSEchSKqamKmgLN1cBqKZP/j2uZAF4c/aqJTeqAEgrgIwDmLWHMwFWTNqw6u9D4rnv3z2b/dmL/z3xWeZP57dk/nqWMgCO5w1Q/7v/VfHxB+EighYAdae4ippICVVKLwKYTIAfc6f3MgVar10BMMuAQI4Yb6JlAxTwroGJLv22kxm4Hck0kncXOf3xwWsPTzo3JLiLeM7/8RVUKazmrCrHEflZ5vm3yMmCzcUyE4SKwfCeAT2dph8lhW8LTQJn3qxQkE/nh3Pu3rXpRXOXghfCWon+4dEnXgp83CwHfq9UZ9BR2vwHMZ9WzcVjUwJsmT4RegZItJz0tYyQcD0TKFJagNgKwEWimPuMynPEQuVvlZX/Vbrip2cAfDaq/tgpAy2tTzwbHSUGJASqmQmNRK84r897JdVPztJjEqAI3NpUwNnjl6wdM3jqgfFDp+fdmBtg+p6JQ6fvGT94xsEFY95e//d34ukD7x+a+t7EpV99OOqjoztfP/7ZN1PEm98vK5h58lPx9Fs1RT0uCLZSiwPBIrA0BgA/xc/kZQw8fr0xABdXgsFyUCBXgMoTQZjLoz+PU370p9Wf9zzlTFNa5Xk9F9DxwxciWoj+YZHWAQFPRbG5J/uh95D7Wab5v8h9UzILU2EoNdxIWwe7dD85WTkVQxN/yyWKtT0N/lHcFl5s2nPCwKgo8XSsWWTG+p1Ij/b3l+ZomIBvC/69L4v1CLFL+70oDWTGgJYZoqUCx8uUQHIFqDEUC/Jo5ZF/LFIuLKZ+v4HiAd6jRcArFPAV8h5VgZxc8xPfp4Njh2XE+B3rl9xQ9G/RQM1I8hY94z03pyd4xdn+NygCN80KQPs2ioxiFIDCDICxlAFwowqAFgw4fc+EIdO/nPbq/O1/fq/237R05drVk2d8t3bmgt0ndv8+9M+vxDO/fW0dfGKTaP88xf+svEcrB49FoFJaEcBmGQGsD+jXqQBoUeM8IPgaw1U9eOh850rjwqjIS90c55891lKw3ysNRkb1jQw6OyDBLPrENHtHkRuS5IL4Ms5/IfcycCxWZVdQkDE1v2+lJfE84M9SznlxvAdXgDtI2n6/0OhhfeP9RGZSQ5GR6HOqe5xHAJSA24l/i4ztsbcGeNvJxSDQIP3vEGklYCWAlH+V60KQNeD805XWpNDqrvEC5Tzv/8F7AnjNV359gGKD7uJ3p4c+5tYrzmdIr3jPE/1SGmiKQKK3Sn9v7BHvEW37R6EI3HAgoHdRBeBiBsCPN5wBcJklIGva/kkvz9q56+PtY9+dO33XyulTvv7s7ffesh4Tmb9/lT/gr2Pqcyc+EaT402ZUoSgBrJTVDIDiJgJtQAhVOTWQasi3p1V+pYnK0Xsm3nH0Hn5fn+jAqf2TmoiMBF8Sn0T5n6Bzl3n+tclAWy2Sf1jloFDKCOlC/LvOVH7mTWDI3fNbtexqR+7k9/aKaTKgT2ID0SfJR/RO9P5fWsLDIVACbjf+Lw34vCi2FFFL4T02BbCxpvyrnBnQxmlwzwOk+M9Tfn+EIrzv590BSe6apJyqknXfxsKI77RQv+o06Q/tleD5k00R6C0VAa+P6Bh2URHIIkUgFWPFtVsAqvJkbx8HcDMzAC4LCCRlInvYzJ0r587d+M78CftXz52894cD32aJs6LH2dPWPrRVcM9Dq0V1NvlnZcH6q5TdDIDiTcIcTOTrGi4aGMKe5Xc8o3xAaX4bDXLgjwyq1zvB51S/Fg144N8MJhyFf4tdqmDwhUau7BuOf0GL8t56J6f4cLBnjrKjcpZXlvT594z16J2R6CWVgIwEr9/S4h6JlPdDCbgN+bfYSfEKoOYuIJeAMeICFxIyG1oP4XcMV47U4GwP3vhLL/0rt3/VJnSp/MuJisz/br0SPIaTMvALjw+aIuBV0CveY23PRM9ge0WABSxekzKQYl8Q6GZmAFwmWdPzxmdNObBk6tivVs0d9+W6FfPf4TRE61lSOvJFxoVzIgWMOEQGQPHCz9Keac7Ru6ys9GVb3aUnegzul+IjB/6eSd5d+FouNHuH4Z8VwAau5CM2BE/nd3gpuXLrV7sc3wpZoYpsC73iPNJICVD7kA84I8H7j/QY6QOGElAm+S90HVxoKBcAkTP5Hf2Vz42c6plVuO/7pcFediZ+eb17XIO66fFeo9PjPU/rFgHRO8HLSjEC7/RO8giEInBdVgAfezfAzc4AuFQBmLFr8qvjvl86ZdSxlXPH7juYt+U1fhe9k60PGeySkP8TVv9Kmc8AKF4CrfxMT2Pgx0XeKd/7WGjDu2jQP8ydmzr2vkeja7kW/b8AR+Df/HFx7ywcwHUloEds/cepPVilEpDk9VevOO9k+8+Bssq/ReefJ6F/j/Auqgj0IUWgV7z32PQEz99YCdCshl4XeiZ4rOgR49W86LgC/KMCYCpua+CblQFwaU2A6XmzXh/184LsV39du3T6x1ayNuiKh7Q6kBjt/zegTGcAFCsympifze+wf6dtZccrv8xkH9GXJD3R6xktFgBWAEfn/0pKQFp8/U6kBORLJSDR6++eMd5toAQ4Pv9Xowh0T/Z9oGec50SyCPzRnyyH/TVFIJ9iBt7qE+fZGIuHq1YCgu2sADc9A4Bl7JAZuye/Ounw3LHDf5875pW/vti0NocVD7vVfzAmf8WxMgCKGwA0V4D5PL/D/p22jhpKAzut/rf3ZytAoucP3aLq10ZHLhf8X1EJ6BHn1ZYG9nOaEuB9Pj3BoyOUAMfn/2oVAXIPPUSKwHRSBM5Ii0CKTwG1E5Ee7/Gq7X5Q+48KwD3SF2+VwYDdSiIDYDwpADNeG3183thX/pozZuTpIwcODKF3PaEHIHI54nugACiOlwFw5VWAOcX+nfYr/d5xHq04/5ddAezzQ0ZA+eD/ny0Bni3JAnBGtwRc6Bnr2QVKgOPz/2+KgNAmdzlp9EypX79HgucMcg38NbB1Q0HBgz1gQbz6zYGs+dZMXpXf9AwACv6bMGzKgXljRvw6b+yrf+aMHH1i26a84dICQO/kd2PyVxw5A6CYQEBD4AD7dxY1Q5IV4AOpACR4/d4j7iEvLWocmnw54P8fLAGeCRwQyEoAR4GnxXp0V2SgKJRDR+b/Wi0C3cj83yPO++X+qXWNsB5etQJw5/nz57txUN77y29uBgCb/6eNHPsDT/7zxw7/dVzW+P+ufXvTZD0AkN9ZFQrAbQRaAWy8+QFAlwWCbSx2DaIP5hQLENorwauAswJIo58HU1754P/KSoAeIxLrGUUWgN90S4Cg9LB0OyUAA4iD8n+NigBwfa6AhpwSOCt78bs3MwAwmzYEmv3GqF/Y/D9r9Osnxwya9iW/g9/F78Tkf1tAS5vxNAb5U0ctKAH/nyjyTNXD2DzA/t32HVma9OK8lmpWAM8LGfGPWKAElA/+/00JoOyAMJr8T7MSwCmjPRK8+sNC5Pj8QxEoUTVATsC7t+9/YuIrMw6S//+mBf9NHZ79zdwxr/5JFoA/poyY8PXYIdN38Tvytu7tBguNcpv5/0yBE0vK/FfUDFif3iXfXMQPaJvke8R4NyQXwF96WuC7aCzlg/9/gq1mRK+E+mZyA/zUJ5mVAKoXH+s5UA5jaB8OzT9QQuzrcRLhni17DX9m3FcTh8/aPXbItJvi/5/5+ms/8ep/9uiR/xufNXXvhFdm7n6V3sHvQoyGcvuk/3jdGVDNwxh4ogQDgC5LB+J3Fjex2zT49ETPCawAcFRv73iPJAQElg/+r0YJoBTBpr0TPE/20QNGKf1rAKxEjs8/UDL8m+9JueOBCo3nRfu03TB+2PQ83sXvRpSAsUNn7J706qRDc8cM/539/1NHjPl+/NCZuynDYE9Mg9SND1RoMi+lfsod4F+5bYJ/uvm4lpTvrxhfIL2L31lcMJBtJdctwfM+SgeUm4LQiu8zu4aCBuPA/F+1JSDuEV9uHyR/9Yp9OAoKQPngH7j51h8PF/9ozyrm9fdXaLyipX/X9RNembGX4gD2Xq8SwOb/6aPeOKat/of/OuGVqQcmvDxzT0v/RzfwOzyrWNbzO280GwS4SfAq0eCfywaAAr0q2IZ/M0ulJ9Z/sS8pAJlcGz7Ro6uCEsHlgv+rNVtSNkATjgtAHED54h+4uahvDBhV3xj4kaerZdUDFZusSm7acR1P/pNenbWXggKv2fQ/8eUpX859Y8SvVPjnz1ljxp6gwkJ5KU07r6eV/yp+h3wXvRO/vFL6wT++JR/8c6VgoIJ/CAaSq/y0qHpVafV/SHcF7E8P9aoCK0C54F+52uI1aA/lln9AufHiTw2cm9YnBWCNTTxdzWt4og6r3+KDl/u+sXPqyDn7xg2dvmfM4GlXvfqf8uqY7+ePe/WPRRNf/3PUs6O+DH245fusWPCz7d71jo9zoMf1FoUCylDwz/UEA9kivzMSPJ/kEsGZFPRFWQGDEAtQPvi/uqhvbP5SnvkHbkL1R2NAD4r/2OBhClh5UQmwrHmgot8q37uC3+3R+pnP2BowmRQBig+QbgFWBvh4iejXKH5g7/zsMb/MG/fyX0PSnjrqe1fou/wsMvsXTv78Ln4nvxsKgFIugn+uJxiogjY4KJWoOuCW59s2FLQf+Fa7yR+rPsfmHwD/QEnyr4RWoUl4PrWBtR6mwNVFLQEPu/ivZmtA6EPJ72e0G/jZa89P3DXp1Zl7WRmYNGL2PnYRSKFzthRkvzI7b/yQ0V8N79v9dM/E4F/MtX22PlDRf4VXFfM79s/md/E7+d31FTOCAZVSCv4hf9wTt873d4XCIP8QDGSb7HvGeyfRHuCv90r8z91oLOWHfwD8AyUb/OdhDFhHE/Iq+wnaXglgqefkJxWBpjUj323RrMv67in9Nz/z+JAtL3R/dTvL048N2ZqW3G9zst+jH7VpFnCoc+DDp9v6ef7oUzXwPQ+TeXVxz9bfuQ7BgKW69adlgw/t1+2lmf/UWyuBF/jdRYKBKlzh/8WEX375B8A/oJRI8N9ICsj7kCbjlXJVfgUhJWC1ZhFovvq+Ck1W3leh8Uo6X2X7nM/5Gn/m7drsvaiH/XaEP9h028Mu//jclfxuCgYcCSaUWx/8420INLMZThfV7vxWif7OIOFtCLD8YzCQUCpwyVdEepdT/gHwDyg30/fv5dzcixSAD8gC8P7Vi/l9SheUwuf2n5GPX16vbwhc+5BL4Lt8vJpn8v/A/wtiAW7xCqABbcvpYfDvQCS08jD6ty4doXfT/2C3RShWAOAfAP9ACfP/sDGgjqeheTBnYngYmgVeu5iLyMXPvO9oaq5P8q/PoHfz/8D/C/gHAAAAAABQboEpkNNvbgeB6Q/8gw/wD9xyS0DF20Sw8gcAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoFTxf2vLIc9qKaMTAAAAAElFTkSuQmCC",
  "golem": "data:image/png;base64,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",
  "diver": "data:image/png;base64,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",
  "fire_geyser": "data:image/png;base64,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",
  "serpent": "data:image/png;base64,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",
  "ptero": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAgAAAACACAYAAAB9V9ELAAAACXBIWXMAAAsTAAALEwEAmpwYAAAYEElEQVR42u2daXBcV5WAW04IywBhr1BOJG9ZLEvdLcsJIQmRHRtbi6VuSZYX2Yq8Ra1uSf26JW8kMBqWgIljAiEDCctUhhmCMWEZMgVFwUwNybAMAaYqUAPzA2ZJDaHYIUBiS3p3zrnvPemp03JkW5ul76u61VKr9frec+567rnnRiIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMJ8pGRwcXGQipgRRoH9A/4D+YQFwsq3tIn09WuPkjtZkt+vPbf57gP4B/QP6h3lIMON71/WpxXevy//p7rX9n9PfByODi5AO+gf0D+gf5imBou9a63z0vg1HzNG12T/cta5vOZUA/aN/9I+E0D9E5rfp51iNs1Zmf0YqwdC9Gw6bozc7d9gKUDN4MVJC/4D+Af3D/KRElP+v719/0LxXKsA9txyQipD7wWB52yXB3xER+gf0D+gf5tns7/jafObeDYfMe2tyw6J4rQTu+24ZMMduzjWGPwfoH9A/oH+IzA/Hj6M3Zktl9vez4+v6reJtBahxhrVC3LU2/+kI+0DoH/2jf0D/EJl/jh81zsc+KHs+qnRVvp/cY7IfJBXiT4EzSFuEWSD6B/QP6B8uaMW3+Xs7Y44fOTekfBPMAm3FuDl3e9gZRCsCM0L0jyTRP6B/uEAoVFztitoX3r02/03r+OHv/YyrAP4+kASF+ElDWXPzhtdvLg3/v61IzArRP6B/QP8wV9G9njHFNS5uja5b3PD2TGzPE+rtKZGfnjP7C1UCI3tD7q3lO83GyxufqS9L/Ft9WfIdDZc3V4TmlIsihI5E/4D+Af3DnGKRnyL1yxM3iAIfqStLDm27qt3cVZN3j6/Lu2oCmijpPtA9t/S7h6/rcuuWJE3jslaTWLbVSCUYqitr+uKmsuQbC78HzpmSgrRQ9T8dcqD90/7RP/qPLDgnjw3L2i7dVNb0QMPS5pGmZVuMKNJtXbFlaPeqnSOd5e1mMqlj5Q7TsDTpNixJDDcsSQ5tlmc0LWszDUuaR2pLG+/X78Bb9Cwv3RBZ6b6apoku39DP1NTUXNxV3fUCjcs9eBaz7bmtf2PLr2XSsmkZJ/pflU0gJ/8zTApo/4D+4XmVv7jlSlH4D+ysbUlyuE4UKK+mtixhNpY2TTptkqT/t66seTT5zxr2n/2EmIhWUAnOjB3EB59XPiWTmkD4g2KkiLznmP5LIqFBfLLlO2P9HvQmD9Qo2j+gfxivfquAjcsbV9Qvaf6pN+tLDImSXFWipoazTDLjMxuXNJtjV28036y8yb7q7w32mYkh/Q6ZDf609ork8nAeYGzACg/8+evzL95f2Xd9ujKbSUed93XHsifSMeermajzjXQs++10LPdYJp7/irz3Kfn7B3tizuFU3NnRVZlbLSvmS4sNkDUyuLa1nbwocMyZTf1rHjQvNcXDiJZoGbQsWiYtm5ZRy+qVWcoec77lycL5qpVN3HlfJu6ku0VmKruJ5Aq0f0D/C30fWVkkez2Pqpmm3lO+OdekFWCDzPh6lzeYoepqY9ZU2Vf9Xd/fbD+nlUC+qyzx2ODYXhCm2rEZsZWFDmAywH1IBrb/zsRzbq76kOlf8xaTqz5snNUHTdZPjp/0/f41R2zKVh0wMhCOpOO5X6Xj2a/LIPl+mSzsSlfmloVm3aP6l326RxMzrv/mxyIF+te8aR69vGY/IK9f98rgjGiZgvIFMiiUgycDldEhozJT2akMZYLwhvB2CjWN9g/of8Ef9dDXhmXJtNf5J89L+fX+7G+9KDq3os64a1ZLBVhtX/X39aMVwKYh/U6peN0Ejhivj66K3mtkJfuFnnh+JC8DWl/VgA5mMqDnhjOx3GlJ+jrsDfDOSMZ733sv5gxpynjvm96qfjs42knBapkUxLKn5H++J5+5uyvaZ0N3bird3NO4tFV0kZgR/cvs335X49ItZuMVDWlbZsmL5kmS5u2U5tXL80FbBi2Llmm0fH55teyjcoiNyuG0lZX8j8pOZaiy7I7nPt9d6VxNfaP9A/pf6DO/RYHgZdb2PTsALEmMnG8FCNImSR+5Zr35j9gN9nWTdPrhWaLMAkf0O2UweFyycVHIO7RkITfG7mhfhwxWT+tKNu0NeDqQjXgD4Fkn166CxwbOEXm2nQj068Ri9YBMCJwn95Snfr71ql1m89IWt7asSQfnadO/Pls8guW7ml39zr0Vqackf09qXjRPmjfNo+bV5tmbyLh+OhcZ+DJ0RnLeROBplfEC73Ro/1Ays/pPnkn/WAGm44iYekSr81PYe3rMg9wzgzaI44co5RlRvnbOrtdBj6VzrQB6DOQWmfFt8l9rQ8/cVKopKd9lP/tMw+KGK4M9Wn01xnNaC7zZNfn5npdHvQKTdCqW7XW8Fa/rD/xmGpI7aimIO26vDLwy+Lo66KaifebW8v2mdcUO0YvqrGlK9K9OQJv8Z7VeucPsWrnf3FaZlbz06wrd7VutK3xHBnhnqCduB2t3OsquMhXZjqiM09Fc3zx2QqL9w6T6nIZlLVfKgPysrzd3qiYAhfqvC/2tVvSu+q/39Z9cuu0qm6e2tktO+o7PWgfQ0lk09uCY2MlJrmq0M/ArQL3OxNQxo2n5FjexvM2oaaZ5xTbTsny7NdeejzlIXxuXNpuWFdvtM5uWtpntK1vNjpUt8l2t8rcWs2Hx1nqbp4i5eLKrZe0cQvvlJReyp7+3399b55v6A7O+mYnkm8/tgKuTAGtur8qZrmivab9mz9ToX1L7NZ3yzB75vrzpv84xB67rle9yjPgmuN3R3Mhtlf1mf8WA6ZKUqsyb7lh+2sqrMlaLQyqeqQ/rgPZP+19oFsfa0sT6kM7cMStdQi2C570dELzqs3SSqScEtlydNNtW6tFA7+8bLttcwzbAWTZ47bT8Rly08vet6Hvh3qpMmXSut0jqkL3Pg7LyOy4OUQ9J+pqshh6X338se8K/lv1mXR3ZZAeCqrwdALZc2W6makaoz+qO9ZiuygPmvbV7zGf3NppPtLeYj29rMx9t3fq7B1q3/+S+ZPvjx+s7vvau9XsfesuN3cdlcDioee+VMmhZaqVME8lEZeF35BdSh2DzuXPFzpf3xvt/rE5u/r62mY0kg6MJ/Aa0Tmy9qmPK9K/m/nS8TwZ3CSW6abfov8n83c5W8zfbtpoHWneYDyZ2mrvrO82dG/aZO96UMv1v6J2+soqMVdY98YEf7VzR9/ILzPxI+58/7X/WLQDiiX9TMMkTi5+1ACWXb7Xt1fcLmJKkE8vtV+8ydaXbzO01SfP5fQnz4A7ZJmhrNg+2J773mb3Jvz3R2XTsREcic3J345sf3tOyjBM7xc5yP1co3jGpCueN3bFcTzqavT+jR8Tiuf+SDv1Zb8/3oMlb7+nAg/yQ3WvVFac0djfjOUy5Qce/U1Z+OmM7HxNwYdJnNS5rMW3L90kHcKv5YlfSfLqzxf1kR/Pwg9u3uh9v22k+lNxtjtelzLtv6TV/eVO/GbhW9oSrDnp7wlIWLZMtW8z5cHfMyaViA2udmPOKwgZvj3tN/gz5LK7+T9oZr3TE+Xz1EeM5783woO/vtcuqf1T/7dfslkAeqv/GKdZ/s9myYkz/J0T/D3W0DD24fcvIR7ZsN/c27TLv2bjHDK69zRx6Y8azEExfuYfy1s8i54R1Qfun/S8kC0DNpTWv2FTa+JTqWyZpbsfKfWbH1Z3GPw5opm5LICGTgC2mZdluc+fGdvNIV7M5cWuL+fuOxqc/uy/x/RO3Jh+V9ImTHckjD+9NtJ7Y1RD7Um3tC1GUdEyFjV4rfXfU2SRnou/UI156TMo7JiZHoGQg0Qbeq407nh8z8/re0yEv8VPa+WtHoP+XivW52vGrOdA6gk2h8seSF1BiR3mz6VnTbnpXZ9z+NYdsB9UlZuD9Ff2n9q8aON1VkR9KRXPq6R04gfnm6QFbNvUO9z27de/4N9Ih/IuU5U6VSafXIYzrDE7Ozc591AlHVqLftR76M2f6d/3Jhqv74fmi+k/OkP69I3ypaN7dv6p/SOqAm6rst1sA6Wne+vAdDr8bMj2W0P5p//N94A/5U0R2r0lf0bFy/4/3VaR1y29EV/1T5QhcbBKwUfw/2stbTGZN+0imqtvsXrXvPzuvTi3BCbDoDG0sjGvPtT2vlka6Uyr7w5J+6R1vOmLPPvf4x6SksQz7Hfuwv6/rFnT6+vcRnekHx8vEHPjtPRWpOyVu8zO+o45bPy2df8hDVBxANl6h3qBtf+4sT79Tg7n0SZ7616hnupYlK43eOsGNz79XptEy6ntadm8QO+IdlxPZyN8fTsWc3ZnyA5dFQuFk59IeU2CCy0azFT2x/OmQ1/50DvrP0b/I6xv7Zk3/rX/evSr1Dlm5fmMS+p96Z0hvYDklA82queYQSPuf3+1/NkKJj4XLjpRoXAyxotwrMvxcV2XPe+Rc/p914NdtgOnXf8Lqf7Pof++qjFw01P+wTGQ/0ledXjfo+6aE8lyyYK9h1NeuyoGbpUJ/Ukx7v836gU60AWtjCI52neGYlHh8S0OSpPt6EhzFrvikw/2FKP9j0kjWqjON3QuSW5uSXpjGoan0Bi2SXI0P3Sz7THVljW/X79Y8yGpmrRf0JvszL6DLIVfz7HdaQxOWz+vYRka92kU2IiNXVwqyMvqtdO6f7Knof3PQ+OfKtZTBfdnd8WznNK7+Lxj9p2N9685B/1NiBZDXW4PoiLR/2v98JVOTeWm6KtcokTQfEP1/WE4dNXe9vuslnv4b3zlb+s9fnn9xj+RFJgH3Sb7+OlWZ27L3hoMvK3Lh1/yepQXeyGqyktn+VmkMj+uRsPxYox/xG8PI85l302ON3niNwXlaGsM/dMfz7enK9CsLHWj0BzmffX9hHOgpNgH58aBtAIj7g4EwfLmN7memYrmdmlfNs+Zdy3AWg4EbBIoRx7rQSsd5XJ7XFuz1hhyGZoWg483E8m/Vvdkp3P+/oPRf6Mg2Bfo/Kz8AlX13Vf6tYZ3Q/mn/F/I4UnhZWFd1/2tS8b5ET5WE0Y5n9+1dmSmbq+1fQp5fnqns3S0Lo9vFcbWp59ojrw6XJ7x9MW8IzuvaAaE6e5PMgr7jhzkNZrjPZw4dDfTizYBHG/0fZVb9JVkB3JaK5RePC7k6/oKUksDcKCagOxqWtAw1ek4gI77SzmdG6Ooz9Fl+DGh5ZuPbCpUZnPcN51HzLNHb9kv5Pi9l+4PfGbhn2RkO+3vd3uon6nwnU+ncHHynmaW7qQMLgOjmmO5pnucEAP2f8wRAZB/P3hXWCe2f9n+BsajYLaF6EiQVz16ZrsjXyASgvK287ZIJLsiaE/oP+7oMlg9esj/ac5Ucj36TlqGzrPNFxW79nA/XCpcEqw/xwD0ms1YvUEnMD206iWAudj9wzWHrTCPv/UZMPJ9LTdDoz+AdO7pHVlfaeGN9aeJb/vng4GzosN7r7FcGt0ilCL+vEaWG7P/I3/QZGva1rrTpW/rskBdqySS8nf3OILVYy6RlkzL+Wo9xaZnt7N43h/rycic6+qUy1U5E/mdYZR1qECWzNQHQ8LfnMAEYH8xH93QXpP6PTF7/Z5gAyIB7bBYnALT/Bdj+z9tapFtFz7WevKCrPFuarshG912/71VWjmWDLyq0Mpk5rH8zlo+S8ERGy9ZpnV/7qnqjA0vD1rpgMnAhWnVsZvfesPdlMkt/RDsjcUoa9vf1JjTt6e+6d6mOLzZwSyz7vzLT/7jMbHf0xfteG372Wc6URiuBFyKyuamuNPFlUfyzarbRpMdFvHOjzYWKt+/p3/Qz+tkma+pJnJJLH/6pbmlLa03EMzWdhXPHomJHn9KVR14pnVuzyOxjWnbPqcmLdR9EfJvIVOiHwx1Wb2lxNPrHTHnmpbPRCQQVWPLzV2qGtjH+J2naL9S/vPd/IosHF5r+peN/QC/7GdV/9UEbxGiyWwXBFoA4nQ3O0hYA7X+Btv9zi/1w8qJix1V1hdxdKUdAY313SD1o2Feef1XY6c8GiZqcg+uc0r+tu+PzXdJxjTjDVmTrxX/hUKYym8+szKwq/D/dQrtQrAMlvhn4UwNjg4Ab8notcG7x9sP8juC74uRyVNKGrurBl0xwDnbReR4ViQT3RNcuSfSJGedTkn4kCv2jxnKuF0Vv9pP+LO+P6N/0M5Ieqlua7NVQo+NMnefugFO0M9CyqwysLFQmIptATuOcpcZiygcrqNPa+fdIYJTZ6ABGLQDRbHdOViVFVntuKO+j+tc9Te94VO7fdftAy74rOvAXC13/IpN3p/Va4Jhzupj+i64O5T1P9k5qliwAtP8F2v4ne1KomGlfwzj3rsrHdPHgXQXufEVPPRT4dkSm4KjgXNL/uDaj1oCMllm2uCR9XRxb3623pxZOdEatA5E5Zh0I9l9EiUm7X+dX0sJZ/ujVrmL2kvQFjWGeXpVeWVjQ0KynZBrOjI5SExm8uP619Zc1lCar665ofrPEek5o0p/1vfqytsv0M8/Z45xaz1ur1MLzvfYqWZGNlZHKyjcVBjfhhVcHgaxV9vJ+YqZDwo7qvzK3wT+v7R1zCry29SY7f5UX1r8GQOmWo4OF+rd7aAtc//q+3TfUgDiT0L89Rqayr8yunzX90/4XZPs/21W+NX/HnTrJ6z0y4P1PT9xa/r6vjo2Dkek5OjdH9T+ujPrclOhPHGa/3WOtobmn5Ge9Qj2plpA5ax0IVhuyAjlqo8BJYI7xs3y91tR5QgrzAS1Mh5wDLtaJzNC+xyLffLNomv/nnL2nizVelZnKTmXoyVJWfONXB6fsWerqg++Z6RVg0LAy12Yukzz+Xr2cpQK7Xv4O246qJ+r8UM7r3qdl6EH/Z9R/sbC4o/rXTtNaTMbpPzhm9nsxA18W1gntn/Y/S8F5xr2Xig+Ui4NqRuMa6GRmYM3tdkGQima/0hvL3VjMdL+Q9F8Y1EhOj9wocnpE+88D194hDp/Z38rvnxEZOuo7UFhHzGzGhhi9BCaebVfF2hvgorlfqJOLeKpmuyrzlcUybM1gsxuwxF4lGpynDSc/X7MavGEis5m9EU1kqrK1jkQia5W5yr67Mts+CyuA0fw5VQceG/COAv5SBqlH5BysI8E50P9U6j/i6d+uDqvyn9Hz5v7q+tFiOqH90/5nGvVtkEFrswxY92S8Y4vP6oB/+Lq3GXEOPd2t9ziIg1/4uN8sDGBzTv+hEwTeRKBcJk7iEyVWkmdVdtrOdWtQ3nvCxhmI923pjg68bjbafdEKK51Rlw3KsKzr0jOYLAiTOHWm4ojKWmWuR6Rmq0MdtQJE87V6PlvPQKP/mdG/On91V2Vb09V9G2d69U/7p/2HI0/aQT/mfFksFL8KWYFc66gYc36nAXLSVc7K0TKNP8IHE4TNzlRlVvjRDn+jEymxtrme9cfGhfhdJpr7Zw2MNKeigBbM8mn0UxwOs7hTTWROxYRA/9O7OpzLt4yh/4XS/r087Liq6zUyID2pA5T4o7ji9+P6x0Cf0vgUeuQtPPBzQ94k2nmBnNJy30HGOonmfq6ylavAbXwNL8DWwJOqg7BOZpwae4bxJFdZzoLDzZwI/zoNDnwwmb3j5160Q/un/c+kD4jcA5I7uOYODfo05N9l8APZnjiwK9r9urCPAwP/uU34w1sk6kelTtRy8uqHffZiqYNDB9e8VSZe/c5s+oAAAEBkIZmrAx+Q3H7dmxa/hPv0NsOu6gdeUOxeCJi6iYDKWBysN6U9B2uRfXbfXPABAQCAhWmRiIQtQhEG/sjUb6+N3bcxJxwAAQAA1FGxmLMizH15/z9WNa4ogO/8fAAAAABJRU5ErkJggg==",
  "log": "data:image/png;base64,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",
  "spikes": "data:image/png;base64,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"
};

var ENEMY_SPRITE_DEFS = {
  "bomber": {
    "cols": 4,
    "rows": 2,
    "fps": 7,
    "anims": {
      "idle": [
        0,
        1,
        2,
        3
      ],
      "attack": [
        4,
        5,
        6
      ],
      "hit": [
        7
      ]
    }
  },
  "charger": {
    "cols": 4,
    "rows": 2,
    "fps": 8,
    "anims": {
      "idle": [
        0,
        1,
        2,
        3
      ],
      "attack": [
        4,
        5,
        6
      ],
      "hit": [
        7
      ]
    }
  },
  "troll": {
    "cols": 4,
    "rows": 2,
    "fps": 5,
    "anims": {
      "idle": [
        0,
        1,
        2,
        3
      ],
      "attack": [
        4,
        5,
        6
      ],
      "hit": [
        7
      ]
    }
  },
  "witch": {
    "cols": 4,
    "rows": 2,
    "fps": 5,
    "anims": {
      "idle": [
        0,
        1,
        2,
        3
      ],
      "attack": [
        4,
        5,
        6
      ],
      "hit": [
        7
      ]
    }
  },
  "golem": {
    "cols": 4,
    "rows": 2,
    "fps": 3,
    "anims": {
      "idle": [
        0,
        1,
        2,
        3
      ],
      "attack": [
        4,
        5,
        6
      ],
      "hit": [
        7
      ]
    }
  },
  "diver": {
    "cols": 4,
    "rows": 2,
    "fps": 6,
    "anims": {
      "idle": [
        0,
        1,
        2,
        3
      ],
      "attack": [
        4,
        5,
        6
      ],
      "hit": [
        7
      ]
    }
  },
  "fire_geyser": {
    "cols": 4,
    "rows": 2,
    "fps": 5,
    "anims": {
      "idle": [
        0
      ],
      "attack": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7
      ]
    }
  },
  "serpent": {
    "cols": 4,
    "rows": 2,
    "fps": 5,
    "anims": {
      "idle": [
        0,
        1,
        2,
        3
      ],
      "attack": [
        4,
        5,
        6
      ],
      "hit": [
        7
      ]
    }
  },
  "ptero": {
    "cols": 4,
    "rows": 1,
    "fps": 6,
    "anims": {
      "idle": [
        0,
        1,
        2,
        3
      ]
    }
  },
  "log": {
    "cols": 1,
    "rows": 1,
    "fps": 1,
    "anims": {
      "idle": [
        0
      ]
    }
  },
  "spikes": {
    "cols": 1,
    "rows": 1,
    "fps": 1,
    "anims": {
      "idle": [
        0
      ]
    }
  }
};

var enemySprites = {};
var _enemySpritesLoading = false;
var _enemySpritesReady = false;

function initEnemySprites() {
  if (_enemySpritesLoading) return;
  if (!ENEMY_SPRITES_ENABLED) {
    _enemySpritesLoading = true;
    _enemySpritesReady = true;
    return;
  }
  _enemySpritesLoading = true;
  var ids = Object.keys(ENEMY_SPRITE_B64);
  var loaded = 0;
  var total = ids.length;
  ids.forEach(function(id) {
    var def = ENEMY_SPRITE_DEFS[id];
    if (!def) { loaded++; return; }
    var sp = { ready: false, frames: null, fw: 0, fh: 0 };
    enemySprites[id] = sp;
    var img = new Image();
    img.onload = function() {
      var fw = Math.floor(img.width / def.cols);
      var fh = Math.floor(img.height / def.rows);
      sp.fw = fw; sp.fh = fh;
      var tmp = document.createElement('canvas');
      tmp.width = img.width; tmp.height = img.height;
      var tc = tmp.getContext('2d');
      tc.drawImage(img, 0, 0);
      var idata = tc.getImageData(0, 0, tmp.width, tmp.height);
      var d = idata.data;
      var bgR = d[0], bgG = d[1], bgB = d[2], bgA = d[3];
      var tol = 38;
      if (bgA > 10) {
        for (var i = 0; i < d.length; i += 4) {
          if (Math.abs(d[i]-bgR) < tol && Math.abs(d[i+1]-bgG) < tol && Math.abs(d[i+2]-bgB) < tol) {
            d[i+3] = 0;
          }
        }
        tc.putImageData(idata, 0, 0);
      }
      sp.frames = [];
      for (var r = 0; r < def.rows; r++) {
        for (var c = 0; c < def.cols; c++) {
          var fc = document.createElement('canvas');
          fc.width = fw; fc.height = fh;
          var fctx = fc.getContext('2d');
          fctx.drawImage(tmp, c*fw, r*fh, fw, fh, 0, 0, fw, fh);
          sp.frames.push(fc);
        }
      }
      sp.ready = true;
      loaded++;
      if (loaded >= total) { _enemySpritesReady = true; console.log('All enemy sprites loaded'); }
      tmp = null; tc = null; idata = null;
    };
    img.onerror = function() { console.warn('Enemy sprite failed: ' + id); loaded++; if (loaded >= total) _enemySpritesReady = true; };
    img.src = ENEMY_SPRITE_B64[id];
  });
}

function getEnemyFrame(id, animState, time) {
  var sp = enemySprites[id];
  var def = ENEMY_SPRITE_DEFS[id];
  if (!sp || !sp.ready || !sp.frames || !def) return null;
  var anim = def.anims[animState] || def.anims.idle;
  if (!anim || anim.length === 0) return null;
  var fps = def.fps || 5;
  var frameIdx = Math.floor(time * fps) % anim.length;
  var globalIdx = anim[Math.abs(frameIdx)];
  if (globalIdx >= sp.frames.length) globalIdx = anim[0];
  return { canvas: sp.frames[globalIdx], fw: sp.fw, fh: sp.fh };
}

function drawEnemySpriteFrame(id, animState, time, drawW, drawH, flipX) {
  var frame = getEnemyFrame(id, animState, time);
  if (!frame) return false;
  ctx.save();
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(frame.canvas, -drawW/2, -drawH, drawW, drawH);
  ctx.restore();
  return true;
}
// ============================================================
// CHARACTER RENDERING
// ============================================================
function drawChar(p, mini) {
  // Blink during invincibility frames (skip drawing every other frame)
  if (!mini && p.iframes > 0 && Math.sin(p.iframes * 20) > 0.3) return;
  // Slide trail particles (dust cloud behind) + sparks
  if (!mini && p.slideTimer > 0) {
    if (Math.random() < 0.7) spawnParticle(p.screenX-UNIT*(.5+Math.random()*.8),p.y-UNIT*.1,{
      vx:-60-Math.random()*50,vy:-(Math.random()*40+15),color:'rgba(180,160,130,0.6)',r:UNIT*(.14+Math.random()*.12),decay:2.5,grav:60});
    if (Math.random() < 0.3) spawnParticle(p.screenX+UNIT*(.2+Math.random()*.3),p.y-UNIT*.05,{
      vx:(Math.random()-.5)*60,vy:-(Math.random()*50+20),color:'#FFDD66',r:UNIT*.06,decay:5,grav:200});
  }
  // Dash trail particles — more dramatic afterimage effect
  if (!mini && p.dashTimer > 0) {
    for(let i=0;i<4;i++) spawnParticle(p.screenX-UNIT*(.5+Math.random()*1.5),p.y-UNIT*(.3+Math.random()*1.2),{
      vx:-120-Math.random()*80,vy:(Math.random()-.5)*60,color:`rgba(100,200,255,${0.4+Math.random()*0.3})`,r:UNIT*(.12+Math.random()*.18),decay:3,grav:0});
  }
  // Skin trail particles (while running on ground)
  if (!mini && p.onGround && p.dashTimer <= 0 && p.slideTimer <= 0) {
    const _ch = p.ch || CHARS[p.charIdx||0];
    const _sk = getActiveSkin(_ch.id);
    if (_sk && _sk.trail && Math.random() < 0.35) {
      const tr = SKIN_TRAILS[_sk.trail];
      if (tr) {
        const tc = tr.colors[Math.floor(Math.random()*tr.colors.length)];
        spawnParticle(p.screenX-UNIT*(.3+Math.random()*.5),p.y-UNIT*(.1+Math.random()*.6),{
          vx:-40-Math.random()*30,vy:-(Math.random()*30+10),color:tc,r:UNIT*(tr.size+Math.random()*.06),decay:2.5,grav:40});
      }
    }
  }
  const x = mini ? 0 : p.screenX;
  const y = mini ? 0 : p.y;
  const u = mini ? UNIT*.8 : UNIT;
  const ch = p.ch || CHARS[p.charIdx||0];
  const sc = ch.sc || 1;
  const dmgFlash = (p.hpFlash > 0 && Math.sin(p.hpFlash*30)>0);
  const skin = getActiveSkin(ch.id);
  const skinCol = skin ? skin.col : ch.col;
  const skinDk = skin ? skin.dk : ch.dk;
  const bodyCol = dmgFlash ? '#FF4444' : p.starTimer > 0 ? `hsl(${p.starHue},90%,62%)` : skinCol;
  const darkCol = dmgFlash ? '#CC2222' : p.starTimer > 0 ? `hsl(${p.starHue+20},85%,48%)` : skinDk;
  const accentCol = ch.id==='bruk' ? '#D9B574' :
    ch.id==='zara' ? '#FF99F2' :
    ch.id==='rex' ? '#FFD35A' :
    ch.id==='mog' ? '#8CFFE3' :
    ch.id==='pip' ? '#FFF1A8' : '#C7F1FF';
  const bootCol = ch.id==='bruk' ? '#4A3020' :
    ch.id==='zara' ? '#5B256A' :
    ch.id==='rex' ? '#7A2A1A' :
    ch.id==='mog' ? '#1D6A62' :
    ch.id==='pip' ? '#8A641A' : '#2A5A80';

  ctx.save();
  ctx.translate(x, y);
  if (!mini && p.slideTimer > 0) {
    // Tilt forward during slide for a dynamic pose
    ctx.rotate(0.35);
    ctx.translate(0, UNIT*.2);
  }
  if (!mini) ctx.scale(p.stretch, p.squash);
  ctx.scale(sc, sc);

  // Shadow
  ctx.fillStyle='rgba(0,0,0,0.25)';ctx.beginPath();ctx.ellipse(0,4,u*.9,u*.18,0,0,PI2);ctx.fill();

  // --- SPRITE RENDERING ---
  const _charSpr = charSprites[ch.id];
  const _sprReady = _charSpr && _charSpr.ready && _charSpr.frames;
  if (_sprReady) {
    const _sprFrames = _charSpr.frames;
    const _sprFW = _charSpr.fw;
    const _sprFH = _charSpr.fh;
    const frameIdx = getSpriteFrame(p, mini);
    const frameCvs = _sprFrames[frameIdx];
    if (frameCvs) {
      const drawH = u * (mini ? 3.05 : 2.55);
      const drawW = drawH * (_sprFW / _sprFH);
      const drawX = -drawW / 2;
      const drawY = -drawH + u * 0.1;
      // Star power: hue-rotate
      if (!mini && p.starTimer > 0) {
        ctx.filter = 'hue-rotate(' + Math.round(p.starHue) + 'deg) saturate(1.5)';
      }
      // Damage flash: red tint
      if (!mini && dmgFlash) {
        ctx.filter = 'brightness(1.5) sepia(1) hue-rotate(-30deg) saturate(5)';
      }
      ctx.drawImage(frameCvs, drawX, drawY, drawW, drawH);
      ctx.filter = 'none';
      // Skin tinting (non-default skins)
      if (skin && !skin.id.endsWith('_default')) {
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = skinCol;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(drawX, drawY, drawW, drawH);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
      }
      // Shield bubble
      if (p.shield) {
        ctx.strokeStyle='rgba(100,180,255,0.85)';ctx.lineWidth=3;
        ctx.shadowColor='#88CCFF';ctx.shadowBlur=14;
        ctx.beginPath();ctx.ellipse(0,-u*.85,u*1.35,u*1.65,0,0,PI2);ctx.stroke();
        ctx.fillStyle='rgba(100,180,255,0.08)';ctx.fill();ctx.shadowBlur=0;
      }
      ctx.restore();
      return; // skip procedural body drawing
    }
  }
  // --- END SPRITE RENDERING ---

  // Legs
  const swing = (p.onGround && !mini) ? Math.sin(p.legAnim)*.45 : 0;
  ctx.fillStyle=darkCol;
  for(let s=-1;s<=1;s+=2){
    ctx.save();ctx.translate(s*u*.35,-u*.08);ctx.rotate(-s*swing);
    ctx.beginPath();ctx.ellipse(0,u*.3,u*.18,u*.38,0,0,PI2);ctx.fill();
    ctx.fillStyle=bootCol;
    ctx.beginPath();ctx.ellipse(s*u*.05,u*.72,u*.22,u*.12,.2*s,0,PI2);ctx.fill();
    ctx.restore();
  }

  // Tail
  ctx.fillStyle=darkCol;ctx.beginPath();ctx.ellipse(-u*.75,-u*.55,u*.32,u*.18,-.6,0,0,PI2);ctx.fill();

  // Body
  ctx.fillStyle=bodyCol;ctx.beginPath();ctx.ellipse(0,-u*.85,u*.88,u*1.05,0,0,PI2);ctx.fill();
  // Belly
  ctx.fillStyle='rgba(255,255,255,0.2)';ctx.beginPath();ctx.ellipse(0,-u*.65,u*.5,u*.6,0,0,PI2);ctx.fill();
  // Character accents
  ctx.fillStyle=accentCol;
  if(ch.id==='gronk'){
    ctx.beginPath();ctx.ellipse(-u*.2,-u*1.05,u*.18,u*.1,-.2,0,PI2);ctx.fill();
    ctx.beginPath();ctx.ellipse(u*.22,-u*.88,u*.16,u*.09,.15,0,PI2);ctx.fill();
  } else if(ch.id==='pip'){
    ctx.beginPath();ctx.ellipse(0,-u*1.02,u*.2,u*.12,0,0,PI2);ctx.fill();
    ctx.beginPath();ctx.ellipse(-u*.34,-u*.78,u*.12,u*.08,-.4,0,PI2);ctx.fill();
    ctx.beginPath();ctx.ellipse(u*.34,-u*.78,u*.12,u*.08,.4,0,PI2);ctx.fill();
  } else if(ch.id==='bruk'){
    ctx.fillStyle='rgba(60,40,20,0.28)';
    ctx.fillRect(-u*.62,-u*1.08,u*1.24,u*.16);
    ctx.fillStyle=accentCol;
    ctx.fillRect(-u*.48,-u*1.04,u*.96,u*.08);
  } else if(ch.id==='zara'){
    ctx.beginPath();ctx.moveTo(-u*.15,-u*1.25);ctx.lineTo(u*.35,-u*1.05);ctx.lineTo(u*.1,-u*.92);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(-u*.38,-u*.95);ctx.lineTo(-u*.02,-u*.84);ctx.lineTo(-u*.18,-u*.68);ctx.closePath();ctx.fill();
  } else if(ch.id==='rex'){
    ctx.beginPath();ctx.moveTo(-u*.1,-u*1.28);ctx.lineTo(u*.18,-u*.7);ctx.lineTo(-u*.02,-u*.7);ctx.lineTo(-u*.28,-u*1.18);ctx.closePath();ctx.fill();
    ctx.fillStyle='rgba(255,245,210,0.32)';
    ctx.beginPath();ctx.ellipse(u*.48,-u*1.03,u*.16,u*.08,.2,0,PI2);ctx.fill();
  } else if(ch.id==='mog'){
    ctx.strokeStyle=accentCol;ctx.lineWidth=u*.06;
    ctx.beginPath();ctx.arc(0,-u*.86,u*.34,0,Math.PI*1.55);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,-u*1.22);ctx.lineTo(0,-u*.52);ctx.stroke();
  }

  // Arms
  ctx.fillStyle=darkCol;
  ctx.beginPath();ctx.ellipse(-u*.85,-u*.95,u*.3,u*.18,-.5,0,PI2);ctx.fill();
  ctx.beginPath();ctx.ellipse(u*.85,-u*.95,u*.3,u*.18,.5,0,PI2);ctx.fill();

  // Horns / spikes / unique features
  ctx.fillStyle=darkCol;
  if (ch.id==='zara') {
    // Multiple spikes
    for(let i=-1;i<=2;i++){
      ctx.beginPath();ctx.moveTo(u*(i*.22),-u*(1.85+Math.abs(i)*.08));
      ctx.lineTo(u*(i*.22+.15),-u*1.55);ctx.lineTo(u*(i*.22-.15),-u*1.58);ctx.closePath();ctx.fill();
    }
  } else if (ch.id==='rex') {
    // Dino spines along head
    ctx.fillStyle='#FF2200';
    for(let i=0;i<4;i++){
      const sx2=-u*.1+i*u*.15;
      ctx.beginPath();ctx.moveTo(sx2,-u*(1.9+i*.06));ctx.lineTo(sx2+u*.08,-u*1.6);ctx.lineTo(sx2-u*.08,-u*1.6);ctx.closePath();ctx.fill();
    }
    // Dino snout
    ctx.fillStyle=ch.col;ctx.beginPath();ctx.ellipse(u*.55,-u*1.1,u*.25,u*.18,.3,0,PI2);ctx.fill();
    // Tiny teeth
    ctx.fillStyle='#fff';
    ctx.beginPath();ctx.moveTo(u*.68,-u*1);ctx.lineTo(u*.72,-u*.85);ctx.lineTo(u*.64,-u*.85);ctx.fill();
    ctx.beginPath();ctx.moveTo(u*.58,-u*.98);ctx.lineTo(u*.62,-u*.83);ctx.lineTo(u*.54,-u*.83);ctx.fill();
  } else if (ch.id==='mog') {
    // Mystical antennae
    ctx.strokeStyle='#22DDAA';ctx.lineWidth=u*.06;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(-u*.2,-u*1.7);ctx.quadraticCurveTo(-u*.5,-u*2.5,-u*.3,-u*2.3);ctx.stroke();
    ctx.beginPath();ctx.moveTo(u*.2,-u*1.7);ctx.quadraticCurveTo(u*.5,-u*2.5,u*.3,-u*2.3);ctx.stroke();
    // Glowing orbs on tips
    ctx.fillStyle='#66FFCC';ctx.shadowColor='#44FFAA';ctx.shadowBlur=8;
    ctx.beginPath();ctx.arc(-u*.3,-u*2.3,u*.08,0,PI2);ctx.arc(u*.3,-u*2.3,u*.08,0,PI2);ctx.fill();
    ctx.shadowBlur=0;
    // Mystical swirl on body
    ctx.strokeStyle='rgba(100,255,200,0.3)';ctx.lineWidth=u*.05;
    ctx.beginPath();ctx.arc(0,-u*.85,u*.4,0,Math.PI*1.5);ctx.stroke();
  } else {
    ctx.beginPath();ctx.moveTo(-u*.28,-u*1.82);ctx.lineTo(-u*.08,-u*1.52);ctx.lineTo(-u*.52,-u*1.57);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(u*.08,-u*1.88);ctx.lineTo(u*.32,-u*1.58);ctx.lineTo(-u*.12,-u*1.62);ctx.closePath();ctx.fill();
  }

  // Eyes
  const eyeScale = ch.id==='pip' ? 1.3 : ch.id==='bruk' ? .8 : 1;
  ctx.fillStyle='white';
  ctx.beginPath();ctx.ellipse(-u*.3,-u*1.28,u*.29*eyeScale,u*.33*eyeScale,0,0,PI2);
  ctx.ellipse(u*.3,-u*1.28,u*.29*eyeScale,u*.33*eyeScale,0,0,PI2);ctx.fill();
  // Pupils
  ctx.fillStyle='#1a1a30';
  const el=(!mini&&p.onGround)? 0.08 :0;
  ctx.beginPath();ctx.ellipse(-u*.2+u*el,-u*1.28,u*.17,u*.21,0,0,PI2);
  ctx.ellipse(u*.4+u*el,-u*1.28,u*.17,u*.21,0,0,PI2);ctx.fill();
  // Shine
  ctx.fillStyle='white';ctx.beginPath();ctx.arc(-u*.14,-u*1.36,u*.065,0,PI2);ctx.arc(u*.46,-u*1.36,u*.065,0,PI2);ctx.fill();

  // Mouth
  ctx.strokeStyle='#1a3a5a';ctx.lineWidth=u*.1;ctx.lineCap='round';ctx.beginPath();
  if(!mini&&!p.onGround){ctx.arc(0,-u*.82,u*.22,Math.PI+.35,PI2-.35);}
  else{ctx.arc(0,-u*.92,u*.28,.15,Math.PI-.15);}
  ctx.stroke();

  // Blush
  ctx.fillStyle='rgba(255,150,150,0.4)';ctx.beginPath();
  ctx.ellipse(-u*.55,-u*1.1,u*.15,u*.1,0,0,PI2);ctx.ellipse(u*.55,-u*1.1,u*.15,u*.1,0,0,PI2);ctx.fill();

  // Bruk bushy eyebrows
  if(ch.id==='bruk'){
    ctx.fillStyle='#4a2a10';
    ctx.fillRect(-u*.55,-u*1.55,u*.5,u*.12);ctx.fillRect(u*.05,-u*1.55,u*.5,u*.12);
  }

  // Shield bubble
  if(p.shield){
    ctx.strokeStyle='rgba(100,180,255,0.85)';ctx.lineWidth=3;ctx.shadowColor='#88CCFF';ctx.shadowBlur=14;
    ctx.beginPath();ctx.ellipse(0,-u*.85,u*1.35,u*1.65,0,0,PI2);ctx.stroke();
    ctx.fillStyle='rgba(100,180,255,0.08)';ctx.fill();ctx.shadowBlur=0;
  }

  ctx.restore();
}

function drawParticles(){
  // Use additive blending for bright particles
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  for(const p of particles){
    const a=clamp(p.life,0,1),r=Math.max(.1,p.r*p.life);
    ctx.globalAlpha=a*0.7;ctx.fillStyle=p.color;
    if(p.sq)ctx.fillRect(p.x-r,p.y-r,r*2,r*2);
    else{ctx.beginPath();ctx.arc(p.x,p.y,r,0,PI2);ctx.fill();}
  }
  ctx.restore();
  // Draw again with normal blend for solid centers
  for(const p of particles){
    const a=clamp(p.life,0,1),r=Math.max(.1,p.r*p.life)*.7;
    ctx.globalAlpha=a;ctx.fillStyle=p.color;
    if(p.sq)ctx.fillRect(p.x-r,p.y-r,r*2,r*2);
    else{ctx.beginPath();ctx.arc(p.x,p.y,r,0,PI2);ctx.fill();}
  }
  ctx.globalAlpha=1;
}

// ============================================================
// HUD
// ============================================================
function drawHUD(dt){
  const u=UNIT, pad=Math.max(u*.7,14)+SAFE_TOP, p=G.player;
  const tl=G.timeLeft;

  // Level name & number (top center above timer)
  ctx.font=`bold ${u*.65}px monospace`;ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillStyle='rgba(255,255,255,0.5)';
  ctx.fillText(`Level ${G.levelNum}: ${G.levelDef.name}`,W/2,pad*.3);

  // Timer
  const urg=clamp(1-tl/10,0,1);
  const tCol=`rgb(255,${Math.floor(lerp(210,30,urg))},${Math.floor(lerp(90,30,urg))})`;
  const pf=tl<5?1+Math.sin(G.time*12)*.14:1;
  ctx.save();ctx.translate(W/2,pad+u*1.6);ctx.scale(pf,pf);
  ctx.font=`bold ${u*1.6}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillText(`${Math.ceil(tl)}s`,3,3);
  ctx.fillStyle=tCol;ctx.fillText(`${Math.ceil(tl)}s`,0,0);ctx.restore();

  // Level progress bar
  const prog=clamp(G.time/G.levelDef.targetTime,0,1);
  const barW=u*8, barH=u*.28, barX=W/2-barW/2, barY=pad+u*3;
  ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(barX,barY,barW,barH);
  const pGrd=ctx.createLinearGradient(barX,barY,barX,barY+barH);
  pGrd.addColorStop(0,`hsl(${lerp(0,120,prog)},85%,60%)`);
  pGrd.addColorStop(1,`hsl(${lerp(0,120,prog)},75%,40%)`);
  ctx.fillStyle=pGrd;ctx.fillRect(barX,barY,barW*prog,barH);
  ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1;ctx.strokeRect(barX,barY,barW,barH);
  ctx.font=`${u*.4}px monospace`;ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillStyle='rgba(255,255,255,0.6)';
  ctx.fillText(`${Math.floor(prog*100)}%`,W/2,barY+barH+2);

  // Score panel bg (top-left)
  ctx.fillStyle='rgba(0,0,0,0.25)';const spW=u*5.5,spH=u*2.2;
  ctx.beginPath();ctx.moveTo(pad+u*.3,pad);ctx.lineTo(pad+spW,pad);ctx.quadraticCurveTo(pad+spW+u*.3,pad,pad+spW+u*.3,pad+u*.3);ctx.lineTo(pad+spW+u*.3,pad+spH);ctx.quadraticCurveTo(pad+spW+u*.3,pad+spH+u*.3,pad+spW,pad+spH+u*.3);ctx.lineTo(pad+u*.3,pad+spH+u*.3);ctx.quadraticCurveTo(pad,pad+spH+u*.3,pad,pad+spH);ctx.lineTo(pad,pad+u*.3);ctx.quadraticCurveTo(pad,pad,pad+u*.3,pad);ctx.closePath();ctx.fill();
  // Score (top-left)
  ctx.font=`bold ${u*.9}px monospace`;ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillText(`${G.runScore}`,pad+2,pad+2);
  ctx.fillStyle='#FFD700';ctx.fillText(`${G.runScore}`,pad,pad);

  // HP Bar (below score)
  const hpBarW=u*5, hpBarH=u*.35, hpBarX=pad, hpBarY=pad+u*1.2;
  const hpPct=clamp(p.hp/p.maxHP,0,1);
  // Background
  ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(hpBarX,hpBarY,hpBarW,hpBarH);
  // HP fill — gradient green > yellow > red
  const hpHue=lerp(0,120,hpPct);
  const hpGrd=ctx.createLinearGradient(hpBarX,hpBarY,hpBarX,hpBarY+hpBarH);
  hpGrd.addColorStop(0,`hsl(${hpHue},85%,55%)`);
  hpGrd.addColorStop(1,`hsl(${hpHue},75%,35%)`);
  ctx.fillStyle=hpGrd;ctx.fillRect(hpBarX,hpBarY,hpBarW*hpPct,hpBarH);
  // Flash red when taking damage
  if(p.hpFlash>0){ctx.fillStyle=`rgba(255,50,50,${p.hpFlash})`;ctx.fillRect(hpBarX,hpBarY,hpBarW,hpBarH);}
  // Border
  ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=1;ctx.strokeRect(hpBarX,hpBarY,hpBarW,hpBarH);
  // HP text (below bar, larger)
  ctx.font=`bold ${u*.45}px monospace`;ctx.fillStyle='white';ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillText(`${p.hp}/${p.maxHP}`,hpBarX+hpBarW/2,hpBarY+hpBarH+u*.1);

  // Gems panel bg (top-right)
  ctx.fillStyle='rgba(0,0,0,0.25)';const gpW=u*5,gpX=W-pad-SAFE_RIGHT-gpW-u*.3;
  ctx.beginPath();ctx.moveTo(gpX+u*.3,pad);ctx.lineTo(gpX+gpW,pad);ctx.quadraticCurveTo(gpX+gpW+u*.3,pad,gpX+gpW+u*.3,pad+u*.3);ctx.lineTo(gpX+gpW+u*.3,pad+u*2);ctx.quadraticCurveTo(gpX+gpW+u*.3,pad+u*2.3,gpX+gpW,pad+u*2.3);ctx.lineTo(gpX+u*.3,pad+u*2.3);ctx.quadraticCurveTo(gpX,pad+u*2.3,gpX,pad+u*2);ctx.lineTo(gpX,pad+u*.3);ctx.quadraticCurveTo(gpX,pad,gpX+u*.3,pad);ctx.closePath();ctx.fill();
  // Gems (top-right)
  ctx.font=`bold ${u*.9}px monospace`;ctx.textAlign='right';
  ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillText(`\u25C6 ${G.runGems}`,W-pad-SAFE_RIGHT+2,pad+2);
  ctx.fillStyle=`hsl(${G.theme.gemH},100%,65%)`;ctx.fillText(`\u25C6 ${G.runGems}`,W-pad-SAFE_RIGHT,pad);

  // Continues (below gems)
  if(G.continuesLeft>0){
    ctx.font=`${u*.5}px monospace`;ctx.fillStyle='rgba(255,170,0,0.7)';
    ctx.fillText(`\u2764 x${G.continuesLeft}`,W-pad-SAFE_RIGHT,pad+u*1.2);
  }

  // Announce banner
  if(G.announce&&G.announce.life>0){
    const al=clamp(G.announce.life,0,1),sc=1+(1-al)*.25;
    ctx.save();ctx.translate(W/2,H*.42);ctx.scale(sc,sc);ctx.globalAlpha=al;
    ctx.font=`bold ${u*1.6}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillText(G.announce.text,3,3);
    ctx.fillStyle='#FFD700';ctx.fillText(G.announce.text,0,0);
    ctx.restore();ctx.globalAlpha=1;
    G.announce.life-=dt*.75;
  }

  // Pause icon (top-right, offset left to avoid Android nav buttons)
  ctx.font=`bold ${u*1.2}px monospace`;ctx.textAlign='right';ctx.textBaseline='top';
  ctx.fillStyle='rgba(255,255,255,0.5)';
  ctx.fillText('||',W-pad*3.5-SAFE_RIGHT,pad*.5);

  // Speaker icon (top-left, above score area)
  drawSpeakerIcon(pad*.3, pad*0.15, u*1.2);

  // Combo display with escalation effects
  if(G.combo > 0){
    const comboY = pad+u*2.2;
    const colors = ['#FFFFFF','#FFD700','#FF8800','#FF4444','#FF00FF','#00FFFF','#FF0088'];
    const cIdx = Math.min(Math.floor(G.combo/5), colors.length-1);
    let comboCol = colors[cIdx];
    if(G.combo >= 30) comboCol = `hsl(${(G.time*360)%360},100%,60%)`;
    const cPulse = 1 + (G.comboPulse > 0 ? G.comboPulse * 0.3 : 0);
    if(G.comboPulse > 0) G.comboPulse -= dt * 2;
    ctx.save();ctx.translate(pad + u*2.5, comboY);ctx.scale(cPulse,cPulse);
    // Glow effect at high combos
    if(G.combo >= 10){
      var glowInt = Math.min((G.combo-10)/40, 1);
      ctx.shadowColor = comboCol;
      ctx.shadowBlur = 8 + glowInt * 20;
    }
    // Size escalation
    var comboSize = Math.min(u*0.65 + G.combo*u*0.005, u*0.95);
    ctx.font=`bold ${comboSize}px monospace`;ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillText(`COMBO x${G.combo}! (${G.comboMult}.0x)`,2,2);
    ctx.fillStyle=comboCol;ctx.fillText(`COMBO x${G.combo}! (${G.comboMult}.0x)`,0,0);
    ctx.shadowBlur=0;
    // Fire particles at 20+ combo
    if(G.combo >= 20 && _perfLevel > 0 && Math.random() < 0.3){
      var _fhue = G.combo >= 50 ? (G.time*360)%360 : G.combo >= 30 ? 40 : 20;
      spawnParticle(pad+u*2.5+Math.random()*u*4, comboY+Math.random()*u*0.5, {
        vx:(Math.random()-0.5)*60, vy:-60-Math.random()*80,
        color:`hsl(${_fhue},100%,${50+Math.random()*30}%)`,
        r:UNIT*(0.08+Math.random()*0.1), decay:2, grav:100
      });
    }
    ctx.restore();
  }

  // Achievement popup
  if(achievementPopup && achievementPopup.life > 0){
    achievementPopup.life -= dt;
    const al = clamp(achievementPopup.life, 0, 1);
    ctx.save();ctx.globalAlpha = al;
    ctx.fillStyle='rgba(255,215,0,0.9)';
    const apW = u*10, apH = u*1.8;
    ctx.fillRect(W/2-apW/2, H*0.15, apW, apH);
    ctx.font=`bold ${u*.6}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='#000';ctx.fillText(`ACHIEVEMENT: ${achievementPopup.name}`, W/2, H*0.15+apH*0.35);
    ctx.font=`${u*.4}px monospace`;ctx.fillText(achievementPopup.desc, W/2, H*0.15+apH*0.7);
    ctx.restore();ctx.globalAlpha=1;
  }
  // Character unlock popup
  if(charUnlockPopup && charUnlockPopup.life > 0){
    charUnlockPopup.life -= dt;
    const al = clamp(charUnlockPopup.life, 0, 1);
    ctx.save();ctx.globalAlpha = al;
    ctx.fillStyle='rgba(100,200,255,0.9)';
    const upW = u*10, upH = u*1.5;
    ctx.fillRect(W/2-upW/2, H*0.22, upW, upH);
    ctx.font=`bold ${u*.55}px monospace`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='#000';ctx.fillText(`${charUnlockPopup.name} UNLOCKED!`, W/2, H*0.22+upH*0.5);
    ctx.restore();ctx.globalAlpha=1;
  }

  // Powerup icons (bottom-left)
  let ix=pad;const iy=H-pad;
  ctx.font=`${u*.75}px sans-serif`;ctx.textAlign='left';ctx.textBaseline='bottom';
  if(p.shield){ctx.fillText('\uD83D\uDEE1\uFE0F',ix,iy);ix+=u*1.2;}
  if(p.magnetTimer>0){ctx.fillText('\uD83E\uDDF2',ix,iy);ix+=u*1.2;}
  if(p.extraLife){ctx.fillText('\u2764\uFE0F',ix,iy);ix+=u*1.2;}
  if(p.starTimer>0){ctx.fillText('\u2B50',ix,iy);ix+=u*1.2;}
  if(p.tinyTimer>0){ctx.fillStyle='#22CCAA';ctx.font=`${u*.55}px monospace`;ctx.fillText('TINY',ix,iy);ix+=u*1.8;}
  if(p.speedBoost){ctx.fillStyle='#CC8822';ctx.font=`${u*.55}px monospace`;ctx.fillText('FAST',ix,iy);ix+=u*1.8;}
  if(p.doubleScore){ctx.fillStyle='#CC4422';ctx.font=`${u*.55}px monospace`;ctx.fillText('x2',ix,iy);ix+=u*1.4;}
  // Cooldown indicators
  ctx.font=`${u*.45}px monospace`;ctx.textBaseline='bottom';
  if(p.slideTimer>0){ctx.fillStyle='#88CCFF';ctx.fillText('SLIDE',ix,iy);ix+=u*2;}
  if(p.dashTimer>0){ctx.fillStyle='#88FFCC';ctx.fillText('DASH',ix,iy);ix+=u*2;}
  if(p.parryTimer>0){ctx.fillStyle='#FFFF44';ctx.fillText('PARRY',ix,iy);ix+=u*2.5;}
  if(p.pounding){ctx.fillStyle='#FFAA44';ctx.fillText('POUND',ix,iy);}
}

// ============================================================
// SCREENS
// ============================================================
function drawMenu(){
  const u=UNIT;
  // Animate BG with faster scroll
  worldOffset+=120*DT;
  if(!chunks.length){G.rng=new RNG(42);initWorld(G.rng,getDiff(0,1),'JUNGLE');initBg();}
  drawBg(THEMES.JUNGLE);

  // Atmospheric gradient overlay
  var menuGrad = ctx.createLinearGradient(0,0,0,H);
  menuGrad.addColorStop(0,'rgba(0,0,0,0.7)');menuGrad.addColorStop(0.35,'rgba(0,0,0,0.35)');
  menuGrad.addColorStop(0.65,'rgba(0,0,0,0.3)');menuGrad.addColorStop(1,'rgba(0,0,0,0.65)');
  ctx.fillStyle=menuGrad;ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.textBaseline='middle';

  // Animated bouncing title
  var titleBounce = Math.sin(Date.now()*.003)*u*0.15;
  var titleScale = 1 + Math.sin(Date.now()*.002)*0.03;
  ctx.save(); ctx.translate(W/2, H*.22 + titleBounce); ctx.scale(titleScale, titleScale);
  ctx.shadowColor='rgba(0,0,0,0.8)';ctx.shadowBlur=15;ctx.shadowOffsetY=4;
  ctx.font=`bold ${u*2.5}px monospace`;ctx.fillStyle='#B8860B';
  ctx.fillText("GRONK'S RUN",0,u*0.1);
  ctx.shadowColor='#FFD700';ctx.shadowBlur=25;ctx.shadowOffsetY=0;
  ctx.fillStyle='#FFD700';ctx.fillText("GRONK'S RUN",0,0);
  ctx.shadowBlur=0;ctx.globalAlpha=0.3;ctx.fillStyle='#FFFFAA';
  ctx.fillText("GRONK'S RUN",0,-u*0.08);ctx.globalAlpha=1;
  ctx.restore();

  ctx.font=`${u*.85}px monospace`;ctx.fillStyle='#88CCFF';
  ctx.fillText('Prehistoric Survival!',W/2,H*.24+u*2.5);

  var tapAlpha = 0.5 + Math.sin(Date.now()*.004)*0.5;
  ctx.globalAlpha = Math.max(0.05, tapAlpha);
  ctx.font=`bold ${u*1.1}px monospace`;ctx.fillStyle='white';
  ctx.shadowColor='rgba(255,255,255,0.5)';ctx.shadowBlur=10;
  ctx.fillText('TAP TO START',W/2,H*.55);
  ctx.shadowBlur=0;ctx.globalAlpha=1;

  // Show resume option if saved progress exists beyond level 1
  if(save.savedLevel>1){
    const cdRemain=save.cooldownEnd-Date.now();
    if(cdRemain>0){
      const mins=Math.max(0, Math.floor(cdRemain/60000));
      const secs=Math.max(0, Math.min(59, Math.ceil((cdRemain%60000)/1000)));
      ctx.font=`${u*.65}px monospace`;ctx.fillStyle='#FF8844';
      ctx.fillText(`Resume Level ${save.savedLevel} in ${mins}:${secs<10?'0':''}${secs}`,W/2,H*.65);
    } else {
      const pulse=1+Math.sin(Date.now()*.006)*.06;
      ctx.save();ctx.translate(W/2,H*.65);ctx.scale(pulse,pulse);
      ctx.font=`bold ${u*.85}px monospace`;ctx.fillStyle='#44DD66';
      ctx.fillText(`RESUME Level ${save.savedLevel}`,0,0);ctx.restore();
    }
  }

  if(save.highestLevel>0){
    ctx.font=`${u*.7}px monospace`;ctx.fillStyle='#FFD700';
    ctx.fillText(`Best: Level ${save.highestLevel} | Score: ${save.bestScore}`,W/2,H*.76);
  }

  ctx.font=`${u*.48}px monospace`;ctx.fillStyle='rgba(255,255,255,0.4)';
  ctx.fillText('Swipe Up: Jump \u2022 Down: Slide/Pound \u2022 Right: Dash',W/2,H-SAFE_BOTTOM-u*1);

  // Speaker icon
  drawSpeakerIcon(SAFE_LEFT+UNIT*.3, SAFE_TOP+UNIT*.3, UNIT*1.2);
}

function drawCharSelect(){
  const u=UNIT;
  ctx.fillStyle='#0a1628';ctx.fillRect(0,0,W,H);

  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font=`bold ${u*1.2}px monospace`;ctx.fillStyle='#FFD700';
  ctx.fillText('CHOOSE YOUR CHARACTER',W/2,SAFE_TOP+H*.06);

  const cols=3, rows=2, totalChars=CHARS.length;
  const cardW=W*.27, cardH=H*.32, gapX=(W-cardW*cols)/(cols+1), gapY=H*.03;
  const topY=SAFE_TOP+H*.12;

  for(let i=0;i<totalChars;i++){
    const row=Math.floor(i/cols), col=i%cols;
    const cx=gapX+(cardW+gapX)*col+cardW/2;
    const cy=topY+row*(cardH+gapY)+cardH/2;
    const sel=G.selectedChar===i;
    const locked = !save.unlockedChars.includes(i);

    // Card bg
    ctx.fillStyle=locked?'rgba(40,40,60,0.4)':sel?'rgba(255,215,0,0.15)':'rgba(255,255,255,0.05)';
    ctx.strokeStyle=locked?'rgba(100,100,120,0.4)':sel?'#FFD700':'rgba(255,255,255,0.2)';
    ctx.lineWidth=sel?3:1;
    const rx=cx-cardW/2,ry=cy-cardH/2;
    ctx.fillRect(rx,ry,cardW,cardH);ctx.strokeRect(rx,ry,cardW,cardH);

    const ch=CHARS[i];
    if (locked) {
      // Silhouette — dark circle + lock icon
      ctx.fillStyle='rgba(60,60,80,0.6)';
      ctx.beginPath();ctx.arc(cx,cy-cardH*.08,u*1.2,0,PI2);ctx.fill();
      ctx.font=`bold ${u*1}px monospace`;ctx.fillStyle='rgba(150,150,170,0.7)';
      ctx.fillText('?',cx,cy-cardH*.06);
      // Name (dimmed)
      ctx.font=`bold ${u*.6}px monospace`;ctx.fillStyle='rgba(150,150,170,0.5)';
      ctx.fillText(ch.name,cx,cy+cardH*.3);
      // Requirement
      ctx.font=`${u*.35}px monospace`;ctx.fillStyle='rgba(255,180,80,0.7)';
      ctx.fillText(CHAR_UNLOCK[i]?CHAR_UNLOCK[i].req:'???',cx,cy+cardH*.42);
    } else {
      // Character preview
      const prevP={screenX:0,y:0,ch:ch,charIdx:i,onGround:true,legAnim:Date.now()*.004,
        squash:1,stretch:1,shield:ch.startShield,magnetTimer:ch.startMagnet?1:0,starTimer:0,starHue:0,extraLife:false,iframes:0};
      ctx.save();ctx.translate(cx,cy-cardH*.08);
      drawChar(prevP,true);
      ctx.restore();

      // Name
      ctx.font=`bold ${u*.6}px monospace`;ctx.fillStyle=sel?'#FFD700':ch.col;
      ctx.fillText(ch.name,cx,cy+cardH*.3);
      // Desc
      ctx.font=`${u*.38}px monospace`;ctx.fillStyle='rgba(255,255,255,0.6)';
      ctx.fillText(ch.desc,cx,cy+cardH*.42);
    }
  }

  // Start button
  const btnW=u*5,btnH=u*1.3,btnX=W/2-btnW/2,btnY=H-SAFE_BOTTOM-u*1.5;
  ctx.fillStyle='#FFD700';ctx.fillRect(btnX,btnY,btnW,btnH);
  ctx.fillStyle='#000';ctx.font=`bold ${u*.85}px monospace`;
  ctx.fillText('START!',W/2,btnY+btnH/2);

  if(Math.sin(Date.now()*.005)>0){
    ctx.font=`${u*.5}px monospace`;ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.fillText('Tap a character, then START!',W/2,btnY-u*.5);
  }

  // HOW TO PLAY button (bottom-left)
  const htpW=u*4.5, htpH=u*1, htpX=SAFE_LEFT+u*.5, htpY=H-SAFE_BOTTOM-u*1.5;
  ctx.fillStyle='rgba(100,100,200,0.3)';ctx.fillRect(htpX,htpY,htpW,htpH);
  ctx.strokeStyle='rgba(100,100,200,0.5)';ctx.lineWidth=1;ctx.strokeRect(htpX,htpY,htpW,htpH);
  ctx.font=`${u*.5}px monospace`;ctx.fillStyle='rgba(200,200,255,0.8)';ctx.textAlign='center';
  ctx.fillText('HOW TO PLAY',htpX+htpW/2,htpY+htpH/2);

  // SKINS button (bottom, between HOW TO PLAY and speaker)
  const skW=u*3.5, skH=u*1, skX=htpX+htpW+u*.5, skY=H-SAFE_BOTTOM-u*1.5;
  ctx.fillStyle='rgba(200,100,220,0.3)';ctx.fillRect(skX,skY,skW,skH);
  ctx.strokeStyle='rgba(200,100,220,0.5)';ctx.lineWidth=1;ctx.strokeRect(skX,skY,skW,skH);
  ctx.font=`bold ${u*.5}px monospace`;ctx.fillStyle='rgba(230,180,255,0.8)';ctx.textAlign='center';
  ctx.fillText('SKINS',skX+skW/2,skY+skH/2);

  // Speaker icon
  drawSpeakerIcon(W-SAFE_RIGHT-u*2, H-SAFE_BOTTOM-u*1.5, u*1);
}

function handleCharSelectTap(){
  const tx=inp.tapX, ty=inp.tapY;
  const u=UNIT;
  const cols=3, totalChars=CHARS.length;
  const cardW=W*.27, cardH=H*.32, gapX=(W-cardW*cols)/(cols+1), gapY=H*.03;
  const topY=SAFE_TOP+H*.12;

  // Check card taps
  for(let i=0;i<totalChars;i++){
    const row=Math.floor(i/cols), col=i%cols;
    const cx=gapX+(cardW+gapX)*col+cardW/2;
    const cy=topY+row*(cardH+gapY)+cardH/2;
    if(tx>cx-cardW/2&&tx<cx+cardW/2&&ty>cy-cardH/2&&ty<cy+cardH/2){
      if(!save.unlockedChars.includes(i)) return; // locked
      G.selectedChar=i; save.selectedChar=i; persistSave(); return;
    }
  }
  // Check start button
  const btnW=u*5,btnH=u*1.3,btnX=W/2-btnW/2,btnY=H-SAFE_BOTTOM-u*1.5;
  if(tx>btnX&&tx<btnX+btnW&&ty>btnY&&ty<btnY+btnH){
    sfxUITap();
    if(!save.tutorialSeen){ G.phase='TUTORIAL'; return; }
    startNewRun();
    return;
  }
  // HOW TO PLAY button
  const htpW=u*4.5, htpH=u*1, htpX=SAFE_LEFT+u*.5, htpY=H-SAFE_BOTTOM-u*1.5;
  if(tx>htpX&&tx<htpX+htpW&&ty>htpY&&ty<htpY+htpH){
    G.phase='TUTORIAL'; sfxUITap(); return;
  }
  // SKINS button
  const skW=u*3.5, skH=u*1, skX=htpX+htpW+u*.5, skY=H-SAFE_BOTTOM-u*1.5;
  if(tx>skX&&tx<skX+skW&&ty>skY&&ty<skY+skH){
    G.skinCharIdx = G.selectedChar || 0;
    G.phase='SKINS'; sfxUITap(); return;
  }
  // Speaker toggle
  if(checkSpeakerTap(tx,ty,W-SAFE_RIGHT-u*2,H-SAFE_BOTTOM-u*1.5,u*1)){
    soundMuted=!soundMuted; sfxUITap();
  }
}

function drawLevelIntro(dt){
  G.introTimer+=dt;
  const u=UNIT;
  const compact = W < 1100 || H < 560;
  const guide = G.onboarding && G.onboarding.level === G.levelNum ? G.onboarding : null;
  drawBg(G.theme);
  ctx.fillStyle='rgba(6,8,14,0.68)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.textBaseline='middle';

  const panelW = Math.min(W * (compact ? 0.76 : 0.7), u * (guide ? 12.4 : 10.8));
  const panelH = u * (guide ? (compact ? 5.4 : 5.7) : (compact ? 4.1 : 4.4));
  const panelX = W / 2 - panelW / 2;
  const panelY = Math.max(SAFE_TOP + u * 0.7, H * (compact ? 0.14 : 0.16));
  const titleScale=Math.min(1,G.introTimer*2.2);

  drawPanel(panelX, panelY, panelW, panelH, {
    radius: u * 0.46,
    top: 'rgba(18,26,44,0.94)',
    bottom: 'rgba(8,12,24,0.92)',
    stroke: 'rgba(255,255,255,0.12)',
    accent: guide ? 'rgba(125,240,155,0.18)' : 'rgba(255,215,90,0.22)',
    blur: 24
  });

  if (guide) {
    drawMiniChip(W / 2 - u * 2.5, panelY + u * 0.34, u * 5, u * 0.58, guide.header, {
      font: FONTS['b0.3'] || ('bold ' + Math.round(u * 0.3) + 'px monospace'),
      accent: 'rgba(120,220,255,0.22)'
    });
  }

  ctx.save();
  ctx.translate(W/2,panelY + u * (guide ? 1.25 : 0.95));
  ctx.scale(titleScale,titleScale);
  ctx.font = FONTS['b1.35'] || ('bold ' + Math.round(u * 1.35) + 'px monospace');
  ctx.fillStyle = '#FFD700';
  ctx.fillText(`LEVEL ${G.levelNum}`,0,0);
  ctx.restore();

  drawMiniChip(panelX + u * 0.62, panelY + u * (guide ? 1.6 : 1.35), panelW - u * 1.24, u * 0.7, G.levelDef.name.toUpperCase(), {
    font: FONTS['b0.42'] || ('bold ' + Math.round(u * 0.42) + 'px monospace'),
    accent: 'rgba(120,210,255,0.2)'
  });

  ctx.font = FONTS['b0.58'] || ('bold ' + Math.round(u * 0.58) + 'px monospace');
  ctx.fillStyle = guide ? '#F5F7FF' : '#88CCFF';
  ctx.fillText((guide ? guide.title : (G.levelDef.focus || 'Stay alive')).toUpperCase(), W / 2, panelY + u * (guide ? 2.55 : 2.35));

  ctx.font = FONTS['n0.4'] || (Math.round(u * 0.4) + 'px monospace');
  ctx.fillStyle = 'rgba(224,233,248,0.76)';
  ctx.fillText(guide ? guide.intro : `Survive ${G.levelDef.targetTime}s to advance.`, W / 2, panelY + u * (guide ? 3.2 : 2.95));

  if (guide) {
    const chipGap = u * 0.18;
    const chipW = Math.min(u * 3.2, (panelW - u * 1.24 - chipGap) / 2);
    const chipY = panelY + u * 3.62;
    for (let i = 0; i < guide.steps.length; i++) {
      const step = guide.steps[i];
      const chipX = W / 2 - chipW - chipGap / 2 + i * (chipW + chipGap);
      drawMiniChip(chipX, chipY, chipW, u * 0.6, step.short, {
        font: FONTS['b0.32'] || ('bold ' + Math.round(u * 0.32) + 'px monospace'),
        accent: step.accent,
        textColor: '#F7FBFF'
      });
    }
    ctx.font = FONTS['n0.33'] || (Math.round(u * 0.33) + 'px monospace');
    ctx.fillStyle = 'rgba(218,230,246,0.68)';
    ctx.fillText(guide.rewardHint, W / 2, panelY + panelH - u * 0.52);
  } else {
    ctx.font = FONTS['n0.34'] || (Math.round(u * 0.34) + 'px monospace');
    ctx.fillStyle = 'rgba(220,228,245,0.68)';
    ctx.fillText('Stay healthy, grab gems, and keep the lane readable.', W / 2, panelY + panelH - u * 0.48);
  }

  if(G.introTimer > (guide ? 3.05 : 2.45)) G.phase='PLAYING';
}

function drawLevelComplete(dt){
  G.levelCompleteTimer+=dt;
  const u=UNIT;
  ctx.fillStyle='rgba(0,0,0,0.55)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.textBaseline='middle';

  const pulse=1+Math.sin(G.levelCompleteTimer*4)*.05;
  ctx.save();ctx.translate(W/2,H*.25);ctx.scale(pulse,pulse);
  ctx.shadowColor='#FFD700';ctx.shadowBlur=20;
  ctx.font=`bold ${u*2}px monospace`;ctx.fillStyle='#FFD700';
  ctx.fillText('LEVEL COMPLETE!',0,0);ctx.shadowBlur=0;ctx.restore();

  ctx.font=`bold ${u*1}px monospace`;ctx.fillStyle='#88CCFF';
  ctx.fillText(`${G.levelDef.name} cleared!`,W/2,H*.42);

  const timeBonus=Math.floor(G.timeLeft*10);
  ctx.font=`${u*.8}px monospace`;ctx.fillStyle='#FFD700';
  ctx.fillText(`Score: ${G.runScore}  |  Time Bonus: +${timeBonus}`,W/2,H*.55);

  // Star rating display
  const stars = G._levelStarsEarned || 1;
  for(let s=0;s<3;s++){
    const sx = W/2 + (s-1)*u*1.5;
    const earned = s < stars;
    const anim = earned && G.levelCompleteTimer > 0.5+s*0.3;
    ctx.font=`${u*(anim?1.4:1)}px sans-serif`;
    ctx.fillStyle = anim ? '#FFD700' : 'rgba(100,100,120,0.4)';
    ctx.fillText(anim?'\u2605':'\u2606', sx, H*.65);
  }

  if(G.levelCompleteTimer>2){
    // Share button (bottom right)
    const _sbw=u*3.5, _sbh=u*.8;
    const _sbx=W-SAFE_RIGHT-_sbw-u, _sby=H-SAFE_BOTTOM-u*1.5;
    ctx.fillStyle='rgba(50,150,255,0.25)';ctx.fillRect(_sbx,_sby,_sbw,_sbh);
    ctx.strokeStyle='rgba(80,180,255,0.5)';ctx.lineWidth=1;ctx.strokeRect(_sbx,_sby,_sbw,_sbh);
    ctx.font='bold '+Math.round(u*.45)+'px monospace';ctx.fillStyle='rgba(100,200,255,0.8)';
    ctx.fillText('SHARE', _sbx+_sbw/2, _sby+_sbh/2);
  }
  if(G.levelCompleteTimer>3){
    if(Math.sin(Date.now()*.005)>0){
      ctx.font=`bold ${u*1}px monospace`;ctx.fillStyle='white';
      ctx.fillText('TAP FOR NEXT LEVEL',W/2,H*.75);
    }
  }
}

function drawDeathScreen(){
  const u=UNIT;
  ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.textBaseline='middle';

  ctx.shadowColor='#FF4444';ctx.shadowBlur=15;
  ctx.font=`bold ${u*1.6}px monospace`;ctx.fillStyle='#FF4444';
  ctx.fillText('GAME OVER',W/2,H*.1);ctx.shadowBlur=0;

  ctx.font=`bold ${u*.9}px monospace`;ctx.fillStyle='#FFD700';
  ctx.fillText(`Score: ${G.runScore}`,W/2,H*.2);

  ctx.font=`${u*.6}px monospace`;ctx.fillStyle='rgba(255,255,255,0.7)';
  ctx.fillText(`Level ${G.levelNum} | Gems: ${G.runGems}${adDoubleGemsUsed?' (doubled!)':''}`,W/2,H*.28);

  if(G.newHigh){
    const bp=1+Math.sin(Date.now()*.008)*.08;
    ctx.save();ctx.translate(W/2,H*.35);ctx.scale(bp,bp);
    ctx.font=`bold ${u*.7}px monospace`;ctx.fillStyle='#FFD700';
    ctx.fillText('\u2B50 NEW BEST! \u2B50',0,0);ctx.restore();
  } else {
    ctx.font=`${u*.55}px monospace`;ctx.fillStyle='rgba(255,215,0,0.6)';
    ctx.fillText(`Best: ${save.bestScore}`,W/2,H*.35);
  }

  // Ad buttons row
  const adBtnW=u*5.5, adBtnH=u*1.3;
  const showAdContinue = adReady && !G.endless && !G.dailyChallenge && canShowAd();
  const showDoubleGems = adReady && !adDoubleGemsUsed && G.runGems > 0 && canShowAd();

  if (showAdContinue || showDoubleGems) {
    const adY = H*.42;
    if (showAdContinue && showDoubleGems) {
      // Two ad buttons side by side
      const gap = u*.4;
      const lx = W/2 - adBtnW - gap/2, rx = W/2 + gap/2;
      // Ad Continue button
      const adPulse=1+Math.sin(Date.now()*.006)*.04;
      ctx.save();ctx.translate(lx+adBtnW/2,adY+adBtnH/2);ctx.scale(adPulse,adPulse);
      ctx.fillStyle='rgba(100,50,200,0.6)';ctx.fillRect(-adBtnW/2,-adBtnH/2,adBtnW,adBtnH);
      ctx.strokeStyle='rgba(160,100,255,0.8)';ctx.lineWidth=2;ctx.strokeRect(-adBtnW/2,-adBtnH/2,adBtnW,adBtnH);
      ctx.font=`bold ${u*.45}px monospace`;ctx.fillStyle='white';
      ctx.fillText('\uD83C\uDFAC WATCH AD',0,-u*.2);
      ctx.font=`bold ${u*.35}px monospace`;ctx.fillStyle='#DDBBFF';
      ctx.fillText('FREE CONTINUE',0,u*.18);
      ctx.restore();
      // Double Gems button
      ctx.save();ctx.translate(rx+adBtnW/2,adY+adBtnH/2);ctx.scale(adPulse,adPulse);
      ctx.fillStyle='rgba(200,150,0,0.5)';ctx.fillRect(-adBtnW/2,-adBtnH/2,adBtnW,adBtnH);
      ctx.strokeStyle='rgba(255,200,50,0.8)';ctx.lineWidth=2;ctx.strokeRect(-adBtnW/2,-adBtnH/2,adBtnW,adBtnH);
      ctx.font=`bold ${u*.45}px monospace`;ctx.fillStyle='white';
      ctx.fillText('\uD83C\uDFAC WATCH AD',0,-u*.2);
      ctx.font=`bold ${u*.35}px monospace`;ctx.fillStyle='#FFE488';
      ctx.fillText('2x GEMS',0,u*.18);
      ctx.restore();
    } else {
      // Single ad button centered
      const ax = W/2 - adBtnW/2;
      const adPulse=1+Math.sin(Date.now()*.006)*.04;
      ctx.save();ctx.translate(W/2,adY+adBtnH/2);ctx.scale(adPulse,adPulse);
      if (showAdContinue) {
        ctx.fillStyle='rgba(100,50,200,0.6)';ctx.fillRect(-adBtnW/2,-adBtnH/2,adBtnW,adBtnH);
        ctx.strokeStyle='rgba(160,100,255,0.8)';ctx.lineWidth=2;ctx.strokeRect(-adBtnW/2,-adBtnH/2,adBtnW,adBtnH);
        ctx.font=`bold ${u*.45}px monospace`;ctx.fillStyle='white';
        ctx.fillText('\uD83C\uDFAC AD: FREE CONTINUE',0,0);
      } else {
        ctx.fillStyle='rgba(200,150,0,0.5)';ctx.fillRect(-adBtnW/2,-adBtnH/2,adBtnW,adBtnH);
        ctx.strokeStyle='rgba(255,200,50,0.8)';ctx.lineWidth=2;ctx.strokeRect(-adBtnW/2,-adBtnH/2,adBtnW,adBtnH);
        ctx.font=`bold ${u*.45}px monospace`;ctx.fillStyle='white';
        ctx.fillText('\uD83C\uDFAC AD: 2x GEMS',0,0);
      }
      ctx.restore();
    }
  }

  // Progress saved notice
  ctx.font=`${u*.45}px monospace`;ctx.fillStyle='rgba(255,170,0,0.7)';
  ctx.fillText(`Progress saved at Level ${G.levelNum}`,W/2,H*.55);

  // Quick retry + level map buttons
  const btnW=u*8,btnH=u*1.3;
  // Retry button — always available, no cooldown
  const pulse=1+Math.sin(Date.now()*.005)*.05;
  ctx.save();ctx.translate(W/2,H*.58);ctx.scale(pulse,pulse);
  ctx.fillStyle='#22AA44';ctx.fillRect(-btnW/2,-btnH/2,btnW,btnH);
  ctx.strokeStyle='#44DD66';ctx.lineWidth=2;ctx.strokeRect(-btnW/2,-btnH/2,btnW,btnH);
  ctx.font=`bold ${u*.75}px monospace`;ctx.fillStyle='white';
  ctx.fillText('RETRY',0,0);ctx.restore();

  // New Run button
  const nrY2=H*.72;
  ctx.fillStyle='rgba(100,100,255,0.3)';ctx.fillRect(W/2-btnW/2,nrY2,btnW,btnH*.85);
  ctx.strokeStyle='rgba(150,150,255,0.5)';ctx.lineWidth=1;ctx.strokeRect(W/2-btnW/2,nrY2,btnW,btnH*.85);
  ctx.font=`bold ${u*.55}px monospace`;ctx.fillStyle='rgba(200,200,255,0.9)';
  ctx.fillText('NEW RUN',W/2,nrY2+btnH*.42);

  // Share + Level Map buttons side by side
  const bottomY=H-SAFE_BOTTOM-u*2;
  const halfBtn=btnW*.45;
  // Share button
  ctx.fillStyle='rgba(50,150,255,0.2)';ctx.fillRect(W/2-halfBtn-u*.3,bottomY,halfBtn,btnH*.8);
  ctx.strokeStyle='rgba(80,180,255,0.5)';ctx.lineWidth=1;ctx.strokeRect(W/2-halfBtn-u*.3,bottomY,halfBtn,btnH*.8);
  ctx.font=`${u*.5}px monospace`;ctx.fillStyle='rgba(100,200,255,0.8)';
  ctx.fillText('SHARE',W/2-halfBtn/2-u*.3,bottomY+btnH*.4);
  // Level Map button
  ctx.fillStyle='rgba(255,255,255,0.1)';ctx.fillRect(W/2+u*.3,bottomY,halfBtn,btnH*.8);
  ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1;ctx.strokeRect(W/2+u*.3,bottomY,halfBtn,btnH*.8);
  ctx.fillStyle='rgba(255,255,255,0.6)';
  ctx.fillText('LEVEL MAP',W/2+halfBtn/2+u*.3,bottomY+btnH*.4);
}

function handleDeathTap(){
  const tx=inp.tapX, ty=inp.tapY, u=UNIT;
  const adBtnW=u*5.5, adBtnH=u*1.3;
  const showAdContinue = adReady && !G.endless && !G.dailyChallenge && canShowAd();
  const showDoubleGems = adReady && !adDoubleGemsUsed && G.runGems > 0 && canShowAd();
  const adY = H*.42;

  // Ad button taps
  if (showAdContinue && showDoubleGems) {
    const gap = u*.4;
    const lx = W/2 - adBtnW - gap/2, rx = W/2 + gap/2;
    // Ad Continue (left)
    if(tx>lx&&tx<lx+adBtnW&&ty>adY&&ty<adY+adBtnH){
      requestAd('continue'); sfxUITap(); return;
    }
    // Double Gems (right)
    if(tx>rx&&tx<rx+adBtnW&&ty>adY&&ty<adY+adBtnH){
      requestAd('doubleGems'); sfxUITap(); return;
    }
  } else if (showAdContinue) {
    if(tx>W/2-adBtnW/2&&tx<W/2+adBtnW/2&&ty>adY&&ty<adY+adBtnH){
      requestAd('continue'); sfxUITap(); return;
    }
  } else if (showDoubleGems) {
    if(tx>W/2-adBtnW/2&&tx<W/2+adBtnW/2&&ty>adY&&ty<adY+adBtnH){
      requestAd('doubleGems'); sfxUITap(); return;
    }
  }

  // Quick retry / New Run / Level Map buttons
  const btnW=u*8,btnH=u*1.3;
  // Retry button (same level)
  const retryY = H*.58 - btnH/2;
  if(tx>W/2-btnW/2&&tx<W/2+btnW/2&&ty>retryY&&ty<retryY+btnH){
    resumeFromSave('death_retry'); sfxUITap(); return;
  }
  // New Run button
  const nrY2=H*.72;
  if(tx>W/2-btnW/2&&tx<W/2+btnW/2&&ty>nrY2&&ty<nrY2+btnH*.85){
    startNewRun(); sfxUITap(); return;
  }
  // Share + Level Map buttons
  const bottomY=H-SAFE_BOTTOM-u*2;
  const halfBtn=btnW*.45;
  // Share button
  if(tx>W/2-halfBtn-u*.3&&tx<W/2-u*.3&&ty>bottomY&&ty<bottomY+btnH*.8){
    const shareText = "I scored " + G.runScore + " on Level " + G.levelNum + " in Gronk's Run! Can you beat it?";
    captureAndShare(shareText);
    sfxUITap(); return;
  }
  // Level Map button
  if(tx>W/2+u*.3&&tx<W/2+u*.3+halfBtn&&ty>bottomY&&ty<bottomY+btnH*.8){
    stopMusic();
    transitionTo('LEVEL_MAP', function(){G._nextLevelNum=0;var _cl=save.highestLevel+1;G.mapTargetScrollY=Math.max(0,_cl*UNIT*4-H/2);G.mapScrollY=G.mapTargetScrollY;});
    sfxUITap(); return;
  }
}

// ============================================================
// PAUSE SCREEN
// ============================================================
function drawPausedScreen(){
  const u=UNIT;
  ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.textBaseline='middle';

  ctx.font=`bold ${u*2.5}px monospace`;ctx.fillStyle='#FFD700';
  ctx.fillText('PAUSED',W/2,H*.25);

  // Resume button (green)
  const btnW=u*6, btnH=u*1.5;
  const resY=H*.45;
  ctx.fillStyle='#22AA44';ctx.fillRect(W/2-btnW/2,resY,btnW,btnH);
  ctx.strokeStyle='#44DD66';ctx.lineWidth=2;ctx.strokeRect(W/2-btnW/2,resY,btnW,btnH);
  ctx.font=`bold ${u*1}px monospace`;ctx.fillStyle='white';
  ctx.fillText('RESUME',W/2,resY+btnH/2);

  // Quit button (red)
  const quitY=H*.62;
  ctx.fillStyle='rgba(200,50,50,0.8)';ctx.fillRect(W/2-btnW/2,quitY,btnW,btnH);
  ctx.strokeStyle='#FF4444';ctx.lineWidth=2;ctx.strokeRect(W/2-btnW/2,quitY,btnW,btnH);
  ctx.font=`bold ${u*1}px monospace`;ctx.fillStyle='white';
  ctx.fillText('QUIT',W/2,quitY+btnH/2);

  // Speaker icon
  drawSpeakerIcon(W/2-u*.6, H-SAFE_BOTTOM-u*2, u*1.2);
}
function handlePausedTap(){
  const tx=inp.tapX, ty=inp.tapY, u=UNIT;
  const btnW=u*6, btnH=u*1.5;
  // Resume
  if(tx>W/2-btnW/2&&tx<W/2+btnW/2&&ty>H*.45&&ty<H*.45+btnH){
    G.phase='PLAYING'; sfxUITap(); return;
  }
  // Quit
  if(tx>W/2-btnW/2&&tx<W/2+btnW/2&&ty>H*.62&&ty<H*.62+btnH){
    transitionTo('LEVEL_MAP'); sfxUITap(); return;
  }
  // Speaker toggle
  if(checkSpeakerTap(tx,ty,W/2-u*.6,H-SAFE_BOTTOM-u*2,u*1.2)){
    soundMuted=!soundMuted; sfxUITap();
  }
}

// ============================================================
// TUTORIAL SCREEN
// ============================================================
function drawTutorial(){
  const u=UNIT;
  ctx.fillStyle='#0a1628';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.textBaseline='middle';

  ctx.font=`bold ${u*1.5}px monospace`;ctx.fillStyle='#FFD700';
  ctx.fillText('HOW TO PLAY',W/2,H*.08);

  const items=[
    {icon:'\u2B06', text:'SWIPE UP \u2192 Jump'},
    {icon:'\u2B06\u2B06', text:'SWIPE UP x2 \u2192 Double Jump'},
    {icon:'\u2B07', text:'SWIPE DOWN \u2192 Slide (ground) / Stomp (air)'},
    {icon:'\u27A1', text:'SWIPE RIGHT \u2192 Dash'},
    {icon:'\u25C6', text:'Collect gems to earn powerups!'},
  ];
  const startY=H*.2, spacing=H*.13;
  for(let i=0;i<items.length;i++){
    const y=startY+i*spacing;
    ctx.font=`${u*1.2}px sans-serif`;ctx.fillStyle='#88CCFF';
    ctx.fillText(items[i].icon,W*.15,y);
    ctx.font=`${u*.65}px monospace`;ctx.fillStyle='rgba(255,255,255,0.85)';
    ctx.textAlign='left';ctx.fillText(items[i].text,W*.25,y);
    ctx.textAlign='center';
  }

  // GOT IT button
  const btnW=u*6, btnH=u*1.5, btnY=H*.85;
  ctx.fillStyle='#22AA44';ctx.fillRect(W/2-btnW/2,btnY,btnW,btnH);
  ctx.strokeStyle='#44DD66';ctx.lineWidth=2;ctx.strokeRect(W/2-btnW/2,btnY,btnW,btnH);
  ctx.font=`bold ${u*1}px monospace`;ctx.fillStyle='white';
  ctx.fillText('GOT IT!',W/2,btnY+btnH/2);
}
function handleTutorialTap(){
  const tx=inp.tapX, ty=inp.tapY, u=UNIT;
  const btnW=u*6, btnH=u*1.5, btnY=H*.85;
  if(tx>W/2-btnW/2&&tx<W/2+btnW/2&&ty>btnY&&ty<btnY+btnH){
    save.tutorialSeen=true; persistSave();
    trackTutorialComplete();
    sfxUITap();
    startNewRun();
  }
}

// ============================================================
// BOSS FIGHT SCREEN
// ============================================================
function drawBossHPBar(){
  if(!boss)return;
  const u=UNIT;
  const barW=W*0.5, barH=u*0.5, barX=W/2-barW/2, barY=u*0.5;
  const pct=clamp(boss.hp/boss.maxHP,0,1);
  ctx.save();
  if(pct<0.34){ctx.shadowColor='#FF2222';ctx.shadowBlur=10+Math.sin(G.time*12)*10;}
  ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(barX-2,barY-2,barW+4,barH+4);
  ctx.fillStyle='#CC2222';ctx.fillRect(barX,barY,barW*pct,barH);
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,255,255,0.4)';ctx.lineWidth=1;ctx.strokeRect(barX,barY,barW,barH);
  ctx.strokeStyle='rgba(255,255,255,0.7)';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(barX+barW*0.33,barY);ctx.lineTo(barX+barW*0.33,barY+barH);
  ctx.moveTo(barX+barW*0.66,barY);ctx.lineTo(barX+barW*0.66,barY+barH);ctx.stroke();
  ctx.font=`bold ${u*.5}px monospace`;ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillStyle='white';ctx.fillText(`${boss.name} - ${boss.hp}/${boss.maxHP}`,W/2,barY+barH+4);

  // Timer
  ctx.font=`bold ${u*.8}px monospace`;ctx.fillStyle='#FFAA00';
  ctx.fillText(`${Math.ceil(boss.bossTimer)}s`,W/2,barY+barH+u*1);
  ctx.restore();
}

function drawBoss(){
  if(!boss)return;
  const u=UNIT;
  ctx.save();ctx.translate(boss.x, boss.y);
  const pct=clamp(boss.hp/boss.maxHP,0,1);
  // Glow effect
  let glowCol = boss.flashTimer>0 ? 'rgba(255,255,255,0.5)' : boss.color;
  let sBlur = 20;
  if(pct<0.66 && pct>=0.33) {
      glowCol = boss.flashTimer>0 ? '#FFFFFF' : '#FF8800';
      sBlur = 30 + Math.sin(G.time*8)*10;
  } else if (pct<0.33) {
      glowCol = boss.flashTimer>0 ? '#FFFFFF' : '#FF0000';
      sBlur = 40 + Math.sin(G.time*15)*20;
  }
  ctx.shadowColor=glowCol;ctx.shadowBlur=sBlur;
  // Scaled-up body based on type
  const sc=2.5;
  ctx.scale(sc,sc);
  // Simple boss body (big colored circle with features)
  ctx.fillStyle=boss.flashTimer>0?'#FFFFFF':boss.color;
  ctx.beginPath();ctx.ellipse(0,-u*.8,u*1,u*1.2,0,0,PI2);ctx.fill();
  // Eyes
  ctx.fillStyle='#ff0';ctx.beginPath();ctx.arc(-u*.3,-u*1.1,u*.15,0,PI2);ctx.arc(u*.3,-u*1.1,u*.15,0,PI2);ctx.fill();
  ctx.fillStyle='#200';ctx.beginPath();ctx.arc(-u*.25,-u*1.08,u*.08,0,PI2);ctx.arc(u*.35,-u*1.08,u*.08,0,PI2);ctx.fill();
  // Mouth
  ctx.strokeStyle='#200';ctx.lineWidth=u*.08;ctx.beginPath();
  ctx.arc(0,-u*.6,u*.3,0.2,Math.PI-0.2);ctx.stroke();
  // Wind-up animation
  if(boss.windUp>0){
    ctx.fillStyle='rgba(255,100,0,0.5)';
    ctx.beginPath();ctx.arc(0,-u*.8,u*(1.2+boss.windUp),0,PI2);ctx.fill();
    ctx.strokeStyle='rgba(255,0,0,0.8)';ctx.lineWidth=u*0.2;
    ctx.beginPath();ctx.moveTo(-u*(1.5+boss.windUp),-u*.8);ctx.lineTo(-u*(2.5+boss.windUp),-u*.8);
    ctx.moveTo(0, u*(0.2+boss.windUp));ctx.lineTo(0, u*(1.2+boss.windUp));
    ctx.moveTo(u*(1.5+boss.windUp),-u*.8);ctx.lineTo(u*(2.5+boss.windUp),-u*.8);
    ctx.moveTo(0, -u*(1.8+boss.windUp));ctx.lineTo(0, -u*(2.8+boss.windUp));
    ctx.stroke();
  }
  ctx.shadowBlur=0;
  ctx.restore();

  // Draw boss projectiles
  for(const pr of boss.projectiles){
    ctx.save();ctx.translate(pr.x,pr.y);
    ctx.shadowColor='rgba(255,255,255,0.7)';ctx.shadowBlur=10;
    if(pr.type==='FIRE_BEAM'){
      ctx.fillStyle='rgba(255,100,0,0.8)';ctx.fillRect(-UNIT*3,-UNIT*.15,UNIT*6,UNIT*.3);
      ctx.fillStyle='rgba(255,200,50,0.5)';ctx.fillRect(-UNIT*3,-UNIT*.08,UNIT*6,UNIT*.16);
    } else if(pr.type==='ICE'){
      ctx.fillStyle='#aaeeff';ctx.beginPath();ctx.moveTo(0,-UNIT*.3);ctx.lineTo(UNIT*.15,0);ctx.lineTo(0,UNIT*.3);ctx.lineTo(-UNIT*.15,0);ctx.closePath();ctx.fill();
    } else if(pr.type==='ICE_PILLAR'){
      ctx.fillStyle='rgba(150,220,255,0.7)';ctx.fillRect(-UNIT*.25,-UNIT*2,UNIT*.5,UNIT*2);
    } else if(pr.type==='POISON_CLOUD'){
      const r2=pr.r||UNIT*2;
      ctx.fillStyle='rgba(100,200,50,0.3)';ctx.beginPath();ctx.arc(0,0,r2,0,PI2);ctx.fill();
      ctx.fillStyle='rgba(80,180,30,0.2)';ctx.beginPath();ctx.arc(r2*.3,-r2*.2,r2*.6,0,PI2);ctx.fill();
    } else if(pr.type==='SWOOP_TRAIL'){
      ctx.fillStyle='rgba(255,150,0,0.6)';ctx.fillRect(-UNIT,UNIT*-.3,UNIT*2,UNIT*.6);
    } else if(pr.type==='ROCK_P'){
      ctx.fillStyle='#6a5a3a';ctx.beginPath();ctx.arc(0,0,UNIT*.35,0,PI2);ctx.fill();
    } else if(pr.type==='BOULDER_P'){
      ctx.fillStyle='#5a5a5a';ctx.beginPath();ctx.arc(0,0,UNIT*.4,0,PI2);ctx.fill();
    } else if(pr.type==='SHOCKWAVE'){
      ctx.fillStyle='rgba(255,120,0,0.8)';ctx.beginPath();ctx.ellipse(0,0,UNIT*.6,UNIT*.25,0,0,PI2);ctx.fill();
    } else if(pr.type==='SKULL'){
      ctx.fillStyle='#aa88ff';ctx.beginPath();ctx.arc(0,0,UNIT*.3,0,PI2);ctx.fill();
    } else if(pr.type==='FEATHER'){
      ctx.fillStyle='#aa7744';ctx.beginPath();ctx.moveTo(-UNIT*.25,0);ctx.lineTo(UNIT*.25,0);ctx.lineTo(0,-UNIT*.15);ctx.closePath();ctx.fill();
    }
    ctx.restore();
  }
}

function checkBossCollisions(dt){
  if(!boss||!G.player||!G.player.alive)return;
  const p=G.player, phb=p.hitbox;
  // Boss projectile collision
  for(let i=boss.projectiles.length-1;i>=0;i--){
    const pr=boss.projectiles[i];
    let prHB;
    if(pr.type==='FIRE_BEAM') prHB={x:pr.x-UNIT*3,y:pr.y-UNIT*.15,w:UNIT*6,h:UNIT*.3};
    else if(pr.type==='ICE_PILLAR') prHB={x:pr.x-UNIT*.25,y:pr.y-UNIT*2,w:UNIT*.5,h:UNIT*2};
    else if(pr.type==='POISON_CLOUD') prHB={x:pr.x-(pr.r||UNIT*2),y:pr.y-(pr.r||UNIT*2),w:(pr.r||UNIT*2)*2,h:(pr.r||UNIT*2)*2};
    else if(pr.type==='SWOOP_TRAIL') prHB={x:pr.x-UNIT,y:pr.y-UNIT*.3,w:UNIT*2,h:UNIT*.6};
    else prHB={x:pr.x-UNIT*.4,y:pr.y-UNIT*.4,w:UNIT*.8,h:UNIT*.8};
    if(pr.homing){
      const dx=p.screenX-pr.x, dy=(p.y-UNIT)-pr.y;
      const d=Math.sqrt(dx*dx+dy*dy);
      if(d>1){const tA=Math.atan2(dy,dx),cA=Math.atan2(pr.vy,pr.vx);
        let da=tA-cA;while(da>Math.PI)da-=PI2;while(da<-Math.PI)da+=PI2;
        const nA=cA+clamp(da,-3*dt,3*dt),spd=210;pr.vx=Math.cos(nA)*spd;pr.vy=Math.sin(nA)*spd;}
    }
    // Parry: deflect boss projectiles back at boss
    if(p.parryTimer>0){
      const dx=pr.x-p.screenX, dy=pr.y-(p.y-UNIT);
      if(Math.sqrt(dx*dx+dy*dy)<UNIT*2.5){
        boss.projectiles.splice(i,1);
        boss.takeDamage(25);
        comboAction(100,'parry');
        G.announce={text:'DEFLECT! -25 Boss HP',life:0.8};
        addTrauma(0.2);
        spawnParts(pr.x,pr.y,10,{color:'#FFFF44',r:UNIT*.2,decay:2,grav:300});
        continue;
      }
    }
    if(aabb(phb,prHB)){boss.projectiles.splice(i,1);p.hit(pr.type==='FIRE_BEAM'?'FIRE_GEYSER':'ROCK_P');return;}
  }
  // Player damages boss via ground pound, dash, or parry
  // Parry damages boss on direct contact
  if(p.parryTimer>0 && aabb(phb,boss.hitbox)){
    boss.takeDamage(15); addTrauma(.15);
    p.parryTimer=0; // consume parry
  }
  // Player damages boss via ground pound or dash
  const bHB=boss.hitbox;
  if(p.pounding && p.onGround){
    const dist=Math.abs(p.screenX-boss.x);
    if(dist<UNIT*5){boss.takeDamage(15);addTrauma(.2);}
  }
  if(p.dashTimer>0 && aabb(phb,bHB)){
    boss.takeDamage(10);addTrauma(.15);
  }
}

// ============================================================
// STATS SCREEN
// ============================================================
let statsTouchStartY=0, statsTouchLastY=0, statsScrollingActive=false;
function drawStatsScreen(dt){
  const u=UNIT;
  const totalAch = ACHIEVEMENTS.length;
  const unlockedAch = ACHIEVEMENTS.filter(function(a){ return save.achievements && save.achievements[a.id]; }).length;
  const achProg = totalAch > 0 ? unlockedAch / totalAch : 0;
  const layout = drawMetaScreenScaffold({
    theme: THEMES.GLACIER,
    accent: 'rgba(125,205,255,0.22)',
    title: 'STATS & ACHIEVEMENTS',
    subtitle: 'Track progression, combat habits, and long-term unlock momentum.',
    leftChip: { label: `${unlockedAch}/${totalAch} UNLOCKED`, w: u * 4.8, accent: 'rgba(255,215,90,0.22)', textColor: '#FFF4C8' },
    rightChip: { label: `BEST ${save.bestScore || 0}`, w: u * 4.2, accent: 'rgba(120,188,255,0.22)' }
  });

  const s=save.stats||{};
  const clipX = layout.bodyX;
  const clipY = layout.bodyY;
  const clipW = layout.bodyW;
  const clipH = layout.bodyH;
  const innerX = clipX + u * 0.26;
  const innerW = clipW - u * 0.52;
  const rowH = u * 0.92;
  const rowGap = u * 0.18;
  const maxStatsScroll = Math.max(0, (G._statsContentH || 0) - clipH);
  G.statsTargetScrollY = clamp(G.statsTargetScrollY || 0, 0, maxStatsScroll);
  G.statsScrollY = lerp(G.statsScrollY || 0, G.statsTargetScrollY || 0, 8 * dt);
  const scrollOff = G.statsScrollY || 0;

  drawPanel(layout.bodyX, layout.bodyY, layout.bodyW, layout.bodyH, {
    radius: u * 0.42,
    top: 'rgba(18,28,46,0.94)',
    bottom: 'rgba(8,12,24,0.9)',
    stroke: 'rgba(255,255,255,0.1)',
    accent: 'rgba(125,205,255,0.12)',
    blur: 20
  });
  drawMiniChip(layout.bodyX + u * 0.36, layout.bodyY + u * 0.24, u * 4.3, u * 0.64, `${Math.round(achProg * 100)}% COMPLETE`, {
    font: FONTS['b0.3'] || ('bold ' + Math.round(u * 0.3) + 'px monospace'),
    accent: 'rgba(255,215,90,0.22)',
    textColor: '#FFF4C8'
  });
  drawProgressBar(layout.bodyX + u * 4.95, layout.bodyY + u * 0.36, layout.bodyW - u * 5.3, u * 0.28, achProg, ['#FFE27A', '#C98618']);

  ctx.save();
  ctx.beginPath();ctx.rect(clipX + 2, clipY + u * 0.82, clipW - 4, clipH - u * 1.08);ctx.clip();

  // Grouped stats with icons
  const statGroups = [
    { title:'PROGRESSION', color:'#4CAF50', items:[
      {label:'Highest Level', val:s.highestLevel||0, icon:'\u26A1'},
      {label:'Total Runs', val:s.totalRuns||0, icon:'\uD83C\uDFC3'},
      {label:'Best Score', val:save.bestScore||0, icon:'\uD83C\uDFC6'},
      {label:'Total Score', val:s.totalScore||0, icon:'\uD83D\uDCCA'},
      {label:'Login Streak', val:save.dailyStreak||0, icon:'\uD83D\uDD25'},
    ]},
    { title:'COLLECTION', color:'#FFD700', items:[
      {label:'Total Gems', val:s.totalGems||0, icon:'\uD83D\uDC8E'},
      {label:'Longest Run', val:(s.longestRun||0)+'s', icon:'\u23F1'},
      {label:'Daily Best', val:save.challengeBest||0, icon:'\uD83C\uDF1F'},
    ]},
    { title:'COMBAT', color:'#FF6644', items:[
      {label:'Enemies Dodged', val:s.enemiesDodged||0, icon:'\uD83D\uDCA8'},
      {label:'Obstacles Smashed', val:s.obstaclesSmashed||0, icon:'\uD83D\uDCA5'},
      {label:'Dashes Used', val:s.dashesUsed||0, icon:'\uD83D\uDCA8'},
      {label:'Slides Used', val:s.slidesUsed||0, icon:'\uD83C\uDFC4'},
    ]},
  ];

  let y = clipY + u * 1.12 - scrollOff;
  ctx.textAlign='left';ctx.textBaseline='middle';
  for(const grp of statGroups) {
    if(y > clipY - u && y < clipY + clipH){
      drawMiniChip(innerX, y, u * 3.8, u * 0.58, grp.title, {
        font: FONTS['b0.32'] || ('bold ' + Math.round(u * 0.32) + 'px monospace'),
        accent: grp.color,
        textColor: '#F7FBFF'
      });
    }
    y += u * 0.74;
    for(const item of grp.items) {
      if(y > clipY - rowH && y < clipY + clipH){
        drawPanel(innerX, y, innerW, rowH, {
          radius: u * 0.22,
          top: 'rgba(20,28,42,0.9)',
          bottom: 'rgba(10,14,24,0.88)',
          stroke: 'rgba(255,255,255,0.06)',
          blur: 8
        });
        ctx.font = FONTS['n0.34'] || (Math.round(u * 0.34) + 'px monospace');
        ctx.fillStyle='rgba(214,226,244,0.72)';
        ctx.textAlign='left';
        ctx.fillText(item.icon+'  '+item.label, innerX + u * 0.28, y + rowH * 0.5);
        ctx.font = FONTS['b0.38'] || ('bold ' + Math.round(u * 0.38) + 'px monospace');
        ctx.fillStyle='rgba(245,247,255,0.92)';
        ctx.textAlign='right';
        ctx.fillText(''+item.val, innerX + innerW - u * 0.28, y + rowH * 0.5);
      }
      y += rowH + rowGap;
    }
    y += u * 0.24;
  }

  if(y > clipY - u && y < clipY + clipH){
    drawMiniChip(innerX, y, u * 4.5, u * 0.58, 'ACHIEVEMENTS', {
      font: FONTS['b0.32'] || ('bold ' + Math.round(u * 0.32) + 'px monospace'),
      accent: 'rgba(255,215,90,0.22)',
      textColor: '#FFF4C8'
    });
  }
  y += u * 0.74;

  for(let i=0;i<ACHIEVEMENTS.length;i++){
    const a=ACHIEVEMENTS[i];
    const unlocked=save.achievements&&save.achievements[a.id];
    const cardH = u * 1.12;
    if(y > clipY - cardH && y < clipY + clipH){
      drawPanel(innerX, y, innerW, cardH, {
        radius: u * 0.24,
        top: unlocked ? 'rgba(42,36,16,0.92)' : 'rgba(18,20,30,0.9)',
        bottom: unlocked ? 'rgba(20,14,10,0.9)' : 'rgba(10,12,20,0.88)',
        stroke: unlocked ? 'rgba(255,215,90,0.18)' : 'rgba(255,255,255,0.05)',
        accent: unlocked ? 'rgba(255,215,90,0.16)' : 'rgba(110,120,150,0.08)',
        blur: 8
      });
      drawMiniChip(innerX + u * 0.24, y + u * 0.18, u * 1.1, u * 0.5, unlocked ? 'DONE' : 'LOCK', {
        font: FONTS['b0.26'] || ('bold ' + Math.round(u * 0.26) + 'px monospace'),
        accent: unlocked ? 'rgba(255,215,90,0.22)' : 'rgba(110,120,150,0.18)',
        textColor: unlocked ? '#FFE7A4' : 'rgba(188,196,216,0.72)'
      });
      ctx.textAlign='left';ctx.textBaseline='top';
      ctx.font = FONTS['b0.34'] || ('bold ' + Math.round(u * 0.34) + 'px monospace');
      ctx.fillStyle = unlocked ? '#FFD45E' : 'rgba(216,224,242,0.74)';
      ctx.fillText(a.name, innerX + u * 1.52, y + u * 0.16);
      ctx.font = FONTS['n0.28'] || (Math.round(u * 0.28) + 'px monospace');
      ctx.fillStyle = unlocked ? 'rgba(255,230,176,0.72)' : 'rgba(170,182,204,0.6)';
      ctx.fillText(a.desc + (a.gems ? ` (+${a.gems}g)` : ''), innerX + u * 1.52, y + u * 0.54);
      if (unlocked) {
        ctx.textAlign='right';
        ctx.font = FONTS['b0.28'] || ('bold ' + Math.round(u * 0.28) + 'px monospace');
        ctx.fillStyle = '#FFE7A4';
        ctx.fillText('UNLOCKED', innerX + innerW - u * 0.28, y + u * 0.24);
      }
    }
    y += cardH + u * 0.18;
  }

  G._statsContentH = Math.max(0, y - (clipY + u * 1.12) + u * 0.28);
  G._statsViewportH = clipH - u * 1.08;
  ctx.restore();

  const topFade = ctx.createLinearGradient(0, clipY, 0, clipY + u * 0.65);
  topFade.addColorStop(0, 'rgba(8,12,24,0.92)');
  topFade.addColorStop(1, 'rgba(8,12,24,0)');
  ctx.fillStyle = topFade;
  ctx.fillRect(clipX, clipY + u * 0.82, clipW, u * 0.65);
  const bottomFade = ctx.createLinearGradient(0, clipY + clipH - u * 0.85, 0, clipY + clipH);
  bottomFade.addColorStop(0, 'rgba(8,12,24,0)');
  bottomFade.addColorStop(1, 'rgba(8,12,24,0.96)');
  ctx.fillStyle = bottomFade;
  ctx.fillRect(clipX, clipY + clipH - u * 0.85, clipW, u * 0.85);

  G._statsBackBtn = drawMetaFooterButton(layout, 'BACK', 'Level map', {
    top: 'rgba(24,30,42,0.95)',
    bottom: 'rgba(10,15,26,0.92)',
    stroke: 'rgba(221,229,245,0.16)',
    accent: '#8593A8',
    labelColor: '#F1F5FF'
  });
}
function handleStatsTap(){
  const tx=inp.tapX, ty=inp.tapY;
  const btn = G._statsBackBtn;
  if(btn && tx>btn.x&&tx<btn.x+btn.w&&ty>btn.y&&ty<btn.y+btn.h){
    G.phase='LEVEL_MAP'; sfxUITap();
  }
}

// ============================================================
// GEM SHOP
// ============================================================
const SHOP_ITEMS = [
  // Per-run powerups (consumed on next level start)
  { id:'shield', name:'Shield', desc:'Start with a shield', cost:10, type:'powerup' },
  { id:'magnet', name:'Magnet', desc:'Start with gem magnet', cost:15, type:'powerup' },
  { id:'extra_life', name:'Extra Life', desc:'One extra life', cost:25, type:'powerup' },
  { id:'time_10', name:'+10s Time', desc:'Start with +10s', cost:20, type:'powerup' },
  // Permanent upgrades (buy once)
  { id:'up_hp', name:'+10 Max HP', desc:'All characters +10 HP', cost:50, type:'upgrade' },
  { id:'up_dashcd', name:'Dash Cooldown', desc:'-0.2s dash cooldown', cost:75, type:'upgrade' },
  { id:'up_continue', name:'+1 Continue', desc:'Extra continue per run', cost:100, type:'upgrade' },
  { id:'up_pound', name:'Pound Range', desc:'+10% pound radius', cost:60, type:'upgrade' },
];

function drawShopScreen(dt) {
  const u = UNIT;
  const queuedCount = (save.nextRunPowerups || []).length;
  const ownedUpgrades = Object.keys(save.shopUpgrades || {}).filter(function(key) { return !!save.shopUpgrades[key]; }).length;
  const totalUpgrades = SHOP_ITEMS.filter(function(item) { return item.type === 'upgrade'; }).length;
  const layout = drawMetaScreenScaffold({
    theme: THEMES.JUNGLE,
    accent: 'rgba(255,208,90,0.24)',
    title: 'GEM SHOP',
    subtitle: 'Spend gems on next-run boosts and permanent upgrades that smooth the climb.',
    leftChip: { label: `${save.totalGems} GEMS`, w: u * 3.9, accent: 'rgba(255,208,90,0.24)', textColor: '#FFE27A' },
    rightChip: { label: `${queuedCount} QUEUED`, w: u * 3.9, accent: queuedCount > 0 ? 'rgba(120,188,255,0.22)' : 'rgba(110,120,150,0.16)' }
  });
  const bodyX = layout.bodyX + u * 0.34;
  const bodyY = layout.bodyY + u * 0.28;
  const bodyW = layout.bodyW - u * 0.68;
  const rowH = u * 1.22;
  const rowGap = u * 0.18;
  const sectionGap = u * 0.46;
  let y = bodyY;
  G._shopTargets = [];

  drawPanel(layout.bodyX, layout.bodyY, layout.bodyW, layout.bodyH, {
    radius: u * 0.42,
    top: 'rgba(18,28,46,0.94)',
    bottom: 'rgba(8,12,24,0.9)',
    stroke: 'rgba(255,255,255,0.1)',
    accent: 'rgba(255,208,90,0.12)',
    blur: 20
  });

  const sections = [
    { type: 'powerup', label: 'NEXT RUN BOOSTS', accent: 'rgba(120,188,255,0.2)', text: '#D8ECFF' },
    { type: 'upgrade', label: `PERMANENT UPGRADES  |  ${ownedUpgrades}/${totalUpgrades} OWNED`, accent: 'rgba(255,208,90,0.2)', text: '#FFF1C4' }
  ];

  for (let s = 0; s < sections.length; s++) {
    const section = sections[s];
    drawMiniChip(bodyX, y, Math.min(u * 6.8, bodyW * 0.64), u * 0.58, section.label, {
      font: FONTS['b0.3'] || ('bold ' + Math.round(u * 0.3) + 'px monospace'),
      accent: section.accent,
      textColor: section.text
    });
    y += u * 0.74;
    const items = SHOP_ITEMS.filter(function(item) { return item.type === section.type; });
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const owned = item.type==='upgrade' && save.shopUpgrades[item.id];
      const queued = item.type==='powerup' && save.nextRunPowerups.includes(item.id);
      const canBuy = !owned && !queued && save.totalGems >= item.cost;
      const statusLabel = owned ? 'OWNED' : queued ? 'QUEUED' : `${item.cost}g`;
      const accent = owned ? 'rgba(110,210,130,0.22)' : queued ? 'rgba(120,188,255,0.22)' : canBuy ? 'rgba(255,208,90,0.2)' : 'rgba(110,120,150,0.12)';
      drawPanel(bodyX, y, bodyW, rowH, {
        radius: u * 0.24,
        top: 'rgba(20,28,42,0.92)',
        bottom: 'rgba(10,14,24,0.9)',
        stroke: canBuy ? 'rgba(255,215,90,0.12)' : 'rgba(255,255,255,0.06)',
        accent: accent,
        blur: 8
      });
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = FONTS['b0.36'] || ('bold ' + Math.round(u * 0.36) + 'px monospace');
      ctx.fillStyle = canBuy ? '#FFE27A' : owned ? '#96FFB4' : queued ? '#CBE4FF' : 'rgba(220,228,245,0.74)';
      ctx.fillText(item.name, bodyX + u * 0.26, y + u * 0.18);
      ctx.font = FONTS['n0.28'] || (Math.round(u * 0.28) + 'px monospace');
      ctx.fillStyle = 'rgba(192,206,228,0.62)';
      ctx.fillText(item.desc, bodyX + u * 0.26, y + u * 0.58);
      const chipW = u * 2.15;
      const chipX = bodyX + bodyW - chipW - u * 0.22;
      drawMiniChip(chipX, y + u * 0.26, chipW, u * 0.62, statusLabel.toUpperCase(), {
        font: FONTS['b0.28'] || ('bold ' + Math.round(u * 0.28) + 'px monospace'),
        accent: accent,
        textColor: owned ? '#E8FFF0' : queued ? '#EAF4FF' : canBuy ? '#FFF4C8' : 'rgba(190,200,220,0.72)'
      });
      G._shopTargets.push({ x: bodyX, y: y, w: bodyW, h: rowH, itemId: item.id });
      y += rowH + rowGap;
    }
    y += sectionGap;
  }

  G._shopBackBtn = drawMetaFooterButton(layout, 'BACK', 'Level map', {
    top: 'rgba(24,30,42,0.95)',
    bottom: 'rgba(10,15,26,0.92)',
    stroke: 'rgba(221,229,245,0.16)',
    accent: '#8593A8',
    labelColor: '#F1F5FF'
  });
}

function handleShopTap(){
  const tx=inp.tapX, ty=inp.tapY;
  const targets = G._shopTargets || [];

  for(let i=0;i<targets.length;i++){
    const hit = targets[i];
    if(tx>hit.x&&tx<hit.x+hit.w&&ty>hit.y&&ty<hit.y+hit.h){
      const item = SHOP_ITEMS.find(function(entry) { return entry.id === hit.itemId; });
      if(!item) return;
      const owned = item.type==='upgrade' && save.shopUpgrades[item.id];
      const queued = item.type==='powerup' && save.nextRunPowerups.includes(item.id);
      if(!owned && !queued && save.totalGems >= item.cost){
        save.totalGems -= item.cost;
        if(item.type==='upgrade'){
          save.shopUpgrades[item.id] = true;
        } else {
          save.nextRunPowerups.push(item.id);
        }
        trackPurchase(item.id, item.cost);
        sfxUITap(); persistSave();
      }
      return;
    }
  }

  const btn = G._shopBackBtn;
  if(btn && tx>btn.x&&tx<btn.x+btn.w&&ty>btn.y&&ty<btn.y+btn.h){
    G.phase='LEVEL_MAP'; sfxUITap();
  }
}

// ============================================================
// SKINS SCREEN
// ============================================================
function drawSkinsScreen(dt) {
  const u = UNIT;
  ctx.fillStyle='#0a1628';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.textBaseline='middle';

  // Title
  ctx.font=`bold ${u*1}px monospace`;ctx.fillStyle='#FFD700';
  ctx.fillText('SKINS',W/2,u*1);
  // Gem balance
  ctx.font=`${u*.5}px monospace`;ctx.fillStyle='rgba(255,220,100,0.8)';
  ctx.fillText(`Gems: ${save.totalGems}`,W/2,u*1.8);

  // Character tabs
  const tabW = W/CHARS.length;
  const selCharIdx = G.skinCharIdx || 0;
  for(let i=0;i<CHARS.length;i++){
    const tx = i*tabW, ty = u*2.3, th = u*1;
    const sel = i===selCharIdx;
    const unlocked = save.unlockedChars.includes(i);
    ctx.fillStyle = sel ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.05)';
    ctx.fillRect(tx,ty,tabW,th);
    if(sel){ctx.strokeStyle='#FFD700';ctx.lineWidth=2;ctx.strokeRect(tx,ty,tabW,th);}
    ctx.font=`bold ${u*.4}px monospace`;
    ctx.fillStyle = unlocked ? (sel?'#FFD700':'rgba(255,255,255,0.7)') : 'rgba(100,100,120,0.4)';
    ctx.fillText(CHARS[i].name, tx+tabW/2, ty+th/2);
  }

  // Skins for selected character
  const ch = CHARS[selCharIdx];
  const skins = getCharSkins(ch.id);
  const charLocked = !save.unlockedChars.includes(selCharIdx);
  const cardW = W*.42, cardH = u*4.5, gapX = (W - cardW*2)/3, gapY = u*.5;
  const startY = u*3.8;

  for(let i=0;i<skins.length;i++){
    const sk = skins[i];
    const row = Math.floor(i/2), col = i%2;
    const cx = gapX + (cardW+gapX)*col + cardW/2;
    const cy = startY + row*(cardH+gapY) + cardH/2;
    const rx = cx-cardW/2, ry = cy-cardH/2;

    const owned = sk.cost===0 || ownsSkin(sk.id);
    const active = save.activeSkins[ch.id]===sk.id || (sk.cost===0 && !save.activeSkins[ch.id]);
    const canBuy = !charLocked && !owned && save.totalGems >= sk.cost;

    // Card bg
    ctx.fillStyle = active ? 'rgba(255,215,0,0.15)' : owned ? 'rgba(80,255,80,0.08)' : 'rgba(255,255,255,0.05)';
    ctx.strokeStyle = active ? '#FFD700' : owned ? 'rgba(80,255,80,0.3)' : 'rgba(80,80,100,0.3)';
    ctx.lineWidth = active ? 3 : 1;
    fillRR(rx, ry, cardW, cardH, u*0.3, ctx.fillStyle, ctx.strokeStyle, ctx.lineWidth);

    // Preview character with skin colors
    const prevP = {screenX:0, y:0, ch:{...ch, col:sk.col, dk:sk.dk}, charIdx:selCharIdx, onGround:true,
      legAnim:Date.now()*.004, squash:1, stretch:1, shield:false, magnetTimer:0, starTimer:0, starHue:0,
      extraLife:false, iframes:0, slideTimer:0, dashTimer:0, hpFlash:0};
    ctx.save(); ctx.translate(cx, cy-cardH*.12);
    drawChar(prevP, true);
    ctx.restore();

    // Trail indicator
    if(sk.trail){
      const tr = SKIN_TRAILS[sk.trail];
      if(tr){
        for(let t=0;t<3;t++){
          ctx.fillStyle=tr.colors[t%tr.colors.length];
          ctx.globalAlpha=0.5-t*0.15;
          ctx.beginPath();ctx.arc(cx-u*(0.6+t*0.4), cy-cardH*.12, u*tr.size*(1-t*0.2), 0, PI2);ctx.fill();
        }
        ctx.globalAlpha=1;
      }
    }

    // Skin name
    ctx.textAlign='center';
    ctx.font=`bold ${u*.5}px monospace`;ctx.fillStyle=active?'#FFD700':owned?'#88FF88':sk.col;
    ctx.fillText(sk.name, cx, cy+cardH*.3);

    // Status / price
    if(charLocked){
      ctx.font=`${u*.35}px monospace`;ctx.fillStyle='rgba(150,150,170,0.5)';
      ctx.fillText('Unlock char first', cx, cy+cardH*.42);
    } else if(active){
      ctx.font=`bold ${u*.4}px monospace`;ctx.fillStyle='#FFD700';
      ctx.fillText('EQUIPPED', cx, cy+cardH*.42);
    } else if(owned){
      ctx.font=`${u*.4}px monospace`;ctx.fillStyle='#88FF88';
      ctx.fillText('TAP TO EQUIP', cx, cy+cardH*.42);
    } else {
      ctx.font=`bold ${u*.45}px monospace`;ctx.fillStyle=canBuy?'#FFD700':'rgba(150,150,170,0.5)';
      ctx.fillText(`${sk.cost}g`, cx, cy+cardH*.42);
    }
  }

  // Back button
  const btnW=u*4, btnH=u*1.2, btnY=H-SAFE_BOTTOM-u*1.8;
  fillRR(W/2-btnW/2, btnY, btnW, btnH, u*0.3, 'rgba(100,100,200,0.3)', 'rgba(100,100,200,0.5)', 1);
  ctx.font=`bold ${u*.6}px monospace`;ctx.fillStyle='rgba(200,200,255,0.8)';
  ctx.fillText('BACK', W/2, btnY+btnH/2);
}

function handleSkinsTap(){
  const tx=inp.tapX, ty=inp.tapY, u=UNIT;

  // Character tabs
  const tabW = W/CHARS.length;
  if(ty > u*2.3 && ty < u*3.3){
    const idx = Math.floor(tx/tabW);
    if(idx >= 0 && idx < CHARS.length){ G.skinCharIdx = idx; sfxUITap(); return; }
  }

  // Skin cards
  const selCharIdx = G.skinCharIdx || 0;
  const ch = CHARS[selCharIdx];
  const skins = getCharSkins(ch.id);
  const charLocked = !save.unlockedChars.includes(selCharIdx);
  const cardW = W*.42, cardH = u*4.5, gapX = (W - cardW*2)/3, gapY = u*.5;
  const startY = u*3.8;

  if(!charLocked){
    for(let i=0;i<skins.length;i++){
      const sk = skins[i];
      const row = Math.floor(i/2), col = i%2;
      const cx = gapX + (cardW+gapX)*col + cardW/2;
      const cy = startY + row*(cardH+gapY) + cardH/2;
      const rx = cx-cardW/2, ry = cy-cardH/2;

      if(tx>rx&&tx<rx+cardW&&ty>ry&&ty<ry+cardH){
        const owned = sk.cost===0 || ownsSkin(sk.id);
        const active = save.activeSkins[ch.id]===sk.id || (sk.cost===0 && !save.activeSkins[ch.id]);
        if(active){ sfxUITap(); return; } // already equipped
        if(owned){ equipSkin(sk.id, ch.id); sfxUITap(); return; }
        if(save.totalGems >= sk.cost){
          buySkin(sk.id, ch.id); sfxUITap(); return;
        }
        return;
      }
    }
  }

  // Back button
  const btnW=u*4, btnH=u*1.2, btnY=H-SAFE_BOTTOM-u*1.8;
  if(tx>W/2-btnW/2&&tx<W/2+btnW/2&&ty>btnY&&ty<btnY+btnH){
    transitionTo('CHAR_SELECT'); sfxUITap();
  }
}

// ============================================================
// CONTINUE PROMPT SCREEN
// ============================================================
function getContinuePromptLayout() {
  const u = UNIT;
  const panelW = Math.min(W * 0.78, u * 10.8);
  const panelH = u * 7.25;
  const panelX = W / 2 - panelW / 2;
  const panelY = Math.max(SAFE_TOP + u * 0.7, H * 0.11);
  const innerPad = u * 0.58;
  const primaryW = panelW - innerPad * 2;
  const primaryH = u * 1.22;
  const primaryX = panelX + innerPad;
  const primaryY = panelY + panelH - u * 2.2;
  const secondaryW = u * 4.6;
  const secondaryH = u * 0.9;
  const secondaryX = W / 2 - secondaryW / 2;
  const secondaryY = panelY + panelH - u * 0.9;
  return {
    panelX, panelY, panelW, panelH, innerPad,
    primaryX, primaryY, primaryW, primaryH,
    secondaryX, secondaryY, secondaryW, secondaryH
  };
}

function getContinuePromptViewModel() {
  const guide = G.onboarding && G.onboarding.level === G.levelNum ? G.onboarding : null;
  const pending = getGuidedPendingStep();
  const guided = !!(guide && pending);
  return {
    guided,
    title: guided ? 'SAVE THE LESSON' : 'KEEP THE RUN?',
    subtitle: guided
      ? `${guide.title.toUpperCase()} STILL NEEDS ${pending.label.toUpperCase()}.`
      : 'Spend one save to restart this level with your score and gems intact.',
    note: guided
      ? pending.remind
      : 'You restart the level clean, but your run score, gems, and upgrades stay with you.',
    lessonChip: guided ? `NEXT: ${pending.label.toUpperCase()}` : `${Math.max(0, G.continuesLeft)} SAVE${G.continuesLeft === 1 ? '' : 'S'} AVAILABLE`,
    primaryLabel: guided ? 'RETRY LESSON' : 'CONTINUE RUN',
    primarySub: guided ? guide.title.toUpperCase() : 'KEEP SCORE + GEMS',
    secondaryLabel: guided ? 'END RUN' : 'GIVE UP'
  };
}

function drawContinuePrompt(dt){
  G.continuePromptTimer+=dt;
  const u = UNIT;
  const layout = getContinuePromptLayout();
  const vm = getContinuePromptViewModel();
  const pulse = 1 + Math.sin(G.continuePromptTimer * 5) * 0.035;

  drawMetaBackdrop(G.theme || THEMES.JUNGLE, '#DA9A49');
  ctx.fillStyle='rgba(6,8,14,0.56)';ctx.fillRect(0,0,W,H);
  drawPanel(layout.panelX, layout.panelY, layout.panelW, layout.panelH, {
    radius: u * 0.5,
    top: 'rgba(28,26,18,0.94)',
    bottom: 'rgba(12,12,10,0.92)',
    stroke: 'rgba(255,222,148,0.16)',
    accent: 'rgba(255,187,84,0.24)',
    blur: 22
  });

  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.font = FONTS['b1.18'] || ('bold ' + Math.round(u * 1.18) + 'px monospace');
  ctx.fillStyle = '#FFD46C';
  ctx.fillText(vm.title, W / 2, layout.panelY + u * 0.88);
  ctx.font = FONTS['n0.36'] || (Math.round(u * 0.36) + 'px monospace');
  ctx.fillStyle = 'rgba(235,240,250,0.74)';
  ctx.fillText(vm.subtitle, W / 2, layout.panelY + u * 1.55, layout.panelW - layout.innerPad * 2);

  const statW = (layout.panelW - layout.innerPad * 2 - u * 0.24 * 2) / 3;
  const statY = layout.panelY + u * 2.1;
  drawMiniChip(layout.panelX + layout.innerPad, statY, statW, u * 0.74, `LEVEL ${G.levelNum}`, {
    font: FONTS['b0.32'] || ('bold ' + Math.round(u * 0.32) + 'px monospace'),
    accent: 'rgba(120,188,255,0.22)'
  });
  drawMiniChip(layout.panelX + layout.innerPad + statW + u * 0.24, statY, statW, u * 0.74, `${G.runScore} SCORE`, {
    font: FONTS['b0.32'] || ('bold ' + Math.round(u * 0.32) + 'px monospace'),
    accent: 'rgba(255,215,90,0.2)'
  });
  drawMiniChip(layout.panelX + layout.panelW - layout.innerPad - statW, statY, statW, u * 0.74, `${Math.max(0, G.continuesLeft - 1)} AFTER USE`, {
    font: FONTS['b0.3'] || ('bold ' + Math.round(u * 0.3) + 'px monospace'),
    accent: 'rgba(255,143,112,0.22)',
    textColor: '#FFD9C9'
  });

  drawMiniChip(layout.panelX + layout.innerPad, layout.panelY + u * 3.12, layout.panelW - layout.innerPad * 2, u * 0.68, vm.lessonChip, {
    font: FONTS['b0.33'] || ('bold ' + Math.round(u * 0.33) + 'px monospace'),
    accent: vm.guided ? 'rgba(127,255,212,0.2)' : 'rgba(255,255,255,0.12)',
    textColor: vm.guided ? '#E8FFF5' : 'rgba(245,247,255,0.8)'
  });

  ctx.font = FONTS['n0.31'] || (Math.round(u * 0.31) + 'px monospace');
  ctx.fillStyle = 'rgba(210,220,236,0.68)';
  ctx.fillText(vm.note, W / 2, layout.panelY + u * 4.1, layout.panelW - layout.innerPad * 2);

  ctx.save();
  ctx.translate(layout.primaryX + layout.primaryW / 2, layout.primaryY + layout.primaryH / 2);
  ctx.scale(pulse, pulse);
  drawActionCard(-layout.primaryW / 2, -layout.primaryH / 2, layout.primaryW, layout.primaryH, vm.primaryLabel, vm.primarySub, {
    top: '#2F7A48',
    bottom: '#184327',
    stroke: '#76DEA0',
    accent: '#4ED37D',
    labelColor: '#F7FFF8',
    subColor: 'rgba(214,255,226,0.8)'
  });
  ctx.restore();

  drawActionCard(layout.secondaryX, layout.secondaryY, layout.secondaryW, layout.secondaryH, vm.secondaryLabel, null, {
    top: 'rgba(122,44,52,0.96)',
    bottom: 'rgba(66,20,28,0.92)',
    stroke: 'rgba(255,170,170,0.3)',
    accent: '#D85A66',
    labelColor: '#FFF5F6',
    labelFont: FONTS['b0.42'] || ('bold ' + Math.round(u * 0.42) + 'px monospace')
  });
}
function handleContinueTap(){
  const tx=inp.tapX, ty=inp.tapY;
  const layout = getContinuePromptLayout();
  if(tx>layout.primaryX&&tx<layout.primaryX+layout.primaryW&&ty>layout.primaryY&&ty<layout.primaryY+layout.primaryH){
    G.continuesLeft--;
    trackRetry('continue_prompt');
    // Revive: restart current level but keep score/gems
    G.phase='LEVEL_INTRO'; G.introTimer=0;
    G.time=0; G.timeLeft=28; G.deathDelay=0;
    G.diff=getDiff(0,getLevelOpeningMultiplier(G.levelDef));
    G.speed=G.diff.speed*CHARS[G.selectedChar].spdM;
    G.rng=new RNG(Date.now()^(Math.random()*0x7FFFFFFF|0));
    G.announce=null; G.flashColor=null; G.flashLife=0;
    inp.jp=inp.jh=false; inp.tapped=false;
    particles.length=0; activeEnemies.length=0; ambients.length=0;
    trauma=0; enemySpawnCD=getLevelEnemyDelay(G.levelDef);
    initWorld(G.rng,G.diff,G.levelDef.theme);
    G.player=new Player(G.selectedChar);
    checkGemUpgrades(true);
    // Apply wheel powerup if any
    if(G.wheelResult) applyWheelPowerup(G.wheelResult);
    initBg();
    return;
  }
  if(tx>layout.secondaryX&&tx<layout.secondaryX+layout.secondaryW&&ty>layout.secondaryY&&ty<layout.secondaryY+layout.secondaryH){
    adDeathCount++; G.phase='DEAD';
  }
}

// ============================================================
// SPIN WHEEL
// ============================================================
const WHEEL_SEGMENTS = [
  { label:'Shield',      color:'#2288CC', type:'SHIELD' },
  { label:'Speed Boost',  color:'#CC8822', type:'SPEED' },
  { label:'Magnet',       color:'#CC22AA', type:'MAGNET' },
  { label:'Extra Life',   color:'#22CC44', type:'EXTRA_LIFE' },
  { label:'Star Power',   color:'#CCCC22', type:'STAR' },
  { label:'+10s Time',    color:'#2222CC', type:'TIME' },
  { label:'Double Score', color:'#CC4422', type:'DOUBLE' },
  { label:'Tiny Hitbox',  color:'#22CCAA', type:'TINY' },
];

function applyWheelPowerup(type) {
  const p = G.player;
  if (!p) return;
  var _pName = '', _pColor = '#FFD700';
  switch(type) {
    case 'SHIELD': p.shield=true; _pName='SHIELD ACTIVATED'; _pColor='#44AAFF'; break;
    case 'SPEED': p.speedBoost=true; _pName='SPEED BOOST!'; _pColor='#FF8800'; break;
    case 'MAGNET': p.magnetTimer=999; _pName='GEM MAGNET!'; _pColor='#CC44FF'; break;
    case 'EXTRA_LIFE': p.extraLife=true; _pName='EXTRA LIFE!'; _pColor='#44FF66'; break;
    case 'STAR': p.starTimer=12; p.starHue=0; _pName='STAR POWER!'; _pColor='#FFD700'; break;
    case 'TIME': G.timeLeft=Math.min(G.timeLeft+10,99); _pName='+10 SECONDS!'; _pColor='#4488FF'; break;
    case 'DOUBLE': p.doubleScore=true; _pName='DOUBLE SCORE!'; _pColor='#FF4466'; break;
    case 'TINY': p.tinyTimer=30; _pName='TINY HITBOX!'; _pColor='#00FFCC'; break;
  }
  if (_pName && G.phase === 'PLAYING') showAnnouncement(_pName, _pColor);
}

function drawSpinWheel(dt) {
  G.wheelTimer+=dt;
  const u=UNIT;
  drawBg(G.theme);
  ctx.save();ctx.translate(shX,shY);
  drawObstacles(G.theme);drawGems(G.theme);
  if(G.player)drawChar(G.player,false);
  drawPteros(G.theme);ctx.restore();
  drawParticles();
  for(let i=particles.length-1;i>=0;i--){particles[i].update(dt);if(!particles[i].alive){if(_particlePool.length<_particlePoolMax)_particlePool.push(particles[i]);particles.splice(i,1);}}

  ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.textBaseline='middle';

  ctx.shadowColor='#FFD700';ctx.shadowBlur=15;
  ctx.font=`bold ${u*1.5}px monospace`;ctx.fillStyle='#FFD700';
  ctx.fillText('SPIN FOR A POWERUP!',W/2,H*.08);ctx.shadowBlur=0;

  // Wheel
  const cx=W/2, cy=H*.48, r=Math.min(W*.3, H*.32);
  const segCount=WHEEL_SEGMENTS.length;
  const segAngle=PI2/segCount;

  // Spin physics
  if (G.wheelSpinning) {
    const prevSeg = Math.floor((((-Math.PI/2 - G.wheelAngle) % PI2 + PI2) % PI2) / segAngle);
    G.wheelAngle+=G.wheelSpeed*dt;
    const curSeg = Math.floor((((-Math.PI/2 - G.wheelAngle) % PI2 + PI2) % PI2) / segAngle);
    if(prevSeg !== curSeg) sfxSpin();
    G.wheelSpeed*=Math.pow(0.97,60*dt); // friction
    if (G.wheelSpeed < 0.15) {
      G.wheelSpinning=false;
      // Pointer is at top (-PI/2). Find which segment it points to.
      const pointerAngle = -Math.PI/2;
      const normAngle = (((pointerAngle - G.wheelAngle) % PI2) + PI2) % PI2;
      const idx = Math.floor(normAngle / segAngle) % segCount;
      G.wheelResult = WHEEL_SEGMENTS[idx].type;
      G.wheelTimer=0;
    }
  }

  // Draw segments
  for(let i=0;i<segCount;i++){
    const startA=G.wheelAngle+i*segAngle;
    ctx.fillStyle=WHEEL_SEGMENTS[i].color;
    ctx.beginPath();ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,startA,startA+segAngle);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=2;ctx.stroke();
    // Label
    ctx.save();ctx.translate(cx,cy);ctx.rotate(startA+segAngle/2);
    ctx.font=`bold ${u*.5}px monospace`;ctx.fillStyle='white';ctx.textAlign='center';
    ctx.fillText(WHEEL_SEGMENTS[i].label,r*.6,0);
    ctx.restore();
  }
  // Center circle
  ctx.fillStyle='#222';ctx.beginPath();ctx.arc(cx,cy,r*.12,0,PI2);ctx.fill();
  ctx.strokeStyle='#FFD700';ctx.lineWidth=3;ctx.stroke();
  // Pointer (top, pointing DOWN into wheel)
  ctx.fillStyle='#FF4444';ctx.beginPath();
  ctx.moveTo(cx,cy-r+u*.4);ctx.lineTo(cx-u*.35,cy-r-u*.3);ctx.lineTo(cx+u*.35,cy-r-u*.3);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#CC0000';ctx.lineWidth=2;ctx.stroke();

  // Tap to spin or result
  if (!G.wheelSpinning && !G.wheelResult) {
    if(Math.sin(Date.now()*.005)>0){
      ctx.font=`bold ${u*1}px monospace`;ctx.fillStyle='white';
      ctx.fillText('TAP TO SPIN!',W/2,H*.85);
    }
  } else if (G.wheelResult && !G.wheelSpinning) {
    // Show result
    const seg = WHEEL_SEGMENTS.find(s=>s.type===G.wheelResult);
    const rPulse=1+Math.sin(G.wheelTimer*6)*.08;
    ctx.save();ctx.translate(W/2,H*.82);ctx.scale(rPulse,rPulse);
    ctx.font=`bold ${u*1.1}px monospace`;ctx.fillStyle='#FFD700';
    ctx.fillText(seg?seg.label:'???',0,0);ctx.restore();
    if(G.wheelTimer>1.5 && Math.sin(Date.now()*.005)>0){
      ctx.font=`bold ${u*.8}px monospace`;ctx.fillStyle='white';
      ctx.fillText('TAP TO CONTINUE',W/2,H*.93);
    }
  }
}

function handleSpinWheelTap() {
  if (!G.wheelSpinning && !G.wheelResult) {
    // Start spinning
    G.wheelSpinning=true;
    G.wheelSpeed=12+Math.random()*8; // random initial speed
    sfxUITap();
  } else if (G.wheelResult && !G.wheelSpinning && G.wheelTimer>1.5) {
    // Save wheel result for next level, go to level map
    G._pendingWheelResult = G.wheelResult;
    G._nextLevelNum = G.levelNum + 1;
    // Persist to save so it survives app close
    if (!save.nextRunPowerups.includes(G.wheelResult)) {
      save.nextRunPowerups.push(G.wheelResult);
      persistSave();
    }
    G.phase = 'LEVEL_MAP';
    // Scroll to the next level node
    const u = UNIT;
    G.mapTargetScrollY = Math.max(0, G._nextLevelNum * u * 4 - H/2);
    G.mapScrollY = G.mapTargetScrollY;
  }
}

// ============================================================
// DAILY REWARD SYSTEM
// ============================================================
// ============================================================
// SEASONAL EVENTS
// ============================================================
// Disabled for the current cleanup build.
function getActiveEvent() { return null; }
let _activeEvent = null;
function checkSeasonalEvent() {
  _activeEvent = null;
  return null;
}

// 7-Day Login Calendar with escalating rewards
const DAILY_CALENDAR = [
  { day:1, type:'GEMS_5',    label:'+5 Gems',       icon:'💎', color:'#44AAFF' },
  { day:2, type:'SHIELD',    label:'Free Shield',   icon:'🛡️', color:'#88CCFF' },
  { day:3, type:'GEMS_10',   label:'+10 Gems',      icon:'💎', color:'#4488FF' },
  { day:4, type:'SPEED',     label:'Speed Boost',   icon:'⚡', color:'#FFAA22' },
  { day:5, type:'GEMS_15',   label:'+15 Gems',      icon:'💎', color:'#FFD700' },
  { day:6, type:'MAGNET',    label:'Gem Magnet',    icon:'🧲', color:'#CC22AA' },
  { day:7, type:'SKIN',      label:'Exclusive Skin', icon:'⭐', color:'#FF4488' },
];

function localDateStr(d) {
  // Use local timezone instead of UTC for daily reward tracking
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function getCalendarWeekStart() {
  // Returns the Monday of the current week as YYYY-MM-DD
  const d = new Date(); const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1); return localDateStr(d);
}
function checkDailyReward() {
  const today = localDateStr(new Date());
  if (save.lastLoginDate === today) return false;
  // Check streak
  const yd = new Date(); yd.setDate(yd.getDate()-1);
  const yesterday = localDateStr(yd);
  if (save.lastLoginDate === yesterday) save.dailyStreak++;
  else save.dailyStreak = 1;
  // Reset calendar if new week
  const weekStart = getCalendarWeekStart();
  if (save.calendarWeekStart !== weekStart) {
    save.calendarWeekStart = weekStart;
    save.calendarClaimed = [];
  }
  save.lastLoginDate = today;
  persistSave();
  // Determine current calendar day (1-7)
  const calDay = Math.min(save.dailyStreak, 7);
  const reward = DAILY_CALENDAR[calDay - 1];
  G.dailyRewardType = reward;
  G.dailyCalendarDay = calDay;
  G.dailyRewardTimer = 0;
  G.dailyRewardClaimed = false;
  return true;
}

function applyDailyReward(reward) {
  switch(reward.type) {
    case 'GEMS_5':  save.totalGems+=5; break;
    case 'GEMS_10': save.totalGems+=10; break;
    case 'GEMS_15': save.totalGems+=15; break;
    case 'SKIN':
      if (!save.ownedSkins) save.ownedSkins = [];
      if (!save.ownedSkins.includes('gronk_streak')) {
        save.ownedSkins.push('gronk_streak');
        save.activeSkins['gronk'] = 'gronk_streak';
      }
      break;
    case 'SHIELD': case 'EXTRA_LIFE': case 'SPEED': case 'MAGNET': case 'TIME_10': case 'STAR':
      save.dailyPowerup = reward.type; break;
  }
  // Mark day as claimed in calendar
  if (!save.calendarClaimed) save.calendarClaimed = [];
  const dayIdx = (G.dailyCalendarDay || 1) - 1;
  if (!save.calendarClaimed.includes(dayIdx)) save.calendarClaimed.push(dayIdx);
  persistSave();
}

function getDailyRewardSummary(reward) {
  if (!reward) return '';
  switch (reward.type) {
    case 'SHIELD': return 'Starts the next run with one shield already active.';
    case 'SPEED': return 'Queues a speed boost for the next level.';
    case 'MAGNET': return 'Queues a gem magnet for the next level.';
    case 'SKIN': return 'Unlocks the exclusive streak skin and equips it.';
    default:
      if (reward.type.indexOf('GEMS_') === 0) return 'Instantly adds gems to the long-term balance.';
      return 'Added to the next run automatically.';
  }
}

function drawDailyReward(dt) {
  G.dailyRewardTimer += dt;
  const u = UNIT, t = G.dailyRewardTimer;
  // Dark background
  ctx.fillStyle = '#0a1628'; ctx.fillRect(0,0,W,H);
  // Sparkle particles
  for(let i=0;i<25;i++){
    const px = W*(0.05+((i*137.5+t*40)%W)/W*0.9);
    const py = H*(0.05+((i*73.3+t*25)%H)/H*0.9);
    const bri = 0.2+Math.sin(t*3+i)*0.25;
    ctx.fillStyle = 'rgba(255,215,0,'+bri+')';
    ctx.beginPath(); ctx.arc(px,py,2+Math.sin(t*2+i*.5)*1.5,0,PI2); ctx.fill();
  }
  ctx.textAlign='center'; ctx.textBaseline='middle';

  // Title with scale-in
  const titleScale = Math.min(1, t*2);
  ctx.save(); ctx.translate(W/2, H*.07); ctx.scale(titleScale, titleScale);
  ctx.shadowColor='#FFD700'; ctx.shadowBlur=20;
  ctx.font='bold '+Math.round(u*1.5)+'px monospace'; ctx.fillStyle='#FFD700';
  ctx.fillText('DAILY LOGIN', 0, 0); ctx.shadowBlur=0; ctx.restore();

  // Streak display
  ctx.font=Math.round(u*.6)+'px monospace'; ctx.fillStyle='#FFAA44';
  ctx.fillText('Day '+save.dailyStreak+' streak!', W/2, H*.13);

  // === 7-Day Calendar Grid ===  
  const calDay = G.dailyCalendarDay || 1;
  const claimed = save.calendarClaimed || [];
  const gridW = Math.min(W*0.92, u*14);
  const cellSize = gridW / 4;
  const gridX = W/2 - gridW/2;
  var gy = H*0.18;
  // Draw 7 cells (4 on top row, 3 on bottom, day 7 big)
  for (var di=0; di<7; di++) {
    const cal = DAILY_CALENDAR[di];
    const isClaimed = claimed.includes(di);
    const isToday = (di === calDay - 1) && !G.dailyRewardClaimed;
    const isFuture = di >= calDay;
    const isDay7 = (di === 6);
    var cx, cy, cw, ch;
    if (di < 4) {
      cx = gridX + di * cellSize; cy = gy; cw = cellSize - u*0.15; ch = cellSize * 1.1;
    } else if (di < 6) {
      cx = gridX + (di-4) * cellSize; cy = gy + cellSize * 1.2; cw = cellSize - u*0.15; ch = cellSize * 1.1;
    } else {
      // Day 7 — wider special cell
      cx = gridX + 2 * cellSize; cy = gy + cellSize * 1.2; cw = cellSize * 2 - u*0.15; ch = cellSize * 1.1;
    }
    // Cell background
    var bgCol, borderCol;
    if (isClaimed) { bgCol='rgba(40,100,40,0.6)'; borderCol='rgba(100,220,100,0.5)'; }
    else if (isToday) {
      const glow = 0.5+Math.sin(t*4)*0.2;
      bgCol='rgba(255,215,0,'+glow*0.3+')'; borderCol='rgba(255,215,0,'+glow+')';
    }
    else if (isFuture) { bgCol='rgba(30,40,60,0.5)'; borderCol='rgba(80,90,110,0.3)'; }
    else { bgCol='rgba(20,30,50,0.6)'; borderCol='rgba(100,100,120,0.3)'; }
    if (isDay7 && !isClaimed) { borderCol = 'rgba(255,68,136,'+(0.5+Math.sin(t*3)*0.3)+')'; }
    fillRR(cx, cy, cw, ch, u*0.2, bgCol, borderCol, isToday?2:1);

    // Day number
    ctx.font='bold '+Math.round(u*0.35)+'px monospace';
    ctx.fillStyle = isClaimed?'rgba(100,220,100,0.8)':isToday?'#FFD700':isFuture?'rgba(120,130,150,0.5)':'rgba(200,200,220,0.6)';
    ctx.fillText('Day '+(di+1), cx+cw/2, cy+u*0.3);

    // Icon
    var iconSize = isDay7 ? u*1.2 : u*0.9;
    if (isToday && !isClaimed) iconSize *= 1+Math.sin(t*3)*0.08;
    ctx.font = Math.round(iconSize)+'px sans-serif';
    ctx.fillStyle = isFuture && !isClaimed ? 'rgba(255,255,255,0.3)' : '#FFF';
    if (isClaimed) {
      ctx.font = 'bold '+Math.round(u*0.9)+'px monospace'; ctx.fillStyle='#4caf50';
      ctx.fillText('\u2713', cx+cw/2, cy+ch*0.5);
    } else {
      ctx.fillText(cal.icon, cx+cw/2, cy+ch*0.5);
    }

    // Reward label
    ctx.font = Math.round(u*0.28)+'px monospace';
    ctx.fillStyle = isClaimed?'rgba(100,200,100,0.5)':isToday?cal.color:isFuture?'rgba(150,150,170,0.4)':'rgba(200,200,220,0.5)';
    ctx.fillText(cal.label, cx+cw/2, cy+ch-u*0.2);
  }

  // Today's reward highlight section
  const reward = G.dailyRewardType;
  if (!reward) return;
  const boxY = gy + cellSize*2.5;
  const revealT = clamp((t-0.3)*2, 0, 1);
  if (revealT > 0) {
    const boxW = u*10, boxH = u*3;
    const bx = W/2-boxW/2;
    ctx.shadowColor = reward.color; ctx.shadowBlur = 20*revealT;
    fillRR(bx, boxY, boxW, boxH, u*0.3, 'rgba(20,30,50,0.85)', reward.color, 2);
    ctx.shadowBlur=0;
    // Icon bouncing
    const iconB = Math.sin(t*3)*u*.15;
    ctx.font = Math.round(u*2)+'px sans-serif';
    ctx.fillText(reward.icon, W/2 - u*2.5, boxY+boxH/2+iconB);
    // Label
    ctx.font = 'bold '+Math.round(u*.8)+'px monospace'; ctx.fillStyle = reward.color;
    ctx.fillText(reward.label, W/2 + u*0.8, boxY+boxH*0.4);
    ctx.font = Math.round(u*.4)+'px monospace'; ctx.fillStyle='rgba(255,255,255,0.6)';
    ctx.fillText("Today's reward", W/2 + u*0.8, boxY+boxH*0.7);
  }

  // Claim button
  if (t > 0.8 && !G.dailyRewardClaimed) {
    const pulse = 1+Math.sin(t*5)*.05;
    const btnW=u*7, btnH=u*1.3;
    const btnY = boxY + u*3.5;
    ctx.save(); ctx.translate(W/2, btnY+btnH/2); ctx.scale(pulse,pulse);
    fillRR(-btnW/2,-btnH/2,btnW,btnH,u*0.3,'#22AA44','#44DD66',2);
    ctx.font='bold '+Math.round(u*.9)+'px monospace'; ctx.fillStyle='white';
    ctx.fillText('CLAIM DAY '+(G.dailyCalendarDay||1)+'!', 0, 0); ctx.restore();
    G._claimBtnY = btnY;
  }

  // Already claimed — continue
  if (G.dailyRewardClaimed && t > 0.5) {
    ctx.font='bold '+Math.round(u*.7)+'px monospace'; ctx.fillStyle='rgba(255,255,255,0.7)';
    ctx.fillText('Reward claimed! Tap to continue', W/2, H*.92);
  }
}

function handleDailyRewardTap() {
  const u=UNIT, tx=inp.tapX, ty=inp.tapY;
  if (!G.dailyRewardClaimed && G.dailyRewardTimer > 0.8) {
    const btnW=u*7, btnH=u*1.3;
    const btnY = G._claimBtnY || H*.78;
    if (tx>W/2-btnW/2 && tx<W/2+btnW/2 && ty>btnY && ty<btnY+btnH) {
      G.dailyRewardClaimed = true;
      applyDailyReward(G.dailyRewardType);
      G.dailyRewardTimer = 0;
      sfxGem();
      return;
    }
  }
  if (G.dailyRewardClaimed && G.dailyRewardTimer > 0.5) {
    transitionTo('LEVEL_MAP');
  }
}

// Refined daily reward presentation for launch polish.
function drawDailyReward(dt) {
  G.dailyRewardTimer += dt;
  const u = UNIT, t = G.dailyRewardTimer;
  const calDay = G.dailyCalendarDay || 1;
  const claimed = save.calendarClaimed || [];
  const reward = G.dailyRewardType;
  const layout = drawMetaScreenScaffold({
    theme: THEMES.SKY,
    accent: reward ? reward.color : 'rgba(255,208,90,0.2)',
    title: 'DAILY LOGIN',
    subtitle: 'A quick reward touchpoint that should feel premium without slowing players down.',
    leftChip: {
      label: `STREAK ${save.dailyStreak || 1}`,
      w: u * 3.8,
      accent: 'rgba(255,164,76,0.22)',
      textColor: '#FFF0CB'
    },
    rightChip: {
      label: G.dailyRewardClaimed ? 'CLAIMED' : `DAY ${calDay}/7`,
      w: u * 3.9,
      accent: G.dailyRewardClaimed ? 'rgba(110,210,130,0.22)' : 'rgba(120,188,255,0.2)',
      textColor: G.dailyRewardClaimed ? '#EAFFF0' : '#DCEEFF'
    }
  });
  const bodyX = layout.bodyX;
  const bodyY = layout.bodyY;
  const bodyW = layout.bodyW;
  const bodyH = layout.bodyH;
  const pad = u * 0.28;
  const gridX = bodyX + pad;
  const gridY = bodyY + pad;
  const gridW = bodyW - pad * 2;
  const cellGap = u * 0.14;
  const cellW = (gridW - cellGap * 3) / 4;
  const cellH = u * 1.08;
  const rowGap = u * 0.18;
  const detailY = gridY + cellH * 2 + rowGap + u * 0.34;
  const detailH = bodyY + bodyH - detailY - u * 0.24;

  for (let i = 0; i < 18; i++) {
    const px = bodyX + ((i * 91.7 + t * 52) % bodyW);
    const py = bodyY + ((i * 47.1 + t * 31) % bodyH);
    const alpha = 0.07 + (Math.sin(t * 3 + i * 0.8) + 1) * 0.04;
    ctx.fillStyle = `rgba(255,220,120,${alpha})`;
    ctx.beginPath();
    ctx.arc(px, py, 1.5 + Math.sin(t * 2 + i) * 0.9, 0, PI2);
    ctx.fill();
  }

  drawPanel(bodyX, bodyY, bodyW, bodyH, {
    radius: u * 0.44,
    top: 'rgba(18,28,46,0.94)',
    bottom: 'rgba(8,12,24,0.9)',
    stroke: 'rgba(255,255,255,0.1)',
    accent: reward ? reward.color : 'rgba(255,208,90,0.14)',
    blur: 20
  });

  for (let di = 0; di < 7; di++) {
    const cal = DAILY_CALENDAR[di];
    const isClaimed = claimed.includes(di);
    const isToday = (di === calDay - 1) && !G.dailyRewardClaimed;
    const isFuture = di >= calDay;
    const isDay7 = di === 6;
    let cx, cy, cw, ch;
    if (di < 4) {
      cx = gridX + di * (cellW + cellGap); cy = gridY; cw = cellW; ch = cellH;
    } else if (di < 6) {
      cx = gridX + (di - 4) * (cellW + cellGap); cy = gridY + cellH + rowGap; cw = cellW; ch = cellH;
    } else {
      cx = gridX + 2 * (cellW + cellGap); cy = gridY + cellH + rowGap; cw = cellW * 2 + cellGap; ch = cellH;
    }
    let bgCol, borderCol, accentCol;
    if (isClaimed) {
      bgCol = 'rgba(20,38,26,0.96)';
      borderCol = 'rgba(110,210,130,0.22)';
      accentCol = 'rgba(110,210,130,0.18)';
    } else if (isToday) {
      const glow = 0.5 + Math.sin(t * 4) * 0.2;
      bgCol = 'rgba(46,34,12,' + (0.72 + glow * 0.1) + ')';
      borderCol = 'rgba(255,215,0,' + glow + ')';
      accentCol = 'rgba(255,215,0,' + (0.18 + glow * 0.1) + ')';
    } else if (isFuture) {
      bgCol = 'rgba(18,24,38,0.92)';
      borderCol = 'rgba(80,90,110,0.28)';
      accentCol = 'rgba(90,110,150,0.08)';
    } else {
      bgCol = 'rgba(16,22,36,0.94)';
      borderCol = 'rgba(110,120,150,0.16)';
      accentCol = 'rgba(90,110,150,0.08)';
    }
    if (isDay7 && !isClaimed) borderCol = 'rgba(255,68,136,' + (0.44 + Math.sin(t * 3) * 0.2) + ')';
    drawPanel(cx, cy, cw, ch, {
      radius: u * 0.22,
      top: bgCol,
      bottom: bgCol,
      stroke: borderCol,
      accent: accentCol,
      blur: isToday ? 12 : 6,
      glossAlpha: 0.1
    });

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold ' + Math.round(u * 0.3) + 'px monospace';
    ctx.fillStyle = isClaimed ? 'rgba(100,220,100,0.8)' : isToday ? '#FFD700' : isFuture ? 'rgba(120,130,150,0.5)' : 'rgba(200,200,220,0.6)';
    ctx.fillText('DAY ' + (di + 1), cx + cw / 2, cy + u * 0.24);

    let iconSize = isDay7 ? u * 0.9 : u * 0.72;
    if (isToday && !isClaimed) iconSize *= 1 + Math.sin(t * 3) * 0.06;
    ctx.font = Math.round(iconSize) + 'px sans-serif';
    ctx.fillStyle = isFuture && !isClaimed ? 'rgba(255,255,255,0.3)' : '#FFF';
    if (isClaimed) {
      ctx.font = 'bold ' + Math.round(u * 0.7) + 'px monospace';
      ctx.fillStyle = '#4caf50';
      ctx.fillText('\u2713', cx + cw / 2, cy + ch * 0.5);
    } else {
      ctx.fillText(cal.icon, cx + cw / 2, cy + ch * 0.48);
    }

    ctx.font = Math.round(u * 0.22) + 'px monospace';
    ctx.fillStyle = isClaimed ? 'rgba(100,200,100,0.5)' : isToday ? cal.color : isFuture ? 'rgba(150,150,170,0.4)' : 'rgba(200,200,220,0.5)';
    drawTextBlock(cal.label, cx + cw / 2, cy + ch - u * 0.36, cw - u * 0.18, u * 0.2, { align: 'center' });
  }

  if (!reward) return;

  drawPanel(bodyX + pad, detailY, bodyW - pad * 2, detailH, {
    radius: u * 0.32,
    top: 'rgba(20,28,42,0.94)',
    bottom: 'rgba(10,14,24,0.9)',
    stroke: 'rgba(255,255,255,0.08)',
    accent: reward.color,
    blur: 10
  });
  drawMiniChip(bodyX + pad + u * 0.22, detailY + u * 0.18, u * 3.5, u * 0.48, 'TODAY', {
    font: FONTS['b0.26'] || ('bold ' + Math.round(u * 0.26) + 'px monospace'),
    accent: reward.color,
    textColor: '#F9FCFF'
  });
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = Math.round(u * 1.05) + 'px sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(reward.icon, bodyX + pad + u * 0.42, detailY + u * 0.82 + Math.sin(t * 3) * u * 0.04);
  ctx.font = FONTS['b0.56'] || ('bold ' + Math.round(u * 0.56) + 'px monospace');
  ctx.fillStyle = reward.color;
  ctx.fillText(reward.label.toUpperCase(), bodyX + pad + u * 1.62, detailY + u * 0.74);
  ctx.font = FONTS['n0.3'] || (Math.round(u * 0.3) + 'px monospace');
  ctx.fillStyle = 'rgba(210,222,240,0.7)';
  drawTextBlock(getDailyRewardSummary(reward), bodyX + pad + u * 1.62, detailY + u * 1.22, bodyW - pad * 2 - u * 1.96, u * 0.3, { align: 'left' });

  G._dailyRewardBtn = drawMetaFooterButton(layout, G.dailyRewardClaimed ? 'CONTINUE' : 'CLAIM REWARD', G.dailyRewardClaimed ? 'Back to the map' : `Day ${calDay} bonus`, {
    top: G.dailyRewardClaimed ? 'rgba(22,44,30,0.96)' : 'rgba(42,36,14,0.96)',
    bottom: G.dailyRewardClaimed ? 'rgba(10,20,16,0.94)' : 'rgba(24,18,8,0.94)',
    stroke: G.dailyRewardClaimed ? 'rgba(110,210,130,0.22)' : 'rgba(255,215,90,0.22)',
    accent: reward.color,
    labelColor: G.dailyRewardClaimed ? '#EAFFF0' : '#FFF4C8'
  });
}

function handleDailyRewardTap() {
  const tx = inp.tapX, ty = inp.tapY;
  const btn = G._dailyRewardBtn;
  if (!btn) return;
  if (tx >= btn.x && tx <= btn.x + btn.w && ty >= btn.y && ty <= btn.y + btn.h) {
    if (!G.dailyRewardClaimed) {
      G.dailyRewardClaimed = true;
      applyDailyReward(G.dailyRewardType);
      G.dailyRewardTimer = 0;
      sfxGem();
      showAnnouncement('LOGIN REWARD CLAIMED', '#FFD700');
    } else {
      transitionTo('LEVEL_MAP');
    }
  }
}

// ============================================================
// LEVEL MAP SCREEN (Candy Crush style)
// ============================================================
function drawLevelMap(dt) {
  const u = UNIT;
  // Rich gradient background
  var lmGrad = ctx.createLinearGradient(0,0,0,H);
  lmGrad.addColorStop(0,'#050d1e');lmGrad.addColorStop(0.3,'#0a1628');lmGrad.addColorStop(0.7,'#101830');lmGrad.addColorStop(1,'#0a0f20');
  ctx.fillStyle=lmGrad; ctx.fillRect(0,0,W,H);
  // Nebula effect
  if (_perfLevel > 0) {
    ctx.save();ctx.globalCompositeOperation='lighter';
    var nt = (G.time||Date.now()*.001)*0.3;
    for(var ni=0;ni<3;ni++){
      var nnx = W*(0.3+ni*0.2) + Math.sin(nt+ni*2.1)*W*0.15;
      var nny = H*(0.2+ni*0.15) + Math.cos(nt*0.7+ni*1.3)*H*0.1;
      var nGrad = ctx.createRadialGradient(nnx,nny,0,nnx,nny,H*0.3);
      var hue = (nt*20+ni*60)%360;
      nGrad.addColorStop(0,'hsla('+hue+',60%,40%,0.04)');
      nGrad.addColorStop(0.5,'hsla('+hue+',50%,30%,0.02)');
      nGrad.addColorStop(1,'transparent');
      ctx.fillStyle=nGrad;ctx.fillRect(0,0,W,H);
    }
    ctx.globalCompositeOperation='source-over';ctx.restore();
  }

  ctx.textAlign='center'; ctx.textBaseline='middle';

  // Title bar
  ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillRect(0,0,W,SAFE_TOP+u*2.2);
  ctx.font=`bold ${u*1}px monospace`; ctx.fillStyle='#FFD700';
  ctx.fillText("GRONK'S JOURNEY", W/2, SAFE_TOP+u*1.1);

  // Stats bar
  ctx.font=`${u*.5}px monospace`; ctx.fillStyle='rgba(255,255,255,0.5)';
  ctx.fillText(`Best Score: ${save.bestScore}  |  Total Gems: ${save.totalGems}`, W/2, SAFE_TOP+u*1.9);

  // Map area
  const mapTop = SAFE_TOP+u*2.5, mapBot = H-SAFE_BOTTOM-u*2.5;
  const mapH = mapBot - mapTop;
  const totalLevels = 40; // fixed 40-level journey
  const nodeSpacingY = u*4;
  const totalMapH = totalLevels * nodeSpacingY + u*6;
  const maxScroll = Math.max(0, totalMapH - mapH);

  // Auto-focus on current level when first entering level map
  if (G._prevPhase !== 'LEVEL_MAP') {
    const curLvl = Math.min(save.highestLevel+1, totalLevels);
    G.mapTargetScrollY = clamp(curLvl * nodeSpacingY - mapH/2, 0, maxScroll);
    G.mapScrollY = G.mapTargetScrollY;
  }

  // Smooth scroll
  G.mapScrollY = lerp(G.mapScrollY, G.mapTargetScrollY, 8*dt);
  G.mapScrollY = clamp(G.mapScrollY, 0, maxScroll);
  G.mapTargetScrollY = clamp(G.mapTargetScrollY, 0, maxScroll);

  // Clip to map area
  ctx.save();
  ctx.beginPath(); ctx.rect(0, mapTop, W, mapH); ctx.clip();

  // Draw decorative background elements (twinkling stars)
  var _starT = (G.time||Date.now()*.001);
  for(let i=0;i<50;i++){
    const sx=((i*137.5+42)%W), sy=((i*73.3+19)%(totalMapH))-G.mapScrollY+mapTop;
    if(sy<mapTop-10||sy>mapBot+10) continue;
    var _tw = 0.1+((i*7)%5)*0.06 + Math.sin(_starT*2+i*1.7)*0.08;
    ctx.fillStyle=`rgba(255,255,255,${_tw})`;
    ctx.beginPath();ctx.arc(sx,sy,0.5+((i*3)%3)*0.4,0,PI2);ctx.fill();
  }

  // Draw path and nodes (bottom-up, like Candy Crush)
  for(let lvl=1; lvl<=totalLevels; lvl++) {
    const def = getLevelDef(lvl);
    const thm = THEMES[def.theme];
    const isBoss = lvl % 5 === 0;
    // Position: level 1 at bottom, higher levels go up — extra padding at bottom
    const ny = mapBot - u*1.5 - (lvl * nodeSpacingY) + G.mapScrollY + nodeSpacingY;
    // Zigzag X position
    const zigzag = (lvl%2===0) ? W*0.32 : W*0.68;
    const nx = zigzag + Math.sin(lvl*0.8)*W*0.08;

    if (ny < mapTop-u*4 || ny > mapBot+u*4) continue;

    // Path line to next level
    if (lvl < totalLevels) {
      const ny2 = mapBot - u*1.5 - ((lvl+1)*nodeSpacingY) + G.mapScrollY + nodeSpacingY;
      const nx2Zig = ((lvl+1)%2===0) ? W*0.32 : W*0.68;
      const nx2 = nx2Zig + Math.sin((lvl+1)*0.8)*W*0.08;
      // Curved path line
      const cpX = (nx+nx2)/2, cpY = (ny+ny2)/2;
      if (lvl <= save.highestLevel) {
        ctx.strokeStyle = 'rgba(255,215,0,0.5)'; ctx.lineWidth = u*.18;
        ctx.shadowColor='rgba(255,215,0,0.3)'; ctx.shadowBlur=6;
      } else {
        ctx.strokeStyle = 'rgba(80,80,120,0.35)'; ctx.lineWidth = u*.12;
        ctx.shadowBlur=0;
      }
      ctx.setLineDash(lvl <= save.highestLevel ? [] : [u*.3, u*.25]);
      ctx.beginPath(); ctx.moveTo(nx, ny); ctx.quadraticCurveTo(cpX+Math.sin(lvl)*u*2, cpY, nx2, ny2); ctx.stroke();
      ctx.setLineDash([]); ctx.shadowBlur=0;
    }

    const completed = lvl <= save.highestLevel;
    const current = lvl === save.highestLevel+1;
    const locked = lvl > save.highestLevel+1;

    // Node size — bosses are bigger
    const nodeR = isBoss ? u*1.5 : u*1.2;

    if (completed) {
      // Completed: filled with theme gradient, gold border
      const grad = ctx.createRadialGradient(nx-nodeR*.2, ny-nodeR*.2, 0, nx, ny, nodeR);
      grad.addColorStop(0, thm.sky[2] || thm.sky[1]); grad.addColorStop(1, thm.sky[0]);
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, PI2); ctx.fill();
      ctx.strokeStyle = '#FFD700'; ctx.lineWidth = isBoss?4:3;
      ctx.shadowColor='#FFD700'; ctx.shadowBlur=isBoss?10:4; ctx.stroke(); ctx.shadowBlur=0;
      // Checkmark
      ctx.strokeStyle = '#44FF66'; ctx.lineWidth = u*.18; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(nx-u*.35, ny); ctx.lineTo(nx-u*.05, ny+u*.3); ctx.lineTo(nx+u*.4, ny-u*.3); ctx.stroke();
      // Star rating dots
      const stars = save.levelStars[lvl] || 0;
      if(stars>0){
        for(let s=0;s<3;s++){
          const sdx = (s-1)*u*.5;
          ctx.fillStyle = s<stars ? '#FFD700' : 'rgba(80,80,100,0.4)';
          ctx.beginPath();ctx.arc(nx+sdx,ny+nodeR+u*.5,u*.18,0,PI2);ctx.fill();
        }
      }
    } else if (current) {
      // Current: pulsing glow
      const pulse = 1+Math.sin(Date.now()*.005)*.15;
      ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 25*pulse;
      const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nodeR*pulse);
      grad.addColorStop(0, thm.sky[2] || thm.sky[1]); grad.addColorStop(1, thm.sky[0]);
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(nx, ny, nodeR*pulse, 0, PI2); ctx.fill();
      ctx.strokeStyle = '#FFD700'; ctx.lineWidth = isBoss?4:3; ctx.stroke();
      ctx.shadowBlur = 0;
      // Play icon (triangle)
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.moveTo(nx-u*.25, ny-u*.35); ctx.lineTo(nx+u*.4, ny); ctx.lineTo(nx-u*.25, ny+u*.35); ctx.closePath(); ctx.fill();
    } else {
      // Locked: dark with subtle theme tint
      ctx.fillStyle = 'rgba(40,40,60,0.75)'; ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, PI2); ctx.fill();
      ctx.strokeStyle = 'rgba(80,80,100,0.4)'; ctx.lineWidth = 2; ctx.stroke();
      // Lock icon (drawn, not emoji for consistency)
      ctx.strokeStyle='rgba(120,120,150,0.5)';ctx.lineWidth=u*.08;ctx.lineCap='round';
      ctx.beginPath();ctx.arc(nx,ny-u*.2,u*.2,Math.PI,0);ctx.stroke();
      ctx.fillStyle='rgba(100,100,130,0.5)';ctx.fillRect(nx-u*.25,ny-u*.05,u*.5,u*.35);
    }

    // Boss skull icon on boss nodes
    if (isBoss) {
      const bossLblX = (lvl%2===0) ? nx-nodeR-u*0.8 : nx+nodeR+u*0.8;
      ctx.font=`${u*.7}px sans-serif`;ctx.textAlign='center';
      ctx.fillStyle=completed?'#FFD700':current?'#FF6644':'rgba(150,150,170,0.5)';
      ctx.fillText('\uD83D\uDC80',bossLblX,ny+u*.15);
    }

    // Level number (above node)
    ctx.font = `bold ${u*.55}px monospace`; ctx.textAlign='center';
    ctx.fillStyle = locked ? 'rgba(80,80,100,0.45)' : 'rgba(255,255,255,0.85)';
    ctx.fillText(`${lvl}`, nx, ny-nodeR-u*.5);

    // Level name (on the side)
    const nameX = (lvl%2===0) ? nx+nodeR+u*1.8 : nx-nodeR-u*1.8;
    ctx.font = `${u*.48}px monospace`;
    ctx.fillStyle = locked ? 'rgba(80,80,100,0.35)' : (completed ? 'rgba(255,215,0,0.75)' : 'rgba(255,255,255,0.65)');
    ctx.textAlign = (lvl%2===0) ? 'left' : 'right';
    let nameStr = def.name;
    if (isBoss) nameStr = '\u2694 ' + nameStr; // crossed swords for boss
    ctx.fillText(nameStr, nameX, ny);
    ctx.textAlign = 'center';

    // Cooldown indicator on saved level
    if (save.savedLevel === lvl && save.cooldownEnd > 0) {
      const cdRemain = save.cooldownEnd - Date.now();
      if (cdRemain > 0) {
        const mins = Math.max(0, Math.floor(cdRemain/60000));
        const secs = Math.max(0, Math.min(59, Math.ceil((cdRemain%60000)/1000)));
        ctx.font = `${u*.4}px monospace`; ctx.fillStyle='#FF8844';
        ctx.fillText(`\u23F3 ${mins}:${secs<10?'0':''}${secs}`, nx, ny+nodeR+u*.6);
      }
    }
  }
  ctx.restore();

  // Bottom bar with buttons
  ctx.fillStyle='rgba(0,0,0,0.6)'; ctx.fillRect(0,H-SAFE_BOTTOM-u*2.2,W,SAFE_BOTTOM+u*2.2);

  const btnW = u*5, btnH = u*1.3;
  const hasNextLevel = G._nextLevelNum && G._nextLevelNum > 0;
  const canResume = save.savedLevel > 1 && (save.cooldownEnd-Date.now()) <= 0;

  if (hasNextLevel) {
    // "NEXT LEVEL" prominent button after completing a level
    const pulse = 1+Math.sin(Date.now()*.006)*.05;
    const nlW = u*7, nlH = u*1.5;
    ctx.save(); ctx.translate(W/2, H-SAFE_BOTTOM-u*1.25); ctx.scale(pulse,pulse);
    ctx.fillStyle='#22AA44'; ctx.fillRect(-nlW/2,-nlH/2,nlW,nlH);
    ctx.strokeStyle='#44DD66'; ctx.lineWidth=3; ctx.strokeRect(-nlW/2,-nlH/2,nlW,nlH);
    ctx.font=`bold ${u*.8}px monospace`; ctx.fillStyle='white';
    ctx.fillText(`NEXT: Level ${G._nextLevelNum}`, 0, 0); ctx.restore();
  } else {
    if (canResume) {
      // Resume button
      const rx = W*0.3-btnW/2, ry = H-SAFE_BOTTOM-u*1.8;
      ctx.fillStyle='#22AA44'; ctx.fillRect(rx,ry,btnW,btnH);
      ctx.strokeStyle='#44DD66'; ctx.lineWidth=2; ctx.strokeRect(rx,ry,btnW,btnH);
      ctx.font=`bold ${u*.6}px monospace`; ctx.fillStyle='white';
      ctx.fillText(`Resume L${save.savedLevel}`, W*0.3, ry+btnH/2);
    }

    // New Run button
    const nrX = (canResume ? W*0.7 : W*0.5)-btnW/2, nrY = H-SAFE_BOTTOM-u*1.8;
    ctx.fillStyle='#2244AA'; ctx.fillRect(nrX,nrY,btnW,btnH);
    ctx.strokeStyle='#4466CC'; ctx.lineWidth=2; ctx.strokeRect(nrX,nrY,btnW,btnH);
    ctx.font=`bold ${u*.6}px monospace`; ctx.fillStyle='white';
    ctx.fillText('New Run', canResume ? W*0.7 : W*0.5, nrY+btnH/2);

    // Endless Mode button (unlocked after completing all 40 levels)
    if(save.highestLevel >= 40){
      const eW=u*5, eH=u*1, eX=W/2-eW/2, eY=H-SAFE_BOTTOM-u*3.3;
      ctx.fillStyle='rgba(180,50,200,0.3)';ctx.fillRect(eX,eY,eW,eH);
      ctx.strokeStyle='rgba(200,80,220,0.5)';ctx.lineWidth=1;ctx.strokeRect(eX,eY,eW,eH);
      ctx.font=`bold ${u*.5}px monospace`;ctx.fillStyle='rgba(220,150,255,0.9)';
      ctx.fillText(`ENDLESS${save.endlessBest>0?' (Best: '+save.endlessBest+')':''}`,W/2,eY+eH/2);
    }
  }

  // Scroll hint
  if (maxScroll > 0) {
    ctx.font=`${u*.4}px monospace`; ctx.fillStyle='rgba(255,255,255,0.3)';
    ctx.fillText('↕ Swipe to scroll', W/2, mapTop+u*.5);
  }

  // Shop button (top-right, left of stats)
  const shW=u*3.5, shH=u*1, shX=W-shW*2-u*1.2-SAFE_RIGHT, shY=SAFE_TOP+u*.3;
  ctx.fillStyle='rgba(200,160,50,0.3)';ctx.fillRect(shX,shY,shW,shH);
  ctx.strokeStyle='rgba(200,160,50,0.5)';ctx.lineWidth=1;ctx.strokeRect(shX,shY,shW,shH);
  ctx.font=`${u*.5}px monospace`;ctx.fillStyle='rgba(255,220,100,0.8)';ctx.textAlign='center';
  ctx.fillText('\uD83D\uDCB0 SHOP',shX+shW/2,shY+shH/2);

  // Stats button (top-right)
  const stW=u*3.5, stH=u*1, stX=W-stW-u*.5-SAFE_RIGHT, stY=SAFE_TOP+u*.3;
  ctx.fillStyle='rgba(100,100,200,0.3)';ctx.fillRect(stX,stY,stW,stH);
  ctx.strokeStyle='rgba(100,100,200,0.5)';ctx.lineWidth=1;ctx.strokeRect(stX,stY,stW,stH);
  ctx.font=`${u*.5}px monospace`;ctx.fillStyle='rgba(200,200,255,0.8)';ctx.textAlign='center';
  ctx.fillText('\uD83D\uDCCA STATS',stX+stW/2,stY+stH/2);

  // Missions dimensions (needed by daily login button positioning)
  const miW=u*3.8, miH=u*1, miX=SAFE_LEFT+u*2, miY=SAFE_TOP+u*.3;

  // Daily login button
  const dlToday = localDateStr(new Date());
  const dlClaimed = save.lastLoginDate === dlToday;
  const dlW=u*3.5, dlH=u*1, dlX=miX+miW+u*2.0, dlY=SAFE_TOP+u*.3;
  drawButton(dlX,dlY,dlW,dlH,'LOGIN',{fill:dlClaimed?'rgba(60,60,80,0.3)':'rgba(255,100,50,0.3)',stroke:dlClaimed?'rgba(80,80,100,0.3)':'rgba(255,120,60,0.6)',lw:1,textColor:dlClaimed?'rgba(150,150,170,0.5)':'rgba(255,180,100,0.9)',font:FONTS['b0.4']||('bold '+Math.round(u*0.4)+'px monospace')});
  if(!dlClaimed) drawNotifDot(dlX+dlW-u*0.1, dlY+u*0.1, 1, u);

  // Daily Challenge button (bottom of title bar)
  const today = localDateStr(new Date());
  const dcDone = save.lastChallengeDate === today;
  const dcW=u*6, dcH=u*0.9, dcX=W/2-dcW/2, dcY=SAFE_TOP+u*2.25;
  ctx.fillStyle=dcDone?'rgba(60,60,80,0.3)':'rgba(255,100,50,0.3)';ctx.fillRect(dcX,dcY,dcW,dcH);
  ctx.strokeStyle=dcDone?'rgba(80,80,100,0.3)':'rgba(255,120,60,0.6)';ctx.lineWidth=1;ctx.strokeRect(dcX,dcY,dcW,dcH);
  ctx.font=`bold ${u*.4}px monospace`;ctx.fillStyle=dcDone?'rgba(150,150,170,0.5)':'rgba(255,180,100,0.9)';ctx.textAlign='center';
  ctx.fillText(dcDone?`DAILY DONE (${save.challengeBest})`:'DAILY CHALLENGE',W/2,dcY+dcH/2);

  // Missions button (top-left, right of speaker)
  const unclaimedN = (save.missions&&save.missions.daily||[]).filter(function(m){return !m.claimed&&(m.progress||0)>=m.target;}).length + (save.missions&&save.missions.weekly||[]).filter(function(m){return !m.claimed&&(m.progress||0)>=m.target;}).length;
  drawButton(miX,miY,miW,miH,'MISSIONS',{fill:unclaimedN>0?'rgba(255,180,0,0.35)':'rgba(100,180,100,0.3)',stroke:unclaimedN>0?'rgba(255,200,50,0.6)':'rgba(100,180,100,0.5)',lw:1,textColor:unclaimedN>0?'#FFD700':'rgba(200,255,200,0.8)',font:FONTS['b0.4']||('bold '+Math.round(u*0.4)+'px monospace')});
  if(unclaimedN>0) drawNotifDot(miX+miW-u*0.1, miY+u*0.1, unclaimedN, u);

  // Settings gear (top-left, right of missions)
  const geX=miX+miW+u*0.3, geY=SAFE_TOP+u*.3, geW=u*1.3, geH=u*1;
  drawButton(geX,geY,geW,geH,'\u2699',{fill:'rgba(255,255,255,0.1)',stroke:'rgba(255,255,255,0.25)',font:Math.round(u*.8)+'px sans-serif',textColor:'rgba(255,255,255,0.7)',radius:u*0.3});

  // Speaker icon
  drawSpeakerIcon(SAFE_LEFT+u*.3, SAFE_TOP+u*.3, u*1);
}

function drawGuidedLessonStrip(baseY, compact) {
  const guide = G.onboarding;
  if (!guide || G.phase !== 'PLAYING') return 0;

  const u = UNIT;
  const panelW = Math.min(W * (compact ? 0.56 : 0.5), u * (compact ? 8.8 : 10.2));
  const panelH = u * (compact ? 1.18 : 1.28);
  const panelX = W / 2 - panelW / 2;
  const panelY = baseY;
  const pending = getGuidedPendingStep();
  const accent = pending ? pending.accent : '#7DF09B';

  drawPanel(panelX, panelY, panelW, panelH, {
    radius: u * 0.3,
    top: 'rgba(16,24,42,0.94)',
    bottom: 'rgba(8,12,24,0.92)',
    stroke: 'rgba(255,255,255,0.1)',
    accent: accent,
    blur: 16
  });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = FONTS['n0.22'] || (Math.round(u * 0.22) + 'px monospace');
  ctx.fillStyle = 'rgba(218,230,250,0.7)';
  ctx.fillText(guide.header, W / 2, panelY + u * 0.2);

  ctx.font = compact ? ('bold ' + Math.round(u * 0.34) + 'px monospace') : (FONTS['b0.38'] || ('bold ' + Math.round(u * 0.38) + 'px monospace'));
  ctx.fillStyle = guide.completed ? '#7DF09B' : '#F5F7FF';
  ctx.fillText(guide.completed ? 'KEEP THE RHYTHM' : guide.title.toUpperCase(), W / 2, panelY + u * 0.48);

  const chipGap = u * 0.12;
  const chipW = (panelW - u * 0.36 - chipGap) / 2;
  const chipY = panelY + u * 0.68;
  for (let i = 0; i < guide.steps.length; i++) {
    const step = guide.steps[i];
    const chipX = panelX + u * 0.18 + i * (chipW + chipGap);
    const done = !!step.done;
    const current = !done && pending === step;
    drawMiniChip(chipX, chipY, chipW, u * 0.38, (done ? 'OK ' : '') + step.short, {
      font: compact ? ('bold ' + Math.round(u * 0.22) + 'px monospace') : (FONTS['b0.26'] || ('bold ' + Math.round(u * 0.26) + 'px monospace')),
      accent: done ? 'rgba(125,240,155,0.28)' : (current ? step.accent : 'rgba(110,126,152,0.16)'),
      textColor: done ? '#DFFFE9' : (current ? '#FFF7E6' : 'rgba(228,236,248,0.78)'),
      top: done ? 'rgba(16,38,26,0.94)' : 'rgba(16,24,40,0.92)',
      bottom: done ? 'rgba(8,22,16,0.9)' : 'rgba(8,12,24,0.88)'
    });
  }

  return panelH + u * 0.16;
}

function drawHUD(dt){
  const u = UNIT;
  const p = G.player;
  const tl = G.timeLeft;
  const compact = W < 1100 || H < 560;
  const edge = Math.max(10, u * 0.45);
  const top = SAFE_TOP + edge;
  const left = SAFE_LEFT + edge;
  const right = W - SAFE_RIGHT - edge;
  const hpPct = clamp(p.hp / p.maxHP, 0, 1);
  const prog = clamp(G.time / G.levelDef.targetTime, 0, 1);
  const urg = clamp(1 - tl / 10, 0, 1);
  const tCol = `rgb(255,${Math.floor(lerp(216,78,urg))},${Math.floor(lerp(138,74,urg))})`;
  const hudX = left + (compact ? u * 1.02 : u * 1.18);
  const hudY = top;
  const hudW = Math.max(u * (compact ? 9.8 : 10.8), right - hudX - (compact ? u * 1.18 : u * 1.45));
  const hudH = compact ? u * 1.7 : u * 1.9;
  const innerPad = compact ? u * 0.28 : u * 0.34;
  const gap = compact ? u * 0.24 : u * 0.34;
  const leftW = Math.min(u * (compact ? 4.2 : 4.6), hudW * (compact ? 0.32 : 0.34));
  const centerW = Math.min(u * (compact ? 4.0 : 4.35), hudW * (compact ? 0.27 : 0.26));
  const rightW = hudW - leftW - centerW - gap * 2;
  const centerX = hudX + leftW + gap;
  const rightX = centerX + centerW + gap;
  if (G.comboPulse > 0) G.comboPulse = Math.max(0, G.comboPulse - dt * 2);
  const comboVisible = G.combo >= 5;

  drawPanel(hudX, hudY, hudW, hudH, {
    radius: u * 0.38,
    top: 'rgba(16,28,48,0.92)',
    bottom: 'rgba(8,14,26,0.88)',
    stroke: 'rgba(255,255,255,0.1)',
    accent: 'rgba(255,215,90,0.16)',
    blur: 18
  });

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(hudX + leftW + gap * 0.5, hudY + u * 0.24);
  ctx.lineTo(hudX + leftW + gap * 0.5, hudY + hudH - u * 0.24);
  ctx.moveTo(centerX + centerW + gap * 0.5, hudY + u * 0.24);
  ctx.lineTo(centerX + centerW + gap * 0.5, hudY + hudH - u * 0.24);
  ctx.stroke();
  ctx.restore();

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = FONTS['b0.3'] || ('bold ' + Math.round(u * 0.3) + 'px monospace');
  ctx.fillStyle = 'rgba(192,208,234,0.72)';
  ctx.fillText('LEVEL ' + G.levelNum, hudX + innerPad, hudY + u * 0.18);
  ctx.font = compact ? ('bold ' + Math.round(u * 0.38) + 'px monospace') : (FONTS['b0.44'] || ('bold ' + Math.round(u * 0.44) + 'px monospace'));
  ctx.fillStyle = '#F5F7FF';
  let _lvlName = G.levelDef.name.toUpperCase();
  const _maxLvlW = leftW - innerPad * 2;
  while (_lvlName.length > 3 && ctx.measureText(_lvlName).width > _maxLvlW) _lvlName = _lvlName.slice(0, -1);
  ctx.fillText(_lvlName, hudX + innerPad, hudY + u * 0.48);
  ctx.font = FONTS['n0.26'] || (Math.round(u * 0.26) + 'px monospace');
  ctx.fillStyle = 'rgba(176,194,220,0.62)';
  ctx.fillText('HP', hudX + innerPad, hudY + u * 1.0);
  drawProgressBar(hudX + innerPad, hudY + u * 1.26, leftW - innerPad * 2, u * 0.24, hpPct, [
    `hsl(${lerp(6,88,hpPct)},92%,58%)`,
    `hsl(${lerp(16,118,hpPct)},88%,40%)`
  ]);
  if (p.hpFlash > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(p.hpFlash, 0, 1) * 0.38;
    fillRR(hudX + innerPad, hudY + u * 1.26, leftW - innerPad * 2, u * 0.24, u * 0.12, '#FF5252', null, 0);
    ctx.restore();
  }
  ctx.textAlign = 'right';
  ctx.font = FONTS['b0.28'] || ('bold ' + Math.round(u * 0.28) + 'px monospace');
  ctx.fillStyle = 'rgba(255,255,255,0.84)';
  ctx.fillText(`${Math.ceil(p.hp)}/${p.maxHP}`, hudX + leftW - innerPad, hudY + u * 0.98);

  const pulse = tl < 5 ? 1 + Math.sin(G.time * 12) * 0.08 : 1;
  ctx.save();
  ctx.translate(centerX + centerW / 2, hudY + u * 0.62);
  ctx.scale(pulse, pulse);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = compact ? ('bold ' + Math.round(u * 0.82) + 'px monospace') : (FONTS['b1.0'] || ('bold ' + Math.round(u * 1.0) + 'px monospace'));
  ctx.fillStyle = tCol;
  ctx.fillText(`${Math.ceil(tl)}s`, 0, 0);
  ctx.restore();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = FONTS['n0.24'] || (Math.round(u * 0.24) + 'px monospace');
  ctx.fillStyle = 'rgba(196,208,232,0.66)';
  ctx.fillText('TIME LEFT', centerX + centerW / 2, hudY + u * 0.86);
  drawProgressBar(centerX + u * 0.14, hudY + u * 1.26, centerW - u * 0.28, u * 0.24, prog, [
    `hsl(${lerp(12,92,prog)},90%,58%)`,
    `hsl(${lerp(32,132,prog)},92%,48%)`
  ]);
  ctx.font = FONTS['b0.26'] || ('bold ' + Math.round(u * 0.26) + 'px monospace');
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.fillText(`${Math.round(prog * 100)}% CLEAR`, centerX + centerW / 2, hudY + u * 1.58);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = FONTS['n0.26'] || (Math.round(u * 0.26) + 'px monospace');
  ctx.fillStyle = 'rgba(188,204,228,0.72)';
  ctx.fillText('SCORE', rightX + innerPad, hudY + u * 0.18);
  ctx.font = compact ? ('bold ' + Math.round(u * 0.52) + 'px monospace') : (FONTS['b0.6'] || ('bold ' + Math.round(u * 0.6) + 'px monospace'));
  ctx.fillStyle = '#FFE27A';
  ctx.fillText(`${G.runScore}`, rightX + innerPad, hudY + u * 0.42);
  const statChipW = Math.min(u * (compact ? 2.2 : 2.5), rightW * 0.34);
  const statChipX = rightX + rightW - innerPad - statChipW;
  drawMiniChip(statChipX, hudY + u * 0.16, statChipW, u * 0.48, `SAVE ${Math.max(0, G.continuesLeft)}`, {
    font: FONTS['b0.22'] || ('bold ' + Math.round(u * 0.22) + 'px monospace'),
    accent: G.continuesLeft > 0 ? 'rgba(255,143,112,0.28)' : 'rgba(110,118,138,0.18)',
    textColor: G.continuesLeft > 0 ? '#FFD9C9' : 'rgba(182,188,210,0.72)',
    top: G.continuesLeft > 0 ? 'rgba(42,24,20,0.92)' : 'rgba(18,22,34,0.9)',
    bottom: G.continuesLeft > 0 ? 'rgba(20,10,10,0.9)' : 'rgba(10,14,24,0.88)'
  });
  ctx.font = FONTS['n0.24'] || (Math.round(u * 0.24) + 'px monospace');
  ctx.fillStyle = 'rgba(184,198,224,0.64)';
  ctx.fillText('GEMS', rightX + innerPad, hudY + u * 1.0);
  drawDiamondShape(rightX + innerPad + u * 0.15, hudY + u * 1.38, u * 0.14, `hsl(${G.theme.gemH},100%,68%)`, 'rgba(255,255,255,0.18)');
  ctx.font = FONTS['b0.36'] || ('bold ' + Math.round(u * 0.36) + 'px monospace');
  ctx.fillStyle = `hsl(${G.theme.gemH},100%,68%)`;
  ctx.fillText(`${G.runGems}`, rightX + innerPad + u * 0.38, hudY + u * 1.2);
  if (comboVisible) {
    const colors = ['#FFD766', '#FFAE47', '#FF6F61', '#FF53CF', '#61EDFF', '#FF5B87'];
    const cIdx = Math.min(Math.max(0, Math.floor((G.combo - 5) / 5)), colors.length - 1);
    let comboCol = colors[cIdx];
    if (G.combo >= 30) comboCol = `hsl(${(G.time * 360) % 360},100%,65%)`;
    const comboPulse = 1 + G.comboPulse * 0.16;
    const comboChipW = Math.min(u * (compact ? 2.6 : 3.0), rightW * 0.46);
    const comboChipX = rightX + rightW - innerPad - comboChipW;
    ctx.save();
    ctx.translate(comboChipX + comboChipW / 2, hudY + u * 1.42);
    ctx.scale(comboPulse, comboPulse);
    drawPanel(-comboChipW / 2, -u * 0.24, comboChipW, u * 0.48, {
      radius: u * 0.2,
      top: 'rgba(28,18,24,0.92)',
      bottom: 'rgba(12,8,16,0.9)',
      stroke: 'rgba(255,255,255,0.07)',
      accent: comboCol,
      blur: 10
    });
    ctx.font = FONTS['b0.24'] || ('bold ' + Math.round(u * 0.24) + 'px monospace');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = comboCol;
    ctx.fillText(`COMBO x${G.combo}`, 0, 0);
    ctx.restore();
  }

  drawMiniChip(W - SAFE_RIGHT - u * 1.48, hudY + u * 0.12, u * 1.0, u * 0.88, '||', {
    font: FONTS['b0.48'] || ('bold ' + Math.round(u * 0.48) + 'px monospace'),
    accent: 'rgba(255,255,255,0.12)'
  });
  drawSpeakerIcon(SAFE_LEFT + u * 0.3, hudY + u * 0.14, u * 1.0);

  const guidedOffset = drawGuidedLessonStrip(hudY + hudH + u * 0.22, compact);

  if (G.announce && G.announce.life > 0) {
    const al = clamp(G.announce.life, 0, 1);
    const sc = 1 + (1 - al) * 0.12;
    const annW = Math.min(W * (compact ? 0.42 : 0.46), u * (compact ? 6.4 : 7.3));
    const annH = u * (compact ? 0.7 : 0.76);
    const tooltipActive = !!(tooltipState.active && tooltipState.alpha > 0);
    const annY = Math.max(hudY + hudH + guidedOffset + u * 0.24, H * (compact ? 0.225 : 0.2)) + (tooltipActive ? u * (compact ? 0.98 : 1.08) : 0);
    ctx.save();
    ctx.globalAlpha = al;
    ctx.translate(W / 2, annY + annH / 2);
    ctx.scale(sc, sc);
    drawPanel(-annW / 2, -annH / 2, annW, annH, {
      radius: u * 0.28,
      top: 'rgba(24,18,12,0.94)',
      bottom: 'rgba(10,10,8,0.92)',
      stroke: 'rgba(255,223,120,0.16)',
      accent: 'rgba(255,215,0,0.24)'
    });
    ctx.font = FONTS['b0.38'] || ('bold ' + Math.round(u * 0.38) + 'px monospace');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFD45E';
    ctx.fillText(G.announce.text, 0, 0);
    ctx.restore();
    G.announce.life -= dt * 0.75;
  }

  const powerups = [];
  if (p.shield) powerups.push({ label: 'SHIELD', accent: '#8BD8FF' });
  if (p.magnetTimer > 0) powerups.push({ label: 'MAGNET', accent: '#7FFFD4' });
  if (p.extraLife) powerups.push({ label: 'EXTRA', accent: '#FF8A80' });
  if (p.starTimer > 0) powerups.push({ label: 'STAR', accent: '#FFD65A' });
  if (p.tinyTimer > 0) powerups.push({ label: 'TINY', accent: '#22CCAA' });
  if (p.speedBoost) powerups.push({ label: 'FAST', accent: '#CC8822' });
  if (p.doubleScore) powerups.push({ label: 'x2', accent: '#FF6644' });
  if (p.slideTimer > 0) powerups.push({ label: 'SLIDE', accent: '#88CCFF' });
  if (p.dashTimer > 0) powerups.push({ label: 'DASH', accent: '#88FFCC' });
  if (p.parryTimer > 0) powerups.push({ label: 'PARRY', accent: '#FFFF66' });
  if (p.pounding) powerups.push({ label: 'POUND', accent: '#FFAA44' });

  let chipX = left;
  let chipRow = 0;
  const chipH = u * 0.72;
  const chipBaseY = H - SAFE_BOTTOM - edge - chipH;
  const chipLimit = W - SAFE_RIGHT - edge - (compact ? u * 1.3 : u * 2.4);
  for (let i = 0; i < powerups.length; i++) {
    const chip = powerups[i];
    const chipW = Math.max(u * 1.35, chip.label.length * u * 0.34 + u * 0.55);
    if (chipX + chipW > chipLimit && chipRow === 0) {
      chipRow = 1;
      chipX = left;
    }
    if (chipRow > 1) break;
    const chipY = chipBaseY - chipRow * (chipH + u * 0.16);
    drawMiniChip(chipX, chipY, chipW, chipH, chip.label, {
      font: FONTS['b0.36'] || ('bold ' + Math.round(u * 0.36) + 'px monospace'),
      accent: chip.accent,
      textColor: '#F5F7FF'
    });
    chipX += chipW + u * 0.18;
  }
  // Save failure warning
  if (_saveFailWarning > 0) {
    _saveFailWarning -= dt;
    ctx.save(); ctx.globalAlpha = clamp(_saveFailWarning, 0, 1);
    ctx.font = FONTS['b0.4'] || ('bold ' + Math.round(u * 0.4) + 'px monospace');
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = '#FF4444';
    ctx.fillText('STORAGE FULL - PROGRESS MAY NOT SAVE', W / 2, H - SAFE_BOTTOM - u * 2);
    ctx.restore();
  }
}

function drawMenu(){
  const u = UNIT;
  worldOffset += 120 * DT;
  if (!chunks.length) {
    G.rng = new RNG(42);
    initWorld(G.rng, getDiff(0, 1), 'JUNGLE');
    initBg();
  }
  drawBg(THEMES.JUNGLE);

  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(5,10,18,0.78)');
  grad.addColorStop(0.42, 'rgba(7,14,24,0.42)');
  grad.addColorStop(0.75, 'rgba(7,12,20,0.52)');
  grad.addColorStop(1, 'rgba(4,8,14,0.82)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const glow = ctx.createRadialGradient(W * 0.5, H * 0.28, 0, W * 0.5, H * 0.28, W * 0.48);
  glow.addColorStop(0, 'rgba(255,210,90,0.24)');
  glow.addColorStop(1, 'rgba(255,210,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const titleBounce = Math.sin(Date.now() * 0.003) * u * 0.08;
  ctx.save();
  ctx.translate(W / 2, H * 0.2 + titleBounce);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 18;
  ctx.font = FONTS['b2.5'] || ('bold ' + Math.round(u * 2.5) + 'px monospace');
  const titleGrad = ctx.createLinearGradient(0, -u * 1.1, 0, u * 0.7);
  titleGrad.addColorStop(0, '#FFF2A6');
  titleGrad.addColorStop(0.52, '#FFD85C');
  titleGrad.addColorStop(1, '#C98618');
  ctx.fillStyle = titleGrad;
  ctx.fillText("GRONK'S RUN", 0, 0);
  ctx.shadowBlur = 0;
  ctx.font = FONTS['b0.7'] || ('bold ' + Math.round(u * 0.7) + 'px monospace');
  ctx.fillStyle = 'rgba(146,218,255,0.88)';
  ctx.fillText('PREHISTORIC SPRINT - DODGE - COLLECT', 0, u * 1.35);
  ctx.restore();

  const cardW = Math.min(W * 0.78, u * 12.8);
  const cardH = u * 4.6;
  const cardX = W / 2 - cardW / 2;
  const cardY = H * 0.42;
  drawPanel(cardX, cardY, cardW, cardH, {
    radius: u * 0.45,
    top: 'rgba(20,30,48,0.92)',
    bottom: 'rgba(8,14,24,0.9)',
    stroke: 'rgba(255,255,255,0.12)',
    accent: 'rgba(255,215,90,0.24)',
    blur: 22
  });
  ctx.font = FONTS['b1'] || ('bold ' + Math.round(u * 1.0) + 'px monospace');
  ctx.fillStyle = '#F5F7FF';
  ctx.fillText('TAP TO START', W / 2, cardY + u * 1.15);
  ctx.font = FONTS['n0.45'] || (Math.round(u * 0.45) + 'px monospace');
  ctx.fillStyle = 'rgba(198,212,236,0.74)';
  ctx.fillText('Swipe up to jump - down to slide - right to dash', W / 2, cardY + u * 1.95);

  const chipY = cardY + u * 2.65;
  const chipW = u * 2.65;
  drawMiniChip(W / 2 - chipW * 1.65, chipY, chipW, u * 0.78, 'DASH', { accent: 'rgba(130,255,200,0.28)' });
  drawMiniChip(W / 2 - chipW * 0.5, chipY, chipW, u * 0.78, 'GEMS', { accent: 'rgba(120,220,255,0.28)' });
  drawMiniChip(W / 2 + chipW * 0.65, chipY, chipW, u * 0.78, 'BOSSES', { accent: 'rgba(255,120,92,0.3)' });

  const tapAlpha = 0.65 + Math.sin(Date.now() * 0.004) * 0.25;
  ctx.save();
  ctx.globalAlpha = tapAlpha;
  ctx.font = FONTS['b0.55'] || ('bold ' + Math.round(u * 0.55) + 'px monospace');
  ctx.fillStyle = '#FFD45E';
  ctx.fillText('PRESS ANYWHERE', W / 2, cardY + cardH - u * 0.45);
  ctx.restore();

  if (save.savedLevel > 1) {
    const resumeY = cardY + cardH + u * 0.38;
    const cdRemain = save.cooldownEnd - Date.now();
    if (cdRemain > 0) {
      const mins = Math.max(0, Math.floor(cdRemain / 60000));
      const secs = Math.max(0, Math.min(59, Math.ceil((cdRemain % 60000) / 1000)));
      drawMiniChip(W / 2 - u * 4.2, resumeY, u * 8.4, u * 0.82, `RESUME L${save.savedLevel} IN ${mins}:${secs<10?'0':''}${secs}`, {
        font: FONTS['b0.38'] || ('bold ' + Math.round(u * 0.38) + 'px monospace'),
        accent: 'rgba(255,140,80,0.26)'
      });
    } else {
      drawMiniChip(W / 2 - u * 4.2, resumeY, u * 8.4, u * 0.82, `RESUME LEVEL ${save.savedLevel}`, {
        font: FONTS['b0.42'] || ('bold ' + Math.round(u * 0.42) + 'px monospace'),
        accent: 'rgba(90,230,140,0.28)'
      });
    }
  }

  if (save.highestLevel > 0) {
    drawMiniChip(W / 2 - u * 4.8, H * 0.79, u * 9.6, u * 0.84, `BEST L${save.highestLevel} - SCORE ${save.bestScore}`, {
      font: FONTS['b0.4'] || ('bold ' + Math.round(u * 0.4) + 'px monospace'),
      accent: 'rgba(255,215,90,0.22)'
    });
  }

  drawMiniChip(W / 2 - u * 5.2, H - SAFE_BOTTOM - u * 1.28, u * 10.4, u * 0.82, 'JUMP - SLIDE - DASH - SURVIVE', {
    font: FONTS['n0.38'] || (Math.round(u * 0.38) + 'px monospace'),
    accent: 'rgba(120,200,255,0.18)',
    textColor: 'rgba(232,240,255,0.74)'
  });
  drawSpeakerIcon(SAFE_LEFT + UNIT * 0.3, SAFE_TOP + UNIT * 0.3, UNIT * 1.2);
}

function drawLevelComplete(dt){
  G.levelCompleteTimer += dt;
  const u = UNIT;
  const compact = W < 1100 || H < 560;
  const postGuidance = getPostLevelGuidance(G.levelNum);
  const rewardReadyHint = getRewardReadyHint(G.levelNum);
  const guideCopy = rewardReadyHint || postGuidance;
  const panelW = Math.min(W * (compact ? 0.78 : 0.74), u * (compact ? 11.1 : 12.2));
  const panelH = u * (compact ? 8.45 : 8.9);
  const panelX = W / 2 - panelW / 2;
  const panelY = Math.max(SAFE_TOP + u * 0.75, H * (compact ? 0.11 : 0.13));
  const innerPad = u * 0.62;
  const timeBonus = Math.floor(G.timeLeft * 10);
  const stars = G._levelStarsEarned || 1;
  const statGap = u * 0.32;
  const statW = (panelW - innerPad * 2 - statGap) / 2;
  const statH = u * 1.58;
  const statY = panelY + u * 3.15;
  const footerW = Math.min(panelW - innerPad * 2, u * (compact ? 8.7 : 9.3));
  const footerY = panelY + panelH - u * 1.18;
  const guideY = footerY - u * 0.96;

  ctx.fillStyle = 'rgba(6,8,14,0.52)';
  ctx.fillRect(0, 0, W, H);
  drawPanel(panelX, panelY, panelW, panelH, {
    radius: u * 0.55,
    top: 'rgba(18,24,42,0.94)',
    bottom: 'rgba(8,12,22,0.92)',
    stroke: 'rgba(255,255,255,0.12)',
    accent: 'rgba(255,215,90,0.26)',
    blur: 24
  });

  const pulse = 1 + Math.sin(G.levelCompleteTimer * 4) * 0.04;
  ctx.save();
  ctx.translate(W / 2, panelY + u * 1.0);
  ctx.scale(pulse, pulse);
  ctx.font = compact ? ('bold ' + Math.round(u * 1.0) + 'px monospace') : (FONTS['b1.2'] || ('bold ' + Math.round(u * 1.2) + 'px monospace'));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFD45E';
  ctx.fillText('LEVEL CLEAR', 0, 0);
  ctx.restore();

  drawMiniChip(panelX + innerPad, panelY + u * 1.55, panelW - innerPad * 2, u * 0.78, G.levelDef.name.toUpperCase(), {
    font: FONTS['b0.4'] || ('bold ' + Math.round(u * 0.4) + 'px monospace'),
    accent: 'rgba(120,210,255,0.24)'
  });

  if (G.newHigh) {
    drawMiniChip(W / 2 - u * 3.1, panelY + u * 2.35, u * 6.2, u * 0.68, 'NEW BEST SCORE', {
      font: FONTS['b0.38'] || ('bold ' + Math.round(u * 0.38) + 'px monospace'),
      accent: 'rgba(255,110,110,0.26)',
      textColor: '#FFE7E9'
    });
  }

  drawPanel(panelX + innerPad, statY, statW, statH, {
    radius: u * 0.34,
    top: 'rgba(22,20,14,0.92)',
    bottom: 'rgba(12,10,8,0.9)',
    accent: 'rgba(255,215,90,0.24)',
    blur: 14
  });
  drawPanel(panelX + panelW - innerPad - statW, statY, statW, statH, {
    radius: u * 0.34,
    top: 'rgba(18,24,14,0.92)',
    bottom: 'rgba(10,14,8,0.9)',
    accent: 'rgba(140,255,150,0.22)',
    blur: 14
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = compact ? (Math.round(u * 0.28) + 'px monospace') : (FONTS['n0.32'] || (Math.round(u * 0.32) + 'px monospace'));
  ctx.fillStyle = 'rgba(188,202,228,0.68)';
  ctx.fillText('SCORE', panelX + innerPad + statW / 2, statY + u * 0.38);
  ctx.fillText('TIME BONUS', panelX + panelW - innerPad - statW / 2, statY + u * 0.38);
  ctx.font = compact ? ('bold ' + Math.round(u * 0.52) + 'px monospace') : (FONTS['b0.6'] || ('bold ' + Math.round(u * 0.6) + 'px monospace'));
  ctx.fillStyle = '#FFE27A';
  ctx.fillText(`${G.runScore}`, panelX + innerPad + statW / 2, statY + u * 0.92);
  ctx.fillStyle = '#7FFAA0';
  ctx.fillText(`+${timeBonus}`, panelX + panelW - innerPad - statW / 2, statY + u * 0.92);

  ctx.font = compact ? (Math.round(u * 0.28) + 'px monospace') : (FONTS['n0.32'] || (Math.round(u * 0.32) + 'px monospace'));
  ctx.fillStyle = 'rgba(188,202,228,0.7)';
  ctx.fillText(stars === 3 ? 'THREE STAR CLEAR' : (stars === 2 ? 'SOLID CLEAR' : 'LEVEL SURVIVED'), W / 2, panelY + u * 5.15);
  for (let s = 0; s < 3; s++) {
    const sx = W / 2 + (s - 1) * u * 1.35;
    const ready = stars > s && G.levelCompleteTimer > 0.55 + s * 0.25;
    const starScale = ready ? 1 + Math.sin((G.levelCompleteTimer - s * 0.1) * 5) * 0.05 : 1;
    ctx.save();
    ctx.translate(sx, panelY + u * 6.05);
    ctx.scale(starScale, starScale);
    drawPanel(-u * 0.48, -u * 0.48, u * 0.96, u * 0.96, {
      radius: u * 0.28,
      top: 'rgba(20,20,22,0.92)',
      bottom: 'rgba(10,10,12,0.88)',
      stroke: ready ? 'rgba(255,220,120,0.24)' : 'rgba(255,255,255,0.06)',
      accent: ready ? 'rgba(255,215,90,0.24)' : 'rgba(110,120,150,0.12)',
      blur: 10,
      glossAlpha: 0.08
    });
    drawStarShape(0, 0, u * 0.28, ready ? '#FFD45E' : 'rgba(120,130,155,0.42)', ready ? 'rgba(255,245,190,0.2)' : 'rgba(255,255,255,0.04)');
    ctx.restore();
  }

  if (guideCopy) {
    drawMiniChip(panelX + innerPad, guideY, panelW - innerPad * 2, u * 0.64, guideCopy.toUpperCase(), {
      font: FONTS['b0.3'] || ('bold ' + Math.round(u * 0.3) + 'px monospace'),
      accent: rewardReadyHint ? 'rgba(255,194,70,0.24)' : 'rgba(120,220,255,0.2)',
      textColor: rewardReadyHint ? '#FFE7B2' : 'rgba(236,244,255,0.82)'
    });
  }

  if (G.levelCompleteTimer > 1.5) {
    const footerLabel = rewardReadyHint
      ? (G.levelCompleteTimer > 2.8 ? 'TAP FOR BONUS SPIN - THEN CLAIM MISSIONS' : 'BONUS SPIN -> CLAIM MISSIONS')
      : (G.levelCompleteTimer > 2.8 ? 'TAP ANYWHERE FOR BONUS SPIN' : 'BONUS SPIN READY');
    const nextAlpha = 0.55 + Math.sin(Date.now() * 0.005) * 0.25;
    ctx.save();
    ctx.globalAlpha = Math.max(0.18, nextAlpha);
    drawMiniChip(W / 2 - footerW / 2, footerY, footerW, u * 0.92, footerLabel, {
      font: FONTS['b0.4'] || ('bold ' + Math.round(u * 0.4) + 'px monospace'),
      accent: 'rgba(255,215,90,0.24)',
      textColor: '#F5F7FF'
    });
    ctx.restore();
  }
}

function getLevelMapLayout() {
  const u = UNIT;
  const topPad = SAFE_TOP + u * 0.28;
  const speakerX = SAFE_LEFT + u * 0.3;
  const speakerY = SAFE_TOP + u * 0.3;
  const speakerSize = u * 1;
  const settingsW = u * 1.15;
  const settingsH = u * 0.95;
  const settingsX = SAFE_LEFT + u * 1.6;
  const settingsY = topPad;
  const shopW = u * 3.2;
  const shopH = u * 0.95;
  const statsW = u * 3.2;
  const statsH = u * 0.95;
  const statsX = W - SAFE_RIGHT - statsW - u * 0.32;
  const statsY = topPad;
  const shopX = statsX - shopW - u * 0.28;
  const shopY = topPad;
  const headerX = SAFE_LEFT + u * 0.55;
  const headerY = topPad + u * 1.18;
  const headerW = W - SAFE_LEFT - SAFE_RIGHT - u * 1.1;
  const headerH = u * 1.88;
  const quickGap = u * 0.28;
  const quickH = u * 0.88;
  const quickTotalW = Math.min(W - SAFE_LEFT - SAFE_RIGHT - u * 1.1, u * 9.6);
  const missionW = quickTotalW * 0.46;
  const loginW = quickTotalW - missionW - quickGap;
  const quickX = W / 2 - quickTotalW / 2;
  const missionX = quickX;
  const loginX = missionX + missionW + quickGap;
  const quickY = headerY + headerH + u * 0.24;
  const mapTop = quickY + quickH + u * 0.42;
  const infoY = H - SAFE_BOTTOM - u * 2.08;
  const infoH = u * 0.66;
  const runnerW = u * 4.4;
  const progressW = u * 4.3;
  const runnerX = W / 2 - runnerW - u * 0.16;
  const progressX = W / 2 + u * 0.16;
  const actionW = u * 5.1;
  const actionH = u * 1.02;
  const actionY = H - SAFE_BOTTOM - actionH - u * 0.42;
  const resumeX = W * 0.33 - actionW / 2;
  const newRunX = W * 0.67 - actionW / 2;
  const centerActionX = W / 2 - actionW / 2;
  const nextW = u * 7.2;
  const nextX = W / 2 - nextW / 2;
  const endlessW = u * 5.2;
  const endlessH = u * 0.74;
  const endlessX = W / 2 - endlessW / 2;
  const endlessY = infoY - u * 0.84;
  const mapBot = infoY - u * 0.34;
  return {
    speakerX, speakerY, speakerSize,
    settingsX, settingsY, settingsW, settingsH,
    shopX, shopY, shopW, shopH,
    statsX, statsY, statsW, statsH,
    headerX, headerY, headerW, headerH,
    missionX, loginX, quickY, missionW, loginW, quickH,
    infoY, infoH, runnerX, runnerW, progressX, progressW,
    actionW, actionH, actionY, resumeX, newRunX, centerActionX,
    nextX, nextW, endlessX, endlessY, endlessW, endlessH,
    mapTop, mapBot
  };
}

function drawLevelMap(dt) {
  const u = UNIT;
  const layout = getLevelMapLayout();
  const dlToday = localDateStr(new Date());
  const dlClaimed = save.lastLoginDate === dlToday;
  const unclaimedN = getUnclaimedMissionCount();
  const runner = CHARS[safeSelectedChar()] || CHARS[0];
  const hasNextLevel = G._nextLevelNum && G._nextLevelNum > 0;
  const canResume = save.savedLevel > 1 && (save.cooldownEnd-Date.now()) <= 0;
  const guidedGoal = getUpcomingGuidedGoal(hasNextLevel ? G._nextLevelNum : (save.highestLevel + 1));
  const rewardReadyHint = getRewardReadyHint(save.highestLevel || G.levelNum || 1);
  const missionLabel = unclaimedN > 0
    ? (unclaimedN === 1 ? 'CLAIM 1 MISSION' : `CLAIM ${unclaimedN} MISSIONS`)
    : 'MISSIONS';

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#050d1e');
  bg.addColorStop(0.38, '#0a1628');
  bg.addColorStop(0.72, '#111d34');
  bg.addColorStop(1, '#090f1f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (_perfLevel > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const nt = (G.time || Date.now() * 0.001) * 0.26;
    for (let i = 0; i < 4; i++) {
      const nx = W * (0.22 + i * 0.18) + Math.sin(nt + i * 1.7) * W * 0.12;
      const ny = H * (0.16 + i * 0.1) + Math.cos(nt * 0.8 + i * 1.4) * H * 0.08;
      const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, H * 0.28);
      const hue = (nt * 32 + i * 58) % 360;
      g.addColorStop(0, `hsla(${hue},72%,56%,0.08)`);
      g.addColorStop(0.48, `hsla(${hue},64%,42%,0.04)`);
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  drawMiniChip(layout.shopX, layout.shopY, layout.shopW, layout.shopH, 'SHOP', {
    font: FONTS['b0.4'] || ('bold ' + Math.round(u * 0.4) + 'px monospace'),
    accent: 'rgba(255,208,90,0.28)',
    textColor: '#FFE27A'
  });
  drawMiniChip(layout.statsX, layout.statsY, layout.statsW, layout.statsH, 'STATS', {
    font: FONTS['b0.4'] || ('bold ' + Math.round(u * 0.4) + 'px monospace'),
    accent: 'rgba(120,180,255,0.24)',
    textColor: '#CBE4FF'
  });
  drawMiniChip(layout.settingsX, layout.settingsY, layout.settingsW, layout.settingsH, 'SET', {
    font: FONTS['b0.34'] || ('bold ' + Math.round(u * 0.34) + 'px monospace'),
    accent: 'rgba(255,255,255,0.12)',
    textColor: 'rgba(244,247,255,0.76)'
  });

  drawPanel(layout.headerX, layout.headerY, layout.headerW, layout.headerH, {
    radius: u * 0.42,
    top: 'rgba(18,28,46,0.92)',
    bottom: 'rgba(8,12,24,0.9)',
    stroke: 'rgba(255,255,255,0.12)',
    accent: 'rgba(255,215,90,0.2)',
    blur: 20
  });
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const _headerInner = layout.headerW - u * 1.0;
  ctx.font = compact ? ('bold ' + Math.round(u * 0.62) + 'px monospace') : (FONTS['b0.72'] || ('bold ' + Math.round(u * 0.72) + 'px monospace'));
  ctx.fillStyle = '#FFE27A';
  ctx.fillText("GRONK'S JOURNEY", layout.headerX + u * 0.5, layout.headerY + u * 0.3);
  ctx.font = FONTS['n0.28'] || (Math.round(u * 0.28) + 'px monospace');
  ctx.fillStyle = 'rgba(192,208,232,0.7)';
  ctx.fillText(`BEST ${save.bestScore}  |  TOTAL GEMS ${save.totalGems}`, layout.headerX + u * 0.5, layout.headerY + u * 1.12);
  ctx.textAlign = 'right';
  ctx.font = compact ? ('bold ' + Math.round(u * 0.3) + 'px monospace') : (FONTS['b0.34'] || ('bold ' + Math.round(u * 0.34) + 'px monospace'));
  ctx.fillStyle = 'rgba(244,247,255,0.78)';
  ctx.fillText(`CURRENT LEVEL ${save.highestLevel + 1}`, layout.headerX + layout.headerW - u * 0.5, layout.headerY + u * 0.36);
  ctx.font = FONTS['n0.24'] || (Math.round(u * 0.24) + 'px monospace');
  ctx.fillStyle = 'rgba(160,182,210,0.66)';
  let _mapHint = rewardReadyHint || (guidedGoal ? guidedGoal.mapHint : 'Tap a node to replay or push forward.');
  const _maxHintW = _headerInner * 0.52;
  while (_mapHint.length > 10 && ctx.measureText(_mapHint).width > _maxHintW) _mapHint = _mapHint.slice(0, -1);
  if (_mapHint.length < (rewardReadyHint || (guidedGoal ? guidedGoal.mapHint : '')).length) _mapHint += '...';
  ctx.fillText(_mapHint, layout.headerX + layout.headerW - u * 0.5, layout.headerY + u * 0.88);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  drawMiniChip(layout.missionX, layout.quickY, layout.missionW, layout.quickH, missionLabel, {
    font: FONTS['b0.42'] || ('bold ' + Math.round(u * 0.42) + 'px monospace'),
    accent: unclaimedN>0 ? 'rgba(255,194,70,0.3)' : 'rgba(110,210,130,0.22)',
    textColor: unclaimedN>0 ? '#FFD45E' : '#D8FFE2'
  });
  if(unclaimedN>0) drawNotifDot(layout.missionX + layout.missionW - u*0.1, layout.quickY + u*0.1, unclaimedN, u);
  drawMiniChip(layout.loginX, layout.quickY, layout.loginW, layout.quickH, dlClaimed ? 'LOGIN CLAIMED' : 'DAILY LOGIN', {
    font: FONTS['b0.4'] || ('bold ' + Math.round(u * 0.4) + 'px monospace'),
    accent: dlClaimed ? 'rgba(110,120,150,0.18)' : 'rgba(255,126,84,0.32)',
    textColor: dlClaimed ? 'rgba(170,182,205,0.58)' : '#FFC39A'
  });
  if(!dlClaimed) drawNotifDot(layout.loginX + layout.loginW - u*0.1, layout.quickY + u*0.1, 1, u);

  const mapTop = layout.mapTop, mapBot = layout.mapBot;
  const mapH = mapBot - mapTop;
  const totalLevels = 40;
  const nodeSpacingY = u*4;
  const totalMapH = totalLevels * nodeSpacingY + u*6;
  const maxScroll = Math.max(0, totalMapH - mapH);
  if (G._prevPhase !== 'LEVEL_MAP') {
    const curLvl = Math.min(save.highestLevel+1, totalLevels);
    G.mapTargetScrollY = clamp(curLvl * nodeSpacingY - mapH/2, 0, maxScroll);
    G.mapScrollY = G.mapTargetScrollY;
  }
  G.mapScrollY = lerp(G.mapScrollY, G.mapTargetScrollY, 8*dt);
  G.mapScrollY = clamp(G.mapScrollY, 0, maxScroll);
  G.mapTargetScrollY = clamp(G.mapTargetScrollY, 0, maxScroll);

  ctx.save();
  ctx.beginPath(); ctx.rect(0, mapTop, W, mapH); ctx.clip();
  const _starT = (G.time||Date.now()*.001);
  for(let i=0;i<60;i++){
    const sx=((i*137.5+42)%W), sy=((i*73.3+19)%(totalMapH))-G.mapScrollY+mapTop;
    if(sy<mapTop-10||sy>mapBot+10) continue;
    var tw = 0.08+((i*7)%5)*0.05 + Math.sin(_starT*2+i*1.7)*0.08;
    ctx.fillStyle=`rgba(255,255,255,${tw})`;
    ctx.beginPath();ctx.arc(sx,sy,0.5+((i*3)%3)*0.4,0,PI2);ctx.fill();
  }

  for(let lvl=1; lvl<=totalLevels; lvl++) {
    const def = getLevelDef(lvl);
    const thm = THEMES[def.theme];
    const isBoss = lvl % 5 === 0;
    const ny = mapBot - u*1.5 - (lvl * nodeSpacingY) + G.mapScrollY + nodeSpacingY;
    const zigzag = (lvl%2===0) ? W*0.32 : W*0.68;
    const nx = zigzag + Math.sin(lvl*0.8)*W*0.08;
    if (ny < mapTop-u*4 || ny > mapBot+u*4) continue;

    if (lvl < totalLevels) {
      const ny2 = mapBot - u*1.5 - ((lvl+1)*nodeSpacingY) + G.mapScrollY + nodeSpacingY;
      const nx2Zig = ((lvl+1)%2===0) ? W*0.32 : W*0.68;
      const nx2 = nx2Zig + Math.sin((lvl+1)*0.8)*W*0.08;
      const cpX = (nx+nx2)/2, cpY = (ny+ny2)/2;
      ctx.strokeStyle = lvl <= save.highestLevel ? 'rgba(255,215,90,0.55)' : 'rgba(96,108,142,0.34)';
      ctx.lineWidth = lvl <= save.highestLevel ? u * 0.16 : u * 0.1;
      ctx.setLineDash(lvl <= save.highestLevel ? [] : [u*.24, u*.2]);
      ctx.beginPath();
      ctx.moveTo(nx, ny);
      ctx.quadraticCurveTo(cpX + Math.sin(lvl) * u * 2, cpY, nx2, ny2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const completed = lvl <= save.highestLevel;
    const current = lvl === save.highestLevel+1;
    const locked = lvl > save.highestLevel+1;
    const nodeR = isBoss ? u*1.45 : u*1.12;
    const halo = ctx.createRadialGradient(nx, ny, 0, nx, ny, nodeR * 1.5);
    if (current) {
      halo.addColorStop(0, 'rgba(255,235,120,0.3)');
      halo.addColorStop(1, 'rgba(255,235,120,0)');
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(nx, ny, nodeR * 1.5, 0, PI2); ctx.fill();
    }

    const core = ctx.createRadialGradient(nx-nodeR*.2, ny-nodeR*.2, 0, nx, ny, nodeR);
    if (locked) {
      core.addColorStop(0, 'rgba(80,92,120,0.92)');
      core.addColorStop(1, 'rgba(42,48,66,0.92)');
    } else {
      core.addColorStop(0, thm.sky[2] || thm.sky[1]);
      core.addColorStop(1, thm.sky[0]);
    }
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(nx, ny, nodeR, 0, PI2); ctx.fill();
    ctx.strokeStyle = current ? '#FFE27A' : completed ? '#FFD45E' : 'rgba(120,130,155,0.45)';
    ctx.lineWidth = isBoss ? 4 : 2.5;
    ctx.stroke();

    ctx.font = FONTS['b0.52'] || ('bold ' + Math.round(u * 0.52) + 'px monospace');
    ctx.fillStyle = locked ? 'rgba(200,208,230,0.42)' : '#F5F7FF';
    ctx.fillText(`${lvl}`, nx, ny + u * 0.03);

    if (completed) {
      const stars = save.levelStars[lvl] || 0;
      for(let s=0;s<3;s++){
        const sdx = (s-1)*u*.42;
        drawStarShape(nx + sdx, ny + nodeR + u * 0.42, u * 0.14, s < stars ? '#FFD45E' : 'rgba(90,100,128,0.45)', null);
      }
    } else if (current) {
      ctx.fillStyle = '#FFE27A';
      ctx.beginPath();
      ctx.moveTo(nx-u*.2, ny-u*.28);
      ctx.lineTo(nx+u*.34, ny);
      ctx.lineTo(nx-u*.2, ny+u*.28);
      ctx.closePath();
      ctx.fill();
    } else if (locked) {
      ctx.strokeStyle='rgba(214,220,236,0.38)';
      ctx.lineWidth=u*.06;
      ctx.beginPath();ctx.arc(nx,ny-u*.14,u*.18,Math.PI,0);ctx.stroke();
      ctx.fillStyle='rgba(120,130,155,0.42)';
      ctx.fillRect(nx-u*.22,ny-u*.02,u*.44,u*.28);
    }

    const showLabel = current || isBoss || Math.abs(lvl - (save.highestLevel + 1)) <= 1;
    if (showLabel) {
      const label = isBoss ? 'BOSS - ' + def.name.toUpperCase() : def.name.toUpperCase();
      const lw = Math.min(u * 4.6, Math.max(u * 2.2, label.length * u * 0.23 + u * 0.7));
      const lx = (lvl%2===0) ? nx+nodeR+u*0.45 : nx-nodeR-u*0.45-lw;
      const ly = ny - u * 0.38;
      drawMiniChip(lx, ly, lw, u * 0.72, label, {
        font: FONTS['b0.32'] || ('bold ' + Math.round(u * 0.32) + 'px monospace'),
        accent: locked ? 'rgba(110,120,150,0.18)' : completed ? 'rgba(255,215,90,0.18)' : 'rgba(120,220,255,0.18)',
        textColor: locked ? 'rgba(178,186,206,0.48)' : 'rgba(245,247,255,0.82)',
        radius: u * 0.22,
        blur: 10
      });
    }
  }
  ctx.restore();

  drawMiniChip(layout.runnerX, layout.infoY, layout.runnerW, layout.infoH, 'RUNNER ' + runner.name.toUpperCase(), {
    font: FONTS['b0.34'] || ('bold ' + Math.round(u * 0.34) + 'px monospace'),
    accent: lightenColor(runner.col, 12),
    textColor: '#F5F7FF'
  });
  drawMiniChip(layout.progressX, layout.infoY, layout.progressW, layout.infoH, rewardReadyHint ? 'CLAIM BONUS GEMS' : guidedGoal ? ('NEXT ' + guidedGoal.steps.map(function(step) { return step.short; }).join(' + ')) : `CLEARED ${save.highestLevel}/40`, {
    font: FONTS['b0.34'] || ('bold ' + Math.round(u * 0.34) + 'px monospace'),
    accent: rewardReadyHint ? 'rgba(255,194,70,0.24)' : guidedGoal ? 'rgba(125,240,155,0.2)' : 'rgba(120,188,255,0.24)',
    textColor: rewardReadyHint ? '#FFECC8' : guidedGoal ? '#E7FFF0' : '#D8ECFF'
  });

  if (hasNextLevel) {
    drawActionCard(layout.nextX, layout.actionY, layout.nextW, layout.actionH, `NEXT LEVEL ${G._nextLevelNum}`, guidedGoal ? guidedGoal.title.toUpperCase() : null, {
      top: '#2F7A48',
      bottom: '#184327',
      stroke: '#76DEA0',
      accent: '#4ED37D',
      labelColor: '#F7FFF8',
      subColor: 'rgba(214,255,226,0.78)',
      labelFont: FONTS['b0.56'] || ('bold ' + Math.round(u * 0.56) + 'px monospace')
    });
  } else {
    if (canResume) {
      drawActionCard(layout.resumeX, layout.actionY, layout.actionW, layout.actionH, 'RESUME RUN', `LEVEL ${save.savedLevel}`, {
        top: '#2F7A48',
        bottom: '#184327',
        stroke: '#76DEA0',
        accent: '#4ED37D',
        labelColor: '#F7FFF8',
        subColor: 'rgba(214,255,226,0.76)',
        labelFont: FONTS['b0.54'] || ('bold ' + Math.round(u * 0.54) + 'px monospace')
      });
    }
    drawActionCard(canResume ? layout.newRunX : layout.centerActionX, layout.actionY, layout.actionW, layout.actionH, guidedGoal ? guidedGoal.cta : 'NEW RUN', guidedGoal ? guidedGoal.mapHint : null, {
      top: 'rgba(44,64,114,0.96)',
      bottom: 'rgba(22,30,58,0.92)',
      stroke: 'rgba(167,192,255,0.36)',
      accent: '#6288D9',
      labelColor: '#EDF4FF',
      subColor: 'rgba(214,228,255,0.72)',
      labelFont: FONTS['b0.54'] || ('bold ' + Math.round(u * 0.54) + 'px monospace')
    });
    if(save.highestLevel >= 40){
      drawMiniChip(layout.endlessX, layout.endlessY, layout.endlessW, layout.endlessH, `ENDLESS${save.endlessBest>0?' '+save.endlessBest:''}`, {
        font: FONTS['b0.38'] || ('bold ' + Math.round(u * 0.38) + 'px monospace'),
        accent: 'rgba(214,106,255,0.22)',
        textColor: '#EAB8FF'
      });
    }
  }

  if (maxScroll > 0) {
    drawMiniChip(W/2-u*2.4, mapTop+u*0.2, u*4.8, u*0.62, 'SWIPE TO SCROLL', {
      font: FONTS['b0.3'] || ('bold ' + Math.round(u * 0.3) + 'px monospace'),
      accent: 'rgba(255,255,255,0.08)',
      textColor: 'rgba(226,232,244,0.55)',
      blur: 8,
      radius: u * 0.18
    });
  }
  drawSpeakerIcon(SAFE_LEFT+u*.3, SAFE_TOP+u*.3, u*1);
}

function drawObs(obs,sx,sy,theme){
  ctx.save();
  ctx.translate(sx,sy);
  var u=UNIT;
  var pulse=Math.sin((G.time||0)*5+(obs.lx||0)*0.02)*0.5+0.5;
  switch(obs.type){
    case"ROCK":{
      var rkMid=theme===THEMES.GLACIER?"#78A9C8":theme===THEMES.VOLCANO?"#7A3921":theme===THEMES.SWAMP?"#6A5947":"#6A5843";
      var rkDark=theme===THEMES.GLACIER?"#4B7492":theme===THEMES.VOLCANO?"#4A1B0A":theme===THEMES.SWAMP?"#3F3125":"#443224";
      var rkLite=theme===THEMES.GLACIER?"#D8F3FF":theme===THEMES.VOLCANO?"#F7A75A":theme===THEMES.SWAMP?"#AA9774":"#C0A57C";
      ctx.fillStyle='rgba(0,0,0,0.22)';ctx.beginPath();ctx.ellipse(u*.08,0,u*.92,u*.16,0,0,PI2);ctx.fill();
      ctx.fillStyle=rkMid;ctx.beginPath();
      ctx.moveTo(-u*.92,-u*.2);ctx.lineTo(-u*.72,-u*.92);ctx.lineTo(-u*.18,-u*1.24);
      ctx.lineTo(u*.48,-u*1.12);ctx.lineTo(u*.92,-u*.62);ctx.lineTo(u*.84,0);
      ctx.lineTo(-u*.88,0);ctx.closePath();ctx.fill();
      ctx.fillStyle=rkDark;ctx.beginPath();
      ctx.moveTo(u*.08,-u*1.18);ctx.lineTo(u*.52,-u*1.06);ctx.lineTo(u*.88,-u*.58);
      ctx.lineTo(u*.8,0);ctx.lineTo(u*.12,0);ctx.lineTo(u*.18,-u*.56);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.16)';ctx.beginPath();
      ctx.moveTo(-u*.58,-u*.84);ctx.lineTo(-u*.2,-u*1.06);ctx.lineTo(u*.02,-u*.82);
      ctx.lineTo(-u*.24,-u*.64);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.18)';ctx.lineWidth=u*.04;
      ctx.beginPath();ctx.moveTo(-u*.22,-u*1.02);ctx.lineTo(-u*.02,-u*.52);ctx.lineTo(-u*.16,-u*.16);ctx.stroke();
      if(theme===THEMES.VOLCANO){
        ctx.strokeStyle='rgba(255,120,0,'+(0.35+pulse*0.35)+')';ctx.lineWidth=u*.07;ctx.shadowColor='#FF6600';ctx.shadowBlur=10;
        ctx.beginPath();ctx.moveTo(-u*.32,-u*.72);ctx.lineTo(-u*.12,-u*.42);ctx.lineTo(-u*.34,-u*.14);ctx.stroke();
        ctx.beginPath();ctx.moveTo(u*.24,-u*.92);ctx.lineTo(u*.42,-u*.52);ctx.lineTo(u*.18,-u*.18);ctx.stroke();
        ctx.shadowBlur=0;
      } else if(theme===THEMES.GLACIER){
        ctx.fillStyle='rgba(255,255,255,0.58)';
        ctx.beginPath();ctx.moveTo(-u*.7,-u*.82);ctx.lineTo(-u*.24,-u*1.1);ctx.lineTo(u*.18,-u*.98);ctx.lineTo(-u*.08,-u*.72);ctx.closePath();ctx.fill();
      } else {
        ctx.fillStyle='rgba(88,150,74,0.26)';
        ctx.beginPath();ctx.arc(-u*.52,-u*.14,u*.1,0,PI2);ctx.arc(-u*.34,-u*.06,u*.08,0,PI2);ctx.fill();
      }
      break;}
    case"SPIKE":{
      var _sp=enemySprites.spikes;
      if(_sp&&_sp.ready){var _dH=u*2,_dW=_dH*(_sp.fw/_sp.fh);var _fr=getEnemyFrame("spikes","idle",G.time);if(_fr){ctx.drawImage(_fr.canvas,-_dW/2,-_dH,_dW,_dH);ctx.restore();return;}}
      var spMid=theme===THEMES.GLACIER?"#AAD8F3":theme===THEMES.VOLCANO?"#D45A18":"#9C978E";
      var spDark=theme===THEMES.GLACIER?"#6799B7":theme===THEMES.VOLCANO?"#822A08":"#58534E";
      ctx.fillStyle='rgba(0,0,0,0.2)';ctx.beginPath();ctx.ellipse(0,u*.02,u*.96,u*.14,0,0,PI2);ctx.fill();
      if(theme===THEMES.VOLCANO){
        ctx.fillStyle='rgba(255,96,32,'+(0.18+pulse*0.18)+')';ctx.beginPath();ctx.ellipse(0,0,u*1.18,u*.26,0,0,PI2);ctx.fill();
      }
      ctx.fillStyle=spDark;ctx.beginPath();ctx.moveTo(-u*.86,0);ctx.quadraticCurveTo(0,-u*.34,u*.86,0);ctx.lineTo(-u*.86,0);ctx.fill();
      for(var i=0;i<3;i++){
        var off=(i-1)*u*.34;
        var h=u*(i===1?1.38:1.02);
        ctx.fillStyle=i===1?spMid:spDark;
        ctx.beginPath();ctx.moveTo(off-u*.18,0);ctx.lineTo(off+u*.18,0);ctx.lineTo(off,h*-1);ctx.closePath();ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.16)';ctx.beginPath();ctx.moveTo(off-u*.08,-u*.04);ctx.lineTo(off,-h*0.9);ctx.lineTo(off+u*.02,-u*.04);ctx.closePath();ctx.fill();
      }
      if(theme===THEMES.GLACIER){
        ctx.fillStyle='rgba(255,255,255,0.6)';ctx.beginPath();ctx.arc(0,-u*1.34,u*.05,0,PI2);ctx.fill();
      }
      break;}
    case"BOULDER":{
      var r=u*1.08;
      var bMid=theme===THEMES.GLACIER?"#6B9FBD":theme===THEMES.VOLCANO?"#6B341A":"#574334";
      var bDark=theme===THEMES.GLACIER?"#486B86":theme===THEMES.VOLCANO?"#42200E":"#34271D";
      var bLite=theme===THEMES.GLACIER?"#BDEBFF":theme===THEMES.VOLCANO?"#B96B2B":"#9A835E";
      ctx.fillStyle='rgba(0,0,0,0.26)';ctx.beginPath();ctx.ellipse(0,r*.08,r*.95,r*.2,0,0,PI2);ctx.fill();
      ctx.fillStyle=bMid;ctx.beginPath();ctx.arc(0,-r*.86,r,0,PI2);ctx.fill();
      ctx.fillStyle=bDark;ctx.beginPath();ctx.arc(r*.12,-r*.78,r*.82,-.35,Math.PI*.7);ctx.lineTo(r*.12,-r*.78);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.18)';ctx.beginPath();ctx.arc(-r*.3,-r*1.08,r*.44,Math.PI*1.15,PI2);ctx.lineTo(-r*.3,-r*1.08);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,0.24)';ctx.lineWidth=u*.05;
      ctx.beginPath();ctx.moveTo(-r*.24,-r*1.3);ctx.lineTo(-r*.02,-r*.84);ctx.lineTo(-r*.14,-r*.34);ctx.stroke();
      ctx.beginPath();ctx.moveTo(r*.22,-r*.42);ctx.lineTo(r*.02,-r*.8);ctx.stroke();
      if(obs.vx){
        var rot=(G.time*3+(obs.lx||0)*0.01)%PI2;
        ctx.strokeStyle='rgba(0,0,0,0.16)';ctx.lineWidth=u*.04;ctx.beginPath();ctx.arc(0,-r*.86,r*.62,rot,rot+1.15);ctx.stroke();
        ctx.fillStyle='rgba(120,100,80,0.2)';ctx.beginPath();ctx.arc(r*.92,-r*.18,u*.24,0,PI2);ctx.arc(r*1.22,-r*.3,u*.18,0,PI2);ctx.fill();
      }
      if(theme===THEMES.VOLCANO){
        ctx.shadowColor='#FF5A00';ctx.shadowBlur=12*pulse;
        ctx.fillStyle='#FFB347';
        ctx.beginPath();ctx.arc(-r*.42,-r*1.16,r*.08,0,PI2);ctx.arc(r*.28,-r*.46,r*.1,0,PI2);ctx.fill();
        ctx.shadowBlur=0;
      } else if(theme===THEMES.GLACIER){
        ctx.fillStyle='rgba(225,245,255,0.52)';ctx.beginPath();ctx.moveTo(-r*.72,-r*.96);ctx.lineTo(-r*.08,-r*1.3);ctx.lineTo(r*.18,-r*.98);ctx.closePath();ctx.fill();
      } else {
        ctx.fillStyle='rgba(94,150,82,0.22)';ctx.beginPath();ctx.arc(-r*.64,-r*.16,u*.08,0,PI2);ctx.arc(-r*.48,-r*.04,u*.06,0,PI2);ctx.fill();
      }
      break;}
    case"LOG":{
      var _lg=enemySprites.log;
      if(_lg&&_lg.ready){var _lh=u*1.8,_lw=_lh*(_lg.fw/_lg.fh);var _lfr=getEnemyFrame("log","idle",G.time);if(_lfr){ctx.drawImage(_lfr.canvas,-_lw/2,-_lh*.7,_lw,_lh);ctx.restore();return;}}
      ctx.fillStyle='rgba(0,0,0,0.22)';ctx.beginPath();ctx.ellipse(0,-u*.04,u*.98,u*.14,0,0,PI2);ctx.fill();
      ctx.fillStyle='#6A4928';ctx.beginPath();ctx.ellipse(0,-u*.48,u*.94,u*.56,0,0,PI2);ctx.fill();
      ctx.fillStyle='#5A391A';ctx.fillRect(-u*.96,-u*.14,u*1.92,u*.18);
      ctx.strokeStyle='#3F2812';ctx.lineWidth=u*.05;
      ctx.beginPath();ctx.ellipse(0,-u*.48,u*.58,u*.34,0,0,PI2);ctx.stroke();
      ctx.beginPath();ctx.ellipse(0,-u*.48,u*.28,u*.16,0,0,PI2);ctx.stroke();
      for(var bark=0;bark<5;bark++){var bx=-u*.72+bark*u*.36;ctx.beginPath();ctx.moveTo(bx,-u*.14);ctx.lineTo(bx,-u*.92);ctx.stroke();}
      if(theme===THEMES.JUNGLE||theme===THEMES.SWAMP){
        ctx.strokeStyle='rgba(92,160,90,0.48)';ctx.lineWidth=u*.05;ctx.beginPath();ctx.moveTo(-u*.18,-u*.92);ctx.quadraticCurveTo(-u*.36,-u*1.18,-u*.08,-u*1.28);ctx.stroke();
        ctx.fillStyle='rgba(108,190,106,0.28)';ctx.beginPath();ctx.ellipse(-u*.04,-u*1.26,u*.12,u*.06,.2,0,PI2);ctx.fill();
      }
      break;}
    case"FIRE_GEYSER":{
      var _fg=enemySprites.fire_geyser;
      var erupt=Math.sin(G.time*4+(obs.lx||0)*.02);
      if(_fg&&_fg.ready){var _as=erupt>0?"attack":"idle";var _fh=u*3.4,_fw=_fh*(_fg.fw/_fg.fh);var _ffr=getEnemyFrame("fire_geyser",_as,erupt>0?(1-erupt)*2.2:0);if(_ffr){ctx.drawImage(_ffr.canvas,-_fw/2,-_fh,_fw,_fh);ctx.restore();return;}}
      ctx.fillStyle='rgba(0,0,0,0.24)';ctx.beginPath();ctx.ellipse(0,0,u*.72,u*.16,0,0,PI2);ctx.fill();
      ctx.fillStyle='#2D170A';ctx.beginPath();ctx.ellipse(0,-u*.08,u*.58,u*.22,0,0,PI2);ctx.fill();
      ctx.fillStyle='#462312';ctx.beginPath();ctx.ellipse(0,-u*.12,u*.36,u*.1,0,0,PI2);ctx.fill();
      if(erupt>0){
        var h=erupt*u*2.65;
        ctx.shadowColor='rgba(255,130,0,0.72)';ctx.shadowBlur=18*erupt;
        ctx.fillStyle='rgba(255,92,0,0.8)';
        ctx.beginPath();ctx.moveTo(-u*.34,-u*.1);ctx.bezierCurveTo(-u*.48,-u*.72,u*.02,-u*1.2-h*.32,0,-u*.1-h);ctx.bezierCurveTo(u*.08,-u*1.12-h*.26,u*.44,-u*.7,u*.34,-u*.1);ctx.closePath();ctx.fill();
        ctx.fillStyle='rgba(255,190,64,0.72)';
        ctx.beginPath();ctx.moveTo(-u*.16,-u*.06);ctx.bezierCurveTo(-u*.2,-u*.54,u*.04,-u*.92-h*.24,0,-u*.06-h*.7);ctx.bezierCurveTo(u*.02,-u*.84-h*.2,u*.22,-u*.48,u*.16,-u*.06);ctx.closePath();ctx.fill();
        ctx.shadowBlur=0;
        for(var ember=0;ember<3;ember++){
          var ex=(ember-1)*u*.18+Math.sin(G.time*9+ember)*u*.08;
          var ey=-u*.3-h*(0.24+ember*0.18);
          ctx.fillStyle='rgba(255,210,120,'+(0.45-ember*0.08)+')';
          ctx.beginPath();ctx.arc(ex,ey,u*(0.05+ember*0.01),0,PI2);ctx.fill();
        }
      }
      break;}
    case"PTERO":{
      var _pt=enemySprites.ptero;
      if(_pt&&_pt.ready){var _ph=u*2.2,_pw=_ph*(_pt.fw/_pt.fh);var _pfr=getEnemyFrame("ptero","idle",G.time+(obs.phase||0)*0.1);if(_pfr){ctx.drawImage(_pfr.canvas,-_pw/2,-_ph*.5,_pw,_ph);ctx.restore();return;}}
      var wf=Math.sin(G.time*6+(obs.phase||0))*0.55;
      ctx.fillStyle='rgba(0,0,0,0.18)';ctx.beginPath();ctx.ellipse(0,u*.26,u*1.08,u*.16,0,0,PI2);ctx.fill();
      ctx.fillStyle=theme===THEMES.SKY?'#4B5F9E':theme===THEMES.VOLCANO?'#70301A':'#56306C';
      ctx.beginPath();ctx.ellipse(0,0,u*.62,u*.42,0,0,PI2);ctx.fill();
      ctx.fillStyle=theme===THEMES.SKY?'#7E97D6':theme===THEMES.VOLCANO?'#A24B24':'#8B51A4';
      for(var s=-1;s<=1;s+=2){
        ctx.beginPath();ctx.moveTo(s*u*.28,0);
        ctx.bezierCurveTo(s*u*1.52,-u*wf,s*u*2.05,u*(.42-wf),s*u*1.92,u*.56);
        ctx.bezierCurveTo(s*u*.98,u*.3,s*u*.5,u*.14,s*u*.28,0);ctx.fill();
      }
      ctx.fillStyle='rgba(255,255,255,0.16)';ctx.beginPath();ctx.moveTo(-u*.12,-u*.22);ctx.lineTo(u*.06,-u*.52);ctx.lineTo(u*.16,-u*.2);ctx.closePath();ctx.fill();
      ctx.fillStyle='#D58C54';ctx.beginPath();ctx.moveTo(u*.42,-u*.02);ctx.lineTo(u*.94,u*.06);ctx.lineTo(u*.42,u*.14);ctx.closePath();ctx.fill();
      ctx.fillStyle='#FF5A5A';ctx.beginPath();ctx.arc(u*.22,-u*.14,u*.06,0,PI2);ctx.fill();
      break;}
    case"ICE_PILLAR":{
      var h=u*2.7;
      ctx.fillStyle='rgba(0,0,0,0.18)';ctx.beginPath();ctx.ellipse(0,0,u*.54,u*.12,0,0,PI2);ctx.fill();
      ctx.fillStyle='rgba(170,226,255,0.82)';ctx.beginPath();ctx.moveTo(-u*.46,0);ctx.lineTo(-u*.26,-h*.9);ctx.lineTo(0,-h);ctx.lineTo(u*.26,-h*.86);ctx.lineTo(u*.46,0);ctx.closePath();ctx.fill();
      ctx.fillStyle='rgba(220,245,255,0.44)';ctx.beginPath();ctx.moveTo(-u*.12,-h*.84);ctx.lineTo(0,-h*.1);ctx.lineTo(u*.1,-h*.76);ctx.closePath();ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.62)';ctx.lineWidth=u*.05;ctx.beginPath();ctx.moveTo(-u*.08,-h*.88);ctx.lineTo(-u*.06,-u*.08);ctx.moveTo(u*.14,-h*.6);ctx.lineTo(u*.08,-u*.18);ctx.stroke();
      break;}
    case"TREASURE_CRATE":{
      ctx.fillStyle='rgba(0,0,0,0.18)';ctx.fillRect(-u*.66,-u*.02,u*1.32,u*.14);
      ctx.fillStyle='#8B4A1A';ctx.fillRect(-u*.62,-u*1.18,u*1.24,u*1.18);
      ctx.fillStyle='#6B3611';ctx.fillRect(-u*.62,-u*1.18,u*1.24,u*.2);
      ctx.strokeStyle='#55270B';ctx.lineWidth=u*.05;ctx.strokeRect(-u*.62,-u*1.18,u*1.24,u*1.18);
      ctx.strokeStyle='#D8A93B';ctx.lineWidth=u*.08;ctx.strokeRect(-u*.58,-u*1.12,u*1.16,u*1.04);
      ctx.beginPath();ctx.moveTo(-u*.58,-u*.62);ctx.lineTo(u*.58,-u*.62);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,-u*1.12);ctx.lineTo(0,-u*.08);ctx.stroke();
      ctx.fillStyle='#FFD45E';ctx.fillRect(-u*.12,-u*.7,u*.24,u*.26);
      ctx.fillStyle='rgba(255,255,255,0.2)';ctx.fillRect(-u*.46,-u*1.04,u*.68,u*.12);
      break;}
  }
  ctx.restore();
}

function drawEnemies(){
  for(var _ei=0;_ei<activeEnemies.length;_ei++){
    var en=activeEnemies[_ei];
    if(!en.alive)continue;
    var sx=en.sx, sy=en.sy, u=UNIT;
    var drawX=en.screenX!==undefined?en.screenX:sx;
    var drawY=en.y!==undefined?en.y:sy;
    var enemyAlpha=en.dying?clamp(en.deathTimer/0.4,0,1):1;
    ctx.save();
    ctx.globalAlpha=enemyAlpha;
    ctx.fillStyle='rgba(0,0,0,0.28)';ctx.beginPath();ctx.ellipse(drawX,drawY,u*1.22,u*.28,0,0,PI2);ctx.fill();
    var _enAnimState="idle";
    if(en.telegraphing||(en.fireCD!==undefined&&en.fireCD<=0.3)) _enAnimState="attack";
    if(en.hpFlash>0) _enAnimState="hit";
    switch(en.type){
      case "TROLL":{
        ctx.translate(sx,sy);
        var _sp=enemySprites.troll;
        if(_sp&&_sp.ready){var _dH=u*3.2,_dW=_dH*(_sp.fw/_sp.fh);drawEnemySpriteFrame("troll",_enAnimState,en.phase,_dW,_dH,false);}
        else{
          var sway=Math.sin((en.phase||G.time)*2.2)*u*.08;
          var clubLift=_enAnimState==="attack"?-1.05+Math.sin(G.time*18)*0.16:-0.35+Math.sin(G.time*4)*0.08;
          ctx.translate(sway,0);
          ctx.fillStyle='#2C5A24';
          ctx.fillRect(-u*.62,-u*.16,u*.24,u*.78);
          ctx.fillRect(u*.18,-u*.16,u*.24,u*.78);
          ctx.fillStyle='#6D4E2A';ctx.beginPath();ctx.ellipse(-u*.5,u*.56,u*.26,u*.12,0,0,PI2);ctx.ellipse(u*.3,u*.56,u*.26,u*.12,0,0,PI2);ctx.fill();
          ctx.fillStyle='#4B8B40';ctx.beginPath();ctx.ellipse(0,-u*1.24,u*1.06,u*1.34,0,0,PI2);ctx.fill();
          ctx.fillStyle='#7FB768';ctx.beginPath();ctx.ellipse(0,-u*.98,u*.58,u*.72,0,0,PI2);ctx.fill();
          ctx.fillStyle='#3A6E32';ctx.beginPath();ctx.ellipse(-u*.96,-u*1.26,u*.28,u*.54,-.35,0,PI2);ctx.ellipse(u*.92,-u*1.18,u*.28,u*.5,.4,0,PI2);ctx.fill();
          ctx.save();ctx.translate(u*.84,-u*1.22);ctx.rotate(clubLift);
          ctx.fillStyle='#5C391C';ctx.fillRect(-u*.08,-u*.06,u*.16,u*.98);
          ctx.fillStyle='#7A522B';ctx.beginPath();ctx.arc(0,u*.02,u*.24,0,PI2);ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.12)';ctx.beginPath();ctx.arc(-u*.06,-u*.06,u*.08,0,PI2);ctx.fill();
          ctx.restore();
          ctx.fillStyle='#67A454';ctx.beginPath();ctx.ellipse(0,-u*1.92,u*.66,u*.54,0,0,PI2);ctx.fill();
          ctx.fillStyle='#FFE77A';ctx.beginPath();ctx.ellipse(-u*.22,-u*1.98,u*.16,u*.13,-.2,0,PI2);ctx.ellipse(u*.22,-u*1.98,u*.16,u*.13,.2,0,PI2);ctx.fill();
          ctx.fillStyle='#231A12';ctx.beginPath();ctx.arc(-u*.18,-u*1.96,u*.06,0,PI2);ctx.arc(u*.26,-u*1.96,u*.06,0,PI2);ctx.fill();
          ctx.fillStyle='#F4F0E2';ctx.beginPath();ctx.moveTo(-u*.28,-u*1.54);ctx.lineTo(-u*.14,-u*1.22);ctx.lineTo(-u*.02,-u*1.54);ctx.closePath();ctx.fill();
          ctx.beginPath();ctx.moveTo(u*.02,-u*1.54);ctx.lineTo(u*.14,-u*1.2);ctx.lineTo(u*.28,-u*1.54);ctx.closePath();ctx.fill();
          ctx.strokeStyle='#1B2C15';ctx.lineWidth=u*.08;ctx.lineCap='round';
          ctx.beginPath();ctx.moveTo(-u*.4,-u*2.2);ctx.lineTo(-u*.1,-u*2.08);ctx.moveTo(u*.4,-u*2.2);ctx.lineTo(u*.1,-u*2.08);ctx.stroke();
          if(_enAnimState==="attack"){ctx.fillStyle='rgba(255,140,40,0.2)';ctx.beginPath();ctx.arc(u*1.08,-u*1.4,u*.48,0,PI2);ctx.fill();}
        }
        break;
      }
      case "CHARGER":{
        if(en.state==="WARN"){
          var blink=Math.sin(G.time*12)>.2;
          if(blink){
            var cw=W-u*2,ch=GROUND_BASE-u*3,ctw=u*1.2,cth=u*2;
            ctx.shadowColor="#FF2200";ctx.shadowBlur=15;
            ctx.fillStyle="#FF3311";ctx.beginPath();ctx.moveTo(cw,ch-cth);ctx.lineTo(cw+ctw,ch);ctx.lineTo(cw-ctw,ch);ctx.closePath();ctx.fill();
            ctx.shadowBlur=0;
            ctx.fillStyle="#FFF";ctx.font="bold "+Math.round(u*1.4)+"px monospace";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("!",cw,ch-u*.7);
          }
          break;
        }
        ctx.translate(drawX,drawY);
        var _ch=enemySprites.charger;
        if(_ch&&_ch.ready){
          var _anim=en.state==="CHARGE"?"idle":_enAnimState;
          var _cH=u*2.8,_cW=_cH*(_ch.fw/_ch.fh);
          drawEnemySpriteFrame("charger",_anim,en.phase,_cW,_cH,true);
        }else{
          var gallop=Math.sin(G.time*14)*.3;
          var chargeScale=en.state==="CHARGE"?1.08:1;
          ctx.scale(chargeScale,1);
          ctx.fillStyle='#95582B';ctx.beginPath();ctx.ellipse(0,-u*.96,u*1.34,u*.78,0,0,PI2);ctx.fill();
          ctx.fillStyle='#B87934';ctx.beginPath();ctx.ellipse(-u*.92,-u*1.08,u*.58,u*.46,-.15,0,PI2);ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.18)';ctx.beginPath();ctx.ellipse(u*.22,-u*1.18,u*.44,u*.18,.1,0,PI2);ctx.fill();
          ctx.fillStyle='#6B3D1C';
          for(var leg=-1;leg<=1;leg+=2){ctx.save();ctx.translate(leg*u*.48,-u*.06);ctx.rotate(leg*gallop);ctx.fillRect(-u*.12,0,u*.24,u*.56);ctx.beginPath();ctx.ellipse(0,u*.58,u*.22,u*.1,0,0,PI2);ctx.fill();ctx.restore();}
          ctx.fillStyle='#F7F1E4';ctx.beginPath();ctx.moveTo(-u*1.24,-u*.88);ctx.lineTo(-u*1.12,-u*.38);ctx.lineTo(-u*.98,-u*.86);ctx.closePath();ctx.fill();
          ctx.beginPath();ctx.moveTo(-u*.94,-u*.78);ctx.lineTo(-u*.82,-u*.32);ctx.lineTo(-u*.7,-u*.72);ctx.closePath();ctx.fill();
          ctx.strokeStyle='#C8883F';ctx.lineWidth=u*.12;ctx.lineCap='round';
          ctx.beginPath();ctx.moveTo(u*.94,-u*.98);ctx.quadraticCurveTo(u*1.5,-u*1.72,u*1.22,-u*1.32);ctx.stroke();
          ctx.fillStyle='#FF4C3C';ctx.beginPath();ctx.arc(-u*.88,-u*1.16,u*.1,0,PI2);ctx.fill();
          if(en.state==="CHARGE"){ctx.fillStyle='rgba(210,140,60,0.18)';ctx.beginPath();ctx.ellipse(u*1.12,-u*.66,u*.52,u*.22,0,0,PI2);ctx.fill();}
        }
        break;
      }
      case "DIVER":{
        ctx.translate(drawX,drawY);
        var _dv=enemySprites.diver;
        if(_dv&&_dv.ready){var _dH=u*2.6,_dW=_dH*(_dv.fw/_dv.fh);drawEnemySpriteFrame("diver",_enAnimState,en.phase,_dW,_dH,true);}
        else{
          var diveTilt=_enAnimState==="attack"?-0.42:0;
          var wf=Math.sin(G.time*5+(en.phase||0))*.62;
          ctx.rotate(diveTilt);
          ctx.fillStyle='#6D4021';ctx.beginPath();ctx.ellipse(0,0,u*.72,u*.44,0,0,PI2);ctx.fill();
          ctx.fillStyle='#9A6534';
          for(var ws=-1;ws<=1;ws+=2){ctx.beginPath();ctx.moveTo(ws*u*.42,0);ctx.bezierCurveTo(ws*u*1.8,-u*wf,ws*u*2.35,u*(.42-wf),ws*u*2.18,u*.58);ctx.bezierCurveTo(ws*u*1.18,u*.34,ws*u*.6,u*.18,ws*u*.42,0);ctx.fill();}
          ctx.fillStyle='#5B2A10';ctx.beginPath();ctx.ellipse(-u*.82,-u*.14,u*.38,u*.28,.25,0,PI2);ctx.fill();
          ctx.fillStyle='#D29221';ctx.beginPath();ctx.moveTo(-u*1.02,-u*.12);ctx.lineTo(-u*1.62,0);ctx.lineTo(-u*1.02,u*.02);ctx.closePath();ctx.fill();
          ctx.fillStyle='#FFE480';ctx.beginPath();ctx.arc(-u*.72,-u*.22,u*.08,0,PI2);ctx.fill();
          ctx.strokeStyle='#6D4021';ctx.lineWidth=u*.04;ctx.beginPath();ctx.moveTo(u*.2,u*.26);ctx.lineTo(u*.34,u*.58);ctx.moveTo(0,u*.22);ctx.lineTo(u*.08,u*.56);ctx.stroke();
        }
        break;
      }
      case "WITCH":{
        ctx.translate(drawX,drawY+Math.sin(G.time*2.6+(en.phase||0))*u*.1);
        var _wt=enemySprites.witch;
        if(_wt&&_wt.ready){var _wH=u*3,_wW=_wH*(_wt.fw/_wt.fh);drawEnemySpriteFrame("witch",_enAnimState,en.phase,_wW,_wH,false);}
        else{
          var orbPulse=Math.sin(G.time*8)*0.5+0.5;
          ctx.fillStyle='#2A0F3A';ctx.beginPath();ctx.moveTo(-u*.56,0);ctx.lineTo(-u*.78,u*.52);ctx.lineTo(u*.78,u*.52);ctx.lineTo(u*.56,0);ctx.lineTo(u*.32,-u*1.26);ctx.lineTo(-u*.32,-u*1.26);ctx.closePath();ctx.fill();
          ctx.fillStyle='#462060';ctx.beginPath();ctx.moveTo(-u*.52,-u*1.26);ctx.lineTo(u*.52,-u*1.26);ctx.lineTo(0,-u*2.52);ctx.closePath();ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.12)';ctx.beginPath();ctx.moveTo(-u*.16,-u*1.12);ctx.lineTo(u*.08,-u*1.94);ctx.lineTo(u*.16,-u*1.08);ctx.closePath();ctx.fill();
          ctx.fillStyle='#C56BFF';ctx.shadowColor='#A000FF';ctx.shadowBlur=12*orbPulse;
          ctx.beginPath();ctx.arc(-u*.16,-u*.94,u*.09,0,PI2);ctx.arc(u*.16,-u*.94,u*.09,0,PI2);ctx.fill();
          ctx.strokeStyle='#6F4A2A';ctx.lineWidth=u*.1;ctx.shadowBlur=0;ctx.beginPath();ctx.moveTo(u*.64,-u*.58);ctx.lineTo(u*.84,u*.52);ctx.stroke();
          ctx.fillStyle='#C449FF';ctx.shadowColor='#B010FF';ctx.shadowBlur=10+orbPulse*4;ctx.beginPath();ctx.arc(u*.56,-u*.64,u*.18,0,PI2);ctx.fill();ctx.shadowBlur=0;
          if(_enAnimState==="attack"){for(var mp=0;mp<4;mp++){var ma=G.time*3+mp*1.6;ctx.fillStyle='rgba(214,120,255,0.45)';ctx.beginPath();ctx.arc(u*.56+Math.cos(ma)*u*.32,-u*.64+Math.sin(ma)*u*.18,u*.05,0,PI2);ctx.fill();}}
        }
        break;
      }
      case "GOLEM":{
        ctx.translate(drawX,drawY);
        var _go=enemySprites.golem;
        if(_go&&_go.ready){var _gH=u*4,_gW=_gH*(_go.fw/_go.fh);drawEnemySpriteFrame("golem",_enAnimState,en.phase,_gW,_gH,false);}
        else{
          var slam=_enAnimState==="attack"?Math.sin(G.time*10)*0.18:0.04;
          ctx.fillStyle='#5C5E62';ctx.beginPath();ctx.ellipse(0,-u*1.56,u*1.22,u*1.56,0,0,PI2);ctx.fill();
          ctx.fillStyle='#47494E';ctx.beginPath();ctx.ellipse(-u*.94,-u*1.38,u*.42,u*.62,-.3,0,PI2);ctx.ellipse(u*.98,-u*1.34,u*.42,u*.62,.3,0,PI2);ctx.fill();
          ctx.fillStyle='#66686E';ctx.fillRect(-u*.76,-u*.14,u*.48,u*.56);ctx.fillRect(u*.28,-u*.14,u*.48,u*.56);
          ctx.strokeStyle='#32343A';ctx.lineWidth=u*.05;ctx.beginPath();ctx.moveTo(-u*.38,-u*2.44);ctx.lineTo(-u*.08,-u*1.72);ctx.lineTo(-u*.28,-u*.92);ctx.stroke();
          ctx.beginPath();ctx.moveTo(u*.26,-u*2.22);ctx.lineTo(u*.48,-u*1.42);ctx.stroke();
          ctx.save();ctx.translate(-u*1.12,-u*1.22);ctx.rotate(-0.42+slam);ctx.fillStyle='#47494E';ctx.fillRect(-u*.16,-u*.08,u*.32,u*.86);ctx.beginPath();ctx.ellipse(0,u*.82,u*.28,u*.22,0,0,PI2);ctx.fill();ctx.restore();
          ctx.save();ctx.translate(u*1.08,-u*1.18);ctx.rotate(0.42-slam);ctx.fillStyle='#47494E';ctx.fillRect(-u*.16,-u*.08,u*.32,u*.84);ctx.beginPath();ctx.ellipse(0,u*.8,u*.28,u*.22,0,0,PI2);ctx.fill();ctx.restore();
          ctx.shadowColor='#FF6622';ctx.shadowBlur=12;ctx.fillStyle='#FF7C2E';ctx.beginPath();ctx.arc(-u*.3,-u*2.12,u*.14,0,PI2);ctx.arc(u*.3,-u*2.12,u*.14,0,PI2);ctx.fill();ctx.shadowBlur=0;
          ctx.strokeStyle='#FF6B2C';ctx.lineWidth=u*.07;ctx.beginPath();ctx.moveTo(-u*.28,-u*1.7);ctx.lineTo(-u*.08,-u*1.48);ctx.lineTo(u*.08,-u*1.7);ctx.lineTo(u*.28,-u*1.48);ctx.stroke();
          ctx.fillStyle='rgba(255,150,70,0.22)';ctx.beginPath();ctx.arc(0,-u*1.6,u*.24,0,PI2);ctx.fill();
        }
        break;
      }
      case "BOMBER":{
        ctx.translate(drawX,drawY);
        var _bm=enemySprites.bomber;
        if(_bm&&_bm.ready){var _bH=u*2.6,_bW=_bH*(_bm.fw/_bm.fh);drawEnemySpriteFrame("bomber",_enAnimState,en.phase,_bW,_bH,true);}
        else{
          var wf2=Math.sin(G.time*7+(en.phase||0))*.42;
          ctx.fillStyle='#835028';ctx.beginPath();ctx.ellipse(0,0,u*.92,u*.5,0,0,PI2);ctx.fill();
          ctx.fillStyle='#A76A3B';
          for(var bw=-1;bw<=1;bw+=2){ctx.beginPath();ctx.moveTo(bw*u*.52,0);ctx.bezierCurveTo(bw*u*1.46,-u*wf2,bw*u*1.98,-u*(.3+wf2),bw*u*1.82,u*.3);ctx.bezierCurveTo(bw*u*1.02,u*.2,bw*u*.62,u*.1,bw*u*.52,0);ctx.fill();}
          ctx.fillStyle='#5A3116';ctx.beginPath();ctx.ellipse(-u*.6,-u*.12,u*.26,u*.22,.15,0,PI2);ctx.fill();
          ctx.fillStyle='#FFE27A';ctx.beginPath();ctx.arc(-u*.56,-u*.16,u*.08,0,PI2);ctx.fill();
          ctx.fillStyle='#6A3D1B';ctx.beginPath();ctx.moveTo(u*.18,u*.1);ctx.lineTo(u*.66,u*.1);ctx.lineTo(u*.58,u*.46);ctx.lineTo(u*.1,u*.46);ctx.closePath();ctx.fill();
          ctx.strokeStyle='#D49A45';ctx.lineWidth=u*.05;ctx.beginPath();ctx.moveTo(u*.18,u*.24);ctx.lineTo(u*.58,u*.24);ctx.stroke();
          ctx.fillStyle='#333';ctx.beginPath();ctx.arc(u*.36,u*.6,u*.18,0,PI2);ctx.fill();
          ctx.fillStyle='#FF6A2E';ctx.beginPath();ctx.arc(u*.44,u*.38,u*.06,0,PI2);ctx.fill();
        }
        break;
      }
      case "SERPENT":{
        ctx.translate(drawX,drawY);
        var _se=enemySprites.serpent;
        if(_se&&_se.ready){var _sH=u*3,_sW=_sH*(_se.fw/_se.fh);drawEnemySpriteFrame("serpent",_enAnimState,en.phase,_sW,_sH,false);}
        else{
          var rear=_enAnimState==="attack"?u*.34:0;
          var segCount=6;
          ctx.fillStyle='#2E8B48';
          for(var seg=0;seg<segCount;seg++){
            var ss=seg*u*.54;
            var sy2=Math.sin((en.slitherPhase||G.time*4)+seg*1.18)*u*.28-seg*rear*.06;
            var rr=u*(.35-seg*.03);
            ctx.beginPath();ctx.arc(ss,sy2-u*.4-seg*rear*.08,rr,0,PI2);ctx.fill();
          }
          ctx.fillStyle='#226A36';ctx.beginPath();ctx.ellipse(-u*.28,-u*.44-rear,u*.46,u*.34,.2,0,PI2);ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.16)';
          for(var sc=0;sc<4;sc++){ctx.beginPath();ctx.ellipse(sc*u*.24,-u*.58-sc*u*.02,u*.08,u*.04,0,0,PI2);ctx.fill();}
          ctx.fillStyle='#FFCF48';ctx.beginPath();ctx.arc(-u*.48,-u*.58-rear,u*.08,0,PI2);ctx.fill();
          ctx.fillStyle='#FFF4E6';ctx.beginPath();ctx.moveTo(-u*.68,-u*.38-rear);ctx.lineTo(-u*.62,-u*.12-rear);ctx.lineTo(-u*.56,-u*.38-rear);ctx.closePath();ctx.fill();
          ctx.strokeStyle='#FF4A68';ctx.lineWidth=u*.05;ctx.beginPath();ctx.moveTo(-u*.76,-u*.44-rear);ctx.lineTo(-u*1.12,-u*.54-rear);ctx.moveTo(-u*.92,-u*.46-rear);ctx.lineTo(-u*1.12,-u*.34-rear);ctx.stroke();
        }
        break;
      }
    }
    ctx.restore();
    if(en.hpFlash>0){ctx.globalAlpha=en.hpFlash*2;ctx.fillStyle="#FFF";var hb=en.hitbox;ctx.fillRect(hb.x,hb.y,hb.w,hb.h);ctx.globalAlpha=1;}
    if(en.hp<en.maxHP&&!en.dying){var barW=u*2,barH=u*0.2;var barX=drawX-barW/2,barY=drawY-u*3.2;ctx.fillStyle="rgba(0,0,0,0.5)";ctx.fillRect(barX-1,barY-1,barW+2,barH+2);ctx.fillStyle="#444";ctx.fillRect(barX,barY,barW,barH);var hpFrac=clamp(en.hp/en.maxHP,0,1);ctx.fillStyle=hpFrac>0.5?"#4CAF50":hpFrac>0.25?"#FF9800":"#F44336";ctx.fillRect(barX,barY,barW*hpFrac,barH);}
    if(en.telegraphing){
      var tPulse=Math.sin(G.time*16)*0.5+0.5;
      var tw=u*0.8, th=u*1.4, ty=drawY-u*4;
      ctx.save();ctx.translate(drawX,ty);ctx.scale(1+tPulse*0.2,1+tPulse*0.2);
      ctx.shadowColor="#FF0000";ctx.shadowBlur=10;ctx.fillStyle="#FF2200";ctx.beginPath();ctx.moveTo(0,-th);ctx.lineTo(tw,0);ctx.lineTo(-tw,0);ctx.closePath();ctx.fill();
      ctx.shadowBlur=0;ctx.fillStyle="#FFF";ctx.font="bold "+Math.round(u*1)+"px monospace";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("!",0,-u*.4);ctx.restore();
    }
    ctx.globalAlpha=1;
    for(var _pi=0;_pi<en.projectiles.length;_pi++){var pr=en.projectiles[_pi];
      ctx.save();ctx.translate(pr.x,pr.y);
      if(pr.type==="ROCK_P"){ctx.fillStyle="#6a5a3a";ctx.beginPath();ctx.arc(0,0,UNIT*.35,0,PI2);ctx.fill();}
      else if(pr.type==="SKULL"){ctx.fillStyle="#aa88ff";ctx.shadowColor="#aa00ff";ctx.shadowBlur=10;ctx.beginPath();ctx.arc(0,0,UNIT*.3,0,PI2);ctx.fill();ctx.fillStyle="#220033";ctx.beginPath();ctx.arc(-UNIT*.08,-UNIT*.05,UNIT*.06,0,PI2);ctx.arc(UNIT*.08,-UNIT*.05,UNIT*.06,0,PI2);ctx.fill();ctx.shadowBlur=0;}
      else if(pr.type==="SHOCKWAVE"){ctx.fillStyle="rgba(255,120,0,0.8)";ctx.beginPath();ctx.ellipse(0,0,UNIT*.6,UNIT*.25,0,0,PI2);ctx.fill();ctx.fillStyle="rgba(255,200,50,0.5)";ctx.beginPath();ctx.ellipse(0,-UNIT*.15,UNIT*.3,UNIT*.12,0,0,PI2);ctx.fill();}
      else if(pr.type==="BOMB"){ctx.fillStyle="#333";ctx.beginPath();ctx.arc(0,0,UNIT*.3,0,PI2);ctx.fill();ctx.fillStyle="#ff4400";ctx.beginPath();ctx.arc(0,-UNIT*.3,UNIT*.1,0,PI2);ctx.fill();}
      else if(pr.type==="VENOM"){ctx.fillStyle="rgba(80,220,50,0.8)";ctx.beginPath();ctx.arc(0,0,UNIT*.28,0,PI2);ctx.fill();ctx.fillStyle="rgba(40,180,20,0.5)";ctx.beginPath();ctx.arc(UNIT*.05,-UNIT*.08,UNIT*.12,0,PI2);ctx.fill();}
      else if(pr.type==="FEATHER"){ctx.fillStyle="#aa7744";ctx.beginPath();ctx.moveTo(-UNIT*.25,0);ctx.lineTo(UNIT*.25,0);ctx.lineTo(UNIT*.05,-UNIT*.15);ctx.lineTo(-UNIT*.15,-UNIT*.1);ctx.closePath();ctx.fill();ctx.strokeStyle="#664422";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-UNIT*.2,0);ctx.lineTo(UNIT*.2,0);ctx.stroke();}
      else if(pr.type==="DEBRIS"){ctx.save();ctx.rotate(G.time*8);ctx.fillStyle="#7a6a4a";ctx.fillRect(-UNIT*.18,-UNIT*.18,UNIT*.36,UNIT*.36);ctx.fillStyle="#5a4a2a";ctx.fillRect(-UNIT*.12,-UNIT*.12,UNIT*.15,UNIT*.24);ctx.restore();}
      else if(pr.type==="BOULDER_P"){ctx.fillStyle="#5a5a5a";ctx.beginPath();ctx.arc(0,0,UNIT*.4,0,PI2);ctx.fill();ctx.fillStyle="#3a3a3a";ctx.beginPath();ctx.arc(UNIT*.05,-UNIT*.08,UNIT*.25,-.3,Math.PI*.6);ctx.fill();ctx.strokeStyle="rgba(0,0,0,0.3)";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(UNIT*.1,-UNIT*.15);ctx.lineTo(-UNIT*.05,UNIT*.1);ctx.stroke();}
      ctx.restore();
    }
  }
}

function drawMetaBackdrop(themeObj, accent) {
  var bgTheme = themeObj || THEMES.JUNGLE;
  if (!chunks.length) {
    G.rng = new RNG(42);
    initWorld(G.rng, getDiff(0, 1), bgTheme.name || 'JUNGLE');
    initBg();
  }
  worldOffset += 72 * DT;
  drawBg(bgTheme);
  var overlay = ctx.createLinearGradient(0, 0, 0, H);
  overlay.addColorStop(0, 'rgba(4,9,18,0.88)');
  overlay.addColorStop(0.45, 'rgba(6,12,24,0.72)');
  overlay.addColorStop(1, 'rgba(2,5,14,0.92)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);
  if (accent) {
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(W * 0.18, H * 0.2, Math.max(W, H) * 0.18, 0, PI2);
    ctx.arc(W * 0.82, H * 0.14, Math.max(W, H) * 0.15, 0, PI2);
    ctx.arc(W * 0.6, H * 0.82, Math.max(W, H) * 0.22, 0, PI2);
    ctx.fill();
    ctx.restore();
  }
}

function drawActionCard(x, y, w, h, label, sub, opts) {
  opts = opts || {};
  drawPanel(x, y, w, h, {
    radius: opts.radius || UNIT * 0.32,
    top: opts.top || 'rgba(18,30,48,0.94)',
    bottom: opts.bottom || 'rgba(9,16,30,0.9)',
    stroke: opts.stroke || 'rgba(255,255,255,0.12)',
    shadow: opts.shadow || 'rgba(0,0,0,0.2)',
    blur: opts.blur || 18,
    accent: opts.accent || null,
    glossAlpha: opts.glossAlpha || 0.14
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = opts.labelFont || (sub ? FONTS['b0.55'] : FONTS['b0.75']) || ('bold ' + Math.round(UNIT * 0.75) + 'px monospace');
  ctx.fillStyle = opts.labelColor || '#F6F8FF';
  ctx.fillText(label, x + w / 2, y + h * (sub ? 0.42 : 0.5));
  if (sub) {
    ctx.font = opts.subFont || FONTS['n0.4'] || (Math.round(UNIT * 0.4) + 'px monospace');
    ctx.fillStyle = opts.subColor || 'rgba(226,232,255,0.78)';
    ctx.fillText(sub, x + w / 2, y + h * 0.74);
  }
}

function drawMetaScreenScaffold(opts) {
  opts = opts || {};
  const u = UNIT;
  const themeObj = opts.theme || G.theme || THEMES.JUNGLE;
  const accent = opts.accent || '#4C87C5';
  const title = opts.title || 'SCREEN';
  const subtitle = opts.subtitle || '';
  const headerX = SAFE_LEFT + u * 0.55;
  const headerY = SAFE_TOP + u * 0.35;
  const headerW = W - SAFE_LEFT - SAFE_RIGHT - u * 1.1;
  const headerH = opts.headerH || u * 2.5;
  const bodyX = SAFE_LEFT + u * 0.7;
  const bodyY = headerY + headerH + u * 0.34;
  const bodyW = W - SAFE_LEFT - SAFE_RIGHT - u * 1.4;
  const footerH = u * 1.02;
  const footerY = H - SAFE_BOTTOM - footerH - u * 0.55;
  const bodyBottom = footerY - u * 0.34;
  const bodyH = Math.max(u * 4, bodyBottom - bodyY);

  drawMetaBackdrop(themeObj, accent);
  drawPanel(headerX, headerY, headerW, headerH, {
    radius: u * 0.45,
    top: 'rgba(20,34,58,0.95)',
    bottom: 'rgba(8,14,28,0.9)',
    stroke: 'rgba(190,220,255,0.16)',
    accent: accent,
    blur: 22
  });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = opts.titleFont || FONTS['b1.08'] || ('bold ' + Math.round(u * 1.08) + 'px monospace');
  ctx.fillStyle = opts.titleColor || '#F5D76C';
  ctx.fillText(title, W / 2, headerY + headerH * 0.34);
  if (subtitle) {
    ctx.font = opts.subtitleFont || FONTS['n0.38'] || (Math.round(u * 0.38) + 'px monospace');
    ctx.fillStyle = opts.subtitleColor || 'rgba(220,235,255,0.78)';
    drawTextBlock(subtitle, W / 2, headerY + headerH * 0.5, headerW - u * 1.5, u * 0.4, { align: 'center' });
  }
  if (opts.leftChip) {
    drawMiniChip(headerX + u * 0.34, headerY + u * 0.36, opts.leftChip.w || u * 3.6, u * 0.72, opts.leftChip.label, {
      font: FONTS['b0.34'] || ('bold ' + Math.round(u * 0.34) + 'px monospace'),
      accent: opts.leftChip.accent || 'rgba(107,143,185,0.24)',
      textColor: opts.leftChip.textColor || '#EFF6FF'
    });
  }
  if (opts.rightChip) {
    const chipW = opts.rightChip.w || u * 3.6;
    drawMiniChip(headerX + headerW - chipW - u * 0.34, headerY + u * 0.36, chipW, u * 0.72, opts.rightChip.label, {
      font: FONTS['b0.34'] || ('bold ' + Math.round(u * 0.34) + 'px monospace'),
      accent: opts.rightChip.accent || 'rgba(75,181,203,0.24)',
      textColor: opts.rightChip.textColor || '#EFFAFF'
    });
  }

  return { headerX, headerY, headerW, headerH, bodyX, bodyY, bodyW, bodyH, bodyBottom, footerY, footerH };
}

function drawMetaFooterButton(layout, label, sub, opts) {
  opts = opts || {};
  const w = opts.w || Math.min(UNIT * 5.2, layout.bodyW * 0.52);
  const h = opts.h || layout.footerH;
  const x = opts.x != null ? opts.x : (W / 2 - w / 2);
  const y = opts.y != null ? opts.y : layout.footerY;
  drawActionCard(x, y, w, h, label, sub || null, {
    top: opts.top || 'rgba(44,64,114,0.96)',
    bottom: opts.bottom || 'rgba(22,30,58,0.92)',
    stroke: opts.stroke || 'rgba(167,192,255,0.36)',
    accent: opts.accent || '#6288D9',
    labelColor: opts.labelColor || '#EDF4FF',
    subColor: opts.subColor || 'rgba(214,228,255,0.74)',
    labelFont: opts.labelFont || FONTS['b0.52'] || ('bold ' + Math.round(UNIT * 0.52) + 'px monospace')
  });
  return { x, y, w, h };
}

function getCharPassiveLabel(ch) {
  if (!ch) return 'Balanced runner';
  if (ch.startShield) return 'Starts with shield';
  if (ch.startMagnet) return 'Gem magnet';
  if (ch.startGems) return '+' + ch.startGems + ' opening gems';
  if (ch.maxHP >= 140) return 'Heavy tank';
  if (ch.spdM >= 1.15) return 'Top speed';
  if (Math.abs(ch.jumpV) >= 900) return 'High jump';
  if (ch.hitM <= 0.75) return 'Low damage taken';
  return 'Balanced runner';
}

function drawCharSelect() {
  const u = UNIT;
  const cols = 3, rows = 2, totalChars = CHARS.length;
  const cardW = W * 0.27, cardH = H * 0.32;
  const gapX = (W - cardW * cols) / (cols + 1), gapY = H * 0.03;
  const topY = SAFE_TOP + H * 0.12;
  const headerX = SAFE_LEFT + u * 0.55, headerY = SAFE_TOP + u * 0.35;
  const headerW = W - SAFE_LEFT - SAFE_RIGHT - u * 1.1, headerH = u * 2.2;
  const selIdx = clamp(G.selectedChar || 0, 0, CHARS.length - 1);
  const selChar = CHARS[selIdx];
  const firstSession = save.highestLevel === 0;
  const starterGuide = firstSession ? getGuidedLevel(1) : null;

  drawMetaBackdrop(THEMES.JUNGLE, '#4C87C5');

  drawPanel(headerX, headerY, headerW, headerH, {
    top: 'rgba(20,34,58,0.95)',
    bottom: 'rgba(8,14,28,0.9)',
    stroke: 'rgba(190,220,255,0.16)',
    accent: '#406FA8',
    blur: 22
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = FONTS['b1.2'] || ('bold ' + Math.round(u * 1.2) + 'px monospace');
  ctx.fillStyle = '#F5D76C';
  ctx.fillText('CHOOSE YOUR RUNNER', W / 2, headerY + headerH * 0.42);
  ctx.font = FONTS['n0.5'] || (Math.round(u * 0.5) + 'px monospace');
  ctx.fillStyle = 'rgba(220,235,255,0.8)';
  ctx.fillText(firstSession ? 'Start clean: Gronk is the easiest opener. Level 1 teaches jump plus dash.' : 'Each hero reshapes your run with a different passive and stat profile.', W / 2, headerY + headerH * 0.76);

  drawMiniChip(headerX + u * 0.35, headerY + u * 0.42, u * 4.4, u * 0.72, 'BEST L' + save.highestLevel + ' - ' + save.bestScore, {
    accent: '#6B8FB9',
    textColor: '#EFF6FF'
  });
  drawMiniChip(headerX + headerW - u * 3.9, headerY + u * 0.42, u * 3.55, u * 0.72, save.totalGems + ' GEMS', {
    accent: '#4BB5CB',
    textColor: '#EFFAFF'
  });

  for (let i = 0; i < totalChars; i++) {
    const row = Math.floor(i / cols), col = i % cols;
    const cx = gapX + (cardW + gapX) * col + cardW / 2;
    const cy = topY + row * (cardH + gapY) + cardH / 2;
    const rx = cx - cardW / 2, ry = cy - cardH / 2;
    const ch = CHARS[i];
    const sel = selIdx === i;
    const locked = !save.unlockedChars.includes(i);
    const accent = locked ? '#5F6779' : lightenColor(ch.col, 18);

    ctx.save();
    if (sel) {
      ctx.shadowColor = ch.col;
      ctx.shadowBlur = 24;
    }
    drawPanel(rx, ry, cardW, cardH, {
      top: locked ? 'rgba(20,24,36,0.92)' : 'rgba(17,28,46,0.95)',
      bottom: locked ? 'rgba(10,12,22,0.9)' : 'rgba(8,15,30,0.9)',
      stroke: sel ? lightenColor(ch.col, 46) : (locked ? 'rgba(180,190,210,0.12)' : 'rgba(255,255,255,0.1)'),
      accent: accent,
      blur: sel ? 22 : 14,
      shadow: sel ? ch.col : 'rgba(0,0,0,0.18)'
    });
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = locked ? 0.1 : (sel ? 0.2 : 0.13);
    ctx.fillStyle = locked ? '#AAB2C4' : ch.col;
    ctx.beginPath();
    ctx.arc(cx, ry + cardH * 0.32, cardW * 0.23, 0, PI2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.ellipse(cx, ry + cardH * 0.57, cardW * 0.25, u * 0.22, 0, 0, PI2);
    ctx.fill();

    if (locked) {
      ctx.fillStyle = 'rgba(46,54,72,0.88)';
      ctx.beginPath();
      ctx.arc(cx, ry + cardH * 0.32, u * 1.1, 0, PI2);
      ctx.fill();
      ctx.font = FONTS['b1'] || ('bold ' + Math.round(u) + 'px monospace');
      ctx.fillStyle = 'rgba(200,208,224,0.85)';
      ctx.fillText('LOCK', cx, ry + cardH * 0.32);
      ctx.font = FONTS['b0.6'] || ('bold ' + Math.round(u * 0.6) + 'px monospace');
      ctx.fillStyle = 'rgba(206,214,230,0.82)';
      ctx.fillText(ch.name.toUpperCase(), cx, ry + cardH * 0.63);
      ctx.font = FONTS['n0.38'] || (Math.round(u * 0.38) + 'px monospace');
      ctx.fillStyle = 'rgba(255,204,122,0.78)';
      ctx.fillText(CHAR_UNLOCK[i] ? CHAR_UNLOCK[i].req : 'Keep playing to unlock', cx, ry + cardH * 0.76);
      drawMiniChip(rx + cardW * 0.17, ry + cardH * 0.83, cardW * 0.66, u * 0.42, 'LOCKED', {
        accent: '#687387',
        textColor: '#EEF2FF',
        top: 'rgba(34,42,60,0.92)',
        bottom: 'rgba(16,20,32,0.9)'
      });
      continue;
    }

    const preview = {
      screenX: 0, y: 0, ch: ch, charIdx: i, onGround: true,
      legAnim: G.time * 4 + i * 0.5, squash: 1, stretch: 1,
      shield: ch.startShield, magnetTimer: ch.startMagnet ? 1 : 0,
      starTimer: 0, starHue: 0, extraLife: false, iframes: 0,
      dashTimer: sel ? 0.12 : 0, slideTimer: 0, pounding: false,
      hpFlash: 0, vy: 0
    };

    ctx.save();
    ctx.translate(cx, ry + cardH * 0.44);
    const previewScale = sel ? 1.5 : 1.34;
    ctx.scale(previewScale, previewScale);
    drawChar(preview, true);
    ctx.restore();

    drawMiniChip(rx + u * 0.22, ry + u * 0.16, cardW * 0.42, u * 0.42, firstSession && i === 0 ? 'STARTER' : (sel ? 'SELECTED' : 'READY'), {
      accent: sel ? lightenColor(ch.col, 22) : darkenColor(ch.col, 12),
      textColor: '#F7FBFF',
      top: 'rgba(16,28,42,0.92)',
      bottom: 'rgba(8,14,26,0.9)'
    });

    ctx.font = FONTS['b0.6'] || ('bold ' + Math.round(u * 0.6) + 'px monospace');
    ctx.fillStyle = sel ? lightenColor(ch.col, 26) : ch.col;
    ctx.fillText(ch.name.toUpperCase(), cx, ry + cardH * 0.63);

    drawMiniChip(rx + cardW * 0.13, ry + cardH * 0.69, cardW * 0.74, u * 0.44, getCharPassiveLabel(ch).toUpperCase(), {
      accent: sel ? lightenColor(ch.col, 14) : darkenColor(ch.col, 10),
      textColor: '#EEF5FF',
      font: FONTS['b0.4'] || ('bold ' + Math.round(u * 0.4) + 'px monospace'),
      top: 'rgba(18,28,46,0.94)',
      bottom: 'rgba(10,16,28,0.9)'
    });

    ctx.font = FONTS['n0.38'] || (Math.round(u * 0.38) + 'px monospace');
    ctx.fillStyle = 'rgba(220,228,245,0.72)';
    ctx.fillText('HP ' + ch.maxHP + '   SPD ' + ch.spdM.toFixed(2) + 'x', cx, ry + cardH * 0.82);

    drawProgressBar(rx + cardW * 0.16, ry + cardH * 0.87, cardW * 0.68, u * 0.15, ch.maxHP / 150, ['#4ED06E', '#2EA84B']);
  }

  drawPanel(W / 2 - u * 5.7, H - SAFE_BOTTOM - u * 3.4, u * 11.4, u * 1.15, {
    top: 'rgba(18,30,52,0.94)',
    bottom: 'rgba(8,14,26,0.9)',
    stroke: 'rgba(255,255,255,0.1)',
    accent: lightenColor(selChar.col, 14)
  });
  ctx.font = FONTS['b0.55'] || ('bold ' + Math.round(u * 0.55) + 'px monospace');
  ctx.fillStyle = '#F6FAFF';
  ctx.fillText(firstSession ? ('RECOMMENDED START - ' + selChar.name.toUpperCase()) : (selChar.name.toUpperCase() + ' - ' + getCharPassiveLabel(selChar).toUpperCase()), W / 2, H - SAFE_BOTTOM - u * 2.85);
  ctx.font = FONTS['n0.42'] || (Math.round(u * 0.42) + 'px monospace');
  ctx.fillStyle = 'rgba(224,233,248,0.74)';
  ctx.fillText(firstSession && starterGuide ? ('BALANCED STARTER  |  LEVEL 1 TEACHES JUMP + DASH') : (selChar.desc + '  |  Dash, slide, and survive long enough to cash out gems.'), W / 2, H - SAFE_BOTTOM - u * 2.4);

  const btnW = u * 5, btnH = u * 1.3, btnX = W / 2 - btnW / 2, btnY = H - SAFE_BOTTOM - u * 1.5;
  const startPulse = 1 + Math.sin(Date.now() * 0.005) * 0.04;
  ctx.save();
  ctx.translate(W / 2, btnY + btnH / 2);
  ctx.scale(startPulse, startPulse);
  drawActionCard(-btnW / 2, -btnH / 2, btnW, btnH, firstSession && starterGuide ? starterGuide.cta : 'START RUN', firstSession && starterGuide ? starterGuide.title.toUpperCase() : null, {
    top: '#3A7A45',
    bottom: '#1E4F2A',
    stroke: '#85E0A2',
    accent: '#5DD17D',
    labelColor: '#F7FFF8'
  });
  ctx.restore();

  const htpW = u * 4.5, htpH = u * 1, htpX = SAFE_LEFT + u * 0.5, htpY = H - SAFE_BOTTOM - u * 1.5;
  drawActionCard(htpX, htpY, htpW, htpH, 'HOW TO PLAY', null, {
    top: 'rgba(47,70,116,0.95)',
    bottom: 'rgba(24,36,66,0.92)',
    stroke: 'rgba(157,190,255,0.4)',
    accent: '#5E88CF',
    labelFont: FONTS['b0.48'] || ('bold ' + Math.round(u * 0.48) + 'px monospace')
  });

  const skW = u * 3.5, skH = u * 1, skX = htpX + htpW + u * 0.5, skY = H - SAFE_BOTTOM - u * 1.5;
  drawActionCard(skX, skY, skW, skH, 'SKINS', null, {
    top: 'rgba(91,56,120,0.95)',
    bottom: 'rgba(48,27,74,0.92)',
    stroke: 'rgba(223,173,255,0.38)',
    accent: '#BA78E6',
    labelFont: FONTS['b0.5'] || ('bold ' + Math.round(u * 0.5) + 'px monospace')
  });

  drawSpeakerIcon(W - SAFE_RIGHT - u * 2, H - SAFE_BOTTOM - u * 1.5, u * 1);
}

function drawDeathScreen() {
  const u = UNIT;
  const guide = G.onboarding && G.onboarding.level === G.levelNum ? G.onboarding : null;
  const pendingGuide = getGuidedPendingStep();
  const panelX = W / 2 - u * 5.6, panelY = SAFE_TOP + u * 0.65, panelW = u * 11.2, panelH = H * 0.28;

  drawMetaBackdrop(G.theme || THEMES.JUNGLE, '#B94444');
  ctx.fillStyle = 'rgba(74,16,18,0.22)';
  ctx.fillRect(0, 0, W, H);

  drawPanel(panelX, panelY, panelW, panelH, {
    top: 'rgba(52,15,20,0.92)',
    bottom: 'rgba(16,9,16,0.9)',
    stroke: 'rgba(255,154,154,0.18)',
    accent: '#A63E46',
    blur: 22
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = FONTS['b1.5'] || ('bold ' + Math.round(u * 1.5) + 'px monospace');
  ctx.fillStyle = '#FFBCB2';
  ctx.fillText('RUN OVER', W / 2, panelY + panelH * 0.2);
  ctx.font = FONTS['b0.8'] || ('bold ' + Math.round(u * 0.8) + 'px monospace');
  ctx.fillStyle = '#FFE28A';
  ctx.fillText('Score ' + G.runScore, W / 2, panelY + panelH * 0.39);

  drawMiniChip(panelX + u * 0.35, panelY + panelH * 0.56, u * 3.05, u * 0.72, 'LEVEL ' + G.levelNum, {
    accent: '#7C8DAA',
    textColor: '#F4F8FF'
  });
  drawMiniChip(W / 2 - u * 1.45, panelY + panelH * 0.56, u * 2.9, u * 0.72, G.runGems + ' GEMS', {
    accent: '#D2A84A',
    textColor: '#FFF8E8'
  });
  drawMiniChip(panelX + panelW - u * 3.4, panelY + panelH * 0.56, u * 3.05, u * 0.72, 'BEST ' + save.bestScore, {
    accent: '#4E90C9',
    textColor: '#EFF8FF'
  });

  if (G.newHigh) {
    drawMiniChip(W / 2 - u * 1.8, panelY + panelH * 0.82, u * 3.6, u * 0.58, 'NEW BEST', {
      accent: '#F3C94B',
      top: 'rgba(68,56,16,0.95)',
      bottom: 'rgba(32,24,10,0.92)',
      textColor: '#FFF7D8'
    });
  } else {
    ctx.font = FONTS['n0.42'] || (Math.round(u * 0.42) + 'px monospace');
    ctx.fillStyle = 'rgba(245,232,192,0.68)';
    ctx.fillText('Highest cleared level ' + save.highestLevel, W / 2, panelY + panelH * 0.86);
  }

  const adBtnW = u * 5.5, adBtnH = u * 1.3;
  const showAdContinue = adReady && !G.endless && !G.dailyChallenge && canShowAd();
  const showDoubleGems = adReady && !adDoubleGemsUsed && G.runGems > 0 && canShowAd();
  const adY = H * 0.42;

  if (showAdContinue && showDoubleGems) {
    const gap = u * 0.4;
    const lx = W / 2 - adBtnW - gap / 2, rx = W / 2 + gap / 2;
    drawActionCard(lx, adY, adBtnW, adBtnH, 'WATCH AD', 'FREE CONTINUE', {
      top: 'rgba(84,48,140,0.96)',
      bottom: 'rgba(44,24,76,0.92)',
      stroke: 'rgba(191,154,255,0.42)',
      accent: '#A879FF',
      labelColor: '#FBF7FF',
      subColor: '#E4D4FF'
    });
    drawActionCard(rx, adY, adBtnW, adBtnH, 'WATCH AD', '2X GEMS', {
      top: 'rgba(120,90,18,0.96)',
      bottom: 'rgba(64,44,10,0.92)',
      stroke: 'rgba(255,211,112,0.4)',
      accent: '#F0C449',
      labelColor: '#FFFDF2',
      subColor: '#FFE69D'
    });
  } else if (showAdContinue || showDoubleGems) {
    drawActionCard(W / 2 - adBtnW / 2, adY, adBtnW, adBtnH, 'WATCH AD', showAdContinue ? 'FREE CONTINUE' : '2X GEMS', {
      top: showAdContinue ? 'rgba(84,48,140,0.96)' : 'rgba(120,90,18,0.96)',
      bottom: showAdContinue ? 'rgba(44,24,76,0.92)' : 'rgba(64,44,10,0.92)',
      stroke: showAdContinue ? 'rgba(191,154,255,0.42)' : 'rgba(255,211,112,0.4)',
      accent: showAdContinue ? '#A879FF' : '#F0C449',
      labelColor: '#FBF7FF',
      subColor: showAdContinue ? '#E4D4FF' : '#FFE69D'
    });
  }

  drawMiniChip(W / 2 - u * 3.8, H * 0.55, u * 7.6, u * 0.62, pendingGuide ? ('LESSON CHECKPOINT - ' + pendingGuide.label.toUpperCase()) : ('PROGRESS SAVED AT LEVEL ' + G.levelNum), {
    accent: pendingGuide ? '#58C68D' : '#D48D3C',
    top: pendingGuide ? 'rgba(14,44,26,0.94)' : 'rgba(55,33,12,0.94)',
    bottom: pendingGuide ? 'rgba(10,20,14,0.92)' : 'rgba(22,14,10,0.92)',
    textColor: pendingGuide ? '#E6FFF0' : '#FFF3D1'
  });
  if (pendingGuide && guide) {
    ctx.font = FONTS['n0.34'] || (Math.round(u * 0.34) + 'px monospace');
    ctx.fillStyle = 'rgba(230,238,248,0.74)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`Retry the ${guide.title.toLowerCase()} lesson and finish ${pendingGuide.label.toLowerCase()}.`, W / 2, H * 0.595, u * 8.8);
  }

  const btnW = u * 8, btnH = u * 1.3;
  const retryY = H * 0.58 - btnH / 2;
  drawActionCard(W / 2 - btnW / 2, retryY, btnW, btnH, pendingGuide ? 'RETRY LESSON' : 'RETRY', pendingGuide ? pendingGuide.label.toUpperCase() : 'Resume saved run', {
    top: '#2F7A48',
    bottom: '#184327',
    stroke: '#76DEA0',
    accent: '#4ED37D',
    labelColor: '#F7FFF8'
  });

  const nrY2 = H * 0.72;
  drawActionCard(W / 2 - btnW / 2, nrY2, btnW, btnH * 0.85, 'NEW RUN', null, {
    top: 'rgba(44,64,114,0.96)',
    bottom: 'rgba(22,30,58,0.92)',
    stroke: 'rgba(167,192,255,0.36)',
    accent: '#6288D9',
    labelColor: '#EDF4FF',
    labelFont: FONTS['b0.58'] || ('bold ' + Math.round(u * 0.58) + 'px monospace')
  });

  const bottomY = H - SAFE_BOTTOM - u * 2;
  const halfBtn = btnW * 0.45;
  drawActionCard(W / 2 - halfBtn - u * 0.3, bottomY, halfBtn, btnH * 0.8, 'SHARE', null, {
    top: 'rgba(34,88,132,0.95)',
    bottom: 'rgba(16,36,70,0.92)',
    stroke: 'rgba(134,204,255,0.34)',
    accent: '#4DADE6',
    labelFont: FONTS['b0.48'] || ('bold ' + Math.round(u * 0.48) + 'px monospace')
  });
  drawActionCard(W / 2 + u * 0.3, bottomY, halfBtn, btnH * 0.8, 'LEVEL MAP', null, {
    top: 'rgba(24,30,42,0.95)',
    bottom: 'rgba(10,15,26,0.92)',
    stroke: 'rgba(221,229,245,0.16)',
    accent: '#8593A8',
    labelColor: '#F1F5FF',
    labelFont: FONTS['b0.46'] || ('bold ' + Math.round(u * 0.46) + 'px monospace')
  });
}

function drawPausedScreen() {
  const u = UNIT;
  const btnW = u * 6, btnH = u * 1.5;
  const panelW = u * 11.5, panelH = u * 7.8;
  const panelX = W / 2 - panelW / 2, panelY = H * 0.16;

  drawMetaBackdrop(G.theme || THEMES.JUNGLE, '#6FA1DB');
  drawPanel(panelX, panelY, panelW, panelH, {
    top: 'rgba(18,32,54,0.95)',
    bottom: 'rgba(8,14,28,0.92)',
    stroke: 'rgba(202,224,255,0.16)',
    accent: '#507BB5',
    blur: 24
  });

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = FONTS['b1.5'] || ('bold ' + Math.round(u * 1.5) + 'px monospace');
  ctx.fillStyle = '#F5D56A';
  ctx.fillText('PAUSED', W / 2, panelY + u * 0.9);
  ctx.font = FONTS['n0.45'] || (Math.round(u * 0.45) + 'px monospace');
  ctx.fillStyle = 'rgba(223,233,250,0.76)';
  ctx.fillText('Your run is frozen. Resume when you are ready or bail out to the map.', W / 2, panelY + u * 1.55);

  drawMiniChip(panelX + u * 0.55, panelY + u * 2.05, u * 3.05, u * 0.72, 'LEVEL ' + G.levelNum, {
    accent: '#6D93BF',
    textColor: '#F4F8FF'
  });
  drawMiniChip(W / 2 - u * 1.55, panelY + u * 2.05, u * 3.1, u * 0.72, G.runScore + ' SCORE', {
    accent: '#D7A84E',
    textColor: '#FFF7E1'
  });
  drawMiniChip(panelX + panelW - u * 3.6, panelY + u * 2.05, u * 3.05, u * 0.72, G.runGems + ' GEMS', {
    accent: '#4AB1C7',
    textColor: '#EFFBFF'
  });

  const resumeY = H * 0.45;
  drawActionCard(W / 2 - btnW / 2, resumeY, btnW, btnH, 'RESUME', 'Jump back in', {
    top: '#2F7A48',
    bottom: '#184327',
    stroke: '#76DEA0',
    accent: '#4ED37D',
    labelColor: '#F7FFF8'
  });

  const quitY = H * 0.62;
  drawActionCard(W / 2 - btnW / 2, quitY, btnW, btnH, 'QUIT TO MAP', 'Leave this run', {
    top: 'rgba(122,44,52,0.96)',
    bottom: 'rgba(66,20,28,0.92)',
    stroke: 'rgba(255,170,170,0.3)',
    accent: '#D85A66',
    labelColor: '#FFF5F6',
    subColor: 'rgba(255,218,220,0.74)',
    labelFont: FONTS['b0.7'] || ('bold ' + Math.round(u * 0.7) + 'px monospace')
  });

  drawMiniChip(W / 2 - u * 2.2, H - SAFE_BOTTOM - u * 2.85, u * 4.4, u * 0.66, soundMuted ? 'SOUND OFF' : 'SOUND ON', {
    accent: soundMuted ? '#7F8794' : '#4AB1C7',
    textColor: '#EFF7FF'
  });
  drawSpeakerIcon(W / 2 - u * 0.6, H - SAFE_BOTTOM - u * 2, u * 1.2);
}

function drawTutorial() {
  const u = UNIT;
  const btnW = u * 6, btnH = u * 1.5, btnY = H * 0.85;
  const items = [
    { key: 'UP', text: 'Swipe up to clear ground threats and hop between short gaps.', accent: '#66B3FF' },
    { key: 'UP x2', text: 'Chain a second swipe for a double jump when the lane gets tall.', accent: '#8DCE6E' },
    { key: 'DOWN', text: 'Slide under hazards on the floor or stomp downward from the air.', accent: '#F5B14B' },
    { key: 'RIGHT', text: 'Dash through danger to recover space and keep the run alive.', accent: '#F277A5' },
    { key: 'GEMS', text: 'Collect gems during the run to unlock heroes, skins, and meta progress.', accent: '#4FC5D9' }
  ];

  drawMetaBackdrop(THEMES.JUNGLE, '#5E8FCC');

  drawPanel(SAFE_LEFT + u * 0.65, SAFE_TOP + u * 0.45, W - SAFE_LEFT - SAFE_RIGHT - u * 1.3, u * 2.05, {
    top: 'rgba(19,34,58,0.95)',
    bottom: 'rgba(8,14,28,0.9)',
    stroke: 'rgba(190,220,255,0.16)',
    accent: '#476FA4'
  });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = FONTS['b1.3'] || ('bold ' + Math.round(u * 1.3) + 'px monospace');
  ctx.fillStyle = '#F5D76C';
  ctx.fillText('HOW TO PLAY', W / 2, SAFE_TOP + u * 1.1);
  ctx.font = FONTS['n0.5'] || (Math.round(u * 0.5) + 'px monospace');
  ctx.fillStyle = 'rgba(222,233,250,0.78)';
  ctx.fillText('Read the verbs once, then let the first three levels teach jump, slide, stomp, and dash timing in motion.', W / 2, SAFE_TOP + u * 1.68);

  const cardX = SAFE_LEFT + u * 0.85, cardW = W - SAFE_LEFT - SAFE_RIGHT - u * 1.7;
  const startY = SAFE_TOP + u * 3, cardH = u * 1.05, gap = u * 0.18;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const y = startY + i * (cardH + gap);
    drawPanel(cardX, y, cardW, cardH, {
      top: 'rgba(18,28,46,0.94)',
      bottom: 'rgba(8,14,28,0.9)',
      stroke: 'rgba(255,255,255,0.1)',
      accent: item.accent,
      blur: 16
    });
    drawMiniChip(cardX + u * 0.22, y + u * 0.16, u * 1.55, u * 0.44, item.key, {
      accent: item.accent,
      textColor: '#F7FBFF',
      top: 'rgba(18,30,52,0.95)',
      bottom: 'rgba(10,16,30,0.9)',
      font: FONTS['b0.38'] || ('bold ' + Math.round(u * 0.38) + 'px monospace')
    });
    ctx.textAlign = 'left';
    ctx.font = FONTS['n0.42'] || (Math.round(u * 0.42) + 'px monospace');
    ctx.fillStyle = '#ECF3FF';
    ctx.fillText(item.text, cardX + u * 2.05, y + cardH * 0.52);
  }

  ctx.font = FONTS['n0.4'] || (Math.round(u * 0.4) + 'px monospace');
  ctx.fillStyle = 'rgba(232,239,250,0.8)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Read the lane, stay centered, and let Level 1 teach the pace before you start improvising.', W / 2, btnY - u * 0.56);

  drawActionCard(W / 2 - btnW / 2, btnY, btnW, btnH, 'START RUN', 'Tap to begin', {
    top: '#2F7A48',
    bottom: '#184327',
    stroke: '#76DEA0',
    accent: '#4ED37D',
    labelColor: '#F7FFF8'
  });
}

// Level map touch scrolling
let mapTouchStartY = 0, mapTouchLastY = 0, mapScrolling = false;

function handleLevelMapTap() {
  const tx=inp.tapX, ty=inp.tapY, u=UNIT;
  const layout = getLevelMapLayout();
  const hasNextLevel = G._nextLevelNum && G._nextLevelNum > 0;
  const canResume = save.savedLevel > 1 && (save.cooldownEnd-Date.now()) <= 0;

  if(tx>layout.shopX&&tx<layout.shopX+layout.shopW&&ty>layout.shopY&&ty<layout.shopY+layout.shopH){
    G.phase='SHOP'; G.shopScrollY=0; sfxUITap(); return;
  }
  if(tx>layout.statsX&&tx<layout.statsX+layout.statsW&&ty>layout.statsY&&ty<layout.statsY+layout.statsH){
    G.phase='STATS'; G.statsScrollY=0; G.statsTargetScrollY=0; sfxUITap(); return;
  }
  if(tx>layout.missionX&&tx<layout.missionX+layout.missionW&&ty>layout.quickY&&ty<layout.quickY+layout.quickH){
    G.phase='MISSIONS'; sfxUITap(); return;
  }
  if(tx>layout.loginX&&tx<layout.loginX+layout.loginW&&ty>layout.quickY&&ty<layout.quickY+layout.quickH){
    if(checkDailyReward()){ G.phase='DAILY_REWARD'; }
    else { G.phase='DAILY_REWARD'; G.dailyRewardType=null; G.dailyRewardClaimed=true; G.dailyRewardTimer=0; }
    sfxUITap(); return;
  }
  if(tx>layout.settingsX&&tx<layout.settingsX+layout.settingsW&&ty>layout.settingsY&&ty<layout.settingsY+layout.settingsH){
    G._settingsReturnPhase='LEVEL_MAP'; G.phase='SETTINGS'; sfxUITap(); return;
  }
  if(checkSpeakerTap(tx,ty,layout.speakerX,layout.speakerY,layout.speakerSize)){
    soundMuted=!soundMuted; sfxUITap(); return;
  }

  // "Next Level" button (after completing a level)
  if (hasNextLevel) {
    if(tx>layout.nextX && tx<layout.nextX+layout.nextW && ty>layout.actionY && ty<layout.actionY+layout.actionH) {
      const nextLvl = G._nextLevelNum;
      const pendingPowerup = G._pendingWheelResult;
      G._nextLevelNum = 0;
      G._pendingWheelResult = null;
      trackNextLevel(nextLvl);
      startLevel(nextLvl);
      if (pendingPowerup) applyWheelPowerup(pendingPowerup);
      return;
    }
  }

  // Resume button
  if (!hasNextLevel && canResume) {
    if(tx>layout.resumeX && tx<layout.resumeX+layout.actionW && ty>layout.actionY && ty<layout.actionY+layout.actionH) {
      G.selectedChar = safeSelectedChar();
      resumeFromSave('map_resume');
      return;
    }
  }

  // New Run button
  if (!hasNextLevel) {
    const newRunX = canResume ? layout.newRunX : layout.centerActionX;
    if(tx>newRunX && tx<newRunX+layout.actionW && ty>layout.actionY && ty<layout.actionY+layout.actionH) {
      G.phase = 'CHAR_SELECT';
      return;
    }
  }

  // Endless mode button
  if(!hasNextLevel && save.highestLevel >= 40){
    if(tx>layout.endlessX&&tx<layout.endlessX+layout.endlessW&&ty>layout.endlessY&&ty<layout.endlessY+layout.endlessH){
      sfxUITap(); startEndlessMode(); return;
    }
  }

  // Tap on level nodes
  const mapTop = layout.mapTop, mapBot = layout.mapBot;
  const nodeSpacingY = u*4;

  // Check all tappable levels (completed + current)
  for(let lvl=1; lvl<=Math.min(save.highestLevel+1, 40); lvl++){
    const nny = mapBot - u*1.5 - (lvl * nodeSpacingY) + G.mapScrollY + nodeSpacingY;
    const zig = (lvl%2===0) ? W*0.32 : W*0.68;
    const nnx = zig + Math.sin(lvl*0.8)*W*0.08;
    const nR = (lvl%5===0) ? u*1.5 : u*1.2;
    if (Math.abs(tx-nnx)<nR*1.5 && Math.abs(ty-nny)<nR*1.5) {
      if(lvl <= save.highestLevel){
        // Replay completed level
        sfxUITap();
        G.selectedChar = safeSelectedChar();
        G.runGems=0; G.runScore=0; G.gems=0;
        G.newHigh=false; G.lastUpgrade=-1;
        G.continuesLeft = 2 + (save.shopUpgrades&&save.shopUpgrades.up_continue ? 1 : 0);
        G.wheelResult=null; G._nextLevelNum=0; G._pendingWheelResult=null;
        G.combo=0; G.comboTimer=0; G.comboMult=1; G.comboPulse=0;
        boss=null;
        trackRetry('level_replay');
        startLevel(lvl);
      } else {
        // Current level — go to char select
        G.phase = 'CHAR_SELECT';
      }
      return;
    }
  }
}

// ============================================================
// DEAD SCREEN HANDLERS
// ============================================================
function resumeFromSave(source) {
  trackRetry(source || 'saved_run');
  G.runGems=save.savedGems; G.runScore=save.savedScore; G.gems=save.savedGems;
  G.score=save.savedScore;
  G.newHigh=false; G.lastUpgrade=-1;
  G.continuesLeft = 2 + (save.shopUpgrades&&save.shopUpgrades.up_continue ? 1 : 0);
  G.wheelResult=null;
  save.cooldownEnd=0; persistSave();
  startLevel(save.savedLevel);
}

function handleDeadTap() {
  const tx=inp.tapX, ty=inp.tapY, u=UNIT;
  const btnW=u*8, btnH=u*1.4;

  // Check ad button taps first (same logic as handleDeathTap)
  const adBtnW=u*5.5, adBtnH=u*1.3;
  const showAdContinue = adReady && !G.endless && !G.dailyChallenge && canShowAd();
  const showDoubleGems = adReady && !adDoubleGemsUsed && G.runGems > 0 && canShowAd();
  const adY = H*.42;
  if (showAdContinue && showDoubleGems) {
    const gap = u*.4;
    const lx = W/2 - adBtnW - gap/2, rx = W/2 + gap/2;
    if(tx>lx&&tx<lx+adBtnW&&ty>adY&&ty<adY+adBtnH){ requestAd('continue'); sfxUITap(); return; }
    if(tx>rx&&tx<rx+adBtnW&&ty>adY&&ty<adY+adBtnH){ requestAd('doubleGems'); sfxUITap(); return; }
  } else if (showAdContinue) {
    if(tx>W/2-adBtnW/2&&tx<W/2+adBtnW/2&&ty>adY&&ty<adY+adBtnH){ requestAd('continue'); sfxUITap(); return; }
  } else if (showDoubleGems) {
    if(tx>W/2-adBtnW/2&&tx<W/2+adBtnW/2&&ty>adY&&ty<adY+adBtnH){ requestAd('doubleGems'); sfxUITap(); return; }
  }

  const cdRemain = save.cooldownEnd - Date.now();

  if (cdRemain > 0) {
    // "LEVEL MAP" button during cooldown
    const nrY=H*.80;
    if(tx>W/2-btnW/2&&tx<W/2+btnW/2&&ty>nrY&&ty<nrY+btnH){
      G.phase='LEVEL_MAP';
      const curLvl=save.highestLevel+1;
      G.mapTargetScrollY=Math.max(0,curLvl*u*4-H/2);
      G.mapScrollY=G.mapTargetScrollY;
    }
  } else {
    // "RETRY LEVEL X" button
    if(tx>W/2-btnW/2&&tx<W/2+btnW/2&&ty>H*.73-btnH/2&&ty<H*.73+btnH/2){
      resumeFromSave('dead_screen_retry');
      return;
    }
    // "LEVEL MAP" button
    const nrY=H*.84;
    if(tx>W/2-btnW/2&&tx<W/2+btnW/2&&ty>nrY&&ty<nrY+btnH*.8){
      G.phase='LEVEL_MAP';
      const curLvl=save.highestLevel+1;
      G.mapTargetScrollY=Math.max(0,curLvl*u*4-H/2);
      G.mapScrollY=G.mapTargetScrollY;
    }
  }
}

// ============================================================
// DEBUG MODE (triple-tap title area on menu to activate)
// ============================================================
let debugMode = false;
// Performance monitoring
let _fpsHistory = [];
let _fpsAvg = 60;
let _frameTimeHistory = [];
let _perfLevel = 2; // 0=low, 1=medium, 2=high (auto-detected)
let _perfSamples = 0;
let _perfDetected = false;
let debugTapCount = 0;
let debugTapTimer = 0;
function toggleDebug() { debugMode = !debugMode; }
function drawDebugPanel() {
  if (!debugMode) return;
  const u = UNIT;
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, W, H);
  ctx.font = `bold ${u*1.2}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#FF4444';
  ctx.fillText('DEBUG MODE', W/2, u*0.5);
  ctx.font = `${u*0.55}px monospace`;
  ctx.fillStyle = '#fff';
  const lines = [
    `Phase: ${G.phase}  |  Level: ${G.levelNum}`,
    `FPS: ${_fpsAvg.toFixed(0)} (${(1/Math.max(DT,0.001)).toFixed(0)} instant)  |  Quality: ${['LOW','MED','HIGH'][_perfLevel]}`,
    `Particles: ${particles.length}/${MAX_PARTICLES}  |  Pool: ${_particlePool.length}  |  Ambients: ${ambients.length}`,
    `Frame: ${(DT*1000).toFixed(1)}ms  |  Chunks: ${typeof chunks!=='undefined'?chunks.length:'--'}  |  Online: ${isOnline}`,
    `Ads: ready=${adReady} deaths=${adDeathCount} last=${adLastShownTime?Math.round((Date.now()-adLastShownTime)/1000)+'s ago':'never'}`,
    `Save: ${JSON.stringify(save).length} bytes  |  Sprites: ${Object.keys(charSprites).map(function(k){return k[0].toUpperCase()+'='+charSprites[k].ready;}).join(' ')}`,
    `Missions ready: ${(save.missions&&save.missions.daily||[]).filter(function(m){return !m.claimed&&(m.progress||0)>=m.target;}).length + (save.missions&&save.missions.weekly||[]).filter(function(m){return !m.claimed&&(m.progress||0)>=m.target;}).length}  |  Streak: ${save.dailyStreak}d`,
    `Player HP: ${G.player?G.player.hp:'--'}/${G.player?G.player.maxHP:'--'}`,
    `Score: ${G.runScore}  |  Gems: ${G.runGems}  |  Combo: ${G.combo}x${G.comboMult}`,
    `Speed: ${G.speed?G.speed.toFixed(0):'--'}  |  Time Left: ${G.timeLeft?G.timeLeft.toFixed(1):'--'}`,
    `Save: Lvl ${save.highestLevel} | Best ${save.bestScore} | Gems ${save.totalGems}`,
    '',
    'TAP A LEVEL TO JUMP TO IT:',
  ];
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], W/2, u*2 + i*u*0.8);
  }
  // Level quick-jump buttons (8 per row)
  const cols = 8, btnS = u*1.1;
  const startY = u*2 + lines.length*u*0.8 + u*0.5;
  ctx.font = `bold ${u*0.4}px monospace`;
  for (let lv = 1; lv <= 40; lv++) {
    const col = (lv-1)%cols, row = Math.floor((lv-1)/cols);
    const bx = W/2 - (cols*btnS)/2 + col*btnS + btnS/2;
    const by = startY + row*btnS;
    const unlocked = lv <= save.highestLevel+1;
    ctx.fillStyle = unlocked ? (lv%5===0?'#FF8800':'#4caf50') : '#444';
    ctx.fillRect(bx-btnS*0.4, by, btnS*0.8, btnS*0.7);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(lv, bx, by+btnS*0.35);
  }
  // Close button
  ctx.fillStyle = '#FF4444';
  ctx.fillRect(W/2-u*2, H-u*2.5, u*4, u*1.5);
  ctx.fillStyle = '#fff'; ctx.font = `bold ${u*0.6}px monospace`;
  ctx.fillText('CLOSE', W/2, H-u*1.75);
}
function handleDebugTap(tx, ty) {
  if (!debugMode) return false;
  const u = UNIT;
  // Close button
  if (tx > W/2-u*2 && tx < W/2+u*2 && ty > H-u*2.5 && ty < H-u*1) {
    debugMode = false; return true;
  }
  // Level buttons
  const cols = 8, btnS = u*1.1;
  const lines = 9; // number of info lines
  const startY = u*2 + lines*u*0.8 + u*0.5;
  for (let lv = 1; lv <= 40; lv++) {
    const col = (lv-1)%cols, row = Math.floor((lv-1)/cols);
    const bx = W/2 - (cols*btnS)/2 + col*btnS + btnS/2;
    const by = startY + row*btnS;
    if (tx > bx-btnS*0.4 && tx < bx+btnS*0.4 && ty > by && ty < by+btnS*0.7) {
      debugMode = false;
      G.selectedChar = safeSelectedChar();
      startNewRun();
      // Override to jump directly to chosen level
      G.levelNum = lv;
      startLevel(lv);
      return true;
    }
  }
  return true; // consume tap
}

// ============================================================
// DEATH TUMBLE FX (Recovered)
// ============================================================
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
  var u = UNIT;
  ctx.fillStyle='rgba(255,50,50,0.6)';
  ctx.beginPath();ctx.ellipse(0,-u*.85,u*.88,u*1.05,0,0,PI2);ctx.fill();
  ctx.fillStyle='rgba(255,100,100,0.4)';
  ctx.beginPath();ctx.ellipse(0,-u*.65,u*.5,u*.6,0,0,PI2);ctx.fill();
  ctx.restore();
}

function spawnDeathFX(x, y) {
  startDeathTumble(x, y);
  const count = _perfLevel === 0 ? 8 : _perfLevel === 1 ? 16 : 24;
  for (let i = 0; i < count; i++) {
    spawnParticle(x, y, {
      vx: (Math.random() - .5) * 700,
      vy: -(Math.random() * 550 + 100),
      color: `hsl(${20 + Math.random() * 50},90%,60%)`,
      r: UNIT * (.18 + Math.random() * .45),
      decay: .6 + Math.random() * .5,
      grav: 900,
      sq: Math.random() > .5,
    });
  }
}

function spawnDustFX(x, y) {
  for (let i = 0; i < 6; i++) {
    spawnParticle(x, y, {
      vx: (Math.random() - .5) * 130,
      vy: -(Math.random() * 70 + 20),
      color: `hsl(30,40%,${50 + Math.random() * 20}%)`,
      r: UNIT * (.1 + Math.random() * .15),
      decay: 3,
      grav: 220,
    });
  }
}

// ============================================================
// MAIN LOOP
// ============================================================
let lastT=0, DT=0;

function loop(ts){
  try{
  const raw=(ts-lastT)/1000; lastT=ts;
  // FPS tracking
  if (raw > 0 && raw < 1) {
    const fps = 1/raw;
    _fpsHistory.push(fps);
    _frameTimeHistory.push(raw*1000);
    if (_fpsHistory.length > 60) _fpsHistory.shift();
    if (_frameTimeHistory.length > 120) _frameTimeHistory.shift();
    _fpsAvg = _fpsHistory.reduce(function(a,b){return a+b;},0) / _fpsHistory.length;
    // Auto-detect performance level in first 3 seconds of gameplay
    if (!_perfDetected && G.phase === 'PLAYING') {
      _perfSamples++;
      if (_perfSamples >= 90) { // ~1.5 seconds of frames
        _perfDetected = true;
        if (_fpsAvg < 25) _perfLevel = 0;
        else if (_fpsAvg < 45) _perfLevel = 1;
        else _perfLevel = 2;
      }
    }
  }
  DT=Math.min(raw,.05);
  // Hit-stop logic
  if (G.hitStop > 0) {
    G.hitStop -= raw;
    // Still render, but skip updates
  }
  // Phase 2: Apply slow-motion factor
  if(_slowMoTimer>0 && G.hitStop <= 0){DT*=_slowMoFactor;_slowMoTimer-=raw;if(_slowMoTimer<=0)_slowMoFactor=1;}
  // Safety: reset canvas state every frame to prevent leaks
  ctx.globalAlpha=1;
  ctx.globalCompositeOperation='source-over';
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,W,H);

  switch(G.phase){
    case 'LOADING': {
      G.loadingTimer += DT;
      const lt = G.loadingTimer;
      // Dark background with gradient
      ctx.fillStyle = '#0d1b3e';
      ctx.fillRect(0, 0, W, H);
      // Gronk's Run title - fade in
      const titleA = clamp(lt * 2, 0, 1);
      ctx.globalAlpha = titleA;
      ctx.font = FONTS['b5'] || `bold ${UNIT*5}px monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1B3A5C';
      ctx.fillText("GRONK'S", W/2+3, H*0.38+3);
      ctx.fillStyle = '#4caf50';
      ctx.fillText("GRONK'S", W/2, H*0.38);
      ctx.font = FONTS['b3'] || `bold ${UNIT*3}px monospace`;
      ctx.fillStyle = '#FFD700';
      ctx.fillText('RUN', W/2, H*0.52);
      // Loading bar
      const barW = W * 0.5, barH = UNIT * 0.4;
      const barX = W/2 - barW/2, barY = H*0.68;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(barX, barY, barW, barH);
      const prog = clamp(lt / 1.5, 0, 1);
      ctx.fillStyle = '#4caf50';
      ctx.fillRect(barX, barY, barW * prog, barH);
      // Loading text
      ctx.font = FONTS['n0.5'] || `${UNIT*0.5}px monospace`;
      ctx.fillStyle = '#888';
      ctx.fillText('Loading...', W/2, barY + barH + UNIT);
      ctx.globalAlpha = 1;
      // Initiate sprite loading once bar fills
      // Load selected character sprite first, defer others
      if (lt >= 1.5) {
        const _sel = safeSelectedChar();
        const _selId = CHARS[_sel] ? CHARS[_sel].id : 'gronk';
        if (!charSprites[_selId].loading) initCharSprite(_selId);
        CHARS.forEach(function(ch) { if (!charSprites[ch.id].loading) initCharSprite(ch.id); });
        if (!_enemySpritesLoading) initEnemySprites();
      }
      // Wait for sprite ready (or 5s timeout for fallback)
      if (lt >= 1.5 && ((charSprites[CHARS[safeSelectedChar()] ? CHARS[safeSelectedChar()].id : 'gronk'].ready || charSprites[CHARS[safeSelectedChar()] ? CHARS[safeSelectedChar()].id : 'gronk'].blocked) || lt >= 5)) {
        G.fadeAlpha = 0;
        // Only wait for selected character sprite
      const _selCharId = CHARS[safeSelectedChar()] ? CHARS[safeSelectedChar()].id : 'gronk';
      const _selReady = charSprites[_selCharId].ready || charSprites[_selCharId].blocked;
      if (!_selReady && lt < 5) break; // still loading
      if (save.highestLevel === 0 && !save.tutorialSeen) {
          // First-run: skip menu, go straight to playing
          G.selectedChar = 0; save.selectedChar = 0;
          startNewRun();
          startMusic(G.theme ? G.theme.name || 'JUNGLE' : 'JUNGLE');
        } else {
          G.phase = 'MENU';
          startMusic('JUNGLE');
        }
      }
      break;
    }
    case 'MENU':
      CHARS.forEach(function(ch) { if (!charSprites[ch.id].loading) initCharSprite(ch.id); });
      drawMenu();
      // Debug mode: triple-tap the title area (top 25% of screen)
      if (debugTapTimer > 0) debugTapTimer -= DT;
      if(inp.tapped){
        inp.tapped=false;
        if (debugMode) { handleDebugTap(inp.tapX, inp.tapY); break; }
        // Triple-tap detection for debug mode (top quarter of screen)
        if (inp.tapY < H*0.25) {
          if (debugTapTimer > 0) { debugTapCount++; } else { debugTapCount = 1; }
          debugTapTimer = 0.5;
          if (debugTapCount >= 3) { debugMode = true; debugTapCount = 0; break; }
          break; // don't proceed to menu action on title taps
        }
        // Check daily reward first
        if(checkDailyReward()){
          G.phase='DAILY_REWARD';
        } else {
          G.phase='LEVEL_MAP';
          // Auto-scroll to current level
          const curLvl = save.highestLevel+1;
          G.mapTargetScrollY = Math.max(0, curLvl*UNIT*4 - H/2);
          G.mapScrollY = G.mapTargetScrollY;
        }
      }
      if (debugMode) drawDebugPanel();
      break;

    case 'DAILY_REWARD':
      drawDailyReward(DT);
      if(inp.tapped){inp.tapped=false;handleDailyRewardTap();}
      break;

    case 'LEVEL_MAP':
      CHARS.forEach(function(ch) { if (!charSprites[ch.id].loading) initCharSprite(ch.id); });
      // Check rate prompt
      if (checkRatePrompt()) { G._showRatePrompt = true; G._ratePromptTimer = 0; }
      drawLevelMap(DT);
      if(inp.tapped){
        // Rate prompt tap handling
        if(G._showRatePrompt){
          const _ru=UNIT, _rw=_ru*10, _rh=_ru*5;
          const _rx=W/2-_rw/2, _ry=H/2-_rh/2;
          // Rate button
          if(inp.tapX>_rx&&inp.tapX<_rx+_rw/2&&inp.tapY>_ry+_rh*.7&&inp.tapY<_ry+_rh){
            triggerRateApp(); G._showRatePrompt=false; sfxUITap(); inp.tapped=false;
          }
          // Dismiss button
          else if(inp.tapX>_rx+_rw/2&&inp.tapX<_rx+_rw&&inp.tapY>_ry+_rh*.7&&inp.tapY<_ry+_rh){
            save._ratePromptDismissed=true; persistSave(); G._showRatePrompt=false; sfxUITap(); inp.tapped=false;
          }
          else { inp.tapped=false; } // consume tap
        }
        else { inp.tapped=false;handleLevelMapTap(); }
      }
      // Rate prompt overlay
      if (G._showRatePrompt) {
        G._ratePromptTimer = (G._ratePromptTimer||0) + DT;
        const _ru=UNIT, _rw=_ru*10, _rh=_ru*5;
        const _rx=W/2-_rw/2, _ry=H/2-_rh/2;
        ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(0,0,W,H);
        ctx.fillStyle='rgba(15,25,50,0.95)';ctx.fillRect(_rx,_ry,_rw,_rh);
        ctx.strokeStyle='#FFD700';ctx.lineWidth=2;ctx.strokeRect(_rx,_ry,_rw,_rh);
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.font='bold '+Math.round(_ru*1)+'px monospace';ctx.fillStyle='#FFD700';
        ctx.fillText('Enjoying the game?', W/2, _ry+_rh*.25);
        ctx.font=Math.round(_ru*.5)+'px monospace';ctx.fillStyle='rgba(255,255,255,0.7)';
        ctx.fillText('Rate us on the Play Store!', W/2, _ry+_rh*.45);
        // Rate button
        ctx.fillStyle='#22AA44';ctx.fillRect(_rx+_ru*.5,_ry+_rh*.65,_rw/2-_ru*.8,_rh*.25);
        ctx.font='bold '+Math.round(_ru*.55)+'px monospace';ctx.fillStyle='white';
        ctx.fillText('RATE', _rx+_rw*.25, _ry+_rh*.78);
        // Later button
        ctx.fillStyle='rgba(100,100,120,0.5)';ctx.fillRect(_rx+_rw/2+_ru*.3,_ry+_rh*.65,_rw/2-_ru*.8,_rh*.25);
        ctx.fillStyle='rgba(200,200,200,0.7)';
        ctx.fillText('LATER', _rx+_rw*.75, _ry+_rh*.78);
      }
      break;

    case 'CHAR_SELECT':
      drawCharSelect();
      if(inp.tapped){inp.tapped=false;handleCharSelectTap();}
      break;

    case 'LEVEL_INTRO':
      drawLevelIntro(DT);
      break;

    case 'PLAYING': {
      const p=G.player;
      G.time+=DT; G.timeLeft-=DT;
      updateTooltip(DT);
      // Endless mode: ramp difficulty over time, cycle themes, spawn bosses
      if(G.endless){
        G.endlessTime+=DT;
        const endlessMult = 1 + G.endlessTime/120; // ramp over 2min cycles
        G.diff=getDiff(clamp(G.endlessTime/60,0,1), endlessMult);
        // Theme cycling every 90s
        const themeKeys = ['JUNGLE','VOLCANO','GLACIER','SWAMP','SKY'];
        const newIdx = Math.floor(G.endlessTime/90)%themeKeys.length;
        if(newIdx!==G.endlessThemeIdx){
          G.endlessThemeIdx=newIdx;
          G.theme=THEMES[themeKeys[newIdx]];
          G.levelDef.theme=themeKeys[newIdx];
          G.flashColor='rgba(255,255,255,0.4)'; G.flashLife=0.4;
          initBg();
        }
        // Boss spawn every 3 minutes
        G.endlessBossTimer-=DT;
        if(G.endlessBossTimer<=0 && !boss && p.alive){
          G.endlessBossTimer=180;
          const bossLvl = 5*(1+Math.floor(G.endlessTime/180)%BOSS_TYPES.length);
          boss=new Boss(bossLvl);
          G.phase='BOSS_FIGHT';
          G.announce={text:`BOSS: ${boss.name}!`,life:2.5};
          break;
        }
      } else {
        const prog=clamp(G.time/G.levelDef.targetTime,0,1);
        G.diff=getDiff(prog,levelDiffMult(G.levelNum));
      }
      // Only update speed if alive — freeze world on death
      if(p.alive) {
        let spdM=CHARS[G.selectedChar].spdM;
        if(p.speedBoost) spdM*=1.15;
        if(p.perfectLandTimer>0) spdM*=1.15; // 15% boost for perfect land
        if(p.dashTimer>0) spdM*=1.6; // dash gives big speed burst
        G.speed=(G.hitStop > 0 ? 0 : G.diff.speed*spdM);
      }
      else G.speed=Math.max(0,G.speed-800*DT); // decelerate to 0
      const scoreMult = p.doubleScore ? 2 : 1;
      G.runScore=(G.score+Math.floor(worldOffset/85)*8)*scoreMult;

      // Timer death
      if(G.timeLeft<=0){G.timeLeft=0;if(p.alive)p.die('timeout');}

      // Level complete! (skipped in endless/daily challenge mode)
      if(!G.endless && !G.dailyChallenge && G.time>=G.levelDef.targetTime && p.alive){
        // Boss fight on every 5th level
        if(G.levelNum % 5 === 0 && !boss) {
          boss = new Boss(G.levelNum);
          G.phase = 'BOSS_FIGHT';
          G.announce = {text: `BOSS: ${boss.name}!`, life: 2.5};
          break;
        }
        G.phase='LEVEL_COMPLETE';
        G.levelCompleteTimer=0;
        calculateLevelStars();
        sfxLevelComplete();
        updateMissionProgress('levelsCompleted', 1);
        const timeBonus=Math.floor(G.timeLeft*10);
        G.score+=timeBonus; G.runScore+=timeBonus;
        trackLevelComplete(G.levelNum, G.runScore, G._levelStarsEarned || 1, G.timeLeft);
        if(G.levelNum>save.highestLevel){save.highestLevel=G.levelNum;persistSave();}
        if(G.runScore>save.bestScore){save.bestScore=G.runScore;G.newHigh=true;persistSave();}
        addTrauma(.3);
        for(let i=0;i<30;i++)spawnParticle(W/2+((Math.random()-.5)*W*.6),H*.4,{
          color:`hsl(${Math.random()*60+30},100%,60%)`,r:UNIT*(.2+Math.random()*.3),
          vx:(Math.random()-.5)*400,vy:-(Math.random()*400+100),decay:.6,grav:500});
        break;
      }

      // Combo timer
      if(G.comboTimer>0){G.comboTimer-=DT;if(G.comboTimer<=0)comboBreak();}

      updateShake(DT);
      updateWorld(DT,G.diff,G.speed,G.rng,G.levelDef.theme);
      updateAmbient(DT,G.theme.amb);

      // Boulder & LOG motion
      for(const ch of chunks)for(const o of ch.obstacles)if(o.vx)o.lx+=o.vx*DT;

      // Enemy spawning
      if(G.levelDef.enemies.length){
        enemySpawnCD-=DT;
        if(enemySpawnCD<=0){
          const spawnProg=clamp(G.time/G.levelDef.targetTime,0,1);
          enemySpawnCD=Math.max(4,9-spawnProg*4);
          spawnEnemy(G.levelDef);
        }
      }
      // Update enemies
      for(let i=activeEnemies.length-1;i>=0;i--){
        activeEnemies[i].update(DT,p,G.speed);
        if(!activeEnemies[i].alive)activeEnemies.splice(i,1);
      }

      p.update(DT);
      if(p.alive && G.hitStop <= 0) checkCollisions(DT);
      for(let i=particles.length-1;i>=0;i--){particles[i].update(DT);if(!particles[i].alive){if(_particlePool.length<_particlePoolMax)_particlePool.push(particles[i]);particles.splice(i,1);}}

      // Death transition
      if(!p.alive){
        G.deathDelay+=DT;
        if(G.deathDelay>1.9){
          if(!G._deathTracked){
            trackDeath(G.levelNum, G._lastDeathCause || 'unknown', G.runScore);
            G._deathTracked=true;
          }
          if(G.dailyChallenge){
            // Daily challenge: no continues, update best
            adDeathCount++; G.phase='DEAD';
            const today = localDateStr(new Date());
            save.lastChallengeDate = today;
            if(G.runScore>save.challengeBest){save.challengeBest=G.runScore;G.newHigh=true;}
            G.dailyChallenge=false;
            updateStatsEndRun();
          } else if(G.endless){
            // Endless: no continues, update best score
            adDeathCount++; G.phase='DEAD';
            if(G.runScore>save.endlessBest){save.endlessBest=G.runScore;G.newHigh=true;}
            updateStatsEndRun();
          } else if(G.continuesLeft>0){
            G.phase='CONTINUE_PROMPT'; G.continuePromptTimer=0;
          } else {
            adDeathCount++; G.phase='DEAD'; checkAdReady();
            // Save progress for Candy Crush style retry
            save.savedLevel=G.levelNum;
            save.savedScore=G.runScore;
            save.savedGems=G.runGems;
            save.cooldownEnd=0; // 5 minute cooldown
            updateStatsEndRun();
          }
          if(G.runScore>save.bestScore){save.bestScore=G.runScore;G.newHigh=true;}
          save.totalGems+=G.runGems;persistSave();
          boss=null;
        }
      }

      // Render
      drawBg(G.theme);
      drawAmbient(G.theme.amb);
      ctx.save();ctx.translate(shX,shY);
      drawObstacles(G.theme);drawGems(G.theme);
      if(p)drawChar(p,false);
      drawPteros(G.theme);drawEnemies();
      if(_perfLevel>=1){var _tn2=Object.keys(THEMES).find(function(k){return THEMES[k]===G.theme;})||'JUNGLE';drawEnvDecoLayer(G.theme,_tn2,3);}
      ctx.restore();
      updateFloatingTexts(DT);
      drawParticles();
      drawFloatingTexts();
      drawDeathTumble();
      drawAnnouncement();
      drawSlowMoEffect();drawSpeedLines();drawPostEffects(G.levelDef.theme);
      if(G.flashLife>0){G.flashLife-=DT;ctx.fillStyle=G.flashColor;ctx.globalAlpha=clamp(G.flashLife/.35,0,1);ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
      if(p.alive||G.deathDelay<1.9) drawHUD(DT);
      drawTooltip();
      if(G.phase==='DEAD'){
        drawDeathScreen();
        if(inp.tapped){inp.tapped=false;handleDeathTap();}
      }
      break;
    }

    case 'PAUSED':
      // Render the game state frozen
      drawBg(G.theme);
      drawAmbient(G.theme.amb);
      ctx.save();ctx.translate(shX,shY);
      drawObstacles(G.theme);drawGems(G.theme);
      if(G.player)drawChar(G.player,false);
      drawPteros(G.theme);drawEnemies();
      if(_perfLevel>=1){var _tn2=Object.keys(THEMES).find(function(k){return THEMES[k]===G.theme;})||'JUNGLE';drawEnvDecoLayer(G.theme,_tn2,3);}
      ctx.restore();
      drawParticles();
      drawFloatingTexts();drawDeathTumble();drawAnnouncement();
      drawSpeedLines();drawPostEffects(G.levelDef.theme);
      if(G.player&&G.player.alive) drawHUD(DT);
      drawPausedScreen();
      if(inp.tapped){inp.tapped=false;handlePausedTap();}
      break;

    case 'TUTORIAL':
      drawTutorial();
      if(inp.tapped){inp.tapped=false;handleTutorialTap();}
      break;

    case 'BOSS_FIGHT': {
      const p=G.player;
      if(boss){
        boss.update(DT, p);
        // Player updates
        p.update(DT);
        updateShake(DT);
        // Ground stays flat during boss fight
        for(let i=particles.length-1;i>=0;i--){particles[i].update(DT);if(!particles[i].alive){if(_particlePool.length<_particlePoolMax)_particlePool.push(particles[i]);particles.splice(i,1);}}
        checkBossCollisions(DT);

        // Boss defeated
        if(boss.defeated){
          G.score+=500; G.runScore+=500;
          G.announce={text:'BOSS DEFEATED! +500',life:2.5};
          sfxLevelComplete();
          addTrauma(.5);
          for(let i=0;i<40;i++)spawnParticle(boss.x,boss.y,{
            color:`hsl(${Math.random()*60+30},100%,60%)`,r:UNIT*(.3+Math.random()*.4),
            vx:(Math.random()-.5)*500,vy:-(Math.random()*500+100),decay:.5,grav:500});
          boss=null;
          if(G.endless){
            G.phase='PLAYING'; G.timeLeft+=15; // bonus time for boss kill in endless
          } else {
            G.phase='LEVEL_COMPLETE'; G.levelCompleteTimer=0;
            calculateLevelStars();
            trackLevelComplete(G.levelNum, G.runScore, G._levelStarsEarned || 1, G.timeLeft);
          }
          if(G.levelNum>save.highestLevel){save.highestLevel=G.levelNum;persistSave();}
          if(G.runScore>save.bestScore){save.bestScore=G.runScore;G.newHigh=true;persistSave();}
        }
        // Timer expired, boss retreats
        else if(boss.bossTimer<=0){
          G.announce={text:'Boss retreats...',life:2};
          boss=null;
          if(G.endless){
            G.phase='PLAYING';
          } else {
            G.phase='LEVEL_COMPLETE'; G.levelCompleteTimer=0;
            calculateLevelStars();
            trackLevelComplete(G.levelNum, G.runScore, G._levelStarsEarned || 1, G.timeLeft);
          }
          sfxLevelComplete();
          if(G.levelNum>save.highestLevel){save.highestLevel=G.levelNum;persistSave();}
          if(G.runScore>save.bestScore){save.bestScore=G.runScore;G.newHigh=true;persistSave();}
        }
        // Player dies during boss fight
        if(p&&!p.alive){
          G.deathDelay+=DT;
          if(G.deathDelay>1.9){
            if(!G._deathTracked){
              trackDeath(G.levelNum, G._lastDeathCause || 'boss', G.runScore);
              G._deathTracked=true;
            }
            boss=null;
            if(G.continuesLeft>0){G.phase='CONTINUE_PROMPT';G.continuePromptTimer=0;}
            else{adDeathCount++; G.phase='DEAD';save.savedLevel=G.levelNum;save.savedScore=G.runScore;save.savedGems=G.runGems;save.cooldownEnd=0;updateStatsEndRun();}
            if(G.runScore>save.bestScore){save.bestScore=G.runScore;G.newHigh=true;}
            save.totalGems+=G.runGems;persistSave();
          }
        }
      }
      // Render
      drawBg(G.theme);
      drawAmbient(G.theme.amb);
      ctx.save();ctx.translate(shX,shY);
      drawTerrain(G.theme);
      if(p)drawChar(p,false);
      ctx.restore();
      drawParticles();
      drawPostEffects(G.levelDef.theme);
      if(boss) { drawBoss(); drawBossHPBar(); }
      if(p&&(p.alive||G.deathDelay<1.9)) drawHUD(DT);
      break;
    }

    case 'STATS':
      drawStatsScreen(DT);
      if(inp.tapped){inp.tapped=false;handleStatsTap();}
      break;

    case 'SHOP':
      drawShopScreen(DT);
      if(inp.tapped){inp.tapped=false;handleShopTap();}
      break;

    case 'SETTINGS':
      drawSettingsScreen(DT);
      if(inp.tapped){inp.tapped=false;handleSettingsTap();}
      break;

    case 'MISSIONS':
      drawMissionsScreen(DT);
      if(inp.tapped){inp.tapped=false;handleMissionsTap();}
      break;

    case 'SKINS':
      drawSkinsScreen(DT);
      if(inp.tapped){inp.tapped=false;handleSkinsTap();}
      break;

    case 'LEVEL_COMPLETE':
      // Keep rendering world in bg
      drawBg(G.theme);
      ctx.save();ctx.translate(shX,shY);
      drawObstacles(G.theme);drawGems(G.theme);
      if(G.player)drawChar(G.player,false);
      drawPteros(G.theme);ctx.restore();
      drawParticles();
      drawPostEffects(G.levelDef.theme);
      for(let i=particles.length-1;i>=0;i--){particles[i].update(DT);if(!particles[i].alive){if(_particlePool.length<_particlePoolMax)_particlePool.push(particles[i]);particles.splice(i,1);}}
      updateShake(DT);
      drawLevelComplete(DT);
      if(inp.tapped&&G.levelCompleteTimer>2){
        inp.tapped=false;
        // Go to spin wheel first, then level map
        G.phase='SPIN_WHEEL';
        G.wheelAngle=0; G.wheelSpinning=false; G.wheelSpeed=0; G.wheelResult=null; G.wheelTimer=0;
        G._postWheelDest='LEVEL_MAP'; // after wheel, go to map instead of next level
      }
      break;

    case 'CONTINUE_PROMPT':
      drawContinuePrompt(DT);
      if(inp.tapped){inp.tapped=false;handleContinueTap();}
      break;

    case 'SPIN_WHEEL':
      drawSpinWheel(DT);
      if(inp.tapped){inp.tapped=false;handleSpinWheelTap();}
      break;

    case 'DEAD':
      if(AudioManager.currentMusicTheme) stopMusic();
      drawDeathScreen();
      if(inp.tapped){inp.tapped=false;handleDeadTap();}
      break;
  }

  inp.tapped=false;
  if (G._prevPhase !== G.phase) {
    trackPhaseView(G.phase);
  }
  G._prevPhase = G.phase;
  // Screen transition fade overlay
  updateFade(DT);updateDeathTumble(DT);updateAnnouncement(DT);
  drawFade();
  // Mini FPS overlay (debug mode only, during gameplay)
  if (debugMode && (G.phase==='PLAYING'||G.phase==='BOSS_FIGHT')) {
    ctx.font='10px monospace';ctx.textAlign='left';ctx.textBaseline='top';
    ctx.fillStyle=_fpsAvg>50?'#0F0':_fpsAvg>30?'#FF0':'#F00';
    ctx.fillText(Math.round(_fpsAvg)+' FPS  Q:'+['L','M','H'][_perfLevel], 8, 8);
    // Mini frame time graph
    ctx.strokeStyle='rgba(0,255,0,0.3)';ctx.lineWidth=1;ctx.beginPath();
    for(var _fi=0;_fi<_frameTimeHistory.length;_fi++){
      var _fy=H-4-Math.min(_frameTimeHistory[_fi],50)*0.8;
      _fi===0?ctx.moveTo(4+_fi,_fy):ctx.lineTo(4+_fi,_fy);
    }
    ctx.stroke();
    // 16ms line (60fps target)
    ctx.strokeStyle='rgba(255,255,0,0.2)';ctx.beginPath();
    ctx.moveTo(4,H-4-16*.8);ctx.lineTo(4+120,H-4-16*.8);ctx.stroke();
  }
  // DEBUG: frame indicator — tiny green dot in bottom-left, red if canvas is tiny
  ctx.globalAlpha=1;ctx.fillStyle=(W>10&&H>10)?'#0F0':'#F00';
  ctx.fillRect(4,H-8,4+((window._fc=(window._fc||0)+1)%60)*.5,4);
  }catch(e){
    console.error('Game loop error:',e);
    // DEBUG: show error overlay so user can report it
    if(!window._errDiv){
      window._errDiv=document.createElement('div');
      window._errDiv.style.cssText='position:fixed;top:0;left:0;right:0;padding:12px;background:red;color:white;font:14px monospace;z-index:9999;white-space:pre-wrap;word-break:break-all';
      document.body.appendChild(window._errDiv);
    }
    window._errDiv.textContent='GAME ERROR ('+G.phase+'): '+e.message+'\n'+((e.stack||'').split('\n').slice(0,4).join('\n'));
    // Forward error to React Native for crash reporting
    if (window.ReactNativeWebView) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'crash',
          phase: G.phase,
          message: e.message,
          stack: (e.stack||'').split('\n').slice(0,6).join('\n'),
          fps: _fpsAvg ? Math.round(_fpsAvg) : -1,
          particles: particles ? particles.length : -1
        }));
      } catch(ex) {}
    }
    window._lastGameError=e;
  }
  requestAnimationFrame(loop);

// Global error handler — catches errors outside the game loop
window.onerror = function(msg, url, line, col, err) {
  if (window.ReactNativeWebView) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'crash',
        phase: typeof G !== 'undefined' ? G.phase : 'unknown',
        message: msg,
        stack: (err && err.stack) ? err.stack.split('\n').slice(0,4).join('\n') : url+':'+line+':'+col,
        fps: typeof _fpsAvg !== 'undefined' ? Math.round(_fpsAvg) : -1,
        particles: typeof particles !== 'undefined' ? particles.length : -1
      }));
    } catch(ex) {}
  }
};
window.onunhandledrejection = function(event) {
  if (window.ReactNativeWebView) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'crash',
        phase: typeof G !== 'undefined' ? G.phase : 'unknown',
        message: 'Unhandled promise: ' + (event.reason ? event.reason.message || String(event.reason) : 'unknown'),
        stack: event.reason && event.reason.stack ? event.reason.stack.split('\n').slice(0,4).join('\n') : '',
        fps: typeof _fpsAvg !== 'undefined' ? Math.round(_fpsAvg) : -1,
        particles: typeof particles !== 'undefined' ? particles.length : -1
      }));
    } catch(ex) {}
  }
};
}

// ============================================================
// INIT
// ============================================================
loadSave();
trackSessionStart();
checkMissionResets();
G.selectedChar=safeSelectedChar();
resize();
initBg();

function roundSnapshotValue(value) {
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

function snapshotEntity(entity) {
  if (!entity) return null;
  return {
    x: roundSnapshotValue(entity.x),
    y: roundSnapshotValue(entity.y),
    vx: roundSnapshotValue(entity.vx),
    vy: roundSnapshotValue(entity.vy),
    hp: Number.isFinite(entity.hp) ? entity.hp : null,
    kind: entity.kind || entity.type || entity.name || null,
  };
}

window.render_game_to_text = function renderGameToText() {
  const pendingGuideStep = getGuidedPendingStep();
  const continuePrompt = G.phase === 'CONTINUE_PROMPT' ? getContinuePromptViewModel() : null;
  const rewardReadyCount = getUnclaimedMissionCount();
  const player = G.player ? {
    alive: !!G.player.alive,
    char: CHARS[G.selectedChar] ? CHARS[G.selectedChar].id : 'unknown',
    grounded: !!G.player.onGround,
    hp: Number.isFinite(G.player.hp) ? G.player.hp : null,
    max_hp: Number.isFinite(G.player.maxHP) ? G.player.maxHP : null,
    shield: !!G.player.shield,
    x: roundSnapshotValue(G.player.x),
    y: roundSnapshotValue(G.player.y),
    vx: roundSnapshotValue(G.player.vx),
    vy: roundSnapshotValue(G.player.vy),
  } : null;

  const hazards = [];
  for (let i = 0; i < Math.min(chunks.length, 3); i++) {
    const chunk = chunks[i];
    if (!chunk || !Array.isArray(chunk.obstacles)) continue;
    for (let j = 0; j < Math.min(chunk.obstacles.length, 4); j++) {
      const hazard = snapshotEntity(chunk.obstacles[j]);
      if (hazard) hazards.push(hazard);
    }
  }

  return JSON.stringify({
    coord_space: {
      origin: 'top-left',
      x_axis: 'right',
      y_axis: 'down',
    },
    hud: {
      continues_left: G.continuesLeft,
      gems: G.runGems,
      score: G.runScore,
      time_left: roundSnapshotValue(G.timeLeft),
    },
    level: G.levelNum,
    phase: G.phase,
    onboarding: G.onboarding ? {
      level: G.onboarding.level,
      title: G.onboarding.title,
      completed: !!G.onboarding.completed,
      pending: pendingGuideStep ? pendingGuideStep.label : null,
      guided_chunk_cursor: G.guidedChunkCursor || 0,
      steps: G.onboarding.steps.map(function(step) {
        return { label: step.label, done: !!step.done };
      }),
    } : null,
    missions: {
      rewards_ready: rewardReadyCount,
    },
    continue_prompt: continuePrompt ? {
      title: continuePrompt.title,
      lesson_chip: continuePrompt.lessonChip,
      primary_label: continuePrompt.primaryLabel,
      secondary_label: continuePrompt.secondaryLabel,
    } : null,
    player,
    boss: boss ? snapshotEntity(boss) : null,
    enemies: activeEnemies.slice(0, 8).map(snapshotEntity).filter(Boolean),
    hazards,
    particles: particles.length,
    tooltip: tooltipState.active ? tooltipState.text : null,
    viewport: {
      height: roundSnapshotValue(H),
      width: roundSnapshotValue(W),
    },
  });
};

window.advanceTime = function advanceTime(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, Math.max(0, Number(ms) || 0));
  });
};

requestAnimationFrame(loop);
