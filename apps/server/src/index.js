import 'dotenv/config';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';

import { loginRoute } from './routes/auth.js';
import { resumeRoutes } from './routes/resumes.js';
import { jobsRoutes } from './routes/jobs.js';
import { applicationsRoutes } from './routes/applications.js';

const fastify = Fastify({
  logger: true,
});

await fastify.register(cors, {
  origin: true,
});

await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

fastify.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
  };
});

fastify.get('/', async () => {
  return {
    message: 'Backend running successfully',
  };
});

fastify.get('/api/health', async () => {
  return {
    ok: true,
  };
});

await fastify.register(loginRoute, { prefix: '/api' });
await fastify.register(resumeRoutes, { prefix: '/api' });
await fastify.register(jobsRoutes, { prefix: '/api' });
await fastify.register(applicationsRoutes, { prefix: '/api' });

const start = async () => {
  try {
    await fastify.listen({
      port: Number(process.env.PORT) || 3001,
      host: '0.0.0.0',
    });
    console.log('Server running on port', Number(process.env.PORT) || 3001);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();