// -*- coding: utf-8 -*-
const { Telegraf, session } = require('telegraf'); 
const { exec } = require('child_process'); // Gunakan child_process agar tidak bisa dibantah sistem
const fastq = require('fastq');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const fetch = require('node-fetch');
const util = require('util');
const execPromise = util.promisify(exec);

const BOT_TOKEN = process.env.BOT_TOKEN || "MASUKKAN_TOKEN_BOT_ANDA_DI_SINI";
const bot = new Telegraf(BOT_TOKEN);
const tempDir = '/tmp/luna_engine';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// --- AUDIT RAM 1 MENIT ---
setInterval(() => {
    const used = process.memoryUsage();
    console.log(`📊 [AUDIT RAM] RSS: ${Math.round(used.rss / 1024 / 1024)}MB`);
    if (global.gc && used.rss > 400 * 1024 * 1024) global.gc();
}, 60000);

async function getRealUrl(url) {
    try {
        const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0' } });
        let finalUrl = res.url;
        if (finalUrl.includes('facebook.com/share/r/')) finalUrl = finalUrl.replace('share/r/', 'reels/');
        return finalUrl;
    } catch { return url; }
}

const queue = fastq.promise(async (task) => {
    return downloadAndSend(task.ctx, task.url, task.isAudio, task.isSoundCloud);
}, 3);

// --- CORE ENGINE (MANUAL BYPASS) ---
async function downloadAndSend(ctx, url, isAudio = false, isSoundCloud = false) {
    const ext = isAudio ? 'mp3' : 'mp4';
    const filePath = path.join(tempDir, `luna_${crypto.randomBytes(4).toString('hex')}.${ext}`);
    const statusMsg = await ctx.reply(isAudio ? "🎵 Menyiapkan audio..." : "🚀 HARD-BYPASS: Menyiapkan video...");

    try {
        const finalTargetUrl = isSoundCloud ? url : await getRealUrl(url);
        
        // --- LOGIKA AGRESIF: MEMANGGIL BINARY SISTEM SECARA LANGSUNG ---
        // Kita tidak pakai library yt-dlp-exec lagi untuk eksekusi agar tidak salah path
        const binary = "/usr/local/bin/yt-dlp";
        const format = isAudio ? "bestaudio/best" : "b[ext=mp4]/best[ext=mp4]/best";
        const cmd = `${binary} "${finalTargetUrl}" -o "${filePath}" --no-check-certificate --no-playlist --format "${format}" --socket-timeout 45 --no-warnings --quiet`;

        console.log(`🛠️ EXECUTING: ${cmd}`);
        await execPromise(cmd);

        if (fs.existsSync(filePath)) {
            const options = { caption: "✅ Berhasil!", supports_streaming: true };
            if (isAudio) {
                await ctx.replyWithAudio({ source: filePath }, options);
            } else {
                await ctx.replyWithVideo({ source: filePath }, options).catch(async () => {
                    await ctx.replyWithVideo({ source: filePath });
                });
            }
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error("Engine Error:", error.message);
        await ctx.reply("❌ Gagal. Link mati atau proteksi platform terlalu kuat.");
    } finally {
        ctx.deleteMessage(statusMsg.message_id).catch(() => {});
    }
}

bot.on('text', async (ctx) => {
    const msg = ctx.message.text.trim();
    const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/ig;
    const links = msg.match(urlPattern);

    if (links) {
        queue.push({ ctx, url: links[0], isAudio: links[0].includes('music.youtube.com'), isSoundCloud: false });
        return;
    }

    if (msg.toLowerCase().startsWith('play ')) {
        const query = msg.slice(5).trim();
        ctx.reply(`🔎 Mencari "${query}"...`);
        queue.push({ ctx, url: query, isAudio: true, isSoundCloud: true });
        return;
    }

    if (msg === '/start') ctx.reply("🔥 Luna Engine v4.8 HARD-BYPASS Aktif!\n\nMemaksa penggunaan sistem binary terbaru.");
});

http.createServer((req, res) => { res.writeHead(200); res.end('Healthy'); }).listen(process.env.PORT || 8000);
bot.launch({ dropPendingUpdates: true });
                                                 
