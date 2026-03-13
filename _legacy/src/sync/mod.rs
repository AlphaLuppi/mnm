// MnM Sync Module
//
// The killer feature: Spec Drift Detection
//
// Detects when:
// - PRD says X but code does Y
// - Story has acceptance criteria not covered by tests
// - Architecture doc is outdated vs actual implementation
// - Code comments contradict behavior

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub source: SyncSource,
    pub target: SyncTarget,
    pub status: SyncState,
    pub issues: Vec<SyncIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SyncSource {
    Prd,
    Story,
    Architecture,
    AcceptanceCriteria,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SyncTarget {
    Code,
    Tests,
    Documentation,
    Config,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum SyncState {
    InSync,
    Drifted,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncIssue {
    pub id: String,
    pub severity: IssueSeverity,
    pub source_location: String,
    pub target_location: String,
    pub description: String,
    pub suggested_fix: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum IssueSeverity {
    Critical,  // Spec says one thing, code does opposite
    Warning,   // Uncovered acceptance criteria
    Info,      // Minor inconsistency
}

pub struct SyncEngine {
    pub statuses: Vec<SyncStatus>,
}

impl SyncEngine {
    pub fn new() -> Self {
        Self {
            statuses: Vec::new(),
        }
    }
    
    /// Check if PRD requirements are implemented in code
    pub fn check_prd_vs_code(&self, _prd_path: &str, _code_path: &str) -> SyncStatus {
        // TODO: Use LLM to analyze PRD and compare with code
        SyncStatus {
            source: SyncSource::Prd,
            target: SyncTarget::Code,
            status: SyncState::Unknown,
            issues: Vec::new(),
        }
    }
    
    /// Check if acceptance criteria are covered by tests
    pub fn check_story_vs_tests(&self, _story_path: &str, _test_path: &str) -> SyncStatus {
        // TODO: Parse acceptance criteria and match with test cases
        SyncStatus {
            source: SyncSource::AcceptanceCriteria,
            target: SyncTarget::Tests,
            status: SyncState::Unknown,
            issues: Vec::new(),
        }
    }
    
    /// Check if architecture doc matches implementation
    pub fn check_architecture_vs_code(&self, _arch_path: &str, _src_path: &str) -> SyncStatus {
        // TODO: Compare architectural decisions with actual code structure
        SyncStatus {
            source: SyncSource::Architecture,
            target: SyncTarget::Code,
            status: SyncState::Unknown,
            issues: Vec::new(),
        }
    }
    
    pub fn all_in_sync(&self) -> bool {
        self.statuses.iter().all(|s| s.status == SyncState::InSync)
    }
    
    pub fn critical_issues(&self) -> Vec<&SyncIssue> {
        self.statuses
            .iter()
            .flat_map(|s| &s.issues)
            .filter(|i| i.severity == IssueSeverity::Critical)
            .collect()
    }
}

impl Default for SyncEngine {
    fn default() -> Self {
        Self::new()
    }
}
