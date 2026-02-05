import os
import asyncio
from pyrogram import Client, filters
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from yt_dlp import YoutubeDL

# KONFIGURASI SECRETS
token = os.environ.get('BOT_TOKEN')
api_id = os.environ.get('API_ID')
api_hash = os.environ.get('API_HASH')

app = Client("downloader_bot", api_id=int(api_id), api_hash=api_hash, bot_token=token)

user_data = {}

@app.on_message(filters.command("dl") & filters.private)
async def ask_for_link(client, message):
    user_id = message.from_user.id
    user_data[user_id] = {'waiting': True}
    await message.reply_text("Mana link-nya? (Dukung Video/Audio/Foto TikTok)")

@app.on_message(filters.text & filters.private)
async def handle_text(client, message):
    user_id = message.from_user.id
    if user_data.get(user_id, {}).get('waiting'):
        url = message.text
        if not url.startswith("http"):
            return await message.reply_text("Kirim link yang valid!")
        
        user_data[user_id] = {'url': url, 'waiting': False}
        
        buttons = InlineKeyboardMarkup([
            [InlineKeyboardButton("🎥 Video", callback_data="vid"),
             InlineKeyboardButton("🎵 Audio", callback_data="aud")]
        ])
        await message.reply_text("Pilih format unduhan:", reply_markup=buttons)

@app.on_callback_query()
async def process_download(client, callback_query):
    user_id = callback_query.from_user.id
    data = callback_query.data
    url = user_data.get(user_id, {}).get('url')

    await callback_query.message.edit_text("⏳ Sedang diproses menggunakan yt-dlp terbaru...")
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        # Header untuk meminimalisir blokir YouTube
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    }

    if data == "vid":
        ydl_opts['format'] = 'bestvideo+bestaudio/best'
        ydl_opts['outtmpl'] = f'dl_{user_id}.%(ext)s'
    else:
        ydl_opts['format'] = 'bestaudio/best'
        ydl_opts['outtmpl'] = f'dl_{user_id}.mp3'

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            
            # Logika khusus untuk Foto TikTok (jika ada entries foto)
            if 'entries' in info:
                for entry in info['entries']:
                    if entry.get('url'):
                        await client.send_photo(chat_id=user_id, photo=entry['url'])
                await callback_query.message.delete()
                return

        if data == "vid":
            await client.send_video(chat_id=user_id, video=filename, caption=f"✅ {info.get('title')}")
        else:
            await client.send_audio(chat_id=user_id, audio=filename, caption=f"✅ {info.get('title')}")
        
        if os.path.exists(filename):
            os.remove(filename)
        await callback_query.message.delete()
        
    except Exception as e:
        await callback_query.message.edit_text(f"❌ Gagal: {str(e)}")

print("Bot Aktif dengan yt-dlp GitHub version...")
app.run()
    
