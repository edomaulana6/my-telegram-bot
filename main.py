import os
import asyncio
from pyrogram import Client, filters
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from yt_dlp import YoutubeDL

# DATA DARI GITHUB SECRETS
token = os.environ.get('BOT_TOKEN')
api_id = os.environ.get('API_ID')
api_hash = os.environ.get('API_HASH')

if not all([token, api_id, api_hash]):
    print("CRITICAL ERROR: Secrets belum lengkap!")
    exit(1)

app = Client("downloader_bot", api_id=int(api_id), api_hash=api_hash, bot_token=token)
user_data = {}

@app.on_message(filters.command("dl") & filters.private)
async def ask_for_link(client, message):
    user_id = message.from_user.id
    user_data[user_id] = {'waiting': True}
    await message.reply_text("Silakan kirimkan link (Dukung YouTube OAuth2):")

@app.on_message(filters.text & filters.private)
async def handle_text(client, message):
    user_id = message.from_user.id
    if user_data.get(user_id, {}).get('waiting'):
        url = message.text
        if not url.startswith("http"):
            return await message.reply_text("❌ Link tidak valid.")
        
        user_data[user_id] = {'url': url, 'waiting': False}
        buttons = InlineKeyboardMarkup([
            [InlineKeyboardButton("🎥 Video", callback_data="vid"),
             InlineKeyboardButton("🎵 Audio", callback_data="aud")]
        ])
        await message.reply_text("Pilih format:", reply_markup=buttons)

@app.on_callback_query()
async def process_download(client, callback_query):
    user_id = callback_query.from_user.id
    data = callback_query.data
    url = user_data.get(user_id, {}).get('url')

    await callback_query.message.edit_text("⏳ Memproses dengan metode OAuth2...")
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        # AKTIFKAN OAUTH2 UNTUK YOUTUBE
        'username': 'oauth2',
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    }

    if data == "vid":
        ydl_opts['format'] = 'best[ext=mp4]/best'
        ydl_opts['outtmpl'] = f'video_{user_id}.%(ext)s'
    else:
        ydl_opts['format'] = 'bestaudio/best'
        ydl_opts['outtmpl'] = f'audio_{user_id}.mp3'

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)

        if data == "vid":
            await client.send_video(chat_id=user_id, video=filename, caption=info.get('title'))
        else:
            await client.send_audio(chat_id=user_id, audio=filename, caption=info.get('title'))
        
        if os.path.exists(filename): os.remove(filename)
        await callback_query.message.delete()
        
    except Exception as e:
        error_msg = str(e)
        # Jika butuh otentikasi OAuth2, instruksi akan muncul di log GitHub Actions
        if "To give yt-dlp access to your account" in error_msg:
             await callback_query.message.edit_text("⚠️ Cek tab **Actions** di GitHub Anda! Klik log 'Run main.py', di sana ada link dan kode untuk login YouTube.")
        else:
            await callback_query.message.edit_text(f"❌ Gagal: {error_msg}")

print("Bot OAuth2 Aktif...")
app.run()
