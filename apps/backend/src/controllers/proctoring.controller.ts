import { Request, Response, NextFunction } from 'express';
import { PrismaClient, SessionStatus, EventType } from '@prisma/client';
import { MAX_WARNINGS } from '../socket/proctoring.handler.js';

const prisma = new PrismaClient();

export interface LogProctoringEventBody {
  sessionToken: string;
  eventType: EventType | string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/exams/:id/proctoring-event
 * Public route — authenticated by the anonymous student session token.
 *
 * Persists a ProctoringEvent for the session and enforces the 3-warning rule:
 * every event increments warningsCount; at MAX_WARNINGS the session is
 * automatically TERMINATED (mirrors the Socket.io handler for REST-only
 * clients that cannot maintain a socket connection).
 */
export const logProctoringEvent = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id: examId } = req.params;
    const { sessionToken, eventType, reason, metadata }: LogProctoringEventBody = req.body;

    const session = await prisma.studentSession.findFirst({
      where: { sessionToken, examId },
      select: { id: true, warningsCount: true, status: true },
    });

    if (!session) {
      res.status(401).json({ status: 'error', message: 'Invalid session token for this exam' });
      return;
    }

    if (session.status !== SessionStatus.ACTIVE) {
      res.status(400).json({
        status: 'error',
        message: `Session is already ${session.status.toLowerCase()}`,
      });
      return;
    }

    const normalizedType = mapEventType(eventType, reason);

    const event = await prisma.proctoringEvent.create({
      data: {
        sessionId: session.id,
        eventType: normalizedType,
        metadata: {
          reason: reason ?? 'Proctoring violation',
          ...(metadata ?? {}),
        },
      },
      select: { id: true, eventType: true, timestamp: true },
    });

    const updated = await prisma.studentSession.update({
      where: { id: session.id },
      data: { warningsCount: { increment: 1 } },
      select: { id: true, warningsCount: true },
    });

    const terminated = updated.warningsCount >= MAX_WARNINGS;

    if (terminated) {
      await prisma.studentSession.update({
        where: { id: session.id },
        data: { status: SessionStatus.TERMINATED, submittedAt: new Date() },
        select: { id: true },
      });
    }

    res.status(201).json({
      status: 'success',
      data: {
        event,
        warningsCount: updated.warningsCount,
        warningsLimit: MAX_WARNINGS,
        terminated,
        reason,
      },
    });
  } catch (err) {
    next(err);
  }
};

/** Maps arbitrary event type strings to the Prisma EventType enum. */
function mapEventType(typeStr: EventType | string | undefined, reason?: string): EventType {
  const lowerReason = reason?.toLowerCase() ?? '';
  const type = (typeStr ?? '').toUpperCase();

  if (type === 'FACE_LOST' || (!type && lowerReason.includes('face lost'))) return EventType.FACE_LOST;
  if (type === 'FULLSCREEN_EXIT' || (!type && lowerReason.includes('fullscreen'))) return EventType.FULLSCREEN_EXIT;
  if (type === 'MULTIPLE_FACES' || (!type && lowerReason.includes('multiple faces'))) return EventType.MULTIPLE_FACES;
  if (type === 'PHONE_DETECTED' || (!type && lowerReason.includes('phone'))) return EventType.PHONE_DETECTED;
  return EventType.TAB_SWITCH;
}
