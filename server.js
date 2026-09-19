import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const execAsync = promisify(exec);
const upload = multer({ storage: multer.memoryStorage() });

const UPLOAD_DIR = path.join(__dirname, 'uploads');
const TEMP_DIR = path.join(__dirname, 'temp');

// Create directories if they don't exist
[UPLOAD_DIR, TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

app.post('/api/merge-video', upload.array('segments'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No video segments provided' });
    }

    const sessionId = Date.now().toString();
    const sessionDir = path.join(TEMP_DIR, sessionId);
    fs.mkdirSync(sessionDir, { recursive: true });

    // Convert WebM to MP4 segments
    const convertedSegments = [];
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const inputPath = path.join(sessionDir, `segment_${i}.webm`);
      const outputPath = path.join(sessionDir, `segment_${i}.mp4`);

      fs.writeFileSync(inputPath, file.buffer);

      try {
        await execAsync(`ffmpeg -i "${inputPath}" -c:v libx264 -crf 23 -c:a aac "${outputPath}"`, {
          timeout: 60000,
        });
        convertedSegments.push(outputPath);
      } catch (error) {
        console.error(`Failed to convert segment ${i}:`, error);
        cleanupSession(sessionDir);
        return res.status(500).json({ error: 'Failed to process video segment' });
      }
    }

    // Create concat file
    const concatFilePath = path.join(sessionDir, 'concat.txt');
    const concatContent = convertedSegments
      .map(segment => `file '${segment}'`)
      .join('\n');
    fs.writeFileSync(concatFilePath, concatContent);

    // Merge videos
    const outputPath = path.join(sessionDir, 'output.mp4');
    try {
      await execAsync(
        `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputPath}"`,
        { timeout: 120000 }
      );
    } catch (error) {
      console.error('Failed to merge videos:', error);
      cleanupSession(sessionDir);
      return res.status(500).json({ error: 'Failed to merge videos' });
    }

    // Send file
    res.download(outputPath, 'content.mp4', (err) => {
      if (err) console.error('Download error:', err);
      cleanupSession(sessionDir);
    });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

function cleanupSession(sessionDir) {
  try {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Video processing server running on port ${PORT}`);
});
