export default function BleControl({
  connected,
  connecting,
  deviceName,
  onConnectClick,
  sending,
  onToggleSending,
  fps,
}) {
  return (
    <div className="ble-control">
      <button onClick={onConnectClick} disabled={connected || connecting}>
        {connected ? `接続済み (${deviceName})` : connecting ? '接続中...' : 'BLE接続'}
      </button>

      <button
        onClick={onToggleSending}
        disabled={!connected}
        className={sending ? 'active' : ''}
      >
        {sending ? 'ESP32へ送信中' : 'ESP32へ送信開始'}
      </button>

      {sending && <span className="ble-control__fps">{fps.toFixed(1)} fps</span>}
    </div>
  );
}
