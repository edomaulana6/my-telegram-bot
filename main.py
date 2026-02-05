import os
import asyncio
from pyrogram import Client, filters

# 1. MENGAMBIL DATA DARI SECRETS GITHUB
token = os.environ.get('BOT_TOKEN')
api_id = os.environ.get('API_ID')
api_hash = os.environ.get('API_HASH')

# 2. INISIALISASI BOT
app = Client(
    "my_bot",
    api_id=int(api_id),
    api_hash=api_hash,
    bot_token=token
)

# 3. CONTOH PERINTAH (HANDLER)
@app.on_message(filters.command("start") & filters.private)
async def start(client, message):
    await message.reply_text(f"Halo {message.from_user.first_name}! Bot Anda sudah aktif 24 jam di GitHub Actions.")

@app.on_message(filters.command("cek") & filters.private)
async def cek(client, message):
    await message.reply_text("Sistem berjalan normal 100%!")

# 4. PENJAGA AGAR BOT TETAP HIDUP (Wajib Ada)
print("Bot sedang berjalan di GitHub Actions...")
app.run()
