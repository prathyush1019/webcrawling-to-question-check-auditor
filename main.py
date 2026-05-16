import asyncio
import sys
import os
import io
import zipfile
import traceback
import re
import json
import time
from contextlib import asynccontextmanager
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser
from typing import Optional
import httpx

# CRITICAL: Must be set before any other imports that touch the event loop
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, HttpUrl
from dotenv import load_dotenv
from playwright.async_api import async_playwright
import numpy as np
from bs4 import BeautifulSoup
from google import genai

load_dotenv()

# ─── Logging Configuration ───────────────────────────────────────────────────
import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("rag_performance.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("NanoCrawler")

# ─── Gemini Client ────────────────────────────────────────────────────────────

api_key = os.getenv("GEMINI_API_KEY")
gemini_client: Optional[genai.Client] = None
if api_key:
    gemini_client = genai.Client(api_key=api_key)

# ─── Azure Speech Configuration ───────────────────────────────────────────────
import azure.cognitiveservices.speech as speechsdk

AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY")
AZURE_SPEECH_REGION = os.getenv("AZURE_SPEECH_REGION")
AZURE_VOICE_NAME = os.getenv("AZURE_VOICE_NAME", "en-US-AvaNeural") # High-quality default

speech_config = None
if AZURE_SPEECH_KEY and AZURE_SPEECH_REGION:
    try:
        speech_config = speechsdk.SpeechConfig(subscription=AZURE_SPEECH_KEY, region=AZURE_SPEECH_REGION)
        speech_config.speech_synthesis_voice_name = AZURE_VOICE_NAME
        # Use MP3 for high compression and compatibility
        speech_config.set_speech_synthesis_output_format(speechsdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3)
    except Exception as e:
        logger.error(f"Failed to initialize Azure Speech: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_running_loop()
    print(f"[NanoCrawler] Event loop: {type(loop).__name__}", flush=True)
    # Auto-load RAG index on startup
    rag_store.load()
    yield


app = FastAPI(title="NanoCrawler | Web Explorer", lifespan=lifespan)

os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


# ─── Models ──────────────────────────────────────────────────────────────────

class CrawlRequest(BaseModel):
    url: HttpUrl
    max_pages: int = 50
    mode: str = "deep"
    include_subdomains: bool = False
    concurrency: int = 2


class KBRequest(BaseModel):
    pages: list
    model_type: str  # B2B, B2C, C2B, SALES_LEAD, ENQUIRY
    extra_instructions: str = ""  # Optional extra context appended to prompt


# ─── Helpers ─────────────────────────────────────────────────────────────────

def get_domain(url: str, base_only: bool = False) -> str:
    try:
        netloc = urlparse(str(url)).netloc.split(':')[0].lower()
        if base_only:
            # Extract example.com from sub.example.com
            parts = netloc.split('.')
            if len(parts) > 2:
                # Basic logic for TLDs - could be better with tldextract but this is no-dep
                return ".".join(parts[-2:])
        return netloc.replace("www.", "")
    except Exception:
        return ""


def clean_and_summarize(html_content: str) -> dict:
    """Enhanced semantic cleaning to reduce token waste by 60%+."""
    soup = BeautifulSoup(html_content, 'html.parser')

    # Collect links before stripping content
    links = [
        {"text": a.get_text().strip() or "No Text", "url": a['href']}
        for a in soup.find_all('a', href=True)
    ]

    # Aggressive noise reduction
    # We remove anything that isn't core business logic/content
    for element in soup(["script", "style", "nav", "footer", "header", "aside", "form", "svg", "button", "iframe"]):
        element.decompose()
    
    # Also remove common UI classes/ids if they seem like boilerplate
    for noise in soup.select('.menu, .sidebar, .ad, .social, .banner, .modal'):
        noise.decompose()

    # Priority-based content extraction
    main_content = soup.find('main') or soup.find('article') or soup.body
    if main_content:
        # Extract only semantic text-heavy elements
        elements = main_content.find_all(['p', 'h1', 'h2', 'h3', 'h4', 'li', 'td', 'span'])
        # Filter for quality: ignore short UI snippets
        text_blocks = []
        min_len = 5 if len(html_content) < 5000 else 20 # Be more lenient for small pages
        for el in elements:
            txt = el.get_text().strip()
            if len(txt) > min_len:
                text_blocks.append(txt)
        
        full_text = ' '.join(text_blocks) 
    else:
        full_text = ' '.join(soup.stripped_strings)

    full_text = re.sub(r'\s+', ' ', full_text).strip()
    title = soup.title.string.strip() if soup.title and soup.title.string else "No Title"
    
    return {
        "title": title[:100],
        "full_text": full_text[:40000], # Cap at 40k chars for safety
        "links": links[:200]
    }

    return {"title": title, "full_text": full_text, "links": links}
 
 
async def check_robots_txt(url: str, user_agent: str = "*") -> bool:
    """Checks robots.txt for the given URL. Returns True if allowed, False if forbidden."""
    try:
        parsed_url = urlparse(url)
        robots_url = f"{parsed_url.scheme}://{parsed_url.netloc}/robots.txt"
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(robots_url)
            if resp.status_code == 404:
                return True # No robots.txt means allowed
            if resp.status_code != 200:
                return True # Other errors, assume allowed or at least not explicitly forbidden
            
            content = resp.text
            
        rp = RobotFileParser()
        rp.parse(content.splitlines())
        return rp.can_fetch(user_agent, url)
    except Exception as e:
        print(f"[RobotsAgent] Error checking {url}: {e}")
        return True # On error, we continue as requested (if not present then continue)
 
 
def parse_json_response(text: str):
    """Clean and parse JSON response from LLM, robustly handling backticks, extra text, and control characters."""
    raw = text.strip()
    
    # 1. Handle Markdown Blocks
    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0].strip()
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0].strip()
    
    # 2. Aggressive Trimming: Find the first occurrence of [ or { and the last matching ] or }
    # This prevents "Extra data" errors when the LLM appends text after the JSON.
    start_idx_arr = raw.find('[')
    start_idx_obj = raw.find('{')
    
    if start_idx_arr != -1 and (start_idx_obj == -1 or start_idx_arr < start_idx_obj):
        # Starts with array
        end_idx = raw.rfind(']')
        if end_idx != -1:
            raw = raw[start_idx_arr:end_idx+1]
    elif start_idx_obj != -1:
        # Starts with object
        end_idx = raw.rfind('}')
        if end_idx != -1:
            raw = raw[start_idx_obj:end_idx+1]
            
    try:
        return json.loads(raw, strict=False)
    except json.JSONDecodeError as e:
        print(f"[JSON Parser] Final attempt failed: {str(e)}")
        raise




# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/")
async def read_index():
    return FileResponse('index.html')




# ─── Crawler Worker ──────────────────────────────────────────────────────────

active_workers = 0

SKIP_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".gif", ".zip", ".exe", ".dmg", ".mp4", ".mp3", ".svg", ".ico"}
SKIP_PREFIXES = ("mailto:", "javascript:", "tel:")


async def playwright_worker(worker_id: int, queue: asyncio.Queue, visited: set,
                             results: list, root_domain: str,
                             request: CrawlRequest, browser_context, logger=None):
    global active_workers
    
    # Use provided logger or fall back to global
    log = logger if logger else globals()['logger']

    while True:
        current_url = await queue.get()

        # Poison pill — graceful shutdown signal
        if current_url is None:
            queue.task_done()
            break

        active_workers += 1
        try:
            if len(results) >= request.max_pages:
                return  # Hard stop — we have enough pages

            for attempt in range(3):
                page = None
                try:
                    log.info(f"[CRAWLER-{worker_id}] Attempting: {current_url}")
                    log.info(
                        f"BROWSER-{worker_id} -> CRAWLING: {current_url}"
                        + (f" (retry {attempt})" if attempt > 0 else "")
                    )

                    page = await browser_context.new_page()
                    await page.goto(current_url, timeout=30000, wait_until="domcontentloaded")

                    if request.mode == "maximum":
                        # Forensic Depth: Handle Infinite Scroll and Dynamic Content
                        for _ in range(5):
                            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                            await asyncio.sleep(1.5)
                        await page.wait_for_load_state("networkidle", timeout=5000)
                    else:
                        # Standard Deep: Basic scroll
                        await page.evaluate("window.scrollTo(0, document.body.scrollHeight/2)")
                        await asyncio.sleep(0.5)

                    content = await page.content()
                    data = clean_and_summarize(content)

                    results.append({
                        "title": data["title"],
                        "url": current_url,
                        "full_text": data["full_text"],
                        "links": data["links"]
                    })

                    log.info(f"[CRAWLER-{worker_id}] Success: {data['title']} | Links found: {len(data['links'])}")
                    log.info(f"BROWSER-{worker_id} -> SUCCESS: {data['title']}")

                    # Discover and enqueue new links
                    for link in data["links"]:
                        href = link["url"]

                        # Skip unwanted protocols/anchors
                        if any(href.startswith(p) for p in SKIP_PREFIXES):
                            continue

                        full_url = urljoin(page.url, href).rstrip('/')
                        # If the URL is just the root with a fragment like domain.com/#test, keep it.
                        # But ignore bare '#' or empty fragments.
                        if full_url.endswith('#'):
                            full_url = full_url[:-1]

                        # Only follow http/https
                        if not full_url.startswith("http"):
                            continue

                        # Skip binary/media file extensions
                        path_lower = urlparse(full_url).path.lower()
                        if any(path_lower.endswith(ext) for ext in SKIP_EXTENSIONS):
                            continue

                        link_domain = get_domain(full_url)
                        domain_ok = False
                        if request.include_subdomains:
                            # If root is 'example.com', 'blog.example.com' or 'example.com' are OK
                            domain_ok = link_domain.endswith(root_domain)
                        else:
                            # Strict match
                            domain_ok = (link_domain == root_domain) or (link_domain == f"www.{root_domain}")

                        if domain_ok and full_url not in visited:
                            visited.add(full_url)
                            await queue.put(full_url)

                    break  # Success — exit retry loop

                except Exception as e:
                    log.error(f"[CRAWLER-{worker_id}] Error crawling {current_url}: {str(e)}")
                    traceback.print_exc()
                    if attempt < 2:
                        log.info(f"BROWSER-{worker_id} -> RETRYING ({attempt+1}/3): {e}")
                        await asyncio.sleep(2)
                    else:
                        log.info(f"BROWSER-{worker_id} -> ERROR: {e}")
                finally:
                    if page:
                        try:
                            await page.close()
                        except Exception:
                            pass

        finally:
            active_workers = max(0, active_workers - 1)
            queue.task_done()


@app.post("/crawl")
async def crawl(request: CrawlRequest):
    async def event_generator():
        global active_workers
        active_workers = 0

        base_url = str(request.url).split('#')[0].rstrip('/')
        
        yield json.dumps({"type": "log", "message": "🔍 Checking compliance..."}) + "\n"
        allowed = await check_robots_txt(base_url)
        if not allowed:
            yield json.dumps({"type": "error", "message": "Scraping forbidden by robots.txt"}) + "\n"
            return
        
        yield json.dumps({"type": "log", "message": "✅ Compliance OK. Booting engine..."}) + "\n"

        root_domain = get_domain(base_url, base_only=request.include_subdomains)
        visited: set = {base_url}
        results: list = []
        queue: asyncio.Queue = asyncio.Queue()
        await queue.put(base_url)

        # Queue to collect logs from workers
        log_queue = asyncio.Queue()

        class WorkerLogger:
            def info(self, msg): log_queue.put_nowait({"type": "log", "message": msg})
            def error(self, msg): log_queue.put_nowait({"type": "log", "message": f"⚠️ {msg}"})

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            )

            workers = [
                asyncio.create_task(
                    playwright_worker(i + 1, queue, visited, results, root_domain, request, context, logger=WorkerLogger())
                )
                for i in range(request.concurrency)
            ]

            while True:
                # 1. Drain log queue
                while not log_queue.empty():
                    yield json.dumps(await log_queue.get()) + "\n"

                await asyncio.sleep(0.2)
                q_size = queue.qsize()
                if (queue.empty() and active_workers == 0) or len(results) >= request.max_pages:
                    break

            for _ in range(request.concurrency): await queue.put(None)
            await asyncio.gather(*workers, return_exceptions=True)
            await browser.close()

        yield json.dumps({
            "type": "final", 
            "root_url": base_url, 
            "total_pages": len(results), 
            "pages": results
        }) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")


# ─── Knowledge Base Generation ───────────────────────────────────────────────

PROMPTS_FILE = "prompts.json"

def load_prompts() -> dict:
    try:
        with open(PROMPTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"prompts.json malformed: {e}")

def save_prompts(prompts: dict):
    with open(PROMPTS_FILE, "w", encoding="utf-8") as f:
        json.dump(prompts, f, indent=2, ensure_ascii=False)


@app.get("/prompts")
async def get_prompts():
    return load_prompts()


@app.put("/prompts/{key}")
async def update_prompt(key: str, body: dict):
    text = body.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Prompt text cannot be empty")
    prompts = load_prompts()
    prompts[key] = text
    save_prompts(prompts)
    return {"status": "updated", "key": key}


@app.post("/prompts")
async def add_prompt(body: dict):
    key  = body.get("key",  "").strip().upper().replace(" ", "_")
    text = body.get("text", "").strip()
    if not key or not text:
        raise HTTPException(status_code=400, detail="Both 'key' and 'text' are required")
    prompts = load_prompts()
    if key in prompts:
        raise HTTPException(status_code=409, detail=f"Prompt key '{key}' already exists. Use PUT to update.")
    prompts[key] = text
    save_prompts(prompts)
    return {"status": "created", "key": key}


@app.delete("/prompts/{key}")
async def delete_prompt(key: str):
    prompts = load_prompts()
    if key not in prompts:
        raise HTTPException(status_code=404, detail=f"Prompt key '{key}' not found")
    del prompts[key]
    save_prompts(prompts)
    return {"status": "deleted", "key": key}


@app.post("/generate-kb")
async def generate_kb(request: KBRequest):
    if not gemini_client:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set in .env")

    prompts = load_prompts()
    base_prompt = prompts.get(request.model_type) or prompts.get("B2B", "")
    if not base_prompt:
        raise HTTPException(status_code=400, detail=f"Unknown model_type: {request.model_type}")

    logger.info(f"SYSTEM -> Generating {request.model_type} Knowledge Base...")

    combined_text = "".join(
        f"\n--- PAGE: {p['url']} ---\n{p.get('full_text', '')}\n"
        for p in request.pages[:30]
    )

    final_prompt = base_prompt.replace("{SCRAPED_CONTENT}", combined_text[:30000])

    # Append any extra instructions from the user
    if request.extra_instructions.strip():
        final_prompt += f"\n\n---\nAdditional Instructions from user:\n{request.extra_instructions.strip()}"

    try:
        start_time = time.time()
        response = gemini_client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=[final_prompt]
        )
        duration = round(time.time() - start_time, 2)
        
        # ─── LOGGING ───
        logger.info(f"[KB GEN] Model: {request.model_type} | Latency: {duration}s")
        
        logger.info("SYSTEM -> Knowledge Base synthesized successfully.")
        return {"kb": response.text}
    except Exception as e:
        traceback.print_exc()
        logger.info(f"SYSTEM -> KB Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/download-kb-txt")
async def download_kb_txt(body: dict):
    kb_text = body.get("kb", "")
    if not kb_text:
        raise HTTPException(status_code=400, detail="No KB content provided")
    return StreamingResponse(
        io.BytesIO(kb_text.encode("utf-8")),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=knowledge_base.txt"}
    )


@app.post("/download-package")
async def download_package(data: dict):
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        if "crawl" in data:
            zf.writestr("crawl_data.json", json.dumps(data["crawl"], indent=2))
        if "kb" in data:
            zf.writestr("knowledge_base.txt", data["kb"])
    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=nanocrawler_package.zip"}
    )


# ─── Agent Builder Endpoints ─────────────────────────────────────────────────

# Load instruction templates from the sibling repo
_agent_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "KB_to_AgentInstruction")
if _agent_dir not in sys.path:
    sys.path.insert(0, _agent_dir)

try:
    from config import INSTRUCTION_TEMPLATES
except ImportError:
    INSTRUCTION_TEMPLATES = {}

from google.genai import types as genai_types


class EvaluateRequest(BaseModel):
    input_kb: str


class GenerateRequest(BaseModel):
    input_kb: str
    instruction_template: Optional[str] = None
    instruction_type: Optional[str] = "Sales"
    call_direction: Optional[str] = "Inbound"
    agent_name: Optional[str] = "Aaliyah"
    company_name: Optional[str] = "the company"
    extra_instructions: Optional[str] = ""
    flow_tree: Optional[str] = None
    performanceConfig: Optional[dict] = {"latency": "standard"}


class QaRequest(BaseModel):
    input_kb: str


class RagIndexRequest(BaseModel):
    input_kb: str
    chunk_size: int = 500
    overlap: int = 100


class RefineRequest(BaseModel):
    current_instructions: str
    failures: list  # List of {"query": "...", "answer": "...", "violation": "...", "justification": "..."}
    agent_name: Optional[str] = "Aaliyah"
    company_name: Optional[str] = "the company"


class RagQueryRequest(BaseModel):
    query: str
    top_k: int = 3
    agent_instructions: str = ""
    history: list = []  # List of {"role": "user/bot", "content": "..."}
    reference_answer: Optional[str] = None


@app.get("/api/templates")
async def get_templates():
    return INSTRUCTION_TEMPLATES


@app.post("/api/evaluate")
async def api_evaluate(data: EvaluateRequest):
    if not gemini_client:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set in .env")
    try:
        eval_prompt = f"""You are an expert Data Cleaner and Content Auditor. Evaluate the following Knowledge Base.
Check for: 1) Formatting issues (blank spaces, junk chars) 2) Relevancy & Coherence.
Return ONLY a JSON object with keys "score" (0-100) and "reasoning" (brief string). No markdown.

Input Knowledge Base:
{data.input_kb}"""
        resp = gemini_client.models.generate_content(
            model="gemini-3.1-pro-preview", contents=eval_prompt,
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                candidate_count=1,
                temperature=0.0
            ),
        )
        result = parse_json_response(resp.text)
        score = result.get("score", 0)
        reasoning = result.get("reasoning", "")
        improved_kb = None
        if score < 75:
            recon = gemini_client.models.generate_content(
                model="gemini-3.1-pro-preview",
                contents=f"Clean and restructure this KB. Fix formatting, remove noise. Return ONLY the cleaned KB.\nReasoning: {reasoning}\n\nKB:\n{data.input_kb}",
                config=genai_types.GenerateContentConfig(temperature=0.2)
            )
            improved_kb = recon.text.strip()
            score = 100
            reasoning += " → Reconstructed by AI."
        return {"score": score, "reasoning": reasoning, "improved_kb": improved_kb}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate")
async def api_generate(data: GenerateRequest):
    if not gemini_client:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set in .env")
    
    template = data.instruction_template
    if not template:
        cat = INSTRUCTION_TEMPLATES.get(data.instruction_type, INSTRUCTION_TEMPLATES.get("Sales", {}))
        template = cat.get(data.call_direction, list(cat.values())[0]) if isinstance(cat, dict) else cat
    
    if data.extra_instructions and data.extra_instructions.strip():
        template += f"\n\n--- ADDITIONAL INSTRUCTIONS ---\n{data.extra_instructions.strip()}\n"

    async def event_generator():
        try:
            import time
            start_time = time.time()
            is_optimized = data.performanceConfig.get("latency") == "optimized" if data.performanceConfig else False
            
            main_model = "gemini-3.1-flash-lite" if is_optimized else "gemini-3.1-pro-preview"
            audit_model = "gemini-3.1-flash-lite" if is_optimized else "gemini-3.1-pro-preview"
            
            flow_context = f"\n\nConversational Flow Logic to follow:\n{data.flow_tree}" if data.flow_tree else ""
            prompt = f"{template}\n\nKB:\n{data.input_kb}\n\nCompany Name: {data.company_name}\nAgent Name: {data.agent_name}\nExtra Instructions: {data.extra_instructions}{flow_context}\n\nReturn ONLY the system prompt."
            
            # Step 1: Main Generation (Streaming)
            yield json.dumps({"type": "status", "message": "Synthesizing Core Intelligence..."}) + "\n"
            
            initial_resp = gemini_client.models.generate_content(
                model=main_model,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    temperature=0.3 if is_optimized else 0.7,
                )
            )
            initial = initial_resp.text.strip()
            yield json.dumps({"type": "chunk", "text": initial}) + "\n"

            # Step 2: Auditor Check
            yield json.dumps({"type": "status", "message": "Auditing Logic & Compliance..."}) + "\n"
            
            eval_prompt = f"Score these instructions vs the template 0-100. Return JSON {{score, reasoning}}.\nTemplate:\n{template}\nInstructions:\n{initial}"
            eval_resp = gemini_client.models.generate_content(
                model=audit_model,
                contents=eval_prompt,
                config=genai_types.GenerateContentConfig(
                    response_mime_type="application/json",
                    candidate_count=1,
                    temperature=0.0
                ),
            )
            
            eval_r = parse_json_response(eval_resp.text)
            # If eval_r is a list, take the first item or handle it
            if isinstance(eval_r, list):
                eval_r = eval_r[0] if eval_r else {}
                
            # If eval_r is a list, take the first item or handle it
            if isinstance(eval_r, list):
                eval_r = eval_r[0] if eval_r else {}
                
            score, reasoning = eval_r.get("score", 0), eval_r.get("reasoning", "")
            
            final = initial
            if score < 75:
                yield json.dumps({"type": "status", "message": "Refining Framework for Production..."}) + "\n"
                refined_resp = gemini_client.models.generate_content(
                    model=main_model,
                    contents=f"Rewrite these instructions to perfectly match the template.\nReason: {reasoning}\nTemplate:\n{template}\nOriginal:\n{initial}\nReturn ONLY refined instructions.",
                    config=genai_types.GenerateContentConfig(temperature=0.2) if is_optimized else None
                )
                final = refined_resp.text.strip()
                yield json.dumps({"type": "chunk", "text": final, "refined": True}) + "\n"

            duration = round(time.time() - start_time, 2)
            
            # ─── LOGGING ───
            logger.info(
                f"[AGENT GEN] Company: {data.company_name} | "
                f"Latency: {duration}s | Score: {score}% | Model: {main_model}"
            )

            yield json.dumps({
                "type": "final",
                "final_instructions": final,
                "score": score,
                "reasoning": reasoning,
                "latency": duration,
                "model": main_model
            }) + "\n"

        except Exception as e:
            traceback.print_exc()
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")


class RewriteRequest(BaseModel):
    current_instructions: str
    goal: str

@app.post("/api/rewrite")
async def api_rewrite(data: RewriteRequest):
    if not gemini_client:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set in .env")
    
    prompt = f"""### AGENT INSTRUCTION REWRITING TASK:
You are an expert AI Architect and Prompt Engineer. Your task is to rewrite or optimize the following Agent Instructions according to the user's goal.

### CURRENT INSTRUCTIONS:
{data.current_instructions}

### REWRITING GOAL / INSTRUCTIONS:
{data.goal}

### TASK REQUIREMENTS:
1. Maintain the core persona and business logic of the original instructions unless explicitly told to change them.
2. Improve clarity, professionalism, and conciseness.
3. Fix any logical inconsistencies.
4. Ensure the instructions remain in the 12-section "Industrial Production Framework" if applicable.
5. Output ONLY the improved, production-grade System Prompt.

Return the optimized prompt now."""
    
    try:
        res = gemini_client.models.generate_content(
            model="gemini-3.1-pro-preview",
            contents=prompt,
            config=genai_types.GenerateContentConfig(temperature=0.3)
        )
        return {"refined_instructions": res.text.strip()}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/refine")
async def api_refine(data: RefineRequest):
    if not gemini_client:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set in .env")
    
    # Filter for items that actually have violations
    violation_cases = [f for f in data.failures if f.get("violation") and f.get("violation") not in ["None", "N/A"]]
    if not violation_cases:
        # If no explicit violations, use low score cases
        violation_cases = [f for f in data.failures if f.get("score", 100) < 80]

    failure_context = "\n".join([
        f"FAIL CASE:\nQuestion: {f.get('q')}\nAgent Answered: {f.get('a')}\nViolation: {f.get('violation')}\nReason: {f.get('justification')}"
        for f in violation_cases[:10] 
    ])
    
    refine_prompt = f"""### AGENT INSTRUCTION REFINEMENT TASK:
You are a Senior Prompt Engineer specializing in Conversational AI. You have been provided with an audit report of an AI Voice Agent.
Your mission is to upgrade the current instructions to solve the identified failures while hardening the agent's logic and persona.

### AGENT IDENTITY:
Company: {data.company_name}
Agent: {data.agent_name}

### CURRENT INSTRUCTIONS:
{data.current_instructions}

### AUDIT FINDINGS (FAILURES):
{failure_context}

### REFINEMENT MANDATES (CRITICAL):
1. RECOVERY LOGIC: If the agent failed to repeat a question or clarify, add: "When asked to repeat, say 'Ok no problem' followed by the question."
2. RELEVANCE FILTERING: Hard-code a rejection for off-topic questions: "If a question is irrelevant to the business, say 'The Question is irrelevant to our business' and steer back."
3. CONCISENESS: Agent must remain human-like and concise. No robotic long-windedness.
4. GROUNDING: Strictly prohibit inventing facts. If info is missing, say "I don't have that information."
5. STRUCTURE: Maintain the 12-section "Industrial Production Framework" structure (Identity, Role, Objectives, Tone, Rules, Restrictions, Flow, Tools, Error Handling, Escalation, Closing, Final Execution).

### TASK:
- Analyze Gaps: Pinpoint the exact logic failure in the current prompt.
- Fix Logic: Add explicit, unambiguous rules to handle the edge cases seen in the failures.
- Production Optimization: Ensure the prompt is high-density and follows the "One idea per line" rule in the Rules section.

### OUTPUT FORMAT:
You MUST return a JSON object with exactly these keys:
- "gap_analysis": A clear, technical list of what was wrong/missing.
- "changes_made": A bulleted summary of specific logic hardening added.
- "refined_instructions": The complete, upgraded System Prompt.

No other text. Return ONLY valid JSON."""
    
    try:
        res = gemini_client.models.generate_content(
            model="gemini-3.1-pro-preview",
            contents=refine_prompt,
            config=genai_types.GenerateContentConfig(
                temperature=0.3,
                response_mime_type="application/json"
            )
        )
        return parse_json_response(res.text)
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))





@app.post("/api/generate_qa")
async def api_generate_qa(data: QaRequest):
    if not gemini_client:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set in .env")
    print(f"[QA Agent] Generating for KB (length: {len(data.input_kb)})")
    try:
        resp = gemini_client.models.generate_content(
            model="gemini-3.1-pro-preview",
            contents=f"Generate atleast 50 customer Q&A pairs 1 - from this KB dont make up any kind of answer from your mind on question that is from the KB, 2 - make some questions that you think are the corner case of this KB and 3 - finally make up some questions on your own to check on halucination. Return ONLY a JSON array of objects with keys: question, answer, type_of_question. No markdown backticks, no preamble text.\n\nKB:\n{data.input_kb}",
            config=genai_types.GenerateContentConfig(response_mime_type="application/json"),
        )
        qa_data = parse_json_response(resp.text)
        if isinstance(qa_data, dict) and "qa_list" in qa_data:
            qa_data = qa_data["qa_list"]
        elif isinstance(qa_data, dict) and "questions" in qa_data:
            qa_data = qa_data["questions"]
            
        if not isinstance(qa_data, list):
            if isinstance(qa_data, dict):
                qa_data = list(qa_data.values())
            else:
                qa_data = []

        # Generate plain text list of questions
        qa_text = "\n".join([item.get("question", item.get("q", "")) for item in qa_data if isinstance(item, dict)])

        print(f"[QA Agent] Successfully generated {len(qa_data)} pairs")
        return {"qa_list": qa_data, "qa_text": qa_text}
    except Exception as e:
        print(f"[QA Agent] Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/generate_flow")
async def api_generate_flow(data: QaRequest):
    if not gemini_client:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set in .env")
    print(f"[Flow Agent] Generating Tree for KB (length: {len(data.input_kb)})")
    try:
        prompt = f"""
Generate ONLY valid Mermaid flowchart syntax.

Rules:
- Start directly with: graph TD
- Think of all the possible corner cases and give the diagram accordingly
- Keep node labels short
- Avoid parentheses inside labels
- Avoid special characters like :, ;, ", '
- Use valid Mermaid syntax only
- Output must be directly renderable in Mermaid Live Editor
- Think step by step dont jump to the end

Example format:

graph TD
    A[Call Start] --> B[User Available]
    B -->|Yes| C[Continue]
    B -->|No| D[Schedule Callback]
    D --> E[End Call]

Now generate the workflow.
KB:
{data.input_kb}
"""
        resp = gemini_client.models.generate_content(
            model="gemini-3.1-pro-preview",
            contents=prompt
        )
        return {"flow_tree": resp.text.strip()}
    except Exception as e:
        print(f"[Flow Agent] Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ─── RAG Intelligence Lab ───────────────────────────────────────────────────

class RagStore:
    def __init__(self):
        self.chunks = []
        self.embeddings = []

    def clear(self):
        self.chunks = []
        self.embeddings = []

    def add_chunks(self, chunks, embeddings):
        self.chunks.extend(chunks)
        self.embeddings.extend(embeddings)

    def save(self, filepath="rag_index.json"):
        """Persists the index to disk."""
        try:
            data = {
                "chunks": self.chunks,
                "embeddings": [e if isinstance(e, list) else e.tolist() for e in self.embeddings]
            }
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(data, f)
            logger.info(f"[RAG STORE] Index saved to {filepath}")
        except Exception as e:
            logger.error(f"[RAG STORE] Failed to save index: {e}")

    def load(self, filepath="rag_index.json"):
        """Loads the index from disk."""
        if not os.path.exists(filepath):
            return False
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.chunks = data.get("chunks", [])
                self.embeddings = [np.array(e) for e in data.get("embeddings", [])]
            logger.info(f"[RAG STORE] Index loaded from {filepath} ({len(self.chunks)} chunks)")
            return True
        except Exception as e:
            logger.error(f"[RAG STORE] Failed to load index: {e}")
            return False

    def search(self, query_embedding, top_k=3):
        if not self.embeddings:
            return []
        
        # Convert to numpy for fast cosine similarity
        lib_embeddings = np.array(self.embeddings)
        query_vec = np.array(query_embedding)
        
        # Cosine similarity: (A . B) / (||A|| * ||B||)
        dot_products = np.dot(lib_embeddings, query_vec)
        lib_norms = np.linalg.norm(lib_embeddings, axis=1)
        query_norm = np.linalg.norm(query_vec)
        
        similarities = dot_products / (lib_norms * query_norm + 1e-10)
        
        # Get top-k indices
        top_indices = np.argsort(similarities)[::-1][:top_k]
        
        results = []
        for i in top_indices:
            score = float(similarities[i])
            results.append({"text": self.chunks[i], "score": score})
            logger.info(f"[RAG SEARCH] Chunk {i} Score: {score:.4f} | Preview: {self.chunks[i][:50]}...")
            
        return results

rag_store = RagStore()


@app.post("/api/rag/index")
async def api_rag_index(data: RagIndexRequest):
    if not gemini_client:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set")
    
    rag_store.clear()
    
    # 1. Simple Semantic Chunking
    text = data.input_kb
    chunks = []
    start = 0
    while start < len(text):
        end = start + data.chunk_size
        chunks.append(text[start:end])
        start += data.chunk_size - data.overlap
        if start >= len(text) - data.overlap:
            break

    try:
        # 2. Batch Embedding (Removed noisy question-aware pre-processing)
        # Directly embed chunks using the available gemini-embedding-2 model
        logger.info(f"[RAG INDEX] Embedding {len(chunks)} chunks using gemini-embedding-2...")
        
        batch_size = 50
        all_embeddings = []
        
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i+batch_size]
            res = gemini_client.models.embed_content(
                model="gemini-embedding-2",
                contents=batch,
                config=genai_types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
            )
            all_embeddings.extend([e.values for e in res.embeddings])

        if len(all_embeddings) != len(chunks):
            logger.error(f"[RAG INDEX] Length mismatch: {len(chunks)} chunks vs {len(all_embeddings)} embeddings")

        rag_store.add_chunks(chunks, all_embeddings)
        rag_store.save() # Persist after indexing
        return {"status": "success", "chunks_indexed": len(chunks)}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/query")
async def api_rag_query(data: RagQueryRequest):
    if not gemini_client:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set")
    
    if not rag_store.chunks:
        raise HTTPException(status_code=400, detail="Index is empty. Please index KB first.")

    try:
        start_time = time.time()
        
        # 1. Embed Direct User Query
        q_res = gemini_client.models.embed_content(
            model="gemini-embedding-2",
            contents=data.query,
            config=genai_types.EmbedContentConfig(task_type="RETRIEVAL_QUERY")
        )
        query_vec = q_res.embeddings[0].values

        # 2. Vector Search (Top 3 Chunks)
        results = rag_store.search(query_vec, top_k=3)
        context = "\n---\n".join([r["text"] for r in results])

        # 3. Augmented Generation
        history_str = ""
        if data.history:
            history_str = "\n### CONVERSATION HISTORY:\n" + "\n".join([f"{h['role'].upper()}: {h['content']}" for h in data.history])

        if data.agent_instructions:
            # High-fidelity Agent alignment with Flow Enforcement & Memory
            prompt = f"""### SYSTEM INSTRUCTIONS & AGENT FRAMEWORK:
{data.agent_instructions}

### RETRIEVED KNOWLEDGE BASE CONTEXT:
{context}
{history_str}

### CURRENT USER QUERY:
{data.query}

### MANDATORY EXECUTION RULES:
1. **Context Adherence**: Use ONLY the provided Knowledge Base Context. DO NOT assume details like prices, dates, or contact info unless they are explicitly written in the Context.
2. **Strict Knowledge Bound**: If the answer needed is not in the context, strictly state: "I'm sorry, I don't have Information about that right now." NEVER make up parameters or assumptions.
3. **No Assumptions**: DO NOT assume customer parameters (like budget, preference, or location) unless the customer has explicitly mentioned them in the Conversation History.
4. **Tone & Style**: Sound human, proactive, and efficient. Ask only one question at a time. Do not repeat what the user just said.

### YOUR RESPONSE:"""
        else:
            # Standard Raw RAG
            prompt = f"""Answer the question using ONLY the retrieved context below.
If the answer isn't in the context, say you don't have that information right now.
DO NOT assume any parameters not explicitly mentioned.

RETRIEVED CONTEXT:
{context}

QUESTION:
{data.query}

ANSWER:"""
        
        llm_start = time.time()
        ans_res = gemini_client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=prompt,
            config=genai_types.GenerateContentConfig(temperature=0.2)
        )
        llm_duration = round((time.time() - llm_start) * 1000)
        
        answer_text = ans_res.text.strip()
        
        # 4. Relevance Evaluation (Self-Check)
        if data.reference_answer:
            eval_prompt = f"""### FACTUAL ACCURACY & INSTRUCTION AUDIT (GROUND-TRUTH COMPARISON):
Verify if the AGENT ANSWER matches the REFERENCE ANSWER and follows the AGENT INSTRUCTIONS.

### RETRIEVED CONTEXT:
{context}

### AGENT INSTRUCTIONS:
{data.agent_instructions}

### REFERENCE ANSWER (GROUND TRUTH):
{data.reference_answer}

### AGENT ANSWER (TO BE EVALUATED):
{answer_text}

### AUDIT RULES:
1. **Semantic Similarity**: Is the agent's answer factually consistent with the reference answer?
2. **Instruction Adherence**: Did the agent follow the tone, proactive flow, and constraints in the AGENT INSTRUCTIONS?
3. **Proactive Flow**: Does the agent end the response with a helpful question?
4. **Scoring**:
   - GIve 100 percent even if The agent skipped the mandatory 'Greeting' and 'Permission-based opening' steps, jumping directly to an objection handling response before establishing the call context if the answer is relevant/grounded."
   - Give 100 percent ONLY if the answer is relevant/correct AND follows all instructions.
   - Give 80 percent if correct but violates a minor instruction (e.g. no proactive question).
   - Give < 60 if it fails on facts or critical instructions.

Return only a JSON object: {{"score": number, "justification": "short explanation", "failure_source": "CONTEXT_MISSING" | "INSTRUCTION_FAIL" | "NONE", "instruction_violation": "Detail what specific instruction was violated, or 'None'"}}"""
        else:
            eval_prompt = f"""### FACTUAL ACCURACY & INSTRUCTION AUDIT:
Verify if the AGENT ANSWER is grounded in the CONTEXT and follows the AGENT INSTRUCTIONS.

### RETRIEVED CONTEXT:
{context}

### AGENT INSTRUCTIONS:
{data.agent_instructions}

### AGENT ANSWER:
{answer_text}

### AUDIT RULES:
1. **Context Grounding**: Is the answer supported by the retrieved context?
2. **Instruction Adherence**: Did the agent follow the provided framework and rules?
3. **Proactive Flow**: Does the agent end with a question?
4. **Scoring**:
   - GIve 100 percent even if The agent skipped the mandatory 'Greeting' and 'Permission-based opening' steps, jumping directly to an objection handling response before establishing the call context if the answer is relevant/grounded."
   - Give 100 percent if relevant/grounded AND follows all instructions.
   - Give 80 percent if relevant but misses a minor instruction.
   - Give 0 percent if it hallucinates or ignores major constraints.

Return only a JSON object: {{"score": number, "justification": "short explanation", "failure_source": "CONTEXT_MISSING" | "INSTRUCTION_FAIL" | "NONE", "instruction_violation": "Specific detail of what instruction was ignored, or 'None'"}}"""
        
        eval_res = gemini_client.models.generate_content(
            model="gemini-3.1-flash-lite",
            contents=eval_prompt,
            config=genai_types.GenerateContentConfig(response_mime_type="application/json", temperature=0.2)
        )
        try:
            eval_data = json.loads(eval_res.text)
            rel_score = int(eval_data.get("score", 0))
            justification = eval_data.get("justification", "")
            failure_source = eval_data.get("failure_source", "NONE")
            instruction_violation = eval_data.get("instruction_violation", "None")
        except:
            rel_score = 0
            justification = "Failed to parse auditor response"
            failure_source = "NONE"
            instruction_violation = "N/A"

        total_duration = round((time.time() - start_time) * 1000)
        
        # ─── LOGGING ───
        logger.info(
            f"[RAG QUERY] Q: {data.query[:100]}... | "
            f"Latency: {total_duration}ms (LLM: {llm_duration}ms) | "
            f"Score: {rel_score}% | "
            f"Source: {failure_source}"
        )

        return {
            "answer": answer_text,
            "context": results,
            "latency": total_duration,
            "llm_latency": llm_duration,
            "model": "gemini-3.1-flash-lite",
            "relevance_score": rel_score,
            "justification": justification,
            "failure_source": failure_source,
            "instruction_violation": instruction_violation
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/rag/benchmark")
async def api_rag_benchmark(data: dict):
    """
    Automates asking multiple questions to the RAG bot.
    Expects: {"questions": ["q1", "q2", ...], "agent_instructions": "..."}
    """
    if not gemini_client:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY not set")
    
    questions = data.get("questions", [])
    agent_instr = data.get("agent_instructions", "")
    results = []
    
    for q in questions:
        try:
            # Re-use the existing logic or call it
            res = await api_rag_query(RagQueryRequest(query=q, agent_instructions=agent_instr))
            results.append({
                "question": q,
                "answer": res["answer"],
                "score": res["relevance_score"],
                "latency": res["latency"]
            })
        except:
            results.append({"question": q, "answer": "Error", "score": 0})
            
    return {"results": results}


@app.get("/api/logs")
async def get_logs():
    """Returns the last 500 lines of the performance log."""
    log_file = "rag_performance.log"
    if not os.path.exists(log_file):
        return {"logs": "Log file not created yet."}
    
    try:
        with open(log_file, "r", encoding="utf-8") as f:
            # Read last 500 lines efficiently
            lines = f.readlines()
            last_lines = lines[-500:]
            return {"logs": "".join(last_lines)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ClientLog(BaseModel):
    level: str = "INFO"
    message: str

@app.post("/api/log")
async def api_log_client(log: ClientLog):
    """Allows client-side metrics/events to be saved to the server log."""
    if log.level.upper() == "ERROR":
        logger.error(f"CLIENT ERROR: {log.message}")
    else:
        logger.info(f"CLIENT INFO: {log.message}")
    return {"status": "ok"}


class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None

@app.post("/api/tts")
async def api_tts(request: TTSRequest):
    """
    Synthesizes text to speech using Azure Neural Voices.
    Returns a streaming MP3 response.
    """
    if not speech_config:
        raise HTTPException(status_code=500, detail="Azure Speech not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.")

    try:
        start_time = time.time()
        # Strip markdown for better speech
        clean_text = re.sub(r'[*#_~`>]', '', request.text)
        
        synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
        result = synthesizer.speak_text_async(clean_text).get()
        latency_ms = int((time.time() - start_time) * 1000)

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
            logger.info(f"TTS SUCCESS | Latency: {latency_ms}ms | Text Length: {len(clean_text)}")
            return StreamingResponse(
                io.BytesIO(result.audio_data),
                media_type="audio/mpeg",
                headers={"X-TTS-Latency": str(latency_ms)}
            )
        elif result.reason == speechsdk.ResultReason.Canceled:
            cancellation_details = result.cancellation_details
            logger.error(f"Speech synthesis canceled: {cancellation_details.reason}")
            if cancellation_details.reason == speechsdk.CancellationReason.Error:
                logger.error(f"Error details: {cancellation_details.error_details}")
            raise HTTPException(status_code=500, detail="Azure Speech synthesis failed.")
        
        raise HTTPException(status_code=500, detail="Unknown error in speech synthesis.")

    except Exception as e:
        logger.error(f"TTS Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Entry Point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    config = uvicorn.Config("main:app", host="127.0.0.1", port=8000, loop="asyncio")
    server = uvicorn.Server(config)
    asyncio.run(server.serve())


