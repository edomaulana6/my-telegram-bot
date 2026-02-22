const { Telegraf } = require('telegraf');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Server dummy untuk Koyeb
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot Ramadan Aktif 🌙");
}).listen(process.env.PORT || 8000, '0.0.0.0');

// Fungsi Progress Bar Ramadan
function makeProgressBar(percent) {
  const size = 10;
  const progress = Math.round((size * percent) / 100);
  const emptyProgress = size - progress;
  const filled = "🌙".repeat(progress); 
  const empty = "☁️".repeat(emptyProgress); 
  return `|${filled}${empty}| ${percent}%`;
}

bot.start((ctx) => {
  ctx.replyWithMarkdown("✨ *Assalamu'alaikum!* ✨\n\nKirim link video, saya akan download via *yt-dlp* dan upscale ke *1080p HD* secara real-time. 🙏");
});

bot.on('text', async (ctx) => {
  const url = ctx.message.text;
  if (!url.startsWith('http')) return;

  const statusMsg = await ctx.reply("✨ *Bismillah...*\n\n☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️ 0%", { parse_mode: 'Markdown' });
  const timestamp = Date.now();
  const rawPath = path.join(__dirname, `raw_${timestamp}.mp4`);
  const outPath = path.join(__dirname, `hd_${timestamp}.mp4`);

  try {
    // 1. TAHAP DOWNLOAD (yt-dlp)
    const ytdlp = spawn('yt-dlp', [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]',
      '--newline',
      '-o', rawPath,
      url
    ]);

    let lastUpdate = 0;

    ytdlp.stdout.on('data', (data) => {
      const output = data.toString();
      const match = output.match(/(\d+\.\d+)%/);
      
      if (match) {
        const percent = parseFloat(match[1]);
        const now = Date.now();
        // Update setiap 3 detik agar aman dari limit Telegram
        if (now - lastUpdate > 3000) {
          const bar = makeProgressBar(percent);
          ctx.telegram.editMessageText(
            ctx.chat.id, 
            statusMsg.message_id, 
            null, 
            `📥 *Sedang Mengunduh...*\n\n${bar}\n\n_Mohon bersabar, sedang menjemput berkah._ 🙏`,
            { parse_mode: 'Markdown' }
          ).catch(() => {});
          lastUpdate = now;
        }
      }
    });

    await new Promise((resolve, reject) => {
      ytdlp.on('close', (code) => code === 0 ? resolve() : reject(new Error("Download Gagal")));
      ytdlp.on('error', reject);
    });

    // 2. TAHAP UPSCALE (FFmpeg)
    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "⚙️ *Proses Penjernihan HD...*\n\n🪔 Sedang melakukan upscale ke 1080p...");

    const ffmpeg = spawn('ffmpeg', [
      '-y', '-i', rawPath,
      '-vf', 'scale=1920:1080:force_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,unsharp=3:3:1.2',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
      '-c:a', 'aac', '-b:a', '128k',
      outPath
    ]);

    await new Promise((res, rej) => {
      ffmpeg.on('close', (code) => code === 0 ? res() : rej(new Error("FFmpeg Gagal")));
      ffmpeg.on('error', rej);
    });

    // 3. TAHAP PENGIRIMAN
    await ctx.replyWithVideo({ source: outPath }, {
      caption: `✅ *Alhamdulillah, Video Selesai!*\n\nBerhasil di-upscale ke 1080p via yt-dlp. Semoga bermanfaat! ✨`,
      parse_mode: 'Markdown',
      supports_streaming: true
    });

  } catch (err) {
    console.error("ANALISA TEKNIS:", err.message);
    ctx.reply("Afwan, terjadi kendala teknis. Pastikan link video valid. 🙏");
  } finally {
    // 4. PEMBERSIHAN (Reset Memori)
    ctx.deleteMessage(statusMsg.message_id).catch(() => {});
    if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  }
});

bot.launch().then(() => console.log("Bot Ramadan Real-time Aktif!"));
