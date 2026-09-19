# 🚀 Content Creator - Setup & Deployment

Your app is **LIVE** on Vercel! Here's how to get everything working:

## ✅ What's Done

- ✓ Frontend deployed to Vercel: https://content-creator-sepia.vercel.app
- ✓ GitHub repo: https://github.com/rimidalvsulrod/content-creator
- ✓ Full React app with teleprompter, recording, and video export
- ✓ PWA support (add to iPhone homescreen!)

## 🔧 What You Need to Do

### 1. Install FFmpeg (Required for video processing)

**Windows:**
```bash
choco install ffmpeg
# OR download from https://ffmpeg.org/download.html
```

**Mac:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg
```

Verify it's installed:
```bash
ffmpeg -version
```

### 2. Start the Backend Server

In this folder, run:
```bash
npm run server
```

Or double-click `START_SERVER.bat` on Windows.

The server will start on `http://localhost:3001`

### 3. Use Locally (Development)

**Frontend (new terminal):**
```bash
npm run dev
```
Opens at http://localhost:5173

**Now test the app:**
1. Click "Start Recording"
2. Grant camera/mic permissions
3. Add your script and set pacing
4. Record, and it should auto-merge and download as MP4

### 4. Use on Vercel (Production + Tunneling)

For the Vercel frontend to reach your backend PC, you need to tunnel your local server:

#### Option A: Use ngrok (Recommended - Free)

1. Install ngrok globally:
```bash
npm install -g ngrok
```

2. In a new terminal, run:
```bash
ngrok http 3001
```

3. Copy the URL it gives you (looks like `https://abc123-456.ngrok.io`)

4. Update Vercel environment variable:
   - Go to: https://vercel.com/albanoajnorwalkct-pngs-projects/content-creator
   - Settings → Environment Variables
   - Add: `VITE_API_URL` = `https://abc123-456.ngrok.io`
   - Redeploy

5. Now visit https://content-creator-sepia.vercel.app and it will use your PC's backend!

#### Option B: Use Cloudflare Tunnel (Also Free, More Stable)

1. Install Cloudflare Tunnel:
```bash
choco install cloudflare-warp
# or download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
```

2. Authenticate:
```bash
cloudflared tunnel login
```

3. Create tunnel:
```bash
cloudflared tunnel create content-creator-tunnel
cloudflared tunnel route dns content-creator-tunnel tunnel.yourdomain.com
cloudflared tunnel run --url http://localhost:3001 content-creator-tunnel
```

4. Use the tunnel URL in Vercel environment variables

### 5. Add to iPhone

1. Open https://content-creator-sepia.vercel.app on Safari
2. Tap Share → Add to Home Screen
3. Name it "Content Creator"
4. It works like a native app!

## 📱 How to Use

1. **Enter Script**: Separate segments with `---` on its own line
2. **Set Pacing**: Choose how many seconds for each segment (3-30s)
3. **Start Recording**: The app will:
   - Show your script on screen (teleprompter)
   - Record for the duration you set
   - Take a 5-second break
   - Move to next segment
   - Repeat until done
4. **Auto-Export**: Once finished, your MP4 downloads automatically

## 🔍 Troubleshooting

**"Failed to access camera"**
- Check browser permissions (Settings > Privacy)
- Make sure you grant camera + microphone

**"API error" or "Failed to process video"**
- Verify backend is running: `curl http://localhost:3001/health`
- Check FFmpeg is installed: `ffmpeg -version`
- Check browser console for errors (F12)

**FFmpeg not found**
- Make sure FFmpeg is in your system PATH
- Restart terminal/PowerShell after installing

**Vercel app can't reach backend**
- Make sure ngrok/Cloudflare tunnel is running
- Check environment variable is set correctly
- Verify tunnel URL is still active (ngrok sessions expire!)

## 📊 File Structure

```
content-creator/
├── src/
│   ├── App.tsx          # Main recording logic
│   ├── App.css          # Styling
│   └── components/      # React components
├── public/
│   ├── manifest.json    # PWA manifest
│   └── sw.js           # Service worker
├── server.js           # Backend (FFmpeg video processing)
├── package.json        # Dependencies
└── vercel.json         # Vercel config
```

## 🎥 How Video Processing Works

1. **Frontend Records**: Uses WebRTC MediaRecorder to capture camera
2. **WebM Segments**: Each segment saved as WebM format
3. **Backend Conversion**: FFmpeg converts WebM → MP4
4. **Video Merge**: FFmpeg concatenates all MP4s into one
5. **Download**: Final MP4 sent to your phone

## 🚀 Tips & Tricks

- **Better audio**: Use a lavalier mic or headphone mic with phone
- **Better lighting**: Use natural light or a small ring light
- **Script pacing**: 5-10 seconds is good for most content
- **Test first**: Do a short test recording before real shoot

## 🆘 Need Help?

- Check README.md for more info
- Backend logs show FFmpeg processing
- Browser DevTools (F12) shows network errors
- Test with simple 3-word script first

---

**Your Vercel URL**: https://content-creator-sepia.vercel.app
**Your GitHub**: https://github.com/rimidalvsulrod/content-creator
**Backend Port**: 3001
