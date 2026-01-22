/**
 * Doodstream Telegram Bot - Entry Point
 * 
 * Bot Telegram untuk mengunduh video dari Doodstream
 * Dengan sistem pembayaran QRIS otomatis via Cashi
 */

require('dotenv').config();
const DoodstreamBot = require('./src/bot');
const createWebhookServer = require('./src/webhook');

// Check for required environment variables
if (!process.env.BOT_TOKEN) {
    console.error('❌ Error: BOT_TOKEN tidak ditemukan!');
    console.error('');
    console.error('Langkah-langkah:');
    console.error('1. Buat file .env di root folder');
    console.error('2. Tambahkan: BOT_TOKEN=your_telegram_bot_token');
    console.error('3. Dapatkan token dari @BotFather di Telegram');
    console.error('');
    process.exit(1);
}

// Create and start bot
const bot = new DoodstreamBot(process.env.BOT_TOKEN);

bot.start().then(() => {
    // Start webhook server for payments
    if (process.env.CASHI_API_KEY) {
        const webhookServer = createWebhookServer(
            bot.paymentHandler,
            bot.quotaManager,
            bot.bot,
            process.env.CASHI_WEBHOOK_SECRET || ''
        );

        const PORT = process.env.WEBHOOK_PORT || 3000;
        webhookServer.listen(PORT, () => {
            console.log(`💳 Payment webhook listening on port ${PORT}`);
            console.log(`   Webhook URL: http://your-domain:${PORT}/webhook/cashi`);
        });
    } else {
        console.log('⚠️  CASHI_API_KEY not set. Payment features disabled.');
    }
}).catch(error => {
    console.error('❌ Failed to start bot:', error.message);
    process.exit(1);
});
