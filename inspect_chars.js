const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const start = content.indexOf('function drawTerrain(theme){');
if (start !== -1) {
    const snippet = content.substring(start, start + 300);
    console.log('Snippet Hex:');
    console.log(Buffer.from(snippet).toString('hex').match(/.{1,64}/g).join('\n'));
    console.log('Snippet Text:');
    console.log(snippet);
} else {
    console.log('Could not find start of drawTerrain');
}
