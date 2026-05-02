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
    """Recursively walk en; yield (path, en_value) for every leaf missing in target.
    target_dict should already be the sub-tree at `prefix`, so we only look up
    each immediate child `k` directly rather than re-descending from the root.
    """
    out = {}
    td = target_dict if isinstance(target_dict, dict) else {}
    for k, v in en_dict.items():
        path = prefix + (k,)
        if isinstance(v, dict):
            sub = collect_missing(v, td.get(k) if isinstance(td.get(k), dict) else {}, path)
            if sub:
                out[k] = sub
        else:
            if k not in td or td.get(k) is None:
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
        # top-level section at a time (small payload per LLM call). For very
        # large sections (e.g. dl has 77 keys) further sub-chunk by direct
        # children so we stay under GPT-4o-mini's reliable JSON output window.
        #
        # IMPORTANT: write incrementally after each section — if the outer
        # timeout kills us mid-way, already-translated sections are preserved
        # so a re-run only processes what's left.
        async def translate_and_merge(payload, session_suffix):
            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"panel-i18n-{code}-{session_suffix}",
                system_message=SYSTEM_PROMPT.format(target_lang=name),
            ).with_model("openai", "gpt-4o-mini")
            return await translate_chunk(chat, payload, name)

        for section_key, section_val in missing.items():
            section_keys_count = sum(1 for _ in _iter_leaves({section_key: section_val}))
            print(f"  → {section_key} ({section_keys_count} keys)", end=" ", flush=True)
            try:
                if isinstance(section_val, dict) and section_keys_count > 40:
                    # Split on direct children — each child gets its own LLM call.
                    merged_section = {}
                    for sub_k, sub_v in section_val.items():
                        sub_out = await translate_and_merge({sub_k: sub_v}, f"{section_key}-{sub_k}")
                        # sub_out is wrapped in the same child key — unwrap safely
                        if sub_k in sub_out:
                            merged_section[sub_k] = sub_out[sub_k]
                        else:
                            merged_section.update(sub_out)
                    section_translated = {section_key: merged_section}
                else:
                    section_translated = await translate_and_merge({section_key: section_val}, section_key)
                # Incremental persist
                tgt = deep_merge(tgt, section_translated)
                tgt_path.write_text(json.dumps(tgt, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
                print("✓")
            except Exception as e:
                print(f"FAIL ({e})")
                # Keep going — partial is better than nothing

        done_count = sum(1 for _ in _iter_leaves(tgt))
        print(f"   {done_count} keys now in {tgt_path}")


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
