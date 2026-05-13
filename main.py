import asyncio
import sys
import os
import io
import zipfile
import traceback
import re
import json
from contextlib import asynccontextmanager
from urllib.parse import urljoin, urlparse
from typing import Optional

# CRITICAL: Must be set before any other imports that touch the event loop
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import uvicorn
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, HttpUrl
from dotenv import load_dotenv
from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from google import genai

load_dotenv()

# ─── Gemini Client ────────────────────────────────────────────────────────────

api_key = os.getenv("GEMINI_API_KEY")
gemini_client: Optional[genai.Client] = None
if api_key:
    gemini_client = genai.Client(api_key=api_key)


@asynccontextmanager
async def lifespan(app: FastAPI):
    loop = asyncio.get_running_loop()
    print(f"[NanoCrawler] Event loop: {type(loop).__name__}", flush=True)
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

def get_domain(url: str) -> str:
    try:
        netloc = urlparse(str(url)).netloc
        return netloc.split(':')[0].replace("www.", "").lower()
    except Exception:
        return ""


def clean_and_summarize(html_content: str) -> dict:
    soup = BeautifulSoup(html_content, 'html.parser')

    # Collect links before stripping content
    links = [
        {"text": a.get_text().strip() or "No Text", "url": a['href']}
        for a in soup.find_all('a', href=True)
    ]

    # Remove noisy elements
    for element in soup(["script", "style", "nav", "footer", "header", "aside", "form"]):
        element.decompose()

    main_content = soup.find('main') or soup.find('article') or soup.body
    if main_content:
        elements = main_content.find_all(['p', 'h1', 'h2', 'h3', 'li'])
        text_blocks = [el.get_text().strip() for el in elements if len(el.get_text().strip()) > 30]
        full_text = ' '.join(text_blocks[:30])
    else:
        full_text = ' '.join(soup.stripped_strings)

    full_text = re.sub(r'\s+', ' ', full_text).strip()
    title = soup.title.string.strip() if soup.title and soup.title.string else "No Title"

    return {"title": title, "full_text": full_text, "links": links}


# ─── WebSocket Manager ───────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception:
                pass


manager = ConnectionManager()


# ─── Routes ──────────────────────────────────────────────────────────────────

@app.get("/")
async def read_index():
    return FileResponse('index.html')


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ─── Crawler Worker ──────────────────────────────────────────────────────────

active_workers = 0

SKIP_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".gif", ".zip", ".exe", ".dmg", ".mp4", ".mp3", ".svg", ".ico"}
SKIP_PREFIXES = ("mailto:", "javascript:", "tel:", "#")


async def playwright_worker(worker_id: int, queue: asyncio.Queue, visited: set,
                             results: list, root_domain: str,
                             request: CrawlRequest, browser_context):
    global active_workers

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
                    await manager.broadcast(
                        f"BROWSER-{worker_id} -> CRAWLING: {current_url}"
                        + (f" (retry {attempt})" if attempt > 0 else "")
                    )

                    page = await browser_context.new_page()
                    await page.goto(current_url, timeout=30000, wait_until="domcontentloaded")

                    if request.mode == "maximum":
                        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        await asyncio.sleep(1)

                    content = await page.content()
                    data = clean_and_summarize(content)

                    results.append({
                        "title": data["title"],
                        "url": current_url,
                        "full_text": data["full_text"],
                        "links": data["links"]
                    })

                    await manager.broadcast(f"BROWSER-{worker_id} -> SUCCESS: {data['title']}")

                    # Discover and enqueue new links
                    for link in data["links"]:
                        href = link["url"]

                        # Skip unwanted protocols/anchors
                        if any(href.startswith(p) for p in SKIP_PREFIXES):
                            continue

                        full_url = urljoin(page.url, href).split('#')[0].rstrip('/')

                        # Only follow http/https
                        if not full_url.startswith("http"):
                            continue

                        # Skip binary/media file extensions
                        path_lower = urlparse(full_url).path.lower()
                        if any(path_lower.endswith(ext) for ext in SKIP_EXTENSIONS):
                            continue

                        link_domain = get_domain(full_url)
                        domain_ok = (
                            link_domain.endswith(root_domain)
                            if request.include_subdomains
                            else link_domain == root_domain
                        )

                        if domain_ok and full_url not in visited:
                            if len(results) + queue.qsize() < request.max_pages:
                                visited.add(full_url)
                                await queue.put(full_url)

                    break  # Success — exit retry loop

                except Exception as e:
                    traceback.print_exc()
                    if attempt < 2:
                        await manager.broadcast(f"BROWSER-{worker_id} -> RETRYING ({attempt+1}/3): {e}")
                        await asyncio.sleep(2)
                    else:
                        await manager.broadcast(f"BROWSER-{worker_id} -> ERROR: {e}")
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
    global active_workers
    active_workers = 0

    base_url = str(request.url).split('#')[0].rstrip('/')
    root_domain = get_domain(base_url)
    visited: set = {base_url}
    results: list = []
    queue: asyncio.Queue = asyncio.Queue()
    await queue.put(base_url)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        )

        workers = [
            asyncio.create_task(
                playwright_worker(i + 1, queue, visited, results, root_domain, request, context)
            )
            for i in range(request.concurrency)
        ]

        # Wait until all work is done or page limit is hit
        while True:
            await asyncio.sleep(0.5)
            if (queue.empty() and active_workers == 0) or len(results) >= request.max_pages:
                break

        # Send shutdown signals to all workers
        for _ in range(request.concurrency):
            await queue.put(None)

        await asyncio.gather(*workers, return_exceptions=True)
        await browser.close()

    await manager.broadcast(f"SYSTEM -> Crawl complete. {len(results)} pages indexed.")
    return {"root_url": base_url, "total_pages": len(results), "pages": results}


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

    await manager.broadcast(f"SYSTEM -> Generating {request.model_type} Knowledge Base...")

    combined_text = "".join(
        f"\n--- PAGE: {p['url']} ---\n{p.get('full_text', '')}\n"
        for p in request.pages[:30]
    )

    final_prompt = base_prompt.replace("{SCRAPED_CONTENT}", combined_text[:30000])

    # Append any extra instructions from the user
    if request.extra_instructions.strip():
        final_prompt += f"\n\n---\nAdditional Instructions from user:\n{request.extra_instructions.strip()}"

    try:
        response = gemini_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[final_prompt]
        )
        await manager.broadcast("SYSTEM -> Knowledge Base synthesized successfully.")
        return {"kb": response.text}
    except Exception as e:
        traceback.print_exc()
        await manager.broadcast(f"SYSTEM -> KB Error: {e}")
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


class QaRequest(BaseModel):
    input_kb: str


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
            model="gemini-2.5-flash", contents=eval_prompt,
            config=genai_types.GenerateContentConfig(response_mime_type="application/json"),
        )
        result = json.loads(resp.text.strip().lstrip("```json").rstrip("```").strip())
        score = result.get("score", 0)
        reasoning = result.get("reasoning", "")
        improved_kb = None
        if score < 75:
            recon = gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=f"Clean and restructure this KB. Fix formatting, remove noise. Return ONLY the cleaned KB.\nReasoning: {reasoning}\n\nKB:\n{data.input_kb}",
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
    try:
        flow_context = f"\n\nConversational Flow Logic to follow:\n{data.flow_tree}" if data.flow_tree else ""
        prompt = f"{template}\n\nKB:\n{data.input_kb}\n\nCompany Name: {data.company_name}\nAgent Name: {data.agent_name}\nExtra Instructions: {data.extra_instructions}{flow_context}\n\nReturn ONLY the system prompt."
        initial = gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        ).text.strip()
        eval_r = json.loads(gemini_client.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"Score these instructions vs the template 0-100. Return JSON {{score, reasoning}}.\nTemplate:\n{template}\nInstructions:\n{initial}",
            config=genai_types.GenerateContentConfig(response_mime_type="application/json"),
        ).text.strip().lstrip("```json").rstrip("```").strip())
        score, reasoning = eval_r.get("score", 0), eval_r.get("reasoning", "")
        final, was_refined = initial, False
        if score < 75:
            was_refined = True
            final = gemini_client.models.generate_content(
                model="gemini-2.5-flash",
                contents=f"Rewrite these instructions to perfectly match the template.\nReason: {reasoning}\nTemplate:\n{template}\nOriginal:\n{initial}\nReturn ONLY refined instructions.",
            ).text.strip()
        return {"final_instructions": final, "auditor_score": score, "auditor_reasoning": reasoning, "was_refined": was_refined}
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
            model="gemini-2.5-flash",
            contents=f"Generate 25+ customer Q&A pairs from this KB. Return ONLY a JSON array of objects with keys: question, answer, type_of_question. No markdown backticks, no preamble text.\n\nKB:\n{data.input_kb}",
            config=genai_types.GenerateContentConfig(response_mime_type="application/json"),
        )
        # Robust JSON extraction
        raw_text = resp.text.strip()
        if "```json" in raw_text:
            raw_text = raw_text.split("```json")[1].split("```")[0].strip()
        elif "```" in raw_text:
            raw_text = raw_text.split("```")[1].split("```")[0].strip()
        
        qa_data = json.loads(raw_text)
        print(f"[QA Agent] Successfully generated {len(qa_data)} pairs")
        return {"qa_list": qa_data}
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
- Do NOT wrap output inside triple backticks
- Do NOT include ```mermaid
- Start directly with: graph TD
- Keep node labels short
- Avoid parentheses inside labels
- Avoid special characters like :, ;, ", '
- Use simple Yes/No branches
- Use valid Mermaid syntax only
- Keep arrows simple using -->
- Output must be directly renderable in Mermaid Live Editor
- No explanations
- No markdown
- No extra text
- dont try to visualize just give command

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
            model="gemini-2.0-flash",
            contents=prompt
        )
        return {"flow_tree": resp.text.strip()}
    except Exception as e:
        print(f"[Flow Agent] Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ─── Entry Point ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

    config = uvicorn.Config("main:app", host="127.0.0.1", port=8000, loop="asyncio")
    server = uvicorn.Server(config)
    asyncio.run(server.serve())


