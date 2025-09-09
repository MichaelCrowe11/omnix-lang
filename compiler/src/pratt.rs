/*!
 * Pratt Parser for OMNIX - Correct operator precedence and associativity
 */

use crate::ast::*;
use crate::token::Token;
use crate::error::{Diagnostic, ErrorKind, Span, CompilerResult};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Precedence {
    Lowest = 0,
    Assignment = 1,    // =, <#> (right-associative)
    Consensus = 2,     // <!>, <?> (right-associative)
    LogicalOr = 3,     // ||
    LogicalAnd = 4,    // &&
    Equality = 5,      // ==, !=
    Comparison = 6,    // <, >, <=, >=
    Addition = 7,      // +, -
    Multiplication = 8, // *, /, %
    Unary = 9,         // !, -, +
    Call = 10,         // function(), array[]
    Member = 11,       // .
    Primary = 12,      // literals, identifiers
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Associativity {
    Left,
    Right,
}

pub struct PrattParser {
    precedence_table: HashMap<Token, (Precedence, Associativity)>,
}

impl PrattParser {
    pub fn new() -> Self {
        let mut precedence_table = HashMap::new();
        
        // Assignment operators (right-associative)
        precedence_table.insert(Token::Assign, (Precedence::Assignment, Associativity::Right));
        precedence_table.insert(Token::Commit, (Precedence::Assignment, Associativity::Right)); // <#>
        
        // Consensus operators (right-associative)
        precedence_table.insert(Token::Propose, (Precedence::Consensus, Associativity::Right)); // <!>
        precedence_table.insert(Token::Vote, (Precedence::Consensus, Associativity::Right)); // <?>
        
        // Logical operators
        precedence_table.insert(Token::OrOr, (Precedence::LogicalOr, Associativity::Left));
        precedence_table.insert(Token::AndAnd, (Precedence::LogicalAnd, Associativity::Left));
        
        // Equality operators
        precedence_table.insert(Token::EqualEqual, (Precedence::Equality, Associativity::Left));
        precedence_table.insert(Token::BangEqual, (Precedence::Equality, Associativity::Left));
        
        // Comparison operators
        precedence_table.insert(Token::Less, (Precedence::Comparison, Associativity::Left));
        precedence_table.insert(Token::Greater, (Precedence::Comparison, Associativity::Left));
        precedence_table.insert(Token::LessEqual, (Precedence::Comparison, Associativity::Left));
        precedence_table.insert(Token::GreaterEqual, (Precedence::Comparison, Associativity::Left));
        
        // Arithmetic operators
        precedence_table.insert(Token::Plus, (Precedence::Addition, Associativity::Left));
        precedence_table.insert(Token::Minus, (Precedence::Addition, Associativity::Left));
        precedence_table.insert(Token::Star, (Precedence::Multiplication, Associativity::Left));
        precedence_table.insert(Token::Slash, (Precedence::Multiplication, Associativity::Left));
        precedence_table.insert(Token::Percent, (Precedence::Multiplication, Associativity::Left));
        
        // Call and member access
        precedence_table.insert(Token::LeftParen, (Precedence::Call, Associativity::Left));
        precedence_table.insert(Token::LeftBracket, (Precedence::Call, Associativity::Left));
        precedence_table.insert(Token::Dot, (Precedence::Member, Associativity::Left));
        
        Self { precedence_table }
    }
    
    pub fn get_precedence(&self, token: &Token) -> Precedence {
        self.precedence_table
            .get(token)
            .map(|(prec, _)| *prec)
            .unwrap_or(Precedence::Lowest)
    }
    
    pub fn get_associativity(&self, token: &Token) -> Associativity {
        self.precedence_table
            .get(token)
            .map(|(_, assoc)| *assoc)
            .unwrap_or(Associativity::Left)
    }
    
    pub fn is_right_associative(&self, token: &Token) -> bool {
        self.get_associativity(token) == Associativity::Right
    }
}

/// Extended LValue for rich assignment targets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LValue {
    Identifier(String),
    Member {
        object: Box<LValue>,
        field: String,
        span: Span,
    },
    Index {
        array: Box<LValue>,
        index: Box<Expression>,
        span: Span,
    },
}

impl LValue {
    pub fn to_expression(&self) -> Expression {
        match self {
            LValue::Identifier(name) => Expression::Identifier(name.clone()),
            LValue::Member { object, field, span } => {
                Expression::Member(MemberExpression {
                    object: Box::new(object.to_expression()),
                    field: field.clone(),
                    span: span.clone(),
                })
            }
            LValue::Index { array, index, span } => {
                Expression::Index(IndexExpression {
                    array: Box::new(array.to_expression()),
                    index: index.clone(),
                    span: span.clone(),
                })
            }
        }
    }
    
    pub fn from_expression(expr: &Expression) -> Option<LValue> {
        match expr {
            Expression::Identifier(name) => Some(LValue::Identifier(name.clone())),
            Expression::Member(member) => {
                let object = LValue::from_expression(&member.object)?;
                Some(LValue::Member {
                    object: Box::new(object),
                    field: member.field.clone(),
                    span: member.span.clone(),
                })
            }
            Expression::Index(index) => {
                let array = LValue::from_expression(&index.array)?;
                Some(LValue::Index {
                    array: Box::new(array),
                    index: index.index.clone(),
                    span: index.span.clone(),
                })
            }
            _ => None,
        }
    }
}

/// Span utilities for accurate source tracking
pub struct SpanTracker {
    start: Option<Span>,
}

impl SpanTracker {
    pub fn new() -> Self {
        Self { start: None }
    }
    
    pub fn start(&mut self, span: Span) {
        self.start = Some(span);
    }
    
    pub fn end(&self, end_span: Span) -> Span {
        if let Some(start) = &self.start {
            Span::new(start.start, end_span.end, start.line, start.column)
        } else {
            end_span
        }
    }
    
    pub fn merge(start: &Span, end: &Span) -> Span {
        Span::new(start.start, end.end, start.line, start.column)
    }
}

/// Helper trait for parsers to track spans
pub trait WithSpan {
    fn with_span<T, F>(&mut self, f: F) -> CompilerResult<(T, Span)>
    where
        F: FnOnce(&mut Self) -> CompilerResult<T>;
    
    fn current_span(&self) -> Span;
    fn previous_span(&self) -> Span;
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_precedence_order() {
        let pratt = PrattParser::new();
        
        assert!(pratt.get_precedence(&Token::Star) > pratt.get_precedence(&Token::Plus));
        assert!(pratt.get_precedence(&Token::Plus) > pratt.get_precedence(&Token::EqualEqual));
        assert!(pratt.get_precedence(&Token::AndAnd) > pratt.get_precedence(&Token::OrOr));
        assert!(pratt.get_precedence(&Token::Propose) > pratt.get_precedence(&Token::Assign));
    }
    
    #[test]
    fn test_associativity() {
        let pratt = PrattParser::new();
        
        assert_eq!(pratt.get_associativity(&Token::Plus), Associativity::Left);
        assert_eq!(pratt.get_associativity(&Token::Assign), Associativity::Right);
        assert_eq!(pratt.get_associativity(&Token::Propose), Associativity::Right);
    }
    
    #[test]
    fn test_lvalue_conversion() {
        let ident = Expression::Identifier("x".to_string());
        let lvalue = LValue::from_expression(&ident);
        assert!(matches!(lvalue, Some(LValue::Identifier(name)) if name == "x"));
    }
}