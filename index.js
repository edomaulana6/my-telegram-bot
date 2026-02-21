// -*- coding: utf-8 -*-
const { Telegraf, session } = require('telegraf');
const { message } = require('telegraf/filters');
const ytdl = require('@distube/ytdl-core'); // Bypass enkripsi terbaru
const fastq = require('fastq');
const http = require('http');
const axios = require('axios');

// --- KONFIGURASI PERSISI ---
const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

// --- AUDIT RESOURCE 1 MENIT ---
// Menjaga agar Koyeb tidak melakukan OOM Kill (Out of Memory)
setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024;
    console.log(`📊 [AUDIT RAM] Usage: ${Math.round(used)}MB / Limit: 512MB`);
    if (global.gc && used > 400) global.gc();
}, 60000);

// --- ANTRIAN PROSES (Concurrency: 3) ---
const queue = fastq.promise(async (task) => {
    return engineCore(task.ctx, task.url, task.isAudio);
}, 3);

// --- CORE ENGINE (STREAMING BYPASS) ---
async function engineCore(ctx, url, isAudio = false) {
    const statusMsg = await ctx.reply(isAudio ? "🎵 Menyiapkan audio..." : "🚀 HARD-BYPASS: Streaming video...");

    try {
        if (ytdl.validateURL(url)) {
            // Mengambil info video tanpa mendownload (hemat data)
            const info = await ytdl.getInfo(url);
            const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
            
            // Format Otomatis: Audio Only atau Video+Audio (MP4)
            const options = {
                quality: isAudio ? 'highestaudio' : 'highestvideo',
                filter: isAudio ? 'audioonly' : 'videoandaudio',
            };

            const stream = ytdl(url, options);

            if (isAudio) {
                await ctx.replyWithAudio({ source: stream, filename: `${title}.mp3` }, { caption: "✅ Audio Berhasil!" });
            } else {
                await ctx.replyWithVideo({ source: stream, filename: `${title}.mp4` }, { caption: "✅ Video Berhasil!", supports_streaming: true });
            }
        } else {
            // Logika untuk link umum (TikTok/Instagram) via Direct Stream Axios
            const response = await axios({ method: 'get', url, responseType: 'stream' });
            await ctx.replyWithDocument({ source: response.data, filename: 'Luna_Download.mp4' });
        }
    } catch (error) {
        console.error("Engine Error:", error.message);
        await ctx.reply("❌ Gagal. Proteksi platform terlalu kuat atau link sudah kadaluarsa.");
    } finally {
        ctx.deleteMessage(statusMsg.message_id).catch(() => {});
    }
}

// --- HANDLER ---
bot.on(message('text'), async (ctx) => {
    const msg = ctx.message.text.trim();
    const urlPattern = /https?:\/\/\S+/gi;
    const links = msg.match(urlPattern);

    if (links) {
        const url = links[0];
        const isAudio = url.includes('music.youtube.com') || msg.includes('--audio');
        queue.push({ ctx, url, isAudio });
        return;
    }

    if (msg.toLowerCase().startsWith('play ')) {
        const query = msg.slice(5).trim();
        ctx.reply(`🔎 Mencari "${query}" via Engine...`);
        // Catatan: Anda bisa menambahkan yt-search di sini untuk mencari link otomatis
        queue.push({ ctx, url: query, isAudio: true });
        return;
    }

    if (msg === '/start') {
        ctx.reply("🔥 Luna Engine v8.0 HARD-BYPASS Online!\n\nRunning on Koyeb Native Node.js.");
    }
});

// --- KOYEB HEALTH CHECK (PORT 8000) ---
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Luna Engine v8.0 is Healthy');
}).listen(process.env.PORT || 8000);

bot.launch({ dropPendingUpdates: true });

// Elegant Shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
            
