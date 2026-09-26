/**
 * Prisma seed — demo teacher, exam, and graded sessions for screenshots,
 * manual QA, and analytics verification (P0-3 / P3-1).
 *
 * Idempotent: every row is upserted on its unique key, so re-running never
 * duplicates. Run with: npx prisma db seed
 */
import bcrypt from 'bcryptjs';
import { PrismaClient, SubmissionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const existingTeacher = await prisma.teacher.findFirst({
    where: { email: 'seed.teacher@example.com', deleted_at: null },
    select: { id: true, email: true },
  });
  const teacher = existingTeacher ??
    (await prisma.teacher.create({
      data: {
        email: 'seed.teacher@example.com',
        name: 'Seed Teacher',
        password_hash: bcrypt.hashSync('SeedPass@123', 10),
        college_name: 'Examora Demo College',
      },
      select: { id: true, email: true },
    }));

  const exam = await prisma.exam.upsert({
    where: { id: '00000000-0000-4000-8000-seedexam0001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-seedexam0001',
      title: 'Seeded Demo Exam',
      description: 'Demo data for screenshots and manual QA.',
      duration_minutes: 30,
      total_marks: 6,
      status: 'ACTIVE',
      access_uuid: 'seed-access-uuid-0001',
      created_by: teacher.id,
      questions: {
        create: [
          {
            type: 'MCQ_SINGLE',
            question_text: 'What is the capital of France?',
            options: ['Paris', 'London'],
            correct_answer: 'Paris',
            marks: 2,
            order_index: 1,
          },
          {
            type: 'MCQ_SINGLE',
            question_text: 'Which planet is the Red Planet?',
            options: ['Mars', 'Venus'],
            correct_answer: 'Mars',
            marks: 2,
            order_index: 2,
          },
          {
            type: 'MCQ_SINGLE',
            question_text: 'What is 2 + 2?',
            options: ['3', '4'],
            correct_answer: '4',
            marks: 2,
            order_index: 3,
          },
        ],
      },
    },
  });

  const questions = await prisma.question.findMany({
    where: { exam_id: exam.id },
    orderBy: { order_index: 'asc' },
  });

  // Three submitted sessions with a known answer pattern:
  // S1 all correct (6/6), S2 Q1 wrong (4/6), S3 Q1+Q2 wrong and Q3 blank (0/6).
  const plans = [
    { name: 'Seed Student One', email: 'seed.s1@example.com', enr: 'SEED001', answers: ['Paris', 'Mars', '4'] as (string | null)[] },
    { name: 'Seed Student Two', email: 'seed.s2@example.com', enr: 'SEED002', answers: ['London', 'Mars', '4'] as (string | null)[] },
    { name: 'Seed Student Three', email: 'seed.s3@example.com', enr: 'SEED003', answers: ['London', 'Venus', null] as (string | null)[] },
  ];

  for (const plan of plans) {
    // Idempotent without a compound unique key: reuse the existing session
    // for this identity, else create one.
    const existing = await prisma.examSession.findFirst({
      where: {
        exam_id: exam.id,
        student_email: plan.email,
        enrollment_number: plan.enr,
      },
      select: { id: true },
    });
    const session = existing ??
      (await prisma.examSession.create({
        data: {
          exam_id: exam.id,
          session_token: `seed-token-${plan.enr.toLowerCase()}`,
          student_name: plan.name,
          student_email: plan.email,
          enrollment_number: plan.enr,
          status: SubmissionStatus.SUBMITTED,
          submitted_at: new Date(),
        },
        select: { id: true },
      }));

    for (const [i, q] of questions.entries()) {
      const text = plan.answers[i];
      if (text === null) continue;
      await prisma.answer.upsert({
        where: { session_id_question_id: { session_id: session.id, question_id: q.id } },
        update: { answer_text: text },
        create: { session_id: session.id, question_id: q.id, answer_text: text },
      });
    }
  }

  console.log(`Seed complete: teacher=${teacher.email} exam=${exam.id}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
