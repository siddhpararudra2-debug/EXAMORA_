# Examora Platform — Environment & Service Setup Guide

This guide provides step-by-step instructions for configuring free tier services for **Examora**:
1. **Groq AI Question Generation** (100% Free AI API)
2. **Gmail SMTP Email Invites** (100% Free Transporter via App Passwords)
3. **Deploying Environment Variables** to Vercel & Render

---

## 1. Setting Up Free Groq AI Question Generation (`GROQ_API_KEY`)

Examora uses **Groq** (`llama-3.3-70b-versatile`) to generate exam questions in real time with ultra-fast inference speed.

### Step-by-Step API Key Setup:
1. Go to [https://console.groq.com](https://console.groq.com) and create a free account (no credit card required).
2. Navigate to **API Keys** in the left sidebar menu.
3. Click **Create API Key**. Give it a label like `Examora-Production`.
4. Copy the generated key (it starts with `gsk_...`).
5. Add it to your backend `.env` file:
   ```env
   GROQ_API_KEY="gsk_your_actual_groq_api_key_here"
   ```

> 💡 **Rate Limit Note**: Groq's free tier provides a generous rate limit. If you encounter `429 Too Many Requests`, Examora automatically activates its built-in fallback question generator so the teacher's workflow is never interrupted.

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
