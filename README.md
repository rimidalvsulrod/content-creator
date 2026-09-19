# 📹 Content Creator - Teleprompter Recording App

A PWA (Progressive Web App) that lets you record content with a teleprompter, automatic video segmentation, and MP4 export.

## Features

- 📱 Works on iPhone, Android, and web browsers
- 📝 Teleprompter display with your script
- ⏱️ Customizable segment duration (3-30 seconds)
- 🎬 Automatic video recording with 5-second breaks between segments
- ✂️ Automatic video joining and MP4 export
- 📲 Add to iPhone homescreen for app-like experience
- 🌙 Dark mode UI optimized for content creators

## Setup

### Prerequisites

- Node.js 18+
- FFmpeg (for video processing)
  - **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html) or use `choco install ffmpeg`
  - **Mac**: `brew install ffmpeg`
  - **Linux**: `sudo apt-get install ffmpeg`

### Development

1. Install dependencies:
```bash
npm install
```

2. Start the backend server (in one terminal):
```bash
npm run server
```
This starts on port 3001 and handles video processing.

3. Start the frontend dev server (in another terminal):
```bash
npm run dev
```
This starts on port 5173.

4. Open http://localhost:5173 in your browser

### Building for Production

```bash
npm run build
```

This creates a `dist` folder with your production-ready app.

## Deployment

### Frontend Deployment (Vercel)

1. Push to GitHub:
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

2. Deploy on Vercel:
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Vercel will auto-detect Vite settings
   - Deploy!

### Backend Deployment (Your PC)

The video processing server (FFmpeg) must run on your PC. After Vercel deploys:

1. Keep a terminal running:
```bash
npm install
npm run server
```

2. Get your public IP or use a tunneling service:
   - **ngrok**: `ngrok http 3001` (free tier available)
   - **Cloudflare Tunnel**: Free alternative
   - **Static IP**: If you have one, just use that

3. Update the API URL in your app:
   - In `vite.config.ts`, change the proxy target to your public server URL
   - Or set environment variable: `VITE_API_URL=https://your-server.com`

4. Redeploy on Vercel with the new API URL

## Usage

1. **Add Script**: Enter your script, separating segments with `---` on its own line
2. **Set Pacing**: Choose how long each segment records (3-30 seconds)
3. **Start Recording**: Press the record button
4. **Record**: Speak clearly for each segment. The app automatically handles timing
5. **Export**: Once done, your MP4 is automatically downloaded

## iPhone Setup

1. Open the app on iPhone Safari
2. Tap Share → Add to Home Screen
3. Name it "Content Creator" and tap Add
4. It works just like a native app!

## API Endpoints

- `POST /api/merge-video` - Upload video segments and get merged MP4
  - Form data: `segments` (multiple files)
  - Returns: MP4 file blob

- `GET /health` - Health check

## Requirements

- Modern browser with WebRTC support
- Camera and microphone permissions
- FFmpeg installed and in PATH (for backend)

## Troubleshooting

**Camera not working?**
- Check browser permissions (Settings > Privacy > Camera)
- Make sure HTTPS is enabled if on Vercel (can use localhost with HTTP)

**FFmpeg not found?**
- Ensure FFmpeg is installed and in your system PATH
- Test: `ffmpeg -version` in terminal

**API not connecting?**
- Check backend is running: `curl http://localhost:3001/health`
- Verify proxy settings in vite.config.ts
- Check CORS if using external backend

## License

MIT
