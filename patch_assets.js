const fs = require('fs');

async function main() {
  const missingSprites = JSON.parse(fs.readFileSync('missing_sprites.json', 'utf8'));
  let assetsContent = fs.readFileSync('assets.js', 'utf8');

  // Find the SPRITE_B64 object closing brace
  // It's a bit tricky because the file is huge.
  // We'll look for the end of the gronk entry and append after it, or find the closing brace.
  
  // Actually, since I know the structure, let's just replace the whole SPRITE_B64 object if it's simpler,
  // or append to it.
  
  for (const [id, b64] of Object.entries(missingSprites)) {
    if (assetsContent.includes(id + ':')) {
        console.log(`${id} already exists in assets.js, skipping.`);
        continue;
    }
    // Simple append before the last };
    const marker = '};';
    const lastIndex = assetsContent.lastIndexOf(marker);
    if (lastIndex !== -1) {
        const newEntry = `  ${id}: '${b64}',\n`;
        assetsContent = assetsContent.slice(0, lastIndex) + newEntry + assetsContent.slice(lastIndex);
        console.log(`Added ${id} to assets.js`);
    } else {
        console.error('Could not find }; in assets.js');
        process.exit(1);
    }
  }

  fs.writeFileSync('assets.js', assetsContent, 'utf8');
  console.log('assets.js updated successfully.');
}

main().catch(console.error);
