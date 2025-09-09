/*!
 * Simplified Raft consensus for OMNIX MVP
 * Basic Raft implementation with leader election and log replication
 */

use crate::{ConsensusEngine, ProposalId, Vote, Message, NodeId};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc, Mutex};
use tokio::time::{Duration, Instant, sleep, timeout};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NodeState {
    Follower,
    Candidate,
    Leader,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub term: u64,
    pub index: u64,
    pub value: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RaftMessage {
    pub term: u64,
    pub from: NodeId,
    pub message_type: RaftMessageType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RaftMessageType {
    RequestVote {
        candidate_id: NodeId,
        last_log_index: u64,
        last_log_term: u64,
    },
    RequestVoteResponse {
        vote_granted: bool,
    },
    AppendEntries {
        leader_id: NodeId,
        prev_log_index: u64,
        prev_log_term: u64,
        entries: Vec<LogEntry>,
        leader_commit: u64,
    },
    AppendEntriesResponse {
        success: bool,
        match_index: u64,
    },
    Heartbeat,
}

pub struct RaftNode {
    pub node_id: NodeId,
    pub state: Arc<RwLock<NodeState>>,
    pub current_term: Arc<RwLock<u64>>,
    pub voted_for: Arc<RwLock<Option<NodeId>>>,
    pub log: Arc<RwLock<Vec<LogEntry>>>,
    pub commit_index: Arc<RwLock<u64>>,
    pub last_applied: Arc<RwLock<u64>>,
    
    // Leader state
    pub next_index: Arc<RwLock<HashMap<NodeId, u64>>>,
    pub match_index: Arc<RwLock<HashMap<NodeId, u64>>>,
    
    // Network
    pub peers: Arc<RwLock<Vec<NodeId>>>,
    pub message_tx: Arc<Mutex<Option<mpsc::UnboundedSender<RaftMessage>>>>,
    pub message_rx: Arc<Mutex<Option<mpsc::UnboundedReceiver<RaftMessage>>>>,
    
    // Timers
    pub election_timeout: Duration,
    pub heartbeat_interval: Duration,
    pub last_heartbeat: Arc<RwLock<Instant>>,
}

impl RaftNode {
    pub fn new(node_id: NodeId) -> Self {
        let (message_tx, message_rx) = mpsc::unbounded_channel();
        
        Self {
            node_id,
            state: Arc::new(RwLock::new(NodeState::Follower)),
            current_term: Arc::new(RwLock::new(0)),
            voted_for: Arc::new(RwLock::new(None)),
            log: Arc::new(RwLock::new(Vec::new())),
            commit_index: Arc::new(RwLock::new(0)),
            last_applied: Arc::new(RwLock::new(0)),
            next_index: Arc::new(RwLock::new(HashMap::new())),
            match_index: Arc::new(RwLock::new(HashMap::new())),
            peers: Arc::new(RwLock::new(Vec::new())),
            message_tx: Arc::new(Mutex::new(Some(message_tx))),
            message_rx: Arc::new(Mutex::new(Some(message_rx))),
            election_timeout: Duration::from_millis(150 + (rand::random::<u64>() % 150)),
            heartbeat_interval: Duration::from_millis(50),
            last_heartbeat: Arc::new(RwLock::new(Instant::now())),
        }
    }
    
    pub async fn add_peer(&self, peer_id: NodeId) {
        self.peers.write().await.push(peer_id);
    }
    
    pub async fn start_consensus_loop(&self) {
        let self_arc = Arc::new(self);
        
        // Start election timer
        {
            let raft = Arc::clone(&self_arc);
            tokio::spawn(async move {
                raft.election_timer_loop().await;
            });
        }
        
        // Start heartbeat timer (for leaders)
        {
            let raft = Arc::clone(&self_arc);
            tokio::spawn(async move {
                raft.heartbeat_timer_loop().await;
            });
        }
        
        // Start message handler
        {
            let raft = Arc::clone(&self_arc);
            tokio::spawn(async move {
                raft.message_handler_loop().await;
            });
        }
    }
    
    async fn election_timer_loop(&self) {
        loop {
            sleep(self.election_timeout).await;
            
            let last_heartbeat = *self.last_heartbeat.read().await;
            let state = *self.state.read().await;
            
            if state != NodeState::Leader && last_heartbeat.elapsed() >= self.election_timeout {
                self.start_election().await;
            }
        }
    }
    
    async fn heartbeat_timer_loop(&self) {
        loop {
            sleep(self.heartbeat_interval).await;
            
            let state = *self.state.read().await;
            if state == NodeState::Leader {
                self.send_heartbeats().await;
            }
        }
    }
    
    async fn message_handler_loop(&self) {
        let mut rx = self.message_rx.lock().await.take().unwrap();
        
        while let Some(message) = rx.recv().await {
            self.handle_message(message).await;
        }
    }
    
    async fn start_election(&self) {
        {
            let mut state = self.state.write().await;
            *state = NodeState::Candidate;
        }
        
        {
            let mut current_term = self.current_term.write().await;
            *current_term += 1;
        }
        
        {
            let mut voted_for = self.voted_for.write().await;
            *voted_for = Some(self.node_id.clone());
        }
        
        {
            let mut last_heartbeat = self.last_heartbeat.write().await;
            *last_heartbeat = Instant::now();
        }
        
        let current_term = *self.current_term.read().await;
        let log = self.log.read().await;
        let last_log_index = log.len() as u64;
        let last_log_term = log.last().map(|e| e.term).unwrap_or(0);
        
        // Send RequestVote to all peers
        let peers = self.peers.read().await.clone();
        let mut vote_count = 1; // Vote for self
        
        for peer in &peers {
            let request = RaftMessage {
                term: current_term,
                from: self.node_id.clone(),
                message_type: RaftMessageType::RequestVote {
                    candidate_id: self.node_id.clone(),
                    last_log_index,
                    last_log_term,
                },
            };
            
            // TODO: Send message to peer
            // For MVP, we'll simulate responses
        }
        
        // For MVP, assume we become leader if we have majority
        let majority = (peers.len() + 1) / 2 + 1;
        if vote_count >= majority {
            self.become_leader().await;
        }
    }
    
    async fn become_leader(&self) {
        {
            let mut state = self.state.write().await;
            *state = NodeState::Leader;
        }
        
        let log_len = self.log.read().await.len() as u64;
        let peers = self.peers.read().await.clone();
        
        // Initialize leader state
        {
            let mut next_index = self.next_index.write().await;
            let mut match_index = self.match_index.write().await;
            
            for peer in &peers {
                next_index.insert(peer.clone(), log_len + 1);
                match_index.insert(peer.clone(), 0);
            }
        }
        
        // Send initial heartbeats
        self.send_heartbeats().await;
    }
    
    async fn send_heartbeats(&self) {
        let peers = self.peers.read().await.clone();
        let current_term = *self.current_term.read().await;
        let commit_index = *self.commit_index.read().await;
        
        for peer in &peers {
            let heartbeat = RaftMessage {
                term: current_term,
                from: self.node_id.clone(),
                message_type: RaftMessageType::AppendEntries {
                    leader_id: self.node_id.clone(),
                    prev_log_index: 0,
                    prev_log_term: 0,
                    entries: Vec::new(), // Empty for heartbeat
                    leader_commit: commit_index,
                },
            };
            
            // TODO: Send heartbeat to peer
        }
    }
    
    async fn handle_message(&self, message: RaftMessage) {
        let current_term = *self.current_term.read().await;
        
        // If message term is higher, become follower
        if message.term > current_term {
            {
                let mut term = self.current_term.write().await;
                *term = message.term;
            }
            {
                let mut state = self.state.write().await;
                *state = NodeState::Follower;
            }
            {
                let mut voted_for = self.voted_for.write().await;
                *voted_for = None;
            }
        }
        
        match message.message_type {
            RaftMessageType::RequestVote {
                candidate_id,
                last_log_index,
                last_log_term,
            } => {
                self.handle_request_vote(message.term, candidate_id, last_log_index, last_log_term).await;
            }
            RaftMessageType::AppendEntries {
                leader_id,
                prev_log_index,
                prev_log_term,
                entries,
                leader_commit,
            } => {
                self.handle_append_entries(
                    message.term,
                    leader_id,
                    prev_log_index,
                    prev_log_term,
                    entries,
                    leader_commit,
                ).await;
            }
            _ => {
                // Handle other message types
            }
        }
    }
    
    async fn handle_request_vote(
        &self,
        term: u64,
        candidate_id: NodeId,
        last_log_index: u64,
        last_log_term: u64,
    ) {
        let current_term = *self.current_term.read().await;
        let voted_for = self.voted_for.read().await.clone();
        
        let vote_granted = term >= current_term
            && (voted_for.is_none() || voted_for.as_ref() == Some(&candidate_id))
            && self.is_log_up_to_date(last_log_index, last_log_term).await;
        
        if vote_granted {
            let mut voted = self.voted_for.write().await;
            *voted = Some(candidate_id.clone());
            
            let mut last_heartbeat = self.last_heartbeat.write().await;
            *last_heartbeat = Instant::now();
        }
        
        // TODO: Send vote response
    }
    
    async fn handle_append_entries(
        &self,
        term: u64,
        leader_id: NodeId,
        prev_log_index: u64,
        prev_log_term: u64,
        entries: Vec<LogEntry>,
        leader_commit: u64,
    ) {
        let current_term = *self.current_term.read().await;
        
        // Update heartbeat timer
        {
            let mut last_heartbeat = self.last_heartbeat.write().await;
            *last_heartbeat = Instant::now();
        }
        
        // Become follower if not already
        if term >= current_term {
            let mut state = self.state.write().await;
            *state = NodeState::Follower;
        }
        
        // Check if we can append entries
        let log_consistent = self.check_log_consistency(prev_log_index, prev_log_term).await;
        
        if log_consistent {
            // Append new entries
            {
                let mut log = self.log.write().await;
                let start_index = prev_log_index as usize + 1;
                
                // Remove conflicting entries
                if log.len() > start_index {
                    log.truncate(start_index);
                }
                
                // Append new entries
                log.extend(entries);
            }
            
            // Update commit index
            if leader_commit > *self.commit_index.read().await {
                let log_len = self.log.read().await.len() as u64;
                let mut commit_index = self.commit_index.write().await;
                *commit_index = leader_commit.min(log_len);
            }
        }
        
        // TODO: Send append entries response
    }
    
    async fn is_log_up_to_date(&self, last_log_index: u64, last_log_term: u64) -> bool {
        let log = self.log.read().await;
        let our_last_index = log.len() as u64;
        let our_last_term = log.last().map(|e| e.term).unwrap_or(0);
        
        last_log_term > our_last_term || (last_log_term == our_last_term && last_log_index >= our_last_index)
    }
    
    async fn check_log_consistency(&self, prev_log_index: u64, prev_log_term: u64) -> bool {
        let log = self.log.read().await;
        
        if prev_log_index == 0 {
            return true; // No previous entry to check
        }
        
        if prev_log_index > log.len() as u64 {
            return false; // We don't have the previous entry
        }
        
        let prev_entry = &log[prev_log_index as usize - 1];
        prev_entry.term == prev_log_term
    }
    
    pub async fn append_log_entry(&self, value: Vec<u8>) -> u64 {
        let current_term = *self.current_term.read().await;
        let mut log = self.log.write().await;
        let index = log.len() as u64 + 1;
        
        let entry = LogEntry {
            term: current_term,
            index,
            value,
        };
        
        log.push(entry);
        index
    }
}

#[async_trait]
impl ConsensusEngine for RaftNode {
    async fn start(&mut self) -> anyhow::Result<()> {
        self.start_consensus_loop().await;
        Ok(())
    }
    
    async fn propose(&self, value: Vec<u8>) -> anyhow::Result<ProposalId> {
        let state = *self.state.read().await;
        
        if state != NodeState::Leader {
            return Err(anyhow::anyhow!("Not the leader"));
        }
        
        let index = self.append_log_entry(value).await;
        Ok(ProposalId(format!("{}:{}", self.node_id, index)))
    }
    
    async fn vote(&self, proposal_id: ProposalId, vote: Vote) -> anyhow::Result<()> {
        // In Raft, voting is handled internally through RequestVote messages
        // This method is used for external voting on proposals
        Ok(())
    }
    
    async fn on_commit(&self, value: Vec<u8>) -> anyhow::Result<()> {
        // Apply committed value to state machine
        // In MVP, we just log that the value was committed
        println!("Committed value: {} bytes", value.len());
        Ok(())
    }
}