import { Counter, Histogram, Gauge, register } from 'prom-client';

// HTTP Metrics
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestSize = new Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
});

export const httpResponseSize = new Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000],
});

// Database Metrics
export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

export const dbQueriesTotal = new Counter({
  name: 'db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['query_type', 'table', 'status'],
});

export const dbConnectionsActive = new Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
});

export const dbConnectionsWaiting = new Gauge({
  name: 'db_connections_waiting',
  help: 'Number of waiting database connections',
});

// Business Metrics
export const casesCreatedTotal = new Counter({
  name: 'cases_created_total',
  help: 'Total number of cases created',
  labelNames: ['violation_type'],
});

export const casesResolvedTotal = new Counter({
  name: 'cases_resolved_total',
  help: 'Total number of cases resolved',
  labelNames: ['outcome'],
});

export const casesActiveGauge = new Gauge({
  name: 'cases_active',
  help: 'Number of active cases',
});

export const complianceScoreHistogram = new Histogram({
  name: 'compliance_score',
  help: 'Distribution of compliance scores',
  buckets: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
});

export const usersActiveGauge = new Gauge({
  name: 'users_active',
  help: 'Number of active users',
});

export const subscriptionsActiveGauge = new Gauge({
  name: 'subscriptions_active',
  help: 'Number of active subscriptions',
  labelNames: ['plan'],
});

// Cache Metrics
export const cacheHitsTotal = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_name'],
});

export const cacheMissesTotal = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_name'],
});

export const cacheSize = new Gauge({
  name: 'cache_size_bytes',
  help: 'Size of cache in bytes',
  labelNames: ['cache_name'],
});

// Socket.io Metrics
export const socketConnectionsActive = new Gauge({
  name: 'socket_connections_active',
  help: 'Number of active socket connections',
});

export const socketEventsTotal = new Counter({
  name: 'socket_events_total',
  help: 'Total number of socket events',
  labelNames: ['event_type'],
});

// Error Metrics
export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'severity'],
});

export const slowRequestsTotal = new Counter({
  name: 'slow_requests_total',
  help: 'Total number of slow requests (>1s)',
  labelNames: ['method', 'route'],
});

// Export metrics endpoint
export function metricsHandler(req: any, res: any) {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
}
