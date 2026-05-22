// GearOS — Content script for mobile.de listing pages
// Injects a floating action button. Works on any mobile.de subdomain.

(function() {
  'use strict';

  // Only run on listing detail pages — but try multiple URL patterns
  const isDetailPage = /\/fahrzeuge\/details\.html\?id=\d+|\/auto\/details\.html\?id=\d+/.test(location.href);

  if (!isDetailPage) {
    console.log('[GearOS] Nie je detail page, content script sa nespúšťa. URL:', location.href);
    return;
  }

  console.log('[GearOS] Detail page detected. Injecting button...');

  // Inject button immediately — don't wait for DOM elements
  injectButton();

  // Watch for DOM changes (mobile.de is SPA)
  const observer = new MutationObserver(() => {
    if (!document.getElementById('gearos-fab')) {
      injectButton();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Stop observing after 30s (no point watching forever)
  setTimeout(() => observer.disconnect(), 30000);

  function injectButton() {
    if (document.getElementById('gearos-fab')) return;
    if (!document.body) return;

    const btn = document.createElement('button');
    btn.id = 'gearos-fab';
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      Vygeneruj GearOS PDF
    `;
    btn.addEventListener('click', onClick);
    document.body.appendChild(btn);
    console.log('[GearOS] Button injected.');
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

      await chrome.storage.local.set({ pendingListing: data });
      btn.innerHTML = '✅ Údaje uložené';

      setTimeout(() => {
        btn.classList.remove('loading');
        btn.innerHTML = '🚀 Klikni ikonu GearOS hore →';
      }, 1200);
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

    // Images — collect all classistatic URLs, strip query string
    const imageUrls = new Set();
    const imgPath = /https:\/\/[\w-]+\.classistatic\.de\/api\/v1\/mo-prod\/images\/[\w/-]+/g;
    // Search whole DOM HTML (catches lazy-loaded data-src, srcset, srcSet, etc.)
    const html = document.documentElement.outerHTML;
    const matches = html.match(imgPath) || [];
    matches.forEach(m => imageUrls.add(m));
    data.images = [...imageUrls].slice(0, 12);
    console.log('[GearOS] Images found:', data.images.length);

    // VIN
    const vinMatch = (document.body.innerText || '').match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
    if (vinMatch) data.specs['VIN'] = vinMatch[0];

    return data;
  }
})();
