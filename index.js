// Luna Engine v7.5 - Multi-Platform Detection
const { Telegraf } = require('telegraf');
const ytdl = require('@distube/ytdl-core'); 
const axios = require('axios');
const http = require('http');
const fastq = require('fastq');

const bot = new Telegraf(process.env.BOT_TOKEN);
const API_KEY = process.env.GOOGLE_API_KEY;

// 🛡️ RESET RAM 1 MENIT (Wajib)
setInterval(() => {
    if (global.gc) global.gc();
    console.log(`📊 [CLEANUP] RAM: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);
}, 60000);

const queue = fastq.promise(async (task) => {
    const { ctx, text } = task;
    
    // 1. DETEKSI PLATFORM (Audit Awal)
    const isYoutube = ytdl.validateURL(text) || !text.includes('http');
    const isTiktok = text.includes('tiktok.com');
    const isFB = text.includes('facebook.com') || text.includes('fb.watch');

    if (!isYoutube) {
        return ctx.reply("⚠️ Maaf, saat ini Luna Engine difokuskan 100% untuk YouTube saja agar stabil.");
    }

    const status = await ctx.reply("🔎 Mencari di YouTube...");
    
    try {
        let videoUrl = text;
        const isAudio = text.toLowerCase().includes('lagu') || text.toLowerCase().includes('play');
        const cleanQuery = text.replace(/lagu|play/gi, '').trim();

        // 2. LOGIKA PENCARIAN (Jika bukan link)
        if (!ytdl.validateURL(cleanQuery)) {
            const search = await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(cleanQuery)}&type=video&maxResults=1&key=${API_KEY}`);
            if (!search.data.items.length) return ctx.reply("❌ Judul tersebut tidak ditemukan di YouTube.");
            videoUrl = `https://www.youtube.com/watch?v=${search.data.items[0].id.videoId}`;
        }

        // 3. PROSES STREAM
        const stream = ytdl(videoUrl, {
            quality: isAudio ? 'highestaudio' : 'highestvideo',
            filter: isAudio ? 'audioonly' : 'videoandaudio'
        });

        if (isAudio) {
            await ctx.replyWithAudio({ source: stream, filename: 'audio.mp3' });
        } else {
            await ctx.replyWithVideo({ source: stream, filename: 'video.mp4' }, { supports_streaming: true });
        }
        stream.destroy();
    } catch (e) {
        console.error("Error Detail:", e.message);
        await ctx.reply("⚠️ YouTube membatasi akses. Coba ganti judul atau gunakan link YouTube langsung.");
    } finally {
        ctx.deleteMessage(status.message_id).catch(() => {});
    }
}, 2);

bot.on('text', (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    queue.push({ ctx, text: ctx.message.text });
});

http.createServer((req, res) => res.end('STABLE')).listen(process.env.PORT || 8000);
bot.launch();
        
