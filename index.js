const { Telegraf } = require('telegraf');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const BOT_TOKEN = (process.env.BOT_TOKEN || "8521111355:AAHfe4FIdrJHCJA7xy0EgzeK6EIINdhhBYk").trim();
const bot = new Telegraf(BOT_TOKEN);

// Gunakan path relatif agar konsisten dengan mkdir -p temp
const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// --- AUTO-CLEAN (Pembersihan setiap 60 detik) ---
setInterval(() => {
    fs.readdir(tempDir, (err, files) => {
        if (err) return;
        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            fs.unlink(filePath, () => {});
        });
    });
}, 60 * 1000);

const frames = ["🕛", "🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕙", "🕚"];
function createSolidBar(p, frameIndex) {
    const P = Math.floor(p / 10);
    const bar = "▓".repeat(P) + "░".repeat(10 - P);
    return `${frames[frameIndex]} **PROGRESS: ${p}%**\n**${bar}**`;
}

bot.on('message', async (ctx) => {
    const text = ctx.message.text;
    if (!text || !/https?:\/\/[^\s]+/.test(text)) return;

    const url = text.match(/https?:\/\/[^\s]+/)[0];
    const isSocial = /(tiktok\.com|instagram\.com|facebook\.com|fb\.watch|x\.com|twitter\.com|youtu\.be|youtube\.com|threads\.net)/i.test(url);

    if (isSocial) {
        let currentFrame = 0;
        let lastUpdate = 0;
        const statusMsg = await ctx.reply("⚙️ **INITIALIZING ENGINE...**\n" + createSolidBar(0, 0));
        
        // Penamaan file yang unik dan aman
        const fileName = `vid_${Date.now()}.mp4`;
        const vPath = path.join(tempDir, fileName);
        
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
                if (now - lastUpdate > 2000) {
                    currentFrame = (currentFrame + 1) % frames.length;
                    ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, 
                        `⚙️ **LUNA ENGINE PROCESSING**\n` +
                        `${createSolidBar(percent, currentFrame)}\n\n` +
                        `📡 **Status:** Downloading...`,
                        { parse_mode: 'Markdown' }
                    ).catch(() => {});
                    lastUpdate = now;
                }
            }
        });

        ls.on('close', async (code) => {
            if (code === 0 && fs.existsSync(vPath)) {
                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "✅ **COMPLETE!**\n🚀 **Sending media...**").catch(() => {});
                
                try {
                    await ctx.replyWithVideo({ source: vPath });
                } catch (err) {
                    console.error("Upload Error:", err.message);
                    ctx.reply("❌ Gagal mengirim video ke Telegram.");
                } finally {
                    if (fs.existsSync(vPath)) fs.unlinkSync(vPath);
                    ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
                }
            } else {
                ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "❌ **ENGINE FAILURE** atau file tidak ditemukan.");
            }
        });
    }
});

http.createServer((req, res) => { res.end('Luna Online'); }).listen(8000);

async function launchBot() {
    try {
        await bot.launch({ dropPendingUpdates: true });
        console.log("✅ BOT ONLINE - STABLE VERSION");
    } catch (err) {
        if (err.response?.error_code === 409) setTimeout(launchBot, 5000); 
        else process.exit(1);
    }
}
launchBot();
