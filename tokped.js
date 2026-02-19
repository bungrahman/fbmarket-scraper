// tokped.js (pakai container data-testid + cookie safe-set)
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const axios = require('axios');

puppeteer.use(StealthPlugin());

function normalizeCookie(c) {
  const out = {
    name: c.name,
    value: c.value,
    path: c.path || '/',
    secure: !!c.secure,
    httpOnly: !!c.httpOnly,
  };
  // domain: remove leading dot if present (helps setCookie)
  if (c.domain) out.domain = c.domain.replace(/^\./, '');
  // expires: puppeteer expects integer seconds
  if (c.expirationDate) out.expires = Math.floor(Number(c.expirationDate));
  if (c.expires) out.expires = Math.floor(Number(c.expires));
  // sameSite normalization
  if (c.sameSite) {
    const s = String(c.sameSite).toLowerCase();
    if (s.includes('lax')) out.sameSite = 'Lax';
    else if (s.includes('strict')) out.sameSite = 'Strict';
    else if (s.includes('no') || s.includes('none') || s.includes('no_restriction')) out.sameSite = 'None';
  }
  return out;
}

(async () => {
  // --- launch
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1366,768',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--hide-scrollbars',
      '--disable-infobars',
      '--ignore-certificate-errors',
    ],
    defaultViewport: { width: 1366, height: 768 },
  });

  const page = await browser.newPage();

  // anti-detect
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.navigator.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
    Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'en-US'] });
  });

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.199 Safari/537.36'
  );
  await page.setExtraHTTPHeaders({ 'accept-language': 'id-ID,id;q=0.9,en;q=0.8', referer: 'https://www.google.com/' });

  // --- load cookies safely
  try {
    console.log('🍪 Memuat cookies Tokopedia...');
    const raw = JSON.parse(fs.readFileSync('./tokped_cookies.json', 'utf8'));
    const cookies = raw.map(normalizeCookie);

    // go to root so domain context matches
    await page.goto('https://www.tokopedia.com/', { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

    let setCount = 0;
    for (const ck of cookies) {
      try {
        // remove undefined props to avoid protocol errors
        const toSet = {};
        ['name','value','domain','path','secure','httpOnly','expires','sameSite'].forEach(k => {
          if (ck[k] !== undefined) toSet[k === 'expires' ? 'expires' : k] = ck[k];
        });
        await page.setCookie(toSet);
        setCount++;
      } catch (err) {
        console.warn(`⚠️ Skip cookie ${ck.name}: ${err.message}`);
      }
    }
    console.log(`✅ Cookies dipasang: ${setCount}/${cookies.length}`);
  } catch (e) {
    console.warn('⚠️ Gagal load cookies:', e.message);
  }

  // --- goto search
  const url = 'https://www.tokopedia.com/search?st=product&q=dslr';
  console.log('🔍 Membuka halaman:', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 }).catch(() => {});

  // small human-like interactions
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    await page.mouse.move(300, 300, { steps: 6 });
    await sleep(600);
    await page.mouse.wheel({ deltaY: 800 });
    await sleep(800);
    await page.mouse.move(600, 500, { steps: 6 });
    await sleep(600);
    // small click to trigger any event
    await page.mouse.click(600, 500, { delay: 120 });
  } catch (e) {}

  // ensure SRP container exists and products rendered
  console.log('⌛ Menunggu container produk...');
  try {
    await page.waitForSelector('div[data-testid="divSRPContentProducts"]', { timeout: 60000 });
  } catch (e) {
    console.warn('⚠️ Container divSRPContentProducts tidak muncul (timeout). Lanjut fallback check...');
  }

  // try multiple scrolls + checks to ensure products loaded
  let found = false;
  for (let i = 0; i < 12 && !found; i++) {
    // check if there are product anchors inside container
    found = await page.evaluate(() => {
      const container = document.querySelector('div[data-testid="divSRPContentProducts"]');
      if (!container) return false;
      const anchors = Array.from(container.querySelectorAll('a[href*="tokopedia.com/"]'));
      if (anchors.length > 0) {
        // ensure at least one anchor contains an img or Rp text
        return anchors.some(a => a.querySelector('img[alt="product-image"]') || /Rp[\s]*[\d\.,]+/.test(a.innerText));
      }
      return false;
    });

    if (!found) {
      // scroll a bit and wait
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await sleep(1500);
      // small mouse move
      try { await page.mouse.move(100 + Math.random() * 800, 100 + Math.random() * 400, { steps: 4 }); } catch (e) {}
    }
  }

  // save debug snapshot
  fs.writeFileSync('debug-tokopedia.html', await page.content());
  try { await page.screenshot({ path: 'debug-tokopedia.png', fullPage: true }); } catch (e) {}

  // --- scrape using the SRP container anchors
  console.log('📦 Mulai scraping...');
  const scrapedData = await page.$$eval(
    'div[data-testid="divSRPContentProducts"] a[href*="tokopedia.com/"]',
    (anchors) => {
      const out = [];
      for (const a of anchors) {
        try {
          // find the product card root (closest parent that visually groups the product)
          const card = a.closest('div.css-5wh65g') || a; // fallback to anchor itself
          const imgEl = card.querySelector('img[alt="product-image"]') || card.querySelector('img');
          const img = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';

          // title usually in a span with long text
          const titleEl = card.querySelector('span') || card.querySelector('div');
          const title = titleEl ? titleEl.innerText.trim() : '';

          // price element contains Rp
          const priceEl = Array.from(card.querySelectorAll('div,span')).find(n => /Rp[\s]*[\d\.,]+/.test(n.innerText));
          const price = priceEl ? priceEl.innerText.trim() : '';

          // store & location appear in small spans near bottom
          const storeEl = Array.from(card.querySelectorAll('span')).find(n => /Official|Store|Toko|Shop|GUDANG|Gudang|Power Merchant/i.test(n.innerText));
          const store = storeEl ? storeEl.innerText.trim() : '';

          const locationEl = Array.from(card.querySelectorAll('span')).find(n => /Jakarta|Bandung|Surabaya|Medan|Bogor|Kab\.|Kota/i.test(n.innerText));
          const location = locationEl ? locationEl.innerText.trim() : '';

          const ratingEl = Array.from(card.querySelectorAll('span')).find(n => /^[0-5]\.[0-9]$/.test(n.innerText));
          const rating = ratingEl ? ratingEl.innerText.trim() : '';

          const soldEl = Array.from(card.querySelectorAll('span')).find(n => /terjual|sold/i.test(n.innerText));
          const sold = soldEl ? soldEl.innerText.trim() : '';

          const link = a.href || (a.getAttribute && a.getAttribute('href')) || '';

          if (!title && !price) continue;
          out.push({ title, price, store, location, rating, sold, img, link });
        } catch (e) {
          // ignore single card error
        }
      }
      // dedupe by link
      const seen = new Set();
      return out.filter(i => i.link && !seen.has(i.link) && (seen.add(i.link) || true));
    }
  );

  fs.writeFileSync('tokopedia.json', JSON.stringify(scrapedData, null, 2));
  console.log(`✅ Dapat ${scrapedData.length} produk dari Tokopedia.`);

  await browser.close();

  // --- optional: send to telegram (if token present)
  const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '6380586292:AAHf5_QslEFbZXVKg28wbAgEIYW7O6qtOtQ';
  const CHAT_ID = process.env.CHAT_ID || '-1001668556532';
  if (TELEGRAM_TOKEN && CHAT_ID) {
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`;
    for (const item of scrapedData.slice(0, 20)) {
      try {
        const caption = [
          `📷 *${item.title || '-'}*`,
          `💰 ${item.price || 'Harga tidak tersedia'}`,
          item.rating ? `⭐️ ${item.rating}` : null,
          item.sold ? `📦 ${item.sold}` : null,
          item.store ? `🏪 ${item.store}` : null,
          item.location ? `📍 ${item.location}` : null,
          `🔗 [Lihat Produk](${item.link})`,
        ].filter(Boolean).join('\n');

        await axios.post(telegramUrl, {
          chat_id: CHAT_ID,
          photo: item.img || 'https://ecs7.tokopedia.net/img/cache/215-square/attachment/2019/5/24/attachment_9d93561a-4df1-463a-8d85-52d1f96af864.png',
          caption,
          parse_mode: 'Markdown',
        });
        await sleep(20000);
      } catch (e) {
        console.warn('telegram err', e.message || e);
      }
    }
    console.log('🚀 Kirim Telegram selesai');
  } else {
    console.log('⚠️ TELEGRAM_TOKEN/CHAT_ID tidak di-set, skip kirim Telegram');
  }

  console.log('Selesai.');
})();
