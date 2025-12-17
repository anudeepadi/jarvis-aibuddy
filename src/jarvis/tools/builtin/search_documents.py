"""Document search tool for Jarvis.

Searches indexed documents in ChromaDB using semantic similarity.
"""

from typing import Dict, Any, Optional

from ..base import Tool, ToolContext
from ..types import ToolExecutionResult
from ...memory.document_store import get_document_store


class SearchDocumentsTool(Tool):
    """Search indexed documents using semantic similarity."""

    @property
    def name(self) -> str:
        return "searchDocuments"

    @property
    def description(self) -> str:
        return (
            "Search through indexed documents using semantic similarity. "
            "Use this to find relevant information from documents that have been indexed "
            "into the knowledge base. Returns the most relevant document chunks."
        )

    @property
    def inputSchema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to find relevant documents"
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of results to return (default: 5)",
                    "default": 5
                },
                "source_filter": {
                    "type": "string",
                    "description": "Optional filter to limit results to a specific source/file path"
                }
            },
            "required": ["query"]
        }

    def run(self, args: Optional[Dict[str, Any]], context: ToolContext) -> ToolExecutionResult:
        if not args or not args.get("query"):
            return ToolExecutionResult(
                success=False,
                reply_text=None,
                error_message="Query is required for document search"
            )

        query = args["query"]
        max_results = args.get("max_results", 5)
        source_filter = args.get("source_filter")

        store = get_document_store()
        if not store.is_available():
            return ToolExecutionResult(
                success=False,
                reply_text=None,
                error_message="Document store is not available"
            )

        # Build where filter if source specified
        where = {"source": source_filter} if source_filter else None

        results = store.search(query, n_results=max_results, where=where)

        if not results:
            return ToolExecutionResult(
                success=True,
                reply_text="No relevant documents found for the query."
            )

        # Format results
        lines = [f"Found {len(results)} relevant document(s):\n"]
        for i, doc in enumerate(results, 1):
            source = doc.get("source", "unknown")
            score = doc.get("score", 0)
            content = doc.get("content", "")

            # Truncate long content
            if len(content) > 300:
                content = content[:300] + "..."

            lines.append(f"{i}. **{source}** (relevance: {score:.2f})")
            lines.append(f"   {content}\n")

        return ToolExecutionResult(
            success=True,
            reply_text="\n".join(lines)
        )
