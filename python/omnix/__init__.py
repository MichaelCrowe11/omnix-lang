"""
OMNIX Language Support for Python
==================================

This package provides tools and utilities for working with the OMNIX
distributed systems programming language in Python environments.
"""

__version__ = "0.1.0"
__author__ = "OMNIX Team"
__email__ = "team@omnixlang.org"
__license__ = "Apache-2.0"

# Core exports
from .parser import OmnixParser
from .lexer import OmnixLexer
from .compiler import OmnixCompiler

__all__ = [
    "OmnixParser",
    "OmnixLexer", 
    "OmnixCompiler",
    "__version__",
]

def get_version():
    """Return the current version of omnix-lang."""
    return __version__