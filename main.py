import os
import asyncio
from aiohttp import web
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, CallbackQueryHandler
import yt_dlp

# --- KONFIGURASI WEB SERVER (HEALTH CHECK) ---
async def handle_health(request):
    # Memberikan respon sukses untuk sistem monitoring server (Koyeb/Heroku)
    return web.Response(text="Bot Aktif 100%", status=200)

async def start_web_server():
    # Menjalankan server asinkron pada port 8000
    app = web.Application()
    app.router.add_get('/', handle_health)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', 8000)
    await site.start()

# --- LOGIKA UNDUHAN DAN PENGIRIMAN FILE ---
async def process_download(url, chat_id, context, is_audio_only=True):
    # Membuat direktori penyimpanan sementara jika belum tersedia
    if not os.path.exists('downloads'):
        os.makedirs('downloads')

    # Pengaturan yt-dlp: dioptimasi tanpa re-encoding berat agar CPU tidak mentok
    ydl_opts = {
        'outtmpl': f'downloads/%(title)s_{chat_id}.%(ext)s',
        'quiet': True,
        'no_warnings': True,
        'restrictfilenames': True,
        'nocheckcertificate': True,
    }

    if is_audio_only:
        # Mengambil format audio asli tanpa konversi FFmpeg yang lambat
        ydl_opts.update({'format': 'bestaudio/best'})
    else:
        # Filter video mp4 max 480p agar ukuran di bawah limit 50MB
        ydl_opts.update({'format': 'best[ext=mp4][height<=480][filesize<50M]/best[ext=mp4]/best'})

    try:
        loop = asyncio.get_event_loop()
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Eksekusi unduhan
            info = await loop.run_in_executor(None, lambda: ydl.extract_info(url, download=True))
            filename = ydl.prepare_filename(info)
            title = info.get('title', 'Media')
            
            # Pengiriman file
            with open(filename, 'rb') as f:
                if is_audio_only:
                    await context.bot.send_audio(chat_id=chat_id, audio=f, title=title)
                else:
                    await context.bot.send_video(chat_id=chat_id, video=f, caption=title)

        # Pembersihan storage otomatis
        if os.path.exists(filename):
            os.remove(filename)
            
    except Exception as e:
        await context.bot.send_message(chat_id, f"❌ Gagal memproses: {str(e)}")

# --- PENANGANAN PESAN MASUK ---
async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text
    chat_id = update.message.chat_id

    # Fitur Cari Musik (SoundCloud)
    if text.lower().startswith("play "):
        query = text[5:].strip()
        msg = await update.message.reply_text(f"📥 Mencari '{query}' di SoundCloud...")
        
        search_opts = {'format': 'bestaudio/best', 'quiet': True, 'default_search': 'scsearch1:', 'noplaylist': True}
        try:
            with yt_dlp.YoutubeDL(search_opts) as ydl:
                info = await asyncio.get_event_loop().run_in_executor(None, lambda: ydl.extract_info(query, download=False))
                if 'entries' in info and len(info['entries']) > 0:
                    url = info['entries'][0]['webpage_url']
                    await process_download(url, chat_id, context, is_audio_only=True)
                    await msg.delete()
                else:
                    await msg.edit_text(f"❌ '{query}' tidak ditemukan.")
        except Exception as e:
            await msg.edit_text(f"❌ Error: {str(e)}")

    # Deteksi Link URL
    elif "http" in text:
        keyboard = InlineKeyboardMarkup([
            [
                InlineKeyboardButton("🎵 Audio", callback_data=f"dl_mp3|{text}"),
                InlineKeyboardButton("🎬 Video", callback_data=f"dl_mp4|{text}")
            ],
            [InlineKeyboardButton("❌ Batalkan Opsi", callback_data="cancel_opt")]
        ])
        await update.message.reply_text("Pilih format media:", reply_markup=keyboard)

# --- PENANGANAN PERINTAH /BATAL ---
async def cancel_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("❌ Opsi atau proses telah dibatalkan.")

# --- PENANGANAN TOMBOL (CALLBACK) ---
async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    # Fungsi tombol batal (menghapus pesan pilihan)
    if query.data == "cancel_opt":
        await query.message.delete()
        return

    data_parts = query.data.split('|')
    action, url = data_parts[0], data_parts[1]
    
    is_audio = (action == "dl_mp3")
    status_msg = await context.bot.send_message(query.message.chat_id, "⏳ Memproses (Mode Cepat)...")
    await process_download(url, query.message.chat_id, context, is_audio_only=is_audio)
    await status_msg.delete()

# --- EKSEKUSI UTAMA ---
async def main():
    token = os.environ.get("TELEGRAM_TOKEN")
    if not token:
        print("❌ ERROR: TELEGRAM_TOKEN tidak ditemukan!")
        return

    application = Application.builder().token(token).build()
    
    # Mendaftarkan handler perintah
    application.add_handler(CommandHandler("start", lambda u, c: u.message.reply_text("👋 Halo! Kirim link atau ketik 'play [judul lagu]'.")))
    application.add_handler(CommandHandler("batal", cancel_command)) # Sesuai set comment BotFather
    
    # Handler pesan teks dan tombol
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    application.add_handler(CallbackQueryHandler(button_callback))

    # Menjalankan server web dan bot secara paralel
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
    
