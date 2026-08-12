-- Server-side proctoring: the lockdown heartbeat timeout violation is created
-- by the auto-submit sweep (never by the client), so it cannot be faked away
-- by disabling client-side JavaScript listeners.
ALTER TYPE "violation_type" ADD VALUE 'HEARTBEAT_TIMEOUT';