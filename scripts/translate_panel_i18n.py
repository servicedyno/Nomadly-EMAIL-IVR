#!/usr/bin/env python3
"""
Translate the `panel.*` hosting-panel UI keys from en.json into fr/hi/zh.

Uses the Emergent LLM key (gpt-4o-mini). Preserves:
  - Mustache placeholders: {{name}}, {{url}}, {{count}}
  - Inline HTML tags like <strong>...</strong>
  - HTML entities and keyboard glyphs (←, →)

Only touches keys that are NEW in en.json (i.e. not yet present in the target
locale). Existing human-curated translations are left untouched.
"""
import asyncio
import json
import os
import sys
from pathlib import Path

from emergentintegrations.llm.chat import LlmChat, UserMessage

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "sk-emergent-07b67C104459eEdF05")
LOCALES = Path("/app/frontend/src/locales")
TARGETS = [
    ("fr", "French"),
    ("hi", "Hindi"),
    ("zh", "Simplified Chinese (zh-CN)"),
]

SYSTEM_PROMPT = """You are a professional UI-string translator for a hosting-panel web app.

Given a JSON object of English UI strings, translate EVERY string to {target_lang}.

CRITICAL RULES (break any of these and the translation is rejected):
1. Return ONLY a JSON object — no prose, no code fences, no explanation.
2. Preserve the JSON structure EXACTLY — same keys, same nesting.
3. Preserve mustache placeholders EXACTLY: `{{name}}`, `{{url}}`, `{{count}}`, `{{percent}}`, `{{date}}`, `{{address}}`, `{{lang}}`, `{{action}}`, `{{domain}}`, `{{query}}`.
4. Preserve inline HTML tags EXACTLY: `<strong>...</strong>` must survive.
5. Preserve keyboard glyphs (←, →, Esc) and punctuation unchanged.
6. For button/label text, be concise. Tone: professional but friendly, same as cPanel/modern hosting panels.
7. For Chinese: use Simplified Chinese (zh-CN), not Traditional.
8. For Hindi: use Devanagari script.
9. Do NOT translate: "cPanel", "HTML", "CSS", "JS", "PHP", "index.html", ".zip", "PIN" (keep as "PIN"), "HostBay", "Gold", brand/technical terms.
"""


async def translate_chunk(chat, payload, target_name):
    msg = UserMessage(text=json.dumps(payload, ensure_ascii=False, indent=2))
    resp = await chat.send_message(msg)
    txt = resp.strip()
    # Strip possible code fence
    if txt.startswith("```"):
        txt = txt.split("\n", 1)[1]
        if txt.endswith("```"):
            txt = txt.rsplit("```", 1)[0]
        if txt.startswith("json\n"):
            txt = txt[5:]
    return json.loads(txt)


def deep_get(d, path):
    for p in path:
        if not isinstance(d, dict) or p not in d:
            return None
        d = d[p]
    return d


def collect_missing(en_dict, target_dict, prefix=()):
    """Recursively walk en; yield (path, en_value) for every leaf missing in target."""
    out = {}
    for k, v in en_dict.items():
        path = prefix + (k,)
        if isinstance(v, dict):
            sub = collect_missing(v, deep_get(target_dict, [*path]) or {}, path)
            if sub:
                out[k] = sub
        else:
            tgt_val = deep_get(target_dict, path)
            if tgt_val is None:
                out[k] = v
    return out


def deep_merge(base, overlay):
    for k, v in overlay.items():
        if isinstance(v, dict) and isinstance(base.get(k), dict):
            deep_merge(base[k], v)
        else:
            base[k] = v
    return base


async def main():
    en = json.loads((LOCALES / "en.json").read_text(encoding="utf-8"))
    for code, name in TARGETS:
        tgt_path = LOCALES / f"{code}.json"
        tgt = json.loads(tgt_path.read_text(encoding="utf-8")) if tgt_path.exists() else {}
        missing = collect_missing(en, tgt)
        total_keys = sum(1 for _ in _iter_leaves(missing))
        print(f"\n=== {name} ({code}) — {total_keys} missing keys ===")
        if total_keys == 0:
            continue

        # Emergent LLM key has a tight per-session budget, so translate one
        # top-level section at a time (small payload per LLM call).
        translated = {}
        for section_key, section_val in missing.items():
            section_keys_count = sum(1 for _ in _iter_leaves({section_key: section_val}))
            print(f"  → {section_key} ({section_keys_count} keys)", end=" ", flush=True)
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"panel-i18n-{code}-{section_key}",
                system_message=SYSTEM_PROMPT.format(target_lang=name),
            ).with_model("openai", "gpt-4o-mini")
            try:
                section_translated = await translate_chunk(chat, {section_key: section_val}, name)
                translated.update(section_translated)
                print("✓")
            except Exception as e:
                print(f"FAIL ({e})")
                # Keep going — partial is better than nothing
        if not translated:
            continue
        print(f"   got {sum(1 for _ in _iter_leaves(translated))} translated keys")
        merged = deep_merge(tgt, translated)
        tgt_path.write_text(json.dumps(merged, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"   wrote {tgt_path}")


def _iter_leaves(d):
    if isinstance(d, dict):
        for v in d.values():
            yield from _iter_leaves(v)
    else:
        yield d


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
