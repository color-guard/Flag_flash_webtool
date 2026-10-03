// core/patterns.js
// NOTE: 現在ui/main.jsからは呼ばれていません（動画ソース方式に切り替えたため）。
// 将来「動画に手続き的なエフェクトを重ねる」等をやりたくなった時のために残してあります。
// 不要なら削除して問題ありません。
//
// パターン関数は (x, y, t, params) => [r, g, b] という共通の形で登録する。
// x, y は0.0〜1.0に正規化された位置、tは経過秒数。
// 新しいパターンを増やす時はここにオブジェクトを追加していくだけでよい構造にしてある。
// paramsのスキーマ（type/min/max/default）をUI側で読み取れば、パラメータUIも自動生成できる。

export const patterns = {
  rainbowSweep: {
    label: 'レインボー(横スクロール)',
    params: {
      speed:      { type: 'range', min: 0.05, max: 2, step: 0.05, default: 0.3 },
      saturation: { type: 'range', min: 0,    max: 1, step: 0.05, default: 1 },
    },
    render(x, y, t, p) {
      const hue = (x + t * p.speed) % 1;
      return hsvToRgb(hue, p.saturation, 1);
    },
  },
};

function hsvToRgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
