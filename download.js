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

const videoId = url.match(/\/video\/(\d+)/)?.[1] || url.match(/\/photo\/(\d+)/)?.[1];
if (!videoId) {
  console.error('❌ Không lấy được video ID từ URL:', url);
  process.exit(1);
}

console.log('🎬 Video ID:', videoId);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  const videoUrls = new Map();
  page.on('response', (res) => {
    const u = res.url();
    const ct = (res.headers()['content-type'] || '').toLowerCase();
    const cl = parseInt(res.headers()['content-length'] || '0', 10);
    if ((ct.includes('video') || /\.mp4/i.test(u)) && cl > 100000) {
      videoUrls.set(u, cl);
      console.log(`🎯 [${(cl / 1024).toFixed(0)}KB] ${u.slice(0, 100)}`);
    }
  });

  const embedUrl = `https://www.tiktok.com/embed/v2/${videoId}`;
  console.log('🌐 Mở embed:', embedUrl);
  await page.goto(embedUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);

  try {
    const video = await page.$('video');
    if (video) {
      await video.evaluate((v) => {
        v.muted = true;
        return v.play().catch(() => {});
      });
      console.log('▶️ Đã play');
      await page.waitForTimeout(8000);
    }
  } catch (e) {}

  console.log(`\n📊 Bắt được ${videoUrls.size} stream`);

  if (videoUrls.size === 0) {
    console.error('❌ Không có video');
    await browser.close();
    process.exit(1);
  }

  const sorted = [...videoUrls.entries()].sort((a, b) => b[1] - a[1]);
  const [bestUrl] = sorted[0];
  console.log(`🏆 Tải: ${bestUrl.slice(0, 100)}`);

  const resp = await context.request.get(bestUrl, {
    headers: {
      Referer: 'https://www.tiktok.com/',
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
  fs.writeFileSync(path.join(OUTPUT_DIR, 'tiktok.mp4'), buf);
  console.log(`💾 Đã lưu: ${(buf.length / 1024 / 1024).toFixed(2)} MB`);

  await browser.close();
  process.exit(0);
})().catch((e) => {
  console.error('💥 Crash:', e);
  process.exit(1);
});
