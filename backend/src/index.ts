import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { projectsRouter } from './routes/projects';
import { phasesRouter } from './routes/phases';
import { tasksRouter } from './routes/tasks';
import { dayProfilesRouter } from './routes/dayProfiles';
import { assistantRouter } from './routes/assistant';
import { authRouter } from './routes/auth';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/phases', phasesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/day-profiles', dayProfilesRouter);
app.use('/api/assistant', assistantRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
