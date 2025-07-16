const express = require('express');
const router = express.Router();
const path = require('path');
const authRoutes = require('./auth');
const userRoutes = require('./user');
// const { getQR } = require('../services/whatsapp');

router.use('/', authRoutes);
router.use('/', userRoutes);
router.use('/api-clients', require('./apiClient'));

router.get('/', (req, res) => {
  res.render('pages/dashboard', {
    title: 'Dashboard',
    description: 'Halaman utama Waserva',
    activePage: 'dashboard',
    user: req.session.user
  });
});

router.get('/message', (req, res) => {
  res.render('pages/message', {
    title: 'Message Test',
    activePage: 'message',
    user: req.session.user
  });
});

router.get('/login-whatsapp', (req, res) => {
  res.render('pages/login-whatsapp', {
    title: 'Login Whatsapp',
    user: req.session.user,
    activePage: 'login-whatsapp'
  });
});

router.get('/history', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.per_page) || 10;
  const start = (page - 1) * perPage;
  const end = start + perPage;

  const paginatedHistory = history.slice(start, end);

  const totalData = history.length; // atau history.length kalau array
  const totalPages = Math.ceil(history.length / perPage);

  res.render('pages/history', {
    title: 'History',
    activePage: 'history',
    user: req.session.user,
    history: paginatedHistory,
    pagination: {
      currentPage: page,
      totalPages: totalPages,
    },
    req
  });
});

router.get('/report', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.per_page) || 10;
  const start = (page - 1) * perPage;
  const end = start + perPage;

  const paginatedReport = report.slice(start, end);

  const totalData = report.length;
  const isDataAvailable = report.length > 0;
  const totalPages = Math.ceil(report.length / perPage);

  

  res.render('pages/report', {
    title: 'Message Report',
    activePage: 'report',
    report: paginatedReport,
    user: req.session.user,
    pagination: {
      currentPage: page,
      totalPages: totalPages,
    },
    isDataAvailable,
    totalData,
    req
  });
});

router.get('/logs', (req, res) => {
  res.render('pages/logs', {
    title: 'Logs',
    user: req.session.user,
    activePage: 'logs'
  });
});

router.get('/helps', (req, res) => {
  res.render('helps/index', {
    title: 'Help',
    user: req.session.user,
    activePage: 'helps'
  });
});

router.get('/helps/api', (req, res) => {
  res.render('helps/api', {
    title: 'API Help',
    user: req.session.user,
    activePage: 'helps'
  });
});

module.exports = router;
