import os
import asyncio
from pyrogram import Client, filters
from yt_dlp import YoutubeDL
from flask import Flask
from threading import Thread

# --- BAGIAN ANTI-MATI KOYEB ---
app_web = Flask('')

@app_web.route('/')
def home():
    return "Bot is Running"

def run_web():
    app_web.run(host='0.0.0.0', port=8000)

def keep_alive():
    t = Thread(target=run_web)
    t.start()
# ------------------------------

api_id = os.environ.get("API_ID")
api_hash = os.environ.get("API_HASH")
token = os.environ.get("BOT_TOKEN")

# workers=1 memastikan bot hanya memproses satu pesan dalam satu waktu (Anti-Spam)
app = Client("downloader_bot", api_id=int(api_id), api_hash=api_hash, bot_token=token, workers=1)

# Daftar untuk mencatat pesan yang sedang diproses (Mencegah duplikasi pesan di grup)
processing_users = set()

@app.on_message(filters.regex(r'http') & (filters.private | filters.group))
async def download_video(client, message):
    # Cek apakah user/pesan ini sedang diproses
    if message.from_user and message.from_user.id in processing_users:
        return # Abaikan jika masih ada proses berjalan untuk user ini
    
    user_id = message.from_user.id if message.from_user else message.chat.id
    processing_users.add(user_id)

    msg = await message.reply("⏳ Memproses link jernih... (Mohon tunggu)")
    url = message.text
    
    # Format 'best' yang paling stabil tanpa membuat RAM meledak
    ydl_opts = {
        'format': 'best[ext=mp4]/best',
        'outtmpl': f'video_{user_id}.%(ext)s',
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
    }
    
    try:
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(None, lambda: YoutubeDL(ydl_opts).extract_info(url, download=True))
        filename = YoutubeDL(ydl_opts).prepare_filename(info)
            
        await message.reply_video(video=filename, caption="✅ Berhasil didownload!")
        
        if os.path.exists(filename):
            os.remove(filename)
        await msg.delete()
    except Exception as e:
        # Jika error, kirim pesan singkat saja agar tidak memenuhi layar
        if "FloodWait" in str(e):
            print("Kena Flood Wait Telegram.")
        else:
            await msg.edit(f"❌ Terjadi kendala teknis.")
    finally:
        # Hapus user dari daftar proses agar bisa kirim link lagi
        processing_users.discard(user_id)

if __name__ == "__main__":
    print("Bot Aktif dengan Sistem Anti-Spam...")
    keep_alive()
    app.run()
