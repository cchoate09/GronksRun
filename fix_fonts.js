const fs = require('fs');
let h = fs.readFileSync('index.html', 'utf8');

// Fix corrupted font assignments in the seasonal event banner
h = h.replace(
  "ctx.font=;ctx.textAlign='center';ctx.textBaseline='middle';\n        ctx.fillStyle=_activeEvent.color;",
  "ctx.font='bold '+Math.round(_eu*.5)+'px monospace';ctx.textAlign='center';ctx.textBaseline='middle';\n        ctx.fillStyle=_activeEvent.color;"
);

// Fix corrupted font assignments in rate prompt overlay
h = h.replace(
  "ctx.font=;ctx.fillStyle='#FFD700';\n        ctx.fillText('Enjoying the game?'",
  "ctx.font='bold '+Math.round(_ru*1)+'px monospace';ctx.fillStyle='#FFD700';\n        ctx.fillText('Enjoying the game?'"
);

h = h.replace(
  "ctx.font=;ctx.fillStyle='rgba(255,255,255,0.7)';\n        ctx.fillText('Rate us on the Play Store!'",
  "ctx.font=Math.round(_ru*.5)+'px monospace';ctx.fillStyle='rgba(255,255,255,0.7)';\n        ctx.fillText('Rate us on the Play Store!'"
);

h = h.replace(
  "ctx.font=;ctx.fillStyle='white';\n        ctx.fillText('RATE'",
  "ctx.font='bold '+Math.round(_ru*.55)+'px monospace';ctx.fillStyle='white';\n        ctx.fillText('RATE'"
);

fs.writeFileSync('index.html', h);
console.log('Fixed all corrupted font assignments');

// Verify no more empty font assignments
const remaining = (h.match(/ctx\.font=;/g) || []).length;
console.log('Remaining empty ctx.font=; :', remaining);
