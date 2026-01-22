const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Cashi Payment Handler
 * Handles QRIS payment creation and status checking
 */
class PaymentHandler {
    constructor(apiKey, dataPath = './data') {
        this.apiKey = apiKey;
        this.baseUrl = 'https://cashi.id/api';
        this.dataPath = dataPath;
        this.transactionsFile = path.join(dataPath, 'payment_transactions.json');

        // Payment packages
        this.packages = [
            { id: 'pkg_100', quota: 100, price: 10000, label: '100 Quota' },
            { id: 'pkg_250', quota: 250, price: 22500, label: '250 Quota (10% OFF)' },
            { id: 'pkg_500', quota: 500, price: 40000, label: '500 Quota (20% OFF)' },
            { id: 'pkg_1000', quota: 1000, price: 70000, label: '1000 Quota (30% OFF)' }
        ];

        this.ensureDataDir();
        this.loadTransactions();
    }

    ensureDataDir() {
        if (!fs.existsSync(this.dataPath)) {
            fs.mkdirSync(this.dataPath, { recursive: true });
        }
    }

    loadTransactions() {
        if (fs.existsSync(this.transactionsFile)) {
            try {
                this.transactions = JSON.parse(fs.readFileSync(this.transactionsFile, 'utf8'));
            } catch (e) {
                this.transactions = {};
            }
        } else {
            this.transactions = {};
        }
    }

    saveTransactions() {
        fs.writeFileSync(this.transactionsFile, JSON.stringify(this.transactions, null, 2));
    }

    /**
     * Get package by ID
     */
    getPackage(packageId) {
        return this.packages.find(p => p.id === packageId);
    }

    /**
     * Get all packages
     */
    getPackages() {
        return this.packages;
    }

    /**
     * Create payment order
     * @param {number} userId - Telegram user ID
     * @param {string} packageId - Package ID
     * @returns {object} Payment details with QRIS
     */
    async createOrder(userId, packageId) {
        const pkg = this.getPackage(packageId);
        if (!pkg) {
            throw new Error('Package not found');
        }

        const orderId = `DOOD-${userId}-${Date.now()}`;

        try {
            const response = await axios.post(`${this.baseUrl}/create-order`, {
                amount: pkg.price,
                order_id: orderId
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': this.apiKey
                }
            });

            if (response.data.success) {
                // Store pending transaction
                this.transactions[orderId] = {
                    orderId,
                    userId: String(userId),
                    packageId,
                    quota: pkg.quota,
                    amount: response.data.amount,
                    status: 'PENDING',
                    checkoutUrl: response.data.checkout_url,
                    qrUrl: response.data.qrUrl,
                    createdAt: new Date().toISOString(),
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes
                };
                this.saveTransactions();

                return {
                    success: true,
                    orderId,
                    amount: response.data.amount,
                    checkoutUrl: response.data.checkout_url,
                    qrUrl: response.data.qrUrl,
                    quota: pkg.quota,
                    expiresIn: '10 menit'
                };
            } else {
                throw new Error('Failed to create order');
            }
        } catch (error) {
            console.error('[Payment] Create order error:', error.message);
            throw error;
        }
    }

    /**
     * Check payment status
     * @param {string} orderId - Order ID
     */
    async checkStatus(orderId) {
        try {
            const response = await axios.get(`${this.baseUrl}/check-status/${orderId}`, {
                headers: {
                    'X-API-KEY': this.apiKey
                }
            });

            if (response.data.success) {
                return {
                    success: true,
                    status: response.data.status,
                    amount: response.data.amount,
                    orderId: response.data.order_id
                };
            }
            return { success: false, status: 'UNKNOWN' };
        } catch (error) {
            console.error('[Payment] Check status error:', error.message);
            return { success: false, status: 'ERROR' };
        }
    }

    /**
     * Get transaction by order ID
     */
    getTransaction(orderId) {
        return this.transactions[orderId];
    }

    /**
     * Get pending transactions for user
     */
    getPendingTransactions(userId) {
        const userIdStr = String(userId);
        return Object.values(this.transactions).filter(
            t => t.userId === userIdStr && t.status === 'PENDING'
        );
    }

    /**
     * Mark transaction as settled
     */
    markAsSettled(orderId) {
        if (this.transactions[orderId]) {
            this.transactions[orderId].status = 'SETTLED';
            this.transactions[orderId].settledAt = new Date().toISOString();
            this.saveTransactions();
            return this.transactions[orderId];
        }
        return null;
    }

    /**
     * Mark transaction as expired
     */
    markAsExpired(orderId) {
        if (this.transactions[orderId]) {
            this.transactions[orderId].status = 'EXPIRED';
            this.saveTransactions();
        }
    }

    /**
     * Clean up expired transactions
     */
    cleanupExpired() {
        const now = new Date();
        Object.keys(this.transactions).forEach(orderId => {
            const tx = this.transactions[orderId];
            if (tx.status === 'PENDING' && new Date(tx.expiresAt) < now) {
                tx.status = 'EXPIRED';
            }
        });
        this.saveTransactions();
    }

    /**
     * Format price to Rupiah
     */
    formatPrice(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }
}

module.exports = PaymentHandler;
