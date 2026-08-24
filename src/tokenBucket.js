class TokenBucket {

    constructor(redisClient, capacity, refillRate) {
        this.redis = redisClient;
        this.capacity = capacity;
        this.refillRate = refillRate;
    }

    async allowRequest(user) {

        const key = `rate_limit:${user}`;

        const now = Date.now();

        const result = await this.redis.eval(
            require('fs').readFileSync(
                './src/tokenBucket.lua',
                'utf8'
            ),
            {
                keys: [key],
                arguments: [
                    this.capacity.toString(),
                    this.refillRate.toString(),
                    now.toString()
                ]
            }
        );

        const allowed = result[0] === 1;
        const remainingTokens = result[1];
        const resetTime = result[2];


        return {
            allowed,
            remainingTokens,
            resetTime
        };
    }
}

module.exports = TokenBucket;