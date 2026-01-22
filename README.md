# 🎬 Doodstream Telegram Bot

Bot Telegram untuk download video dari Doodstream dan platform video hosting lainnya.

## ✨ Fitur

| Fitur | Deskripsi |
|-------|-----------|
| 📥 Download Video | Download dari berbagai platform video hosting |
| 📦 Batch Download | Download hingga 20 video sekaligus |
| ⚡ Parallel Processing | Proses 2 video secara bersamaan |
| 🔄 Auto Retry | Retry otomatis hingga 3x jika gagal |
| 💰 Quota System | Sistem quota dengan daily bonus |
| 💳 QRIS Payment | Top-up via Cashi QRIS |
| 📢 Force Subscribe | Wajib subscribe channel sebelum pakai |
| 🛡️ Stealth Mode | Puppeteer dengan stealth plugin |
| 🐳 Docker Support | Deploy dengan Docker |

## 📋 Platform yang Didukung

- Doodstream (dood.yt, dood-hd.com, dll)
- Filemoon
- Filelions
- StreamTape
- Vidhide
- VOE
- Lixey
- Dan 50+ mirror domains

## 🚀 Instalasi

### Prasyarat
- Node.js 18+
- npm atau yarn
- Chromium (untuk Puppeteer)

### Setup

```bash
# Clone repository
git clone <repo-url>
cd doodstream-telegram-bot

# Install dependencies
npm install

# Copy dan edit environment
cp .env.example .env

# Jalankan bot
npm start
```

## ⚙️ Konfigurasi (.env)

```env
# Telegram Bot
BOT_TOKEN=your_bot_token
ADMIN_ID=your_telegram_id

# Force Subscribe
CHANNEL_USERNAME=@your_channel
CHANNEL_ID=-1001234567890

# Payment (Cashi QRIS)
CASHI_API_KEY=CASHI-XXXXXXXX
CASHI_WEBHOOK_SECRET=sk_xxxxxxxxxxxx
WEBHOOK_PORT=3000

# Extractor Mode: puppeteer atau ytdlp
EXTRACTOR_MODE=puppeteer

# Local Bot API (opsional, untuk upload >50MB)
# BOT_API_URL=http://localhost:8081
```

## 🤖 Command Bot

### User Commands
| Command | Deskripsi |
|---------|-----------|
| `/start` | Mulai bot |
| `/quota` | Cek sisa quota |
| `/bonus` | Klaim daily bonus |
| `/topup` | Beli quota via QRIS |
| `/download <url>` | Download video |
| `/platforms` | Lihat platform yang didukung |

### Admin Commands
| Command | Deskripsi |
|---------|-----------|
| `/addquota <user_id> <amount>` | Tambah quota user |

## 🐳 Docker Deployment

```bash
# Build dan jalankan
docker-compose up -d --build

# Lihat logs
docker-compose logs -f

# Stop
docker-compose down
```

## 📁 Struktur Project

```
doodstream-telegram-bot/
├── index.js              # Entry point
├── src/
│   ├── bot.js            # Bot utama
│   ├── doodstream.js     # Extractor Puppeteer
│   ├── ytdlp.js          # Extractor yt-dlp
│   ├── http-extractor.js # Extractor HTTP
│   ├── quota.js          # Quota manager
│   ├── payment.js        # Payment handler
│   ├── webhook.js        # Webhook server
│   ├── logger.js         # Custom logger
│   ├── utils.js          # Utilitas
│   ├── messages.js       # Template pesan
│   └── handlers/
│       ├── commands.js   # Command handlers
│       ├── callbacks.js  # Callback handlers
│       ├── messages.js   # Message handlers
│       └── subscription.js # Subscribe checker
├── data/                 # Data storage (JSON)
├── downloads/            # Temp download folder
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

## 🔧 Extractor Modes

| Mode | Kecepatan | Keandalan | Deskripsi |
|------|-----------|-----------|-----------|
| `puppeteer` | Sedang | ⭐⭐⭐ | Browser headless dengan stealth |
| `ytdlp` | Cepat | ⭐⭐ | CLI tool (perlu install) |

## 💰 Quota System

- **Daily Bonus:** 15 quota/hari
- **Download Cost:** 15 quota/video
- **Top-up:** Via QRIS Cashi

## 📝 Changelog

### v1.0.0
- Initial release
- Batch download dengan retry logic
- Puppeteer Stealth mode
- Docker support
- QRIS Payment integration

## 📄 License

MIT License
