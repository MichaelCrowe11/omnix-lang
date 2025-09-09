/*!
 * OMNIX Lexer v0.1 MVP
 * Tokenizes distributed consensus language source code
 */

use crate::token::Token;
use crate::error::{Diagnostic, ErrorKind, Span, CompilerResult};
use logos::Logos;

pub struct Lexer<'a> {
    source: &'a str,
    logos_lexer: logos::Lexer<'a, Token>,
    current_line: u32,
    line_start: usize,
}

impl<'a> Lexer<'a> {
    pub fn new(source: &'a str) -> Self {
        Self {
            source,
            logos_lexer: Token::lexer(source),
            current_line: 1,
            line_start: 0,
        }
    }
    
    pub fn tokenize(&mut self) -> CompilerResult<Vec<(Token, Span)>> {
        let mut tokens = Vec::new();
        let mut diagnostics = Vec::new();
        
        while let Some(token_result) = self.logos_lexer.next() {
            let span_range = self.logos_lexer.span();
            let span = self.make_span(span_range.start, span_range.end);
            
            match token_result {
                Ok(token) => {
                    tokens.push((token, span));
                }
                Err(_) => {
                    let text = &self.source[span_range.clone()];
                    if let Some(ch) = text.chars().next() {
                        diagnostics.push(Diagnostic::error(
                            ErrorKind::UnexpectedCharacter(ch),
                            format!("Unexpected character '{}'", ch),
                            span,
                        ));
                    }
                }
            }
            
            // Update line tracking
            self.update_line_tracking(span_range.end);
        }
        
        if diagnostics.is_empty() {
            Ok(tokens)
        } else {
            Err(diagnostics)
        }
    }
    
    fn make_span(&self, start: usize, end: usize) -> Span {
        let column = start - self.line_start;
        Span::new(start, end, self.current_line, column as u32)
    }
    
    fn update_line_tracking(&mut self, pos: usize) {
        let text_slice = &self.source[self.line_start..pos];
        for (i, ch) in text_slice.char_indices() {
            if ch == '\n' {
                self.current_line += 1;
                self.line_start = self.line_start + i + 1;
            }
        }
    }
}

// Convenience function for simple tokenization
pub fn tokenize(source: &str) -> CompilerResult<Vec<(Token, Span)>> {
    let mut lexer = Lexer::new(source);
    lexer.tokenize()
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