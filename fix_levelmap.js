const fs = require('fs');
let h = fs.readFileSync('index.html', 'utf8');

const OLD = "    case 'LEVEL_MAP':\n      drawLevelMap(DT);\n      if(inp.tapped){inp.tapped=false;handleLevelMapTap();}\n      break;";

const NEW = `    case 'LEVEL_MAP':
      if (!gronkSpriteLoading) initGronkSprite();
      if (!pipSpriteLoading) initPipSprite();
      if (checkRatePrompt()) { G._showRatePrompt = true; G._ratePromptTimer = 0; }
      drawLevelMap(DT);
      if(inp.tapped){
        if(G._showRatePrompt){
          const _ru=UNIT, _rw=_ru*10, _rh=_ru*5;
          const _rx=W/2-_rw/2, _ry=H/2-_rh/2;
          if(inp.tapX>_rx&&inp.tapX<_rx+_rw/2&&inp.tapY>_ry+_rh*.65&&inp.tapY<_ry+_rh*.9){
            triggerRateApp(); G._showRatePrompt=false; sfxUITap(); inp.tapped=false;
          } else if(inp.tapX>_rx+_rw/2&&inp.tapX<_rx+_rw&&inp.tapY>_ry+_rh*.65&&inp.tapY<_ry+_rh*.9){
            save._ratePromptDismissed=true; persistSave(); G._showRatePrompt=false; sfxUITap(); inp.tapped=false;
          } else { inp.tapped=false; }
        } else { inp.tapped=false;handleLevelMapTap(); }
      }
      // Seasonal event banner
      if (!_activeEvent) checkSeasonalEvent();
      if (_activeEvent) {
        const _eu=UNIT, _ew=W*.6, _eh=_eu*1.2;
        const _ex=W/2-_ew/2, _ey=SAFE_TOP+_eu*.3;
        ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillRect(_ex,_ey,_ew,_eh);
        ctx.strokeStyle=_activeEvent.color;ctx.lineWidth=2;ctx.strokeRect(_ex,_ey,_ew,_eh);
        ctx.font='bold '+Math.round(_eu*.5)+'px monospace';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillStyle=_activeEvent.color;
        ctx.fillText(_activeEvent.icon+' '+_activeEvent.name.toUpperCase()+' EVENT '+_activeEvent.icon, W/2, _ey+_eh/2);
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
        ctx.fillStyle='#22AA44';ctx.fillRect(_rx+_ru*.5,_ry+_rh*.65,_rw/2-_ru*.8,_rh*.25);
        ctx.font='bold '+Math.round(_ru*.55)+'px monospace';ctx.fillStyle='white';
        ctx.fillText('RATE', _rx+_rw*.25, _ry+_rh*.78);
        ctx.fillStyle='rgba(100,100,120,0.5)';ctx.fillRect(_rx+_rw/2+_ru*.3,_ry+_rh*.65,_rw/2-_ru*.8,_rh*.25);
        ctx.fillStyle='rgba(200,200,200,0.7)';
        ctx.fillText('LATER', _rx+_rw*.75, _ry+_rh*.78);
      }
      break;`;

if (!h.includes(OLD)) {
  console.log('WARN: Target not found. Checking what exists...');
  const idx = h.indexOf("case 'LEVEL_MAP':", 5000);
  const lines = h.split('\n');
  const lineNum = h.substring(0, idx).split('\n').length;
  for (let i = lineNum-1; i < lineNum+5; i++) console.log((i+1) + ': ' + lines[i]);
} else {
  h = h.replace(OLD, NEW);
  fs.writeFileSync('index.html', h);
  console.log('Fixed LEVEL_MAP case successfully');
}
