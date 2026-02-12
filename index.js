const { Telegraf } = require('telegraf');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// --- KEAMANAN & KONFIGURASI ANTI-CRASH ---
const BOT_TOKEN = (process.env.BOT_TOKEN || "TOKEN_SENSITIVE_DI_SINI").trim();

const bot = new Telegraf(BOT_TOKEN, {
    handlerTimeout: 120000 // Batas tunggu 2 menit
});

// GLOBAL ERROR HANDLER
bot.catch((err, ctx) => {
    console.log(`❌ LUNA ENGINE ERROR: ${err.message}`);
    if (ctx) ctx.reply("⚠️ **Koneksi sangat berat.** Luna sedang mencoba bertahan...").catch(() => {});
});

const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// DAFTAR 5 PROXY INDONESIA TERUJI AKTIF
const PROXY_LIST = [
    'http://103.150.116.154:8080', 
    'http://103.111.54.34:8080',  
    'http://202.152.41.146:80',    
    'http://103.161.184.14:3128',  
    'http://103.120.129.202:8080'  
];

// FUNGSI CEK PROXY TERCEPAT
async function getFastestProxy() {
    return new Promise((resolve) => {
        const globalTimeout = setTimeout(() => resolve(null), 5000);
        const tests = PROXY_LIST.map(proxy => {
            return new Promise((res) => {
                const start = Date.now();
                try {
                    const proxyUrl = new URL(proxy);
                    const options = {
                        host: proxyUrl.hostname,
                        port: proxyUrl.port,
                        path: 'http://www.google.com',
                        method: 'GET',
                        timeout: 2500
                    };
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

// --- AUTO-CLEAN (Pembersihan memori 60 detik) ---
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
        let currentFrame = 0, lastUpdate = 0, statusText = "📡 Mencari Jalur Indonesia Tercepat...";
        const statusMsg = await ctx.reply("⚙️ **INITIALIZING ENGINE...**\n" + createSolidBar(0, 0, statusText));
        const vPath = path.join(tempDir, `luna_${Date.now()}.mp4`);
        
        const fastestProxy = await getFastestProxy();
        const args = [
            '--no-check-certificate',
            '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
            '--add-header', 'Referer:https://www.instagram.com/',
            '-f', 'b[ext=mp4]/bv*[ext=mp4]+ba[ext=m4a]/b/best', // Fix Audio
            '--newline', url, '-o', vPath
        ];

        if (fastestProxy) {
            args.push('--proxy', fastestProxy);
            statusText = `🌐 Jalur: Indonesia (${fastestProxy})`;
        } else {
            statusText = `⚠️ Jalur Utama (Proxy Lemot)`;
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
            const platformName = url.includes('tiktok') ? 'TikTok' : 'Instagram';
            if (code === 0 && fs.existsSync(vPath)) {
                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, `✅ **${platformName.toUpperCase()} BYPASS BERHASIL!**\n🚀 **Mengirim video...**`);
                await ctx.replyWithVideo({ source: vPath }).finally(() => {
                    if (fs.existsSync(vPath)) fs.unlinkSync(vPath);
                    ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
                });
            } else {
                let errorReason = fastestProxy ? "Proxy Indonesia Down/Terblokir" : "IP Utama Terblokir";
                ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, 
                    `❌ **ENGINE FAILURE (${platformName})**\nPenyebab: ${errorReason}.\nSaran: Coba kirim ulang link atau hubungi Admin.`
                );
                if (fs.existsSync(vPath)) fs.unlinkSync(vPath);
            }
        });
    }
});

http.createServer((req, res) => { res.end('Luna Engine Online'); }).listen(8000);
bot.launch({ dropPendingUpdates: true });
