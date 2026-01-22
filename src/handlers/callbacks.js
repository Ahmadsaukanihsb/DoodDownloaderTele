const { Markup } = require('telegraf');

/**
 * Setup callback query handlers
 * @param {DoodstreamBot} bot 
 */
function setupCallbackHandlers(bot) {
    // Show quota
    bot.bot.action('show_quota', async (ctx) => {
        await ctx.answerCbQuery();
        const userId = ctx.from.id;
        const quota = bot.quotaManager.getQuota(userId);

        await ctx.editMessageText(
            `💰 *Saldo Quota: ${quota}*`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('💳 Top Up', 'show_topup')],
                    [Markup.button.callback('🔙 Kembali', 'back_to_start')]
                ])
            }
        );
    });

    // Show topup
    bot.bot.action('show_topup', async (ctx) => {
        await ctx.answerCbQuery();
        await bot.sendTopUpMessage(ctx);
    });

    // Show history
    bot.bot.action('show_history', async (ctx) => {
        await ctx.answerCbQuery();
        const history = bot.quotaManager.getTransactionHistory(ctx.from.id, 5);

        let text = '📜 *Riwayat Transaksi:*\n\n';
        if (history.length === 0) {
            text += '_Belum ada transaksi._';
        } else {
            history.forEach((t, i) => {
                const sign = t.amount > 0 ? '+' : '';
                text += `${i + 1}. ${sign}${t.amount} - ${t.description}\n`;
            });
        }

        await ctx.editMessageText(text, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🔙 Kembali', 'back_to_start')]
            ])
        });
    });

    // Check subscription
    bot.bot.action('check_subscription', async (ctx) => {
        await ctx.answerCbQuery();
        const isSubscribed = await bot.checkSubscription(ctx.from.id);

        if (isSubscribed) {
            await ctx.editMessageText(
                '✅ *Terverifikasi!* Kirim /start untuk mulai.',
                { parse_mode: 'Markdown' }
            );
        } else {
            await ctx.editMessageText(
                `❌ Anda belum bergabung ke ${bot.CHANNEL_USERNAME}`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.url('📢 Join Channel', `https://t.me/${bot.CHANNEL_USERNAME.replace('@', '')}`)],
                        [Markup.button.callback('✅ Sudah Join', 'check_subscription')]
                    ])
                }
            );
        }
    });

    // Back to start - show full menu like /start
    bot.bot.action('back_to_start', async (ctx) => {
        await ctx.answerCbQuery();
        const userId = ctx.from.id;
        const quota = bot.quotaManager.getQuota(userId);
        const { canClaim } = bot.quotaManager.canClaimDailyBonus(userId);
        const bonusText = canClaim ? '🎁 Bonus Harian' : '⏰ Bonus (Claimed)';

        await ctx.editMessageText(
            `🎬 *Selamat datang di Video Downloader Bot!*\n\n💰 Quota Anda: *${quota}*\n📥 Biaya: *15 quota/download*\n\nKirim link video untuk download!`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('📥 Download Video', 'download')],
                    [Markup.button.callback('💰 Cek Quota', 'show_quota'), Markup.button.callback('💳 Top Up', 'show_topup')],
                    [Markup.button.callback(bonusText, 'claim_bonus')],
                    [Markup.button.callback('📖 Bantuan', 'help'), Markup.button.callback('🔗 Support URL', 'platforms')]
                ])
            }
        );
    });

    // Download action
    bot.bot.action('download', async (ctx) => {
        await ctx.answerCbQuery();
        bot.waitingForUrl.set(ctx.from.id, true);

        await ctx.editMessageText(
            `📥 *Download Video*\n\nKirim link video yang ingin didownload.\n\n💰 Biaya: *15 quota/download*`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('❌ Batal', 'cancel_download')]
                ])
            }
        );
    });

    // Cancel download
    bot.bot.action('cancel_download', async (ctx) => {
        await ctx.answerCbQuery();
        bot.waitingForUrl.delete(ctx.from.id);

        await ctx.editMessageText(
            '❌ Download dibatalkan.',
            Markup.inlineKeyboard([
                [Markup.button.callback('🔙 Kembali', 'back_to_start')]
            ])
        );
    });

    // Help action
    bot.bot.action('help', async (ctx) => {
        await ctx.answerCbQuery();
        await bot.sendHelpMessage(ctx);
    });

    // Platforms action
    bot.bot.action('platforms', async (ctx) => {
        await ctx.answerCbQuery();
        await bot.sendPlatformsMessage(ctx);
    });

    // Payment package callbacks
    bot.bot.action(/^buy_(.+)$/, async (ctx) => {
        await ctx.answerCbQuery();
        const packageId = ctx.match[1];

        try {
            const result = await bot.paymentHandler.createOrder(ctx.from.id, packageId);

            if (result.success) {
                const message = `
💳 *Invoice Pembayaran*

📦 Paket: ${result.quota} Quota
💰 Total: *Rp ${result.amount.toLocaleString('id-ID')}*
⏱️ Berlaku: ${result.expiresIn}

📱 *Cara Bayar:*
1️⃣ Scan QRIS dengan e-wallet/m-banking
2️⃣ Pastikan nominal sesuai
3️⃣ Quota otomatis masuk setelah bayar

🔗 Atau buka: ${result.checkoutUrl}

_Order ID: ${result.orderId}_
                `;

                await ctx.editMessageText(message, {
                    parse_mode: 'Markdown',
                    disable_web_page_preview: true,
                    ...Markup.inlineKeyboard([
                        [Markup.button.url('📱 Bayar Sekarang', result.checkoutUrl)],
                        [Markup.button.callback('🔄 Cek Status', `check_payment_${result.orderId}`)],
                        [Markup.button.callback('❌ Batal', 'back_to_start')]
                    ])
                });
            }
        } catch (error) {
            console.error('[Payment] Error:', error.message);
            await ctx.editMessageText('❌ Gagal membuat invoice. Coba lagi nanti.', {
                ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Kembali', 'show_topup')]])
            });
        }
    });

    // Check payment status
    bot.bot.action(/^check_payment_(.+)$/, async (ctx) => {
        await ctx.answerCbQuery('Mengecek status...');
        const orderId = ctx.match[1];

        const status = await bot.paymentHandler.checkStatus(orderId);
        const tx = bot.paymentHandler.getTransaction(orderId);

        if (status.status === 'SETTLED') {
            // Already processed by webhook, just confirm
            const newQuota = bot.quotaManager.getQuota(ctx.from.id);
            await ctx.editMessageText(
                `✅ *Pembayaran Berhasil!*\n\n💰 Saldo: *${newQuota} quota*\n\n_Terima kasih!_`,
                { parse_mode: 'Markdown', ...Markup.inlineKeyboard([[Markup.button.callback('🔙 Menu', 'back_to_start')]]) }
            );
        } else if (status.status === 'PENDING' || tx?.status === 'PENDING') {
            await ctx.answerCbQuery('⏳ Menunggu pembayaran...', { show_alert: true });
        } else {
            await ctx.answerCbQuery('❌ Pembayaran expired atau gagal', { show_alert: true });
        }
    });

    // Claim daily bonus
    bot.bot.action('claim_bonus', async (ctx) => {
        await ctx.answerCbQuery();
        const userId = ctx.from.id;
        const result = bot.quotaManager.claimDailyBonus(userId);

        if (result.success) {
            await ctx.editMessageText(
                `🎁 *Daily Bonus Claimed!*\n\n` +
                `✅ +${result.quota} quota\n` +
                `💰 Saldo baru: *${result.newBalance} quota*\n\n` +
                `_Kembali besok untuk bonus lagi!_`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('📥 Download Video', 'download')],
                        [Markup.button.callback('🔙 Menu', 'back_to_start')]
                    ])
                }
            );
        } else {
            const { nextClaimIn } = bot.quotaManager.canClaimDailyBonus(userId);
            await ctx.editMessageText(
                `⏰ *Sudah Diklaim!*\n\n` +
                `Anda sudah mengambil bonus hari ini.\n` +
                `🕐 Kembali dalam: *${nextClaimIn} jam*\n\n` +
                `_Bonus reset setiap hari pukul 00:00_`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('🔙 Menu', 'back_to_start')]
                    ])
                }
            );
        }
    });

    // Admin refresh stats
    bot.bot.action('admin_refresh', async (ctx) => {
        await ctx.answerCbQuery('Refreshing...');

        if (String(ctx.from.id) !== String(bot.ADMIN_ID)) {
            return;
        }

        const stats = bot.quotaManager.getStats();
        const queueStatus = bot.getQueueStatus();

        await ctx.editMessageText(
            `📊 *Admin Dashboard*\n\n` +
            `👥 *Users:*\n` +
            `• Total: ${stats.totalUsers}\n` +
            `• Aktif hari ini: ${stats.activeToday}\n\n` +
            `📈 *Statistics:*\n` +
            `• Total downloads: ${stats.totalDownloads}\n` +
            `• Quota issued: ${stats.totalQuotaIssued}\n\n` +
            `📋 *Queue:*\n` +
            `• Active: ${queueStatus.activeDownloads}\n` +
            `• Waiting: ${queueStatus.queueLength}\n\n` +
            `_Last updated: ${new Date().toLocaleString('id-ID')}_`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('📢 Broadcast', 'admin_broadcast')],
                    [Markup.button.callback('🔄 Refresh', 'admin_refresh')]
                ])
            }
        );
    });

    // Admin broadcast button
    bot.bot.action('admin_broadcast', async (ctx) => {
        await ctx.answerCbQuery();

        if (String(ctx.from.id) !== String(bot.ADMIN_ID)) {
            return;
        }

        await ctx.editMessageText(
            `📢 *Broadcast Message*\n\n` +
            `Untuk mengirim broadcast, gunakan command:\n\n` +
            `\`/broadcast <pesan>\`\n\n` +
            `Contoh:\n` +
            `\`/broadcast 🎉 Promo spesial! Top up hari ini dapat bonus 50%!\``,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🔙 Kembali', 'admin_refresh')]
                ])
            }
        );
    });

    // Batch download confirmation
    bot.bot.action(/^batch_confirm_(.+)$/, async (ctx) => {
        await ctx.answerCbQuery('Memproses batch download...');
        const batchId = ctx.match[1];

        if (!bot.pendingBatch || !bot.pendingBatch.has(batchId)) {
            return ctx.editMessageText('❌ Batch expired. Silakan kirim ulang link-link video.');
        }

        const batch = bot.pendingBatch.get(batchId);
        const userId = ctx.from.id;

        if (String(batch.userId) !== String(userId)) {
            return ctx.editMessageText('❌ Batch ini bukan milik Anda.');
        }

        const urls = batch.urls;
        const totalCost = urls.length * bot.quotaManager.DOWNLOAD_COST;
        const currentQuota = bot.quotaManager.getQuota(userId);

        if (currentQuota < totalCost) {
            return ctx.editMessageText('❌ Quota tidak cukup untuk batch ini.', {
                ...Markup.inlineKeyboard([[Markup.button.callback('💳 Top Up', 'show_topup')]])
            });
        }

        // Delete batch from pending
        bot.pendingBatch.delete(batchId);

        // Update message to show progress
        await ctx.editMessageText(
            `📦 *Batch Download Started!*\n\n` +
            `🔗 Total: ${urls.length} video\n` +
            `⏳ Memproses ke antrian...\n\n` +
            `_Progress akan dikirim per video._`,
            { parse_mode: 'Markdown' }
        );

        // Add all URLs to queue (skip cooldown and quota check since we already verified)
        let queued = 0;
        for (const url of urls) {
            await bot.handleDownload(ctx, url, { skipCooldown: true, skipQuotaCheck: true });
            queued++;

            // Small delay between adds
            await new Promise(r => setTimeout(r, 100));
        }

        await ctx.reply(
            `✅ *${queued} video* ditambahkan ke antrian!\n\n` +
            `📋 Video akan diproses secara berurutan.\n` +
            `💰 Total biaya: ${totalCost} quota`,
            { parse_mode: 'Markdown' }
        );
    });
}

module.exports = setupCallbackHandlers;
