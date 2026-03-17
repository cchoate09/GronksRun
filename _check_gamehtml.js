const fs = require('fs');
const content = fs.readFileSync('gameHtml.js', 'utf8');
// Try to evaluate as a module - if the template literal is broken it will fail
try {
  // The file is: export default `...`;
  // Extract just the template literal content
  const start = content.indexOf('`');
  const end = content.lastIndexOf('`');
  const body = content.substring(start + 1, end);

  // Check for unescaped template literal interpolation
  let issues = 0;
  for (let i = 0; i < body.length - 1; i++) {
    if (body[i] === '$' && body[i+1] === '{' && (i === 0 || body[i-1] !== '\\')) {
      issues++;
      if (issues <= 5) {
        const ctx = body.substring(Math.max(0, i-40), Math.min(body.length, i+40));
        console.log('Unescaped ${} at pos ' + i + ': ' + JSON.stringify(ctx));
      }
    }
  }
  console.log('Total unescaped ${}: ' + issues);

  // Also check for unescaped backticks
  let btIssues = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '`' && (i === 0 || body[i-1] !== '\\')) {
      btIssues++;
      if (btIssues <= 5) {
        const ctx = body.substring(Math.max(0, i-40), Math.min(body.length, i+40));
        console.log('Unescaped backtick at pos ' + i + ': ' + JSON.stringify(ctx));
      }
    }
  }
  console.log('Total unescaped backticks: ' + btIssues);

  console.log('Body length: ' + body.length);
} catch(e) {
  console.log('Error: ' + e.message);
}
