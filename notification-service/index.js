require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const cors = require('cors');
const morgan = require('morgan');
const axios = require('axios');

// --- 1. Konfigurasi Awal ---
const app = express();
const PORT = process.env.PORT || 3005;
const API_GATEWAY_URL = process.env.API_GATEWAY_URL;

if (!API_GATEWAY_URL) {
  throw new Error("FATAL_ERROR: API_GATEWAY_URL tidak ada di .env");
}

const isProduction = process.env.NODE_ENV === 'production';

// --- 2. Middleware Global ---
app.use(cors());
app.use(express.json());
app.use(morgan(isProduction ? 'combined' : 'dev'));

// --- 3. Database (Sequelize + SQLite) ---
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: isProduction ? false : console.log,
});

const NotificationLog = sequelize.define('NotificationLog', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  type: { type: DataTypes.STRING, defaultValue: 'INFO' },
  status: { 
    type: DataTypes.ENUM('processing', 'sent', 'failed'), 
    defaultValue: 'processing' // 'processing' lebih akurat saat baru dibuat
  }
}, {
  tableName: 'notification_logs',
  timestamps: true
});

// --- 4. Utilitas (Helpers) ---

/**
 * Wrapper untuk menangani error pada async route handlers.
 * Menghilangkan kebutuhan try...catch di setiap rute.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Middleware untuk memastikan header X-User-Id ada
 */
const checkAuth = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Akses ditolak. Header X-User-Id tidak ada.' });
  }
  req.userId = userId; // Lampirkan ke request agar mudah diakses
  next();
};

/**
 * [CONSUMER] Fungsi Asinkron untuk memproses notifikasi
 * (Dipanggil secara "fire-and-forget", menangani error sendiri)
 */
async function processNotification(log, token) {
  try {
    // 1. Panggil User Service (via Gateway) untuk dapatkan email
    const userResponse = await axios.get(`${API_GATEWAY_URL}/api/users/${log.user_id}`, {
      headers: { Authorization: token }
    });

    const email = userResponse.data.email;
    if (!email) {
      throw new Error('Email user tidak ditemukan');
    }

    // 2. Kirim notifikasi (Simulasi dengan console.log)
    console.log('--------------------------------------------------');
    console.log(`[SIMULASI PENGIRIMAN NOTIFIKASI]`);
    console.log(`KE: ${email} (User ID: ${log.user_id})`);
    console.log(`PESAN: ${log.message}`);
    console.log(`TIPE: ${log.type}`);
    console.log('--------------------------------------------------');

    // (Di dunia nyata, di sini Anda akan memanggil Nodemailer, SendGrid, dll)
    
    // 3. Update status ke 'sent' jika berhasil
    await log.update({ status: 'sent' });

  } catch (error) {
    console.error(`Gagal memproses notifikasi (ID: ${log.id}): ${error.message}`);
    // Update status log ke 'failed' jika user tidak ditemukan atau ada error
    await log.update({ status: 'failed' });
  }
}

// --- 5. Rute (Routes) ---

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'notification-service' });
});

/**
 * [PROVIDER]
 * POST / - Endpoint internal untuk menerima permintaan notifikasi
 * Dipanggil oleh service lain (cth: Enrollment Service)
 */
app.post('/', async (req, res, next) => {
  // Kita gunakan try...catch lokal di sini karena ini adalah
  // endpoint "penerima" yang kritis.
  try {
    const { user_id, message, type } = req.body;
    // Ambil token yang diteruskan oleh layanan lain
    const token = req.headers.authorization;

    if (!user_id || !message) {
      return res.status(400).json({ error: 'user_id dan message diperlukan' });
    }
    if (!token) {
      return res.status(401).json({ error: 'Endpoint ini memerlukan token internal service' });
    }

    // 1. Buat log notifikasi di DB
    const log = await NotificationLog.create({
      user_id,
      message,
      type: type || 'INFO',
      status: 'processing' // Status awal
    });

    // 2. Panggil prosesor secara asinkron (JANGAN DITUNGGU/await)
    // Ini adalah kunci dari arsitektur decoupled.
    processNotification(log, token);

    // 3. Langsung beri respon 201 (Created)
    res.status(201).json({ message: 'Notifikasi dicatat dan sedang diproses', log });
    
  } catch (error) {
    // Jika GAGAL membuat log di DB, lempar ke global error handler
    next(error); 
  }
});

/**
 * [PROVIDER]
 * GET /my-notifications - Mengambil riwayat notifikasi untuk user (dari token)
 */
app.get('/my-notifications', checkAuth, asyncHandler(async (req, res) => {
  // req.userId diambil dari middleware checkAuth
  const notifications = await NotificationLog.findAll({
    where: { user_id: req.userId },
    order: [['createdAt', 'DESC']],
    limit: 20
  });

  res.json(notifications);
}));


// --- 6. Penanganan Error (Global) ---

// Catch-all untuk 404 (Endpoint tidak ditemukan)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint Not Found', path: req.originalUrl });
});

// Error handler utama (Global)
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);

  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map(e => e.message);
    return res.status(400).json({ error: 'Validation failed', details: messages });
  }

  // Error default
  res.status(500).json({
    error: 'Internal Server Error',
    details: isProduction ? 'Terjadi kesalahan pada server' : err.message
  });
});


// --- 7. Menjalankan Server ---

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Koneksi database (SQLite) berhasil.');
    
    await sequelize.sync();
    console.log('Database tersinkronisasi.');

    app.listen(PORT, () => {
      console.log(`Notification Service (Layanan 5) berjalan di http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('Gagal menjalankan server:', err);
    process.exit(1); // Keluar jika koneksi DB gagal
  }
};

startServer();