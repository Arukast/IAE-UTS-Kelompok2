require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes, Op } = require('sequelize');
const cors = require('cors');
const morgan = require('morgan');

// --- 1. Konfigurasi Awal ---
const app = express();
const PORT = process.env.PORT || 3002;

// Cek NODE_ENV untuk logging
const isProduction = process.env.NODE_ENV === 'production';

// --- 2. Middleware Global ---
app.use(cors());
app.use(express.json());
// Gunakan 'combined' log di produksi, 'dev' di development
app.use(morgan(isProduction ? 'combined' : 'dev'));

// --- 3. Database (Sequelize + SQLite) ---
// Pastikan DATABASE_URL ada di file .env (cth: sqlite:courses.sqlite)
const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: isProduction ? false : console.log, // Nonaktifkan log SQL di produksi
});

// Model Course (TANPA 'price')
const Course = sequelize.define('Course', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.TEXT },
  instructor_id: { type: DataTypes.INTEGER, allowNull: false }, // ID dari User Service
  thumbnail_url: { 
    type: DataTypes.STRING, 
    allowNull: true,
    defaultValue: 'https://via.placeholder.com/300x200.png?text=Kursus'
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, { tableName: 'courses', timestamps: true });

// Model Module
const Module = sequelize.define('Module', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  module_order: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'modules', timestamps: false });

// Model Lesson
const Lesson = sequelize.define('Lesson', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  content_type: { type: DataTypes.ENUM('video', 'text', 'quiz'), allowNull: false },
  content_url_or_text: { type: DataTypes.TEXT },
  lesson_order: { type: DataTypes.INTEGER, allowNull: false }
}, { tableName: 'lessons', timestamps: false });

// --- 4. Relasi Database ---
Course.hasMany(Module, { foreignKey: 'course_id', onDelete: 'CASCADE' });
Module.belongsTo(Course, { foreignKey: 'course_id' });

Module.hasMany(Lesson, { foreignKey: 'module_id', onDelete: 'CASCADE' });
Lesson.belongsTo(Module, { foreignKey: 'module_id' });

// --- 5. Utilitas (Helpers) ---

/**
 * Wrapper untuk menangani error pada async route handlers.
 * Menghilangkan kebutuhan try...catch di setiap rute.
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Middleware untuk otentikasi peran (Role-Based Access Control)
 * Membaca header yang dikirim oleh API Gateway
 */
const checkRole = (roles) => {
  return (req, res, next) => {
    const userRole = req.headers['x-user-role'];
    if (!userRole || !roles.includes(userRole)) {
      // Jika peran tidak ada atau tidak sesuai, kirim 403 Forbidden
      return res.status(403).json({ error: 'Akses ditolak. Peran tidak memadai.' });
    }
    next();
  };
};

// --- 6. Rute (Routes) ---

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'course-service' });
});

// === Rute Kursus ===

// POST / (Membuat Kursus baru)
app.post('/', checkRole(['instructor', 'admin']), asyncHandler(async (req, res) => {
  const { title, description, thumbnail_url, category } = req.body;
  const instructor_id = req.headers['x-user-id']; // Diambil dari header (sudah diautentikasi Gateway)

  if (!title || !description) {
    return res.status(400).json({ error: 'Title dan description diperlukan' });
  }

  const newCourse = await Course.create({
    title,
    description,
    instructor_id,
    thumbnail_url, // Akan menggunakan default value jika null/undefined
    category
  });
  res.status(201).json(newCourse);
}));

// GET / (Mendapatkan semua kursus) - Untuk semua peran
app.get('/', asyncHandler(async (req, res) => {
  const courses = await Course.findAll({
    order: [['createdAt', 'DESC']]
  });
  res.json(courses);
}));

// GET /:id (Mendapatkan detail kursus, termasuk modul dan lesson)
app.get('/:id', asyncHandler(async (req, res) => {
  const course = await Course.findByPk(req.params.id, {
    include: {
      model: Module,
      include: {
        model: Lesson,
        order: [['lesson_order', 'ASC']] // Urutkan lessons
      },
      order: [['module_order', 'ASC']] // Urutkan modules
    }
  });

  if (!course) {
    return res.status(404).json({ error: 'Kursus tidak ditemukan' });
  }
  res.json(course);
}));

// PUT /:id (Update Kursus)
app.put('/:id', checkRole(['instructor', 'admin']), asyncHandler(async (req, res) => {
  const { title, description, thumbnail_url, category } = req.body;
  const courseId = req.params.id;
  const requesterId = parseInt(req.headers['x-user-id'], 10);
  const requesterRole = req.headers['x-user-role'];

  const course = await Course.findByPk(courseId);
  if (!course) {
    return res.status(404).json({ error: 'Kursus tidak ditemukan' });
  }

  // Validasi kepemilikan: Hanya Admin atau Instruktur pemilik yang boleh edit
  if (requesterRole !== 'admin' && course.instructor_id !== requesterId) {
    return res.status(403).json({ error: 'Akses ditolak. Anda bukan pemilik kursus ini.' });
  }

  // Lakukan update (hanya field yang diisi)
  const updatedCourse = await course.update({
    title: title || course.title,
    description: description || course.description,
    thumbnail_url: thumbnail_url || course.thumbnail_url,
    category: category || course.category
  });

  res.json(updatedCourse);
}));

// === Rute Modul & Lesson ===

// POST /:courseId/modules (Membuat Modul baru)
app.post('/:courseId/modules', checkRole(['instructor', 'admin']), asyncHandler(async (req, res) => {
  const { title, module_order } = req.body;
  const { courseId } = req.params;

  if (!title || module_order === undefined) {
    return res.status(400).json({ error: 'Title dan module_order diperlukan' });
  }
  
  // Pastikan kursus ada
  const course = await Course.findByPk(courseId);
  if (!course) {
    return res.status(404).json({ error: 'Kursus tidak ditemukan' });
  }

  // TODO: Tambahkan validasi kepemilikan kursus di sini jika diperlukan

  const newModule = await Module.create({
    title,
    module_order,
    course_id: courseId
  });
  res.status(201).json(newModule);
}));

// POST /modules/:moduleId/lessons (Membuat Materi/Lesson baru)
app.post('/modules/:moduleId/lessons', checkRole(['instructor', 'admin']), asyncHandler(async (req, res) => {
  const { title, content_type, content_url_or_text, lesson_order } = req.body;
  const { moduleId } = req.params;

  if (!title || !content_type || lesson_order === undefined) {
    return res.status(400).json({ error: 'Title, content_type, dan lesson_order diperlukan' });
  }

  // Pastikan modul ada
  const module = await Module.findByPk(moduleId);
  if (!module) {
    return res.status(404).json({ error: 'Modul tidak ditemukan' });
  }
  
  // TODO: Tambahkan validasi kepemilikan modul/kursus di sini jika diperlukan

  const newLesson = await Lesson.create({
    title,
    content_type,
    content_url_or_text: content_url_or_text || '',
    lesson_order,
    module_id: moduleId
  });
  res.status(201).json(newLesson);
}));


// --- 7. Penanganan Error (Global) ---

// Catch-all untuk 404 (Endpoint tidak ditemukan)
// Harus diletakkan setelah semua rute
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint Not Found', path: req.originalUrl });
});

// Error handler utama (Global)
// Menangkap semua error yang dilempar oleh 'next(error)' dari asyncHandler
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);

  // Deteksi error spesifik dari Sequelize
  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map(e => e.message);
    return res.status(400).json({ error: 'Validation failed', details: messages });
  }
  
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ error: 'Conflict', details: 'Data sudah ada' });
  }

  // Error default
  res.status(500).json({ 
    error: 'Internal Server Error', 
    details: isProduction ? 'Terjadi kesalahan pada server' : err.message 
  });
});


// --- 8. Menjalankan Server ---

const startServer = async () => {
  try {
    // 1. Uji koneksi database
    await sequelize.authenticate();
    console.log('Koneksi database (SQLite) berhasil.');
    
    // 2. Sinkronisasi model (buat tabel jika belum ada)
    // { force: true } akan menghapus tabel lama. Hati-hati!
    // { alter: true } akan mencoba migrasi tabel.
    await sequelize.sync(); 
    console.log('Database tersinkronisasi.');

    // 3. Jalankan server HANYA JIKA DB siap
    app.listen(PORT, () => {
      console.log(`Course Service (Layanan 2) berjalan di http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('Gagal menjalankan server:', err);
    process.exit(1); // Keluar jika koneksi DB gagal
  }
};

startServer();