import os
import asyncio
from pyrogram import Client, filters
from yt_dlp import YoutubeDL

# AMBIL DATA DARI SECRETS GITHUB
token = os.environ.get('BOT_TOKEN')
api_id = os.environ.get('API_ID')
api_hash = os.environ.get('API_HASH')

app = Client("downloader_bot", api_id=int(api_id), api_hash=api_hash, bot_token=token)

# Variabel sementara untuk menyimpan siapa yang sedang ditanya link
waiting_for_link = {}

@app.on_message(filters.command("start") & filters.private)
async def start(client, message):
    await message.reply_text("Halo! Ketik /dl untuk mulai mengunduh video.")

@app.on_message(filters.command("dl") & filters.private)
async def ask_for_link(client, message):
    user_id = message.from_user.id
    # Tandai user ini sedang ditunggu link-nya
    waiting_for_link[user_id] = True
    await message.reply_text("Mana link-nya?")

@app.on_message(filters.text & filters.private)
async def handle_text(client, message):
    user_id = message.from_user.id
    
    # Cek apakah user ini baru saja mengetik /dl
    if waiting_for_link.get(user_id):
        url = message.text
        
        # Validasi link
        if not url.startswith("http"):
            return await message.reply_text("Itu bukan link. Coba kirim link yang benar atau ketik /dl lagi.")
        
        # Hapus tanda tunggu agar tidak terjadi loop download
        waiting_for_link[user_id] = False
        
        waiting_msg = await message.reply_text("Siap, sedang memproses link tersebut... Mohon tunggu.")
        
        ydl_opts = {
            'format': 'best',
            'outtmpl': 'downloaded_video.%(ext)s',
            'quiet': True,
        }

        try:
            with YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                
            await waiting_msg.edit_text("Download selesai, sedang mengirim file...")
            await message.reply_video(video=filename, caption=f"✅ **Berhasil:** {info.get('title')}")
            
            # Hapus file dari server Microsoft
            if os.path.exists(filename):
                os.remove(filename)
                
        except Exception as e:
            await waiting_msg.edit_text(f"Gagal mengunduh. Error: {str(e)}")
    
    # Jika user kirim teks biasa tanpa /dl, bot diam saja atau beri instruksi lain

print("Bot Downloader (Mode Percakapan) Aktif...")
app.run()
                
