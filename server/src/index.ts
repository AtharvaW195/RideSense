import express from 'express';
import cors from 'cors';
import path from 'path';
import { createApiRouter } from './routes.js';
import { seedDemoEvents } from './store.js';

const app = express();
const clientBuildPath = path.resolve(process.cwd(), 'client/dist');
const port = process.env.PORT ? Number(process.env.PORT) : 4000;

seedDemoEvents();

app.use(cors());
app.use(express.json());
app.use('/api', createApiRouter());
app.use(express.static(clientBuildPath));

app.get('*', (_request, response, next) => {
  if (response.headersSent) {
    next();
    return;
  }

  response.sendFile(path.join(clientBuildPath, 'index.html'));
});

app.listen(port, () => {
  // The dashboard is intentionally seeded so the UI shows insights on first load.
  console.log(`Ride Analytics backend listening on http://localhost:${port}`);
});