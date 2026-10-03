import { useCallback, useEffect, useRef, useState } from 'react';
import { loadVideo, sampleFrame } from '../core/videoSource.js';
import { pointsToSvgPath } from '../core/geometry.js';

/**
 * 動画 / LEDグロー表示の背景レイヤーと、LED位置マーカー・一筆書き線のSVGオーバーレイをまとめたコンポーネント。
 * mode === 'placementReset' の間はポインタ操作が「一筆書きの記録」になり、
 * mode === 'normal' の間は既存マーカーのドラッグ移動になる。
 *
 * 色の更新(毎フレーム)はReactのstateを経由せず、マーカー要素とcanvasに直接書き込むことで
 * 余計な再レンダリングを避け、体感の遅延を減らしている。位置(cx/cy)の更新のみReact管理。
 */
export default function Stage({
  videoRef,
  videoFile,
  mode,
  displayMode,
  strokePoints,
  ledPositions,
  onStrokeComplete,
  onMarkerDrag,
  onFrame,
}) {
  const containerRef = useRef(null);
  const glowCanvasRef = useRef(null);
  const circleRefs = useRef([]); // 各LEDマーカー<circle>への参照。色の直接書き込みに使う
  const drawingRef = useRef(null); // 描画中の点列。再レンダリング不要なのでrefで保持
  const dragIndexRef = useRef(null);

  const [videoReady, setVideoReady] = useState(false);
  const [drawingPreview, setDrawingPreview] = useState([]); // 描画中プレビュー表示用

  // 動画ファイルの読み込み。コンテナのaspect-ratioを動画の比率に合わせることで、
  // 正規化座標(0〜1)がそのまま動画上の位置と一致するようにする（レターボックス防止）。
  useEffect(() => {
    if (!videoFile || !videoRef.current) return;
    setVideoReady(false);
    loadVideo(videoFile, videoRef.current)
      .then((info) => {
        if (containerRef.current && info.width && info.height) {
          containerRef.current.style.aspectRatio = `${info.width} / ${info.height}`;
        }
        setVideoReady(true);
      })
      .catch((e) => console.error('[Stage] failed to load video', e));
  }, [videoFile, videoRef]);

  // グローcanvasのサイズをコンテナに合わせる（表示モード切替・動画読み込み時に実行）
  useEffect(() => {
    const canvas = glowCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }, [displayMode, videoReady]);

  // LED位置ごとの色を継続的にサンプリングし、マーカーの塗り色とグローcanvasへ直接書き込む。
  // Reactのstate/再レンダリングを経由しないことで、ここの処理が描画の遅延要因にならないようにしている。
  useEffect(() => {
    if (!videoReady) return;
    let raf;

    const tick = () => {
      if (ledPositions.length > 0) {
        const rgb = sampleFrame(ledPositions);

        // マーカーの塗り色を直接DOM操作で更新（Reactの再レンダリングを挟まない）
        for (let i = 0; i < ledPositions.length; i++) {
          const el = circleRefs.current[i];
          if (el) {
            el.setAttribute('fill', `rgb(${rgb[i * 3]}, ${rgb[i * 3 + 1]}, ${rgb[i * 3 + 2]})`);
          }
        }

        // LEDのみ表示モードの時だけグローcanvasを描画
        if (displayMode === 'led') {
          const canvas = glowCanvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            const w = canvas.width;
            const h = canvas.height;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            ctx.filter = 'blur(10px)';
            ctx.globalCompositeOperation = 'lighter';
            ledPositions.forEach((pos, i) => {
              ctx.beginPath();
              ctx.fillStyle = `rgb(${rgb[i * 3]}, ${rgb[i * 3 + 1]}, ${rgb[i * 3 + 2]})`;
              ctx.arc(pos.x * w, pos.y * h, Math.max(w, h) * 0.015, 0, Math.PI * 2);
              ctx.fill();
            });
            ctx.filter = 'none';
            ctx.globalCompositeOperation = 'source-over';
          }
        }

        // BLE送信など、このフレームのRGBデータを使いたい呼び出し元への通知。
        // マーカー色更新・グロー描画と同じサンプリング結果を使い回すことで二重計算を避けている。
        onFrame?.(rgb);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoReady, ledPositions, displayMode, onFrame]);

  const toNormalized = useCallback((e) => {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    };
  }, []);

  const handlePointerDown = useCallback(
    (e) => {
      if (mode !== 'placementReset') return;
      const p = toNormalized(e);
      drawingRef.current = [p];
      setDrawingPreview([p]);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [mode, toNormalized]
  );

  const handlePointerMove = useCallback(
    (e) => {
      if (mode === 'placementReset' && drawingRef.current) {
        const p = toNormalized(e);
        drawingRef.current.push(p);
        setDrawingPreview([...drawingRef.current]);
        return;
      }
      if (mode === 'normal' && dragIndexRef.current !== null) {
        const p = toNormalized(e);
        onMarkerDrag(dragIndexRef.current, p);
      }
    },
    [mode, toNormalized, onMarkerDrag]
  );

  const handlePointerUp = useCallback(() => {
    if (mode === 'placementReset' && drawingRef.current) {
      const points = drawingRef.current;
      drawingRef.current = null;
      setDrawingPreview([]);
      if (points.length >= 2) {
        onStrokeComplete(points);
      }
    }
    dragIndexRef.current = null;
  }, [mode, onStrokeComplete]);

  const handleMarkerPointerDown = useCallback(
    (index) => (e) => {
      if (mode !== 'normal') return;
      e.stopPropagation();
      dragIndexRef.current = index;
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    [mode]
  );

  return (
    <div
      ref={containerRef}
      className={`stage ${mode === 'placementReset' ? 'stage--drawing' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <video
        ref={videoRef}
        muted
        loop
        playsInline
        className="stage__video"
        style={{ display: displayMode === 'video' ? 'block' : 'none' }}
      />
      <canvas
        ref={glowCanvasRef}
        className="stage__glow"
        style={{ display: displayMode === 'led' ? 'block' : 'none' }}
      />

      <svg className="stage__overlay" viewBox="0 0 1 1" preserveAspectRatio="none">
        {strokePoints.length > 0 && (
          <path
            d={pointsToSvgPath(strokePoints)}
            fill="none"
            stroke="gray"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {drawingPreview.length > 0 && (
          <path
            d={pointsToSvgPath(drawingPreview)}
            fill="none"
            stroke="red"
            strokeWidth="2"
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {ledPositions.map((pos, i) => (
          <circle
            key={i}
            ref={(el) => (circleRefs.current[i] = el)}
            cx={pos.x}
            cy={pos.y}
            r="0.015"
            fill="rgb(80,80,80)"
            stroke="rgb(128,128,128)"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
            style={{ cursor: mode === 'normal' ? 'grab' : 'default' }}
            onPointerDown={handleMarkerPointerDown(i)}
          />
        ))}
      </svg>

      {!videoReady && <div className="stage__placeholder">動画を読み込んでください</div>}
    </div>
  );
}
