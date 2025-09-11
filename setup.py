"""
OMNIX Language Support Package for Python
==========================================

This package provides OMNIX language support tools and utilities for Python developers.
"""

from setuptools import setup, find_packages
import os

# Read the README file
with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

# Read requirements if they exist
requirements = []
if os.path.exists("requirements.txt"):
    with open("requirements.txt", "r", encoding="utf-8") as fh:
        requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="omnix-lang",
    version="0.1.0",
    author="OMNIX Team",
    author_email="team@omnixlang.org",
    description="Language support and tools for OMNIX - The Distributed Systems Programming Language",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/omnix-lang/omnix",
    project_urls={
        "Bug Tracker": "https://github.com/omnix-lang/omnix/issues",
        "Documentation": "https://docs.omnixlang.org",
        "Source Code": "https://github.com/omnix-lang/omnix",
        "Homepage": "https://omnixlang.org",
        "Discord": "https://discord.gg/omnixlang",
    },
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Software Development :: Compilers",
        "Topic :: System :: Distributed Computing",
        "License :: OSI Approved :: Apache Software License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Operating System :: OS Independent",
    ],
    packages=find_packages(where="python"),
    package_dir={"": "python"},
    package_data={
        "omnix": [
            "grammars/*.json",
            "snippets/*.json",
            "syntaxes/*.json",
            "templates/*.omx",
        ]
    },
    include_package_data=True,
    python_requires=">=3.8",
    install_requires=requirements,
    extras_require={
        "dev": [
            "pytest>=7.0",
            "black>=22.0",
            "flake8>=5.0",
            "mypy>=0.990",
            "pytest-cov>=4.0",
        ],
        "cli": [
            "click>=8.0",
            "rich>=12.0",
            "pygments>=2.13",
        ],
    },
    entry_points={
        "console_scripts": [
            "omnix=omnix.cli:main",
            "omnix-lsp=omnix.language_server:main",
        ],
    },
    keywords=[
        "omnix",
        "distributed-systems",
        "consensus",
        "blockchain",
        "programming-language",
        "compiler",
        "distributed-computing",
        "fault-tolerance",
        "byzantine",
        "raft",
        "pbft",
    ],
    license="Apache-2.0",
    zip_safe=False,
)