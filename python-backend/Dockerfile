FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Force headless OpenCV AFTER deepface installs the GUI version
RUN pip uninstall -y opencv-python opencv-contrib-python 2>/dev/null || true
RUN pip install --no-cache-dir "opencv-python-headless>=4.10.0"

COPY . .

RUN mkdir -p /data


CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
