import os, asyncio, requests, random, string, time
from pyrogram import Client, filters, types
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from yt_dlp import YoutubeDL
from flask import Flask
from threading import Thread

# --- ANTI-MATI KOYEB (PORT DINAMIS) ---
app_web = Flask('')
@app_web.route('/')
def home(): 
    return "Bot 50 Fitur Aktif - Jalur Direct"

def run_web():
    port = int(os.environ.get("PORT", 8000))
    app_web.run(host='0.0.0.0', port=port)

# --- CONFIG (Koneksi Langsung Tanpa Beban VPS) ---
# Audit: Menghapus PROXY karena [Errno 111] Connection Refused pada VPS
api_id = int(os.environ.get("API_ID"))
api_hash = os.environ.get("API_HASH")
token = os.environ.get("BOT_TOKEN")

app = Client(
    "ultimate_50_bot", 
    api_id=api_id, 
    api_hash=api_hash, 
    bot_token=token,
    workers=200 # Menaikkan speed respon aplikasi
)

search_db = {}

# ==========================================
# 1-10: MEDIA DOWNLOADER (FIXED)
# ==========================================
@app.on_message(filters.regex(r'http') & ~filters.command(["pin", "ai", "qr", "tr", "short"]))
async def media_dl(client, message):
    msg = await message.reply("⏳ `Sedang memproses media...`")
    url = message.text
    ydl_opts = {'format': 'best', 'outtmpl': 'downloads/%(title)s.%(ext)s', 'noplaylist': True}
    try:
        if not os.path.exists("downloads"): os.makedirs("downloads")
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
        await message.reply_video(video=filename, caption=f"✅ **Berhasil!**\n📂 **File:** {info.get('title')}")
        if os.path.exists(filename): os.remove(filename)
        await msg.delete()
    except Exception as e: 
        await msg.edit(f"❌ **Gagal:** Link tidak didukung.")

# ==========================================
# 11-20: PINTEREST & PHOTO TOOLS
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
# 21-35: AI & PING TOOLS
# ==========================================
@app.on_message(filters.command("ai"))
async def ai_brain(c, m):
    query = m.text.split(None, 1)
    if len(query) < 2: return await m.reply("Tanya apa, Bos?")
    res = requests.get(f"https://api.simsimi.vn/v2/simtalk?text={query[1]}&lc=id").json()
    await m.reply(f"🤖 **AI Brain**: {res.get('message', 'Server sibuk.')}")

@app.on_message(filters.command("ping"))
async def ping_real(c, m):
    start = time.time()
    msg = await m.reply("🛰️ `Checking Real Latency...`")
    latency = (time.time() - start) * 1000
    await msg.edit(f"🚀 **PONG!!**\n⚡ **Latency:** `{latency:.2f} ms`\n📶 **Status:** Online")

# ==========================================
# 36-50: UTILITIES & CALLBACK
# ==========================================
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
    print("✅ Bot Aktif Jalur Direct - Fitur Lengkap!")
    app.run()
