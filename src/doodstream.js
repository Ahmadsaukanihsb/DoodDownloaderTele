/**
 * Doodstream Video Link Extractor
 * Uses Puppeteer with Stealth Plugin to extract direct video links
 * Stealth mode helps bypass anti-bot detection
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { delay } = require('./utils');
const logger = require('./logger');

// Add stealth plugin
puppeteer.use(StealthPlugin());

class DoodstreamExtractor {
    constructor() {
        this.browser = null;
        // FAST MODE: Enabled for speed
        this.FAST_MODE = true;
        this.BLOCKED_RESOURCES = ['image', 'font', 'stylesheet'];
    }

    /**
     * Initialize browser instance with stealth and optimized settings
     */
    async init() {
        if (!this.browser) {
            logger.info('[Puppeteer] Launching browser with Stealth mode...');
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1280x720',
                    '--disable-blink-features=AutomationControlled',
                    // Performance optimizations
                    '--disable-extensions',
                    '--disable-plugins',
                    '--disable-images',
                    '--disable-background-networking',
                    '--disable-sync',
                    '--disable-translate',
                    '--no-first-run',
                    '--safebrowsing-disable-auto-update'
                ]
            });
            logger.success('[Puppeteer] Browser ready (Stealth mode)');
        }
        return this.browser;
    }

    /**
     * Close browser instance
     */
    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * Apply stealth mode to avoid bot detection
     * @param {puppeteer.Page} page 
     */
    async applyStealthMode(page) {
        // Override webdriver detection
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });

            // Override plugins
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });

            // Override languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });

            // Remove automation indicators
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
            delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
        });
    }

    /**
     * Generate unique param for video URL (same algorithm as Doodstream)
     */
    generateUniqueParam(token) {
        let a = "";
        const t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (let o = 0; o < 10; o++) {
            a += t.charAt(Math.floor(Math.random() * t.length));
        }
        return a + `?token=${token}&expiry=` + Date.now();
    }

    /**
     * FAST METHOD: Extract pass_md5 and token from page, then generate URL via HTTP
     * Much faster than waiting for video to load in browser
     */
    async extractViaPassMd5(page, baseUrl) {
        const axios = require('axios');

        try {
            // Extract pass_md5 path and token from page scripts
            const extractedData = await page.evaluate(() => {
                const scripts = document.querySelectorAll('script');
                let passMd5 = null;
                let token = null;

                for (const script of scripts) {
                    const content = script.textContent || script.innerHTML;

                    // Look for pass_md5 path
                    const passMd5Match = content.match(/\/pass_md5\/([^\/'"]+\/[^'"]+)/);
                    if (passMd5Match) {
                        passMd5 = passMd5Match[1];
                    }

                    // Look for token
                    const tokenMatch = content.match(/[?&]token=([a-zA-Z0-9]+)/);
                    if (tokenMatch) {
                        token = tokenMatch[1];
                    }

                    // Alternative token pattern
                    if (!token) {
                        const altToken = content.match(/makePlay\s*\(\s*\)\s*\{[\s\S]*?token\s*=\s*['"]([^'"]+)['"]/);
                        if (altToken) {
                            token = altToken[1];
                        }
                    }
                }

                return { passMd5, token };
            });

            if (!extractedData.passMd5) {
                console.log('[Doodstream] pass_md5 not found in page');
                return null;
            }

            console.log(`[Doodstream] Found pass_md5: ${extractedData.passMd5.substring(0, 20)}...`);

            // Get base URL from the page (might have redirected)
            const pageUrl = page.url();
            const pageOrigin = new URL(pageUrl).origin;

            // Call pass_md5 endpoint
            const passMd5Url = `${pageOrigin}/pass_md5/${extractedData.passMd5}`;
            console.log(`[Doodstream] Calling pass_md5 endpoint...`);

            const response = await axios.get(passMd5Url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': pageUrl,
                    'Accept': '*/*'
                },
                timeout: 10000
            });

            if (response.data && typeof response.data === 'string' && response.data.includes('http')) {
                // Generate video URL with unique param
                const token = extractedData.token || 'notoken';
                const videoUrl = response.data + this.generateUniqueParam(token);
                console.log(`[Doodstream] Generated video URL via pass_md5!`);
                return videoUrl;
            }

            return null;
        } catch (error) {
            console.log(`[Doodstream] pass_md5 extraction failed: ${error.message}`);
            return null;
        }
    }

    /**
     * Extract video info and download link from Doodstream URL
     * @param {string} url - Doodstream video URL
     * @returns {Promise<{title: string, thumbnail: string, duration: string, videoUrl: string}>}
     */
    async extractVideoInfo(url) {
        await this.init();

        let page = await this.browser.newPage();
        let extractionComplete = false;
        let popupHandler = null;

        try {
            // Apply stealth mode to bypass bot detection
            await this.applyStealthMode(page);

            // Set user agent to avoid detection
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            // Set viewport
            await page.setViewport({ width: 1920, height: 1080 });

            // Variable to store captured video URL
            let videoUrl = null;
            let videoTitle = 'Doodstream Video';
            let thumbnail = null;

            // Enable request interception to capture video URLs
            await page.setRequestInterception(true);

            // Block popups/new tabs from opening (ads)
            const context = this.browser.defaultBrowserContext();
            try {
                await context.overridePermissions(new URL(url).origin, []);
            } catch (e) {
                // Ignore permission errors
            }

            // Close any new pages/popups that open
            popupHandler = async (target) => {
                if (extractionComplete) return; // Don't process after extraction is done
                try {
                    const newPage = await target.page();
                    if (newPage && newPage !== page && !extractionComplete) {
                        console.log('[Doodstream] Closing popup ad...');
                        await newPage.close().catch(() => { });
                    }
                } catch (e) {
                    // Ignore errors when closing popups
                }
            };
            this.browser.on('targetcreated', popupHandler);

            const capturedUrls = [];

            page.on('request', request => {
                const reqUrl = request.url();
                const resourceType = request.resourceType();

                // FAST MODE: Block unnecessary resources
                if (this.FAST_MODE && this.BLOCKED_RESOURCES.includes(resourceType)) {
                    request.abort();
                    return;
                }

                // Check for video stream URLs
                if (reqUrl.includes('.mp4') ||
                    reqUrl.includes('.m3u8') ||
                    reqUrl.includes('/download') ||
                    reqUrl.includes('get_file') ||
                    reqUrl.includes('cloudatacdn.com') ||
                    reqUrl.includes('streaming')) {
                    capturedUrls.push(reqUrl);
                }

                request.continue();
            });

            page.on('response', async response => {
                const resUrl = response.url();
                const contentType = response.headers()['content-type'] || '';

                if (contentType.includes('video') ||
                    resUrl.includes('.mp4') ||
                    resUrl.includes('get_file') ||
                    resUrl.includes('cloudatacdn.com')) {
                    capturedUrls.push(resUrl);
                }
            });

            // Convert /s/ URL to /e/ URL (share links often have issues)
            let targetUrl = url;
            if (url.includes('/s/')) {
                targetUrl = url.replace('/s/', '/e/');
                console.log(`[Doodstream] Converting /s/ to /e/: ${targetUrl}`);
            }

            // Navigate to the page (FAST MODE uses domcontentloaded)
            console.log(`[Doodstream] Navigating to: ${targetUrl}`);
            await page.goto(targetUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });

            // Quick wait
            await delay(300);

            // Get final URL after any redirects
            let finalUrl = page.url();
            if (finalUrl !== targetUrl) {
                console.log(`[Doodstream] Redirected to: ${finalUrl}`);
            }

            // If redirected to about:blank, the actual page might be in a popup
            if (finalUrl === 'about:blank' || finalUrl === '') {
                console.log('[Doodstream] Page is blank, looking for popup tabs...');

                // FAST MODE: Fewer retries with shorter delays
                let foundPopup = false;
                const maxRetries = 2;
                for (let retry = 0; retry < maxRetries && !foundPopup; retry++) {
                    await delay(300);

                    const pages = await this.browser.pages();
                    console.log(`[Doodstream] Attempt ${retry + 1}: Found ${pages.length} pages`);

                    for (const p of pages) {
                        const pUrl = p.url();
                        console.log(`[Doodstream] Checking page: ${pUrl}`);

                        // Find a page that's not blank and is not the original blank page
                        if (p !== page && pUrl && pUrl !== 'about:blank' && !pUrl.startsWith('chrome')) {
                            console.log(`[Doodstream] Found popup with video: ${pUrl}`);
                            // Switch to this page
                            await page.close().catch(() => { });
                            page = p;
                            finalUrl = pUrl;
                            foundPopup = true;

                            // Re-apply stealth mode and request interception
                            await this.applyStealthMode(page);
                            await page.setRequestInterception(true);
                            page.on('request', request => {
                                const reqUrl = request.url();
                                if (reqUrl.includes('.mp4') || reqUrl.includes('.m3u8') ||
                                    reqUrl.includes('cloudatacdn') || reqUrl.includes('/get/') ||
                                    reqUrl.includes('xbox-streaming') || reqUrl.includes('hbvicbe5y')) {
                                    capturedUrls.push(reqUrl);
                                }
                                request.continue();
                            });

                            await delay(500);
                            break;
                        }
                    }
                }

                if (!foundPopup) {
                    console.log('[Doodstream] No popup found after retries');
                }
            }

            // Check for "File not found" error early
            const isFileNotFound = await page.evaluate(() => {
                const pageText = document.body?.innerText || '';
                const title = document.title || '';
                return pageText.includes('File not found') ||
                    pageText.includes('Oops! Sorry') ||
                    pageText.includes('Video not found') ||
                    pageText.includes('has been removed') ||
                    title.includes('File not found') ||
                    title.includes('Not Found');
            });

            if (isFileNotFound) {
                throw new Error('File not found - Video mungkin sudah dihapus');
            }

            // Try to get video title from page
            try {
                videoTitle = await page.evaluate(() => {
                    const titleEl = document.querySelector('h4.h4, .title, h1');
                    return titleEl ? titleEl.textContent.trim() : document.title;
                });
            } catch (e) {
                console.log('[Doodstream] Could not extract title');
            }

            // Try to get thumbnail
            try {
                thumbnail = await page.evaluate(() => {
                    const poster = document.querySelector('video')?.poster;
                    const ogImage = document.querySelector('meta[property="og:image"]')?.content;
                    return poster || ogImage || null;
                });
            } catch (e) {
                console.log('[Doodstream] Could not extract thumbnail');
            }

            // FAST METHOD: Try to extract via pass_md5 first (much faster!)
            console.log('[Doodstream] Trying FAST pass_md5 extraction...');
            const passMd5Url = await this.extractViaPassMd5(page, finalUrl);
            if (passMd5Url) {
                capturedUrls.push(passMd5Url);
                console.log('[Doodstream] FAST extraction successful!');
            } else {
                console.log('[Doodstream] FAST extraction failed, falling back to click method...');
            }

            // Multiple click attempts to bypass ads (first clicks often trigger popups)
            for (let clickAttempt = 1; clickAttempt <= 3; clickAttempt++) {
                try {
                    console.log(`[Doodstream] Click attempt ${clickAttempt}/3 to trigger video...`);

                    // Click in center of video area
                    await page.mouse.click(960, 400);
                    await delay(500);

                    // Check if video src is already set
                    const hasVideoSrc = await page.evaluate(() => {
                        const video = document.querySelector('video');
                        return video && video.src && video.src.startsWith('http');
                    });

                    if (hasVideoSrc) {
                        console.log('[Doodstream] Video src found after click!');
                        break;
                    }

                    // Try clicking play button
                    const playButton = await page.$('.plyr__control--overlaid, .play-btn, [data-plyr="play"], .vjs-big-play-button, .vjs-play-control');
                    if (playButton) {
                        await playButton.click();
                        await delay(300);
                    }
                } catch (e) {
                    console.log(`[Doodstream] Click attempt ${clickAttempt} failed`);
                }
            }

            // Wait for video element to have src attribute
            try {
                console.log('[Doodstream] Waiting for video src...');
                await page.waitForFunction(() => {
                    const video = document.querySelector('video');
                    return video && video.src && video.src.startsWith('http');
                }, { timeout: 12000 });
            } catch (e) {
                console.log('[Doodstream] Video src wait timeout, trying alternative methods');
            }

            // Try to extract video URL from video element directly
            const directVideoUrl = await page.evaluate(() => {
                const video = document.querySelector('video');
                if (video && video.src && video.src.startsWith('http')) {
                    return video.src;
                }

                // Also check for video_player_html5_api (Video.js)
                const vjsVideo = document.querySelector('#video_player_html5_api');
                if (vjsVideo && vjsVideo.src && vjsVideo.src.startsWith('http')) {
                    return vjsVideo.src;
                }

                return null;
            });

            if (directVideoUrl) {
                console.log('[Doodstream] Found direct video URL from element');
                capturedUrls.push(directVideoUrl);
            }

            // Try to extract video URL from page scripts
            const scriptVideoUrl = await page.evaluate(() => {
                // Look for video source in various places
                const video = document.querySelector('video source, video');
                if (video && video.src && video.src.includes('http')) {
                    return video.src;
                }

                // Check for any script that might contain the video URL
                const scripts = document.querySelectorAll('script');
                for (const script of scripts) {
                    const content = script.textContent || script.innerHTML;

                    // Look for patterns that might contain video URL
                    const patterns = [
                        /source:\s*['"]([^'"]+\.mp4[^'"]*)['"]/,
                        /file:\s*['"]([^'"]+\.mp4[^'"]*)['"]/,
                        /src:\s*['"]([^'"]+\.mp4[^'"]*)['"]/,
                        /"videoUrl":\s*['"]([^'"]+)['"]/,
                        /https:\/\/[^\s"']+cloudatacdn\.com[^\s"']*/,
                        /https:\/\/[^\s"']+\.mp4[^\s"']*/
                    ];

                    for (const pattern of patterns) {
                        const match = content.match(pattern);
                        if (match) {
                            return match[1] || match[0];
                        }
                    }
                }

                return null;
            });

            if (scriptVideoUrl) {
                capturedUrls.push(scriptVideoUrl);
            }

            // Quick wait for network
            await delay(500);

            // Find the best video URL from captured URLs
            videoUrl = this.selectBestUrl(capturedUrls);

            // If still no video URL, try alternative method
            if (!videoUrl) {
                videoUrl = await this.tryAlternativeExtraction(page, url);
            }

            if (!videoUrl) {
                throw new Error('Could not extract video URL from page');
            }

            console.log(`[Doodstream] Extracted video URL: ${videoUrl.substring(0, 100)}...`);

            return {
                title: this.sanitizeTitle(videoTitle),
                thumbnail,
                videoUrl,
                sourceUrl: url
            };

        } catch (error) {
            console.error('[Doodstream] Extraction error:', error.message);
            throw error;
        } finally {
            // Mark extraction as complete to stop popup handler
            extractionComplete = true;

            // Remove popup handler to prevent errors after page close
            try {
                this.browser.off('targetcreated', popupHandler);
            } catch (e) {
                // Ignore
            }

            try {
                await page.close();
            } catch (e) {
                // Page may already be closed, ignore
            }
        }
    }

    /**
     * Try alternative extraction method using direct page evaluation
     * @param {puppeteer.Page} page 
     * @param {string} originalUrl 
     */
    async tryAlternativeExtraction(page, originalUrl) {
        try {
            // Convert embed URL to download URL if needed
            let downloadUrl = originalUrl.replace('/e/', '/d/');

            if (downloadUrl !== originalUrl) {
                await page.goto(downloadUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                await delay(2000);
            }

            // Look for download link on the page
            const downloadLink = await page.evaluate(() => {
                // Common selectors for download buttons/links
                const selectors = [
                    'a.btn-success[href*="download"]',
                    'a[href*="get_file"]',
                    'a.download-btn',
                    '.download_box a',
                    '#download_link',
                    'a[onclick*="download"]'
                ];

                for (const selector of selectors) {
                    const el = document.querySelector(selector);
                    if (el && el.href) {
                        return el.href;
                    }
                }

                // Check for countdown button
                const countdownBtn = document.querySelector('#btn_download, .countdown');
                if (countdownBtn) {
                    return 'WAIT_FOR_COUNTDOWN';
                }

                return null;
            });

            if (downloadLink === 'WAIT_FOR_COUNTDOWN') {
                // Wait for countdown timer if exists
                console.log('[Doodstream] Waiting for countdown...');
                await delay(10000);

                return await page.evaluate(() => {
                    const dl = document.querySelector('a.btn-success[href*="download"], a[href*="get_file"]');
                    return dl ? dl.href : null;
                });
            }

            return downloadLink;
        } catch (error) {
            console.log('[Doodstream] Alternative extraction failed:', error.message);
            return null;
        }
    }

    /**
     * Select the best video URL from captured URLs
     * @param {string[]} urls 
     * @returns {string|null}
     */
    selectBestUrl(urls) {
        if (!urls || urls.length === 0) return null;

        // Filter unique URLs and exclude tracking/analytics/ad URLs
        const excludePatterns = [
            'google-analytics',
            'googletagmanager',
            'facebook.com',
            'doubleclick',
            'adsense',
            'analytics',
            'tracker',
            'pixel',
            'beacon',
            '.js',
            '.css',
            '.png',
            '.jpg',
            '.gif',
            '.ico',
            '.svg',
            '.woff',
            // Ad networks
            'bartcons.com',
            'adtng.com',
            'adzerk',
            'adserver',
            'popads',
            'exoclick',
            'juicyads',
            'trafficjunky',
            'propellerads',
            '/vmon/',
            'SSP%20LINK'
        ];

        const uniqueUrls = [...new Set(urls)].filter(url => {
            const lowerUrl = url.toLowerCase();
            return !excludePatterns.some(pattern => lowerUrl.includes(pattern));
        });

        // Prioritize cloudatacdn URLs (these are the actual video CDN)
        const cdnUrls = uniqueUrls.filter(url => url.includes('cloudatacdn.com'));
        if (cdnUrls.length > 0) {
            // Return the one with token (most complete URL)
            const withToken = cdnUrls.find(url => url.includes('token='));
            if (withToken) return withToken;
            return cdnUrls[cdnUrls.length - 1];
        }

        // Prioritize .mp4 URLs
        const mp4Urls = uniqueUrls.filter(url => url.includes('.mp4'));
        if (mp4Urls.length > 0) {
            return mp4Urls[mp4Urls.length - 1]; // Return the last one (usually the highest quality)
        }

        // Then try m3u8 (HLS)
        const hlsUrls = uniqueUrls.filter(url => url.includes('.m3u8'));
        if (hlsUrls.length > 0) {
            return hlsUrls[0];
        }

        // Return any URL with get_file or download
        const downloadUrls = uniqueUrls.filter(url =>
            url.includes('get_file') || url.includes('download')
        );
        if (downloadUrls.length > 0) {
            return downloadUrls[downloadUrls.length - 1];
        }

        return null;
    }

    /**
     * Sanitize video title for use as filename
     * @param {string} title 
     * @returns {string}
     */
    sanitizeTitle(title) {
        if (!title) return 'doodstream_video';

        return title
            .replace(/[<>:"/\\|?*]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 100)
            .trim();
    }
}

module.exports = DoodstreamExtractor;
