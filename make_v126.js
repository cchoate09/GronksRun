const fs = require('fs');
const path = require('path');

// Paths
const backupPath = path.join(__dirname, 'index_full_backup.html');
const indexPath = path.join(__dirname, 'index.html');

console.log('--- Gronk\'s Run v1.2.6 Restoration Script ---');

// 1. Read Backup
console.log('Reading backup...');
const backupText = fs.readFileSync(backupPath, 'utf8');
const backupLines = backupText.split(/\r?\n/);

// Extract Sprite Data (Lines 300 to 447, 0-indexed: 299 to 447)
// Line 300: var SPRITE_B64 = {
// Line 447: };
const spriteBlock = backupLines.slice(299, 447).join('\n');
console.log(`Extracted SPRITE_B64 block (${spriteBlock.length} bytes)`);

// Extract Missing Systems (Lines 690 to 1086, 0-indexed: 689 to 1086)
const missingLogic = backupLines.slice(689, 1086).join('\n');
console.log(`Extracted Missing Logic block (${missingLogic.length} bytes)`);

// 2. Read Current index.html
console.log('Reading current index.html...');
let html = fs.readFileSync(indexPath, 'utf8');

// 3. Restore SPRITE_B64
console.log('Restoring SPRITE_B64...');
const spriteRegex = /var SPRITE_B64 = \{[\s\S]*?\};/;
if (spriteRegex.test(html)) {
    html = html.replace(spriteRegex, spriteBlock);
} else {
    console.warn('Could not find SPRITE_B64 block in index.html, skipping direct replace.');
}

// 4. Clean up corrupted literal \n and \r
console.log('Cleaning up literal \\n and \\r corruption...');
html = html.replace(/\\n/g, '\n').replace(/\\r/g, '\r');

// 5. Restore Missing Logic Blocks (Cleanly)
// We'll look for the injection point 'const particles = [];' or '// COMBO SYSTEM'
// Actually, let's just make sure the systems are there.
const injectionPoint = '// COMBO SYSTEM';
if (html.includes(injectionPoint)) {
    // Check if missing logic is already mostly there (to avoid double injection)
    if (!html.includes('function spawnParticle')) {
        console.log('Injecting Missing Logic...');
        html = html.replace(injectionPoint, missingLogic + '\n\n' + injectionPoint);
    } else {
        console.log('Missing logic seems to be already present.');
    }
}

// 6. Versioning Update (v1.2.6, Code 9)
console.log('Updating internal version strings...');
html = html.replace(/Gronk's Run v1\.\d+(\.\d+)?/g, "Gronk's Run v1.2.6");

// Write back
fs.writeFileSync(indexPath, html);
console.log('index.html updated successfully!');

// 7. Update other config files
console.log('Updating package.json, app.json, and build.gradle...');

function updateFile(p, regex, replacement) {
    if (fs.existsSync(p)) {
        let content = fs.readFileSync(p, 'utf8');
        content = content.replace(regex, replacement);
        fs.writeFileSync(p, content);
        console.log(`Updated ${path.basename(p)}`);
    }
}

updateFile('package.json', /"version": ".*?"/, '"version": "1.2.6"');
updateFile('app.json', /"version": ".*?"/, '"version": "1.2.6"');
updateFile('app.json', /"versionCode": \d+/, '"versionCode": 9');

const gradlePath = path.join('android', 'app', 'build.gradle');
updateFile(gradlePath, /versionCode \d+/, 'versionCode 9');
updateFile(gradlePath, /versionName ".*?"/, 'versionName "1.2.6"');

console.log('--- Restoration Complete ---');
