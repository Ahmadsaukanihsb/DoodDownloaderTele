/**
 * Utility functions for Doodstream Telegram Bot
 */

/**
 * Check if a URL is a valid video hosting URL
 * Supports Doodstream, Filemoon, Filelions, StreamTape, VOE, and many more
 * @param {string} url - URL to validate
 * @returns {boolean}
 */
function isValidDoodstreamUrl(url) {
    if (!url) return false;

    // List of supported domain patterns (base domains without TLD)
    const supportedDomains = [
        // Doodstream and variants
        'dood', 'doood', 'dooood', 'doodstream', 'doodster', 'd00d', 'd000d', 'd0000d', 'd0o0d', 'do0od', 'do-od',
        'doods', 'doodss', 'doodz', 'dooodz', 'doodp', 'doodx', 'doodw', 'doodf', 'doodvid', 'doodst', 'doodstr',
        'ds2play', 'ds2video', 'myvidplay', 'videokitrsi', 'dood-hd',
        // Poop variants (Doodstream mirrors)
        'poop', 'poophd', 'poopvid', 'poopvip', 'poopweb', 'poops', 'pooph', 'poodvid', 'poods', 'poo',
        // Lulu variants
        'lulustream', 'luluvdo', 'lulu', 'lumiawatch',
        // Filemoon variants
        'filemoon', 'moonmov',
        // Filelions variants  
        'filelions', 'mlions', 'alions', 'dlions', 'fviplions',
        // Vidhide variants
        'vidhide', 'vidhidepro', 'vidhidevip', 'vidhidepre', 'nekomedia',
        // StreamTape variants
        'streamtape', 'strtape', 'strcloud', 'strtpe', 'stape', 'shavetape', 'streamadblockplus', 'scloud', 'tapelovesads',
        // VOE variants
        'voe', 'voe-unblock', 'voeunblock', 'voeunbl0ck', 'voeunblck', 'voeunblk', 'v-o-e-unblock', 'un-block-voe',
        // Other supported sites
        'gofile', 'filegram', 'mp4upload', 'veev', 'videy', 'javplaya', 'javlion', 'kinoger', 'cinegrab', 'moflix-stream', 'lixey',
        // Random domain patterns used by these services
        'cloudatacdn', 'lw2cgtcm', 'azipcdn', 'cdn-vid'
    ];

    // Additional full domain matches for complex domains
    const fullDomainPatterns = [
        /doo+d/i,                    // Matches dood, doood, dooood, etc.
        /d0+d/i,                     // Matches d0d, d00d, d000d, etc.
        /poo+p/i,                    // Matches poop, pooop, etc.
        /filemoon/i,
        /filelions?/i,
        /streamtape?/i,
        /vidhide/i,
        /lulu(stream|vdo)?/i,
        /\blions?\b/i,
    ];

    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        const pathname = urlObj.pathname.toLowerCase();

        // Reject album links (/a/) - they are not video embeds
        if (/\/a\/\w+/.test(pathname)) {
            return false;
        }

        // Check if path contains video identifiers (/e/, /d/, /s/, /v/, /w/, /f/)
        const hasVideoPath = /\/[edsvwf]\/\w+/.test(pathname);

        // Check against domain list
        for (const domain of supportedDomains) {
            if (hostname.includes(domain)) {
                return true;
            }
        }

        // Check against regex patterns
        for (const pattern of fullDomainPatterns) {
            if (pattern.test(hostname)) {
                return true;
            }
        }

        // If has video path identifier and looks like a video hosting URL
        if (hasVideoPath) {
            return true;
        }

        return false;
    } catch (e) {
        return false;
    }
}

/**
 * Extract file code from Doodstream URL
 * @param {string} url - Doodstream URL
 * @returns {string|null}
 */
function extractFileCode(url) {
    const match = url.match(/\/[ed]\/(\w+)/);
    return match ? match[1] : null;
}

/**
 * Format file size to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string}
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration from seconds to HH:MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string}
 */
function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Delay execution
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extract URLs from text
 * @param {string} text - Text containing URLs
 * @returns {string[]}
 */
function extractUrls(text) {
    // Match URLs with protocol
    const urlWithProtocol = /(https?:\/\/[^\s]+)/gi;
    // Match URLs without protocol (domain.tld/path)
    const urlWithoutProtocol = /(?<![\/\w])([a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;

    let urls = text.match(urlWithProtocol) || [];

    // Also find URLs without protocol and add https://
    const noProtocolMatches = text.match(urlWithoutProtocol) || [];
    for (const match of noProtocolMatches) {
        // Skip if already captured with protocol
        if (!urls.some(u => u.includes(match))) {
            urls.push('https://' + match);
        }
    }

    return urls;
}

/**
 * Check if URL is a redirect wrapper (like cdn-vid)
 * NOTE: Most wrappers use JavaScript redirect, not HTTP redirect
 * @param {string} url 
 * @returns {boolean}
 */
function isRedirectWrapper(url) {
    // Disabled - most wrappers use JS redirect which HTTP can't follow
    // Puppeteer handles these better
    return false;
}

/**
 * Follow redirects and get final URL
 * @param {string} url 
 * @returns {Promise<string>}
 */
async function followRedirect(url) {
    const axios = require('axios');
    try {
        const response = await axios({
            method: 'head',
            url: url,
            maxRedirects: 5,
            timeout: 10000,
            validateStatus: (status) => status < 400
        });
        return response.request.res.responseUrl || url;
    } catch (e) {
        // If HEAD fails, try GET
        try {
            const response = await axios({
                method: 'get',
                url: url,
                maxRedirects: 5,
                timeout: 10000,
                responseType: 'stream',
                validateStatus: (status) => status < 400
            });
            response.data.destroy(); // Don't actually download
            return response.request.res.responseUrl || url;
        } catch (e2) {
            return url;
        }
    }
}

module.exports = {
    isValidDoodstreamUrl,
    extractFileCode,
    formatFileSize,
    formatDuration,
    delay,
    extractUrls,
    isRedirectWrapper,
    followRedirect
};
