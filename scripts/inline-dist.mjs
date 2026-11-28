// Post-build step: fold every referenced CSS/JS chunk into its HTML page so each
// built page is fully self-contained. This keeps the site working everywhere the
// HTML can be opened: dev previews, file:// double-click, and static hosts that
// may not serve the sibling asset files. Run automatically after `vite build`.
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const asset = (href) => path.join(dist, href.replace(/^\.\//, ''));
const isModuleTag = (attrs) => /type\s*=\s*["']module["']/.test(attrs);
// Files whose contents we fold into a page become unreferenced and can be
// deleted afterwards. This set is the ONLY thing the prune step removes:
// runtime assets the tree fetches by building paths at runtime (models,
// textures, wasm, HDRIs) are never inlined, so they can never be pruned.
const inlinedAssets = new Set();

function chunkGraph(href, seen = new Map()) {
  if (seen.has(href)) return seen;
  const file = asset(href);
  if (!fs.existsSync(file)) return seen;
  const code = fs.readFileSync(file, 'utf8');
  seen.set(href, code);
  inlinedAssets.add(href.replace(/^\.\//, ''));
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
    if (!fs.existsSync(file2)) return match;
    inlinedAssets.add(href.replace(/^\.\//, ''));
    return `<style>\n${fs.readFileSync(file2, 'utf8')}\n</style>`;
  });

  html = html.replace(/<link\b[^>]*rel="modulepreload"[^>]*href="(\.\/assets\/[^"]+)"[^>]*>/g, (match, href) => {
    if (fs.existsSync(asset(href))) inlinedAssets.add(href.replace(/^\.\//, ''));
    return '';
  });

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

// Prune exactly the chunk/CSS files that were folded into the pages. Runtime
// assets (models, textures, HDRIs, wasm, anything a loader fetches later) are
// never touched — their references are built at runtime and cannot be trusted
// to a text scan.
for (const href of inlinedAssets) {
  const file = path.join(dist, href);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    fs.unlinkSync(file);
    console.log(`pruned inlined assets/${path.basename(href)}`);
  }
}
