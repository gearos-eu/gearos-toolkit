// GearOS — Content script for mobile.de listing pages
// Injects a floating action button. Works on any mobile.de subdomain.

(function() {
  'use strict';

  console.log('[GearOS] Content script loaded on', location.href);

  // Only run on listing detail pages — but try multiple URL patterns
  const isDetailPage = /\/fahrzeuge\/details\.html\?id=\d+|\/auto\/details\.html\?id=\d+/.test(location.href);

  if (!isDetailPage) {
    console.log('[GearOS] Nie je detail page — tlačidlo sa nepridá. Očakávam URL s /fahrzeuge/details.html?id=...');
    return;
  }

  console.log('[GearOS] Detail page detected. Injecting button...');

  // Inject button immediately — don't wait for DOM elements
  injectButton();

  // Watch for DOM changes (mobile.de is SPA, may remove our button)
  if (document.body) {
    const observer = new MutationObserver(() => {
      if (!document.getElementById('gearos-fab')) injectButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Belt + suspenders: also check every 2s for the lifetime of the page
  setInterval(() => {
    if (document.body && !document.getElementById('gearos-fab')) {
      injectButton();
    }
  }, 2000);

  function injectButton() {
    if (document.getElementById('gearos-fab')) return;
    if (!document.body) return;

    const btn = document.createElement('button');
    btn.id = 'gearos-fab';
    // Inline styles to override mobile.de CSS (CSS file load might be blocked/overridden)
    btn.setAttribute('style', `
      position: fixed !important;
      bottom: 24px !important;
      right: 24px !important;
      background: #2563eb !important;
      color: white !important;
      border: none !important;
      border-radius: 999px !important;
      padding: 14px 22px !important;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
      font-size: 14px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      box-shadow: 0 4px 16px rgba(0,0,0,.35) !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      line-height: 1 !important;
      text-transform: none !important;
      letter-spacing: normal !important;
    `.replace(/\s+/g, ' '));
    btn.textContent = '⚡ Vygeneruj GearOS PDF';
    btn.addEventListener('click', onClick);
    document.body.appendChild(btn);
    console.log('[GearOS] Button injected at', new Date().toISOString());
  }

  async function onClick() {
    const btn = document.getElementById('gearos-fab');
    btn.classList.add('loading');
    btn.innerHTML = '⏳ Scrapujem údaje...';

    try {
      const data = scrapeListing();
      console.log('[GearOS] Scraped:', data);

      if (!data.title && Object.keys(data.specs).length === 0) {
        throw new Error('Stránka ešte nie je načítaná. Počkaj 3s a skús znova.');
      }

      // Download photos on the mobile.de page (origin lets it through)
      if (data.images && data.images.length > 0) {
        btn.innerHTML = `📷 Sťahujem ${Math.min(8, data.images.length)} fotiek...`;
        data.photos_b64 = await downloadAndResizePhotos(data.images);
        console.log('[GearOS] Photos downloaded:', {
          hero: !!data.photos_b64.hero,
          ext: data.photos_b64.exterior.length,
          int: data.photos_b64.interior.length,
        });
      } else {
        data.photos_b64 = { hero: null, exterior: [], interior: [] };
      }

      await chrome.storage.local.set({ pendingListing: data });
      btn.innerHTML = '✅ Údaje + fotky pripravené';

      setTimeout(() => {
        btn.classList.remove('loading');
        btn.innerHTML = '🚀 Klikni ikonu GearOS hore →';
      }, 1500);
    } catch (e) {
      console.error('[GearOS] Error:', e);
      btn.classList.remove('loading');
      btn.innerHTML = '❌ ' + e.message;
      setTimeout(() => {
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          Skús znova
        `;
      }, 4000);
    }
  }

  // ─── PHOTO DOWNLOAD (on mobile.de origin — bypasses extension CORS issues) ──

  function resizeViaCanvas(srcDataUrl, targetW, quality) {
    return new Promise(resolve => {
      if (!srcDataUrl || !srcDataUrl.startsWith('data:image/')) return resolve(null);
      const img = new Image();
      img.onload = () => {
        try {
          if (!img.naturalWidth || !img.naturalHeight) return resolve(null);
          const ratio = img.naturalHeight / img.naturalWidth;
          const w = targetW;
          const h = Math.round(w * ratio);
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          const out = c.toDataURL('image/jpeg', quality);
          resolve(out && out.length > 100 ? out : null);
        } catch (e) {
          console.warn('[GearOS] resize fail:', e.message);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = srcDataUrl;
    });
  }

  async function fetchAsDataURL(url) {
    try {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) {
        console.warn('[GearOS] fetch failed', res.status, url.slice(-50));
        return null;
      }
      const blob = await res.blob();
      return await new Promise(r => {
        const fr = new FileReader();
        fr.onload = () => r(fr.result);
        fr.onerror = () => r(null);
        fr.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('[GearOS] fetch threw:', e.message);
      return null;
    }
  }

  async function downloadAndResizePhotos(urls) {
    // Use URLs exactly as found in DOM (preserves any signing/token)
    const candidates = urls.slice(0, 8);
    console.log('[GearOS] Fetching', candidates.length, 'photos. First:', candidates[0]?.slice(-100));

    const raw = await Promise.all(candidates.map(fetchAsDataURL));
    const ok = raw.map((d, i) => d ? { idx: i, dataUrl: d } : null).filter(Boolean);
    console.log('[GearOS] Fetched OK:', ok.length, '/', candidates.length);

    if (ok.length === 0) return { hero: null, exterior: [], interior: [] };

    const heroSrc = ok[0].dataUrl;
    const extSrc = [ok[1]?.dataUrl, ok[2]?.dataUrl].filter(Boolean);
    const intSrc = [ok[5]?.dataUrl, ok[7]?.dataUrl].filter(Boolean);

    const [hero, exterior, interior] = await Promise.all([
      resizeViaCanvas(heroSrc, 900, 0.85),
      Promise.all(extSrc.map(d => resizeViaCanvas(d, 480, 0.82))),
      Promise.all(intSrc.map(d => resizeViaCanvas(d, 480, 0.82))),
    ]);

    return {
      hero: (hero && hero.startsWith('data:image/')) ? hero : null,
      exterior: exterior.filter(d => d && d.startsWith('data:image/')),
      interior: interior.filter(d => d && d.startsWith('data:image/')).slice(0, 2),
    };
  }

  // ─── SCRAPER ─────────────────────────────────────────────────────────────

  function scrapeListing() {
    const data = {
      url: location.href,
      scraped_at: new Date().toISOString(),
      title: '',
      price_eur: null,
      specs: {},
      equipment: [],
      images: [],
      dealer: null,
    };

    // Title — prefer h1, fallback to document.title
    const h1 = document.querySelector('h1');
    if (h1 && h1.textContent.trim()) {
      data.title = h1.textContent.trim();
    } else {
      const tabTitle = document.title.split(/\s+für\s+/)[0].trim();
      if (tabTitle && tabTitle.length > 3 && tabTitle.length < 120) {
        data.title = tabTitle;
      }
    }

    // Price — from document.title (most reliable)
    let price = null;
    const titleMatch = document.title.match(/für\s+([\d.,\s]+)\s*€/);
    if (titleMatch) {
      price = parseInt(titleMatch[1].replace(/[.,\s]/g, ''), 10);
    }
    if (!price) {
      const priceEls = document.querySelectorAll('[data-testid*="price"], [class*="Price"], [class*="price"]');
      for (const el of priceEls) {
        const m = el.textContent.replace(/\./g, '').match(/(\d{4,7})\s*€/);
        if (m) { price = parseInt(m[1], 10); break; }
      }
    }
    if (price && price > 100 && price < 1000000) data.price_eur = price;

    // Spec table — dl dt/dd pattern
    const dts = [...document.querySelectorAll('dl dt')];
    const dds = [...document.querySelectorAll('dl dd')];
    dts.forEach((dt, i) => {
      if (dds[i]) {
        const key = dt.textContent.trim();
        const value = dds[i].textContent.trim();
        if (key && value && key.length < 50 && value.length < 200) {
          data.specs[key] = value;
        }
      }
    });

    // Equipment
    const equip = [...document.querySelectorAll('li')]
      .map(li => li.textContent.trim())
      .filter(t => t.length > 3 && t.length < 80 && !t.includes('\n') && !/mobile|cookie|impressum|kontakt|datenschutz/i.test(t))
      .slice(0, 40);
    data.equipment = [...new Set(equip)];

    // Images — capture FULL URLs including query strings (mobile.de often signs URLs)
    const imageUrls = new Set();
    // Match full URL including query params, stop at quote/space/<
    const imgRe = /https:\/\/[\w-]+\.classistatic\.de\/api\/v1\/mo-prod\/images\/[^\s"'<>]+/g;
    const html = document.documentElement.outerHTML;
    const matches = html.match(imgRe) || [];
    // Dedupe by image ID (path before query string)
    const byId = new Map();
    matches.forEach(m => {
      const idMatch = m.match(/images\/([\w/-]+)/);
      if (!idMatch) return;
      const id = idMatch[1];
      // Prefer higher-quality version (mo-720 > mo-360 > mo-160)
      const existing = byId.get(id);
      const newRule = (m.match(/mo-(\d+)/) || [])[1] || '0';
      const oldRule = existing ? ((existing.match(/mo-(\d+)/) || [])[1] || '0') : '0';
      if (!existing || parseInt(newRule) > parseInt(oldRule)) {
        byId.set(id, m);
      }
    });
    data.images = [...byId.values()].slice(0, 12);
    console.log('[GearOS] Images found:', data.images.length, 'sample:', data.images[0]?.slice(-100));

    // VIN
    const vinMatch = (document.body.innerText || '').match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
    if (vinMatch) data.specs['VIN'] = vinMatch[0];

    return data;
  }
})();
