"""Document indexing tool for Jarvis.

Indexes text files into ChromaDB for semantic search.
"""

from typing import Dict, Any, Optional
from pathlib import Path

from ..base import Tool, ToolContext
from ..types import ToolExecutionResult
from ...memory.document_store import get_document_store


class IndexDocumentsTool(Tool):
    """Index documents into the knowledge base for semantic search."""

    @property
    def name(self) -> str:
        return "indexDocuments"

    @property
    def description(self) -> str:
        return (
            "Index one or more text files into the knowledge base for semantic search. "
            "Indexed documents can later be searched using the searchDocuments tool. "
            "Supports text files like .txt, .md, .py, .json, etc."
        )

    @property
    def inputSchema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "file_path": {
                    "type": "string",
                    "description": "Path to the file to index (can be absolute or relative to home)"
                },
                "chunk_size": {
                    "type": "integer",
                    "description": "Maximum characters per chunk (default: 1000)",
                    "default": 1000
                },
                "chunk_overlap": {
                    "type": "integer",
                    "description": "Overlap between chunks for context (default: 200)",
                    "default": 200
                }
            },
            "required": ["file_path"]
        }

    def run(self, args: Optional[Dict[str, Any]], context: ToolContext) -> ToolExecutionResult:
        if not args or not args.get("file_path"):
            return ToolExecutionResult(
                success=False,
                reply_text=None,
                error_message="File path is required for indexing"
            )

        file_path = args["file_path"]
        chunk_size = args.get("chunk_size", 1000)
        chunk_overlap = args.get("chunk_overlap", 200)

        # Expand user home directory
        path = Path(file_path).expanduser()
        if not path.is_absolute():
            path = Path.home() / path

        if not path.exists():
            return ToolExecutionResult(
                success=False,
                reply_text=None,
                error_message=f"File not found: {path}"
            )

        if not path.is_file():
            return ToolExecutionResult(
                success=False,
                reply_text=None,
                error_message=f"Path is not a file: {path}"
            )

        store = get_document_store()
        if not store.is_available():
            return ToolExecutionResult(
                success=False,
                reply_text=None,
                error_message="Document store is not available"
            )

        # Check file size (limit to 10MB)
        file_size = path.stat().st_size
        if file_size > 10 * 1024 * 1024:
            return ToolExecutionResult(
                success=False,
                reply_text=None,
                error_message=f"File too large ({file_size / 1024 / 1024:.1f}MB). Maximum is 10MB."
            )

        # Index the file
        doc_ids = store.index_file(
            str(path),
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )

        if not doc_ids:
            return ToolExecutionResult(
                success=False,
                reply_text=None,
                error_message=f"Failed to index file: {path}"
            )

        # Get stats
        stats = store.get_stats()
        total_docs = stats.get("total_documents", 0)

        return ToolExecutionResult(
            success=True,
            reply_text=(
                f"Successfully indexed **{path.name}**:\n"
                f"- Created {len(doc_ids)} document chunks\n"
                f"- Total documents in knowledge base: {total_docs}"
            )
        )
