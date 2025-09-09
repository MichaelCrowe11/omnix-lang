/*!
 * OMNIX Runtime
 * Distributed consensus runtime system
 */

pub mod consensus;
pub mod network;
pub mod state;
pub mod crdt;

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

/// Node ID type
pub type NodeId = String;

/// The main OMNIX runtime
pub struct Runtime {
    node_id: NodeId,
    consensus: Arc<RwLock<dyn ConsensusEngine>>,
    network: Arc<RwLock<dyn NetworkLayer>>,
    state: Arc<RwLock<StateManager>>,
}

impl Runtime {
    pub async fn new(node_id: NodeId, config: RuntimeConfig) -> anyhow::Result<Self> {
        let consensus = Arc::new(RwLock::new(
            consensus::create_engine(config.consensus)?
        ));
        
        let network = Arc::new(RwLock::new(
            network::create_layer(config.network)?
        ));
        
        let state = Arc::new(RwLock::new(
            StateManager::new(config.state)?
        ));
        
        Ok(Self {
            node_id,
            consensus,
            network,
            state,
        })
    }
    
    pub async fn start(&self) -> anyhow::Result<()> {
        // Start network layer
        self.network.write().await.start().await?;
        
        // Start consensus engine
        self.consensus.write().await.start().await?;
        
        Ok(())
    }
    
    pub async fn propose(&self, value: Vec<u8>) -> anyhow::Result<ProposalId> {
        self.consensus.read().await.propose(value).await
    }
    
    pub async fn vote(&self, proposal_id: ProposalId, vote: Vote) -> anyhow::Result<()> {
        self.consensus.read().await.vote(proposal_id, vote).await
    }
    
    pub async fn commit(&self, value: Vec<u8>) -> anyhow::Result<()> {
        self.state.write().await.commit(value).await
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeConfig {
    pub consensus: ConsensusConfig,
    pub network: NetworkConfig,
    pub state: StateConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsensusConfig {
    pub algorithm: ConsensusAlgorithm,
    pub timeout_ms: u64,
    pub max_faulty: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConsensusAlgorithm {
    Raft,
    PBFT,
    Tendermint,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfig {
    pub port: u16,
    pub discovery: DiscoveryMethod,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DiscoveryMethod {
    MDNS,
    Static(Vec<String>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateConfig {
    pub replication_factor: u32,
    pub consistency_level: ConsistencyLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConsistencyLevel {
    Strong,
    Eventual,
    Causal,
}

/// Consensus engine trait
#[async_trait]
pub trait ConsensusEngine: Send + Sync {
    async fn start(&mut self) -> anyhow::Result<()>;
    async fn propose(&self, value: Vec<u8>) -> anyhow::Result<ProposalId>;
    async fn vote(&self, proposal_id: ProposalId, vote: Vote) -> anyhow::Result<()>;
    async fn on_commit(&self, value: Vec<u8>) -> anyhow::Result<()>;
}

/// Network layer trait
#[async_trait]
pub trait NetworkLayer: Send + Sync {
    async fn start(&mut self) -> anyhow::Result<()>;
    async fn broadcast(&self, message: Message) -> anyhow::Result<()>;
    async fn send_to(&self, node: NodeId, message: Message) -> anyhow::Result<()>;
    async fn gossip(&self, data: Vec<u8>, fanout: u32) -> anyhow::Result<()>;
}

/// State manager
pub struct StateManager {
    store: sled::Db,
    replicas: Vec<NodeId>,
}

impl StateManager {
    pub fn new(config: StateConfig) -> anyhow::Result<Self> {
        let store = sled::open("omnix_state")?;
        
        Ok(Self {
            store,
            replicas: Vec::new(),
        })
    }
    
    pub async fn commit(&mut self, value: Vec<u8>) -> anyhow::Result<()> {
        // Store value locally
        let key = format!("value_{}", uuid::Uuid::new_v4());
        self.store.insert(key, value)?;
        
        // TODO: Replicate to other nodes
        
        Ok(())
    }
    
    pub async fn get(&self, key: &str) -> anyhow::Result<Option<Vec<u8>>> {
        Ok(self.store.get(key)?.map(|v| v.to_vec()))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Vote {
    Accept,
    Reject,
    Abstain,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Message {
    Propose { id: ProposalId, value: Vec<u8> },
    Vote { id: ProposalId, vote: Vote },
    Commit { value: Vec<u8> },
    Gossip { data: Vec<u8> },
    Heartbeat,
}

// Re-export UUID for convenience
pub use uuid;