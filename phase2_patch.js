const fs = require('fs');
let h = fs.readFileSync('index.html', 'utf8');
let changed = 0;

function patch(label, old, replacement) {
  if (!h.includes(old)) {
    console.log('WARN: Could not find target for: ' + label);
    console.log('  First 80 chars: ' + old.substring(0, 80));
    return false;
  }
  h = h.replace(old, replacement);
  changed++;
  console.log(changed + '. ' + label + ': done');
  return true;
}

// ============================================================
// 1. FIRST-RUN ONBOARDING
// ============================================================
patch('First-run onboarding',
  "if (lt >= 1.5 && ((gronkSpriteReady && pipSpriteReady) || lt >= 5)) { G.phase = 'MENU'; G.fadeAlpha = 0; startMusic('JUNGLE'); }",
  `if (lt >= 1.5 && ((gronkSpriteReady && pipSpriteReady) || lt >= 5)) {
        G.fadeAlpha = 0;
        if (save.highestLevel === 0 && !save.tutorialSeen) {
          // First-run: skip menu, go straight to playing
          G.selectedChar = 0; save.selectedChar = 0;
          startNewRun();
          startMusic(G.theme ? G.theme.name || 'JUNGLE' : 'JUNGLE');
        } else {
          G.phase = 'MENU';
          startMusic('JUNGLE');
        }
      }`
);

// ============================================================
// 2. QUICK RESTART — remove cooldown, instant retry
// ============================================================
// Death screen draw: replace cooldown section
patch('Quick restart (draw)',
  `  // Cooldown timer or retry button
  const cdRemain = save.cooldownEnd - Date.now();
  const btnW=u*8,btnH=u*1.3;`,
  `  // Quick retry + level map buttons
  const btnW=u*8,btnH=u*1.3;`
);

// Remove the entire cooldown if/else block and replace with simple buttons
// Let me find and replace the whole block differently - by targeting the unique structure
// First find where "Progress saved" line is
const progressSavedIdx = h.indexOf("ctx.fillText(`Progress saved at Level ${G.levelNum}`");
const cooldownStart = h.indexOf("// Cooldown timer or retry button", progressSavedIdx > 0 ? progressSavedIdx : 0);
// Actually let me do targeted replacements instead

// Replace cooldown timer display
patch('Quick restart (remove cooldown timer)',
  `  if (cdRemain > 0) {
    const mins = Math.max(0, Math.floor(cdRemain/60000));
    const secs = Math.max(0, Math.min(59, Math.ceil((cdRemain%60000)/1000)));
    ctx.font=\`bold \${u*.8}px monospace\`;ctx.fillStyle='#FF8844';
    ctx.fillText(\`Retry in \${mins}:\${secs<10?'0':''}$\{secs}\`,W/2,H*.62);

    // Level Map button
    const nrY=H-SAFE_BOTTOM-u*2;
    ctx.fillStyle='rgba(255,255,255,0.1)';ctx.fillRect(W/2-btnW/2,nrY,btnW,btnH);
    ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1;ctx.strokeRect(W/2-btnW/2,nrY,btnW,btnH);
    ctx.font=\`bold \${u*.6}px monospace\`;ctx.fillStyle='rgba(255,255,255,0.6)';
    ctx.fillText('LEVEL MAP',W/2,nrY+btnH/2);
  } else {
    // Cooldown expired — show resume button
    const pulse=1+Math.sin(Date.now()*.005)*.05;
    ctx.save();ctx.translate(W/2,H*.62);ctx.scale(pulse,pulse);
    ctx.fillStyle='#22AA44';ctx.fillRect(-btnW/2,-btnH/2,btnW,btnH);
    ctx.strokeStyle='#44DD66';ctx.lineWidth=2;ctx.strokeRect(-btnW/2,-btnH/2,btnW,btnH);
    ctx.font=\`bold \${u*.75}px monospace\`;ctx.fillStyle='white';
    ctx.fillText(\`RETRY L\${save.savedLevel}\`,0,0);ctx.restore();

    // Level Map button
    const nrY=H-SAFE_BOTTOM-u*2;
    ctx.fillStyle='rgba(255,255,255,0.1)';ctx.fillRect(W/2-btnW/2,nrY,btnW,btnH*.8);
    ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1;ctx.strokeRect(W/2-btnW/2,nrY,btnW,btnH*.8);
    ctx.font=\`\${u*.55}px monospace\`;ctx.fillStyle='rgba(255,255,255,0.6)';
    ctx.fillText('LEVEL MAP',W/2,nrY+btnH*.4);
  }`,
  `  // Retry button — always available, no cooldown
  const pulse=1+Math.sin(Date.now()*.005)*.05;
  ctx.save();ctx.translate(W/2,H*.58);ctx.scale(pulse,pulse);
  ctx.fillStyle='#22AA44';ctx.fillRect(-btnW/2,-btnH/2,btnW,btnH);
  ctx.strokeStyle='#44DD66';ctx.lineWidth=2;ctx.strokeRect(-btnW/2,-btnH/2,btnW,btnH);
  ctx.font=\`bold \${u*.75}px monospace\`;ctx.fillStyle='white';
  ctx.fillText('RETRY',0,0);ctx.restore();

  // New Run button
  const nrY2=H*.72;
  ctx.fillStyle='rgba(100,100,255,0.3)';ctx.fillRect(W/2-btnW/2,nrY2,btnW,btnH*.85);
  ctx.strokeStyle='rgba(150,150,255,0.5)';ctx.lineWidth=1;ctx.strokeRect(W/2-btnW/2,nrY2,btnW,btnH*.85);
  ctx.font=\`bold \${u*.55}px monospace\`;ctx.fillStyle='rgba(200,200,255,0.9)';
  ctx.fillText('NEW RUN',W/2,nrY2+btnH*.42);

  // Level Map button
  const lmY=H-SAFE_BOTTOM-u*2;
  ctx.fillStyle='rgba(255,255,255,0.1)';ctx.fillRect(W/2-btnW/2,lmY,btnW,btnH*.8);
  ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1;ctx.strokeRect(W/2-btnW/2,lmY,btnW,btnH*.8);
  ctx.font=\`\${u*.55}px monospace\`;ctx.fillStyle='rgba(255,255,255,0.6)';
  ctx.fillText('LEVEL MAP',W/2,lmY+btnH*.4);`
);

// Update tap handler
patch('Quick restart (tap handler)',
  `  // Retry / Level Map buttons
  const cdRemain = save.cooldownEnd - Date.now();
  const btnW=u*8,btnH=u*1.3;
  if (cdRemain > 0) {
    const nrY=H-SAFE_BOTTOM-u*2;
    if(tx>W/2-btnW/2&&tx<W/2+btnW/2&&ty>nrY&&ty<nrY+btnH){
      stopMusic(); G.phase='LEVEL_MAP'; G._nextLevelNum=0; sfxUITap(); return;
    }
  } else {
    // Retry button
    const retryY = H*.62 - btnH/2;
    if(tx>W/2-btnW/2&&tx<W/2+btnW/2&&ty>retryY&&ty<retryY+btnH){
      resumeFromSave(); sfxUITap(); return;
    }
    // Level Map button
    const nrY=H-SAFE_BOTTOM-u*2;
    if(tx>W/2-btnW/2&&tx<W/2+btnW/2&&ty>nrY&&ty<nrY+btnH*.8){
      stopMusic(); G.phase='LEVEL_MAP'; G._nextLevelNum=0; sfxUITap(); return;
    }
  }`,
  `  // Quick retry / New Run / Level Map buttons
  const btnW=u*8,btnH=u*1.3;
  // Retry button (same level)
  const retryY = H*.58 - btnH/2;
  if(tx>W/2-btnW/2&&tx<W/2+btnW/2&&ty>retryY&&ty<retryY+btnH){
    resumeFromSave(); sfxUITap(); return;
  }
  // New Run button
  const nrY2=H*.72;
  if(tx>W/2-btnW/2&&tx<W/2+btnW/2&&ty>nrY2&&ty<nrY2+btnH*.85){
    startNewRun(); sfxUITap(); return;
  }
  // Level Map button
  const lmY=H-SAFE_BOTTOM-u*2;
  if(tx>W/2-btnW/2&&tx<W/2+btnW/2&&ty>lmY&&ty<lmY+btnH*.8){
    stopMusic(); G.phase='LEVEL_MAP'; G._nextLevelNum=0; sfxUITap(); return;
  }`
);

// Remove cooldown timer set on death
h = h.replace(
  /save\.cooldownEnd=Date\.now\(\)\+5\*60\*1000;/g,
  'save.cooldownEnd=0;'
);
console.log('   Cooldown removal: done');

// ============================================================
// 3. ENHANCED PROCEDURAL MUSIC
// ============================================================
patch('Enhanced music (startMusic)',
  `function startMusic(themeName) {
  if (!audioCtx || musicVolume <= 0) return;
  stopMusic();
  initAudioRouting();
  const pat = MUSIC_PATTERNS[themeName] || MUSIC_PATTERNS.JUNGLE;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, audioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + 2);
  gain.connect(musicGain);

  // Bass drone
  const bass = audioCtx.createOscillator();
  bass.type = 'sine';
  bass.frequency.value = pat.scale[0] * 0.5;
  const bassG = audioCtx.createGain();
  bassG.gain.value = 0.15;
  bass.connect(bassG);
  bassG.connect(gain);
  bass.start();

  // Melody arpeggio
  const mel = audioCtx.createOscillator();
  mel.type = pat.type;
  mel.frequency.value = pat.scale[0];
  const melG = audioCtx.createGain();
  melG.gain.value = 0.06;
  mel.connect(melG);
  melG.connect(gain);
  mel.start();

  // Schedule note changes
  let noteIdx = 0;
  const interval = setInterval(() => {
    if (!musicNodes) { clearInterval(interval); return; }
    noteIdx = (noteIdx + 1) % pat.scale.length;
    try { mel.frequency.setValueAtTime(pat.scale[noteIdx], audioCtx.currentTime); } catch(e) {}
  }, pat.tempo * 1000);

  musicNodes = { bass, mel, gain, interval };
  currentMusicTheme = themeName;
}`,
  `function startMusic(themeName) {
  if (!audioCtx || musicVolume <= 0) return;
  stopMusic();
  initAudioRouting();
  const pat = MUSIC_PATTERNS[themeName] || MUSIC_PATTERNS.JUNGLE;
  const t = audioCtx.currentTime;
  const gain = audioCtx.createGain();
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.10, t + 2);
  gain.connect(musicGain);

  // Low-pass filter for warmth
  const lpf = audioCtx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 800;
  lpf.Q.value = 1.5;
  lpf.connect(gain);

  // Bass drone
  const bass = audioCtx.createOscillator();
  bass.type = 'sine';
  bass.frequency.value = pat.scale[0] * 0.5;
  const bassG = audioCtx.createGain();
  bassG.gain.value = 0.18;
  bass.connect(bassG); bassG.connect(lpf);
  bass.start();

  // Sub bass (octave below)
  const sub = audioCtx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = pat.scale[0] * 0.25;
  const subG = audioCtx.createGain();
  subG.gain.value = 0.10;
  sub.connect(subG); subG.connect(lpf);
  sub.start();

  // Pad: detuned triangle for ambient texture
  const pad = audioCtx.createOscillator();
  pad.type = 'triangle';
  pad.frequency.value = pat.scale[2] || pat.scale[0];
  pad.detune.value = 7;
  const padG = audioCtx.createGain();
  padG.gain.value = 0.04;
  pad.connect(padG); padG.connect(gain);
  pad.start();

  // Melody arpeggio through filter
  const mel = audioCtx.createOscillator();
  mel.type = pat.type;
  mel.frequency.value = pat.scale[0];
  const melG = audioCtx.createGain();
  melG.gain.value = 0.07;
  mel.connect(melG); melG.connect(lpf);
  mel.start();

  // High shimmer (octave above, very quiet)
  const shimmer = audioCtx.createOscillator();
  shimmer.type = 'sine';
  shimmer.frequency.value = pat.scale[0] * 2;
  const shimG = audioCtx.createGain();
  shimG.gain.value = 0.015;
  shimmer.connect(shimG); shimmer.connect(gain);
  shimmer.start();

  // Rhythm pulse: LFO modulates pad gain
  const lfo = audioCtx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 1.0 / pat.tempo;
  const lfoG = audioCtx.createGain();
  lfoG.gain.value = 0.02;
  lfo.connect(lfoG); lfoG.connect(padG.gain);
  lfo.start();

  // Schedule note changes with pattern variation
  let noteIdx = 0;
  let barCount = 0;
  const interval = setInterval(() => {
    if (!musicNodes) { clearInterval(interval); return; }
    noteIdx = (noteIdx + 1) % pat.scale.length;
    barCount++;
    try {
      const ct = audioCtx.currentTime;
      mel.frequency.setValueAtTime(pat.scale[noteIdx], ct);
      shimmer.frequency.setValueAtTime(pat.scale[noteIdx] * 2, ct);
      // Shift pad note for chord movement every 2 bars
      if (barCount % (pat.scale.length * 2) === 0) {
        pad.frequency.setValueAtTime(pat.scale[(noteIdx + 2) % pat.scale.length], ct);
      }
      // Gentle filter sweep every full cycle
      if (barCount % pat.scale.length === 0) {
        lpf.frequency.linearRampToValueAtTime(600 + Math.sin(barCount * 0.3) * 300, ct + pat.tempo * 0.5);
      }
    } catch(e) {}
  }, pat.tempo * 1000);

  musicNodes = { bass, sub, pad, mel, shimmer, lfo, lpf, gain, interval };
  currentMusicTheme = themeName;
}`
);

// Update stopMusic for new nodes
patch('Enhanced music (stopMusic)',
  `function stopMusic() {
  if (!musicNodes) return;
  clearInterval(musicNodes.interval);
  try {
    musicNodes.gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
    setTimeout(() => {
      try { musicNodes.bass.stop(); } catch(e) {}
      try { musicNodes.mel.stop(); } catch(e) {}
      musicNodes = null;
    }, 600);
  } catch(e) { musicNodes = null; }
  currentMusicTheme = null;
}`,
  `function stopMusic() {
  if (!musicNodes) return;
  clearInterval(musicNodes.interval);
  try {
    musicNodes.gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
    setTimeout(() => {
      ['bass','sub','pad','mel','shimmer','lfo'].forEach(function(n) {
        try { if(musicNodes && musicNodes[n]) musicNodes[n].stop(); } catch(e) {}
      });
      musicNodes = null;
    }, 600);
  } catch(e) { musicNodes = null; }
  currentMusicTheme = null;
}`
);

// ============================================================
// 4. HAPTIC FEEDBACK
// ============================================================
patch('Haptic feedback (bridge function)',
  'function checkAdReady() {',
  `function haptic(pattern) {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'haptic', pattern: pattern }));
  }
}
function checkAdReady() {`
);

// Add haptic to SFX functions
h = h.replace(
  /function sfxHit\(\) \{/,
  "function sfxHit() {\n  haptic('medium');"
);
h = h.replace(
  /function sfxDeath\(\) \{/,
  "function sfxDeath() {\n  haptic('heavy');"
);
h = h.replace(
  /function sfxGem\(\) \{/,
  "function sfxGem() {\n  haptic('light');"
);
h = h.replace(
  /function sfxLevelComplete\(\) \{/,
  "function sfxLevelComplete() {\n  haptic([50,50,100]);"
);
console.log((++changed) + '. Haptic feedback: done');

// ============================================================
// 5. SCREEN TRANSITIONS — snappier fade
// ============================================================
patch('Snappier transitions',
  'G.fadeAlpha += G.fadeDir * dt * 4; // 0.25s fade',
  'G.fadeAlpha += G.fadeDir * dt * 5; // 0.2s fade (snappier)'
);

// ============================================================
// 6. LOADING PERFORMANCE — lazy sprite loading
// ============================================================
patch('Lazy sprite loading (load phase)',
  `if (lt >= 1.5 && !gronkSpriteLoading) initGronkSprite();
      if (lt >= 1.5 && !pipSpriteLoading) initPipSprite();`,
  `// Load selected character sprite first, defer others
      if (lt >= 1.5) {
        const _sel = safeSelectedChar();
        if (_sel === 0 && !gronkSpriteLoading) initGronkSprite();
        else if (_sel === 1 && !pipSpriteLoading) initPipSprite();
        else if (!gronkSpriteLoading) initGronkSprite();
      }`
);

// Note: The LOADING→MENU transition was already changed by first-run onboarding patch
// We need to update the ready check inside that new code
h = h.replace(
  "if (save.highestLevel === 0 && !save.tutorialSeen) {",
  `// Only wait for selected character sprite
      const _selReady = (safeSelectedChar()===0 ? gronkSpriteReady : safeSelectedChar()===1 ? pipSpriteReady : gronkSpriteReady);
      if (!_selReady && lt < 5) break; // still loading
      if (save.highestLevel === 0 && !save.tutorialSeen) {`
);

// Lazy-load other sprites from MENU
patch('Lazy sprite loading (menu)',
  "case 'MENU':\n      drawMenu();",
  "case 'MENU':\n      if (!gronkSpriteLoading) initGronkSprite();\n      if (!pipSpriteLoading) initPipSprite();\n      drawMenu();"
);

// ============================================================
// 7. SETTINGS — credits section
// ============================================================
patch('Settings credits',
  `  // Version
  ctx.textAlign = 'center'; ctx.font = FONTS['n0.4'] || (Math.round(u*0.4) + 'px monospace');
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('Gronk\\'s Run v1.2', W/2, y);`,
  `  // Credits
  ctx.textAlign = 'center';
  ctx.font = FONTS['b0.5'] || ('bold ' + Math.round(u*0.5) + 'px monospace');
  ctx.fillStyle = 'rgba(255,215,0,0.6)';
  ctx.fillText('CREDITS', W/2, y); y += u * 0.8;
  ctx.font = FONTS['n0.4'] || (Math.round(u*0.4) + 'px monospace');
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText('Game Design & Programming', W/2, y); y += u * 0.5;
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('Built with HTML5 Canvas + Expo', W/2, y); y += u * 0.7;
  // Version
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('Gronk\\'s Run v1.3', W/2, y);`
);

fs.writeFileSync('index.html', h);
console.log('\n=== All ' + changed + ' Phase 2 patches applied ===');
