const { Markup } = require('telegraf');

/**
 * Subscription/Force Subscribe Handler
 */
class SubscriptionHandler {
    constructor(bot, channelUsername, channelId) {
        this.bot = bot;
        this.CHANNEL_USERNAME = channelUsername;
        this.CHANNEL_ID = channelId;
    }

    /**
     * Check if user is subscribed to required channel
     * @param {number} userId 
     * @returns {boolean}
     */
    async checkSubscription(userId) {
        // Skip check if channel not configured
        if (!this.CHANNEL_ID || this.CHANNEL_ID === '-1001234567890') {
            return true;
        }

        try {
            const member = await this.bot.telegram.getChatMember(this.CHANNEL_ID, userId);
            return ['creator', 'administrator', 'member'].includes(member.status);
        } catch (error) {
            console.log(`[Subscribe Check] Error for user ${userId}:`, error.message);

            // If bot doesn't have permission, allow access
            if (error.message.includes('inaccessible') ||
                error.message.includes('not found') ||
                error.message.includes('not a member')) {
                return true;
            }

            return false;
        }
    }

    /**
     * Send subscription required message
     * @param {Context} ctx 
     */
    async sendSubscribeMessage(ctx) {
        const message = `
🔒 *Akses Terbatas!*

Untuk menggunakan bot ini, Anda harus bergabung ke channel kami terlebih dahulu.

📢 *Channel:* ${this.CHANNEL_USERNAME}

Setelah bergabung, tekan tombol "✅ Sudah Join" di bawah.
        `;

        await ctx.replyWithMarkdown(message, Markup.inlineKeyboard([
            [Markup.button.url('📢 Join Channel', `https://t.me/${this.CHANNEL_USERNAME.replace('@', '')}`)],
            [Markup.button.callback('✅ Sudah Join', 'check_subscription')]
        ]));
    }
}

module.exports = SubscriptionHandler;
