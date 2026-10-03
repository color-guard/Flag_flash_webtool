// core/storage.js
// LED位置データの永続化。今はlocalStorageだが、後でIndexedDBやファイル出力に
// 差し替える場合もこのモジュールのAPI（loadPositions/savePositions）だけ守れば
// 呼び出し側（UI層）に影響を与えずに済む。

const STORAGE_KEY = 'led-tool.positions.v1';

/**
 * @returns {{id:number, x:number, y:number}[]}
 */
export function loadPositions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[storage] failed to load positions', e);
    return [];
  }
}

export function savePositions(positions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
}
