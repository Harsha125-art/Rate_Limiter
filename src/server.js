const express = require('express');
const authenticate= require('./auth');
const {
    register,
    totalRequests,
    allowedRequests,
    rejectedRequests
} = require('./metrics');

const {
    redisClient,
    connectRedis
} = require('./redis');

const TokenBucket = require('./tokenBucket');

const app = express();
app.use((req,res,next)=>{
    req.redis=redisClient;
    
    const start=Date.now();
    res.on('finish',()=>{
        const duration=Date.now()-start;
          console.log(
            `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
        );
    });
    next();
})

const CAPACITY = 5;
const REFILL_RATE = 1;

let bucket;

app.get('/check',authenticate, async (req, res) => {
    try{
    totalRequests.inc();

    const user = req.user;

    

    const result = await bucket.allowRequest(user);

    res.setHeader('X-RateLimit-Limit', CAPACITY);
res.setHeader(
    'X-RateLimit-Remaining',
    Math.floor(result.remainingTokens)
);
res.setHeader(
    'X-RateLimit-Reset',
    result.resetTime
);

    if (result.allowed) {
        allowedRequests.inc();

        res.json({
            allowed: true,
            user: user,
            remainingTokens:result.remainingTokens,
            message: "request allowed"
        });

    } else {
        rejectedRequests.inc();

        res.status(429).json({
            allowed: false,
            user: user,
            remainingTokens:result.remainingTokens,
            message: "too many requests"
        });
    }
}catch(error){
     console.error(
            "Rate limiter error:",
            error
        );

        return res.status(503).json({
            error: "Rate limiter temporarily unavailable"
        });
}
});

app.get('/health', async (req, res) => {

    try {

        const result = await redisClient.ping();

        return res.status(200).json({
            status: "healthy",
            redis: result === "PONG"
                ? "connected"
                : "disconnected"
        });

    } catch (error) {

        console.error(
            "Health check failed:",
            error
        );

        return res.status(503).json({
            status: "unhealthy",
            redis: "disconnected"
        });
    }
});
app.get('/metrics', async (req, res) => {

    res.set(
        'Content-Type',
        register.contentType
    );

    res.end(
        await register.metrics()
    );
});

async function startServer() {

    await connectRedis();

    bucket = new TokenBucket(
        redisClient,
        CAPACITY,
        REFILL_RATE
    );

    app.listen(3000, () => {
        console.log("Rate limiter running on 3000");
    });
}

startServer();