"""
OMNIX Language Compiler Interface
==================================

Python interface to the OMNIX compiler.
"""

import subprocess
import os
from typing import Optional

class OmnixCompiler:
    """Interface to the OMNIX compiler."""
    
    def __init__(self, compiler_path: str = "omnix"):
        """
        Initialize the compiler interface.
        
        Args:
            compiler_path: Path to the OMNIX compiler executable
        """
        self.compiler_path = compiler_path
    
    def compile(self, source_file: str, output: Optional[str] = None):
        """
        Compile an OMNIX source file.
        
        Args:
            source_file: Path to .omx source file
            output: Optional output file path
            
        Returns:
            Compilation result
        """
        cmd = [self.compiler_path, "compile", source_file]
        if output:
            cmd.extend(["-o", output])
        
        try:
            result = subprocess.run(cmd, capture_output=True, text=True)
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr
            }
        except FileNotFoundError:
            return {
                "success": False,
                "stdout": "",
                "stderr": f"OMNIX compiler not found at: {self.compiler_path}"
            }