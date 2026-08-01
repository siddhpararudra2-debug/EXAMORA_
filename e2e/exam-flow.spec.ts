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
    await expect(
      teacherPage.getByRole("heading", { name: "No exams yet" }),
    ).toBeVisible();

    // ── 3. Create an exam with 2 MCQ questions via the UI ──────────────────
    await teacherPage.goto("/dashboard/exams/create");
    await teacherPage.getByLabel("Exam title").fill("E2E Computer Science Quiz");
    await teacherPage.getByLabel("Description (optional)").fill(
      "Automated end-to-end test exam.",
    );
    await teacherPage.getByLabel("Duration (minutes)").fill("30");
    await teacherPage.getByLabel("Total marks").fill("4");
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
    await expect(
      studentPage.getByText(/Enter your details to begin/i),
    ).toBeVisible();
    await studentPage.getByLabel("Full name").fill(STUDENT_NAME);
    await studentPage.getByLabel("Email").fill(STUDENT_EMAIL);
    await studentPage
      .getByLabel("Enrollment number")
      .fill(STUDENT_ENROLLMENT);
    await studentPage.getByRole("button", { name: "Start exam" }).click();
    await studentPage.waitForURL(`**/exam/${examId}/take**`);

    // ── 6. Answer both MCQ questions ───────────────────────────────────────
    await expect(
      studentPage.getByText("What is the capital of France?"),
    ).toBeVisible();
    await studentPage.getByText("Paris", { exact: true }).click();
    await studentPage.getByRole("button", { name: "Next" }).click();
    await expect(
      studentPage.getByText("Which planet is known as the Red Planet?"),
    ).toBeVisible();
    await studentPage.getByText("Mars", { exact: true }).click();

    // ── 7. Submit and land on the already-completed page ───────────────────
    await studentPage.getByRole("button", { name: "Submit Exam" }).click();
    await expect(studentPage.getByText("Submit your exam?")).toBeVisible();
    await studentPage.getByRole("button", { name: "Submit now" }).click();
    await expect(
      studentPage.getByText("Your exam has been submitted"),
    ).toBeVisible();
    await studentPage.waitForURL("**/exam/already-completed");
    await expect(
      studentPage.getByText("You've already taken this exam"),
    ).toBeVisible();
  });
});
