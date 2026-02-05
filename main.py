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

app = Client("downloader_bot", api_id=int(api_id), api_hash=api_hash, bot_token=token)

@app.on_message(filters.regex(r'http'))
async def download_video(client, message):
    msg = await message.reply("⏳ Memproses link...")
    url = message.text
    
    ydl_opts = {
        'format': 'best',
        'outtmpl': 'video.%(ext)s',
        'noplaylist': True,
    }
    
    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            
        await message.reply_video(video=filename, caption="✅ Berhasil didownload!")
        os.remove(filename)
        await msg.delete()
    except Exception as e:
        await msg.edit(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    print("Bot Aktif...")
    keep_alive()  # Menjalankan website pura-pura di port 8000
    app.run()
               
