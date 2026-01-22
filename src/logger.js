/**
 * Logger utility with timestamps and colored output
 */

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

function getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const logger = {
    info(message) {
        console.log(`${colors.dim}${getTimestamp()}${colors.reset} ${colors.cyan}[INFO]${colors.reset} - ${message}`);
    },

    success(message) {
        console.log(`${colors.dim}${getTimestamp()}${colors.reset} ${colors.green}[SUCCESS]${colors.reset} - ${message}`);
    },

    warn(message) {
        console.log(`${colors.dim}${getTimestamp()}${colors.reset} ${colors.yellow}[WARN]${colors.reset} - ${message}`);
    },

    error(message) {
        console.log(`${colors.dim}${getTimestamp()}${colors.reset} ${colors.red}[ERROR]${colors.reset} - ${message}`);
    },

    download(message) {
        console.log(`${colors.dim}${getTimestamp()}${colors.reset} ${colors.magenta}[DOWNLOAD]${colors.reset} - ${message}`);
    },

    extract(message) {
        console.log(`${colors.dim}${getTimestamp()}${colors.reset} ${colors.blue}[EXTRACT]${colors.reset} - ${message}`);
    },

    payment(message) {
        console.log(`${colors.dim}${getTimestamp()}${colors.reset} ${colors.green}[PAYMENT]${colors.reset} - ${message}`);
    },

    bot(message) {
        console.log(`${colors.dim}${getTimestamp()}${colors.reset} ${colors.bright}[BOT]${colors.reset} - ${message}`);
    }
};

module.exports = logger;
