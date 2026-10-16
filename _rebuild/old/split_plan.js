const fs = require('fs');
const code = fs.readFileSync('js/ui.js', 'utf-8');

// Find ACT block
const actMatch = code.match(/const ACT=\{([\s\S]*?)\n\};\n/);
if(actMatch) {
  console.log("ACT block found. Length:", actMatch[1].length);
  // Just print the keys
  const keys = [...actMatch[1].matchAll(/^\s+async ([a-zA-Z0-9_]+)\(/gm)].map(m => m[1]);
  console.log("ACT keys:", keys.join(', '));
}
