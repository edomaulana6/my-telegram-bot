import os
import asyncio
from pyrogram import Client, filters
from yt_dlp import YoutubeDL

# DATA DARI GITHUB SECRETS
token = os.environ.get('BOT_TOKEN')
api_id = os.environ.get('API_ID')
api_hash = os.environ.get('API_HASH')

app = Client("downloader_bot", api_id=int(api_id), api_hash=api_hash, bot_token=token)

@app.on_message(filters.text & filters.private)
async def handle_download(client, message):
    url = message.text
    if not url.startswith("http"):
        return

    status_msg = await message.reply_text("⏳ Memproses link via yt-dlp...")

    # Konfigurasi yt-dlp lokal
    ydl_opts = {
        'format': 'best[ext=mp4]/best',
        'quiet': True,
        'no_warnings': True,
        'outtmpl': f'download_{message.from_user.id}.%(ext)s',
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            # Mengunduh secara lokal di server GitHub
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            
            await status_msg.edit_text("📤 Mengirim file ke Telegram...")
            await client.send_video(chat_id=message.chat.id, video=filename, caption=info.get('title'))
            
            if os.path.exists(filename):
                os.remove(filename)
            await status_msg.delete()

    except Exception as e:
        error_text = str(e)
        # Jawaban jujur jika platform tidak tembus
        if "Unsupported URL" in error_text:
            await status_msg.edit_text("❌ Platform ini tidak didukung oleh bot.")
        else:
            await status_msg.edit_text("❌ Gagal: Platform ini tidak didukung (butuh akses khusus/cookies).")

print("Bot yt-dlp Standar Aktif...")
app.run()
            
