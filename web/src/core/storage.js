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
