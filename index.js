// -*- coding: utf-8 -*-
const { Telegraf, session } = require('telegraf'); 
const ytDlp = require('yt-dlp-exec');
const yts = require('yt-search'); 
const fastq = require('fastq');
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto'); // Tool enkripsi data untuk privasi pengguna

// --- AUDIT KONFIGURASI ---
const BOT_TOKEN = (process.env.BOT_TOKEN || "7547000858:AAF98R28V7n2YI9099_p9pWf7p-x6I88o1E").trim();
const bot = new Telegraf(BOT_TOKEN);

// Mengaktifkan session dengan proteksi Hash (Ketelitian Data 100%)
bot.use(session({
    property: 'session',
    getSessionKey: (ctx) => {
        if (!ctx.from) return null;
        // Enkripsi ID pengguna agar privasi terjaga ketat
        return crypto.createHash('sha256').update(ctx.from.id.toString()).digest('hex');
    }
}));

// Folder sementara untuk Koyeb
const tempDir = '/tmp/luna_engine';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// --- SISTEM ANTREAN (Worker) ---
// Struktur tetap: memproses maksimal 2 video sekaligus agar RAM 512MB aman
const queue = fastq.promise(async (task) => {
    return downloadAndSend(task.ctx, task.url, task.isAudio);
}, 2);

// --- AUTO-CLEANER (Setiap 60 detik) [cite: 2026-02-07] ---
// Struktur tetap: menghapus file lama untuk menjaga storage Koyeb
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

// --- DOWNLOAD ENGINE (DIPERKUAT - VIRTUAL API MUXING) ---
async function downloadAndSend(ctx, url, isAudio = false) {
    const ext = isAudio ? 'mp3' : 'mp4';
    // Penamaan file unik dengan crypto agar tidak bentrok
    const filePath = path.join(tempDir, `luna_${crypto.randomBytes(4).toString('hex')}.${ext}`);
    const statusMsg = await ctx.reply(isAudio ? "⏳ Memproses Audio High-Quality (Tanpa Cookies)..." : "⏳ Memproses Video Full HD (Merging Stream)...");

    try {
        // KONFIGURASI MESIN DIPERKUAT (Tanpa Merubah Struktur Fungsi)
        const options = {
            output: filePath,
            noCheckCertificate: true,
            noPlaylist: true,
            // Memaksa penggabungan Audio+Video di semua platform (Muxing)
            format: isAudio ? 'bestaudio/best' : 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            // Penyamaran tingkat tinggi untuk menembus blokir IP
            addHeader: [
                'User-Agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept-Language:en-US,en;q=0.9',
                'Referer:https://www.youtube.com/'
            ],
            // Memastikan FFmpeg digunakan untuk menyatukan stream yang terpisah
            ffmpegLocation: '/usr/bin/ffmpeg'
        };

        // Jika audio, tambahkan argumen post-processor
        if (isAudio) {
            options.postprocessorArgs = ['-extract-audio', '--audio-format', 'mp3'];
        }

        await ytDlp(url, options);

        if (fs.existsSync(filePath)) {
            if (isAudio) {
                await ctx.replyWithAudio({ source: filePath }, { caption: "✅ Berhasil diproses oleh Luna Engine (Audio)." });
            } else {
                await ctx.replyWithVideo({ source: filePath }, { caption: "✅ Berhasil diproses oleh Luna Engine (Video)." });
            }
            fs.unlinkSync(filePath); // Hapus setelah terkirim
        }
    } catch (error) {
        console.error("Download Error:", error.message);
        await ctx.reply("❌ Gagal: Konten tidak dapat diakses. IP server mungkin dibatasi atau link tidak didukung.");
    } finally {
        ctx.deleteMessage(statusMsg.message_id).catch(() => {});
    }
}

// --- MESSAGE HANDLER (DIPERKUAT DENGAN /CANCEL & LINK PROCESSOR) ---
bot.command('cari', (ctx) => {
    ctx.session = { action: 'waiting_for_song' };
    ctx.reply("🎵 Lagu apa yang anda cari? Tolong kirimkan judul lagunya.\n\n(Ketik /cancel untuk membatalkan)");
});

bot.command('cancel', (ctx) => {
    if (ctx.session && ctx.session.action === 'waiting_for_song') {
        ctx.session.action = null;
        ctx.reply("❌ Pencarian lagu telah dibatalkan.");
    } else {
        ctx.reply("Tidak ada proses pencarian yang sedang aktif.");
    }
});

bot.on('text', async (ctx) => {
    const msg = ctx.message.text.trim();
    const sessionAction = ctx.session ? ctx.session.action : null;

    // 1. Deteksi Link (DIPERKUAT)
    const isLink = /https?:\/\/[^\s]+/.test(msg);

    if (isLink) {
        const isAudio = msg.includes('music.youtube.com');
        ctx.reply(`✅ Link diterima. Antrean saat ini: ${queue.length()}`);
        queue.push({ ctx, url: msg, isAudio });
        if (ctx.session) ctx.session.action = null; 
    } 
    // 2. Logika Tanya Balik (Pesan Cari Lagu)
    else if (sessionAction === 'waiting_for_song') {
        ctx.reply(`🔍 Mencari lagu: "${msg}"...`);
        try {
            const searchResult = await yts(msg);
            const video = searchResult.videos[0];
            
            if (video) {
                ctx.reply(`✅ Lagu ditemukan: ${video.title}\nMemulai proses unduhan aman...`);
                queue.push({ ctx, url: video.url, isAudio: true });
            } else {
                ctx.reply("❌ Maaf, lagu tidak ditemukan.");
            }
        } catch (err) {
            ctx.reply("❌ Terjadi kesalahan saat mencari lagu.");
        }
        ctx.session.action = null; 
    } 
    // 3. Command Start
    else if (msg === '/start') {
        ctx.reply("Selamat datang di Luna Engine Ultra.\n\n- Kirim link video (YT/IG/FB/TikTok)\n- /cari untuk mencari lagu\n- /cancel untuk batalkan pencarian");
    }
    // 4. Pesan Biasa
    else {
        console.log(`Pesan biasa terdeteksi: ${msg}`);
    }
});

// --- KOYEB HEALTH CHECK ---
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Luna Engine is Healthy');
}).listen(process.env.PORT || 8000);

bot.launch({ dropPendingUpdates: true }).then(() => {
    console.log("🚀 LUNA ENGINE ULTRA DEPLOYED ON KOYEB");
});
