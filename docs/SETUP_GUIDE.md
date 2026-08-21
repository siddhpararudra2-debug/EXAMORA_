# Examora Platform — Environment & Service Setup Guide

This guide provides step-by-step instructions for configuring free tier services for **Examora**:
1. **Groq AI Question Generation** (100% Free AI API)
2. **AI Document Parsing Service** (FastAPI — PDF/DOCX/TXT → questions)
3. **Gmail SMTP Email Invites** (100% Free Transporter via App Passwords)
4. **Deploying Environment Variables** to Vercel & Render

---

## 1. Setting Up AI Question Generation (`GROQ_API_KEY` or Local Ollama)

Examora supports both cloud-based AI via **Groq** (`llama-3.3-70b-versatile`) and 100% offline, local open-source models via **Ollama** or any OpenAI-compatible server.

### Option A: Cloud Groq Setup (Fastest)
1. Go to [https://console.groq.com](https://console.groq.com) and create a free account.
2. Navigate to **API Keys** and click **Create API Key**.
3. Copy the key and set it in your `.env`:
   ```env
   GROQ_API_KEY="gsk_your_actual_groq_api_key_here"
   ```

### Option B: 100% Local & Open-Source Setup (Ollama / LocalAI)
1. Install [Ollama](https://ollama.com) on your machine or server.
2. Pull your preferred open-source model:
   ```bash
   ollama pull llama3
   ```
3. Set the local endpoint variables in your `.env`:
   ```env
   OLLAMA_HOST="http://localhost:11434"
   LOCAL_LLM_URL="http://localhost:11434/v1"
   LOCAL_LLM_MODEL="llama3"
   ```

> 💡 **Fallback Note**: If neither Groq nor local LLM endpoints are reachable, Examora automatically activates its built-in fallback question generator so the teacher's workflow is never interrupted.

---

## 1.5 Running the AI Document Parsing Service (`services/ai-service`)

The **"Upload paper"** feature in the exam wizard parses PDF/DOCX/TXT exam papers into editable question banks. It runs as a small FastAPI service (`services/ai-service/`) that talks to Groq using the **same** `GROQ_API_KEY` above.

### Option A — Docker (recommended)

```bash
docker compose up -d ai-service        # dev stack (adds the FastAPI container on :5001)
```

### Option B — Local Python

```bash
npm run ai:service:install   # pip install -r services/ai-service/requirements.txt
npm run ai:service           # uvicorn on http://localhost:5001
```

Verify: `GET http://localhost:5001/health` → `{ "status": "ok", "groq_configured": true }`

The Express backend proxies uploads to this service via `AI_SERVICE_URL` (`.env`):

```env
AI_SERVICE_URL="http://localhost:5001"   # "http://ai-service:5001" inside Docker Compose
```

> **Scanned PDFs**: OCR (`pytesseract` + `pdf2image`) is a lazy fallback. Install the system binaries (`tesseract-ocr`, `poppler-utils`) — the Docker image already includes them. Without them, scanned PDFs return `no readable text`.

> If the AI service is unreachable, the parse endpoint returns `503` with a clear message — the rest of the platform keeps working.

---

## 2. Setting Up Gmail SMTP for Student Email Invites (`SMTP_PASS`)

Gmail requires **2-Factor Authentication (2FA)** and an **App Password** for Nodemailer to send emails securely.

### Step-by-Step Gmail App Password Setup:
1. Log in to your Google Account at [https://myaccount.google.com](https://myaccount.google.com).
2. Go to **Security** $\rightarrow$ **How you sign in to Google**.
3. Ensure **2-Step Verification** is turned **ON**.
4. In the search bar at the top of the Google Account page, search for **"App passwords"**.
5. Create a new App Password:
   - App Name: `Examora Platform`
6. Click **Create**. Google will generate a **16-character passcode** (e.g. `abcd efgh ijkl mnop`).
7. Copy the 16-character passcode **without spaces**.
8. Add the SMTP environment variables to your backend `.env` file:

```env
# Gmail SMTP Configuration
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="abcdefghijklmnop"
SMTP_FROM='"Examora Platform" <your-email@gmail.com>'
FRONTEND_URL="http://localhost:3000"
```

> 🚨 **Critical Pitfall**: Do NOT use your regular Gmail account password. Standard passwords will be blocked by Google security checks with `535 5.7.8 Authentication failed`. You MUST use a 16-character App Password.

---

## 3. Production Environment Variables Checklist

### Backend (Render / Docker / Host Dashboard)

| Variable | Example Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Production mode flag |
| `PORT` | `4000` | Server listening port |
| `DATABASE_URL` | `postgresql://user:pass@ep-xyz.neon.tech/examora_db?sslmode=require` | Neon/Supabase PostgreSQL connection string |
| `REDIS_URL` | `rediss://default:pass@xyz.upstash.io:6379` | Upstash Redis connection string |
| `JWT_SECRET` | `your-32-byte-secure-jwt-key` | JWT token signing key |
| `GROQ_API_KEY` | `gsk_...` | Groq AI API key |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP host |
| `SMTP_PORT` | `587` | SMTP TLS port |
| `SMTP_USER` | `your-email@gmail.com` | Sender Gmail address |
| `SMTP_PASS` | `16-char-app-password` | Gmail App Password |
| `SMTP_FROM` | `"Examora" <your-email@gmail.com>` | Display sender header |
| `FRONTEND_URL` | `https://examora.vercel.app` | Vercel production frontend domain |

### Frontend (Vercel Project Settings)

| Variable | Example Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://examora-backend.onrender.com/api` | Render Express API base URL |
| `NEXT_PUBLIC_SOCKET_URL` | `https://examora-backend.onrender.com` | Render Socket.io server URL |

---

## 4. End-to-End Testing Workflow

To perform a complete integration test of Examora:
1. **Teacher Login**: Log in to `/login` as a teacher.
2. **Create Exam with AI**: Click **Create Exam** $\rightarrow$ Click **✨ Generate with AI** $\rightarrow$ Enter topic (e.g. "Data Structures") $\rightarrow$ Select questions.
3. **Bulk Invite Students**: Click **Bulk Invite Students** on the exam details page $\rightarrow$ Upload a sample CSV (`Name,Email,EnrollmentNo`).
4. **Student Session**: Click the generated join link in email or open `/exam/[examId]/take`.
5. **Proctoring Audit**: Exit fullscreen or switch tabs to trigger proctoring alerts.
6. **Timeline Visualizer**: Open `/dashboard/exams/[examId]/sessions/[sessionId]/timeline` to review the interactive proctoring timeline.
