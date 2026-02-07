import os, asyncio, requests, time
from pyrogram import Client, filters, types
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton, InputMediaPhoto
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
    
    # Peraturan 1: Bedakan link dan pesan biasa (Anti-Spam)
    if not is_url(url): 
        return 

    status_msg = await message.reply("🔍 `Menganalisis konten...`")
    
    # Konfigurasi Akurat: extract_flat=False agar bisa membaca redirect TikTok
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False, 
        'skip_download': True,
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # --- LOGIKA DETEKSI FOTO / ALBUM (TikTok Slide/IG) ---
            image_list = []
            
            # Cek jika ada entries (Album/Slide)
            if 'entries' in info:
                for entry in info['entries']:
                    if entry.get('url'):
                        image_list.append(entry.get('url'))
            
            # Cek jika info dasar adalah foto tunggal
            elif info.get('url') and any(x in info.get('url', '').lower() for x in ['.jpg', '.jpeg', '.png', '.webp']):
                image_list.append(info.get('url'))

            # Peraturan 2: Jika foto banyak kirim album, jika satu kirim tunggal
            if image_list:
                await status_msg.delete()
                if len(image_list) == 1:
                    await message.reply_photo(photo=image_list[0], caption="✅ **Foto Berhasil Diunduh**")
                else:
                    # Ambil maksimal 10 agar tidak overload
                    media_group = [InputMediaPhoto(img) for img in image_list[:10]]
                    await message.reply_media_group(media=media_group)
                return

            # --- LOGIKA VIDEO (Tetap seperti struktur asli) ---
            video_id = info.get('id')
            download_db[video_id] = url
            
            buttons = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("🎬 Video", callback_data=f"vid_{video_id}"),
                    InlineKeyboardButton("🎵 Audio", callback_data=f"aud_{video_id}")
                ]
            ])

            thumb = info.get('thumbnail') or "https://via.placeholder.com/300"
            await message.reply_photo(
                photo=thumb, 
                caption=f"📝 **Judul:** `{info.get('title', 'Video Content')}`\n⏱️ **Durasi:** `{time.strftime('%M:%S', time.gmtime(info.get('duration', 0)))}`", 
                reply_markup=buttons
            )
            await status_msg.delete()

    except Exception as e:
        # Fallback jika yt-dlp gagal mendeteksi link gambar secara otomatis
        if any(url.lower().endswith(x) for x in ['.jpg', '.jpeg', '.png', '.webp']):
            try:
                await message.reply_photo(photo=url, caption="✅ **Foto (Direct Link)**")
                return await status_msg.delete()
            except: pass
        
        await status_msg.edit(f"❌ **Gagal:** `Link tidak didukung atau privat.`")

# ==========================================
# CALLBACK HANDLER (TETAP SAMA - 100% AMAN)
# ==========================================
@app.on_callback_query()
async def on_click(client, cb):
    action, v_id = cb.data.split("_")
    url = download_db.get(v_id)
    
    if not url:
        return await cb.answer("❌ Data kedaluwarsa!", show_alert=True)

    await cb.message.edit_caption("⚡ `Sedang mengunduh...` (RAM dipantau)")
    
    is_audio = action == "aud"
    # Menggunakan User ID agar file 100% tidak tertukar saat download bareng
    path = f"downloads/{cb.from_user.id}_{v_id}_{int(time.time())}.%(ext)s"
    
    ydl_opts = {
        'format': 'bestaudio/best' if is_audio else 'best[filesize<50M]',
        'outtmpl': path,
        'quiet': True,
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)

        if is_audio:
            await client.send_audio(cb.message.chat.id, audio=filename)
        else:
            await client.send_video(cb.message.chat.id, video=filename)
        
        # Pembersihan Disk & RAM
        if os.path.exists(filename): os.remove(filename)
        if v_id in download_db: del download_db[v_id]
        await cb.message.delete()

    except Exception as e:
        await cb.message.reply(f"❌ **Gagal:** `{str(e)[:50]}`")
        if v_id in download_db: del download_db[v_id]

if __name__ == "__main__":
    if not os.path.exists("downloads"): os.makedirs("downloads")
    Thread(target=run_web, daemon=True).start()
    app.run()
