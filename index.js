const { Telegraf } = require('telegraf');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Inisialisasi Bot dengan Token dari Environment Variable
const bot = new Telegraf(process.env.BOT_TOKEN);

// Server dummy agar Koyeb tetap 'Healthy' (Port 8000)
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot Ramadan Real-time Aktif 🌙");
}).listen(process.env.PORT || 8000, '0.0.0.0');

/**
 * Fungsi Progress Bar Unik Ramadan
 * Menghasilkan visualisasi bulan yang menutupi awan secara bertahap
 */
function makeProgressBar(percent) {
  const size = 10;
  const progress = Math.round((size * percent) / 100);
  const emptyProgress = size - progress;
  const filled = "🌙".repeat(progress); 
  const empty = "☁️".repeat(emptyProgress); 
  return `|${filled}${empty}| ${percent}%`;
}

bot.start((ctx) => {
  ctx.replyWithMarkdown(
    "✨ *Assalamu'alaikum Warahmatullahi Wabarakatuh* ✨\n\n" +
    "Selamat datang di **Bot Berkah Ramadan**.\n" +
    "Saya siap mengunduh & menjernihkan video Anda secara real-time.\n\n" +
    "🙏 *Silakan kirimkan link video (TikTok/YT/IG/FB).*"
  );
});

bot.on('text', async (ctx) => {
  const url = ctx.message.text;
  if (!url.startsWith('http')) return;

  const statusMsg = await ctx.reply("✨ *Bismillah...*\n\n☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️ 0%", { parse_mode: 'Markdown' });
  const timestamp = Date.now();
  const rawPath = path.join(__dirname, `raw_${timestamp}.mp4`);
  const outPath = path.join(__dirname, `hd_${timestamp}.mp4`);

  try {
    // 1. TAHAP DOWNLOAD (yt-dlp dengan Output Real-time)
    const ytdlp = spawn('yt-dlp', [
      '-f', 'best[ext=mp4]/best',
      '--newline',
      '--progress',
      '--force-overwrites',
      '-o', rawPath,
      url
    ]);

    let lastUpdate = 0;

    ytdlp.stdout.on('data', (data) => {
      const output = data.toString();
      // Menangkap angka persentase (Contoh: 45.2%)
      const match = output.match(/(\d+\.\d+)%/);
      
      if (match) {
        const percent = parseFloat(match[1]);
        const now = Date.now();
        
        // Update setiap 2.5 detik untuk menghindari rate-limit Telegram
        if (now - lastUpdate > 2500) {
          const bar = makeProgressBar(percent);
          ctx.telegram.editMessageText(
            ctx.chat.id, 
            statusMsg.message_id, 
            null, 
            `📥 *Sedang Mengunduh...*\n\n${bar}\n\n_Mohon bersabar, sedang menjemput berkah._ 🙏`,
            { parse_mode: 'Markdown' }
          ).catch(() => {}); // Mengabaikan error jika konten pesan sama
          lastUpdate = now;
        }
      }
    });

    await new Promise((resolve, reject) => {
      ytdlp.on('close', (code) => code === 0 ? resolve() : reject(new Error("Download Gagal")));
      ytdlp.on('error', reject);
    });

    // 2. TAHAP UPSCALE (FFmpeg - Konfigurasi Paling Ringan & Stabil)
    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "⚙️ *Proses Penjernihan...*\n\n🪔 Sedang mengoptimasi visual agar lebih jernih.");

    const ffmpeg = spawn('ffmpeg', [
      '-y', '-i', rawPath,
      '-vf', 'scale=1280:720:force_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2',
      '-c:v', 'libx264', 
      '-preset', 'superfast', 
      '-crf', '26', 
      '-c:a', 'copy', // Menghemat CPU dengan menyalin audio tanpa encode ulang
      outPath
    ]);

    await new Promise((res, rej) => {
      ffmpeg.on('close', (code) => code === 0 ? res() : rej(new Error("FFmpeg Gagal")));
      ffmpeg.on('error', rej);
    });

    // 3. TAHAP PENGIRIMAN
    await ctx.replyWithVideo({ source: outPath }, {
      caption: `✅ *Alhamdulillah, Video Selesai!*\n\nKualitas telah dioptimalkan (720p HD). Semoga bermanfaat! ✨`,
      parse_mode: 'Markdown',
      supports_streaming: true
    });

  } catch (err) {
    console.error("ANALISA TEKNIS:", err.message);
    ctx.reply("Afwan, video gagal diproses. Pastikan link publik dan durasi tidak terlalu panjang. 🙏");
  } finally {
    // 4. PEMBERSIHAN MUTLAK (Reset Memori/Storage)
    ctx.deleteMessage(statusMsg.message_id).catch(() => {});
    if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
  }
});

bot.launch().then(() => console.log("Bot Ramadan Real-time Berjalan Stabil."));

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
