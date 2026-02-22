import os
import asyncio
from aiohttp import web
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import yt_dlp

# --- Web Server Ringan (Health Check Koyeb) ---
async def handle_health(request):
    return web.Response(text="Bot Aktif 100%")

async def start_web_server():
    app = web.Application()
    app.router.add_get('/', handle_health)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', int(os.environ.get('PORT', 8080)))
    await site.start()

# --- Logika Bot Downloader ---
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Halo! Kirimkan link Douyin/TikTok/YouTube untuk diunduh.")

async def download_video(update: Update, context: ContextTypes.DEFAULT_TYPE):
    url = update.message.text
    chat_id = update.message.chat_id
    
    # Pesan status awal
    status_msg = await update.message.reply_text("🔍 Sedang memproses link...")

    # Opsi yt-dlp (Sangat Ringan)
    ydl_opts = {
        'format': 'best',
        'outtmpl': f'video_{chat_id}.%(ext)s',
        'quiet': True,
        'no_warnings': True,
    }

    try:
        # Menjalankan proses blocking yt-dlp di thread berbeda agar bot tidak lag
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(None, lambda: extract_and_download(url, ydl_opts))
        filename = info['filename']

        await status_msg.edit_text("📤 Mengirim video...")
        
        with open(filename, 'rb') as video:
            await context.bot.send_video(chat_id=chat_id, video=video)
        
        # Hapus file setelah terkirim agar penyimpanan bersih
        if os.path.exists(filename):
            os.remove(filename)
        await status_msg.delete()

    except Exception as e:
        await status_msg.edit_text(f"❌ Error: {str(e)}")

def extract_and_download(url, opts):
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return {'filename': ydl.prepare_filename(info)}

async def main():
    # Ambil token dari Environment Variable
    token = os.environ.get("TELEGRAM_TOKEN")
    if not token:
        print("Error: TELEGRAM_TOKEN belum diatur!")
        return

    # Inisialisasi Bot
    application = Application.builder().token(token).build()

    # Handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, download_video))

    # Jalankan Web Server dan Bot secara bersamaan
    await start_web_server()
    
    async with application:
        await application.initialize()
        await application.start()
        await application.updater.start_polling()
        # Menjaga script tetap berjalan
        await asyncio.Event().wait()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
                         
