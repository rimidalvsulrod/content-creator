import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import './style.css';

const $ = (id) => document.getElementById(id);
const BREAK_S = 5;
const COUNTDOWN_S = 3;
const TAIL_S = 1.5;
const MAX_WORDS = 32;
const DEMO = new URLSearchParams(location.search).has('demo');

const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
const cfg = {
  mode: store.get('mode', 'auto'),
  wpm: +store.get('wpm', 150),
  secs: +store.get('secs', 10),
  cam: store.get('cam', 'user'),
};

const el = {
  script: $('script'), wpm: $('wpm'), wpmOut: $('wpmOut'), secs: $('secs'), secsOut: $('secsOut'),
  autoRow: $('autoRow'), fixedRow: $('fixedRow'), summary: $('summary'),
  stage: $('stage'), preview: $('preview'), status: $('status'), line: $('line'), next: $('next'),
  bigNum: $('bigNum'), fill: $('fill'), recBtn: $('recBtn'), stopBtn: $('stopBtn'), skipBtn: $('skipBtn'),
  hint: $('hint'), toast: $('toast'),
};

function toast(msg, ms = 3800) {
  el.toast.textContent = msg;
  el.toast.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.toast.hidden = true; }, ms);
}
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
function showScreen(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
}

/* ---------- script + pacing ---------- */
const wc = (t) => t.split(/\s+/).filter(Boolean).length;

function splitLine(line) {
  if (wc(line) <= MAX_WORDS) return [line];
  const sentences = line.match(/[^.!?…]+[.!?…]+["'”’)\]]*\s*|[^.!?…]+$/g) || [line];
  const out = [];
  let cur = '';
  for (const s of sentences) {
    const t = s.trim();
    if (!t) continue;
    if (cur && wc(cur) + wc(t) > MAX_WORDS) { out.push(cur); cur = t; }
    else cur = cur ? `${cur} ${t}` : t;
  }
  if (cur) out.push(cur);
  return out;
}

function clipDur(words) {
  return cfg.mode === 'fixed' ? cfg.secs : Math.max(3, Math.ceil((words / cfg.wpm) * 60 + TAIL_S));
}

function getClips() {
  return el.script.value
    .split(/\n+/).map((s) => s.trim()).filter(Boolean).flatMap(splitLine)
    .map((text) => { const words = text.split(/\s+/); return { text, words, dur: clipDur(words.length) }; });
}

function renderSetup() {
  document.querySelectorAll('#modeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === cfg.mode));
  document.querySelectorAll('#camSeg button').forEach((b) => b.classList.toggle('on', b.dataset.cam === cfg.cam));
  el.autoRow.hidden = cfg.mode !== 'auto';
  el.fixedRow.hidden = cfg.mode !== 'fixed';
  el.wpm.value = cfg.wpm; el.wpmOut.textContent = `${cfg.wpm} wpm`;
  el.secs.value = cfg.secs; el.secsOut.textContent = `${cfg.secs} s`;
  const clips = getClips();
  const rec = clips.reduce((a, c) => a + c.dur, 0);
  el.summary.innerHTML = clips.length
    ? `<b>${clips.length}</b> clip${clips.length > 1 ? 's' : ''} &middot; final video &asymp; <b>${fmt(rec)}</b> &middot; session &asymp; ${fmt(rec + (clips.length - 1) * BREAK_S)}`
    : 'Add a script to get started.';
  $('openCam').disabled = !clips.length;
}

el.script.value = store.get('script', '');
el.script.addEventListener('input', () => { store.set('script', el.script.value); renderSetup(); });
$('modeSeg').addEventListener('click', (e) => { const m = e.target.dataset.mode; if (m) { cfg.mode = m; store.set('mode', m); renderSetup(); } });
$('camSeg').addEventListener('click', (e) => { const c = e.target.dataset.cam; if (c) { cfg.cam = c; store.set('cam', c); renderSetup(); } });
el.wpm.addEventListener('input', () => { cfg.wpm = +el.wpm.value; store.set('wpm', cfg.wpm); renderSetup(); });
el.secs.addEventListener('input', () => { cfg.secs = +el.secs.value; store.set('secs', cfg.secs); renderSetup(); });

/* ---------- camera ---------- */
let stream = null;
let wake = null;

function demoStream() {
  const c = document.createElement('canvas');
  c.width = 360; c.height = 640;
  const x = c.getContext('2d');
  const t0 = performance.now();
  setInterval(() => {
    const t = performance.now() - t0;
    x.fillStyle = `hsl(${(t / 15) % 360} 55% 30%)`; x.fillRect(0, 0, 360, 640);
    x.fillStyle = '#fff'; x.font = 'bold 56px sans-serif'; x.textAlign = 'center';
    x.fillText(`${(t / 1000).toFixed(1)}s`, 180, 330);
  }, 33);
  const s = c.captureStream(30);
  const ac = new AudioContext();
  const osc = ac.createOscillator(); const g = ac.createGain(); g.gain.value = 0.05;
  const d = ac.createMediaStreamDestination();
  osc.connect(g); g.connect(d); osc.start();
  d.stream.getAudioTracks().forEach((t) => s.addTrack(t));
  return s;
}

function stopStream() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  el.preview.srcObject = null;
}

async function startCamera() {
  stopStream();
  if (DEMO) stream = demoStream();
  else {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera needs HTTPS. Open the https:// link.');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: { facingMode: { ideal: cfg.cam }, width: { ideal: 1080 }, height: { ideal: 1920 }, frameRate: { ideal: 30 } },
    });
  }
  el.preview.srcObject = stream;
  el.preview.classList.toggle('mirror', cfg.cam === 'user' && !DEMO);
  await el.preview.play().catch(() => {});
}

async function keepAwake() {
  try { wake = await navigator.wakeLock?.request('screen'); } catch { /* ignore */ }
}
function release() { try { wake?.release(); } catch { /* ignore */ } wake = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && el.stage.classList.contains('active')) keepAwake();
});

function pickMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  return [
    'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4',
    'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm',
  ].find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

/* ---------- stage UI ---------- */
function setState(s) {
  el.stage.dataset.state = s;
  el.recBtn.hidden = s !== 'idle';
  el.stopBtn.hidden = s === 'idle';
  el.skipBtn.hidden = s !== 'break';
  $('backBtn').hidden = s !== 'idle';
  $('flipBtn').hidden = s !== 'idle' || DEMO;
  el.bigNum.hidden = !(s === 'countdown' || s === 'break');
  el.stopBtn.textContent = s === 'countdown' ? 'Cancel' : 'Finish & export';
  if (s === 'idle') { el.fill.style.width = '0'; el.status.className = 'pill'; el.status.textContent = ''; }
}

let wordEls = [];
let lastIdx = -1;
function showLine(clip, { active }) {
  el.line.className = `line${clip.words.length > 22 ? ' long' : ''}`;
  el.line.innerHTML = '';
  wordEls = clip.words.map((w) => {
    const s = document.createElement('span');
    s.className = 'w'; s.textContent = `${w} `;
    el.line.appendChild(s);
    return s;
  });
  lastIdx = -1;
  if (!active) wordEls.forEach((s) => s.classList.remove('said', 'now'));
}
function highlight(idx) {
  if (idx === lastIdx) return;
  lastIdx = idx;
  wordEls.forEach((s, i) => { s.classList.toggle('said', i < idx); s.classList.toggle('now', i === idx); });
}

function renderIdle() {
  const clips = getClips();
  setState('idle');
  if (!clips.length) { el.line.textContent = ''; el.next.textContent = ''; return; }
  showLine(clips[0], { active: false });
  el.next.textContent = `${clips.length} clip${clips.length > 1 ? 's' : ''} · clip 1 records for ${clips[0].dur}s`;
  el.hint.textContent = 'Tap record once. Everything else is automatic.';
}

/* ---------- session engine ---------- */
const S = { running: false, stop: false, cancel: false, skip: null, results: [] };

function tick(ms, onFrame) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const frame = () => {
      const e = performance.now() - t0;
      onFrame?.(Math.min(1, e / ms), e);
      return e >= ms;
    };
    const done = () => { clearInterval(id); S.skip = null; resolve(); };
    const id = setInterval(() => { if (frame()) done(); }, 100);
    S.skip = done;
    if (frame()) done();
  });
}

function recordClip(clip, mime) {
  return new Promise((resolve) => {
    const chunks = [];
    let rec;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8e6, audioBitsPerSecond: 128e3 } : undefined);
    } catch (err) {
      console.error(err);
      toast('This browser cannot record video.');
      return resolve(null);
    }
    const t0 = performance.now();
    rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
    rec.onstop = () => {
      const secs = (performance.now() - t0) / 1000;
      resolve(chunks.length && secs >= 1
        ? { blob: new Blob(chunks, { type: rec.mimeType || mime || 'video/webm' }), secs, w: el.preview.videoWidth, h: el.preview.videoHeight }
        : null);
    };
    rec.start(1000);
    const speech = Math.max(1, clip.dur - TAIL_S) * 1000;
    tick(clip.dur * 1000, (p, e) => {
      el.fill.style.width = `${p * 100}%`;
      el.status.textContent = `REC ${fmt(Math.max(0, clip.dur - e / 1000))}`;
      highlight(Math.floor(Math.min(1, e / speech) * clip.words.length));
    }).then(() => { if (rec.state !== 'inactive') rec.stop(); });
  });
}

async function startSession() {
  if (S.running) return;
  const clips = getClips();
  if (!clips.length) return toast('Add a script first.');
  if (!stream) {
    try { await startCamera(); } catch (e) { return toast(camError(e), 6000); }
  }
  const mime = pickMime();
  if (!mime && typeof MediaRecorder === 'undefined') return toast('This browser cannot record video.');
  Object.assign(S, { running: true, stop: false, cancel: false, results: [] });
  getFFmpeg().catch(() => {});

  setState('countdown');
  el.status.className = 'pill'; el.status.textContent = 'Get ready';
  showLine(clips[0], { active: false });
  el.next.textContent = '';
  el.hint.textContent = '';
  for (let n = COUNTDOWN_S; n >= 1 && !S.cancel; n--) {
    el.bigNum.textContent = n;
    await tick(1000, (p) => { el.fill.style.width = `${p * 100}%`; });
  }

  for (let i = 0; i < clips.length && !S.cancel && !S.stop; i++) {
    setState('rec');
    el.status.className = 'pill rec';
    showLine(clips[i], { active: true });
    el.next.textContent = clips[i + 1] ? `Next: ${clips[i + 1].text}` : 'Last clip';
    el.hint.textContent = `Clip ${i + 1} of ${clips.length}`;
    const r = await recordClip(clips[i], mime);
    if (r) S.results.push(r);
    if (S.cancel || S.stop || i === clips.length - 1) break;

    setState('break');
    el.status.className = 'pill brk';
    el.status.textContent = 'Break';
    showLine(clips[i + 1], { active: false });
    el.next.textContent = 'Get ready — next clip starts in';
    el.hint.textContent = `Clip ${i + 2} of ${clips.length} is next`;
    await tick(BREAK_S * 1000, (p, e) => {
      el.fill.style.width = `${(1 - p) * 100}%`;
      el.bigNum.textContent = Math.max(1, Math.ceil(BREAK_S - e / 1000));
    });
  }
  S.running = false;

  if (S.cancel || !S.results.length) {
    S.results = [];
    renderIdle();
    return;
  }
  stopStream(); release();
  await exportAndShow(S.results);
}

el.recBtn.addEventListener('click', startSession);
el.skipBtn.addEventListener('click', () => S.skip?.());
el.stopBtn.addEventListener('click', () => {
  if (el.stage.dataset.state === 'countdown') S.cancel = true; else S.stop = true;
  S.skip?.();
});
$('backBtn').addEventListener('click', () => { stopStream(); release(); showScreen('setup'); });
$('flipBtn').addEventListener('click', async () => {
  cfg.cam = cfg.cam === 'user' ? 'environment' : 'user';
  store.set('cam', cfg.cam);
  try { await startCamera(); } catch (e) { toast(camError(e)); }
});
$('openCam').addEventListener('click', openStage);

function camError(e) {
  if (e?.name === 'NotAllowedError') return 'Camera blocked. Allow camera + microphone in Settings > Safari (or this app).';
  if (e?.name === 'NotFoundError') return 'No camera found.';
  return e?.message || 'Could not open the camera.';
}

async function openStage() {
  showScreen('stage');
  renderIdle();
  keepAwake();
  try { await startCamera(); } catch (e) { toast(camError(e), 6000); }
}

/* ---------- editing (ffmpeg.wasm) ---------- */
let ffPromise = null;
let onProgress = () => {};

function getFFmpeg() {
  ffPromise ??= (async () => {
    const ff = new FFmpeg();
    ff.on('progress', ({ progress }) => { if (progress >= 0 && progress <= 1) onProgress(progress); });
    const base = `${location.origin}/ffmpeg/`;
    await ff.load({
      coreURL: await toBlobURL(`${base}ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${base}ffmpeg-core.wasm`, 'application/wasm'),
    });
    return ff;
  })().catch((e) => { ffPromise = null; throw e; });
  return ffPromise;
}

async function fileSize(ff, name) {
  try { return (await ff.readFile(name)).length; } catch { return 0; }
}

async function stitch(results) {
  const ff = await getFFmpeg();
  const exts = results.map((r) => (r.blob.type.includes('mp4') ? 'mp4' : 'webm'));
  const names = results.map((_, i) => `in${i}.${exts[i]}`);
  for (let i = 0; i < results.length; i++) {
    await ff.writeFile(names[i], new Uint8Array(await results[i].blob.arrayBuffer()));
  }
  const fixed = [];
  const cleanup = async () => {
    for (const n of [...names, ...fixed, 'list.txt', 'out.mp4']) { try { await ff.deleteFile(n); } catch { /* ignore */ } }
  };
  try {
    let ok = false;
    if (exts.every((e) => e === 'mp4')) {
      $('pSub').textContent = 'Joining clips (fast path)';
      for (let i = 0; i < names.length; i++) {
        const c = await ff.exec(['-i', names[i], '-c', 'copy', '-movflags', '+faststart', '-y', `fx${i}.mp4`]);
        if (c !== 0) break;
        fixed.push(`fx${i}.mp4`);
      }
      if (fixed.length === names.length) {
        await ff.writeFile('list.txt', fixed.map((n) => `file '${n}'`).join('\n'));
        const code = await ff.exec(['-f', 'concat', '-safe', '0', '-i', 'list.txt', '-c', 'copy', '-movflags', '+faststart', '-y', 'out.mp4']);
        ok = code === 0 && (await fileSize(ff, 'out.mp4')) > 1000;
      }
      if (!ok) { try { await ff.deleteFile('out.mp4'); } catch { /* ignore */ } }
    }
    if (!ok) {
      $('pSub').textContent = 'Re-encoding clips to MP4 (this can take a minute)';
      const { w, h } = results[0];
      const k = Math.min(1, 720 / Math.min(w || 720, h || 1280));
      const W = 2 * Math.round(((w || 720) * k) / 2);
      const H = 2 * Math.round(((h || 1280) * k) / 2);
      const parts = names.map((_, i) =>
        `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}];[${i}:a]aresample=44100[a${i}]`);
      const fc = `${parts.join(';')};${names.map((_, i) => `[v${i}][a${i}]`).join('')}concat=n=${names.length}:v=1:a=1[v][a]`;
      const code = await ff.exec([
        ...names.flatMap((n) => ['-i', n]), '-filter_complex', fc, '-map', '[v]', '-map', '[a]',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '25', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-y', 'out.mp4',
      ]);
      if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`);
    }
    const data = await ff.readFile('out.mp4');
    return new Blob([data], { type: 'video/mp4' });
  } finally {
    await cleanup();
  }
}

/* ---------- export + result ---------- */
let outUrl = null;
let outFile = null;
let rawUrls = [];

function resetResult() {
  if (outUrl) URL.revokeObjectURL(outUrl);
  rawUrls.forEach((u) => URL.revokeObjectURL(u));
  outUrl = null; outFile = null; rawUrls = [];
  $('resultVideo').removeAttribute('src');
  $('errBox').hidden = true; $('rawList').hidden = true; $('rawList').innerHTML = '';
}

async function exportAndShow(results) {
  resetResult();
  showScreen('processing');
  $('pText').textContent = `Editing ${results.length} clip${results.length > 1 ? 's' : ''}…`;
  $('pSub').textContent = 'Loading editor';
  onProgress = (p) => { $('pText').textContent = `Editing… ${Math.round(p * 100)}%`; };
  const total = results.reduce((a, r) => a + r.secs, 0);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  try {
    const blob = await stitch(results);
    outFile = new File([blob], `prompter-${stamp}.mp4`, { type: 'video/mp4' });
    outUrl = URL.createObjectURL(blob);
    $('resultVideo').src = outUrl;
    $('resultMeta').textContent = `${fmt(total)} · ${(blob.size / 1e6).toFixed(1)} MB · MP4`;
    $('dlBtn').hidden = false;
    $('shareBtn').hidden = !(navigator.canShare && navigator.canShare({ files: [outFile] }));
  } catch (e) {
    console.error(e);
    $('resultMeta').textContent = '';
    $('errBox').hidden = false;
    $('errBox').textContent = `Editing failed (${e.message}). Your raw clips are below, tap to save each one.`;
    $('dlBtn').hidden = true; $('shareBtn').hidden = true;
    const list = $('rawList');
    list.hidden = false;
    results.forEach((r, i) => {
      const u = URL.createObjectURL(r.blob);
      rawUrls.push(u);
      const a = document.createElement('a');
      a.href = u; a.download = `clip-${i + 1}.${r.blob.type.includes('mp4') ? 'mp4' : 'webm'}`;
      a.textContent = `Clip ${i + 1} (${fmt(r.secs)})`;
      list.appendChild(a);
    });
  }
  onProgress = () => {};
  showScreen('result');
}

$('dlBtn').addEventListener('click', () => {
  if (!outUrl) return;
  const a = document.createElement('a');
  a.href = outUrl; a.download = outFile.name;
  document.body.appendChild(a); a.click(); a.remove();
});
$('shareBtn').addEventListener('click', async () => {
  try { await navigator.share({ files: [outFile], title: 'My video' }); }
  catch (e) { if (e?.name !== 'AbortError') toast('Share failed. Use Download instead.'); }
});
$('againBtn').addEventListener('click', () => { resetResult(); openStage(); });

/* ---------- boot ---------- */
renderSetup();
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}
