#!/usr/bin/env python3

from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from functools import lru_cache
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

BASE_DIR = Path(__file__).resolve().parent
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = int(os.environ.get("PORT", "8000"))
CACHE_TTL_SECONDS = 20 * 60

WORLD_FALLBACK = [
    {
        "id": "world-fallback-1",
        "title": "全球主要资本市场关注央行政策窗口",
        "summary": "实时新闻源不可用时，系统会回退到这一组后备观察主题，确保界面持续可读。",
        "region": "Global Macro",
        "signal": "后备数据",
        "relevance": "资金流向、汇率与成长股估值",
        "timestamp": "本地后备",
        "url": "",
        "provider": "本地后备",
        "linkLabel": "",
    },
    {
        "id": "world-fallback-2",
        "title": "中东与红海航运风险仍在牵动能源与物流",
        "summary": "地缘风险、航运路径和能源价格仍是全球宏观新闻中的高频线索。",
        "region": "Middle East",
        "signal": "后备数据",
        "relevance": "能源价格、运费与供应链韧性",
        "timestamp": "本地后备",
        "url": "",
        "provider": "本地后备",
        "linkLabel": "",
    },
]

RESEARCH_FALLBACK = [
    {
        "id": "research-fallback-1",
        "title": "多智能体工作流从 demo 转向可控生产化",
        "summary": "后备研究流仍然会保留最近值得跟踪的 AI / NLP 方向，避免页面出现空状态。",
        "domain": "Agents",
        "signal": "后备数据",
        "relevance": "工作流自动化、企业 Copilot、复杂任务分解",
        "timestamp": "本地后备",
        "url": "",
        "provider": "本地后备",
        "linkLabel": "",
    },
    {
        "id": "research-fallback-2",
        "title": "长上下文模型继续探索检索与压缩协同",
        "summary": "检索增强、记忆压缩和结构化状态管理仍然是近阶段的重要研究议题。",
        "domain": "LLM Systems",
        "signal": "后备数据",
        "relevance": "知识助手、代码理解、长文档分析",
        "timestamp": "本地后备",
        "url": "",
        "provider": "本地后备",
        "linkLabel": "",
    },
]

feed_cache: dict[tuple[str, str], dict[str, Any]] = {}


class PulseDeckHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".webmanifest": "application/manifest+json",
    }

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)

        if parsed.path == "/api/health":
            self.respond_json({"status": "ok", "time": utc_now_iso()})
            return

        if parsed.path in {"/api/world", "/api/research"}:
            query = parse_qs(parsed.query)
            keywords = normalize_keywords(query.get("keywords", [""])[0])
            feed_type = "world" if parsed.path.endswith("/world") else "research"
            payload = get_cached_feed(feed_type, keywords)
            self.respond_json(payload)
            return

        return super().do_GET()

    def respond_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status.value)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)


def get_cached_feed(feed_type: str, keywords: list[str]) -> dict[str, Any]:
    cache_key = (feed_type, ",".join(keywords))
    cached = feed_cache.get(cache_key)
    now = time.time()

    if cached and now - cached["stored_at"] < CACHE_TTL_SECONDS:
        return cached["payload"]

    payload = build_world_feed_payload(keywords) if feed_type == "world" else build_research_feed_payload(keywords)
    feed_cache[cache_key] = {"stored_at": now, "payload": payload}
    return payload


def build_world_feed_payload(keywords: list[str]) -> dict[str, Any]:
    params = {
        "query": build_world_query(keywords),
        "mode": "ArtList",
        "maxrecords": "10",
        "timespan": "24h",
        "sort": "datedesc",
        "format": "json",
    }

    try:
        payload = fetch_json("https://api.gdeltproject.org/api/v2/doc/doc", params)
        articles = payload.get("articles") or []
        items = [map_gdelt_article(article, index) for index, article in enumerate(articles[:6])]
        items = [item for item in items if item["title"]]
        if not items:
            raise ValueError("news source returned no articles")
        return {
            "mode": "live",
            "provider": "GDELT News API",
            "fetchedAt": utc_now_iso(),
            "error": None,
            "items": items,
        }
    except (HTTPError, URLError, TimeoutError, ValueError) as error:
        return {
            "mode": "fallback",
            "provider": "本地后备",
            "fetchedAt": utc_now_iso(),
            "error": str(error),
            "items": WORLD_FALLBACK,
        }


def build_research_feed_payload(keywords: list[str]) -> dict[str, Any]:
    queries = build_research_queries(keywords)
    papers: list[dict[str, Any]] = []
    seen: set[str] = set()

    try:
        for index, (label, query) in enumerate(queries):
            if index:
                time.sleep(1.05)

            payload = fetch_json(
                "https://api.semanticscholar.org/graph/v1/paper/search/bulk",
                {
                    "query": query,
                    "fields": (
                        "title,url,abstract,publicationDate,citationCount,authors,year,venue,openAccessPdf,paperId"
                    ),
                    "year": f"{datetime.now().year - 1}-",
                },
            )

            for paper in payload.get("data") or []:
                mapped = map_semantic_scholar_paper(paper, label)
                if not mapped["title"]:
                    continue
                if not is_ai_nlp_paper(mapped["title"], mapped["summary"], mapped["relevance"], mapped["domain"]):
                    continue
                key = mapped["url"] or mapped["title"]
                if key in seen:
                    continue
                seen.add(key)
                papers.append(mapped)

        papers.sort(
            key=lambda paper: (
                paper.get("_sort_date", ""),
                paper.get("_sort_citations", 0),
            ),
            reverse=True,
        )

        items = [strip_sort_fields(item) for item in papers[:6]]
        if not items:
            raise ValueError("research source returned no papers")

        return {
            "mode": "live",
            "provider": "Semantic Scholar",
            "fetchedAt": utc_now_iso(),
            "error": None,
            "items": items,
        }
    except (HTTPError, URLError, TimeoutError, ValueError) as error:
        return {
            "mode": "fallback",
            "provider": "本地后备",
            "fetchedAt": utc_now_iso(),
            "error": str(error),
            "items": RESEARCH_FALLBACK,
        }


def fetch_json(base_url: str, params: dict[str, str]) -> dict[str, Any]:
    request = Request(
        f"{base_url}?{urlencode(params)}",
        headers={
            "User-Agent": "PulseDeck/1.0 (+https://local.app)",
            "Accept": "application/json",
        },
    )
    with urlopen(request, timeout=20) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return json.loads(response.read().decode(charset))


def build_world_query(keywords: list[str]) -> str:
    base_terms = [
        '"geopolitics"',
        '"global economy"',
        '"technology policy"',
        '"energy market"',
    ]
    extra_terms = [quote_term(keyword) for keyword in keywords[:2]]
    return f"({' OR '.join(base_terms + extra_terms)})"


def build_research_queries(keywords: list[str]) -> list[tuple[str, str]]:
    queries = [
        ("LLM", '"large language model"'),
        ("NLP", '"natural language processing"'),
        ("Agents", '"LLM agent"'),
        ("Multimodal", '"multimodal learning"'),
    ]
    research_markers = {
        "ai",
        "agent",
        "llm",
        "nlp",
        "openai",
        "transformer",
        "reasoning",
        "multimodal",
        "retrieval",
        "rag",
        "speech",
        "vision",
    }

    for keyword in keywords:
        lowered = keyword.lower()
        if not any(marker in lowered for marker in research_markers):
            continue
        candidate = (keyword[:24], quote_term(keyword))
        if candidate not in queries:
            queries.append(candidate)
        if len(queries) >= 5:
            break

    return queries


def is_ai_nlp_paper(title: str, summary: str, relevance: str, domain: str) -> bool:
    haystack = f"{title} {summary} {relevance} {domain}".lower()
    markers = [
        "large language model",
        "language model",
        "llm",
        "natural language",
        "nlp",
        "generative ai",
        "foundation model",
        "transformer",
        "prompt",
        "retrieval",
        "rag",
        "multimodal",
        "agentic",
        "openai",
        "reasoning model",
        "vision-language",
    ]
    return any(marker in haystack for marker in markers)


def map_gdelt_article(article: dict[str, Any], index: int) -> dict[str, str]:
    title = clean_text(article.get("title"))
    url = clean_text(article.get("url"))
    domain = clean_text(article.get("domain")) or "Global News"
    country = clean_text(article.get("sourcecountry")) or "Global"
    language = clean_text(article.get("language")) or "mixed"
    seen_date = format_remote_time(clean_text(article.get("seendate")))
    summary = clean_text(article.get("excerpt"))

    if not summary:
        summary = f"来自 {domain} 的最新报道，聚焦 {country} 相关议题，当前语言标记为 {language.upper()}。"

    return {
        "id": f"world-{index}-{url or title}",
        "title": title,
        "summary": truncate(summary, 180),
        "region": country,
        "signal": "实时新闻流",
        "relevance": domain,
        "timestamp": seen_date or "刚刚更新",
        "url": url,
        "provider": "GDELT News API",
        "linkLabel": "查看报道",
    }


def map_semantic_scholar_paper(paper: dict[str, Any], label: str) -> dict[str, Any]:
    title = clean_text(paper.get("title"))
    abstract = clean_text(paper.get("abstract"))
    url = clean_text(paper.get("url"))
    venue = clean_text(paper.get("venue")) or "Semantic Scholar"
    publication_date = clean_text(paper.get("publicationDate"))
    citations = paper.get("citationCount") or 0
    authors = ", ".join(
        clean_text(author.get("name")) for author in (paper.get("authors") or [])[:3] if author.get("name")
    )
    pdf = ""
    if isinstance(paper.get("openAccessPdf"), dict):
        pdf = clean_text(paper["openAccessPdf"].get("url"))

    if not abstract:
        abstract = f"{venue} 收录的最新研究条目，方向标签为 {label}。"

    link = pdf or url
    return {
        "id": clean_text(paper.get("paperId")) or f"paper-{title}",
        "title": title,
        "summary": truncate(abstract, 220),
        "domain": infer_research_domain(title, abstract, label),
        "signal": f"{citations} citations" if citations else "recent paper",
        "relevance": authors or venue,
        "timestamp": publication_date or str(paper.get("year") or "") or "最新",
        "url": link,
        "provider": "Semantic Scholar",
        "linkLabel": "查看 PDF" if pdf else "查看论文",
        "_sort_date": publication_date or str(paper.get("year") or ""),
        "_sort_citations": citations,
    }


def infer_research_domain(title: str, abstract: str, label: str) -> str:
    haystack = f"{title} {abstract}".lower()
    if "agent" in haystack:
        return "Agents"
    if "multimodal" in haystack or "vision" in haystack:
        return "Multimodal"
    if "speech" in haystack or "audio" in haystack:
        return "Speech"
    if "retrieval" in haystack or "rag" in haystack:
        return "RAG"
    if "reasoning" in haystack:
        return "Reasoning"
    if "language" in haystack or "nlp" in haystack:
        return "NLP"
    if "large language model" in haystack or "llm" in haystack:
        return "LLM"
    return label


def strip_sort_fields(item: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in item.items() if not key.startswith("_")}


def normalize_keywords(raw: str) -> list[str]:
    parts = [segment.strip() for segment in raw.replace("\n", ",").split(",")]
    unique: list[str] = []
    seen_lower: set[str] = set()

    for part in parts:
        if not part:
            continue
        lowered = part.lower()
        if lowered in seen_lower:
            continue
        seen_lower.add(lowered)
        unique.append(part)
        if len(unique) >= 6:
            break

    return unique


@lru_cache(maxsize=64)
def quote_term(value: str) -> str:
    return '"' + value.replace('"', "") + '"'


def truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return f"{text[: limit - 1].rstrip()}…"


def clean_text(value: Any) -> str:
    return str(value).strip() if value else ""


def format_remote_time(raw_value: str) -> str:
    if not raw_value:
        return ""
    for pattern in ("%Y%m%dT%H%M%SZ", "%Y-%m-%d", "%Y-%m-%dT%H:%M:%S"):
        try:
            parsed = datetime.strptime(raw_value, pattern)
            return parsed.strftime("%m/%d %H:%M")
        except ValueError:
            continue
    return raw_value


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def run() -> None:
    server = ThreadingHTTPServer((HOST, PORT), PulseDeckHandler)
    print(f"PulseDeck running at http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    run()
