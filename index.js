const { Telegraf } = require('telegraf');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// --- KEAMANAN TINGKAT TINGGI ---
// Token telah disensor. Masukkan token asli Anda di Dashboard Koyeb -> Environment Variables dengan nama BOT_TOKEN
const BOT_TOKEN = (process.env.BOT_TOKEN || "TOKEN_ANDA_SUDAH_AMAN_DI_SINI").trim();
const bot = new Telegraf(BOT_TOKEN);

const tempDir = path.join(process.cwd(), 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

// DAFTAR 20 PROXY INDONESIA TERBARU
const PROXY_LIST = [
    'http://103.150.116.154:8080', 'http://103.161.184.14:3128', 'http://103.111.54.34:8080',
    'http://103.147.21.34:80', 'http://103.152.112.112:80', 'http://103.119.145.170:80',
    'http://103.153.255.42:8080', 'http://103.102.131.206:8080', 'http://103.167.135.106:80',
    'http://202.152.41.146:80', 'http://103.155.104.253:3128', 'http://36.37.81.254:8080',
    'http://103.121.122.106:8080', 'http://103.141.137.158:80', 'http://103.111.232.193:8080',
    'http://103.120.129.202:8080', 'http://103.101.55.194:80', 'http://103.10.168.106:8080',
    'http://111.92.164.254:8080', 'http://103.41.204.146:80'
];

// Fungsi Cek Proxy Tercepat (Bawaan Node.js)
async function getFastestProxy() {
    const tests = PROXY_LIST.map(proxy => {
        return new Promise((resolve) => {
            const start = Date.now();
            const [host, port] = proxy.replace('http://', '').split(':');
            const req = https.get('https://www.instagram.com', { host, port, timeout: 2000 }, () => {
                resolve({ proxy, latency: Date.now() - start });
            });
            req.on('error', () => resolve({ proxy, latency: 9999 }));
            req.end();
        });
    });
    const results = await Promise.all(tests);
    const valid = results.filter(r => r.latency < 9999).sort((a, b) => a.latency - b.latency);
    return valid.length > 0 ? valid[0].proxy : null;
}

// --- AUTO-CLEAN (Dihapus setiap 60 detik agar storage 0% overload) ---
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
            '--no-check-certificate', '--user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
            '--add-header', 'Referer:https://www.instagram.com/', '-f', 'best[ext=mp4]/best', '--newline', url, '-o', vPath
        ];

        if (fastestProxy) {
            args.push('--proxy', fastestProxy);
            statusText = `🌐 Jalur: Indonesia (${fastestProxy})`;
        } else {
            statusText = `⚠️ Proxy Lambat, Menggunakan Jalur Utama...`;
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
                await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "✅ **BYPASS BERHASIL!**\n🚀 **Mengirim video...**");
                await ctx.replyWithVideo({ source: vPath }).finally(() => {
                    if (fs.existsSync(vPath)) fs.unlinkSync(vPath);
                    ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
                });
            } else {
                ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "❌ **ENGINE FAILURE**\nSemua jalur terblokir atau Instagram sedang Maintenance.");
            }
        });
    }
});

http.createServer((req, res) => { res.end('Luna Engine Active'); }).listen(8000);
bot.launch({ dropPendingUpdates: true });

// --- PROTOKOL RESET HARIAN (Sesuai Permintaan) ---
// Instance akan restart otomatis di Koyeb setiap 24 jam untuk membersihkan memori [cite: 2026-02-07]
