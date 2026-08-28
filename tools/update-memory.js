// Studio Extrait - Refresh the auto-generated "File inventory" block in MEMORY.md
// Usage: node tools/update-memory.js
// It scans js/, css/, and root *.html files and rewrites the block between the
// FILE_INVENTORY_START / FILE_INVENTORY_END markers in MEMORY.md.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const memoryPath = path.join(root, 'MEMORY.md');

const START = '<!-- FILE_INVENTORY_START -->';
const END = '<!-- FILE_INVENTORY_END -->';

function collect(dir, prefix, acc) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return acc;
  }
  for (const en of entries) {
    if (en.name.startsWith('.') || en.name === 'node_modules') continue;
    const full = path.join(dir, en.name);
    const rel = path.join(prefix, en.name).split(path.sep).join('/');
    if (en.isDirectory()) {
      collect(full, rel, acc);
    } else if (/\.(js|html|json|css|md)$/i.test(en.name) && !/package-lock|products\.json/i.test(en.name)) {
      acc.push(rel);
    }
  }
  return acc;
}

const files = [];
collect(path.join(root, 'js'), 'js', files);
collect(path.join(root, 'css'), 'css', files);
fs.readdirSync(root).forEach(f => {
  if (/\.[a-z]+$/i.test(f) && !/\.agents|node_modules/i.test(f)) files.push(f);
});

files.sort();
const inventory = ['```', ...files.map(f => `- ${f}`), '```'].join('\n');
const block = `${START}\n${inventory}\n${END}`;

let memory = '';
try { memory = fs.readFileSync(memoryPath, 'utf8'); } catch (e) {
  console.error('MEMORY.md not found:', e.message);
  process.exit(1);
}

const startIdx = memory.indexOf(START);
const endIdx = memory.indexOf(END);
if (startIdx === -1 || endIdx === -1) {
  console.error('Markers not found in MEMORY.md. Add them around the inventory block.');
  process.exit(1);
}
const endMarkerEnd = endIdx + END.length;
memory = memory.slice(0, startIdx) + block + memory.slice(endMarkerEnd);
fs.writeFileSync(memoryPath, memory, 'utf8');

const total = memory.length;
console.log(`Updated MEMORY.md inventory (${files.length} files, ${total} chars).`);
