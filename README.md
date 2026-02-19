# 🛒 Marketplace Scraper

> Automated multi-platform marketplace scraper with Telegram notifications. Monitors product listings from **Facebook Marketplace**, **Tokopedia**, **Mercari**, and **Yahoo Auctions Japan** — and delivers results straight to your Telegram channel.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Puppeteer](https://img.shields.io/badge/Puppeteer-v24-40B5A4?logo=puppeteer&logoColor=white)
![Telegram Bot API](https://img.shields.io/badge/Telegram-Bot%20API-26A5E4?logo=telegram&logoColor=white)
![License](https://img.shields.io/badge/License-ISC-blue)

---

## 📑 Table of Contents

- [Features](#-features)
- [Supported Marketplaces](#-supported-marketplaces)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Automation (Cron Jobs)](#-automation-cron-jobs)
- [Debugging](#-debugging)
- [Contributing](#-contributing)
- [License](#-license)
- [Disclaimer](#-disclaimer)

---

## ✨ Features

- 🔍 **Multi-Platform Scraping** — Scrape products from 4 different marketplaces in one project
- 🤖 **Anti-Bot Detection** — Uses `puppeteer-extra-plugin-stealth` to bypass bot checks
- 📲 **Telegram Notifications** — Automatically sends scraped products (with images) to a Telegram channel
- 🌏 **Multi-Region Support** — Facebook Marketplace scrapers for different Indonesian cities (Yogyakarta, Jakarta, Surabaya)
- 🔄 **Batch Processing** — Sends Telegram messages in batches with configurable delays to avoid rate limits
- 🍪 **Session Persistence** — Uses exported cookies to maintain logged-in sessions
- 📸 **Debug Snapshots** — Saves HTML dumps and screenshots for troubleshooting selector changes
- 🗃️ **Local Data Caching** — Saves all scraped data as JSON files for further processing

---

## 🌐 Supported Marketplaces

| Platform | Script(s) | Region | Search Query |
|---|---|---|---|
| **Facebook Marketplace** | `fbmp.js`, `fbmp-jkt.js`, `fbmp-sby.js` | Yogyakarta, Jakarta, Surabaya | `kamera` |
| **Mercari** (Japan) | `mercari.js`, `mercari2.js` | Japan | Category 846 (Cameras), Category 97 |
| **Yahoo Auctions** (Japan) | `auctionsyahoo.js` | Japan | Category 2084261691 |
| **Tokopedia** (Indonesia) | `tokped.js` | Indonesia | `dslr` |

---

## 🛠 Tech Stack

| Technology | Purpose |
|---|---|
| [Node.js](https://nodejs.org/) | JavaScript runtime |
| [Puppeteer](https://pptr.dev/) | Headless browser automation |
| [puppeteer-extra](https://github.com/berstend/puppeteer-extra) | Plugin framework for Puppeteer |
| [puppeteer-extra-plugin-stealth](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth) | Anti-bot detection evasion |
| [Axios](https://axios-http.com/) | HTTP client for Telegram API |
| [Telegram Bot API](https://core.telegram.org/bots/api) | Message delivery to channels |

---

## 📁 Project Structure

```
fbmarket-scraper/
├── fbmp.js                # FB Marketplace scraper (Yogyakarta)
├── fbmp-jkt.js            # FB Marketplace scraper (Jakarta)
├── fbmp-sby.js            # FB Marketplace scraper (Surabaya)
├── mercari.js             # Mercari scraper (Category 846 - Cameras)
├── mercari2.js            # Mercari scraper (Category 97)
├── auctionsyahoo.js       # Yahoo Auctions Japan scraper
├── tokped.js              # Tokopedia scraper
├── index_lama.js          # [Legacy] Express API version with Google Sheets
├── cookies.json           # Facebook session cookies (NOT committed)
├── tokped_cookies.json    # Tokopedia session cookies (NOT committed)
├── *.json                 # Scraped data output files (NOT committed)
├── *.log                  # Cron job logs (NOT committed)
├── debug-*.html           # Debug HTML snapshots (NOT committed)
├── debug-*.png            # Debug screenshots (NOT committed)
├── .gitignore             # Git ignore rules
├── package.json           # Node.js dependencies
└── package-lock.json      # Dependency lock file
```

---

## 📋 Prerequisites

- **Node.js** v18 or higher
- **npm** (comes with Node.js)
- **Chromium** (auto-installed by Puppeteer)
- A **Telegram Bot Token** ([create one via @BotFather](https://t.me/BotFather))
- A **Telegram Channel** (with the bot added as an admin)
- **Facebook cookies** exported from your browser (for FB Marketplace scrapers)
- **Tokopedia cookies** exported from your browser (for Tokopedia scraper)

---

## 🚀 Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/bungrahman/fbmarket-scraper.git
   cd fbmarket-scraper
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Set up cookies** (see [Configuration](#-configuration) below)

---

## ⚙️ Configuration

### 1. Telegram Bot Setup

Each scraper file contains two variables you need to configure:

```javascript
const TELEGRAM_TOKEN = 'YOUR_BOT_TOKEN_HERE';
const CHAT_ID = 'YOUR_CHANNEL_ID_HERE';
```

> **💡 Tip:** To get your channel ID, forward a message from your channel to [@userinfobot](https://t.me/userinfobot).

### 2. Facebook Cookies (`cookies.json`)

Export your Facebook login cookies using a browser extension like [EditThisCookie](https://www.editthiscookie.com/) or [Cookie-Editor](https://cookie-editor.cgagnier.ca/), and save them as `cookies.json` in the project root.

```json
[
  {
    "name": "c_user",
    "value": "your_user_id",
    "domain": ".facebook.com",
    "path": "/",
    "secure": true,
    "httpOnly": true
  }
]
```

### 3. Tokopedia Cookies (`tokped_cookies.json`)

Same process as Facebook — export Tokopedia cookies and save as `tokped_cookies.json`.

### 4. Search Queries & Regions

To change what products are scraped, edit the URL in each scraper file:

```javascript
// Example: Change search query in fbmp.js
const url = 'https://www.facebook.com/marketplace/yogyakartacity/search/?query=kamera';
//                                                                         ^^^^^^
//                                                              Change this keyword

// Example: Change category in mercari.js
const url = 'https://jp.mercari.com/en/search?category_id=846&status=on_sale';
//                                                         ^^^
//                                                Change category ID
```

---

## ▶️ Usage

Run any scraper individually:

```bash
# Facebook Marketplace (Yogyakarta)
node fbmp.js

# Facebook Marketplace (Jakarta)
node fbmp-jkt.js

# Facebook Marketplace (Surabaya)
node fbmp-sby.js

# Mercari Japan (Cameras)
node mercari.js

# Mercari Japan (Category 97)
node mercari2.js

# Yahoo Auctions Japan
node auctionsyahoo.js

# Tokopedia
node tokped.js
```

### What happens when you run a scraper:

1. 🚀 A headless Chromium browser launches with stealth mode
2. 🍪 Session cookies are loaded to simulate a logged-in user
3. 🔍 The target marketplace page is opened
4. 🌀 The page is scrolled to load all products
5. 📦 Product data (title, price, location, link, image) is extracted
6. 💾 Results are saved to a local `.json` file
7. 📲 Each product is sent to your Telegram channel with formatted messages

---

## ⏰ Automation (Cron Jobs)

You can automate these scrapers using Linux cron jobs. Example:

```bash
# Edit crontab
crontab -e

# Run FB Marketplace scraper every 6 hours
0 */6 * * * cd /path/to/fbmarket-scraper && /usr/bin/node fbmp.js >> fbmp-cron.log 2>&1

# Run Mercari scraper every 4 hours
0 */4 * * * cd /path/to/fbmarket-scraper && /usr/bin/node mercari.js >> cron-mercari.log 2>&1

# Run Yahoo Auctions scraper daily at 8 AM
0 8 * * * cd /path/to/fbmarket-scraper && /usr/bin/node auctionsyahoo.js >> cron.log 2>&1

# Run Tokopedia scraper every 12 hours
0 */12 * * * cd /path/to/fbmarket-scraper && /usr/bin/node tokped.js >> cron.log 2>&1
```

---

## 🐛 Debugging

Each scraper automatically saves debug files on every run:

| File | Description |
|---|---|
| `debug-fbmp.html` | Full HTML of the last FB Marketplace page |
| `debug-fbmp.png` | Screenshot of the last FB Marketplace page |
| `debug-mercari.html` / `.png` | Mercari page snapshot |
| `debug-tokopedia.html` / `.png` | Tokopedia page snapshot |
| `debug-yahoo.html` / `.png` | Yahoo Auctions page snapshot |

These files help you determine if a scraper broke due to:
- ❌ Selector changes (the marketplace updated their HTML)
- 🚫 Bot detection (your session was blocked)
- 🍪 Expired cookies (you need to re-export)

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/new-marketplace`)
3. **Commit** your changes (`git commit -m 'Add new marketplace scraper'`)
4. **Push** to the branch (`git push origin feature/new-marketplace`)
5. **Open** a Pull Request

### Ideas for contributions:

- [ ] Add environment variables (`.env`) for Telegram token and chat ID
- [ ] Add Shopee / Bukalapak / Amazon Japan scraper
- [ ] Add duplicate detection (avoid sending the same product twice)
- [ ] Create a centralized config file for all scrapers
- [ ] Add a web dashboard to view scraped results

---

## 📄 License

This project is licensed under the **ISC License** — see the [package.json](package.json) for details.

---

## ⚠️ Disclaimer

This project is for **educational and personal use only**. Web scraping may violate the Terms of Service of some websites. Always review and comply with the robots.txt and Terms of Service of any website you scrape. The author is not responsible for any misuse of this software.

---

<p align="center">
  Made with ❤️ by <a href="https://github.com/bungrahman">bungrahman</a>
</p>
