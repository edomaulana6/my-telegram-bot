const { Telegraf } = require('telegraf');
const ytdl = require('ytdl-core');
const axios = require('axios');
const fs = require('fs');
const { spawn } = require('child_process');
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  if (!ytdl.validateURL(text)) {
    return ctx.reply("⚠️ Maaf, hanya link YouTube yang didukung.");
  }

  const status = await ctx.reply("🔎 Mendownload...");
  try {
    const info = await ytdl.getInfo(text);
    const format = ytdl.chooseFormat(info.formats, { quality: 'highestvideo', filter: 'videoonly' });
    if (!format) {
      return ctx.reply("⚠️ Tidak ada format video yang sesuai.");
    }

    const videoStream = ytdl.downloadFromInfo(info, { format: format });
    const audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
    const audioStream = ytdl.downloadFromInfo(info, { format: audioFormat });

    // Simpan video dan audio ke file sementara
    const videoFile = 'video.mp4';
    const audioFile = 'audio.mp3';
    const outputFile = 'output.mp4';

    videoStream.pipe(fs.createWriteStream(videoFile));
    audioStream.pipe(fs.createWriteStream(audioFile));

    // Tunggu sampai video dan audio selesai diunduh
    await new Promise((resolve, reject) => {
      videoStream.on('end', resolve);
      videoStream.on('error', reject);
    });
    await new Promise((resolve, reject) => {
      audioStream.on('end', resolve);
      audioStream.on('error', reject);
    });

    // Gunakan FFmpeg untuk meng upscale video ke 1080p dan menggabungkan dengan audio
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoFile,
      '-i', audioFile,
      '-vf', 'scale=1920:1080:force_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
      '-c:v', 'libx264',
      '-crf', '18',
      '-c:a', 'aac',
      outputFile
    ]);

    await new Promise((resolve, reject) => {
      ffmpeg.on('close', resolve);
      ffmpeg.on('error', reject);
    });

    // Kirim file output
    await ctx.replyWithVideo({ source: fs.createReadStream(outputFile), filename: 'video.mp4' }, { supports_streaming: true });

    // Hapus file sementara
    fs.unlinkSync(videoFile);
    fs.unlinkSync(audioFile);
    fs.unlinkSync(outputFile);
  } catch (e) {
    console.error("Error:", e.message);
    await ctx.reply("⚠️ Gagal mendownload video.");
  } finally {
    ctx.deleteMessage(status.message_id).catch(() => {});
  }
});

bot.launch();
