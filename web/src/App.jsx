import { useCallback, useEffect, useRef, useState } from 'react';
import Stage from './components/Stage.jsx';
import Controls from './components/Controls.jsx';
import BleControl from './components/BleControl.jsx';
import { connect, isConnected, sendFrame } from './core/ble.js';
import { loadLayout, saveLayout } from './core/storage.js';
import { resampleAlongPolyline, simplifyPoints } from './core/geometry.js';
import './App.css';

export default function App() {
  const videoRef = useRef(null);
  const initial = loadLayout();

  const [ledCount, setLedCount] = useState(initial.ledCount);
  const [strokePoints, setStrokePoints] = useState(initial.strokePoints);
  const [ledPositions, setLedPositions] = useState(initial.ledPositions);
  const [mode, setMode] = useState('normal'); // 'normal' | 'placementReset'
  const [displayMode, setDisplayMode] = useState('video'); // 'video' | 'led'
  const [videoFile, setVideoFile] = useState(null);

  // BLE関連
  const [bleConnected, setBleConnected] = useState(false);
  const [bleConnecting, setBleConnecting] = useState(false);
  const [bleDeviceName, setBleDeviceName] = useState(null);
  const [sending, setSending] = useState(false);
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(performance.now());

  // 配置データが変わるたびに永続化
  useEffect(() => {
    saveLayout({ ledCount, strokePoints, ledPositions });
  }, [ledCount, strokePoints, ledPositions]);

  // LED数変更: 一筆書き線が既にあれば、その線をそのまま新しい数で再分割する
  const handleLedCountChange = useCallback(
    (newCount) => {
      setLedCount(newCount);
      if (strokePoints.length >= 2) {
        setLedPositions(resampleAlongPolyline(strokePoints, newCount));
      }
    },
    [strokePoints]
  );

  // 配置リセットボタン: 既存の線・位置をクリアして一筆書きモードへ
  const handleResetClick = useCallback(() => {
    setStrokePoints([]);
    setLedPositions([]);
    setMode('placementReset');
  }, []);

  // 一筆書き完了: 簡略化した点列を保存し、現在のLED数で等間隔分割してLED位置を確定
  const handleStrokeComplete = useCallback(
    (rawPoints) => {
      const simplified = simplifyPoints(rawPoints);
      const positions = resampleAlongPolyline(simplified, ledCount);
      setStrokePoints(simplified);
      setLedPositions(positions);
      setMode('normal');
    },
    [ledCount]
  );

  // 通常モードでのマーカードラッグ
  const handleMarkerDrag = useCallback((index, pos) => {
    setLedPositions((prev) => {
      const next = [...prev];
      next[index] = pos;
      return next;
    });
  }, []);

  // BLE接続。デバイス側の実際のLED数が分かれば、UI側のLED数をそれに合わせて同期する
  // （ファームウェアのバッファサイズとずれると表示が崩れるため）。
  const handleConnectClick = useCallback(async () => {
    setBleConnecting(true);
    try {
      const info = await connect();
      setBleConnected(true);
      setBleDeviceName(info.name ?? 'unknown');
      if (info.ledCount && info.ledCount !== ledCount) {
        handleLedCountChange(info.ledCount);
      }
    } catch (e) {
      console.error(e);
      alert('BLE接続に失敗しました: ' + e.message);
    } finally {
      setBleConnecting(false);
    }
  }, [ledCount, handleLedCountChange]);

  // Stageが毎フレーム計算しているRGBデータを受け取り、送信ONなら流す。
  // マーカー色更新・グロー描画と同じサンプリング結果を使い回しているので二重計算にはならない。
  const handleFrame = useCallback(
    async (rgb) => {
      if (!sending || !isConnected()) return;
      const sent = await sendFrame(rgb);
      if (sent) {
        frameCountRef.current++;
        const now = performance.now();
        const elapsed = now - lastFpsTimeRef.current;
        if (elapsed >= 1000) {
          setFps((frameCountRef.current / elapsed) * 1000);
          frameCountRef.current = 0;
          lastFpsTimeRef.current = now;
        }
      }
    },
    [sending]
  );

  return (
    <div className="app">
      <h1>LED配置エディタ</h1>
      <p>
        <a href={`${import.meta.env.BASE_URL}flash.html`} target="_blank" rel="noopener noreferrer">
          ファームウェア書き込みページへ
        </a>
      </p>

      <BleControl
        connected={bleConnected}
        connecting={bleConnecting}
        deviceName={bleDeviceName}
        onConnectClick={handleConnectClick}
        sending={sending}
        onToggleSending={() => setSending((s) => !s)}
        fps={fps}
      />

      <Controls
        videoRef={videoRef}
        videoFile={videoFile}
        onVideoFileChange={setVideoFile}
        ledCount={ledCount}
        onLedCountChange={handleLedCountChange}
        mode={mode}
        onResetClick={handleResetClick}
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
      />

      <Stage
        videoRef={videoRef}
        videoFile={videoFile}
        mode={mode}
        displayMode={displayMode}
        strokePoints={strokePoints}
        ledPositions={ledPositions}
        onStrokeComplete={handleStrokeComplete}
        onMarkerDrag={handleMarkerDrag}
        onFrame={handleFrame}
      />
    </div>
  );
}
