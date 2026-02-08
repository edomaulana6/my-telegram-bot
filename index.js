const { Telegraf } = require('telegraf');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const BOT_TOKEN = process.env.BOT_TOKEN;
const bot = new Telegraf(BOT_TOKEN);

// Database internal untuk menangani limit 64 byte Telegram
const urlDatabase = new Map();

const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

if (!fs.existsSync('./temp')) fs.mkdirSync('./temp');

// 1. Menerima Link (Pendek maupun Panjang)
bot.on('message', async (ctx) => {
    const text = ctx.message.text;
    if (!text || !text.match(urlRegex)) return;

    const targetUrl = text.match(urlRegex)[0];
    const linkId = `id_${Date.now()}`; 
    
    // Simpan URL asli ke gudang memori agar tombol tidak overload
    urlDatabase.set(linkId, targetUrl);

    await ctx.reply("🎬 **Media Berhasil Dideteksi!**\nSilakan pilih format unduhan di bawah ini:", {
        reply_markup: {
            inline_keyboard: [
                [{ text: "📽️ Video (Kualitas Asli)", callback_data: `v|${linkId}` }],
                [{ text: "🎵 Audio (MP3 320kbps)", callback_data: `a|${linkId}` }]
            ]
        }
    });
});

// 2. Memproses Klik pada Tombol
bot.on('callback_query', async (ctx) => {
    const data = ctx.callbackQuery.data;
    const [type, linkId] = data.split('|');
    const url = urlDatabase.get(linkId);

    if (!url) {
        return ctx.answerCbQuery("❌ Sesi habis. Silakan kirim ulang link Anda.", { show_alert: true });
    }

    await ctx.answerCbQuery("⏳ Memulai pengunduhan...");
    const statusMsg = await ctx.reply("⏳ Sedang memproses file kualitas tinggi, mohon tunggu...");

    const timestamp = Date.now();
    
    if (type === 'v') {
        const vPath = path.join(__dirname, 'temp', `v_${timestamp}.mp4`);
        // Command yt-dlp untuk kualitas VIDEO tertinggi
        const cmdV = `yt-dlp -f "bestvideo+bestaudio/best" --merge-output-format mp4 "${url}" -o "${vPath}" --no-playlist`;
        
        exec(cmdV, async (err) => {
            if (!err && fs.existsSync(vPath)) {
                await ctx.replyWithVideo({ source: vPath }, { caption: "✅ Video Berhasil Diunduh (Kualitas Asli)" });
                if (fs.existsSync(vPath)) fs.unlinkSync(vPath);
            } else {
                ctx.reply("❌ Gagal mengunduh Video.");
            }
            ctx.deleteMessage(statusMsg.message_id).catch(() => {});
        });

    } else if (type === 'a') {
        const aPath = path.join(__dirname, 'temp', `a_${timestamp}.mp3`);
        // Command yt-dlp untuk kualitas AUDIO tertinggi (320kbps)
        const cmdA = `yt-dlp -f "ba" -x --audio-format mp3 --audio-quality 0 "${url}" -o "${aPath}" --no-playlist`;
        
        exec(cmdA, async (err) => {
            if (!err && fs.existsSync(aPath)) {
                await ctx.replyWithAudio({ source: aPath }, { title: "High_Quality_Audio" });
                if (fs.existsSync(aPath)) fs.unlinkSync(aPath);
            } else {
                ctx.reply("❌ Gagal mengunduh Audio.");
            }
            ctx.deleteMessage(statusMsg.message_id).catch(() => {});
        });
    }
});

// Server dummy agar tetap 'Healthy' di Koyeb
http.createServer((req, res) => { res.end('Bot is Running'); }).listen(process.env.PORT || 8080);

bot.launch().then(() => console.log("✅ Bot Aktif & Siap Melayani Link Panjang/Pendek"));
