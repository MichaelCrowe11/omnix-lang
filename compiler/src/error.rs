use std::fmt;
use serde::{Serialize, Deserialize};

/// Represents a span in source code
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Span {
    pub start: usize,
    pub end: usize,
    pub line: u32,
    pub column: u32,
}

impl Span {
    pub fn new(start: usize, end: usize, line: u32, column: u32) -> Self {
        Self { start, end, line, column }
    }
    
    pub fn unknown() -> Self {
        Self { start: 0, end: 0, line: 0, column: 0 }
    }
}

/// Diagnostic severity levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Severity {
    Error,
    Warning,
    Info,
    Hint,
}

/// Compilation error types
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ErrorKind {
    // Lexer errors
    UnexpectedCharacter(char),
    UnterminatedString,
    InvalidNumber,
    
    // Parser errors
    UnexpectedToken { expected: String, found: String },
    UnexpectedEof,
    InvalidSyntax(String),
    
    // Semantic errors
    UndeclaredVariable(String),
    DuplicateDefinition(String),
    TypeMismatch { expected: String, found: String },
    InvalidConsensusConfig(String),
    
    // Consensus specific errors
    InvalidValidatorCount,
    UnsupportedConsensusAlgorithm(String),
    InvalidTimeout,
    MissingReplicatedAnnotation,
    
    // Network errors
    InvalidNetworkConfig(String),
    InvalidPort,
    UnsupportedDiscoveryMethod(String),
}

/// A diagnostic message with location information
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Diagnostic {
    pub severity: Severity,
    pub kind: ErrorKind,
    pub message: String,
    pub span: Span,
    pub help: Option<String>,
}

impl Diagnostic {
    pub fn error(kind: ErrorKind, message: String, span: Span) -> Self {
        Self {
            severity: Severity::Error,
            kind,
            message,
            span,
            help: None,
        }
    }
    
    pub fn warning(kind: ErrorKind, message: String, span: Span) -> Self {
        Self {
            severity: Severity::Warning,
            kind,
            message,
            span,
            help: None,
        }
    }
    
    pub fn with_help(mut self, help: String) -> Self {
        self.help = Some(help);
        self
    }
}

impl fmt::Display for Diagnostic {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let severity_str = match self.severity {
            Severity::Error => "error",
            Severity::Warning => "warning",
            Severity::Info => "info",
            Severity::Hint => "hint",
        };
        
        write!(f, "{}: {} at line {}, column {}", 
               severity_str, self.message, self.span.line, self.span.column)?;
        
        if let Some(help) = &self.help {
            write!(f, "\n  help: {}", help)?;
        }
        
        Ok(())
    }
}

impl std::error::Error for Diagnostic {}

/// Result type for compilation operations
pub type CompilerResult<T> = Result<T, Vec<Diagnostic>>;

/// Helper for collecting diagnostics during compilation
#[derive(Debug, Default)]
pub struct DiagnosticCollector {
    pub diagnostics: Vec<Diagnostic>,
}

impl DiagnosticCollector {
    pub fn new() -> Self {
        Self {
            diagnostics: Vec::new(),
        }
    }
    
    pub fn error(&mut self, kind: ErrorKind, message: String, span: Span) {
        self.diagnostics.push(Diagnostic::error(kind, message, span));
    }
    
    pub fn warning(&mut self, kind: ErrorKind, message: String, span: Span) {
        self.diagnostics.push(Diagnostic::warning(kind, message, span));
    }
    
    pub fn has_errors(&self) -> bool {
        self.diagnostics.iter().any(|d| d.severity == Severity::Error)
    }
    
    pub fn into_result<T>(self, value: T) -> CompilerResult<T> {
        if self.diagnostics.is_empty() {
            Ok(value)
        } else {
            Err(self.diagnostics)
        }
    }
    
    pub fn diagnostics(&self) -> &[Diagnostic] {
        &self.diagnostics
    }
}