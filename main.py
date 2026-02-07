import os, asyncio, requests, time, re, shutil
from pyrogram import Client, filters, types
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton, InputMediaPhoto
from yt_dlp import YoutubeDL
from flask import Flask
from threading import Thread

# --- ANTI-MATI KOYEB & DOUBLE-LAYER CLEANUP ---
app_web = Flask('')
@app_web.route('/')
def home(): return "Bot Pro Aktif - Extreme Storage Management"

def run_web():
    port = int(os.environ.get("PORT", 8000))
    app_web.run(host='0.0.0.0', port=port)

# FITUR: Pembersihan 1 Menit & 24 Jam
def storage_manager():
    last_daily_reset = time.time()
    while True:
        try:
            now = time.time()
            folder = "downloads"
            
            if os.path.exists(folder):
                for f in os.listdir(folder):
                    f_path = os.path.join(folder, f)
                    # LAPISAN 1: Hapus file tidak terpakai/sisa setiap 1 menit (60 detik)
                    if os.stat(f_path).st_mtime < now - 60:
                        if os.path.isfile(f_path):
                            os.remove(f_path)
                            print(f"🧹 1-Min Cleanup: {f} deleted.")

            # LAPISAN 2: Reset Memori & Database setiap 24 Jam
            if now - last_daily_reset >= 86400:
                download_db.clear()
                if os.path.exists(folder):
                    shutil.rmtree(folder)
                    os.makedirs(folder)
                last_daily_reset = now
                print("♻️ 24-Hour Global Reset Completed.")

        except Exception as e:
            print(f"Storage Manager Error: {e}")
        
        time.sleep(60) # Interval pengecekan setiap 1 menit

# --- CONFIG ---
api_id = int(os.environ.get("API_ID", 0))
api_hash = os.environ.get("API_HASH", "")
token = os.environ.get("BOT_TOKEN", "")

app = Client("dl_pro", api_id=api_id, api_hash=api_hash, bot_token=token, ipv6=False)
download_db = {}

def is_url(text):
    return text.startswith(("http://", "https://"))

# API INTERNAL FOTO (Sesuai Peraturan Awal)
def internal_photo_downloader(url):
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/110.0.0.0 Safari/537.36"}
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
# HANDLER UTAMA (ANTI-SPAM & AUTO-DETECTION)
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
                    InlineKeyboardButton("🎵 Audio", callback_data=f"aud_{video_id}")
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
# CALLBACK HANDLER
# ==========================================
@app.on_callback_query()
async def on_click(client, cb):
    action, v_id = cb.data.split("_")
    url = download_db.get(v_id)
    if not url: return await cb.answer("❌ Data kedaluwarsa!", show_alert=True)

    await cb.message.edit_caption("⚡ `Sedang mengunduh...` (RAM dipantau)")
    is_audio = action == "aud"
    path = f"downloads/{cb.from_user.id}_{v_id}_{int(time.time())}.%(ext)s"
    
    ydl_opts = {'format': 'bestaudio/best' if is_audio else 'best[filesize<50M]', 'outtmpl': path, 'quiet': True}
    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
        if is_audio: await client.send_audio(cb.message.chat.id, audio=filename)
        else: await client.send_video(cb.message.chat.id, video=filename)
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
    print("✅ System Ready: Extreme Cleanup & 24H Reset Enabled")
    app.run()
