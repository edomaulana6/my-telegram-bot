const { Bot, InputFile } = require("grammy");
const { execa } = require("execa");
const fs = require("fs");
const path = require("path");

// Mengambil token dari Environment Variables Koyeb
// Menambahkan pembersihan otomatis terhadap karakter spasi atau kutip yang tidak sengaja terbawa
const token = process.env.BOT_TOKEN ? process.env.BOT_TOKEN.replace(/['"]+/g, '').trim() : null;

if (!token) {
    console.error("Kesalahan Fatal: BOT_TOKEN tidak ditemukan di Environment Variables!");
    process.exit(1);
}

const bot = new Bot(token);

bot.command("start", (ctx) => {
    ctx.reply("Bismillah. Assalamu'alaikum! Bot sudah aktif melalui Environment Variables. Silakan kirim link video. 🌙");
});

bot.on("message:text", async (ctx) => {
    const url = ctx.message.text;
    if (!url.startsWith("http")) return;

    const fileId = `vid_${ctx.from.id}_${Date.now()}`;
    const output = path.join(__dirname, `${fileId}.mp4`);
    
    let status;
    try {
        status = await ctx.reply("Bismillah, sedang memproses... 🌙");

        await execa("yt-dlp", [
            url,
            "-f", "mp4[height<=720]/best[height<=720]",
            "--no-playlist",
            "-o", output
        ]);

        if (fs.existsSync(output)) {
            await ctx.replyWithVideo(new InputFile(output), {
                caption: "Alhamdulillah, video berhasil diunduh. ✨"
            });
        }
    } catch (e) {
        console.error("Error Detail:", e.message);
        await ctx.reply("Afwan, video gagal diproses. Pastikan link publik dan durasi tidak terlalu panjang. 🙏");
    } finally {
        if (fs.existsSync(output)) fs.unlinkSync(output);
        if (status) ctx.api.deleteMessage(ctx.chat.id, status.message_id).catch(() => {});
    }
});

// Menjalankan bot dengan pembersihan update tertunda
bot.start({ drop_pending_updates: true });
console.log("Bot berjalan... Alhamdulillah.");
