# ⚡ Quick Start - Content Creator App

## Your App is LIVE! 🎉

- **🌐 Live URL**: https://content-creator-sepia.vercel.app
- **📱 iPhone**: Open on Safari, tap Share → Add to Home Screen
- **🔗 GitHub**: https://github.com/rimidalvsulrod/content-creator

---

## What You Need (One-Time Setup)

### 1️⃣ Install FFmpeg

**Pick your OS:**

<details>
<summary><b>🪟 Windows</b></summary>

Option A (Recommended):
```bash
choco install ffmpeg
```

Option B (Manual):
- Download: https://ffmpeg.org/download.html
- Extract and add to PATH

Verify:
```bash
ffmpeg -version
```
</details>

<details>
<summary><b>🍎 Mac</b></summary>

```bash
brew install ffmpeg
```

Verify:
```bash
ffmpeg -version
```
</details>

<details>
<summary><b>🐧 Linux</b></summary>

```bash
sudo apt-get install ffmpeg
```

Verify:
```bash
ffmpeg -version
```
</details>

---

## How to Use

### 🏠 Use at Home (Localhost)

**Terminal 1 - Start Backend:**
```bash
cd content-creator
npm run server
```
You should see:
```
Video processing server running on port 3001
```

**Terminal 2 - Start Frontend:**
```bash
cd content-creator
npm run dev
```
Opens at: http://localhost:5173

**Or just double-click** `START_SERVER.bat` on Windows

---

### 📱 Use on Vercel + iPhone

The app is already deployed! To make it work with your PC's backend:

#### Setup Tunneling (Pick One)

**Using ngrok (Easiest):**
```bash
npm install -g ngrok
ngrok http 3001
```
You'll get a URL like: `https://abc123.ngrok.io`

Copy that URL, then:

1. Go to: https://vercel.com/albanoajnorwalkct-pngs-projects/content-creator/settings/environment-variables
2. Add new environment variable:
   - Name: `VITE_API_URL`
   - Value: `https://abc123.ngrok.io` (your ngrok URL)
3. Click "Save" → Redeploy
4. Done! The Vercel app now talks to your PC

**Or using Cloudflare Tunnel:**
- More stable but more setup
- See SETUP.md for instructions

---

## 🎬 Using the App

1. **Enter Script**: Type what you want to say
   - Separate parts with: `---`
   ```
   Hello, my name is Vlad.
   ---
   This is my second segment.
   ---
   Thanks for watching!
   ```

2. **Set Duration**: Pick 5-15 seconds per segment (the slider)

3. **Start Recording**: Click the red button

4. **Speak**: The app shows your script, you just talk!
   - Each segment auto-records
   - 5-second break between segments
   - Then next segment

5. **Get Video**: MP4 auto-downloads when done!

---

## 🔍 Quick Troubleshooting

| Problem | Fix |
|---------|-----|
| Camera won't work | Check browser permissions (Settings > Privacy > Camera) |
| "FFmpeg not found" | Install FFmpeg (see above) |
| Backend error | Make sure `npm run server` is running |
| Can't reach Vercel | Make sure ngrok/tunnel is running and URL is in env vars |
| Audio issues | Use external mic, close background apps |

---

## 📍 Important URLs

| Item | URL/Command |
|------|-----------|
| Live App | https://content-creator-sepia.vercel.app |
| GitHub | https://github.com/rimidalvsulrod/content-creator |
| Backend | `npm run server` (port 3001) |
| Frontend Dev | `npm run dev` (port 5173) |
| Vercel Project | https://vercel.com/albanoajnorwalkct-pngs-projects/content-creator |

---

## 📞 Need More Help?

- **SETUP.md** - Detailed setup guide with all options
- **README.md** - Full documentation
- Check browser console (F12) for errors
- Test with 3-word script first before long recording

---

## 🎯 Your Next Step

1. **Install FFmpeg** (if not done)
2. **Run backend**: `npm run server`
3. **Open app**: https://content-creator-sepia.vercel.app (or localhost:5173)
4. **Test recording**: Simple 2-segment test
5. **Enjoy!** 🎉

---

**Welcome to content creation! Go make something awesome! 🚀**
