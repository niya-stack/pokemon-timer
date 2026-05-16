'use strict';

const CONFIG = {
  BO1: {
    duration: 25 * 60,
    alerts: [
      { at: 10 * 60, text: '残り10分です', state: 'warning', label: '残り10分' },
      { at:  5 * 60, text: '残り5分です',  state: 'danger',  label: '残り5分'  },
    ],
    endMessage: '後攻の番までプレイしてください',
  },
  BO3: {
    duration: 50 * 60,
    alerts: [
      { at: 25 * 60, text: '残り25分です', state: 'warning', label: '残り25分' },
      { at: 10 * 60, text: '残り10分です', state: 'alert',   label: '残り10分' },
      { at:  5 * 60, text: '残り5分です',  state: 'danger',  label: '残り5分'  },
    ],
    endMessage: '今のターンを0ターン目として、追加で3ターンプレイしてください',
  },
};

// --- State ---
let mode          = 'BO1';
let remaining     = CONFIG.BO1.duration;
let running       = false;
let timerStart    = null;   // Date.now() when last started
let baseRemaining = 0;      // remaining seconds at last start
let intervalId    = null;
let firedAlerts   = new Set();
let wakeLock      = null;

// --- Mode ---
function setMode(m) {
  if (running) return;
  mode = m;
  document.getElementById('modeBO1').classList.toggle('active', m === 'BO1');
  document.getElementById('modeBO3').classList.toggle('active', m === 'BO3');
  resetTimer();
}

// --- Timer control ---
function toggleTimer() {
  running ? pause() : start();
}

function start() {
  running       = true;
  timerStart    = Date.now();
  baseRemaining = remaining;

  document.getElementById('btnStart').textContent = '一時停止';
  document.getElementById('timer').classList.add('running');
  document.getElementById('modeBO1').disabled = true;
  document.getElementById('modeBO3').disabled = true;

  intervalId = setInterval(tick, 500);
  acquireWakeLock();
}

function pause() {
  running   = false;
  remaining = calcRemaining();
  clearInterval(intervalId);

  document.getElementById('btnStart').textContent = 'スタート';
  document.getElementById('timer').classList.remove('running');
  document.getElementById('modeBO1').disabled = false;
  document.getElementById('modeBO3').disabled = false;

  releaseWakeLock();
}

function resetTimer() {
  if (running) pause();
  remaining = CONFIG[mode].duration;
  firedAlerts.clear();
  document.body.className = '';
  document.getElementById('statusLabel').innerHTML = '&nbsp;';
  document.getElementById('modeBO1').disabled = false;
  document.getElementById('modeBO3').disabled = false;
  render();
}

// --- Tick ---
function calcRemaining() {
  if (!timerStart) return remaining;
  const elapsed = Math.floor((Date.now() - timerStart) / 1000);
  return Math.max(0, baseRemaining - elapsed);
}

function tick() {
  const prev = remaining;
  remaining  = calcRemaining();

  // Check for alert thresholds crossed since last tick
  for (const alert of CONFIG[mode].alerts) {
    if (prev > alert.at && remaining <= alert.at && !firedAlerts.has(alert.at)) {
      firedAlerts.add(alert.at);
      speak(alert.text);
      vibrate();
      document.body.className = alert.state;
      document.getElementById('statusLabel').textContent = alert.label;
    }
  }

  render();

  if (remaining <= 0) {
    clearInterval(intervalId);
    running = false;
    document.getElementById('timer').classList.remove('running');
    releaseWakeLock();
    showEnd();
  }
}

function render() {
  const m = String(Math.floor(remaining / 60)).padStart(2, '0');
  const s = String(remaining % 60).padStart(2, '0');
  document.getElementById('timer').textContent = `${m}:${s}`;
}

// --- End screen ---
function showEnd() {
  const msg = CONFIG[mode].endMessage;
  document.getElementById('overlayMsg').textContent = msg;
  document.getElementById('overlay').classList.add('show');
  speak(msg);
  vibrate([200, 100, 200, 100, 200]);
}

function closeOverlay() {
  document.getElementById('overlay').classList.remove('show');
  resetTimer();
}

// --- Speech ---
function speak(text) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang  = 'ja-JP';
  u.rate  = 0.9;
  window.speechSynthesis.speak(u);
}

// --- Vibration ---
function vibrate(pattern = [120]) {
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// --- Screen Wake Lock ---
async function acquireWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (_) {}
}

function releaseWakeLock() {
  if (wakeLock) { wakeLock.release(); wakeLock = null; }
}

// Re-acquire after returning from background
document.addEventListener('visibilitychange', () => {
  if (running && document.visibilityState === 'visible') acquireWakeLock();
});

// --- Orientation ---
function toggleOrientation() {
  document.body.classList.toggle('rotated');
}

// --- Init ---
render();
