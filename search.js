const fs = require('fs');
const path = require('path');

const results = [];
function walk(dir) {
  fs.readdirSync(dir).forEach(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        walk(full);
      }
    } else if (full.endsWith('.js') || full.endsWith('.jsx')) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('working_days')) {
          results.push(`${full}:${index + 1}: ${line.trim()}`);
        }
      });
    }
  });
}

walk('src');
fs.writeFileSync('search_details.txt', results.join('\n'));
console.log('Done');
