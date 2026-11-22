# EduVerify face + attendance API.
# Runs on Hugging Face Spaces (Docker SDK, port 7860, uid 1000) and any host that sets $PORT.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces run containers as uid 1000 — build as that user so every path is writable.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    DEEPFACE_HOME=/home/user \
    TF_CPP_MIN_LOG_LEVEL=2 \
    PYTHONUNBUFFERED=1 \
    PORT=7860

WORKDIR /home/user/app

COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt \
    # deepface pulls GUI OpenCV; servers need the headless build
    && (pip uninstall -y opencv-python opencv-contrib-python || true) \
    && pip install --no-cache-dir --user "opencv-python-headless>=4.10.0"

# Download the Facenet512 weights at build time so the first check-in isn't slow.
RUN python -c "from deepface import DeepFace; DeepFace.build_model('Facenet512')"

COPY --chown=user . .

EXPOSE 7860
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
