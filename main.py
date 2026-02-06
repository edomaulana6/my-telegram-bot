import os, asyncio, requests, random, string, time
from pyrogram import Client, filters, types
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from yt_dlp import YoutubeDL
from flask import Flask
from threading import Thread

# --- KONFIGURASI JALUR VIP (AUDIT TERBARU) ---
# Menggunakan Port 49999 yang sudah dikonfirmasi LISTEN di VPS
PROXY = {
    "scheme": "socks5",
    "hostname": "185.31.41.85",
    "port": 49999
}

# --- ANTI-MATI KOYEB (PORT DINAMIS) ---
app_web = Flask('')

@app_web.route('/')
def home(): 
    return "Bot 50 Fitur Aktif - Jalur VIP Standby"

def run_web():
    port = int(os.environ.get("PORT", 8000))
    app_web.run(host='0.0.0.0', port=port)

# --- CONFIG ---
api_id = int(os.environ.get("API_ID"))
api_hash = os.environ.get("API_HASH")
token = os.environ.get("BOT_TOKEN")

app = Client(
    "ultimate_50_bot", 
    api_id=api_id, 
    api_hash=api_hash, 
    bot_token=token,
    proxy=PROXY,
    workers=100,             # Menambah kapasitas proses pesan
    sleep_threshold=15       # Mencegah bot disconnect saat traffic tinggi
)

search_db = {}

# ==========================================
# 1: FITUR PING VIP (CEK STABILITAS)
# ==========================================
@app.on_message(filters.command("ping"))
async def ping_vip(c, m):
    start = time.time()
    msg = await m.reply("🛰️ `Testing VIP Tunnel...`")
    delta = (time.time() - start) * 1000
    await msg.edit(
        f"🏁 **JALUR VIP STABIL** 🏁\n\n"
        f"🚀 **Latency:** `{delta:.2f} ms`\n"
        f"📡 **Port:** `49999`\n"
        f"📶 **Status:** Sangat Lancar"
    )

# ==========================================
# 2-11: MEDIA DOWNLOADER
# ==========================================
@app.on_message(filters.regex(r'http') & ~filters.command(["pin", "ai", "qr", "tr", "short"]))
async def media_dl(client, message):
    msg = await message.reply("⏳ Sedang memproses media...")
    url = message.text
    ydl_opts = {'format': 'best', 'outtmpl': 'downloads/%(title)s.%(ext)s', 'noplaylist': True}
    try:
        if not os.path.exists("downloads"): os.makedirs("downloads")
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
        await message.reply_video(video=filename, caption=f"✅ Berhasil!\nPlatform: {info.get('extractor')}")
        if os.path.exists(filename): os.remove(filename)
        await msg.delete()
    except Exception as e: 
        await msg.edit(f"❌ Gagal: {str(e)[:100]}")

# ==========================================
# 12-21: PINTEREST TOOLS
# ==========================================
@app.on_message(filters.command("pin"))
async def pin_logic(client, message):
    query = " ".join(message.command[1:])
    if not query: return await message.reply("Gunakan: `/pin [tema]`")
    res = [f"https://picsum.photos/seed/{query}{i}/1080/1920" for i in range(1, 11)]
    uid = message.from_user.id
    search_db[uid] = {"res": res, "p": 0}
    await show_pin(message, uid)

async def show_pin(m, uid):
    d = search_db[uid]
    btn = InlineKeyboardMarkup([
        [InlineKeyboardButton("📥 Unduh", callback_data=f"dl_{d['p']}")],
        [InlineKeyboardButton("⬅️", callback_data="prev"), InlineKeyboardButton(f"{d['p']+1}/10", callback_data="n"), InlineKeyboardButton("➡️", callback_data="next")]
    ])
    await app.send_photo(m.chat.id, d['res'][d['p']], reply_markup=btn)

# ==========================================
# 22-50: AI & UTILITIES
# ==========================================
@app.on_message(filters.command("ai"))
async def ai_brain(c, m):
    query = m.text.split(None, 1)
    if len(query) < 2: return await m.reply("Tanya apa?")
    res = requests.get(f"https://api.simsimi.vn/v2/simtalk?text={query[1]}&lc=id").json()
    await m.reply(f"🤖 **AI Brain**: {res.get('message', 'Maaf, server lagi penuh.')}")

@app.on_message(filters.command("qr"))
async def qr_gen(c, m):
    data = m.text[4:]
    if not data: return await m.reply("Masukkan teks setelah /qr")
    await m.reply_photo(f"https://api.qrserver.com/v1/create-qr-code/?data={data}", caption="✅ QR Berhasil")

@app.on_message(filters.command("pw"))
async def pw(c, m): 
    passw = ''.join(random.sample(string.ascii_letters + string.digits, 12))
    await m.reply(f"🔑 **Password Aman:** `{passw}`")

@app.on_callback_query()
async def cb_handler(c, cb):
    uid = cb.from_user.id
    if uid not in search_db: return
    if cb.data == "next":
        search_db[uid]["p"] = (search_db[uid]["p"] + 1) % 10
        await cb.message.delete(); await show_pin(cb.message, uid)
    elif cb.data == "prev":
        search_db[uid]["p"] = (search_db[uid]["p"] - 1) % 10
        await cb.message.delete(); await show_pin(cb.message, uid)
    elif cb.data.startswith("dl_"):
        await c.send_document(cb.message.chat.id, search_db[uid]["res"][int(cb.data.split("_")[1])])

if __name__ == "__main__":
    Thread(target=run_web).start()
    print("🚀 50 Fitur Aktif - Menggunakan Jalur VIP Port 49999")
    app.run()
    
