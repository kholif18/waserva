const express = require('express');
const router = express.Router();
const apiClientController = require('../controllers/apiClientController');
const isAuthenticated = require('../middlewares/isAuthenticated');

router.get('/', isAuthenticated, apiClientController.index);
router.post('/add', isAuthenticated, apiClientController.add);
router.post('/toggle/:id', isAuthenticated, apiClientController.toggleActive);
router.post('/regenerate/:id', isAuthenticated, apiClientController.regenerate);
router.post('/delete/:id', isAuthenticated, apiClientController.delete);

module.exports = router;
