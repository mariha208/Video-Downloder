const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Create temp directory for downloads
// Vercel Serverless only allows writing to /tmp
const tempDir = process.env.VERCEL ? '/tmp' : path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Determine yt-dlp command based on OS and environment
const getYtDlpCommand = () => {
    // Check for local binary in bin directory first (deployed env)
    const platform = process.platform;
    const binaryName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const localBinary = path.join(__dirname, 'bin', binaryName);

    if (fs.existsSync(localBinary)) {
        return localBinary;
    }

    // Fallback to global command
    return 'yt-dlp';
};

// Validate URL
const isValidUrl = (url) => {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
};

// Check if URL is from supported platforms
const isSupportedPlatform = (url) => {
    const supportedDomains = [
        'youtube.com', 'youtu.be', 'www.youtube.com',
        'instagram.com', 'www.instagram.com',
        'facebook.com', 'www.facebook.com', 'fb.watch',
        'twitter.com', 'x.com', 'www.twitter.com',
        'tiktok.com', 'www.tiktok.com',
        'linkedin.com', 'www.linkedin.com'
    ];

    try {
        const urlObj = new URL(url);
        return supportedDomains.some(domain => urlObj.hostname.includes(domain));
    } catch {
        return false;
    }
};

// Get video info using yt-dlp
const getVideoInfo = (url) => {
    return new Promise((resolve, reject) => {
        const platform = process.platform;
        const command = getYtDlpCommand();

        let execArgs = [
            '--dump-json',
            '--no-playlist',
            '--no-warnings',
            '--quiet',
            '--no-check-certificate',
            '--ffmpeg-location', 'bin',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            '--extractor-args', 'youtube:player_client=web_creator,android',
            url
        ];

        let ytdlp;
        if (platform === 'win32') {
            const psScript = `& "${command}" ${execArgs.map(a => `'${a}'`).join(' ')}`;
            ytdlp = spawn('powershell.exe', [
                '-NoProfile',
                '-WindowStyle', 'Hidden',
                '-Command', psScript
            ], {
                windowsHide: true,
                shell: false
            });
        } else {
            ytdlp = spawn(command, execArgs, { windowsHide: true });
        }

        let stdout = '';
        let stderr = '';

        ytdlp.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        ytdlp.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ytdlp.on('close', (code) => {
            if (code === 0) {
                try {
                    const info = JSON.parse(stdout);

                    // Filter and simplify formats for the frontend
                    const formats = (info.formats || [])
                        .filter(f => f.vcodec !== 'none' || f.acodec !== 'none')
                        .map(f => ({
                            format_id: f.format_id,
                            ext: f.ext,
                            resolution: f.resolution || (f.vcodec !== 'none' ? `${f.width}x${f.height}` : 'audio only'),
                            filesize: f.filesize || f.filesize_approx,
                            note: f.format_note || f.format,
                            fps: f.fps,
                            vcodec: f.vcodec,
                            acodec: f.acodec
                        }));

                    // Extract unique resolutions for simpler UI
                    const resolutions = [...new Set(formats
                        .filter(f => f.vcodec !== 'none' && f.height)
                        .map(f => f.height))]
                        .sort((a, b) => b - a);

                    resolve({
                        title: info.title,
                        thumbnail: info.thumbnail,
                        duration: info.duration,
                        uploader: info.uploader,
                        platform: info.extractor,
                        formats: formats,
                        resolutions: resolutions
                    });
                } catch (e) {
                    reject(new Error('Failed to parse video info'));
                }
            } else {
                reject(new Error(stderr || 'Failed to get video info'));
            }
        });

        ytdlp.on('error', (err) => {
            reject(new Error(`yt-dlp error: ${err.message}`));
        });
    });
};

// Download video using yt-dlp
const downloadVideo = (url, outputPath, formatSelection = 'best[ext=mp4]/best/bestvideo+bestaudio') => {
    return new Promise((resolve, reject) => {
        const platform = process.platform;
        const command = getYtDlpCommand();

        let execArgs = [
            '-f', formatSelection,
            '--no-playlist',
            '-o', outputPath,
            '--no-warnings',
            '--quiet',
            '--no-check-certificate',
            '--ffmpeg-location', 'bin',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            '--extractor-args', 'youtube:player_client=web_creator,android',
            url
        ];

        let ytdlp;
        if (platform === 'win32') {
            const psScript = `& "${command}" ${execArgs.map(a => `'${a}'`).join(' ')}`;
            ytdlp = spawn('powershell.exe', [
                '-NoProfile',
                '-WindowStyle', 'Hidden',
                '-Command', psScript
            ], {
                windowsHide: true,
                shell: false
            });
        } else {
            ytdlp = spawn(command, execArgs, { windowsHide: true });
        }

        let stderr = '';

        ytdlp.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ytdlp.on('close', (code) => {
            if (code === 0) {
                // Find the actual file created in temp directory
                // outputPath might have changed extension if yt-dlp decided mkv was better
                const dir = path.dirname(outputPath);
                const base = path.basename(outputPath, path.extname(outputPath));
                const files = fs.readdirSync(dir);
                const actualFile = files.find(f => f.startsWith(base));

                if (actualFile) {
                    resolve(path.join(dir, actualFile));
                } else {
                    resolve(outputPath); // Fallback
                }
            } else {
                if (stderr.includes('Private video') || stderr.includes('Sign in')) {
                    reject(new Error('This video is private or requires login'));
                } else if (stderr.includes('Video unavailable') || stderr.includes('not available')) {
                    reject(new Error('Video is not available or has been removed'));
                } else if (stderr.includes('copyright')) {
                    reject(new Error('Video cannot be downloaded due to copyright restrictions'));
                } else if (stderr.includes('age-restricted')) {
                    reject(new Error('This video is age-restricted and cannot be downloaded'));
                } else if (stderr.includes('Requested format is not available')) {
                    reject(new Error('The selected quality is not available for this video'));
                } else {
                    reject(new Error(stderr || 'Failed to download video'));
                }
            }
        });

        ytdlp.on('error', (err) => {
            reject(new Error(`Failed to start downloader: ${err.message}`));
        });
    });
};

// API Route: Get video info
app.post('/api/info', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    if (!isValidUrl(url)) {
        return res.status(400).json({ error: 'Invalid URL format' });
    }

    try {
        const info = await getVideoInfo(url);
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API Route: Download video
app.post('/download', async (req, res) => {
    const { url, quality, format_id } = req.body;

    // Validate request
    if (!url) {
        return res.status(400).json({ error: 'Video URL is required' });
    }

    if (!isValidUrl(url)) {
        return res.status(400).json({ error: 'Invalid URL format. Please enter a valid video URL.' });
    }

    // Determine format selection string
    let formatSelection = 'best[ext=mp4]/best[ext=mkv]/best';
    let fileExt = 'mp4';

    if (quality === 'audio') {
        formatSelection = 'bestaudio/best';
        fileExt = 'mp3';
    } else if (quality) {
        // e.g. quality = '1080'
        formatSelection = `bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}][ext=mp4]/best[height<=${quality}]/best`;
    } else if (format_id) {
        formatSelection = format_id;
    }

    // Generate unique filename
    const fileId = uuidv4();
    const outputPath = path.join(tempDir, `${fileId}.${fileExt}`);

    try {
        console.log(`Starting download for: ${url} (Quality: ${quality || 'best'})`);

        // Get video info first for filename
        let videoTitle = 'video';
        try {
            const info = await getVideoInfo(url);
            videoTitle = info.title.replace(/[^\w\s-]/g, '').substring(0, 50);
        } catch (e) {
            console.log('Could not get video title, using default');
        }

        // Download the video
        const actualOutputPath = await downloadVideo(url, outputPath, formatSelection);

        // Check if file exists
        if (!fs.existsSync(actualOutputPath)) {
            throw new Error('Download completed but file not found');
        }

        // Get file stats
        const stats = fs.statSync(actualOutputPath);
        console.log(`Download complete. File size: ${stats.size} bytes`);

        // Final extension might be different
        const finalExt = path.extname(actualOutputPath).substring(1) || fileExt;

        // Set headers for file download
        const contentType = quality === 'audio' ? 'audio/mpeg' : (finalExt === 'mp4' ? 'video/mp4' : 'application/octet-stream');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${videoTitle}.${finalExt}"`);
        res.setHeader('Content-Length', stats.size);

        // Stream file to response
        const fileStream = fs.createReadStream(actualOutputPath);

        fileStream.pipe(res);

        // Clean up temp file after streaming
        fileStream.on('close', () => {
            fs.unlink(actualOutputPath, (err) => {
                if (err) console.error('Error deleting temp file:', err);
                else console.log('Temp file cleaned up');
            });
        });

        fileStream.on('error', (err) => {
            console.error('Stream error:', err);
            fs.unlink(outputPath, () => { });
            if (!res.headersSent) {
                res.status(500).json({ error: 'Error streaming video' });
            }
        });

    } catch (error) {
        console.error('Download error:', error.message);

        // Clean up temp file if exists
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }

        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Video Downloader API is running' });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Export for Vercel
module.exports = app;

// Start server if running directly
if (require.main === module) {
    const server = app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════╗
║     🎬 Video Downloader Server Started! 🎬       ║
╠══════════════════════════════════════════════════╣
║  Local:   http://localhost:${PORT}                  ║
║  Network: http://YOUR_IP:${PORT}                    ║
╠══════════════════════════════════════════════════╣
║  Supported: YouTube, Instagram, Facebook,        ║
║             Twitter/X, TikTok, LinkedIn          ║
╚══════════════════════════════════════════════════╝
    `);
    });

    // Handle unexpected errors to prevent EADDRINUSE on restarts
    process.on('SIGTERM', () => {
        server.close(() => {
            console.log('Server process terminated');
        });
    });

    process.on('SIGINT', () => {
        server.close(() => {
            console.log('Server process interrupted');
            process.exit(0);
        });
    });
}
