/*!
 * Parser tests for OMNIX compiler
 */

use omnix_compiler::lexer::tokenize;
use omnix_compiler::parser::parse;
use omnix_compiler::ast::*;

#[test]
fn test_parse_simple_node() {
    let source = r#"
@network(port: 8080, discovery: mDNS)
node CounterNode {
    @replicated
    state counter: u64 = 0;
    
    function increment() {
        let proposal = counter + 1;
        counter <#> proposal;
    }
}
"#;

    let tokens = tokenize(source).expect("Tokenization should succeed");
    let program = parse(tokens).expect("Parsing should succeed");
    
    assert_eq!(program.items.len(), 1);
    match &program.items[0] {
        Item::Node(node) => {
            assert_eq!(node.name, "CounterNode");
            assert_eq!(node.annotations.len(), 1);
            assert_eq!(node.annotations[0].name, "network");
            assert_eq!(node.items.len(), 2); // state + function
        }
        _ => panic!("Expected node definition")
    }
}

#[test]
fn test_parse_consensus_operator() {
    let source = r#"
function test() {
    let result = value <!> {
        validators: 3,
        timeout: 2000,
        algorithm: Raft
    };
}
"#;

    let tokens = tokenize(source).expect("Tokenization should succeed");
    let program = parse(tokens).expect("Parsing should succeed");
    
    assert_eq!(program.items.len(), 1);
    match &program.items[0] {
        Item::Function(func) => {
            assert_eq!(func.name, "test");
            // Check for proposal expression in the function body
            if let Statement::Let(let_stmt) = &func.body.statements[0] {
                match &let_stmt.value {
                    Expression::Proposal(proposal) => {
                        assert!(proposal.config.validators.is_some());
                        assert_eq!(proposal.config.validators.unwrap(), 3);
                        assert_eq!(proposal.config.timeout.unwrap(), 2000);
                        assert!(matches!(proposal.config.algorithm.as_ref().unwrap(), ConsensusAlgorithm::Raft));
                    }
                    _ => panic!("Expected proposal expression")
                }
            } else {
                panic!("Expected let statement");
            }
        }
        _ => panic!("Expected function definition")
    }
}

#[test]
fn test_parse_consensus_cluster() {
    let source = r#"
consensus cluster TestCluster {
    replicas: 5
    consensus: PBFT
    
    @replicated
    state data: u64 = 0;
}
"#;

    let tokens = tokenize(source).expect("Tokenization should succeed");
    let program = parse(tokens).expect("Parsing should succeed");
    
    assert_eq!(program.items.len(), 1);
    match &program.items[0] {
        Item::Cluster(cluster) => {
            assert_eq!(cluster.name, "TestCluster");
            assert_eq!(cluster.replicas, 5);
            assert!(matches!(cluster.consensus, ConsensusAlgorithm::PBFT));
            assert_eq!(cluster.items.len(), 1);
        }
        _ => panic!("Expected cluster definition")
    }
}

#[test]
fn test_parse_error_recovery() {
    let source = r#"
node BadNode {
    invalid syntax here
    function good() {
        return true;
    }
}
"#;

    let tokens = tokenize(source).expect("Tokenization should succeed");
    let result = parse(tokens);
    
    // Should have errors but still parse the good parts
    assert!(result.is_err());
    let errors = result.unwrap_err();
    assert!(!errors.is_empty());
    
    // Error should contain information about the syntax error
    assert!(errors.iter().any(|e| e.message.contains("Expected")));
}

#[test]
fn test_parse_when_statement() {
    let source = r#"
function test() {
    when result.accepted() {
        counter <#> result.value;
        broadcast(Update(counter));
    }
}
"#;

    let tokens = tokenize(source).expect("Tokenization should succeed");
    let program = parse(tokens).expect("Parsing should succeed");
    
    match &program.items[0] {
        Item::Function(func) => {
            match &func.body.statements[0] {
                Statement::When(when_stmt) => {
                    assert_eq!(when_stmt.body.statements.len(), 2);
                }
                _ => panic!("Expected when statement")
            }
        }
        _ => panic!("Expected function definition")
    }
}

#[test]
fn test_parse_annotations() {
    let source = r#"
@byzantine(f: 3, n: 10)
@network(port: 9090, discovery: mDNS)
node TestNode {
    @replicated
    @persistent
    state value: u64 = 42;
}
"#;

    let tokens = tokenize(source).expect("Tokenization should succeed");
    let program = parse(tokens).expect("Parsing should succeed");
    
    match &program.items[0] {
        Item::Node(node) => {
            assert_eq!(node.annotations.len(), 2);
            assert_eq!(node.annotations[0].name, "byzantine");
            assert_eq!(node.annotations[1].name, "network");
            
            // Check state annotations
            match &node.items[0] {
                NodeItem::State(state) => {
                    assert_eq!(state.annotations.len(), 2);
                    assert_eq!(state.annotations[0].name, "replicated");
                    assert_eq!(state.annotations[1].name, "persistent");
                }
                _ => panic!("Expected state variable")
            }
        }
        _ => panic!("Expected node definition")
    }
}