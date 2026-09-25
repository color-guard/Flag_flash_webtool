// core/ble.js
// フレームワーク非依存のBLE通信レイヤー。
// UI側（今はui/、将来はReactコンポーネント）はここの関数だけを呼び出す想定。
// firmware/src/main.cpp のUUIDと必ず一致させること。

const SERVICE_UUID    = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
const PIXEL_DATA_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';
const FRAME_SYNC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';
const LED_COUNT_UUID  = '6e400004-b5a3-f393-e0a9-e50e24dcca9e';

// 1回のwriteValueWithoutResponseで送るバイト数。
// MTUネゴシエーション結果次第で詰まる場合はここを調整する。
const CHUNK_SIZE = 180;

let device = null;
let pixelDataChar = null;
let frameSyncChar = null;
let sending = false; // 送信中に次フレームを重ねて送らないためのフラグ（バックプレッシャー制御）

export async function connect() {
  device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [SERVICE_UUID] }],
  });

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(SERVICE_UUID);

  pixelDataChar = await service.getCharacteristic(PIXEL_DATA_UUID);
  frameSyncChar = await service.getCharacteristic(FRAME_SYNC_UUID);

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
  if (!pixelDataChar || !frameSyncChar) {
    throw new Error('Not connected');
  }
  if (sending) {
    // 前フレームの送信がまだ終わっていない場合は今回をスキップして詰まりを防ぐ
    return false;
  }

  sending = true;
  try {
    for (let offset = 0; offset < rgbBytes.length; offset += CHUNK_SIZE) {
      const chunk = rgbBytes.slice(offset, offset + CHUNK_SIZE);
      await pixelDataChar.writeValueWithoutResponse(chunk);
    }
    await frameSyncChar.writeValue(new Uint8Array([1]));
    return true;
  } finally {
    sending = false;
  }
}
