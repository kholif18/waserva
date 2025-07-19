async function startSession(userId) {
    console.log('[startSession] Dipanggil untuk userId:', userId);
    await log(userId, 'INFO', 'Memulai startSession()');
    userId = getSessionKey(userId);

    if (clients.has(userId)) {
        await log(userId, 'INFO', 'Session sudah ada, tidak diinisialisasi ulang');
        return;
    }

    const sessionPath = path.join(__dirname, '../sessions', `session-${userId}`);
    const singletonLock = path.join(sessionPath, 'SingletonLock');

    try {
        if (fs.existsSync(sessionPath)) {
            if (fs.existsSync(singletonLock)) {
                await log(userId, 'WARN', 'SingletonLock terdeteksi. Melewati inisialisasi. Gunakan tombol "Reset Session" jika QR tidak muncul.');
                return; // tidak hapus folder, tidak inisialisasi ulang
            }

            const files = fs.readdirSync(sessionPath);
            if (files.length === 0) {
                fs.rmSync(sessionPath, {
                    recursive: true,
                    force: true
                });
                await log(userId, 'INFO', 'Session folder kosong dihapus.');
            }
        }

        // Tunggu file lock hilang hanya jika sebelumnya ada lock (opsional)
        const success = await waitForFileRelease(singletonLock, 5000);
        if (!success) {
            await log(userId, 'ERROR', 'Gagal memulai sesi: SingletonLock tidak hilang setelah 5 detik.');
            return;
        }
    } catch (err) {
        await log(userId, 'ERROR', `Gagal mengecek/menghapus session folder: ${err.message}`);
        return;
    }

    const client = new Client({
        authStrategy: new LocalAuth({
            clientId: userId,
            dataPath: path.join(__dirname, '../sessions')
        }),
        puppeteer: {
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-features=site-per-process',
                '--window-size=1920,1080'
            ]
        }
    });

    sessions[userId] = {
        client,
        status: 'starting'
    };

    emitToSocket(userId, 'session:update', {
        userId,
        status: 'starting'
    });

    client.on('qr', async qr => {
        const qrImage = await qrcode.toDataURL(qr);
        qrCodes.set(userId, qrImage);
        sessions[userId].status = 'qr';
        emitToSocket(userId, 'session:update', {
            userId,
            status: 'qr'
        });
        emitToSocket(userId, 'session:qr', {
            userId,
            qr: qrImage
        });
        setTimeout(() => qrCodes.delete(userId), 60000);
    });

    client.on('ready', async () => {
        sessions[userId].status = 'connected';
        emitToSocket(userId, 'session:update', {
            userId,
            status: 'connected'
        });
        await log(userId, 'INFO', 'WhatsApp session connected.');
    });

    client.on('auth_failure', async () => {
        sessions[userId].status = 'auth_failure';

        emitToSocket(userId, 'session:update', {
            userId,
            status: 'auth_failure'
        });

        removeClient(userId);
        qrCodes.delete(userId);

        const sessionPath = path.join(__dirname, '../sessions', `session-${userId}`);
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, {
                recursive: true,
                force: true
            });
            await log(userId, 'INFO', 'Session folder dihapus karena auth failure');
        }

        await log(userId, 'ERROR', 'Authentication failed.');
    });

    client.on('disconnected', async reason => {
        sessions[userId].status = 'disconnected';
        emitToSocket(userId, 'session:update', {
            userId,
            status: 'disconnected',
            reason
        });

        try {
            await client.destroy();
        } catch {}

        removeClient(userId);
        qrCodes.delete(userId);

        if (reason !== 'LOGOUT') setTimeout(() => startSession(userId), 5000);

        await log(userId, 'WARN', `Disconnected: ${reason}`);
    });

    client.on('message', async msg => {
        const webhookUrl = process.env.WEBHOOK_URL;
        if (!webhookUrl) return;
        try {
            await axios.post(webhookUrl, {
                session: userId,
                from: msg.from,
                to: msg.to || userId,
                body: msg.body,
                type: msg.type,
                timestamp: msg.timestamp,
                isGroupMsg: msg.from.endsWith('@g.us'),
            });
        } catch (err) {
            await log(userId, 'ERROR', `Webhook failed: ${err.message}`);
        }
    });

    try {
        await client.initialize();
        setClient(userId, client);
        await log(userId, 'INFO', 'client.initialize() selesai');
    } catch (err) {
        await log(userId, 'ERROR', `Gagal memulai sesi WA: ${err.message}`);
    }
}