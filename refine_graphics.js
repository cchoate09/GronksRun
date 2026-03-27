const fs = require('fs');

async function main() {
    let content = fs.readFileSync('index.html', 'utf8');

    const hudNewBody = `  const u=UNIT, pad=Math.max(u*.7,14)+SAFE_TOP, p=G.player;
  const tl=G.timeLeft;

  // Level name & number (top center above timer)
  ctx.font=\`bold \${u*.65}px monospace\`;ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillStyle='rgba(255,255,255,0.6)';
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4;
  ctx.fillText(\`Level \${G.levelNum}: \${G.levelDef.name}\`,W/2,pad*.3);
  ctx.shadowBlur = 0;

  // Timer
  const urg=clamp(1-tl/10,0,1);
  const tCol=\`rgb(255,\${Math.floor(lerp(210,30,urg))},\${Math.floor(lerp(90,30,urg))})\`;
  const pf=tl<5?1+Math.sin(G.time*12)*.14:1;
  ctx.save();ctx.translate(W/2,pad+u*1.6);ctx.scale(pf,pf);
  ctx.font=\`bold \${u*1.7}px monospace\`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillText(\`\${Math.ceil(tl)}s\`,3,3);
  ctx.shadowColor = tCol; ctx.shadowBlur = tl < 5 ? 15 : 0;
  ctx.fillStyle=tCol;ctx.fillText(\`\${Math.ceil(tl)}s\`,0,0);
  ctx.restore();

  // Level progress bar (Modernized)
  const prog=clamp(G.time/G.levelDef.targetTime,0,1);
  const barW=u*10, barH=u*.35, barX=W/2-barW/2, barY=pad+u*3.2;
  // Glass track
  ctx.fillStyle='rgba(255,255,255,0.1)';
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(barX,barY,barW,barH,u*.1); else ctx.rect(barX,barY,barW,barH);
  ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.stroke();
  // Fill gradient
  const pGrd=ctx.createLinearGradient(barX,barY,barX,barY+barH);
  pGrd.addColorStop(0,\`hsl(\${lerp(0,120,prog)},85%,65%)\`);
  pGrd.addColorStop(1,\`hsl(\${lerp(0,120,prog)},75%,45%)\`);
  ctx.fillStyle=pGrd;
  ctx.shadowColor = \`hsl(\${lerp(0,120,prog)},80%,50%)\`; ctx.shadowBlur = 10;
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(barX,barY,barW*prog,barH,u*.1); else ctx.rect(barX,barY,barW*prog,barH);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Percentage text
  ctx.font=\`bold \${u*.45}px monospace\`;ctx.textAlign='center';ctx.textBaseline='top';
  ctx.fillStyle='rgba(255,255,255,0.8)';
  ctx.fillText(\`\${Math.floor(prog*100)}%\`,W/2,barY+barH+4);

  // Score panel bg (Glassmorphism top-left)
  const spW=u*5.7,spH=u*2.3;
  ctx.save();
  ctx.translate(pad, pad);
  ctx.fillStyle='rgba(255,255,255,0.08)';
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(0, 0, spW, spH, u*.4); else ctx.rect(0, 0, spW, spH);
  ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1.5;ctx.stroke();
  ctx.restore();

  // Score (top-left)
  ctx.font=\`bold \${u*1.0}px monospace\`;ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillText(\`\${G.runScore}\`,pad+u*.3+2,pad+u*.2+2);
  ctx.fillStyle='#FFD700'; ctx.shadowColor = '#FF8800'; ctx.shadowBlur = 5;
  ctx.fillText(\`\${G.runScore}\`,pad+u*.3,pad+u*.2);
  ctx.shadowBlur = 0;

  // HP Bar (Modern Glass top-left)
  const hpBarW=u*5.1, hpBarH=u*.42, hpBarX=pad+u*.3, hpBarY=pad+u*1.45;
  const hpPct=clamp(p.hp/p.maxHP,0,1);
  ctx.fillStyle='rgba(0,0,0,0.4)';
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(hpBarX,hpBarY,hpBarW,hpBarH,u*.1); else ctx.rect(hpBarX,hpBarY,hpBarW,hpBarH);
  ctx.fill();
  const hpHue=lerp(0,120,hpPct);
  const hpGrd=ctx.createLinearGradient(hpBarX,hpBarY,hpBarX,hpBarY+hpBarH);
  hpGrd.addColorStop(0,\`hsl(\${hpHue},85%,60%)\`);
  hpGrd.addColorStop(1,\`hsl(\${hpHue},75%,40%)\`);
  ctx.fillStyle=hpGrd;
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(hpBarX,hpBarY,hpBarW*hpPct,hpBarH,u*.1); else ctx.rect(hpBarX,hpBarY,hpBarW*hpPct,hpBarH);
  ctx.fill();
  if(p.hpFlash>0){ctx.fillStyle=\`rgba(255,50,50,\${p.hpFlash})\`;ctx.fill();}
  ctx.strokeStyle='rgba(255,255,255,0.3)';ctx.stroke();
  ctx.font=\`bold \${u*.4}px monospace\`;ctx.fillStyle='white';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(\`\${p.hp}/\${p.maxHP}\`,hpBarX+hpBarW/2,hpBarY+hpBarH/2);

  // Gems panel bg (Glassmorphism top-right)
  const gpW=u*5,gpX=W-pad-SAFE_RIGHT-gpW-u*.3;
  ctx.save();
  ctx.translate(gpX, pad);
  ctx.fillStyle='rgba(255,255,255,0.08)';
  ctx.beginPath();
  if(ctx.roundRect) ctx.roundRect(0, 0, gpW, u*2.3, u*.4); else ctx.rect(0, 0, gpW, u*2.3);
  ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1.5;ctx.stroke();
  ctx.restore();

  // Gems (top-right)
  ctx.font=\`bold \${u*1.0}px monospace\`;ctx.textAlign='right';
  ctx.fillStyle='rgba(0,0,0,0.5)';ctx.fillText(\`\\u25C6 \${G.runGems}\`,W-pad-SAFE_RIGHT+2,pad+u*.2+2);
  ctx.shadowColor = \`hsl(\${G.theme.gemH},100%,50%)\`; ctx.shadowBlur = 8;
  ctx.fillStyle=\`hsl(\${G.theme.gemH},100%,70%)\`;ctx.fillText(\`\\u25C6 \${G.runGems}\`,W-pad-SAFE_RIGHT,pad+u*.2);
  ctx.shadowBlur = 0;

  // Continues (below gems)
  if(G.continuesLeft>0){
    ctx.font=\`bold \${u*.55}px monospace\`;ctx.fillStyle='rgba(255,100,100,0.9)';
    ctx.fillText(\`\\u2764 x\${G.continuesLeft}\`,W-pad-SAFE_RIGHT,pad+u*1.55);
  }

  // Announce banner
  if(G.announce&&G.announce.life>0){
    const al=clamp(G.announce.life,0,1),sc=1+(1-al)*.25;
    ctx.save();ctx.translate(W/2,H*.42);ctx.scale(sc,sc);ctx.globalAlpha=al;
    ctx.font=\`bold \${u*2.0}px monospace\`;ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillText(G.announce.text,4,4);
    ctx.shadowColor = '#FFD700'; ctx.shadowBlur = 20;
    ctx.fillStyle='#FFD700';ctx.fillText(G.announce.text,0,0);
    ctx.restore();ctx.globalAlpha=1;
    G.announce.life-=dt*.75;
  }
`;

    // Regex to match the contents of drawHUD function
    const hudRegex = /function drawHUD\(dt\)\{([\s\S]*?)\n\}/;
    
    if (hudRegex.test(content)) {
        console.log('Matched drawHUD function.');
        content = content.replace(hudRegex, `function drawHUD(dt){\n${hudNewBody}\n}`);
        console.log('Updated HUD design.');
    } else {
        console.error('Could not match drawHUD function.');
    }

    fs.writeFileSync('index.html', content, 'utf8');
}

main().catch(console.error);
