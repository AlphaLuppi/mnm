// MnM Workflow Module
//
// Manages the product development workflow:
// PRD → Stories → Architecture → Development → Testing → Deploy
//
// Each stage has:
// - Associated documents (specs, code, tests)
// - Assigned agents
// - Validation rules
// - Sync requirements

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WorkflowStage {
    Prd,
    Stories,
    Architecture,
    Development,
    Testing,
    Deploy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowItem {
    pub id: String,
    pub stage: WorkflowStage,
    pub title: String,
    pub status: ItemStatus,
    pub assigned_agent: Option<String>,
    pub documents: Vec<Document>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ItemStatus {
    NotStarted,
    InProgress,
    InReview,
    Done,
    Blocked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Document {
    pub path: String,
    pub doc_type: DocumentType,
    pub last_modified: u64,
    pub hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum DocumentType {
    Prd,
    Story,
    ArchitectureDoc,
    SourceCode,
    Test,
    Config,
}

pub struct Workflow {
    pub items: Vec<WorkflowItem>,
    pub current_stage: WorkflowStage,
}

impl Workflow {
    pub fn new() -> Self {
        Self {
            items: Vec::new(),
            current_stage: WorkflowStage::Prd,
        }
    }
    
    pub fn add_item(&mut self, item: WorkflowItem) {
        self.items.push(item);
    }
    
    pub fn items_by_stage(&self, stage: &WorkflowStage) -> Vec<&WorkflowItem> {
        self.items.iter().filter(|i| &i.stage == stage).collect()
    }
    
    pub fn active_items(&self) -> Vec<&WorkflowItem> {
        self.items.iter().filter(|i| i.status == ItemStatus::InProgress).collect()
    }
}

impl Default for Workflow {
    fn default() -> Self {
        Self::new()
    }
}
