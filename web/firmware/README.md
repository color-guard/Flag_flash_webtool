# ここにビルド済みバイナリを置く

`manifest.json` が参照している以下のファイルをこのフォルダに置く（現状は未配置のプレースホルダ状態）。

- `bootloader.bin`
- `partitions.bin`
- `boot_app0.bin`（ESP32コアの tools ディレクトリ内にある共通ファイルをコピーしてくる）
- `firmware.bin`

PlatformIOの場合、`pio run` 後に `.pio/build/esp32-c3-devkitm-1/` 以下に生成される
`bootloader.bin` `partitions.bin` `firmware.bin` をコピーする
（`boot_app0.bin` は別途 `~/.platformio/packages/framework-arduinoespressif32/tools/partitions/boot_app0.bin`
などから取得する）。

将来的にはこのコピー作業をGitHub Actionsで自動化する（README.mdのロードマップ参照）。
