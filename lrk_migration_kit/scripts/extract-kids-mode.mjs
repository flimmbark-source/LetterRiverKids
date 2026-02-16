#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const exts = ['.tsx', '.ts', '.jsx', '.js', '.css', '.json'];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) out[key] = true;
      else {
        out[key] = next;
        i++;
      }
    }
  }
  return out;
}

const args = parseArgs(process.argv);
const srcRoot = path.resolve(args.src || process.cwd());
const outRoot = path.resolve(args.out || path.join(process.cwd(), '..', 'LetterRiverKids'));
const dryRun = Boolean(args['dry-run']);
const userEntry = args.entry ? path.resolve(srcRoot, args.entry) : null;

const requiredRootFiles = [
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'index.html',
  'vite.config.js',
  'vite.config.ts',
  'tailwind.config.js',
  'tailwind.config.ts',
  'postcss.config.js',
  'postcss.config.cjs',
  '.gitignore',
  'README.md',
];

const keywordBoost = [
  'letter', 'learn', 'learning', 'association', 'bucket', 'phon', 'sound', 'alphabet',
  'achievement', 'reward', 'tts', 'speech', 'accessibility', 'settings', 'profile', 'mode'
];

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function walk(dir) {
  const out = [];
  if (!exists(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const d of fs.readdirSync(cur, { withFileTypes: true })) {
      if (d.name === 'node_modules' || d.name === '.git' || d.name === 'dist' || d.name === 'build') continue;
      const full = path.join(cur, d.name);
      if (d.isDirectory()) stack.push(full);
      else out.push(full);
    }
  }
  return out;
}

function isCodeFile(file) {
  return exts.some((e) => file.endsWith(e));
}

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function parseImports(code) {
  const found = new Set();
  const patterns = [
    /import\s+(?:[^'";]+?\s+from\s+)?["']([^"']+)["']/g,
    /export\s+\*\s+from\s+["']([^"']+)["']/g,
    /export\s+\{[^}]*\}\s+from\s+["']([^"']+)["']/g,
    /import\(\s*["']([^"']+)["']\s*\)/g,
    /require\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code))) found.add(m[1]);
  }
  return [...found];
}

function resolveImport(fromFile, imp, srcRoot) {
  if (!imp.startsWith('.')) return null;
  const fromDir = path.dirname(fromFile);
  const base = path.resolve(fromDir, imp);

  const candidates = [];
  if (path.extname(base)) candidates.push(base);
  else {
    for (const e of exts) candidates.push(base + e);
    for (const e of exts) candidates.push(path.join(base, 'index' + e));
  }

  for (const c of candidates) {
    if (exists(c) && c.startsWith(srcRoot)) return c;
  }
  return null;
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function rel(p) {
  return path.relative(srcRoot, p).replaceAll(path.sep, '/');
}

function scoreCandidate(file, code) {
  const r = rel(file).toLowerCase();
  let score = 0;
  for (const k of keywordBoost) {
    if (r.includes(k)) score += 4;
    if (code.toLowerCase().includes(k)) score += 1;
  }
  if (r.includes('/views/') || r.includes('/pages/')) score += 3;
  if (r.includes('/components/')) score += 2;
  if (r.includes('/game/')) score += 2;
  if (r.includes('/data/')) score += 1;
  if (r.includes('/services/')) score += 1;
  if (/letter|learn|association|bucket|phon|sound/.test(path.basename(r))) score += 6;
  return score;
}

function discoverEntrypoints(srcRoot) {
  const srcDir = path.join(srcRoot, 'src');
  const files = walk(srcDir).filter((f) => isCodeFile(f) && !f.endsWith('.d.ts'));
  const scored = files
    .map((f) => ({ file: f, code: read(f) }))
    .map((x) => ({ file: x.file, score: scoreCandidate(x.file, x.code) }))
    .filter((x) => x.score >= 8)
    .sort((a, b) => b.score - a.score);

  const unique = [];
  const seenBase = new Set();
  for (const s of scored) {
    const base = path.basename(s.file).toLowerCase();
    if (seenBase.has(base)) continue;
    seenBase.add(base);
    unique.push(s.file);
    if (unique.length >= 8) break;
  }
  return unique;
}

function gatherDependencyClosure(entryFiles) {
  const queue = [...entryFiles];
  const visited = new Set();

  while (queue.length) {
    const f = queue.pop();
    if (!f || visited.has(f)) continue;
    if (!exists(f)) continue;
    visited.add(f);
    const code = read(f);
    const imports = parseImports(code);
    for (const imp of imports) {
      const resolved = resolveImport(f, imp, srcRoot);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }

  return visited;
}

function includeKeywordFiles(currentSet) {
  const srcDir = path.join(srcRoot, 'src');
  const files = walk(srcDir).filter((f) => isCodeFile(f));
  const extra = [];
  for (const f of files) {
    const r = rel(f).toLowerCase();
    if (currentSet.has(f)) continue;
    if (
      r.includes('soundassociation') ||
      r.includes('/tts') ||
      r.includes('speech') ||
      r.includes('accessib') ||
      r.includes('setting') ||
      r.includes('achievement') ||
      r.includes('profile') ||
      r.includes('language') ||
      r.includes('letter')
    ) {
      extra.push(f);
    }
  }
  return extra;
}

function hashFile(file) {
  const buf = fs.readFileSync(file);
  return crypto.createHash('sha1').update(buf).digest('hex').slice(0, 10);
}

function ensureCleanOut() {
  if (!exists(outRoot)) return;
  const marker = path.join(outRoot, '.kids-repo-generated');
  if (exists(marker)) {
    fs.rmSync(outRoot, { recursive: true, force: true });
    return;
  }
  console.error(`\nRefusing to overwrite existing directory without marker: ${outRoot}`);
  console.error('Move/delete that folder or pass a new --out path.');
  process.exit(1);
}

function writeReport({ entries, allFiles, copiedRootFiles, copiedPublic }) {
  const reportPath = path.join(outRoot, 'MIGRATION_REPORT.md');
  const lines = [];
  lines.push('# Letter River Kids Extraction Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('## Selected entry file(s)');
  for (const e of entries) lines.push(`- \`${rel(e)}\``);
  lines.push('');
  lines.push('## Copied root/build files');
  for (const f of copiedRootFiles) lines.push(`- \`${f}\``);
  if (copiedPublic) lines.push('- `public/**`');
  lines.push('');
  lines.push('## Copied source files');
  for (const f of [...allFiles].sort((a, b) => rel(a).localeCompare(rel(b)))) {
    lines.push(`- \`${rel(f)}\` (sha:${hashFile(f)})`);
  }
  lines.push('');
  lines.push('## Next steps');
  lines.push('- Rename app title and package name to Letter River Kids.');
  lines.push('- Replace adult achievements with icon/audio based rewards.');
  lines.push('- Set association mode as default for pre-readers.');
  lines.push('- Add parent-only settings gate and child-safe telemetry.');
  lines.push('');
  fs.writeFileSync(reportPath, lines.join('\n'));
}

function writeKidsTodos() {
  const p = path.join(outRoot, 'KIDS_REFACTOR_TODO.md');
  const txt = `# Kids Refactor TODO\n\n## Must-do product changes\n- [ ] Default to audio-first, pre-reader flow\n- [ ] Association mode as primary loop\n- [ ] Remove text-heavy achievements\n- [ ] Add visual collection rewards\n- [ ] Add accessibility presets (motor/sensory/cognitive)\n- [ ] Add caregiver mode with parent gate\n\n## Engineering tasks\n- [ ] Create routes: /kids, /kids/parent\n- [ ] Add feature flags for KidsMode\n- [ ] Build adaptive hint engine\n- [ ] Add mastery scheduler (spaced review)\n- [ ] Add analytics events for learning outcomes\n`;
  fs.writeFileSync(p, txt);
}

function main() {
  const srcDir = path.join(srcRoot, 'src');
  if (!exists(srcDir)) {
    console.error(`No src directory found at: ${srcDir}`);
    process.exit(1);
  }

  const discovered = discoverEntrypoints(srcRoot);
  const entries = [];

  if (userEntry) {
    if (!exists(userEntry)) {
      console.error(`--entry not found: ${userEntry}`);
      process.exit(1);
    }
    entries.push(userEntry);
  } else if (discovered.length) {
    entries.push(discovered[0]);
  }

  if (!entries.length) {
    console.error('Could not auto-discover a letter-learning entry file.');
    console.error('Run again with --entry, e.g.:');
    console.error('  node scripts/extract-kids-mode.mjs --src . --entry src/views/LetterLearningView.jsx --out ../LetterRiverKids');
    process.exit(1);
  }

  const deps = gatherDependencyClosure(entries);
  const extras = includeKeywordFiles(deps);
  for (const f of extras) deps.add(f);

  const copiedRootFiles = requiredRootFiles.filter((f) => exists(path.join(srcRoot, f)));
  const hasPublic = exists(path.join(srcRoot, 'public'));

  console.log('\n=== Letter River Kids Extract ===');
  console.log(`Source: ${srcRoot}`);
  console.log(`Output: ${outRoot}`);
  console.log(`Entry:  ${entries.map((e) => rel(e)).join(', ')}`);
  console.log(`Files:  ${deps.size} source files`);
  console.log(`Mode:   ${dryRun ? 'dry-run' : 'write'}`);

  if (dryRun) {
    console.log('\nTop auto-discovered entry candidates:');
    for (const c of discovered.slice(0, 8)) console.log(`- ${rel(c)}`);

    console.log('\nSource files to copy:');
    for (const f of [...deps].sort((a, b) => rel(a).localeCompare(rel(b)))) {
      console.log(`- ${rel(f)}`);
    }
    process.exit(0);
  }

  ensureCleanOut();
  fs.mkdirSync(outRoot, { recursive: true });
  fs.writeFileSync(path.join(outRoot, '.kids-repo-generated'), 'generated by extract-kids-mode.mjs\n');

  for (const f of copiedRootFiles) {
    copyFile(path.join(srcRoot, f), path.join(outRoot, f));
  }

  if (hasPublic) {
    const publicFiles = walk(path.join(srcRoot, 'public'));
    for (const pf of publicFiles) {
      copyFile(pf, path.join(outRoot, path.relative(srcRoot, pf)));
    }
  }

  for (const f of deps) {
    copyFile(f, path.join(outRoot, path.relative(srcRoot, f)));
  }

  writeReport({
    entries,
    allFiles: deps,
    copiedRootFiles,
    copiedPublic: hasPublic,
  });
  writeKidsTodos();

  console.log('\nDone. Created Letter River Kids repo scaffold.');
  console.log(`Open: ${outRoot}`);
  console.log('Read: MIGRATION_REPORT.md and KIDS_REFACTOR_TODO.md');
}

main();
