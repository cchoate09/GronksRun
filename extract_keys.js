const fs = require('fs');
const content = fs.readFileSync('index_full_backup.html', 'utf8');
const match = content.match(/const SPRITE_B64 = ({[\s\S]*?});/);
if (match) {
    try {
        const spriteObj = eval('(' + match[1] + ')');
        console.log(Object.keys(spriteObj));
    } catch (e) {
        console.error('Failed to parse SPRITE_B64:', e.message);
        // Fallback: simple regex for keys
        const keys = match[1].match(/"?[a-zA-Z0-9_]+"?:\s*['"]data:image/g);
        console.log(keys ? keys.map(k => k.split(':')[0].trim().replace(/['"]/g, '')) : 'No keys found');
    }
} else {
    console.log('SPRITE_B64 not found');
}
