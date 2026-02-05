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

    status_msg = await message.reply_text("⏳ Memproses link...")

    # Konfigurasi yt-dlp standar
    ydl_opts = {
        'format': 'best[ext=mp4]/best',
        'quiet': True,
        'no_warnings': True,
        'outtmpl': f'download_{message.from_user.id}.%(ext)s',
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            # Audit apakah platform didukung
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            
            await status_msg.edit_text("📤 Mengirim file...")
            await client.send_video(chat_id=message.chat.id, video=filename, caption=info.get('title'))
            
            if os.path.exists(filename):
                os.remove(filename)
            await status_msg.delete()

    except Exception as e:
        error_msg = str(e)
        # Logika jawaban jika platform tidak didukung atau diblokir
        if "Unsupported URL" in error_msg:
            await status_msg.edit_text(f"❌ Platform ini tidak didukung.")
        elif "Sign in to confirm your age" in error_msg or "Inappropriate content" in error_msg:
            await status_msg.edit_text(f"❌ Konten ini dibatasi atau butuh cookies.")
        else:
            await status_msg.edit_text(f"❌ Gagal: YouTube/Platform ini tidak didukung tanpa cookies.")

print("Bot yt-dlp Lokal Aktif...")
app.run()
    
