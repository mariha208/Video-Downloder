const express = require("express");
const cors = require("cors");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2.1 Safari/605.1.15",
];

const getRandomUserAgent = () =>
  USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Create temp directory for downloads
const tempDir = process.env.VERCEL ? "/tmp" : path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// ✅ UPDATED: Cookie file setup with multiple fallbacks
let COOKIES_PATH = null;

const setupCookies = () => {
  try {
    // Method 1: Environment Variable (RECOMMENDED for Render)
    if (process.env.COOKIES_CONTENT) {
      console.log('📝 Creating cookies from environment variable...');
      const cookiePath = '/tmp/cookies.txt';
      fs.writeFileSync(cookiePath, process.env.COOKIES_CONTENT, 'utf8');
      console.log('✅ Cookies created from ENV:', cookiePath);
      COOKIES_PATH = cookiePath;
      return cookiePath;
    }

    // Method 2: Secret File (Render Secret Files)
    if (process.env.NODE_ENV === 'production') {
      const secretFile = path.join(__dirname, 'cookies.txt');

      if (fs.existsSync(secretFile)) {
        const writableCookiePath = '/tmp/cookies.txt';
        fs.copyFileSync(secretFile, writableCookiePath);
        console.log('✅ Cookies copied from Secret File to:', writableCookiePath);
        COOKIES_PATH = writableCookiePath;
        return writableCookiePath;
      }
    }

    // Method 3: Local development
    const localCookies = path.join(__dirname, "cookies.txt");
    if (fs.existsSync(localCookies)) {
      console.log('✅ Using local cookies:', localCookies);
      COOKIES_PATH = localCookies;
      return localCookies;
    }

    // Method 4: Temp directory fallback (where the user might have placed them)
    const tempCookies = path.join(__dirname, "temp", "cookies.txt");
    if (fs.existsSync(tempCookies)) {
      console.log('✅ Using temp directory cookies:', tempCookies);
      COOKIES_PATH = tempCookies;
      return tempCookies;
    }

    console.log('⚠️ No cookies file found - downloads may fail for private/restricted videos');
    return null;
  } catch (error) {
    console.error('❌ Error setting up cookies:', error.message);
    return null;
  }
};

// Initialize cookies on startup
setupCookies();

const getCookiesPath = () => {
  return COOKIES_PATH;
};

// Determine yt-dlp command based on OS and environment
const getYtDlpCommand = () => {
  const platform = process.platform;
  const binaryName = platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
  const localBinary = path.join(__dirname, "bin", binaryName);

  if (fs.existsSync(localBinary)) {
    return localBinary;
  }

  return "yt-dlp";
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
    "youtube.com",
    "youtu.be",
    "www.youtube.com",
    "instagram.com",
    "www.instagram.com",
    "facebook.com",
    "www.facebook.com",
    "fb.watch",
    "twitter.com",
    "x.com",
    "www.twitter.com",
    "tiktok.com",
    "www.tiktok.com",
    "linkedin.com",
    "www.linkedin.com",
  ];

  try {
    const urlObj = new URL(url);
    return supportedDomains.some((domain) => urlObj.hostname.includes(domain));
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
      "--dump-json",
      "--no-playlist",
      "--no-warnings",
      "--quiet",
      "--no-check-certificate",
      "--no-cache-dir",
      "--ffmpeg-location",
      "bin",
      "--user-agent",
      getRandomUserAgent(),
      "--ignore-errors",
      "--extractor-args",
      "youtube:player_client=android,ios,mweb;player_skip=web",
      url,
    ];

    // Add cookies if available
    const cookiesPath = getCookiesPath();
    if (cookiesPath && fs.existsSync(cookiesPath)) {
      execArgs.splice(execArgs.length - 1, 0, "--cookies", cookiesPath);
      console.log('🍪 Using cookies for video info:', cookiesPath);
    } else {
      console.log('⚠️ No cookies available for this request');
    }

    // Instagram specific optimizations
    if (url.includes("instagram.com")) {
      execArgs.splice(
        execArgs.length - 1,
        0,
        "--add-header",
        "Referer:https://www.instagram.com/",
      );
    }

    let ytdlp;
    console.log(`Executing: ${command} ${execArgs.join(" ")}`);

    ytdlp = spawn(command, execArgs, { windowsHide: true });

    let stdout = "";
    let stderr = "";

    ytdlp.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ytdlp.stderr.on("data", (data) => {
      stderr += data.toString();
      console.error(`yt-dlp stderr: ${data}`);
    });

    ytdlp.on("close", (code) => {
      console.log(`yt-dlp process exited with code ${code}`);
      if (code === 0) {
        try {
          const info = JSON.parse(stdout);

          const formats = (info.formats || [])
            .filter((f) => f.vcodec !== "none" || f.acodec !== "none")
            .map((f) => ({
              format_id: f.format_id,
              ext: f.ext,
              resolution:
                f.resolution ||
                (f.vcodec !== "none" ? `${f.width}x${f.height}` : "audio only"),
              filesize: f.filesize || f.filesize_approx,
              note: f.format_note || f.format,
              fps: f.fps,
              vcodec: f.vcodec,
              acodec: f.acodec,
            }));

          const resolutions = [
            ...new Set(
              formats
                .filter((f) => f.vcodec !== "none" && f.height)
                .map((f) => f.height),
            ),
          ].sort((a, b) => b - a);

          resolve({
            title: info.title,
            thumbnail: info.thumbnail,
            duration: info.duration,
            uploader: info.uploader,
            platform: info.extractor,
            formats: formats,
            resolutions: resolutions,
          });
        } catch (e) {
          reject(new Error("Failed to parse video info"));
        }
      } else {
        reject(new Error(stderr || "Failed to get video info"));
      }
    });

    ytdlp.on("error", (err) => {
      reject(new Error(`yt-dlp error: ${err.message}`));
    });
  });
};

// Download video using yt-dlp
const downloadVideo = (
  url,
  outputPath,
  formatSelection = "best[ext=mp4]/best/bestvideo+bestaudio",
) => {
  return new Promise((resolve, reject) => {
    const platform = process.platform;
    const command = getYtDlpCommand();

    let execArgs = [
      "-f",
      formatSelection,
      "--no-playlist",
      "-o",
      outputPath,
      "--no-warnings",
      "--quiet",
      "--no-check-certificate",
      "--no-cache-dir",
      "--ffmpeg-location",
      "bin",
      "--user-agent",
      getRandomUserAgent(),
      "--ignore-errors",
      "--extractor-args",
      "youtube:player_client=android,ios,mweb;player_skip=web",
      url,
    ];

    // Add cookies if available
    const cookiesPath = getCookiesPath();
    if (cookiesPath && fs.existsSync(cookiesPath)) {
      execArgs.splice(execArgs.length - 1, 0, "--cookies", cookiesPath);
      console.log('🍪 Using cookies for download:', cookiesPath);
    } else {
      console.log('⚠️ No cookies available for download');
    }

    // Instagram specific optimizations
    if (url.includes("instagram.com")) {
      execArgs.splice(
        execArgs.length - 1,
        0,
        "--add-header",
        "Referer:https://www.instagram.com/",
      );
    }

    let ytdlp;
    console.log(`Executing Download: ${command} ${execArgs.join(" ")}`);

    ytdlp = spawn(command, execArgs, { windowsHide: true });

    let stderr = "";

    ytdlp.stderr.on("data", (data) => {
      stderr += data.toString();
      console.error(`yt-dlp download stderr: ${data}`);
    });

    ytdlp.on("close", (code) => {
      console.log(`yt-dlp download process exited with code ${code}`);
      if (code === 0) {
        const dir = path.dirname(outputPath);
        const base = path.basename(outputPath, path.extname(outputPath));
        const files = fs.readdirSync(dir);
        const actualFile = files.find((f) => f.startsWith(base));

        if (actualFile) {
          resolve(path.join(dir, actualFile));
        } else {
          resolve(outputPath);
        }
      } else if (
        stderr.includes("Private video") ||
        stderr.includes("Sign in") ||
        (url.includes("instagram.com") &&
          (stderr.includes("401") || stderr.includes("403")))
      ) {
        reject(
          new Error(
            "Login required. Instagram often blocks anonymous downloads. Please provide a cookies.txt file or use the local app with Chrome open.",
          ),
        );
      } else if (
        stderr.includes("Video unavailable") ||
        stderr.includes("not available") ||
        (url.includes("instagram.com") && stderr.includes("404"))
      ) {
        reject(
          new Error(
            "Video is not available, private, or has been removed. Instagram links can be tricky!",
          ),
        );
      } else if (stderr.includes("copyright")) {
        reject(
          new Error("Video cannot be downloaded due to copyright restrictions"),
        );
      } else if (stderr.includes("age-restricted")) {
        reject(
          new Error(
            "This video is age-restricted. Please provide a cookies.txt file.",
          ),
        );
      } else if (stderr.includes("Requested format is not available")) {
        reject(
          new Error("The selected quality is not available for this video"),
        );
      } else {
        reject(new Error(stderr || "Failed to download video"));
      }
    });

    ytdlp.on("error", (err) => {
      reject(new Error(`Failed to start downloader: ${err.message}`));
    });
  });
};

// API Route: Get video info
app.post("/api/info", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: "Invalid URL format" });
  }

  try {
    const info = await getVideoInfo(url);
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API Route: Download video
app.post("/download", async (req, res) => {
  const { url, quality, format_id } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Video URL is required" });
  }

  if (!isValidUrl(url)) {
    return res
      .status(400)
      .json({ error: "Invalid URL format. Please enter a valid video URL." });
  }

  let formatSelection = "best[ext=mp4]/best[ext=mkv]/best";
  let fileExt = "mp4";

  if (quality === "audio") {
    formatSelection = "bestaudio/best";
    fileExt = "mp3";
  } else if (quality) {
    formatSelection = `bestvideo[height<=${quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${quality}][ext=mp4]/best[height<=${quality}]/best`;
  } else if (format_id) {
    formatSelection = format_id;
  }

  const fileId = uuidv4();
  const outputPath = path.join(tempDir, `${fileId}.${fileExt}`);

  try {
    console.log(
      `Starting download for: ${url} (Quality: ${quality || "best"})`,
    );

    let videoTitle = "video";
    try {
      const info = await getVideoInfo(url);
      videoTitle = info.title.replace(/[^\w\s-]/g, "").substring(0, 50);
    } catch (e) {
      console.log("Could not get video title, using default");
    }

    const actualOutputPath = await downloadVideo(
      url,
      outputPath,
      formatSelection,
    );

    if (!fs.existsSync(actualOutputPath)) {
      throw new Error("Download completed but file not found");
    }

    const stats = fs.statSync(actualOutputPath);
    console.log(`Download complete. File size: ${stats.size} bytes`);

    const finalExt = path.extname(actualOutputPath).substring(1) || fileExt;

    const contentType =
      quality === "audio"
        ? "audio/mpeg"
        : finalExt === "mp4"
          ? "video/mp4"
          : "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${videoTitle}.${finalExt}"`,
    );
    res.setHeader("Content-Length", stats.size);

    const fileStream = fs.createReadStream(actualOutputPath);

    fileStream.pipe(res);

    fileStream.on("close", () => {
      fs.unlink(actualOutputPath, (err) => {
        if (err) console.error("Error deleting temp file:", err);
        else console.log("Temp file cleaned up");
      });
    });

    fileStream.on("error", (err) => {
      console.error("Stream error:", err);
      fs.unlink(outputPath, () => { });
      if (!res.headersSent) {
        res.status(500).json({ error: "Error streaming video" });
      }
    });
  } catch (error) {
    console.error("Download error:", error.message);

    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  const cookiesPath = getCookiesPath();
  const cookiesExist = cookiesPath && fs.existsSync(cookiesPath);

  let cookiesPreview = 'Not available';
  if (cookiesExist) {
    try {
      const content = fs.readFileSync(cookiesPath, 'utf8');
      cookiesPreview = content.substring(0, 100) + '...';
    } catch (e) {
      cookiesPreview = 'Error reading file';
    }
  }

  res.json({
    status: "ok",
    message: "Video Downloader API is running",
    cookies_loaded: cookiesExist,
    cookies_path: cookiesPath || 'Not found',
    cookies_preview: cookiesPreview,
    environment: process.env.NODE_ENV || 'development',
    has_env_cookies: !!process.env.COOKIES_CONTENT
  });
});

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Export for Vercel
module.exports = app;

// Start server if running directly
if (require.main === module) {
  const server = app.listen(PORT, () => {
    const cookiesPath = getCookiesPath();
    console.log(`
╔══════════════════════════════════════════════════╗
║     🎬 Video Downloader Server Started! 🎬       ║
╠══════════════════════════════════════════════════╣
║  Local:   http://localhost:${PORT}                  ║
║  Network: http://YOUR_IP:${PORT}                    ║
╠══════════════════════════════════════════════════╣
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(35)} ║
║  Cookies: ${cookiesPath ? '✅ Loaded' : '❌ Not Found'}                        ║
${cookiesPath ? `║  Path: ${cookiesPath.padEnd(46)} ║` : ''}
╠══════════════════════════════════════════════════╣
║  Supported: YouTube, Instagram, Facebook,        ║
║             Twitter/X, TikTok, LinkedIn          ║
╚══════════════════════════════════════════════════╝
    `);
  });

  process.on("SIGTERM", () => {
    server.close(() => {
      console.log("Server process terminated");
    });
  });

  process.on("SIGINT", () => {
    server.close(() => {
      console.log("Server process interrupted");
      process.exit(0);
    });
  });
}