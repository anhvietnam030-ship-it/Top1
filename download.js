const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const url = process.env.TIKTOK_URL;
if (!url) {
  console.error('❌ Thiếu URL');
  process.exit(1);
}

const OUTPUT_DIR = 'output';
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();
  const streams = new Map(); // url -> type

  // Phân loại video / audio dựa vào URL và content-type
  page.on('response', (response) => {
    const u = response.url();
    const ct = response.headers()['content-type'] || '';
    let type = null;
    if (ct.includes('video/') || /\/video\/tos\//.test(u) || /\.mp4(\?|$)/.test(u)) {
      type = 'video';
    } else if (ct.includes('audio/') || /\/audio\/tos\//.test(u) || /\.m4a(\?|$)/.test(u)) {
      type = 'audio';
    }
    if (type) {
      streams.set(u, type);
      console.log(`🎯 Found [${type}]:`, u.slice(0, 90) + '...');
    }
  });

  console.log('🌐 Đang mở:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(8000);

  try {
    const video = await page.$('video');
    if (video) {
      await video.evaluate((v) => v.play().catch(() => {}));
      await page.waitForTimeout(6000);
    }
  } catch (e) {}

  console.log(`\n📊 Tìm được ${streams.size} stream`);

  let videoFile = null;
  let audioFile = null;
  let videoSize = 0;
  let idx = 0;

  for (const [sUrl, type] of streams) {
    try {
      const resp = await context.request.get(sUrl);
      if (!resp.ok()) continue;
      const buf = await resp.body();
      if (buf.length < 5000) continue;

      const ext = type === 'audio' ? 'm4a' : 'mp4';
      const filename = path.join(OUTPUT_DIR, `stream-${idx}.${ext}`);
      fs.writeFileSync(filename, buf);
      console.log(`💾 Saved ${filename} (${(buf.length / 1024).toFixed(1)} KB)`);

      if (type === 'video' && buf.length > videoSize) {
        videoFile = filename;
        videoSize = buf.length;
      } else if (type === 'audio' && !audioFile) {
        audioFile = filename;
      }
      idx++;
    } catch (e) {
      console.error('Lỗi tải:', e.message);
    }
  }

  await browser.close();

  if (!videoFile) {
    console.error('❌ Không tìm được video');
    process.exit(1);
  }

  if (audioFile) {
    console.log('\n🔧 Đang ghép hình + tiếng bằng ffmpeg...');
    const outputFile = path.join(OUTPUT_DIR, 'tiktok.mp4');
    try {
      execSync(
        `ffmpeg -y -i "${videoFile}" -i "${audioFile}" -c:v copy -c:a aac -shortest "${outputFile}"`,
        { stdio: 'inherit' }
      );
      console.log(`\n✅ Đã ghép xong: ${outputFile}`);
    } catch (e) {
      console.error('❌ ffmpeg lỗi:', e.message);
      process.exit(1);
    }
  } else {
    console.log('⚠️ Không có audio, chỉ có video');
  }

  // Dọn dẹp file rác, chỉ giữ tiktok.mp4
  fs.readdirSync(OUTPUT_DIR).forEach((f) => {
    if (f.startsWith('stream-')) fs.unlinkSync(path.join(OUTPUT_DIR, f));
  });

  console.log('\n🎉 Hoàn thành!');
})();
