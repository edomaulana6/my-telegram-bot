const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Server dummy agar Koyeb tetap 'Healthy' (Port 8000)
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot Universal Ramadan Aktif");
}).listen(process.env.PORT || 8000, '0.0.0.0');

bot.start((ctx) => {
  ctx.reply("Assalamu'alaikum! ✨\n\nBot All-Platform siap. Kirim link YouTube, TikTok, IG, FB, atau Twitter. Saya akan download dan upscale ke 1080p HD untuk Anda. 🙏");
});

bot.on('text', async (ctx) => {
  const url = ctx.message.text;
  if (!url.startsWith('http')) return;

  const status = await ctx.reply("🌙 Bismillah, sedang mendeteksi link secara agresif...");

  try {
    // API UNIVERSAL: Mendukung semua platform termasuk TikTok tanpa watermark
    const res = await axios.get(`https://api.vreden.my.id/api/download/allinone?url=${encodeURIComponent(url)}`);
    
    if (!res.data || !res.data.result) {
        throw new Error("Server sedang sibuk atau link tidak valid.");
    }

    const downloadUrl = res.data.result.url || res.data.result.video || (res.data.result.medias && res.data.result.medias[0].url);
    const id = Date.now();
    const rawFile = `raw_${id}.mp4`;
    const outputFile = `1080p_${id}.mp4`;

    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, null, "📥 Sedang mengambil file video asli...");

    // Proses Download
    const writer = fs.createWriteStream(rawFile);
    const response = await axios({ url: downloadUrl, method: 'GET', responseType: 'stream' });
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, null, "⚙️ Mengolah kualitas ke 1080p HD & Menjernihkan suara...");

    // PROSES UPSCALE FFmpeg (Wajib ada di Dockerfile)
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', rawFile,
      '-vf', 'scale=1920:1080:force_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,unsharp=3:3:1.2',
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '18',
      '-c:a', 'aac',
      '-b:a', '192k',
      outputFile
    ]);

    await new Promise((res, rej) => {
      ffmpeg.on('close', (code) => code === 0 ? res() : rej(new Error("Gagal upscale")));
      ffmpeg.on('error', rej);
    });

    await ctx.replyWithVideo({ source: outputFile }, {
      caption: `✅ Alhamdulillah, video berhasil di-upscale ke 1080p.\n\nSemoga bermanfaat! ✨`,
      supports_streaming: true
    });

    // Hapus file sampah
    if (fs.existsSync(rawFile)) fs.unlinkSync(rawFile);
    if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);

  } catch (err) {
    console.error(err);
    ctx.reply("Afwan, bot mengalami kendala teknis. Pastikan link publik dan coba lagi nanti. 🙏");
  } finally {
    ctx.deleteMessage(status.message_id).catch(() => {});
  }
});

bot.launch();
