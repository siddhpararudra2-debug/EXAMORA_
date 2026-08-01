# Examora Demo Script (5-7 minutes)

This walkthrough script details the exact steps for recording or presenting a live demonstration of **Examora** — the 100% free, open-source AI-proctored online exam platform.

---

## 🎬 Scene 1: Teacher Login & Dashboard (30 seconds)
- Open browser, navigate to `https://examora.vercel.app` (or `http://localhost:3000`).
- Click **Login** and log in as a teacher (`demo@examora.com` / `demo123`).
- Highlight the clean indigo/slate teacher dashboard:
  - Total Exams created
  - Total Candidates enrolled
  - Quick action buttons: **Create New Exam**, **Live Proctoring Monitor**.

---

## 🤖 Scene 2: AI Question Generation (1 minute)
- Click **Create Exam**.
- Fill in exam details:
  - Title: `Biology Midterm — Photosynthesis & Cell Respiration`
  - Duration: `60 mins`
  - Total Marks: `20`
- Click **"✨ Generate with AI"**.
- In the AI Generator modal:
  - Enter topic: `Photosynthesis`
  - Select count: `5`
  - Select difficulty: `Medium`
  - Select type: `MCQ`
- Click **Generate Questions with AI**.
- Watch the real-time AI question generation powered by Groq (`llama-3.3-70b-versatile`).
- Select all generated questions, click **Add 5 Questions to Exam**, and save the exam.

---

## ✉️ Scene 3: Bulk Email Invite (1 minute)
- Navigate to the newly created Exam Details page.
- Click **Bulk Invite Students**.
- Upload a sample CSV (`Name, Email, EnrollmentNo`).
- Show the interactive parsed preview table before sending.
- Click **Send Invites**.
- Demonstrate the success summary banner showing candidate email invites sent via Gmail SMTP.

---

## 🛡️ Scene 4: Student Exam Experience (2 minutes)
- Open a new Incognito browser window (simulating the student perspective).
- Paste the student's unique exam join link (`/exam/[examId]/take?token=...`).
- Allow webcam permissions when prompted.
- Enter the locked exam environment:
  - Show the top header: Live countdown timer and proctoring warnings badge (`Warnings: 0/3`).
  - Show the bottom-right picture-in-picture webcam preview with the **"🔴 Recording"** badge and AI face verification pill (`✓ Face Verified`).
- **Trigger Proctoring Violations**:
  1. **Tab Switch**: Switch to another tab. Hear the distinct Web Audio API warning beep and notice the warning count increment (`Warnings: 1/3`).
  2. **Fullscreen Exit**: Press `ESC` to exit fullscreen. Hear the beep warning tone (`Warnings: 2/3`).
  3. **Missing Face Grace Period**: Look away from the camera for 5 seconds. Hear the final warning beep tone.
- Demonstrate auto-termination sequence triggering when `warnings >= 3` and redirecting to the `/exam/terminated` page.

---

## 📡 Scene 5: Teacher Live Proctoring (1 minute)
- Switch back to the teacher's browser window.
- Open the **Live Proctoring Dashboard** (`/dashboard/live/[examId]`).
- Show real-time WebSocket status updates (`ACTIVE`, `WARNING`, `TERMINATED`).
- Point out the instant warning count updates broadcasted from student sessions.

---

## 📊 Scene 6: Results & Proctoring Timeline (1 minute)
- Navigate to the Exam Results & Analytics page.
- Review auto-graded scores and class performance metrics.
- Click **View Proctoring Timeline** for a candidate session (`/dashboard/exams/[examId]/sessions/[sessionId]/timeline`).
- Show the horizontal timeline visualization bar with color-coded incident markers:
  - **Yellow Dot**: Tab Switch
  - **Orange Dot**: Face Lost
  - **Red Dot**: Fullscreen Exit
  - **Purple Dot**: Multiple Faces / Phone
- Hover over timeline markers to demonstrate the timestamp tooltips (`00:14:32`).

---

## 📄 Scene 7: Student Result Lookup (30 seconds)
- Open a new browser tab and navigate to `/results`.
- Enter student email and enrollment number.
- Display the official student scorecard.
- Click **Download PDF Scorecard**.
- Show the generated PDF report download.

---

## 🏁 Closing (30 seconds)
- **Summary**: Highlight Examora's core strengths:
  - 100% Free & Open-Source (No paid AI/cloud APIs, zero cost deployment).
  - Client-Side AI proctoring (BlazeFace / MediaPipe running in browser).
  - Web Audio warning sound synthesizer.
  - PWA Offline support with local answer saving.
- Share the GitHub repository link: [https://github.com/siddhpararudra2-debug/EXAMORA_.git](https://github.com/siddhpararudra2-debug/EXAMORA_.git).
- Thank the audience!
