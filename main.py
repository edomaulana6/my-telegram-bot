import os, asyncio, requests, time
from pyrogram import Client, filters, types
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from yt_dlp import YoutubeDL
from flask import Flask
from threading import Thread

# --- ANTI-MATI KOYEB ---
app_web = Flask('')
@app_web.route('/')
def home(): return "Bot Pro Aktif - RAM Optimized"

def run_web():
    port = int(os.environ.get("PORT", 8000))
    app_web.run(host='0.0.0.0', port=port)

# --- CONFIG ---
api_id = int(os.environ.get("API_ID", 0))
api_hash = os.environ.get("API_HASH", "")
token = os.environ.get("BOT_TOKEN", "")

app = Client("dl_pro", api_id=api_id, api_hash=api_hash, bot_token=token, ipv6=False)

# Database sementara
download_db = {}

def is_url(text):
    return text.startswith(("http://", "https://"))

# ==========================================
# HANDLER UTAMA
# ==========================================
@app.on_message(filters.private & ~filters.command(["start", "ping"]))
async def handle_message(client, message):
    url = message.text
    if not is_url(url):
        return await message.reply("👋 Kirimkan **Link Video** untuk mendownload.")

    status_msg = await message.reply("🔍 `Menganalisis link...`")
    
    try:
        # PROTEKSI RAM: Batasi data yang masuk ke RAM
        with YoutubeDL({'quiet': True, 'noplaylist': True}) as ydl:
            info = ydl.extract_info(url, download=False)
            video_id = info.get('id')
            
            # Simpan hanya yang diperlukan
            download_db[video_id] = url

            buttons = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("🎬 Video", callback_data=f"vid_{video_id}"),
                    InlineKeyboardButton("🎵 Audio", callback_data=f"aud_{video_id}")
                ]
            ])

            await message.reply_photo(
                photo=info.get('thumbnail'), 
                caption=f"📝 **Judul:** `{info.get('title')}`\n⏱️ **Durasi:** `{time.strftime('%M:%S', time.gmtime(info.get('duration', 0)))}`", 
                reply_markup=buttons
            )
            await status_msg.delete()

    except Exception as e:
        await status_msg.edit(f"❌ **Gagal:** `{str(e)[:40]}`")

# ==========================================
# CALLBACK HANDLER DENGAN AUTO-CLEAR
# ==========================================
@app.on_callback_query()
async def on_click(client, cb):
    action, v_id = cb.data.split("_")
    url = download_db.get(v_id) # Ambil data
    
    if not url:
        return await cb.answer("❌ Data kedaluwarsa!", show_alert=True)

    await cb.message.edit_caption("⚡ `Sedang mengunduh...` (RAM dipantau)")
    
    is_audio = action == "aud"
    path = f"downloads/{v_id}_{int(time.time())}.%(ext)s"
    
    ydl_opts = {
        'format': 'bestaudio/best' if is_audio else 'best[filesize<50M]', # PROTEKSI: Maks 50MB
        'outtmpl': path,
        'quiet': True,
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)

        # Kirim File
        if is_audio:
            await client.send_audio(cb.message.chat.id, audio=filename)
        else:
            await client.send_video(cb.message.chat.id, video=filename)
        
        # --- FITUR AUTO-CLEAR (AKURASI 100%) ---
        if os.path.exists(filename): 
            os.remove(filename) # Hapus file fisik
        
        if v_id in download_db:
            del download_db[v_id] # Hapus data dari RAM (Database)
            
        await cb.message.delete()
        print(f"✅ RAM Cleared for ID: {v_id}") # Laporan di log

    except Exception as e:
        await cb.message.reply(f"❌ **Gagal:** `{str(e)[:50]}`")
        # Tetap hapus data jika gagal agar tidak menumpuk
        if v_id in download_db: del download_db[v_id]

if __name__ == "__main__":
    if not os.path.exists("downloads"): os.makedirs("downloads")
    Thread(target=run_web, daemon=True).start()
    app.run()
