"""Memory search tool for Jarvis.

Searches cloud memories stored in Mem0 using semantic similarity.
"""

from typing import Dict, Any, Optional

from ..base import Tool, ToolContext
from ..types import ToolExecutionResult
from ...memory.mem0_provider import get_mem0_provider


class SearchMemoriesTool(Tool):
    """Search cloud memories using Mem0's semantic search."""

    @property
    def name(self) -> str:
        return "searchMemories"

    @property
    def description(self) -> str:
        return (
            "Search through long-term memories stored in the cloud. "
            "Use this to recall information from past conversations, user preferences, "
            "or facts that were learned over time. Memories are automatically extracted "
            "from conversations and stored for future reference."
        )

    @property
    def inputSchema(self) -> Dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The search query to find relevant memories"
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of memories to return (default: 5)",
                    "default": 5
                }
            },
            "required": ["query"]
        }

    def run(self, args: Optional[Dict[str, Any]], context: ToolContext) -> ToolExecutionResult:
        if not args or not args.get("query"):
            return ToolExecutionResult(
                success=False,
                reply_text=None,
                error_message="Query is required for memory search"
            )

        query = args["query"]
        max_results = args.get("max_results", 5)

        mem0 = get_mem0_provider()
        if not mem0.is_available():
            return ToolExecutionResult(
                success=False,
                reply_text=None,
                error_message="Memory service is not available. Check MEM0_API_KEY."
            )

        results = mem0.search(query, limit=max_results)

        if not results:
            return ToolExecutionResult(
                success=True,
                reply_text="No relevant memories found for the query."
            )

        # Format results
        lines = [f"Found {len(results)} relevant memory/memories:\n"]
        for i, mem in enumerate(results, 1):
            memory_text = mem.get("memory", "")
            score = mem.get("score", 0)
            metadata = mem.get("metadata", {})

            lines.append(f"{i}. {memory_text}")
            if score:
                lines.append(f"   (relevance: {score:.2f})")
            if metadata:
                meta_str = ", ".join(f"{k}={v}" for k, v in metadata.items() if v)
                if meta_str:
                    lines.append(f"   [{meta_str}]")
            lines.append("")

        return ToolExecutionResult(
            success=True,
            reply_text="\n".join(lines)
        )
