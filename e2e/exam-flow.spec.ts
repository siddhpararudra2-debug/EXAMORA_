import { test, expect } from "@playwright/test";

const TEACHER_NAME = "Playwright Teacher";
const TEACHER_EMAIL = `teacher_${Date.now()}@example.com`;
const TEACHER_PASSWORD = "Examora@123";

const STUDENT_NAME = "Ada Lovelace";
const STUDENT_EMAIL = `ada_${Date.now()}@example.com`;
const STUDENT_ENROLLMENT = `CS2023-${Math.floor(1000 + Math.random() * 9000)}`;

let teacherToken = "";

test.describe("Examora happy path", () => {
  test("register → create exam → publish → student joins, answers and submits", async ({
    browser,
    request,
  }) => {
    // Dev-server compile variance makes this long flow exceed the 30s
    // default (UI exam creation alone is ~10s on a cold server).
    test.setTimeout(120000);
    // ── 1. Register a teacher through the Express API ──────────────────────
    const registerRes = await request.post("/api/auth/register", {
      data: {
        name: TEACHER_NAME,
        email: TEACHER_EMAIL,
        password: TEACHER_PASSWORD,
      },
    });
    expect(registerRes.status()).toBe(201);
    const registerBody = (await registerRes.json()) as {
      status: string;
      data: { user: { name: string }; token: string };
    };
    expect(registerBody.status).toBe("success");
    teacherToken = registerBody.data.token;
    expect(teacherToken).toBeTruthy();

    // ── 2. Teacher signs in via the UI and lands on the dashboard ──────────
    const teacherContext = await browser.newContext();
    await teacherContext.addInitScript((token) => {
      window.localStorage.setItem("examora_token", token);
    }, teacherToken);
    const teacherPage = await teacherContext.newPage();

    await teacherPage.goto("/login");
    await teacherPage.getByLabel("Email address").fill(TEACHER_EMAIL);
    await teacherPage.getByLabel("Password").fill(TEACHER_PASSWORD);
    await teacherPage.getByRole("button", { name: /sign in/i }).click();
    await teacherPage.waitForURL("**/dashboard");
    // Fresh teacher → first-run onboarding checklist (P1-1), not an empty list.
    await expect(
      teacherPage.getByText("Welcome to Examora", { exact: true }),
    ).toBeVisible();

    // ── 3. Create an exam with 2 MCQ questions via the UI ──────────────────
    await teacherPage.goto("/dashboard/exams/create");
    await teacherPage.getByLabel("Exam title").fill("E2E Computer Science Quiz");
    await teacherPage.getByLabel("Description (optional)").fill(
      "Automated end-to-end test exam.",
    );
    await teacherPage.getByLabel("Duration (minutes)").fill("30");
    await teacherPage.getByLabel("Total marks").fill("4");
    // Disable camera checks for a deterministic happy-path run: the CI fake
    // camera has no face and would otherwise generate warnings.
    await teacherPage
      .getByRole("switch", { name: "On-device camera checks" })
      .click();
    await teacherPage
      .getByRole("button", { name: "Continue to questions" })
      .click();

    // Question 1
    await teacherPage
      .getByLabel("Question text")
      .nth(0)
      .fill("What is the capital of France?");
    await teacherPage.getByPlaceholder("Option A").nth(0).fill("Paris");
    await teacherPage.getByPlaceholder("Option B").nth(0).fill("London");
    await teacherPage.getByText("Pick the correct option").click();
    await teacherPage.getByRole("option", { name: "A. Paris" }).click();

    // Question 2
    await teacherPage.getByRole("button", { name: "Add a question" }).click();
    await teacherPage
      .getByLabel("Question text")
      .nth(1)
      .fill("Which planet is known as the Red Planet?");
    await teacherPage.getByPlaceholder("Option A").nth(1).fill("Mars");
    await teacherPage.getByPlaceholder("Option B").nth(1).fill("Venus");
    await teacherPage.getByText("Pick the correct option").click();
    await teacherPage.getByRole("option", { name: "A. Mars" }).click();

    // Create the exam and capture its id from the API response
    const createResponsePromise = teacherPage.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        r.request().url().startsWith("http://localhost:3000") &&
        r.request().url().endsWith("/api/exams"),
    );
    await teacherPage.getByRole("button", { name: "Create exam" }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);
    const createBody = (await createResponse.json()) as {
      status: string;
      data: { exam: { id: string } };
    };
    const examId = createBody.data.exam.id;
    expect(examId).toBeTruthy();

    // ── 4. Publish the exam so students can join it ────────────────────────
    const publishRes = await request.post(`/api/exams/${examId}/publish`, {
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    expect(publishRes.status()).toBe(200);

    // ── 5. Student joins via the public join page (camera permission) ──────
    const studentContext = await browser.newContext({
      permissions: ["camera"],
    });
    const studentPage = await studentContext.newPage();
    await studentPage.goto(`/exam/${examId}/join`);
    // The join page shows the exam description (not the "Enter your details"
    // fallback) whenever the exam has one — assert the form itself.
    await expect(studentPage.getByLabel("Full name")).toBeVisible();
    await studentPage.getByLabel("Full name").fill(STUDENT_NAME);
    await studentPage.getByLabel("Email").fill(STUDENT_EMAIL);
    await studentPage
      .getByLabel("Enrollment number")
      .fill(STUDENT_ENROLLMENT);
    await studentPage.getByRole("button", { name: "Start exam" }).click();
    await studentPage.waitForURL(`**/exam/${examId}/take**`);

    // ── 6. Answer both MCQ questions ───────────────────────────────────────
    // Questions may be shuffled per session, so answer whichever MCQ is displayed.
    const correctAnswers = new Map([
      ["What is the capital of France?", "Paris"],
      ["Which planet is known as the Red Planet?", "Mars"],
    ]);
    for (let answered = 0; answered < 2; answered += 1) {
      const questionText = (
        await studentPage.locator("main h2").first().textContent()
      )?.trim();
      const expectedAnswer = questionText
        ? correctAnswers.get(questionText)
        : undefined;
      expect(expectedAnswer).toBeTruthy();
      await studentPage.getByText(expectedAnswer as string, { exact: true }).click();
      if (await studentPage.getByRole("button", { name: "Next" }).count()) {
        await studentPage.getByRole("button", { name: "Next" }).click();
      } else {
        break;
      }
    }

    // ── 7. Submit and land on the already-completed page ───────────────────
    await studentPage.getByRole("button", { name: "Submit", exact: true }).click();
    await expect(
      studentPage.getByRole("heading", { name: "Submit Exam" }),
    ).toBeVisible();
    await studentPage.getByRole("button", { name: "Submit now" }).click();
    await expect(
      studentPage.getByText("Your exam has been submitted"),
    ).toBeVisible();
    // Trailing wildcard: the app redirects with query params
    // (/exam/already-completed?warnings=...), which a bare glob would miss.
    await studentPage.waitForURL("**/exam/already-completed*");
    await expect(
      studentPage.getByText("You've already taken this exam"),
    ).toBeVisible();
  });
});
