/*!
 * Real P2P Network Implementation for OMNIX
 * Uses libp2p for peer discovery and messaging
 */

use crate::{NetworkLayer, NodeId, Message};
use async_trait::async_trait;
use libp2p::{
    core::upgrade,
    gossipsub::{self, Gossipsub, GossipsubEvent, MessageAuthenticity, Topic},
    identity::{self, Keypair},
    mdns::{self, Mdns, MdnsEvent},
    noise,
    swarm::{NetworkBehaviour, SwarmBuilder, SwarmEvent},
    tcp::TcpConfig,
    yamux, Multiaddr, PeerId, Transport,
};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::error::Error;
use std::time::Duration;
use tokio::sync::{mpsc, RwLock};
use tokio::time::sleep;
use tracing::{debug, info, warn, error};

/// P2P Network behaviour combining Gossipsub and mDNS
#[derive(NetworkBehaviour)]
#[behaviour(out_event = "OmnixNetworkEvent")]
pub struct OmnixBehaviour {
    pub gossipsub: Gossipsub,
    pub mdns: Mdns,
}

#[derive(Debug)]
pub enum OmnixNetworkEvent {
    Gossipsub(GossipsubEvent),
    Mdns(MdnsEvent),
}

impl From<GossipsubEvent> for OmnixNetworkEvent {
    fn from(event: GossipsubEvent) -> Self {
        OmnixNetworkEvent::Gossipsub(event)
    }
}

impl From<MdnsEvent> for OmnixNetworkEvent {
    fn from(event: MdnsEvent) -> Self {
        OmnixNetworkEvent::Mdns(event)
    }
}

/// Real P2P network implementation
pub struct P2PNetworkLayer {
    node_id: NodeId,
    swarm: Option<libp2p::Swarm<OmnixBehaviour>>,
    peers: RwLock<HashSet<PeerId>>,
    peer_map: RwLock<HashMap<NodeId, PeerId>>,
    topic: Topic,
    message_tx: mpsc::UnboundedSender<NetworkCommand>,
    message_rx: Option<mpsc::UnboundedReceiver<NetworkCommand>>,
    incoming_tx: mpsc::UnboundedSender<Message>,
    incoming_rx: Option<mpsc::UnboundedReceiver<Message>>,
}

#[derive(Debug)]
enum NetworkCommand {
    Broadcast(Message),
    SendTo(NodeId, Message),
    Gossip(Vec<u8>, u32),
}

impl P2PNetworkLayer {
    pub fn new(node_id: NodeId, port: u16) -> Result<Self, Box<dyn Error>> {
        let (cmd_tx, cmd_rx) = mpsc::unbounded_channel();
        let (incoming_tx, incoming_rx) = mpsc::unbounded_channel();
        
        Ok(Self {
            node_id: node_id.clone(),
            swarm: None,
            peers: RwLock::new(HashSet::new()),
            peer_map: RwLock::new(HashMap::new()),
            topic: Topic::new("omnix-consensus"),
            message_tx: cmd_tx,
            message_rx: Some(cmd_rx),
            incoming_tx,
            incoming_rx: Some(incoming_rx),
        })
    }
    
    pub async fn initialize(&mut self, port: u16) -> Result<(), Box<dyn Error>> {
        // Generate identity
        let local_key = identity::Keypair::generate_ed25519();
        let local_peer_id = PeerId::from(local_key.public());
        info!("Local peer id: {:?}", local_peer_id);
        
        // Create transport
        let transport = TcpConfig::new()
            .upgrade(upgrade::Version::V1)
            .authenticate(noise::NoiseConfig::xx(local_key.clone()).into_authenticated())
            .multiplex(yamux::YamuxConfig::default())
            .boxed();
        
        // Create Gossipsub
        let message_id_fn = |message: &gossipsub::GossipsubMessage| {
            use std::hash::{Hash, Hasher};
            let mut hasher = std::collections::hash_map::DefaultHasher::new();
            message.data.hash(&mut hasher);
            gossipsub::MessageId::from(hasher.finish().to_string())
        };
        
        let gossipsub_config = gossipsub::GossipsubConfigBuilder::default()
            .heartbeat_interval(Duration::from_secs(1))
            .validation_mode(gossipsub::ValidationMode::Strict)
            .message_id_fn(message_id_fn)
            .build()
            .expect("Valid config");
        
        let mut gossipsub = Gossipsub::new(
            MessageAuthenticity::Signed(local_key),
            gossipsub_config,
        ).expect("Correct configuration");
        
        // Subscribe to topic
        gossipsub.subscribe(&self.topic)?;
        
        // Create mDNS for peer discovery
        let mdns = Mdns::new(mdns::MdnsConfig::default())?;
        
        // Create swarm
        let behaviour = OmnixBehaviour { gossipsub, mdns };
        let mut swarm = SwarmBuilder::new(transport, behaviour, local_peer_id)
            .executor(Box::new(|fut| {
                tokio::spawn(fut);
            }))
            .build();
        
        // Listen on all interfaces
        let listen_addr: Multiaddr = format!("/ip4/0.0.0.0/tcp/{}", port).parse()?;
        swarm.listen_on(listen_addr)?;
        
        self.swarm = Some(swarm);
        Ok(())
    }
    
    pub async fn start_event_loop(mut self) {
        let mut swarm = self.swarm.take().expect("Swarm not initialized");
        let mut message_rx = self.message_rx.take().expect("Message receiver missing");
        
        loop {
            tokio::select! {
                // Handle swarm events
                event = swarm.select_next_some() => {
                    self.handle_swarm_event(&mut swarm, event).await;
                }
                
                // Handle outgoing messages
                Some(cmd) = message_rx.recv() => {
                    self.handle_command(&mut swarm, cmd).await;
                }
            }
        }
    }
    
    async fn handle_swarm_event(
        &self,
        swarm: &mut libp2p::Swarm<OmnixBehaviour>,
        event: SwarmEvent<OmnixNetworkEvent, impl Error>,
    ) {
        match event {
            SwarmEvent::NewListenAddr { address, .. } => {
                info!("Listening on {:?}", address);
            }
            SwarmEvent::Behaviour(OmnixNetworkEvent::Mdns(event)) => {
                self.handle_mdns_event(swarm, event).await;
            }
            SwarmEvent::Behaviour(OmnixNetworkEvent::Gossipsub(event)) => {
                self.handle_gossipsub_event(event).await;
            }
            _ => {}
        }
    }
    
    async fn handle_mdns_event(
        &self,
        swarm: &mut libp2p::Swarm<OmnixBehaviour>,
        event: MdnsEvent,
    ) {
        match event {
            MdnsEvent::Discovered(list) => {
                for (peer, addr) in list {
                    info!("Discovered peer {} at {}", peer, addr);
                    swarm.behaviour_mut().gossipsub.add_explicit_peer(&peer);
                    self.peers.write().await.insert(peer);
                }
            }
            MdnsEvent::Expired(list) => {
                for (peer, _) in list {
                    info!("Peer {} expired", peer);
                    swarm.behaviour_mut().gossipsub.remove_explicit_peer(&peer);
                    self.peers.write().await.remove(&peer);
                }
            }
        }
    }
    
    async fn handle_gossipsub_event(&self, event: GossipsubEvent) {
        if let GossipsubEvent::Message {
            propagation_source: _,
            message_id: _,
            message,
        } = event
        {
            if let Ok(msg) = serde_json::from_slice::<Message>(&message.data) {
                debug!("Received message: {:?}", msg);
                let _ = self.incoming_tx.send(msg);
            }
        }
    }
    
    async fn handle_command(
        &self,
        swarm: &mut libp2p::Swarm<OmnixBehaviour>,
        cmd: NetworkCommand,
    ) {
        match cmd {
            NetworkCommand::Broadcast(msg) => {
                let data = serde_json::to_vec(&msg).expect("Serialize message");
                if let Err(e) = swarm.behaviour_mut().gossipsub.publish(self.topic.clone(), data) {
                    warn!("Failed to broadcast message: {:?}", e);
                }
            }
            NetworkCommand::SendTo(node_id, msg) => {
                // For MVP, we broadcast and let the recipient filter
                let data = serde_json::to_vec(&TargetedMessage {
                    target: node_id,
                    message: msg,
                }).expect("Serialize message");
                
                if let Err(e) = swarm.behaviour_mut().gossipsub.publish(self.topic.clone(), data) {
                    warn!("Failed to send targeted message: {:?}", e);
                }
            }
            NetworkCommand::Gossip(data, _fanout) => {
                if let Err(e) = swarm.behaviour_mut().gossipsub.publish(self.topic.clone(), data) {
                    warn!("Failed to gossip data: {:?}", e);
                }
            }
        }
    }
    
    pub fn take_incoming_receiver(&mut self) -> Option<mpsc::UnboundedReceiver<Message>> {
        self.incoming_rx.take()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TargetedMessage {
    target: NodeId,
    message: Message,
}

#[async_trait]
impl NetworkLayer for P2PNetworkLayer {
    async fn start(&mut self) -> anyhow::Result<()> {
        // Already started in initialize
        Ok(())
    }
    
    async fn broadcast(&self, message: Message) -> anyhow::Result<()> {
        self.message_tx.send(NetworkCommand::Broadcast(message))
            .map_err(|e| anyhow::anyhow!("Failed to queue broadcast: {}", e))
    }
    
    async fn send_to(&self, node: NodeId, message: Message) -> anyhow::Result<()> {
        self.message_tx.send(NetworkCommand::SendTo(node, message))
            .map_err(|e| anyhow::anyhow!("Failed to queue send: {}", e))
    }
    
    async fn gossip(&self, data: Vec<u8>, fanout: u32) -> anyhow::Result<()> {
        self.message_tx.send(NetworkCommand::Gossip(data, fanout))
            .map_err(|e| anyhow::anyhow!("Failed to queue gossip: {}", e))
    }
}

/// Create a real P2P network layer
pub fn create_p2p_network(node_id: NodeId, port: u16) -> anyhow::Result<P2PNetworkLayer> {
    P2PNetworkLayer::new(node_id, port)
        .map_err(|e| anyhow::anyhow!("Failed to create P2P network: {}", e))
}