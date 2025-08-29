# System Architecture Diagram

## Current Architecture (Single Server)

```mermaid
graph TB
    subgraph "Client Layer"
        U1[👤 User 1<br/>React App]
        U2[👤 User 2<br/>React App]
        U3[👤 User N<br/>React App]
    end
    
    subgraph "Application Layer"
        LB[🔄 Load Balancer<br/>nginx/HAProxy<br/>FUTURE]
        APP[🚀 Node.js Server<br/>Express + Socket.io<br/>GCP e2-standard-2<br/>2 vCPU, 8GB RAM]
    end
    
    subgraph "Processing Layer"
        EMB[🧠 Embedding Service<br/>Local Transformers<br/>all-MiniLM-L6-v2<br/>~300ms per message]
        QUEUE[📋 Message Queue<br/>In-Memory<br/>NEEDS IMPLEMENTATION]
    end
    
    subgraph "Data Layer"
        DB[(🗄️ MongoDB<br/>Message Storage<br/>User Management)]
        CACHE[(⚡ Redis Cache<br/>FUTURE<br/>Embedding Cache)]
        VECTOR[(🔍 Vector DB<br/>FUTURE<br/>Qdrant/Pinecone)]
    end
    
    subgraph "Monitoring Layer"
        MON[📊 Monitoring<br/>Custom Metrics<br/>Console Logging]
        ALERT[🚨 Alerting<br/>FUTURE<br/>Threshold Based]
    end

    %% User Connections
    U1 -.->|WebSocket| APP
    U2 -.->|WebSocket| APP
    U3 -.->|WebSocket| APP
    
    %% Future Load Balancer
    U1 -.->|FUTURE| LB
    U2 -.->|FUTURE| LB
    U3 -.->|FUTURE| LB
    LB -.->|FUTURE| APP
    
    %% Application Processing
    APP -->|Message Processing| QUEUE
    QUEUE -->|Embedding Generation| EMB
    EMB -->|Semantic Vectors| APP
    
    %% Data Operations
    APP -->|Store Messages| DB
    APP -->|User Management| DB
    APP -.->|FUTURE Cache| CACHE
    EMB -.->|FUTURE Vector Search| VECTOR
    
    %% Monitoring
    APP -->|Metrics| MON
    MON -.->|FUTURE| ALERT
    
    %% Styling
    classDef primary fill:#3b82f6,color:#fff
    classDef secondary fill:#06b6d4,color:#fff
    classDef future fill:#94a3b8,color:#fff,stroke-dasharray: 5 5
    classDef bottleneck fill:#ef4444,color:#fff
    
    class APP,EMB primary
    class DB,MON secondary
    class LB,CACHE,VECTOR,ALERT,QUEUE future
    class EMB bottleneck
```

## Scaled Architecture (Future State)

```mermaid
graph TB
    subgraph "Client Layer"
        U1[👤 User 1-100]
        U2[👤 User 101-200]
        U3[👤 User 201-N]
    end
    
    subgraph "Load Balancing"
        LB[🔄 Load Balancer<br/>nginx + sticky sessions]
        CDN[🌐 CDN<br/>Static Assets]
    end
    
    subgraph "Application Cluster"
        APP1[🚀 App Instance 1<br/>Socket.io + Express]
        APP2[🚀 App Instance 2<br/>Socket.io + Express]
        APP3[🚀 App Instance N<br/>Socket.io + Express]
    end
    
    subgraph "Processing Services"
        EMB_SVC[🧠 Embedding Service<br/>GPU Accelerated<br/>Kubernetes Pod]
        QUEUE_SVC[📋 Message Queue<br/>Redis/RabbitMQ<br/>Async Processing]
    end
    
    subgraph "Data Cluster"
        DB_PRIMARY[(🗄️ MongoDB Primary<br/>Write Operations)]
        DB_REPLICA1[(🗄️ MongoDB Replica 1<br/>Read Operations)]
        DB_REPLICA2[(🗄️ MongoDB Replica 2<br/>Read Operations)]
        REDIS[(⚡ Redis Cluster<br/>Session + Cache)]
        VECTOR[(🔍 Vector Database<br/>Qdrant/Pinecone<br/>Semantic Search)]
    end
    
    subgraph "Monitoring & Ops"
        METRICS[📊 Prometheus<br/>Metrics Collection]
        GRAFANA[📈 Grafana<br/>Dashboards]
        ALERT[🚨 AlertManager<br/>Incident Response]
        LOGS[📝 Elasticsearch<br/>Log Aggregation]
    end

    %% Client Connections
    U1 --> LB
    U2 --> LB
    U3 --> LB
    CDN --> U1
    
    %% Load Distribution
    LB --> APP1
    LB --> APP2
    LB --> APP3
    
    %% Service Communication
    APP1 --> QUEUE_SVC
    APP2 --> QUEUE_SVC
    APP3 --> QUEUE_SVC
    QUEUE_SVC --> EMB_SVC
    
    %% Data Operations
    APP1 --> DB_PRIMARY
    APP2 --> DB_REPLICA1
    APP3 --> DB_REPLICA2
    APP1 --> REDIS
    APP2 --> REDIS
    APP3 --> REDIS
    EMB_SVC --> VECTOR
    
    %% Database Replication
    DB_PRIMARY --> DB_REPLICA1
    DB_PRIMARY --> DB_REPLICA2
    
    %% Monitoring
    APP1 --> METRICS
    APP2 --> METRICS
    APP3 --> METRICS
    EMB_SVC --> METRICS
    METRICS --> GRAFANA
    METRICS --> ALERT
    APP1 --> LOGS
    APP2 --> LOGS
    APP3 --> LOGS
    
    %% Styling
    classDef primary fill:#3b82f6,color:#fff
    classDef data fill:#06b6d4,color:#fff
    classDef monitoring fill:#10b981,color:#fff
    classDef processing fill:#8b5cf6,color:#fff
    
    class APP1,APP2,APP3,LB primary
    class DB_PRIMARY,DB_REPLICA1,DB_REPLICA2,REDIS,VECTOR data
    class METRICS,GRAFANA,ALERT,LOGS monitoring
    class EMB_SVC,QUEUE_SVC processing
```

## ASCII Diagram (Simplified Current State)

```
                    CHAT APPLICATION ARCHITECTURE
                           (Current State)

    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │   User 1    │    │   User 2    │    │   User N    │
    │ React App   │    │ React App   │    │ React App   │
    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
           │                  │                  │
           └──────────────────┼──────────────────┘
                              │ WebSocket Connections
                              │ (Max ~1,000 concurrent)
                              ▼
    ┌─────────────────────────────────────────────────────────┐
    │              NODE.JS APPLICATION SERVER                 │
    │         GCP e2-standard-2 (2 vCPU, 8GB RAM)           │
    │                                                         │
    │  ┌──────────────┐  ┌───────────────┐  ┌─────────────┐  │
    │  │  Socket.io   │  │   Express     │  │   Metrics   │  │
    │  │  WebSocket   │  │     API       │  │   Logger    │  │
    │  │   Handler    │  │   Routes      │  │             │  │
    │  └──────┬───────┘  └───────┬───────┘  └─────────────┘  │
    │         │                  │                           │
    │         └──────────────────┼───────────────────────────┤
    │                            ▼                           │
    │  ┌─────────────────────────────────────────────────┐   │
    │  │        EMBEDDING PROCESSING PIPELINE            │   │
    │  │                                                 │   │
    │  │  Input Queue → Transformer Model → Vector DB   │   │
    │  │     (RAM)    →  (300ms/msg CPU)  →  (MongoDB)  │   │
    │  │                                                 │   │
    │  │            🚨 PRIMARY BOTTLENECK 🚨            │   │
    │  └─────────────────────────────────────────────────┘   │
    └─────────────────────────┬───────────────────────────────┘
                              │
                              ▼
    ┌─────────────────────────────────────────────────────────┐
    │                    MONGODB DATABASE                     │
    │                                                         │
    │  Collections:                                          │
    │  ├── users (authentication)                           │
    │  ├── messages (chat history + embeddings)             │
    │  └── conversations (user relationships)               │
    │                                                         │
    │  Performance: ~500-1000 writes/sec                    │
    └─────────────────────────────────────────────────────────┘

                            BOTTLENECK ANALYSIS
    ┌─────────────────────────────────────────────────────────┐
    │                                                         │
    │  🔴 CRITICAL: Embedding Generation (300ms/msg)         │
    │      └── Supports only 5-7 concurrent users           │
    │                                                         │
    │  🟡 MODERATE: Memory Usage (2KB/connection)            │
    │      └── Supports ~3,000 concurrent connections       │
    │                                                         │
    │  🟢 MINIMAL: Database Writes (10ms/msg)                │
    │      └── Supports ~500 messages/second globally       │
    │                                                         │
    └─────────────────────────────────────────────────────────┘
```
