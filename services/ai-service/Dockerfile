# Examora AI Service — FastAPI + Groq (free tier)
# Document parsing (PDF/DOCX/TXT → structured questions) & exam generation.
FROM python:3.11-slim

# System dependencies for the OCR fallback (scanned PDFs):
#   tesseract-ocr     — OCR engine (pytesseract)
#   poppler-utils     — PDF page rendering (pdf2image)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=5001
EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5001/health')"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5001"]
