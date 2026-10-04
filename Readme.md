# 🚦 Redis Token Bucket Rate Limiter

A production-oriented **Express.js rate limiting middleware** built using the **Token Bucket algorithm**, **Redis**, and **Lua scripting**.

The project is designed as a reusable middleware/library that can be integrated into Express applications to protect APIs from excessive requests while maintaining configurable limits, per-user rate limiting, atomic Redis operations, and Docker-based deployment.

---

## ✨ Features

* 🚦 **Token Bucket rate limiting**
* ⚡ **Redis-backed distributed rate limiting**
* 🔒 **Atomic operations using Lua scripts**
* 👤 **Per-user / per-IP / custom rate-limit keys**
* ⚙️ **Configurable bucket capacity**
* 🔄 **Configurable token refill rate**
* 📦 **Reusable Express middleware**
* 🐳 **Docker & Docker Compose support**
* 📊 **Rate-limit response headers**
* 🛡️ **Graceful Redis error handling**
* 🔌 **Pluggable key generation**
* 📈 Designed for future observability and metrics integration

---

# 🏗️ Architecture

```text
                    ┌──────────────────────┐
                    │     Client / API     │
                    └──────────┬───────────┘
                               │
                               │ HTTP Request
                               ▼
                    ┌──────────────────────┐
                    │   Express Server     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Rate Limit Middleware│
                    └──────────┬───────────┘
                               │
                       Generate Key
                               │
                               ▼
                    ┌──────────────────────┐
                    │    Token Bucket      │
                    │      Algorithm       │
                    └──────────┬───────────┘
                               │
                               │ Redis EVAL
                               ▼
                    ┌──────────────────────┐
                    │     Lua Script       │
                    │      Atomicity       │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │        Redis         │
                    │                      │
                    │ tokens               │
                    │ lastRefillTime       │
                    └──────────┬───────────┘
                               │
                       Allow / Reject
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
        ┌───────────────┐             ┌───────────────┐
        │    next()     │             │  HTTP 429     │
        │  Request      │             │ Too Many      │
        │  continues    │             │ Requests      │
        └───────────────┘             └───────────────┘
```

---

# 🧠 How the Token Bucket Works

Each user gets a logical bucket containing tokens.

For example:

```text
capacity = 5
refillRate = 1 token/second
```

Initially:

```text
🪙 🪙 🪙 🪙 🪙
```

Each request consumes one token:

```text
Request 1 → 🪙 🪙 🪙 🪙
Request 2 → 🪙 🪙 🪙
Request 3 → 🪙 🪙
```

When the bucket becomes empty, requests are rejected.

After one second:

```text
🪙
```

After another second:

```text
🪙 🪙
```

The bucket can never exceed its configured capacity.

This allows short bursts of traffic while still controlling the long-term request rate.

---

# 🔑 Why Redis?

Redis is used because the rate-limit state needs to be shared between requests and potentially between multiple application instances.

Without Redis:

```text
Server 1 → local counter
Server 2 → local counter
Server 3 → local counter
```

Each server would have independent rate-limit state.

With Redis:

```text
              ┌──────────────┐
Server 1 ────►│              │
Server 2 ────►│    Redis     │
Server 3 ────►│              │
              └──────────────┘
```

All application instances can access the same bucket state.

This makes the design suitable for horizontally scaled applications.

---

# ⚡ Why Lua?

The token bucket update requires multiple operations:

1. Read current token count.
2. Read previous refill time.
3. Calculate elapsed time.
4. Calculate newly available tokens.
5. Decide whether the request is allowed.
6. Update Redis.

If these operations were performed separately from Node.js, concurrent requests could interfere with each other.

The Lua script performs the entire operation atomically inside Redis.

```text
Node.js
   │
   │ EVAL
   ▼
┌────────────────────────────┐
│        Redis Lua            │
│                            │
│ Read state                 │
│      ↓                     │
│ Calculate refill           │
│      ↓                     │
│ Check token availability   │
│      ↓                     │
│ Consume token              │
│      ↓                     │
│ Save state                 │
└────────────────────────────┘
```

This prevents race conditions when multiple requests arrive at nearly the same time.

---

# 📁 Project Structure

```text
Rate_Limiter/
│
├── src/
│   ├── index.js
│   │
│   ├── algorithms/
│   │   └── tokenBucket.js
│   │
│   ├── middleware/
│   │   └── rateLimiter.js
│   │
│   ├── scripts/
│   │   └── tokenBucket.lua
│   │
│   └── redis/
│       └── redisStore.js
│
├── example/
│   ├── server.js
│   └── auth.js
│
├── test/
│
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .gitignore
├── package.json
├── package-lock.json
└── Readme.md
```

---

# 📦 Installation

Install the package:

```bash
npm install redis
```

If using this project as a local package:

```bash
npm install
```

The middleware requires:

* Node.js
* Redis
* Express
* Redis Node.js client

---

# 🚀 Basic Usage

Import the middleware:

```javascript
const { rateLimiter } = require("./src");
```

Create a Redis client:

```javascript
const { createClient } = require("redis");

const redisClient = createClient({
    url: "redis://localhost:6379"
});

await redisClient.connect();
```

Create the rate limiter:

```javascript
const limiter = rateLimiter({
    redis: redisClient,
    capacity: 5,
    refillRate: 1,
    keyGenerator: (req) => req.user
});
```

Apply it to a route:

```javascript
app.get(
    "/check",
    authenticate,
    limiter,
    (req, res) => {

        res.json({
            message: "request allowed",
            user: req.user
        });

    }
);
```

---

# ⚙️ Configuration

The middleware accepts the following configuration:

```javascript
rateLimiter({
    redis,
    capacity,
    refillRate,
    keyGenerator
});
```

### `redis`

The Redis client used by the rate limiter.

```javascript
redis: redisClient
```

This is required.

---

### `capacity`

Maximum number of tokens that can exist in the bucket.

Example:

```javascript
capacity: 10
```

The user can therefore make a burst of up to 10 requests when the bucket is full.

Default:

```javascript
capacity: 5
```

---

### `refillRate`

Number of tokens added per second.

Example:

```javascript
refillRate: 2
```

This means approximately 2 tokens are added every second.

Default:

```javascript
refillRate: 1
```

---

### `keyGenerator`

Determines which client/user receives a rate-limit bucket.

Example:

```javascript
keyGenerator: (req) => req.user
```

For IP-based rate limiting:

```javascript
keyGenerator: (req) => req.ip
```

For API-key based rate limiting:

```javascript
keyGenerator: (req) => req.headers["x-api-key"]
```

This makes the middleware flexible for different authentication architectures.

---

# 👤 Per-User Rate Limiting

Suppose authentication sets:

```javascript
req.user = "harsha";
```

The rate limiter generates:

```text
rate_limit:harsha
```

Redis stores the token bucket state for that user.

Another user:

```text
req.user = "john"
```

gets:

```text
rate_limit:john
```

Therefore:

```text
Harsha → Bucket A
John   → Bucket B
```

Each user has an independent rate limit.

---

# 🌐 IP-Based Rate Limiting

The same middleware can be used without authentication:

```javascript
const limiter = rateLimiter({
    redis: redisClient,
    capacity: 20,
    refillRate: 5,
    keyGenerator: (req) => req.ip
});
```

Now the bucket is associated with the client's IP address.

---

# 🔐 API-Key Based Rate Limiting

For API-based applications:

```javascript
const limiter = rateLimiter({
    redis: redisClient,
    capacity: 100,
    refillRate: 10,
    keyGenerator: (req) => req.headers["x-api-key"]
});
```

Each API key receives its own bucket.

---

# 📊 Response Headers

The middleware returns rate-limit information through HTTP headers.

Example:

```text
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 0
```

### `X-RateLimit-Limit`

Maximum bucket capacity.

```text
5
```

### `X-RateLimit-Remaining`

Approximate number of tokens currently available.

```text
3
```

### `X-RateLimit-Reset`

Approximate time until another token becomes available when the bucket is empty.

---

# 🚫 Rate Limit Response

When no tokens are available:

```http
HTTP/1.1 429 Too Many Requests
```

Example response:

```json
{
    "error": "Too many requests",
    "remainingTokens": 0
}
```

The request does not reach the route handler because the middleware stops the request.

---

# 🔄 Request Flow

A typical request follows this flow:

```text
Client
  │
  ▼
Express
  │
  ▼
Authentication
  │
  │ req.user
  ▼
Rate Limiter
  │
  ▼
Generate Rate Limit Key
  │
  ▼
Token Bucket
  │
  ▼
Redis Lua Script
  │
  ├──── Token available ────► next()
  │
  └──── No token ───────────► 429
```

---

# 🧮 Token Bucket Calculation

The Lua script calculates new tokens using elapsed time.

Conceptually:

```text
elapsedTime = currentTime - lastRefillTime

newTokens = elapsedTime × refillRate

tokens = min(
    capacity,
    tokens + newTokens
)
```

If at least one token exists:

```text
tokens >= 1
```

the request is allowed and one token is consumed:

```text
tokens = tokens - 1
```

Otherwise:

```text
allowed = false
```

---

# 🐳 Running with Docker

The project includes Docker support.

Start Redis:

```bash
docker compose up -d redis
```

Check running containers:

```bash
docker ps
```

Start the complete application:

```bash
docker compose up --build
```

The application is exposed on:

```text
http://localhost:3000
```

Redis is exposed on:

```text
localhost:6379
```

---

# 🩺 Health Check

The example application provides:

```http
GET /health
```

A healthy response looks like:

```json
{
    "status": "healthy",
    "redis": "connected"
}
```

If Redis is unavailable, the endpoint returns an unhealthy response.

---

# 🧪 Testing

The example endpoint is:

```http
GET /check
```

For authenticated requests, provide:

```http
x-api-key: abc123
```

Example:

```text
GET http://localhost:3000/check
x-api-key: abc123
```

The demo authentication layer maps the API key to a user.

Example Redis entry:

```text
SET api_key:abc123 harsha
```

The request then becomes associated with:

```text
rate_limit:harsha
```

---

# 🧪 Testing Rate Limiting

With:

```javascript
capacity: 5
refillRate: 1
```

send multiple requests quickly.

Initially:

```text
Request 1 → 200
Request 2 → 200
Request 3 → 200
Request 4 → 200
Request 5 → 200
Request 6 → 429
```

After enough time passes, tokens are gradually regenerated.

This demonstrates the burst + refill behavior of the Token Bucket algorithm.

---

# 🔒 Redis Data Structure

Each rate-limit key is stored as a Redis hash.

Example:

```text
rate_limit:harsha
```

contains fields conceptually equivalent to:

```text
tokens          → 3.5
lastRefillTime  → 1720000000000
```

The authentication example uses normal Redis string keys:

```text
api_key:abc123 → harsha
```

The two mechanisms are intentionally separate:

```text
Authentication
    ↓
Redis String
api_key:abc123

Rate Limiting
    ↓
Redis Hash
rate_limit:harsha
```

---

# 🛡️ Error Handling

Redis or rate-limiter failures are propagated through Express middleware using:

```javascript
next(error);
```

This allows the consuming application to decide how infrastructure failures should be handled.

Applications can implement either:

### Fail-closed

Reject requests when the rate limiter cannot be reached.

Useful for highly sensitive APIs.

### Fail-open

Allow requests temporarily when the rate limiter is unavailable.

Useful when availability is more important than strict enforcement.

The policy can be implemented by the consuming application or extended in future versions of this library.

---

# 📈 Scalability

The architecture supports multiple application instances:

```text
                ┌───────────────┐
                │ Load Balancer │
                └───────┬───────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
      Server 1      Server 2      Server 3
          │             │             │
          └─────────────┼─────────────┘
                        │
                        ▼
                  ┌───────────┐
                  │   Redis   │
                  └───────────┘
```

Because the bucket state is stored in Redis rather than application memory, different application instances can share the same rate-limit state.

---

# ⚡ Why This Design?

### In-memory rate limiter

```text
Simple
   ↓
Fast
   ↓
But state belongs to one server
```

Problem:

```text
Server 1 → 5 requests
Server 2 → 5 requests
```

The client may effectively receive a larger combined limit.

### Redis-backed rate limiter

```text
Server 1 ──┐
Server 2 ──┼──► Redis
Server 3 ──┘
```

All servers share the same state.

### Lua-based update

The complete bucket calculation occurs atomically inside Redis, reducing race-condition problems under concurrent requests.

---

# 📦 Package API

The package exposes:

```javascript
const { rateLimiter } = require("your-package");
```

Then:

```javascript
const limiter = rateLimiter({
    redis: redisClient,
    capacity: 100,
    refillRate: 10,
    keyGenerator: (req) => req.user
});
```

Apply it like any Express middleware:

```javascript
app.use(limiter);
```

or to specific routes:

```javascript
app.get("/api/data", limiter, handler);
```

---

# 🧩 Example

Complete example:

```javascript
const express = require("express");
const { createClient } = require("redis");

const { rateLimiter } = require("./src");

const app = express();

const redisClient = createClient({
    url: "redis://localhost:6379"
});

redisClient.on("error", console.error);

async function start() {

    await redisClient.connect();

    const limiter = rateLimiter({
        redis: redisClient,
        capacity: 5,
        refillRate: 1,
        keyGenerator: (req) => req.ip
    });

    app.get("/api", limiter, (req, res) => {

        res.json({
            message: "Request allowed"
        });

    });

    app.listen(3000, () => {
        console.log("Server running on port 3000");
    });
}

start();
```

---

# 🏆 Design Highlights

This project demonstrates several backend engineering concepts:

* Express middleware architecture
* Redis
* Distributed state management
* Token Bucket algorithm
* Lua scripting
* Atomic operations
* Race-condition prevention
* API rate limiting
* Configurable middleware
* Docker
* REST API design
* Error propagation
* Scalable backend architecture

---

# 🚀 Future Improvements

Planned improvements include:

* [ ] npm package publishing
* [ ] Unit tests
* [ ] Integration tests with Redis
* [ ] Prometheus metrics
* [ ] `Retry-After` response header
* [ ] Fail-open / fail-closed configuration
* [ ] Sliding Window algorithm
* [ ] Additional rate-limit strategies
* [ ] Performance benchmarking
* [ ] Load testing
* [ ] TypeScript support
* [ ] Better configuration validation
* [ ] Redis Cluster support
* [ ] More detailed observability

---

# 📚 Algorithms

## Token Bucket

Currently implemented.

Characteristics:

```text
Burst traffic       → Supported
Continuous refill   → Supported
Redis state         → Supported
Atomic update       → Lua
Distributed usage   → Supported
```

A future version may support additional algorithms such as:

```text
Token Bucket
     │
     ├── Sliding Window
     │
     ├── Fixed Window
     │
     └── Leaky Bucket
```

---

# 🔧 Development

Clone the repository:

```bash
git clone https://github.com/Harsha125-art/Rate_Limiter.git
```

Enter the project:

```bash
cd Rate_Limiter
```

Install dependencies:

```bash
npm install
```

Start Redis:

```bash
docker compose up -d redis
```

Run the example application:

```bash
node example/server.js
```

---

# 📜 License

This project is licensed under the MIT License.

See the `LICENSE` file for details.

---

# 👩‍💻 Author

**Harsha Vardhani**

Backend / Software Engineering Project

Built with:

```text
Node.js
Express.js
Redis
Lua
Docker
```
