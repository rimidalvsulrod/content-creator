# Prompter

Teleprompter camera PWA. Paste a script, press record once: it records each clip for a timed window, takes a 5s break, repeats, then stitches the clips (breaks cut out) into one MP4 in the browser with ffmpeg.wasm. No backend.

- `npm install && npm run dev` (add `?demo` to the URL to use a fake camera on desktop)
- `npm run build` outputs `dist/`; deploy to Vercel as a Vite project.
- iPhone: open the URL in Safari > Share > Add to Home Screen.
