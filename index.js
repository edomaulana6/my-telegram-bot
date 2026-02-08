const { Telegraf } = require('telegraf');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const yts = require('yt-search');

// 1. Inisialisasi Token
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error("❌ ERROR: Variabel BOT_TOKEN tidak ditemukan di panel Koyeb!");
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
let urlDatabase = new Map();

// 2. Pembersihan RAM Otomatis (Setiap 24 Jam)
setInterval(() => {
    urlDatabase.clear();
    console.log("♻️ [SYSTEM] RAM Reset: Database URL telah dibersihkan.");
}, 24 * 60 * 60 * 1000);

const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');

// 3. Logika Penerima Pesan
bot.on('message', async (ctx) => {
    const text = ctx.message.text;
    if (!text) return;

    const match = text.match(urlRegex);
    let targetUrl;
    let displayTitle;

    try {
        if (match) {
            targetUrl = match[0];
            displayTitle = "Media dari Link";
        } else {
            const search = await yts(text);
            const video = search.videos[0];
            if (!video) return ctx.reply("❌ Maaf, lagu/video tidak ditemukan.");
            targetUrl = video.url;
            displayTitle = video.title;
        }

        const linkId = `id_${Date.now()}`;
        urlDatabase.set(linkId, targetUrl);

        await ctx.reply(`🎬 **Hasil:** ${displayTitle}\n\nSilakan pilih format unduhan:`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "📽️ Video (Kualitas Asli)", callback_data: `v|${linkId}` }],
                    [{ text: "🎵 Audio (Semua Platform)", callback_data: `a|${linkId}` }]
                ]
            }
        });
    } catch (e) {
        console.error("Search Error:", e);
        ctx.reply("❌ Terjadi kesalahan saat mencari.");
    }
});

// 4. Logika Eksekusi Download
bot.on('callback_query', async (ctx) => {
    const [type, linkId] = ctx.callbackQuery.data.split('|');
    const url = urlDatabase.get(linkId);

    if (!url) return ctx.answerCbQuery("❌ Sesi kedaluwarsa, kirim ulang link.", { show_alert: true });

    await ctx.answerCbQuery("⏳ Sedang memproses...");
    const statusMsg = await ctx.reply("⏳ Mohon tunggu, sedang mengunduh kualitas terbaik...");
    const timestamp = Date.now();

    if (type === 'v') {
        const vPath = path.join(__dirname, 'temp', `v_${timestamp}.mp4`);
        const cmdV = `yt-dlp -f "bestvideo+bestaudio/best" --merge-output-format mp4 "${url}" -o "${vPath}" --no-playlist`;
        
        exec(cmdV, async (err) => {
            if (!err && fs.existsSync(vPath)) {
                await ctx.replyWithVideo({ source: vPath }, { caption: "✅ Berhasil diunduh." });
                fs.unlinkSync(vPath); // Hapus file dari server
                console.log(`♻️ STORAGE CLEANED: Video ${timestamp} dihapus.`);
            } else {
                ctx.reply("❌ Gagal mendownload video.");
            }
            ctx.deleteMessage(statusMsg.message_id).catch(() => {});
        });

    } else if (type === 'a') {
        const aPath = path.join(__dirname, 'temp', `a_${timestamp}.mp3`);
        // Fix Audio TikTok/GoTube dengan format ba/b
        const cmdA = `yt-dlp -f "ba/b" -x --audio-format mp3 --audio-quality 0 "${url}" -o "${aPath}" --no-playlist`;
        
        exec(cmdA, async (err) => {
            if (!err && fs.existsSync(aPath)) {
                await ctx.replyWithAudio({ source: aPath });
                fs.unlinkSync(aPath); // Hapus file dari server
                console.log(`♻️ STORAGE CLEANED: Audio ${timestamp} dihapus.`);
            } else {
                ctx.reply("❌ Gagal mendownload audio.");
            }
            ctx.deleteMessage(statusMsg.message_id).catch(() => {});
        });
    }
});

// 5. Monitoring Server & Launch
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is Healthy');
}).listen(process.env.PORT || 8080);

bot.launch({ allowedUpdates: ['message', 'callback_query'] })
    .then(() => console.log("✅ BOT ONLINE: Siap melayani link dan judul lagu!"))
    .catch((err) => {
        if (err.message.includes("401")) {
            console.error("❌ LOGIN GAGAL: Token di Koyeb SALAH (Unauthorized).");
        } else {
            console.error("❌ ERROR:", err.message);
        }
    });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
