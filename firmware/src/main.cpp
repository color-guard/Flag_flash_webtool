// LED Tool - Firmware (frameSync撤廃版)
//
// 役割はシンプルに:
//   BLEでRGBデータのチャンクを受信 -> バッファに詰める
//   -> LED数ぶん(LED_COUNT*3バイト)たまったら自動的にshow()
// 明示的な同期信号(frameSync)は使わず、受信バイト数だけでフレーム完了を判定する。
// 光り方のロジックは一切持たない（Web側で計算したRGB列をそのまま流し込むだけ）。
//
// 注意: Web側が送るバイト数が LED_COUNT*3 ぴったりでないと表示が更新されない。
// UIのLED数とこのLED_COUNTが必ず一致している前提の設計。

#include <Arduino.h>
#include <NimBLEDevice.h>
#include <Adafruit_NeoPixel.h>

// ---- 配線に合わせて変更 ----
#define LED_PIN   19
#define LED_COUNT 50

// web/core/ble.js のUUIDと必ず一致させること（frameSyncは撤廃したので使わない）
#define SERVICE_UUID      "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define PIXEL_DATA_UUID   "6e400002-b5a3-f393-e0a9-e50e24dcca9e" // Write Without Response
#define LED_COUNT_UUID    "6e400004-b5a3-f393-e0a9-e50e24dcca9e" // Read

Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

NimBLECharacteristic* pPixelDataChar = nullptr;
NimBLECharacteristic* pLedCountChar  = nullptr;

uint8_t frameBuffer[LED_COUNT * 3];
volatile size_t bufferOffset = 0;
volatile bool   frameReady   = false;

// NimBLE-Arduino 2.x系のコールバックAPI（NimBLEConnInfo&が必須引数になった）に対応。
// 1.x系で書く場合は NimBLEConnInfo& connInfo の部分を削る必要がある。
class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* server, NimBLEConnInfo& connInfo) override {
    Serial.println("[BLE] connected");
    bufferOffset = 0;
  }
  void onDisconnect(NimBLEServer* server, NimBLEConnInfo& connInfo, int reason) override {
    Serial.printf("[BLE] disconnected, reason=0x%02X, restart advertising\n", reason);
    NimBLEDevice::startAdvertising();
  }
};

// pixelDataへの書き込み = フレームの一部（チャンク）を受信
class PixelDataCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c, NimBLEConnInfo& connInfo) override {
    // 2.x系ではgetValue()がNimBLEAttValueを返す（std::stringではない）。
    // data()/length()はstd::stringと同じ感覚で使えるのでロジック自体は変更なし。
    const NimBLEAttValue& v = c->getValue();
    size_t len = v.length();

    // バッファをはみ出す分は捨てる（フレームサイズ不一致に対する保険）
    if (bufferOffset + len > sizeof(frameBuffer)) {
      len = sizeof(frameBuffer) - bufferOffset;
    }
    memcpy(frameBuffer + bufferOffset, v.data(), len);
    bufferOffset += len;

    // 明示的な同期信号を使わず、LED_COUNT*3バイトぴったり受信できたら自動的に表示トリガー。
    if (bufferOffset >= sizeof(frameBuffer)) {
      frameReady = true;
    }
  }
};

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\n[BOOT] LED Tool firmware");

  strip.begin();
  strip.clear();
  strip.show();

  NimBLEDevice::init("LED-Controller");
  NimBLEDevice::setMTU(247); // 可能な限り大きいMTUを要求（実際の合意値は接続後に決まる）

  NimBLEServer* pServer = NimBLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  NimBLEService* pService = pServer->createService(SERVICE_UUID);

  pPixelDataChar = pService->createCharacteristic(
      PIXEL_DATA_UUID,
      NIMBLE_PROPERTY::WRITE_NR);
  pPixelDataChar->setCallbacks(new PixelDataCallbacks());

  pLedCountChar = pService->createCharacteristic(
      LED_COUNT_UUID,
      NIMBLE_PROPERTY::READ);
  {
    uint16_t count = LED_COUNT;
    pLedCountChar->setValue((uint8_t*)&count, sizeof(count));
  }

  pService->start();

  NimBLEAdvertising* pAdvertising = NimBLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->start();

  Serial.println("[BLE] advertising started");
}

void loop() {
  if (frameReady) {
    for (int i = 0; i < LED_COUNT; i++) {
      uint8_t r = frameBuffer[i * 3 + 0];
      uint8_t g = frameBuffer[i * 3 + 1];
      uint8_t b = frameBuffer[i * 3 + 2];
      strip.setPixelColor(i, strip.Color(r, g, b));
    }
    strip.show();

    bufferOffset = 0;
    frameReady = false;
  }
}