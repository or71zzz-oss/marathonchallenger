import { createApp } from './app.js';

const isProduction = process.env.NODE_ENV === 'production';
const serveStatic = isProduction && !process.env.VERCEL;
const app = createApp({ serveStatic });

const port = Number(process.env.PORT) || 3001;
const host = isProduction ? '0.0.0.0' : '127.0.0.1';
app.listen(port, host, () => {
  console.log(`API http://${host}:${port}`);
});
