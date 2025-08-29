# Scaling Notes — Where Things Break If Everyone Logs In  

I wanted to figure out roughly where our current chat setup will start to fall over if the whole school piles on. This is not a formal capacity test, just back-of-the-envelope math + what we’re already seeing in logs.  

---

## 1) How Things Are Wired Right Now  

- Clients (browser/phone) connect via WebSockets  
- Node.js app server handles sockets + APIs  
- App talks to:  
  - **MongoDB** → message storage  
  - **Qdrant** → vector storage  
  - **Embedding service** → generates embeddings (either API or local model)  
- Thinking about adding a message queue (Redis/Kafka) so we don’t block on embeddings  

---

## 2) Assumptions I Used  

- GCP e2-standard-2 (2 vCPUs, 8 GB RAM)  
- Each user has an open WebSocket  
- Let’s say: 1 msg/user/sec on average  
- Every msg does:  
  - Mongo write (~20 ms)  
  - Embedding (~300 ms if API)  
  - Qdrant insert (~100 ms)  
- Node.js CPU per msg ~10 ms  
- Embedding size ~6–7 KB  
- Socket overhead ~5 KB each  

---

## 3) Likely Breaking Point  

With the above numbers, the server probably maxes out around **150–250 active users** (each sending ~1 msg/sec).  

Main pain points:  
- Node.js CPU gets saturated (2 cores ≈ ~200 msg/sec max)  
- Embedding API is the slowest piece (and could throttle us)  
- Qdrant writes add extra lag  

---

## 4) Quick Math  

- 200 users × 1 msg/sec = 200 msg/sec  
- Node.js can do ~100 msg/sec/core → 2 cores = ~200 msg/sec cap  
- Bandwidth is fine: 200 msg/sec × 7 KB = ~1.4 MB/sec (~11 Mbps)  
- Memory from sockets is tiny (10k sockets ≈ 50 MB)  

So: CPU + embeddings are the bottlenecks, not bandwidth or memory.  

---

## 5) What To Watch  

**App-level:**  
- Msg latency (p50, p95, p99)  
- Embedding response times  
- Qdrant insert times  
- Errors from embedding API  
- Active connections  

**System-level:**  
- CPU/memory usage  
- Network I/O  
- Mongo writes/sec  
- Qdrant memory/latency  

🚨 Red flag signals:  
- p95 latency > 1s  
- Embedding times spike  
- Queue backlog grows  

---

## 6) What We Already Track  

- Message handling time (logged + exposed to Prometheus)  
- Embedding + Qdrant times (also logged/metric-ed)  

So I already have visibility on where the lag is creeping in.  

---

## 7) How I’d Collect + View  

- Prometheus `/metrics` (already in place)  
- Logs shipped to Loki/ELK/Datadog  
- Dashboard:  
  - latency percentiles  
  - embedding timing  
  - active sockets  
  - CPU  

---

## 8) Things I Can Do Right Away  

- Rate limiting (stop spam)  
- Save msg first → push embeddings to a queue instead of blocking  
- Batch embeddings where possible  
- Have fallback (if embeddings fail, still store + show messages)  

---

## 9) Scaling Roadmap  

**Short-term:**  
- Add Redis/Kafka worker queue  
- Scale Node.js horizontally + sticky sessions  
- Redis adapter for socket state  
- Autoscale workers  

**Long-term:**  
- Shard Qdrant if embeddings grow big  
- Kafka for higher throughput  
- Multi-region for reliability  

---

## 10) Playbook for Outages  

- **Latency creeping up** → check CPU, scale app servers, inspect queue  
- **Embedding failures** → pause workers, fallback to basic flow  
- **Qdrant slow** → batch writes, check memory, scale cluster  

---

## 11) Next Things To Build  

- Track MongoDB write time  
- Move embedding/upserts to async workers  
- Add simple autoscaling rules  

---

That’s where things stand. Short version: the real cap is CPU + embedding latency, and sockets themselves are cheap. Need queues + horizontal scaling before we grow past ~200 active users.
