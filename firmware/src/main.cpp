// LED Tool - Firmware (Step1: 最小疎通確認用)
//
// 役割はシンプルに:
//   BLEでRGBデータのチャンクを受信 -> バッファに詰める -> frameSyncが来たらshow()
// 光り方のロジックは一切持たない（Web側で計算したRGB列をそのまま流し込むだけ）。

#include <Arduino.h>
#include <NimBLEDevice.h>
#include <Adafruit_NeoPixel.h>

// ---- 配線に合わせて変更 ----
#define LED_PIN   2
#define LED_COUNT 30

// web/core/ble.js のUUIDと必ず一致させること
#define SERVICE_UUID      "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define PIXEL_DATA_UUID   "6e400002-b5a3-f393-e0a9-e50e24dcca9e" // Write Without Response
#define FRAME_SYNC_UUID   "6e400003-b5a3-f393-e0a9-e50e24dcca9e" // Write
#define LED_COUNT_UUID    "6e400004-b5a3-f393-e0a9-e50e24dcca9e" // Read

Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

NimBLECharacteristic* pPixelDataChar = nullptr;
NimBLECharacteristic* pFrameSyncChar = nullptr;
NimBLECharacteristic* pLedCountChar  = nullptr;

uint8_t frameBuffer[LED_COUNT * 3];
volatile size_t bufferOffset = 0;
volatile bool   frameReady   = false;

class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* server) override {
    Serial.println("[BLE] connected");
    bufferOffset = 0;
  }
  void onDisconnect(NimBLEServer* server) override {
    Serial.println("[BLE] disconnected, restart advertising");
    NimBLEDevice::startAdvertising();
  }
};

// pixelDataへの書き込み = フレームの一部（チャンク）を受信
class PixelDataCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c) override {
    std::string v = c->getValue();
    size_t len = v.length();

    // バッファをはみ出す分は捨てる（フレームサイズ不一致に対する保険）
    if (bufferOffset + len > sizeof(frameBuffer)) {
      len = sizeof(frameBuffer) - bufferOffset;
    }
    memcpy(frameBuffer + bufferOffset, v.data(), len);
    bufferOffset += len;
  }
};

// frameSyncへの書き込み = 1フレーム分たまったので表示せよ、の合図
class FrameSyncCallbacks : public NimBLECharacteristicCallbacks {
  void onWrite(NimBLECharacteristic* c) override {
    frameReady = true;
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

  pFrameSyncChar = pService->createCharacteristic(
      FRAME_SYNC_UUID,
      NIMBLE_PROPERTY::WRITE);
  pFrameSyncChar->setCallbacks(new FrameSyncCallbacks());

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
