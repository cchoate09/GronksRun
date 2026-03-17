const fs = require('fs');
const raw = fs.readFileSync('gameHtml.js', 'utf8');

// The file is: export default `...`;
// Find the template literal content
const start = raw.indexOf('`') + 1;
const end = raw.lastIndexOf('`');
const content = raw.substring(start, end);

console.log('Template content length:', content.length);

// Check for unescaped backticks (backtick NOT preceded by backslash)
let unescapedBT = 0;
for (let i = 0; i < content.length; i++) {
  if (content[i] === '`' && (i === 0 || content[i-1] !== '\\')) {
    unescapedBT++;
    if (unescapedBT <= 5) {
      console.log('Unescaped backtick at pos', i, ':', JSON.stringify(content.substring(Math.max(0,i-30), i+30)));
    }
  }
}
console.log('Total unescaped backticks:', unescapedBT);

// Check for unescaped ${ (dollar-brace NOT preceded by backslash)
let unescapedTL = 0;
for (let i = 0; i < content.length - 1; i++) {
  if (content[i] === '$' && content[i+1] === '{' && (i === 0 || content[i-1] !== '\\')) {
    unescapedTL++;
    if (unescapedTL <= 5) {
      console.log('Unescaped ${ at pos', i, ':', JSON.stringify(content.substring(Math.max(0,i-30), i+30)));
    }
  }
}
console.log('Total unescaped template expressions:', unescapedTL);

// Also try to evaluate it as a template literal
try {
  const fn = new Function('return `' + content + '`');
  const result = fn();
  console.log('Template literal eval: OK, length:', result.length);
} catch(e) {
  console.log('Template literal eval ERROR:', e.message);
}
