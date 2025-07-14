const express = require('express');
const router = express.Router();
const path = require('path');
// const { getQR } = require('../services/whatsapp');

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

router.get('/history', (req, res) => {
  res.render('pages/history', {
    title: 'History',
    activePage: 'history'
  });
});

module.exports = router;
