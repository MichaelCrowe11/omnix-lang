/*!
 * OMNIX Abstract Syntax Tree v0.1 MVP
 * Simplified AST for the MVP implementation
 */

use serde::{Deserialize, Serialize};
use crate::error::Span;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Program {
    pub items: Vec<Item>,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Item {
    Node(NodeDefinition),
    Cluster(ConsensusCluster),
    Function(Function),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeDefinition {
    pub name: String,
    pub annotations: Vec<Annotation>,
    pub items: Vec<NodeItem>,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum NodeItem {
    State(StateVariable),
    Function(Function),
    EventHandler(EventHandler),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsensusCluster {
    pub name: String,
    pub replicas: u32,
    pub consensus: ConsensusAlgorithm,
    pub zones: Option<Vec<String>>,
    pub items: Vec<ClusterItem>,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ClusterItem {
    State(StateVariable),
    Service(Service),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Service {
    pub name: String,
    pub params: Vec<Parameter>,
    pub return_type: Option<Type>,
    pub body: Block,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateVariable {
    pub annotations: Vec<Annotation>,
    pub name: String,
    pub type_: Type,
    pub initial_value: Option<Expression>,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Function {
    pub annotations: Vec<Annotation>,
    pub name: String,
    pub params: Vec<Parameter>,
    pub return_type: Option<Type>,
    pub body: Block,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventHandler {
    pub event_name: String,
    pub params: Vec<Parameter>,
    pub body: Block,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parameter {
    pub name: String,
    pub type_: Type,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Block {
    pub statements: Vec<Statement>,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Statement {
    Let(LetStatement),
    Assignment(Assignment),
    Expression(Expression),
    When(WhenStatement),
    Phase(PhaseStatement),
    Return(Option<Expression>),
    Broadcast(Expression),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LetStatement {
    pub name: String,
    pub value: Expression,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Assignment {
    pub target: String,
    pub op: AssignmentOp,
    pub value: Expression,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AssignmentOp {
    Assign,     // =
    Merge,      // <#>
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhenStatement {
    pub condition: Expression,
    pub body: Block,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PhaseStatement {
    pub name: String,
    pub body: Block,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Expression {
    Literal(Literal),
    Identifier(String),
    Binary(BinaryExpression),
    Call(CallExpression),
    Proposal(ProposalExpression),
    Vote(VoteExpression),
    Array(Vec<Expression>),
    Object(Vec<ObjectField>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinaryExpression {
    pub left: Box<Expression>,
    pub op: BinaryOp,
    pub right: Box<Expression>,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum BinaryOp {
    Add, Sub, Mul, Div,
    Eq, Ne, Lt, Le, Gt, Ge,
    And, Or,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CallExpression {
    pub function: String,
    pub args: Vec<Expression>,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalExpression {
    pub value: Box<Expression>,
    pub config: ConsensusConfig,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoteExpression {
    pub value: Box<Expression>,
    pub config: ConsensusConfig,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsensusConfig {
    pub validators: Option<u32>,
    pub timeout: Option<u64>, // milliseconds
    pub algorithm: Option<ConsensusAlgorithm>,
    pub quorum: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectField {
    pub name: String,
    pub value: Expression,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Literal {
    Integer(i64),
    UInteger(u64),
    Float(f64),
    String(String),
    Boolean(bool),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Type {
    U64,
    I64,
    F64,
    Bool,
    String,
    Bytes,
    Vec(Box<Type>),
    Set(Box<Type>),
    Map(Box<Type>, Box<Type>),
    Option(Box<Type>),
    Result(Box<Type>, Box<Type>),
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConsensusAlgorithm {
    Raft,
    PBFT,
    Tendermint,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Annotation {
    pub name: String,
    pub params: Vec<AnnotationParam>,
    pub span: Span,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnotationParam {
    pub name: String,
    pub value: Expression,
}

// Helper methods for AST construction
impl Program {
    pub fn new(items: Vec<Item>) -> Self {
        Self {
            items,
            span: Span::unknown(),
        }
    }
}

impl Expression {
    pub fn span(&self) -> Span {
        match self {
            Expression::Binary(expr) => expr.span.clone(),
            Expression::Call(expr) => expr.span.clone(),
            Expression::Proposal(expr) => expr.span.clone(),
            Expression::Vote(expr) => expr.span.clone(),
            _ => Span::unknown(),
        }
    }
}

// AST traversal and manipulation helpers
impl Program {
    pub fn find_main_function(&self) -> Option<&Function> {
        self.items.iter().find_map(|item| {
            if let Item::Function(func) = item {
                if func.name == "main" {
                    Some(func)
                } else {
                    None
                }
            } else {
                None
            }
        })
    }
    
    pub fn nodes(&self) -> impl Iterator<Item = &NodeDefinition> {
        self.items.iter().filter_map(|item| {
            if let Item::Node(node) = item {
                Some(node)
            } else {
                None
            }
        })
    }
    
    pub fn clusters(&self) -> impl Iterator<Item = &ConsensusCluster> {
        self.items.iter().filter_map(|item| {
            if let Item::Cluster(cluster) = item {
                Some(cluster)
            } else {
                None
            }
        })
    }
}