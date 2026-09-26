# LED Tool


ESP32-C3 + WS2812B を BLE 経由でブラウザ（PC/スマホの Web アプリ）から操作し、
光り方のデザインを検討するためのツール。

## 構成

```
firmware/   PlatformIO プロジェクト（ESP32-C3, NimBLE-Arduino, Adafruit_NeoPixel）
web/        GitHub Pages で公開する Web アプリ一式
  core/     フレームワーク非依存のロジック（BLE通信・パターン・保存）
  ui/       画面側のコード（最初は素のJS。後でReact/Next.jsに置き換え予定）
  firmware/ ESP Web Tools 用の manifest.json とビルド済みバイナリの置き場
```

## 最初にやること（ローカル環境）

### 1. PlatformIO のインストール

VSCode 拡張の PlatformIO IDE か、CLI (`pip install platformio` など) のどちらでも可。

### 2. ファームウェアを書き込む

```bash
cd firmware
pio run -t upload
pio device monitor
```

`firmware/src/main.cpp` 冒頭の `LED_PIN` / `LED_COUNT` は配線に合わせて書き換える。
`platformio.ini` の `board` も、使っている ESP32-C3 ボードに合わせて確認・変更する。

### 3. Web アプリをローカルで試す

Web Bluetooth は HTTPS か localhost でしか動かないため、ローカルでは簡易サーバー経由で開く。

```bash
cd web
npx serve .
# 表示されたURL (http://localhost:xxxx) をChrome/Edgeで開く
```

「BLE接続」ボタン→ペアリングダイアログでファームウェアのデバイス名
（`main.cpp` 内 `NimBLEDevice::init("LED-Controller")`）を選択。
接続後「パターン送信開始」でレインボーパターンが流れ、FPS が表示されれば疎通成功。

## GitHub Pages への公開設定

1. GitHubリポジトリの Settings → Pages
2. Source を **GitHub Actions** に設定（ブランチ指定ではない方）
3. `main` ブランチに push すると `.github/workflows/deploy-pages.yml` が
   `web/` フォルダをそのまま公開する

## ファームウェア書き込みページ（ESP Web Tools）について

`web/flash.html` は Web Serial 経由でブラウザから直接書き込みを行うページ。
現状 `web/firmware/manifest.json` はプレースホルダなので、Arduino IDE か
`pio run -t buildfs`（もしくは Arduino の「コンパイル済みバイナリをエクスポート」）で
生成される bootloader.bin / partitions.bin / firmware.bin 等を
`web/firmware/` に置き、パスを実際のファイル名に合わせて更新する。

ここを毎回手動でやるのが面倒になってきたら、GitHub Actions で自動ビルド・自動配置する
workflow を追加する（次のステップ）。

## ロードマップ

1. [x] 雛形作成
2. [ ] firmware最小疎通確認（このリポジトリの初期状態でここまでは動く）
3. [ ] ESP Web Toolsでの書き込み確認（手動エクスポートしたbinで）
4. [ ] ビルド自動化（GitHub Actions）
5. [ ] LED位置登録UI・永続化
6. [ ] パターンのモジュール化・パラメータUI拡充
7. [ ] React/Next.js移行（core/はそのまま、ui/だけ載せ替え）
