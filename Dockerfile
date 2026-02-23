# Gunakan image Python yang ringan
FROM python:3.10-slim

# Instal FFmpeg dan dependencies sistem
RUN apt-get update && apt-get install -y \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set direktori kerja di dalam kontainer
WORKDIR /app

# Salin requirements dan instal library Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Salin seluruh kode bot ke dalam kontainer
COPY . .

# Buat folder downloads agar aplikasi tidak error saat menulis file
RUN mkdir -p downloads && chmod 777 downloads

# Ekspos port 8000 untuk Health Check (Koyeb)
EXPOSE 8000

# Jalankan bot
CMD ["python", "main.py"]
