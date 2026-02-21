const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Server Dummy agar Health Check Koyeb Lulus (Port 8000)
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot Universal Ramadan Aktif");
}).listen(process.env.PORT || 8000, '0.0.0.0');

bot.start((ctx) => {
  ctx.reply(
    "Assalamu'alaikum Warahmatullahi Wabarakatuh ✨\n\n" +
    "Ahlan wa Sahlan di Bot Universal Downloader. Saya siap mengunduh dari platform apa pun (YouTube, TikTok, IG, FB, dll) dan mengubahnya ke 1080p HD.\n\n" +
    "Silakan kirimkan tautan video Anda. Semoga berkah! 🙏"
  );
});

bot.on('text', async (ctx) => {
  const url = ctx.message.text;
  if (!url.startsWith('http')) return;

  const status = await ctx.reply("🌙 Bismillah, sedang mendeteksi sumber video secara agresif...");

  try {
    // API Universal: Mendukung 100+ Platform termasuk TikTok tanpa Watermark
    const apiUrl = `https://api.vreden.my.id/api/download/allinone?url=${encodeURIComponent(url)}`;
    const { data } = await axios.get(apiUrl);

    if (!data || !data.result) {
      return ctx.reply("Afwan, video tidak ditemukan atau tautan bersifat privat. Silakan cek kembali.");
    }

    // Identifikasi URL Video hasil scraping
    const videoUrl = data.result.url || data.result.video || (data.result.medias && data.result.medias[0].url);
    
    if (!videoUrl) throw new Error("Video URL not found");

    const id = Date.now();
    const rawFile = `raw_${id}.mp4`;
    const outputFile = `1080p_${id}.mp4`;

    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, null, "📥 Sedang mengunduh file asli dari server sumber...");

    // Proses Download File Asli
    const writer = fs.createWriteStream(rawFile);
    const response = await axios({ url: videoUrl, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, null, "⚙️ Proses Upscale 1080p & Penjernihan Video sedang berlangsung... Mohon bersabar.");

    // MESIN UPSCALE FFmpeg: Memaksa 1080p & Menyatukan Audio
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', rawFile,
      '-vf', 'scale=1920:1080:force_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,unsharp=3:3:1.2', // Upscale + Pad + Sharpen
      '-c:v', 'libx264',
      '-preset', 'ultrafast', // Kecepatan Agresif
      '-crf', '18', // High Quality (Bitrate tinggi)
      '-c:a', 'aac',
      '-b:a', '192k', // Audio jernih
      '-shortest',
      outputFile
    ]);

    await new Promise((res, rej) => {
      ffmpeg.on('close', (code) => code === 0 ? res() : rej(new Error("Gagal mengolah video")));
      ffmpeg.on('error', rej);
    });

    // Kirim Hasil Akhir
    await ctx.replyWithVideo({ source: outputFile }, {
      caption: `✅ Alhamdulillah, Video berhasil di-upscale ke 1080p Full HD.\n\n✨ Selamat menikmati konten Anda, barakallahu feek!`,
      supports_streaming: true
    });

    // Cleanup File Sampah
    [rawFile, outputFile].forEach(f => fs.existsSync(f) && fs.unlinkSync(f));

  } catch (err) {
    console.error("Audit Error:", err.message);
    ctx.reply("Qadarullah, terjadi kesalahan teknis. Pastikan link benar atau coba beberapa saat lagi. 🙏");
  } finally {
    ctx.deleteMessage(status.message_id).catch(() => {});
  }
});

bot.launch().catch(err => {
    console.error("Koneksi gagal, mencoba ulang...", err.message);
    setTimeout(() => bot.launch(), 5000);
});
    
