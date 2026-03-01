import os
import asyncio
import re
import yt_dlp
from aiohttp import web

# --- KONFIGURASI TAMPILAN (FRONTEND) ---
HTML_PAGE = """
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Downloader Pro | vps-eropa.duckdns.org</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #121212; color: #fff; text-align: center; padding: 20px; }
        .container { max-width: 600px; margin: auto; background: #1e1e1e; padding: 30px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        h1 { color: #0088cc; }
        input[type="text"] { width: 90%; padding: 12px; margin: 15px 0; border-radius: 8px; border: 1px solid #333; background: #252525; color: #fff; }
        .btn-group { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
        button { padding: 12px 25px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.3s; }
        .btn-audio { background: #0088cc; color: white; }
        .btn-video { background: #f44336; color: white; }
        .btn-search { background: #ff5500; color: white; width: 95%; margin-top: 10px; }
        button:hover { opacity: 0.8; transform: scale(1.02); }
        .footer { margin-top: 20px; font-size: 11px; color: #666; }
        .info { font-size: 13px; color: #aaa; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 All-in-One Downloader</h1>
        <p class="info">Mendukung YouTube, TikTok, IG, FB, dan SoundCloud</p>
        
        <form action="/download" method="get">
            <input type="text" name="q" placeholder="Tempel Link atau Judul Lagu (SoundCloud)..." required>
            <div class="btn-group">
                <button type="submit" name="type" value="audio" class="btn-audio">🎵 Audio (M4A/MP3)</button>
                <button type="submit" name="type" value="video" class="btn-video">🎬 Video (MP4)</button>
            </div>
            <button type="submit" name="type" value="sc" class="btn-search">☁️ Search & Play SoundCloud</button>
        </form>

        <div class="footer">
            Server: vps-eropa.duckdns.org <br>
            Batas Deaktivasi Sistem: 30 Maret 2026
        </div>
    </div>
</body>
</html>
"""

# --- LOGIKA PEMROSESAN (BACKEND) ---
async def handle_home(request):
    return web.Response(text=HTML_PAGE, content_type='text/html')

async def handle_download(request):
    query = request.query.get('q')
    mode = request.query.get('type')
    
    if not query:
        return web.Response(text="Input tidak boleh kosong!", status=400)

    # Opsi dasar yang diperkuat untuk menghindari deteksi bot
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'nocheckcertificate': True,
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'referer': 'https://www.google.com/',
    }

    if mode == "audio" or mode == "sc":
        # Perbaikan: Mengutamakan m4a namun mengizinkan format lain jika m4a tidak tersedia (anti-error)
        search_prefix = "scsearch1:" if mode == "sc" else ""
        ydl_opts.update({
            'format': 'bestaudio/best',
            'format_sort': ['ext:m4a:m4a', 'abr'],
            'default_search': search_prefix,
            'noplaylist': True
        })
    else:
        # Perbaikan: Mengutamakan mp4 dan resolusi 480p tanpa memaksanya secara kaku (anti-error TikTok)
        ydl_opts.update({
            'format': 'best[ext=mp4]/best',
            'format_sort': ['res:480', 'ext:mp4:m4a'],
        })

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            loop = asyncio.get_event_loop()
            # Ekstraksi informasi tanpa mengunduh file ke server Railway
            info = await loop.run_in_executor(None, lambda: ydl.extract_info(query, download=False))
            
            if 'entries' in info:
                info = info['entries'][0]
            
            download_url = info.get('url')
            if not download_url:
                return web.Response(text="Gagal mendapatkan link unduhan. Platform mungkin memperbarui sistemnya.")

            # Redirect pengguna ke URL file asli
            return web.HTTPFound(location=download_url)

    except Exception as e:
        # Pesan kesalahan yang lebih informatif untuk debugging
        return web.Response(text=f"Kesalahan Sistem: {str(e)}", status=500)

# --- KONFIGURASI SERVER ---
async def main():
    app = web.Application()
    app.router.add_get('/', handle_home)
    app.router.add_get('/download', handle_download)
    
    # Mengambil port dari environment Railway (default 8000)
    port = int(os.environ.get("PORT", 8000))
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', port)
    await site.start()
    print(f"Server Downloader Aktif di Port {port}")
    await asyncio.Event().wait()

if __name__ == '__main__':
    asyncio.run(main())
    
