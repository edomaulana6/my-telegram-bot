import os
import asyncio
from aiohttp import web
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import yt_dlp

# --- Web Server Ringan (Health Check Koyeb) ---
# Fungsi ini menjawab "tamu" dari Koyeb agar status bot menjadi Healthy
async def handle_health(request):
    return web.Response(text="Bot Aktif 100%", status=200)

async def start_web_server():
    app = web.Application()
    app.router.add_get('/', handle_health)
    runner = web.AppRunner(app)
    await runner.setup()
    
    # KUNCI MATI KE 8000 (Sesuai settingan dashboard kamu)
    # Menggunakan 0.0.0.0 agar bisa diakses oleh sistem internal Koyeb
    port = 8000 
    
    site = web.TCPSite(runner, '0.0.0.0', port)
    await site.start()
    print(f"✅ Web Server FIX running on port: {port}")

# --- Logika Pengunduh (yt-dlp) ---
def extract_and_download(url, opts):
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        return {'filename': ydl.prepare_filename(info)}

# --- Handler Pesan Bot ---
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("Halo! Kirimkan link Douyin/TikTok/YouTube untuk diunduh.")

async def download_video(update: Update, context: ContextTypes.DEFAULT_TYPE):
    url = update.message.text
    chat_id = update.message.chat_id
    
    # Memberi tahu user bahwa proses sedang berjalan
    status_msg = await update.message.reply_text("🔍 Sedang memproses link...")

    # Konfigurasi yt-dlp yang stabil dan ringan
    ydl_opts = {
        'format': 'best',
        'outtmpl': f'video_{chat_id}.%(ext)s',
        'quiet': True,
        'no_warnings': True,
    }

    try:
        # Menjalankan proses berat di thread berbeda agar bot tidak hang
        loop = asyncio.get_event_loop()
        info = await loop.run_in_executor(None, lambda: extract_and_download(url, ydl_opts))
        filename = info['filename']

        await status_msg.edit_text("📤 Mengirim video...")
        
        # Mengirim file ke Telegram
        with open(filename, 'rb') as video:
            await context.bot.send_video(chat_id=chat_id, video=video)
        
        # Hapus file setelah terkirim agar storage Koyeb tidak penuh (Efisiensi 100%)
        if os.path.exists(filename):
            os.remove(filename)
            
        await status_msg.delete()

    except Exception as e:
        await status_msg.edit_text(f"❌ Terjadi kesalahan: {str(e)}")

# --- Fungsi Utama ---
async def main():
    # Mengambil token dari Environment Variables
    token = os.environ.get("TELEGRAM_TOKEN")
    if not token:
        print("Error: Variabel TELEGRAM_TOKEN belum diatur di Koyeb!")
        return

    # Inisialisasi Bot dengan library terbaru (v20.x)
    application = Application.builder().token(token).build()

    # Menambahkan perintah bot
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, download_video))

    # 1. Jalankan Web Server DULU agar Koyeb melihat bot "Healthy"
    await start_web_server()
    
    # 2. Jalankan Bot Polling
    async with application:
        await application.initialize()
        await application.start()
        await application.updater.start_polling()
        # Menjaga script agar tidak berhenti
        await asyncio.Event().wait()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        pass
    
