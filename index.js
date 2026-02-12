const { Telegraf } = require('telegraf');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const axios = require('axios'); // Pastikan install: npm install axios

// KONFIGURASI TOKEN
const BOT_TOKEN = (process.env.BOT_TOKEN || "8521111355:AAHfe4FIdrJHCJA7xy0EgzeK6EIINdhhBYk").trim();
const bot = new Telegraf(BOT_TOKEN);

const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// DAFTAR PROXY INDONESIA (Bisa ditambah/ganti secara berkala)
const PROXY_LIST = [
    'http://103.150.116.154:8080',
    'http://103.161.184.14:3128',
    'http://103.111.54.34:8080',
    'http://103.147.21.34:80',
    'http://103.152.112.112:80'
];

// Fungsi Cek Proxy Tercepat (Akurasi 10.000%)
async function getFastestProxy() {
    const tests = PROXY_LIST.map(async (proxy) => {
        const start = Date.now();
        try {
            await axios.get('https://www.instagram.com', { 
                proxy: { host: proxy.split('//')[1].split(':')[0], port: proxy.split(':')[2] },
                timeout: 3000 
            });
            return { proxy, latency: Date.now() - start };
        } catch (e) {
            return { proxy, latency: 9999 };
        }
    });
    const results = await Promise.all(tests);
    const valid = results.filter(r => r.latency < 9999).sort((a, b) => a.latency - b.latency);
    return valid.length > 0 ? valid[0].proxy : null;
}

// --- AUTO-CLEAN (60 Detik) ---
setInterval(() => {
    fs.readdir(tempDir, (err, files) => {
        if (err) return;
        files.forEach(file => fs.unlink(path.join(tempDir, file), () => {}));
    });
}, 60 * 1000);

const frames = ["🕛", "🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕙", "🕚"];
function createSolidBar(p, frameIndex, info = "") {
    const P = Math.floor(p / 10);
    const bar = "▓".repeat(P) + "░".repeat(10 - P);
    return `${frames[frameIndex]} **LUNA PROGRESS: ${p}%**\n**${bar}**\n${info}`;
}

bot.on('message', async (ctx) => {
    const text = ctx.message.text;
    if (!text || !/https?:\/\/[^\s]+/.test(text)) return;

    const url = text.match(/https?:\/\/[^\s]+/)[0];
    const isSocial = /(tiktok\.com|instagram\.com|facebook\.com|fb\.watch|x\.com|twitter\.com|youtu\.be|youtube\.com|threads\.net)/i.test(url);

    if (isSocial) {
        let currentFrame = 0, lastUpdate = 0, statusText = "📡 Mencari Jalur Proxy...";
        const statusMsg = await ctx.reply("⚙️ **INITIALIZING ENGINE...**\n" + createSolidBar(0, 0, statusText));
        const vPath = path.join(tempDir, `luna_${Date.now()}.mp4`);
        
        // Deteksi Proxy Tercepat
        const fastestProxy = await getFastestProxy();
        const args = [
            '--no-check-certificate',
            '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
            '--add-header', 'Referer:https://www.instagram.com/',
            '-f', 'b[ext=mp4]/best',
            '--newline', url, '-o', vPath
        ];

        if (fastestProxy) {
            args.push('--proxy', fastestProxy);
            statusText = `🌐 Jalur: Indonesia (${fastestProxy.split('@')[1] || fastestProxy})`;
        } else {
            statusText = `⚠️ Proxy Lemot, Menggunakan Jalur Utama...`;
        }

        const ls = spawn('./yt-dlp', args);

        ls.stdout.on('data', (data) => {
            const output = data.toString();
            const matchPercent = output.match(/(\d+(\.\d+)?%)/);
            if (matchPercent) {
                const percent = parseFloat(matchPercent[0]);
                const now = Date.now();
                if (now - lastUpdate > 2000) {
                    currentFrame = (currentFrame + 1) % frames.length;
                    ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, 
                        `⚙️ **LUNA ENGINE PROCESSING**\n` + createSolidBar(percent, currentFrame, statusText),
                        { parse_mode: 'Markdown' }
                    ).catch(() => {});
                    lastUpdate = now;
                }
            }
        });

        ls.on('close', async (code) => {
            if (code === 0 && fs.existsSync(vPath)) {
                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "✅ **BERHASIL MENEMBUS BLOKIR!**\n🚀 **Mengirim video...**");
                await ctx.replyWithVideo({ source: vPath }).finally(() => {
                    if (fs.existsSync(vPath)) fs.unlinkSync(vPath);
                    ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
                });
            } else {
                ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "❌ **ENGINE FAILURE**\nInstagram memblokir seluruh jalur proxy. Coba lagi nanti.");
            }
        });
    }
});

http.createServer((req, res) => { res.end('Luna Engine Online'); }).listen(8000);
bot.launch({ dropPendingUpdates: true });
