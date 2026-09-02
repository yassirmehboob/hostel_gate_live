(async () => {
    try {
        const { default: app } = await import('./app.js');
        const port = process.env.PORT || 3000;
        app.set('port', port);
        app.listen(port, () => console.log(`Application listening on port ${port}`));
        console.log("✅ Application bridge initialized");
    } catch (err) {
        console.error("❌ Failed to load ESM app:", err);
    }
})();
