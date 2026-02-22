const { Bot, InputFile } = require("grammy");
const { execa } = require("execa");
const fs = require("fs");
const path = require("path");

const bot = new Bot("TOKEN_ANDA");

bot.command("start", (ctx) => ctx.reply("Assalamu'alaikum. Silakan kirim link video. Bismillah."));

bot.on("message:text", async (ctx) => {
    const url = ctx.message.text;
    const fileId = `${ctx.from.id}_${Date.now()}`;
    const output = path.join(__dirname, `${fileId}.mp4`);
    
    const status = await ctx.reply("Bismillah, memproses... 🌙");

    try {
        // Eksekusi yt-dlp + FFmpeg dalam satu aliran (Pipe) jika memungkinkan, 
        // tapi untuk kestabilan 720p, kita gunakan perintah langsung yang efisien:
        await execa("yt-dlp", [
            url,
            "-f", "mp4[height<=720]/best[height<=720]", // Langsung ambil 720p dari sumber (lebih ringan drpd convert)
            "--no-playlist",
            "--merge-output-format", "mp4",
            "-o", output
        ]);

        await ctx.replyWithVideo(new InputFile(output), {
            caption: "Alhamdulillah, selesai. 🌙"
        });

    } catch (e) {
        ctx.reply("Afwan, terjadi kesalahan teknis.");
    } finally {
        // Auto-Cleanup Instan
        if (fs.existsSync(output)) fs.unlinkSync(output);
        ctx.api.deleteMessage(ctx.chat.id, status.message_id).catch(() => {});
    }
});

bot.start();
  
