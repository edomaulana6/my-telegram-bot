import os, asyncio, requests, time
from pyrogram import Client, filters
from yt_dlp import YoutubeDL
from flask import Flask
from threading import Thread

# --- ANTI-MATI KOYEB (PORT DINAMIS) ---
# Menjaga agar Koyeb tidak mematikan bot karena dianggap 'idle'
app_web = Flask('')
@app_web.route('/')
def home(): 
    return "Bot Downloader Aktif - Status: Healthy"

def run_web():
    # Koyeb akan memberikan PORT secara otomatis melalui environment variable
    port = int(os.environ.get("PORT", 8000))
    app_web.run(host='0.0.0.0', port=port)

# --- CONFIG (Ambil dari Settings Koyeb) ---
# Pastikan kamu sudah mengisi API_ID, API_HASH, dan BOT_TOKEN di dashboard Koyeb
api_id = int(os.environ.get("API_ID", 0))
api_hash = os.environ.get("API_HASH", "")
token = os.environ.get("BOT_TOKEN", "")

app = Client(
    "downloader_bot", 
    api_id=api_id, 
    api_hash=api_hash, 
    bot_token=token,
    workers=50 
)

# ==========================================
# CORE DOWNLOADER (YouTube, TikTok, IG, FB)
# ==========================================
@app.on_message(filters.regex(r'http') & filters.private)
async def media_dl(client, message):
    msg = await message.reply("⏳ `Sedang memproses link, tunggu sebentar...`")
    url = message.text
    
    # Lokasi folder download
    download_path = "downloads"
    if not os.path.exists(download_path): 
        os.makedirs(download_path)

    ydl_opts = {
        'format': 'best',
        'outtmpl': f'{download_path}/%(title)s.%(ext)s',
        'noplaylist': True,
        'quiet': True,
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
        
        await message.reply_video(
            video=filename, 
            caption=f"✅ **Berhasil Diunduh!**\n\n📂 **Judul:** `{info.get('title')}`\n🌐 **Sumber:** `{info.get('extractor_key')}`"
        )
        
        # Hapus file setelah terkirim agar penyimpanan tidak penuh
        if os.path.exists(filename): 
            os.remove(filename)
        await msg.delete()

    except Exception as e: 
        await msg.edit(f"❌ **Gagal:** Link tidak didukung atau video terlalu besar.\nError: `{str(e)[:50]}`")

@app.on_message(filters.command("start"))
async def start_cmd(c, m):
    await m.reply("👋 **Halo Bos!**\nKirimkan link video (YouTube, TikTok, IG) dan saya akan mendownloadnya untukmu.")

@app.on_message(filters.command("ping"))
async def ping(c, m):
    start = time.time()
    latency = (time.time() - start) * 1000
    await m.reply(f"🚀 **PONG!!**\n⚡ **Latency:** `{latency:.2f} ms`")

if __name__ == "__main__":
    # Jalankan server web untuk bypass check Koyeb
    Thread(target=run_web).start()
    print("✅ Bot Downloader Siap Jalur Direct!")
    app.run()
