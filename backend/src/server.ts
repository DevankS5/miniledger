import { createApp } from './app';
import { migrate } from './db';

const port = Number(process.env.PORT || 4000);

migrate()
  .then(() => createApp().listen(port, () => console.log(`MiniLedger API on http://localhost:${port}`)))
  .catch((err) => {
    console.error('Could not start:', err.message);
    process.exit(1);
  });
