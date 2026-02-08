const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const http = require('http');

const API_ID = 'YOUR_API_ID';
const API_HASH = 'YOUR_API_HASH';
const BOT_TOKEN = 'YOUR_BOT_TOKEN';

const bot = new Telegraf(BOT_TOKEN);
const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

const clearMemoryTotal = () => {
    const tempDir = path.join(__dirname, 'temp');
    if (fs.existsSync(tempDir)) {
        fs.readdirSync(tempDir).forEach(file => {
            try { fs.unlinkSync(path.join(tempDir, file)); } catch (e) {}
        });
    }
    if (global.gc) { global.gc(); }
};

setInterval(clearMemoryTotal, 24 * 60 * 60 * 1000);

const MyMediaAPI = {
    async getUltraAudio(url) {
        const outputPath = path.join(__dirname, 'temp', `audio_${Date.now()}.mp3`);
        return new Promise((resolve, reject) => {
            ffmpeg(ytdl(url, { quality: 'highestaudio', highWaterMark: 1 << 14 }))
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
            const stream = ytdl(url, { quality: 'highestvideo', highWaterMark: 1 << 14 });
            const writer = fs.createWriteStream(outputPath);
            stream.pipe(writer);
            writer.on('finish', () => resolve(outputPath));
            writer.on('error', reject);
        });
    }
};

bot.on('message', async (ctx) => {
    const text = ctx.message.text;
    if (!text) return;
    const match = text.match(urlRegex);
    
    if (match) {
        const targetUrl = match[0];
        try {
            const info = await ytdl.getInfo(targetUrl);
            const title = info.videoDetails.title;
            const thumb = info.videoDetails.thumbnails.pop().url;

            await ctx.replyWithPhoto(thumb, {
                caption: `📝 *INFORMASI MEDIA*\n━━━━━━━━━━━━━━\n📌 *Judul:* ${title}\n🔊 *Audio:* 320kbps (Ultra HD)\n📺 *Video:* 1080p/Ultra HD\n⚙️ *Status:* Memproses data...\n━━━━━━━━━━━━━━`,
                parse_mode: 'Markdown'
            });

            const audioPath = await MyMediaAPI.getUltraAudio(targetUrl);
            await ctx.replyWithAudio({ source: audioPath });
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

            const videoPath = await MyMediaAPI.getUltraVideo(targetUrl);
            await ctx.replyWithVideo({ source: videoPath });
            if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);

            if (global.gc) global.gc();
        } catch (error) {
            console.error(error);
        }
    } else {
        const rawText = text.toLowerCase().replace('rb', '000').replace(',', '');
        try {
            const result = eval(rawText);
            if (typeof result === 'number') {
                ctx.reply(`Hasil Perhitungan: ${result}`);
            }
        } catch (e) {}
    }
});

if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');

http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot Running');
}).listen(process.env.PORT || 8080);

bot.launch();
