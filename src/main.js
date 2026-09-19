import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import './style.css';

const $ = (id) => document.getElementById(id);
const BREAK_S = 5;
const COUNTDOWN_S = 3;
const REDO_S = 2;
const TAIL_S = 1.5;
const MAX_WORDS = 32;
const SILENCE_END = 900;
const SILENCE_LONG = 2000;
const KEEP_TAIL = 0.45;
const OVERRUN_MS = 3000;
const PREROLL_MS = 500;
const RATIO = 9 / 16;
const P = new URLSearchParams(location.search);
const DEMO = P.has('demo');
const DEMO_WIDE = P.get('demo') === 'wide';

const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};
const cfg = {
  mode: store.get('mode', 'auto'),
  wpm: +store.get('wpm', 150),
  secs: +store.get('secs', 10),
  cam: store.get('cam', 'user'),
  light: store.get('light', '0') === '1',
};

const el = {
  script: $('script'), wpm: $('wpm'), wpmOut: $('wpmOut'), secs: $('secs'), secsOut: $('secsOut'),
  autoRow: $('autoRow'), fixedRow: $('fixedRow'), summary: $('summary'),
  stage: $('stage'), frame: $('frame'), preview: $('preview'), status: $('status'), line: $('line'), next: $('next'),
  bigNum: $('bigNum'), fill: $('fill'), recBtn: $('recBtn'), stopBtn: $('stopBtn'), skipBtn: $('skipBtn'),
  redoBtn: $('redoBtn'), lightBtn: $('lightBtn'), hint: $('hint'), meter: $('meter'), micName: $('micName'), toast: $('toast'),
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
    ? `<b>${clips.length}</b> clip${clips.length > 1 ? 's' : ''} &middot; up to <b>${fmt(rec)}</b> of video (silence is cut, so usually less)`
    : 'Add a script to get started.';
  $('openCam').disabled = !clips.length;
}

el.script.value = store.get('script', '');
el.script.addEventListener('input', () => { store.set('script', el.script.value); renderSetup(); });
$('modeSeg').addEventListener('click', (e) => { const m = e.target.dataset.mode; if (m) { cfg.mode = m; store.set('mode', m); renderSetup(); } });
$('camSeg').addEventListener('click', (e) => { const c = e.target.dataset.cam; if (c) { cfg.cam = c; store.set('cam', c); renderSetup(); } });
el.wpm.addEventListener('input', () => { cfg.wpm = +el.wpm.value; store.set('wpm', cfg.wpm); renderSetup(); });
el.secs.addEventListener('input', () => { cfg.secs = +el.secs.value; store.set('secs', cfg.secs); renderSetup(); });

/* ---------- layout (always a 9:16 frame, optional ring light) ---------- */
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)';
document.body.appendChild(probe);

const ringOn = () => cfg.light && cfg.cam === 'user';

function layout() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const cs = getComputedStyle(probe);
  const st = parseFloat(cs.paddingTop) || 0;
  const sb = parseFloat(cs.paddingBottom) || 0;
  const ring = ringOn();
  let fw; let top; let radius = 0;
  if (ring) {
    top = st + 52;
    const r = Math.max(22, Math.min(46, W * 0.07));
    fw = Math.min(W - 2 * r, ((H - top - (170 + sb)) * 9) / 16);
    radius = 22;
  } else {
    top = 0;
    fw = Math.min(W, (H * 9) / 16);
  }
  fw = Math.max(120, fw);
  const fh = (fw * 16) / 9;
  Object.assign(el.frame.style, {
    width: `${fw}px`, height: `${fh}px`, left: `${(W - fw) / 2}px`, top: `${top}px`, borderRadius: `${radius}px`,
  });
  el.frame.style.setProperty('--pt', `${ring ? 14 : st + 64}px`);
  el.stage.classList.toggle('lit-on', ring);
  el.lightBtn.classList.toggle('on', cfg.light);
}
window.addEventListener('resize', layout);
window.addEventListener('orientationchange', layout);

/* ---------- camera + matching microphone ---------- */
let stream = null;
let recStream = null;
let recDims = { w: 720, h: 1280 };
let cropTimer = 0;
let wake = null;
let demoCtx = null;
let micLabel = '';

function demoStream() {
  const w = DEMO_WIDE ? 640 : 360;
  const h = DEMO_WIDE ? 360 : 640;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  const t0 = performance.now();
  setInterval(() => {
    const t = performance.now() - t0;
    x.fillStyle = `hsl(${(t / 15) % 360} 55% 30%)`; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff'; x.font = 'bold 56px sans-serif'; x.textAlign = 'center';
    x.fillText(`${(t / 1000).toFixed(1)}s`, w / 2, h / 2);
  }, 33);
  const s = c.captureStream(30);
  demoCtx = new AudioContext();
  const osc = demoCtx.createOscillator(); const g = demoCtx.createGain(); g.gain.value = 0.0001;
  const d = demoCtx.createMediaStreamDestination();
  osc.connect(g); g.connect(d); osc.start();
  window.__tone = (on) => { g.gain.value = on ? 0.3 : 0.0001; };
  d.stream.getAudioTracks().forEach((t) => s.addTrack(t));
  return s;
}

function stopStream() {
  clearInterval(cropTimer);
  try { vad.src?.disconnect(); } catch { /* ignore */ }
  vad.src = null; vad.an = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null; recStream = null;
  el.preview.srcObject = null;
}

async function matchMic(s) {
  const want = cfg.cam === 'user' ? /front|user|face/i : /back|rear|environment/i;
  const cur = s.getAudioTracks()[0];
  micLabel = cur?.label || '';
  try {
    const mics = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    const m = mics.find((d) => want.test(d.label));
    if (!m) return s;
    if (cur && cur.getSettings().deviceId === m.deviceId) { micLabel = m.label; return s; }
    const a = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: m.deviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: false },
    });
    s.getAudioTracks().forEach((t) => { t.stop(); s.removeTrack(t); });
    s.addTrack(a.getAudioTracks()[0]);
    micLabel = m.label;
  } catch (e) { console.warn('mic match failed', e); }
  return s;
}

function buildRecStream() {
  clearInterval(cropTimer);
  const vt = stream.getVideoTracks()[0];
  const { width: w, height: h } = vt.getSettings();
  if (w && h && Math.abs(w / h - RATIO) < 0.012) {
    recStream = stream; recDims = { w, h };
    return;
  }
  const c = document.createElement('canvas');
  c.width = 720; c.height = 1280;
  const x = c.getContext('2d');
  cropTimer = setInterval(() => {
    const v = el.preview;
    if (!v.videoWidth) return;
    const k = Math.max(720 / v.videoWidth, 1280 / v.videoHeight);
    const dw = v.videoWidth * k; const dh = v.videoHeight * k;
    x.drawImage(v, (720 - dw) / 2, (1280 - dh) / 2, dw, dh);
  }, 33);
  const cs = c.captureStream(30);
  stream.getAudioTracks().forEach((t) => cs.addTrack(t));
  recStream = cs; recDims = { w: 720, h: 1280 };
}

async function startCamera() {
  stopStream();
  if (DEMO) stream = demoStream();
  else {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera needs HTTPS. Open the https:// link.');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      video: { facingMode: { ideal: cfg.cam }, width: { ideal: 1080 }, height: { ideal: 1920 }, aspectRatio: { ideal: RATIO }, frameRate: { ideal: 30 } },
    });
    stream = await matchMic(stream);
  }
  el.preview.srcObject = stream;
  el.preview.classList.toggle('mirror', cfg.cam === 'user' && !DEMO);
  await el.preview.play().catch(() => {});
  buildRecStream();
  setupVAD();
  el.micName.textContent = DEMO ? 'Mic: demo tone' : micLabel ? `Mic: ${micLabel}` : '';
  layout();
  applyTorch(true);
}

async function applyTorch(quiet) {
  if (cfg.cam !== 'environment') return;
  const vt = stream?.getVideoTracks()[0];
  try { await vt?.applyConstraints({ advanced: [{ torch: cfg.light }] }); }
  catch { if (cfg.light && !quiet) toast('Rear torch is not supported on this device.'); }
}

el.lightBtn.addEventListener('click', () => {
  cfg.light = !cfg.light;
  store.set('light', cfg.light ? '1' : '0');
  layout();
  applyTorch(false);
});

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

/* ---------- voice activity ---------- */
const vad = { ctx: null, an: null, src: null, buf: null, thr: 0.02, ok: false };

function setupVAD() {
  try {
    vad.ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    const tracks = stream.getAudioTracks();
    if (!tracks.length) return;
    vad.src = vad.ctx.createMediaStreamSource(new MediaStream(tracks));
    vad.an = vad.ctx.createAnalyser();
    vad.an.fftSize = 1024;
    vad.buf = new Float32Array(vad.an.fftSize);
    vad.src.connect(vad.an);
  } catch (e) { console.warn('VAD unavailable', e); vad.an = null; }
}

function level() {
  if (!vad.an) return 0;
  vad.an.getFloatTimeDomainData(vad.buf);
  let s = 0;
  for (let i = 0; i < vad.buf.length; i++) s += vad.buf[i] * vad.buf[i];
  return Math.sqrt(s / vad.buf.length);
}

function calibrate(samples) {
  const sorted = samples.filter((v) => v >= 0).sort((a, b) => a - b);
  vad.ok = !!vad.an && sorted.length > 5 && sorted[sorted.length - 1] > 0;
  const floor = sorted.length ? sorted[Math.floor(sorted.length * 0.4)] : 0;
  vad.thr = Math.max(0.012, floor * 3.2);
}

let meterTimer = 0;
function startMeter() {
  clearInterval(meterTimer);
  meterTimer = setInterval(() => { el.meter.style.width = `${Math.min(100, level() * 500)}%`; }, 80);
}
function stopMeter() { clearInterval(meterTimer); el.meter.style.width = '0'; }

/* ---------- stage UI ---------- */
function setState(s) {
  el.stage.dataset.state = s;
  const live = s === 'rec' || s === 'break';
  el.recBtn.hidden = s !== 'idle';
  el.stopBtn.hidden = s === 'idle';
  el.skipBtn.hidden = s !== 'break';
  el.redoBtn.hidden = !live;
  $('backBtn').hidden = s !== 'idle';
  $('flipBtn').hidden = s !== 'idle' || DEMO;
  el.bigNum.hidden = !(s === 'countdown' || s === 'redo' || s === 'break');
  el.stopBtn.textContent = s === 'countdown' ? 'Cancel' : 'Finish';
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
  layout();
  if (!clips.length) { el.line.textContent = ''; el.next.textContent = ''; return; }
  showLine(clips[0], { active: false });
  el.next.textContent = `${clips.length} clip${clips.length > 1 ? 's' : ''} · 9:16 · up to ${clips[0].dur}s for clip 1`;
  el.hint.textContent = 'Tap record once. The rest is automatic.';
}

/* ---------- session engine ---------- */
const S = { running: false, stop: false, cancel: false, redo: false, skip: null, results: [] };

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
    const opts = mime ? { mimeType: mime, videoBitsPerSecond: 8e6, audioBitsPerSecond: 128e3 } : undefined;
    const dm = clip.dur * 1000;
    const expectedMs = (clip.words.length / 150) * 60000;
    const speechWin = Math.max(1000, dm - TAIL_S * 1000);
    let rec = null; let chunks = []; let recStart = 0; let done = false;
    let speaking = false; let run = 0; let runStart = 0; let speechStart = null;
    let lastVoice = 0; let lastAny = -1e9;

    const begin = () => {
      chunks = [];
      const mine = chunks;
      rec = new MediaRecorder(recStream, opts);
      rec.ondataavailable = (e) => { if (e.data?.size) mine.push(e.data); };
      rec.start(1000);
      recStart = performance.now();
    };
    const discardRec = () => {
      if (!rec) return;
      rec.ondataavailable = null; rec.onstop = null;
      try { if (rec.state !== 'inactive') rec.stop(); } catch { /* ignore */ }
    };

    try { begin(); } catch (err) {
      console.error(err);
      toast('This browser cannot record video.');
      return resolve(null);
    }
    const t0 = performance.now();

    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(id);
      S.skip = null;
      const cur = rec; const mine = chunks;
      const secs = (performance.now() - recStart) / 1000;
      let keep = null;
      if (speechStart !== null) keep = Math.max(0.6, Math.min(secs, (lastVoice - recStart) / 1000 + KEEP_TAIL));
      else if (vad.ok && !S.redo && !S.cancel) toast("Didn't hear you. Check the mic level bar.", 4500);
      const type = cur.mimeType || mime || 'video/webm';
      const out = () => resolve(mine.length && secs >= 0.8 ? { blob: new Blob(mine, { type }), secs, keep, w: recDims.w, h: recDims.h } : null);
      if (cur.state === 'inactive') return out();
      cur.onstop = out;
      try { cur.stop(); } catch { out(); }
    };

    const id = setInterval(() => {
      const now = performance.now();
      const e = now - t0;
      const lvl = level();
      const voiced = vad.ok && lvl > vad.thr;
      if (voiced) {
        lastAny = now; lastVoice = now;
        if (!run) runStart = now;
        run++;
        if (!speaking && run >= 3) { speaking = true; speechStart = runStart; }
      } else run = 0;

      if (!speaking && vad.ok && e < dm * 0.6 && now - recStart > PREROLL_MS && now - lastAny > 300) {
        discardRec();
        try { begin(); } catch { /* keep going */ }
      }

      el.fill.style.width = `${Math.min(1, e / dm) * 100}%`;
      el.status.textContent = `REC ${fmt(Math.max(0, (dm - e) / 1000))}`;
      highlight(Math.floor(Math.min(1, e / speechWin) * clip.words.length));

      if (speaking) {
        const spoke = lastVoice - speechStart;
        const need = spoke < expectedMs * 0.4 ? SILENCE_LONG : SILENCE_END;
        if (spoke >= 600 && now - lastVoice > need) return finish();
      }
      if (e >= dm) {
        if (speaking && now - lastVoice < 400 && e < dm + OVERRUN_MS) return;
        finish();
      }
    }, 50);
    S.skip = finish;
  });
}

async function preCount(clip, label, secs, state) {
  setState(state);
  el.status.className = 'pill brk';
  el.status.textContent = label;
  showLine(clip, { active: false });
  el.next.textContent = '';
  el.hint.textContent = '';
  for (let n = secs; n >= 1 && !S.cancel && !S.stop; n--) {
    el.bigNum.textContent = n;
    await tick(1000, (p) => { el.fill.style.width = `${p * 100}%`; });
  }
}

async function startSession() {
  if (S.running) return;
  const clips = getClips();
  if (!clips.length) return toast('Add a script first.');
  vad.ctx?.resume?.();
  demoCtx?.resume?.();
  if (!stream) {
    try { await startCamera(); } catch (e) { return toast(camError(e), 6000); }
  }
  const mime = pickMime();
  if (!mime && typeof MediaRecorder === 'undefined') return toast('This browser cannot record video.');
  Object.assign(S, { running: true, stop: false, cancel: false, redo: false, results: [] });
  getFFmpeg().catch(() => {});

  setState('countdown');
  el.status.className = 'pill'; el.status.textContent = 'Get ready';
  showLine(clips[0], { active: false });
  el.next.textContent = 'Stay quiet for a moment';
  el.hint.textContent = '';
  const cal = [];
  for (let n = COUNTDOWN_S; n >= 1 && !S.cancel; n--) {
    el.bigNum.textContent = n;
    await tick(1000, (p) => { el.fill.style.width = `${p * 100}%`; cal.push(level()); });
  }
  calibrate(cal);

  let i = 0;
  let pre = false;
  while (i < clips.length && !S.cancel && !S.stop) {
    if (pre) {
      await preCount(clips[i], 'Redo', REDO_S, 'redo');
      pre = false;
      if (S.cancel || S.stop) break;
    }
    setState('rec');
    el.status.className = 'pill rec';
    showLine(clips[i], { active: true });
    el.next.textContent = clips[i + 1] ? `Next: ${clips[i + 1].text}` : 'Last clip';
    el.hint.textContent = `Clip ${i + 1} of ${clips.length}`;
    const r = await recordClip(clips[i], mime);
    if (S.redo) { S.redo = false; pre = true; continue; }
    S.results[i] = r;
    if (S.cancel || S.stop || i === clips.length - 1) break;

    setState('break');
    el.status.className = 'pill brk';
    el.status.textContent = 'Break';
    showLine(clips[i + 1], { active: false });
    el.next.textContent = 'Next clip starts in';
    el.hint.textContent = `Clip ${i + 2} of ${clips.length} is next`;
    await tick(BREAK_S * 1000, (p, e) => {
      el.fill.style.width = `${(1 - p) * 100}%`;
      el.bigNum.textContent = Math.max(1, Math.ceil(BREAK_S - e / 1000));
    });
    if (S.redo) { S.redo = false; pre = true; continue; }
    i++;
  }
  S.running = false;

  const results = S.results.filter(Boolean);
  if (S.cancel || !results.length) {
    S.results = [];
    renderIdle();
    return;
  }
  stopMeter(); stopStream(); release();
  await exportAndShow(results);
}

el.recBtn.addEventListener('click', startSession);
el.skipBtn.addEventListener('click', () => S.skip?.());
el.redoBtn.addEventListener('click', () => { S.redo = true; S.skip?.(); });
el.stopBtn.addEventListener('click', () => {
  if (el.stage.dataset.state === 'countdown') S.cancel = true; else S.stop = true;
  S.skip?.();
});
$('backBtn').addEventListener('click', () => { stopMeter(); stopStream(); release(); showScreen('setup'); });
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
  startMeter();
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
  const trim = (i) => (results[i].keep ? ['-t', results[i].keep.toFixed(2)] : []);
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
      $('pSub').textContent = 'Cutting silence and joining clips';
      for (let i = 0; i < names.length; i++) {
        const c = await ff.exec([...trim(i), '-i', names[i], '-c', 'copy', '-movflags', '+faststart', '-y', `fx${i}.mp4`]);
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
        ...names.flatMap((n, i) => [...trim(i), '-i', n]), '-filter_complex', fc, '-map', '[v]', '-map', '[a]',
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
  const total = results.reduce((a, r) => a + (r.keep || r.secs), 0);
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  try {
    const blob = await stitch(results);
    outFile = new File([blob], `prompter-${stamp}.mp4`, { type: 'video/mp4' });
    outUrl = URL.createObjectURL(blob);
    $('resultVideo').src = outUrl;
    $('resultMeta').textContent = `${fmt(total)} · 9:16 · ${(blob.size / 1e6).toFixed(1)} MB · MP4`;
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
