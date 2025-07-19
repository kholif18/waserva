const activeQueues = new Map(); // userId => jumlah pesan aktif

function isQueueFull(userId, maxQueue) {
    const count = activeQueues.get(userId) || 0;
    return count >= maxQueue;
}

function increaseQueue(userId) {
    const count = activeQueues.get(userId) || 0;
    activeQueues.set(userId, count + 1);
}

function decreaseQueue(userId) {
    const count = activeQueues.get(userId) || 1;
    if (count <= 1) {
        activeQueues.delete(userId);
    } else {
        activeQueues.set(userId, count - 1);
    }
}

module.exports = {
    isQueueFull,
    increaseQueue,
    decreaseQueue
};
