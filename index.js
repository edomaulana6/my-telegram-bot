// -*- coding: utf-8 -*-
const { Telegraf, session } = require('telegraf'); 
const ytDlp = require('yt-dlp-exec');
const fastq = require('fastq');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

// --- PENGATURAN TOKEN (SANGAT RAHASIA) ---
// Sangat disarankan memasukkan token di 'Environment Variables' Koyeb dengan nama BOT_TOKEN
const BOT_TOKEN = process.env.BOT_TOKEN || "MASUKKAN_TOKEN_BOT_ANDA_DI_SINI";
const bot = new Telegraf(BOT_TOKEN);

// Enkripsi Data Sesi
bot.use(session({
    property: 'session',
    getSessionKey: (ctx) => {
        if (!ctx.from) return null;
        return crypto.createHash('sha256').update(ctx.from.id.toString()).digest('hex');
    }
}));

const tempDir = '/tmp/luna_engine';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// Sistem Antrean Paralel (Konkurensi 3)
const queue = fastq.promise(async (task) => {
    return downloadAndSend(task.ctx, task.url, task.isAudio, task.isSoundCloud);
}, 3);

// Auto-Cleaner Storage (Setiap 60 detik)
setInterval(() => {
    fs.readdir(tempDir, (err, files) => {
        if (err) return;
        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            fs.stat(filePath, (err, stats) => {
                if (!err && (Date.now() - stats.mtimeMs > 60000)) {
                    fs.unlink(filePath, () => {});
                }
            });
        });
    });
}, 60000);

// --- ULTRA EXTRACTION ENGINE ---
async function downloadAndSend(ctx, url, isAudio = false, isSoundCloud = false) {
    const ext = isAudio ? 'mp3' : 'mp4';
    const filePath = path.join(tempDir, `luna_${crypto.randomBytes(4).toString('hex')}.${ext}`);
    const statusMsg = await ctx.reply(isAudio ? "🎵 Menyiapkan audio..." : "🎬 Menyiapkan video (Anti-Bisu)...");

    try {
        let engineConfig = {
            output: filePath,
            noCheckCertificate: true,
            noPlaylist: true,
            /* Filter Durasi: Maksimal 600 detik (10 menit) agar Koyeb tidak berat */
            matchFilter: "duration <= 600", 
            addHeader: [
                'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept:*/*',
                'Referer:https://www.google.com/'
            ],
            noWarnings: true,
            quiet: true,
            socketTimeout: 60 
        };

        if (isSoundCloud) {
            engineConfig.defaultSearch = 'scsearch';
            engineConfig.format = 'bestaudio/best';
            url = `scsearch1:${url}`;
        } else {
            engineConfig.format = isAudio ? 'bestaudio/best' : 'b[ext=mp4]/best[ext=mp4]/best';
        }

        await ytDlp(url, engineConfig);

        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size > 1000) {
                if (isAudio) {
                    await ctx.replyWithAudio({ source: filePath }, { caption: "✅ Berhasil diekstrak." });
                } else {
                    await ctx.replyWithVideo({ source: filePath }, { caption: "✅ Berhasil diunduh." });
                }
            } else {
                throw new Error("File tidak valid.");
            }
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error("Engine Error:", error.message);
        await ctx.reply("❌ Gagal. Platform memblokir atau durasi terlalu panjang (Max 10 Menit).");
    } finally {
        ctx.deleteMessage(statusMsg.message_id).catch(() => {});
    }
}

// --- HANDLER PESAN ---
bot.on('text', async (ctx) => {
    const msg = ctx.message.text.trim();
    const lowMsg = msg.toLowerCase();

    // 1. Deteksi Link Otomatis
    const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/ig;
    const links = msg.match(urlPattern);

    if (links) {
        const finalUrl = links[0];
        const isAudio = finalUrl.includes('music.youtube.com');
        queue.push({ ctx, url: finalUrl, isAudio, isSoundCloud: false });
        return;
    }

    // 2. Filter Pesan (Play/Musik/Cari) tanpa Command
    const keywords = ['play ', 'musik ', 'cari '];
    const matchKeyword = keywords.find(k => lowMsg.startsWith(k));

    if (matchKeyword) {
        const query = msg.slice(matchKeyword.length).trim();
        if (query) {
            ctx.reply(`🔎 Mencari "${query}" di SoundCloud...`);
            queue.push({ ctx, url: query, isAudio: true, isSoundCloud: true });
        }
        return;
    }

    if (msg === '/start') {
        ctx.reply("Luna Engine Ultra v4.1 Aktif.\n\n• Kirim link media sosial untuk download.\n• Ketik 'play [judul]' untuk cari lagu.");
    }
});

// Health Check untuk Koyeb
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Luna Engine is Healthy');
}).listen(process.env.PORT || 8000);

bot.launch({ dropPendingUpdates: true }).then(() => {
    console.log("🚀 LUNA ENGINE DEPLOYED - SECURE MODE");
});
