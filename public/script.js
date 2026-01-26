// DOM Elements
const downloadForm = document.getElementById('downloadForm');
const videoUrlInput = document.getElementById('videoUrl');
const downloadBtn = document.getElementById('downloadBtn');
const pasteBtn = document.getElementById('pasteBtn');
const statusMessage = document.getElementById('statusMessage');
const progressContainer = document.getElementById('progressContainer');
const progressText = document.getElementById('progressText');
const btnText = downloadBtn.querySelector('.btn-text');
const btnLoading = downloadBtn.querySelector('.btn-loading');

const qualityOptionsContainer = document.getElementById('qualityOptionsContainer');
const qualityButtons = document.getElementById('qualityButtons');
const audioOnlyToggle = document.getElementById('audioOnlyToggle');
const btnTextContent = document.getElementById('btnTextContent');
const loadingText = document.getElementById('loadingText');

let currentVideoInfo = null;
let selectedQuality = null;
let lastUrl = null;

// API Base URL - Change this when deploying
const API_BASE_URL = window.location.origin;

// Paste button functionality
pasteBtn.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        videoUrlInput.value = text;
        videoUrlInput.focus();
        showStatus('Link pasted! Click Download to continue.', 'info');
    } catch (err) {
        showStatus('Could not access clipboard. Please paste manually.', 'error');
    }
});

// Form submission
downloadForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const url = videoUrlInput.value.trim();

    if (!url) {
        showStatus('Please enter a video URL', 'error');
        return;
    }

    if (!isValidUrl(url)) {
        showStatus('Please enter a valid URL', 'error');
        return;
    }

    // If info hasn't been fetched for this URL yet, fetch it first
    if (!currentVideoInfo || lastUrl !== url) {
        await fetchInfo(url);
        return;
    }

    // If info is present, proceed with download
    const isAudioOnly = audioOnlyToggle.checked;
    await downloadVideo(url, isAudioOnly ? 'audio' : selectedQuality);
});

async function fetchInfo(url) {
    setLoading(true, 'Fetching video info...');
    qualityOptionsContainer.style.display = 'none';
    currentVideoInfo = null;
    selectedQuality = null;
    lastUrl = url;

    try {
        const response = await fetch(`${API_BASE_URL}/api/info`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to get video info');
        }

        currentVideoInfo = await response.json();
        displayQualityOptions(currentVideoInfo);

        // Change button text to confirm download
        btnTextContent.innerHTML = '<span class="btn-icon">✅</span> Confirm Download';
        showStatus(`Video found: ${currentVideoInfo.title}`, 'info');

    } catch (error) {
        console.error('Info fetch error:', error);
        showStatus(`❌ ${error.message}`, 'error');
    } finally {
        setLoading(false);
    }
}

function displayQualityOptions(info) {
    qualityButtons.innerHTML = '';
    qualityOptionsContainer.style.display = 'block';

    const resolutions = info.resolutions || [];
    const standardResolutions = [2160, 1080, 720, 480, 360, 240];

    // Add "Best" button first
    addQualityButton('Best', null, true);

    // Add standard resolutions
    standardResolutions.forEach(res => {
        addQualityButton(`${res}p`, res, false);
    });

    // Also add the requested 520p (even if non-standard)
    addQualityButton('520p', 520, false);

    function addQualityButton(label, value, isActive) {
        // Avoid duplicates if a standard resolution is already in the dynamic list
        const existing = Array.from(qualityButtons.querySelectorAll('.quality-btn')).some(btn => btn.textContent === label);
        if (existing) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `quality-btn ${isActive ? 'active' : ''}`;
        btn.textContent = label;
        if (isActive) selectedQuality = value;

        btn.onclick = () => {
            document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedQuality = value;
            audioOnlyToggle.checked = false;
        };

        qualityButtons.appendChild(btn);
    }
}

audioOnlyToggle.onchange = () => {
    if (audioOnlyToggle.checked) {
        document.querySelectorAll('.quality-btn').forEach(b => b.classList.remove('active'));
        selectedQuality = 'audio';
    } else {
        // Reactivate first button
        const firstBtn = qualityButtons.querySelector('.quality-btn');
        if (firstBtn) firstBtn.click();
    }
};

// Validate URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

// Show status message
function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';

    // Auto-hide after 5 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 5000);
    }
}

// Hide status message
function hideStatus() {
    statusMessage.style.display = 'none';
}

// Set loading state
function setLoading(loading, message = 'Downloading...') {
    downloadBtn.disabled = loading;
    const btnTextElem = downloadBtn.querySelector('.btn-text');
    if (btnTextElem) btnTextElem.style.display = loading ? 'none' : 'flex';
    btnLoading.style.display = loading ? 'flex' : 'none';
    loadingText.textContent = message;
    progressContainer.style.display = loading ? 'block' : 'none';

    if (loading) {
        hideStatus();
    }
}

// Update progress text
function updateProgress(text) {
    progressText.textContent = text;
}

// Download video
async function downloadVideo(url, quality) {
    setLoading(true, 'Downloading...');
    updateProgress('Connecting to server...');

    try {
        updateProgress('Processing video... This may take a while for large videos.');

        const response = await fetch(`${API_BASE_URL}/download`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, quality }),
        });

        if (!response.ok) {
            // Check if response is HTML (timeout error from Render)
            const contentType = response.headers.get('Content-Type') || '';
            if (contentType.includes('text/html')) {
                throw new Error('Server timeout. The video is too large or taking too long. Try a shorter video or run the app locally.');
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Download failed');
        }

        updateProgress('Download complete! Saving file...');

        // Get filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = quality === 'audio' ? 'audio.mp3' : 'video.mp4';

        if (contentDisposition) {
            const match = contentDisposition.match(/filename="(.+)"/);
            if (match) {
                filename = match[1];
            }
        }

        // Create blob and download
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        window.URL.revokeObjectURL(downloadUrl);

        showStatus('✅ Video downloaded successfully!', 'success');
        videoUrlInput.value = '';
        qualityOptionsContainer.style.display = 'none';
        currentVideoInfo = null;
        btnTextContent.innerHTML = '<span class="btn-icon">⬇️</span> Download Video';

    } catch (error) {
        console.error('Download error:', error);

        // Handle specific errors
        let errorMessage = error.message;

        if (error.message.includes('Failed to fetch')) {
            errorMessage = 'Could not connect to server. Please make sure the server is running.';
        } else if (error.message.includes('yt-dlp')) {
            errorMessage = 'Server error: yt-dlp is not installed on the server.';
        }

        showStatus(`❌ ${errorMessage}`, 'error');
    } finally {
        setLoading(false);
    }
}

// Add enter key support
videoUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        downloadForm.dispatchEvent(new Event('submit'));
    }
});

// Clear status on input focus
videoUrlInput.addEventListener('focus', () => {
    if (statusMessage.classList.contains('error')) {
        hideStatus();
    }
});

// Add visual feedback when URL is detected as valid
videoUrlInput.addEventListener('input', () => {
    const url = videoUrlInput.value.trim();
    if (url && isValidUrl(url)) {
        videoUrlInput.style.borderColor = 'rgba(16, 185, 129, 0.5)';
    } else {
        videoUrlInput.style.borderColor = '';
    }
});

// Service Worker registration for PWA (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment below to enable PWA
        // navigator.serviceWorker.register('/sw.js');
    });
}

console.log('🎬 Video Downloader loaded successfully!');
console.log('API Base URL:', API_BASE_URL);
