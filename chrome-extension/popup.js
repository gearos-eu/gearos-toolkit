// GearOS Extension popup — license, listing display, PDF generation

const API_BASE = 'https://gearos-license-api.rybarsky.workers.dev';

let CURRENT_LICENSE = null;
let CURRENT_LISTING = null;
let DEALER_LOGO_DATAURL = null;
let COMPANY = {
  name: 'AutoTest s.r.o.',
  owner: 'Peter Novák',
  email: 'info@autotest.sk',
  phone: '+421 900 123 456',
  city: 'Košice, Slovensko',
};

// ─── INIT ──────────────────────────────────────────────────────────────────

init();

async function init() {
  // Wire up event listeners (MV3 CSP blocks inline onclick)
  document.getElementById('btn-save-license')?.addEventListener('click', saveLicense);
  document.getElementById('btn-change-license')?.addEventListener('click', changeLicense);
  document.getElementById('generate-btn')?.addEventListener('click', generatePDF);
  document.getElementById('margin')?.addEventListener('input', recalcPrice);

  // Format license input as user types
  const li = document.getElementById('license-input');
  li.addEventListener('input', () => {
    let v = li.value.replace(/[^A-Z0-9]/gi,'').toUpperCase().substring(0,16);
    let out = '';
    for (let i = 0; i < v.length; i++) {
      if (i === 4 || i === 8 || i === 12) out += '-';
      out += v[i];
    }
    li.value = out;
  });
  li.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveLicense();
  });

  // Load saved license
  const stored = await chrome.storage.local.get(['license', 'pendingListing', 'company']);
  if (stored.company) Object.assign(COMPANY, stored.company);

  if (stored.license) {
    CURRENT_LICENSE = stored.license;
    showLicensed();
  } else {
    showLoginForm();
    return;
  }

  // If content script populated a listing, show it
  if (stored.pendingListing) {
    CURRENT_LISTING = stored.pendingListing;
    showListing(CURRENT_LISTING);
  } else {
    document.getElementById('no-data').style.display = 'block';
    document.getElementById('with-data').style.display = 'none';
  }

  // Async load dealer logo
  loadDealerLogo(CURRENT_LICENSE.key).then(logo => {
    if (logo) DEALER_LOGO_DATAURL = logo.dataUrl;
  });
}

// ─── LICENSE ───────────────────────────────────────────────────────────────

async function saveLicense() {
  const key = document.getElementById('license-input').value.trim().toUpperCase();
  const status = document.getElementById('license-status');
  status.textContent = 'Overujem...';
  status.className = 'status';

  try {
    const res = await fetch(`${API_BASE}/license?key=${encodeURIComponent(key)}`);
    const data = await res.json();
    if (data.valid) {
      CURRENT_LICENSE = { key, ...data };
      await chrome.storage.local.set({ license: CURRENT_LICENSE });
      showLicensed();
      init();  // reload
    } else {
      status.textContent = data.reason === 'not_found' ? 'Kľúč nenájdený' :
                           data.reason === 'invalid_format' ? 'Zlý formát' :
                           data.reason === 'expired' ? 'Licencia expirovala' : 'Neplatný kľúč';
      status.className = 'status err';
    }
  } catch (e) {
    status.textContent = 'Chyba spojenia: ' + e.message;
    status.className = 'status err';
  }
}

function showLicensed() {
  document.getElementById('no-license').style.display = 'none';
  document.getElementById('main').style.display = 'block';
  document.getElementById('license-key').textContent = CURRENT_LICENSE.key;
  if (CURRENT_LICENSE.tier) {
    const t = document.getElementById('license-tier');
    t.textContent = CURRENT_LICENSE.tier;
    t.style.display = 'inline-block';
  }
}

function showLoginForm() {
  document.getElementById('no-license').style.display = 'block';
  document.getElementById('main').style.display = 'none';
  document.getElementById('license-key').textContent = '—';
}

async function changeLicense() {
  await chrome.storage.local.remove(['license']);
  CURRENT_LICENSE = null;
  showLoginForm();
}

// ─── LISTING DISPLAY ───────────────────────────────────────────────────────

function showListing(listing) {
  document.getElementById('no-data').style.display = 'none';
  document.getElementById('with-data').style.display = 'block';
  document.getElementById('data-title').value = listing.title || '(neznámy názov)';
  const specsList = Object.entries(listing.specs || {})
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
  document.getElementById('specs-preview').textContent = specsList || '(žiadne tech. údaje)';
  document.getElementById('data-images-count').value =
    (listing.images?.length || 0) + ' (zatiaľ nepoužité — Phase 2)';
  if (listing.price_eur) {
    document.getElementById('source-price').value = listing.price_eur;
    document.getElementById('selling-price').value = listing.price_eur;
  }
}

function recalcPrice(){
  const src = parseInt(document.getElementById('source-price').value || '0', 10);
  const mar = parseInt(document.getElementById('margin').value || '0', 10);
  if (src && mar) {
    document.getElementById('selling-price').value = src + mar;
  }
}

// ─── LOGO LOADER ───────────────────────────────────────────────────────────

async function loadDealerLogo(license_key) {
  const base = 'https://ykkbdhfxfqrcjkmqtqlu.supabase.co/storage/v1/object/public/dealer-logos/';
  for (const ext of ['png','jpg','webp','svg']) {
    try {
      const res = await fetch(base + license_key + '.' + ext);
      if (res.ok) {
        const blob = await res.blob();
        return await new Promise(r => {
          const fr = new FileReader();
          fr.onload = () => r({ dataUrl: fr.result });
          fr.readAsDataURL(blob);
        });
      }
    } catch (e) {}
  }
  return null;
}

// ─── PDF GENERATION ────────────────────────────────────────────────────────

async function generatePDF() {
  const status = document.getElementById('gen-status');
  const btn = document.getElementById('generate-btn');
  const price = parseInt(document.getElementById('selling-price').value || '0', 10);
  const vatMode = document.getElementById('vat-mode').value;

  console.log('[GearOS] generatePDF start', { price, vatMode, listing: !!CURRENT_LISTING });

  if (!price || price < 100) {
    status.textContent = 'Zadaj predajnú cenu';
    status.className = 'status err';
    return;
  }

  if (!CURRENT_LISTING) {
    status.textContent = '❌ Žiadne dáta — najprv klikni "Vygeneruj PDF" tlačidlo na mobile.de stránke';
    status.className = 'status err';
    return;
  }

  btn.disabled = true;
  status.textContent = 'Volám Claude API pre copywriting...';
  status.className = 'status';

  try {
    const desc = buildDescription(CURRENT_LISTING, price, vatMode);
    console.log('[GearOS] Sending to Claude, desc length:', desc.length);

    const res = await fetch(`${API_BASE}/skill/vehicle-doc-generator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: desc, license_key: CURRENT_LICENSE.key }),
    });
    const data = await res.json();
    console.log('[GearOS] Claude response:', data);
    if (data.error) throw new Error('API: ' + data.error);

    const jsonMatch = data.output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude nevrátil JSON. Output: ' + (data.output || '').slice(0, 100));
    const vehData = JSON.parse(jsonMatch[0]);
    console.log('[GearOS] Parsed vehData:', vehData);
    if (vehData.error) throw new Error(vehData.message || vehData.error);

    vehData.price_value_eur = price;

    console.log('[GearOS] Listing images URLs:', CURRENT_LISTING.images?.length || 0, CURRENT_LISTING.images?.slice(0,2));
    status.textContent = 'Sťahujem fotky (môže trvať 5-10s)...';
    const photos = await downloadPhotos(CURRENT_LISTING.images || []);
    console.log('[GearOS] Photos result:', { hero: !!photos.hero, ext: photos.exterior.length, int: photos.interior.length });
    if (!photos.hero && (CURRENT_LISTING.images?.length || 0) > 0) {
      console.warn('[GearOS] Photos URLs existed but all downloads failed. Check network errors above.');
    }

    status.textContent = 'Generujem PDF...';
    const filename = await buildPDF(vehData, vatMode, photos);
    console.log('[GearOS] PDF saved:', filename);
    status.textContent = '✅ PDF stiahnuté: ' + filename;
    status.className = 'status ok';
  } catch (e) {
    console.error('[GearOS] PDF generation failed:', e);
    status.textContent = '❌ ' + (e.message || String(e));
    status.className = 'status err';
  } finally {
    btn.disabled = false;
  }
}

function buildDescription(listing, price, vatMode) {
  const lines = [];
  lines.push(listing.title || '');
  for (const [k, v] of Object.entries(listing.specs || {})) {
    lines.push(`${k}: ${v}`);
  }
  // Send ALL equipment (Claude will translate)
  if (listing.equipment && listing.equipment.length) {
    lines.push('Výbava (po nemecky, prelož): ' + listing.equipment.join(', '));
  }
  lines.push(`Predajná cena: ${price} EUR`);
  lines.push(`DPH režim: ${vatMode === 'margin' ? '§ 25a (DPH v marži)' : vatMode === 'vat' ? 'štandardná 23%' : 'bez DPH'}`);
  return lines.join('\n');
}

// Resize image to target width via canvas, return JPEG dataURL.
// NEVER throws — returns null on any failure so downstream Promise.all doesn't reject.
async function resizeImage(srcDataUrl, targetW, quality = 0.82) {
  return new Promise((resolve) => {
    if (!srcDataUrl || typeof srcDataUrl !== 'string' || !srcDataUrl.startsWith('data:image/')) {
      console.warn('[GearOS] resizeImage: invalid input');
      return resolve(null);
    }
    const img = new Image();
    img.onload = () => {
      try {
        if (!img.naturalWidth || !img.naturalHeight) return resolve(null);
        const ratio = img.naturalHeight / img.naturalWidth;
        const w = targetW;
        const h = Math.round(w * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL('image/jpeg', quality);
        if (!out || !out.startsWith('data:image/jpeg') || out.length < 100) return resolve(null);
        resolve(out);
      } catch (e) {
        console.warn('[GearOS] resize failed:', e.message);
        resolve(null);
      }
    };
    img.onerror = () => {
      console.warn('[GearOS] image load failed');
      resolve(null);
    };
    img.src = srcDataUrl;
  });
}

// Download images from classistatic CDN and convert to base64 dataURLs.
async function downloadPhotos(urls) {
  if (!urls || !urls.length) return { hero: null, exterior: [], interior: [] };

  // Smaller rule = smaller files = faster everything
  const fullUrls = urls.map(u => {
    if (u.includes('?')) return u;
    return u + '?rule=mo-720';  // ~720px wide source
  });

  const candidates = fullUrls.slice(0, Math.min(8, fullUrls.length));
  console.log('[GearOS] Downloading', candidates.length, 'photos');

  const results = await Promise.all(candidates.map(async (url) => {
    try {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise(r => {
        const fr = new FileReader();
        fr.onload = () => r({ url, dataUrl: fr.result });
        fr.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('[GearOS] Failed to download', url, e);
      return null;
    }
  }));

  const valid = results.filter(Boolean);
  if (valid.length === 0) return { hero: null, exterior: [], interior: [] };

  console.log('[GearOS] Resizing photos for PDF...');
  const heroSrc = valid[0]?.dataUrl;
  const ext = [valid[1], valid[2]].filter(Boolean).map(v => v.dataUrl);
  const intr = [valid[5], valid[7]].filter(Boolean).map(v => v.dataUrl);

  const [heroResized, extResized, intrResized] = await Promise.all([
    heroSrc ? resizeImage(heroSrc, 900, 0.85) : null,
    Promise.all(ext.map(d => resizeImage(d, 480, 0.82))),
    Promise.all(intr.map(d => resizeImage(d, 480, 0.82))),
  ]);

  // Filter null/undefined — only valid dataURLs pass through to pdfmake
  return {
    hero: (heroResized && heroResized.startsWith('data:image/')) ? heroResized : null,
    exterior: extResized.filter(d => d && d.startsWith('data:image/')),
    interior: intrResized.filter(d => d && d.startsWith('data:image/')).slice(0, 2),
  };
}

async function buildPDF(v, vatMode, photos) {
  const today = new Date().toLocaleDateString('sk-SK');
  const price = (v.price_value_eur || 0).toLocaleString('sk-SK');
  const equipment = v.equipment_sk || [];

  const headerColumns = [];
  if (DEALER_LOGO_DATAURL) {
    headerColumns.push({ image: DEALER_LOGO_DATAURL, fit: [120, 45] });
  } else {
    headerColumns.push({ text: COMPANY.name, style: 'companyName' });
  }
  headerColumns.push({ text: today, style: 'date', alignment: 'right', margin: [0, 16, 0, 0] });

  const subtitle = [COMPANY.name, COMPANY.city, COMPANY.email, COMPANY.phone].filter(Boolean).join(' · ');

  let vatLine = '';
  let priceWithoutVat = null;
  let vatAmount = null;
  if (vatMode === 'margin') {
    vatLine = 'Cena vrátane DPH v režime prirážky podľa § 25a zákona o DPH.';
  } else if (vatMode === 'vat') {
    // Selling price IS with VAT — calculate the breakdown
    const priceWith = v.price_value_eur || 0;
    priceWithoutVat = Math.round(priceWith / 1.23);
    vatAmount = priceWith - priceWithoutVat;
    vatLine = 'Cena vrátane DPH 23%.';
  }

  // Reusable header block
  const headerBlock = [
    { columns: headerColumns, columnGap: 10 },
    { text: DEALER_LOGO_DATAURL ? subtitle : (COMPANY.city + ' · ' + COMPANY.email + ' · ' + COMPANY.phone),
      style: 'companyInfo', margin: [0, DEALER_LOGO_DATAURL ? 8 : 3, 0, 0] },
    { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1.2, lineColor: '#1a1a2e' }],
      margin: [0, 10, 0, 18] },
  ];

  // Split equipment into 2 columns
  const half = Math.ceil(equipment.length / 2);
  const equipLeft = equipment.slice(0, half);
  const equipRight = equipment.slice(half);

  const content = [
    // ─── PAGE 1: Cover ──────────────────────────────────────
    ...headerBlock,
    { text: 'CENOVÁ PONUKA', style: 'docTitle' },
    { text: v.title || 'Vozidlo', style: 'vehicleTitle' },
    v.headline_specs && v.headline_specs.length ?
      { text: v.headline_specs.join('  ·  '), style: 'specsRow', margin: [0, 6, 0, 0] } : '',
  ];

  // Hero photo (if available)
  if (photos?.hero) {
    content.push({
      image: photos.hero,
      width: 515,
      margin: [0, 18, 0, 0],
    });
  }

  // Selling points
  content.push(
    { text: 'PREDNOSTI VOZIDLA', style: 'sectionLabel', margin: [0, 20, 0, 8] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 80, y2: 0, lineWidth: 1, lineColor: '#1a1a2e' }] },
    { ul: v.selling_points || [], style: 'pointsList', margin: [0, 10, 0, 0] },
  );

  // Price box — VAT breakdown only for 'vat' mode (s odpočtom DPH)
  const priceStack = [
    { text: (v.price_label || 'PREDAJNÁ CENA').toUpperCase(), style: 'priceLabel' },
    { text: price + ' €', style: 'priceValue' },
  ];
  if (priceWithoutVat !== null) {
    priceStack.push({
      text: `Cena bez DPH: ${priceWithoutVat.toLocaleString('sk-SK')} €  ·  DPH 23%: ${vatAmount.toLocaleString('sk-SK')} €`,
      style: 'priceBreakdown',
      margin: [0, 6, 0, 0],
    });
  }
  if (vatLine) {
    priceStack.push({ text: vatLine, style: 'priceNote', margin: [0, priceWithoutVat !== null ? 2 : 4, 0, 0] });
  }
  content.push({
    table: {
      widths: ['*'],
      body: [[{
        stack: priceStack,
        fillColor: '#1a1a2e', color: '#ffffff',
        border: [false, false, false, false],
        margin: [16, 14, 16, 14],
      }]],
    },
    layout: 'noBorders',
    margin: [0, 18, 0, 0],
  });

  // ─── PAGE 2: Equipment + interior photos ─────────────────────
  if (equipment.length > 0 || photos?.interior?.length) {
    content.push({ text: '', pageBreak: 'before' });
    content.push(...headerBlock);

    if (equipment.length > 0) {
      content.push(
        { text: 'VÝBAVA A VÝRAZNÉ PRVKY', style: 'sectionLabel', margin: [0, 0, 0, 8] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 80, y2: 0, lineWidth: 1, lineColor: '#1a1a2e' }] },
        {
          columns: [
            { ul: equipLeft, style: 'equipList' },
            { ul: equipRight, style: 'equipList' },
          ],
          columnGap: 18,
          margin: [0, 12, 0, 0],
        },
      );
    }

    // Interior photos
    if (photos?.interior?.length) {
      content.push(
        { text: 'INTERIÉR', style: 'sectionLabel', margin: [0, 22, 0, 8] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 80, y2: 0, lineWidth: 1, lineColor: '#1a1a2e' }] },
      );
      const interiorRow = {
        columns: photos.interior.map(p => ({ image: p, width: 248 })),
        columnGap: 19,
        margin: [0, 12, 0, 0],
      };
      content.push(interiorRow);
    }
  }

  // ─── PAGE 3: Additional exterior + contact ─────────────────
  if (photos?.exterior?.length) {
    content.push({ text: '', pageBreak: 'before' });
    content.push(...headerBlock);
    content.push(
      { text: 'EXTERIÉR', style: 'sectionLabel', margin: [0, 0, 0, 8] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 80, y2: 0, lineWidth: 1, lineColor: '#1a1a2e' }] },
    );
    const exteriorRow = {
      columns: photos.exterior.map(p => ({ image: p, width: 248 })),
      columnGap: 19,
      margin: [0, 12, 0, 0],
    };
    content.push(exteriorRow);

    // Footer note + contact on page 3
    if (v.footer_note) {
      content.push({ text: v.footer_note, style: 'footerNote', margin: [0, 24, 0, 0] });
    }
    content.push(
      { text: '', margin: [0, 30, 0, 0] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }] },
      { text: 'KONTAKT', style: 'sectionLabel', margin: [0, 14, 0, 6] },
      {
        columns: [
          { text: COMPANY.owner + '\n' + COMPANY.name, style: 'contactName' },
          { text: COMPANY.email + '\n' + COMPANY.phone, style: 'contactInfo', alignment: 'right' },
        ],
      },
    );
  } else {
    // No photos — add contact at end of page 1/2
    content.push(
      v.footer_note ? { text: v.footer_note, style: 'footerNote', margin: [0, 18, 0, 0] } : '',
      { text: '', margin: [0, 24, 0, 0] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }] },
      { text: 'KONTAKT', style: 'sectionLabel', margin: [0, 12, 0, 6] },
      {
        columns: [
          { text: COMPANY.owner + '\n' + COMPANY.name, style: 'contactName' },
          { text: COMPANY.email + '\n' + COMPANY.phone, style: 'contactInfo', alignment: 'right' },
        ],
      },
    );
  }

  const docDef = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    content,
    styles: {
      companyName: { fontSize: 18, bold: true, color: '#1a1a2e' },
      companyInfo: { fontSize: 9, color: '#6b7280' },
      date: { fontSize: 10, color: '#6b7280' },
      docTitle: { fontSize: 10, color: '#6b7280', bold: true, characterSpacing: 2 },
      vehicleTitle: { fontSize: 24, bold: true, color: '#1a1a2e', margin: [0, 4, 0, 0] },
      specsRow: { fontSize: 11, color: '#6b7280' },
      sectionLabel: { fontSize: 9, color: '#1a1a2e', bold: true, characterSpacing: 1.5 },
      pointsList: { fontSize: 11, color: '#1a1a2e', lineHeight: 1.5 },
      equipList: { fontSize: 9.5, color: '#1a1a2e', lineHeight: 1.4 },
      priceLabel: { fontSize: 10, color: '#cccccc', characterSpacing: 2 },
      priceValue: { fontSize: 30, bold: true, color: '#ffffff', margin: [0, 4, 0, 0] },
      priceBreakdown: { fontSize: 10, color: '#e5e7eb' },
      priceNote: { fontSize: 9, color: '#cccccc', italics: true },
      footerNote: { fontSize: 10, italics: true, color: '#6b7280' },
      contactName: { fontSize: 11, bold: true, color: '#1a1a2e', lineHeight: 1.3 },
      contactInfo: { fontSize: 10, color: '#6b7280', lineHeight: 1.3 },
    },
    defaultStyle: { font: 'Roboto' },
  };

  const safeTitle = (v.title || 'vozidlo').replace(/[^a-zA-Z0-9]+/g, '_').substring(0, 40);
  const filename = `ponuka_${safeTitle}_${new Date().toISOString().slice(0,10)}.pdf`;

  return new Promise((resolve) => {
    pdfMake.createPdf(docDef).getBlob(blob => {
      const url = URL.createObjectURL(blob);
      chrome.downloads.download({
        url,
        filename,
        saveAs: false,
      }, (downloadId) => {
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        resolve(filename);
      });
    });
  });
}
