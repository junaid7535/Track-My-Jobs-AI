import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const APPLICATIONS_FILE = path.join(DATA_DIR, 'applications.json');

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function loadApplications() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(APPLICATIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function saveApplications(applications) {
  await ensureDataDir();
  await fs.writeFile(
    APPLICATIONS_FILE,
    JSON.stringify(applications, null, 2),
    'utf-8'
  );
}

export async function applicationsRoutes(fastify) {
  fastify.get('/applications', async () => {
    const applications = await loadApplications();
    return { success: true, applications };
  });

  fastify.post('/applications', async (request, reply) => {
    try {
      const applications = await loadApplications();
      const newApplication = {
        id: Date.now().toString(),
        ...request.body,
        createdAt: new Date().toISOString(),
      };

      applications.unshift(newApplication);
      await saveApplications(applications);

      return reply.code(201).send({
        success: true,
        application: newApplication,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        message: 'Failed to save application',
      });
    }
  });
}