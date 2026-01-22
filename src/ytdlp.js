/**
 * yt-dlp Video Extractor
 * Alternative to Puppeteer - much faster and more reliable
 * 
 * Requires yt-dlp to be installed:
 * - Windows: winget install yt-dlp or download from https://github.com/yt-dlp/yt-dlp/releases
 * - Linux: pip install yt-dlp or apt install yt-dlp
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

class YtdlpExtractor {
    constructor() {
        this.ytdlpPath = process.env.YTDLP_PATH || 'yt-dlp';
        this.downloadDir = path.join(process.cwd(), 'downloads');

        // Create download directory
        if (!fs.existsSync(this.downloadDir)) {
            fs.mkdirSync(this.downloadDir, { recursive: true });
        }
    }

    /**
     * Initialize extractor (check if yt-dlp is available)
     */
    async init() {
        return new Promise((resolve) => {
            exec(`${this.ytdlpPath} --version`, (error, stdout) => {
                if (error) {
                    logger.warn('yt-dlp tidak ditemukan. Install: pip install yt-dlp');
                    resolve(false);
                } else {
                    logger.info(`yt-dlp versi: ${stdout.trim()}`);
                    resolve(true);
                }
            });
        });
    }

    /**
     * Preprocess URL - convert /s/ to /e/ and normalize doodstream URLs
     * @param {string} url 
     * @returns {string}
     */
    preprocessUrl(url) {
        let processedUrl = url;

        // Convert /s/ or /d/ to /e/ for doodstream
        processedUrl = processedUrl.replace(/\/(s|d)\//, '/e/');

        // Remove ?lv1= parameters that can cause issues
        processedUrl = processedUrl.replace(/\?lv1=.*$/, '');

        return processedUrl;
    }

    /**
     * Extract video info using yt-dlp
     * @param {string} url - Video URL
     * @returns {Promise<{title: string, videoUrl: string, duration: number, filesize: number}>}
     */
    async extractVideoInfo(url) {
        return new Promise((resolve, reject) => {
            // Preprocess URL
            const processedUrl = this.preprocessUrl(url);
            logger.extract(`[yt-dlp] Mengekstrak: ${processedUrl}`);

            const args = [
                '--no-warnings',
                '--no-playlist',
                '-j',  // JSON output
                '--no-check-certificate',
                processedUrl
            ];

            const process = spawn(this.ytdlpPath, args);
            let stdout = '';
            let stderr = '';

            process.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            process.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            process.on('close', (code) => {
                if (code !== 0) {
                    logger.error(`[yt-dlp] Error: ${stderr || 'Unknown error'}`);
                    reject(new Error(stderr || 'yt-dlp extraction failed'));
                    return;
                }

                try {
                    const info = JSON.parse(stdout);

                    // Get best video URL (prefer direct mp4)
                    let videoUrl = info.url;

                    // If formats available, find best mp4
                    if (info.formats && info.formats.length > 0) {
                        const mp4Formats = info.formats.filter(f =>
                            f.ext === 'mp4' && f.url && !f.url.includes('manifest')
                        );

                        if (mp4Formats.length > 0) {
                            // Sort by quality (filesize or height)
                            mp4Formats.sort((a, b) => (b.filesize || 0) - (a.filesize || 0));
                            videoUrl = mp4Formats[0].url;
                        }
                    }

                    const result = {
                        title: info.title || 'Video',
                        videoUrl: videoUrl,
                        duration: info.duration || 0,
                        filesize: info.filesize || info.filesize_approx || 0,
                        thumbnail: info.thumbnail || null,
                        extractor: 'yt-dlp'
                    };

                    logger.success(`[yt-dlp] Link ditemukan: ${result.title}`);
                    resolve(result);
                } catch (parseError) {
                    logger.error(`[yt-dlp] Parse error: ${parseError.message}`);
                    reject(new Error('Failed to parse yt-dlp output'));
                }
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                process.kill();
                reject(new Error('yt-dlp timeout'));
            }, 30000);
        });
    }

    /**
     * Download video directly using yt-dlp
     * @param {string} url - Video URL
     * @param {string} outputPath - Output file path (optional)
     * @returns {Promise<{filePath: string, title: string, filesize: number}>}
     */
    async downloadVideo(url, outputPath = null) {
        return new Promise((resolve, reject) => {
            const filename = outputPath || path.join(this.downloadDir, `ytdlp_${Date.now()}.mp4`);

            logger.download(`[yt-dlp] Mengunduh: ${url}`);

            const args = [
                '--no-warnings',
                '--no-playlist',
                '--no-check-certificate',
                '-f', 'best[ext=mp4]/best',
                '-o', filename,
                url
            ];

            const process = spawn(this.ytdlpPath, args);
            let stderr = '';

            process.stderr.on('data', (data) => {
                const msg = data.toString();
                stderr += msg;
                // Log progress
                if (msg.includes('%')) {
                    const match = msg.match(/(\d+\.?\d*)%/);
                    if (match) {
                        logger.info(`[yt-dlp] Progress: ${match[1]}%`);
                    }
                }
            });

            process.on('close', (code) => {
                if (code !== 0 || !fs.existsSync(filename)) {
                    logger.error(`[yt-dlp] Download failed: ${stderr}`);
                    reject(new Error(stderr || 'Download failed'));
                    return;
                }

                const stats = fs.statSync(filename);
                logger.success(`[yt-dlp] Download selesai: ${filename}`);

                resolve({
                    filePath: filename,
                    title: path.basename(filename, '.mp4'),
                    filesize: stats.size
                });
            });

            // Timeout after 5 minutes
            setTimeout(() => {
                process.kill();
                reject(new Error('Download timeout'));
            }, 300000);
        });
    }

    /**
     * Get supported extractors list
     */
    async getSupportedSites() {
        return new Promise((resolve) => {
            exec(`${this.ytdlpPath} --list-extractors`, (error, stdout) => {
                if (error) {
                    resolve([]);
                } else {
                    const extractors = stdout.trim().split('\n');
                    resolve(extractors);
                }
            });
        });
    }

    /**
     * Close extractor (nothing to do for yt-dlp)
     */
    async close() {
        // Nothing to close
    }
}

module.exports = YtdlpExtractor;
