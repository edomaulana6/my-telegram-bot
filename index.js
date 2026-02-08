const { Telegraf } = require('telegraf');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);
const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');

bot.on('message', async (ctx) => {
    const text = ctx.message.text;
    if (!text) return;
    const match = text.match(urlRegex);
    if (!match) return; // Bot diam jika bukan link

    const targetUrl = match[0];
    const timestamp = Date.now();
    const audioPath = path.join(__dirname, 'temp', `audio_${timestamp}.mp3`);
    const videoPath = path.join(__dirname, 'temp', `video_${timestamp}.mp4`);

    await ctx.reply("⏳ Memproses media... Audio (Metode Lama) & Video (yt-dlp)");

    // --- METODE AUDIO (Tetap yang lama karena lancar) ---
    try {
        ffmpeg(ytdl(targetUrl, { quality: 'highestaudio', filter: 'audioonly' }))
            .audioBitrate(320)
            .toFormat('mp3')
            .save(audioPath)
            .on('end', async () => {
                await ctx.replyWithAudio({ source: audioPath });
                if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
            })
            .on('error', (err) => {
                console.log("Audio Error:", err.message);
            });
    } catch (e) {
        console.log("Audio Catch:", e.message);
    }

    // --- METODE VIDEO (Ganti ke yt-dlp agar tidak Error Facebook) ---
    const cmdVideo = `yt-dlp -f "b" "${targetUrl}" -o "${videoPath}"`;
    exec(cmdVideo, async (err) => {
        if (!err && fs.existsSync(videoPath)) {
            await ctx.replyWithVideo({ source: videoPath });
            if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
        } else {
            ctx.reply("❌ Video Gagal: Facebook memblokir metode biasa. Sistem sedang diperkuat.");
        }
    });
});

http.createServer((req, res) => { res.end('Bot Running'); }).listen(process.env.PORT || 8080);
bot.launch();
