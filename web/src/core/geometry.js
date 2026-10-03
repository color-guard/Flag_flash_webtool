// core/geometry.js
// 一筆書き線（手書きの点列）に関する計算をまとめたモジュール。
// LED位置登録UI専用だが、BLE送信やパターン生成とは無関係な純粋計算なので
// 他のcore/モジュールと同様フレームワーク非依存にしてある。

/**
 * 近すぎる点を間引く。pointermoveは高頻度で発火するため、
 * 描画中にこれをかけておかないと点が増えすぎて重くなる。
 * @param {{x:number,y:number}[]} points 正規化座標(0〜1)の点列
 * @param {number} minDist 間引く距離のしきい値（正規化座標系）
 */
export function simplifyPoints(points, minDist = 0.004) {
  if (points.length === 0) return points;
  const result = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const last = result[result.length - 1];
    const dx = points[i].x - last.x;
    const dy = points[i].y - last.y;
    if (Math.sqrt(dx * dx + dy * dy) >= minDist) {
      result.push(points[i]);
    }
  }
  return result;
}

/**
 * 一筆書き線(points)を、弧長が等間隔になるようcount個の点に再分割する。
 * LED数が変わった時はstrokePointsに対してこれを呼び直すだけでよい。
 * @param {{x:number,y:number}[]} points
 * @param {number} count
 * @returns {{x:number,y:number}[]} 長さcountの配列
 */
export function resampleAlongPolyline(points, count) {
  if (points.length < 2 || count < 1) return [];

  const segLengths = [];
  let totalLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segLengths.push(len);
    totalLength += len;
  }

  if (totalLength === 0) {
    return Array.from({ length: count }, () => ({ ...points[0] }));
  }

  const result = [];
  for (let i = 0; i < count; i++) {
    const targetLength = count > 1 ? (i / (count - 1)) * totalLength : 0;
    result.push(pointAtLength(points, segLengths, targetLength));
  }
  return result;
}

function pointAtLength(points, segLengths, targetLength) {
  let accumulated = 0;
  for (let i = 0; i < segLengths.length; i++) {
    const segLen = segLengths[i];
    if (accumulated + segLen >= targetLength || i === segLengths.length - 1) {
      const t = segLen === 0 ? 0 : (targetLength - accumulated) / segLen;
      const a = points[i];
      const b = points[i + 1];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    accumulated += segLen;
  }
  return points[points.length - 1];
}

/** 点列(正規化座標)をSVGのpath d属性文字列に変換する。 */
export function pointsToSvgPath(points) {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
}
