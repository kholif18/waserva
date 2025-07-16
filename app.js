const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const flash = require('connect-flash');
const app = express();
const settingRoutes = require('./routes/setting');

// Routing
const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const apiRoutes = require('./routes/api');

app.use('/settings', settingRoutes);
// Middleware parsing form
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

// Global Flash Messages
app.use((req, res, next) => {
  res.locals.success = req.flash('success') || [];
  res.locals.error = req.flash('error') || [];
  res.locals.user = req.session.user || null;
  next();
});

// View Engine & Layouts
app.use(expressLayouts);
app.set('layout', 'layout'); // layout.ejs di views root
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', authRoutes);
app.use('/', indexRoutes);
app.use('/api', apiRoutes);

// Start App
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`waserva is running on http://localhost:${PORT}`);
});
