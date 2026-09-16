FROM python:3.11-slim

WORKDIR /app

# Torch CPU-only (evite les roues CUDA, inutiles et volumineuses sur ce service).
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir pocket-tts fastapi uvicorn scipy

COPY app.py .

ENV HF_HOME=/data/.cache/huggingface
EXPOSE 10000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "10000"]
