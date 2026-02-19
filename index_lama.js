const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const axios = require('axios');

puppeteer.use(StealthPlugin());
const app = express();
app.use(express.json()); // biar bisa terima JSON body

// Endpoint scraping
app.post('/scrape', async (req, res) => {
  const tasks = req.body; // Array [{ keyword, location }]

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: 'Format input salah, harus array keyword/location' });
  }

  const allResults = [];

  try {
    // Launch browser sekali aja
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

    const cookies = JSON.parse(fs.readFileSync('./cookies.json', 'utf8'));
    await page.setCookie(...cookies);

    for (const task of tasks) {
      const searchUrl = `https://www.facebook.com/marketplace/${encodeURIComponent(task.location)}/search?query=${encodeURIComponent(task.keyword)}`;

      console.log(`🔍 Scraping: ${task.keyword} @ ${task.location}`);

      await page.goto(searchUrl, { waitUntil: 'networkidle2' });
      await page.waitForSelector('a[href*="/marketplace/item"]', { timeout: 20000 });

      const listings = await page.$$('a[href*="/marketplace/item"]');

      for (const linkHandle of listings) {
        const link = await linkHandle.evaluate(a => a.href);
        const spans = await linkHandle.$$eval('span[dir="auto"]', els =>
          els.map(el => el.innerText.trim())
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

        allResults.push({
          keyword: task.keyword,
          searchLocation: task.location,
          title,
          price,
          location,
          link
        });
      }
    }

    await browser.close();

    // Kirim juga ke Google Sheets kalau mau
    try {
      await axios.post(
        'https://script.google.com/macros/s/AKfycbxYye0v-JqcxUpJM7aAxxEDVTZ2q1RSyhftmCjq7vhCpkYwv1tuarXA3cnGIhKiF3os/exec',
        allResults
      );
      console.log('✅ Data terkirim ke Google Sheets!');
    } catch (err) {
      console.error('⚠ Gagal kirim ke GSheets:', err.message);
    }

    // Return hasil ke client (n8n)
    res.json(allResults);

  } catch (err) {
    console.error('❌ Error scraping:', err);
    res.status(500).json({ error: err.message });
  }
});

// Jalankan server
app.listen(3000, () => {
  console.log('🚀 Scraper API jalan di http://localhost:3000');
});
