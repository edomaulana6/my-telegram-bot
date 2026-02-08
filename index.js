const { Telegraf } = require('telegraf');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const yts = require('yt-search');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

// Database internal untuk limit 64 byte & RAM
let urlDatabase = new Map();

// 1. FITUR PEMBERSIH RAM: Reset harian agar bot tidak berat (Setiap 24 Jam)
setInterval(() => {
    urlDatabase.clear();
    console.log("♻️ [SYSTEM] RAM Reset: Database URL telah dibersihkan secara berkala.");
}, 24 * 60 * 60 * 1000);

const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');

// 2. LOGIKA PENERIMA PESAN (LINK ATAU CARI JUDUL)
bot.on('message', async (ctx) => {
    const text = ctx.message.text;
    if (!text) return;

    const match = text.match(urlRegex);
    let targetUrl;
    let displayTitle;

    if (match) {
        // Jika User Kirim Link
        targetUrl = match[0];
        displayTitle = "Media dari Link";
    } else {
        // Jika User Ketik Judul (Pencarian Bebas)
        const search = await yts(text);
        const video = search.videos[0];
        if (!video) return ctx.reply("❌ Lagu/Video tidak ditemukan.");
        targetUrl = video.url;
        displayTitle = video.title;
    }

    const linkId = `id_${Date.now()}`;
    urlDatabase.set(linkId, targetUrl);

    await ctx.reply(`🎬 **Hasil:** ${displayTitle}\n\nSilakan pilih format:`, {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📽️ Video (Kualitas Asli)", callback_data: `v|${linkId}` }],
                [{ text: "🎵 Audio (Semua Platform)", callback_data: `a|${linkId}` }]
            ]
        }
    });
});

// 3. LOGIKA EKSEKUSI (DOWNLOAD & AUTO-CLEAN)
bot.on('callback_query', async (ctx) => {
    const [type, linkId] = ctx.callbackQuery.data.split('|');
    const url = urlDatabase.get(linkId);

    if (!url) return ctx.answerCbQuery("❌ Sesi habis, kirim ulang link.", { show_alert: true });

    await ctx.answerCbQuery("⏳ Proses pengunduhan dimulai...");
    const statusMsg = await ctx.reply("⏳ Sedang memproses kualitas terbaik...");
    const timestamp = Date.now();

    if (type === 'v') {
        const vPath = path.join(__dirname, 'temp', `v_${timestamp}.mp4`);
        // Kualitas Video Terbaik
        const cmdV = `yt-dlp -f "bestvideo+bestaudio/best" --merge-output-format mp4 "${url}" -o "${vPath}" --no-playlist`;
        
        exec(cmdV, async (err) => {
            if (!err && fs.existsSync(vPath)) {
                await ctx.replyWithVideo({ source: vPath });
                // FITUR PEMBERSIH STORAGE (PENTING)
                fs.unlinkSync(vPath); 
                console.log(`♻️ STORAGE CLEANED: Video ${timestamp} dihapus.`);
            } else {
                ctx.reply("❌ Gagal mendownload video.");
            }
            ctx.deleteMessage(statusMsg.message_id).catch(() => {});
        });

    } else if (type === 'a') {
        const aPath = path.join(__dirname, 'temp', `a_${timestamp}.mp3`);
        // FIX AUDIO: Menggunakan "ba/b" agar TikTok & GoTube Lancar
        const cmdA = `yt-dlp -f "ba/b" -x --audio-format mp3 --audio-quality 0 "${url}" -o "${aPath}" --no-playlist`;
        
        exec(cmdA, async (err) => {
            if (!err && fs.existsSync(aPath)) {
                await ctx.replyWithAudio({ source: aPath });
                // FITUR PEMBERSIH STORAGE (PENTING)
                fs.unlinkSync(aPath); 
                console.log(`♻️ STORAGE CLEANED: Audio ${timestamp} dihapus.`);
            } else {
                ctx.reply("❌ Gagal mendownload audio. Pastikan link benar.");
            }
            ctx.deleteMessage(statusMsg.message_id).catch(() => {});
        });
    }
});

// 4. SERVER & BOT LAUNCH
http.createServer((req, res) => { res.end('Bot Aktif'); }).listen(process.env.PORT || 8080);
bot.launch().then(() => console.log("✅ Bot Full Version Aktif & Pembersihan Otomatis Berjalan."));
