const { Telegraf } = require('telegraf');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Mengambil Token dari Environment Variables Koyeb
const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

// Regex ketat untuk mendeteksi URL
const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

// Pastikan folder temp tersedia
if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');

bot.on('message', async (ctx) => {
    const text = ctx.message.text;
    
    // Filter: Hanya proses jika ada link. Jika chat biasa, bot DIAM.
    if (!text || !text.match(urlRegex)) return;

    const targetUrl = text.match(urlRegex)[0];
    const timestamp = Date.now();
    const videoPath = path.join(__dirname, 'temp', `video_${timestamp}.mp4`);
    const audioPath = path.join(__dirname, 'temp', `audio_${timestamp}.mp3`);

    await ctx.reply("🚀 **Processing High Quality...**\nSedang mengambil Video (Original) & Audio (320kbps). Mohon tunggu.");

    // Command untuk Video Kualitas Terbaik (Best Video + Best Audio merged)
    const cmdVideo = `yt-dlp -f "bestvideo+bestaudio/best" --merge-output-format mp4 "${targetUrl}" -o "${videoPath}" --no-playlist`;
    
    // Command untuk Audio Kualitas Terbaik (MP3 320kbps)
    const cmdAudio = `yt-dlp -f "ba" -x --audio-format mp3 --audio-quality 0 "${targetUrl}" -o "${audioPath}" --no-playlist`;

    // Proses Download Video
    exec(cmdVideo, async (err) => {
        if (!err && fs.existsSync(videoPath)) {
            await ctx.replyWithVideo({ source: videoPath }, { 
                caption: "🎬 **Video Kualitas Asli Berhasil Diunduh**" 
            });
            if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        } else {
            console.error(err);
            ctx.reply("❌ Gagal mengambil Video. Mungkin link diproteksi atau server penuh.");
        }

        // Proses Download Audio setelah Video
        exec(cmdAudio, async (errAudio) => {
            if (!errAudio && fs.existsSync(audioPath)) {
                await ctx.replyWithAudio({ source: audioPath }, { 
                    title: `Audio_HighQuality_${timestamp}` 
                });
                if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
            } else {
                console.error(errAudio);
                ctx.reply("❌ Gagal mengambil Audio kualitas tinggi.");
            }
        });
    });
});

// Penanganan Error Polling agar bot tidak mati saat terjadi Conflict 409
bot.launch().then(() => {
    console.log("✅ Bot High Quality telah aktif di semua platform.");
}).catch((err) => {
    console.error("Critical Error:", err.message);
});

// Server dummy agar Koyeb tidak menganggap aplikasi mati (Port 8080)
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is running perfectly');
}).listen(process.env.PORT || 8080);

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
