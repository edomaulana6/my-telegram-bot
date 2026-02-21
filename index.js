const { Telegraf } = require('telegraf');
const ytdl = require('ytdl-core');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http'); // Tambahan untuk Health Check

const bot = new Telegraf(process.env.BOT_TOKEN);

// --- TAMBAHAN UNTUK KOYEB HEALTH CHECK ---
// Membuat server dummy agar Koyeb tidak mematikan bot secara paksa
http.createServer((req, res) => {
  res.writeHead(200);
  res.end("Alhamdulillah, Bot Ramadan Aktif.");
}).listen(process.env.PORT || 8000);
// ------------------------------------------

bot.start((ctx) => {
  ctx.reply(
    "Assalamu'alaikum Warahmatullahi Wabarakatuh ✨\n\n" +
    "Ahlan wa Sahlan di Bot Download Video YouTube.\n\n" +
    "Di bulan suci Ramadan yang penuh berkah ini, semoga fasilitas ini dapat membantu Anda menyebarkan kebaikan atau menimba ilmu bermanfaat. Silakan kirimkan tautan (link) video yang ingin Anda simpan dalam kualitas 1080p HD.\n\n" +
    "Selamat menjalankan ibadah puasa, semoga Allah subhanahu wa ta'ala menerima amal ibadah kita semua. 🙏"
  );
});

bot.on('text', async (ctx) => {
  const url = ctx.message.text;

  if (!ytdl.validateURL(url)) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return ctx.reply("Afwan (mohon maaf), tautan yang Anda berikan sepertinya kurang tepat. Silakan diperiksa kembali, barakallahu feek.");
    }
    return;
  }

  const status = await ctx.reply("🌙 Bismillah, sedang menyiapkan proses unduhan... Mohon kesabaran Anda sembari memperbanyak istighfar.");

  try {
    const info = await ytdl.getInfo(url);
    const id = Date.now();
    const videoFile = `v_${id}.mp4`;
    const audioFile = `a_${id}.mp3`;
    const outputFile = `1080p_${id}.mp4`;

    const videoStream = ytdl(url, { quality: 'highestvideo' });
    const audioStream = ytdl(url, { quality: 'highestaudio' });

    await Promise.all([
      new Promise((res, rej) => {
        videoStream.pipe(fs.createWriteStream(videoFile)).on('finish', res).on('error', rej);
      }),
      new Promise((res, rej) => {
        audioStream.pipe(fs.createWriteStream(audioFile)).on('finish', res).on('error', rej);
      })
    ]);

    await ctx.telegram.editMessageText(ctx.chat.id, status.message_id, null, "⚙️ Biidznillah, sedang menyatukan video dan audio serta meningkatkan kualitas ke 1080p HD...");

    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-i', videoFile,
      '-i', audioFile,
      '-vf', 'scale=1920:1080:force_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,unsharp=3:3:1.5', 
      '-c:v', 'libx264',
      '-preset', 'ultrafast', 
      '-crf', '20', 
      '-c:a', 'aac',
      '-b:a', '192k',
      outputFile
    ]);

    await new Promise((res, rej) => {
      ffmpeg.on('close', (code) => code === 0 ? res() : rej(new Error("Gagal dalam proses olah data")));
      ffmpeg.on('error', rej);
    });

    await ctx.replyWithVideo({ source: outputFile }, {
      caption: `✅ Alhamdulillah, video Anda telah siap dalam kualitas 1080p.\n\n🎬 Judul: ${info.videoDetails.title}\n\nSemoga menjadi ilmu yang bermanfaat dan membawa keberkahan. Selamat menanti waktu berbuka puasa! ✨`,
      supports_streaming: true
    });

    [videoFile, audioFile, outputFile].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });

  } catch (err) {
    console.error("Audit Error:", err.message);
    ctx.reply("Qadarullah, terjadi kendala teknis dalam memproses video ini. Silakan dicoba kembali beberapa saat lagi. Semoga Allah mudahkan.");
  } finally {
    ctx.deleteMessage(status.message_id).catch(() => {});
  }
});

// Jalankan bot dengan proteksi error koneksi (ECONNRESET)
bot.launch().then(() => {
    console.log("Alhamdulillah, Bot Khidmat Ramadan Aktif!");
}).catch((err) => {
    console.error("Gagal koneksi ke Telegram, mencoba ulang dalam 5 detik...", err.message);
    setTimeout(() => bot.launch(), 5000); 
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
  
