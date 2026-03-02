import path from 'node:path';
import { promises as fs } from 'node:fs';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'data');
const PUBLIC_DATA_DIR = path.join(ROOT, 'public', 'data');

function parseArgs(argv) {
  const args = { srcDir: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--srcDir') {
      args.srcDir = argv[i + 1] ?? null;
      i++;
    } else if (a === '--help' || a === '-h') {
      args.help = true;
    }
  }
  return args;
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function listLatestBackupDir() {
  const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  const candidates = entries
    .filter((d) => d.isDirectory() && d.name.startsWith('uncompressed_chunks_backup_'))
    .map((d) => d.name)
    .sort();

  if (candidates.length === 0) return null;
  return path.join(DATA_DIR, candidates[candidates.length - 1]);
}

async function moveFile(from, to) {
  try {
    await fs.rename(from, to);
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 'EXDEV') {
      await fs.copyFile(from, to);
      await fs.unlink(from);
      return;
    }
    throw err;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log('Usage: node scripts/restore_uncompressed_chunks.js [--srcDir <path>]');
    console.log(
      'Restores uncompressed *.geojson chunk files from the newest data/uncompressed_chunks_backup_* folder back into public/data/.'
    );
    process.exit(0);
  }

  if (!(await pathExists(PUBLIC_DATA_DIR))) {
    await fs.mkdir(PUBLIC_DATA_DIR, { recursive: true });
  }

  const srcDir = args.srcDir ? path.resolve(ROOT, args.srcDir) : await listLatestBackupDir();
  if (!srcDir) {
    console.error('No backup folder found under data/ (expected data/uncompressed_chunks_backup_*).');
    process.exit(1);
  }

  if (!(await pathExists(srcDir))) {
    console.error(`Backup folder does not exist: ${srcDir}`);
    process.exit(1);
  }

  const existing = await fs.readdir(PUBLIC_DATA_DIR);
  const existingUncompressed = existing.filter((n) => /_chunk_\d{4}\.geojson$/.test(n));
  if (existingUncompressed.length > 0) {
    console.error(
      `public/data already contains ${existingUncompressed.length} uncompressed chunk(s). Move them out first to avoid mixing sets.`
    );
    process.exit(1);
  }

  const srcFiles = (await fs.readdir(srcDir)).filter(
    (n) => n.startsWith('Tucson_Police_Incidents_-_') && /_chunk_\d{4}\.geojson$/.test(n)
  );
  if (srcFiles.length === 0) {
    console.log(`No uncompressed chunk files found in: ${srcDir}`);
    process.exit(0);
  }

  let moved = 0;
  for (const file of srcFiles) {
    const from = path.join(srcDir, file);
    const to = path.join(PUBLIC_DATA_DIR, file);
    await moveFile(from, to);
    moved++;
  }

  console.log(`Restored ${moved} uncompressed chunk file(s) from:`);
  console.log(`  ${path.relative(ROOT, srcDir)}`);
  console.log('to:');
  console.log('  public/data/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
