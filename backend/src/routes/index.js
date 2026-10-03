const { Router } = require('express');
const healthRouter = require('./health');

// This is the single router mounted at /api in server.js.
// As the API grows, add new routers here, e.g. router.use('/cars', carRouter).
const router = Router();

router.use('/health', healthRouter);

module.exports = router;
