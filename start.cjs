const fs = require('fs');
const logFile = fs.createWriteStream('./debug.log', { flags: 'a' });
process.stdout.write = process.stderr.write = logFile.write.bind(logFile);

const appPromise = import('./app.js');

module.exports = appPromise.then(module => module.default);

(async () => {
    try {
        await appPromise;
        console.log("✅ Application bridge initialized");
    } catch (err) {
        console.error("❌ Failed to load ESM app:", err);
    }
})();