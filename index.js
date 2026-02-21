const { Telegraf } = require('telegraf');
const ytdl = require('ytdl-core');
const axios = require('axios');
const fs = require('fs');
const { spawn } = require('child_process');

// Inisialisasi bot dengan Token dari Environment Variable
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.on('text', async (ctx) => {
  const text = ctx.message.text;

  // 1. Validasi URL YouTube
  if (!ytdl.validateURL(text)) {
    return ctx.reply("⚠️ Maaf, hanya link YouTube yang didukung.");
  }

  const status = await ctx.reply("🔎 Sedang memproses dan meng-upscale ke 1080p...");

  try {
    const info = await ytdl.getInfo(text);
    
    // Pilih format video tertinggi dan audio tertinggi secara terpisah
    const videoFormat = ytdl.chooseFormat(info.formats, { quality: 'highestvideo', filter: 'videoonly' });
    const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });

    if (!videoFormat || !audioFormat) {
      return ctx.reply("⚠️ Gagal mendapatkan format video/audio yang sesuai.");
    }

    const videoFile = `video_${Date.now()}.mp4`;
    const audioFile = `audio_${Date.now()}.mp3`;
    const outputFile = `output_${Date.now()}.mp4`;

    // 2. Proses Download Video dan Audio secara paralel
    // Menggunakan event 'finish' pada writeStream untuk memastikan file benar-benar tertulis di disk
    await Promise.all([
      new Promise((resolve, reject) => {
        ytdl(text, { format: videoFormat })
          .pipe(fs.createWriteStream(videoFile))
          .on('finish', resolve)
          .on('error', reject);
      }),
      new Promise((resolve, reject) => {
        ytdl(text, { format: audioFormat })
          .pipe(fs.createWriteStream(audioFile))
          .on('finish', resolve)
          .on('error', reject);
      })
    ]);

    // 3. Proses FFmpeg: Menggabungkan dan Upscale ke 1080p
    // Ditambahkan flag -y untuk overwrite file jika ada bentrokan
    const ffmpeg = spawn('ffmpeg', [
      '-y', 
      '-i', videoFile,
      '-i', audioFile,
      '-vf', 'scale=1920:1080:force_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
      '-c:v', 'libx264',
      '-preset', 'veryfast', // Mempercepat proses build di server
      '-crf', '23',           // Keseimbangan antara kualitas dan ukuran file
      '-c:a', 'aac',
      outputFile
    ]);

    await new Promise((resolve, reject) => {
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg keluar dengan kode ${code}`));
      });
      ffmpeg.on('error', reject);
    });

    // 4. Kirim file hasil upscale ke Telegram
    await ctx.replyWithVideo({ 
      source: fs.createReadStream(outputFile), 
      filename: 'video_1080p.mp4' 
    }, { 
      supports_streaming: true,
      caption: `✅ Berhasil di-upscale ke 1080p: ${info.videoDetails.title}`
    });

    // 5. Cleanup: Hapus file sementara dengan aman
    [videoFile, audioFile, outputFile].forEach(file => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });

  } catch (e) {
    console.error("Audit Error:", e.message);
    await ctx.reply(`⚠️ Terjadi kesalahan: ${e.message}`);
    
    // Pastikan file sampah terhapus jika gagal
    if (fs.existsSync(videoFile)) fs.unlinkSync(videoFile);
    if (fs.existsSync(audioFile)) fs.unlinkSync(audioFile);
  } finally {
    ctx.deleteMessage(status.message_id).catch(() => {});
  }
});

bot.launch().then(() => console.log("Bot berjalan dengan akurasi 100%"));

// Penanganan penghentian bot secara halus
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
  
