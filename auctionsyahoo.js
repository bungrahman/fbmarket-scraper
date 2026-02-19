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

  const url = 'https://auctions.yahoo.co.jp/category/list/2084261691/?nockie=1&s1=featured&o1=d';
  console.log('📦 Membuka halaman Yahoo Auctions...');
  await page.goto(url, { waitUntil: 'networkidle2' });

  // Auto scroll biar semua produk muncul
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

  fs.writeFileSync('debug-yahoo.html', await page.content());
  await page.screenshot({ path: 'debug-yahoo.png' });

  console.log('🔍 Mulai scraping...');
  await page.waitForSelector('li.Product', { timeout: 20000 });

  const scrapedData = await page.$$eval('li.Product', (items) =>
    items.map((el) => {
      const titleEl = el.querySelector('.Product__titleLink');
      const imgEl = el.querySelector('.Product__imageData');
      const priceEl = el.querySelector('.Product__priceValue');
      const bidEl = el.querySelector('.Product__bid');
      const timeEl = el.querySelector('.Product__time');
      const link = titleEl?.href || '';

      // Bersihkan URL gambar
      let image = imgEl?.src || '';
      if (image.includes('?')) image = image.split('?')[0]; // ambil sebelum tanda '?'
      image = image.replace(/&amp;/g, '&').trim();

      return {
        title: titleEl?.innerText.trim() || '',
        price: priceEl?.innerText.trim() || '',
        bids: bidEl?.innerText.trim() || '',
        remaining: timeEl?.innerText.trim() || '',
        image,
        link,
      };
    })
  );

  fs.writeFileSync('yahoo-auctions.json', JSON.stringify(scrapedData, null, 2));
  console.log(`✅ Scraped ${scrapedData.length} produk dari Yahoo Auctions.`);

  await browser.close();

  // ===============================
  // KIRIM KE TELEGRAM (per batch)
  // ===============================
  const TELEGRAM_TOKEN = '8532229239:AAFynp1ZycYAQ1MtYfB7MXSK5o2ty8Di2iQ';
  const CHAT_ID = '-1003262141284';
  const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

  // Clean text agar aman di HTML
  function cleanText(text) {
    if (!text) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '')
      .replace(/>/g, '')
      .replace(/"/g, '')
      .replace(/'/g, '')
      .replace(/`/g, '')
      .replace(/\*/g, '')
      .replace(/\[/g, '')
      .replace(/\]/g, '')
      .replace(/\(/g, '')
      .replace(/\)/g, '')
      .replace(/\+/g, '')
      .replace(/\!/g, '')
      .replace(/_/g, '')
      .replace(/#/g, '')
      .replace(/~/g, '')
      .trim();
  }

  console.log('🚀 Kirim ke Telegram (batch 20 item)...');

  for (let i = 0; i < scrapedData.length; i += 20) {
    const batch = scrapedData.slice(i, i + 20);

    for (const item of batch) {
      try {
        const title = cleanText(item.title);
        //const price = cleanText(item.price);
        const bids = cleanText(item.bids);
        //const remaining = cleanText(item.remaining);
        let price = cleanText(item.price);       // ganti const jadi let
        let remaining = cleanText(item.remaining);
        price = price.replace(/円/g, ' YEN');
        remaining = remaining
          .replace(/日/g, ' Hari')
          .replace(/時間/g, ' Jam')
          .replace(/分/g, ' Menit')
          .replace(/秒/g, ' Detik');
        const link = item.link || '';
        const image = item.image || '';

        let message = `<b>${title}</b>\n💴 ${price}\n🔨 Bids: ${bids}\n⏰ Sisa: ${remaining}\n\n<a href="${link}">🔗 Lihat Produk</a>`;
        if (image) message += `\n\n🖼️ <a href="${image}">Gambar Produk</a>`;

        if (message.length > 4000) message = message.slice(0, 3995) + '...';

        await axios.post(telegramUrl, {
          chat_id: CHAT_ID,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        });

        console.log(`✅ Terkirim: ${item.title}`);
        await new Promise((r) => setTimeout(r, 10000)); // delay antar item
      } catch (err) {
        console.error(`❌ Gagal kirim: ${item.title} (${err.message})`);
      }
    }

    console.log('🕒 Jeda antar batch 5 detik...');
    await new Promise((r) => setTimeout(r, 50000));
  }

  console.log('🎯 Semua produk Yahoo Auctions terkirim ke Telegram!');
})();
