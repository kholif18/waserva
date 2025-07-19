function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function retrySend(fn, maxRetry, timeoutSec, retryIntervalSec) {
    let attempt = 0;
    while (attempt <= maxRetry) {
        try {
            await Promise.race([
                fn(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutSec * 1000))
            ]);
            return {
                success: true
            };
        } catch (err) {
            if (attempt === maxRetry) {
                return {
                    success: false,
                    error: err.message
                };
            }
            attempt++;
            await delay(retryIntervalSec * 1000);
        }
    }
}

module.exports = {
    retrySend,
    delay
};
