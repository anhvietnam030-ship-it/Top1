const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const url = process.env.TIKTOK_URL;
if (!url) {
  console.error('❌ Missing TIKTOK_URL');
  process.exit(1);
}

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

  // URL cuối cùng sau redirect
  console.log('🔗 URL cuối:', page.url());

  // Tiêu đề trang
  console.log('📄 Title:', await page.title());

  // Check các element có thể chứa data
  const checks = await page.evaluate(() => {
    const result = {};
    result.hasUniversalData = !!document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
    result.hasSIGI = !!document.getElementById('SIGI_STATE');
    result.hasVideoTag = !!document.querySelector('video');
    result.hasScripts = document.querySelectorAll('script').length;
    result.bodyLength = document.body ? document.body.innerHTML.length : 0;

    // List tất cả script có type application/json
    const jsonScripts = [];
    document.querySelectorAll('script[type="application/json"]').forEach((s, i) => {
      jsonScripts.push({ id: s.id || `script-${i}`, len: s.textContent.length });
    });
    result.jsonScripts = jsonScripts;

    // List ID của tất cả element có id
    const ids = [];
    document.querySelectorAll('[id]').forEach((el) => {
      if (el.id) ids.push(el.id);
    });
    result.allIds = ids.slice(0, 50);

    return result;
  });

  console.log('🔍 CHECKS:');
  console.log(JSON.stringify(checks, null, 2));

  // Lưu HTML để xem
  const html = await page.content();
  fs.writeFileSync('output/page.html', html);
  console.log('💾 Đã lưu HTML:', html.length, 'chars');

  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error('💥 Crash:', e);
  process.exit(1);
});
