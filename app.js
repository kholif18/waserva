const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const app = express();

const indexRoutes = require('./routes/index');
const apiRoutes = require('./routes/api');
const expressLayouts = require('express-ejs-layouts');

app.use(expressLayouts);
app.set('layout', 'layout'); // gunakan views/layout.ejs

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use('/', indexRoutes);
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`waserva is running on http://localhost:${PORT}`);
});
