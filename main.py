import os
import asyncio
from pyrogram import Client, filters
from yt_dlp import YoutubeDL

# AMBIL DATA DARI SECRETS GITHUB
token = os.environ.get('BOT_TOKEN')
api_id = os.environ.get('API_ID')
api_hash = os.environ.get('API_HASH')

# Validasi awal agar tidak Exit Code 1 karena data kosong
if not all([token, api_id, api_hash]):
    print("Error: Secrets BOT_TOKEN, API_ID, atau API_HASH belum diisi!")
    exit(1)

app = Client("downloader_bot", api_id=int(api_id), api_hash=api_hash, bot_token=token)

# Database sementara
waiting_for_link = {}

@app.on_message(filters.command("start") & filters.private)
async def start(client, message):
    await message.reply_text("Halo! Ketik /dl untuk mulai.")

@app.on_message(filters.command("dl") & filters.private)
async def ask_for_link(client, message):
    user_id = message.from_user.id
    waiting_for_link[user_id] = True
    await message.reply_text("Mana link-nya?")

@app.on_message(filters.text & filters.private)
async def handle_text(client, message):
    user_id = message.from_user.id
    
    if waiting_for_link.get(user_id):
        url = message.text
        if not url.startswith("http"):
            await message.reply_text("Itu bukan link. Ketik /dl lagi ya.")
            waiting_for_link[user_id] = False
            return

        waiting_for_link[user_id] = False
        waiting_msg = await message.reply_text("Memproses... mohon tunggu.")
        
        ydl_opts = {
            'format': 'best',
            'outtmpl': 'video_%(id)s.%(ext)s',
            'quiet': True,
        }

        try:
            with YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
            
            await message.reply_video(video=filename, caption=f"Selesai: {info.get('title')}")
            if os.path.exists(filename):
                os.remove(filename)
            await waiting_msg.delete()
        except Exception as e:
            await message.reply_text(f"Gagal: {str(e)}")

print("Bot Aktif...")
app.run()
