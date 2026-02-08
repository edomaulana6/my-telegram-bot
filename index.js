const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const http = require('http');

// Kredensial dari Environment Variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

// Membersihkan file temp setiap 24 jam
const clearMemoryTotal = () => {
    const tempDir = path.join(__dirname, 'temp');
    if (fs.existsSync(tempDir)) {
        fs.readdirSync(tempDir).forEach(file => {
            try { fs.unlinkSync(path.join(tempDir, file)); } catch (e) {}
        });
    }
};
setInterval(clearMemoryTotal, 24 * 60 * 60 * 1000);

const MyMediaAPI = {
    async getUltraAudio(url) {
        const outputPath = path.join(__dirname, 'temp', `audio_${Date.now()}.mp3`);
        return new Promise((resolve, reject) => {
            ffmpeg(ytdl(url, { quality: 'highestaudio', filter: 'audioonly' }))
                .audioBitrate(320)
                .toFormat('mp3')
                .save(outputPath)
                .on('end', () => resolve(outputPath))
                .on('error', reject);
        });
    },
    async getUltraVideo(url) {
        const outputPath = path.join(__dirname, 'temp', `video_${Date.now()}.mp4`);
        return new Promise((resolve, reject) => {
            const stream = ytdl(url, { quality: 'highestvideo' });
            const writer = fs.createWriteStream(outputPath);
            stream.pipe(writer);
            writer.on('finish', () => resolve(outputPath));
            writer.on('error', reject);
        });
    }
};

bot.start((ctx) => {
    ctx.reply("👋 Halo! Kirimkan link video (YouTube/Facebook) untuk mendownload audio dan video secara otomatis.");
});

bot.on('message', async (ctx) => {
    const text = ctx.message.text;
    
    // Validasi: Hanya proses jika ada teks dan teks tersebut mengandung Link URL
    if (!text) return;
    const match = text.match(urlRegex);
    
    // Jika tidak ada link, bot diam (tidak membalas chat biasa)
    if (!match) return;

    const targetUrl = match[0];
    try {
        const info = await ytdl.getInfo(targetUrl);
        const title = info.videoDetails.title;
        const thumb = info.videoDetails.thumbnails.pop().url;

        await ctx.replyWithPhoto(thumb, {
            caption: `📝 *INFORMASI MEDIA*\n━━━━━━━━━━━━━━\n📌 *Judul:* ${title}\n🔊 *Audio:* 320kbps (Ultra HD)\n📺 *Video:* 1080p/720p\n⚙️ *Status:* Mengunduh file...\n━━━━━━━━━━━━━━`,
            parse_mode: 'Markdown'
        });

        // Proses Audio
        const audioPath = await MyMediaAPI.getUltraAudio(targetUrl);
        await ctx.replyWithAudio({ source: audioPath });
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

        // Proses Video
        const videoPath = await MyMediaAPI.getUltraVideo(targetUrl);
        await ctx.replyWithVideo({ source: videoPath });
        if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);

    } catch (error) {
        console.error(error);
        ctx.reply("❌ Maaf, terjadi kesalahan saat memproses link tersebut. Pastikan link video publik dan valid.");
    }
});

// Setup folder temp dan server dummy untuk Koyeb
if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');

http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot Downloader is Running');
}).listen(process.env.PORT || 8080);

bot.launch();
