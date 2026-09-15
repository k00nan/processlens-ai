from types import SimpleNamespace

import pytest

import llm_client


def test_generate_text_nutzt_google_standardmaessig(monkeypatch):
    aufrufe = []

    def fake_generate(prompt, model):
        aufrufe.append((prompt, model))
        return "ok"

    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.delenv("LLM_MODEL", raising=False)
    monkeypatch.setattr(llm_client, "_generate_with_gemini", fake_generate)

    assert llm_client.generate_text("Hallo") == "ok"
    assert aufrufe == [("Hallo", "gemini-3-flash-preview")]


def test_generate_text_nutzt_anthropic_wenn_konfiguriert(monkeypatch):
    aufrufe = []

    def fake_generate(prompt, model):
        aufrufe.append((prompt, model))
        return "ok"

    monkeypatch.setenv("LLM_PROVIDER", "anthropic")
    monkeypatch.setenv("LLM_MODEL", "claude-test-model")
    monkeypatch.setattr(llm_client, "_generate_with_claude", fake_generate)

    assert llm_client.generate_text("Hallo") == "ok"
    assert aufrufe == [("Hallo", "claude-test-model")]


def test_generate_text_nutzt_openai_wenn_konfiguriert(monkeypatch):
    aufrufe = []

    def fake_generate(prompt, model):
        aufrufe.append((prompt, model))
        return "ok"

    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.setenv("LLM_MODEL", "gpt-test-model")
    monkeypatch.setattr(llm_client, "_generate_with_openai", fake_generate)

    assert llm_client.generate_text("Hallo") == "ok"
    assert aufrufe == [("Hallo", "gpt-test-model")]


def test_generate_text_nutzt_openai_default_model(monkeypatch):
    aufrufe = []

    def fake_generate(prompt, model):
        aufrufe.append((prompt, model))
        return "ok"

    monkeypatch.setenv("LLM_PROVIDER", "openai")
    monkeypatch.delenv("LLM_MODEL", raising=False)
    monkeypatch.setattr(llm_client, "_generate_with_openai", fake_generate)

    assert llm_client.generate_text("Hallo") == "ok"
    assert aufrufe == [("Hallo", "gpt-5-mini")]


def test_generate_text_lehnt_unbekannten_provider_ab(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "unknown")

    with pytest.raises(ValueError, match="Unsupported LLM_PROVIDER"):
        llm_client.generate_text("Hallo")


def test_claude_token_limit_ist_optional(monkeypatch):
    aufrufe = []

    class FakeMessages:
        def create(self, **kwargs):
            aufrufe.append(kwargs)
            return SimpleNamespace(content=[SimpleNamespace(type="text", text="ok")])

    monkeypatch.delenv("LLM_MAX_TOKENS", raising=False)
    monkeypatch.setattr(llm_client, "_claude_client", lambda: SimpleNamespace(messages=FakeMessages()))

    assert llm_client._generate_with_claude("Hallo", "claude-test-model") == "ok"
    assert "max_tokens" not in aufrufe[0]


def test_openai_token_limit_ist_optional(monkeypatch):
    aufrufe = []

    class FakeResponses:
        def create(self, **kwargs):
            aufrufe.append(kwargs)
            return SimpleNamespace(output_text="ok")

    monkeypatch.delenv("LLM_MAX_TOKENS", raising=False)
    monkeypatch.setattr(llm_client, "_openai_client", lambda: SimpleNamespace(responses=FakeResponses()))

    assert llm_client._generate_with_openai("Hallo", "gpt-test-model") == "ok"
    assert "max_output_tokens" not in aufrufe[0]
