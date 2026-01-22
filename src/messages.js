const { Markup } = require('telegraf');

/**
 * Message templates for the bot
 */
const messages = {
    /**
     * Help message content
     */
    getHelpMessage() {
        return `
📖 *Panduan Penggunaan Bot*

*Commands:*
• \`/start\` - Mulai bot
• \`/help\` - Bantuan
• \`/quota\` - Cek saldo quota
• \`/topup\` - Beli quota
• \`/download <url>\` - Download video
• \`/queue\` - Cek antrian

*Cara Pakai:*
1️⃣ Copy link video dari platform yang didukung
2️⃣ Kirim link ke chat bot
3️⃣ Tunggu proses download
4️⃣ Video akan dikirim ke chat Anda!

*Harga:*
• 1 download = 15 quota
• 100 quota = Rp 10.000
• User baru dapat 50 quota gratis!

*Tips:*
✅ Video max 50MB dikirim langsung ke Telegram
✅ Video lebih besar akan mendapat link download
        `;
    },

    /**
     * Platforms list message
     */
    getPlatformsMessage() {
        return `
🔗 *Support URL*

*DOODSTREAM:*
dood.watch, doodstream.com, dood.to
dood.la, dood.pm, dood.wf, d00d.com
myvidplay.com, dood-hd.com, lixey.org

*FILEMOON:*
filemoon.sx, filemoon.to, moonmov.pro
kerapoxy.cc, runstream.co

*FILELIONS:*
filelions.com, mlions.pro, alions.pro

*STREAMTAPE:*
streamtape.com, strtape.cloud, streamta.pe

*VOE:*
voe.sx, voe-unblock.com, voeunblck.com

*LAINNYA:*
gofile.io, mp4upload.com, veev.to
vidhide.com, streamwish.to

_Total: 300+ domain didukung!_ ✅
        `;
    },

    /**
     * Top up message content
     */
    getTopUpMessage(adminContact) {
        return `
💳 *Top Up Quota*

📦 *Paket Tersedia:*

┌─────────────────────────
│ 100 Quota  │ Rp 10.000
├─────────────────────────
│ 250 Quota  │ Rp 22.500 (10% OFF)
├─────────────────────────
│ 500 Quota  │ Rp 40.000 (20% OFF)
├─────────────────────────
│ 1000 Quota │ Rp 70.000 (30% OFF)
└─────────────────────────

💰 *1 download = 15 quota*

📞 *Cara Top Up:*
1️⃣ Pilih paket yang diinginkan
2️⃣ Hubungi admin: ${adminContact}
3️⃣ Transfer ke rekening yang diberikan
4️⃣ Kirim bukti transfer
5️⃣ Quota akan ditambahkan!

_Pembayaran via Transfer Bank, QRIS, atau E-Wallet_
        `;
    },

    /**
     * Subscribe required message
     */
    getSubscribeMessage(channelUsername) {
        return `
🔒 *Akses Terbatas!*

Untuk menggunakan bot ini, Anda harus bergabung ke channel kami terlebih dahulu.

📢 *Channel:* ${channelUsername}

Setelah bergabung, tekan tombol "✅ Sudah Join" di bawah.
        `;
    },

    /**
     * Quota not enough message
     */
    getQuotaNotEnoughMessage(currentQuota, downloadCost) {
        return `
❌ *Quota Tidak Cukup!*

📊 Saldo Anda: *${currentQuota} quota*
📥 Biaya download: *${downloadCost} quota*

_Silakan top up quota untuk melanjutkan._
        `;
    },

    /**
     * Download success message
     */
    getDownloadSuccessMessage(title, size, remainingQuota) {
        return `
✅ *Download Berhasil!*

🎬 *${title || 'Video'}*
📁 Size: ${size}
💰 Sisa quota: ${remainingQuota}
        `;
    }
};

module.exports = messages;
