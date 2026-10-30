// Pack the Playfair Display cuts to WOFF and inject them into label-concepts.html.
// Usage: node fonts/embed-playfair.mjs
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

const HERE = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname)).replace(/^\/([A-Za-z]:)/, "$1");
const ROOT = path.resolve(HERE, "..");
const PAGE = path.join(ROOT, "label-concepts.html");

const U32 = (b, o) => b.readUInt32BE(o);
const U16 = (b, o) => b.readUInt16BE(o);

function toWoff(ttfPath) {
  const b = fs.readFileSync(ttfPath);
  const flavor = U32(b, 0);
  const num = U16(b, 4);
  const tables = [];
  for (let i = 0; i < num; i++) {
    const o = 12 + i * 16;
    const tag = b.toString("ascii", o, o + 4);
    const chk = U32(b, o + 4);
    const off = U32(b, o + 8);
    const len = U32(b, o + 12);
    tables.push({ tag, chk, data: b.subarray(off, off + len) });
  }
  const dir = 44 + num * 20;
  let cursor = dir;
  const packed = tables.map(t => {
    const comp = zlib.deflateSync(t.data, { level: 9 });
    const use = comp.length < t.data.length ? comp : t.data;
    const rec = { tag: t.tag, chk: t.chk, orig: t.data.length, comp: use.length, data: use, offset: cursor };
    cursor += use.length + ((4 - (use.length % 4)) % 4);
    return rec;
  });
  const total = cursor;
  const out = Buffer.alloc(total);
  out.write("wOFF", 0, "ascii");
  out.writeUInt32BE(flavor, 4);
  out.writeUInt32BE(total, 8);
  out.writeUInt16BE(num, 12);
  out.writeUInt16BE(0, 14);
  out.writeUInt32BE(b.length, 16);            // totalSfntSize: the original, uncompressed font
  out.writeUInt16BE(1, 20); out.writeUInt16BE(0, 22);   // version 1.0
  out.writeUInt32BE(0, 24); out.writeUInt32BE(0, 28); out.writeUInt32BE(0, 32);   // no metadata
  out.writeUInt32BE(0, 36); out.writeUInt32BE(0, 40);                             // no private data
  packed.forEach((t, i) => {
    const o = 44 + i * 20;
    out.write(t.tag, o, "ascii");
    out.writeUInt32BE(t.offset, o + 4);
    out.writeUInt32BE(t.comp, o + 8);
    out.writeUInt32BE(t.orig, o + 12);
    out.writeUInt32BE(t.chk, o + 16);
    t.data.copy(out, t.offset);
  });
  return { woff: out, num, tables: packed };
}

function verify(woff, num, tables) {
  if (woff.toString("ascii", 0, 4) !== "wOFF") throw new Error("bad signature");
  const total = U32(woff, 8);
  if (total !== woff.length) throw new Error("bad length");
  if (U16(woff, 12) !== num) throw new Error("bad numTables");
  for (let i = 0; i < num; i++) {
    const o = 44 + i * 20;
    const t = tables[i];
    if (woff.toString("ascii", o, o + 4) !== t.tag) throw new Error("bad tag " + i);
    if (U32(woff, o + 8) !== t.comp) throw new Error("bad compLength " + t.tag);
    if (U32(woff, o + 12) !== t.orig) throw new Error("bad origLength " + t.tag);
    const raw = woff.subarray(U32(woff, o + 4), U32(woff, o + 4) + t.comp);
    const back = U32(woff, o + 8) === U32(woff, o + 12) ? raw : zlib.inflateSync(raw);
    if (back.length !== U32(woff, o + 12)) throw new Error("round-trip length " + t.tag);
  }
  return true;
}

let page = fs.readFileSync(PAGE, "utf8");
for (const [marker, file] of [["@@PLAYFAIR400@@", "PlayfairDisplay-Regular.ttf"], ["@@PLAYFAIR700@@", "PlayfairDisplay-Bold.ttf"]]) {
  const ttf = path.join(ROOT, "fonts", file);
  const { woff, num, tables } = toWoff(ttf);
  verify(woff, num, tables);
  const b64 = woff.toString("base64");
  const needle = `EMBED_FONTS.PlayfairDisplay${marker.includes("400") ? "400" : "700"}="${marker}"`;
  if (!page.includes(needle)) {
    const re = new RegExp(`EMBED_FONTS\\.PlayfairDisplay${marker.includes("400") ? "400" : "700"}="[^"]*"`);
    if (!re.test(page)) throw new Error("marker line not found for " + marker);
    page = page.replace(re, `EMBED_FONTS.PlayfairDisplay${marker.includes("400") ? "400" : "700"}="${b64}"`);
  } else {
    page = page.replace(needle, needle.replace(marker, b64));
  }
  console.log(`${file}: ${(fs.statSync(ttf).size / 1024).toFixed(1)} KB ttf -> ${(woff.length / 1024).toFixed(1)} KB woff -> ${(b64.length / 1024).toFixed(1)} KB base64`);
}
fs.writeFileSync(PAGE, page);
console.log("label-concepts.html updated (" + (fs.statSync(PAGE).size / 1024 / 1024).toFixed(2) + " MB)");
