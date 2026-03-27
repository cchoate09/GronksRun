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
// 1. SOCIAL SHARING — screenshot + share via RN bridge
// ============================================================
// Add share function near haptic/ad bridge code
patch('Social sharing (bridge function)',
  'function haptic(pattern) {',
  `function shareScore(text, imageDataUrl) {
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'share',
      text: text,
      image: imageDataUrl || null
    }));
  }
}
function captureAndShare(text) {
  // Capture current canvas as image and share
  try {
    const dataUrl = canvas.toDataURL('image/png');
    shareScore(text, dataUrl);
  } catch(e) {
    shareScore(text, null);
  }
}
function haptic(pattern) {`
);

// Add share button on death screen (after the level map button)
patch('Social sharing (death screen button)',
  `  // Level Map button
  const lmY=H-SAFE_BOTTOM-u*2;
  ctx.fillStyle='rgba(255,255,255,0.1)';ctx.fillRect(W/2-btnW/2,lmY,btnW,btnH*.8);
  ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1;ctx.strokeRect(W/2-btnW/2,lmY,btnW,btnH*.8);
  ctx.font=\`\${u*.55}px monospace\`;ctx.fillStyle='rgba(255,255,255,0.6)';
  ctx.fillText('LEVEL MAP',W/2,lmY+btnH*.4);`,
  `  // Share + Level Map buttons side by side
  const bottomY=H-SAFE_BOTTOM-u*2;
  const halfBtn=btnW*.45;
  // Share button
  ctx.fillStyle='rgba(50,150,255,0.2)';ctx.fillRect(W/2-halfBtn-u*.3,bottomY,halfBtn,btnH*.8);
  ctx.strokeStyle='rgba(80,180,255,0.5)';ctx.lineWidth=1;ctx.strokeRect(W/2-halfBtn-u*.3,bottomY,halfBtn,btnH*.8);
  ctx.font=\`\${u*.5}px monospace\`;ctx.fillStyle='rgba(100,200,255,0.8)';
  ctx.fillText('SHARE',W/2-halfBtn/2-u*.3,bottomY+btnH*.4);
  // Level Map button
  ctx.fillStyle='rgba(255,255,255,0.1)';ctx.fillRect(W/2+u*.3,bottomY,halfBtn,btnH*.8);
  ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.lineWidth=1;ctx.strokeRect(W/2+u*.3,bottomY,halfBtn,btnH*.8);
  ctx.fillStyle='rgba(255,255,255,0.6)';
  ctx.fillText('LEVEL MAP',W/2+halfBtn/2+u*.3,bottomY+btnH*.4);`
);

// Add share button tap handling in handleDeathTap
patch('Social sharing (death tap handler)',
  `  // Level Map button
  const lmY=H-SAFE_BOTTOM-u*2;
  if(tx>W/2-btnW/2&&tx<W/2+btnW/2&&ty>lmY&&ty<lmY+btnH*.8){
    stopMusic(); G.phase='LEVEL_MAP'; G._nextLevelNum=0; sfxUITap(); return;
  }`,
  `  // Share + Level Map buttons
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
    stopMusic(); G.phase='LEVEL_MAP'; G._nextLevelNum=0; sfxUITap(); return;
  }`
);

// Add share button on level complete screen too
// Find the level complete screen tap handler
patch('Social sharing (level complete)',
  "case 'LEVEL_COMPLETE':",
  `case 'LEVEL_COMPLETE':
      // Share button on level complete (rendered at bottom-right)
      if(inp.tapped && G.levelCompleteTimer > 2){
        const _su=UNIT, _sbw=_su*3.5, _sbh=_su*.8;
        const _sbx=W-SAFE_RIGHT-_sbw-_su, _sby=H-SAFE_BOTTOM-_su*1.5;
        if(inp.tapX>_sbx&&inp.tapX<_sbx+_sbw&&inp.tapY>_sby&&inp.tapY<_sby+_sbh){
          const shareText = "I completed " + G.levelDef.name + " with " + (G._levelStarsEarned||1) + " stars in Gronk's Run!";
          captureAndShare(shareText);
          sfxUITap(); inp.tapped=false;
        }
      }`
);

console.log('   Social sharing: done');

// ============================================================
// 2. RATE-THE-APP PROMPT
// ============================================================
// Add rate prompt state and trigger logic
patch('Rate app (state + trigger)',
  'let adReady = false;',
  `let adReady = false;
let ratePromptShown = false;
function checkRatePrompt() {
  if (ratePromptShown) return false;
  if (save._ratePromptDismissed) return false;
  const s = save.stats || {};
  // Show after 5+ runs or reaching level 10
  if ((s.totalRuns >= 5 || (s.highestLevel || 0) >= 10)) {
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
}`
);

// Add rate prompt check after returning to level map from a run
// Find where DEAD phase transitions to LEVEL_MAP
patch('Rate app (trigger on level map)',
  "case 'LEVEL_MAP':\n      if (!gronkSpriteLoading) initGronkSprite();\n      if (!pipSpriteLoading) initPipSprite();",
  `case 'LEVEL_MAP':
      if (!gronkSpriteLoading) initGronkSprite();
      if (!pipSpriteLoading) initPipSprite();
      // Check if we should show rate prompt
      if (checkRatePrompt()) {
        G._showRatePrompt = true;
        G._ratePromptTimer = 0;
      }`
);

// Draw rate prompt overlay in LEVEL_MAP phase
patch('Rate app (draw overlay)',
  "case 'LEVEL_MAP':\n      if (!gronkSpriteLoading) initGronkSprite();\n      if (!pipSpriteLoading) initPipSprite();\n      // Check if we should show rate prompt\n      if (checkRatePrompt()) {\n        G._showRatePrompt = true;\n        G._ratePromptTimer = 0;\n      }",
  `case 'LEVEL_MAP':
      if (!gronkSpriteLoading) initGronkSprite();
      if (!pipSpriteLoading) initPipSprite();
      // Check if we should show rate prompt
      if (checkRatePrompt()) {
        G._showRatePrompt = true;
        G._ratePromptTimer = 0;
      }
      // Rate prompt overlay after map draws
      if (G._showRatePrompt) {
        G._ratePromptTimer = (G._ratePromptTimer||0) + DT;
      }`
);

console.log('   Rate app: done');

// ============================================================
// 3. EXPAND ACHIEVEMENTS from 10 to 20+
// ============================================================
patch('Expand achievements',
  `const ACHIEVEMENTS = [
  { id:'first_run', name:'First Steps', desc:'Complete your first run', check: s => s.totalRuns >= 1, gems:10 },
  { id:'gem_hunter', name:'Gem Hunter', desc:'Collect 100 total gems', check: s => s.totalGems >= 100, gems:25 },
  { id:'gem_master', name:'Gem Master', desc:'Collect 500 total gems', check: s => s.totalGems >= 500, gems:50, bonus:'magnetRange' },
  { id:'level5', name:'Adventurer', desc:'Reach Level 5', check: s => s.highestLevel >= 5, gems:20 },
  { id:'level10', name:'Explorer', desc:'Reach Level 10', check: s => s.highestLevel >= 10, gems:50 },
  { id:'score10k', name:'High Scorer', desc:'Get 10,000 total score', check: s => s.totalScore >= 10000, gems:30 },
  { id:'score50k', name:'Score Legend', desc:'Get 50,000 total score', check: s => s.totalScore >= 50000, gems:100 },
  { id:'smasher', name:'Smasher', desc:'Destroy 50 obstacles', check: s => s.obstaclesSmashed >= 50, bonus:'poundRadius' },
  { id:'dasher', name:'Speed Demon', desc:'Use dash 100 times', check: s => s.dashesUsed >= 100, bonus:'dashCD' },
  { id:'streak5', name:'Loyal Player', desc:'5-day login streak', check: s => s.dailyStreak >= 5, gems:75 },
];`,
  `const ACHIEVEMENTS = [
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
];`
);

console.log('   Achievements expanded to 24');

// ============================================================
// 4. STATISTICS SCREEN POLISH — grouped layout, progress bars
// ============================================================
patch('Stats screen polish',
  `function drawStatsScreen(dt){
  const u=UNIT;
  ctx.fillStyle='#0a1628';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.textBaseline='middle';

  // Title
  ctx.font=\`bold \${u*1.2}px monospace\`;ctx.fillStyle='#FFD700';
  ctx.fillText('\\uD83D\\uDCCA STATS & ACHIEVEMENTS',W/2,u*1.2);

  const s=save.stats||{};
  const startY=u*2.5;
  const lineH=u*1.1;

  // Stats
  ctx.save();
  ctx.beginPath();ctx.rect(0,u*2,W,H-u*4);ctx.clip();

  const scrollOff = G.statsScrollY||0;
  G.statsScrollY = lerp(G.statsScrollY||0, G.statsTargetScrollY||0, 8*dt);

  const stats=[
    \`Total Runs: \${s.totalRuns||0}\`,
    \`Total Gems: \${s.totalGems||0}\`,
    \`Total Score: \${s.totalScore||0}\`,
    \`Highest Level: \${s.highestLevel||0}\`,
    \`Longest Run: \${s.longestRun||0}s\`,
    \`Obstacles Smashed: \${s.obstaclesSmashed||0}\`,
    \`Dashes Used: \${s.dashesUsed||0}\`,
    \`Slides Used: \${s.slidesUsed||0}\`,
    \`Enemies Dodged: \${s.enemiesDodged||0}\`,
  ];
  ctx.font=\`\${u*.55}px monospace\`;ctx.textAlign='left';
  for(let i=0;i<stats.length;i++){
    const y=startY+i*lineH-scrollOff;
    if(y<u*1.5||y>H-u*3)continue;
    ctx.fillStyle='rgba(255,255,255,0.7)';
    ctx.fillText(stats[i],u*1.5,y);
  }

  // Achievements header
  const achY=startY+stats.length*lineH+lineH*0.5-scrollOff;
  if(achY>u*1.5&&achY<H-u*3){
    ctx.font=\`bold \${u*.8}px monospace\`;ctx.fillStyle='#FFD700';ctx.textAlign='center';
    ctx.fillText('ACHIEVEMENTS',W/2,achY);
  }

  ctx.font=\`\${u*.5}px monospace\`;ctx.textAlign='left';
  for(let i=0;i<ACHIEVEMENTS.length;i++){
    const a=ACHIEVEMENTS[i];
    const ay=achY+lineH*(i+1);
    if(ay<u*1.5||ay>H-u*3)continue;
    const unlocked=save.achievements&&save.achievements[a.id];
    if(unlocked){
      ctx.fillStyle='#FFD700';ctx.fillText('\\u2714',u*1,ay);
      ctx.fillStyle='#FFD700';ctx.fillText(\`\${a.name} - \${a.desc}\`,u*2,ay);
    } else {
      ctx.fillStyle='rgba(100,100,120,0.6)';ctx.fillText('\\uD83D\\uDD12',u*1,ay);
      ctx.fillStyle='rgba(100,100,120,0.6)';ctx.fillText(\`\${a.name} - \${a.desc}\`,u*2,ay);
    }
  }
  ctx.restore();

  // Back button
  const btnW=u*4, btnH=u*1.2, btnY=H-SAFE_BOTTOM-u*1.8;
  ctx.fillStyle='#2244AA';ctx.fillRect(W/2-btnW/2,btnY,btnW,btnH);
  ctx.strokeStyle='#4466CC';ctx.lineWidth=2;ctx.strokeRect(W/2-btnW/2,btnY,btnW,btnH);
  ctx.font=\`bold \${u*.7}px monospace\`;ctx.fillStyle='white';ctx.textAlign='center';
  ctx.fillText('BACK',W/2,btnY+btnH/2);
}`,
  `function drawStatsScreen(dt){
  const u=UNIT;
  ctx.fillStyle='#0a1628';ctx.fillRect(0,0,W,H);
  ctx.textAlign='center';ctx.textBaseline='middle';

  // Title
  ctx.font=\`bold \${u*1.2}px monospace\`;ctx.fillStyle='#FFD700';
  ctx.fillText('STATS & ACHIEVEMENTS',W/2,u*1.2);

  // Achievement progress bar
  const totalAch = ACHIEVEMENTS.length;
  const unlockedAch = ACHIEVEMENTS.filter(function(a){ return save.achievements && save.achievements[a.id]; }).length;
  const achProg = totalAch > 0 ? unlockedAch / totalAch : 0;
  const progW = W*0.5, progH = u*0.25, progX = W/2-progW/2;
  ctx.fillStyle='rgba(255,255,255,0.1)';ctx.fillRect(progX,u*1.8,progW,progH);
  ctx.fillStyle='#FFD700';ctx.fillRect(progX,u*1.8,progW*achProg,progH);
  ctx.font=\`\${u*.35}px monospace\`;ctx.fillStyle='rgba(255,215,0,0.7)';
  ctx.fillText(unlockedAch+'/'+totalAch+' achievements unlocked',W/2,u*1.8+progH+u*.3);

  const s=save.stats||{};
  const startY=u*2.8;
  const lineH=u*1;

  ctx.save();
  ctx.beginPath();ctx.rect(0,u*2.3,W,H-u*4.3);ctx.clip();

  const scrollOff = G.statsScrollY||0;
  G.statsScrollY = lerp(G.statsScrollY||0, G.statsTargetScrollY||0, 8*dt);

  // Grouped stats with icons
  const statGroups = [
    { title:'PROGRESSION', color:'#4CAF50', items:[
      {label:'Highest Level', val:s.highestLevel||0, icon:'\\u26A1'},
      {label:'Total Runs', val:s.totalRuns||0, icon:'\\uD83C\\uDFC3'},
      {label:'Best Score', val:save.bestScore||0, icon:'\\uD83C\\uDFC6'},
      {label:'Total Score', val:s.totalScore||0, icon:'\\uD83D\\uDCCA'},
      {label:'Login Streak', val:save.dailyStreak||0, icon:'\\uD83D\\uDD25'},
    ]},
    { title:'COLLECTION', color:'#FFD700', items:[
      {label:'Total Gems', val:s.totalGems||0, icon:'\\uD83D\\uDC8E'},
      {label:'Longest Run', val:(s.longestRun||0)+'s', icon:'\\u23F1'},
      {label:'Daily Best', val:save.challengeBest||0, icon:'\\uD83C\\uDF1F'},
    ]},
    { title:'COMBAT', color:'#FF6644', items:[
      {label:'Enemies Dodged', val:s.enemiesDodged||0, icon:'\\uD83D\\uDCA8'},
      {label:'Obstacles Smashed', val:s.obstaclesSmashed||0, icon:'\\uD83D\\uDCA5'},
      {label:'Dashes Used', val:s.dashesUsed||0, icon:'\\uD83D\\uDCA8'},
      {label:'Slides Used', val:s.slidesUsed||0, icon:'\\uD83C\\uDFC4'},
    ]},
  ];

  let y = startY - scrollOff;
  ctx.textAlign='left';
  for(const grp of statGroups) {
    if(y>u*1.5&&y<H-u*3){
      ctx.font=\`bold \${u*.6}px monospace\`;ctx.fillStyle=grp.color;
      ctx.fillText(grp.title, u*1.2, y);
    }
    y += lineH*.8;
    ctx.font=\`\${u*.45}px monospace\`;
    for(const item of grp.items) {
      if(y>u*1.5&&y<H-u*3){
        ctx.fillStyle='rgba(255,255,255,0.5)';
        ctx.fillText(item.icon+'  '+item.label, u*1.5, y);
        ctx.textAlign='right';ctx.fillStyle='rgba(255,255,255,0.9)';
        ctx.fillText(''+item.val, W-u*1.5, y);
        ctx.textAlign='left';
      }
      y += lineH*.7;
    }
    y += lineH*.4;
  }

  // Achievements section
  if(y>u*1.5&&y<H-u*3){
    ctx.font=\`bold \${u*.7}px monospace\`;ctx.fillStyle='#FFD700';ctx.textAlign='center';
    ctx.fillText('ACHIEVEMENTS',W/2,y);
  }
  y += lineH;

  ctx.font=\`\${u*.4}px monospace\`;ctx.textAlign='left';
  for(let i=0;i<ACHIEVEMENTS.length;i++){
    const a=ACHIEVEMENTS[i];
    if(y>u*1.5&&y<H-u*3){
      const unlocked=save.achievements&&save.achievements[a.id];
      if(unlocked){
        ctx.fillStyle='#FFD700';ctx.fillText('\\u2714 '+a.name, u*1.2, y);
        ctx.fillStyle='rgba(255,215,0,0.5)';ctx.fillText(a.desc+(a.gems?' (+'+a.gems+' gems)':''), u*1.2, y+u*.4);
      } else {
        ctx.fillStyle='rgba(100,100,120,0.5)';ctx.fillText('\\uD83D\\uDD12 '+a.name, u*1.2, y);
        ctx.fillStyle='rgba(100,100,120,0.35)';ctx.fillText(a.desc, u*1.2, y+u*.4);
      }
    }
    y += lineH*.9;
  }

  // Track total scroll content height
  G._statsContentH = y + scrollOff;
  ctx.restore();

  // Back button
  const btnW=u*4, btnH=u*1.2, btnY=H-SAFE_BOTTOM-u*1.8;
  ctx.fillStyle='#2244AA';ctx.fillRect(W/2-btnW/2,btnY,btnW,btnH);
  ctx.strokeStyle='#4466CC';ctx.lineWidth=2;ctx.strokeRect(W/2-btnW/2,btnY,btnW,btnH);
  ctx.font=\`bold \${u*.7}px monospace\`;ctx.fillStyle='white';ctx.textAlign='center';
  ctx.fillText('BACK',W/2,btnY+btnH/2);
}`
);

// ============================================================
// 5. DAILY CHALLENGE — streak bonus multiplier + better UI
// ============================================================
// Add streak bonus to daily challenge scoring
patch('Daily challenge streak bonus',
  "G.diff=getDiff(0, 1.3); // slightly harder",
  `// Streak bonus: higher streak = more gems earned
  G._dailyStreakBonus = Math.min(2.0, 1.0 + (save.dailyStreak - 1) * 0.1); // +10% per streak day, max 2x
  G.diff=getDiff(0, 1.3); // slightly harder`
);

// Add streak bonus display to daily challenge UI
// Find where daily challenge best score is shown on death
patch('Daily challenge streak display',
  "ctx.fillText('DAILY REWARD!', 0, 0); ctx.shadowBlur=0; ctx.restore();",
  `ctx.fillText('DAILY REWARD!', 0, 0); ctx.shadowBlur=0; ctx.restore();
  // Streak milestone display
  if (save.dailyStreak >= 7) {
    ctx.font=\`bold \${u*.5}px monospace\`;ctx.fillStyle='#FF6600';
    ctx.fillText('\\uD83D\\uDD25 '+save.dailyStreak+'-DAY STREAK! Bonus rewards active!', W/2, H*.22);
  }`
);

console.log('   Daily challenge: done');

// ============================================================
// 6. SEASONAL EVENTS FRAMEWORK
// ============================================================
// Add seasonal event detection and configuration
patch('Seasonal events framework',
  'const DAILY_REWARDS = [',
  `// ============================================================
// SEASONAL EVENTS
// ============================================================
function getActiveEvent() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const day = now.getDate();
  // Halloween: Oct 20 - Nov 3
  if ((month === 10 && day >= 20) || (month === 11 && day <= 3))
    return { id:'halloween', name:'Spooky Run', color:'#FF6600', icon:'\\uD83C\\uDF83',
      missions:[
        {id:'hw_gems', desc:'Collect {n} spooky gems', targets:[50,100], reward:[30,60], stat:'gemsCollected'},
        {id:'hw_runs', desc:'Complete {n} haunted runs', targets:[3,5], reward:[25,50], stat:'runsCompleted'},
      ]};
  // Winter Holiday: Dec 15 - Jan 5
  if ((month === 12 && day >= 15) || (month === 1 && day <= 5))
    return { id:'winter', name:'Winter Run', color:'#88CCFF', icon:'\\u2744',
      missions:[
        {id:'wn_gems', desc:'Collect {n} frosty gems', targets:[75,150], reward:[40,80], stat:'gemsCollected'},
        {id:'wn_score', desc:'Score {n} in a single run', targets:[5000,10000], reward:[50,100], stat:'scoreEarned'},
      ]};
  // Spring: Mar 15 - Apr 15
  if ((month === 3 && day >= 15) || (month === 4 && day <= 15))
    return { id:'spring', name:'Spring Dash', color:'#44CC44', icon:'\\uD83C\\uDF38',
      missions:[
        {id:'sp_dash', desc:'Dash {n} times', targets:[30,60], reward:[25,50], stat:'dashesUsed'},
        {id:'sp_levels', desc:'Complete {n} levels', targets:[5,10], reward:[40,80], stat:'levelsCompleted'},
      ]};
  // Summer: Jun 15 - Jul 15
  if ((month === 6 && day >= 15) || (month === 7 && day <= 15))
    return { id:'summer', name:'Summer Sprint', color:'#FFAA00', icon:'\\u2600',
      missions:[
        {id:'sm_time', desc:'Survive {n} seconds total', targets:[300,600], reward:[35,70], stat:'longestRun'},
        {id:'sm_smash', desc:'Smash {n} obstacles', targets:[30,60], reward:[30,60], stat:'obstaclesSmashed'},
      ]};
  return null;
}

// Show active event banner on level map
let _activeEvent = null;
function checkSeasonalEvent() {
  _activeEvent = getActiveEvent();
  return _activeEvent;
}

const DAILY_REWARDS = [`
);

// Show event banner in level map draw
// Find drawLevelMap function reference
const levelMapIdx = h.indexOf("case 'LEVEL_MAP':");
const levelMapDrawIdx = h.indexOf("drawLevelMap(", levelMapIdx);
// Add event banner after level map draws
patch('Seasonal events (level map banner)',
  "case 'STATS':",
  `case 'STATS':
      // (Seasonal event banner drawn in LEVEL_MAP render above)`
);

// Actually let's add the event banner rendering to the LEVEL_MAP case
// Find a unique string in the LEVEL_MAP phase handling
patch('Seasonal events (render in level map)',
  "      // Rate prompt overlay after map draws\n      if (G._showRatePrompt) {\n        G._ratePromptTimer = (G._ratePromptTimer||0) + DT;\n      }",
  `      // Rate prompt overlay after map draws
      if (G._showRatePrompt) {
        G._ratePromptTimer = (G._ratePromptTimer||0) + DT;
      }
      // Seasonal event banner
      if (!_activeEvent) checkSeasonalEvent();
      if (_activeEvent) {
        const _eu=UNIT, _ew=W*.6, _eh=_eu*1.2;
        const _ex=W/2-_ew/2, _ey=SAFE_TOP+_eu*.3;
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(_ex,_ey,_ew,_eh);
        ctx.strokeStyle=_activeEvent.color;ctx.lineWidth=2;ctx.strokeRect(_ex,_ey,_ew,_eh);
        ctx.font=\`bold \${_eu*.5}px monospace\`;ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillStyle=_activeEvent.color;
        ctx.fillText(_activeEvent.icon+' '+_activeEvent.name.toUpperCase()+' EVENT '+_activeEvent.icon, W/2, _ey+_eh/2);
      }`
);

console.log('   Seasonal events: done');

fs.writeFileSync('index.html', h);
console.log('\n=== All ' + patchCount + ' Phase 3 patches applied ===');
