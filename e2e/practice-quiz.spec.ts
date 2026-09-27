import { test, expect } from "@playwright/test";

// P4-2: practice quizzes never mount proctoring (no camera request), reveal
// objective answers instantly when enabled, and never reveal short answers.

test.describe("Practice quiz mode", () => {
  test("no camera, instant MCQ feedback, no short-answer reveal, score summary", async ({
    browser,
    request,
  }) => {
    test.setTimeout(120000);
    const stamp = Date.now();
    const teacherEmail = `practice_teacher_${stamp}@example.com`;
    const reg = await request.post("/api/auth/register", {
      data: { name: "Practice Teacher", email: teacherEmail, password: "Examora@123" },
    });
    expect(reg.status()).toBe(201);
    const { data } = (await reg.json()) as { data: { token: string } };

    const created = await request.post("/api/exams", {
      headers: { Authorization: `Bearer ${data.token}` },
      data: {
        title: "Practice Quiz E2E",
        durationMinutes: 30,
        totalMarks: 7,
        status: "DRAFT",
        assessmentType: "PRACTICE_QUIZ",
        instantFeedback: true,
        questions: [
          {
            type: "MCQ_SINGLE",
            questionText: "Practice MCQ?",
            options: ["Right", "Wrong"],
            correctAnswer: "Right",
            marks: 2,
          },
          {
            type: "SHORT_ANSWER",
            questionText: "Practice short answer?",
            correctAnswer: "Model response",
            marks: 5,
          },
        ],
      },
    });
    expect(created.status()).toBe(201);
    const { data: examData } = (await created.json()) as {
      data: { exam: { id: string } };
    };
    const publish = await request.post(`/api/exams/${examData.exam.id}/publish`, {
      headers: { Authorization: `Bearer ${data.token}` },
    });
    expect(publish.status()).toBe(200);

    const ctx = await browser.newContext();
    // Spy on camera access: any getUserMedia call fails the test.
    await ctx.addInitScript(() => {
      (window as unknown as { __gumCalls?: number }).__gumCalls = 0;
      const md = navigator.mediaDevices;
      if (md?.getUserMedia) {
        const orig = md.getUserMedia.bind(md);
        md.getUserMedia = (...args: Parameters<typeof orig>) => {
          (window as unknown as { __gumCalls?: number }).__gumCalls =
            ((window as unknown as { __gumCalls?: number }).__gumCalls ?? 0) + 1;
          return orig(...args);
        };
      }
    });
    const page = await ctx.newPage();
    await page.goto(`/exam/${examData.exam.id}/join`);
    await expect(page.getByLabel("Full name")).toBeVisible();
    await page.getByLabel("Full name").fill("Practice Student");
    await page.getByLabel("Email").fill(`ps_${stamp}@example.com`);
    await page.getByLabel("Enrollment number").fill("PRAC1");
    await page.getByRole("button", { name: "Start exam" }).click();
    await page.waitForURL(`**/exam/${examData.exam.id}/take**`);

    // Practice badge instead of the warnings pill.
    await expect(page.getByText("Practice Quiz", { exact: true })).toBeVisible();
    await expect(page.getByText(/Warnings:/)).toHaveCount(0);

    // Answer the MCQ correctly (first question; shuffle off by default).
    await expect(page.getByText("Practice MCQ?")).toBeVisible();
    await page.getByText("Right", { exact: true }).click();
    await expect(page.getByText("Correct — nice work!")).toBeVisible();

    // Short answer: type, no reveal.
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByText("Practice short answer?")).toBeVisible();
    await page.getByPlaceholder("Type your answer here…").fill("My attempt");
    await expect(page.getByText(/Correct — nice work!|Not quite/)).toHaveCount(0);

    // Submit → practice score summary, no proctoring chrome anywhere.
    await page.getByRole("button", { name: "Submit", exact: true }).click();
    await page.getByRole("button", { name: "Submit now" }).click();
    await expect(page.getByText("Nice work!")).toBeVisible();

    // No camera access happened at any point.
    const gumCalls = await page.evaluate(
      () => (window as unknown as { __gumCalls?: number }).__gumCalls ?? -1,
    );
    expect(gumCalls).toBe(0);

    await ctx.close();
  });
});
