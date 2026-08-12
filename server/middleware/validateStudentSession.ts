import { Request, Response, NextFunction } from 'express';
import { ExamStatus, SubmissionStatus } from '@prisma/client';
import prisma from '../../prisma/client.js';

/**
 * Shape of the authenticated student session attached to the request.
 */
export interface StudentSessionPayload {
  id: string;
  token: string;
  examId: string;
  status: SubmissionStatus;
}

/**
 * Extend Express's Request so downstream controllers get a typed
 * `studentSession` property.
 */
export interface AuthenticatedStudentRequest extends Request {
  studentSession: StudentSessionPayload;
}

/**
 * validateStudentSession(allowedStatuses?)
 *
 * Middleware factory guarding the active exam-taking endpoints. Expects the
 * student's anonymous session token in the `Authorization: Bearer <token>`
 * header.
 *
 * By default only IN_PROGRESS sessions are accepted (covers /violation and
 * /submit). Pass an explicit list to also allow other states — e.g.
 * TERMINATED for the /answer route so a closed session can still flush its
 * last answers.
 *
 * Checks that:
 *  - the token resolves to an existing exam_session,
 *  - the route `:token` param matches the header token (cross-session forgery),
 *  - the session status is in `allowedStatuses` (rejects resubmits),
 *  - the exam is ACTIVE and its end_time has not passed.
 *
 * On success → attaches `req.studentSession` and calls next().
 * On failure → 401 / 403 JSON error.
 */
export const validateStudentSession = (
  allowedStatuses: SubmissionStatus[] = [SubmissionStatus.IN_PROGRESS],
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          status: 'error',
          message: 'Authentication required. Provide a Bearer session token.',
        });
        return;
      }

      const token = authHeader.split(' ')[1].trim();

      if (!token) {
        res.status(401).json({
          status: 'error',
          message: 'Authentication required. Provide a Bearer session token.',
        });
        return;
      }

      // If the route carries a :token param, it must match the header token —
      // otherwise one valid session could be used to tamper with another.
      const routeToken = req.params.token as string | undefined;
      if (routeToken && routeToken !== token) {
        res.status(401).json({
          status: 'error',
          message: 'Session token does not match this route',
        });
        return;
      }

      const session = await prisma.examSession.findUnique({
        where: {
          session_token: token,
          deleted_at: null,
          exam: { deleted_at: null },
        },
        select: {
          id: true,
          session_token: true,
          status: true,
          expires_at: true,
          exam: {
            select: { id: true, status: true, end_time: true },
          },
        },
      });

      if (!session) {
        res.status(401).json({
          status: 'error',
          message: 'Invalid or expired session token',
        });
        return;
      }

      if (
        session.expires_at &&
        new Date() > session.expires_at
      ) {
        res.status(403).json({
          status: 'error',
          message: 'This session has expired — please contact your educator',
        });
        return;
      }

      if (!allowedStatuses.includes(session.status)) {
        res.status(403).json({
          status: 'error',
          message: `Session is already ${session.status.toLowerCase()}`,
        });
        return;
      }

      if (session.exam.status !== ExamStatus.ACTIVE) {
        res.status(403).json({
          status: 'error',
          message: 'This exam is not currently active',
        });
        return;
      }

      if (session.exam.end_time && new Date() > session.exam.end_time) {
        res.status(403).json({
          status: 'error',
          message: 'The exam window has ended — the session was auto-submitted',
        });
        return;
      }

      (req as AuthenticatedStudentRequest).studentSession = {
        id: session.id,
        token: session.session_token,
        examId: session.exam.id,
        status: session.status,
      };

      next();
    } catch (err) {
      next(err);
    }
  };
};
