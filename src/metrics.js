const client = require('prom-client');

const register = new client.Registry();

client.collectDefaultMetrics({
    register
});

const totalRequests = new client.Counter({
    name: 'rate_limiter_requests_total',
    help: 'Total number of requests received'
});

const allowedRequests = new client.Counter({
    name: 'rate_limiter_allowed_requests_total',
    help: 'Total number of allowed requests'
});

const rejectedRequests = new client.Counter({
    name: 'rate_limiter_rejected_requests_total',
    help: 'Total number of rejected requests'
});

register.registerMetric(totalRequests);
register.registerMetric(allowedRequests);
register.registerMetric(rejectedRequests);

module.exports = {
    register,
    totalRequests,
    allowedRequests,
    rejectedRequests
};