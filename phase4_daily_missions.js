#!/usr/bin/env node
// Phase 4: Daily Login Calendar, Notification Dots, Improved Missions UI
const fs = require('fs');
const N = '\r\n';

let html = fs.readFileSync('index.html', 'utf8');
let applied = 0, failed = 0;

function patch(name, oldStr, newStr) {
  if (html.includes(oldStr)) {
    html = html.replace(oldStr, newStr);
    applied++;
    console.log('  \u2713 ' + name);
  } else {
    failed++;
    console.log('FAILED: ' + name);
    console.log('  Looking for: ' + oldStr.substring(0, 80).replace(/\n/g,'\\n') + '...');
  }
}

// ================================================================
// 1. DAILY LOGIN CALENDAR — 7-day grid with escalating rewards
// ================================================================
console.log('\n=== 1. Daily Login Calendar ===');

// 1a. Replace DAILY_REWARDS with a 7-day calendar system
patch('Replace daily rewards with 7-day calendar',
  `const DAILY_REWARDS = [${N}  { type:'GEMS_5',   label:'+5 Gems',       icon:'\uD83D\uDC8E', color:'#44AAFF' },${N}  { type:'GEMS_10',  label:'+10 Gems',      icon:'\uD83D\uDC8E', color:'#4488FF' },${N}  { type:'SHIELD',   label:'Free Shield',   icon:'\uD83D\uDEE1\uFE0F', color:'#88CCFF' },${N}  { type:'EXTRA_LIFE',label:'Extra Life',   icon:'\u2764\uFE0F', color:'#FF6688' },${N}  { type:'SPEED',    label:'Speed Boost',   icon:'\u26A1', color:'#FFAA22' },${N}  { type:'MAGNET',   label:'Gem Magnet',    icon:'\uD83E\uDDF2', color:'#CC22AA' },${N}  { type:'TIME_10',  label:'+10s Timer',    icon:'\u23F1\uFE0F', color:'#2288CC' },${N}];`,

  `// 7-Day Login Calendar with escalating rewards${N}` +
  `const DAILY_CALENDAR = [${N}` +
  `  { day:1, type:'GEMS_5',    label:'+5 Gems',       icon:'\uD83D\uDC8E', color:'#44AAFF' },${N}` +
  `  { day:2, type:'SHIELD',    label:'Free Shield',   icon:'\uD83D\uDEE1\uFE0F', color:'#88CCFF' },${N}` +
  `  { day:3, type:'GEMS_10',   label:'+10 Gems',      icon:'\uD83D\uDC8E', color:'#4488FF' },${N}` +
  `  { day:4, type:'SPEED',     label:'Speed Boost',   icon:'\u26A1', color:'#FFAA22' },${N}` +
  `  { day:5, type:'GEMS_15',   label:'+15 Gems',      icon:'\uD83D\uDC8E', color:'#FFD700' },${N}` +
  `  { day:6, type:'MAGNET',    label:'Gem Magnet',    icon:'\uD83E\uDDF2', color:'#CC22AA' },${N}` +
  `  { day:7, type:'SKIN',      label:'Exclusive Skin', icon:'\u2B50', color:'#FF4488' },${N}` +
  `];`
);

// 1b. Add the exclusive login skin to SKINS
patch('Add exclusive login skin to gronk skins',
  `    { id:'gronk_neon', name:'Neon', col:'#00FF88', dk:'#009955', cost:200, trail:'neon' },${N}  ],`,
  `    { id:'gronk_neon', name:'Neon', col:'#00FF88', dk:'#009955', cost:200, trail:'neon' },${N}` +
  `    { id:'gronk_streak', name:'Streak', col:'#FF4488', dk:'#CC1155', cost:0, trail:'flame', exclusive:true },${N}  ],`
);

// 1c. Add login calendar fields to save migration
patch('Add calendar save migration',
  `    // Skins migration${N}    if (!Array.isArray(save.ownedSkins)) save.ownedSkins = [];`,
  `    // Daily calendar migration${N}` +
  `    if (!Array.isArray(save.calendarClaimed)) save.calendarClaimed = [];${N}` +
  `    save.calendarWeekStart = save.calendarWeekStart || '';${N}` +
  `    // Skins migration${N}    if (!Array.isArray(save.ownedSkins)) save.ownedSkins = [];`
);

// 1d. Replace checkDailyReward() with calendar-aware version
patch('Replace checkDailyReward with calendar version',
  `function checkDailyReward() {${N}  const today = localDateStr(new Date());${N}  if (save.lastLoginDate === today) return false;${N}  // Check streak${N}  const yd = new Date(); yd.setDate(yd.getDate()-1);${N}  const yesterday = localDateStr(yd);${N}  if (save.lastLoginDate === yesterday) save.dailyStreak++;${N}  else save.dailyStreak = 1;${N}  save.lastLoginDate = today;${N}  persistSave();${N}  // Pick reward \u2014 higher streak = better rewards more likely${N}  const pool = [...DAILY_REWARDS];${N}  if (save.dailyStreak >= 3) pool.push(${N}    { type:'GEMS_15', label:'+15 Gems', icon:'\uD83D\uDC8E', color:'#FFD700' },${N}    { type:'STAR', label:'Star Power!', icon:'\u2B50', color:'#FFDD00' }${N}  );${N}  G.dailyRewardType = pool[Math.floor(Math.random()*pool.length)];${N}  G.dailyRewardTimer = 0;${N}  G.dailyRewardClaimed = false;${N}  return true;${N}}`,

  `function getCalendarWeekStart() {${N}` +
  `  // Returns the Monday of the current week as YYYY-MM-DD${N}` +
  `  const d = new Date(); const day = d.getDay() || 7;${N}` +
  `  d.setDate(d.getDate() - day + 1); return localDateStr(d);${N}` +
  `}${N}` +
  `function checkDailyReward() {${N}` +
  `  const today = localDateStr(new Date());${N}` +
  `  if (save.lastLoginDate === today) return false;${N}` +
  `  // Check streak${N}` +
  `  const yd = new Date(); yd.setDate(yd.getDate()-1);${N}` +
  `  const yesterday = localDateStr(yd);${N}` +
  `  if (save.lastLoginDate === yesterday) save.dailyStreak++;${N}` +
  `  else save.dailyStreak = 1;${N}` +
  `  // Reset calendar if new week${N}` +
  `  const weekStart = getCalendarWeekStart();${N}` +
  `  if (save.calendarWeekStart !== weekStart) {${N}` +
  `    save.calendarWeekStart = weekStart;${N}` +
  `    save.calendarClaimed = [];${N}` +
  `  }${N}` +
  `  save.lastLoginDate = today;${N}` +
  `  persistSave();${N}` +
  `  // Determine current calendar day (1-7)${N}` +
  `  const calDay = Math.min(save.dailyStreak, 7);${N}` +
  `  const reward = DAILY_CALENDAR[calDay - 1];${N}` +
  `  G.dailyRewardType = reward;${N}` +
  `  G.dailyCalendarDay = calDay;${N}` +
  `  G.dailyRewardTimer = 0;${N}` +
  `  G.dailyRewardClaimed = false;${N}` +
  `  return true;${N}` +
  `}`
);

// 1e. Replace applyDailyReward to handle SKIN type
patch('Update applyDailyReward for skin type',
  `function applyDailyReward(reward) {${N}  switch(reward.type) {${N}    case 'GEMS_5':  save.totalGems+=5; break;${N}    case 'GEMS_10': save.totalGems+=10; break;${N}    case 'GEMS_15': save.totalGems+=15; break;${N}    case 'SHIELD': case 'EXTRA_LIFE': case 'SPEED': case 'MAGNET': case 'TIME_10': case 'STAR':${N}      save.dailyPowerup = reward.type; break;${N}  }${N}  persistSave();${N}}`,

  `function applyDailyReward(reward) {${N}` +
  `  switch(reward.type) {${N}` +
  `    case 'GEMS_5':  save.totalGems+=5; break;${N}` +
  `    case 'GEMS_10': save.totalGems+=10; break;${N}` +
  `    case 'GEMS_15': save.totalGems+=15; break;${N}` +
  `    case 'SKIN':${N}` +
  `      if (!save.ownedSkins) save.ownedSkins = [];${N}` +
  `      if (!save.ownedSkins.includes('gronk_streak')) {${N}` +
  `        save.ownedSkins.push('gronk_streak');${N}` +
  `        save.activeSkins['gronk'] = 'gronk_streak';${N}` +
  `      }${N}` +
  `      break;${N}` +
  `    case 'SHIELD': case 'EXTRA_LIFE': case 'SPEED': case 'MAGNET': case 'TIME_10': case 'STAR':${N}` +
  `      save.dailyPowerup = reward.type; break;${N}` +
  `  }${N}` +
  `  // Mark day as claimed in calendar${N}` +
  `  if (!save.calendarClaimed) save.calendarClaimed = [];${N}` +
  `  const dayIdx = (G.dailyCalendarDay || 1) - 1;${N}` +
  `  if (!save.calendarClaimed.includes(dayIdx)) save.calendarClaimed.push(dayIdx);${N}` +
  `  persistSave();${N}` +
  `}`
);

// 1f. Replace drawDailyReward with calendar grid UI
patch('Replace drawDailyReward with calendar grid',
  `function drawDailyReward(dt) {${N}  G.dailyRewardTimer += dt;${N}  const u = UNIT;${N}  // Animated background${N}  ctx.fillStyle = '#0a1628'; ctx.fillRect(0,0,W,H);${N}  // Sparkle particles${N}  const t = G.dailyRewardTimer;${N}  for(let i=0;i<20;i++){${N}    const px = W*(0.1+((i*137.5+t*50)%W)/W*0.8);${N}    const py = H*(0.1+((i*73.3+t*30)%H)/H*0.8);${N}    const bri = 0.3+Math.sin(t*3+i)*0.3;${N}    ctx.fillStyle = \`rgba(255,215,0,\${bri})\`;${N}    ctx.beginPath(); ctx.arc(px,py,2+Math.sin(t*2+i*0.5)*1.5,0,PI2); ctx.fill();${N}  }${N}${N}  ctx.textAlign='center'; ctx.textBaseline='middle';${N}${N}  // Title${N}  const titleScale = Math.min(1, t*2);${N}  ctx.save(); ctx.translate(W/2, H*.15); ctx.scale(titleScale, titleScale);${N}  ctx.shadowColor='#FFD700'; ctx.shadowBlur=20;${N}  ctx.font=\`bold \${u*1.8}px monospace\`; ctx.fillStyle='#FFD700';${N}  ctx.fillText('DAILY REWARD!', 0, 0); ctx.shadowBlur=0; ctx.restore();${N}  // Streak milestone display${N}  if (save.dailyStreak >= 7) {${N}    ctx.font=\`bold \${u*.5}px monospace\`;ctx.fillStyle='#FF6600';${N}    ctx.fillText('\\uD83D\\uDD25 '+save.dailyStreak+'-DAY STREAK! Bonus rewards active!', W/2, H*.22);${N}  }${N}${N}  // Streak display${N}  ctx.font=\`\${u*.7}px monospace\`; ctx.fillStyle='#FFAA44';${N}  ctx.fillText(\`\uD83D\uDD25 Day \${save.dailyStreak} streak!\`, W/2, H*.26);${N}${N}  const reward = G.dailyRewardType;${N}  if (!reward) return;${N}${N}  // Reward box with reveal animation${N}  const revealT = clamp((t-0.5)*2, 0, 1);${N}  if (revealT > 0) {${N}    const boxW = u*10, boxH = u*6;${N}    const bx = W/2-boxW/2, by = H*.35;${N}    // Glow${N}    ctx.shadowColor = reward.color; ctx.shadowBlur = 30*revealT;${N}    ctx.fillStyle = 'rgba(20,30,50,0.9)';${N}    ctx.fillRect(bx, by, boxW, boxH);${N}    ctx.strokeStyle = reward.color; ctx.lineWidth=3;${N}    ctx.strokeRect(bx, by, boxW, boxH);${N}    ctx.shadowBlur=0;${N}${N}    // Icon (bouncing)${N}    const iconBounce = Math.sin(t*3)*u*.2;${N}    ctx.font = \`\${u*3}px sans-serif\`;${N}    ctx.fillText(reward.icon, W/2, by+boxH*.35+iconBounce);${N}${N}    // Label${N}    ctx.font = \`bold \${u*1.1}px monospace\`; ctx.fillStyle = reward.color;${N}    ctx.fillText(reward.label, W/2, by+boxH*.75);${N}  }${N}${N}  // Claim button${N}  if (t > 1.5 && !G.dailyRewardClaimed) {${N}    const pulse = 1+Math.sin(t*5)*.05;${N}    const btnW=u*6, btnH=u*1.4;${N}    ctx.save(); ctx.translate(W/2, H*.82); ctx.scale(pulse,pulse);${N}    ctx.fillStyle='#22AA44'; ctx.fillRect(-btnW/2,-btnH/2,btnW,btnH);${N}    ctx.strokeStyle='#44DD66'; ctx.lineWidth=2; ctx.strokeRect(-btnW/2,-btnH/2,btnW,btnH);${N}    ctx.font=\`bold \${u*.9}px monospace\`; ctx.fillStyle='white';${N}    ctx.fillText('CLAIM!', 0, 0); ctx.restore();${N}  }${N}${N}  // Already claimed \u2014 show continue${N}  if (G.dailyRewardClaimed && t > 0.5) {${N}    ctx.font=\`bold \${u*.8}px monospace\`; ctx.fillStyle='rgba(255,255,255,0.7)';${N}    ctx.fillText('Reward applied! Tap to continue', W/2, H*.9);${N}  }${N}}`,

  // New calendar-based daily reward screen
  `function drawDailyReward(dt) {${N}` +
  `  G.dailyRewardTimer += dt;${N}` +
  `  const u = UNIT, t = G.dailyRewardTimer;${N}` +
  `  // Dark background${N}` +
  `  ctx.fillStyle = '#0a1628'; ctx.fillRect(0,0,W,H);${N}` +
  `  // Sparkle particles${N}` +
  `  for(let i=0;i<25;i++){${N}` +
  `    const px = W*(0.05+((i*137.5+t*40)%W)/W*0.9);${N}` +
  `    const py = H*(0.05+((i*73.3+t*25)%H)/H*0.9);${N}` +
  `    const bri = 0.2+Math.sin(t*3+i)*0.25;${N}` +
  `    ctx.fillStyle = 'rgba(255,215,0,'+bri+')';${N}` +
  `    ctx.beginPath(); ctx.arc(px,py,2+Math.sin(t*2+i*.5)*1.5,0,PI2); ctx.fill();${N}` +
  `  }${N}` +
  `  ctx.textAlign='center'; ctx.textBaseline='middle';${N}` +
  `${N}` +
  `  // Title with scale-in${N}` +
  `  const titleScale = Math.min(1, t*2);${N}` +
  `  ctx.save(); ctx.translate(W/2, H*.07); ctx.scale(titleScale, titleScale);${N}` +
  `  ctx.shadowColor='#FFD700'; ctx.shadowBlur=20;${N}` +
  `  ctx.font='bold '+Math.round(u*1.5)+'px monospace'; ctx.fillStyle='#FFD700';${N}` +
  `  ctx.fillText('DAILY LOGIN', 0, 0); ctx.shadowBlur=0; ctx.restore();${N}` +
  `${N}` +
  `  // Streak display${N}` +
  `  ctx.font=Math.round(u*.6)+'px monospace'; ctx.fillStyle='#FFAA44';${N}` +
  `  ctx.fillText('Day '+save.dailyStreak+' streak!', W/2, H*.13);${N}` +
  `${N}` +
  `  // === 7-Day Calendar Grid ===  ${N}` +
  `  const calDay = G.dailyCalendarDay || 1;${N}` +
  `  const claimed = save.calendarClaimed || [];${N}` +
  `  const gridW = Math.min(W*0.92, u*14);${N}` +
  `  const cellSize = gridW / 4;${N}` +
  `  const gridX = W/2 - gridW/2;${N}` +
  `  var gy = H*0.18;${N}` +
  `  // Draw 7 cells (4 on top row, 3 on bottom, day 7 big)${N}` +
  `  for (var di=0; di<7; di++) {${N}` +
  `    const cal = DAILY_CALENDAR[di];${N}` +
  `    const isClaimed = claimed.includes(di);${N}` +
  `    const isToday = (di === calDay - 1) && !G.dailyRewardClaimed;${N}` +
  `    const isFuture = di >= calDay;${N}` +
  `    const isDay7 = (di === 6);${N}` +
  `    var cx, cy, cw, ch;${N}` +
  `    if (di < 4) {${N}` +
  `      cx = gridX + di * cellSize; cy = gy; cw = cellSize - u*0.15; ch = cellSize * 1.1;${N}` +
  `    } else if (di < 6) {${N}` +
  `      cx = gridX + (di-4) * cellSize; cy = gy + cellSize * 1.2; cw = cellSize - u*0.15; ch = cellSize * 1.1;${N}` +
  `    } else {${N}` +
  `      // Day 7 — wider special cell${N}` +
  `      cx = gridX + 2 * cellSize; cy = gy + cellSize * 1.2; cw = cellSize * 2 - u*0.15; ch = cellSize * 1.1;${N}` +
  `    }${N}` +
  `    // Cell background${N}` +
  `    var bgCol, borderCol;${N}` +
  `    if (isClaimed) { bgCol='rgba(40,100,40,0.6)'; borderCol='rgba(100,220,100,0.5)'; }${N}` +
  `    else if (isToday) {${N}` +
  `      const glow = 0.5+Math.sin(t*4)*0.2;${N}` +
  `      bgCol='rgba(255,215,0,'+glow*0.3+')'; borderCol='rgba(255,215,0,'+glow+')';${N}` +
  `    }${N}` +
  `    else if (isFuture) { bgCol='rgba(30,40,60,0.5)'; borderCol='rgba(80,90,110,0.3)'; }${N}` +
  `    else { bgCol='rgba(20,30,50,0.6)'; borderCol='rgba(100,100,120,0.3)'; }${N}` +
  `    if (isDay7 && !isClaimed) { borderCol = 'rgba(255,68,136,'+(0.5+Math.sin(t*3)*0.3)+')'; }${N}` +
  `    fillRR(cx, cy, cw, ch, u*0.2, bgCol, borderCol, isToday?2:1);${N}` +
  `${N}` +
  `    // Day number${N}` +
  `    ctx.font='bold '+Math.round(u*0.35)+'px monospace';${N}` +
  `    ctx.fillStyle = isClaimed?'rgba(100,220,100,0.8)':isToday?'#FFD700':isFuture?'rgba(120,130,150,0.5)':'rgba(200,200,220,0.6)';${N}` +
  `    ctx.fillText('Day '+(di+1), cx+cw/2, cy+u*0.3);${N}` +
  `${N}` +
  `    // Icon${N}` +
  `    var iconSize = isDay7 ? u*1.2 : u*0.9;${N}` +
  `    if (isToday && !isClaimed) iconSize *= 1+Math.sin(t*3)*0.08;${N}` +
  `    ctx.font = Math.round(iconSize)+'px sans-serif';${N}` +
  `    ctx.fillStyle = isFuture && !isClaimed ? 'rgba(255,255,255,0.3)' : '#FFF';${N}` +
  `    if (isClaimed) {${N}` +
  `      ctx.font = 'bold '+Math.round(u*0.9)+'px monospace'; ctx.fillStyle='#4caf50';${N}` +
  `      ctx.fillText('\\u2713', cx+cw/2, cy+ch*0.5);${N}` +
  `    } else {${N}` +
  `      ctx.fillText(cal.icon, cx+cw/2, cy+ch*0.5);${N}` +
  `    }${N}` +
  `${N}` +
  `    // Reward label${N}` +
  `    ctx.font = Math.round(u*0.28)+'px monospace';${N}` +
  `    ctx.fillStyle = isClaimed?'rgba(100,200,100,0.5)':isToday?cal.color:isFuture?'rgba(150,150,170,0.4)':'rgba(200,200,220,0.5)';${N}` +
  `    ctx.fillText(cal.label, cx+cw/2, cy+ch-u*0.2);${N}` +
  `  }${N}` +
  `${N}` +
  `  // Today's reward highlight section${N}` +
  `  const reward = G.dailyRewardType;${N}` +
  `  if (!reward) return;${N}` +
  `  const boxY = gy + cellSize*2.5;${N}` +
  `  const revealT = clamp((t-0.3)*2, 0, 1);${N}` +
  `  if (revealT > 0) {${N}` +
  `    const boxW = u*10, boxH = u*3;${N}` +
  `    const bx = W/2-boxW/2;${N}` +
  `    ctx.shadowColor = reward.color; ctx.shadowBlur = 20*revealT;${N}` +
  `    fillRR(bx, boxY, boxW, boxH, u*0.3, 'rgba(20,30,50,0.85)', reward.color, 2);${N}` +
  `    ctx.shadowBlur=0;${N}` +
  `    // Icon bouncing${N}` +
  `    const iconB = Math.sin(t*3)*u*.15;${N}` +
  `    ctx.font = Math.round(u*2)+'px sans-serif';${N}` +
  `    ctx.fillText(reward.icon, W/2 - u*2.5, boxY+boxH/2+iconB);${N}` +
  `    // Label${N}` +
  `    ctx.font = 'bold '+Math.round(u*.8)+'px monospace'; ctx.fillStyle = reward.color;${N}` +
  `    ctx.fillText(reward.label, W/2 + u*0.8, boxY+boxH*0.4);${N}` +
  `    ctx.font = Math.round(u*.4)+'px monospace'; ctx.fillStyle='rgba(255,255,255,0.6)';${N}` +
  `    ctx.fillText("Today's reward", W/2 + u*0.8, boxY+boxH*0.7);${N}` +
  `  }${N}` +
  `${N}` +
  `  // Claim button${N}` +
  `  if (t > 0.8 && !G.dailyRewardClaimed) {${N}` +
  `    const pulse = 1+Math.sin(t*5)*.05;${N}` +
  `    const btnW=u*7, btnH=u*1.3;${N}` +
  `    const btnY = boxY + u*3.5;${N}` +
  `    ctx.save(); ctx.translate(W/2, btnY+btnH/2); ctx.scale(pulse,pulse);${N}` +
  `    fillRR(-btnW/2,-btnH/2,btnW,btnH,u*0.3,'#22AA44','#44DD66',2);${N}` +
  `    ctx.font='bold '+Math.round(u*.9)+'px monospace'; ctx.fillStyle='white';${N}` +
  `    ctx.fillText('CLAIM DAY '+(G.dailyCalendarDay||1)+'!', 0, 0); ctx.restore();${N}` +
  `    G._claimBtnY = btnY;${N}` +
  `  }${N}` +
  `${N}` +
  `  // Already claimed — continue${N}` +
  `  if (G.dailyRewardClaimed && t > 0.5) {${N}` +
  `    ctx.font='bold '+Math.round(u*.7)+'px monospace'; ctx.fillStyle='rgba(255,255,255,0.7)';${N}` +
  `    ctx.fillText('Reward claimed! Tap to continue', W/2, H*.92);${N}` +
  `  }${N}` +
  `}`
);

// 1g. Update handleDailyRewardTap for new button position
patch('Update handleDailyRewardTap for calendar layout',
  `function handleDailyRewardTap() {${N}  const u=UNIT, tx=inp.tapX, ty=inp.tapY;${N}  if (!G.dailyRewardClaimed && G.dailyRewardTimer > 1.5) {${N}    const btnW=u*6, btnH=u*1.4;${N}    if (tx>W/2-btnW/2 && tx<W/2+btnW/2 && ty>H*.82-btnH/2 && ty<H*.82+btnH/2) {${N}      G.dailyRewardClaimed = true;${N}      applyDailyReward(G.dailyRewardType);${N}      G.dailyRewardTimer = 0; // reset for continue message${N}      return;${N}    }${N}  }${N}  if (G.dailyRewardClaimed && G.dailyRewardTimer > 0.5) {${N}    G.phase = 'LEVEL_MAP';${N}  }${N}}`,

  `function handleDailyRewardTap() {${N}` +
  `  const u=UNIT, tx=inp.tapX, ty=inp.tapY;${N}` +
  `  if (!G.dailyRewardClaimed && G.dailyRewardTimer > 0.8) {${N}` +
  `    const btnW=u*7, btnH=u*1.3;${N}` +
  `    const btnY = G._claimBtnY || H*.78;${N}` +
  `    if (tx>W/2-btnW/2 && tx<W/2+btnW/2 && ty>btnY && ty<btnY+btnH) {${N}` +
  `      G.dailyRewardClaimed = true;${N}` +
  `      applyDailyReward(G.dailyRewardType);${N}` +
  `      G.dailyRewardTimer = 0;${N}` +
  `      sfxGem();${N}` +
  `      return;${N}` +
  `    }${N}` +
  `  }${N}` +
  `  if (G.dailyRewardClaimed && G.dailyRewardTimer > 0.5) {${N}` +
  `    transitionTo('LEVEL_MAP');${N}` +
  `  }${N}` +
  `}`
);

// ================================================================
// 2. NOTIFICATION DOTS — Red badges on menu items
// ================================================================
console.log('\n=== 2. Notification Dots ===');

// 2a. Add notification dot drawing utility
patch('Add drawNotifDot utility function',
  `function drawButton(x,y,w,h,label,opts){`,

  `function drawNotifDot(x, y, count, u) {${N}` +
  `  if (count <= 0) return;${N}` +
  `  const r = u * 0.35;${N}` +
  `  ctx.beginPath(); ctx.arc(x, y, r, 0, PI2);${N}` +
  `  ctx.fillStyle = '#FF2244'; ctx.fill();${N}` +
  `  ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 1.5; ctx.stroke();${N}` +
  `  ctx.font = 'bold '+Math.round(u*0.3)+'px monospace';${N}` +
  `  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';${N}` +
  `  ctx.fillStyle = '#FFF';${N}` +
  `  ctx.fillText(count > 9 ? '9+' : ''+count, x, y);${N}` +
  `}${N}${N}` +
  `function drawButton(x,y,w,h,label,opts){`
);

// 2b. Replace missions button with notification dot on level map
patch('Add notification dot to missions button',
  `  drawButton(miX,miY,miW,miH,'MISSIONS'+(unclaimedN>0?' !':''),{fill:unclaimedN>0?'rgba(255,180,0,0.35)':'rgba(100,180,100,0.3)',stroke:unclaimedN>0?'rgba(255,200,50,0.6)':'rgba(100,180,100,0.5)',lw:1,textColor:unclaimedN>0?'#FFD700':'rgba(200,255,200,0.8)',font:FONTS['b0.4']||('bold '+Math.round(u*0.4)+'px monospace')});`,

  `  drawButton(miX,miY,miW,miH,'MISSIONS',{fill:unclaimedN>0?'rgba(255,180,0,0.35)':'rgba(100,180,100,0.3)',stroke:unclaimedN>0?'rgba(255,200,50,0.6)':'rgba(100,180,100,0.5)',lw:1,textColor:unclaimedN>0?'#FFD700':'rgba(200,255,200,0.8)',font:FONTS['b0.4']||('bold '+Math.round(u*0.4)+'px monospace')});${N}` +
  `  if(unclaimedN>0) drawNotifDot(miX+miW-u*0.1, miY+u*0.1, unclaimedN, u);`
);

// 2c. Add daily reward notification dot on level map (if unclaimed today)
// We need to add a check for whether daily reward was claimed today
patch('Add daily login dot to level map',
  `  // Daily Challenge button (bottom of title bar)`,

  `  // Daily login button${N}` +
  `  const dlToday = localDateStr(new Date());${N}` +
  `  const dlClaimed = save.lastLoginDate === dlToday;${N}` +
  `  const dlW=u*3.5, dlH=u*1, dlX=miX+miW+u*2.0, dlY=SAFE_TOP+u*.3;${N}` +
  `  drawButton(dlX,dlY,dlW,dlH,'LOGIN',{fill:dlClaimed?'rgba(60,60,80,0.3)':'rgba(255,100,50,0.3)',stroke:dlClaimed?'rgba(80,80,100,0.3)':'rgba(255,120,60,0.6)',lw:1,textColor:dlClaimed?'rgba(150,150,170,0.5)':'rgba(255,180,100,0.9)',font:FONTS['b0.4']||('bold '+Math.round(u*0.4)+'px monospace')});${N}` +
  `  if(!dlClaimed) drawNotifDot(dlX+dlW-u*0.1, dlY+u*0.1, 1, u);${N}` +
  `${N}` +
  `  // Daily Challenge button (bottom of title bar)`
);

// 2d. Add tap handler for daily login button on level map
patch('Add daily login button tap handler',
  `  // Settings gear${N}  const geX=miX+miW+u*0.3`,
  `  // Daily login button tap${N}` +
  `  const dlW2=u*3.5, dlH2=u*1, dlX2=miX+miW+u*2.0, dlY2=SAFE_TOP+u*.3;${N}` +
  `  if(tx>dlX2&&tx<dlX2+dlW2&&ty>dlY2&&ty<dlY2+dlH2){${N}` +
  `    if(checkDailyReward()){ G.phase='DAILY_REWARD'; }${N}` +
  `    else { G.phase='DAILY_REWARD'; G.dailyRewardType=null; G.dailyRewardClaimed=true; G.dailyRewardTimer=0; }${N}` +
  `    sfxUITap(); return;${N}` +
  `  }${N}` +
  `  // Settings gear${N}  const geX=miX+miW+u*0.3`
);

// ================================================================
// 3. IMPROVED MISSIONS UI
// ================================================================
console.log('\n=== 3. Improved Missions UI ===');

// 3a. Replace drawMissionsScreen with enhanced version
patch('Replace drawMissionsScreen with improved UI',
  `function drawMissionsScreen(dt) {${N}  const u = UNIT;${N}  ctx.fillStyle = '#0a1628'; ctx.fillRect(0, 0, W, H);${N}  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';${N}  ctx.font = FONTS['b2'] || ('bold ' + Math.round(u*2) + 'px monospace');${N}  ctx.fillStyle = '#FFD700';${N}  ctx.fillText('MISSIONS', W/2, H * 0.06);${N}  checkMissionResets();${N}${N}  const panelX = W * 0.05, panelW = W * 0.9;${N}  let y = H * 0.13;${N}${N}  // Daily header${N}  ctx.textAlign = 'left';${N}  ctx.font = FONTS['b0.6'] || ('bold ' + Math.round(u*0.6) + 'px monospace');${N}  ctx.fillStyle = '#FFD700';${N}  ctx.fillText('Daily Missions', panelX + u * 0.3, y);${N}  y += u * 0.7;${N}  const daily = save.missions && save.missions.daily || [];${N}  for (const m of daily) {${N}    drawMissionCard(panelX, y, panelW, u * 1.1, m, u);${N}    y += u * 1.3;${N}  }${N}  if (!daily.length) { ctx.textAlign='center'; ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.fillText('No missions yet',W/2,y); y+=u*0.7; }${N}${N}  y += u * 0.3;${N}  ctx.textAlign = 'left';${N}  ctx.fillStyle = '#88CCFF';${N}  ctx.fillText('Weekly Missions', panelX + u * 0.3, y);${N}  y += u * 0.7;${N}  const weekly = save.missions && save.missions.weekly || [];${N}  for (const m of weekly) {${N}    drawMissionCard(panelX, y, panelW, u * 1.1, m, u);${N}    y += u * 1.3;${N}  }${N}${N}  drawButton(W/2 - u*2.5, H * 0.9, u * 5, u * 1, 'BACK', {${N}    fill: 'rgba(60,60,80,0.7)', stroke: 'rgba(255,255,255,0.3)',${N}    font: FONTS['b0.65'] || ('bold ' + Math.round(u*0.65) + 'px monospace')${N}  });${N}}`,

  `function getMissionResetCountdown(type) {${N}` +
  `  const now = new Date();${N}` +
  `  if (type === 'daily') {${N}` +
  `    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);${N}` +
  `    const diff = Math.max(0, Math.floor((tomorrow - now)/1000));${N}` +
  `    const h = Math.floor(diff/3600), m = Math.floor((diff%3600)/60);${N}` +
  `    return h+'h '+m+'m';${N}` +
  `  } else {${N}` +
  `    const day = now.getDay() || 7;${N}` +
  `    const daysLeft = 8 - day;${N}` +
  `    return daysLeft+'d';${N}` +
  `  }${N}` +
  `}${N}` +
  `${N}` +
  `function drawMissionsScreen(dt) {${N}` +
  `  if (!G._missionClaimFX) G._missionClaimFX = [];${N}` +
  `  const u = UNIT;${N}` +
  `  ctx.fillStyle = '#0a1628'; ctx.fillRect(0, 0, W, H);${N}` +
  `  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';${N}` +
  `  ctx.font = 'bold ' + Math.round(u*1.5) + 'px monospace';${N}` +
  `  ctx.fillStyle = '#FFD700';${N}` +
  `  ctx.fillText('MISSIONS', W/2, H * 0.06);${N}` +
  `  checkMissionResets();${N}` +
  `${N}` +
  `  const panelX = W * 0.05, panelW = W * 0.9;${N}` +
  `  var y = H * 0.12;${N}` +
  `${N}` +
  `  // Daily header with timer${N}` +
  `  ctx.textAlign = 'left';${N}` +
  `  ctx.font = 'bold ' + Math.round(u*0.55) + 'px monospace';${N}` +
  `  ctx.fillStyle = '#FFD700';${N}` +
  `  ctx.fillText('Daily Missions', panelX + u * 0.3, y);${N}` +
  `  ctx.textAlign = 'right';${N}` +
  `  ctx.font = Math.round(u*0.35) + 'px monospace';${N}` +
  `  ctx.fillStyle = 'rgba(255,200,100,0.6)';${N}` +
  `  ctx.fillText('Resets in '+getMissionResetCountdown('daily'), panelX + panelW - u*0.3, y);${N}` +
  `  y += u * 0.7;${N}` +
  `  const daily = save.missions && save.missions.daily || [];${N}` +
  `  for (var mi=0; mi<daily.length; mi++) {${N}` +
  `    drawMissionCard(panelX, y, panelW, u * 1.4, daily[mi], u, dt);${N}` +
  `    y += u * 1.6;${N}` +
  `  }${N}` +
  `  if (!daily.length) { ctx.textAlign='center'; ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font=Math.round(u*0.4)+'px monospace'; ctx.fillText('No missions yet',W/2,y); y+=u*0.7; }${N}` +
  `${N}` +
  `  y += u * 0.2;${N}` +
  `  ctx.textAlign = 'left';${N}` +
  `  ctx.font = 'bold ' + Math.round(u*0.55) + 'px monospace';${N}` +
  `  ctx.fillStyle = '#88CCFF';${N}` +
  `  ctx.fillText('Weekly Missions', panelX + u * 0.3, y);${N}` +
  `  ctx.textAlign = 'right';${N}` +
  `  ctx.font = Math.round(u*0.35) + 'px monospace';${N}` +
  `  ctx.fillStyle = 'rgba(136,200,255,0.5)';${N}` +
  `  ctx.fillText('Resets in '+getMissionResetCountdown('weekly'), panelX + panelW - u*0.3, y);${N}` +
  `  y += u * 0.7;${N}` +
  `  const weekly = save.missions && save.missions.weekly || [];${N}` +
  `  for (var mi2=0; mi2<weekly.length; mi2++) {${N}` +
  `    drawMissionCard(panelX, y, panelW, u * 1.4, weekly[mi2], u, dt);${N}` +
  `    y += u * 1.6;${N}` +
  `  }${N}` +
  `${N}` +
  `  // Claim animation particles${N}` +
  `  for (var fi=G._missionClaimFX.length-1; fi>=0; fi--) {${N}` +
  `    var fx = G._missionClaimFX[fi];${N}` +
  `    fx.life -= dt;${N}` +
  `    if (fx.life <= 0) { G._missionClaimFX.splice(fi,1); continue; }${N}` +
  `    fx.x += fx.vx * dt; fx.y += fx.vy * dt; fx.vy += 300*dt;${N}` +
  `    var fa = clamp(fx.life/fx.maxLife, 0, 1);${N}` +
  `    ctx.globalAlpha = fa;${N}` +
  `    ctx.fillStyle = fx.color;${N}` +
  `    ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r, 0, PI2); ctx.fill();${N}` +
  `  }${N}` +
  `  ctx.globalAlpha = 1;${N}` +
  `${N}` +
  `  drawButton(W/2 - u*2.5, H * 0.92, u * 5, u * 0.9, 'BACK', {${N}` +
  `    fill: 'rgba(60,60,80,0.7)', stroke: 'rgba(255,255,255,0.3)',${N}` +
  `    font: 'bold ' + Math.round(u*0.55) + 'px monospace'${N}` +
  `  });${N}` +
  `}`
);

// 3b. Replace drawMissionCard with enhanced version
patch('Replace drawMissionCard with improved version',
  `function drawMissionCard(x, y, w, h, mission, u) {${N}  const done = mission.claimed;${N}  const ready = !done && (mission.progress || 0) >= mission.target;${N}  fillRR(x, y, w, h, u * 0.25,${N}    done ? 'rgba(40,80,40,0.5)' : ready ? 'rgba(80,60,20,0.6)' : 'rgba(7,14,26,0.6)',${N}    done ? 'rgba(100,200,100,0.3)' : ready ? 'rgba(255,215,0,0.4)' : 'rgba(255,255,255,0.12)', 1);${N}${N}  ctx.textAlign = 'left';${N}  ctx.font = FONTS['n0.4'] || (Math.round(u*0.4) + 'px monospace');${N}  ctx.fillStyle = done ? 'rgba(150,200,150,0.6)' : '#FFF';${N}  ctx.fillText(mission.desc, x + u * 0.3, y + u * 0.3);${N}${N}  // Progress bar${N}  const barX = x + u * 0.3, barY = y + h - u * 0.35, barW = w * 0.45, barH = u * 0.15;${N}  fillRR(barX, barY, barW, barH, barH/2, 'rgba(255,255,255,0.1)', null, 0);${N}  const prog = clamp((mission.progress || 0) / mission.target, 0, 1);${N}  if (prog > 0) fillRR(barX, barY, barW * prog, barH, barH/2, done ? '#4caf50' : ready ? '#FFD700' : '#2196F3', null, 0);${N}${N}  ctx.font = FONTS['n0.4'] || (Math.round(u*0.35) + 'px monospace');${N}  ctx.fillStyle = 'rgba(255,255,255,0.6)';${N}  ctx.fillText(Math.min(mission.progress || 0, mission.target) + '/' + mission.target, barX + barW + u * 0.2, barY + barH * 0.7);${N}${N}  // Reward / Claim${N}  const btnX = x + w - u * 2.8;${N}  if (done) {${N}    ctx.textAlign = 'center'; ctx.fillStyle = '#4caf50';${N}    ctx.fillText('\\u2713 DONE', btnX + u * 1.2, y + h / 2);${N}  } else if (ready) {${N}    drawButton(btnX, y + u * 0.15, u * 2.5, h - u * 0.3, '+' + mission.reward + 'g', {${N}      fill: 'rgba(255,215,0,0.3)', stroke: '#FFD700', textColor: '#FFD700',${N}      font: FONTS['b0.4'] || ('bold ' + Math.round(u*0.4) + 'px monospace')${N}    });${N}  } else {${N}    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,215,0,0.4)';${N}    ctx.fillText(mission.reward + 'g', btnX + u * 1.2, y + h / 2);${N}  }${N}}`,

  `function drawMissionCard(x, y, w, h, mission, u, dt) {${N}` +
  `  const done = mission.claimed;${N}` +
  `  const ready = !done && (mission.progress || 0) >= mission.target;${N}` +
  `  const prog = clamp((mission.progress || 0) / mission.target, 0, 1);${N}` +
  `${N}` +
  `  // Animate progress bar fill (smooth lerp)${N}` +
  `  if (mission._displayProg === undefined) mission._displayProg = prog;${N}` +
  `  mission._displayProg += (prog - mission._displayProg) * Math.min(1, (dt||0.016) * 4);${N}` +
  `${N}` +
  `  // Card background with subtle glow for ready state${N}` +
  `  if (ready) {${N}` +
  `    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 8 + Math.sin(G.time*4)*3;${N}` +
  `  }${N}` +
  `  fillRR(x, y, w, h, u * 0.25,${N}` +
  `    done ? 'rgba(40,80,40,0.5)' : ready ? 'rgba(80,60,20,0.6)' : 'rgba(7,14,26,0.6)',${N}` +
  `    done ? 'rgba(100,200,100,0.3)' : ready ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.12)', ready?2:1);${N}` +
  `  ctx.shadowBlur = 0;${N}` +
  `${N}` +
  `  // Mission description${N}` +
  `  ctx.textAlign = 'left';${N}` +
  `  ctx.font = Math.round(u*0.4) + 'px monospace';${N}` +
  `  ctx.fillStyle = done ? 'rgba(150,200,150,0.6)' : '#FFF';${N}` +
  `  ctx.fillText(mission.desc, x + u * 0.3, y + u * 0.35);${N}` +
  `${N}` +
  `  // Enhanced progress bar with gradient and percentage${N}` +
  `  const barX = x + u * 0.3, barY = y + h - u * 0.5, barW = w * 0.52, barH = u * 0.22;${N}` +
  `  // Bar background${N}` +
  `  fillRR(barX, barY, barW, barH, barH/2, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.06)', 1);${N}` +
  `  // Bar fill with gradient${N}` +
  `  var dp = mission._displayProg;${N}` +
  `  if (dp > 0.005) {${N}` +
  `    var barGrad = ctx.createLinearGradient(barX, 0, barX+barW*dp, 0);${N}` +
  `    if (done) { barGrad.addColorStop(0,'#2e7d32'); barGrad.addColorStop(1,'#4caf50'); }${N}` +
  `    else if (ready) { barGrad.addColorStop(0,'#FF8800'); barGrad.addColorStop(1,'#FFD700'); }${N}` +
  `    else { barGrad.addColorStop(0,'#1565c0'); barGrad.addColorStop(1,'#42a5f5'); }${N}` +
  `    fillRR(barX, barY, Math.max(barH, barW * dp), barH, barH/2, barGrad, null, 0);${N}` +
  `    // Shine effect on bar${N}` +
  `    if (!done) {${N}` +
  `      var shineX = barX + (barW*dp)*0.3;${N}` +
  `      ctx.globalAlpha = 0.2;${N}` +
  `      fillRR(barX, barY, Math.max(barH, barW*dp*0.5), barH*0.45, barH/4, 'rgba(255,255,255,0.4)', null, 0);${N}` +
  `      ctx.globalAlpha = 1;${N}` +
  `    }${N}` +
  `  }${N}` +
  `${N}` +
  `  // Progress text and percentage${N}` +
  `  ctx.font = Math.round(u*0.32) + 'px monospace';${N}` +
  `  ctx.fillStyle = 'rgba(255,255,255,0.7)';${N}` +
  `  ctx.fillText(Math.min(mission.progress || 0, mission.target) + '/' + mission.target, barX + barW + u * 0.2, barY + barH * 0.8);${N}` +
  `  // Percentage${N}` +
  `  ctx.textAlign = 'right';${N}` +
  `  ctx.fillStyle = done?'#4caf50':ready?'#FFD700':'rgba(255,255,255,0.4)';${N}` +
  `  ctx.fillText(Math.round(prog*100)+'%', barX + barW + u*1.8, barY + barH * 0.8);${N}` +
  `${N}` +
  `  // Reward / Claim button${N}` +
  `  const btnX = x + w - u * 2.8;${N}` +
  `  if (done) {${N}` +
  `    ctx.textAlign = 'center'; ctx.fillStyle = '#4caf50';${N}` +
  `    ctx.font = 'bold '+Math.round(u*0.45)+'px monospace';${N}` +
  `    ctx.fillText('\\u2713 DONE', btnX + u * 1.2, y + h * 0.4);${N}` +
  `  } else if (ready) {${N}` +
  `    // Pulsing claim button${N}` +
  `    const pulse = 1+Math.sin(G.time*5)*0.04;${N}` +
  `    const bw=u*2.5, bh=h-u*0.4, bxc=btnX+bw/2, byc=y+h/2;${N}` +
  `    ctx.save(); ctx.translate(bxc,byc); ctx.scale(pulse,pulse); ctx.translate(-bxc,-byc);${N}` +
  `    drawButton(btnX, y + u * 0.2, bw, bh, '+' + mission.reward, {${N}` +
  `      fill: 'rgba(255,215,0,0.35)', stroke: '#FFD700', textColor: '#FFD700',${N}` +
  `      font: 'bold ' + Math.round(u*0.45) + 'px monospace', radius: u*0.2${N}` +
  `    });${N}` +
  `    ctx.restore();${N}` +
  `  } else {${N}` +
  `    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,215,0,0.35)';${N}` +
  `    ctx.font = Math.round(u*0.38)+'px monospace';${N}` +
  `    ctx.fillText(mission.reward+'g', btnX + u * 1.2, y + h * 0.4);${N}` +
  `  }${N}` +
  `}`
);

// 3c. Replace handleMissionsTap to add claim animation
patch('Replace handleMissionsTap with claim animation',
  `function handleMissionsTap() {${N}  const tx = inp.tapX, ty = inp.tapY, u = UNIT;${N}  const panelX = W * 0.05, panelW = W * 0.9;${N}${N}  // Check daily claim buttons${N}  let y = H * 0.13 + u * 0.7;${N}  const daily = save.missions && save.missions.daily || [];${N}  for (const m of daily) {${N}    const btnX = panelX + panelW - u * 2.8;${N}    if (!m.claimed && (m.progress || 0) >= m.target && tx >= btnX && tx <= btnX + u * 2.5 && ty >= y && ty <= y + u * 1.1) {${N}      claimMissionReward(m); sfxGem(); return;${N}    }${N}    y += u * 1.3;${N}  }${N}  if (!daily.length) y += u * 0.7;${N}${N}  // Check weekly claim buttons${N}  y += u * 1;${N}  const weekly = save.missions && save.missions.weekly || [];${N}  for (const m of weekly) {${N}    const btnX = panelX + panelW - u * 2.8;${N}    if (!m.claimed && (m.progress || 0) >= m.target && tx >= btnX && tx <= btnX + u * 2.5 && ty >= y && ty <= y + u * 1.1) {${N}      claimMissionReward(m); sfxGem(); return;${N}    }${N}    y += u * 1.3;${N}  }${N}${N}  // Back button${N}  if (tx > W/2 - u*2.5 && tx < W/2 + u*2.5 && ty > H*0.9 && ty < H*0.9 + u) {${N}    G.phase = 'LEVEL_MAP'; sfxUITap();${N}  }${N}}`,

  `function spawnClaimFX(cx, cy) {${N}` +
  `  if (!G._missionClaimFX) G._missionClaimFX = [];${N}` +
  `  var colors = ['#FFD700','#FFAA00','#FF8800','#44FF88','#FFFFFF'];${N}` +
  `  for (var i=0; i<15; i++) {${N}` +
  `    var angle = (i/15)*Math.PI*2 + Math.random()*0.3;${N}` +
  `    var speed = 100+Math.random()*200;${N}` +
  `    G._missionClaimFX.push({${N}` +
  `      x:cx, y:cy, vx:Math.cos(angle)*speed, vy:Math.sin(angle)*speed-50,${N}` +
  `      r:UNIT*(0.08+Math.random()*0.12), color:colors[i%colors.length],${N}` +
  `      life:0.6+Math.random()*0.4, maxLife:1.0${N}` +
  `    });${N}` +
  `  }${N}` +
  `}${N}` +
  `${N}` +
  `function handleMissionsTap() {${N}` +
  `  const tx = inp.tapX, ty = inp.tapY, u = UNIT;${N}` +
  `  const panelX = W * 0.05, panelW = W * 0.9;${N}` +
  `${N}` +
  `  // Check daily claim buttons${N}` +
  `  var y = H * 0.12 + u * 0.7;${N}` +
  `  const daily = save.missions && save.missions.daily || [];${N}` +
  `  for (var di=0; di<daily.length; di++) {${N}` +
  `    var m = daily[di];${N}` +
  `    const btnX = panelX + panelW - u * 2.8;${N}` +
  `    const cardH = u * 1.4;${N}` +
  `    if (!m.claimed && (m.progress || 0) >= m.target && tx >= btnX && tx <= btnX + u * 2.5 && ty >= y && ty <= y + cardH) {${N}` +
  `      claimMissionReward(m); sfxGem();${N}` +
  `      spawnClaimFX(btnX + u*1.2, y + cardH/2);${N}` +
  `      showAnnouncement('+'+m.reward+' Gems!', '#FFD700');${N}` +
  `      return;${N}` +
  `    }${N}` +
  `    y += u * 1.6;${N}` +
  `  }${N}` +
  `  if (!daily.length) y += u * 0.7;${N}` +
  `${N}` +
  `  // Check weekly claim buttons${N}` +
  `  y += u * 0.9;${N}` +
  `  const weekly = save.missions && save.missions.weekly || [];${N}` +
  `  for (var wi=0; wi<weekly.length; wi++) {${N}` +
  `    var wm = weekly[wi];${N}` +
  `    const btnX2 = panelX + panelW - u * 2.8;${N}` +
  `    const cardH2 = u * 1.4;${N}` +
  `    if (!wm.claimed && (wm.progress || 0) >= wm.target && tx >= btnX2 && tx <= btnX2 + u * 2.5 && ty >= y && ty <= y + cardH2) {${N}` +
  `      claimMissionReward(wm); sfxGem();${N}` +
  `      spawnClaimFX(btnX2 + u*1.2, y + cardH2/2);${N}` +
  `      showAnnouncement('+'+wm.reward+' Gems!', '#FFD700');${N}` +
  `      return;${N}` +
  `    }${N}` +
  `    y += u * 1.6;${N}` +
  `  }${N}` +
  `${N}` +
  `  // Back button${N}` +
  `  if (tx > W/2 - u*2.5 && tx < W/2 + u*2.5 && ty > H*0.92 && ty < H*0.92 + u*0.9) {${N}` +
  `    G.phase = 'LEVEL_MAP'; sfxUITap();${N}` +
  `  }${N}` +
  `}`
);


// Write result
console.log('\n=== Applied ' + applied + ' changes ===');
if (failed > 0) console.log('=== FAILED ' + failed + ' changes ===');
fs.writeFileSync('index.html', html);
console.log('File size: ' + (html.length / 1024 / 1024).toFixed(2) + ' MB');
