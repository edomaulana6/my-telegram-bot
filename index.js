const { Telegraf } = require('telegraf');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');
const util = require('util');
const execPromise = util.promisify(exec);
const core = require('./plugins/gemini3'); 

// KONFIGURASI TOKEN
const BOT_TOKEN = (process.env.BOT_TOKEN || "8521111355:AAHfe4FIdrJHCJA7xy0EgzeK6EIINdhhBYk").trim();
const bot = new Telegraf(BOT_TOKEN);

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

// --- FITUR PEMBERSIH MEMORI (Daily Reset & Auto-Clean) ---
setInterval(() => {
    fs.readdir(tempDir, (err, files) => {
        if (err) return;
        for (const file of files) {
            fs.unlink(path.join(tempDir, file), (err) => {
                if (!err) console.log(`🗑️ File lama dihapus: ${file}`);
            });
        }
    });
}, 24 * 60 * 60 * 1000);

// --- HANDLER PESAN & DOWNLOADER AIO ---
bot.on('message', async (ctx) => {
    const text = ctx.message.text;
    if (!text) return;

    const match = text.match(/https?:\/\/[^\s]+/);
    if (match) {
        const url = match[0];
        const isSocial = /(tiktok\.com|instagram\.com|facebook\.com|fb\.watch|x\.com|twitter\.com|youtu\.be|youtube\.com|threads\.net)/i.test(url);

        if (isSocial) {
            await ctx.reply("🔍 Memproses media dengan Luna Engine...");
            try {
                // EKSTRAK METADATA MENGGUNAKAN YT-DLP
                const { stdout } = await execPromise(`yt-dlp --dump-json --flat-playlist --no-check-certificate "${url}"`);
                const info = JSON.parse(stdout);

                // LOGIKA FOTO (Slide/Single)
                let photoList = [];
                if (info.entries) {
                    photoList = info.entries.map(e => e.url || e.thumbnail).filter(u => u);
                } else if (info.thumbnails && !info.duration) {
                    photoList = [info.thumbnails[info.thumbnails.length - 1].url];
                }

                if (photoList.length > 0 && !info.duration) {
                    return core.handleMain(ctx, photoList);
                }

                // LOGIKA VIDEO
                const vPath = path.join(tempDir, `vid_${Date.now()}.mp4`);
                await execPromise(`yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best" "${url}" -o "${vPath}"`);
                await ctx.replyWithVideo({ source: vPath });
                return fs.unlinkSync(vPath);

            } catch (e) {
                console.error("Engine Error:", e.message);
                return core.handleMain(ctx); // Fallback ke Gemini jika downloader gagal
            }
        }
    }
    return core.handleMain(ctx);
});

// HANDLER NAVIGASI FOTO
bot.action(/^(next|prev)_/, (ctx) => core.handlePagination(ctx));

// KEEP-ALIVE UNTUK KOYEB (PORT 8000)
http.createServer((req, res) => { 
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('Luna Engine is Healthy'); 
}).listen(8000, '0.0.0.0', () => {
    console.log("✅ Web Server Aktif di Port 8000");
});

// --- PROTOKOL ANTI-BOT HANTU (FORCE START) ---
async function launchBot() {
    try {
        // dropPendingUpdates: true membersihkan "hantu" pesan lama
        await bot.launch({ dropPendingUpdates: true });
        console.log("✅ BOT ONLINE - SESI BERHASIL DIBERSIHKAN");
    } catch (err) {
        if (err.response && err.response.error_code === 409) {
            console.log("⚠️ Konflik Sesi (409) Terdeteksi. Menunggu 10 detik untuk Force Kill...");
            setTimeout(launchBot, 10000); 
        } else {
            console.error("❌ Gagal Startup:", err.message);
            process.exit(1);
        }
    }
}

launchBot();

// Graceful stop saat restart server
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
