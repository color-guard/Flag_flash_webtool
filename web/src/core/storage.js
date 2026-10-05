// core/storage.js
// LED配置データ（一筆書き線・LED位置・LED数）の永続化。
// 旧バージョン(loadPositions/savePositions)からスキーマを変更したため置き換え。

const STORAGE_KEY = 'led-tool.layout.v2';

const DEFAULT_LAYOUT = {
  ledCount: 30,
  strokePoints: [], // 一筆書きの生の点列 {x,y}（正規化座標）。再分割の元データ。
  ledPositions: [], // 現在のLED位置 {x,y}。ドラッグによる個別調整を含む。
};

export function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_LAYOUT };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_LAYOUT, ...parsed };
  } catch (e) {
    console.warn('[storage] failed to load layout', e);
    return { ...DEFAULT_LAYOUT };
  }
}

export function saveLayout(layout) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch (e) {
    console.warn('[storage] failed to save layout', e);
  }
}

// ---- JSONファイルとしての書き出し/読み込み ----
// localStorageはオリジン(ドメイン)ごとに独立しているため、GitHub Pages版(BLE)と
// ESP32版(WiFi, http://192.168.4.1)の間では配置データが共有されない。
// JSONファイル経由で持ち運べるようにしておくことで、この間の受け渡しや、
// 単純なバックアップ・他デバイスへの移行にも使える。

const LAYOUT_FORMAT_VERSION = 1;

/** 現在のレイアウトをJSONファイルとしてダウンロードさせる。 */
export function exportLayoutToFile(layout, filename = 'led-layout.json') {
  const payload = {
    version: LAYOUT_FORMAT_VERSION,
    ledCount: layout.ledCount,
    strokePoints: layout.strokePoints,
    ledPositions: layout.ledPositions,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** JSON文字列をパースし、最低限の形式チェックをしてレイアウトを返す。 */
export function parseLayoutFromJson(jsonText) {
  const data = JSON.parse(jsonText);
  if (
    typeof data.ledCount !== 'number' ||
    !Array.isArray(data.strokePoints) ||
    !Array.isArray(data.ledPositions)
  ) {
    throw new Error('レイアウトファイルの形式が不正です');
  }
  return {
    ledCount: data.ledCount,
    strokePoints: data.strokePoints,
    ledPositions: data.ledPositions,
  };
}

/** <input type="file">で選ばれたFileオブジェクトからレイアウトを読み込む。 */
export async function importLayoutFromFile(file) {
  const text = await file.text();
  return parseLayoutFromJson(text);
}