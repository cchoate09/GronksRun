const fs = require('fs');
let h = fs.readFileSync('index.html', 'utf8');

// Add share button to level complete screen
h = h.replace(
  `  if(G.levelCompleteTimer>3){
    if(Math.sin(Date.now()*.005)>0){
      ctx.font=\`bold \${u*1}px monospace\`;ctx.fillStyle='white';
      ctx.fillText('TAP FOR NEXT LEVEL',W/2,H*.75);
    }
  }
}`,
  `  if(G.levelCompleteTimer>2){
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
      ctx.font=\`bold \${u*1}px monospace\`;ctx.fillStyle='white';
      ctx.fillText('TAP FOR NEXT LEVEL',W/2,H*.75);
    }
  }
}`
);

fs.writeFileSync('index.html', h);
console.log('Added share button to level complete screen');
