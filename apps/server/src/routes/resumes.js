import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const RESUMES_FILE = path.join(DATA_DIR, 'resumes.json');

// Ensure data directory exists
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating data directory:', err);
  }
}

// Load existing resumes
async function loadResumes() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(RESUMES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

// Save resumes to JSON
async function saveResumes(resumes) {
  try {
    await ensureDataDir();
    await fs.writeFile(RESUMES_FILE, JSON.stringify(resumes, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving resumes:', err);
    throw err;
  }
}

// Extract text from PDF
async function extractPdfText(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}

// Extract text from TXT
function extractTxtText(buffer) {
  return buffer.toString('utf-8');
}

export async function resumeRoutes(fastify, options) {
  // Upload resume endpoint
  fastify.post('/resume/upload', async (request, reply) => {
    reply.type('application/json; charset=utf-8');
    try {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({
          success: false,
          message: 'No file provided',
        });
      }

      const filename = data.filename;
      const fileExt = filename.split('.').pop().toLowerCase();

      // Validate file type
      if (!['pdf', 'txt'].includes(fileExt)) {
        return reply.code(400).send({
          success: false,
          message: 'Only PDF and TXT files are supported',
        });
      }

      // Read file buffer
      const buffer = await data.toBuffer();
      let extractedText = '';

      // Extract text based on file type
      if (fileExt === 'pdf') {
        extractedText = await extractPdfText(buffer);
      } else if (fileExt === 'txt') {
        extractedText = extractTxtText(buffer);
      }

      // Create resume record
      const resumeId = uuidv4();
      const resume = {
        id: resumeId,
        filename: filename,
        fileType: fileExt,
        uploadedAt: new Date().toISOString(),
        text: extractedText,
      };

      // Save to JSON
      await saveResumes([resume]);

      return reply.code(200).send({
        success: true,
        message: 'Resume uploaded successfully',
        resume: {
          id: resume.id,
          filename: resume.filename,
          uploadedAt: resume.uploadedAt,
          textLength: resume.text.length,
        },
      });
    } catch (error) {
      console.error('Resume upload error:', error);
      return reply.code(500).send({
        success: false,
        message: 'Error uploading resume: ' + error.message,
      });
    }
  });

  // Get all resumes endpoint
  fastify.get('/resume', async (request, reply) => {
    try {
      const resumes = await loadResumes();
      return reply.code(200).send({
        success: true,
        resumes: resumes.map((r) => ({
          id: r.id,
          filename: r.filename,
          uploadedAt: r.uploadedAt,
          textLength: r.text.length,
        })),
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        message: 'Error fetching resumes',
      });
    }
  });

  // Get single resume endpoint
  fastify.get('/resume/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      const resumes = await loadResumes();
      const resume = resumes.find((r) => r.id === id);

      if (!resume) {
        return reply.code(404).send({
          success: false,
          message: 'Resume not found',
        });
      }

      return reply.code(200).send({
        success: true,
        resume: resume,
      });
    } catch (error) {
      return reply.code(500).send({
        success: false,
        message: 'Error fetching resume',
      });
    }
  });

  // Replace/delete old resume and upload new one
  fastify.put('/resume', async (request, reply) => {
    try {
      const data = await request.file();

      if (!data) {
        return reply.code(400).send({
          success: false,
          message: 'No file provided',
        });
      }

      const filename = data.filename;
      const fileExt = filename.split('.').pop().toLowerCase();

      if (!['pdf', 'txt'].includes(fileExt)) {
        return reply.code(400).send({
          success: false,
          message: 'Only PDF and TXT files are supported',
        });
      }

      const buffer = await data.toBuffer();
      let extractedText = '';

      if (fileExt === 'pdf') {
        extractedText = await extractPdfText(buffer);
      } else if (fileExt === 'txt') {
        extractedText = extractTxtText(buffer);
      }

      // Clear old resumes and create new one
      const resumeId = uuidv4();
      const resume = {
        id: resumeId,
        filename: filename,
        fileType: fileExt,
        uploadedAt: new Date().toISOString(),
        text: extractedText,
      };

      await saveResumes([resume]);

      return reply.code(200).send({
        success: true,
        message: 'Resume replaced successfully',
        resume: {
          id: resume.id,
          filename: resume.filename,
          uploadedAt: resume.uploadedAt,
          textLength: resume.text.length,
        },
      });
    } catch (error) {
      console.error('Resume update error:', error);
      return reply.code(500).send({
        success: false,
        message: 'Error updating resume: ' + error.message,
      });
    }
  });
}
