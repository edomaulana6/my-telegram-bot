import os, asyncio, requests, time
from pyrogram import Client, filters, types
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from yt_dlp import YoutubeDL
from flask import Flask
from threading import Thread

# --- ANTI-MATI KOYEB ---
app_web = Flask('')
@app_web.route('/')
def home(): return "Bot Pro Aktif"

def run_web():
    port = int(os.environ.get("PORT", 8000))
    app_web.run(host='0.0.0.0', port=port)

# --- CONFIG ---
api_id = int(os.environ.get("API_ID", 0))
api_hash = os.environ.get("API_HASH", "")
token = os.environ.get("BOT_TOKEN", "")

app = Client("dl_pro", api_id=api_id, api_hash=api_hash, bot_token=token, ipv6=True)

# Database sementara untuk menyimpan info download agar tidak spam/re-download
download_db = {}

# ==========================================
# FUNGSI FILTER: MEMBEDAKAN LINK & PESAN BIASA
# ==========================================
def is_url(text):
    return text.startswith(("http://", "https://"))

# ==========================================
# HANDLER UTAMA: KIRIM LINK LANGSUNG
# ==========================================
@app.on_message(filters.private & ~filters.command(["start", "ping"]))
async def handle_message(client, message):
    url = message.text
    
    # 1. Cek apakah ini link atau cuma pesan biasa
    if not is_url(url):
        # Jika bukan link, bot hanya membalas biasa (menghindari spam download)
        return await message.reply("👋 Bos, kirimkan **Link Video** yang valid untuk mulai mendownload.")

    # 2. Proses Ambil Informasi (Bukan Download Dulu)
    status_msg = await message.reply("🔍 `Menganalisis link...`")
    
    try:
        with YoutubeDL({'quiet': True, 'noplaylist': True}) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Ekstraksi Data Informasi
            title = info.get('title', 'Video')
            uploader = info.get('uploader', 'Unknown')
            views = info.get('view_count', 0)
            likes = info.get('like_count', 0)
            duration = time.strftime('%M:%S', time.gmtime(info.get('duration', 0)))
            thumb = info.get('thumbnail')
            video_id = info.get('id')

            # Simpan ke database sementara (agar tombol tahu apa yang harus didownload)
            download_db[video_id] = url

            # 3. Buat Tombol Unduh
            buttons = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("🎬 Video (MP4)", callback_data=f"vid_{video_id}"),
                    InlineKeyboardButton("🎵 Audio (MP3)", callback_data=f"aud_{video_id}")
                ]
            ])

            caption = (
                f"📝 **Judul:** `{title}`\n"
                f"👤 **User:** `{uploader}`\n"
                f"⏱️ **Durasi:** `{duration}`\n"
                f"👁️ **Views:** `{views:,}` | ❤️ **Likes:** `{likes:,}`\n\n"
                f"Silakan pilih format di bawah ini:"
            )

            # Kirim Thumbnail dengan Info & Tombol
            if thumb:
                await message.reply_photo(photo=thumb, caption=caption, reply_markup=buttons)
            else:
                await message.reply(caption, reply_markup=buttons)
            
            await status_msg.delete()

    except Exception as e:
        await status_msg.edit(f"❌ **Link Bermasalah:** Pastikan link publik.\n`Error: {str(e)[:40]}`")

# ==========================================
# CALLBACK HANDLER: PROSES TOMBOL KLIK
# ==========================================
@app.on_callback_query()
async def on_click(client, cb):
    action, v_id = cb.data.split("_")
    url = download_db.get(v_id)
    
    if not url:
        return await cb.answer("❌ Data kedaluwarsa, kirim ulang link!", show_alert=True)

    await cb.message.edit_caption("⚡ `Memulai proses unduhan...` (Ini mungkin memakan waktu)")
    
    is_audio = action == "aud"
    path = f"downloads/{v_id}_{int(time.time())}.%(ext)s"
    
    ydl_opts = {
        'format': 'bestaudio/best' if is_audio else 'best',
        'outtmpl': path,
        'quiet': True,
    }
    if is_audio:
        ydl_opts['postprocessors'] = [{'key': 'FFmpegExtractAudio','preferredcodec': 'mp3','preferredquality': '192'}]

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            if is_audio: filename = filename.rsplit('.', 1)[0] + ".mp3"

        if is_audio:
            await client.send_audio(cb.message.chat.id, audio=filename, caption=f"✅ `{info['title']}`")
        else:
            await client.send_video(cb.message.chat.id, video=filename, caption=f"✅ `{info['title']}`")
        
        if os.path.exists(filename): os.remove(filename)
        await cb.message.delete()
    except Exception as e:
        await cb.message.reply(f"❌ **Gagal download:** `{str(e)[:50]}`")

if __name__ == "__main__":
    Thread(target=run_web, daemon=True).start()
    app.run()
