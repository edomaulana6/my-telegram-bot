// -*- coding: utf-8 -*-
const { Telegraf, session } = require('telegraf'); 
const ytDlp = require('yt-dlp-exec');
const fastq = require('fastq');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const fetch = require('node-fetch');

// --- KONFIGURASI SISTEM ---
const BOT_TOKEN = process.env.BOT_TOKEN || "MASUKKAN_TOKEN_BOT_ANDA_DI_SINI";
const bot = new Telegraf(BOT_TOKEN);
const tempDir = '/tmp/luna_engine';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// --- [FITUR 1: AUDIT RAM SETIAP 1 MENIT] ---
setInterval(() => {
    const used = process.memoryUsage();
    const rss = Math.round(used.rss / 1024 / 1024);
    console.log(`📊 [AUDIT RAM - ${new Date().toLocaleTimeString()}] RSS: ${rss}MB`);
    if (global.gc && rss > 400) {
        global.gc();
    }
}, 60000);

// --- [FITUR 2: UNIVERSAL URL EXPANDER] ---
async function getRealUrl(url) {
    try {
        const res = await fetch(url, { 
            method: 'GET', 
            redirect: 'follow', 
            headers: { 'User-Agent': 'Mozilla/5.0' } 
        });
        let finalUrl = res.url;
        if (finalUrl.includes('facebook.com/share/r/')) finalUrl = finalUrl.replace('share/r/', 'reels/');
        return finalUrl;
    } catch { return url; }
}

bot.use(session({
    property: 'session',
    getSessionKey: (ctx) => {
        if (!ctx.from) return null;
        return crypto.createHash('sha256').update(ctx.from.id.toString()).digest('hex');
    }
}));

const queue = fastq.promise(async (task) => {
    return downloadAndSend(task.ctx, task.url, task.isAudio, task.isSoundCloud);
}, 3);

// Auto-Cleaner Storage
setInterval(() => {
    fs.readdir(tempDir, (err, files) => {
        if (err) return;
        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            fs.stat(filePath, (err, stats) => {
                if (!err && (Date.now() - stats.mtimeMs > 60000)) fs.unlink(filePath, () => {});
            });
        });
    });
}, 60000);

// --- CORE ENGINE DOWNLOAD ---
async function downloadAndSend(ctx, url, isAudio = false, isSoundCloud = false) {
    const ext = isAudio ? 'mp3' : 'mp4';
    const filePath = path.join(tempDir, `luna_${crypto.randomBytes(4).toString('hex')}.${ext}`);
    const statusMsg = await ctx.reply(isAudio ? "🎵 Menyiapkan audio..." : "🚀 GAS: Menyiapkan video...");

    try {
        const finalTargetUrl = isSoundCloud ? url : await getRealUrl(url);

        let engineConfig = {
            output: filePath,
            noCheckCertificate: true,
            noPlaylist: true,
            matchFilter: "duration <= 600", 
            addHeader: ['User-Agent:Mozilla/5.0', 'Accept:*/*'],
            noWarnings: true,
            quiet: true,
            socketTimeout: 45 
        };

        if (isSoundCloud) {
            engineConfig.defaultSearch = 'scsearch';
            engineConfig.format = 'bestaudio/best';
            await ytDlp(`scsearch1:${finalTargetUrl}`, engineConfig);
        } else {
            engineConfig.format = isAudio ? 'bestaudio/best' : 'b[ext=mp4]/best[ext=mp4]/best';
            await ytDlp(finalTargetUrl, engineConfig);
        }

        if (fs.existsSync(filePath)) {
            if (isAudio) {
                await ctx.replyWithAudio({ source: filePath }, { caption: "✅ Berhasil!" });
            } else {
                // --- [LOGIKA HANYA VIDEO - TANPA DOCUMENT] ---
                try {
                    // Coba kirim dengan metadata lengkap
                    await ctx.replyWithVideo({ source: filePath }, { 
                        caption: "✅ Berhasil!", 
                        supports_streaming: true 
                    });
                } catch (e) {
                    // Jika gagal (biasanya karena thumbnail), paksa kirim video polosan tanpa opsi tambahan
                    await ctx.replyWithVideo({ source: filePath });
                }
            }
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error("Engine Error:", error.message);
        await ctx.reply("❌ Gagal mengirim video.");
    } finally {
        ctx.deleteMessage(statusMsg.message_id).catch(() => {});
    }
}

// --- HANDLER PESAN ---
bot.on('text', async (ctx) => {
    const msg = ctx.message.text.trim();
    const lowMsg = msg.toLowerCase();
    const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/ig;
    const links = msg.match(urlPattern);

    if (links) {
        queue.push({ ctx, url: links[0], isAudio: links[0].includes('music.youtube.com'), isSoundCloud: false });
        return;
    }

    const keywords = ['play ', 'musik ', 'cari '];
    const matchKeyword = keywords.find(k => lowMsg.startsWith(k));
    if (matchKeyword) {
        const query = msg.slice(matchKeyword.length).trim();
        ctx.reply(`🔎 Mencari "${query}"...`);
        queue.push({ ctx, url: query, isAudio: true, isSoundCloud: true });
        return;
    }

    if (msg === '/start') {
        ctx.reply("🔥 Luna Engine v4.6 Agresif Aktif!\n\n• Mode: Only Video (No Document)\n• Audit RAM: 1 Menit");
    }
});

http.createServer((req, res) => { res.writeHead(200); res.end('Healthy'); }).listen(process.env.PORT || 8000);

bot.launch({ dropPendingUpdates: true }).then(() => console.log("🚀 ENGINE ONLINE - VIDEO ONLY MODE"));
        
