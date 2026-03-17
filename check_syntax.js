const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');

const lines = content.split('\n');
let found = 0;

// Search for ?. and ?? excluding common string patterns like ??? or URLs
lines.forEach((line, i) => {
    // Look for ?. but not as part of a decimal like ?.08 (which is still a problem)
    // and ?? but not in strings
    const optionalChaining = line.match(/\?\.[a-zA-Z_0-9]/);
    const nullishCoalescing = line.match(/\?\?(?![?])/);
    
    // Check for the specific typo I found
    const typo = line.match(/\?\.[0-9]/);

    if (optionalChaining || nullishCoalescing || typo) {
        // Exclude some common false positives like comments or strings
        if (!line.trim().startsWith('//') && !line.includes("'???'")) {
            console.log(`Line ${i + 1}: ${line.trim()}`);
            found++;
        }
    }
});

console.log(`Found ${found} potential issues.`);
