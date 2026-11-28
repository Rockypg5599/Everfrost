// Post-build step: fold every referenced CSS/JS chunk into its HTML page so each
// built page is fully self-contained. This keeps the site working everywhere the
// HTML can be opened: dev previews, file:// double-click, and static hosts that
// may not serve the sibling asset files. Run automatically after `vite build`.
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const asset = (href) => path.join(dist, href.replace(/^\.\//, ''));
const isModuleTag = (attrs) => /type\s*=\s*["']module["']/.test(attrs);

function chunkGraph(href, seen = new Map()) {
  if (seen.has(href)) return seen;
  const file = asset(href);
  if (!fs.existsSync(file)) return seen;
  const code = fs.readFileSync(file, 'utf8');
  seen.set(href, code);
  for (const match of code.matchAll(/(?:import|from)\s*["'](\.\/[^"']+\.js)["']/g)) {
    chunkGraph(path.posix.join(path.posix.dirname(href), match[1]), seen);
  }
  return seen;
}

// Emit dependencies before their importer, dropping the import statements.
function bundleChunks(entryHref) {
  const graph = chunkGraph(entryHref);
  const emitted = [];
  const visiting = new Set();
  function visit(href) {
    if (emitted.includes(href) || visiting.has(href) || !graph.has(href)) return;
    visiting.add(href);
    for (const match of graph.get(href).matchAll(/(?:import|from)\s*["'](\.\/[^"']+\.js)["']/g)) {
      visit(path.posix.join(path.posix.dirname(href), match[1]));
    }
    visiting.delete(href);
    emitted.push(href);
  }
  visit(entryHref);
  return emitted.map((href) => graph.get(href).replace(/(?:^|\n)(?:import|from)\s*["']\.\/[^"']+\.js["'];?/g, '\n')).join('\n');
}

for (const file of fs.readdirSync(dist).filter((f) => f.endsWith('.html'))) {
  const filePath = path.join(dist, file);
  let html = fs.readFileSync(filePath, 'utf8');
  const original = html;

  html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*href="(\.\/assets\/[^"]+)"[^>]*>/g, (match, href) => {
    const file2 = asset(href);
    return fs.existsSync(file2) ? `<style>\n${fs.readFileSync(file2, 'utf8')}\n</style>` : match;
  });

  html = html.replace(/<link\b[^>]*rel="modulepreload"[^>]*href="(\.\/assets\/[^"]+)"[^>]*>/g, '');

  html = html.replace(/<script\b([^>]*)\bsrc="(\.\/assets\/[^"]+\.js)"([^>]*)><\/script>/g, (match, before, href, after) => {
    const attrs = before + after;
    if (!isModuleTag(attrs)) return match;
    const file2 = asset(href);
    if (!fs.existsSync(file2)) return match;
    return `<script type="module">\n${bundleChunks(href)}\n</script>`;
  });

  if (html !== original) {
    fs.writeFileSync(filePath, html);
    console.log(`inlined ${file} -> ${(html.length / 1024).toFixed(1)} kB`);
  } else {
    console.log(`no local assets to inline in ${file}`);
  }
}

// GitHub Pages runs Jekyll unless this marker is present; Jekyll would skip or
// mangle generated assets for no benefit here.
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
