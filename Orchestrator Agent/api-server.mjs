// api-server.mjs — Lightweight Express API for Impact OS bug/feature reports
// Exposes POST /api/bug-report to create ClickUp tasks from the web app sidebar form

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { ClickUpClient } from './clickup.mjs';

const PORT = parseInt(process.env.API_PORT || '3099', 10);

const clickup = new ClickUpClient(
  process.env.CLICKUP_API_TOKEN,
  process.env.CLICKUP_LIST_ID,
  process.env.CLICKUP_WORKSPACE_ID
);

const ALLOWED_MIMETYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: ${file.mimetype}. Allowed: PNG, JPG, GIF, WEBP.`));
    }
  },
});

const app = express();

app.use(cors({
  origin: [
    'https://app.scaleforimpact.co',
    /^http:\/\/localhost(:\d+)?$/,
  ],
}));

app.use(express.json());

// Priority mapping: form values → ClickUp priority numbers
const PRIORITY_MAP = {
  critical: 1,
  high: 2,
  normal: 3,
  low: 4,
};

// Module label → ClickUp tag mapping (must match MODULE_MAP keys in executor.mjs)
const MODULE_TAG_MAP = {
  'Brand Creator': 'brand creator',
  'Market Researcher': 'market researcher',
  'Doc Factory': 'doc factory',
  'Copywriter': 'copywriter',
  'Web Designer': 'web designer',
  'Funnel Designer': 'funnel designer',
  'UX/UI (Platform-wide)': 'ux/ui',
  'Other': 'other',
};

function formatDescription({ module, type, description, reporter }) {
  const sections = [];

  if (reporter) {
    sections.push(`### Reporter\n${reporter}`);
  }

  sections.push(`### Module\n${module || 'Not specified'}`);
  sections.push(`### Type\n${type === 'feature' ? 'Feature Request' : 'Bug Report'}`);
  sections.push(`### Description\n${description || 'No description provided.'}`);

  return sections.join('\n\n');
}

app.post('/api/bug-report', async (req, res) => {
  try {
    const { module, type, title, description, priority, reporter } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Title is required.' });
    }

    const prefix = type === 'feature' ? 'Feature Request' : 'Bug';
    const taskName = `${prefix}: ${title}`;

    const clickupPriority = PRIORITY_MAP[priority] ?? 3;

    const tags = [];
    if (module) {
      tags.push(MODULE_TAG_MAP[module] || module.toLowerCase());
    }
    if (type === 'feature') {
      tags.push('feature-request');
    } else {
      tags.push('bug');
    }

    const formattedDescription = formatDescription({ module, type, description, reporter });

    const task = await clickup.createTask({
      name: taskName,
      description: formattedDescription,
      priority: clickupPriority,
      tags,
    });

    console.log(`Created ClickUp task: ${task.id} — ${taskName}`);

    res.json({
      success: true,
      taskId: task.id,
      taskUrl: task.url,
    });
  } catch (err) {
    console.error('Bug report failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/bug-report/:taskId/attachment', (req, res, next) => {
  upload.single('screenshot')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'File exceeds 10MB limit.' });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({ success: false, error: 'taskId is required.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const result = await clickup.uploadAttachment(taskId, req.file.buffer, req.file.originalname);

    console.log(`Attached screenshot to task ${taskId}: ${req.file.originalname}`);

    res.json({
      success: true,
      attachmentUrl: result.url || result.attachment?.url || null,
    });
  } catch (err) {
    console.error('Attachment upload failed:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Impact OS API server listening on port ${PORT}`);
});
