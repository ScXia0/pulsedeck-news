#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import html
import json
import os
import random
import re
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
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
MUSIC_ART_TTL_SECONDS = 7 * 24 * 60 * 60
WORLD_POOL_LIMIT = 48
RESEARCH_POOL_LIMIT = 42
MUSIC_POOL_LIMIT = 54
ENTERTAINMENT_POOL_LIMIT = 48
BATCH_SIZE = 6
ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}
REQUEST_HEADERS = {
    "User-Agent": "XscNews/1.0 (+https://xscnews.local)",
    "Accept": "application/json, application/rss+xml, application/atom+xml, text/xml, application/xml;q=0.9, */*;q=0.8",
}

WORLD_FALLBACK = [
    {
        "id": "world-fallback-1",
        "title": "全球主要资本市场关注央行政策窗口",
        "summary": "实时新闻源不可用时，系统会回退到后备内容池，确保你依旧可以换一批查看不同主题。",
        "region": "Global Macro",
        "signal": "后备数据",
        "relevance": "资金流向、汇率与成长股估值",
        "timestamp": "本地后备",
        "url": "https://www.bing.com/news/search?q=%E5%85%A8%E7%90%83%E4%B8%BB%E8%A6%81%E8%B5%84%E6%9C%AC%E5%B8%82%E5%9C%BA%E5%85%B3%E6%B3%A8%E5%A4%AE%E8%A1%8C%E6%94%BF%E7%AD%96%E7%AA%97%E5%8F%A3",
        "provider": "本地后备",
        "linkLabel": "查看线索",
    },
    {
        "id": "world-fallback-2",
        "title": "中东与红海航运风险仍在牵动能源与物流",
        "summary": "当地缘风险重新升温时，能源价格、物流成本和全球供应链都会出现连锁反馈。",
        "region": "Middle East",
        "signal": "后备数据",
        "relevance": "能源价格、运费与供应链韧性",
        "timestamp": "本地后备",
        "url": "https://www.bing.com/news/search?q=%E7%BA%A2%E6%B5%B7+%E8%88%AA%E8%BF%90+%E8%83%BD%E6%BA%90",
        "provider": "本地后备",
        "linkLabel": "查看线索",
    },
    {
        "id": "world-fallback-3",
        "title": "全球 AI 基础设施投资持续扩张",
        "summary": "算力、数据中心、电力与冷却系统正在成为全球科技投资中的重要主线。",
        "region": "Tech",
        "signal": "后备数据",
        "relevance": "算力、芯片、云服务与电力建设",
        "timestamp": "本地后备",
        "url": "https://www.bing.com/news/search?q=AI+infrastructure+data+center+investment",
        "provider": "本地后备",
        "linkLabel": "查看线索",
    },
    {
        "id": "world-fallback-4",
        "title": "平台治理与数据合规规则继续变化",
        "summary": "生成式 AI、平台责任和跨境数据流依然是科技监管的重要观察方向。",
        "region": "Policy",
        "signal": "后备数据",
        "relevance": "合规成本、产品设计与跨境数据流",
        "timestamp": "本地后备",
        "url": "https://www.bing.com/news/search?q=AI+policy+data+regulation",
        "provider": "本地后备",
        "linkLabel": "查看线索",
    },
    {
        "id": "world-fallback-5",
        "title": "全球创业投资仍然偏好 AI 与高效率软件",
        "summary": "投资逻辑更偏向真实收入、明确场景和成本效率，而不是纯概念故事。",
        "region": "Venture",
        "signal": "后备数据",
        "relevance": "创业公司融资窗口与赛道判断",
        "timestamp": "本地后备",
        "url": "https://www.bing.com/news/search?q=AI+startup+funding+software",
        "provider": "本地后备",
        "linkLabel": "查看线索",
    },
]

RESEARCH_FALLBACK = [
    {
        "id": "research-fallback-1",
        "title": "多智能体工作流从 demo 转向可控生产化",
        "summary": "Agent 体系正在从单轮演示走向更可靠的任务闭环和工程落地。",
        "domain": "Agents",
        "signal": "后备数据",
        "relevance": "工作流自动化、企业 Copilot、复杂任务分解",
        "timestamp": "本地后备",
        "url": "https://www.semanticscholar.org/search?q=multi-agent%20workflow%20llm",
        "provider": "本地后备",
        "linkLabel": "搜索论文",
    },
    {
        "id": "research-fallback-2",
        "title": "长上下文模型继续探索检索与压缩协同",
        "summary": "检索增强、记忆压缩和结构化状态管理仍然是提升长文档能力的重要路径。",
        "domain": "LLM Systems",
        "signal": "后备数据",
        "relevance": "知识助手、代码理解、长文档分析",
        "timestamp": "本地后备",
        "url": "https://www.semanticscholar.org/search?q=long%20context%20llm%20retrieval",
        "provider": "本地后备",
        "linkLabel": "搜索论文",
    },
    {
        "id": "research-fallback-3",
        "title": "小模型蒸馏与高效推理仍然很关键",
        "summary": "端侧部署、私有化推理和成本优化继续推动高效模型研究。",
        "domain": "Efficient AI",
        "signal": "后备数据",
        "relevance": "移动端部署、私有化模型、成本优化",
        "timestamp": "本地后备",
        "url": "https://www.semanticscholar.org/search?q=small%20language%20model%20distillation",
        "provider": "本地后备",
        "linkLabel": "搜索论文",
    },
    {
        "id": "research-fallback-4",
        "title": "多模态理解与推理正在持续深化",
        "summary": "视觉、语音与文本协同推理仍是下一阶段智能助手的重要能力基础。",
        "domain": "Multimodal",
        "signal": "后备数据",
        "relevance": "智能助手、机器人、人机交互",
        "timestamp": "本地后备",
        "url": "https://www.semanticscholar.org/search?q=multimodal%20reasoning%20model",
        "provider": "本地后备",
        "linkLabel": "搜索论文",
    },
    {
        "id": "research-fallback-5",
        "title": "NLP 评测越来越强调真实任务效果",
        "summary": "线上稳定性、鲁棒性和任务完成率正在比单点 benchmark 分数更重要。",
        "domain": "Evaluation",
        "signal": "后备数据",
        "relevance": "模型选型、线上监控、质量基准",
        "timestamp": "本地后备",
        "url": "https://www.semanticscholar.org/search?q=nlp%20evaluation%20robustness",
        "provider": "本地后备",
        "linkLabel": "搜索论文",
    },
]

MUSIC_FALLBACK = [
    {
        "id": "music-fallback-1",
        "title": "Ordinary",
        "artist": "Alex Warren",
        "summary": "近期在主流播放平台和短视频里都很活跃，适合用来代表当下的高热单曲。",
        "genre": "Pop",
        "signal": "后备数据",
        "relevance": "Alex Warren",
        "timestamp": "本地后备",
        "url": "https://www.youtube.com/results?search_query=Ordinary+Alex+Warren+official+audio",
        "provider": "本地后备",
        "linkLabel": "听歌 / 视频",
    },
    {
        "id": "music-fallback-2",
        "title": "Die With A Smile",
        "artist": "Lady Gaga & Bruno Mars",
        "summary": "跨平台传播力强，常见于热门歌单、翻唱和视频剪辑内容里。",
        "genre": "Pop",
        "signal": "后备数据",
        "relevance": "Lady Gaga & Bruno Mars",
        "timestamp": "本地后备",
        "url": "https://www.youtube.com/results?search_query=Die+With+A+Smile+Lady+Gaga+Bruno+Mars+official+audio",
        "provider": "本地后备",
        "linkLabel": "听歌 / 视频",
    },
    {
        "id": "music-fallback-3",
        "title": "APT.",
        "artist": "ROSÉ & Bruno Mars",
        "summary": "兼具全球热度和亚洲讨论度，是近期跨区传播非常强的代表性热歌。",
        "genre": "Global Pop",
        "signal": "后备数据",
        "relevance": "ROSÉ & Bruno Mars",
        "timestamp": "本地后备",
        "url": "https://www.youtube.com/results?search_query=APT+ROSE+Bruno+Mars+official+audio",
        "provider": "本地后备",
        "linkLabel": "听歌 / 视频",
    },
    {
        "id": "music-fallback-4",
        "title": "Beautiful Things",
        "artist": "Benson Boone",
        "summary": "在流媒体和翻唱生态里持续保持高曝光，属于很稳的热门单曲。",
        "genre": "Pop Rock",
        "signal": "后备数据",
        "relevance": "Benson Boone",
        "timestamp": "本地后备",
        "url": "https://www.youtube.com/results?search_query=Beautiful+Things+Benson+Boone+official+audio",
        "provider": "本地后备",
        "linkLabel": "听歌 / 视频",
    },
    {
        "id": "music-fallback-5",
        "title": "Birds of a Feather",
        "artist": "Billie Eilish",
        "summary": "兼具审美型用户与主流用户关注度，常被各类精选歌单反复收录。",
        "genre": "Alt Pop",
        "signal": "后备数据",
        "relevance": "Billie Eilish",
        "timestamp": "本地后备",
        "url": "https://www.youtube.com/results?search_query=Birds+of+a+Feather+Billie+Eilish+official+audio",
        "provider": "本地后备",
        "linkLabel": "听歌 / 视频",
    },
    {
        "id": "music-fallback-6",
        "title": "Lose Control",
        "artist": "Teddy Swims",
        "summary": "电台、流媒体和现场表演传播都比较稳，适合做热歌池的高频补位。",
        "genre": "Soul Pop",
        "signal": "后备数据",
        "relevance": "Teddy Swims",
        "timestamp": "本地后备",
        "url": "https://www.youtube.com/results?search_query=Lose+Control+Teddy+Swims+official+audio",
        "provider": "本地后备",
        "linkLabel": "听歌 / 视频",
    },
]

ENTERTAINMENT_FALLBACK = [
    {
        "id": "entertainment-fallback-1",
        "title": "流媒体平台新剧动态继续带动娱乐关注",
        "summary": "从上线排期到续订消息，平台内容节奏依旧是娱乐新闻里最稳定的热点来源。",
        "category": "Streaming",
        "signal": "后备数据",
        "relevance": "平台上新、续订节奏、话题发酵",
        "timestamp": "本地后备",
        "url": "https://www.bing.com/news/search?q=streaming+series+entertainment+news",
        "provider": "本地后备",
        "linkLabel": "查看娱乐线索",
    },
    {
        "id": "entertainment-fallback-2",
        "title": "电影票房与口碑表现仍在牵动文娱讨论",
        "summary": "票房走势、媒体评价和观众反馈会直接影响新片后续宣传与社交传播强度。",
        "category": "Box Office",
        "signal": "后备数据",
        "relevance": "票房、口碑、宣传节奏",
        "timestamp": "本地后备",
        "url": "https://www.bing.com/news/search?q=box+office+movie+entertainment+news",
        "provider": "本地后备",
        "linkLabel": "查看娱乐线索",
    },
    {
        "id": "entertainment-fallback-3",
        "title": "明星官宣与合作项目持续制造娱乐流量",
        "summary": "演员加盟、合作确认和公开活动仍是最容易形成扩散的娱乐新闻类型。",
        "category": "Celebrity",
        "signal": "后备数据",
        "relevance": "官宣、合作、公开活动",
        "timestamp": "本地后备",
        "url": "https://www.bing.com/news/search?q=celebrity+entertainment+news",
        "provider": "本地后备",
        "linkLabel": "查看娱乐线索",
    },
    {
        "id": "entertainment-fallback-4",
        "title": "奖项前哨与提名预测开始抬升讨论度",
        "summary": "娱乐媒体对提名预测、首波获奖名单和红毯前哨的跟进通常会非常密集。",
        "category": "Awards",
        "signal": "后备数据",
        "relevance": "提名预测、颁奖季、红毯话题",
        "timestamp": "本地后备",
        "url": "https://www.bing.com/news/search?q=awards+season+entertainment+news",
        "provider": "本地后备",
        "linkLabel": "查看娱乐线索",
    },
    {
        "id": "entertainment-fallback-5",
        "title": "综艺与真人秀新季消息保持高讨论",
        "summary": "嘉宾阵容、播出时间和节目机制变化经常会在社交平台快速扩散。",
        "category": "Variety Show",
        "signal": "后备数据",
        "relevance": "新季、嘉宾阵容、社交讨论",
        "timestamp": "本地后备",
        "url": "https://www.bing.com/news/search?q=variety+show+entertainment+news",
        "provider": "本地后备",
        "linkLabel": "查看娱乐线索",
    },
]

WORLD_RSS_SOURCES = [
    {"provider": "BBC World", "url": "https://feeds.bbci.co.uk/news/world/rss.xml", "region": "World"},
    {"provider": "BBC Business", "url": "https://feeds.bbci.co.uk/news/business/rss.xml", "region": "Business"},
    {"provider": "BBC Technology", "url": "https://feeds.bbci.co.uk/news/technology/rss.xml", "region": "Technology"},
    {
        "provider": "BBC Science",
        "url": "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml",
        "region": "Science",
    },
    {"provider": "Guardian World", "url": "https://www.theguardian.com/world/rss", "region": "World"},
    {"provider": "Guardian Business", "url": "https://www.theguardian.com/business/rss", "region": "Business"},
    {"provider": "Guardian Tech", "url": "https://www.theguardian.com/uk/technology/rss", "region": "Technology"},
    {"provider": "NYT World", "url": "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", "region": "World"},
    {
        "provider": "NYT Technology",
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml",
        "region": "Technology",
    },
    {
        "provider": "Google News Top",
        "url": "https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en",
        "region": "Top Stories",
    },
]

WORLD_GOOGLE_QUERIES = [
    ("Geopolitics", '"geopolitics" OR "international relations"'),
    ("Global Economy", '"global economy" OR inflation OR interest rate'),
    ("AI Business", '"AI" startup funding OR model release'),
    ("Energy", '"energy market" OR oil OR gas OR shipping'),
    ("Cybersecurity", '"cybersecurity" OR "data breach"'),
]

WORLD_GDELT_QUERIES = [
    ("Geo", '"geopolitics" OR "international conflict"'),
    ("Economy", '"global economy" OR "central bank" OR inflation'),
    ("AI", '"artificial intelligence" OR "AI startup" OR "foundation model"'),
]

RESEARCH_ARXIV_QUERIES = [
    ("LLM", 'all:"large language model"'),
    ("NLP", "cat:cs.CL"),
    ("Agents", 'all:"llm agent" OR all:"ai agent"'),
    ("Multimodal", 'all:multimodal OR all:"vision language"'),
    ("RAG", 'all:retrieval OR all:"retrieval augmented generation"'),
]

RESEARCH_SEMANTIC_QUERIES = [
    ("LLM", '"large language model"'),
    ("NLP", '"natural language processing"'),
    ("Agents", '"llm agent"'),
    ("Multimodal", '"multimodal reasoning"'),
]

MUSIC_BILLBOARD_SOURCES = [
    {
        "kind": "billboard",
        "provider": "Billboard Hot 100",
        "url": "https://www.billboard.com/charts/hot-100/",
        "genre": "US Top",
        "chart": "Hot 100",
    },
    {
        "kind": "billboard",
        "provider": "Billboard Global 200",
        "url": "https://www.billboard.com/charts/billboard-global-200/",
        "genre": "Global",
        "chart": "Global 200",
    },
    {
        "kind": "billboard",
        "provider": "Billboard Global Excl. US",
        "url": "https://www.billboard.com/charts/billboard-global-excl-us/",
        "genre": "Global",
        "chart": "Global Excl. US",
    },
    {
        "kind": "billboard",
        "provider": "Billboard Japan Hot 100",
        "url": "https://www.billboard.com/charts/japan-hot-100/",
        "genre": "Japan",
        "chart": "Japan Hot 100",
    },
    {
        "kind": "billboard",
        "provider": "Billboard Korea Hot 100",
        "url": "https://www.billboard.com/charts/billboard-korea-hot-100/",
        "genre": "K-Pop",
        "chart": "Korea Hot 100",
    },
    {
        "kind": "billboard",
        "provider": "Billboard Hot Rock & Alternative",
        "url": "https://www.billboard.com/charts/hot-rock-songs/",
        "genre": "Rock / Alt",
        "chart": "Hot Rock & Alternative Songs",
    },
    {
        "kind": "billboard",
        "provider": "Billboard Hot R&B / Hip-Hop",
        "url": "https://www.billboard.com/charts/r-b-hip-hop-songs/",
        "genre": "R&B / Hip-Hop",
        "chart": "Hot R&B / Hip-Hop Songs",
    },
    {
        "kind": "billboard",
        "provider": "Billboard Hot Country",
        "url": "https://www.billboard.com/charts/country-songs/",
        "genre": "Country",
        "chart": "Hot Country Songs",
    },
]

ENTERTAINMENT_RSS_SOURCES = [
    {
        "provider": "BBC Entertainment",
        "url": "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",
        "category": "Entertainment",
    },
    {"provider": "Guardian Film", "url": "https://www.theguardian.com/film/rss", "category": "Film"},
    {"provider": "Guardian TV", "url": "https://www.theguardian.com/tv-and-radio/rss", "category": "TV"},
    {"provider": "NYT Arts", "url": "https://rss.nytimes.com/services/xml/rss/nyt/Arts.xml", "category": "Arts"},
    {
        "provider": "NYT Movies",
        "url": "https://rss.nytimes.com/services/xml/rss/nyt/Movies.xml",
        "category": "Movies",
    },
]

ENTERTAINMENT_GOOGLE_QUERIES = [
    ("Streaming", '"streaming series" OR Netflix OR Disney OR HBO OR trailer'),
    ("Celebrity", '"celebrity" OR actor OR actress OR red carpet'),
    ("Awards", '"awards season" OR Emmy OR Oscar OR Grammy'),
    ("Box Office", '"box office" OR movie release OR casting'),
    ("TV Shows", '"tv series" OR finale OR renewal OR cancellation'),
]

feed_cache: dict[tuple[str, str], dict[str, Any]] = {}
music_art_cache: dict[str, dict[str, Any]] = {}
link_image_cache: dict[str, dict[str, Any]] = {}


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

        if parsed.path == "/api/music-art":
            query = parse_qs(parsed.query)
            title = clean_text(query.get("title", [""])[0])
            artist = clean_text(query.get("artist", [""])[0])
            artwork = resolve_music_artwork({"title": title, "artist": artist})
            if artwork:
                self.send_response(HTTPStatus.FOUND.value)
                self.send_header("Location", artwork)
                self.send_header("Cache-Control", "public, max-age=86400")
                self.end_headers()
                return
            self.send_response(HTTPStatus.NOT_FOUND.value)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return

        if parsed.path in {"/api/world", "/api/research", "/api/music", "/api/entertainment"}:
            query = parse_qs(parsed.query)
            keywords = normalize_keywords(query.get("keywords", [""])[0])
            force_refresh = query.get("force", ["0"])[0] == "1"
            if parsed.path.endswith("/world"):
                feed_type = "world"
            elif parsed.path.endswith("/research"):
                feed_type = "research"
            elif parsed.path.endswith("/music"):
                feed_type = "music"
            else:
                feed_type = "entertainment"
            payload = get_cached_feed(feed_type, keywords, force_refresh=force_refresh)
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


def get_cached_feed(feed_type: str, keywords: list[str], force_refresh: bool = False) -> dict[str, Any]:
    cache_key = (feed_type, ",".join(keywords))
    cached = feed_cache.get(cache_key)
    now = time.time()

    if not force_refresh and cached and now - cached["stored_at"] < CACHE_TTL_SECONDS:
        return cached["payload"]

    if feed_type == "world":
        payload = build_world_feed_payload(keywords)
    elif feed_type == "research":
        payload = build_research_feed_payload(keywords)
    elif feed_type == "music":
        payload = build_music_feed_payload()
    else:
        payload = build_entertainment_feed_payload(keywords)
    feed_cache[cache_key] = {"stored_at": now, "payload": payload}
    return payload


def build_world_feed_payload(keywords: list[str]) -> dict[str, Any]:
    sources = build_world_sources(keywords)
    items, errors = gather_source_items(sources, fetch_world_source, max_workers=8)
    pool = diversify_and_limit(dedupe_items(items), WORLD_POOL_LIMIT)

    if not pool:
        return fallback_payload("world", errors)

    pool = enrich_items_with_link_images(pool)

    providers = summarize_providers(pool)
    return {
        "mode": "live",
        "provider": f"{len(providers)} 个资讯源",
        "providers": providers,
        "fetchedAt": utc_now_iso(),
        "error": summarize_errors(errors),
        "poolSize": len(pool),
        "batchSize": BATCH_SIZE,
        "items": pool,
    }


def build_research_feed_payload(keywords: list[str]) -> dict[str, Any]:
    sources = build_research_sources(keywords)
    items, errors = gather_source_items(sources, fetch_research_source, max_workers=6)
    filtered = [
        item
        for item in items
        if is_ai_nlp_paper(item["title"], item["summary"], item["relevance"], item["domain"])
    ]
    pool = diversify_and_limit(dedupe_items(filtered), RESEARCH_POOL_LIMIT)

    if not pool:
        return fallback_payload("research", errors)

    providers = summarize_providers(pool)
    return {
        "mode": "live",
        "provider": f"{len(providers)} 个研究源",
        "providers": providers,
        "fetchedAt": utc_now_iso(),
        "error": summarize_errors(errors),
        "poolSize": len(pool),
        "batchSize": BATCH_SIZE,
        "items": pool,
    }


def build_music_feed_payload() -> dict[str, Any]:
    items, errors = gather_source_items(MUSIC_BILLBOARD_SOURCES, fetch_music_source, max_workers=5)
    pool = diversify_and_limit(dedupe_items(items), MUSIC_POOL_LIMIT)

    if not pool:
        return fallback_payload("music", errors)

    pool = enrich_music_items_with_artwork(pool)

    providers = summarize_providers(pool)
    return {
        "mode": "live",
        "provider": f"{len(providers)} 个音乐榜单源",
        "providers": providers,
        "fetchedAt": utc_now_iso(),
        "error": summarize_errors(errors),
        "poolSize": len(pool),
        "batchSize": BATCH_SIZE,
        "items": pool,
    }


def build_entertainment_feed_payload(keywords: list[str]) -> dict[str, Any]:
    sources = build_entertainment_sources(keywords)
    items, errors = gather_source_items(sources, fetch_entertainment_source, max_workers=6)
    pool = diversify_and_limit(dedupe_items(items), ENTERTAINMENT_POOL_LIMIT)

    if not pool:
        return fallback_payload("entertainment", errors)

    pool = enrich_items_with_link_images(pool)

    providers = summarize_providers(pool)
    return {
        "mode": "live",
        "provider": f"{len(providers)} 个娱乐资讯源",
        "providers": providers,
        "fetchedAt": utc_now_iso(),
        "error": summarize_errors(errors),
        "poolSize": len(pool),
        "batchSize": BATCH_SIZE,
        "items": pool,
    }


def fallback_payload(feed_type: str, errors: list[str]) -> dict[str, Any]:
    base_items = (
        WORLD_FALLBACK
        if feed_type == "world"
        else RESEARCH_FALLBACK
        if feed_type == "research"
        else MUSIC_FALLBACK
        if feed_type == "music"
        else ENTERTAINMENT_FALLBACK
    )
    items = enrich_music_items_with_artwork(base_items) if feed_type == "music" else [dict(item) for item in base_items]
    providers = summarize_providers(items)
    label = "本地后备"
    return {
        "mode": "fallback",
        "provider": label,
        "providers": providers,
        "fetchedAt": utc_now_iso(),
        "error": summarize_errors(errors),
        "poolSize": len(items),
        "batchSize": BATCH_SIZE,
        "items": items,
    }


def enrich_items_with_link_images(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    enriched = [dict(item) for item in items]
    pending = [
        (index, item)
        for index, item in enumerate(enriched)
        if item.get("url") and not item.get("image") and not str(item.get("url")).lower().endswith(".pdf")
    ]
    if not pending:
        return enriched

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {
            executor.submit(resolve_link_preview_image, str(item.get("url", ""))): index
            for index, item in pending[:24]
        }
        for future in as_completed(futures):
            index = futures[future]
            try:
                image = future.result()
            except Exception:  # noqa: BLE001
                image = ""
            if image:
                enriched[index]["image"] = image

    return enriched


def build_world_sources(keywords: list[str]) -> list[dict[str, Any]]:
    sources = [{"kind": "rss", **source} for source in WORLD_RSS_SOURCES]

    for label, query in WORLD_GOOGLE_QUERIES:
        sources.append(
            {
                "kind": "rss",
                "provider": f"Google News {label}",
                "url": build_google_news_url(query),
                "region": label,
            }
        )

    for keyword in keywords[:3]:
        sources.append(
            {
                "kind": "rss",
                "provider": f"Google News {keyword[:20]}",
                "url": build_google_news_url(quote_phrase(keyword)),
                "region": "Keyword",
            }
        )

    for label, query in WORLD_GDELT_QUERIES:
        sources.append(
            {
                "kind": "gdelt",
                "provider": f"GDELT {label}",
                "query": build_gdelt_query(query, keywords),
            }
        )

    return sources


def build_research_sources(keywords: list[str]) -> list[dict[str, Any]]:
    sources = [{"kind": "arxiv", "provider": f"arXiv {label}", "topic": label, "query": query} for label, query in RESEARCH_ARXIV_QUERIES]
    sources.extend(
        {
            "kind": "semantic",
            "provider": f"Semantic Scholar {label}",
            "topic": label,
            "query": query,
        }
        for label, query in RESEARCH_SEMANTIC_QUERIES
    )

    for keyword in keywords[:3]:
        lowered = keyword.lower()
        if not any(marker in lowered for marker in ("ai", "llm", "nlp", "agent", "multimodal", "rag", "language")):
            continue
        sources.append(
            {
                "kind": "arxiv",
                "provider": f"arXiv {keyword[:18]}",
                "topic": keyword[:18],
                "query": f'all:"{keyword}"',
            }
        )
        sources.append(
            {
                "kind": "semantic",
                "provider": f"Semantic Scholar {keyword[:18]}",
                "topic": keyword[:18],
                "query": quote_phrase(keyword),
            }
        )

    return sources


def build_entertainment_sources(keywords: list[str]) -> list[dict[str, Any]]:
    sources = [{"kind": "rss", **source} for source in ENTERTAINMENT_RSS_SOURCES]

    for label, query in ENTERTAINMENT_GOOGLE_QUERIES:
        sources.append(
            {
                "kind": "rss",
                "provider": f"Google News {label}",
                "url": build_google_news_url(query),
                "category": label,
            }
        )

    for keyword in keywords[:3]:
        lowered = keyword.lower()
        if any(marker in lowered for marker in ("movie", "film", "tv", "show", "celebrity", "music", "drama", "streaming", "actor")):
            sources.append(
                {
                    "kind": "rss",
                    "provider": f"Google News {keyword[:20]}",
                    "url": build_google_news_url(quote_phrase(keyword)),
                    "category": "Keyword",
                }
            )

    return sources


def gather_source_items(
    sources: list[dict[str, Any]],
    fetcher: Any,
    max_workers: int,
) -> tuple[list[dict[str, Any]], list[str]]:
    items: list[dict[str, Any]] = []
    errors: list[str] = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(fetcher, source): source for source in sources}
        for future in as_completed(futures):
            source = futures[future]
            try:
                items.extend(future.result())
            except Exception as error:  # noqa: BLE001
                errors.append(f"{source['provider']}: {error}")

    return items, errors


def fetch_world_source(source: dict[str, Any]) -> list[dict[str, Any]]:
    if source["kind"] == "rss":
        xml_text = fetch_text(source["url"], timeout=6)
        return parse_rss_feed(xml_text, source["provider"], source.get("region", "World"))

    if source["kind"] == "gdelt":
        payload = fetch_json(
            "https://api.gdeltproject.org/api/v2/doc/doc",
            {
                "query": source["query"],
                "mode": "ArtList",
                "maxrecords": "12",
                "timespan": "36h",
                "sort": "datedesc",
                "format": "json",
            },
            timeout=8,
        )
        articles = payload.get("articles") or []
        return [map_gdelt_article(article, source["provider"], index) for index, article in enumerate(articles)]

    return []


def fetch_research_source(source: dict[str, Any]) -> list[dict[str, Any]]:
    if source["kind"] == "semantic":
        payload = fetch_json(
            "https://api.semanticscholar.org/graph/v1/paper/search/bulk",
            {
                "query": source["query"],
                "fields": "title,url,abstract,publicationDate,citationCount,authors,year,venue,openAccessPdf,paperId",
                "year": f"{datetime.now().year - 1}-",
            },
            timeout=10,
        )
        return [map_semantic_scholar_paper(paper, source.get("topic", ""), source["provider"]) for paper in (payload.get("data") or [])[:12]]

    if source["kind"] == "arxiv":
        xml_text = fetch_text(
            "https://export.arxiv.org/api/query?" +
            urlencode(
                {
                    "search_query": source["query"],
                    "start": "0",
                    "max_results": "12",
                    "sortBy": "submittedDate",
                    "sortOrder": "descending",
                }
            ),
            timeout=10,
        )
        return parse_arxiv_feed(xml_text, source.get("topic", ""), source["provider"])

    return []


def fetch_music_source(source: dict[str, Any]) -> list[dict[str, Any]]:
    if source["kind"] == "billboard":
        html_text = fetch_text(source["url"], timeout=10)
        return parse_billboard_chart(
            html_text,
            provider=source["provider"],
            chart=source["chart"],
            genre=source["genre"],
        )

    return []


def fetch_entertainment_source(source: dict[str, Any]) -> list[dict[str, Any]]:
    if source["kind"] == "rss":
        xml_text = fetch_text(source["url"], timeout=8)
        return parse_rss_feed(xml_text, source["provider"], source.get("category", "Entertainment"))

    return []


def parse_rss_feed(xml_text: str, provider: str, default_region: str) -> list[dict[str, Any]]:
    root = ET.fromstring(xml_text)
    items: list[dict[str, Any]] = []

    for index, node in enumerate(root.findall("./channel/item")):
        title = clean_text(node.findtext("title"))
        url = clean_text(node.findtext("link"))
        raw_description = clean_text(node.findtext("description"))
        description = clean_html_text(raw_description)
        category = clean_text(node.findtext("category")) or default_region
        published = format_feed_time(clean_text(node.findtext("pubDate")))
        sort_ts = parse_feed_timestamp(clean_text(node.findtext("pubDate")))
        image = extract_rss_image_url(node, raw_description)

        if not title or not url:
            continue

        items.append(
            {
                "id": hashed_id(provider, title, url),
                "title": title,
                "summary": truncate(description or f"{provider} 的最新资讯条目。", 220),
                "region": category,
                "signal": "多源资讯",
                "relevance": provider,
                "timestamp": published,
                "url": url,
                "provider": provider,
                "linkLabel": "查看原文",
                "image": image,
                "_sort_ts": sort_ts,
            }
        )

        if index >= 11:
            break

    return items


def parse_arxiv_feed(xml_text: str, topic: str, provider: str) -> list[dict[str, Any]]:
    root = ET.fromstring(xml_text)
    items: list[dict[str, Any]] = []

    for entry in root.findall("atom:entry", ATOM_NS):
        title = normalize_space(entry.findtext("atom:title", default="", namespaces=ATOM_NS))
        summary = normalize_space(entry.findtext("atom:summary", default="", namespaces=ATOM_NS))
        published_raw = clean_text(entry.findtext("atom:published", default="", namespaces=ATOM_NS))
        link = ""
        pdf_link = ""

        for link_node in entry.findall("atom:link", ATOM_NS):
            href = clean_text(link_node.get("href"))
            title_attr = clean_text(link_node.get("title"))
            rel = clean_text(link_node.get("rel"))
            if title_attr.lower() == "pdf":
                pdf_link = href
            if rel == "alternate" and href:
                link = href

        categories = [clean_text(node.get("term")) for node in entry.findall("atom:category", ATOM_NS) if node.get("term")]
        authors = ", ".join(
            normalize_space(author.findtext("atom:name", default="", namespaces=ATOM_NS))
            for author in entry.findall("atom:author", ATOM_NS)[:3]
        )

        if not title:
            continue

        items.append(
            {
                "id": hashed_id(provider, title, pdf_link or link),
                "title": title,
                "summary": truncate(summary or f"{provider} 的最新论文条目。", 240),
                "domain": infer_research_domain(title, summary, "Research"),
                "signal": "arXiv",
                "relevance": authors or ", ".join(categories[:2]) or provider,
                "timestamp": format_feed_time(published_raw),
                "url": pdf_link or link,
                "provider": provider,
                "linkLabel": "查看 PDF" if pdf_link else "查看论文",
                "_sort_ts": parse_feed_timestamp(published_raw),
            }
        )

    return items


def parse_billboard_chart(html_text: str, provider: str, chart: str, genre: str) -> list[dict[str, Any]]:
    rows = re.split(r'<div class="o-chart-results-list-row-container">', html_text)[1:]
    items: list[dict[str, Any]] = []
    fetched_at = utc_now_iso()

    for fallback_rank, row in enumerate(rows[:18], start=1):
        title = extract_match(
            row,
            [
                r'<h3 id="title-of-a-story"[^>]*>\s*(?:<a[^>]*>)?\s*([^<]+?)\s*(?:</a>)?\s*</h3>',
                r'<span class="c-title[^"]*"[^>]*>\s*(?:<a[^>]*>)?\s*([^<]+?)\s*(?:</a>)?\s*</span>',
            ],
        )
        artist = extract_match(
            row,
            [
                r'<span class="c-label\s+a-no-trucate[^"]*"[^>]*>\s*(?:<a[^>]*>)?\s*([^<]+?)\s*(?:</a>)?\s*</span>',
                r'<h3 class="c-title[^"]*"[^>]*>\s*(?:<a[^>]*>)?\s*([^<]+?)\s*(?:</a>)?\s*</h3>',
            ],
        )
        if not title:
            continue

        rank = extract_match(
            row,
            [
                r'u-font-size-32px[^>]*>\s*([0-9]{1,3})\s*<',
                r'u-font-size-28px[^>]*>\s*([0-9]{1,3})\s*<',
                r'u-width-45px@mobile-max[^>]*>\s*<span[^>]*>\s*([0-9]{1,3})\s*</span>',
            ],
        ) or str(fallback_rank)

        search_url = build_music_search_url(title, artist)
        summary = f"来自 {chart} 的近期热门歌曲，当前排位 #{rank}，可直接打开听歌或视频搜索入口。"
        items.append(
            {
                "id": hashed_id(provider, chart, title, artist, rank),
                "title": title,
                "summary": truncate(summary, 220),
                "genre": genre,
                "signal": f"#{rank} {chart}",
                "relevance": artist or f"{chart} 热单",
                "artist": artist,
                "timestamp": format_feed_time(fetched_at),
                "url": search_url,
                "provider": provider,
                "linkLabel": "听歌 / 视频",
                "_sort_ts": parse_feed_timestamp(fetched_at) - fallback_rank,
            }
        )

    return items


def map_gdelt_article(article: dict[str, Any], provider: str, index: int) -> dict[str, Any]:
    title = clean_text(article.get("title"))
    url = clean_text(article.get("url"))
    domain = clean_text(article.get("domain")) or provider
    country = clean_text(article.get("sourcecountry")) or "World"
    language = clean_text(article.get("language")) or "mixed"
    summary = clean_text(article.get("excerpt")) or f"来自 {domain} 的最新报道，当前语言标记为 {language.upper()}。"
    seen_date_raw = clean_text(article.get("seendate"))

    return {
        "id": hashed_id(provider, title, url or str(index)),
        "title": title,
        "summary": truncate(summary, 220),
        "region": country,
        "signal": "多源资讯",
        "relevance": domain,
        "timestamp": format_feed_time(seen_date_raw),
        "url": url,
        "provider": provider,
        "linkLabel": "查看原文" if url else "查看线索",
        "_sort_ts": parse_feed_timestamp(seen_date_raw),
    }


def map_semantic_scholar_paper(paper: dict[str, Any], topic: str, provider: str) -> dict[str, Any]:
    title = clean_text(paper.get("title"))
    abstract = clean_text(paper.get("abstract"))
    url = clean_text(paper.get("url"))
    venue = clean_text(paper.get("venue")) or provider
    publication_date = clean_text(paper.get("publicationDate"))
    citations = int(paper.get("citationCount") or 0)
    authors = ", ".join(
        clean_text(author.get("name")) for author in (paper.get("authors") or [])[:3] if author.get("name")
    )
    pdf_link = ""
    if isinstance(paper.get("openAccessPdf"), dict):
        pdf_link = clean_text(paper["openAccessPdf"].get("url"))

    summary = abstract or f"{venue} 收录的最新研究条目。"
    target_link = pdf_link or url
    return {
        "id": clean_text(paper.get("paperId")) or hashed_id(provider, title, target_link),
        "title": title,
        "summary": truncate(summary, 240),
        "domain": infer_research_domain(title, summary, "Research"),
        "signal": f"{citations} citations" if citations else "Semantic Scholar",
        "relevance": authors or venue,
        "timestamp": format_feed_time(publication_date or str(paper.get("year") or "")),
        "url": target_link,
        "provider": provider,
        "linkLabel": "查看 PDF" if pdf_link else "查看论文",
        "_sort_ts": parse_feed_timestamp(publication_date or str(paper.get("year") or "")),
    }


def dedupe_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen: set[str] = set()

    for item in sorted(items, key=lambda row: row.get("_sort_ts", 0), reverse=True):
        normalized = normalize_dedupe_key(item.get("url", ""), item.get("title", ""))
        if normalized in seen:
            continue
        seen.add(normalized)
        deduped.append(item)

    return deduped


def diversify_and_limit(items: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for item in sorted(items, key=lambda row: row.get("_sort_ts", 0), reverse=True):
        groups.setdefault(item["provider"], []).append(item)

    mixed: list[dict[str, Any]] = []
    providers = list(groups.keys())
    random.Random(len(items)).shuffle(providers)

    while providers and len(mixed) < limit:
        next_providers: list[str] = []
        for provider in providers:
            bucket = groups.get(provider, [])
            if bucket:
                mixed.append(bucket.pop(0))
            if bucket:
                next_providers.append(provider)
            if len(mixed) >= limit:
                break
        providers = next_providers

    for item in mixed:
        item.pop("_sort_ts", None)

    return mixed


def build_google_news_url(query: str) -> str:
    return (
        "https://news.google.com/rss/search?"
        + urlencode({"q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"})
    )


def build_music_search_url(title: str, artist: str) -> str:
    query = f"{title} {artist} official audio".strip()
    return "https://www.youtube.com/results?" + urlencode({"search_query": query})


def enrich_music_items_with_artwork(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    enriched = [dict(item) for item in items]

    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {
            executor.submit(resolve_music_artwork, item): index
            for index, item in enumerate(enriched)
        }
        for future in as_completed(futures):
            index = futures[future]
            try:
                artwork = future.result()
            except Exception:  # noqa: BLE001
                artwork = ""
            if artwork:
                enriched[index]["artwork"] = artwork

    return enriched


def resolve_music_artwork(item: dict[str, Any]) -> str:
    title = clean_text(item.get("title"))
    artist = clean_text(item.get("artist") or item.get("relevance"))
    if not title:
        return ""

    cache_key = normalize_signal_key(f"{title}::{artist}")
    cached = music_art_cache.get(cache_key)
    now = time.time()
    if cached and now - cached["stored_at"] < MUSIC_ART_TTL_SECONDS:
        return cached.get("artwork", "")

    payload = fetch_json(
        "https://itunes.apple.com/search",
        {
            "term": f"{title} {artist}".strip(),
            "entity": "song",
            "limit": "1",
            "country": "US",
        },
        timeout=6,
    )
    result = (payload.get("results") or [{}])[0]
    artwork = clean_text(result.get("artworkUrl100")) or clean_text(result.get("artworkUrl60"))
    if artwork:
        artwork = artwork.replace("100x100bb", "600x600bb").replace("60x60bb", "600x600bb")

    music_art_cache[cache_key] = {"stored_at": now, "artwork": artwork}
    return artwork


def resolve_link_preview_image(url: str) -> str:
    if not url:
        return ""

    cache_key = normalize_signal_key(url)
    now = time.time()
    cached = link_image_cache.get(cache_key)
    if cached and now - cached["stored_at"] < CACHE_TTL_SECONDS:
        return cached.get("image", "")

    image = ""
    try:
        html_text = fetch_text(url, timeout=6)
        image = extract_link_preview_image(html_text, url)
    except Exception:  # noqa: BLE001
        image = ""

    link_image_cache[cache_key] = {"stored_at": now, "image": image}
    return image


def build_gdelt_query(base_query: str, keywords: list[str]) -> str:
    extras = " OR ".join(quote_phrase(keyword) for keyword in keywords[:2] if keyword)
    if extras:
        return f"({base_query} OR {extras})"
    return f"({base_query})"


def fetch_json(base_url: str, params: dict[str, str], timeout: int) -> dict[str, Any]:
    request = Request(
        f"{base_url}?{urlencode(params)}",
        headers=REQUEST_HEADERS,
    )
    with urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return json.loads(response.read().decode(charset))


def fetch_text(url: str, timeout: int) -> str:
    request = Request(url, headers=REQUEST_HEADERS)
    with urlopen(request, timeout=timeout) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset, errors="replace")


def summarize_providers(items: list[dict[str, Any]]) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for item in items:
        provider = item.get("provider", "")
        if provider and provider not in seen:
            seen.add(provider)
            ordered.append(provider)
    return ordered


def summarize_errors(errors: list[str]) -> str | None:
    if not errors:
        return None
    unique = []
    seen = set()
    for error in errors:
        if error in seen:
            continue
        seen.add(error)
        unique.append(error)
        if len(unique) >= 3:
            break
    return f"{len(seen)} 个来源暂时超时"


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
        "reasoning",
        "vision-language",
        "diffusion",
        "speech recognition",
        "fine-tuning",
    ]
    blockers = [
        "multi-agent reinforcement learning",
        "transportation",
        "robot manipulator",
        "wireless sensor",
        "uav",
        "power system",
    ]
    return any(marker in haystack for marker in markers) and not any(blocker in haystack for blocker in blockers)


def infer_research_domain(title: str, abstract: str, fallback: str) -> str:
    haystack = f"{title} {abstract}".lower()
    if "agent" in haystack:
        return "Agents"
    if "multimodal" in haystack or "vision-language" in haystack or "vision language" in haystack:
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
    return fallback


def quote_phrase(value: str) -> str:
    return f'"{value.replace(chr(34), "").strip()}"'


def extract_match(text: str, patterns: list[str]) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if not match:
            continue
        return clean_html_text(match.group(1))
    return ""


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


def normalize_dedupe_key(url: str, title: str) -> str:
    normalized_title = re.sub(r"\s+", " ", title.strip().lower())
    normalized_url = url.strip().lower().rstrip("/")
    return normalized_url or normalized_title


def hashed_id(*parts: str) -> str:
    digest = hashlib.sha1("||".join(parts).encode("utf-8")).hexdigest()
    return digest


def clean_text(value: Any) -> str:
    return str(value).strip() if value else ""


def clean_html_text(value: Any) -> str:
    text = clean_text(value)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return normalize_space(text)


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def normalize_signal_key(value: str) -> str:
    return normalize_space(value).lower()[:96]


def extract_rss_image_url(node: ET.Element, raw_html: str) -> str:
    image = extract_match(
        raw_html,
        [
            r'<img[^>]+src=["\']([^"\']+)["\']',
            r'url=["\']([^"\']+)["\']',
        ],
    )
    if image:
        return html.unescape(image)

    for child in list(node):
        tag = child.tag.lower()
        url = clean_text(child.get("url") or child.get("href"))
        medium = clean_text(child.get("medium"))
        mime_type = clean_text(child.get("type"))
        if not url:
            continue
        if tag.endswith("thumbnail") or tag.endswith("content"):
            if not medium or medium == "image" or mime_type.startswith("image/"):
                return url

    enclosure = node.find("enclosure")
    if enclosure is not None:
        url = clean_text(enclosure.get("url"))
        mime_type = clean_text(enclosure.get("type"))
        if url and mime_type.startswith("image/"):
            return url

    return ""


def extract_link_preview_image(html_text: str, page_url: str) -> str:
    image = extract_match(
        html_text,
        [
            r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:image["\']',
            r'<meta[^>]+name=["\']twitter:image["\'][^>]+content=["\']([^"\']+)["\']',
            r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']twitter:image["\']',
            r'<img[^>]+src=["\']([^"\']+)["\']',
        ],
    )
    if not image:
        return ""

    image = html.unescape(image)
    if image.startswith("//"):
        return "https:" + image
    if image.startswith("/"):
        parsed = urlparse(page_url)
        return f"{parsed.scheme}://{parsed.netloc}{image}"
    if image.startswith("http://") or image.startswith("https://"):
        return image
    return ""


def truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return f"{text[: limit - 1].rstrip()}…"


def parse_feed_timestamp(raw_value: str) -> float:
    if not raw_value:
        return 0.0
    try:
        return parsedate_to_datetime(raw_value).timestamp()
    except Exception:  # noqa: BLE001
        pass
    for pattern in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d", "%Y%m%dT%H%M%SZ", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(raw_value, pattern).replace(tzinfo=timezone.utc).timestamp()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(raw_value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return 0.0


def format_feed_time(raw_value: str) -> str:
    timestamp = parse_feed_timestamp(raw_value)
    if timestamp <= 0:
        return "刚刚更新"
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%m/%d %H:%M")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def run() -> None:
    server = ThreadingHTTPServer((HOST, PORT), PulseDeckHandler)
    print(f"XscNews running at http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    run()
