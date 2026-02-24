import os
import asyncio
import re
from aiohttp import web
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, CallbackQueryHandler
import yt_dlp

# --- KONFIGURASI ---
INVIDIOUS_INSTANCE = "https://yewtu.be"

# --- WEB SERVER HEALTH CHECK ---
async def handle_health(request):
    return web.Response(text="Bot Aktif 100%", status=200)

async def start_web_server():
    app = web.Application()
    app.router.add_get('/', handle_health)
    runner = web.AppRunner(app)
    await runner.setup()
    # Port 8000 untuk kesesuaian dengan Cloud Hosting (Koyeb/Heroku)
    site = web.TCPSite(runner, '0.0.0.0', 8000)
    await site.start()

# --- LOGIKA PENYESUAIAN URL ---
def get_safe_url(url):
    """Konversi YouTube ke Invidious (Tanpa Cookies). Platform lain tetap."""
    if "youtube.com" in url or "youtu.be" in url:
        video_id = ""
        if "watch?v=" in url:
            video_id = url.split("watch?v=")[1].split("&")[0]
        elif "youtu.be/" in url:
            video_id = url.split("youtu.be/")[1].split("?")[0]
        
        if video_id:
            return f"{INVIDIOUS_INSTANCE}/watch?v={video_id}"
    return url

# --- LOGIKA UNDUHAN ---
async def process_download(url, chat_id, context, is_audio_only=True):
    if not os.path.exists('downloads'):
        os.makedirs('downloads')

    final_url = get_safe_url(url)
    
    # ID Unik agar file antar user tidak tertukar
    file_id = f"{chat_id}_{int(asyncio.get_event_loop().time())}"
    
    ydl_opts = {
        'outtmpl': f'downloads/%(title)s_{file_id}.%(ext)s',
        'quiet': True,
        'no_warnings': True,
        'nocheckcertificate': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    if is_audio_only:
        # Format M4A: Cepat, Ringan, Bisa Disimpan (Saveable)
        ydl_opts.update({
            'format': 'bestaudio[ext=m4a]/bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'm4a',
            }],
        })
    else:
        # Video MP4 Max 480p agar masuk limit 50MB Telegram
        ydl_opts.update({'format': 'best[ext=mp4][height<=480][filesize<50M]/best[ext=mp4]/best'})

    try:
        loop = asyncio.get_event_loop()
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = await loop.run_in_executor(None, lambda: ydl.extract_info(final_url, download=True))
            original_file = ydl.prepare_filename(info)
            
            # Koreksi ekstensi jika menggunakan postprocessor
            if is_audio_only:
                filename = os.path.splitext(original_file)[0] + ".m4a"
            else:
                filename = original_file
            
            title = info.get('title', 'Media')

            if os.path.exists(filename):
                with open(filename, 'rb') as f:
                    if is_audio_only:
                        await context.bot.send_audio(
                            chat_id=chat_id,
                            audio=f,
                            title=title,
                            performer="Downloader Bot",
                            filename=f"{title}.m4a"
                        )
                    else:
                        await context.bot.send_video(
                            chat_id=chat_id,
                            video=f,
                            caption=title
                        )
                os.remove(filename)
            else:
                raise FileNotFoundError("File tidak ditemukan setelah unduhan.")
                
    except Exception as e:
        await context.bot.send_message(chat_id, f"❌ Gagal: {str(e)}")

# --- PENANGANAN PESAN ---
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    chat_id = update.message.chat_id

    # Fitur PLAY (YouTube via Invidious)
    if text.lower().startswith("play "):
        query = text[5:].strip()
        msg = await update.message.reply_text(f"🔍 Mencari '{query}'...")
        
        search_opts = {'quiet': True, 'noplaylist': True, 'extract_flat': True, 'default_search': 'ytsearch1'}
        try:
            with yt_dlp.YoutubeDL(search_opts) as ydl:
                info = await asyncio.get_event_loop().run_in_executor(None, lambda: ydl.extract_info(query, download=False))
                if 'entries' in info and len(info['entries']) > 0:
                    video_url = info['entries'][0]['url']
                    await process_download(video_url, chat_id, context, is_audio_only=True)
                    await msg.delete()
                else:
                    await msg.edit_text("❌ Tidak ditemukan.")
        except Exception as e:
            await msg.edit_text(f"❌ Error: {str(e)}")

    # Deteksi Link (Semua Platform)
    elif "http" in text:
        url = re.search(r'(https?://[^\s]+)', text).group(0)
        # Simpan URL di context user karena callback_data punya limit karakter
        context.user_data['last_url'] = url
        
        keyboard = InlineKeyboardMarkup([
            [InlineKeyboardButton("🎵 Audio (M4A)", callback_data="dl_m4a"),
             InlineKeyboardButton("🎬 Video (MP4)", callback_data="dl_mp4")]
        ])
        await update.message.reply_text("Pilih format media:", reply_markup=keyboard)

# --- CALLBACK ---
async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    url = context.user_data.get('last_url')
    if not url:
        await query.message.edit_text("❌ Link kadaluwarsa. Silakan kirim ulang.")
        return

    is_audio = (query.data == "dl_m4a")
    status_msg = await context.bot.send_message(query.message.chat_id, "⏳ Memproses sumber...")
    await process_download(url, query.message.chat_id, context, is_audio_only=is_audio)
    await status_msg.delete()

# --- MAIN ---
async def main():
    token = os.environ.get("TELEGRAM_TOKEN")
    if not token:
        print("❌ TELEGRAM_TOKEN TIDAK DITEMUKAN!")
        return

    application = Application.builder().token(token).build()
    
    application.add_handler(CommandHandler("start", lambda u, c: u.message.reply_text("👋 Bot Aktif! Gunakan 'play [judul]' atau kirim link.")))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    application.add_handler(CallbackQueryHandler(button_callback))

    await start_web_server()
    async with application:
        await application.initialize()
        await application.start()
        await application.updater.start_polling()
        await asyncio.Event().wait()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        pass
    
