// Dedupe text-overflow report.json into worst (largest-rendered) issue per
// (state, viewport, text). Keeping the largest fontPx eliminates pop-in
// animation transient frames where text scales from 0 to full size.
const fs = require('fs');
const path = require('path');
const reportPath = path.join(process.cwd(), 'output', 'text-overflow', 'report.json');
const raw = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const bestByKey = new Map();
const errors = [];
for (const it of raw.issues) {
  if (it.error) {
    errors.push(it);
    continue;
  }
  const key = `${it.label}@${it.viewport}::${(it.text || '').trim()}`;
  const prev = bestByKey.get(key);
  const fontPx = (it.rect && it.rect.fontPx) || 0;
  if (!prev) {
    bestByKey.set(key, it);
    continue;
  }
  const prevPx = (prev.rect && prev.rect.fontPx) || 0;
  if (fontPx > prevPx) bestByKey.set(key, it);
}
function viewportDims(name) {
  const m = String(name || '').match(/^(\d+)x(\d+)/);
  return m ? { w: +m[1], h: +m[2] } : { w: Infinity, h: Infinity };
}
function reasonsFor(it) {
  const r = it.rect || {};
  const v = viewportDims(it.viewport);
  const reasons = [];
  if (r.left < -0.5) reasons.push(`left ${r.left.toFixed(1)} < 0`);
  if (r.right > v.w + 0.5) reasons.push(`right ${r.right.toFixed(1)} > ${v.w}`);
  if (r.top < -0.5) reasons.push(`top ${r.top.toFixed(1)} < 0`);
  if (r.bottom > v.h + 0.5) reasons.push(`bottom ${r.bottom.toFixed(1)} > ${v.h}`);
  if (r.fontPx > 0 && r.fontPx < 9) reasons.push(`font ${r.fontPx.toFixed(1)}px below readable floor 9px`);
  return reasons;
}
const final = [];
for (const it of bestByKey.values()) {
  const reasons = reasonsFor(it);
  if (reasons.length === 0) continue;
  it.reasons = reasons;
  final.push(it);
}
const grouped = {};
for (const it of final) {
  const k = `${it.label}@${it.viewport}`;
  grouped[k] = grouped[k] || [];
  grouped[k].push(it);
}
const lines = ['# Text Overflow — Worst-Case Issues', ''];
lines.push(`Total: ${final.length}`);
lines.push('');
for (const k of Object.keys(grouped).sort()) {
  lines.push(`## ${k}  (${grouped[k].length})`);
  for (const it of grouped[k]) {
    const reason = (it.reasons || []).join(' · ');
    lines.push(`- "${(it.text || '').replace(/\n/g, ' ')}" — ${reason}  [${it.align}/${it.baseline}, ${it.font}]`);
  }
  lines.push('');
}
fs.writeFileSync(path.join(process.cwd(), 'output', 'text-overflow', 'unique.md'), lines.join('\n'));
console.log(`Worst-case unique flagged texts: ${final.length}`);
console.log('Wrote: output/text-overflow/unique.md');
