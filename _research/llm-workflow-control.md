# LLM Workflow Control — Comment les LLM pilotent des Workflows

**Date:** 2026-02-19  
**Auteur:** Atlas (Subagent Research)

## Résumé Exécutif

- **Function calling** : Méthode standard pour permettre au LLM d'invoquer des actions structurées (création/modification de workflow)
- **Structured output** : Garantir que le LLM produit du JSON valide avec un schema prédéfini
- **LangGraph** : Framework de référence pour workflows stateful avec graphe d'états
- **CrewAI** : Framework multi-agent avec rôles prédéfinis et collaboration orchestrée
- **Validation** : Toujours valider les modifications LLM avant de les appliquer (schema + règles métier)

---

## 1. Patterns de Contrôle LLM

### 1.1 Function Calling

Le LLM décide quand et avec quels paramètres appeler une fonction :

```typescript
// Définition des tools pour l'API OpenAI/Anthropic
const tools = [
  {
    name: "create_workflow_node",
    description: "Add a new node to the workflow",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "Unique node identifier" },
        nodeType: { 
          type: "string", 
          enum: ["llm", "tool", "decision", "parallel"],
          description: "Type of workflow node"
        },
        config: {
          type: "object",
          properties: {
            prompt: { type: "string" },
            model: { type: "string" },
            tools: { type: "array", items: { type: "string" } }
          }
        },
        connections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              targetId: { type: "string" },
              condition: { type: "string" }
            }
          }
        }
      },
      required: ["nodeId", "nodeType"]
    }
  },
  {
    name: "modify_workflow_node",
    description: "Modify an existing node in the workflow",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        updates: { type: "object" }
      },
      required: ["nodeId", "updates"]
    }
  },
  {
    name: "delete_workflow_node",
    description: "Remove a node from the workflow",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string" }
      },
      required: ["nodeId"]
    }
  }
];
```

### 1.2 Structured Output

Forcer le LLM à produire un schema spécifique :

```python
from pydantic import BaseModel, Field
from typing import List, Literal, Optional

class WorkflowNode(BaseModel):
    id: str = Field(description="Unique node identifier")
    type: Literal["llm", "tool", "decision", "parallel"] = Field(description="Node type")
    config: dict = Field(default_factory=dict)
    connections: List[dict] = Field(default_factory=list)

class WorkflowModification(BaseModel):
    action: Literal["create", "modify", "delete", "reorder"]
    nodes: List[WorkflowNode]
    reason: str = Field(description="Why this modification is needed")

# Avec Anthropic
from anthropic import Anthropic

client = Anthropic()
response = client.messages.create(
    model="claude-sonnet-4-5-20250929",
    max_tokens=1024,
    tools=[{
        "name": "modify_workflow",
        "description": "Propose workflow modifications",
        "input_schema": WorkflowModification.model_json_schema()
    }],
    messages=[{
        "role": "user", 
        "content": "Add a node that validates the output before sending it"
    }]
)
```

---

## 2. LangGraph — Workflows Stateful

### Architecture

LangGraph modélise les workflows comme des **graphes d'états** avec :
- **Nodes** : Fonctions qui transforment l'état
- **Edges** : Connexions entre nodes (conditionnelles ou fixes)
- **State** : Objet partagé entre tous les nodes

```python
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, START, END
import operator

# Define state
class WorkflowState(TypedDict):
    input: str
    steps: Annotated[list, operator.add]  # Accumulate steps
    result: str

# Define nodes
def analyze_task(state: WorkflowState):
    # LLM analyzes the task
    analysis = llm.invoke(f"Analyze this task: {state['input']}")
    return {"steps": [{"action": "analyze", "result": analysis}]}

def plan_execution(state: WorkflowState):
    # LLM creates execution plan
    plan = llm.invoke(f"Create plan for: {state['input']}")
    return {"steps": [{"action": "plan", "result": plan}]}

def execute_plan(state: WorkflowState):
    # Execute the plan
    result = execute_with_tools(state["steps"][-1]["result"])
    return {"result": result}

def should_continue(state: WorkflowState) -> str:
    # LLM decides if more work needed
    response = llm.invoke(f"Is this complete? {state['result']}")
    return "continue" if "no" in response.lower() else "end"

# Build graph
workflow = StateGraph(WorkflowState)
workflow.add_node("analyze", analyze_task)
workflow.add_node("plan", plan_execution)
workflow.add_node("execute", execute_plan)

workflow.add_edge(START, "analyze")
workflow.add_edge("analyze", "plan")
workflow.add_edge("plan", "execute")
workflow.add_conditional_edges(
    "execute",
    should_continue,
    {"continue": "plan", "end": END}
)

# Compile and run
app = workflow.compile()
result = app.invoke({"input": "Build a REST API for user management"})
```

### Patterns LangGraph

#### Orchestrator-Worker

```python
from typing import List

class Section(BaseModel):
    name: str
    description: str

class Sections(BaseModel):
    sections: List[Section]

# Planner outputs structured sections
planner = llm.with_structured_output(Sections)

def orchestrator(state):
    plan = planner.invoke(f"Break this into sections: {state['input']}")
    return {"sections": plan.sections}

def worker(state, section):
    result = llm.invoke(f"Complete this section: {section.description}")
    return {"completed": [{"section": section.name, "content": result}]}

# Parallel execution
def run_workers(state):
    with ThreadPoolExecutor() as executor:
        results = list(executor.map(
            lambda s: worker(state, s),
            state["sections"]
        ))
    return {"completed": [r["completed"][0] for r in results]}
```

#### Human-in-the-Loop

```python
from langgraph.checkpoint.memory import MemorySaver
from langgraph.types import interrupt

def human_review(state):
    # Interrupt for human approval
    decision = interrupt({
        "question": "Approve this workflow modification?",
        "proposed": state["modification"]
    })
    return {"approved": decision == "yes"}

# Compile with checkpointing
checkpointer = MemorySaver()
app = workflow.compile(checkpointer=checkpointer)

# Run until interrupt
config = {"configurable": {"thread_id": "review-1"}}
result = app.invoke(state, config)  # Pauses at interrupt

# Resume after human decision
app.invoke(Command(resume="yes"), config)
```

---

## 3. CrewAI — Multi-Agent Orchestration

### Concepts

| Concept | Description |
|---------|-------------|
| **Agent** | Entité avec rôle, goal, backstory |
| **Task** | Unité de travail assignée à un agent |
| **Crew** | Équipe d'agents coordonnés |
| **Process** | Mode d'exécution (sequential, hierarchical) |

### Exemple

```python
from crewai import Agent, Task, Crew, Process

# Define agents
architect = Agent(
    role="Software Architect",
    goal="Design robust and scalable system architectures",
    backstory="Expert in system design with 20 years experience",
    tools=[read_file, write_file, search_docs]
)

developer = Agent(
    role="Senior Developer",
    goal="Implement clean, tested code following best practices",
    backstory="Full-stack developer specializing in Python and TypeScript",
    tools=[execute_code, run_tests, git_commit]
)

reviewer = Agent(
    role="Code Reviewer",
    goal="Ensure code quality and catch bugs before production",
    backstory="QA lead with attention to detail",
    tools=[analyze_code, suggest_improvements]
)

# Define tasks
design_task = Task(
    description="Design the architecture for a workflow engine",
    expected_output="Architecture document with diagrams",
    agent=architect
)

implement_task = Task(
    description="Implement the workflow engine based on the architecture",
    expected_output="Working code with tests",
    agent=developer,
    context=[design_task]  # Depends on design
)

review_task = Task(
    description="Review the implementation for quality and bugs",
    expected_output="Review report with suggestions",
    agent=reviewer,
    context=[implement_task]
)

# Create crew
crew = Crew(
    agents=[architect, developer, reviewer],
    tasks=[design_task, implement_task, review_task],
    process=Process.sequential,  # or Process.hierarchical
    verbose=True
)

# Execute
result = crew.kickoff()
```

### Hierarchical Process (Manager)

```python
manager = Agent(
    role="Project Manager",
    goal="Coordinate team and ensure project success",
    backstory="Experienced PM",
    allow_delegation=True
)

crew = Crew(
    agents=[architect, developer, reviewer],
    tasks=[complex_task],
    process=Process.hierarchical,
    manager_agent=manager,  # Manager coordinates
    manager_llm=ChatOpenAI(model="gpt-4")
)
```

---

## 4. Claude Code Agent Teams

### Architecture (récent - Février 2026)

Claude Code a introduit **Agent Teams** pour orchestrer plusieurs instances :

```
┌─────────────────────────────────────────────────────┐
│                   TEAM LEAD                          │
│  (Main Claude Code session)                         │
│                                                      │
│  - Creates team                                     │
│  - Spawns teammates                                 │
│  - Coordinates work                                 │
│  - Synthesizes results                              │
└─────────────────────────────────────────────────────┘
          │                     │
    ┌─────┴─────┐         ┌─────┴─────┐
    │ Teammate A │         │ Teammate B │
    │ (Research) │         │ (Implement)│
    └───────────┘         └───────────┘
          │                     │
          │ Direct messaging    │
          │◄───────────────────►│
```

### Caractéristiques

- **Own context window** : Chaque teammate a son propre contexte
- **Direct messaging** : Les teammates peuvent communiquer entre eux
- **Shared task list** : Coordination via liste de tâches partagée
- **Plan approval** : Option pour valider les plans avant exécution

### Différence avec Subagents

| Feature | Subagents | Agent Teams |
|---------|-----------|-------------|
| Context | Own, results summarized back | Own, fully independent |
| Communication | Report to main only | Direct between teammates |
| Coordination | Main manages all | Shared task list |
| Token cost | Lower | Higher |

---

## 5. Validation des Modifications LLM

### Pipeline de Validation

```typescript
interface WorkflowModification {
  action: 'create' | 'modify' | 'delete';
  nodeId: string;
  changes: Record<string, any>;
}

class WorkflowValidator {
  async validate(modification: WorkflowModification): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 1. Schema validation
    const schemaResult = this.validateSchema(modification);
    if (!schemaResult.valid) {
      errors.push(...schemaResult.errors);
    }
    
    // 2. Business rules
    const rulesResult = await this.validateBusinessRules(modification);
    errors.push(...rulesResult.errors);
    warnings.push(...rulesResult.warnings);
    
    // 3. Safety checks
    const safetyResult = this.validateSafety(modification);
    errors.push(...safetyResult.errors);
    
    // 4. Consistency check
    const consistencyResult = await this.validateConsistency(modification);
    errors.push(...consistencyResult.errors);
    
    return {
      valid: errors.length === 0,
      errors,
      warnings,
      modification: errors.length === 0 ? this.sanitize(modification) : null
    };
  }
  
  private validateBusinessRules(mod: WorkflowModification): RulesResult {
    const errors: string[] = [];
    
    // Example rules
    if (mod.action === 'delete' && this.hasDownstreamDependencies(mod.nodeId)) {
      errors.push(`Cannot delete node ${mod.nodeId}: has downstream dependencies`);
    }
    
    if (mod.action === 'create' && this.nodeExists(mod.nodeId)) {
      errors.push(`Node ${mod.nodeId} already exists`);
    }
    
    return { errors, warnings: [] };
  }
  
  private validateSafety(mod: WorkflowModification): SafetyResult {
    const errors: string[] = [];
    
    // Prevent dangerous operations
    if (mod.changes?.command?.includes('rm -rf')) {
      errors.push('Dangerous command detected');
    }
    
    // Limit node count
    if (this.getNodeCount() >= 100) {
      errors.push('Maximum node count reached');
    }
    
    return { errors };
  }
}
```

### Sandbox Execution

```python
# Execute LLM-proposed changes in sandbox first
class WorkflowSandbox:
    def __init__(self, original_workflow: Workflow):
        self.workflow = copy.deepcopy(original_workflow)
    
    def apply_modification(self, mod: WorkflowModification) -> SandboxResult:
        try:
            # Apply in sandbox
            if mod.action == "create":
                self.workflow.add_node(mod.node)
            elif mod.action == "modify":
                self.workflow.update_node(mod.nodeId, mod.changes)
            elif mod.action == "delete":
                self.workflow.remove_node(mod.nodeId)
            
            # Validate resulting workflow
            validation = self.workflow.validate()
            
            # Dry-run execution
            dry_run = self.workflow.execute(dry_run=True)
            
            return SandboxResult(
                success=True,
                workflow=self.workflow,
                validation=validation,
                dry_run=dry_run
            )
        except Exception as e:
            return SandboxResult(
                success=False,
                error=str(e)
            )
```

---

## 6. Workflow Schema pour LLM

### JSON Schema (pour function calling)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Workflow",
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "description": { "type": "string" },
    "nodes": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "type": {
            "type": "string",
            "enum": ["start", "llm", "tool", "decision", "parallel", "end"]
          },
          "config": {
            "type": "object",
            "properties": {
              "prompt": { "type": "string" },
              "model": { "type": "string" },
              "tools": { "type": "array", "items": { "type": "string" } },
              "condition": { "type": "string" },
              "timeout": { "type": "number" }
            }
          },
          "position": {
            "type": "object",
            "properties": {
              "x": { "type": "number" },
              "y": { "type": "number" }
            }
          }
        },
        "required": ["id", "type"]
      }
    },
    "edges": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "source": { "type": "string" },
          "target": { "type": "string" },
          "label": { "type": "string" },
          "condition": { "type": "string" }
        },
        "required": ["source", "target"]
      }
    }
  },
  "required": ["id", "nodes", "edges"]
}
```

### Natural Language Description (pour prompt)

```markdown
## Workflow Format

A workflow consists of:

1. **Nodes**: Processing units that perform actions
   - `start`: Entry point (exactly one)
   - `llm`: Call to language model
   - `tool`: External tool execution
   - `decision`: Conditional branching
   - `parallel`: Execute multiple branches simultaneously
   - `end`: Exit point (at least one)

2. **Edges**: Connections between nodes
   - Each edge has a source and target node ID
   - Optional: condition for conditional branching

3. **Config**: Node-specific configuration
   - `llm` nodes: prompt, model, temperature
   - `tool` nodes: tool name, parameters
   - `decision` nodes: condition expression

Example:
```json
{
  "nodes": [
    {"id": "start", "type": "start"},
    {"id": "analyze", "type": "llm", "config": {"prompt": "Analyze: {input}"}},
    {"id": "end", "type": "end"}
  ],
  "edges": [
    {"source": "start", "target": "analyze"},
    {"source": "analyze", "target": "end"}
  ]
}
```
```

---

## 7. Recommandations pour MnM

### Architecture Suggérée

```
┌─────────────────────────────────────────────────────┐
│                 MnM Workflow Engine                  │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Workflow   │  │     LLM      │  │  Sandbox  │ │
│  │    State     │  │   Controller │  │  Executor │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│         │                 │                │        │
│  ┌──────────────────────────────────────────────┐  │
│  │              Validation Layer                 │  │
│  │   - Schema validation                        │  │
│  │   - Business rules                           │  │
│  │   - Safety checks                            │  │
│  └──────────────────────────────────────────────┘  │
│         │                                          │
│  ┌──────────────────────────────────────────────┐  │
│  │              Event Bus                        │  │
│  │   - Workflow updates                         │  │
│  │   - Node execution events                    │  │
│  │   - LLM streaming                            │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Workflow Modification Flow

```
User Request
     │
     ▼
┌─────────────┐
│ LLM Analyze │ ─── "Add validation step before output"
└─────────────┘
     │
     ▼
┌─────────────┐
│  Generate   │ ─── Structured output: WorkflowModification
│ Modification│
└─────────────┘
     │
     ▼
┌─────────────┐
│  Validate   │ ─── Schema + Rules + Safety
└─────────────┘
     │
     ├── Invalid → Show errors to user
     │
     ▼ Valid
┌─────────────┐
│  Sandbox    │ ─── Dry-run execution
│   Test      │
└─────────────┘
     │
     ├── Failed → Show issues to user
     │
     ▼ Success
┌─────────────┐
│   Preview   │ ─── Show diff to user
└─────────────┘
     │
     ├── User rejects → Discard
     │
     ▼ User approves
┌─────────────┐
│   Apply     │ ─── Update workflow state
└─────────────┘
```

### Code d'intégration

```typescript
// services/workflowLLM.ts
export class WorkflowLLMController {
  constructor(
    private llm: LLMClient,
    private validator: WorkflowValidator,
    private sandbox: WorkflowSandbox
  ) {}
  
  async proposeModification(
    workflow: Workflow,
    userRequest: string
  ): Promise<ModificationProposal> {
    // 1. Generate modification with LLM
    const response = await this.llm.chat({
      messages: [
        { role: "system", content: WORKFLOW_SYSTEM_PROMPT },
        { role: "user", content: this.buildPrompt(workflow, userRequest) }
      ],
      tools: WORKFLOW_TOOLS,
      tool_choice: "required"
    });
    
    const modification = this.parseToolCall(response);
    
    // 2. Validate
    const validation = await this.validator.validate(modification);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }
    
    // 3. Sandbox test
    const sandboxResult = await this.sandbox.apply(workflow, modification);
    if (!sandboxResult.success) {
      return { success: false, errors: [sandboxResult.error] };
    }
    
    // 4. Generate diff
    const diff = this.generateDiff(workflow, sandboxResult.workflow);
    
    return {
      success: true,
      modification,
      diff,
      newWorkflow: sandboxResult.workflow
    };
  }
}
```

---

## Sources

- https://docs.langchain.com/oss/python/langgraph/workflows-agents
- https://langwatch.ai/blog/best-ai-agent-frameworks-in-2025
- https://www.nuvi.dev/blog/ai-agent-framework-comparison-langgraph-crewai-openai-swarm
- https://code.claude.com/docs/en/agent-teams
- https://agixtech.com/langgraph-vs-crewai-vs-autogpt/
- https://xcelore.com/blog/langgraph-vs-crewai/
