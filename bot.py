FROM python:3.10-slim

# Instalasi ffmpeg
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

# Set direktori kerja ke /app
WORKDIR /app

# Salin requirements dulu (optimasi cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Salin SEMUA file dari repo ke dalam /app
COPY . /app/

# Pastikan port sesuai
EXPOSE 8080

# Jalankan dengan jalur absolut untuk menghindari error directory
CMD ["python", "/app/bot.py"]
