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

  // Lưu tất cả URL video bắt được
  const videoUrls = new Map();

  page.on('response', (res) => {
    const u = res.url();
    const ct = (res.headers()['content-type'] || '').toLowerCase();
    const cl = parseInt(res.headers()['content-length'] || '0', 10);

    const isVideo =
      ct.includes('video/mp4') ||
      ct.includes('video/') ||
      /\.mp4(\?|$)/i.test(u) ||
      /\/video\/tos\//.test(u);

    if (isVideo && cl > 50000) {
      videoUrls.set(u, cl);
      console.log(`🎯 [${(cl / 1024).toFixed(0)} KB] ${u.slice(0, 110)}`);
    }
  });

  console.log('🌐 Mở:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Đợi load vài giây
  await page.waitForTimeout(5000);

  // Thử play video để trigger loading
  try {
    const video = await page.$('video');
    if (video) {
      await video.evaluate((v) => {
        v.muted = true;
        return v.play().catch(() => {});
      });
      console.log('▶️ Đã play video, đợi stream...');
    }
  } catch (e) {
    console.log('Không play được:', e.message);
  }

  await page.waitForTimeout(8000);

  // Nếu chưa có video, scroll xuống để trigger lazy load
  if (videoUrls.size === 0) {
    console.log('📜 Chưa có, thử scroll...');
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(5000);
  }

  console.log(`\n📊 Tổng cộng ${videoUrls.size} video stream bắt được`);

  if (videoUrls.size === 0) {
    console.error('❌ Không bắt được video nào');
    await browser.close();
    process.exit(1);
  }

  // Chọn file lớn nhất (thường là video chính có cả hình + tiếng)
  const sorted = [...videoUrls.entries()].sort((a, b) => b[1] - a[1]);
  const [bestUrl, bestSize] = sorted[0];
  console.log(`\n🏆 Chọn file lớn nhất: ${(bestSize / 1024).toFixed(0)} KB`);

  // Download bằng context.request (giữ cookies/session)
  const resp = await context.request.get(bestUrl, { timeout: 60000 });
  if (!resp.ok()) {
    console.error(`❌ Download failed: ${resp.status()}`);
    await browser.close();
    process.exit(1);
  }

  const buf = await resp.body();
  const outPath = path.join(OUTPUT_DIR, 'tiktok.mp4');
  fs.writeFileSync(outPath, buf);
  console.log(`💾 Đã lưu: ${outPath} (${(buf.length / 1024).toFixed(0)} KB)`);

  await browser.close();
  console.log('\n✅ Done');
})().catch((e) => {
  console.error('💥 Crash:', e);
  process.exit(1);
});
