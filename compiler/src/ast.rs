/*!
 * OMNIX Abstract Syntax Tree
 * AST definitions for distributed consensus constructs
 */

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Program {
    pub nodes: Vec<NodeDefinition>,
    pub contracts: Vec<Contract>,
    pub services: Vec<Service>,
    pub pipelines: Vec<Pipeline>,
    pub functions: Vec<Function>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeDefinition {
    pub name: String,
    pub config: NodeConfig,
    pub state: Vec<StateVariable>,
    pub methods: Vec<Method>,
    pub handlers: Vec<EventHandler>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeConfig {
    pub network_port: u16,
    pub discovery: DiscoveryMethod,
    pub consensus: ConsensusAlgorithm,
    pub replication_factor: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DiscoveryMethod {
    MDNS,
    Static(Vec<String>),
    Consul,
    Etcd,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConsensusAlgorithm {
    Raft,
    PBFT,
    Tendermint,
    HotStuff,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateVariable {
    pub name: String,
    pub ty: Type,
    pub replicated: bool,
    pub crdt_type: Option<CRDTType>,
    pub initial_value: Option<Expression>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CRDTType {
    GCounter,
    PNCounter,
    LWWMap,
    ORSet,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Method {
    pub name: String,
    pub visibility: Visibility,
    pub consensus_required: bool,
    pub params: Vec<Parameter>,
    pub return_type: Option<Type>,
    pub body: Block,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Visibility {
    Public,
    Private,
    Internal,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventHandler {
    pub event: EventType,
    pub handler: Block,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EventType {
    PeerDiscovered,
    PeerLost,
    PartitionDetected,
    ConsensusReached,
    ViewChange,
    LeaderElected,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Contract {
    pub name: String,
    pub cross_chain: Vec<String>,
    pub functions: Vec<ContractFunction>,
    pub state: Vec<StateVariable>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContractFunction {
    pub name: String,
    pub params: Vec<Parameter>,
    pub body: Block,
    pub modifiers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    pub name: String,
    pub replicas: u32,
    pub consensus: ConsensusAlgorithm,
    pub zones: Vec<String>,
    pub methods: Vec<ServiceMethod>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceMethod {
    pub name: String,
    pub params: Vec<Parameter>,
    pub return_type: Type,
    pub body: Block,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pipeline {
    pub name: String,
    pub input: DataSource,
    pub stages: Vec<Stage>,
    pub output: DataSink,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stage {
    pub name: String,
    pub workers: WorkerConfig,
    pub process: Block,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkerConfig {
    Fixed(u32),
    AutoScale,
    GPU(u32),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DataSource {
    KafkaStream(String),
    Database(String),
    API(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DataSink {
    Database(String),
    Stream(String),
    File(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Function {
    pub name: String,
    pub params: Vec<Parameter>,
    pub return_type: Option<Type>,
    pub body: Block,
    pub attributes: Vec<Attribute>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parameter {
    pub name: String,
    pub ty: Type,
    pub default: Option<Expression>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Attribute {
    pub name: String,
    pub args: Vec<Expression>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub statements: Vec<Statement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Statement {
    Expression(Expression),
    Let {
        name: String,
        ty: Option<Type>,
        value: Expression,
    },
    Assignment {
        target: Expression,
        value: Expression,
    },
    If {
        condition: Expression,
        then_block: Block,
        else_block: Option<Block>,
    },
    When {
        condition: Expression,
        body: Block,
    },
    For {
        variable: String,
        iterable: Expression,
        body: Block,
    },
    While {
        condition: Expression,
        body: Block,
    },
    Return(Option<Expression>),
    
    // Consensus operations
    Propose {
        value: Expression,
        config: ConsensusConfig,
    },
    Vote {
        proposal: Expression,
        vote: VoteType,
    },
    Commit {
        target: Expression,
        value: Expression,
    },
    Broadcast {
        message: Expression,
    },
    Gossip {
        data: Expression,
        fanout: u32,
    },
    Atomic {
        body: Block,
    },
    Phase {
        name: String,
        body: Block,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsensusConfig {
    pub validators: Option<u32>,
    pub timeout: Option<u64>,
    pub algorithm: Option<ConsensusAlgorithm>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VoteType {
    Accept,
    Reject,
    Abstain,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Expression {
    Literal(Literal),
    Identifier(String),
    Binary {
        left: Box<Expression>,
        op: BinaryOp,
        right: Box<Expression>,
    },
    Unary {
        op: UnaryOp,
        operand: Box<Expression>,
    },
    Call {
        function: Box<Expression>,
        args: Vec<Expression>,
    },
    MemberAccess {
        object: Box<Expression>,
        member: String,
    },
    Index {
        object: Box<Expression>,
        index: Box<Expression>,
    },
    
    // Consensus expressions
    ConsensusOp {
        op: ConsensusOperator,
        left: Box<Expression>,
        right: Option<Box<Expression>>,
    },
    QuorumCheck {
        value: Box<Expression>,
        threshold: f32,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConsensusOperator {
    Propose,    // <!>
    Vote,       // <?>
    Commit,     // <#>
    Broadcast,  // <~>
    Gossip,     // <@>
    Sync,       // <=>
    Partition,  // <|>
    Quorum,     // <*>
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Literal {
    Integer(i64),
    Float(f64),
    String(String),
    Boolean(bool),
    Null,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Type {
    Bool,
    U32,
    U64,
    I32,
    I64,
    F32,
    F64,
    String,
    Vec(Box<Type>),
    Set(Box<Type>),
    Map(Box<Type>, Box<Type>),
    NodeId,
    Proposal,
    Vote,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BinaryOp {
    Add,
    Subtract,
    Multiply,
    Divide,
    Modulo,
    Equal,
    NotEqual,
    Less,
    LessEqual,
    Greater,
    GreaterEqual,
    And,
    Or,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UnaryOp {
    Not,
    Negate,
}