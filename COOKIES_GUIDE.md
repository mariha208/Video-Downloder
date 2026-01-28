# How to fix Instagram Download Errors (Cookie Guide)

Instagram is very strict about automated downloads. If you see errors like "Login required" or "Video not available", you probably need to provide cookies.

## Method 1: Automatic (Windows Desktop only)
If you are running the app on your computer, `yt-dlp` will automatically try to steal cookies from your **Chrome** browser. 
1. Open Chrome.
2. Log in to your Instagram account.
3. Keep Chrome open while using the downloader.

---

## Method 2: Manual (Best for Servers/Laptops)
This is the most reliable method.

1. Install the **"Get cookies.txt LOCALLY"** extension in Chrome or Edge.
2. Go to [Instagram.com](https://www.instagram.com) and make sure you are logged in.
3. Click the extension icon and select **"Export"** to download `instagram.com_cookies.txt`.
4. Rename that file to just `cookies.txt`.
5. Place the `cookies.txt` file in your project folder:
   `c:\Users\The Mars\Desktop\video-Downloader\cookies.txt`
6. Restart your server.

> [!TIP]
> Never share your `cookies.txt` file with anyone. It contains your login session!
