import os
import requests
from pyrogram import Client, filters

# DATA DARI GITHUB SECRETS
token = os.environ.get('BOT_TOKEN')
api_id = os.environ.get('API_ID')
api_hash = os.environ.get('API_HASH')

app = Client("downloader_bot", api_id=int(api_id), api_hash=api_hash, bot_token=token)

@app.on_message(filters.text & filters.private)
async def handle_download(client, message):
    url = message.text
    if not url.startswith("http"):
        return await message.reply_text("Silakan kirim link video yang valid.")

    status = await message.reply_text("🚀 Sedang memproses via Jalur Pihak Ketiga...")

    # MENGGUNAKAN COBALT API (PIHAK KETIGA)
    payload = {
        "url": url,
        "vQuality": "720", # Kualitas standar agar cepat
        "isAudioOnly": False
    }
    
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

    try:
        # Kita meminta bantuan server 'api.cobalt.tools'
        response = requests.post("https://api.cobalt.tools/api/json", json=payload, headers=headers)
        data = response.json()

        if data.get("status") == "stream":
            video_url = data.get("url")
            await client.send_video(chat_id=message.chat.id, video=video_url, caption="✅ Berhasil via Pihak Ketiga")
            await status.delete()
        elif data.get("status") == "picker":
            # Untuk TikTok Slide (Banyak Foto)
            for item in data.get("picker"):
                await client.send_photo(chat_id=message.chat.id, photo=item.get("url"))
            await status.delete()
        else:
            await status.edit_text(f"❌ Pihak ketiga gagal: {data.get('text', 'Kesalahan tidak diketahui')}")
            
    except Exception as e:
        await status.edit_text(f"❌ Gangguan koneksi: {str(e)}")

print("Bot Jalur Pihak Ketiga Aktif (Bebas Cookies)...")
app.run()
    
