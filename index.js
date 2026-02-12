const { Telegraf } = require('telegraf');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// KONFIGURASI TOKEN
const BOT_TOKEN = (process.env.BOT_TOKEN || "8521111355:AAHfe4FIdrJHCJA7xy0EgzeK6EIINdhhBYk").trim();
const bot = new Telegraf(BOT_TOKEN);

// Jalur Folder Absolut (Akurasi 100% di Koyeb)
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// --- AUTO-CLEAN (Dihapus setiap 60 detik agar storage 0% overload) ---
setInterval(() => {
    fs.readdir(tempDir, (err, files) => {
        if (err) return;
        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            fs.unlink(filePath, () => {});
        });
    });
}, 60 * 1000);

// Animasi Industrial & Clock Frame
const frames = ["🕛", "🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕙", "🕚"];
function createSolidBar(p, frameIndex, size = "") {
    const P = Math.floor(p / 10);
    const bar = "▓".repeat(P) + "░".repeat(10 - P);
    return `${frames[frameIndex]} **LUNA PROGRESS: ${p}%** ${size}\n**${bar}**`;
}

bot.on('message', async (ctx) => {
    const text = ctx.message.text;
    if (!text) return;

    const match = text.match(/https?:\/\/[^\s]+/);
    if (match) {
        const url = match[0];
        // Mendukung semua platform besar
        const isSocial = /(tiktok\.com|instagram\.com|facebook\.com|fb\.watch|x\.com|twitter\.com|youtu\.be|youtube\.com|threads\.net)/i.test(url);

        if (isSocial) {
            let currentFrame = 0, lastUpdate = 0, fileInfo = "";
            const statusMsg = await ctx.reply("⚙️ **INITIALIZING ENGINE...**\n" + createSolidBar(0, 0));
            
            const fileName = `luna_${Date.now()}.mp4`;
            const vPath = path.join(tempDir, fileName);
            
            // PERINTAH UNIVERSAL DENGAN MASKING (Tembus blokir IG/FB)
            const ls = spawn('./yt-dlp', [
                '-f', 'b[ext=mp4]/bv*[ext=mp4]+ba[ext=m4a]/b/best', // Fix: Cari mp4 tunggal agar tidak butuh FFmpeg
                '--no-check-certificate',
                '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
                '--newline',
                url,
                '-o', vPath
            ]);

            ls.stdout.on('data', (data) => {
                const output = data.toString();
                const sizeMatch = output.match(/(\d+\.\d+MiB)/);
                if (sizeMatch) fileInfo = `[${sizeMatch[0]}]`;

                const matchPercent = output.match(/(\d+(\.\d+)?%)/);
                if (matchPercent) {
                    const percent = parseFloat(matchPercent[0]);
                    const now = Date.now();
                    if (now - lastUpdate > 2000) {
                        currentFrame = (currentFrame + 1) % frames.length;
                        ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, 
                            `⚙️ **LUNA ENGINE PROCESSING**\n` +
                            `${createSolidBar(percent, currentFrame, fileInfo)}\n\n` +
                            `📡 **Status:** Downloading from Cloud...`,
                            { parse_mode: 'Markdown' }
                        ).catch(() => {});
                        lastUpdate = now;
                    }
                }
            });

            ls.on('close', async (code) => {
                if (code === 0 && fs.existsSync(vPath)) {
                    const stats = fs.statSync(vPath);
                    const sizeMB = stats.size / (1024 * 1024);

                    if (sizeMB > 50) {
                        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `❌ **FILE TERLALU BESAR (${sizeMB.toFixed(2)}MB)**\nLimit bot Telegram adalah 50MB.`);
                        if (fs.existsSync(vPath)) fs.unlinkSync(vPath);
                    } else {
                        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "✅ **DOWNLOAD SELESAI!**\n🚀 **Mengirim video...**");
                        try {
                            await ctx.replyWithVideo({ source: vPath });
                        } catch (e) {
                            ctx.reply("❌ Gagal mengirim: Masalah pada jaringan Telegram.");
                        } finally {
                            if (fs.existsSync(vPath)) fs.unlinkSync(vPath);
                            ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
                        }
                    }
                } else {
                    ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "❌ **ENGINE FAILURE**\nInstagram/Facebook memblokir akses atau link salah.");
                    if (fs.existsSync(vPath)) fs.unlinkSync(vPath);
                }
            });
            return;
        }
    }
});

http.createServer((req, res) => { res.end('Luna Engine Online'); }).listen(8000);

async function launchBot() {
    try {
        await bot.launch({ dropPendingUpdates: true });
        console.log("✅ BOT ONLINE - AKURASI 10.000%");
    } catch (err) {
        if (err.response?.error_code === 409) setTimeout(launchBot, 5000); 
        else process.exit(1);
    }
}
launchBot();
