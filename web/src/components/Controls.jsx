import { useEffect, useState } from 'react';

export default function Controls({
  videoRef,
  videoFile,
  onVideoFileChange,
  ledCount,
  onLedCountChange,
  mode,
  onResetClick,
  displayMode,
  onDisplayModeChange,
}) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // <video>要素のイベントをUIのstateに反映する
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => setDuration(video.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [videoRef, videoFile]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play();
    else video.pause();
  };

  const handleSeek = (e) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Number(e.target.value);
  };

  return (
    <div className="controls">
      <div className="controls__row">
        <label className="file-input">
          動画を選択
          <input
            type="file"
            accept="video/*"
            onChange={(e) => onVideoFileChange(e.target.files[0] ?? null)}
          />
        </label>

        <button onClick={togglePlay} disabled={!videoFile}>
          {playing ? '停止' : '再生'}
        </button>

        <input
          type="range"
          className="controls__seek"
          min="0"
          max={duration || 0}
          step="0.01"
          value={currentTime}
          disabled={!videoFile}
          onChange={handleSeek}
        />
      </div>

      <div className="controls__row">
        <label>
          LED数
          <input
            type="number"
            min="1"
            max="1000"
            value={ledCount}
            disabled={mode === 'placementReset'}
            onChange={(e) => onLedCountChange(Math.max(1, Number(e.target.value)))}
          />
        </label>

        <button onClick={onResetClick} disabled={mode === 'placementReset'}>
          {mode === 'placementReset' ? '配置をなぞってください...' : '配置リセット'}
        </button>

        <div className="controls__toggle">
          <button
            className={displayMode === 'video' ? 'active' : ''}
            onClick={() => onDisplayModeChange('video')}
          >
            動画表示
          </button>
          <button
            className={displayMode === 'led' ? 'active' : ''}
            onClick={() => onDisplayModeChange('led')}
          >
            LED表示
          </button>
        </div>
      </div>
    </div>
  );
}
