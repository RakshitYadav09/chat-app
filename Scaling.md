# When the Whole School Shows Up — Bottleneck & Failure Analysis

This note explains, in plain language, where the chat app will struggle when many students connect, how we measured and estimated the limits, what to watch in production, and immediate/medium/long-term steps to scale safely.

---

## 1) Quick system diagram

Client browsers / mobile apps (WebSocket / HTTP)
  ↕
  ┌──────────┐   Load Balancer   ┌──────────┐
  │ WebSocket│ <--------------> │ Node.js  │  (stateless app servers)
  │ gateway  │                  │ app + API│
  └──────────┘                  └──────────┘
       │                              │
       │                              │
       ▼                              ▼
  Message queue (Redis/Kafka)     Databases
       │                          - MongoDB (messages)
       │                          - Qdrant (vector search)
       ▼                          - External embedding APIs (Claude/OpenAI)
  Worker pool (embeddings + upserts)


## 2) Assumptions (explicit)
- Server used for baseline: GCP e2-standard-2 (2 vCPU, 8 GB RAM)
- Each user opens a websocket and sends 1 message/sec (given)
- Each message triggers: a Mongo write, an embedding generation, and a Qdrant upsert
- Embedding vector size: 1536 floats (≈6–7 KB payload)
- Conservative per-operation latencies:
  - Node processing per message: 10 ms CPU
  - Mongo write: 20 ms
  - Embedding API round-trip: 300 ms
  - Qdrant upsert: 100 ms
  - Websocket overhead per connection: ~5 KB memory


## 3) Breaking-point estimate (simple answer)
- Estimated break on a single e2-standard-2 instance: ~150–250 concurrent active users (each sending 1 msg/sec).
- The primary limiting factors are:
  1. CPU on the Node server (handling per-message work and synchronous tasks)
  2. External embedding API rate limits and latency
  3. If synchronous upserts are used, Qdrant write latency also matters

Reasoning: per-message CPU ≈ 10 ms → a 2-core machine can handle ~200 messages/sec; at 1 msg/sec/user this equals ~200 concurrent users. Embedding API limits or long latency will reduce that number in practice.


## 4) Numeric reasoning & transparent math
- Messages/sec = concurrent_users × 1 msg/sec
- CPU capacity (approx):
  - single core can handle ~100 messages/sec (1000 ms / 10 ms)
  - 2 cores → ~200 messages/sec
- Network & bandwidth:
  - embedding response ≈ 7 KB; at 200 msg/sec → ~1.4 MB/s (≈11.2 Mbps)
  - easily handled by typical cloud NICs; at 10k msg/sec this grows to ≈70 MB/s
- Memory for connections:
  - 5 KB per websocket → 200 users ≈ 1 MB; 10k users ≈ 50 MB (plus Node process memory)

These are conservative, back-of-envelope estimates intended to show what will saturate first.


## 5) Monitoring plan — how to detect the bottleneck in production
Watch these core signals (metrics & logs):

- Application metrics
  - messages_received/sec (counter)
  - message_processing_time_ms (histogram: p50/p95/p99)
  - embedding_time_ms (histogram)
  - qdrant_upsert_time_ms (histogram)
  - embedding_errors_total (counter)
  - active_websocket_connections (gauge)

- Infrastructure metrics
  - CPU%, memory usage, network in/out, disk IOPS
  - MongoDB ops/sec, replication lag
  - Qdrant memory usage and write latency

Detection rules (examples):
- If p95 message_processing_time_ms > 1s → urgent (likely CPU or blocking I/O)
- If embedding_time_ms p95 increases or embedding_errors spike → embedding provider is struggling
- If queue depth (if using a queue) grows steadily → downstream workers are slower than ingestion


## 6) What we already implemented (logging & metrics)
Two critical metrics were instrumented and are available now:

1) Message processing time (end-to-end inside the app)
   - Location: `backend/routes/messages.js` — POST `/` path and socket message handling
   - Console log example: `⏱️ Message processing time for 68b1bb...: 142ms`
   - Also recorded to Prometheus: `message_processing_time_ms` histogram

2) Embedding + Qdrant upsert latencies
   - Location: `backend/utils/vectorDatabase.js`
   - Console log example: `embedding_time_ms=312 upsert_time_ms=107 userId=68b1...`
   - Also recorded to Prometheus: `embedding_time_ms` and `qdrant_upsert_time_ms`

Prometheus `/metrics` endpoint is exposed at: `http://<host>:<port>/metrics`
You can `curl` it to see current metrics:

```
curl http://localhost:10000/metrics
```


## 7) How to log & collect metrics (recommended minimal stack)
- Export Prometheus metrics (we added `prom-client`) and scrape with Prometheus.
- For logs, forward structured logs to Loki / Datadog / ELK and build dashboards/alerts.
- Suggested dashboards: p95/p99 message_processing_time, embedding_time histogram, messages/sec, active connections, CPU%.


## 8) Immediate mitigation steps (0–2 days)
1. Add rate limiting per user (token bucket) to avoid abuse
2. Move heavy tasks off the request path: accept + persist message immediately, push to a queue for embedding and indexing
3. Batch embeddings (send multiple texts in one API call if provider supports it)
4. Add backoff and fallback: if embedding provider errors, mark message as pending and use Mongo-only semantic search


## 9) Medium-term and long-term scaling (1–12 weeks)
- Medium-term (1–4 weeks):
  - Introduce worker pool (Redis/Kafka + worker processes) for embedding generation and Qdrant upserts
  - Horizontally scale Node app servers behind a load balancer; use central session/Socket adapter (Redis) if needed
  - Use autoscaling rules: scale workers by queue depth; scale front-ends by CPU or p95 latency

- Long-term (1–3 months):
  - Partition users (shard by userId) across multiple Qdrant clusters or collections
  - Consider streaming platform (Kafka) for very high throughput
  - Implement multi-region deployments and CDN for static assets


## 10) Operational playbooks (short)
- If p95 message_processing_time climbs:
  1. Check CPU% and node count. Scale front-ends.
  2. Check queue depth. Scale workers or pause ingestion.
- If embedding errors spike:
  1. Pause workers, switch to fallback search, notify ops, rotate API keys or switch provider.
- If Qdrant upsert latency rises:
  1. Batch upserts, increase workers sparingly, check Qdrant memory and replica health.


## 11) Next dev tasks I recommend (can implement)
1. Add Prometheus metrics for additional DB latencies (Mongo write histogram)
2. Implement a lightweight worker queue (Redis + Bull or Kafka) and move embedding/upsert to workers
3. Add autoscaling GitHub Actions + infra (Terraform) to provision workers and DB autoscaling


## Checklist (what you asked for)
- Breaking point estimate: Included ✔️
- Limiting factor: Identified (CPU + embedding API) ✔️
- Reasoning & numbers: Included with explicit assumptions ✔️
- Monitoring plan and metrics: Included ✔️
- Implement logging for two metrics: Implemented ✔️ (message processing, embedding/upsert)
- Mitigation plan: Included (short/medium/long) ✔️


---

If you want, I can now:
- Add the remaining Prometheus instrumentation for Mongo write times;
- Implement a tiny worker queue and demo moving embedding/upsert off the request path;
- Create Grafana dashboard JSON for the key metrics.

Which one should I do next?
