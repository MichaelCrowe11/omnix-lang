/*!
 * OMNIX Token Definitions
 * Tokens for distributed consensus operations
 */

use logos::Logos;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Logos)]
pub enum Token {
    // Consensus Operators
    #[token("<!>")]
    Propose,        // Propose value to network
    
    #[token("<?>")]
    Vote,           // Vote on proposal
    
    #[token("<#>")]
    Commit,         // Commit consensus value
    
    #[token("<~>")]
    Broadcast,      // Broadcast to all nodes
    
    #[token("<@>")]
    Gossip,         // Gossip protocol
    
    #[token("<=>")]
    Sync,           // Synchronize state
    
    #[token("<|>")]
    Partition,      // Handle partition
    
    #[token("<*>")]
    Quorum,         // Quorum operation
    
    // Distributed Keywords
    #[token("consensus")]
    Consensus,
    
    #[token("replicated")]
    Replicated,
    
    #[token("distributed")]
    Distributed,
    
    #[token("node")]
    Node,
    
    #[token("cluster")]
    Cluster,
    
    #[token("byzantine")]
    Byzantine,
    
    #[token("atomic")]
    Atomic,
    
    #[token("transaction")]
    Transaction,
    
    #[token("phase")]
    Phase,
    
    #[token("view")]
    View,
    
    #[token("leader")]
    Leader,
    
    #[token("follower")]
    Follower,
    
    #[token("candidate")]
    Candidate,
    
    #[token("gossip")]
    GossipKw,
    
    #[token("broadcast")]
    BroadcastKw,
    
    #[token("network")]
    Network,
    
    #[token("peer")]
    Peer,
    
    #[token("quorum")]
    QuorumKw,
    
    #[token("majority")]
    Majority,
    
    #[token("crdt")]
    CRDT,
    
    // Standard Keywords
    #[token("function")]
    Function,
    
    #[token("async")]
    Async,
    
    #[token("await")]
    Await,
    
    #[token("let")]
    Let,
    
    #[token("const")]
    Const,
    
    #[token("state")]
    State,
    
    #[token("if")]
    If,
    
    #[token("else")]
    Else,
    
    #[token("when")]
    When,
    
    #[token("for")]
    For,
    
    #[token("while")]
    While,
    
    #[token("return")]
    Return,
    
    #[token("on")]
    On,
    
    #[token("emit")]
    Emit,
    
    #[token("contract")]
    Contract,
    
    #[token("service")]
    Service,
    
    #[token("pipeline")]
    Pipeline,
    
    #[token("stage")]
    Stage,
    
    // Types
    #[token("bool")]
    Bool,
    
    #[token("u32")]
    U32,
    
    #[token("u64")]
    U64,
    
    #[token("i32")]
    I32,
    
    #[token("i64")]
    I64,
    
    #[token("f32")]
    F32,
    
    #[token("f64")]
    F64,
    
    #[token("string")]
    String,
    
    #[token("vec")]
    Vec,
    
    #[token("set")]
    Set,
    
    #[token("map")]
    Map,
    
    // Symbols
    #[token("(")]
    LeftParen,
    
    #[token(")")]
    RightParen,
    
    #[token("{")]
    LeftBrace,
    
    #[token("}")]
    RightBrace,
    
    #[token("[")]
    LeftBracket,
    
    #[token("]")]
    RightBracket,
    
    #[token("<")]
    LessThan,
    
    #[token(">")]
    GreaterThan,
    
    #[token("<=")]
    LessEqual,
    
    #[token(">=")]
    GreaterEqual,
    
    #[token("==")]
    Equal,
    
    #[token("!=")]
    NotEqual,
    
    #[token("=")]
    Assign,
    
    #[token("+=")]
    AddAssign,
    
    #[token("-=")]
    SubAssign,
    
    #[token("+")]
    Plus,
    
    #[token("-")]
    Minus,
    
    #[token("*")]
    Star,
    
    #[token("/")]
    Slash,
    
    #[token("%")]
    Percent,
    
    #[token("&&")]
    And,
    
    #[token("||")]
    Or,
    
    #[token("!")]
    Not,
    
    #[token(".")]
    Dot,
    
    #[token(",")]
    Comma,
    
    #[token(":")]
    Colon,
    
    #[token("::")]
    DoubleColon,
    
    #[token(";")]
    Semicolon,
    
    #[token("->")]
    Arrow,
    
    #[token("=>")]
    FatArrow,
    
    #[token("@")]
    At,
    
    #[token("#")]
    Hash,
    
    #[token("|")]
    Pipe,
    
    // Literals
    #[regex(r"[a-zA-Z_][a-zA-Z0-9_]*", |lex| lex.slice().to_string())]
    Identifier(String),
    
    #[regex(r"\d+", |lex| lex.slice().parse())]
    Integer(i64),
    
    #[regex(r"\d+\.\d+", |lex| lex.slice().parse())]
    Float(f64),
    
    #[regex(r#""([^"\\]|\\.)*""#, |lex| lex.slice()[1..lex.slice().len()-1].to_string())]
    StringLiteral(String),
    
    #[regex(r"true|false", |lex| lex.slice() == "true")]
    BoolLiteral(bool),
    
    // Time literals
    #[regex(r"\d+ms", |lex| lex.slice()[..lex.slice().len()-2].parse())]
    Milliseconds(u64),
    
    #[regex(r"\d+s", |lex| lex.slice()[..lex.slice().len()-1].parse())]
    Seconds(u64),
    
    // Comments and whitespace
    #[regex(r"//[^\n]*", logos::skip)]
    #[regex(r"/\*([^*]|\*[^/])*\*/", logos::skip)]
    #[regex(r"[ \t\n\r]+", logos::skip)]
    #[error]
    Error,
}

impl Token {
    pub fn is_consensus_operator(&self) -> bool {
        matches!(self, 
            Token::Propose | Token::Vote | Token::Commit | 
            Token::Broadcast | Token::Gossip | Token::Sync | 
            Token::Partition | Token::Quorum
        )
    }
    
    pub fn is_distributed_keyword(&self) -> bool {
        matches!(self,
            Token::Consensus | Token::Replicated | Token::Distributed |
            Token::Node | Token::Cluster | Token::Byzantine |
            Token::Atomic | Token::Transaction | Token::Phase |
            Token::View | Token::Leader | Token::Follower |
            Token::Candidate | Token::Network | Token::Peer |
            Token::CRDT
        )
    }
}