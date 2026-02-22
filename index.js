const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

// Konfigurasi Token & Port
const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 8000;

if (!BOT_TOKEN) throw new Error("BOT_TOKEN tidak ditemukan di Environment Variables!");

const bot = new Telegraf(BOT_TOKEN);

// Server Monitoring (Agar Koyeb tetap 'Healthy')
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Layanan Bot Ramadan Aktif 🌙");
}).listen(PORT, '0.0.0.0');

// Fungsi Pembersihan File (Reset Memory Sederhana)
const hapusFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error(`Gagal menghapus cache: ${err.message}`);
    });
  }
};

bot.start((ctx) => {
  ctx.replyWithMarkdown(
    "✨ *Assalamu'alaikum Warahmatullahi Wabarakatuh* ✨\n\n" +
    "Selamat datang di **Bot Berkah Ramadan**. Saya akan membantu Anda mengunduh video " +
    "dan melakukan *upscale* ke HD 1080p untuk keperluan syiar kebaikan.\n\n" +
    "🙏 *Silakan kirimkan link video Anda (YT/IG/TikTok/FB).*"
  );
});

bot.on('text', async (ctx) => {
  const url = ctx.message.text;
  if (!url.startsWith('http')) return;

  const status = await ctx.reply("🌙 *Bismillah*, sedang memproses tautan...");
  const timestamp = Date.now();
  const rawPath = path.join(__dirname, `raw_${timestamp}.mp4`);
  const outPath = path.join(__dirname, `hd_${timestamp}.mp4`);

  try {
    // 1. Fetching Data dari API Universal
    const response = await axios.get(`https://api.vreden.my.id/api/download/allinone?url=${encodeURIComponent(url)}`);
    const data = response.data?.result;

    if (!data) throw new Error("Data video tidak ditemukan.");

    const downloadUrl = data.url || data.video || (data.medias && data.medias[0].url);
    
    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, null, "📥 *Mengunduh file asli...*");

    // 2. Download Proses (Stream)
    const writer = fs.createWriteStream(rawPath);
    const videoStream = await axios({ url: downloadUrl, method: 'GET', responseType: 'stream' });
    videoStream.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, null, "⚙️ *Proses Upscale 1080p & Penjernihan Suara...*");

    // 3. FFmpeg Processing (Optimasi Presisi)
    const ffmpeg = spawn('ffmpeg', [
      '-y', '-i', rawPath,
      '-vf', 'scale=1920:1080:force_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,unsharp=3:3:1.2',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20',
      '-c:a', 'aac', '-b:a', '192k',
      outPath
    ]);

    await new Promise((res, rej) => {
      ffmpeg.on('close', (code) => code === 0 ? res() : rej(new Error("Gagal Upscale")));
      ffmpeg.on('error', rej);
    });

    // 4. Pengiriman Hasil
    await ctx.replyWithVideo({ source: outPath }, {
      caption: "✅ *Alhamdulillah, Video Berhasil Diproses!*\n\nSemoga menjadi wasilah kebaikan di bulan suci ini. ✨",
      parse_mode: 'Markdown'
    });

  } catch (err) {
    console.error("ANALISA ERROR:", err.message);
    ctx.reply("Afwan, bot mengalami kendala teknis. Pastikan link publik dan coba kembali. 🙏");
  } finally {
    // Menghapus pesan status & file sampah (Cleanup 100% Akurat)
    ctx.deleteMessage(status.message_id).catch(() => {});
    hapusFile(rawPath);
    hapusFile(outPath);
  }
});

bot.launch().then(() => console.log("Bot Ramadan Berjalan Stabil."));
        
