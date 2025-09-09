/*!
 * Network layer for OMNIX
 */

use crate::{NetworkLayer, NetworkConfig, DiscoveryMethod, NodeId, Message};
use async_trait::async_trait;
use libp2p::{
    identity,
    PeerId,
    Swarm,
    swarm::SwarmEvent,
    gossipsub::{self, Gossipsub, GossipsubEvent, MessageAuthenticity},
    mdns::{self, Mdns, MdnsEvent},
    NetworkBehaviour,
};
use std::collections::HashSet;
use tokio::sync::mpsc;

pub fn create_layer(config: NetworkConfig) -> anyhow::Result<Box<dyn NetworkLayer>> {
    Ok(Box::new(P2PNetwork::new(config)?))
}

/// P2P network implementation using libp2p
pub struct P2PNetwork {
    config: NetworkConfig,
    swarm: Option<Swarm<OmnixBehaviour>>,
    peers: HashSet<PeerId>,
    tx: mpsc::Sender<NetworkCommand>,
    rx: mpsc::Receiver<NetworkCommand>,
}

#[derive(NetworkBehaviour)]
struct OmnixBehaviour {
    gossipsub: Gossipsub,
    mdns: Mdns,
}

enum NetworkCommand {
    Broadcast(Message),
    SendTo(NodeId, Message),
    Gossip(Vec<u8>, u32),
}

impl P2PNetwork {
    pub fn new(config: NetworkConfig) -> anyhow::Result<Self> {
        let (tx, rx) = mpsc::channel(100);
        
        Ok(Self {
            config,
            swarm: None,
            peers: HashSet::new(),
            tx,
            rx,
        })
    }
    
    fn create_swarm(&mut self) -> anyhow::Result<Swarm<OmnixBehaviour>> {
        // Generate peer identity
        let local_key = identity::Keypair::generate_ed25519();
        let local_peer_id = PeerId::from(local_key.public());
        
        // Create Gossipsub
        let gossipsub_config = gossipsub::GossipsubConfigBuilder::default()
            .build()
            .map_err(|e| anyhow::anyhow!("Failed to build gossipsub config: {}", e))?;
        
        let gossipsub = Gossipsub::new(
            MessageAuthenticity::Signed(local_key.clone()),
            gossipsub_config,
        )?;
        
        // Create mDNS for peer discovery
        let mdns = Mdns::new(mdns::MdnsConfig::default())?;
        
        // Create network behaviour
        let behaviour = OmnixBehaviour { gossipsub, mdns };
        
        // Create swarm
        let transport = libp2p::tcp::TcpConfig::new();
        let swarm = Swarm::new(transport, behaviour, local_peer_id);
        
        Ok(swarm)
    }
}

#[async_trait]
impl NetworkLayer for P2PNetwork {
    async fn start(&mut self) -> anyhow::Result<()> {
        let mut swarm = self.create_swarm()?;
        
        // Listen on specified port
        let addr = format!("/ip4/0.0.0.0/tcp/{}", self.config.port);
        swarm.listen_on(addr.parse()?)?;
        
        self.swarm = Some(swarm);
        
        // Start event loop
        tokio::spawn(async move {
            // Handle swarm events
            // This would be the main network event loop
        });
        
        Ok(())
    }
    
    async fn broadcast(&self, message: Message) -> anyhow::Result<()> {
        self.tx.send(NetworkCommand::Broadcast(message)).await?;
        Ok(())
    }
    
    async fn send_to(&self, node: NodeId, message: Message) -> anyhow::Result<()> {
        self.tx.send(NetworkCommand::SendTo(node, message)).await?;
        Ok(())
    }
    
    async fn gossip(&self, data: Vec<u8>, fanout: u32) -> anyhow::Result<()> {
        self.tx.send(NetworkCommand::Gossip(data, fanout)).await?;
        Ok(())
    }
}