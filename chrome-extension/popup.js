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

  if (!price || price < 100) {
    status.textContent = 'Zadaj predajnú cenu';
    status.className = 'status err';
    return;
  }

  btn.disabled = true;
  status.textContent = 'Volám Claude API pre copywriting...';
  status.className = 'status';

  try {
    // Build a clean description for Claude from scraped data
    const desc = buildDescription(CURRENT_LISTING, price, vatMode);

    const res = await fetch(`${API_BASE}/skill/vehicle-doc-generator`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: desc, license_key: CURRENT_LICENSE.key }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error + ': ' + JSON.stringify(data.detail).slice(0, 100));

    const jsonMatch = data.output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude nevrátil JSON');
    const vehData = JSON.parse(jsonMatch[0]);
    if (vehData.error) throw new Error(vehData.message || vehData.error);

    // Use our price, not Claude's
    vehData.price_value_eur = price;

    status.textContent = 'Generujem PDF...';
    const filename = await buildPDF(vehData, vatMode);
    status.textContent = '✅ PDF stiahnuté: ' + filename;
    status.className = 'status ok';
  } catch (e) {
    console.error('[GearOS]', e);
    status.textContent = '❌ ' + e.message;
    status.className = 'status err';
  } finally {
    btn.disabled = false;
  }
}

function buildDescription(listing, price, vatMode) {
  const lines = [];
  lines.push(listing.title || '');
  // Specs as key-value pairs
  for (const [k, v] of Object.entries(listing.specs || {})) {
    lines.push(`${k}: ${v}`);
  }
  if (listing.equipment && listing.equipment.length) {
    lines.push('Výbava: ' + listing.equipment.slice(0, 20).join(', '));
  }
  lines.push(`Predajná cena: ${price} EUR`);
  lines.push(`DPH režim: ${vatMode === 'margin' ? '§ 25a (DPH v marži)' : vatMode === 'vat' ? 'štandardná 23%' : 'bez DPH'}`);
  return lines.join('\n');
}

async function buildPDF(v, vatMode) {
  const today = new Date().toLocaleDateString('sk-SK');
  const price = (v.price_value_eur || 0).toLocaleString('sk-SK');

  const headerColumns = [];
  if (DEALER_LOGO_DATAURL) {
    headerColumns.push({ image: DEALER_LOGO_DATAURL, fit: [120, 45] });
  } else {
    headerColumns.push({ text: COMPANY.name, style: 'companyName' });
  }
  headerColumns.push({ text: today, style: 'date', alignment: 'right', margin: [0, 16, 0, 0] });

  const subtitle = [COMPANY.name, COMPANY.city, COMPANY.email, COMPANY.phone].filter(Boolean).join(' · ');

  let vatLine = '';
  if (vatMode === 'margin') vatLine = 'Cena vrátane DPH v režime prirážky podľa § 25a zákona o DPH.';
  else if (vatMode === 'vat') vatLine = 'Cena vrátane DPH 23%.';

  const docDef = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 50],
    content: [
      { columns: headerColumns, columnGap: 10 },
      { text: DEALER_LOGO_DATAURL ? subtitle : (COMPANY.city + ' · ' + COMPANY.email + ' · ' + COMPANY.phone),
        style: 'companyInfo', margin: [0, DEALER_LOGO_DATAURL ? 8 : 3, 0, 0] },
      { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1.2, lineColor: '#1a1a2e' }],
        margin: [0, 10, 0, 18] },
      { text: 'CENOVÁ PONUKA', style: 'docTitle' },
      { text: v.title || 'Vozidlo', style: 'vehicleTitle' },
      v.headline_specs && v.headline_specs.length ?
        { text: v.headline_specs.join('  ·  '), style: 'specsRow', margin: [0, 6, 0, 0] } : '',
      { text: 'PREDNOSTI VOZIDLA', style: 'sectionLabel', margin: [0, 25, 0, 8] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 80, y2: 0, lineWidth: 1, lineColor: '#1a1a2e' }] },
      { ul: v.selling_points || [], style: 'pointsList', margin: [0, 10, 0, 0] },
      {
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              { text: (v.price_label || 'PREDAJNÁ CENA').toUpperCase(), style: 'priceLabel' },
              { text: price + ' €', style: 'priceValue' },
              vatLine ? { text: vatLine, style: 'priceNote', margin: [0, 4, 0, 0] } : '',
            ],
            fillColor: '#1a1a2e', color: '#ffffff',
            border: [false, false, false, false],
            margin: [16, 14, 16, 14],
          }]],
        },
        layout: 'noBorders',
        margin: [0, 30, 0, 15],
      },
      v.footer_note ? { text: v.footer_note, style: 'footerNote', margin: [0, 14, 0, 0] } : '',
      { text: '', margin: [0, 30, 0, 0] },
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#cccccc' }] },
      { text: 'KONTAKT', style: 'sectionLabel', margin: [0, 14, 0, 6] },
      {
        columns: [
          { text: COMPANY.owner + '\n' + COMPANY.name, style: 'contactName' },
          { text: COMPANY.email + '\n' + COMPANY.phone, style: 'contactInfo', alignment: 'right' },
        ],
      },
    ],
    styles: {
      companyName: { fontSize: 18, bold: true, color: '#1a1a2e' },
      companyInfo: { fontSize: 9, color: '#6b7280' },
      date: { fontSize: 10, color: '#6b7280' },
      docTitle: { fontSize: 10, color: '#6b7280', bold: true, characterSpacing: 2 },
      vehicleTitle: { fontSize: 26, bold: true, color: '#1a1a2e', margin: [0, 4, 0, 0] },
      specsRow: { fontSize: 11, color: '#6b7280' },
      sectionLabel: { fontSize: 9, color: '#1a1a2e', bold: true, characterSpacing: 1.5 },
      pointsList: { fontSize: 11.5, color: '#1a1a2e', lineHeight: 1.5 },
      priceLabel: { fontSize: 10, color: '#cccccc', characterSpacing: 2 },
      priceValue: { fontSize: 32, bold: true, color: '#ffffff', margin: [0, 4, 0, 0] },
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
