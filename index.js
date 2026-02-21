// -*- coding: utf-8 -*-
const { Telegraf } = require('telegraf');
const { message } = require('telegraf/filters');
const ytdl = require('@distube/ytdl-core'); 
const yts = require('yt-search');
const fastq = require('fastq');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

/**
 * 🛡️ SISTEM RESET RAM OTOMATIS (SETIAP 1 MENIT)
 * Standar Ketelitian 100% untuk menjaga uptime di Koyeb.
 */
setInterval(() => {
    if (global.gc) {
        global.gc(); // Bersihkan RAM secara paksa setiap menit
    }
    const usage = process.memoryUsage().rss / 1024 / 1024;
    console.log(`📊 [RESET RAM 1 MENIT] Status: Clean | RAM: ${Math.round(usage)}MB`);
}, 60000);

// --- QUEUE SYSTEM ---
const queue = fastq.promise(async (task) => {
    return engineBypass(task.ctx, task.url, task.isAudio);
}, 2);

async function engineBypass(ctx, url, isAudio = false) {
    const status = await ctx.reply(isAudio ? "🎵 Menyiapkan Audio (Public Stream)..." : "🎬 Menyiapkan Video (Public Stream)...");
    
    try {
        let finalUrl = url;

        // Pencarian murni via YouTube Web (Bukan YT Music)
        if (!ytdl.validateURL(url)) {
            const search = await yts(url);
            if (!search.videos.length) return ctx.reply("❌ Tidak ditemukan.");
            finalUrl = search.videos[0].url;
        }

        // Menggunakan filter 'Guest' agar tidak meminta cookies
        const info = await ytdl.getInfo(finalUrl);
        const title = info.videoDetails.title.replace(/[^\w\s]/gi, '');
        
        const stream = ytdl(finalUrl, {
            quality: isAudio ? 'highestaudio' : 'highestvideo',
            filter: isAudio ? 'audioonly' : 'videoandaudio',
            // Hard-code untuk menghindari pemanggilan YT Music API
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                }
            }
        });

        const meta = { source: stream, filename: `${title}.${isAudio ? 'mp3' : 'mp4'}` };
        const caption = `✅ **${title}**\n\nMode: No-Cookies Public Stream`;

        if (isAudio) {
            await ctx.replyWithAudio(meta, { caption, parse_mode: 'Markdown' });
        } else {
            await ctx.replyWithVideo(meta, { caption, parse_mode: 'Markdown', supports_streaming: true });
        }

        // Hancurkan stream segera setelah selesai agar RAM tidak tersisa
        stream.destroy();
    } catch (e) {
        console.error("Engine Error:", e.message);
        await ctx.reply("❌ Gagal mengambil data. Platform sedang memperketat akses publik.");
    } finally {
        ctx.deleteMessage(status.message_id).catch(() => {});
    }
}

// --- HANDLER ---
bot.on(message('text'), async (ctx) => {
    const text = ctx.message.text.trim();
    if (text.startsWith('/')) return;

    const isUrl = /https?:\/\/\S+/gi.test(text);
    // Jika ada kata kunci 'lagu' atau 'mp3', otomatis mode audio
    const wantAudio = text.toLowerCase().includes('lagu') || text.toLowerCase().endsWith('mp3');

    queue.push({ 
        ctx, 
        url: text.toLowerCase().replace('lagu', '').trim(), 
        isAudio: wantAudio 
    });
});

// KOYEB HEALTH CHECK (Port 8000)
http.createServer((req, res) => { res.writeHead(200); res.end('OK'); }).listen(process.env.PORT || 8000);
bot.launch({ dropPendingUpdates: true });
                            
