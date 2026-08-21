FROM python:3.11-slim

# Install system dependencies that OpenCV needs
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install Python packages
COPY requirements.txt .

# Force headless OpenCV BEFORE deepface can pull the GUI version
RUN pip install --no-cache-dir opencv-python-headless==4.9.0.80
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the code
COPY . .

# Create face data directory
RUN mkdir -p /data

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
