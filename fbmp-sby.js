const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const axios = require('axios');

puppeteer.use(StealthPlugin());

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1200,800',
    ],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/114.0.0.0 Safari/537.36'
  );

  // 🔐 Ambil cookies login FB
  const cookies = JSON.parse(fs.readFileSync('./cookies.json', 'utf8'));
  await page.setCookie(...cookies);

  // 🔍 Target pencarian
  const url = 'https://www.facebook.com/marketplace/surabaya/search/?query=kamera';
  console.log('Membuka halaman:', url);
  await page.goto(url, { waitUntil: 'networkidle2' });

  fs.writeFileSync('debug-fbmp.html', await page.content());
  await page.screenshot({ path: 'debug-fbmp.png' });

  await page.waitForSelector('a[href*="/marketplace/item"]', { timeout: 20000 });
  const listings = await page.$$('a[href*="/marketplace/item"]');

  const scrapedData = [];

  for (const linkHandle of listings) {
    const link = await linkHandle.evaluate((a) => a.href.split('?')[0].split('#')[0]);

    const spans = await linkHandle.$$eval('span[dir="auto"]', (els) =>
      els.map((el) => el.innerText.trim())
    );

    let price = '';
    let title = '';
    let location = '';

    for (const text of spans) {
      if (!price && /^Rp[0-9]/.test(text)) {
        price = text;
      } else if (!location && /(Indonesia|Kota|Kabupaten|,)/i.test(text)) {
        location = text;
      } else if (!title) {
        title = text;
      }
    }

    scrapedData.push({ title, price, location, link });
  }

  fs.writeFileSync('fbmp.json', JSON.stringify(scrapedData, null, 2));
  console.log(`✅ Scraped ${scrapedData.length} produk dari FB Marketplace.`);

  await browser.close();

  // ===============================
  // KIRIM KE TELEGRAM CHANNEL
  // ===============================
  const TELEGRAM_TOKEN = '8532229239:AAFynp1ZycYAQ1MtYfB7MXSK5o2ty8Di2iQ'; // ganti token kamu
  const CHAT_ID = '-1003262141284'; // ganti ID channel kamu
  const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

  console.log('🚀 Kirim ke Telegram...');

  for (let i = 0; i < scrapedData.length; i += 20) {
    const batch = scrapedData.slice(i, i + 20);

    for (const item of batch) {
      try {
        const message = `📦 *${item.title}*\n💰 ${item.price}\n📍 ${item.location}\n🔗 [Lihat Produk](${item.link})`;

        await axios.post(telegramUrl, {
          chat_id: CHAT_ID,
          text: message,
          parse_mode: 'Markdown',
          disable_web_page_preview: false,
        });

        console.log(`✅ Terkirim: ${item.title}`);
        await new Promise((r) => setTimeout(r, 30000)); // jeda antar pesan
      } catch (err) {
        console.error(`❌ Gagal kirim: ${item.title} (${err.message})`);
      }
    }

    console.log('🕒 Jeda 30 detik antar batch Telegram...');
    await new Promise((r) => setTimeout(r, 60000));
  }

  console.log('🎯 Semua produk FB Marketplace terkirim ke Telegram!');
})();
