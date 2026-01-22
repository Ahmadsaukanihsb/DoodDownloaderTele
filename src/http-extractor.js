/**
 * HTTP Regex Video Extractor
 * Lightweight alternative to Puppeteer - uses axios and regex parsing
 * 
 * Much faster than Puppeteer, but may break if site structure changes
 */

const axios = require('axios');
const logger = require('./logger');

class HttpRegexExtractor {
    constructor() {
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        this.timeout = 15000;
    }

    /**
     * Initialize extractor
     */
    async init() {
        logger.info('[HTTP] HTTP Regex Extractor initialized');
        return true;
    }

    /**
     * Close extractor (nothing to do)
     */
    async close() {
        // Nothing to close
    }

    /**
     * Preprocess URL - convert /s/ or /d/ to /e/
     */
    preprocessUrl(url) {
        let processed = url.replace(/\/(s|d)\//, '/e/');
        processed = processed.replace(/\?.*$/, ''); // Remove query params
        return processed;
    }

    /**
     * Extract video info from Doodstream
     */
    async extractVideoInfo(url) {
        const processedUrl = this.preprocessUrl(url);
        logger.extract(`[HTTP] Mengekstrak: ${processedUrl}`);

        try {
            // First request - get the embed page
            const response1 = await axios.get(processedUrl, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Referer': url
                },
                timeout: this.timeout,
                maxRedirects: 5
            });

            const html = response1.data;
            const finalUrl = response1.request.res.responseUrl || processedUrl;
            const baseUrl = new URL(finalUrl).origin;

            // Extract title
            let title = 'Doodstream Video';
            const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
            if (titleMatch) {
                title = titleMatch[1].replace(' - DoodStream', '').replace('Watch', '').trim();
            }

            // Method 1: Look for direct video URL in page
            let videoUrl = null;

            // Pattern 1: dsplayer.hotkeys.video_url
            const pattern1 = html.match(/dsplayer\.hotkeys\.video_url\s*=\s*["']([^"']+)["']/);
            if (pattern1) {
                videoUrl = pattern1[1];
                logger.info('[HTTP] Found via dsplayer.hotkeys');
            }

            // Pattern 2: source src in video tag
            if (!videoUrl) {
                const pattern2 = html.match(/<source\s+src=["']([^"']+\.mp4[^"']*)["']/i);
                if (pattern2) {
                    videoUrl = pattern2[1];
                    logger.info('[HTTP] Found via source tag');
                }
            }

            // Pattern 3: video.type = 'video/mp4' + video.src
            if (!videoUrl) {
                const pattern3 = html.match(/video\.src\s*=\s*["']([^"']+\.mp4[^"']*)["']/);
                if (pattern3) {
                    videoUrl = pattern3[1];
                    logger.info('[HTTP] Found via video.src');
                }
            }

            // Pattern 4: Look for pass_md5 token generation
            if (!videoUrl) {
                const passMd5Match = html.match(/\/pass_md5\/([^\/'"]+)/);
                const tokenMatch = html.match(/makePlay\s*\(\s*\)\s*\{[^}]*token\s*=\s*["']([^"']+)["']/);

                if (passMd5Match) {
                    // Need to fetch the pass_md5 endpoint
                    const passUrl = `${baseUrl}/pass_md5/${passMd5Match[1]}`;
                    logger.info(`[HTTP] Fetching pass_md5: ${passUrl}`);

                    try {
                        const passResponse = await axios.get(passUrl, {
                            headers: {
                                'User-Agent': this.userAgent,
                                'Referer': finalUrl
                            },
                            timeout: this.timeout
                        });

                        // The response should be the video URL or a token
                        if (passResponse.data && passResponse.data.includes('http')) {
                            videoUrl = passResponse.data.trim();
                            // Add random token
                            const rand = Math.random().toString(36).substring(2, 12);
                            const expiry = Date.now();
                            videoUrl += `?token=${rand}&expiry=${expiry}`;
                            logger.info('[HTTP] Found via pass_md5 endpoint');
                        }
                    } catch (e) {
                        logger.warn(`[HTTP] pass_md5 fetch failed: ${e.message}`);
                    }
                }
            }

            // Pattern 5: Look for $.get('/pass_md5/...')
            if (!videoUrl) {
                const getPattern = html.match(/\$\.get\s*\(\s*['"]([^'"]*pass_md5[^'"]+)['"]/);
                if (getPattern) {
                    const passPath = getPattern[1];
                    const passUrl = passPath.startsWith('http') ? passPath : `${baseUrl}${passPath}`;

                    try {
                        const passResponse = await axios.get(passUrl, {
                            headers: {
                                'User-Agent': this.userAgent,
                                'Referer': finalUrl
                            },
                            timeout: this.timeout
                        });

                        if (passResponse.data) {
                            const data = passResponse.data.trim();
                            if (data.includes('http') || data.includes('.mp4')) {
                                videoUrl = data;
                                const rand = Math.random().toString(36).substring(2, 12);
                                videoUrl += (videoUrl.includes('?') ? '&' : '?') + `token=${rand}&expiry=${Date.now()}`;
                                logger.info('[HTTP] Found via $.get pass_md5');
                            }
                        }
                    } catch (e) {
                        logger.warn(`[HTTP] $.get pass_md5 failed: ${e.message}`);
                    }
                }
            }

            // Pattern 6: Direct CDN URL patterns
            if (!videoUrl) {
                const cdnPatterns = [
                    /https?:\/\/[a-z0-9.-]+\.(com|net|io|xyz)\/[a-z0-9\/-]+\.mp4[^"'\s]*/gi,
                    /https?:\/\/[a-z0-9.-]+\/xbox-streaming\/[^"'\s]+/gi,
                    /https?:\/\/[a-z0-9.-]+\/video\/[a-f0-9-]+\.mp4/gi
                ];

                for (const pattern of cdnPatterns) {
                    const matches = html.match(pattern);
                    if (matches && matches.length > 0) {
                        // Filter out non-video URLs
                        const validUrls = matches.filter(u =>
                            u.includes('.mp4') &&
                            !u.includes('player') &&
                            !u.includes('.js')
                        );
                        if (validUrls.length > 0) {
                            videoUrl = validUrls[0];
                            logger.info('[HTTP] Found via CDN pattern');
                            break;
                        }
                    }
                }
            }

            if (!videoUrl) {
                throw new Error('Could not extract video URL from page');
            }

            // Ensure URL is absolute
            if (videoUrl.startsWith('//')) {
                videoUrl = 'https:' + videoUrl;
            } else if (videoUrl.startsWith('/')) {
                videoUrl = baseUrl + videoUrl;
            }

            logger.success(`[HTTP] Link ditemukan: ${title}`);

            return {
                title: title || 'Doodstream Video',
                videoUrl: videoUrl,
                duration: 0,
                filesize: 0,
                extractor: 'http-regex'
            };

        } catch (error) {
            logger.error(`[HTTP] Extraction error: ${error.message}`);
            throw error;
        }
    }
}

module.exports = HttpRegexExtractor;
