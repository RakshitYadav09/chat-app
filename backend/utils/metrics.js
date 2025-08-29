const client = require('prom-client');

// Create a registry which registers the metrics
const register = new client.Registry();

// Add default metrics (cpu, memory, event loop lag, etc.)
client.collectDefaultMetrics({ register });

// Histograms for latency measurements (milliseconds)
const messageProcessingHistogram = new client.Histogram({
  name: 'message_processing_time_ms',
  help: 'Time taken to process a message end-to-end in ms',
  buckets: [10, 50, 100, 200, 500, 1000, 2000],
  registers: [register]
});

const embeddingTimeHistogram = new client.Histogram({
  name: 'embedding_time_ms',
  help: 'Time taken to generate an embedding (ms)',
  buckets: [50, 100, 200, 300, 500, 1000],
  registers: [register]
});

const qdrantUpsertHistogram = new client.Histogram({
  name: 'qdrant_upsert_time_ms',
  help: 'Time taken to upsert a vector into Qdrant (ms)',
  buckets: [10, 50, 100, 200, 500],
  registers: [register]
});

// Counters/Gauges
const messagesReceivedCounter = new client.Counter({
  name: 'messages_received_total',
  help: 'Total number of messages received',
  registers: [register]
});

const embeddingErrorsCounter = new client.Counter({
  name: 'embedding_errors_total',
  help: 'Total embedding errors',
  registers: [register]
});

const activeConnectionsGauge = new client.Gauge({
  name: 'active_connections',
  help: 'Active websocket connections',
  registers: [register]
});

module.exports = {
  register,
  messageProcessingHistogram,
  embeddingTimeHistogram,
  qdrantUpsertHistogram,
  messagesReceivedCounter,
  embeddingErrorsCounter,
  activeConnectionsGauge
};
