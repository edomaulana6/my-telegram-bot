import os
import asyncio
from aiohttp import web
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, CallbackQueryHandler
import yt_dlp

# --- Web Server Health Check ---
async def handle_health(request):
    return web.Response(text="Bot Aktif 100%", status=200)

async def start_web_server():
    app = web.Application()
    app.router.add_get('/', handle_health)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8000)
    await site.start()

# --- Fungsi Inti Download ---
async def process_download(url, chat_id, context, is_audio_only=True):
    # Gunakan restrictfilenames agar tidak ada karakter ilegal di sistem file
    ydl_opts = {
        'outtmpl': f'downloads/%(title)s_{chat_id}.%(ext)s',
        'quiet': True,
        'no_warnings': True,
        'restrictfilenames': True, 
    }

    if is_audio_only:
        ydl_opts.update({
            'format': 'bestaudio/best',
            'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '192'}],
        })
    else:
        ydl_opts.update({'format': 'bestvideo+bestaudio/best'})

    if not os.path.exists('downloads'):
        os.makedirs('downloads')

    try:
        loop = asyncio.get_event_loop()
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = await loop.run_in_executor(None, lambda: ydl.extract_info(url, download=True))
            filename = ydl.prepare_filename(info)
            
            if is_audio_only:
                filename = os.path.splitext(filename)[0] + ".mp3"
            
            title = info.get('title', 'Media')
            
            with open(filename, 'rb') as f:
                if is_audio_only:
                    await context.bot.send_audio(chat_id=chat_id, audio=f, title=title)
                else:
                    await context.bot.send_video(chat_id=chat_id, video=f, caption=title)

        # Hapus file segera setelah terkirim (Pembersihan Memory)
        if os.path.exists(filename):
            os.remove(filename)
    except Exception as e:
        await context.bot.send_message(chat_id, f"❌ Gagal: {str(e)}")

# --- Handler Pesan ---
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    chat_id = update.message.chat_id

    if text.lower().startswith("play "):
        query = text[5:].strip()
        msg = await update.message.reply_text(f"📥 Mencari '{query}'...")
        
        # Default ke pencarian YouTube jika tidak spesifik
        search_opts = {'format': 'bestaudio/best', 'quiet': True, 'default_search': 'ytsearch1:', 'noplaylist': True}
        try:
            with yt_dlp.YoutubeDL(search_opts) as ydl:
                info = await asyncio.get_event_loop().run_in_executor(None, lambda: ydl.extract_info(query, download=False))
                if 'entries' in info and len(info['entries']) > 0:
                    url = info['entries'][0]['webpage_url']
                    await process_download(url, chat_id, context, is_audio_only=True)
                    await msg.delete()
                else:
                    await msg.edit_text("❌ Lagu tidak ditemukan.")
        except Exception as e:
            await msg.edit_text(f"❌ Error: {str(e)}")

    elif "http" in text:
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("🎵 MP3", callback_data=f"dl_mp3|{text}"),
                InlineKeyboardButton("🎬 MP4", callback_data=f"dl_mp4|{text}")
            ]
        ])
        await update.message.reply_text("Pilih format unduhan:", reply_markup=keyboard)

async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    data_parts = query.data.split('|')
    action = data_parts[0]
    url = data_parts[1]
    
    is_audio = (action == "dl_mp3")
    status_msg = await context.bot.send_message(query.message.chat_id, "⏳ Sedang mengunduh...")
    await process_download(url, query.message.chat_id, context, is_audio_only=is_audio)
    await status_msg.delete()

# --- Fungsi Utama ---
async def main():
    token = os.environ.get("TELEGRAM_TOKEN")
    if not token:
        print("❌ ERROR: TELEGRAM_TOKEN tidak ditemukan di Environment Variables!")
        return

    application = Application.builder().token(token).build()
    application.add_handler(CommandHandler("start", lambda u, c: u.message.reply_text("Kirim link atau ketik 'play [judul]'")))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    application.add_handler(CallbackQueryHandler(button_callback))

    await start_web_server()
    
    async with application:
        await application.initialize()
        await application.start()
        await application.updater.start_polling()
        await asyncio.Event().wait()

if __name__ == '__main__':
    asyncio.run(main())
    
