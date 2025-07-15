const express = require('express');
const router = express.Router();
const path = require('path');
const authRoutes = require('./auth');
const userRoutes = require('./user');
// const { getQR } = require('../services/whatsapp');

router.use('/', authRoutes);
router.use('/', userRoutes);

const report = [{
    datetime: '14-07-2025 19:45',
    count: '3'
  },
  {
    datetime: '14-07-2025 19:46',
    count: '45'
  },
  {
    datetime: '14-07-2025 19:47',
    count: '16'
  },
  {
    datetime: '14-07-2025 19:48',
    count: '10'
  },
  {
    datetime: '14-07-2025 19:49',
    count: '25'
  },
  {
    datetime: '14-07-2025 19:50',
    count: '9'
  },
  {
    datetime: '14-07-2025 19:51',
    count: '13'
  },
  {
    datetime: '14-07-2025 19:52',
    count: '4'
  },
  {
    datetime: '14-07-2025 19:53',
    count: '17'
  },
  {
    datetime: '14-07-2025 19:54',
    count: '20'
  },
  {
    datetime: '14-07-2025 19:55',
    count: '18'
  },
  {
    datetime: '14-07-2025 19:56',
    count: '8'
  },
  {
    datetime: '14-07-2025 19:57',
    count: '2'
  },
  {
    datetime: '14-07-2025 19:58',
    count: '12'
  },
  {
    datetime: '14-07-2025 19:59',
    count: '7'
  }
];

const history = [{
    datetime: '14-07-2025 19:45',
    to: '081234567890',
    message: 'Test Pesan',
    status: 'success'
  },
  {
    datetime: '14-07-2025 19:46',
    to: '081234567891',
    message: 'Pesan untuk tes WA Gateway',
    status: 'success'
  },
  {
    datetime: '14-07-2025 19:47',
    to: '081234567892',
    message: 'Pesan ini untuk ytest WA-Gateway di JavaScript',
    status: 'success'
  },
  {
    datetime: '14-07-2025 19:48',
    to: '081234567893',
    message: 'Pengujian sistem notifikasi otomatis',
    status: 'success'
  },
  {
    datetime: '14-07-2025 19:49',
    to: '081234567894',
    message: 'Reminder pengambilan pesanan',
    status: 'success'
  },
  {
    datetime: '14-07-2025 19:50',
    to: '081234567895',
    message: 'Uji coba template WhatsApp',
    status: 'failed'
  },
  {
    datetime: '14-07-2025 19:51',
    to: '081234567896',
    message: 'Pesanan telah selesai diproses',
    status: 'success'
  },
  {
    datetime: '14-07-2025 19:52',
    to: '081234567897',
    message: 'Silakan ambil sebelum tanggal 16 Juli',
    status: 'pending'
  },
  {
    datetime: '14-07-2025 19:53',
    to: '081234567898',
    message: 'Notifikasi status pesanan aktif',
    status: 'success'
  },
  {
    datetime: '14-07-2025 19:54',
    to: '081234567899',
    message: 'Pesan gagal dikirim, akan dicoba ulang',
    status: 'failed'
  },
  {
    datetime: '14-07-2025 19:55',
    to: '081234567800',
    message: 'Test kirim ke nomor baru',
    status: 'success'
  },
  {
    datetime: '14-07-2025 19:56',
    to: '081234567801',
    message: 'Pengujian jadwal kirim otomatis',
    status: 'success'
  },
  {
    datetime: '14-07-2025 19:57',
    to: '081234567802',
    message: 'WA Gateway status pengiriman dicek',
    status: 'success'
  },
  {
    datetime: '14-07-2025 19:58',
    to: '081234567803',
    message: 'Pesanan Anda sedang dalam proses',
    status: 'success'
  },
  {
    datetime: '14-07-2025 19:59',
    to: '081234567804',
    message: 'Pembatalan pesanan berhasil dikirim',
    status: 'success'
  },
];


router.get('/', (req, res) => {
  res.render('pages/dashboard', {
    title: 'Dashboard',
    description: 'Halaman utama Waserva',
    activePage: 'dashboard'
  });
});

router.get('/message', (req, res) => {
  res.render('pages/message', {
    title: 'Message Test',
    activePage: 'message'
  });
});

router.get('/login-whatsapp', (req, res) => {
  res.render('pages/login-whatsapp', {
    title: 'Login Whatsapp',
    activePage: 'login-whatsapp'
  });
});

router.get('/history', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const perPage = parseInt(req.query.per_page) || 10;
  const start = (page - 1) * perPage;
  const end = start + perPage;

  const paginatedHistory = history.slice(start, end);

  // const totalData = await db.history.count(); // atau history.length kalau array
  // const totalPages = Math.ceil(totalData / perPage);
  const totalData = history.length; // atau history.length kalau array
  const totalPages = Math.ceil(history.length / perPage);

  // const paginatedHistory = await db.history.findAll({
  //   offset: (page - 1) * perPage,
  //   limit: perPage
  // });
  // const paginatedHistory = history.slice((page - 1) * perPage, page * perPage);
  

  res.render('pages/history', {
    title: 'History',
    activePage: 'history',
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
    activePage: 'logs'
  });
});

router.get('/api-client', (req, res) => {
  res.render('pages/api-client', {
    title: 'Api Client',
    activePage: 'api-client'
  });
});

router.get('/settings', (req, res) => {
  res.render('pages/settings', {
    title: 'Settings',
    activePage: 'settings'
  });
});

router.get('/helps', (req, res) => {
  res.render('helps/index', {
    title: 'Help',
    activePage: 'helps'
  });
});

router.get('/helps/api', (req, res) => {
  res.render('helps/api', {
    title: 'API Help',
    activePage: 'helps'
  });
});

module.exports = router;
