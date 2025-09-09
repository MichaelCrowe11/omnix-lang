/*!
 * OMNIX Parser
 * Parses distributed consensus language constructs
 */

use crate::ast::*;
use crate::token::Token;
use anyhow::{Result, anyhow};

pub struct Parser {
    tokens: Vec<Token>,
    current: usize,
}

impl Parser {
    pub fn new(tokens: Vec<Token>) -> Self {
        Self {
            tokens,
            current: 0,
        }
    }
    
    pub fn parse_program(&mut self) -> Result<Program> {
        let mut nodes = Vec::new();
        let mut contracts = Vec::new();
        let mut services = Vec::new();
        let mut pipelines = Vec::new();
        let mut functions = Vec::new();
        
        while !self.is_at_end() {
            match self.peek() {
                Some(Token::Node) => nodes.push(self.parse_node()?),
                Some(Token::Contract) => contracts.push(self.parse_contract()?),
                Some(Token::Service) => services.push(self.parse_service()?),
                Some(Token::Pipeline) => pipelines.push(self.parse_pipeline()?),
                Some(Token::Function) => functions.push(self.parse_function()?),
                Some(Token::Consensus) if self.peek_ahead(1) == Some(&Token::Cluster) => {
                    services.push(self.parse_consensus_cluster()?)
                }
                _ => {
                    return Err(anyhow!("Unexpected token: {:?}", self.peek()));
                }
            }
        }
        
        Ok(Program {
            nodes,
            contracts,
            services,
            pipelines,
            functions,
        })
    }
    
    fn parse_node(&mut self) -> Result<NodeDefinition> {
        self.expect(Token::Node)?;
        let name = self.expect_identifier()?;
        
        self.expect(Token::LeftBrace)?;
        
        let mut config = NodeConfig {
            network_port: 8080,
            discovery: DiscoveryMethod::MDNS,
            consensus: ConsensusAlgorithm::Raft,
            replication_factor: 3,
        };
        
        let mut state = Vec::new();
        let mut methods = Vec::new();
        let mut handlers = Vec::new();
        
        while !self.check(&Token::RightBrace) {
            match self.peek() {
                Some(Token::At) => {
                    // Parse attributes/config
                    self.parse_node_config(&mut config)?;
                }
                Some(Token::State) => {
                    state.push(self.parse_state_variable()?);
                }
                Some(Token::Function) => {
                    methods.push(self.parse_method()?);
                }
                Some(Token::On) => {
                    handlers.push(self.parse_event_handler()?);
                }
                _ => {
                    return Err(anyhow!("Unexpected token in node: {:?}", self.peek()));
                }
            }
        }
        
        self.expect(Token::RightBrace)?;
        
        Ok(NodeDefinition {
            name,
            config,
            state,
            methods,
            handlers,
        })
    }
    
    fn parse_consensus_cluster(&mut self) -> Result<Service> {
        self.expect(Token::Consensus)?;
        self.expect(Token::Cluster)?;
        let name = self.expect_identifier()?;
        
        self.expect(Token::LeftBrace)?;
        
        let mut replicas = 3;
        let mut consensus = ConsensusAlgorithm::PBFT;
        let mut zones = Vec::new();
        let mut methods = Vec::new();
        
        while !self.check(&Token::RightBrace) {
            match self.peek() {
                Some(Token::Identifier(id)) if id == "replicas" => {
                    self.advance();
                    self.expect(Token::Colon)?;
                    if let Some(Token::Integer(n)) = self.peek() {
                        replicas = *n as u32;
                        self.advance();
                    }
                }
                Some(Token::Consensus) => {
                    self.advance();
                    self.expect(Token::Colon)?;
                    consensus = self.parse_consensus_algorithm()?;
                }
                Some(Token::Service) => {
                    methods.push(self.parse_service_method()?);
                }
                _ => {
                    self.advance(); // Skip unknown tokens for now
                }
            }
        }
        
        self.expect(Token::RightBrace)?;
        
        Ok(Service {
            name,
            replicas,
            consensus,
            zones,
            methods,
        })
    }
    
    fn parse_contract(&mut self) -> Result<Contract> {
        // Parse @cross_chain attribute if present
        let mut cross_chain = Vec::new();
        if self.check(&Token::At) {
            self.advance();
            // Parse cross_chain annotation
        }
        
        self.expect(Token::Contract)?;
        let name = self.expect_identifier()?;
        
        self.expect(Token::LeftBrace)?;
        
        let mut functions = Vec::new();
        let mut state = Vec::new();
        
        while !self.check(&Token::RightBrace) {
            match self.peek() {
                Some(Token::Function) => {
                    functions.push(self.parse_contract_function()?);
                }
                Some(Token::State) => {
                    state.push(self.parse_state_variable()?);
                }
                _ => {
                    return Err(anyhow!("Unexpected token in contract: {:?}", self.peek()));
                }
            }
        }
        
        self.expect(Token::RightBrace)?;
        
        Ok(Contract {
            name,
            cross_chain,
            functions,
            state,
        })
    }
    
    fn parse_service(&mut self) -> Result<Service> {
        self.expect(Token::Service)?;
        let name = self.expect_identifier()?;
        
        // Default values
        let replicas = 1;
        let consensus = ConsensusAlgorithm::Raft;
        let zones = Vec::new();
        let methods = Vec::new();
        
        // TODO: Parse service body
        
        Ok(Service {
            name,
            replicas,
            consensus,
            zones,
            methods,
        })
    }
    
    fn parse_pipeline(&mut self) -> Result<Pipeline> {
        self.expect(Token::Pipeline)?;
        let name = self.expect_identifier()?;
        
        self.expect(Token::LeftBrace)?;
        
        // Parse input
        let input = DataSource::KafkaStream("default".to_string());
        
        let mut stages = Vec::new();
        
        while self.check(&Token::Stage) {
            stages.push(self.parse_stage()?);
        }
        
        // Parse output
        let output = DataSink::Database("default".to_string());
        
        self.expect(Token::RightBrace)?;
        
        Ok(Pipeline {
            name,
            input,
            stages,
            output,
        })
    }
    
    fn parse_stage(&mut self) -> Result<Stage> {
        self.expect(Token::Stage)?;
        let name = self.expect_identifier()?;
        
        self.expect(Token::LeftBrace)?;
        
        let workers = WorkerConfig::AutoScale;
        let process = self.parse_block()?;
        
        self.expect(Token::RightBrace)?;
        
        Ok(Stage {
            name,
            workers,
            process,
        })
    }
    
    fn parse_function(&mut self) -> Result<Function> {
        let mut attributes = Vec::new();
        
        // Parse attributes
        while self.check(&Token::At) {
            attributes.push(self.parse_attribute()?);
        }
        
        self.expect(Token::Function)?;
        let name = self.expect_identifier()?;
        
        self.expect(Token::LeftParen)?;
        let params = self.parse_parameters()?;
        self.expect(Token::RightParen)?;
        
        let return_type = if self.check(&Token::Arrow) {
            self.advance();
            Some(self.parse_type()?)
        } else {
            None
        };
        
        let body = self.parse_block()?;
        
        Ok(Function {
            name,
            params,
            return_type,
            body,
            attributes,
        })
    }
    
    fn parse_method(&mut self) -> Result<Method> {
        let visibility = Visibility::Public; // Default
        let consensus_required = false; // Default
        
        self.expect(Token::Function)?;
        let name = self.expect_identifier()?;
        
        self.expect(Token::LeftParen)?;
        let params = self.parse_parameters()?;
        self.expect(Token::RightParen)?;
        
        let return_type = if self.check(&Token::Arrow) {
            self.advance();
            Some(self.parse_type()?)
        } else {
            None
        };
        
        let body = self.parse_block()?;
        
        Ok(Method {
            name,
            visibility,
            consensus_required,
            params,
            return_type,
            body,
        })
    }
    
    fn parse_service_method(&mut self) -> Result<ServiceMethod> {
        self.expect(Token::Service)?;
        let name = self.expect_identifier()?;
        
        self.expect(Token::LeftParen)?;
        let params = self.parse_parameters()?;
        self.expect(Token::RightParen)?;
        
        self.expect(Token::Arrow)?;
        let return_type = self.parse_type()?;
        
        let body = self.parse_block()?;
        
        Ok(ServiceMethod {
            name,
            params,
            return_type,
            body,
        })
    }
    
    fn parse_contract_function(&mut self) -> Result<ContractFunction> {
        self.expect(Token::Function)?;
        let name = self.expect_identifier()?;
        
        self.expect(Token::LeftParen)?;
        let params = self.parse_parameters()?;
        self.expect(Token::RightParen)?;
        
        let body = self.parse_block()?;
        let modifiers = Vec::new();
        
        Ok(ContractFunction {
            name,
            params,
            body,
            modifiers,
        })
    }
    
    fn parse_state_variable(&mut self) -> Result<StateVariable> {
        let mut replicated = false;
        let mut crdt_type = None;
        
        // Check for annotations
        if self.check(&Token::At) {
            self.advance();
            if self.check(&Token::Replicated) {
                replicated = true;
                self.advance();
            } else if self.check(&Token::CRDT) {
                self.advance();
                // Parse CRDT type
                crdt_type = Some(CRDTType::GCounter); // Default
            }
        }
        
        self.expect(Token::State)?;
        let name = self.expect_identifier()?;
        self.expect(Token::Colon)?;
        let ty = self.parse_type()?;
        
        let initial_value = if self.check(&Token::Assign) {
            self.advance();
            Some(self.parse_expression()?)
        } else {
            None
        };
        
        self.expect(Token::Semicolon)?;
        
        Ok(StateVariable {
            name,
            ty,
            replicated,
            crdt_type,
            initial_value,
        })
    }
    
    fn parse_event_handler(&mut self) -> Result<EventHandler> {
        self.expect(Token::On)?;
        
        let event = match self.peek() {
            Some(Token::Identifier(name)) => {
                let event_name = name.clone();
                self.advance();
                match event_name.as_str() {
                    "peer_discovered" => EventType::PeerDiscovered,
                    "peer_lost" => EventType::PeerLost,
                    "partition_detected" => EventType::PartitionDetected,
                    "consensus_reached" => EventType::ConsensusReached,
                    "view_change" => EventType::ViewChange,
                    "leader_elected" => EventType::LeaderElected,
                    _ => EventType::Custom(event_name),
                }
            }
            _ => return Err(anyhow!("Expected event name")),
        };
        
        let handler = self.parse_block()?;
        
        Ok(EventHandler {
            event,
            handler,
        })
    }
    
    fn parse_block(&mut self) -> Result<Block> {
        self.expect(Token::LeftBrace)?;
        
        let mut statements = Vec::new();
        
        while !self.check(&Token::RightBrace) && !self.is_at_end() {
            statements.push(self.parse_statement()?);
        }
        
        self.expect(Token::RightBrace)?;
        
        Ok(Block { statements })
    }
    
    fn parse_statement(&mut self) -> Result<Statement> {
        match self.peek() {
            Some(Token::Let) => self.parse_let_statement(),
            Some(Token::If) => self.parse_if_statement(),
            Some(Token::When) => self.parse_when_statement(),
            Some(Token::For) => self.parse_for_statement(),
            Some(Token::While) => self.parse_while_statement(),
            Some(Token::Return) => self.parse_return_statement(),
            Some(Token::Atomic) => self.parse_atomic_statement(),
            Some(Token::Phase) => self.parse_phase_statement(),
            Some(Token::Broadcast) => self.parse_broadcast_statement(),
            Some(Token::GossipKw) => self.parse_gossip_statement(),
            _ => {
                // Try to parse as expression or consensus operation
                let expr = self.parse_expression()?;
                
                // Check for consensus operators
                if let Some(token) = self.peek() {
                    match token {
                        Token::Propose => {
                            self.advance();
                            let config = self.parse_consensus_config()?;
                            self.expect(Token::Semicolon)?;
                            return Ok(Statement::Propose {
                                value: expr,
                                config,
                            });
                        }
                        Token::Vote => {
                            self.advance();
                            let vote = self.parse_vote_type()?;
                            self.expect(Token::Semicolon)?;
                            return Ok(Statement::Vote {
                                proposal: expr,
                                vote,
                            });
                        }
                        Token::Commit => {
                            self.advance();
                            let value = self.parse_expression()?;
                            self.expect(Token::Semicolon)?;
                            return Ok(Statement::Commit {
                                target: expr,
                                value,
                            });
                        }
                        _ => {}
                    }
                }
                
                self.expect(Token::Semicolon)?;
                Ok(Statement::Expression(expr))
            }
        }
    }
    
    fn parse_let_statement(&mut self) -> Result<Statement> {
        self.expect(Token::Let)?;
        let name = self.expect_identifier()?;
        
        let ty = if self.check(&Token::Colon) {
            self.advance();
            Some(self.parse_type()?)
        } else {
            None
        };
        
        self.expect(Token::Assign)?;
        let value = self.parse_expression()?;
        self.expect(Token::Semicolon)?;
        
        Ok(Statement::Let { name, ty, value })
    }
    
    fn parse_if_statement(&mut self) -> Result<Statement> {
        self.expect(Token::If)?;
        let condition = self.parse_expression()?;
        let then_block = self.parse_block()?;
        
        let else_block = if self.check(&Token::Else) {
            self.advance();
            Some(self.parse_block()?)
        } else {
            None
        };
        
        Ok(Statement::If {
            condition,
            then_block,
            else_block,
        })
    }
    
    fn parse_when_statement(&mut self) -> Result<Statement> {
        self.expect(Token::When)?;
        let condition = self.parse_expression()?;
        let body = self.parse_block()?;
        
        Ok(Statement::When { condition, body })
    }
    
    fn parse_for_statement(&mut self) -> Result<Statement> {
        self.expect(Token::For)?;
        let variable = self.expect_identifier()?;
        self.expect_keyword("in")?;
        let iterable = self.parse_expression()?;
        let body = self.parse_block()?;
        
        Ok(Statement::For {
            variable,
            iterable,
            body,
        })
    }
    
    fn parse_while_statement(&mut self) -> Result<Statement> {
        self.expect(Token::While)?;
        let condition = self.parse_expression()?;
        let body = self.parse_block()?;
        
        Ok(Statement::While { condition, body })
    }
    
    fn parse_return_statement(&mut self) -> Result<Statement> {
        self.expect(Token::Return)?;
        
        let value = if !self.check(&Token::Semicolon) {
            Some(self.parse_expression()?)
        } else {
            None
        };
        
        self.expect(Token::Semicolon)?;
        
        Ok(Statement::Return(value))
    }
    
    fn parse_atomic_statement(&mut self) -> Result<Statement> {
        self.expect(Token::Atomic)?;
        let body = self.parse_block()?;
        
        Ok(Statement::Atomic { body })
    }
    
    fn parse_phase_statement(&mut self) -> Result<Statement> {
        self.expect(Token::Phase)?;
        let name = self.expect_identifier()?;
        let body = self.parse_block()?;
        
        Ok(Statement::Phase { name, body })
    }
    
    fn parse_broadcast_statement(&mut self) -> Result<Statement> {
        self.expect(Token::Broadcast)?;
        self.expect(Token::LeftParen)?;
        let message = self.parse_expression()?;
        self.expect(Token::RightParen)?;
        self.expect(Token::Semicolon)?;
        
        Ok(Statement::Broadcast { message })
    }
    
    fn parse_gossip_statement(&mut self) -> Result<Statement> {
        self.expect(Token::GossipKw)?;
        self.expect(Token::LeftParen)?;
        let data = self.parse_expression()?;
        self.expect(Token::Comma)?;
        
        let fanout = if let Some(Token::Integer(n)) = self.peek() {
            let f = *n as u32;
            self.advance();
            f
        } else {
            3 // Default fanout
        };
        
        self.expect(Token::RightParen)?;
        self.expect(Token::Semicolon)?;
        
        Ok(Statement::Gossip { data, fanout })
    }
    
    fn parse_expression(&mut self) -> Result<Expression> {
        self.parse_logical_or()
    }
    
    fn parse_logical_or(&mut self) -> Result<Expression> {
        let mut left = self.parse_logical_and()?;
        
        while self.check(&Token::Or) {
            self.advance();
            let right = self.parse_logical_and()?;
            left = Expression::Binary {
                left: Box::new(left),
                op: BinaryOp::Or,
                right: Box::new(right),
            };
        }
        
        Ok(left)
    }
    
    fn parse_logical_and(&mut self) -> Result<Expression> {
        let mut left = self.parse_equality()?;
        
        while self.check(&Token::And) {
            self.advance();
            let right = self.parse_equality()?;
            left = Expression::Binary {
                left: Box::new(left),
                op: BinaryOp::And,
                right: Box::new(right),
            };
        }
        
        Ok(left)
    }
    
    fn parse_equality(&mut self) -> Result<Expression> {
        let mut left = self.parse_comparison()?;
        
        while let Some(op) = self.match_tokens(&[Token::Equal, Token::NotEqual]) {
            let op = match op {
                Token::Equal => BinaryOp::Equal,
                Token::NotEqual => BinaryOp::NotEqual,
                _ => unreachable!(),
            };
            
            let right = self.parse_comparison()?;
            left = Expression::Binary {
                left: Box::new(left),
                op,
                right: Box::new(right),
            };
        }
        
        Ok(left)
    }
    
    fn parse_comparison(&mut self) -> Result<Expression> {
        let mut left = self.parse_additive()?;
        
        while let Some(op) = self.match_tokens(&[
            Token::LessThan,
            Token::LessEqual,
            Token::GreaterThan,
            Token::GreaterEqual,
        ]) {
            let op = match op {
                Token::LessThan => BinaryOp::Less,
                Token::LessEqual => BinaryOp::LessEqual,
                Token::GreaterThan => BinaryOp::Greater,
                Token::GreaterEqual => BinaryOp::GreaterEqual,
                _ => unreachable!(),
            };
            
            let right = self.parse_additive()?;
            left = Expression::Binary {
                left: Box::new(left),
                op,
                right: Box::new(right),
            };
        }
        
        Ok(left)
    }
    
    fn parse_additive(&mut self) -> Result<Expression> {
        let mut left = self.parse_multiplicative()?;
        
        while let Some(op) = self.match_tokens(&[Token::Plus, Token::Minus]) {
            let op = match op {
                Token::Plus => BinaryOp::Add,
                Token::Minus => BinaryOp::Subtract,
                _ => unreachable!(),
            };
            
            let right = self.parse_multiplicative()?;
            left = Expression::Binary {
                left: Box::new(left),
                op,
                right: Box::new(right),
            };
        }
        
        Ok(left)
    }
    
    fn parse_multiplicative(&mut self) -> Result<Expression> {
        let mut left = self.parse_unary()?;
        
        while let Some(op) = self.match_tokens(&[Token::Star, Token::Slash, Token::Percent]) {
            let op = match op {
                Token::Star => BinaryOp::Multiply,
                Token::Slash => BinaryOp::Divide,
                Token::Percent => BinaryOp::Modulo,
                _ => unreachable!(),
            };
            
            let right = self.parse_unary()?;
            left = Expression::Binary {
                left: Box::new(left),
                op,
                right: Box::new(right),
            };
        }
        
        Ok(left)
    }
    
    fn parse_unary(&mut self) -> Result<Expression> {
        if let Some(op) = self.match_tokens(&[Token::Not, Token::Minus]) {
            let op = match op {
                Token::Not => UnaryOp::Not,
                Token::Minus => UnaryOp::Negate,
                _ => unreachable!(),
            };
            
            let operand = self.parse_unary()?;
            return Ok(Expression::Unary {
                op,
                operand: Box::new(operand),
            });
        }
        
        self.parse_postfix()
    }
    
    fn parse_postfix(&mut self) -> Result<Expression> {
        let mut expr = self.parse_primary()?;
        
        loop {
            match self.peek() {
                Some(Token::Dot) => {
                    self.advance();
                    let member = self.expect_identifier()?;
                    expr = Expression::MemberAccess {
                        object: Box::new(expr),
                        member,
                    };
                }
                Some(Token::LeftParen) => {
                    self.advance();
                    let args = self.parse_arguments()?;
                    self.expect(Token::RightParen)?;
                    expr = Expression::Call {
                        function: Box::new(expr),
                        args,
                    };
                }
                Some(Token::LeftBracket) => {
                    self.advance();
                    let index = self.parse_expression()?;
                    self.expect(Token::RightBracket)?;
                    expr = Expression::Index {
                        object: Box::new(expr),
                        index: Box::new(index),
                    };
                }
                _ => break,
            }
        }
        
        Ok(expr)
    }
    
    fn parse_primary(&mut self) -> Result<Expression> {
        match self.peek() {
            Some(Token::Integer(n)) => {
                let value = *n;
                self.advance();
                Ok(Expression::Literal(Literal::Integer(value)))
            }
            Some(Token::Float(f)) => {
                let value = *f;
                self.advance();
                Ok(Expression::Literal(Literal::Float(value)))
            }
            Some(Token::StringLiteral(s)) => {
                let value = s.clone();
                self.advance();
                Ok(Expression::Literal(Literal::String(value)))
            }
            Some(Token::BoolLiteral(b)) => {
                let value = *b;
                self.advance();
                Ok(Expression::Literal(Literal::Boolean(value)))
            }
            Some(Token::Identifier(name)) => {
                let value = name.clone();
                self.advance();
                Ok(Expression::Identifier(value))
            }
            Some(Token::LeftParen) => {
                self.advance();
                let expr = self.parse_expression()?;
                self.expect(Token::RightParen)?;
                Ok(expr)
            }
            _ => Err(anyhow!("Unexpected token in expression: {:?}", self.peek())),
        }
    }
    
    fn parse_arguments(&mut self) -> Result<Vec<Expression>> {
        let mut args = Vec::new();
        
        if !self.check(&Token::RightParen) {
            loop {
                args.push(self.parse_expression()?);
                
                if !self.check(&Token::Comma) {
                    break;
                }
                self.advance();
            }
        }
        
        Ok(args)
    }
    
    fn parse_parameters(&mut self) -> Result<Vec<Parameter>> {
        let mut params = Vec::new();
        
        if !self.check(&Token::RightParen) {
            loop {
                let name = self.expect_identifier()?;
                self.expect(Token::Colon)?;
                let ty = self.parse_type()?;
                
                let default = if self.check(&Token::Assign) {
                    self.advance();
                    Some(self.parse_expression()?)
                } else {
                    None
                };
                
                params.push(Parameter { name, ty, default });
                
                if !self.check(&Token::Comma) {
                    break;
                }
                self.advance();
            }
        }
        
        Ok(params)
    }
    
    fn parse_type(&mut self) -> Result<Type> {
        match self.peek() {
            Some(Token::Bool) => {
                self.advance();
                Ok(Type::Bool)
            }
            Some(Token::U32) => {
                self.advance();
                Ok(Type::U32)
            }
            Some(Token::U64) => {
                self.advance();
                Ok(Type::U64)
            }
            Some(Token::I32) => {
                self.advance();
                Ok(Type::I32)
            }
            Some(Token::I64) => {
                self.advance();
                Ok(Type::I64)
            }
            Some(Token::F32) => {
                self.advance();
                Ok(Type::F32)
            }
            Some(Token::F64) => {
                self.advance();
                Ok(Type::F64)
            }
            Some(Token::String) => {
                self.advance();
                Ok(Type::String)
            }
            Some(Token::Vec) => {
                self.advance();
                self.expect(Token::LessThan)?;
                let inner = self.parse_type()?;
                self.expect(Token::GreaterThan)?;
                Ok(Type::Vec(Box::new(inner)))
            }
            Some(Token::Set) => {
                self.advance();
                self.expect(Token::LessThan)?;
                let inner = self.parse_type()?;
                self.expect(Token::GreaterThan)?;
                Ok(Type::Set(Box::new(inner)))
            }
            Some(Token::Map) => {
                self.advance();
                self.expect(Token::LessThan)?;
                let key = self.parse_type()?;
                self.expect(Token::Comma)?;
                let value = self.parse_type()?;
                self.expect(Token::GreaterThan)?;
                Ok(Type::Map(Box::new(key), Box::new(value)))
            }
            Some(Token::Identifier(name)) => {
                let type_name = name.clone();
                self.advance();
                Ok(Type::Custom(type_name))
            }
            _ => Err(anyhow!("Expected type, found {:?}", self.peek())),
        }
    }
    
    fn parse_consensus_config(&mut self) -> Result<ConsensusConfig> {
        let mut config = ConsensusConfig {
            validators: None,
            timeout: None,
            algorithm: None,
        };
        
        if self.check(&Token::LeftBrace) {
            self.advance();
            
            while !self.check(&Token::RightBrace) {
                let field = self.expect_identifier()?;
                self.expect(Token::Colon)?;
                
                match field.as_str() {
                    "validators" => {
                        if let Some(Token::Integer(n)) = self.peek() {
                            config.validators = Some(*n as u32);
                            self.advance();
                        }
                    }
                    "timeout" => {
                        if let Some(Token::Milliseconds(ms)) = self.peek() {
                            config.timeout = Some(*ms);
                            self.advance();
                        }
                    }
                    "algorithm" => {
                        config.algorithm = Some(self.parse_consensus_algorithm()?);
                    }
                    _ => {
                        return Err(anyhow!("Unknown consensus config field: {}", field));
                    }
                }
                
                if !self.check(&Token::RightBrace) {
                    self.expect(Token::Comma)?;
                }
            }
            
            self.expect(Token::RightBrace)?;
        }
        
        Ok(config)
    }
    
    fn parse_consensus_algorithm(&mut self) -> Result<ConsensusAlgorithm> {
        match self.peek() {
            Some(Token::Identifier(name)) => {
                let algo_name = name.clone();
                self.advance();
                
                match algo_name.as_str() {
                    "Raft" => Ok(ConsensusAlgorithm::Raft),
                    "PBFT" => Ok(ConsensusAlgorithm::PBFT),
                    "Tendermint" => Ok(ConsensusAlgorithm::Tendermint),
                    "HotStuff" => Ok(ConsensusAlgorithm::HotStuff),
                    _ => Ok(ConsensusAlgorithm::Custom(algo_name)),
                }
            }
            _ => Err(anyhow!("Expected consensus algorithm name")),
        }
    }
    
    fn parse_vote_type(&mut self) -> Result<VoteType> {
        match self.peek() {
            Some(Token::Identifier(name)) => {
                let vote_name = name.clone();
                self.advance();
                
                match vote_name.as_str() {
                    "Accept" => Ok(VoteType::Accept),
                    "Reject" => Ok(VoteType::Reject),
                    "Abstain" => Ok(VoteType::Abstain),
                    _ => Err(anyhow!("Unknown vote type: {}", vote_name)),
                }
            }
            _ => Err(anyhow!("Expected vote type")),
        }
    }
    
    fn parse_attribute(&mut self) -> Result<Attribute> {
        self.expect(Token::At)?;
        let name = self.expect_identifier()?;
        
        let args = if self.check(&Token::LeftParen) {
            self.advance();
            let args = self.parse_arguments()?;
            self.expect(Token::RightParen)?;
            args
        } else {
            Vec::new()
        };
        
        Ok(Attribute { name, args })
    }
    
    fn parse_node_config(&mut self, _config: &mut NodeConfig) -> Result<()> {
        // Parse node configuration attributes
        self.parse_attribute()?;
        Ok(())
    }
    
    // Helper methods
    
    fn peek(&self) -> Option<&Token> {
        self.tokens.get(self.current)
    }
    
    fn peek_ahead(&self, n: usize) -> Option<&Token> {
        self.tokens.get(self.current + n)
    }
    
    fn advance(&mut self) -> Option<&Token> {
        if !self.is_at_end() {
            self.current += 1;
        }
        self.tokens.get(self.current - 1)
    }
    
    fn check(&self, token: &Token) -> bool {
        self.peek() == Some(token)
    }
    
    fn match_tokens(&mut self, tokens: &[Token]) -> Option<Token> {
        for token in tokens {
            if self.check(token) {
                let matched = token.clone();
                self.advance();
                return Some(matched);
            }
        }
        None
    }
    
    fn expect(&mut self, token: Token) -> Result<()> {
        if self.check(&token) {
            self.advance();
            Ok(())
        } else {
            Err(anyhow!("Expected {:?}, found {:?}", token, self.peek()))
        }
    }
    
    fn expect_identifier(&mut self) -> Result<String> {
        match self.peek() {
            Some(Token::Identifier(name)) => {
                let result = name.clone();
                self.advance();
                Ok(result)
            }
            _ => Err(anyhow!("Expected identifier, found {:?}", self.peek())),
        }
    }
    
    fn expect_keyword(&mut self, keyword: &str) -> Result<()> {
        match self.peek() {
            Some(Token::Identifier(name)) if name == keyword => {
                self.advance();
                Ok(())
            }
            _ => Err(anyhow!("Expected keyword '{}', found {:?}", keyword, self.peek())),
        }
    }
    
    fn is_at_end(&self) -> bool {
        self.current >= self.tokens.len()
    }
}

pub fn parse(tokens: Vec<Token>) -> Result<Program> {
    let mut parser = Parser::new(tokens);
    parser.parse_program()
}