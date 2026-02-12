const { Telegraf } = require('telegraf');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// KONFIGURASI TOKEN
const BOT_TOKEN = (process.env.BOT_TOKEN || "8521111355:AAHfe4FIdrJHCJA7xy0EgzeK6EIINdhhBYk").trim();
const bot = new Telegraf(BOT_TOKEN);

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// --- AUTO-CLEAN (Pembersihan memori setiap 60 detik) ---
setInterval(() => {
    fs.readdir(tempDir, (err, files) => {
        if (err) return;
        files.forEach(file => {
            fs.unlink(path.join(tempDir, file), () => {});
        });
    });
}, 60 * 1000); 

// Animasi Frame & Progress Bar ▓░
const frames = ["🕛", "🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕙", "🕚"];
function createSolidBar(p, frameIndex) {
    const P = Math.floor(p / 10);
    const bar = "▓".repeat(P) + "░".repeat(10 - P);
    return `${frames[frameIndex]} **PROGRESS: ${p}%**\n**${bar}**`;
}

// --- HANDLER PESAN ---
bot.on('message', async (ctx) => {
    const text = ctx.message.text;
    if (!text) return;

    const match = text.match(/https?:\/\/[^\s]+/);
    if (match) {
        const url = match[0];
        const isSocial = /(tiktok\.com|instagram\.com|facebook\.com|fb\.watch|x\.com|twitter\.com|youtu\.be|youtube\.com|threads\.net)/i.test(url);

        if (isSocial) {
            let currentFrame = 0;
            let lastUpdate = 0;
            const statusMsg = await ctx.reply("⚙️ **INITIALIZING ENGINE...**\n" + createSolidBar(0, 0));
            const vPath = path.join(tempDir, `vid_${Date.now()}.mp4`);
            
            // SPAWN YT-DLP UNTUK KECEPATAN & REAL-TIME PROGRESS
            const ls = spawn('./yt-dlp', [
                '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best',
                '--no-check-certificate', 
                '--newline', 
                url, 
                '-o', vPath
            ]);

            ls.stdout.on('data', (data) => {
                const output = data.toString();
                const matchPercent = output.match(/(\d+(\.\d+)?%)/);
                if (matchPercent) {
                    const percent = parseFloat(matchPercent[0]);
                    const now = Date.now();
                    // Throttling 1.5 detik agar aman dari Rate Limit Telegram
                    if (now - lastUpdate > 1500) {
                        currentFrame = (currentFrame + 1) % frames.length;
                        ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, 
                            `⚙️ **LUNA ENGINE PROCESSING**\n` +
                            `${createSolidBar(percent, currentFrame)}\n\n` +
                            `📡 **Status:** Mengunduh media dari Cloud...`,
                            { parse_mode: 'Markdown' }
                        ).catch(() => {});
                        lastUpdate = now;
                    }
                }
            });

            ls.on('close', async (code) => {
                if (code === 0) {
                    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "✅ **COMPLETE!**\n🚀 **Sedang mengirim video...**");
                    await ctx.replyWithVideo({ source: vPath });
                    if (fs.existsSync(vPath)) fs.unlinkSync(vPath);
                    ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
                } else {
                    ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "❌ **ENGINE FAILURE:** Link tidak didukung atau video tidak tersedia.");
                }
            });

            ls.on('error', (err) => {
                console.error("Critical Engine Error:", err.message);
                ctx.reply("❌ Terjadi kesalahan fatal pada mesin pengunduh.");
            });
            return;
        }
    }
});

// KEEP-ALIVE UNTUK KOYEB (PORT 8000)
http.createServer((req, res) => { 
    res.end('Luna Pure Downloader is Healthy'); 
}).listen(8000);

// PROTOKOL STARTUP
async function launchBot() {
    try {
        await bot.launch({ dropPendingUpdates: true });
        console.log("✅ BOT ONLINE - PURE VIDEO DOWNLOADER - AKURASI 10.000%");
    } catch (err) {
        if (err.response?.error_code === 409) {
            setTimeout(launchBot, 5000); 
        } else {
            process.exit(1);
        }
    }
}
launchBot();
