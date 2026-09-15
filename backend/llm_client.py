import os
from enum import StrEnum
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DEFAULT_GEMINI_MODEL = "gemini-3-flash-preview"
DEFAULT_CLAUDE_MODEL = "claude-sonnet-4-5"
DEFAULT_OPENAI_MODEL = "gpt-5-mini"


class LlmProvider(StrEnum):
    GOOGLE = "google"
    ANTHROPIC = "anthropic"
    OPENAI = "openai"


def _provider() -> LlmProvider:
    provider = os.getenv("LLM_PROVIDER", LlmProvider.GOOGLE).strip().lower()
    try:
        return LlmProvider(provider)
    except ValueError as exc:
        supported = ", ".join(provider.value for provider in LlmProvider)
        raise ValueError(
            f"Unsupported LLM_PROVIDER '{provider}'. Supported providers: {supported}."
        ) from exc


def _model_for(provider: LlmProvider) -> str:
    if os.getenv("LLM_MODEL"):
        return os.environ["LLM_MODEL"]
    if provider == LlmProvider.ANTHROPIC:
        return DEFAULT_CLAUDE_MODEL
    if provider == LlmProvider.OPENAI:
        return DEFAULT_OPENAI_MODEL
    return DEFAULT_GEMINI_MODEL


def _max_tokens() -> int | None:
    value = os.getenv("LLM_MAX_TOKENS")
    if not value:
        return None
    return int(value)


@lru_cache(maxsize=1)
def _gemini_client():
    from google import genai

    return genai.Client(api_key=os.environ["GEMINI_KEY"])


@lru_cache(maxsize=1)
def _claude_client():
    import anthropic

    return anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])


@lru_cache(maxsize=1)
def _openai_client():
    from openai import OpenAI

    return OpenAI(api_key=os.environ["OPENAI_API_KEY"])


def _generate_with_gemini(prompt: str, model: str) -> str:
    response = _gemini_client().models.generate_content(
        model=model,
        contents=prompt,
    )
    return response.text.strip()


def _generate_with_claude(prompt: str, model: str) -> str:
    kwargs = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
    }
    max_tokens = _max_tokens()
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens

    response = _claude_client().messages.create(**kwargs)
    text_parts = [
        block.text
        for block in response.content
        if getattr(block, "type", None) == "text"
    ]
    return "\n".join(text_parts).strip()


def _generate_with_openai(prompt: str, model: str) -> str:
    kwargs = {
        "model": model,
        "input": prompt,
    }
    max_tokens = _max_tokens()
    if max_tokens is not None:
        kwargs["max_output_tokens"] = max_tokens

    response = _openai_client().responses.create(**kwargs)
    return response.output_text.strip()


def generate_text(prompt: str) -> str:
    """Generate text with the configured LLM provider."""
    provider = _provider()
    model = _model_for(provider)

    if provider == LlmProvider.GOOGLE:
        return _generate_with_gemini(prompt, model)
    if provider == LlmProvider.ANTHROPIC:
        return _generate_with_claude(prompt, model)
    if provider == LlmProvider.OPENAI:
        return _generate_with_openai(prompt, model)

    raise AssertionError(f"Unhandled LLM provider: {provider}")
