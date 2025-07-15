const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const app = express();

const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index'); 
const apiRoutes = require('./routes/api');

// Middleware session
app.use(session({
  secret: 'rahasia-super-aman',
  resave: false,
  saveUninitialized: false,
}));

// Middleware parsing form dan JSON
app.use(express.urlencoded({
  extended: true
}));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// Middleware layout
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Routing
app.use('/', authRoutes);
app.use('/', indexRoutes);
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`waserva is running on http://localhost:${PORT}`);
});
