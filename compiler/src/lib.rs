/*!
 * OMNIX Compiler v0.1 MVP
 * Distributed consensus language compiler
 */

pub mod lexer;
pub mod token;
pub mod parser;
pub mod ast;
pub mod error;
pub mod pratt;

use anyhow::Result;

pub struct Compiler {
    // Compiler state
}

impl Compiler {
    pub fn new() -> Self {
        Self {}
    }
    
    pub fn compile(&self, source: &str) -> Result<Vec<u8>> {
        let tokens = lexer::tokenize(source)?;
        let ast = parser::parse(tokens)?;
        // TODO: Generate distributed runtime code
        Ok(vec![])
    }
}