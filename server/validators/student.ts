import { z } from 'zod';

export const studentJoinSchema = z.object({
  studentName: z.string().min(2, 'Name must be at least 2 characters'),
  studentEmail: z.string().email('Invalid email address'),
  enrollmentNo: z.string().min(1, 'Enrollment number is required'),
});

export type StudentJoinInput = z.infer<typeof studentJoinSchema>;