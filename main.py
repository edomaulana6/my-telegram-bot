import os
import asyncio
import re
from aiohttp import web
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, CallbackQueryHandler
import yt_dlp

# --- KONFIGURASI WEB SERVER (KOYEB COMPLIANT) ---
async def handle_health(request):
    return web.Response(text="Bot Status: 100% Aktif", status=200)

async def start_web_server():
    app = web.Application()
    app.router.add_get('/', handle_health)
    runner = web.AppRunner(app)
    await runner.setup()
    # Koyeb memberikan PORT secara dinamis melalui environment variable
    port = int(os.environ.get("PORT", 8000))
    site = web.TCPSite(runner, '0.0.0.0', port)
    await site.start()
    print(f"Web Server running on port {port}")

# --- LOGIKA UNDUHAN UTAMA ---
async def process_download(url, chat_id, context, is_audio_only=True):
    if not os.path.exists('downloads'):
        os.makedirs('downloads')

    # ID unik untuk menghindari tabrakan file antar user
    file_id = f"{chat_id}_{int(asyncio.get_event_loop().time())}"
    
    ydl_opts = {
        'outtmpl': f'downloads/%(title)s_{file_id}.%(ext)s',
        'quiet': True,
        'no_warnings': True,
        'nocheckcertificate': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }

    if is_audio_only:
        # Optimasi M4A (AAC) agar ringan dan bisa di-Save ke Library Musik
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
            # Mengunduh file
            info = await loop.run_in_executor(None, lambda: ydl.extract_info(url, download=True))
            original_file = ydl.prepare_filename(info)
            
            # Koreksi nama file jika format audio diubah oleh postprocessor
            filename = os.path.splitext(original_file)[0] + ".m4a" if is_audio_only else original_file
            title = info.get('title', 'Media')

            if os.path.exists(filename):
                with open(filename, 'rb') as f:
                    if is_audio_only:
                        await context.bot.send_audio(
                            chat_id=chat_id, 
                            audio=f, 
                            title=title, 
                            performer="Music Downloader",
                            filename=f"{title}.m4a"
                        )
                    else:
                        await context.bot.send_video(chat_id=chat_id, video=f, caption=title)
                # Pembersihan storage otomatis
                os.remove(filename)
            else:
                raise FileNotFoundError("Gagal membuat file M4A. Pastikan FFmpeg terinstall.")

    except Exception as e:
        await context.bot.send_message(chat_id, f"❌ Kesalahan: {str(e)}")

# --- PENANGANAN PESAN MASUK ---
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    chat_id = update.message.chat_id

    # --- FITUR PLAY: SOUNDCLOUD ---
    if text.lower().startswith("play "):
        query = text[5:].strip()
        msg = await update.message.reply_text(f"🔍 Mencari '{query}' di SoundCloud...")
        
        search_opts = {
            'format': 'bestaudio/best', 
            'quiet': True, 
            'default_search': 'scsearch1:', 
            'noplaylist': True
        }
        try:
            with yt_dlp.YoutubeDL(search_opts) as ydl:
                info = await asyncio.get_event_loop().run_in_executor(None, lambda: ydl.extract_info(query, download=False))
                if 'entries' in info and len(info['entries']) > 0:
                    url = info['entries'][0]['url']
                    await process_download(url, chat_id, context, is_audio_only=True)
                    await msg.delete()
                else:
                    await msg.edit_text(f"❌ '{query}' tidak ditemukan.")
        except Exception as e:
            await msg.edit_text(f"❌ SoundCloud Error: {str(e)}")

    # --- DETEKSI LINK (SEMUA PLATFORM) ---
    elif "http" in text:
        url_match = re.search(r'(https?://[^\s]+)', text)
        if url_match:
            url = url_match.group(0)
            # Simpan URL di memori bot agar callback data tidak terlalu panjang
            context.user_data['last_url'] = url
            
            keyboard = InlineKeyboardMarkup([
                [InlineKeyboardButton("🎵 Audio (M4A)", callback_data="dl_m4a"),
                 InlineKeyboardButton("🎬 Video (MP4)", callback_data="dl_mp4")]
            ])
            await update.message.reply_text("Pilih format unduhan:", reply_markup=keyboard)

# --- CALLBACK TOMBOL ---
async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    url = context.user_data.get('last_url')
    if not url:
        await query.message.edit_text("❌ Link sudah kadaluwarsa, kirim ulang linknya.")
        return

    is_audio = (query.data == "dl_m4a")
    status_msg = await context.bot.send_message(query.message.chat_id, "⏳ Sedang memproses file...")
    await process_download(url, query.message.chat_id, context, is_audio_only=is_audio)
    await status_msg.delete()

# --- MAIN EXECUTION ---
async def main():
    token = os.environ.get("TELEGRAM_TOKEN")
    if not token:
        print("❌ CRITICAL ERROR: Variabel TELEGRAM_TOKEN tidak ditemukan!")
        return

    application = Application.builder().token(token).build()
    
    # Register Handlers
    application.add_handler(CommandHandler("start", lambda u, c: u.message.reply_text("👋 Bot Aktif!\nKetik 'play [judul]' atau kirim link.")))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    application.add_handler(CallbackQueryHandler(button_callback))

    # Start Web Server & Polling
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
    
