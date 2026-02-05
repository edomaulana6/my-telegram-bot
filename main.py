import os
import asyncio
from pyrogram import Client, filters
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from yt_dlp import YoutubeDL

# AMBIL DATA DARI SECRETS GITHUB
token = os.environ.get('BOT_TOKEN')
api_id = os.environ.get('API_ID')
api_hash = os.environ.get('API_HASH')

# Validasi awal agar tidak Exit Code 1
if not all([token, api_id, api_hash]):
    print("Error: Secrets BOT_TOKEN, API_ID, atau API_HASH belum diisi!")
    exit(1)

app = Client("downloader_bot", api_id=int(api_id), api_hash=api_hash, bot_token=token)

# Database sementara untuk status user
user_data = {}

@app.on_message(filters.command("start") & filters.private)
async def start(client, message):
    await message.reply_text(f"Halo {message.from_user.first_name}! 👋\nKetik /dl untuk mulai download.")

@app.on_message(filters.command("dl") & filters.private)
async def ask_for_link(client, message):
    user_id = message.from_user.id
    user_data[user_id] = {'waiting': True}
    await message.reply_text("Mana link-nya? (Dukung YouTube, TikTok Foto/Video, IG, dll)")

@app.on_message(filters.text & filters.private)
async def handle_text(client, message):
    user_id = message.from_user.id
    if user_data.get(user_id, {}).get('waiting'):
        url = message.text
        if not url.startswith("http"):
            return await message.reply_text("Kirim link yang valid ya!")
        
        user_data[user_id] = {'url': url, 'waiting': False}
        
        # Pilihan Format
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

    if not url:
        return await callback_query.answer("Link hilang, ulangi /dl", show_alert=True)

    await callback_query.message.edit_text("⏳ Sedang memproses... Mohon tunggu.")
    
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    }

    if data == "vid":
        ydl_opts['format'] = 'bestvideo+bestaudio/best'
        ydl_opts['outtmpl'] = f'video_{user_id}.%(ext)s'
    else:
        ydl_opts['format'] = 'bestaudio/best'
        ydl_opts['outtmpl'] = f'audio_{user_id}.mp3'

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)

            # Fitur Foto TikTok (Slide)
            if 'entries' in info or info.get('ext') in ['jpg', 'png', 'webp']:
                await callback_query.message.edit_text("Mendeteksi foto, mengirim sebagai media...")
                if 'entries' in info:
                    for entry in info['entries']:
                        await client.send_photo(chat_id=user_id, photo=entry['url'])
                else:
                    await client.send_photo(chat_id=user_id, photo=url)
                await callback_query.message.delete()
                return

        # Kirim Video atau Audio
        if data == "vid":
            await client.send_video(chat_id=user_id, video=filename, caption=f"✅ {info.get('title')}")
        else:
            await client.send_audio(chat_id=user_id, audio=filename, caption=f"✅ {info.get('title')}")
        
        if os.path.exists(filename):
            os.remove(filename)
        await callback_query.message.delete()
        
    except Exception as e:
        await callback_query.message.edit_text(f"❌ Gagal: {str(e)}")

print("Bot Multi-Downloader (TikTok Photo Support) Aktif...")
app.run()
