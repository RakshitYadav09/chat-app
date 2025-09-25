Chat App with Semantic Search
---

## 🚀 Features

- **User signup/login** — quick, email-based, no passwords for demo simplicity.
- **Real-time chat** — instant messaging with Socket.io.
- **Persistent storage** — all messages saved in MongoDB Atlas.
- **Semantic search** — find messages by meaning, not just keywords, using Claude API and Qdrant.
- **Combined search** — word matches always show up first, but semantic matches are right there too.
- **Responsive UI** — React + Vite, works on desktop and mobile.
- **Monitoring & scaling** — Prometheus metrics, health checks, and a scaling plan.

---

## 🏗️ System Overview

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   React UI   │<--►│  Node.js API │<--►│   MongoDB    │
│ (Vite/Socket)│    │ (Express/SIO)│    │ (Messages)   │
└──────────────┘    │  + Qdrant    │    └──────────────┘
                    └──────────────┘
```

- **Frontend:** React app connects via REST and Socket.io.
- **Backend:** Node.js/Express handles API, sockets, and search.
- **MongoDB:** Stores users and messages.
- **Qdrant:** Stores message embeddings for semantic search.
- **Claude API:** Generates embeddings for meaning-based search.

---

## ⚙️ Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/faff-chat-app.git
cd faff-chat-app

# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Environment Setup

Create a `.env` file in `backend/`:

```env
NODE_ENV=production
PORT=10000

MONGODB_URI=your-mongodb-uri
JWT_SECRET=your-jwt-secret

CORS_ORIGIN=https://your-frontend.vercel.app
FRONTEND_URL=https://your-frontend.vercel.app

CLAUDE_API_KEY=sk-ant-api03-your-key
QDRANT_URL=https://your-qdrant-instance.cloud.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key
QDRANT_COLLECTION=messages

ENABLE_VECTOR_SEARCH=true
```

And in `frontend/`:

```env
VITE_API_BASE_URL=http://localhost:10000
```

### 3. Run Locally

**Backend:**

```bash
cd backend
npm start
```

**Frontend:**

```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🐳 Dockerfile Overview

This project includes **three Dockerfiles** for maximum flexibility:

- **Root `Dockerfile` (in the project root):**
  - Builds and runs both backend and frontend in a single container.
  - Great for local testing, quick demos, or simple deployments.
  - Usage:
    ```bash
    docker build -t faff-fullstack .
    docker run --env-file backend/.env -p 10000:10000 faff-fullstack
    # Visit http://localhost:10000
    ```

- **`backend/Dockerfile`:**
  - Builds and runs only the backend (Node.js/Express API).
  - Use this for production deployments where backend and frontend are separate services.
  - Usage:
    ```bash
    cd backend
    docker build -t faff-backend .
    docker run --env-file .env -p 10000:10000 faff-backend
    ```

- **`frontend/Dockerfile`:**
  - Builds and serves only the frontend (React/Vite, served by Nginx).
  - Use this for deploying the frontend to Vercel, Netlify, or as a standalone static site.
  - Usage:
    ```bash
    cd frontend
    docker build -t faff-frontend .
    docker run -p 80:80 faff-frontend
    # Visit http://localhost
    ```

**Best practice:**  
Keep all three Dockerfiles! This lets you develop, test, and deploy in whatever way fits your needs.

---

## 🧪 Testing & Health Checks

- **Health check:**  
  Visit `http://localhost:10000/health` or run `./health-check.sh` after deployment.
- **Prometheus metrics:**  
  Visit `http://localhost:10000/metrics` for live stats.
- **Monitoring dashboard:**  
  Open `http://localhost:10000/dashboard` for a simple real-time view.

---

## 🔍 Search API

### Combined Search

```http
GET /messages/search?userId=...&q=...&limit=10
```

- **Word search:** Finds exact matches (always ranked first).
- **Semantic search:** Finds messages with similar meaning (using Claude embeddings + Qdrant).
- **Hybrid:** Both results merged, word hits boosted.

### Semantic Search Only

```http
GET /messages/semantic-search?userId=...&q=...
```

- Returns top 10 most relevant messages by meaning.

---

## 🧠 How Semantic Search Works

- When you send a message, the backend generates an embedding (vector) using Claude API.
- The embedding is stored in Qdrant (vector DB) and MongoDB.
- When you search, the backend:
  1. Runs a word search in MongoDB.
  2. Runs a semantic search in Qdrant.
  3. Merges and ranks results (word matches always on top).
- The UI shows both types, so you never miss a message — even if you forgot the exact words.

---

## 📈 Scaling & Monitoring

- **Metrics:**  
  `/metrics` endpoint exposes Prometheus stats (message latency, embedding times, etc.).
- **Scaling plan:**  
  - Start: Single server, MongoDB Atlas, Qdrant Cloud.
  - Grow: Add worker queue for embeddings, batch requests, scale horizontally.
  - Big: Partition messages, use distributed Qdrant, add Redis cache, autoscale.

---

## 📝 Bottleneck & Failure Analysis

- **Breaking point:**  
  On a GCP e2-standard-2 (2 vCPU, 8GB RAM), expect ~150–250 active users (1 msg/sec each) before CPU or embedding API limits hit.
- **Limiting factors:**  
  CPU, embedding API rate limits, DB write speed, and socket connections.
- **Monitoring:**  
  Prometheus metrics for message processing time and embedding latency.
- **Mitigation:**  
  Add rate limiting, move embedding to background workers, batch API calls, and scale out as needed.

