/**
 * Doodstream Telegram Bot - Entry Point
 * 
 * Bot Telegram untuk mengunduh video dari Doodstream
 * Dengan sistem pembayaran QRIS otomatis via Cashi
 */

require('dotenv').config();
const DoodstreamBot = require('./src/bot');
const createWebhookServer = require('./src/webhook');
const logger = require('./src/logger');

// Check for required environment variables
if (!process.env.BOT_TOKEN) {
    logger.error('BOT_TOKEN tidak ditemukan!');
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

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error.message}`);
    // Don't exit - keep bot running
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection: ${reason}`);
    // Don't exit - keep bot running
});

bot.start().then(() => {
    logger.success('Bot berhasil dijalankan!');

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
            logger.payment(`Webhook server aktif di port ${PORT}`);
            logger.info(`Webhook URL: https://your-domain/webhook/cashi`);
        });
    } else {
        logger.warn('CASHI_API_KEY tidak diset. Fitur payment dinonaktifkan.');
    }
}).catch(error => {
    logger.error(`Gagal menjalankan bot: ${error.message}`);
    process.exit(1);
});
