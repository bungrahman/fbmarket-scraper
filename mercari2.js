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

  const url = 'https://jp.mercari.com/en/search?category_id=97&status=on_sale';
  console.log('🔍 Membuka halaman:', url);
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Scroll biar semua produk muncul
  async function autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 800;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 400);
      });
    });
  }

  console.log('🌀 Scroll halaman...');
  await autoScroll(page);
  await new Promise((r) => setTimeout(r, 2000));

  fs.writeFileSync('debug-mercari2.html', await page.content());
  await page.screenshot({ path: 'debug-mercari2.png' });

  console.log('📦 Mulai scraping...');
  await page.waitForSelector('a[data-testid="thumbnail-link"]', { timeout: 30000 });

  const scrapedData = await page.$$eval('a[data-testid="thumbnail-link"]', (links) =>
      links.map((a) => {
        const thumb = a.querySelector('div.merItemThumbnail');
        const img = a.querySelector('figure img');
        const aria = thumb?.getAttribute('aria-label') || '';
        const image = img?.src || '';
    
        // 🔥 Bersihkan teks "Image of" dari judul
        let title = aria.replace(/^Image of\s*/i, '').trim();
        let price = '';
    
        const match = aria.match(/(.+?)\s([\d,]+yen.*$)/);
        if (match) {
          title = match[1].trim().replace(/^Image of\s*/i, '').trim(); // jaga-jaga kalau masih ada
          price = match[2].trim();
        }
    
        const link = a.href.startsWith('http')
          ? a.href
          : `https://jp.mercari.com${a.getAttribute('href')}`;
    
        return { title, price, image, link };
      })
    );


  fs.writeFileSync('mercari2.json', JSON.stringify(scrapedData, null, 2));
  console.log(`✅ Dapat ${scrapedData.length} produk dari Mercari2.`);

  await browser.close();

  // ===============================
  // KIRIM KE TELEGRAM CHANNEL
  // ===============================
  const TELEGRAM_TOKEN = '8532229239:AAFynp1ZycYAQ1MtYfB7MXSK5o2ty8Di2iQ'; // ganti token kamu
  const CHAT_ID = '-1003262141284'; // ganti ID channel kamu
  const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`;

  console.log('🚀 Kirim ke Telegram...');

  for (let i = 0; i < scrapedData.length; i += 20) {
    const batch = scrapedData.slice(i, i + 20);

    for (const item of batch) {
      try {
        const caption = `📦 *${item.title}*\n💰 ${item.price}\n🔗 [Lihat Produk](${item.link})`;

        await axios.post(telegramUrl, {
          chat_id: CHAT_ID,
          photo: item.image || 'https://upload.wikimedia.org/wikipedia/commons/9/94/Mercari_logo.png',
          caption: caption,
          parse_mode: 'Markdown',
        });

        console.log(`✅ Terkirim: ${item.title}`);
        await new Promise((r) => setTimeout(r, 30000)); // jeda antar pesan
      } catch (err) {
        console.error(`❌ Gagal kirim: ${item.title} (${err.message})`);
      }
    }

    console.log('🕒 Jeda 30 detik antar batch...');
    await new Promise((r) => setTimeout(r, 60000));
  }

  console.log('🎯 Semua produk terkirim ke Telegram!');
})();
