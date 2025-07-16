const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const isAuthenticated = require('../middlewares/isAuthenticated');
const multer = require('multer');
const path = require('path');

const upload = multer({
    dest: 'public/uploads/',
    limits: {
        fileSize: 2 * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

router.get('/profile', isAuthenticated, userController.getMyProfile);
router.post('/profile', upload.single('avatar'), isAuthenticated, userController.updateMyProfile);


module.exports = router;
