const fs = require('fs');
const path = require('path');

const sourceJs = path.resolve(__dirname, '../node_modules/sweetalert2/dist/sweetalert2.min.js');
const sourceCss = path.resolve(__dirname, '../node_modules/sweetalert2/dist/sweetalert2.min.css');

const targetJs = path.resolve(__dirname, '../public/assets/js/sweetalert2.min.js');
const targetCss = path.resolve(__dirname, '../public/assets/css/sweetalert2.min.css');

function copyFile(source, target) {
    fs.copyFile(source, target, (err) => {
        if (err) {
            console.error(`❌ Failed to copy ${path.basename(source)}:`, err);
        } else {
            console.log(`✅ ${path.basename(source)} copied to ${path.relative(process.cwd(), target)}`);
        }
    });
}

// Pastikan folder tujuan ada
fs.mkdirSync(path.dirname(targetJs), {
    recursive: true
});
fs.mkdirSync(path.dirname(targetCss), {
    recursive: true
});

copyFile(sourceJs, targetJs);
copyFile(sourceCss, targetCss);
