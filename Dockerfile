const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Fungsi untuk membuat progress bar unik
function makeProgressBar(percent) {
  const size = 10;
  const progress = Math.round((size * percent) / 100);
  const emptyProgress = size - progress;
  const filled = "🌙".repeat(progress); // Karakter unik saat jalan
  const empty = "☁️".repeat(emptyProgress); // Karakter sisa
  return `[${filled}${empty}] ${percent}%`;
}

bot.on('text', async (ctx) => {
  const url = ctx.message.text;
  if (!url.startsWith('http')) return;

  const statusMsg = await ctx.reply("✨ *Bismillah...*\n\n☁️☁️☁️☁️☁️☁️☁️☁️☁️☁️ 0%", { parse_mode: 'Markdown' });
  const timestamp = Date.now();
  const rawPath = path.join(__dirname, `raw_${timestamp}.mp4`);

  try {
    const ytdlp = spawn('yt-dlp', [
      '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]',
      '--newline', // Wajib agar progress bisa dibaca per baris
      '-o', rawPath,
      url
    ]);

    let lastUpdate = 0;

    ytdlp.stdout.on('data', (data) => {
      const output = data.toString();
      // Mencari pola persentase dari output yt-dlp (contoh: [download]  45.0% of 10.00MiB)
      const match = output.match(/(\d+\.\d+)%/);
      
      if (match) {
        const percent = parseFloat(match[1]);
        const now = Date.now();
        
        // Update setiap 2 detik agar tidak kena spam limit Telegram (PENTING!)
        if (now - lastUpdate > 2000) {
          const bar = makeProgressBar(percent);
          ctx.telegram.editMessageText(
            ctx.chat.id, 
            statusMsg.message_id, 
            null, 
            `✨ *Sedang Mengunduh...*\n\n${bar}\n\nMohon bersabar, sedang menjemput berkah. 🙏`,
            { parse_mode: 'Markdown' }
          ).catch(() => {}); // Abaikan error jika pesan sama
          lastUpdate = now;
        }
      }
    });

    await new Promise((resolve, reject) => {
      ytdlp.on('close', (code) => code === 0 ? resolve() : reject(new Error("Gagal")));
      ytdlp.on('error', reject);
    });

    // Lanjut ke proses FFmpeg seperti biasa...
    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, null, "⚙️ *Hampir Selesai...* Sedang memperindah kualitas (Upscale).");
    
    // ... (Logika FFmpeg dan Kirim Video)

  } catch (err) {
    ctx.reply("Afwan, terjadi kendala teknis. 🙏");
  } finally {
    if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
  }
});
