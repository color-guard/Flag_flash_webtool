import { exportLayoutToFile, importLayoutFromFile } from '../core/storage.js';

export default function LayoutIO({ ledCount, strokePoints, ledPositions, onImport }) {
  const handleExport = () => {
    exportLayoutToFile({ ledCount, strokePoints, ledPositions });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const layout = await importLayoutFromFile(file);
      onImport(layout);
    } catch (err) {
      console.error(err);
      alert('配置ファイルの読み込みに失敗しました: ' + err.message);
    } finally {
      e.target.value = ''; // 同じファイルを連続で選び直せるようにリセット
    }
  };

  return (
    <div className="layout-io">
      <button onClick={handleExport} disabled={ledPositions.length === 0}>
        配置を書き出し
      </button>
      <label className="file-input">
        配置を読み込み
        <input type="file" accept="application/json" onChange={handleFileChange} />
      </label>
    </div>
  );
}
