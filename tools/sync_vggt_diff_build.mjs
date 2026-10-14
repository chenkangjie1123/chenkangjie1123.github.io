import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = dirname(fileURLToPath(import.meta.url));
const buildDir = resolve(toolsDir, '../../vggt-diff-architecture-site/dist/client');
const pageDir = resolve(toolsDir, '../VGGT-Diff');

if (!existsSync(join(buildDir, 'index.html'))) {
  throw new Error(`Missing built project page: ${buildDir}`);
}

const sitePaths = ['_next/', 'assets/', 'fonts/', 'favicon.svg', 'site.webmanifest', 'VGGT-Diff.pdf', 'robots.txt', 'sitemap.xml', '4k.html'];
const pathPattern = new RegExp(`(?<!/VGGT-Diff)/(?=${sitePaths.map((value) => value.replace('.', '\\.')).join('|')})`, 'g');

function syncText(relativePath) {
  const source = join(buildDir, relativePath);
  const target = join(pageDir, relativePath);
  const text = readFileSync(source, 'utf8').replace(pathPattern, '/VGGT-Diff/');
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
}

function syncDirectory(relativeDir) {
  for (const item of readdirSync(join(buildDir, relativeDir), { withFileTypes: true })) {
    const relativePath = join(relativeDir, item.name);
    if (item.isDirectory()) {
      syncDirectory(relativePath);
    } else if (/\.(?:js|css|html|rsc)$/.test(item.name)) {
      syncText(relativePath);
    } else {
      const target = join(pageDir, relativePath);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(buildDir, relativePath), target);
    }
  }
}

syncText('index.html');
syncText('index.rsc');
syncDirectory('_next');

const exportedHtml = readFileSync(join(pageDir, 'index.html'), 'utf8');
for (const expected of ['19.283', '17.217', '22.772', '100K + 6K']) {
  if (!exportedHtml.includes(expected)) throw new Error(`Missing updated result: ${expected}`);
}
if (exportedHtml.includes('/VGGT-Diff/VGGT-Diff/')) throw new Error('Duplicate project path prefix');

console.log(`Updated GitHub Pages build in ${pageDir}`);
