FROM python:3.11-slim
WORKDIR /app
# tesseract-ocr + poppler-utils: OCR fallback for scanned PDFs with no text layer (see
# agent_openrouter.py's extract_text) — pypdf alone only reads PDFs that already have real text.
RUN apt-get update && apt-get install -y --no-install-recommends tesseract-ocr poppler-utils \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
CMD ["python", "web_app.py"]
