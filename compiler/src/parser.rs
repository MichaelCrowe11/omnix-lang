/*!
 * OMNIX Parser v0.1 MVP
 * Recursive descent parser for OMNIX language
 */

use crate::ast::*;
use crate::token::Token;
use crate::error::{Diagnostic, ErrorKind, Span, CompilerResult, DiagnosticCollector};

pub struct Parser {
    tokens: Vec<(Token, Span)>,
    current: usize,
    diagnostics: DiagnosticCollector,
}

impl Parser {
    pub fn new(tokens: Vec<(Token, Span)>) -> Self {
        Self {
            tokens,
            current: 0,
            diagnostics: DiagnosticCollector::new(),
        }
    }
    
    pub fn parse(&mut self) -> CompilerResult<Program> {
        let mut items = Vec::new();
        
        while !self.is_at_end() {
            match self.parse_item() {
                Ok(item) => items.push(item),
                Err(err) => {
                    for diagnostic in err {
                        self.diagnostics.diagnostics.push(diagnostic);
                    }
                    self.synchronize();
                }
            }
        }
        
        if self.diagnostics.has_errors() {
            Err(self.diagnostics.diagnostics.clone())
        } else {
            Ok(Program::new(items))
        }
    }
    
    fn parse_item(&mut self) -> CompilerResult<Item> {
        let annotations = self.parse_annotations()?;
        
        match self.peek_token() {
            Some(Token::Node) => {
                self.advance();
                Ok(Item::Node(self.parse_node(annotations)?))
            }
            Some(Token::Consensus) => {
                self.advance();
                if self.match_token(&Token::Cluster) {
                    Ok(Item::Cluster(self.parse_cluster()?))
                } else {
                    Err(vec![self.error("Expected 'cluster' after 'consensus'")])
                }
            }
            Some(Token::Function) => {
                self.advance();
                Ok(Item::Function(self.parse_function(annotations)?))
            }
            _ => Err(vec![self.error("Expected node, consensus cluster, or function")])
        }
    }
    
    fn parse_annotations(&mut self) -> CompilerResult<Vec<Annotation>> {
        let mut annotations = Vec::new();
        
        while self.match_token(&Token::At) {
            let name = self.expect_identifier()?;
            self.expect_token(&Token::LeftParen, "Expected '(' after annotation name")?;
            
            let mut params = Vec::new();
            if !self.check(&Token::RightParen) {
                loop {
                    let param_name = self.expect_identifier()?;
                    self.expect_token(&Token::Colon, "Expected ':' after parameter name")?;
                    let value = self.parse_expression()?;
                    params.push(AnnotationParam { name: param_name, value });
                    
                    if !self.match_token(&Token::Comma) {
                        break;
                    }
                }
            }
            
            self.expect_token(&Token::RightParen, "Expected ')' after annotation parameters")?;
            
            annotations.push(Annotation {
                name,
                params,
                span: self.previous_span(),
            });
        }
        
        Ok(annotations)
    }
    
    fn parse_node(&mut self, annotations: Vec<Annotation>) -> CompilerResult<NodeDefinition> {
        let name = self.expect_identifier()?;
        self.expect_token(&Token::LeftBrace, "Expected '{' after node name")?;
        
        let mut items = Vec::new();
        
        while !self.check(&Token::RightBrace) && !self.is_at_end() {
            let item_annotations = self.parse_annotations()?;
            
            match self.peek_token() {
                Some(Token::State) => {
                    self.advance();
                    items.push(NodeItem::State(self.parse_state(item_annotations)?));
                }
                Some(Token::Function) => {
                    self.advance();
                    items.push(NodeItem::Function(self.parse_function(item_annotations)?));
                }
                Some(Token::On) => {
                    self.advance();
                    items.push(NodeItem::EventHandler(self.parse_event_handler()?));
                }
                _ => return Err(vec![self.error("Expected state, function, or event handler")])
            }
        }
        
        self.expect_token(&Token::RightBrace, "Expected '}' after node body")?;
        
        Ok(NodeDefinition {
            name,
            annotations,
            items,
            span: self.previous_span(),
        })
    }
    
    fn parse_cluster(&mut self) -> CompilerResult<ConsensusCluster> {
        let name = self.expect_identifier()?;
        self.expect_token(&Token::LeftBrace, "Expected '{' after cluster name")?;
        
        let mut replicas = 3; // default
        let mut consensus = ConsensusAlgorithm::Raft; // default
        let mut zones = None;
        let mut items = Vec::new();
        
        while !self.check(&Token::RightBrace) && !self.is_at_end() {
            match self.peek_token() {
                Some(Token::Replicas) => {
                    self.advance();
                    self.expect_token(&Token::Colon, "Expected ':' after 'replicas'")?;
                    replicas = self.expect_number()? as u32;
                }
                Some(Token::Consensus) => {
                    self.advance();
                    self.expect_token(&Token::Colon, "Expected ':' after 'consensus'")?;
                    consensus = self.parse_consensus_algorithm()?;
                }
                Some(Token::State) => {
                    self.advance();
                    let annotations = self.parse_annotations()?;
                    items.push(ClusterItem::State(self.parse_state(annotations)?));
                }
                Some(Token::Service) => {
                    self.advance();
                    items.push(ClusterItem::Service(self.parse_service()?));
                }
                _ => {
                    self.advance(); // skip unknown tokens
                }
            }
        }
        
        self.expect_token(&Token::RightBrace, "Expected '}' after cluster body")?;
        
        Ok(ConsensusCluster {
            name,
            replicas,
            consensus,
            zones,
            items,
            span: self.previous_span(),
        })
    }
    
    fn parse_state(&mut self, annotations: Vec<Annotation>) -> CompilerResult<StateVariable> {
        let name = self.expect_identifier()?;
        self.expect_token(&Token::Colon, "Expected ':' after state variable name")?;
        let type_ = self.parse_type()?;
        
        let initial_value = if self.match_token(&Token::Assign) {
            Some(self.parse_expression()?)
        } else {
            None
        };
        
        self.expect_token(&Token::Semicolon, "Expected ';' after state variable")?;
        
        Ok(StateVariable {
            annotations,
            name,
            type_,
            initial_value,
            span: self.previous_span(),
        })
    }
    
    fn parse_function(&mut self, annotations: Vec<Annotation>) -> CompilerResult<Function> {
        let name = self.expect_identifier()?;
        self.expect_token(&Token::LeftParen, "Expected '(' after function name")?;
        
        let params = self.parse_parameters()?;
        self.expect_token(&Token::RightParen, "Expected ')' after parameters")?;
        
        let return_type = if self.match_token(&Token::Arrow) {
            Some(self.parse_type()?)
        } else {
            None
        };
        
        let body = self.parse_block()?;
        
        Ok(Function {
            annotations,
            name,
            params,
            return_type,
            body,
            span: self.previous_span(),
        })
    }
    
    fn parse_service(&mut self) -> CompilerResult<Service> {
        let name = self.expect_identifier()?;
        self.expect_token(&Token::LeftParen, "Expected '(' after service name")?;
        
        let params = self.parse_parameters()?;
        self.expect_token(&Token::RightParen, "Expected ')' after parameters")?;
        
        let return_type = if self.match_token(&Token::Arrow) {
            Some(self.parse_type()?)
        } else {
            None
        };
        
        let body = self.parse_block()?;
        
        Ok(Service {
            name,
            params,
            return_type,
            body,
            span: self.previous_span(),
        })
    }
    
    fn parse_event_handler(&mut self) -> CompilerResult<EventHandler> {
        let event_name = self.expect_identifier()?;
        self.expect_token(&Token::LeftParen, "Expected '(' after event name")?;
        
        let params = self.parse_parameters()?;
        self.expect_token(&Token::RightParen, "Expected ')' after parameters")?;
        
        let body = self.parse_block()?;
        
        Ok(EventHandler {
            event_name,
            params,
            body,
            span: self.previous_span(),
        })
    }
    
    fn parse_parameters(&mut self) -> CompilerResult<Vec<Parameter>> {
        let mut params = Vec::new();
        
        if !self.check(&Token::RightParen) {
            loop {
                let name = self.expect_identifier()?;
                self.expect_token(&Token::Colon, "Expected ':' after parameter name")?;
                let type_ = self.parse_type()?;
                
                params.push(Parameter {
                    name,
                    type_,
                    span: self.previous_span(),
                });
                
                if !self.match_token(&Token::Comma) {
                    break;
                }
            }
        }
        
        Ok(params)
    }
    
    fn parse_block(&mut self) -> CompilerResult<Block> {
        self.expect_token(&Token::LeftBrace, "Expected '{'")?;
        
        let mut statements = Vec::new();
        
        while !self.check(&Token::RightBrace) && !self.is_at_end() {
            statements.push(self.parse_statement()?);
        }
        
        self.expect_token(&Token::RightBrace, "Expected '}'")?;
        
        Ok(Block {
            statements,
            span: self.previous_span(),
        })
    }
    
    fn parse_statement(&mut self) -> CompilerResult<Statement> {
        match self.peek_token() {
            Some(Token::Let) => {
                self.advance();
                let name = self.expect_identifier()?;
                self.expect_token(&Token::Assign, "Expected '=' after let binding")?;
                let value = self.parse_expression()?;
                self.expect_token(&Token::Semicolon, "Expected ';' after let statement")?;
                
                Ok(Statement::Let(LetStatement {
                    name,
                    value,
                    span: self.previous_span(),
                }))
            }
            Some(Token::When) => {
                self.advance();
                let condition = self.parse_expression()?;
                let body = self.parse_block()?;
                
                Ok(Statement::When(WhenStatement {
                    condition,
                    body,
                    span: self.previous_span(),
                }))
            }
            Some(Token::Return) => {
                self.advance();
                let value = if self.check(&Token::Semicolon) {
                    None
                } else {
                    Some(self.parse_expression()?)
                };
                self.expect_token(&Token::Semicolon, "Expected ';' after return")?;
                
                Ok(Statement::Return(value))
            }
            Some(Token::Broadcast) => {
                self.advance();
                self.expect_token(&Token::LeftParen, "Expected '(' after broadcast")?;
                let expr = self.parse_expression()?;
                self.expect_token(&Token::RightParen, "Expected ')' after broadcast expression")?;
                self.expect_token(&Token::Semicolon, "Expected ';' after broadcast")?;
                
                Ok(Statement::Broadcast(expr))
            }
            _ => {
                let expr = self.parse_expression()?;
                
                // Check for assignment
                if self.match_token(&Token::Assign) || self.match_token(&Token::Commit) {
                    let op = if self.previous_token() == Some(&Token::Assign) {
                        AssignmentOp::Assign
                    } else {
                        AssignmentOp::Merge
                    };
                    
                    if let Expression::Identifier(target) = expr {
                        let value = self.parse_expression()?;
                        self.expect_token(&Token::Semicolon, "Expected ';' after assignment")?;
                        
                        Ok(Statement::Assignment(Assignment {
                            target,
                            op,
                            value,
                            span: self.previous_span(),
                        }))
                    } else {
                        Err(vec![self.error("Invalid assignment target")])
                    }
                } else {
                    self.expect_token(&Token::Semicolon, "Expected ';' after expression")?;
                    Ok(Statement::Expression(expr))
                }
            }
        }
    }
    
    fn parse_expression(&mut self) -> CompilerResult<Expression> {
        self.parse_binary()
    }
    
    fn parse_binary(&mut self) -> CompilerResult<Expression> {
        let mut expr = self.parse_primary()?;
        
        while let Some(op) = self.match_binary_op() {
            let right = self.parse_primary()?;
            expr = Expression::Binary(BinaryExpression {
                left: Box::new(expr),
                op,
                right: Box::new(right),
                span: self.previous_span(),
            });
        }
        
        // Check for consensus operators
        if self.match_token(&Token::Propose) {
            let config = self.parse_consensus_config()?;
            expr = Expression::Proposal(ProposalExpression {
                value: Box::new(expr),
                config,
                span: self.previous_span(),
            });
        }
        
        Ok(expr)
    }
    
    fn parse_primary(&mut self) -> CompilerResult<Expression> {
        match self.peek_token() {
            Some(Token::Integer(n)) => {
                let value = *n;
                self.advance();
                Ok(Expression::Literal(Literal::Integer(value)))
            }
            Some(Token::String(s)) => {
                let value = s.clone();
                self.advance();
                Ok(Expression::Literal(Literal::String(value)))
            }
            Some(Token::True) => {
                self.advance();
                Ok(Expression::Literal(Literal::Boolean(true)))
            }
            Some(Token::False) => {
                self.advance();
                Ok(Expression::Literal(Literal::Boolean(false)))
            }
            Some(Token::Identifier(name)) => {
                let name = name.clone();
                self.advance();
                
                // Check for function call
                if self.match_token(&Token::LeftParen) {
                    let mut args = Vec::new();
                    
                    if !self.check(&Token::RightParen) {
                        loop {
                            args.push(self.parse_expression()?);
                            if !self.match_token(&Token::Comma) {
                                break;
                            }
                        }
                    }
                    
                    self.expect_token(&Token::RightParen, "Expected ')' after arguments")?;
                    
                    Ok(Expression::Call(CallExpression {
                        function: name,
                        args,
                        span: self.previous_span(),
                    }))
                } else {
                    Ok(Expression::Identifier(name))
                }
            }
            Some(Token::LeftParen) => {
                self.advance();
                let expr = self.parse_expression()?;
                self.expect_token(&Token::RightParen, "Expected ')' after expression")?;
                Ok(expr)
            }
            _ => Err(vec![self.error("Expected expression")])
        }
    }
    
    fn parse_consensus_config(&mut self) -> CompilerResult<ConsensusConfig> {
        self.expect_token(&Token::LeftBrace, "Expected '{' after consensus operator")?;
        
        let mut config = ConsensusConfig {
            validators: None,
            timeout: None,
            algorithm: None,
            quorum: None,
        };
        
        while !self.check(&Token::RightBrace) && !self.is_at_end() {
            let key = self.expect_identifier()?;
            self.expect_token(&Token::Colon, "Expected ':' after config key")?;
            
            match key.as_str() {
                "validators" => {
                    config.validators = Some(self.expect_number()? as u32);
                }
                "timeout" => {
                    config.timeout = Some(self.expect_number()? as u64);
                }
                "algorithm" => {
                    config.algorithm = Some(self.parse_consensus_algorithm()?);
                }
                "quorum" => {
                    config.quorum = Some(self.expect_number()? as u32);
                }
                _ => {
                    // Skip unknown config options
                    self.parse_expression()?;
                }
            }
            
            if !self.match_token(&Token::Comma) {
                break;
            }
        }
        
        self.expect_token(&Token::RightBrace, "Expected '}' after consensus config")?;
        Ok(config)
    }
    
    fn parse_consensus_algorithm(&mut self) -> CompilerResult<ConsensusAlgorithm> {
        match self.expect_identifier()?.as_str() {
            "Raft" => Ok(ConsensusAlgorithm::Raft),
            "PBFT" => Ok(ConsensusAlgorithm::PBFT),
            "Tendermint" => Ok(ConsensusAlgorithm::Tendermint),
            name => Err(vec![Diagnostic::error(
                ErrorKind::UnsupportedConsensusAlgorithm(name.to_string()),
                format!("Unsupported consensus algorithm: {}", name),
                self.previous_span(),
            )])
        }
    }
    
    fn parse_type(&mut self) -> CompilerResult<Type> {
        match self.expect_identifier()?.as_str() {
            "u64" => Ok(Type::U64),
            "i64" => Ok(Type::I64),
            "f64" => Ok(Type::F64),
            "bool" => Ok(Type::Bool),
            "String" => Ok(Type::String),
            "Bytes" => Ok(Type::Bytes),
            name => Ok(Type::Custom(name.to_string())),
        }
    }
    
    // Helper methods
    fn match_binary_op(&mut self) -> Option<BinaryOp> {
        match self.peek_token() {
            Some(Token::Plus) => { self.advance(); Some(BinaryOp::Add) }
            Some(Token::Minus) => { self.advance(); Some(BinaryOp::Sub) }
            Some(Token::Star) => { self.advance(); Some(BinaryOp::Mul) }
            Some(Token::Slash) => { self.advance(); Some(BinaryOp::Div) }
            Some(Token::EqualEqual) => { self.advance(); Some(BinaryOp::Eq) }
            Some(Token::BangEqual) => { self.advance(); Some(BinaryOp::Ne) }
            Some(Token::Greater) => { self.advance(); Some(BinaryOp::Gt) }
            Some(Token::GreaterEqual) => { self.advance(); Some(BinaryOp::Ge) }
            Some(Token::Less) => { self.advance(); Some(BinaryOp::Lt) }
            Some(Token::LessEqual) => { self.advance(); Some(BinaryOp::Le) }
            _ => None
        }
    }
    
    fn match_token(&mut self, token: &Token) -> bool {
        if self.check(token) {
            self.advance();
            true
        } else {
            false
        }
    }
    
    fn check(&self, token: &Token) -> bool {
        std::mem::discriminant(self.peek_token().unwrap_or(&Token::Eof)) == std::mem::discriminant(token)
    }
    
    fn advance(&mut self) -> Option<&Token> {
        if !self.is_at_end() {
            self.current += 1;
        }
        self.previous_token()
    }
    
    fn is_at_end(&self) -> bool {
        self.current >= self.tokens.len()
    }
    
    fn peek_token(&self) -> Option<&Token> {
        self.tokens.get(self.current).map(|(token, _)| token)
    }
    
    fn previous_token(&self) -> Option<&Token> {
        if self.current > 0 {
            self.tokens.get(self.current - 1).map(|(token, _)| token)
        } else {
            None
        }
    }
    
    fn previous_span(&self) -> Span {
        if self.current > 0 {
            self.tokens.get(self.current - 1).map(|(_, span)| span.clone()).unwrap_or(Span::unknown())
        } else {
            Span::unknown()
        }
    }
    
    fn expect_token(&mut self, expected: &Token, message: &str) -> CompilerResult<()> {
        if self.check(expected) {
            self.advance();
            Ok(())
        } else {
            Err(vec![self.error(message)])
        }
    }
    
    fn expect_identifier(&mut self) -> CompilerResult<String> {
        if let Some(Token::Identifier(name)) = self.peek_token() {
            let name = name.clone();
            self.advance();
            Ok(name)
        } else {
            Err(vec![self.error("Expected identifier")])
        }
    }
    
    fn expect_number(&mut self) -> CompilerResult<i64> {
        if let Some(Token::Integer(n)) = self.peek_token() {
            let value = *n;
            self.advance();
            Ok(value)
        } else {
            Err(vec![self.error("Expected number")])
        }
    }
    
    fn error(&self, message: &str) -> Diagnostic {
        let span = if self.current < self.tokens.len() {
            self.tokens[self.current].1.clone()
        } else {
            Span::unknown()
        };
        
        Diagnostic::error(
            ErrorKind::InvalidSyntax(message.to_string()),
            message.to_string(),
            span,
        )
    }
    
    fn synchronize(&mut self) {
        self.advance();
        
        while !self.is_at_end() {
            if let Some(token) = self.previous_token() {
                if matches!(token, Token::Semicolon) {
                    return;
                }
            }
            
            match self.peek_token() {
                Some(Token::Node) | Some(Token::Consensus) | Some(Token::Function) |
                Some(Token::State) | Some(Token::Return) | Some(Token::Let) => return,
                _ => { self.advance(); }
            }
        }
    }
}

// Convenience function
pub fn parse(tokens: Vec<(Token, Span)>) -> CompilerResult<Program> {
    let mut parser = Parser::new(tokens);
    parser.parse()
}