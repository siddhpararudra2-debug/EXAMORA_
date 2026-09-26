import {
  test,
  expect,
  type APIRequestContext,
  type Browser,
} from "@playwright/test";

// P1-4: termination at the 3rd warning + teacher visibility (live grid,
// results) through the wired ProctoringWrapper path.
//
// Each test is fully self-contained (own teacher, exam, student) so the file
// is safe under the repo's `fullyParallel` config — no cross-test module
// state, no ordering dependency.
//
// The exams disable on-device camera checks
// (settings.supervision.camera: false) so the fake media device in CI cannot
// inject face-detection violations mid-test.

// useExamLockdown dedupes violations inside a 600ms cooldown window, so the
// browser test waits past it between synthetic events. Dropping below ~700ms
// makes the second blur a no-op and the count assertions fail.
const COOLDOWN_GAP_MS = 1000;

const TEACHER_PASSWORD = "Examora@123";

const PROCTOR_QUESTIONS = [
  {
    type: "MCQ_SINGLE",
    questionText: "What is 2 + 2?",
    options: ["3", "4"],
    correctAnswer: "4",
    marks: 2,
  },
  {
    type: "MCQ_SINGLE",
    questionText: "What is the capital of France?",
    options: ["Paris", "London"],
    correctAnswer: "Paris",
    marks: 2,
  },
];

async function registerTeacher(
  request: APIRequestContext,
  email: string,
): Promise<string> {
  const res = await request.post("/api/auth/register", {
    data: { name: "Proctor Teacher", email, password: TEACHER_PASSWORD },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as {
    status: string;
    data: { token: string };
  };
  expect(body.data.token).toBeTruthy();
  return body.data.token;
}

async function createPublishedExam(
  request: APIRequestContext,
  token: string,
  title: string,
): Promise<string> {
  const createRes = await request.post("/api/exams", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title,
      description: "Termination-flow test exam.",
      durationMinutes: 30,
      totalMarks: 4,
      status: "DRAFT",
      settings: {
        shuffleQuestions: false,
        shuffleOptions: false,
        warningThreshold: 3,
        supervision: { camera: false },
      },
      questions: PROCTOR_QUESTIONS,
    },
  });
  expect(createRes.status()).toBe(201);
  const createBody = (await createRes.json()) as {
    status: string;
    data: { exam: { id: string } };
  };
  const examId = createBody.data.exam.id;
  expect(examId).toBeTruthy();

  const publishRes = await request.post(`/api/exams/${examId}/publish`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(publishRes.status()).toBe(200);
  return examId;
}

async function loginTeacher(browser: Browser, email: string) {
  // NOTE: no localStorage token seeding here — a valid token makes the
  // login page bounce to /dashboard mid-fill and detach the form.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(TEACHER_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
  return { context, page };
}

test.describe("Proctoring & warnings flow", () => {
  test("student is terminated after 3 warnings", async ({
    browser,
    request,
  }) => {
    const stamp = Date.now();
    const token = await registerTeacher(
      request,
      `proctor_teacher_${stamp}@example.com`,
    );
    expect(token).toBeTruthy();
    const examId = await createPublishedExam(
      request,
      token,
      "Proctoring E2E Exam",
    );

    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();

    await studentPage.goto(`/exam/${examId}/join`);
    await expect(studentPage.getByLabel("Full name")).toBeVisible();
    await studentPage.getByLabel("Full name").fill("Proctor Student");
    await studentPage
      .getByLabel("Email")
      .fill(`proctor_student_${stamp}@example.com`);
    await studentPage
      .getByLabel("Enrollment number")
      .fill(`PROC-${stamp.toString().slice(-6)}`);
    await studentPage.getByRole("button", { name: "Start exam" }).click();
    await studentPage.waitForURL(`**/exam/${examId}/take**`);

    // Persistent header counter starts at zero.
    await expect(
      studentPage.getByText("Warnings: 0 / 3", { exact: true }),
    ).toBeVisible();

    // Warning 1 — synthetic window blur, as the pre-rewrite spec did.
    await studentPage.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(
      studentPage.getByText("Warnings: 1 / 3", { exact: true }),
    ).toBeVisible();

    // Warning 2 — past the hook's 600ms dedupe cooldown.
    await studentPage.waitForTimeout(COOLDOWN_GAP_MS);
    await studentPage.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(
      studentPage.getByText("Warnings: 2 / 3", { exact: true }),
    ).toBeVisible();

    // Warning 3 — server terminates the session; the take page shows its
    // countdown overlay, then redirects to /exam/terminated.
    await studentPage.waitForTimeout(COOLDOWN_GAP_MS);
    await studentPage.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(
      studentPage.getByText("Your exam has been terminated"),
    ).toBeVisible();
    // NOTE: the take page redirects with query params
    // (/exam/terminated?reason=warnings&...), so the glob needs a trailing
    // wildcard — `**/exam/terminated` alone never matches. The terminated
    // page auto-redirects home after ~3s, so assert immediately.
    await studentPage.waitForURL("**/exam/terminated*", { timeout: 20000 });
    await expect(
      studentPage.getByText("Exam terminated", { exact: true }),
    ).toBeVisible();

    await studentContext.close();
  });

  test("teacher sees the terminated session in live grid and results", async ({
    browser,
    request,
  }) => {
    const stamp = Date.now();
    const teacherEmail = `proctor_teacher2_${stamp}@example.com`;
    const token = await registerTeacher(request, teacherEmail);
    const examId = await createPublishedExam(
      request,
      token,
      "Proctoring E2E Exam (teacher view)",
    );

    // Student joins via API, then collects 3 server-side warnings. The 600ms
    // dedupe cooldown lives in the browser hook, not the server — back to
    // back POSTs each count.
    const studentEmail = `proctor_student2_${stamp}@example.com`;
    const joinRes = await request.post(`/api/exams/${examId}/join`, {
      data: {
        studentName: "Proctor Student",
        studentEmail,
        enrollmentNo: `PROC2-${stamp.toString().slice(-6)}`,
      },
    });
    expect(joinRes.status()).toBe(201);
    const joinBody = (await joinRes.json()) as {
      status: string;
      data: { sessionToken: string };
    };
    const sessionToken = joinBody.data.sessionToken;
    expect(sessionToken).toBeTruthy();

    for (let i = 1; i <= 3; i += 1) {
      const vRes = await request.post(
        `/api/v1/exam-session/${sessionToken}/violation`,
        {
          headers: { Authorization: `Bearer ${sessionToken}` },
          data: {
            type: "TAB_SWITCH",
            description: `E2E synthetic warning ${i}`,
          },
        },
      );
      expect(vRes.status()).toBe(201);
      const vBody = (await vRes.json()) as {
        status: string;
        data: { warningsCount: number; terminated: boolean };
      };
      expect(vBody.data.warningsCount).toBe(i);
      expect(vBody.data.terminated).toBe(i === 3);
    }

    const { context, page: teacherPage } = await loginTeacher(
      browser,
      teacherEmail,
    );

    // Live grid shows the terminated session with its warning tally.
    await teacherPage.goto(`/dashboard/live/${examId}`);
    await expect(
      teacherPage.getByText("Proctor Student").first(),
    ).toBeVisible();
    await expect(
      teacherPage.getByText("Terminated (3/3)", { exact: true }),
    ).toBeVisible();

    // Results show the session with a TERMINATED badge. (NOTE: the results
    // screen renders session cards, not a <table> — there is no <tr> here.)
    await teacherPage.goto(`/dashboard/results/${examId}`);
    await expect(
      teacherPage.getByText("Proctor Student").first(),
    ).toBeVisible();
    await expect(
      teacherPage.getByText("TERMINATED", { exact: true }),
    ).toBeVisible();

    await context.close();
  });
});
