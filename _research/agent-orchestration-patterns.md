# Agent Orchestration Patterns — Temporal, Prefect, Dagster, n8n

**Date:** 2026-02-19  
**Auteur:** Atlas (Subagent Research)

## Résumé Exécutif

- **Temporal** : Durable execution avec state capture automatique à chaque step, UI avec Timeline/Compact/Full History views, pas de WebSocket natif (pattern pub/sub externe)
- **Prefect** : Python-first, événements natifs stockés et visibles dans UI, triggers event-driven, bonne intégration MCP
- **Dagster** : Asset-centric, sensors et auto-materialization puissants, UI orientée data lineage
- **n8n** : Low-code/visual, bon pour automations simples, moins adapté pour agents complexes

---

## 1. Temporal

### Architecture

Temporal est une plateforme de **durable execution** : les workflows capturent automatiquement l'état à chaque step et peuvent reprendre exactement où ils se sont arrêtés en cas de failure.

```
┌─────────────────────────────────────────────────────┐
│                 TEMPORAL CLUSTER                     │
│  ┌───────────┐  ┌───────────┐  ┌───────────────┐   │
│  │  History  │  │  Matching │  │   Frontend    │   │
│  │  Service  │  │  Service  │  │   Service     │   │
│  └───────────┘  └───────────┘  └───────────────┘   │
│         │              │               │            │
│  ┌──────────────────────────────────────────────┐  │
│  │           Event History Storage               │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
          │                              │
    ┌─────┴─────┐                  ┌─────┴─────┐
    │  Worker A │                  │  Worker B │
    │  (Tasks)  │                  │  (Tasks)  │
    └───────────┘                  └───────────┘
```

### Event Groups (concept clé)

Temporal groupe les events liés :
- `ActivityTaskScheduled` + `ActivityTaskStarted` + `ActivityTaskCompleted` = Activity group
- `TimerStarted` + `TimerFired` = Timer group

Permet une vue simplifiée sans perdre le détail.

### UI Views

| View | Description | Use Case |
|------|-------------|----------|
| **Compact** | Progression linéaire des Event Groups | Vue d'ensemble rapide |
| **Timeline** | Durées clock-time, events empilés verticalement | Analyse latency |
| **Full History** | Git-tree style, tous les events | Debug détaillé |

### Real-Time Updates Pattern

Temporal **n'a pas de WebSocket natif** pour notifier les frontends. Pattern recommandé :

```python
# Worker side: emit to external pub/sub
@activity.defn
async def process_step():
    result = do_work()
    # Push to Redis/Kafka/WebSocket server
    await redis.publish(f"workflow:{workflow_id}", json.dumps({
        "event": "step_completed",
        "step": "process_step",
        "result": result
    }))
    return result
```

```javascript
// Frontend: subscribe to pub/sub
const ws = new WebSocket('wss://your-ws-server');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  updateUI(data);
};
```

### Workflow Actions

Depuis l'UI, on peut :
- Request Cancellation
- Send Signal / Update
- Reset workflow
- Terminate workflow
- Start new workflow with pre-filled values

### Code Example (Python)

```python
from temporalio import activity, workflow
from datetime import timedelta

@activity.defn
async def fetch_data() -> dict:
    return {"data": "..."}

@activity.defn
async def process_data(data: dict) -> str:
    return f"Processed: {data}"

@workflow.defn
class DataPipelineWorkflow:
    @workflow.run
    async def run(self) -> str:
        data = await workflow.execute_activity(
            fetch_data,
            start_to_close_timeout=timedelta(seconds=30)
        )
        return await workflow.execute_activity(
            process_data,
            args=[data],
            start_to_close_timeout=timedelta(seconds=30)
        )
```

---

## 2. Prefect

### Architecture

Prefect est **Python-first** avec un système d'événements natif et une UI cloud/self-hosted.

### Event System

**Clé** : Chaque event reçu ou émis par Prefect est **stocké et visible dans l'UI**.

```python
from prefect.events import emit_event
from prefect import flow, task

@task
def process_file(file_name: str):
    # Processing logic
    return f"Processed {file_name}"

@flow
def data_pipeline(file_name: str):
    result = process_file(file_name)
    
    # Emit custom event
    emit_event(
        event="custom.file_processed",
        resource={"prefect.resource.id": f"file.{file_name}"}
    )
    return result
```

### Event-Driven Triggers

```python
from prefect import flow
from prefect.automations import Automation
from prefect.events.schemas import EventTrigger

# Trigger flow on S3 file upload
automation = Automation(
    name="Process new files",
    trigger=EventTrigger(
        expect=["s3.object.created"],
        match={"bucket": "my-bucket"}
    ),
    actions=[{"type": "run-deployment", "deployment_id": "..."}]
)
```

### UI Features

- **Dashboard** : Summaries, recent runs, error logs, upcoming runs
- **Events page** : Raw event inspection (JSON)
- **Flow runs** : Status, logs, timeline
- **Logs** : Auto-emitted par Prefect, visibles dans UI/CLI/API

### Real-Time Pattern

Prefect stocke les events, mais pour streaming temps réel vers un frontend :

```python
from prefect.client import get_client

async def stream_flow_logs(flow_run_id: str):
    async with get_client() as client:
        # Poll for new logs (Prefect n'a pas de streaming natif)
        while True:
            logs = await client.read_logs(flow_run_id)
            yield logs
            await asyncio.sleep(1)
```

### MCP Integration

Prefect supporte MCP (Model Context Protocol) :
```
Connect to https://docs.prefect.io/mcp in Claude Desktop, Cursor, or VS Code
```

---

## 3. Dagster

### Architecture

Dagster est **asset-centric** : les workflows sont définis en termes de données produites plutôt que de tâches exécutées.

### Concepts clés

| Concept | Description |
|---------|-------------|
| **Asset** | Donnée persistante avec lineage |
| **Op** | Unité de computation |
| **Job** | Collection d'ops |
| **Sensor** | Trigger sur conditions externes |
| **Schedule** | Trigger temporel |

### Code Example

```python
from dagster import asset, define_asset_job, Definitions

@asset
def raw_data():
    return fetch_from_api()

@asset
def cleaned_data(raw_data):
    return clean(raw_data)

@asset
def analytics(cleaned_data):
    return compute_analytics(cleaned_data)

defs = Definitions(
    assets=[raw_data, cleaned_data, analytics],
    jobs=[define_asset_job("refresh_analytics", selection="*")]
)
```

### Sensors (Event-Driven)

```python
from dagster import sensor, RunRequest

@sensor(job=my_job)
def file_sensor(context):
    new_files = check_for_new_files()
    for file in new_files:
        yield RunRequest(
            run_key=file.name,
            run_config={"ops": {"process": {"config": {"file": file.path}}}}
        )
```

### UI Features

- **Asset lineage graph** : Visualisation des dépendances
- **Materialization history** : Quand chaque asset a été produit
- **Run timeline** : Durées et statuts
- **Logs** : Structured logging avec levels

---

## 4. n8n

### Architecture

n8n est un outil **low-code/visual** pour l'automatisation de workflows.

### Concepts

| Concept | Description |
|---------|-------------|
| **Node** | Unité d'exécution (action ou trigger) |
| **Workflow** | Graphe de nodes connectés |
| **Trigger** | Démarrage du workflow (webhook, schedule, event) |
| **Credential** | Auth stockée pour les intégrations |

### UI Features

- **Visual editor** : Drag & drop de nodes
- **Execution history** : Logs par exécution
- **Real-time** : Preview des données entre nodes
- **Webhook** : URL générée automatiquement

### Agent Nodes (récent)

n8n a ajouté des nodes AI :
- `AI Agent` : LLM avec tools
- `Chat Memory` : Contexte de conversation
- `Tool` : Actions que l'agent peut appeler

### Limitations pour MnM

- Moins adapté pour orchestration complexe d'agents
- Pas de support natif multi-agent sophistiqué
- UI orientée automations simples

---

## 5. Comparaison

| Feature | Temporal | Prefect | Dagster | n8n |
|---------|----------|---------|---------|-----|
| **Focus** | Durable execution | Data pipelines | Asset management | Low-code automation |
| **Language** | Multi (Go, Python, TS) | Python | Python | Visual + Code |
| **Event storage** | ✅ (Event History) | ✅ (Events page) | ✅ (Asset history) | ⚠️ (Execution logs) |
| **Real-time UI** | Timeline view | Events page | Run timeline | Execution preview |
| **WebSocket native** | ❌ | ❌ | ❌ | ⚠️ (webhooks) |
| **Multi-agent** | ❌ | ❌ | ❌ | ⚠️ (AI nodes) |
| **Pause/Resume** | ✅ (Signals) | ⚠️ (Cancellation) | ⚠️ (Sensors) | ⚠️ (Manual) |
| **State persistence** | ✅ (Automatic) | ✅ (Results) | ✅ (Assets) | ⚠️ (Execution data) |

---

## 6. Patterns Communs

### State Machine Pattern

```python
# Workflow as state machine (applicable à tous)
class WorkflowState(Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class WorkflowExecution:
    id: str
    state: WorkflowState
    current_step: int
    steps: List[Step]
    started_at: datetime
    updated_at: datetime
    error: Optional[str]
```

### Event Notification Pattern

```python
# Abstraction pour notifier un frontend
class WorkflowEventEmitter:
    async def emit(self, event: WorkflowEvent):
        # 1. Store in DB
        await self.db.insert("events", event.dict())
        
        # 2. Push to subscribers (WebSocket/SSE)
        for subscriber in self.subscribers[event.workflow_id]:
            await subscriber.send(event.json())
        
        # 3. Optionally publish to message queue
        await self.mq.publish(f"workflow.{event.type}", event.dict())
```

### Retry/Backoff Pattern

```python
from tenacity import retry, stop_after_attempt, wait_exponential

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10)
)
async def execute_step(step: Step):
    return await step.run()
```

---

## 7. Recommandations pour MnM

### Ce qu'on peut reprendre

1. **De Temporal** :
   - Event Groups (grouper les events liés)
   - Multiple views (Compact/Timeline/Detail)
   - Workflow actions (pause/cancel/signal)

2. **De Prefect** :
   - Event storage natif et visible
   - Custom events (`emit_event`)
   - MCP integration

3. **De Dagster** :
   - Asset-centric thinking (outputs persistants)
   - Sensors pour triggers

4. **De n8n** :
   - Visual workflow builder (pour les non-devs)
   - Webhook triggers faciles

### Architecture suggérée pour MnM

```
┌─────────────────────────────────────────────────────┐
│                    MnM Backend                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  Workflow    │  │    Event     │  │    API    │ │
│  │   Engine     │  │    Store     │  │  (REST +  │ │
│  │  (State)     │  │  (Events)    │  │   WS)     │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│         │                 │                │        │
│  ┌──────────────────────────────────────────────┐  │
│  │              Agent Orchestrator               │  │
│  │   - Spawn agents                             │  │
│  │   - Route messages                           │  │
│  │   - Collect results                          │  │
│  └──────────────────────────────────────────────┘  │
│         │                                          │
│  ┌──────────────────────────────────────────────┐  │
│  │              OpenClaw Gateway                 │  │
│  │   (actual agent execution)                   │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
          │                              │
    ┌─────┴─────┐                  ┌─────┴─────┐
    │  Frontend │                  │  Frontend │
    │  (React)  │                  │  (Mobile) │
    └───────────┘                  └───────────┘
```

---

## Sources

- https://docs.temporal.io/web-ui
- https://temporal.io/blog/the-dark-magic-of-workflow-exploration
- https://docs.prefect.io/
- https://www.prefect.io/blog/building-real-time-data-pipelines-a-guide-to-event-driven-workflows-in-prefect
- https://docs.dagster.io/
- https://docs.n8n.io/
- Community discussions (Reddit, HackerNews)
