"""
ChromaDB document store for Jarvis.
Provides semantic search over indexed documents using vector embeddings.
"""

from __future__ import annotations
import os
import hashlib
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime

from ..debug import debug_log


class DocumentStore:
    """
    Document store using ChromaDB for semantic search.
    Indexes text documents and provides semantic retrieval.
    """

    def __init__(
        self,
        persist_dir: Optional[str] = None,
        collection_name: str = "jarvis_documents",
    ):
        """
        Initialize the document store.

        Args:
            persist_dir: Directory for persistent storage. Defaults to ~/.local/share/jarvis/chroma
            collection_name: Name of the ChromaDB collection.
        """
        if persist_dir is None:
            persist_dir = str(Path.home() / ".local" / "share" / "jarvis" / "chroma")

        self.persist_dir = persist_dir
        self.collection_name = collection_name
        self._client = None
        self._collection = None
        self._initialized = False
        self._init_error = None

    def _ensure_initialized(self) -> bool:
        """Initialize ChromaDB client lazily."""
        if self._initialized:
            return self._collection is not None

        self._initialized = True

        try:
            import chromadb
            from chromadb.config import Settings

            # Ensure directory exists
            Path(self.persist_dir).mkdir(parents=True, exist_ok=True)

            # Create persistent client
            self._client = chromadb.PersistentClient(
                path=self.persist_dir,
                settings=Settings(anonymized_telemetry=False),
            )

            # Get or create collection
            self._collection = self._client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )

            debug_log(f"ChromaDB initialized at {self.persist_dir}", "memory")
            return True

        except ImportError:
            self._init_error = "chromadb package not installed"
            debug_log(f"ChromaDB init failed: {self._init_error}", "memory")
            return False
        except Exception as e:
            self._init_error = str(e)
            debug_log(f"ChromaDB init failed: {self._init_error}", "memory")
            return False

    def is_available(self) -> bool:
        """Check if document store is available."""
        return self._ensure_initialized()

    def _generate_doc_id(self, content: str, source: str) -> str:
        """Generate a unique document ID based on content and source."""
        hash_input = f"{source}:{content[:500]}"
        return hashlib.sha256(hash_input.encode()).hexdigest()[:16]

    def add_document(
        self,
        content: str,
        source: str,
        metadata: Optional[Dict[str, Any]] = None,
        doc_id: Optional[str] = None,
    ) -> Optional[str]:
        """
        Add a document to the store.

        Args:
            content: The document text content.
            source: Source identifier (e.g., file path, URL).
            metadata: Optional additional metadata.
            doc_id: Optional custom document ID. Auto-generated if not provided.

        Returns:
            Document ID if successful, None otherwise.
        """
        if not self._ensure_initialized():
            return None

        if not content or not content.strip():
            return None

        try:
            # Generate or use provided ID
            doc_id = doc_id or self._generate_doc_id(content, source)

            # Prepare metadata
            doc_metadata = {
                "source": source,
                "indexed_at": datetime.utcnow().isoformat(),
                "content_length": len(content),
            }
            if metadata:
                doc_metadata.update(metadata)

            # Add to collection (ChromaDB handles embedding)
            self._collection.add(
                ids=[doc_id],
                documents=[content],
                metadatas=[doc_metadata],
            )

            debug_log(f"Added document {doc_id} from {source}", "memory")
            return doc_id

        except Exception as e:
            debug_log(f"Failed to add document: {e}", "memory")
            return None

    def add_documents(
        self,
        documents: List[Dict[str, Any]],
    ) -> List[str]:
        """
        Add multiple documents at once.

        Args:
            documents: List of dicts with 'content', 'source', and optional 'metadata'.

        Returns:
            List of successfully added document IDs.
        """
        if not self._ensure_initialized():
            return []

        added_ids = []
        for doc in documents:
            content = doc.get("content", "")
            source = doc.get("source", "unknown")
            metadata = doc.get("metadata")

            doc_id = self.add_document(content, source, metadata)
            if doc_id:
                added_ids.append(doc_id)

        return added_ids

    def search(
        self,
        query: str,
        n_results: int = 5,
        where: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Search documents by semantic similarity.

        Args:
            query: Search query text.
            n_results: Maximum number of results.
            where: Optional metadata filter.

        Returns:
            List of matching documents with 'content', 'source', 'score', 'metadata'.
        """
        if not self._ensure_initialized():
            return []

        if not query or not query.strip():
            return []

        try:
            results = self._collection.query(
                query_texts=[query],
                n_results=n_results,
                where=where,
            )

            documents = []
            if results and results.get("documents"):
                docs = results["documents"][0] if results["documents"] else []
                metadatas = results["metadatas"][0] if results.get("metadatas") else []
                distances = results["distances"][0] if results.get("distances") else []
                ids = results["ids"][0] if results.get("ids") else []

                for i, doc in enumerate(docs):
                    documents.append({
                        "id": ids[i] if i < len(ids) else None,
                        "content": doc,
                        "source": metadatas[i].get("source", "unknown") if i < len(metadatas) else "unknown",
                        "score": 1.0 - distances[i] if i < len(distances) else 0.0,  # Convert distance to similarity
                        "metadata": metadatas[i] if i < len(metadatas) else {},
                    })

            debug_log(f"Document search '{query[:50]}...' returned {len(documents)} results", "memory")
            return documents

        except Exception as e:
            debug_log(f"Document search failed: {e}", "memory")
            return []

    def get_document(self, doc_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a specific document by ID.

        Args:
            doc_id: The document ID.

        Returns:
            Document dict with 'content', 'source', 'metadata', or None.
        """
        if not self._ensure_initialized():
            return None

        try:
            result = self._collection.get(ids=[doc_id])

            if result and result.get("documents") and result["documents"]:
                return {
                    "id": doc_id,
                    "content": result["documents"][0],
                    "source": result["metadatas"][0].get("source", "unknown") if result.get("metadatas") else "unknown",
                    "metadata": result["metadatas"][0] if result.get("metadatas") else {},
                }
            return None

        except Exception as e:
            debug_log(f"Failed to get document {doc_id}: {e}", "memory")
            return None

    def delete_document(self, doc_id: str) -> bool:
        """
        Delete a document by ID.

        Args:
            doc_id: The document ID.

        Returns:
            True if deleted, False otherwise.
        """
        if not self._ensure_initialized():
            return False

        try:
            self._collection.delete(ids=[doc_id])
            debug_log(f"Deleted document {doc_id}", "memory")
            return True
        except Exception as e:
            debug_log(f"Failed to delete document {doc_id}: {e}", "memory")
            return False

    def delete_by_source(self, source: str) -> int:
        """
        Delete all documents from a specific source.

        Args:
            source: The source identifier.

        Returns:
            Number of documents deleted.
        """
        if not self._ensure_initialized():
            return 0

        try:
            # Get all documents from source
            results = self._collection.get(where={"source": source})

            if results and results.get("ids"):
                ids = results["ids"]
                if ids:
                    self._collection.delete(ids=ids)
                    debug_log(f"Deleted {len(ids)} documents from {source}", "memory")
                    return len(ids)
            return 0

        except Exception as e:
            debug_log(f"Failed to delete documents from {source}: {e}", "memory")
            return 0

    def get_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the document store.

        Returns:
            Dict with 'total_documents', 'persist_dir', etc.
        """
        if not self._ensure_initialized():
            return {"error": self._init_error, "available": False}

        try:
            count = self._collection.count()
            return {
                "available": True,
                "total_documents": count,
                "persist_dir": self.persist_dir,
                "collection_name": self.collection_name,
            }
        except Exception as e:
            return {"error": str(e), "available": False}

    def index_file(
        self,
        file_path: str,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ) -> List[str]:
        """
        Index a text file by chunking and adding to the store.

        Args:
            file_path: Path to the file to index.
            chunk_size: Maximum characters per chunk.
            chunk_overlap: Overlap between chunks for context.

        Returns:
            List of chunk document IDs.
        """
        if not self._ensure_initialized():
            return []

        try:
            path = Path(file_path)
            if not path.exists():
                debug_log(f"File not found: {file_path}", "memory")
                return []

            # Read file content
            content = path.read_text(encoding="utf-8", errors="ignore")

            if not content.strip():
                return []

            # Chunk the content
            chunks = self._chunk_text(content, chunk_size, chunk_overlap)

            # Add each chunk
            doc_ids = []
            for i, chunk in enumerate(chunks):
                doc_id = self.add_document(
                    content=chunk,
                    source=str(path.absolute()),
                    metadata={
                        "file_name": path.name,
                        "file_type": path.suffix,
                        "chunk_index": i,
                        "total_chunks": len(chunks),
                    },
                )
                if doc_id:
                    doc_ids.append(doc_id)

            debug_log(f"Indexed {len(doc_ids)} chunks from {file_path}", "memory")
            return doc_ids

        except Exception as e:
            debug_log(f"Failed to index file {file_path}: {e}", "memory")
            return []

    def _chunk_text(
        self,
        text: str,
        chunk_size: int,
        overlap: int,
    ) -> List[str]:
        """Split text into overlapping chunks."""
        chunks = []
        start = 0

        while start < len(text):
            end = start + chunk_size

            # Try to break at a natural boundary (newline, period, space)
            if end < len(text):
                # Look for paragraph break first
                para_break = text.rfind("\n\n", start, end)
                if para_break > start + chunk_size // 2:
                    end = para_break + 2
                else:
                    # Look for sentence end
                    period = text.rfind(". ", start, end)
                    if period > start + chunk_size // 2:
                        end = period + 2
                    else:
                        # Look for newline
                        newline = text.rfind("\n", start, end)
                        if newline > start + chunk_size // 2:
                            end = newline + 1
                        else:
                            # Look for space
                            space = text.rfind(" ", start, end)
                            if space > start + chunk_size // 2:
                                end = space + 1

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            # Move start for next chunk, with overlap
            start = end - overlap

        return chunks

    def get_formatted_context(
        self,
        query: str,
        n_results: int = 3,
    ) -> List[str]:
        """
        Get formatted document context for use in prompts.

        Args:
            query: Query to search for relevant documents.
            n_results: Maximum number of documents to include.

        Returns:
            List of formatted document strings.
        """
        results = self.search(query, n_results=n_results)

        formatted = []
        for doc in results:
            source = doc.get("source", "unknown")
            content = doc.get("content", "")
            if content:
                # Truncate very long content
                if len(content) > 500:
                    content = content[:500] + "..."
                formatted.append(f"[Document: {source}] {content}")

        return formatted


# Global singleton instance
_document_store: Optional[DocumentStore] = None


def get_document_store() -> DocumentStore:
    """
    Get or create the global document store instance.

    Returns:
        DocumentStore instance.
    """
    global _document_store

    if _document_store is None:
        _document_store = DocumentStore()

    return _document_store
