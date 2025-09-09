/*!
 * OMNIX Lexer
 * Tokenizes distributed consensus language source code
 */

use crate::token::Token;
use logos::Logos;
use anyhow::{Result, anyhow};

pub fn tokenize(source: &str) -> Result<Vec<Token>> {
    let mut tokens = Vec::new();
    let mut lexer = Token::lexer(source);
    
    while let Some(token) = lexer.next() {
        match token {
            Ok(t) => tokens.push(t),
            Err(_) => {
                let span = lexer.span();
                let text = &source[span.clone()];
                return Err(anyhow!("Unexpected token '{}' at position {}", text, span.start));
            }
        }
    }
    
    Ok(tokens)
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_consensus_operators() {
        let source = "value <!> consensus <?> vote <#> commit";
        let tokens = tokenize(source).unwrap();
        
        assert!(tokens.contains(&Token::Propose));
        assert!(tokens.contains(&Token::Vote));
        assert!(tokens.contains(&Token::Commit));
    }
    
    #[test]
    fn test_distributed_keywords() {
        let source = "consensus cluster replicated byzantine atomic";
        let tokens = tokenize(source).unwrap();
        
        assert!(tokens.contains(&Token::Consensus));
        assert!(tokens.contains(&Token::Cluster));
        assert!(tokens.contains(&Token::Replicated));
        assert!(tokens.contains(&Token::Byzantine));
        assert!(tokens.contains(&Token::Atomic));
    }
    
    #[test]
    fn test_time_literals() {
        let source = "timeout: 3000ms heartbeat: 5s";
        let tokens = tokenize(source).unwrap();
        
        assert!(tokens.contains(&Token::Milliseconds(3000)));
        assert!(tokens.contains(&Token::Seconds(5)));
    }
}