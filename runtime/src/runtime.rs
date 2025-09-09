/*!
 * OMNIX Runtime Executor MVP
 * Executes parsed OMNIX programs
 */

use crate::{Runtime, RuntimeConfig, ConsensusConfig, NetworkConfig, StateConfig, ConsensusAlgorithm, DiscoveryMethod, ConsistencyLevel, NodeId};
use omnix_compiler::ast::*;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// MVP runtime executor for OMNIX programs
pub struct Executor {
    runtime: Runtime,
    node_id: NodeId,
    state_vars: Arc<RwLock<HashMap<String, RuntimeValue>>>,
}

#[derive(Debug, Clone)]
pub enum RuntimeValue {
    Integer(i64),
    UInteger(u64),
    Float(f64),
    String(String),
    Boolean(bool),
    Bytes(Vec<u8>),
}

impl Executor {
    pub async fn new(node_id: NodeId, config: RuntimeConfig) -> anyhow::Result<Self> {
        let runtime = Runtime::new(node_id.clone(), config).await?;
        
        Ok(Self {
            runtime,
            node_id,
            state_vars: Arc::new(RwLock::new(HashMap::new())),
        })
    }
    
    pub async fn execute(&mut self, program: Program) -> anyhow::Result<()> {
        // Start the runtime
        self.runtime.start().await?;
        
        // Execute each top-level item
        for item in program.items {
            match item {
                Item::Node(node) => {
                    self.execute_node(node).await?;
                }
                Item::Cluster(cluster) => {
                    self.execute_cluster(cluster).await?;
                }
                Item::Function(func) => {
                    if func.name == "main" {
                        self.execute_function(func).await?;
                    }
                }
            }
        }
        
        Ok(())
    }
    
    async fn execute_node(&mut self, node: NodeDefinition) -> anyhow::Result<()> {
        println!("Executing node: {}", node.name);
        
        // Initialize state variables
        for item in &node.items {
            if let NodeItem::State(state_var) = item {
                self.initialize_state_var(state_var).await?;
            }
        }
        
        // Execute functions and event handlers
        for item in &node.items {
            match item {
                NodeItem::Function(func) => {
                    // Functions are available for calling, don't execute immediately
                    println!("Registered function: {}", func.name);
                }
                NodeItem::EventHandler(handler) => {
                    println!("Registered event handler: {}", handler.event_name);
                }
                NodeItem::State(_) => {
                    // Already handled above
                }
            }
        }
        
        Ok(())
    }
    
    async fn execute_cluster(&mut self, cluster: ConsensusCluster) -> anyhow::Result<()> {
        println!("Executing consensus cluster: {}", cluster.name);
        println!("Replicas: {}, Consensus: {:?}", cluster.replicas, cluster.consensus);
        
        // Initialize cluster state
        for item in &cluster.items {
            match item {
                ClusterItem::State(state_var) => {
                    self.initialize_state_var(state_var).await?;
                }
                ClusterItem::Service(service) => {
                    println!("Registered service: {}", service.name);
                }
            }
        }
        
        Ok(())
    }
    
    async fn execute_function(&mut self, func: Function) -> anyhow::Result<()> {
        println!("Executing function: {}", func.name);
        
        // Execute function body
        self.execute_block(&func.body).await?;
        
        Ok(())
    }
    
    async fn initialize_state_var(&mut self, state_var: &StateVariable) -> anyhow::Result<()> {
        let value = if let Some(initial_expr) = &state_var.initial_value {
            self.evaluate_expression(initial_expr).await?
        } else {
            // Default values based on type
            match state_var.type_ {
                Type::U64 => RuntimeValue::UInteger(0),
                Type::I64 => RuntimeValue::Integer(0),
                Type::F64 => RuntimeValue::Float(0.0),
                Type::Bool => RuntimeValue::Boolean(false),
                Type::String => RuntimeValue::String(String::new()),
                Type::Bytes => RuntimeValue::Bytes(Vec::new()),
                _ => RuntimeValue::Integer(0), // Default fallback
            }
        };
        
        let mut state_vars = self.state_vars.write().await;
        state_vars.insert(state_var.name.clone(), value);
        
        println!("Initialized state variable: {} = {:?}", state_var.name, state_vars.get(&state_var.name));
        
        Ok(())
    }
    
    async fn execute_block(&mut self, block: &Block) -> anyhow::Result<()> {
        for statement in &block.statements {
            self.execute_statement(statement).await?;
        }
        Ok(())
    }
    
    async fn execute_statement(&mut self, statement: &Statement) -> anyhow::Result<()> {
        match statement {
            Statement::Let(let_stmt) => {
                let value = self.evaluate_expression(&let_stmt.value).await?;
                let mut state_vars = self.state_vars.write().await;
                state_vars.insert(let_stmt.name.clone(), value);
                println!("Let binding: {} = {:?}", let_stmt.name, state_vars.get(&let_stmt.name));
            }
            Statement::Assignment(assignment) => {
                let value = self.evaluate_expression(&assignment.value).await?;
                match assignment.op {
                    AssignmentOp::Assign => {
                        let mut state_vars = self.state_vars.write().await;
                        state_vars.insert(assignment.target.clone(), value);
                        println!("Assignment: {} = {:?}", assignment.target, state_vars.get(&assignment.target));
                    }
                    AssignmentOp::Merge => {
                        // For MVP, merge is the same as assign
                        let mut state_vars = self.state_vars.write().await;
                        state_vars.insert(assignment.target.clone(), value);
                        println!("Merge: {} <#> {:?}", assignment.target, state_vars.get(&assignment.target));
                    }
                }
            }
            Statement::Expression(expr) => {
                let _result = self.evaluate_expression(expr).await?;
                // Expression statements don't store their result
            }
            Statement::When(when_stmt) => {
                let condition_result = self.evaluate_expression(&when_stmt.condition).await?;
                if let RuntimeValue::Boolean(true) = condition_result {
                    self.execute_block(&when_stmt.body).await?;
                }
            }
            Statement::Return(expr_opt) => {
                if let Some(expr) = expr_opt {
                    let value = self.evaluate_expression(expr).await?;
                    println!("Return: {:?}", value);
                } else {
                    println!("Return (void)");
                }
            }
            Statement::Broadcast(expr) => {
                let value = self.evaluate_expression(expr).await?;
                println!("Broadcast: {:?}", value);
                // TODO: Actually broadcast the message
            }
            Statement::Phase(_phase) => {
                println!("Phase execution not implemented in MVP");
            }
        }
        Ok(())
    }
    
    async fn evaluate_expression(&mut self, expr: &Expression) -> anyhow::Result<RuntimeValue> {
        match expr {
            Expression::Literal(literal) => {
                Ok(match literal {
                    Literal::Integer(n) => RuntimeValue::Integer(*n),
                    Literal::UInteger(n) => RuntimeValue::UInteger(*n),
                    Literal::Float(f) => RuntimeValue::Float(*f),
                    Literal::String(s) => RuntimeValue::String(s.clone()),
                    Literal::Boolean(b) => RuntimeValue::Boolean(*b),
                })
            }
            Expression::Identifier(name) => {
                let state_vars = self.state_vars.read().await;
                state_vars.get(name)
                    .cloned()
                    .ok_or_else(|| anyhow::anyhow!("Undefined variable: {}", name))
            }
            Expression::Binary(bin_expr) => {
                let left = self.evaluate_expression(&bin_expr.left).await?;
                let right = self.evaluate_expression(&bin_expr.right).await?;
                self.evaluate_binary_op(&bin_expr.op, left, right)
            }
            Expression::Call(call_expr) => {
                println!("Function call: {}()", call_expr.function);
                // For MVP, just return a default value
                Ok(RuntimeValue::Boolean(true))
            }
            Expression::Proposal(proposal) => {
                let value = self.evaluate_expression(&proposal.value).await?;
                println!("Consensus proposal: {:?} with config {:?}", value, proposal.config);
                
                // For MVP, simulate consensus by just accepting the proposal
                // In a real implementation, this would go through the consensus protocol
                let value_bytes = self.serialize_value(&value)?;
                let proposal_id = self.runtime.propose(value_bytes).await?;
                println!("Proposal accepted: {:?}", proposal_id);
                
                Ok(RuntimeValue::Boolean(true)) // Simulate accepted result
            }
            Expression::Vote(_vote_expr) => {
                println!("Vote expression not implemented in MVP");
                Ok(RuntimeValue::Boolean(true))
            }
            Expression::Array(_) => {
                println!("Array expressions not implemented in MVP");
                Ok(RuntimeValue::Integer(0))
            }
            Expression::Object(_) => {
                println!("Object expressions not implemented in MVP");
                Ok(RuntimeValue::Integer(0))
            }
        }
    }
    
    fn evaluate_binary_op(&self, op: &BinaryOp, left: RuntimeValue, right: RuntimeValue) -> anyhow::Result<RuntimeValue> {
        match (left, right) {
            (RuntimeValue::Integer(a), RuntimeValue::Integer(b)) => {
                Ok(match op {
                    BinaryOp::Add => RuntimeValue::Integer(a + b),
                    BinaryOp::Sub => RuntimeValue::Integer(a - b),
                    BinaryOp::Mul => RuntimeValue::Integer(a * b),
                    BinaryOp::Div => RuntimeValue::Integer(a / b),
                    BinaryOp::Eq => RuntimeValue::Boolean(a == b),
                    BinaryOp::Ne => RuntimeValue::Boolean(a != b),
                    BinaryOp::Lt => RuntimeValue::Boolean(a < b),
                    BinaryOp::Le => RuntimeValue::Boolean(a <= b),
                    BinaryOp::Gt => RuntimeValue::Boolean(a > b),
                    BinaryOp::Ge => RuntimeValue::Boolean(a >= b),
                    _ => return Err(anyhow::anyhow!("Invalid binary operation for integers")),
                })
            }
            (RuntimeValue::UInteger(a), RuntimeValue::UInteger(b)) => {
                Ok(match op {
                    BinaryOp::Add => RuntimeValue::UInteger(a + b),
                    BinaryOp::Sub => RuntimeValue::UInteger(a.saturating_sub(b)),
                    BinaryOp::Mul => RuntimeValue::UInteger(a * b),
                    BinaryOp::Div => RuntimeValue::UInteger(a / b),
                    BinaryOp::Eq => RuntimeValue::Boolean(a == b),
                    BinaryOp::Ne => RuntimeValue::Boolean(a != b),
                    BinaryOp::Lt => RuntimeValue::Boolean(a < b),
                    BinaryOp::Le => RuntimeValue::Boolean(a <= b),
                    BinaryOp::Gt => RuntimeValue::Boolean(a > b),
                    BinaryOp::Ge => RuntimeValue::Boolean(a >= b),
                    _ => return Err(anyhow::anyhow!("Invalid binary operation for unsigned integers")),
                })
            }
            (RuntimeValue::Boolean(a), RuntimeValue::Boolean(b)) => {
                Ok(match op {
                    BinaryOp::And => RuntimeValue::Boolean(a && b),
                    BinaryOp::Or => RuntimeValue::Boolean(a || b),
                    BinaryOp::Eq => RuntimeValue::Boolean(a == b),
                    BinaryOp::Ne => RuntimeValue::Boolean(a != b),
                    _ => return Err(anyhow::anyhow!("Invalid binary operation for booleans")),
                })
            }
            _ => Err(anyhow::anyhow!("Type mismatch in binary operation")),
        }
    }
    
    fn serialize_value(&self, value: &RuntimeValue) -> anyhow::Result<Vec<u8>> {
        match value {
            RuntimeValue::Integer(n) => Ok(n.to_be_bytes().to_vec()),
            RuntimeValue::UInteger(n) => Ok(n.to_be_bytes().to_vec()),
            RuntimeValue::Float(f) => Ok(f.to_be_bytes().to_vec()),
            RuntimeValue::String(s) => Ok(s.as_bytes().to_vec()),
            RuntimeValue::Boolean(b) => Ok(vec![if *b { 1 } else { 0 }]),
            RuntimeValue::Bytes(bytes) => Ok(bytes.clone()),
        }
    }
}

/// Create a default runtime configuration for MVP
pub fn create_mvp_config(port: u16) -> RuntimeConfig {
    RuntimeConfig {
        consensus: ConsensusConfig {
            algorithm: ConsensusAlgorithm::Raft,
            timeout_ms: 2000,
            max_faulty: 1,
        },
        network: NetworkConfig {
            port,
            discovery: DiscoveryMethod::MDNS,
        },
        state: StateConfig {
            replication_factor: 3,
            consistency_level: ConsistencyLevel::Strong,
        },
    }
}