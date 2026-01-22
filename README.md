# 🎬 Doodstream Telegram Bot

Bot Telegram untuk mengunduh video dari Doodstream dengan mudah.

## ✨ Fitur

- 📥 Download video dari berbagai domain Doodstream
- 🔗 Kirim URL langsung atau gunakan command `/download`
- 📹 Video kecil (<50MB) dikirim langsung ke Telegram
- 🔗 Video besar dikirim sebagai download link
- ⚡ Ekstraksi link otomatis dengan Puppeteer

## 📋 Prasyarat

- Node.js v18 atau lebih baru
- npm atau yarn
- Token bot Telegram dari [@BotFather](https://t.me/BotFather)

## 🚀 Instalasi

1. **Clone atau masuk ke folder project**
   ```bash
   cd DOODSTREAM
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   # Copy file contoh
   cp .env.example .env
   
   # Edit file .env dan masukkan token bot Anda
   # BOT_TOKEN=your_telegram_bot_token_here
   ```

4. **Jalankan bot**
   ```bash
   # Mode production
   npm start
   
   # Mode development (auto-restart saat ada perubahan)
   npm run dev
   ```

## 📖 Cara Mendapatkan Bot Token

1. Buka [@BotFather](https://t.me/BotFather) di Telegram
2. Kirim `/newbot`
3. Ikuti instruksi untuk memberi nama bot
4. Salin token yang diberikan
5. Tempelkan token ke file `.env`

## 💬 Penggunaan Bot

### Commands

| Command | Deskripsi |
|---------|-----------|
| `/start` | Mulai bot dan lihat panduan |
| `/help` | Bantuan penggunaan bot |
| `/download <url>` | Download video dari URL |

### Cara Download

1. **Langsung kirim URL:**
   ```
   https://dood.la/d/xxxxx
   ```

2. **Atau gunakan command:**
   ```
   /download https://dood.to/e/xxxxx
   ```

### URL yang Didukung

- `dood.la`, `dood.to`, `dood.wf`
- `dood.pm`, `dood.re`, `dood.cx`
- `dood.so`, `dood.watch`, `dood.stream`
- `doodstream.com`, `ds2play.com`
- `doods.pro`, `myvidplay.com`
- `dood-hd.com`

## 📁 Struktur Project

```
DOODSTREAM/
├── index.js           # Entry point
├── package.json       # Dependencies
├── .env               # Environment variables (create this)
├── .env.example       # Example env file
├── .gitignore         # Git ignore
├── README.md          # Documentation
└── src/
    ├── bot.js         # Telegram bot logic
    ├── doodstream.js  # Video link extractor  
    └── utils.js       # Utility functions
```

## ⚠️ Troubleshooting

### Bot tidak merespon
- Pastikan token bot valid
- Cek koneksi internet
- Restart bot

### Gagal ekstrak video
- Pastikan URL valid dan video masih tersedia
- Beberapa video mungkin dilindungi atau sudah dihapus
- Coba lagi beberapa saat kemudian

### Error Puppeteer
- Pastikan Chromium terinstall dengan benar
- Cek log error untuk detail

## 📝 License

MIT License

## 🤝 Contributing

Pull requests are welcome!
