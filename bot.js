const { Bot, InputFile } = require("grammy");
const { exec } = require("child_process"); // Library paling stabil (built-in)
const fs = require("fs");
const path = require("path");
const http = require("http");

// 1. Konfigurasi Token (Environment Variable)
const token = process.env.BOT_TOKEN ? process.env.BOT_TOKEN.replace(/['"]+/g, '').trim() : null;
if (!token) {
    console.error("TOKEN TIDAK DITEMUKAN!");
    process.exit(1);
}
const bot = new Bot(token);

// 2. Server HTTP (Agar Koyeb tetap 'Healthy' & tidak restart)
const PORT = process.env.PORT || 8000;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Bot is Active');
}).listen(PORT);

// 3. Logika Utama Bot
bot.on("message:text", async (ctx) => {
    const url = ctx.message.text;
    
    // Validasi link sederhana
    if (!url.startsWith("http")) return;

    const fileName = `video_${Date.now()}.mp4`;
    const outputPath = path.join(__dirname, fileName);
    
    let statusMsg;
    try {
        statusMsg = await ctx.reply("Bismillah, sedang mengunduh... 🌙");

        // Perintah yt-dlp paling stabil
        // -f mp4: memastikan format mp4 agar bisa diputar langsung di Telegram
        const command = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --no-playlist -o "${outputPath}" "${url}"`;

        exec(command, async (error, stdout, stderr) => {
            if (error) {
                console.error(`Exec Error: ${error.message}`);
                return ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, "Afwan, gagal memproses video. 🙏");
            }

            // Kirim file jika berhasil diunduh
            if (fs.existsSync(outputPath)) {
                await ctx.replyWithVideo(new InputFile(outputPath), {
                    caption: "Alhamdulillah, video berhasil diunduh. ✨",
                    supports_streaming: true
                });
                
                // Hapus file setelah dikirim (Clean-up)
                fs.unlinkSync(outputPath);
            }
            
            // Hapus pesan status "sedang mengunduh"
            ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
        });

    } catch (e) {
        console.error(`System Error: ${e.message}`);
        if (statusMsg) ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id).catch(() => {});
    }
});

// 4. Menjalankan Bot
bot.start({
    drop_pending_updates: true,
    onStart: (me) => console.log(`Bot ${me.username} Aktif! Alhamdulillah.`)
});
    
