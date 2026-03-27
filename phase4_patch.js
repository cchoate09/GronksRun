const fs = require('fs');
let h = fs.readFileSync('index.html', 'utf8');
let patchCount = 0;

function patch(label, old, replacement) {
  if (!h.includes(old)) {
    console.log('WARN: Could not find target for: ' + label);
    console.log('  First 100 chars: ' + JSON.stringify(old.substring(0, 100)));
    return false;
  }
  h = h.replace(old, replacement);
  patchCount++;
  console.log(patchCount + '. ' + label);
  return true;
}

// ============================================================
// 1. FPS COUNTER + PERFORMANCE HUD
// Enhance existing debug panel with rolling FPS average + frame time graph
// ============================================================
patch('FPS counter (rolling average)',
  'let debugMode = false;',
  `let debugMode = false;
// Performance monitoring
let _fpsHistory = [];
let _fpsAvg = 60;
let _frameTimeHistory = [];
let _perfLevel = 2; // 0=low, 1=medium, 2=high (auto-detected)
let _perfSamples = 0;
let _perfDetected = false;`
);

// Add FPS tracking to main loop
patch('FPS tracking in loop',
  'const raw=(ts-lastT)/1000; lastT=ts;',
  `const raw=(ts-lastT)/1000; lastT=ts;
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
  }`
);

// Enhance existing debug panel with more perf info
patch('Enhanced debug panel',
  "    `FPS: ${(1/Math.max(DT,0.001)).toFixed(0)}  |  Particles: ${particles.length}/${MAX_PARTICLES}`,",
  "    `FPS: ${_fpsAvg.toFixed(0)} (${(1/Math.max(DT,0.001)).toFixed(0)} instant)  |  Quality: ${['LOW','MED','HIGH'][_perfLevel]}`,\n    `Particles: ${particles.length}/${MAX_PARTICLES}  |  Pool: ${_particlePool.length}  |  Ambients: ${ambients.length}`,\n    `Frame: ${(DT*1000).toFixed(1)}ms  |  Chunks: ${typeof chunks!=='undefined'?chunks.length:'--'}  |  Online: ${isOnline}`,\n    `Ads: ready=${adReady} deaths=${adDeathCount} last=${adLastShownTime?Math.round((Date.now()-adLastShownTime)/1000)+'s ago':'never'}`,\n    `Save: ${JSON.stringify(save).length} bytes  |  Sprites: G=${gronkSpriteReady} P=${pipSpriteReady}`,\n    `Event: ${_activeEvent?_activeEvent.name:'none'}  |  Streak: ${save.dailyStreak}d`,",
);

// Remove the old duplicate lines from debug panel
patch('Remove old debug lines',
  "    `Save: Lvl ${save.highestLevel} | Best ${save.bestScore} | Gems ${save.totalGems}`,\n    `Pool: ${_particlePool.length} recycled  |  Chunks: ${typeof chunks!=='undefined'?chunks.length:'--'}`,",
  "    `Save: Lvl ${save.highestLevel} | Best ${save.bestScore} | Gems ${save.totalGems}`,",
);

// Add mini FPS overlay in PLAYING phase (when debug mode is on)
patch('Mini FPS overlay in gameplay',
  "  // DEBUG: frame indicator",
  `  // Mini FPS overlay (debug mode only, during gameplay)
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
  // DEBUG: frame indicator`
);

console.log('   FPS counter + perf HUD: done\n');

// ============================================================
// 2. ADAPTIVE QUALITY — reduce effects on slow devices
// ============================================================
// Reduce star count based on performance level
patch('Adaptive stars',
  'for(let i=0;i<60;i++){',
  'const _starCount = _perfLevel === 0 ? 20 : _perfLevel === 1 ? 40 : 60;\n    for(let i=0;i<_starCount;i++){'
);

// Reduce cloud count based on performance level
patch('Adaptive clouds',
  'for(let i=0;i<6;i++){\n    const cx=',
  'const _cloudCount = _perfLevel === 0 ? 2 : _perfLevel === 1 ? 4 : 6;\n  for(let i=0;i<_cloudCount;i++){\n    const cx='
);

// Reduce particle spawn on low perf
patch('Adaptive particles',
  'const MAX_PARTICLES = 200;',
  'let MAX_PARTICLES = 200;\nfunction updateMaxParticles() { MAX_PARTICLES = _perfLevel === 0 ? 60 : _perfLevel === 1 ? 120 : 200; }'
);

// Reduce ambient max on low perf
patch('Adaptive ambients',
  'if (ambients.length < 30 && Math.random() < 0.3)',
  'const _ambMax = _perfLevel === 0 ? 10 : _perfLevel === 1 ? 20 : 30;\n  if (ambients.length < _ambMax && Math.random() < 0.3)'
);

// Reduce gem sparkle on low perf
patch('Adaptive gem sparkle',
  'for(let i=0;i<12;i++) spawnParticle(x,y,{',
  'const _gemParts = _perfLevel === 0 ? 4 : _perfLevel === 1 ? 8 : 12;\nfor(let i=0;i<_gemParts;i++) spawnParticle(x,y,{'
);

// Reduce death FX on low perf
patch('Adaptive death FX',
  'for(let i=0;i<24;i++) spawnParticle(x,y,{',
  'const _deathParts = _perfLevel === 0 ? 8 : _perfLevel === 1 ? 16 : 24;\nfor(let i=0;i<_deathParts;i++) spawnParticle(x,y,{'
);

// Skip vignette on low perf (expensive radial gradient)
patch('Adaptive vignette',
  'function drawVignette() {',
  'function drawVignette() {\n  if (_perfLevel === 0) return; // skip on low-end devices'
);

// Skip atmospheric overlay on low perf
patch('Adaptive atmospheric overlay',
  'function drawAtmosphericOverlay(themeName) {\n  const ac = ATMO_COLORS[themeName];',
  'function drawAtmosphericOverlay(themeName) {\n  if (_perfLevel === 0) return; // skip on low-end devices\n  const ac = ATMO_COLORS[themeName];'
);

console.log('   Adaptive quality: done\n');

// ============================================================
// 3. MEMORY MANAGEMENT — limit caches, cleanup
// ============================================================
patch('Memory management (vignette cache cleanup on resize)',
  'function resize() {',
  'function resize() {\n  // Clear cached canvases on resize to free memory\n  _vignetteCache = null;'
);

// Add sprite frame cleanup for non-selected characters after prolonged inactivity
patch('Memory management (sprite canvas size limit note)',
  'let gronkSpriteReady = false, gronkSpriteLoading = false;',
  '// Sprite memory: each character = 16 frames × 128×128 pixels × 4 bytes = ~1MB decoded\n// Total with 2 characters: ~2MB — acceptable for modern devices\nlet gronkSpriteReady = false, gronkSpriteLoading = false;'
);

console.log('   Memory management: done\n');

// ============================================================
// 4. ANALYTICS EVENT BRIDGE — prep for Firebase
// ============================================================
patch('Analytics bridge',
  'function haptic(pattern) {',
  `// ============================================================
// ANALYTICS EVENT BRIDGE
// Sends game events to React Native for Firebase/analytics integration
// Events are no-ops if analytics isn't configured on the native side
// ============================================================
function logEvent(eventName, params) {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'analytics',
      event: eventName,
      params: params || {}
    }));
  }
}
// Key game events to track:
function trackLevelStart(levelNum) { logEvent('level_start', { level: levelNum }); }
function trackLevelComplete(levelNum, score, stars, timeLeft) {
  logEvent('level_complete', { level: levelNum, score: score, stars: stars, time_left: Math.round(timeLeft) });
}
function trackDeath(levelNum, cause, score) {
  logEvent('player_death', { level: levelNum, cause: cause || 'unknown', score: score });
}
function trackAdWatched(rewardType) { logEvent('ad_watched', { reward_type: rewardType }); }
function trackPurchase(itemId, cost) { logEvent('shop_purchase', { item: itemId, cost: cost }); }
function trackAchievement(achId) { logEvent('achievement_unlocked', { achievement: achId }); }
function trackSessionStart() { logEvent('session_start', { highest_level: save.highestLevel, total_gems: save.totalGems }); }
function trackShare(context) { logEvent('share', { context: context }); }

function haptic(pattern) {`
);

// Wire analytics into existing code points
// Track level start
patch('Analytics: level start',
  "function startLevel(num) {",
  "function startLevel(num) {\n  trackLevelStart(num);"
);

// Track achievement unlocks
patch('Analytics: achievement unlock',
  "      achievementPopup = { name: a.name,",
  "      trackAchievement(a.id);\n      achievementPopup = { name: a.name,"
);

// Track ad watched
patch('Analytics: ad watched',
  "function requestAd(rewardType) {\n  adLastShownTime = Date.now();",
  "function requestAd(rewardType) {\n  trackAdWatched(rewardType);\n  adLastShownTime = Date.now();"
);

// Track share
patch('Analytics: share',
  "function captureAndShare(text) {",
  "function captureAndShare(text) {\n  trackShare('death_or_complete');"
);

// Track session start on load
patch('Analytics: session start',
  'loadSave();',
  'loadSave();\ntrackSessionStart();'
);

console.log('   Analytics bridge: done\n');

// ============================================================
// 5. CRASH REPORTING BRIDGE — forward WebView errors to RN
// ============================================================
patch('Crash reporting bridge',
  "window._errDiv.textContent='GAME ERROR ('+G.phase+'): '+e.message+'\\n'+((e.stack||'').split('\\n').slice(0,4).join('\\n'));",
  `window._errDiv.textContent='GAME ERROR ('+G.phase+'): '+e.message+'\\n'+((e.stack||'').split('\\n').slice(0,4).join('\\n'));
    // Forward error to React Native for crash reporting
    if (window.ReactNativeWebView) {
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'crash',
          phase: G.phase,
          message: e.message,
          stack: (e.stack||'').split('\\n').slice(0,6).join('\\n'),
          fps: _fpsAvg ? Math.round(_fpsAvg) : -1,
          particles: particles ? particles.length : -1
        }));
      } catch(ex) {}
    }`
);

// Also add global error handler for unhandled errors
patch('Global error handler',
  'requestAnimationFrame(loop);',
  `requestAnimationFrame(loop);

// Global error handler — catches errors outside the game loop
window.onerror = function(msg, url, line, col, err) {
  if (window.ReactNativeWebView) {
    try {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'crash',
        phase: typeof G !== 'undefined' ? G.phase : 'unknown',
        message: msg,
        stack: (err && err.stack) ? err.stack.split('\\n').slice(0,4).join('\\n') : url+':'+line+':'+col,
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
        stack: event.reason && event.reason.stack ? event.reason.stack.split('\\n').slice(0,4).join('\\n') : '',
        fps: typeof _fpsAvg !== 'undefined' ? Math.round(_fpsAvg) : -1,
        particles: typeof particles !== 'undefined' ? particles.length : -1
      }));
    } catch(ex) {}
  }
};`
);

console.log('   Crash reporting bridge: done\n');

fs.writeFileSync('index.html', h);
console.log('=== All ' + patchCount + ' Phase 4 patches applied ===');
