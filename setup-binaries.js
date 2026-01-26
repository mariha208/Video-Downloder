const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const binDir = path.join(__dirname, 'bin');

if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir);
}

const platform = process.platform;
const binaryName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const url = platform === 'win32'
    ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
    : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

const outputPath = path.join(binDir, binaryName);

console.log(`Downloading ${binaryName} for ${platform}...`);

const downloadFile = (url, dest) => {
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            // Handle Redirects
            if (response.statusCode === 302 || response.statusCode === 301) {
                downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }

            const file = fs.createWriteStream(dest);
            response.pipe(file);

            file.on('finish', () => {
                file.close();
                console.log(`Downloaded ${path.basename(dest)}`);
                if (platform !== 'win32') {
                    try {
                        execSync(`chmod +x ${dest}`);
                    } catch (e) {
                        // ignore
                    }
                }
                resolve();
            });
        }).on('error', (err) => {
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            reject(err);
        });
    });
};

const setup = async () => {
    try {
        console.log(`Setting up binaries for ${platform}...`);

        // 1. Download yt-dlp
        await downloadFile(url, outputPath);

        // 2. Download ffmpeg (Windows only)
        if (platform === 'win32') {
            const ffmpegPath = path.join(binDir, 'ffmpeg.exe');
            if (!fs.existsSync(ffmpegPath)) {
                console.log('Downloading ffmpeg.exe for Windows...');
                const ffmpegUrl = 'https://github.com/eugeneware/ffmpeg-static/releases/download/b4.4/win32-x64';
                try {
                    await downloadFile(ffmpegUrl, ffmpegPath);
                    console.log('ffmpeg.exe downloaded successfully.');
                } catch (e) {
                    console.log('Direct download failed, trying PowerShell...');
                    try {
                        execSync(`powershell -Command "Invoke-WebRequest -Uri '${ffmpegUrl}' -OutFile '${ffmpegPath}'"`);
                        console.log('ffmpeg.exe downloaded via PowerShell.');
                    } catch (psErr) {
                        console.error('Failed to download ffmpeg.exe:', psErr.message);
                    }
                }
            } else {
                console.log('ffmpeg.exe already exists.');
            }
        }

        console.log('Setup complete.');
    } catch (error) {
        console.error('Setup failed:', error.message);
    }
};

setup();
