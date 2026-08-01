import { Request, Response, NextFunction } from 'express';
import { PrismaClient, SubmissionStatus, ViolationType } from '@prisma/client';
import { MAX_WARNINGS } from '../socket/proctoring.handler.js';

const prisma = new PrismaClient();

export interface LogProctoringEventBody {
  sessionToken: string;
  eventType: ViolationType | string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/exams/:id/proctoring-event
 * Public route — authenticated by the anonymous student session token.
 *
 * Persists a Violation for the session and enforces the 3-warning rule:
 * every violation is counted; at MAX_WARNINGS the session is automatically
 * TERMINATED (mirrors the Socket.io handler for REST-only clients that
 * cannot maintain a socket connection).
 */
export const logProctoringEvent = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id: examId } = req.params;
    const { sessionToken, eventType, reason, metadata }: LogProctoringEventBody = req.body;

    const session = await prisma.examSession.findFirst({
      where: { session_token: sessionToken, exam_id: examId },
      select: { id: true, status: true },
    });

    if (!session) {
      res.status(401).json({ status: 'error', message: 'Invalid session token for this exam' });
      return;
    }

    if (session.status !== SubmissionStatus.IN_PROGRESS) {
      res.status(400).json({
        status: 'error',
        message: `Session is already ${session.status.toLowerCase()}`,
      });
      return;
    }

    const normalizedType = mapViolationType(eventType, reason);

    const event = await prisma.violation.create({
      data: {
        session_id: session.id,
        type: normalizedType,
        description: reason ?? 'Proctoring violation',
        metadata: {
          reason: reason ?? 'Proctoring violation',
          ...(metadata ?? {}),
        },
      },
      select: { id: true, type: true, occurred_at: true },
    });

    const warningsCount = await prisma.violation.count({
      where: { session_id: session.id },
    });

    const terminated = warningsCount >= MAX_WARNINGS;

    if (terminated) {
      await prisma.examSession.update({
        where: { id: session.id },
        data: { status: SubmissionStatus.TERMINATED, submitted_at: new Date() },
        select: { id: true },
      });
    }

    res.status(201).json({
      status: 'success',
      data: {
        event: {
          id: event.id,
          type: event.type,
          occurred_at: event.occurred_at,
        },
        warningsCount,
        warningsLimit: MAX_WARNINGS,
        terminated,
        reason,
      },
    });
  } catch (err) {
    next(err);
  }
};

/** Maps arbitrary event type strings to the Prisma ViolationType enum. */
function mapViolationType(typeStr: ViolationType | string | undefined, reason?: string): ViolationType {
  const lowerReason = reason?.toLowerCase() ?? '';
  const type = (typeStr ?? '').toUpperCase();

  if (type === 'FACE_LOST' || type === 'AI_OVERLAY' || (!type && lowerReason.includes('face lost'))) return ViolationType.AI_OVERLAY;
  if (type === 'FULLSCREEN_EXIT' || type === 'MINIMIZE' || (!type && lowerReason.includes('fullscreen'))) return ViolationType.MINIMIZE;
  if (type === 'MULTIPLE_FACES' || (!type && lowerReason.includes('multiple faces'))) return ViolationType.SCREEN_CAPTURE;
  if (type === 'PHONE_DETECTED' || type === 'APP_SWITCH' || (!type && lowerReason.includes('phone'))) return ViolationType.APP_SWITCH;
  if (type === 'MOBILE_BUTTON') return ViolationType.MOBILE_BUTTON;
  if (type === 'DEVTOOLS') return ViolationType.DEVTOOLS;
  if (type === 'KEYBOARD_SHORTCUT') return ViolationType.KEYBOARD_SHORTCUT;
  return ViolationType.TAB_SWITCH;
}
