import dotenv from 'dotenv';

import { connectDatabase } from './prisma/client.js';
import { createApp, AppBundle } from './server/app.js';
import { startAutoSubmitSweep } from './server/jobs/autoSubmit.sweep.js';

// Load environment variables
dotenv.config();

// Build the Express app + Socket.io server (single source of truth in server/app.ts)
const { app, httpServer, io }: AppBundle = createApp();

// Socket.io adapter (for scaling across multiple instances)
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

// Redis adapter for Socket.io (when Redis is available)
const setupRedisAdapter = async (): Promise<void> => {
  if (!io) return;
  if (process.env.REDIS_URL) {
    try {
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();

      await pubClient.connect();
      await subClient.connect();

      io.adapter(createAdapter(pubClient, subClient));
      console.log('✅ Redis adapter for Socket.io initialized');
    } catch (error) {
      console.warn('⚠️ Redis not available, using default in-memory adapter');
    }
  }
};

// Start server
const PORT = process.env.PORT || 4000;

// Periodic auto-submit sweep (closes IN_PROGRESS sessions whose exam end_time
// has passed). Started after the HTTP server is listening so the first sweep
// never races the boot sequence.
let autoSubmitSweep: NodeJS.Timeout | null = null;

const startServer = async (): Promise<void> => {
  try {
    // Connect to database
    await connectDatabase();

    // Setup Socket.io adapter (Redis if available)
    await setupRedisAdapter();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📡 Socket.io ready for connections`);
      console.log(`🌐 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      autoSubmitSweep = startAutoSubmitSweep();
      console.log(`⏱️  Auto-submit sweep started (every 60s)`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  if (autoSubmitSweep) clearInterval(autoSubmitSweep);
  io?.close();
  await import('./prisma/client.js').then((m) => m.default.$disconnect());
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Only listen when executed directly (not when imported by tests)
const isMainModule =
  typeof require !== 'undefined' && require.main === module;

if (isMainModule) {
  startServer();
}

export { app, httpServer, io };
