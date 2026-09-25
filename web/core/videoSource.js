// core/videoSource.js
// 光り方の「設計」は外部ツール(p5.js/AfterEffects/TouchDesigner等)で動画として作り、
// ここではその動画を読み込んで各LED位置の色をフレームごとに抜き出すだけ、という役割に絞る。
//
// 使い方:
//   await loadVideo(file, videoElement)  // <video>要素に動画を読み込む
//   play()
//   onFrame(() => { const rgb = sampleFrame(positions); ... })

let video = null;
let canvas = null;
let ctx = null;

// サンプリング用canvasの最大辺(px)。LED位置を拾えれば十分なので、
// 動画本来の解像度のまま毎フレームgetImageDataすると重いため縮小しておく。
const MAX_DIM = 480;

/**
 * @param {File|string} source Fileオブジェクト、またはURL文字列
 * @param {HTMLVideoElement} videoElement 画面上のプレビュー用<video>要素
 */
export async function loadVideo(source, videoElement) {
  video = videoElement;
  const url = source instanceof File ? URL.createObjectURL(source) : source;
  video.src = url;

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('動画の読み込みに失敗しました'));
  });

  const scale = Math.min(1, MAX_DIM / Math.max(video.videoWidth, video.videoHeight));
  canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  ctx = canvas.getContext('2d', { willReadFrequently: true });

  return { width: video.videoWidth, height: video.videoHeight, duration: video.duration };
}

export function getVideoElement() {
  return video;
}

export function play() {
  return video?.play();
}

export function pause() {
  video?.pause();
}

/**
 * 新しいフレームが描画されるたびにcallbackを呼ぶ。
 * requestVideoFrameCallback対応ブラウザ(Chrome/Edge)ではそれを使い、
 * 非対応環境向けにrequestAnimationFrameへフォールバックする。
 */
export function onFrame(callback) {
  if (!video) return;

  if (typeof video.requestVideoFrameCallback === 'function') {
    const step = () => {
      if (!video || video.paused || video.ended) return;
      callback();
      video.requestVideoFrameCallback(step);
    };
    video.requestVideoFrameCallback(step);
  } else {
    const step = () => {
      if (!video || video.paused || video.ended) return;
      callback();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

/**
 * 現在の動画フレームを描画し、正規化座標(x,y: 0.0〜1.0、原点は左上)の
 * LED位置ごとの色を抜き出す。
 * @param {{x:number,y:number}[]} positions
 * @returns {Uint8Array} 長さ = positions.length * 3 (RGB)
 */
export function sampleFrame(positions) {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const rgb = new Uint8Array(positions.length * 3);
  positions.forEach((pos, i) => {
    const px = Math.min(canvas.width - 1, Math.floor(pos.x * (canvas.width - 1)));
    const py = Math.min(canvas.height - 1, Math.floor(pos.y * (canvas.height - 1)));
    const idx = (py * canvas.width + px) * 4;
    rgb[i * 3]     = frame[idx];
    rgb[i * 3 + 1] = frame[idx + 1];
    rgb[i * 3 + 2] = frame[idx + 2];
  });
  return rgb;
}
