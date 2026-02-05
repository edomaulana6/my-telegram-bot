import os
import requests
from pyrogram import Client, filters

token = os.environ.get('BOT_TOKEN')
api_id = os.environ.get('API_ID')
api_hash = os.environ.get('API_HASH')

app = Client("downloader_bot", api_id=int(api_id), api_hash=api_hash, bot_token=token)

@app.on_message(filters.text & filters.private)
async def handle_download(client, message):
    url = message.text
    if not url.startswith("http"): return

    status_msg = await message.reply_text("🔎 Memeriksa Server Pihak Ketiga...")

    # Arsitektur JSON v10 terbaru
    payload = {
        "url": url,
        "videoQuality": "720",
        "filenameStyle": "basic",
        "downloadMode": "auto"
    }
    
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

    try:
        # Mencoba server utama
        response = requests.post("https://api.cobalt.tools/api/json", json=payload, headers=headers)
        data = response.json()

        # Audit tipe konten yang dikirim balik oleh API
        if data.get("status") in ["stream", "redirect"]:
            dl_link = data.get("url")
            await status_msg.edit_text("📥 Server ditemukan! Mengirim file...")
            await client.send_video(chat_id=message.chat.id, video=dl_link, caption="✅ Berhasil via API v10")
            await status_msg.delete()
        elif data.get("status") == "picker":
            for item in data.get("picker"):
                await client.send_photo(chat_id=message.chat.id, photo=item.get("url"))
            await status_msg.delete()
        else:
            await status_msg.edit_text(f"⚠️ Server merespons tapi gagal: {data.get('text', 'Konten tidak didukung')}")
            
    except Exception as e:
        await status_msg.edit_text(f"❌ Gangguan Jalur: Pihak ketiga sedang down atau memblokir koneksi.")

print("Bot Pihak Ketiga v10 Siap...")
app.run()
