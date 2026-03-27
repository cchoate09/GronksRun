const fs = require('fs');

const backupText = fs.readFileSync('index_full_backup.html', 'utf8');
const backupLines = backupText.split(/\r?\n/);
const missingLogic = backupLines.slice(690, 1086).join('\n');

let currentHtml = fs.readFileSync('index.html', 'utf8');

// Find where to inject
const injectionPoint = '// COMBO SYSTEM';
if (!currentHtml.includes(injectionPoint)) {
  console.error('Could not find injection point');
  process.exit(1);
}

// Remove the old adDoubleGemsUsed declaration near top of file (around line 75)
console.log('Removing duplicate adDoubleGemsUsed...');
let newHtml = currentHtml.replace('let adPendingReward = null;\nlet adDoubleGemsUsed = false;', 'let adPendingReward = null;');

  // Remove the older Recovered Death Tumble block (so it doesn\'t conflict with the one we just injected from backup)
  console.log('Removing duplicate Death Tumble Recovered block...');
  const tumbleStart = newHtml.indexOf('// ============================================================\\n// DEATH TUMBLE FX (Recovered)');
  const tumbleEnd = newHtml.indexOf('// ============================================================\\n// MAIN LOOP');
  
  // Also check for rn line endings
  const rtumbleStart = newHtml.indexOf('// ============================================================\\r\\n// DEATH TUMBLE FX (Recovered)');
  const rtumbleEnd = newHtml.indexOf('// ============================================================\\r\\n// MAIN LOOP');
  
  if (tumbleStart !== -1 && tumbleEnd !== -1 && tumbleEnd > tumbleStart) {
      newHtml = newHtml.substring(0, tumbleStart) + newHtml.substring(tumbleEnd);
  } else if (rtumbleStart !== -1 && rtumbleEnd !== -1 && rtumbleEnd > rtumbleStart) {
      newHtml = newHtml.substring(0, rtumbleStart) + newHtml.substring(rtumbleEnd);
  }

console.log(`Injecting ${missingLogic.length} bytes of missing logic...`);
newHtml = newHtml.replace(injectionPoint, missingLogic + '\\n\\n// ============================================================\\n' + injectionPoint);

fs.writeFileSync('index.html', newHtml);
console.log('Injection successful!');
