# GearOS Chrome Extension

Vygeneruje brandovanú PDF cenovú ponuku z mobile.de inzerátu jedným klikom.

## Inštalácia (developer mode — pre testovanie)

1. Otvor Chrome → `chrome://extensions/`
2. Vpravo hore zapni **Developer mode** (toggle)
3. Klikni **Load unpacked**
4. Vyber priečinok `chrome-extension/` z gearos-toolkit
5. Extension sa zobrazí v zozname so zelenou bodkou

## Prvé použitie

1. Klikni na **GearOS ikonu** v Chrome paneli (vpravo hore)
2. Zadaj svoj **licenčný kľúč** GEAR-XXXX-XXXX-XXXX
3. Klikni **Overiť a uložiť**

## Generovanie PDF

1. Otvor ľubovoľný inzerát na **suchen.mobile.de** (URL končí `/fahrzeuge/details.html?id=...`)
2. V pravom dolnom rohu sa objaví tlačidlo **"Vygeneruj GearOS PDF"**
3. Klikni naň → údaje sa naskenujú
4. Klikni GearOS ikonu v paneli → otvorí sa popup s naskenovanými údajmi
5. Zadaj **predajnú cenu** (€) + vyber **DPH režim**
6. Klikni **Vygenerovať PDF**
7. PDF sa stiahne do Downloads s názvom `ponuka_<auto>_<datum>.pdf`

## Čo extension robí

- **Content script** (`content.js`) — beží na mobile.de stránkach, extrahuje údaje (názov, cena, technické parametre, výbava, fotky, VIN)
- **Popup** (`popup.html` + `popup.js`) — UI pre licenciu + predajné podmienky + PDF generator
- **Worker API** — overuje licenciu, volá Claude API pre copywriting, ukladá logo

## Privacy

- Údaje z inzerátu sa nikdy nikam neposielajú **okrem** posiela tvojho popisu na Claude API (cez GearOS Worker)
- PDF sa generuje **v tvojom browseri** (pdfmake.js lokálne)
- Licenčný kľúč je uložený lokálne v `chrome.storage.local`

## Branding

Logo dealera nahráš v dashboarde: `https://gearos-eu.github.io/gearos-toolkit/dashboard/`
→ Login → Nastavenia → 🎨 Branding → Vybrať súbor

Extension si logo automaticky stiahne pri každom PDF.

## Verzie

- **v0.1.0** — MVP: scraping + manual price + Claude copywriting + 1-strana PDF
- **v0.2.0** (plánované) — fotky áut v PDF (3-strany ako RF Motors)
- **v0.3.0** — auto-pixelácia ŠPZ + dealer badge overlay
- **v0.4.0** — Chrome Web Store publikácia

## Vývoj

Po úprave súborov klikni v `chrome://extensions/` ikonu reload pri GearOS extension.
