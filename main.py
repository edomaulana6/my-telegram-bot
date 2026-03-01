import os
import asyncio
import yt_dlp
import aiohttp
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
        body { font-family: 'Segoe UI', sans-serif; background: #121212; color: #fff; text-align: center; padding: 20px; }
        .container { max-width: 600px; margin: auto; background: #1e1e1e; padding: 30px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
        h1 { color: #0088cc; }
        input[type="text"] { width: 90%; padding: 12px; margin: 15px 0; border-radius: 8px; border: 1px solid #333; background: #252525; color: #fff; }
        .btn-group { display: flex; justify-content: center; gap: 10px; flex-wrap: wrap; }
        button { padding: 12px 25px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.3s; }
        .btn-audio { background: #0088cc; color: white; }
        .btn-video { background: #f44336; color: white; }
        button:hover { opacity: 0.8; transform: scale(1.02); }
        .footer { margin-top: 20px; font-size: 11px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 All-in-One Downloader</h1>
        <p style="color:#aaa;">Bypass Proteksi Link TikTok & YouTube</p>
        <form action="/process" method="get">
            <input type="text" name="url" placeholder="Tempel Link di sini..." required>
            <div class="btn-group">
                <button type="submit" name="mode" value="audio" class="btn-audio">🎵 Download Audio</button>
                <button type="submit" name="mode" value="video" class="btn-video">🎬 Download Video</button>
            </div>
        </form>
        <div class="footer">Status: Server Aktif (vps-eropa)</div>
    </div>
</body>
</html>
"""

# --- LOGIKA PEMROSESAN ---

async def handle_home(request):
    return web.Response(text=HTML_PAGE, content_type='text/html')

async def handle_process(request):
    target_url = request.query.get('url')
    mode = request.query.get('mode')
    
    if not target_url:
        return web.Response(text="URL wajib diisi", status=400)

    # Konfigurasi YT-DLP
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'format': 'bestaudio/best' if mode == 'audio' else 'best[ext=mp4]/best',
        'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            loop = asyncio.get_event_loop()
            info = await loop.run_in_executor(None, lambda: ydl.extract_info(target_url, download=False))
            
            if 'entries' in info:
                info = info['entries'][0]
            
            real_direct_url = info.get('url')
            file_name = f"{info.get('title', 'download')}.{'mp3' if mode == 'audio' else 'mp4'}"

            # PROXY STREAMING: Alih-alih redirect (yang bikin NXDOMAIN), 
            # kita ambil datanya lewat server Railway lalu kirim ke user.
            return web.Response(
                body=f"<html><body style='background:#121212;color:white;text-align:center;padding:50px;'> \
                        <h3>File Ditemukan!</h3> \
                        <p>{info.get('title')}</p> \
                        <a href='{real_direct_url}' download='{file_name}' style='color:#0088cc; font-weight:bold; font-size:20px;'>[ KLIK UNTUK SIMPAN KE HP ]</a><br><br> \
                        <small style='color:red;'>Jika muncul error domain, klik kanan dan 'Save Link As' atau gunakan browser lain.</small> \
                        </body></html>",
                content_type='text/html'
            )

    except Exception as e:
        return web.Response(text=f"Error: {str(e)}", status=500)

async def main():
    app = web.Application()
    app.router.add_get('/', handle_home)
    app.router.add_get('/process', handle_process)
    
    port = int(os.environ.get("PORT", 8000))
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', port)
    await site.start()
    await asyncio.Event().wait()

if __name__ == '__main__':
    asyncio.run(main())
            
