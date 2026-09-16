const fs = require('fs');
const path = require('path');

const WORKER = 'https://top1.anhvietnam030.workers.dev';
const url = process.env.TIKTOK_URL;

if (!url) {
  console.error('❌ Missing TIKTOK_URL');
  process.exit(1);
}

const OUTPUT_DIR = 'output';
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

(async () => {
  console.log('🌐 TikTok URL:', url);
  console.log('🔧 Worker:', WORKER);

  const infoUrl = `${WORKER}/info?url=${encodeURIComponent(url)}`;
  console.log('📡 Gọi:', infoUrl);

  const infoResp = await fetch(infoUrl);
  const infoText = await infoResp.text();

  if (!infoResp.ok) {
    console.error('❌ /info failed:', infoResp.status);
    console.error(infoText.slice(0, 3000));
    process.exit(1);
  }

  let info;
  try {
    info = JSON.parse(infoText);
  } catch (e) {
    console.error('❌ Không parse JSON:', infoText.slice(0, 3000));
    process.exit(1);
  }

  console.log('📋 Info:', JSON.stringify(info, null, 2).slice(0, 3000));

  const videoUrl = info.playAddr || info.downloadAddr || (info.mp4Urls && info.mp4Urls[0]);

  if (!videoUrl) {
    console.error('❌ Không tìm được video URL');
    process.exit(1);
  }

  console.log('🎬 Video URL:', videoUrl.slice(0, 150));

  const proxyUrl = `${WORKER}/proxy?url=${encodeURIComponent(videoUrl)}`;
  console.log('📥 Tải qua proxy...');

  const videoResp = await fetch(proxyUrl);
  if (!videoResp.ok) {
    console.error('❌ Download failed:', videoResp.status);
    process.exit(1);
  }

  const buf = Buffer.from(await videoResp.arrayBuffer());
  const outPath = path.join(OUTPUT_DIR, 'tiktok.mp4');
  fs.writeFileSync(outPath, buf);
  console.log(`💾 Đã lưu: ${outPath} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
  console.log('✅ Done');
})().catch((e) => {
  console.error('💥 Crash:', e);
  process.exit(1);
});
