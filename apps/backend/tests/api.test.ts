import request from 'supertest';
import prisma from '../../../prisma/client.js';

// ── Mock external services (hoisted by Jest) ─────────────────────────────────

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mocked-id' }),
  })),
}));

jest.mock('groq-sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    {
                      type: 'MCQ_SINGLE',
                      questionText: 'Mocked AI question?',
                      options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
                      correctAnswer: 'Alpha',
                      marks: 2,
                    },
                  ],
                }),
              },
            },
          ],
        }),
      },
    },
  })),
}));

import nodemailer from 'nodemailer';
import { createApp } from '../../../server/app.js';

const { app } = createApp({ withSocket: false });

const api = request(app);

// ── Shared fixtures ──────────────────────────────────────────────────────────

const TEACHER = {
  name: 'API Test Teacher',
  email: `teacher_${Date.now()}@example.com`,
  password: 'TestPass@123',
};

const EXAM_PAYLOAD = {
  title: 'API Integration Exam',
  description: 'Created by the API test suite',
  durationMinutes: 30,
  totalMarks: 4,
  status: 'DRAFT',
  questions: [
    {
      type: 'MCQ_SINGLE',
      questionText: 'What is the capital of France?',
      options: ['Paris', 'London'],
      correctAnswer: 'Paris',
      marks: 2,
    },
    {
      type: 'MCQ_SINGLE',
      questionText: 'Which planet is the Red Planet?',
      options: ['Mars', 'Venus'],
      correctAnswer: 'Mars',
      marks: 2,
    },
  ],
};

let teacherToken = '';
let examId = '';
let sessionToken = '';

beforeAll(async () => {
  await prisma.$connect();
  // Clean slate — order matters due to foreign keys
  await prisma.$executeRawUnsafe(
    'TRUNCATE "email_log", "violations", "answers", "exam_sessions", "questions", "exams", "teachers" CASCADE;',
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('registers a teacher and returns a JWT', async () => {
    const res = await api.post('/api/auth/register').send(TEACHER).expect(201);

    expect(res.body.status).toBe('success');
    expect(res.body.data.user.email).toBe(TEACHER.email);
    expect(res.body.data.token).toEqual(expect.any(String));
    expect(res.body.data.token.split('.')).toHaveLength(3); // JWT structure

    teacherToken = res.body.data.token;
  });

  it('rejects duplicate emails with 409', async () => {
    await api.post('/api/auth/register').send(TEACHER).expect(409);
  });

  it('rejects invalid payloads with 400 (Zod)', async () => {
    const res = await api
      .post('/api/auth/register')
      .send({ name: 'X', email: 'not-an-email', password: '123' })
      .expect(400);

    expect(res.body.status).toBe('error');
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials and returns a JWT', async () => {
    const res = await api
      .post('/api/auth/login')
      .send({ email: TEACHER.email, password: TEACHER.password })
      .expect(200);

    expect(res.body.status).toBe('success');
    expect(res.body.data.token.split('.')).toHaveLength(3);
  });

  it('rejects wrong credentials with 401', async () => {
    await api
      .post('/api/auth/login')
      .send({ email: TEACHER.email, password: 'WrongPass@123' })
      .expect(401);
  });
});

describe('POST /api/exams', () => {
  it('creates an exam with questions (201)', async () => {
    const res = await api
      .post('/api/exams')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send(EXAM_PAYLOAD)
      .expect(201);

    expect(res.body.status).toBe('success');
    expect(res.body.data.exam.id).toBeTruthy();
    expect(res.body.data.exam.status).toBe('DRAFT');
    expect(res.body.data.exam.questions).toHaveLength(2);

    examId = res.body.data.exam.id;
  });

  it('rolls back the transaction when a question is invalid', async () => {
    const before = await prisma.exam.count({ where: { title: 'Broken Exam' } });

    const res = await api
      .post('/api/exams')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        ...EXAM_PAYLOAD,
        title: 'Broken Exam',
        questions: [
          {
            type: 'MCQ',
            questionText: 'Missing options',
            correctAnswer: 'X',
            marks: 2,
          },
        ],
      })
      .expect(400);

    expect(res.body.status).toBe('error');
    const after = await prisma.exam.count({ where: { title: 'Broken Exam' } });
    expect(after).toBe(before); // no partial rows left behind
  });

  it('requires a valid teacher token (401)', async () => {
    await api.post('/api/exams').send(EXAM_PAYLOAD).expect(401);
  });
});

describe('POST /api/exams/:id/publish', () => {
  it('publishes the DRAFT exam', async () => {
    const res = await api
      .post(`/api/exams/${examId}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    expect(res.body.data.exam.status).toBe('ACTIVE');
  });
});

describe('PUT /api/exams/:id', () => {
  it('rejects edits after an exam has been published', async () => {
    await api
      .put(`/api/exams/${examId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ ...EXAM_PAYLOAD, title: 'Attempted Published Edit' })
      .expect(409);
  });
});

describe('POST /api/exams/:id/join', () => {
  it('creates an anonymous student session with a UUID token', async () => {
    const res = await api
      .post(`/api/exams/${examId}/join`)
      .send({
        studentName: 'Ada Lovelace',
        studentEmail: 'ada@example.com',
        enrollmentNo: 'CS2023-0042',
      })
      .expect(201);

    expect(res.body.status).toBe('success');
    expect(res.body.data.sessionToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    sessionToken = res.body.data.sessionToken;
  });

  it('reuses the same session token for a repeat join', async () => {
    const res = await api
      .post(`/api/exams/${examId}/join`)
      .send({
        studentName: 'Ada Lovelace',
        studentEmail: 'ada@example.com',
        enrollmentNo: 'CS2023-0042',
      })
      .expect(200);

    expect(res.body.data.sessionToken).toBe(sessionToken);
  });

  it('rejects joining an unpublished exam', async () => {
    const draft = await api
      .post('/api/exams')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ ...EXAM_PAYLOAD, title: 'Draft-Only Exam' })
      .expect(201);

    await api
      .post(`/api/exams/${draft.body.data.exam.id}/join`)
      .send({
        studentName: 'Nope',
        studentEmail: 'nope@example.com',
        enrollmentNo: 'CS0000',
      })
      .expect(400);
  });
});

describe('GET /api/exams/:id/student-view', () => {
  it('returns questions without correct answers', async () => {
    const res = await api
      .get(`/api/exams/${examId}/student-view`)
      .query({ sessionToken })
      .expect(200);

    expect(res.body.data.exam.questions).toHaveLength(2);
    expect(JSON.stringify(res.body)).not.toContain('correctAnswer');
    expect(res.body.data.session.warningsCount).toBe(0);
  });

  it('rejects an invalid session token', async () => {
    await api
      .get(`/api/exams/${examId}/student-view`)
      .query({ sessionToken: '00000000-0000-0000-0000-000000000000' })
      .expect(401);
  });
});

describe('POST /api/v1/exam-session/:token/submit', () => {
  it('submits answers and grades the session atomically', async () => {
    // Fetch real question ids from the student view
    const view = await api
      .get(`/api/exams/${examId}/student-view`)
      .query({ sessionToken })
      .expect(200);

    const questions = view.body.data.exam.questions;
    expect(questions).toHaveLength(2);

    // Save answers via canonical /answer endpoint
    await api
      .post(`/api/v1/exam-session/${sessionToken}/answer`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ questionId: questions[0].id, answerData: 'Paris' })
      .expect(200);

    await api
      .post(`/api/v1/exam-session/${sessionToken}/answer`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .send({ questionId: questions[1].id, answerData: 'Mars' })
      .expect(200);

    // Submit session via canonical /submit endpoint
    const res = await api
      .post(`/api/v1/exam-session/${sessionToken}/submit`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(200);

    expect(res.body.status).toBe('success');
    expect(res.body.data.result.score).toBe(4);

    // Second submit must be rejected (session already submitted)
    await api
      .post(`/api/v1/exam-session/${sessionToken}/submit`)
      .set('Authorization', `Bearer ${sessionToken}`)
      .expect(403);
  });

  it('verifies graded score persisted on session', async () => {
    const session = await prisma.examSession.findUnique({
      where: { session_token: sessionToken },
      select: { total_score: true, status: true },
    });
    expect(Number(session?.total_score)).toBe(4);
    expect(session?.status).toBe('SUBMITTED');
  });
});

describe('POST /api/v1/exam-session/:token/violation', () => {
  it('logs violations and enforces 3-warning termination rule', async () => {
    const joinRes = await api
      .post(`/api/exams/${examId}/join`)
      .send({
        studentName: 'Violation Test Student',
        studentEmail: 'violation.test@example.com',
        enrollmentNo: 'CS2023-8888',
      })
      .expect(201);

    const testToken = joinRes.body.data.sessionToken;

    for (let i = 1; i <= 3; i++) {
      const res = await api
        .post(`/api/v1/exam-session/${testToken}/violation`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({ type: 'TAB_SWITCH', description: `Switch ${i}` })
        .expect(201);

      expect(res.body.data.violation.type).toBe('TAB_SWITCH');
      expect(res.body.data.warningsCount).toBe(i);
      expect(res.body.data.terminated).toBe(i === 3);
    }

    // The session is now TERMINATED — further requests are rejected with 403
    await api
      .post(`/api/v1/exam-session/${testToken}/violation`)
      .set('Authorization', `Bearer ${testToken}`)
      .send({ type: 'TAB_SWITCH' })
      .expect(403);

    const session = await prisma.examSession.findUnique({
      where: { session_token: testToken },
      select: { id: true },
    });

    const eventsRes = await api
      .get(`/api/exams/${examId}/sessions/${session!.id}/events`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    expect(eventsRes.body.data.events).toHaveLength(3);
    expect(eventsRes.body.data.events[0].type).toBe('TAB_SWITCH');
  });

  it('rejects unknown event types (Zod)', async () => {
    const freshJoin = await api
      .post(`/api/exams/${examId}/join`)
      .send({
        studentName: 'Second Student',
        studentEmail: 'second@example.com',
        enrollmentNo: 'CS2023-0099',
      })
      .expect(201);

    await api
      .post(`/api/v1/exam-session/${freshJoin.body.data.sessionToken}/violation`)
      .set('Authorization', `Bearer ${freshJoin.body.data.sessionToken}`)
      .send({ type: 'NINJA_MOVE' })
      .expect(400);
  });
});

describe('POST /api/exams/:examId/invite-bulk', () => {
  const mockCreateTransport = nodemailer.createTransport as jest.Mock;

  it('creates sessions and emails join links (JSON payload)', async () => {
    process.env.SMTP_USER = 'test@examora.dev';
    process.env.SMTP_PASS = 'test-pass';

    const res = await api
      .post(`/api/exams/${examId}/invite-bulk`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        students: [
          { Name: 'Alice', Email: 'alice@example.com', EnrollmentNo: 'CS1' },
          { Name: 'Bob', Email: 'bob@example.com', EnrollmentNo: 'CS2' },
        ],
      })
      .expect(200);

    expect(res.body.data.total).toBe(2);
    expect(res.body.data.successful).toBe(2);
    expect(res.body.data.failed).toBe(0);
    expect(mockCreateTransport).toHaveBeenCalled();
    expect(mockCreateTransport.mock.results[0].value.sendMail).toHaveBeenCalledTimes(2);

    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  it('parses a CSV file upload', async () => {
    const csv = 'Name,Email,EnrollmentNo\nCarol,carol@example.com,CS3\n';

    const res = await api
      .post(`/api/exams/${examId}/invite-bulk`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .attach('file', Buffer.from(csv), 'students.csv')
      .expect(200);

    expect(res.body.data.successful).toBe(1);
    expect(res.body.data.failed).toBe(0);
  });

  it('denies teachers who do not own the exam', async () => {
    const other = await api
      .post('/api/auth/register')
      .send({
        name: 'Other Teacher',
        email: `other_${Date.now()}@example.com`,
        password: 'OtherPass@123',
      })
      .expect(201);

    await api
      .post(`/api/exams/${examId}/invite-bulk`)
      .set('Authorization', `Bearer ${other.body.data.token}`)
      .send({ students: [{ Name: 'Eve', Email: 'eve@example.com' }] })
      .expect(403);
  });
});

describe('POST /api/exams/generate-questions (AI)', () => {
  it('returns questions from the Groq mock when a key is configured', async () => {
    process.env.GROQ_API_KEY = 'test-groq-key';

    const res = await api
      .post('/api/exams/generate-questions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ topic: 'Photosynthesis', count: 1, difficulty: 'medium', type: 'MCQ_SINGLE' })
      .expect(200);

    expect(res.body.status).toBe('success');
    expect(res.body.questions).toHaveLength(1);
    expect(res.body.questions[0].questionText).toBe('Mocked AI question?');

    delete process.env.GROQ_API_KEY;
  });

  it('falls back to the built-in generator without a Groq key', async () => {
    const res = await api
      .post('/api/exams/generate-questions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ topic: 'Databases', count: 3, type: 'MCQ_SINGLE' })
      .expect(200);

    expect(res.body.status).toBe('success');
    expect(res.body.questions).toHaveLength(3);
    expect(res.body.questions[0].questionText).toContain('Databases');
  });

  it('validates the request body with Zod', async () => {
    await api
      .post('/api/exams/generate-questions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ topic: '' })
      .expect(400);
  });
});

describe('GET /api/exams/:id/sessions', () => {
  it('returns every session with server-side warning counts (owner only)', async () => {
    const joinRes = await api
      .post(`/api/exams/${examId}/join`)
      .send({
        studentName: 'Live Grid Student',
        studentEmail: 'live.grid@example.com',
        enrollmentNo: 'CS2023-7777',
      })
      .expect(201);

    const liveToken = joinRes.body.data.sessionToken;

    await api
      .post(`/api/v1/exam-session/${liveToken}/violation`)
      .set('Authorization', `Bearer ${liveToken}`)
      .send({ type: 'TAB_SWITCH', description: 'Switch 1' })
      .expect(201);
    await api
      .post(`/api/v1/exam-session/${liveToken}/violation`)
      .set('Authorization', `Bearer ${liveToken}`)
      .send({ type: 'TAB_SWITCH', description: 'Switch 2' })
      .expect(201);

    const res = await api
      .get(`/api/exams/${examId}/sessions`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    expect(res.body.status).toBe('success');
    expect(res.body.data.exam.id).toBe(examId);
    const row = res.body.data.sessions.find(
      (s: { studentName: string }) => s.studentName === 'Live Grid Student',
    );
    expect(row).toBeTruthy();
    expect(row.warnings).toBe(2);
    expect(row.warningsLimit).toBe(3);
    expect(row.status).toBe('IN_PROGRESS');
  });

  it('returns 404 for an unknown exam', async () => {
    await api
      .get('/api/exams/00000000-0000-0000-0000-000000000000/sessions')
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(404);
  });

  it('requires a valid teacher token (401)', async () => {
    await api.get(`/api/exams/${examId}/sessions`).expect(401);
  });
});

describe('P2-3 configurable warning threshold (Exam.max_warnings)', () => {
  it('terminates only on the Nth warning when maxWarnings is set', async () => {
    const strict = await api
      .post('/api/exams')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({ ...EXAM_PAYLOAD, title: 'Strict Exam', maxWarnings: 5 })
      .expect(201);

    const strictId = strict.body.data.exam.id;
    expect(strict.body.data.exam.max_warnings).toBe(5);

    await api
      .post(`/api/exams/${strictId}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    const joinRes = await api
      .post(`/api/exams/${strictId}/join`)
      .send({
        studentName: 'Strict Student',
        studentEmail: 'strict@example.com',
        enrollmentNo: 'CS2023-5555',
      })
      .expect(201);

    const strictToken = joinRes.body.data.sessionToken;

    for (let i = 1; i <= 5; i++) {
      const res = await api
        .post(`/api/v1/exam-session/${strictToken}/violation`)
        .set('Authorization', `Bearer ${strictToken}`)
        .send({ type: 'TAB_SWITCH', description: `Switch ${i}` })
        .expect(201);

      expect(res.body.data.warningsCount).toBe(i);
      expect(res.body.data.maxWarnings).toBe(5);
      expect(res.body.data.terminated).toBe(i === 5);
    }
  });

  it('rejects publish with unreviewed AI questions, then allows after review', async () => {
    const aiExam = await api
      .post('/api/exams')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        ...EXAM_PAYLOAD,
        title: 'AI Review Gate Exam',
        questions: [
          {
            type: 'MCQ_SINGLE',
            questionText: 'AI drafted: what is 2 + 2?',
            options: ['3', '4'],
            correctAnswer: '4',
            marks: 2,
            aiGenerated: true,
            educatorReviewed: false,
          },
        ],
      })
      .expect(201);

    const aiExamId = aiExam.body.data.exam.id;

    const blocked = await api
      .post(`/api/exams/${aiExamId}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(400);

    expect(blocked.body.status).toBe('error');
    expect(blocked.body.message).toBe(
      '1 AI-generated question(s) have not been reviewed. Review them before publishing.',
    );

    // Approve via edit-and-save (PUT replaces the draft, flags included).
    await api
      .put(`/api/exams/${aiExamId}`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        ...EXAM_PAYLOAD,
        title: 'AI Review Gate Exam',
        questions: [
          {
            type: 'MCQ_SINGLE',
            questionText: 'AI drafted: what is 2 + 2?',
            options: ['3', '4'],
            correctAnswer: '4',
            marks: 2,
            aiGenerated: true,
            educatorReviewed: true,
          },
        ],
      })
      .expect(200);

    await api
      .post(`/api/exams/${aiExamId}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);
  });

  it('derives the column from legacy settings.warningThreshold', async () => {
    const legacy = await api
      .post('/api/exams')
      .set('Authorization', `Bearer ${teacherToken}`)
      .send({
        ...EXAM_PAYLOAD,
        title: 'Legacy Threshold Exam',
        settings: { warningThreshold: 4 },
      })
      .expect(201);

    const legacyId = legacy.body.data.exam.id;
    expect(legacy.body.data.exam.max_warnings).toBe(4);

    await api
      .post(`/api/exams/${legacyId}/publish`)
      .set('Authorization', `Bearer ${teacherToken}`)
      .expect(200);

    const joinRes = await api
      .post(`/api/exams/${legacyId}/join`)
      .send({
        studentName: 'Legacy Student',
        studentEmail: 'legacy@example.com',
        enrollmentNo: 'CS2023-4444',
      })
      .expect(201);

    const legacyToken = joinRes.body.data.sessionToken;

    for (let i = 1; i <= 4; i++) {
      const res = await api
        .post(`/api/v1/exam-session/${legacyToken}/violation`)
        .set('Authorization', `Bearer ${legacyToken}`)
        .send({ type: 'TAB_SWITCH', description: `Switch ${i}` })
        .expect(201);

      expect(res.body.data.maxWarnings).toBe(4);
      expect(res.body.data.terminated).toBe(i === 4);
    }
  });
});
