require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const axios = require('axios');
const cors = require('cors');
const morgan = require('morgan');

// --- 1. Konfigurasi Awal ---
const app = express();
const PORT = process.env.PORT || 3003;
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

const Enrollment = sequelize.define('Enrollment', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  course_id: { type: DataTypes.INTEGER, allowNull: false },
  enrollment_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  status: {
    type: DataTypes.ENUM('active', 'completed'),
    defaultValue: 'active'
  }
}, {
  tableName: 'enrollments',
  timestamps: false,
  indexes: [
    // Indeks unik untuk mencegah user mendaftar ke kursus yang sama dua kali
    {
      unique: true,
      fields: ['user_id', 'course_id']
    }
  ]
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
 * Middleware untuk otentikasi peran (RBAC)
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    const userRole = req.headers['x-user-role'];
    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({ error: 'Akses ditolak. Peran tidak memadai.' });
    }
    next();
  };
};

/**
 * [CONSUMER] Helper untuk memanggil Notification Service.
 * Dibuat non-blocking (tidak pakai await di rute)
 */
async function sendNotification(token, user_id, message, type) {
  try {
    // Panggil Notification Service via Gateway
    await axios.post(`${API_GATEWAY_URL}/api/notifications`,
      { user_id, message, type },
      { headers: { Authorization: token } }
    );
    console.log('Notifikasi terkirim (dicatat)');
  } catch (error) {
    // Gagal kirim notifikasi JANGAN sampai menggagalkan proses utama
    console.error('Gagal mengirim notifikasi:', error.message);
  }
}

/**
 * [CONSUMER] Helper untuk memvalidasi keberadaan kursus
 */
const validateCourseExists = async (courseId, token) => {
  try {
    const response = await axios.get(`${API_GATEWAY_URL}/api/courses/${courseId}`, {
      headers: { Authorization: token }
    });
    return response.data; // Kembalikan data kursus (cth: title)
  } catch (error) {
    if (error.response && error.response.status === 404) {
      const err = new Error('Kursus tidak ditemukan');
      err.status = 404; // Set status untuk ditangkap error handler
      throw err;
    }
    const err = new Error('Gagal memvalidasi kursus (Layanan 2)');
    err.status = 502; // 502 Bad Gateway (service lain error)
    throw err;
  }
};

/**
 * [CONSUMER] Helper untuk memvalidasi keberadaan user
 */
const validateUserExists = async (userId, token) => {
  try {
    await axios.get(`${API_GATEWAY_URL}/api/users/${userId}`, {
      headers: { Authorization: token }
    });
    // Jika sukses, tidak perlu return apa-apa
  } catch (error) {
    if (error.response && error.response.status === 404) {
      const err = new Error('User tidak ditemukan');
      err.status = 404;
      throw err;
    }
    const err = new Error('Gagal memvalidasi user (Layanan 1)');
    err.status = 502;
    throw err;
  }
};


// --- 5. Rute (Routes) ---

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'enrollment-service' });
});

/**
 * [CONSUMER]
 * POST /:courseId - Mendaftarkan user (dari token) ke sebuah kursus
 */
app.post('/:courseId', asyncHandler(async (req, res) => {
  const user_id = req.headers['x-user-id'];
  const token = req.headers.authorization;
  const { courseId } = req.params;

  if (!user_id || !token) {
    return res.status(401).json({ error: 'Akses ditolak. Header X-User-Id atau Token tidak ada.' });
  }

  // 1. Validasi Kursus (menggunakan helper)
  const courseData = await validateCourseExists(courseId, token);

  // 2. Validasi User (menggunakan helper)
  await validateUserExists(user_id, token);

  // 3. Buat Enrollment (jika error, akan ditangkap global handler)
  const newEnrollment = await Enrollment.create({
    user_id,
    course_id: courseId
  });

  // 4. Kirim Notifikasi (non-blocking, tidak perlu ditunggu)
  sendNotification(
    token,
    user_id,
    `Anda telah berhasil mendaftar di kursus: ${courseData.title || 'kursus'}`,
    'ENROLLMENT_SUCCESS'
  );

  res.status(201).json({
    message: 'Berhasil mendaftar di kursus',
    enrollment: newEnrollment
  });
}));

/**
 * [PROVIDER]
 * GET /my-enrollments - Melihat semua kursus yang diambil user
 */
app.get('/my-enrollments', asyncHandler(async (req, res) => {
  const user_id = req.headers['x-user-id'];
  if (!user_id) {
    return res.status(401).json({ error: 'User tidak terautentikasi' });
  }

  const enrollments = await Enrollment.findAll({
    where: { user_id }
  });
  res.json(enrollments);
}));

/**
 * [PROVIDER]
 * GET /course-roster/:courseId - (Untuk Instruktur) Melihat siapa saja di kursus
 */
app.get('/course-roster/:courseId', checkRole(['instructor', 'admin']), asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const enrollments = await Enrollment.findAll({
    where: { course_id: courseId },
    attributes: ['user_id', 'enrollment_date', 'status']
  });
  res.json(enrollments);
}));

/**
 * [PROVIDER]
 * GET /check - Endpoint internal untuk validasi oleh service lain (cth: Progress Service)
 * Memeriksa apakah user terdaftar (dan aktif) di kursus.
 */
app.get('/check', asyncHandler(async (req, res) => {
  // Ambil dari header (jika dipanggil Gateway) atau query (jika dipanggil service-to-service)
  const user_id = req.headers['x-user-id'] || req.query.user_id;
  const courseId = req.query.courseId;

  if (!user_id || !courseId) {
    return res.status(400).json({ error: 'user_id dan courseId diperlukan' });
  }

  const enrollment = await Enrollment.findOne({
    where: {
      user_id: user_id,
      course_id: courseId,
      status: 'active' // Pastikan masih aktif
    }
  });

  if (!enrollment) {
    return res.status(404).json({ error: 'User tidak terdaftar di kursus ini' });
  }

  res.json(enrollment);
}));


// --- 6. Penanganan Error (Global) ---

// Catch-all untuk 404 (Endpoint tidak ditemukan)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint Not Found', path: req.originalUrl });
});

// Error handler utama (Global)
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);

  // Error spesifik dari helper validasi (404 atau 502)
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  // Error unik dari Sequelize (sudah terdaftar)
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Anda sudah terdaftar di kursus ini' });
  }
  
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: 'Validation failed', details: err.errors.map(e => e.message) });
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
      console.log(`Enrollment Service (Layanan 3) berjalan di http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('Gagal menjalankan server:', err);
    process.exit(1); // Keluar jika koneksi DB gagal
  }
};

startServer();