const { Telegraf } = require('telegraf');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const BOT_TOKEN = (process.env.BOT_TOKEN || "TOKEN_SENSITIVE_DI_SINI").trim();
const bot = new Telegraf(BOT_TOKEN, { handlerTimeout: 180000 });

const ffmpegPath = path.join(process.cwd(), 'ffmpeg');
const ytdlpPath = path.join(process.cwd(), 'yt-dlp');

// --- AUDIT BINARY ---
function syncPermissions() {
    try {
        if (fs.existsSync(ytdlpPath)) execSync(`chmod +x ${ytdlpPath}`);
        if (fs.existsSync(ffmpegPath)) execSync(`chmod +x ${ffmpegPath}`);
        console.log("✅ Engine Guard: Permissions Synced.");
    } catch (err) {
        console.log("⚠️ Permission Error: " + err.message);
    }
}

syncPermissions();

bot.catch((err, ctx) => {
    console.log(`❌ LUNA ERROR: ${err.message}`);
});

const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// PROXY INDONESIA
const PROXY_LIST = [
    'http://103.150.116.154:8080', 'http://103.111.54.34:8080',  
    'http://202.152.41.146:80', 'http://103.161.184.14:3128',  
    'http://103.120.129.202:8080'  
];

async function getFastestProxy() {
    return new Promise((resolve) => {
        const globalTimeout = setTimeout(() => resolve(null), 4000);
        const tests = PROXY_LIST.map(proxy => {
            return new Promise((res) => {
                const start = Date.now();
                try {
                    const proxyUrl = new URL(proxy);
                    const options = { host: proxyUrl.hostname, port: proxyUrl.port, path: 'http://www.google.com', method: 'GET', timeout: 2000 };
                    const req = http.request(options, () => res({ proxy, latency: Date.now() - start }));
                    req.on('error', () => res({ proxy, latency: 9999 }));
                    req.on('timeout', () => { req.destroy(); res({ proxy, latency: 9999 }); });
                    req.end();
                } catch (e) { res({ proxy, latency: 9999 }); }
            });
        });
        Promise.all(tests).then(results => {
            clearTimeout(globalTimeout);
            const valid = results.filter(r => r.latency < 9999).sort((a, b) => a.latency - b.latency);
            resolve(valid.length > 0 ? valid[0].proxy : null);
        });
    });
}

// AUTO-CLEAN [cite: 2026-02-07]
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
        let currentFrame = 0, lastUpdate = 0;
        const statusMsg = await ctx.reply("⚙️ **INITIALIZING ENGINE...**\n" + createSolidBar(0, 0, "📡 Jalur Indonesia..."));
        const vPath = path.join(tempDir, `luna_${Date.now()}.mp4`);
        
        const fastestProxy = await getFastestProxy();
        syncPermissions();

        const args = [
            '--no-check-certificate',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            '--ffmpeg-location', ffmpegPath, 
            '-f', 'bestvideo+bestaudio/best',
            '--merge-output-format', 'mp4',
            '--newline', url, '-o', vPath
        ];

        if (fastestProxy) args.push('--proxy', fastestProxy);

        const ls = spawn(ytdlpPath, args);

        ls.stdout.on('data', (data) => {
            const output = data.toString();
            const matchPercent = output.match(/(\d+(\.\d+)?%)/);
            if (matchPercent) {
                const percent = parseFloat(matchPercent[0]);
                const now = Date.now();
                if (now - lastUpdate > 2500) {
                    currentFrame = (currentFrame + 1) % frames.length;
                    ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, 
                        `⚙️ **LUNA ENGINE PROCESSING**\n` + createSolidBar(percent, currentFrame, "🧵 Menjahit Audio..."),
                        { parse_mode: 'Markdown' }
                    ).catch(() => {});
                    lastUpdate = now;
                }
            }
        });

        ls.on('close', async (code) => {
            if (code === 0 && fs.existsSync(vPath)) {
                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "✅ **AUDIO MERGE BERHASIL!**");
                await ctx.replyWithVideo({ source: vPath }).finally(() => {
                    if (fs.existsSync(vPath)) fs.unlinkSync(vPath);
                    ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
                });
            } else {
                ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "❌ **CRITICAL ERROR**\nPastikan video tidak diprivat.");
                if (fs.existsSync(vPath)) fs.unlinkSync(vPath);
            }
        });
    }
});

http.createServer((req, res) => { res.end('Luna Engine Online'); }).listen(8000);

// --- MEMBERSIHKAN KONFLIK SEBELUM JALAN ---
bot.telegram.deleteWebhook().then(() => {
    console.log("🚀 Webhook Deleted. Starting Polling...");
    bot.launch({ dropPendingUpdates: true });
});
