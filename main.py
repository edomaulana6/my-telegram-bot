import os
import asyncio
from pyrogram import Client, filters
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from yt_dlp import YoutubeDL

# AMBIL DATA DARI SECRETS GITHUB
token = os.environ.get('BOT_TOKEN')
api_id = os.environ.get('API_ID')
api_hash = os.environ.get('API_HASH')

if not all([token, api_id, api_hash]):
    print("Error: Secrets belum lengkap!")
    exit(1)

app = Client("downloader_bot", api_id=int(api_id), api_hash=api_hash, bot_token=token)

# Database sementara untuk menyimpan link dan status
user_data = {}

@app.on_message(filters.command("start") & filters.private)
async def start(client, message):
    await message.reply_text(f"Halo {message.from_user.first_name}! Ketik /dl untuk mulai download.")

@app.on_message(filters.command("dl") & filters.private)
async def ask_for_link(client, message):
    user_id = message.from_user.id
    user_data[user_id] = {'waiting': True}
    await message.reply_text("Mana link-nya? (Dukung YouTube, TikTok, IG, FB, dll)")

@app.on_message(filters.text & filters.private)
async def handle_text(client, message):
    user_id = message.from_user.id
    if user_data.get(user_id, {}).get('waiting'):
        url = message.text
        if not url.startswith("http"):
            return await message.reply_text("Kirim link yang valid ya!")
        
        user_data[user_id] = {'url': url, 'waiting': False}
        
        # Munculkan Tombol Pilihan
        buttons = InlineKeyboardMarkup([
            [InlineKeyboardButton("🎥 Video", callback_data="vid"),
             InlineKeyboardButton("🎵 Audio (MP3)", callback_data="aud")]
        ])
        await message.reply_text("Mau download dalam format apa?", reply_markup=buttons)

@app.on_callback_query()
async def process_download(client, callback_query):
    user_id = callback_query.from_user.id
    data = callback_query.data
    url = user_data.get(user_id, {}).get('url')

    if not url:
        return await callback_query.answer("Link tidak ditemukan, ulangi perintah /dl", show_alert=True)

    await callback_query.message.edit_text("Sedang memproses... Ini butuh waktu jika server sibuk.")
    
    # Konfigurasi Anti-Bot & Format
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
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
            
        if data == "vid":
            await client.send_video(chat_id=user_id, video=filename, caption=f"Selesai: {info.get('title')}")
        else:
            await client.send_audio(chat_id=user_id, audio=filename, caption=f"Selesai: {info.get('title')}")
        
        if os.path.exists(filename):
            os.remove(filename)
        await callback_query.message.delete()
        
    except Exception as e:
        error_msg = str(e)
        if "confirm you're not a bot" in error_msg:
            await callback_query.message.edit_text("YouTube memblokir server ini. Coba link platform lain (TikTok/IG) atau coba lagi nanti.")
        else:
            await callback_query.message.edit_text(f"Gagal: {error_msg}")

print("Bot Multi-Downloader Aktif...")
app.run()
    
