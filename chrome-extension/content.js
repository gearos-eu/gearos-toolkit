// GearOS — Content script for mobile.de listing pages
// Injects a floating action button that scrapes the listing and triggers PDF generation.

(function() {
  'use strict';

  // ─── Wait for page to be stable ───
  const waitForListing = setInterval(() => {
    if (document.querySelector('dl dt') || document.querySelector('h1')) {
      clearInterval(waitForListing);
      injectButton();
    }
  }, 500);

  // Safety timeout — give up after 10s
  setTimeout(() => clearInterval(waitForListing), 10000);

  function injectButton() {
    if (document.getElementById('gearos-fab')) return;  // already injected

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
  }

  async function onClick() {
    const btn = document.getElementById('gearos-fab');
    btn.classList.add('loading');
    btn.innerHTML = '⏳ Scrapujem údaje...';

    try {
      const data = scrapeListing();
      if (!data.title) {
        throw new Error('Nepodarilo sa extrahovať údaje z tejto stránky.');
      }

      // Send to popup via chrome.storage so popup can open with prefilled data
      await chrome.storage.local.set({ pendingListing: data });
      btn.innerHTML = '✅ Údaje pripravené — otvor GearOS popup';

      // Auto-open popup (Chrome doesn't allow this from content script — instruct user)
      setTimeout(() => {
        btn.classList.remove('loading');
        btn.innerHTML = '🚀 Klikni GearOS ikonu v Chrome paneli →';
      }, 1500);
    } catch (e) {
      console.error('[GearOS]', e);
      btn.classList.remove('loading');
      btn.innerHTML = '❌ ' + e.message;
      setTimeout(() => {
        btn.innerHTML = '🔄 Skús znova';
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

    // Title — usually in h1 or document.title
    const h1 = document.querySelector('h1');
    if (h1) data.title = h1.textContent.trim();

    // Price — try multiple selectors
    const priceText =
      document.querySelector('[data-testid="vip-price"]')?.textContent ||
      document.querySelector('.price-block')?.textContent ||
      document.querySelector('[class*="price"]')?.textContent || '';
    const priceMatch = priceText.replace(/\./g, '').match(/(\d+[\d\s]*)\s*€/);
    if (priceMatch) {
      data.price_eur = parseInt(priceMatch[1].replace(/\s/g, ''), 10);
    }

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

    // Equipment list — small list items not in obvious nav/header
    const equipItems = [...document.querySelectorAll('li')]
      .map(li => li.textContent.trim())
      .filter(t => t.length > 3 && t.length < 80 && !t.includes('\n') && !/mobile|cookie|impressum|kontakt/i.test(t))
      .slice(0, 40);
    data.equipment = [...new Set(equipItems)];

    // Images — from <img> srcset or <source> tags pointing to classistatic CDN
    const imageUrls = new Set();
    document.querySelectorAll('img[src*="classistatic"], source[srcset*="classistatic"]').forEach(el => {
      const src = el.src || el.getAttribute('srcset') || '';
      // Take the highest-res URL
      const matches = src.match(/https:\/\/img\.classistatic\.de\/api\/v1\/mo-prod\/images\/[\w-]+\/[\w-]+/g);
      if (matches) matches.forEach(m => imageUrls.add(m));
    });
    data.images = [...imageUrls].slice(0, 12);

    // Dealer name
    const dealerEl = document.querySelector('[data-testid="vip-dealer-name"]') ||
                     document.querySelector('[class*="dealer-name"]') ||
                     document.querySelector('[class*="seller-name"]');
    if (dealerEl) data.dealer = dealerEl.textContent.trim();

    // VIN search (BMW: WBA/WBY/WBS, generic 17-char)
    const allText = document.body.innerText || '';
    const vinMatch = allText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
    if (vinMatch) data.specs['VIN'] = vinMatch[0];

    return data;
  }
})();
