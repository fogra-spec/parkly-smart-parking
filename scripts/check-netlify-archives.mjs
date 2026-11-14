import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';

const directory = new URL('../.netlify/parkly-functions/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', directory), 'utf8'));
assert.deepEqual(manifest.functions.map(item => item.name).sort(), ['parking-reminders', 'parkly-api']);
let entries = 0;
for (const item of manifest.functions) {
  const zip = await readFile(new URL(item.name + '.zip', directory));
  // Read the central directory rather than trusting filename-like strings in
  // compressed data. ZIP64/encrypted archives fail closed for manual review.
  let end = zip.length - 22;
  while (end >= Math.max(0, zip.length - 65557) && zip.readUInt32LE(end) !== 0x06054b50) end--;
  assert.ok(end >= 0, 'ZIP directory missing.');
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  assert.notEqual(count, 65535, 'ZIP64 needs explicit review.');
  for (let index = 0; index < count; index++) {
    assert.equal(zip.readUInt32LE(offset), 0x02014b50);
    const flags = zip.readUInt16LE(offset + 8), method = zip.readUInt16LE(offset + 10);
    const size = zip.readUInt32LE(offset + 20), unpacked = zip.readUInt32LE(offset + 24);
    const nameLength = zip.readUInt16LE(offset + 28), extraLength = zip.readUInt16LE(offset + 30), commentLength = zip.readUInt16LE(offset + 32);
    const local = zip.readUInt32LE(offset + 42);
    const name = zip.subarray(offset + 46, offset + 46 + nameLength).toString('utf8').replaceAll('\\', '/');
    assert.ok(!/(?:^|\/)(?:\.local|\.sites-runtime|\.wrangler|\.git)(?:\/|$)|(?:^|\/)\.env(?:\.|$)|(?:^|\/)(?:push-keys|fixture-accounts|runtime)\.json$/.test(name), 'Private file found in function archive: ' + name);
    assert.equal(flags & 1, 0, 'Encrypted archives cannot be inspected.');
    assert.ok(unpacked <= 10000000, 'Unexpectedly large function file.');
    assert.equal(zip.readUInt32LE(local), 0x04034b50);
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const data = zip.subarray(start, start + size);
    assert.ok([0, 8].includes(method), 'Unsupported ZIP compression.');
    const content = method === 8 ? inflateRawSync(data, { maxOutputLength: 10000000 }) : data;
    assert.equal(content.length, unpacked, 'Incomplete ZIP contents.');
    offset += 46 + nameLength + extraLength + commentLength;
    entries++;
  }
}
console.log(`PASS: ${manifest.functions.length} Netlify function archives, ${entries} entries; private local runtime, keys and environment files excluded.`);
