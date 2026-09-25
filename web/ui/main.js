// ui/main.js
// Step1確認用のDOM操作（動画ソース版）。
// React/Next.jsへ移行する際はここだけ書き換え、core/以下のインポートはそのまま流用できる想定。

import { connect, isConnected, sendFrame } from '../core/ble.js';
import { loadVideo, play, onFrame, sampleFrame, getVideoElement } from '../core/videoSource.js';

const connectBtn     = document.getElementById('connectBtn');
const videoInput     = document.getElementById('videoInput');
const videoPreviewEl = document.getElementById('videoPreview');
const startBtn       = document.getElementById('startBtn');
const stopBtn        = document.getElementById('stopBtn');
const statusEl       = document.getElementById('status');
const ledCountEl     = document.getElementById('ledCount');
const fpsEl          = document.getElementById('fps');

let ledCount = 30; // 接続後にledCount特性の値で上書きされる
let positions = buildLinearPositions(ledCount);
let videoReady = false;
let frameCount = 0;
let lastFpsTime = performance.now();

// LED位置登録UI(ロードマップ後続ステップ)が入るまでの暫定マッピング。
// i番目のLEDが動画フレームの横方向 i/(N-1) 地点・縦方向中央(0.5)をサンプリングする。
// 2D配置UIができたら、ここをstorage.jsから読み込んだ位置配列に差し替えるだけでよい。
function buildLinearPositions(n) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push({ x: n > 1 ? i / (n - 1) : 0, y: 0.5 });
  }
  return arr;
}

connectBtn.addEventListener('click', async () => {
  try {
    statusEl.textContent = '接続中...';
    const info = await connect();
    ledCount = info.ledCount ?? ledCount;
    positions = buildLinearPositions(ledCount);
    statusEl.textContent = `接続済み (${info.name ?? 'unknown'})`;
    ledCountEl.textContent = String(ledCount);
    updateStartButton();
  } catch (e) {
    console.error(e);
    statusEl.textContent = `接続失敗: ${e.message}`;
  }
});

videoInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    await loadVideo(file, videoPreviewEl);
    videoReady = true;
    updateStartButton();
  } catch (err) {
    console.error(err);
    alert('動画の読み込みに失敗しました: ' + err.message);
  }
});

function updateStartButton() {
  startBtn.disabled = !(isConnected() && videoReady);
}

startBtn.addEventListener('click', () => {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  frameCount = 0;
  lastFpsTime = performance.now();

  play();
  onFrame(handleFrame);
});

stopBtn.addEventListener('click', () => {
  getVideoElement()?.pause();
  startBtn.disabled = false;
  stopBtn.disabled = true;
});

async function handleFrame() {
  if (!isConnected()) return;

  const rgb = sampleFrame(positions);
  const sent = await sendFrame(rgb);
  if (sent) {
    frameCount++;
    const now = performance.now();
    const elapsed = now - lastFpsTime;
    if (elapsed >= 1000) {
      fpsEl.textContent = (frameCount / (elapsed / 1000)).toFixed(1);
      frameCount = 0;
      lastFpsTime = now;
    }
  }
}
