FROM python:3.10-slim

# Instalasi ffmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Set direktori kerja secara absolut
WORKDIR /app

# Salin requirements dan instalasi
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Salin semua isi repo ke /app
COPY . .

# Tambahkan perintah 'ls' di log untuk debugging (Opsional)
# RUN ls -la /app

# Gunakan jalur absolut pada CMD
CMD ["python", "/app/bot.py"]
    
