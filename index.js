// -*- coding: utf-8 -*-
const { Telegraf, session } = require('telegraf'); // Menambahkan session untuk deteksi input
const ytDlp = require('yt-dlp-exec');
const yts = require('yt-search'); // Library pencarian lagu tanpa cookies
const fastq = require('fastq');
const fs = require('fs');
const path = require('path');
const http = require('http');

// --- AUDIT KONFIGURASI ---
const BOT_TOKEN = (process.env.BOT_TOKEN || "7547000858:AAF98R28V7n2YI9099_p9pWf7p-x6I88o1E").trim();
const bot = new Telegraf(BOT_TOKEN);

// Mengaktifkan session agar bot ingat jika sedang dalam mode "tanya lagu"
bot.use(session());

// Folder sementara untuk Koyeb
const tempDir = '/tmp/luna_engine';
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// --- SISTEM ANTREAN (Worker) ---
const queue = fastq.promise(async (task) => {
    return downloadAndSend(task.ctx, task.url, task.isAudio);
}, 2);

// --- AUTO-CLEANER (Setiap 60 detik) [cite: 2026-02-07] ---
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

// --- DOWNLOAD ENGINE ---
async function downloadAndSend(ctx, url, isAudio = false) {
    const ext = isAudio ? 'mp3' : 'mp4';
    const filePath = path.join(tempDir, `luna_${Date.now()}.${ext}`);
    const statusMsg = await ctx.reply(isAudio ? "⏳ Sedang mencari dan mengunduh lagu..." : "⏳ Sedang diproses dalam antrean...");

    try {
        const options = isAudio ? {
            output: filePath,
            format: 'bestaudio/best',
            extractAudio: true,
            audioFormat: 'mp3',
            noCheckCertificate: true,
            noPlaylist: true
        } : {
            output: filePath,
            format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            noCheckCertificate: true,
            maxFilesize: '100M',
            noPlaylist: true
        };

        await ytDlp(url, options);

        if (fs.existsSync(filePath)) {
            if (isAudio) {
                await ctx.replyWithAudio({ source: filePath }, { caption: "✅ Lagu berhasil diunduh oleh Luna Engine." });
            } else {
                await ctx.replyWithVideo({ source: filePath }, { caption: "✅ Video berhasil diproses oleh Luna Engine." });
            }
            fs.unlinkSync(filePath);
        }
    } catch (error) {
        console.error("Download Error:", error.message);
        await ctx.reply("❌ Gagal: Konten tidak dapat diakses atau terjadi gangguan pada server.");
    } finally {
        ctx.deleteMessage(statusMsg.message_id).catch(() => {});
    }
}

// --- MESSAGE HANDLER ---
bot.command('cari', (ctx) => {
    ctx.session = { action: 'waiting_for_song' };
    ctx.reply("🎵 Lagu apa yang anda cari? Tolong kirimkan judul lagunya.");
});

bot.on('text', async (ctx) => {
    const msg = ctx.message.text;
    const sessionAction = ctx.session ? ctx.session.action : null;

    // 1. Deteksi Jika Pesan Adalah Link Langsung
    if (/https?:\/\/[^\s]+/.test(msg)) {
        const isAudio = msg.includes('music.youtube.com');
        ctx.reply(`✅ Link diterima. Antrean: ${queue.length()}`);
        queue.push({ ctx, url: msg, isAudio });
        if (ctx.session) ctx.session.action = null; // Reset session jika ada
    } 
    // 2. Deteksi Jika Pengguna Sedang Menjawab Pertanyaan "Cari Lagu"
    else if (sessionAction === 'waiting_for_song') {
        ctx.reply(`🔍 Mencari lagu: "${msg}"...`);
        try {
            const searchResult = await yts(msg);
            const video = searchResult.videos[0]; // Ambil hasil paling akurat
            
            if (video) {
                ctx.reply(`✅ Lagu ditemukan: ${video.title}\nMemulai proses unduhan...`);
                queue.push({ ctx, url: video.url, isAudio: true });
            } else {
                ctx.reply("❌ Maaf, lagu tidak ditemukan.");
            }
        } catch (err) {
            ctx.reply("❌ Terjadi kesalahan saat mencari lagu.");
        }
        ctx.session.action = null; // Reset setelah diproses
    } 
    // 3. Respon untuk Perintah Start
    else if (msg === '/start') {
        ctx.reply("Selamat datang di Luna Engine.\n\n- Kirim link video/musik langsung.\n- Ketik /cari untuk mencari lagu berdasarkan judul.");
    }
    // 4. Pesan Biasa (Bot Bisa Membedakan)
    else {
        // Abaikan atau beri respon ringan jika bukan perintah
        console.log(`Pesan biasa terdeteksi: ${msg}`);
    }
});

// --- KOYEB HEALTH CHECK ---
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Luna Engine is Healthy');
}).listen(process.env.PORT || 8000);

bot.launch({ dropPendingUpdates: true }).then(() => {
    console.log("🚀 LUNA ENGINE DEPLOYED ON KOYEB WITH SONG SEARCH");
});
