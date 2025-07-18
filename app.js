const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const flash = require('connect-flash');
const http = require('http');
const {
  Server
} = require('socket.io');

const {
  setSocketInstance
} = require('./controllers/whatsappSessionController');

// Inisialisasi Express & Socket.IO
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*'
  }
});

// Inject Socket ke session controller
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
  console.log(`📡 Socket joined session: ${sessionId}`);

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
}));
app.use(flash());

// Middleware global (user & flash)
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.flash('success') || [];
  res.locals.error = req.flash('error') || [];
  next();
});

// View Engine & Layout
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const mainRoutes = require('./routes');
app.use('/', mainRoutes);

// Start App
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`waserva is running on http://localhost:${PORT}`);
});
