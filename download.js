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
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
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
