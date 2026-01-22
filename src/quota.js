const fs = require('fs');
const path = require('path');

class QuotaManager {
    constructor(dataPath = './data') {
        this.dataPath = dataPath;
        this.quotaFile = path.join(dataPath, 'quota.json');
        this.transactionFile = path.join(dataPath, 'transactions.json');

        // Pricing
        this.DOWNLOAD_COST = 15; // 15 quota per download
        this.DAILY_BONUS = 50; // 50 quota daily bonus
        this.QUOTA_PACKAGES = [
            { id: 'pkg_100', quota: 100, price: 10000, label: '100 Quota - Rp 10.000' },
            { id: 'pkg_250', quota: 250, price: 22500, label: '250 Quota - Rp 22.500 (10% OFF)' },
            { id: 'pkg_500', quota: 500, price: 40000, label: '500 Quota - Rp 40.000 (20% OFF)' },
            { id: 'pkg_1000', quota: 1000, price: 70000, label: '1000 Quota - Rp 70.000 (30% OFF)' }
        ];

        // Free quota for new users
        this.FREE_QUOTA = 50;

        this.ensureDataDir();
        this.loadData();
    }

    ensureDataDir() {
        if (!fs.existsSync(this.dataPath)) {
            fs.mkdirSync(this.dataPath, { recursive: true });
        }
    }

    loadData() {
        // Load quota data
        if (fs.existsSync(this.quotaFile)) {
            try {
                this.quotaData = JSON.parse(fs.readFileSync(this.quotaFile, 'utf8'));
            } catch (e) {
                this.quotaData = {};
            }
        } else {
            this.quotaData = {};
        }

        // Load transaction data
        if (fs.existsSync(this.transactionFile)) {
            try {
                this.transactions = JSON.parse(fs.readFileSync(this.transactionFile, 'utf8'));
            } catch (e) {
                this.transactions = [];
            }
        } else {
            this.transactions = [];
        }
    }

    saveQuota() {
        fs.writeFileSync(this.quotaFile, JSON.stringify(this.quotaData, null, 2));
    }

    saveTransactions() {
        fs.writeFileSync(this.transactionFile, JSON.stringify(this.transactions, null, 2));
    }

    /**
     * Get user quota, create if not exists
     * @param {number} userId 
     * @returns {object}
     */
    getUser(userId) {
        const id = String(userId);
        if (!this.quotaData[id]) {
            this.quotaData[id] = {
                quota: this.FREE_QUOTA,
                totalDownloads: 0,
                totalSpent: 0,
                createdAt: new Date().toISOString(),
                lastActive: new Date().toISOString()
            };
            this.saveQuota();
        }
        return this.quotaData[id];
    }

    /**
     * Get user's current quota balance
     * @param {number} userId 
     * @returns {number}
     */
    getQuota(userId) {
        return this.getUser(userId).quota;
    }

    /**
     * Check if user has enough quota
     * @param {number} userId 
     * @param {number} amount 
     * @returns {boolean}
     */
    hasEnoughQuota(userId, amount = this.DOWNLOAD_COST) {
        return this.getQuota(userId) >= amount;
    }

    /**
     * Deduct quota from user
     * @param {number} userId 
     * @param {number} amount 
     * @returns {boolean}
     */
    deductQuota(userId, amount = this.DOWNLOAD_COST) {
        const user = this.getUser(userId);
        if (user.quota < amount) {
            return false;
        }

        user.quota -= amount;
        user.totalDownloads += 1;
        user.lastActive = new Date().toISOString();
        this.saveQuota();

        // Log transaction
        this.addTransaction(userId, 'download', -amount, `Download video (-${amount} quota)`);

        return true;
    }

    /**
     * Add quota to user
     * @param {number} userId 
     * @param {number} amount 
     * @param {string} reason 
     */
    addQuota(userId, amount, reason = 'Top up') {
        const user = this.getUser(userId);
        user.quota += amount;
        user.totalSpent += amount;
        user.lastActive = new Date().toISOString();
        this.saveQuota();

        // Log transaction
        this.addTransaction(userId, 'topup', amount, reason);
    }

    /**
     * Add transaction record
     */
    addTransaction(userId, type, amount, description) {
        this.transactions.push({
            id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: String(userId),
            type,
            amount,
            description,
            timestamp: new Date().toISOString()
        });

        // Keep only last 1000 transactions
        if (this.transactions.length > 1000) {
            this.transactions = this.transactions.slice(-1000);
        }

        this.saveTransactions();
    }

    /**
     * Get user's transaction history
     * @param {number} userId 
     * @param {number} limit 
     * @returns {array}
     */
    getTransactionHistory(userId, limit = 10) {
        const id = String(userId);
        return this.transactions
            .filter(t => t.userId === id)
            .slice(-limit)
            .reverse();
    }

    /**
     * Get package by ID
     * @param {string} packageId 
     * @returns {object|null}
     */
    getPackage(packageId) {
        return this.QUOTA_PACKAGES.find(p => p.id === packageId) || null;
    }

    /**
     * Get all packages
     * @returns {array}
     */
    getPackages() {
        return this.QUOTA_PACKAGES;
    }

    /**
     * Get statistics
     * @returns {object}
     */
    getStats() {
        const users = Object.values(this.quotaData);
        return {
            totalUsers: users.length,
            totalQuotaIssued: users.reduce((sum, u) => sum + u.totalSpent + this.FREE_QUOTA, 0),
            totalDownloads: users.reduce((sum, u) => sum + u.totalDownloads, 0),
            activeToday: users.filter(u => {
                const lastActive = new Date(u.lastActive);
                const today = new Date();
                return lastActive.toDateString() === today.toDateString();
            }).length
        };
    }

    /**
     * Check if user can claim daily bonus
     * @param {number} userId 
     * @returns {object} { canClaim, nextClaimIn }
     */
    canClaimDailyBonus(userId) {
        const user = this.getUser(userId);
        const lastClaim = user.lastDailyBonus ? new Date(user.lastDailyBonus) : null;

        if (!lastClaim) {
            return { canClaim: true, nextClaimIn: 0 };
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const lastClaimDate = new Date(lastClaim.getFullYear(), lastClaim.getMonth(), lastClaim.getDate());

        if (today > lastClaimDate) {
            return { canClaim: true, nextClaimIn: 0 };
        }

        // Calculate next claim time (tomorrow 00:00)
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextClaimIn = Math.ceil((tomorrow - now) / 1000 / 60 / 60); // hours

        return { canClaim: false, nextClaimIn };
    }

    /**
     * Claim daily bonus
     * @param {number} userId 
     * @returns {object} { success, quota, newBalance, message }
     */
    claimDailyBonus(userId) {
        const { canClaim, nextClaimIn } = this.canClaimDailyBonus(userId);

        if (!canClaim) {
            return {
                success: false,
                message: `Anda sudah klaim hari ini. Kembali dalam ${nextClaimIn} jam.`
            };
        }

        const user = this.getUser(userId);
        user.quota += this.DAILY_BONUS;
        user.lastDailyBonus = new Date().toISOString();
        user.lastActive = new Date().toISOString();
        this.saveQuota();

        // Log transaction
        this.addTransaction(userId, 'bonus', this.DAILY_BONUS, 'Daily Bonus 🎁');

        return {
            success: true,
            quota: this.DAILY_BONUS,
            newBalance: user.quota,
            message: `Berhasil klaim ${this.DAILY_BONUS} quota!`
        };
    }
}

module.exports = QuotaManager;
