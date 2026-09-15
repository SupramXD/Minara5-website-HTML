// Studio Extrait - Mirror the Firestore `products` collection into products.json (+ images)
//
//   node tools/pull-firestore-to-repo.js           # write products.json + any new images
//   node tools/pull-firestore-to-repo.js --check   # report what WOULD change, write nothing
//
// WHY THIS EXISTS
// ---------------
// The normal path is admin panel -> Firestore -> `syncToGithub` Cloud Function -> GitHub.
// That function (Cloud Functions v2 / Cloud Run) needs the project to have billing enabled
// (see MEMORY.md); when it is unavailable nothing reaches the static products.json and the
// storefront keeps showing old values.
//
// The Firestore `products` collection is world-readable (`firestore.rules`:
// `match /products/{productId} { allow read: if true }`), so this script can rebuild
// products.json straight from Firestore - from a laptop or from GitHub Actions
// (.github/workflows/sync-firestore-products.yml) - with no token and no Cloud Functions.
//
// The mapping/ordering intentionally mirrors the `saveProduct` branch of
// functions/index.js so both paths produce identical products.json files.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const CHECK = process.argv.includes('--check');
const WRITE = !CHECK;
const PRODUCTS_JSON = path.join(root, 'products.json');

function firebaseConfig() {
  const src = fs.readFileSync(path.join(root, 'js', 'admin', 'admin-auth.js'), 'utf8');
  const key = (src.match(/apiKey:\s*"([^"]+)"/) || [])[1];
  const project = (src.match(/projectId:\s*"([^"]+)"/) || [])[1];
  if (!key || !project) throw new Error('Could not read apiKey/projectId from js/admin/admin-auth.js');
  return {key, project};
}

function decodeValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  return null;
}

function decodeFields(fields) {
  const out = {};
  for (const k of Object.keys(fields || {})) out[k] = decodeValue(fields[k]);
  return out;
}

async function fetchProducts({key, project}) {
  const docs = [];
  let pageToken = '';
  do {
    const url = 'https://firestore.googleapis.com/v1/projects/' + project +
      '/databases/(default)/documents/products?pageSize=300&key=' + key +
      (pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : '');
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error('Firestore read failed: HTTP ' + res.status + ' - ' + (await res.text()).slice(0, 300));
    }
    const json = await res.json();
    (json.documents || []).forEach((d) => {
      docs.push({id: d.name.split('/').pop(), data: decodeFields(d.fields || {})});
    });
    pageToken = json.nextPageToken || '';
  } while (pageToken);
  return docs;
}

const imageChanges = [];

// Writes a `data:image/...;base64,...` value out as a real file and returns its repo path.
// Values that are already a path are returned untouched.
function materializeImage(value, targetBasePath) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || !raw.startsWith('data:image/')) return raw;
  const parts = raw.split(';base64,');
  const mime = parts[0].replace(/^data:/, '');
  const ext = mime.split('/')[1] || 'webp';
  const repoPath = targetBasePath + '.' + ext;
  const buffer = Buffer.from(parts[1] || '', 'base64');
  const abs = path.join(root, repoPath);
  const existing = fs.existsSync(abs) ? fs.readFileSync(abs) : null;
  if (!existing || !existing.equals(buffer)) {
    imageChanges.push({repoPath, bytes: buffer.length, created: !existing});
  }
  if (WRITE) {
    fs.mkdirSync(path.dirname(abs), {recursive: true});
    if (!existing || !existing.equals(buffer)) fs.writeFileSync(abs, buffer);
  }
  return repoPath;
}

// The Firestore REST API returns map fields in storage order, which differs from the
// order the admin panel/Cloud Function write. Rebuilding scentProfile in the canonical
// order keeps products.json from churning on every sync run.
function normalizeScentProfile(sp) {
  if (sp === undefined || sp === null || typeof sp !== 'object' || Array.isArray(sp)) return sp === undefined ? null : sp;
  const order = ['keyNotes', 'topNotes', 'topNotesDesc', 'middleNotes', 'middleNotesDesc', 'baseNotes', 'baseNotesDesc'];
  const out = {};
  order.forEach((k) => {
    if (sp[k] !== undefined) out[k] = sp[k];
    else out[k] = (k === 'keyNotes') ? [] : '';
  });
  // Note objects come back from Firestore with varying key order - normalise to {name, icon}.
  if (Array.isArray(out.keyNotes)) {
    out.keyNotes = out.keyNotes.map((n) => {
      if (!n || typeof n !== 'object' || Array.isArray(n)) return n;
      const note = {};
      if (n.name !== undefined) note.name = n.name;
      if (n.icon !== undefined) note.icon = n.icon;
      Object.keys(n).forEach((k) => { if (!(k in note)) note[k] = n[k]; });
      return note;
    });
  }
  Object.keys(sp).forEach((k) => { if (!(k in out)) out[k] = sp[k]; });
  return out;
}

function toProduct({id, data}) {
  const imageEntries = String(data.image || '').split(',').map((s) => s.trim()).filter(Boolean);
  const mainImage = materializeImage(imageEntries[0] || '', 'images/products/' + id);
  const gallerySource = (Array.isArray(data.galleryImages) && data.galleryImages.length)
    ? data.galleryImages
    : imageEntries.slice(1);
  const galleryImages = gallerySource
      .map((g, i) => materializeImage(g, 'images/products/' + id + '_gallery_' + (i + 1)))
      .filter(Boolean);
  const image = (imageEntries.length > 1 && galleryImages.length)
    ? [mainImage, ...galleryImages].join(', ')
    : mainImage;

  const customisations = Array.isArray(data.customisations) ? data.customisations.map((c, idx) => {
    let blockImg = String(c.image || '');
    let blockThumb = c.image_thumb ? String(c.image_thumb) : '';
    if (blockImg.startsWith('data:image/')) {
      blockImg = materializeImage(blockImg, 'images/products/' + id + '_cust_' + idx);
      blockThumb = blockImg;
    } else if (blockThumb.startsWith('data:image/')) {
      blockThumb = materializeImage(blockThumb, 'images/products/' + id + '_cust_' + idx + '_thumb');
    }
    // Same expression as the Cloud Function: keep the raw data-url payload as image_data.
    const rawData = (typeof c.image === 'string' && c.image.startsWith('data:image/'))
      ? c.image
      : (typeof c.image_data === 'string' ? c.image_data : '');

    const block = {
      label: c.label || 'OPTION ' + (idx + 1),
      size: c.size || '',
      image: blockImg,
      image_thumb: blockThumb || blockImg,
      image_data: rawData,
      stock: (c.stock !== undefined && c.stock !== null && !isNaN(c.stock)) ? Number(c.stock) : 10,
    };
    if (c.price !== undefined && c.price !== null && c.price !== '') block.price = Number(c.price);
    if (c.priceExtra !== undefined && c.priceExtra !== null) block.priceExtra = Number(c.priceExtra);
    return block;
  }) : [];

  return {
    id,
    nameShort: data.nameShort || '',
    name: data.name,
    price: Number(data.price),
    retailPrice: (data.retailPrice !== null && data.retailPrice !== undefined) ? data.retailPrice : null,
    stock: Number(data.stock),
    image,
    galleryImages: galleryImages.length ? galleryImages : (image ? [image] : []),
    image_thumb: materializeImage(data.image_thumb || '', 'images/products/' + id + '_thumb'),
    description: data.description || '',
    status: data.status || 'Active',
    flair: data.flair || '',
    flairText: data.flairText || '',
    flairColor: data.flairColor || '',
    invisibleFlair: data.invisibleFlair || '',
    standardBottleImg: materializeImage(data.standardBottleImg || '', 'images/products/' + id + '_std'),
    masculinePremiumBottleImg: materializeImage(data.masculinePremiumBottleImg || '', 'images/products/' + id + '_premium'),
    femininePremiumBottleImg: materializeImage(data.femininePremiumBottleImg || '', 'images/products/' + id + '_fem_premium'),
    customisations,
    sizes: Array.isArray(data.sizes) ? data.sizes : ['50ml', '100ml'],
    isBundle: data.isBundle !== undefined ? !!data.isBundle : false,
    bundleSize: data.bundleSize !== undefined ? Number(data.bundleSize) : 0,
    sortOrder: (data.sortOrder !== undefined && data.sortOrder !== null) ? Number(data.sortOrder) : null,
    scentProfile: normalizeScentProfile(data.scentProfile),
  };
}

// Active products first (ordered by sortOrder, then name) renumbered 1..n, then the
// inactive ones with sortOrder null - identical to the Cloud Function.
function orderProducts(products) {
  const bySortOrder = (a, b) => {
    const va = (a.sortOrder === null || a.sortOrder === undefined) ? Infinity : Number(a.sortOrder);
    const vb = (b.sortOrder === null || b.sortOrder === undefined) ? Infinity : Number(b.sortOrder);
    if (va !== vb) return va - vb;
    return String(a.name || '').localeCompare(String(b.name || ''));
  };
  const active = products.filter((p) => p.status === 'Active').sort(bySortOrder);
  active.forEach((p, i) => { p.sortOrder = i + 1; });
  const inactive = products.filter((p) => p.status !== 'Active');
  inactive.forEach((p) => { p.sortOrder = null; });
  return [...active, ...inactive];
}

function reportDiff(before, after) {
  const beforeById = {};
  before.forEach((p) => { beforeById[p.id] = p; });
  let changes = 0;
  const show = (v) => (String(v).length > 90 ? String(v).slice(0, 90) + '...' : String(v));
  after.forEach((p) => {
    const old = beforeById[p.id];
    if (!old) {
      changes++;
      console.log('  + ' + p.id + ' (new product)');
      return;
    }
    const fields = new Set([...Object.keys(old), ...Object.keys(p)]);
    fields.forEach((f) => {
      const a = JSON.stringify(old[f]);
      const b = JSON.stringify(p[f]);
      if (a !== b) {
        changes++;
        console.log('  ~ ' + p.id + '.' + f + ': ' + show(a) + ' -> ' + show(b));
      }
    });
  });
  const afterIds = new Set(after.map((p) => p.id));
  before.forEach((p) => {
    if (!afterIds.has(p.id)) {
      changes++;
      console.log('  - ' + p.id + ' (would be REMOVED - no longer in Firestore)');
    }
  });
  return changes;
}

(async () => {
  const cfg = firebaseConfig();
  const docs = await fetchProducts(cfg);
  if (!docs.length) {
    console.error('Firestore returned 0 products - refusing to touch products.json.');
    process.exit(1);
  }
  const next = orderProducts(docs.map(toProduct));
  const currentJson = fs.existsSync(PRODUCTS_JSON) ? fs.readFileSync(PRODUCTS_JSON, 'utf8') : '';
  let current = [];
  try { current = JSON.parse(currentJson); } catch (e) { /* keep empty */ }

  console.log((CHECK ? 'Checking' : 'Mirroring') + ' ' + next.length +
    ' product(s) from Firestore (project ' + cfg.project + ')...\n');
  const changes = reportDiff(current, next);

  if (imageChanges.length) {
    console.log('\nImage files needing an update (' + imageChanges.length + '):');
    imageChanges.forEach((c) => {
      console.log('  ' + (c.created ? '+' : '~') + ' ' + c.repoPath + ' (' + Math.round(c.bytes / 1024) + ' KB)');
    });
  }

  if (!changes && !imageChanges.length) {
    console.log('\nAlready in sync - nothing to do.');
    process.exit(0);
  }

  if (CHECK) {
    console.log('\n--check: ' + changes + ' field change(s), ' + imageChanges.length +
      ' image file(s) would change. Nothing was written.');
    process.exit(0);
  }

  fs.writeFileSync(PRODUCTS_JSON, JSON.stringify(next, null, 2), 'utf8');
  console.log('\nproducts.json updated (' + changes + ' field change(s), ' +
    imageChanges.length + ' image file(s)).');
  console.log('Publish it:  git add -A && git commit -m "Sync products from Firestore" && git push');
  console.log('             firebase deploy --only hosting --project ' + cfg.project);
})();
