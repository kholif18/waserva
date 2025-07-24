require('dotenv').config();
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const flash = require('connect-flash');
const http = require('http');
const fs = require('fs');
const {
  logAdminOnly
} = require('./services/logService');
const ADMIN_USER_ID = process.env.ADMIN_USER_ID || 1;
const {
  Server
} = require('socket.io');
const whatsappService = require('./services/whatsappService');
const {
  setAppVersion
} = require('./middlewares/appVersion');
const {
  sequelize,
  User,
  AdminSetting
} = require('./models');
const {
  setSocketInstance
} = require('./controllers/whatsappSessionController');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});
setSocketInstance(io);

// Handle koneksi socket WA
io.on('connection', (socket) => {
  console.log('Socket client connected');
  const sessionId = socket.handshake.query.session;
  if (!sessionId) {
    console.warn('Session ID not provided in socket');
    return;
  }

  socket.join(sessionId);

  const currentSession = global.sessions[sessionId];
  if (currentSession) {
    socket.emit('session:update', {
      session: sessionId,
      status: currentSession.status || 'unknown'
    });

    if (currentSession.status === 'qr' && global.qrCodes?.has(sessionId)) {
      socket.emit('session:qr', {
        session: sessionId,
        qr: global.qrCodes.get(sessionId)
      });
    }
  } else {
    socket.emit('session:update', {
      session: sessionId,
      status: 'disconnected'
    });
  }
});

// Middleware parsing
app.use(express.urlencoded({
  extended: true
}));
app.use(express.json());

// Session & Flash
app.use(session({
  secret: 'rahasia-super-aman',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true
  }
}));
app.use(flash());

// Middleware global (user, flash, admin settings)
app.use(async (req, res, next) => {
  res.locals.success = req.flash('success') || [];
  res.locals.error = req.flash('error') || [];

  if (req.session.user?.id) {
    try {
      const user = await User.findByPk(req.session.user.id);
      res.locals.user = user;
    } catch (err) {
      console.error('Gagal memuat user dari DB:', err);
      res.locals.user = null;
    }
  } else {
    res.locals.user = null;
  }

  // Admin Settings: logo & appName
  try {
    const adminSettings = await AdminSetting.findAll({
      where: {
        key: ['logo', 'appName']
      }
    });

    const map = {};
    adminSettings.forEach(setting => {
      map[setting.key] = setting.value;
    });

    res.locals.appLogo = map.logo || '/assets/img/logo.png';
    res.locals.appName = map.appName || 'Waserva';

  } catch (err) {
    console.error('Gagal memuat AdminSettings:', err);
    res.locals.appLogo = '/assets/img/logo.png';
    res.locals.appName = 'Waserva';
  }

  next();
});

// View Engine & Layout
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
setAppVersion(app);

// Routes
const authRoutes = require('./routes/auth');
const mainRoutes = require('./routes');
app.use('/', authRoutes);
app.use('/', mainRoutes);

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`waserva is running on http://localhost:${PORT}`);
});

// BOOT SYSTEM
(async () => {
  try {
    await sequelize.authenticate();
    await logAdminOnly(ADMIN_USER_ID, 'info', 'Database connected.');

    // Booting: validasi folder dan inisialisasi sesi WA
    await whatsappService.boot();

    await logAdminOnly(ADMIN_USER_ID, 'info', 'Semua sesi WhatsApp berhasil dipulihkan.');
  } catch (error) {
    console.error('Gagal saat proses booting aplikasi:', error);
    await logAdminOnly(ADMIN_USER_ID, 'error', `Gagal booting: ${error.message}`);
  }
})();