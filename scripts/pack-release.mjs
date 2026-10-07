import { createWriteStream, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { Readable } from 'node:stream';

/**
 * Minimal zip (store + deflate) without external deps — CrazyGames wants a zip of dist/.
 * We pack dist/ into release/embervein.zip
 */

function walk(dir, base = dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, base, files);
    else files.push({ full, rel: relative(base, full).replaceAll('\\', '/'), size: st.size, mtime: st.mtime });
  }
  return files;
}

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  }
  return ~c >>> 0;
}

async function deflate(buf) {
  const gzip = createGzip({ level: 9 });
  // Use raw deflate via zlib by stripping gzip header — simpler: store uncompressed for tiny builds
  // Prefer compression with zlib deflateRaw
  const { deflateRawSync } = await import('node:zlib');
  return deflateRawSync(buf, { level: 9 });
}

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n, 0);
  return b;
}
function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
}

async function buildZip(files, outPath) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const data = await import('node:fs').then((fs) => fs.readFileSync(file.full));
    const nameBuf = Buffer.from(file.rel, 'utf8');
    const compressed = await deflate(data);
    const useStore = compressed.length >= data.length;
    const payload = useStore ? data : compressed;
    const method = useStore ? 0 : 8;
    const crc = crc32(data);
    const dosTime = 0;
    const dosDate = 0;

    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(method),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(payload.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      nameBuf,
      payload,
    ]);
    localParts.push(local);

    const central = Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(method),
      u16(dosTime),
      u16(dosDate),
      u32(crc),
      u32(payload.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBuf,
    ]);
    centralParts.push(central);
    offset += local.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  const zip = Buffer.concat([...localParts, centralDir, end]);
  writeFileSync(outPath, zip);
  return zip.length;
}

const dist = join(process.cwd(), 'dist');
if (!existsSync(dist)) {
  console.error('dist/ missing — run vite build first');
  process.exit(1);
}

const releaseDir = join(process.cwd(), 'release');
mkdirSync(releaseDir, { recursive: true });
const files = walk(dist);
const out = join(releaseDir, 'embervein.zip');
const size = await buildZip(files, out);

const totalBytes = files.reduce((a, f) => a + f.size, 0);
const report = {
  files: files.length,
  distBytes: totalBytes,
  zipBytes: size,
  zipMB: +(size / (1024 * 1024)).toFixed(2),
  distMB: +(totalBytes / (1024 * 1024)).toFixed(2),
  withinBudget: size <= 18 * 1024 * 1024 && files.length <= 1500,
};
writeFileSync(join(releaseDir, 'build-report.json'), JSON.stringify(report, null, 2));
console.log(`Packed ${files.length} files → ${out} (${report.zipMB} MB)`);
