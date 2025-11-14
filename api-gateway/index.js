require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// --- 1. Middleware Global ---

// Konfigurasi CORS dari environment variable
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5000'
};
app.use(cors(corsOptions));

// Logging yang adaptif (Production vs Development)
if (process.env.NODE_ENV === 'production') {
  app.use(morgan('combined')); // Logger standar untuk produksi
} else {
  app.use(morgan('dev')); // Logger 'dev' untuk development
}

// --- 2. Daftar URL Microservices ---
const services = {
  user: process.env.USER_SERVICE_URL,
  course: process.env.COURSE_SERVICE_URL,
  enrollment: process.env.ENROLLMENT_SERVICE_URL,
  progress: process.env.PROGRESS_SERVICE_URL,
  notification: process.env.NOTIFICATION_SERVICE_URL,
};

// --- 3. Rute Publik (Tidak Memerlukan JWT) ---

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: Object.keys(services)
  });
});

// Rute Publik untuk Autentikasi (Login/Register)
// Diforward ke User Service
app.use('/api/auth', createProxyMiddleware({
    target: services.user,
    changeOrigin: true,
    pathRewrite: {
      '^/api/auth': '/auth' // /api/auth/login -> /auth/login
    }
}));

// --- 4. Middleware Autentikasi (Wajib JWT) ---
// SEMUA RUTE DI BAWAH INI AKAN DILINDUNGI OLEH MIDDLEWARE INI

// Middleware untuk memverifikasi JWT secara asinkron
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1]; // Format: Bearer TOKEN
  if (!token) {
    return res.status(401).json({ error: 'Access denied. Token format invalid.' });
  }

  // Verifikasi token secara asinkron (non-blocking)
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      // err.name bisa 'TokenExpiredError' atau 'JsonWebTokenError'
      return res.status(403).json({ error: 'Invalid or expired token.', details: err.message });
    }
    req.user = decoded; // Menyimpan data user (id, role, email) ke request
    next();
  });
};

// Terapkan middleware JWT untuk semua rute di bawah ini
app.use(authenticateJWT);

// --- 5. Fungsi Bantuan Proxy (Helper) ---
// Untuk rute terproteksi yang meneruskan info user
const createAuthProxy = (target, servicePrefix) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      // Meneruskan informasi user (dari token) ke service backend
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.id);
        proxyReq.setHeader('X-User-Role', req.user.role);
        proxyReq.setHeader('X-User-Email', req.user.email);
      }
    },
    pathRewrite: (path, req) => {
      // Menghapus prefix. Cth: /api/users/1 -> /1
      const regex = new RegExp(`^/api/${servicePrefix}`);
      const newPath = path.replace(regex, '');
      
      // Jika hasil replace string kosong (cth: dari /api/users),
      // kembalikan '/', jika tidak, kembalikan path (cth: /1)
      return newPath || '/';
    }
  });
};

// --- 6. Definisi Rute Proxy Terproteksi (Wajib JWT) ---

app.use('/api/users', createAuthProxy(services.user, 'users'));
app.use('/api/courses', createAuthProxy(services.course, 'courses'));

// Proxy khusus untuk /api/modules (Target: Course Service)
// Menggunakan pathRewrite kustom karena prefixnya berbeda
app.use('/api/modules', createProxyMiddleware({
    target: services.course, // modules adalah bagian dari course service
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      if (req.user) {
        proxyReq.setHeader('X-User-Id', req.user.id);
        proxyReq.setHeader('X-User-Role', req.user.role);
        proxyReq.setHeader('X-User-Email', req.user.email);
      }
    },
    pathRewrite: {
      '^/api': '' // /api/modules/2 -> /modules/2
    }
}));

app.use('/api/enrollments', createAuthProxy(services.enrollment, 'enrollments'));
app.use('/api/progress', createAuthProxy(services.progress, 'progress'));
app.use('/api/notifications', createAuthProxy(services.notification, 'notifications'));

// --- 7. Penanganan Error & 404 (Catch-all) ---
// Diletakkan di paling bawah untuk menangkap rute yang tidak terdefinisi
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint Not Found', path: req.originalUrl });
});

// (Opsional) Error handler 500
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// --- 8. Jalankan Server ---
app.listen(PORT, () => {
  console.log(`API Gateway (Optimized) running on port ${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`CORS_ORIGIN diizinkan: ${corsOptions.origin}`);
    console.log(`User Service Target: ${services.user}`);
  }
});