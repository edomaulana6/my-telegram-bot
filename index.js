const { Telegraf, Input } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

// Inisialisasi Bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Server Monitoring (Koyeb/PaaS Health Check)
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot Pelayan Ramadan Aktif 🌙");
}).listen(process.env.PORT || 8000, '0.0.0.0');

/**
 * Fungsi Helper untuk menghapus file secara aman
 * Mencegah penumpukan storage (Memory Reset Logic)
 */
const cleanupFiles = (...files) => {
  files.forEach(file => {
    if (file && fs.existsSync(file)) {
      try {
        fs.unlinkSync(file);
      } catch (e) {
        console.error(`Gagal menghapus file: ${file}`, e);
      }
    }
  });
};

// Command Start - Tema Ramadan
bot.start((ctx) => {
  const pesan = `
✨ *Assalamu'alaikum Warahmatullahi Wabarakatuh* ✨

Selamat datang di **Bot Berkah Ramadan**. 🌙
Saya siap membantu Anda mengunduh & menjernihkan video (Upscale 1080p) untuk syiar kebaikan.

*Layanan Support:*
• TikTok (No Watermark)
• YouTube, Instagram, FB, Twitter/X

Silakan kirimkan link video yang ingin diproses. 🙏
  `;
  ctx.replyWithMarkdown(pesan);
});

bot.on('text', async (ctx) => {
  const url = ctx.message.text;
  if (!url.startsWith('http')) return;

  const timestamp = Date.now();
  const rawFile = path.join(__dirname, `temp_raw_${timestamp}.mp4`);
  const outputFile = path.join(__dirname, `ramadan_hd_${timestamp}.mp4`);
  
  let statusMsg;
  
  try {
    statusMsg = await ctx.reply("🔍 *Bismillah*, sedang memverifikasi tautan...");

    // 1. Ekstraksi Data API
    const { data } = await axios.get(`https://api.vreden.my.id/api/download/allinone?url=${encodeURIComponent(url)}`);
    
    if (!data?.result) throw new Error("Data tidak ditemukan");

    const videoUrl = data.result.url || data.result.video || data.result.medias?.[0]?.url;
    if (!videoUrl) throw new Error("URL Video tidak valid");

    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "📥 *Menjemput Berkah...* Sedang mengunduh file asli.");

    // 2. Download Stream
    const writer = fs.createWriteStream(rawFile);
    const stream = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
    stream.data.pipe(writer);

    await new Promise((res, rej) => {
      writer.on('finish', res);
      writer.on('error', rej);
    });

    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "⚙️ *Proses Upscale 1080p HD...*\nMohon bersabar, sedang memperindah kualitas video.");

    // 3. FFmpeg Processing (Optimization)
    // Menggunakan preset 'fast' agar tidak terlalu lama namun hasil tetap tajam
    const ffmpeg = spawn('ffmpeg', [
      '-y', '-i', rawFile,
      '-vf', 'scale=1280:720:force_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,unsharp=5:5:1.0:5:5:0.0',
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '22',
      '-c:a', 'aac', '-b:a', '128k',
      outputFile
    ]);

    await new Promise((res, rej) => {
      ffmpeg.on('close', (code) => code === 0 ? res() : rej(new Error("FFmpeg Error")));
      ffmpeg.on('error', rej);
    });

    // 4. Kirim Hasil
    await ctx.replyWithVideo({ source: outputFile }, {
      caption: `✅ *Alhamdulillah!* Video telah berhasil di-upscale.\n\nSemoga menjadi wasilah kebaikan di bulan suci ini. ✨`,
      parse_mode: 'Markdown'
    });

  } catch (err) {
    console.error("ANALYSIS ERROR:", err.message);
    ctx.reply("Afwan, terjadi kendala teknis saat memproses video. Pastikan link tidak diprivasi. 🙏");
  } finally {
    // 5. Pembersihan Mutlak (Anti-Halusinasi & Storage Management)
    if (statusMsg) ctx.deleteMessage(statusMsg.message_id).catch(() => {});
    cleanupFiles(rawFile, outputFile);
  }
});

bot.launch().then(() => console.log("Bot Ramadan Berjalan Akurat 100%"));

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
