const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const url = process.env.TIKTOK_URL;
if (!url) {
  console.error('❌ Missing TIKTOK_URL');
  process.exit(1);
}

const OUTPUT_DIR = 'output';
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ' +
      'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
    locale: 'vi-VN',
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();

  console.log('🌐 Mở:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);

  // DEBUG: dump cấu trúc JSON
  const debugInfo = await page.evaluate(() => {
    try {
      const el = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
      if (!el) return { error: 'No data element' };
      const data = JSON.parse(el.textContent);
      const scope = data['__DEFAULT_SCOPE__'];
      if (!scope) return { error: 'No default scope' };

      const detail = scope['webapp.video-detail'];

      return {
        detailKeys: detail ? Object.keys(detail) : null,
        detailDump: detail ? JSON.stringify(detail).slice(0, 4000) : null,
      };
    } catch (e) {
      return { error: e.message };
    }
  });

  console.log('🔍 DEBUG INFO:');
  console.log(JSON.stringify(debugInfo, null, 2));

  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error('💥 Crash:', e);
  process.exit(1);
});
