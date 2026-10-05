// core/ble.js (frameSync撤廃版)
// フレームワーク非依存のBLE通信レイヤー。
// UI側（今はui/、将来はReactコンポーネント）はここの関数だけを呼び出す想定。
// firmware/src/main_nosync.cpp のUUIDと必ず一致させること。
// frameSyncは撤廃済み: ESP32側がLED_COUNT*3バイト受信した時点で自動的に表示する設計なので、
// JS側はpixelDataのチャンクを送るだけでよい。

const SERVICE_UUID    = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const PIXEL_DATA_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const LED_COUNT_UUID  = '6e400004-b5a3-f393-e0a9-e50e24dcca9e';

// 1回のwriteValueWithoutResponseで送るバイト数。
// MTUネゴシエーション結果次第で詰まる場合はここを調整する。
const CHUNK_SIZE = 180;

let device = null;
let pixelDataChar = null;
let sending = false; // 送信中に次フレームを重ねて送らないためのフラグ（バックプレッシャー制御）

export async function connect() {
  device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [SERVICE_UUID] }],
  });

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(SERVICE_UUID);

  pixelDataChar = await service.getCharacteristic(PIXEL_DATA_UUID);

  let ledCount = null;
  try {
    const ledCountChar = await service.getCharacteristic(LED_COUNT_UUID);
    const value = await ledCountChar.readValue();
    ledCount = value.getUint16(0, /* littleEndian= */ true);
  } catch (e) {
    console.warn('[ble] ledCount characteristic not available', e);
  }

  return { name: device.name, ledCount };
}

export function isConnected() {
  return !!(device && device.gatt && device.gatt.connected);
}

export function disconnect() {
  if (isConnected()) {
    device.gatt.disconnect();
  }
}

/**
 * 1フレーム分のRGBデータを送信する。
 * @param {Uint8Array} rgbBytes 長さ = LED数 * 3
 * @returns {Promise<boolean>} 送信できたらtrue、送信中スキップならfalse
 */
export async function sendFrame(rgbBytes) {
  if (!pixelDataChar) {
    throw new Error('Not connected');
  }
  if (sending) {
    // 前フレームの送信がまだ終わっていない場合は今回をスキップして詰まりを防ぐ
    return false;
  }

  sending = true;
  const t0 = performance.now();
  try {
    let chunkCount = 0;
    for (let offset = 0; offset < rgbBytes.length; offset += CHUNK_SIZE) {
      const chunk = rgbBytes.slice(offset, offset + CHUNK_SIZE);
      await pixelDataChar.writeValueWithoutResponse(chunk);
      chunkCount++;
    }
    const t1 = performance.now();

    // 診断用ログ。不要になったら消してOK。
    console.log(
      `[ble] bytes: ${rgbBytes.length} (CHUNK_SIZE=${CHUNK_SIZE}), chunkCount: ${chunkCount}, total: ${(t1 - t0).toFixed(1)}ms`
    );
    return true;
  } finally {
    sending = false;
  }
}