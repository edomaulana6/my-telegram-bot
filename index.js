// -*- coding: utf-8 -*-
const { Telegraf } = require('telegraf');
const ytDlp = require('yt-dlp-exec');
const fastq = require('fastq');
const fs = require('fs');
const path = require('path');
const http = require('http');

// --- AUDIT KONFIGURASI ---
const BOT_TOKEN = (process.env.BOT_TOKEN || "7547000858:AAF98R28V7n2YI9099_p9pWf7p-x6I88o1E").trim();
const bot = new Telegraf(BOT_TOKEN);

// Folder sementara untuk Koyeb
const tempDir = '/tmp/luna_engine';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// --- SISTEM ANTREAN (Worker) ---
// Memproses maksimal 2 video sekaligus agar RAM 512MB tidak meledak
const queue = fastq.promise(async (task) => {
    return downloadAndSend(task.ctx, task.url);
}, 2);

// --- AUTO-CLEANER (Setiap 60 detik) [cite: 2026-02-07] ---
setInterval(() => {
    fs.readdir(tempDir, (err, files) => {
        if (err) return;
        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            // Hanya hapus file yang sudah berumur lebih dari 1 menit
            fs.stat(filePath, (err, stats) => {
                if (!err && (Date.now() - stats.mtimeMs > 60000)) {
                    fs.unlink(filePath, () => {});
                }
            });
        });
    });
}, 60000);

// --- DOWNLOAD ENGINE ---
async function downloadAndSend(ctx, url) {
    const vPath = path.join(tempDir, `luna_${Date.now()}.mp4`);
    const statusMsg = await ctx.reply("⏳ Sedang diproses dalam antrean...");

    try {
        await ytDlp(url, {
            output: vPath,
            format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            noCheckCertificate: true,
            maxFilesize: '100M', // Batas aman untuk free tier Koyeb
            noPlaylist: true
        });

        if (fs.existsSync(vPath)) {
            await ctx.replyWithVideo({ source: vPath }, { caption: "✅ Berhasil diproses oleh Luna Engine." });
            fs.unlinkSync(vPath); // Hapus setelah terkirim
        }
    } catch (error) {
        console.error("Download Error:", error.message);
        await ctx.reply("❌ Gagal: Video terlalu besar (>100MB) atau link tidak didukung.");
    } finally {
        ctx.deleteMessage(statusMsg.message_id).catch(() => {});
    }
}

// --- MESSAGE HANDLER ---
bot.on('text', async (ctx) => {
    const url = ctx.message.text;
    if (/https?:\/\/[^\s]+/.test(url)) {
        const pos = queue.length();
        ctx.reply(`✅ Link diterima. Antrean saat ini: ${pos}`);
        queue.push({ ctx, url });
    } else if (url === '/start') {
        ctx.reply("Selamat datang di Luna Engine. Kirimkan link video untuk mendownload.");
    }
});

// --- KOYEB HEALTH CHECK ---
// Tanpa ini, Koyeb akan menganggap bot 'Dead' dan melakukan restart paksa.
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Luna Engine is Healthy');
}).listen(process.env.PORT || 8000);

bot.launch({ dropPendingUpdates: true }).then(() => {
    console.log("🚀 LUNA ENGINE DEPLOYED ON KOYEB");
});
