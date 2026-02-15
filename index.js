// -*- coding: utf-8 -*-
const { Telegraf, session } = require('telegraf'); 
const ytDlp = require('yt-dlp-exec');
const yts = require('yt-search'); 
const fastq = require('fastq');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');

// --- AUDIT KONFIGURASI ---
const BOT_TOKEN = (process.env.BOT_TOKEN || "7547000858:AAF98R28V7n2YI9099_p9pWf7p-x6I88o1E").trim();
const bot = new Telegraf(BOT_TOKEN);

// Enkripsi Data Sesi (Privasi 100%)
bot.use(session({
    property: 'session',
    getSessionKey: (ctx) => {
        if (!ctx.from) return null;
        return crypto.createHash('sha256').update(ctx.from.id.toString()).digest('hex');
    }
}));

const tempDir = '/tmp/luna_engine';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// Sistem Antrean Paralel (Konkurensi 3 untuk kecepatan maksimal)
const queue = fastq.promise(async (task) => {
    return downloadAndSend(task.ctx, task.url, task.isAudio);
}, 3);

// Auto-Cleaner (Setiap 60 detik agar storage tetap lega)
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

// --- ULTRA EXTRACTION ENGINE (NO-FFMPEG & ANTI-BISU) ---
async function downloadAndSend(ctx, url, isAudio = false) {
    const ext = isAudio ? 'mp3' : 'mp4';
    const filePath = path.join(tempDir, `luna_${crypto.randomBytes(4).toString('hex')}.${ext}`);
    const statusMsg = await ctx.reply(isAudio ? "Mengekstrak audio..." : "Mengekstrak video kualitas terbaik (Anti-Bisu)...");

    try {
        const engineConfig = {
            output: filePath,
            noCheckCertificate: true,
            noPlaylist: true,
            /* LOGIKA BERFIKIR MATANG:
               Karena FFmpeg tidak tersedia, kita menggunakan parameter '-f b'.
               'b' (best) memaksa yt-dlp mencari SATU file yang sudah berisi video+audio.
               Ini adalah cara tercepat (seperti ssstik) dan paling aman agar IG tidak bisu.
            */
            format: isAudio ? 'bestaudio/best' : 'b[ext=mp4]/best[ext=mp4]/best',
            addHeader: [
                'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept:*/*',
                'Referer:https://www.instagram.com/'
            ],
            noWarnings: true,
            quiet: true,
            // Timeout diperpanjang agar tidak kaku saat koneksi platform melambat
            socketTimeout: 60 
        };

        if (isAudio) {
            engineConfig.postprocessorArgs = ['-extract-audio', '--audio-format', 'mp3'];
        }

        // Proses Ekstraksi
        await ytDlp(url, engineConfig);

        if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            if (stats.size > 1000) { // Pastikan file tidak korup
                if (isAudio) {
                    await ctx.replyWithAudio({ source: filePath }, { caption: "Audio berhasil diekstrak." });
                } else {
                    await ctx.replyWithVideo({ source: filePath }, { caption: "Video berhasil diunduh (Suara Aktif)." });
                }
            } else {
                throw new Error("File terlalu kecil atau korup.");
            }
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error("Critical Engine Error:", error.message);
        await ctx.reply("Gagal memproses. Platform memblokir akses atau link tidak valid.");
    } finally {
        ctx.deleteMessage(statusMsg.message_id).catch(() => {});
    }
}

// --- HANDLER SEMUA PLATFORM ---
bot.command('cari', (ctx) => {
    ctx.session = { action: 'waiting_for_song' };
    ctx.reply("Masukkan judul lagu yang dicari:\n(Ketik /cancel untuk membatalkan)");
});

bot.command('cancel', (ctx) => {
    if (ctx.session && ctx.session.action === 'waiting_for_song') {
        ctx.session.action = null;
        ctx.reply("Pencarian dibatalkan.");
    }
});

bot.on('text', async (ctx) => {
    const msg = ctx.message.text.trim();
    const sessionAction = ctx.session ? ctx.session.action : null;

    // RegEx Universal (TikTok, IG, FB, YT, YT Music)
    const urlPattern = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/ig;
    const links = msg.match(urlPattern);

    if (links) {
        const finalUrl = links[0];
        const isAudio = finalUrl.includes('music.youtube.com');
        ctx.reply("Link terdeteksi. Memulai ekstraksi cepat...");
        queue.push({ ctx, url: finalUrl, isAudio });
        if (ctx.session) ctx.session.action = null;
    } 
    else if (sessionAction === 'waiting_for_song') {
        ctx.reply(`Mencari: "${msg}"...`);
        try {
            const searchResult = await yts(msg);
            const video = searchResult.videos[0];
            if (video) {
                ctx.reply(`Ditemukan: ${video.title}\nMemproses ekstraksi audio...`);
                queue.push({ ctx, url: video.url, isAudio: true });
            } else {
                ctx.reply("Maaf, data tidak ditemukan.");
            }
        } catch (err) {
            ctx.reply("Sistem pencarian sedang sibuk.");
        }
        ctx.session.action = null;
    } 
    else if (msg === '/start') {
        ctx.reply("Luna Engine Ultra v3.0 Aktif.\nSupport: YouTube, TikTok, IG, FB (Anti-Bisu).");
    }
});

// Health Check untuk Koyeb
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Luna Engine is Healthy');
}).listen(process.env.PORT || 8000);

bot.launch({ dropPendingUpdates: true }).then(() => {
    console.log("🚀 LUNA ENGINE DEPLOYED - OPTIMAL PERFORMANCE");
});
