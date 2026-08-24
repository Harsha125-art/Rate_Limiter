local key = KEYS[1]

local capacity = tonumber(ARGV[1])
local refillRate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local tokens = tonumber(redis.call("HGET", key, "tokens"))
local lastRefillTime = tonumber(redis.call("HGET", key, "lastRefillTime"))

if tokens == nil then
    tokens = capacity
    lastRefillTime = now
end

local elapsedTime = (now - lastRefillTime) / 1000

local newTokens = elapsedTime * refillRate

tokens = math.min(capacity, tokens + newTokens)

lastRefillTime = now

local allowed = 0

if tokens >= 1 then
    tokens = tokens - 1
    allowed = 1
end

redis.call(
    "HSET",
    key,
    "tokens",
    tokens,
    "lastRefillTime",
    lastRefillTime
)

local resetTime = 0

if tokens < 1 then
    resetTime = math.ceil((1 - tokens) / refillRate)
end

return {allowed, tokens, resetTime}