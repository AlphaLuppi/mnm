// MnM Agents Module
//
// Manages AI agents that work on the product:
// - Main: Orchestrator
// - Atlas: Research & Analysis
// - Daedalus: Architecture
// - Héphaestos: Development
// - Hygieia: Testing/QA
// - Hermès: Coordination

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub role: AgentRole,
    pub status: AgentStatus,
    pub current_task: Option<String>,
    pub model: String,
    pub tokens_used: TokenUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AgentRole {
    Orchestrator,
    Researcher,
    Architect,
    Developer,
    Tester,
    Coordinator,
    Writer,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AgentStatus {
    Idle,
    Working,
    WaitingForInput,
    Blocked,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TokenUsage {
    pub input: u64,
    pub output: u64,
    pub cached: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub from: String,
    pub to: String,
    pub content: String,
    pub timestamp: u64,
    pub message_type: MessageType,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum MessageType {
    Task,
    Result,
    Question,
    Update,
    Error,
}

pub struct AgentRegistry {
    pub agents: Vec<Agent>,
    pub messages: Vec<AgentMessage>,
}

impl AgentRegistry {
    pub fn new() -> Self {
        Self {
            agents: Vec::new(),
            messages: Vec::new(),
        }
    }
    
    pub fn register(&mut self, agent: Agent) {
        self.agents.push(agent);
    }
    
    pub fn get(&self, id: &str) -> Option<&Agent> {
        self.agents.iter().find(|a| a.id == id)
    }
    
    pub fn get_mut(&mut self, id: &str) -> Option<&mut Agent> {
        self.agents.iter_mut().find(|a| a.id == id)
    }
    
    pub fn active_agents(&self) -> Vec<&Agent> {
        self.agents.iter().filter(|a| a.status == AgentStatus::Working).collect()
    }
    
    pub fn send_message(&mut self, msg: AgentMessage) {
        self.messages.push(msg);
    }
    
    pub fn messages_for(&self, agent_id: &str) -> Vec<&AgentMessage> {
        self.messages.iter().filter(|m| m.to == agent_id).collect()
    }
    
    pub fn recent_exchanges(&self, limit: usize) -> Vec<&AgentMessage> {
        let len = self.messages.len();
        let start = if len > limit { len - limit } else { 0 };
        self.messages[start..].iter().collect()
    }
}

impl Default for AgentRegistry {
    fn default() -> Self {
        Self::new()
    }
}

/// Create the default Pantheon agent team
pub fn create_default_team() -> AgentRegistry {
    let mut registry = AgentRegistry::new();
    
    registry.register(Agent {
        id: "main".to_string(),
        name: "Main".to_string(),
        emoji: "🧠".to_string(),
        role: AgentRole::Orchestrator,
        status: AgentStatus::Idle,
        current_task: None,
        model: "claude-opus-4-5".to_string(),
        tokens_used: TokenUsage::default(),
    });
    
    registry.register(Agent {
        id: "atlas".to_string(),
        name: "Atlas".to_string(),
        emoji: "🔍".to_string(),
        role: AgentRole::Researcher,
        status: AgentStatus::Idle,
        current_task: None,
        model: "claude-sonnet-4".to_string(),
        tokens_used: TokenUsage::default(),
    });
    
    registry.register(Agent {
        id: "daedalus".to_string(),
        name: "Daedalus".to_string(),
        emoji: "🏛️".to_string(),
        role: AgentRole::Architect,
        status: AgentStatus::Idle,
        current_task: None,
        model: "claude-sonnet-4".to_string(),
        tokens_used: TokenUsage::default(),
    });
    
    registry.register(Agent {
        id: "hephaestos".to_string(),
        name: "Héphaestos".to_string(),
        emoji: "🔨".to_string(),
        role: AgentRole::Developer,
        status: AgentStatus::Idle,
        current_task: None,
        model: "claude-sonnet-4".to_string(),
        tokens_used: TokenUsage::default(),
    });
    
    registry.register(Agent {
        id: "hygieia".to_string(),
        name: "Hygieia".to_string(),
        emoji: "🧪".to_string(),
        role: AgentRole::Tester,
        status: AgentStatus::Idle,
        current_task: None,
        model: "claude-sonnet-4".to_string(),
        tokens_used: TokenUsage::default(),
    });
    
    registry
}
