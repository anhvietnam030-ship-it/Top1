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

  // Đọc JSON nhúng trong page
  const videoInfo = await page.evaluate(() => {
    try {
      const el = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
      if (!el) return { error: 'No data element' };
      const data = JSON.parse(el.textContent);
      const scope = data['__DEFAULT_SCOPE__'];
      if (!scope) return { error: 'No default scope' };

      // Tìm itemStruct trong các key có thể
      const detail = scope['webapp.video-detail'];
      if (detail && detail.itemInfo && detail.itemInfo.itemStruct) {
        return detail.itemInfo.itemStruct;
      }

      // Fallback: scan các key
      for (const k of Object.keys(scope)) {
        const v = scope[k];
        if (v && v.itemInfo && v.itemInfo.itemStruct) {
          return v.itemInfo.itemStruct;
        }
      }
      return { error: 'No itemStruct found', keys: Object.keys(scope) };
    } catch (e) {
      return { error: e.message };
    }
  });

  if (videoInfo.error) {
    console.error('❌ Không parse được JSON:', videoInfo.error);
    if (videoInfo.keys) console.error('Keys có sẵn:', videoInfo.keys);
    await browser.close();
    process.exit(1);
  }

  console.log('✅ Đã lấy được itemStruct');
  console.log('📝 Title:', (videoInfo.desc || '').slice(0, 80));

  // Lấy URL video
  const video = videoInfo.video || {};
  let videoUrl =
    video.playAddr ||
    video.downloadAddr ||
    (video.bitrateInfo && video.bitrateInfo[0] && video.bitrateInfo[0].PlayAddr &&
     video.bitrateInfo[0].PlayAddr.UrlList && video.bitrateInfo[0].PlayAddr.UrlList[0]);

  if (!videoUrl) {
    console.error('❌ Không có URL video trong itemStruct');
    console.error('video keys:', Object.keys(video));
    await browser.close();
    process.exit(1);
  }

  console.log('🎬 Video URL:', videoUrl.slice(0, 120));

  // Download với headers của browser
  const resp = await context.request.get(videoUrl, {
    timeout: 60000,
    headers: {
      'Referer': 'https://www.tiktok.com/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!resp.ok()) {
    console.error(`❌ Download failed: ${resp.status()}`);
    await browser.close();
    process.exit(1);
  }

  const buf = await resp.body();
  const outPath = path.join(OUTPUT_DIR, 'tiktok.mp4');
  fs.writeFileSync(outPath, buf);
  console.log(`💾 Đã lưu: ${outPath} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);

  await browser.close();
  console.log('\n✅ Done');
})().catch((e) => {
  console.error('💥 Crash:', e);
  process.exit(1);
});
