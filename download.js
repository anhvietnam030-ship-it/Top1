const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const url = process.env.TIKTOK_URL;
if (!url) { console.error('No URL'); process.exit(1); }

const OUTPUT_DIR = 'output';
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  const videoUrls = new Set();

  page.on('response', async (response) => {
    const u = response.url();
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('video/') || /\.mp4(\?|$)/.test(u)) {
      videoUrls.add(u);
      console.log('Found video URL:', u);
    }
  });

  console.log('Navigating to', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

  // Wait for video to start loading
  await page.waitForTimeout(5000);

  // Try to click play if needed
  try {
    const video = await page.$('video');
    if (video) {
      await video.evaluate(v => v.play());
      await page.waitForTimeout(5000);
    }
  } catch (e) {}

  console.log('Total video URLs found:', videoUrls.size);

  // Download the first/largest video
  let saved = 0;
  for (const vUrl of videoUrls) {
    try {
      const response = await context.request.get(vUrl);
      if (response.ok()) {
        const buffer = await response.body();
        const filename = path.join(OUTPUT_DIR, `video-${saved}.mp4`);
        fs.writeFileSync(filename, buffer);
        console.log(`Saved ${filename} (${buffer.length} bytes)`);
        saved++;
      }
    } catch (e) {
      console.error('Failed to download', vUrl, e.message);
    }
  }

  await browser.close();

  if (saved === 0) {
    console.error('No videos downloaded');
    process.exit(1);
  }
})();
