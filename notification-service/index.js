require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const sequelize = new Sequelize(process.env.DATABASE_URL);

const NotificationLog = sequelize.define('NotificationLog', {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false }, 
  message: { type: DataTypes.TEXT, allowNull: false },
  type: { type: DataTypes.STRING, defaultValue: 'INFO' }, 
  status: { type: DataTypes.ENUM('sent', 'failed'), defaultValue: 'sent' }
}, {
  tableName: 'notification_logs',
  timestamps: true 
});

app.post('/', async (req, res) => {
  try {
    const { user_id, message, type } = req.body;
    
    if (!user_id || !message) {
      return res.status(400).json({ error: 'user_id dan message diperlukan' });
    }

    const log = await NotificationLog.create({
      user_id,
      message,
      type: type || 'INFO'
    });
    
    
    res.status(201).json({ message: 'Notifikasi dicatat', log });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/my-notifications', async (req, res) => {
  try {
    const user_id = req.headers['x-user-id'];
    if (!user_id) {
      return res.status(401).json({ error: 'User tidak terautentikasi' });
    }

    const notifications = await NotificationLog.findAll({
      where: { user_id },
      order: [['createdAt', 'DESC']],
      limit: 20 
    });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'notification-service' });
});

sequelize.sync()
  .then(() => {
    console.log('Database tersinkronisasi (SQLite)');
    app.listen(PORT, () => {
      console.log(`Notification Service (Layanan 5) berjalan di port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Gagal sinkronisasi database:', err);
  });