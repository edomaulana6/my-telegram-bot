import os, asyncio, requests, time, re, shutil
from pyrogram import Client, filters, types
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton, InputMediaPhoto
from yt_dlp import YoutubeDL
from flask import Flask
from threading import Thread

# --- ANTI-MATI KOYEB & DOUBLE-LAYER CLEANUP ---
app_web = Flask('')
@app_web.route('/')
def home(): return "Bot Pro Aktif - Audio Fix Optimized"

def run_web():
    port = int(os.environ.get("PORT", 8000))
    app_web.run(host='0.0.0.0', port=port)

def storage_manager():
    last_daily_reset = time.time()
    while True:
        try:
            now = time.time()
            folder = "downloads"
            if os.path.exists(folder):
                for f in os.listdir(folder):
                    f_path = os.path.join(folder, f)
                    if os.stat(f_path).st_mtime < now - 60:
                        if os.path.isfile(f_path):
                            os.remove(f_path)
            if now - last_daily_reset >= 86400:
                download_db.clear()
                if os.path.exists(folder):
                    shutil.rmtree(folder)
                    os.makedirs(folder)
                last_daily_reset = now
        except: pass
        time.sleep(60)

# --- CONFIG ---
api_id = int(os.environ.get("API_ID", 0))
api_hash = os.environ.get("API_HASH", "")
token = os.environ.get("BOT_TOKEN", "")

app = Client("dl_pro", api_id=api_id, api_hash=api_hash, bot_token=token, ipv6=False)
download_db = {}

def is_url(text):
    return text.startswith(("http://", "https://"))

def internal_photo_downloader(url):
    try:
        headers = {"User-Agent": "Mozilla/5.0"}
        if "tiktok.com" in url:
            response = requests.get(url, headers=headers, timeout=10)
            images = re.findall(r'"display_image":{"url_list":\["(.*?)"', response.text)
            if not images:
                images = re.findall(r'"download_addr":{"url_list":\["(.*?)"', response.text)
            clean_images = [img.replace("\\u002F", "/") for img in images]
            return list(dict.fromkeys(clean_images))
        if any(url.lower().endswith(x) for x in ['.jpg', '.jpeg', '.png', '.webp']):
            return [url]
        return None
    except: return None

# ==========================================
# HANDLER UTAMA
# ==========================================
@app.on_message(filters.private & ~filters.command(["start", "ping"]))
async def handle_message(client, message):
    url = message.text
    if not is_url(url): return 

    status_msg = await message.reply("🔍 `Menganalisis konten...`")
    
    photos = internal_photo_downloader(url)
    if photos:
        await status_msg.delete()
        if len(photos) == 1:
            return await message.reply_photo(photo=photos[0], caption="✅ **Foto Berhasil Diunduh**")
        else:
            media_group = [InputMediaPhoto(img) for img in photos[:10]]
            return await message.reply_media_group(media=media_group)

    ydl_opts = {'quiet': True, 'no_warnings': True, 'extract_flat': False}
    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            video_id = info.get('id')
            download_db[video_id] = url
            
            buttons = InlineKeyboardMarkup([
                [
                    InlineKeyboardButton("🎬 Video", callback_data=f"vid_{video_id}"),
                    InlineKeyboardButton("🎵 Audio (MP3)", callback_data=f"aud_{video_id}")
                ]
            ])
            await message.reply_photo(
                photo=info.get('thumbnail') or "https://via.placeholder.com/300", 
                caption=f"📝 **Judul:** `{info.get('title', 'Video Content')}`\n⏱️ **Durasi:** `{time.strftime('%M:%S', time.gmtime(info.get('duration', 0)))}`", 
                reply_markup=buttons
            )
            await status_msg.delete()
    except:
        await status_msg.edit("❌ **Gagal:** `Konten tidak didukung.`")

# ==========================================
# CALLBACK HANDLER (PERBAIKAN AUDIO MP3)
# ==========================================
@app.on_callback_query()
async def on_click(client, cb):
    action, v_id = cb.data.split("_")
    url = download_db.get(v_id)
    if not url: return await cb.answer("❌ Data kedaluwarsa!", show_alert=True)

    await cb.message.edit_caption("⚡ `Sedang memproses...` (RAM dipantau)")
    is_audio = action == "aud"
    
    # Path dasar (tanpa ekstensi karena akan ditentukan oleh yt-dlp)
    path = f"downloads/{cb.from_user.id}_{v_id}_{int(time.time())}"
    
    # PERBAIKAN LOGIKA YT-DLP UNTUK MP3
    if is_audio:
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': f"{path}.%(ext)s",
            'quiet': True,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }],
        }
    else:
        ydl_opts = {
            'format': 'best[filesize<50M]',
            'outtmpl': f"{path}.%(ext)s",
            'quiet': True,
        }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            # Dapatkan path file yang sebenarnya setelah post-processing
            filename = ydl.prepare_filename(info)
            if is_audio:
                # Pastikan nama file berakhiran .mp3 setelah konversi
                filename = os.path.splitext(filename)[0] + ".mp3"

        if is_audio:
            await client.send_audio(cb.message.chat.id, audio=filename, title=info.get('title'))
        else:
            await client.send_video(cb.message.chat.id, video=filename)
        
        # Pembersihan Instan (Akurasi 100%)
        if os.path.exists(filename): os.remove(filename)
        if v_id in download_db: del download_db[v_id]
        await cb.message.delete()

    except Exception as e:
        await cb.message.reply(f"❌ **Gagal:** `{str(e)[:50]}`")
        if v_id in download_db: del download_db[v_id]

if __name__ == "__main__":
    if not os.path.exists("downloads"): os.makedirs("downloads")
    Thread(target=run_web, daemon=True).start()
    Thread(target=storage_manager, daemon=True).start()
    app.run()
