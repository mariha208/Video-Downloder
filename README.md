# 🎬 Video Downloader

A simple, fast, and free web-based video downloader that works on mobile and desktop browsers. Download videos from YouTube, Instagram, Facebook, Twitter, and TikTok.

## ✨ Features

- 📱 **Responsive Design** - Works on mobile and desktop
- ⚡ **Fast Downloads** - Best quality video downloads
- 🌐 **Multi-Platform Support** - YouTube, Instagram, Facebook, Twitter, TikTok
- 🎨 **Modern UI** - Dark theme with beautiful animations
- 🔒 **Privacy Focused** - No data stored

## 📋 Prerequisites

Before running this application, you need:

1. **Node.js** (v16 or higher)
   - Download: https://nodejs.org/

2. **yt-dlp** (Required for video downloading)
   
   **Windows:**
   ```bash
   # Using winget
   winget install yt-dlp
   
   # OR download from: https://github.com/yt-dlp/yt-dlp/releases
   # Place yt-dlp.exe in your PATH or project folder
   ```
   
   **Linux:**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install yt-dlp
   
   # OR using pip
   pip install yt-dlp
   
   # OR download binary
   sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
   sudo chmod a+rx /usr/local/bin/yt-dlp
   ```

## 🚀 Running Locally (Localhost)

### Step 1: Install Dependencies
```bash
cd Video-Downloder
npm install
```

### Step 2: Start the Server
```bash
npm start
```

### Step 3: Open in Browser
Open your browser and go to:
```
http://localhost:3000
```

### For Development (Auto-reload)
```bash
npm run dev
```

## 🌐 VPS Deployment (Linux Server)

### Step 1: Connect to Your VPS
```bash
ssh root@your-server-ip
```

### Step 2: Install Node.js
```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Step 3: Install yt-dlp
```bash
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Verify installation
yt-dlp --version
```

### Step 4: Upload Your Project
```bash
# Option 1: Clone from GitHub (if hosted)
git clone https://github.com/yourusername/video-downloader.git
cd video-downloader

# Option 2: Use SCP to upload
scp -r ./Video-Downloder root@your-server-ip:/var/www/video-downloader
```

### Step 5: Install Dependencies on Server
```bash
cd /var/www/video-downloader
npm install --production
```

### Step 6: Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

### Step 7: Start with PM2
```bash
pm2 start server.js --name "video-downloader"
pm2 save
pm2 startup
```

### Step 8: Configure Firewall
```bash
sudo ufw allow 3000
# OR use Nginx as reverse proxy (recommended)
```

### Step 9: (Optional) Setup Nginx Reverse Proxy
```bash
sudo apt install nginx

# Create config
sudo nano /etc/nginx/sites-available/video-downloader
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeout for large video downloads
        proxy_read_timeout 300s;
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/video-downloader /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 10: (Optional) Add SSL with Certbot
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## 📁 Project Structure

```
Video-Downloder/
├── server.js           # Express backend server
├── package.json        # NPM dependencies
├── README.md           # This file
├── temp/               # Temporary download folder (auto-created)
└── public/
    ├── index.html      # Main HTML page
    ├── styles.css      # CSS styling
    └── script.js       # Frontend JavaScript
```

## 🔧 Configuration

Change the port by setting environment variable:
```bash
PORT=8080 npm start
```

## ❓ Troubleshooting

### "yt-dlp not found"
- Make sure yt-dlp is installed and in your PATH
- On Windows, you may need to restart the terminal after installation

### "Video is private"
- Private videos cannot be downloaded without login
- This is a limitation of yt-dlp

### "Download failed"
- Check if the URL is valid
- Some videos may have regional restrictions
- Try updating yt-dlp: `yt-dlp -U`

### Large videos timeout
- Increase the timeout in server.js
- For VPS: increase Nginx timeout settings

## 📝 API Endpoints

| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `/download` | POST | `{ "url": "video_url" }` | Download a video |
| `/api/health` | GET | - | Health check |

## ⚠️ Disclaimer

This tool is for personal use only. Please respect copyright laws and terms of service of the platforms you download from.

## 📄 License

MIT License - Feel free to use and modify!
