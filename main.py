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
# HANDLER UTAMA (DETEKSI CERDAS)
# ==========================================
@app.on_message(filters.private & ~filters.command(["start", "ping"]))
async def handle_message(client, message):
    url = message.text
    
    # 1. Validasi: Bedakan Link dan Pesan Biasa
    if not is_url(url):
        # Jika bukan link, bot diam atau beri respon sopan (menghindari spam)
        return 

    status_msg = await message.reply("🔍 `Menganalisis konten...`")
    
    try:
        with YoutubeDL({'quiet': True, 'noplaylist': False}) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # 2. Logika Deteksi Foto (Instagram/Pinterest/DLL)
            # Mengecek apakah entri mengandung banyak gambar (Album)
            if 'entries' in info or (info.get('extract_flat') is False and info.get('images')):
                images = info.get('images', []) or [info.get('url')] if info.get('ext') in ['jpg', 'png', 'jpeg', 'webp'] else []
                
                # Jika playlist/album ditemukan
                if 'entries' in info:
                    images = [e.get('url') for e in info['entries'] if e.get('url')]

                if images:
                    await status_msg.delete()
                    if len(images) == 1:
                        # Kirim foto tunggal
                        await message.reply_photo(photo=images[0], caption="✅ **Foto Berhasil Diunduh**")
                    else:
                        # Kirim album (Media Group) agar tidak spam chat
                        media_group = [InputMediaPhoto(img) for img in images[:10]] # Limit 10 agar stabil
                        await message.reply_media_group(media=media_group)
                    return

            # 3. Logika Video (Struktur Asli Dipertahankan)
            video_id = info.get('id')
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
        # Menghindari edit pesan jika status_msg sudah dihapus/error
        try: await status_msg.edit(f"❌ **Gagal:** `{str(e)[:40]}`")
        except: pass

# ==========================================
# CALLBACK HANDLER (TETAP SAMA - 100% AKURAT)
# ==========================================
@app.on_callback_query()
async def on_click(client, cb):
    action, v_id = cb.data.split("_")
    url = download_db.get(v_id)
    
    if not url:
        return await cb.answer("❌ Data kedaluwarsa!", show_alert=True)

    await cb.message.edit_caption("⚡ `Sedang mengunduh...` (RAM dipantau)")
    
    is_audio = action == "aud"
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
