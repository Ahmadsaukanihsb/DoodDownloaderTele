const express = require('express');

/**
 * Create webhook server for Cashi payments
 * @param {PaymentHandler} paymentHandler 
 * @param {QuotaManager} quotaManager 
 * @param {Telegraf} bot 
 * @param {string} webhookSecret 
 * @returns {Express}
 */
function createWebhookServer(paymentHandler, quotaManager, bot, webhookSecret) {
    const app = express();

    // Parse JSON body
    app.use(express.json());

    // Health check
    app.get('/health', (req, res) => {
        res.json({ status: 'ok', service: 'doodstream-payment' });
    });

    // Cashi webhook endpoint
    app.post('/webhook/cashi', async (req, res) => {
        try {
            const { event, data } = req.body;

            console.log('[Webhook] Received:', event, data?.order_id);

            if (event === 'PAYMENT_SETTLED') {
                // Handle test webhook
                if (data.order_id && data.order_id.startsWith('TEST-')) {
                    console.log('[Webhook] Test connection received');
                    return res.status(200).send('Test OK');
                }

                // Handle real payment
                if (data.status === 'SETTLED') {
                    const orderId = data.order_id;
                    const transaction = paymentHandler.getTransaction(orderId);

                    if (!transaction) {
                        console.log('[Webhook] Transaction not found:', orderId);
                        return res.status(200).send('OK');
                    }

                    if (transaction.status === 'SETTLED') {
                        console.log('[Webhook] Already processed:', orderId);
                        return res.status(200).send('OK');
                    }

                    // Mark as settled
                    paymentHandler.markAsSettled(orderId);

                    // Add quota to user
                    const userId = transaction.userId;
                    const quota = transaction.quota;

                    quotaManager.addQuota(userId, quota, `Top up ${quota} quota via QRIS`);
                    const newBalance = quotaManager.getQuota(userId);

                    console.log(`[Webhook] Added ${quota} quota to user ${userId}. New balance: ${newBalance}`);

                    // Notify user via Telegram
                    try {
                        await bot.telegram.sendMessage(userId,
                            `🎉 *Pembayaran Berhasil!*\n\n` +
                            `📦 Paket: ${quota} Quota\n` +
                            `💰 Nominal: ${paymentHandler.formatPrice(data.amount)}\n` +
                            `📊 Saldo Baru: *${newBalance} quota*\n\n` +
                            `_Terima kasih telah top up!_`,
                            { parse_mode: 'Markdown' }
                        );
                    } catch (e) {
                        console.error('[Webhook] Failed to notify user:', e.message);
                    }
                }
            }

            res.status(200).send('OK');
        } catch (error) {
            console.error('[Webhook] Error:', error.message);
            res.status(200).send('OK'); // Always return 200 to prevent retries
        }
    });

    // Manual status check endpoint (for testing)
    app.get('/check/:orderId', async (req, res) => {
        const { orderId } = req.params;
        const status = await paymentHandler.checkStatus(orderId);
        res.json(status);
    });

    // TESTING ONLY: Simulate payment success
    app.get('/simulate/:orderId', async (req, res) => {
        const { orderId } = req.params;
        const transaction = paymentHandler.getTransaction(orderId);

        if (!transaction) {
            return res.json({ success: false, error: 'Transaction not found' });
        }

        if (transaction.status === 'SETTLED') {
            return res.json({ success: false, error: 'Already processed' });
        }

        // Mark as settled
        paymentHandler.markAsSettled(orderId);

        // Add quota to user
        const userId = transaction.userId;
        const quota = transaction.quota;

        quotaManager.addQuota(userId, quota, `Top up ${quota} quota via QRIS (TEST)`);
        const newBalance = quotaManager.getQuota(userId);

        console.log(`[SIMULATE] Added ${quota} quota to user ${userId}. New balance: ${newBalance}`);

        // Notify user via Telegram
        try {
            await bot.telegram.sendMessage(userId,
                `🎉 *Pembayaran Berhasil!*\n\n` +
                `📦 Paket: ${quota} Quota\n` +
                `💰 Nominal: ${paymentHandler.formatPrice(transaction.amount)}\n` +
                `📊 Saldo Baru: *${newBalance} quota*\n\n` +
                `_Terima kasih telah top up!_`,
                { parse_mode: 'Markdown' }
            );
        } catch (e) {
            console.error('[SIMULATE] Failed to notify user:', e.message);
        }

        res.json({
            success: true,
            message: 'Payment simulated',
            userId,
            quota,
            newBalance
        });
    });

    // List pending transactions (for testing)
    app.get('/pending/:userId', (req, res) => {
        const { userId } = req.params;
        const pending = paymentHandler.getPendingTransactions(userId);
        res.json(pending);
    });

    return app;
}

module.exports = createWebhookServer;
