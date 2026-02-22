const { Bot, InputFile } = require("grammy");
const { execa } = require("execa"); // Pastikan menggunakan kurung kurawal
const fs = require("fs-extra");
const path = require("path");
const http = require("http");

// 1. Inisialisasi Bot dengan Pembersihan Token
const token = process.env.BOT_TOKEN ? process.env.BOT_TOKEN.replace(/['"]+/g, '').trim() : null;
if (!token) {
    console.error("Kesalahan Fatal: BOT_TOKEN tidak ditemukan!");
    process.exit(1);
}
const bot = new Bot(token);

// 2. Mini Web Server untuk Health Check Koyeb (Port 8000)
const PORT = process.env.PORT || 8000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running... Alhamdulillah');
}).listen(PORT, () => {
    console.log(`Health Check server aktif pada port ${PORT}`);
});

// 3. Logika Bot
bot.command("start", (ctx) => {
    ctx.reply("Assalamu'alaikum Warahmatullahi Wabarakatuh. 🌙\nBismillah, silakan kirimkan link video yang ingin diunduh.");
});

bot.on("message:text", async (ctx) => {
    const url = ctx.message.text;
    if (!url.startsWith("http")) return;

    const fileId = `vid_${ctx.from.id}_${Date.now()}`;
    const filePath = path.join(__dirname, `${fileId}.mp4`);
    let statusMsg;

    try {
        statusMsg = await ctx.reply("Bismillah, sedang memproses... 🌙");

        // Eksekusi yt-dlp dengan filter 720p & Progress Bar
        const downloadProcess = execa("yt-dlp", [
            url,
            "-f", "mp4[height<=720]/best[height<=720]",
            "--newline",
            "--no-playlist",
            "-o", filePath
        ]);

        // Logika Progress Bar Unik Ramadan
        downloadProcess.stdout.on("data", (data) => {
            const line = data.toString();
            const match = line.match(/(\d+\.\d+)%/);
            if (match) {
                const percent = parseFloat(match[1]);
                const barSize = 10;
                const filled = Math.round((percent / 100) * barSize);
                const bar = "🌙".repeat(filled) + "☁️".repeat(barSize - filled);
                
                ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, 
                    `Sedang mengunduh: [${bar}] ${percent}%`).catch(() => {});
            }
        });

        await downloadProcess;

        // Kirim Video ke User
        if (fs.existsSync(filePath)) {
            await ctx.replyWithVideo(new InputFile(filePath), {
                caption: "Alhamdulillah, video berhasil diunduh. Semoga bermanfaat. ✨"
            });
        }

    } catch (error) {
        console.error("Error Detail:", error.message);
        await ctx.reply("Afwan, video gagal diproses. Pastikan link publik dan durasi tidak terlalu panjang. 🙏");
    } finally {
        // Auto-Cleanup: Hapus file segera agar storage tidak penuh
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (statusMsg) ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    }
});

// 4. Menjalankan Bot
bot.start({
    drop_pending_updates: true,
    onStart: (me) => console.log(`Bot ${me.username} berjalan... Alhamdulillah.`)
}).catch((err) => {
    console.error("Gagal memulai bot:", err);
});
