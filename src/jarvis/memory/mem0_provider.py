"""
Mem0 cloud memory provider for Jarvis.
Provides persistent, searchable memory across sessions using Mem0's managed API.
"""

from __future__ import annotations
import os
from typing import Optional, List, Dict, Any

from ..debug import debug_log


class Mem0Provider:
    """
    Cloud memory provider using Mem0 API.
    Stores and retrieves memories for users with semantic search.
    """

    def __init__(self, api_key: Optional[str] = None, user_id: str = "jarvis_user"):
        """
        Initialize Mem0 provider.

        Args:
            api_key: Mem0 API key. Falls back to MEM0_API_KEY env var.
            user_id: User identifier for memory storage.
        """
        self.api_key = api_key or os.environ.get("MEM0_API_KEY")
        self.user_id = user_id
        self._client = None
        self._client_error = None
        self._initialized = False

    def _ensure_initialized(self) -> bool:
        """Initialize the Mem0 client lazily."""
        if self._initialized:
            return self._client is not None

        self._initialized = True

        if not self.api_key:
            self._client_error = "MEM0_API_KEY not set"
            debug_log(f"Mem0 initialization failed: {self._client_error}", "memory")
            return False

        try:
            from mem0 import MemoryClient
            self._client = MemoryClient(api_key=self.api_key)
            debug_log("Mem0 cloud memory initialized successfully", "memory")
            return True
        except ImportError:
            self._client_error = "mem0ai package not installed"
            debug_log(f"Mem0 initialization failed: {self._client_error}", "memory")
            return False
        except Exception as e:
            self._client_error = str(e)
            debug_log(f"Mem0 initialization failed: {self._client_error}", "memory")
            return False

    def is_available(self) -> bool:
        """Check if Mem0 is available and configured."""
        return self._ensure_initialized()

    def add_memory(
        self,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """
        Add a memory to Mem0.

        Args:
            content: The memory content to store.
            metadata: Optional metadata to attach to the memory.

        Returns:
            Event ID if queued for processing, memory ID if immediately available, None on error.
        """
        if not self._ensure_initialized():
            return None

        try:
            # Mem0 MemoryClient.add() expects messages format
            messages = [{"role": "user", "content": content}]

            result = self._client.add(
                messages=messages,
                user_id=self.user_id,
                metadata=metadata or {},
            )

            debug_log(f"Added memory to Mem0: {content[:100]}...", "memory")

            # Handle async response (queued for background processing)
            if result and isinstance(result, dict):
                # Check for async result
                if "results" in result and isinstance(result["results"], list):
                    for r in result["results"]:
                        if r.get("status") == "PENDING":
                            return r.get("event_id")  # Return event ID for tracking
                        if r.get("id"):
                            return r.get("id")
                # Direct ID response
                return result.get("id") or result.get("memory_id") or result.get("event_id")
            elif result and isinstance(result, list) and len(result) > 0:
                return result[0].get("id") or result[0].get("memory_id")
            return "queued"  # Indicate success even without explicit ID

        except Exception as e:
            debug_log(f"Mem0 add_memory error: {e}", "memory")
            return None

    def add_conversation(
        self,
        messages: List[Dict[str, str]],
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[List[str]]:
        """
        Add a conversation to Mem0 for memory extraction.

        Args:
            messages: List of message dicts with 'role' and 'content' keys.
            metadata: Optional metadata to attach.

        Returns:
            List of memory IDs if successful, None otherwise.
        """
        if not self._ensure_initialized():
            return None

        if not messages:
            return None

        try:
            result = self._client.add(
                messages=messages,
                user_id=self.user_id,
                metadata=metadata or {},
            )

            debug_log(f"Added conversation to Mem0 ({len(messages)} messages)", "memory")

            # Extract memory IDs
            memory_ids = []
            if result and isinstance(result, dict) and "results" in result:
                for mem in result.get("results", []):
                    if mem.get("id"):
                        memory_ids.append(mem["id"])
            elif result and isinstance(result, list):
                for mem in result:
                    if isinstance(mem, dict) and mem.get("id"):
                        memory_ids.append(mem["id"])

            return memory_ids if memory_ids else None

        except Exception as e:
            debug_log(f"Mem0 add_conversation error: {e}", "memory")
            return None

    def search(
        self,
        query: str,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Search memories using semantic search.

        Args:
            query: Search query string.
            limit: Maximum number of results to return.

        Returns:
            List of memory dicts with 'memory', 'id', and 'score' keys.
        """
        if not self._ensure_initialized():
            return []

        try:
            # Use filters parameter as required by Mem0 API v2
            results = self._client.search(
                query=query,
                filters={"user_id": self.user_id},
                limit=limit,
            )

            memories = []
            if results and isinstance(results, dict) and "results" in results:
                for mem in results.get("results", []):
                    memories.append({
                        "memory": mem.get("memory", ""),
                        "id": mem.get("id", ""),
                        "score": mem.get("score", 0.0),
                        "metadata": mem.get("metadata", {}),
                    })
            elif results and isinstance(results, list):
                for mem in results:
                    if isinstance(mem, dict):
                        memories.append({
                            "memory": mem.get("memory", ""),
                            "id": mem.get("id", ""),
                            "score": mem.get("score", 0.0),
                            "metadata": mem.get("metadata", {}),
                        })

            debug_log(f"Mem0 search for '{query[:50]}...' returned {len(memories)} results", "memory")
            return memories

        except Exception as e:
            debug_log(f"Mem0 search error: {e}", "memory")
            return []

    def get_all(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get all memories for the user.

        Args:
            limit: Maximum number of memories to return.

        Returns:
            List of memory dicts.
        """
        if not self._ensure_initialized():
            return []

        try:
            # Use filters parameter as required by Mem0 API v2
            results = self._client.get_all(
                filters={"user_id": self.user_id},
                limit=limit
            )

            memories = []
            if results and isinstance(results, dict) and "results" in results:
                memories = results.get("results", [])
            elif results and isinstance(results, list):
                memories = results

            debug_log(f"Retrieved {len(memories)} memories from Mem0", "memory")
            return memories

        except Exception as e:
            debug_log(f"Mem0 get_all error: {e}", "memory")
            return []

    def delete(self, memory_id: str) -> bool:
        """
        Delete a specific memory.

        Args:
            memory_id: The ID of the memory to delete.

        Returns:
            True if successful, False otherwise.
        """
        if not self._ensure_initialized():
            return False

        try:
            self._client.delete(memory_id=memory_id)
            debug_log(f"Deleted memory {memory_id} from Mem0", "memory")
            return True
        except Exception as e:
            debug_log(f"Mem0 delete error: {e}", "memory")
            return False

    def get_formatted_context(
        self,
        query: str,
        limit: int = 5,
    ) -> List[str]:
        """
        Get formatted memory context for use in prompts.

        Args:
            query: Query to search for relevant memories.
            limit: Maximum number of memories to include.

        Returns:
            List of formatted memory strings.
        """
        memories = self.search(query, limit=limit)

        formatted = []
        for mem in memories:
            memory_text = mem.get("memory", "")
            if memory_text:
                formatted.append(f"[Memory] {memory_text}")

        return formatted


# Global singleton instance
_mem0_provider: Optional[Mem0Provider] = None


def get_mem0_provider(user_id: str = "jarvis_user") -> Mem0Provider:
    """
    Get or create the global Mem0 provider instance.

    Args:
        user_id: User identifier for memory storage.

    Returns:
        Mem0Provider instance.
    """
    global _mem0_provider

    if _mem0_provider is None:
        _mem0_provider = Mem0Provider(user_id=user_id)

    return _mem0_provider
