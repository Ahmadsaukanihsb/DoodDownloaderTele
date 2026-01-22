const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Core modules
const DoodstreamExtractor = require('./doodstream');
const QuotaManager = require('./quota');
const PaymentHandler = require('./payment');
const { isValidDoodstreamUrl, formatFileSize, extractUrls } = require('./utils');
const messages = require('./messages');

// Handler modules
const setupCommandHandlers = require('./handlers/commands');
const setupCallbackHandlers = require('./handlers/callbacks');
const setupMessageHandlers = require('./handlers/messages');

class DoodstreamBot {
    constructor(token) {
        // Configure Telegraf with optional local Bot API server
        const telegrafOptions = {};

        if (process.env.BOT_API_URL) {
            // Use local Bot API server (supports up to 2GB files)
            telegrafOptions.telegram = {
                apiRoot: process.env.BOT_API_URL // e.g., http://localhost:8081
            };
            console.log('📡 Using Local Bot API Server:', process.env.BOT_API_URL);
        }

        this.bot = new Telegraf(token, telegrafOptions);
        this.extractor = new DoodstreamExtractor();
        this.quotaManager = new QuotaManager('./data');
        this.paymentHandler = new PaymentHandler(process.env.CASHI_API_KEY || '', './data');

        // Configuration
        this.downloadDir = process.env.DOWNLOAD_DIR || './downloads';
        this.ADMIN_ID = process.env.ADMIN_ID || '';
        this.CHANNEL_USERNAME = process.env.CHANNEL_USERNAME || '@your_channel';
        this.CHANNEL_ID = process.env.CHANNEL_ID || '-1001234567890';
        this.COOLDOWN_TIME = 30000; // 30 seconds

        // State management
        this.waitingForUrl = new Map();
        this.userCooldowns = new Map();

        // Queue system
        this.downloadQueue = [];
        this.isProcessing = false;
        this.MAX_CONCURRENT = 1;
        this.activeDownloads = 0;

        // Ensure directories exist
        if (!fs.existsSync(this.downloadDir)) {
            fs.mkdirSync(this.downloadDir, { recursive: true });
        }

        this.setupCommands();
        this.setupHandlers();
    }

    /**
     * Setup bot commands in Telegram menu
     */
    setupCommands() {
        this.bot.telegram.setMyCommands([
            { command: 'start', description: 'Mulai bot' },
            { command: 'help', description: 'Bantuan penggunaan' },
            { command: 'download', description: 'Download video' },
            { command: 'quota', description: 'Cek saldo quota' },
            { command: 'topup', description: 'Beli quota' },
            { command: 'queue', description: 'Cek antrian download' }
        ]);
    }

    /**
     * Setup all handlers (commands, callbacks, messages)
     */
    setupHandlers() {
        setupCommandHandlers(this);
        setupCallbackHandlers(this);
        setupMessageHandlers(this);
    }

    /**
     * Handle video download request
     * @param {Context} ctx 
     * @param {string} url 
     * @param {object} options - { skipCooldown: boolean, skipQuotaCheck: boolean }
     */
    async handleDownload(ctx, url, options = {}) {
        const userId = ctx.from.id;
        const chatId = ctx.chat.id;
        const { skipCooldown = false, skipQuotaCheck = false } = options;

        // Check subscription
        const isSubscribed = await this.checkSubscription(userId);
        if (!isSubscribed) return this.sendSubscribeMessage(ctx);

        // Check quota (skip if already checked in batch)
        if (!skipQuotaCheck) {
            const downloadCost = this.quotaManager.DOWNLOAD_COST;
            if (!this.quotaManager.hasEnoughQuota(userId, downloadCost)) {
                const currentQuota = this.quotaManager.getQuota(userId);
                return ctx.replyWithMarkdown(
                    messages.getQuotaNotEnoughMessage(currentQuota, downloadCost),
                    Markup.inlineKeyboard([[Markup.button.callback('💳 Top Up', 'show_topup')]])
                );
            }
        }

        // Check cooldown (skip for batch downloads)
        if (!skipCooldown) {
            const lastDownload = this.userCooldowns.get(userId);
            if (lastDownload && Date.now() - lastDownload < this.COOLDOWN_TIME) {
                const timeLeft = Math.ceil((this.COOLDOWN_TIME - (Date.now() - lastDownload)) / 1000);
                return ctx.reply(`⏳ Tunggu ${timeLeft} detik sebelum download lagi.`);
            }
            this.userCooldowns.set(userId, Date.now());
        }

        // Validate URL
        if (!isValidDoodstreamUrl(url)) {
            return ctx.reply('❌ URL tidak valid.', Markup.inlineKeyboard([
                [Markup.button.callback('🔗 Support URL', 'platforms')]
            ]));
        }

        // Add to queue
        const queuePos = this.downloadQueue.length + this.activeDownloads + 1;
        const statusMsg = queuePos > 1
            ? await ctx.reply(`📋 Antrian #${queuePos}. Mohon tunggu...`)
            : await ctx.reply('🔍 Mencari video...');

        this.downloadQueue.push({
            userId,
            chatId,
            url,
            statusMsgId: statusMsg.message_id,
            ctx
        });

        this.processQueue();
    }

    /**
     * Process download queue
     */
    async processQueue() {
        if (this.isProcessing || this.downloadQueue.length === 0) return;
        if (this.activeDownloads >= this.MAX_CONCURRENT) return;

        this.isProcessing = true;

        while (this.downloadQueue.length > 0 && this.activeDownloads < this.MAX_CONCURRENT) {
            const item = this.downloadQueue.shift();
            this.activeDownloads++;

            // Update remaining queue positions
            this.updateQueuePositions();

            await this.processDownload(item);
            this.activeDownloads--;
        }

        this.isProcessing = false;
    }

    /**
     * Update queue position messages for waiting users
     */
    async updateQueuePositions() {
        for (let i = 0; i < this.downloadQueue.length; i++) {
            const item = this.downloadQueue[i];
            try {
                await item.ctx.telegram.editMessageText(
                    item.chatId,
                    item.statusMsgId,
                    null,
                    `📋 Antrian #${i + 1 + this.activeDownloads}. Mohon tunggu...`
                );
            } catch (e) {
                // Ignore edit errors
            }
        }
    }

    /**
     * Process a single download from queue
     * @param {Object} item 
     */
    async processDownload(item) {
        const { ctx, url, statusMsgId, chatId, userId } = item;
        let extractionDone = false;

        // Animation
        const animationInterval = setInterval(async () => {
            if (extractionDone) return;
            try {
                await ctx.telegram.editMessageText(chatId, statusMsgId, null, '⏳ Mengekstrak video...');
            } catch (e) { }
        }, 3000);

        try {
            // Extract video info
            const videoInfo = await Promise.race([
                this.extractor.extractVideoInfo(url),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Extraction timeout')), 60000)
                )
            ]);

            extractionDone = true;
            clearInterval(animationInterval);

            await ctx.telegram.editMessageText(chatId, statusMsgId, null, '📥 Mengunduh video...');

            // Download and send
            const referer = new URL(url).origin + '/';
            const filePath = path.join(this.downloadDir, `${Date.now()}_video.mp4`);

            try {
                console.log('[Bot] Downloading video file...');

                const response = await axios({
                    method: 'get',
                    url: videoInfo.videoUrl,
                    responseType: 'stream',
                    timeout: 300000,
                    headers: { 'Referer': referer }
                });

                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);
                await new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });

                const actualSize = fs.statSync(filePath).size;
                console.log(`[Bot] Download complete (${formatFileSize(actualSize)}), uploading to Telegram...`);

                // Always try to upload to Telegram
                await ctx.telegram.editMessageText(chatId, statusMsgId, null, `📤 Mengunggah ke Telegram... (${formatFileSize(actualSize)})`);

                try {
                    await ctx.replyWithVideo(
                        { source: filePath },
                        {
                            caption: `🎬 *${videoInfo.title || 'Video'}*\n📁 ${formatFileSize(actualSize)}`,
                            parse_mode: 'Markdown'
                        }
                    );

                    // Deduct quota ONLY after successful send
                    this.quotaManager.deductQuota(userId);
                    const newQuota = this.quotaManager.getQuota(userId);

                    await ctx.telegram.deleteMessage(chatId, statusMsgId).catch(() => { });
                    await ctx.reply(`💰 Sisa quota: *${newQuota}*`, { parse_mode: 'Markdown' });
                    console.log('[Bot] Video sent successfully!');
                } catch (uploadError) {
                    console.log('[Bot] Upload failed, sending link instead:', uploadError.message);

                    // Deduct quota even if upload fails but link is provided
                    this.quotaManager.deductQuota(userId);
                    const newQuota = this.quotaManager.getQuota(userId);

                    await ctx.telegram.editMessageText(
                        chatId,
                        statusMsgId,
                        null,
                        `✅ *Video Siap!*\n\n📁 Size: ${formatFileSize(actualSize)}\n💰 Sisa quota: ${newQuota}\n\n⚠️ File terlalu besar untuk Telegram.\n\n⬇️ Link:\n\`${videoInfo.videoUrl}\``,
                        { parse_mode: 'Markdown', disable_web_page_preview: true }
                    );
                    await ctx.reply('📥 Download:', Markup.inlineKeyboard([
                        Markup.button.url('⬇️ Download', videoInfo.videoUrl)
                    ]));
                }

                fs.unlinkSync(filePath);
            } catch (downloadError) {
                console.error('[Bot] Download error:', downloadError.message);
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

                // Deduct quota even if download fails but link is provided
                this.quotaManager.deductQuota(userId);
                const newQuota = this.quotaManager.getQuota(userId);

                await ctx.telegram.editMessageText(
                    chatId,
                    statusMsgId,
                    null,
                    `✅ Link ditemukan!\n\n💰 Sisa quota: ${newQuota}\n\n⬇️ Download:\n\`${videoInfo.videoUrl}\``,
                    { parse_mode: 'Markdown', disable_web_page_preview: true }
                );
                await ctx.reply('📥 Download:', Markup.inlineKeyboard([
                    Markup.button.url('⬇️ Download', videoInfo.videoUrl)
                ]));
            }
        } catch (error) {
            extractionDone = true;
            clearInterval(animationInterval);
            console.error('Download error:', error.message);

            await ctx.telegram.editMessageText(
                chatId,
                statusMsgId,
                null,
                '❌ Gagal mengekstrak video. Video mungkin tidak tersedia.',
                Markup.inlineKeyboard([
                    [Markup.button.callback('🔄 Coba Lagi', 'download')],
                    [Markup.button.callback('🔙 Menu', 'back_to_start')]
                ])
            );
        }
    }

    /**
     * Get queue status
     */
    getQueueStatus() {
        return {
            queueLength: this.downloadQueue.length,
            activeDownloads: this.activeDownloads,
            isProcessing: this.isProcessing
        };
    }

    /**
     * Check if user is subscribed to required channel
     */
    async checkSubscription(userId) {
        if (!this.CHANNEL_ID || this.CHANNEL_ID === '-1001234567890') {
            return true;
        }

        try {
            const member = await this.bot.telegram.getChatMember(this.CHANNEL_ID, userId);
            return ['creator', 'administrator', 'member'].includes(member.status);
        } catch (error) {
            console.log(`[Subscribe Check] Error:`, error.message);
            if (error.message.includes('inaccessible') || error.message.includes('not found')) {
                return true;
            }
            return false;
        }
    }

    /**
     * Send subscription required message
     */
    async sendSubscribeMessage(ctx) {
        await ctx.replyWithMarkdown(
            messages.getSubscribeMessage(this.CHANNEL_USERNAME),
            Markup.inlineKeyboard([
                [Markup.button.url('📢 Join Channel', `https://t.me/${this.CHANNEL_USERNAME.replace('@', '')}`)],
                [Markup.button.callback('✅ Sudah Join', 'check_subscription')]
            ])
        );
    }

    /**
     * Send help message
     */
    async sendHelpMessage(ctx) {
        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('🔗 Support URL', 'platforms')],
            [Markup.button.callback('🔙 Kembali', 'back_to_start')]
        ]);

        if (ctx.callbackQuery) {
            await ctx.editMessageText(messages.getHelpMessage(), { parse_mode: 'Markdown', ...kb });
        } else {
            await ctx.replyWithMarkdown(messages.getHelpMessage(), kb);
        }
    }

    /**
     * Send platforms message
     */
    async sendPlatformsMessage(ctx) {
        const kb = Markup.inlineKeyboard([
            [Markup.button.callback('🔙 Kembali', 'back_to_start')]
        ]);

        if (ctx.callbackQuery) {
            await ctx.editMessageText(messages.getPlatformsMessage(), { parse_mode: 'Markdown', ...kb });
        } else {
            await ctx.replyWithMarkdown(messages.getPlatformsMessage(), kb);
        }
    }

    /**
     * Send top up message with package buttons
     */
    async sendTopUpMessage(ctx) {
        const packages = this.paymentHandler.getPackages();
        const buttons = packages.map(pkg =>
            [Markup.button.callback(`💳 ${pkg.label} - Rp ${pkg.price.toLocaleString('id-ID')}`, `buy_${pkg.id}`)]
        );
        buttons.push([Markup.button.callback('🔙 Kembali', 'back_to_start')]);

        const message = `
💳 *Top Up Quota via QRIS*

Pilih paket yang diinginkan:

📱 *Pembayaran Otomatis*
• Scan QRIS dengan e-wallet/m-banking
• Quota langsung masuk setelah bayar
• Support: GoPay, OVO, DANA, ShopeePay, dll

⚡ *1 download = 15 quota*
        `;

        const kb = Markup.inlineKeyboard(buttons);

        if (ctx.callbackQuery) {
            await ctx.editMessageText(message, { parse_mode: 'Markdown', ...kb });
        } else {
            await ctx.replyWithMarkdown(message, kb);
        }
    }

    /**
     * Start the bot
     */
    async start() {
        console.log('🤖 Starting Doodstream Bot...');
        await this.extractor.init();
        this.bot.launch();
        console.log('✅ Bot is running!');

        process.once('SIGINT', () => this.stop('SIGINT'));
        process.once('SIGTERM', () => this.stop('SIGTERM'));
    }

    /**
     * Stop the bot gracefully
     */
    async stop(signal) {
        console.log(`\n🛑 Received ${signal}, shutting down...`);
        await this.extractor.close();
        this.bot.stop(signal);
        console.log('👋 Bot stopped gracefully');
        process.exit(0);
    }
}

module.exports = DoodstreamBot;
