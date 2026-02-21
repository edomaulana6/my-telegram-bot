// Luna Engine Ultra v7.0 - Official API Mode
const { Telegraf } = require('telegraf');
const ytdl = require('@distube/ytdl-core'); 
const axios = require('axios');
const http = require('http');
const fastq = require('fastq');

const bot = new Telegraf(process.env.BOT_TOKEN);
const API_KEY = process.env.GOOGLE_API_KEY;

// 🛡️ SISTEM RESET RAM OTOMATIS (PER 1 MENIT)
setInterval(() => {
    if (global.gc) global.gc(); // Memicu pembuangan sampah memori
    const usage = Math.round(process.memoryUsage().rss / 1024 / 1024);
    console.log(`📊 [SYSTEM] RAM Audit: ${usage}MB | Status: Healthy`);
}, 60000);

// Antrean Proses (Agar tidak overload)
const queue = fastq.promise(async (task) => {
    const { ctx, query } = task;
    const isAudio = query.toLowerCase().includes('lagu') || query.toLowerCase().includes('play');
    const cleanQuery = query.replace(/lagu|play/gi, '').trim();
    
    const status = await ctx.reply(isAudio ? "🎵 Menyiapkan Audio..." : "🎬 Menyiapkan Video...");
    
    try {
        let videoUrl = cleanQuery;

        // Jika bukan link, cari lewat API Resmi yang Anda berikan
        if (!ytdl.validateURL(cleanQuery)) {
            const search = await axios.get(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(cleanQuery)}&type=video&maxResults=1&key=${API_KEY}`);
            if (!search.data.items.length) return ctx.reply("❌ Konten tidak ditemukan.");
            videoUrl = `https://www.youtube.com/watch?v=${search.data.items[0].id.videoId}`;
        }

        const info = await ytdl.getInfo(videoUrl);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
        
        const stream = ytdl(videoUrl, {
            quality: isAudio ? 'highestaudio' : 'highestvideo',
            filter: isAudio ? 'audioonly' : 'videoandaudio',
            requestOptions: {
                headers: {
                    'User-Agent': 'com.google.android.youtube/19.05.36 (Linux; U; Android 14)',
                    'X-YouTube-Client-Name': '3',
                    'X-YouTube-Client-Version': '19.05.36'
                }
            }
        });

        if (isAudio) {
            await ctx.replyWithAudio({ source: stream, filename: `${title}.mp3` }, { caption: `✅ **${title}**` });
        } else {
            await ctx.replyWithVideo({ source: stream, filename: `${title}.mp4` }, { caption: `✅ **${title}**`, supports_streaming: true });
        }
        
        stream.destroy(); // Langsung bersihkan memori stream
    } catch (e) {
        console.error(e);
        await ctx.reply("⚠️ Gagal memproses. Pastikan API Key aktif.");
    } finally {
        ctx.deleteMessage(status.message_id).catch(() => {});
    }
}, 2);

bot.on('text', (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    queue.push({ ctx, query: ctx.message.text });
});

// Health Check untuk Koyeb
http.createServer((req, res) => res.end('LUNA_ONLINE')).listen(process.env.PORT || 8000);
bot.launch({ dropPendingUpdates: true });
        
