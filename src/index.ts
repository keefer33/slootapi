import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import routes from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
//app.use(helmet()); // Security headers
app.use(
  cors({
    origin: true, // Accept connections from all domains
    credentials: true, // Set to false when using origin: '*' for security
  })
); // Enable CORS for all domains with all headers
//app.use(morgan('combined')); // Logging
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(cookieParser()); // Parse cookies

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`🚀 Main app request: ${req.method} ${req.originalUrl}`);
  next();
});

// Production streaming optimizations
app.use((req, res, next) => {
  if (req.path.includes('/agents') || req.path.includes('/chat')) {
    // Disable all buffering for streaming routes
    res.setHeader('X-Accel-Buffering', 'no'); // Disable Nginx buffering
    res.setHeader(
      'Cache-Control',
      'no-cache, no-store, must-revalidate, private'
    );
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Disable compression for streaming
    res.setHeader('Content-Encoding', 'identity');

    // Set timeout to prevent connection drops
    res.setTimeout(0); // No timeout
  }
  next();
});
// Routes
app.use('/', routes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
  });
});

// Error handler
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Something went wrong!',
    });
  }
);

app.listen(PORT, () => {
  console.log(`🚀 Sloot API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API base URL: http://localhost:${PORT}/api`);
});

export default app;
