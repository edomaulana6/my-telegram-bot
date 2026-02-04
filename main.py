import os
from pyrogram import Client # Sesuaikan dengan library Anda

# Mengambil data dari 'Secrets' yang Anda isi tadi
token = os.environ.get('BOT_TOKEN')
api_id = os.environ.get('API_ID')
api_hash = os.environ.get('API_HASH')

# Pastikan API_ID diubah ke angka (integer)
app = Client("my_bot", api_id=int(api_id), api_hash=api_hash, bot_token=token)

# ... Sisa kode bot Anda di sini ...

