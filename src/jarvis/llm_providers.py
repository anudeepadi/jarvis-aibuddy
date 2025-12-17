"""
LLM Provider abstraction for Jarvis.
Supports multiple backends: Ollama (local) and Gemini (cloud).
"""

from __future__ import annotations
import os
import json
from typing import Optional, Any, Dict, List
from abc import ABC, abstractmethod

from .debug import debug_log


class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    def chat(
        self,
        messages: List[Dict[str, Any]],
        timeout_sec: float = 30.0,
        extra_options: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Send messages to the LLM and return the raw response."""
        pass

    @abstractmethod
    def embed(self, text: str, timeout_sec: float = 30.0) -> Optional[List[float]]:
        """Generate embeddings for text."""
        pass

    @staticmethod
    def extract_text(response: Dict[str, Any]) -> Optional[str]:
        """Extract text content from LLM response."""
        if not response:
            return None

        # Ollama format
        if "message" in response and isinstance(response["message"], dict):
            content = response["message"].get("content")
            if isinstance(content, str):
                return content

        # OpenAI/Gemini format
        if "choices" in response and isinstance(response["choices"], list) and len(response["choices"]) > 0:
            choice = response["choices"][0]
            if isinstance(choice, dict):
                if "message" in choice and isinstance(choice["message"], dict):
                    content = choice["message"].get("content")
                    if isinstance(content, str):
                        return content
                elif "text" in choice:
                    content = choice["text"]
                    if isinstance(content, str):
                        return content

        # Direct content field
        if "content" in response:
            content = response["content"]
            if isinstance(content, str):
                return content

        # Gemini candidate format
        if "candidates" in response and isinstance(response["candidates"], list):
            if len(response["candidates"]) > 0:
                candidate = response["candidates"][0]
                if isinstance(candidate, dict) and "content" in candidate:
                    parts = candidate["content"].get("parts", [])
                    if parts and isinstance(parts[0], dict):
                        return parts[0].get("text", "")

        return None


class OllamaProvider(LLMProvider):
    """Ollama local LLM provider."""

    def __init__(self, base_url: str, chat_model: str, embed_model: str):
        self.base_url = base_url.rstrip('/')
        self.chat_model = chat_model
        self.embed_model = embed_model

    def chat(
        self,
        messages: List[Dict[str, Any]],
        timeout_sec: float = 30.0,
        extra_options: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        import requests

        payload = {
            "model": self.chat_model,
            "messages": messages,
            "stream": False,
            "options": {"num_ctx": 4096},
        }
        if extra_options and isinstance(extra_options, dict):
            payload["options"].update(extra_options)

        try:
            resp = requests.post(
                f"{self.base_url}/api/chat",
                json=payload,
                timeout=timeout_sec
            )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict):
                return data
        except Exception as e:
            debug_log(f"Ollama chat error: {e}", "llm")
        return None

    def embed(self, text: str, timeout_sec: float = 30.0) -> Optional[List[float]]:
        import requests

        try:
            resp = requests.post(
                f"{self.base_url}/api/embeddings",
                json={"model": self.embed_model, "prompt": text},
                timeout=timeout_sec
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("embedding")
        except Exception as e:
            debug_log(f"Ollama embed error: {e}", "llm")
        return None


class OpenAIProvider(LLMProvider):
    """OpenAI API provider (gpt-4o, gpt-4o-mini, etc.)."""

    def __init__(self, api_key: str, model: str = "gpt-4o-mini"):
        self.api_key = api_key
        self.model = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=self.api_key)
        return self._client

    def chat(
        self,
        messages: List[Dict[str, Any]],
        timeout_sec: float = 30.0,
        extra_options: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        try:
            client = self._get_client()

            # OpenAI accepts messages directly in the standard format
            response = client.chat.completions.create(
                model=self.model,
                messages=messages,
                timeout=timeout_sec,
            )

            # Extract response
            response_text = ""
            if response.choices and len(response.choices) > 0:
                response_text = response.choices[0].message.content or ""

            # Convert to Ollama-compatible format for consistency
            result = {
                "message": {
                    "role": "assistant",
                    "content": response_text
                }
            }

            return result

        except Exception as e:
            debug_log(f"OpenAI chat error: {e}", "llm")
            return None

    def embed(self, text: str, timeout_sec: float = 30.0) -> Optional[List[float]]:
        try:
            client = self._get_client()
            response = client.embeddings.create(
                model="text-embedding-3-small",
                input=text,
            )
            if response.data and len(response.data) > 0:
                return list(response.data[0].embedding)
            return None
        except Exception as e:
            debug_log(f"OpenAI embed error: {e}", "llm")
        return None


class GeminiProvider(LLMProvider):
    """Google Gemini API provider using the new google.genai SDK."""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash"):
        self.api_key = api_key
        self.model = model
        self._client = None

    def _get_client(self):
        if self._client is None:
            from google import genai
            self._client = genai.Client(api_key=self.api_key)
        return self._client

    def chat(
        self,
        messages: List[Dict[str, Any]],
        timeout_sec: float = 30.0,
        extra_options: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        try:
            from google import genai
            from google.genai import types

            client = self._get_client()

            # Convert messages to Gemini format
            # Collect system instructions and build conversation history
            system_instruction = None
            conversation_parts = []

            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")

                if role == "system":
                    # Gemini handles system prompts via system_instruction
                    if system_instruction is None:
                        system_instruction = content
                    else:
                        system_instruction += "\n" + content
                elif role == "user":
                    conversation_parts.append({"role": "user", "text": content})
                elif role == "assistant":
                    conversation_parts.append({"role": "model", "text": content})
                elif role == "tool":
                    # Handle tool results as user messages
                    conversation_parts.append({"role": "user", "text": f"Tool result: {content}"})

            # Build config with system instruction
            config = types.GenerateContentConfig(
                system_instruction=system_instruction
            ) if system_instruction else None

            # Build contents for multi-turn conversation
            # For single turn, just use the last user message as a string
            if len(conversation_parts) == 1:
                contents = conversation_parts[0]["text"]
            elif len(conversation_parts) > 1:
                # Build multi-turn contents
                contents = []
                for part in conversation_parts:
                    contents.append({
                        "role": part["role"],
                        "parts": [{"text": part["text"]}]
                    })
            else:
                contents = "Hello"

            # Generate response
            response = client.models.generate_content(
                model=self.model,
                contents=contents,
                config=config
            )

            # Extract text from response
            response_text = ""
            if response and response.text:
                response_text = response.text

            # Convert to Ollama-compatible format for consistency
            result = {
                "message": {
                    "role": "assistant",
                    "content": response_text
                }
            }

            return result

        except Exception as e:
            debug_log(f"Gemini chat error: {e}", "llm")
            import traceback
            debug_log(f"Traceback: {traceback.format_exc()}", "llm")
            return None

    def embed(self, text: str, timeout_sec: float = 30.0) -> Optional[List[float]]:
        try:
            from google import genai

            client = self._get_client()
            result = client.models.embed_content(
                model="text-embedding-004",
                contents=text,
            )
            if result and result.embeddings:
                return list(result.embeddings[0].values)
            return None
        except Exception as e:
            debug_log(f"Gemini embed error: {e}", "llm")
        return None


def get_llm_provider(cfg) -> LLMProvider:
    """
    Factory function to get the appropriate LLM provider based on config.

    Config should have:
    - llm_provider: "ollama", "gemini", or "openai" (default: "ollama")
    - For ollama: ollama_base_url, ollama_chat_model, ollama_embed_model
    - For gemini: GEMINI_API_KEY env var, gemini_model (optional)
    - For openai: OPENAI_API_KEY env var, openai_model (optional, default: gpt-4o-mini)
    """
    provider_type = getattr(cfg, 'llm_provider', 'ollama').lower()

    if provider_type == "openai":
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            debug_log("OPENAI_API_KEY not found, falling back to Ollama", "llm")
            provider_type = "ollama"
        else:
            model = getattr(cfg, 'openai_model', 'gpt-4o-mini')
            debug_log(f"Using OpenAI provider with model: {model}", "llm")
            return OpenAIProvider(api_key=api_key, model=model)

    if provider_type == "gemini":
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            debug_log("GEMINI_API_KEY not found, falling back to Ollama", "llm")
            provider_type = "ollama"
        else:
            model = getattr(cfg, 'gemini_model', 'gemini-2.5-flash-preview-05-20')
            debug_log(f"Using Gemini provider with model: {model}", "llm")
            return GeminiProvider(api_key=api_key, model=model)

    # Default to Ollama
    debug_log(f"Using Ollama provider with model: {cfg.ollama_chat_model}", "llm")
    return OllamaProvider(
        base_url=cfg.ollama_base_url,
        chat_model=cfg.ollama_chat_model,
        embed_model=cfg.ollama_embed_model
    )
