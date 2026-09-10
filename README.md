# NanoCrawler — Web Intelligence & Agent Builder

> A browser-based AI engineering platform that crawls dynamic websites, converts web content into structured knowledge, audits and reconstructs the resulting knowledge base, generates AI agent instructions, builds conversational flow logic, and evaluates the resulting agent through RAG-based testing.

---

## Overview

**NanoCrawler** is an end-to-end web intelligence and AI agent configuration system.

The system starts with a website URL and transforms raw web content into a structured AI-agent development and evaluation pipeline.

```text
Website URL
    |
    v
Playwright / Chromium Crawler
    |
    v
HTML Extraction + Semantic Cleaning
    |
    v
Gemini Knowledge Base Synthesis
    |
    v
Knowledge Base Quality Audit
    |
    +----------------------+
    |                      |
    | Score >= 75          | Score < 75
    |                      |
    v                      v
 Continue             AI Reconstruction
                            |
                            +-----------+
                                        |
                                        v
                            Agent Instruction Builder
                                        |
                  +---------------------+---------------------+
                  |                     |                     |
                  v                     v                     v
          Agent Instructions       Flow Tree             Synthetic Q&A
                  |                     |                     |
                  v                     |                     v
           Instruction Audit            |              Automated Testing
                  |                    |
                  v                    |
           Refined Instructions        |
                  |                    |
                  +----------+---------+
                             |
                             v
                         RAG Lab
                             |
                             v
                  Retrieval + Generation
                             |
                             v
                      Answer Evaluation
                             |
                             v
                      Failure Diagnosis
                             |
                             v
                  Instruction Refinement
                             |
                             v
                           Re-test
```

The application is implemented using an asynchronous **FastAPI** backend with a browser-based frontend. Website crawling uses **Playwright/Chromium**, page content is cleaned using **BeautifulSoup**, Gemini models handle synthesis and evaluation, and the RAG subsystem uses Gemini embeddings with NumPy-based cosine similarity search.

---

# What the System Does

## 1. Dynamic Website Crawling

NanoCrawler uses **Playwright** rather than relying only on traditional HTTP requests. This allows the crawler to work with websites that depend on JavaScript and dynamic rendering.

The crawler:

* launches Chromium in headless mode
* creates a browser context
* crawls pages concurrently using asynchronous workers
* follows links discovered on pages
* restricts crawling to the target domain by default
* optionally permits subdomains
* skips binary and media resources
* supports configurable page limits
* supports configurable worker concurrency
* provides **Deep Research** and **Forensic Depth** crawling modes

The Forensic Depth mode performs additional scrolling and waits for network activity to expose dynamically loaded content.

The backend also performs a `robots.txt` check before beginning the browser workload.

---

# 2. Semantic HTML Extraction and Cleaning

Raw web pages contain a large amount of browser-facing information that is not useful for downstream AI processing.

NanoCrawler preprocesses the pages before sending the content to an LLM.

The extraction pipeline prioritizes:

* `<main>`
* `<article>`
* `<body>`

and extracts semantic content such as:

* headings
* paragraphs
* list items
* table cells
* spans

Navigation, footer, header, and script content are filtered during processing.

Whitespace is normalized, page titles are extracted, and the resulting text is bounded before being passed to downstream AI components.

This gives the crawler a role beyond page retrieval: it acts as a **semantic preprocessing layer** that prepares web content for LLM processing.

---

# 3. AI Knowledge Base Synthesis

After crawling, NanoCrawler can convert the collected website content into a structured knowledge base.

The user can select a generation strategy and provide additional instructions before synthesis.

The backend combines crawled page content and sends it to Gemini for structured knowledge extraction.

The generated knowledge base can capture information such as:

* company information
* products and services
* pricing
* FAQs
* target customers
* differentiators
* policies
* onboarding information
* contact information
* other domain-specific business information

The crawler output is bounded when constructing the synthesis prompt to control the amount of information passed to the model.

---

# 4. Knowledge Base Quality Auditor

NanoCrawler does not assume that an LLM-generated knowledge base is automatically correct.

A separate auditing stage evaluates the generated KB.

The Knowledge Base Auditor evaluates:

* formatting quality
* relevance
* coherence

and produces both a score and reasoning.

The current quality threshold is **75**.

```text
Generated Knowledge Base
          |
          v
      Quality Audit
          |
      +---+---+
      |       |
      |       |
   >= 75     < 75
      |       |
      v       v
 Continue   AI Reconstruction
              |
              v
       Improved Knowledge Base
```

This creates a basic:

**Generate → Evaluate → Repair**

workflow instead of relying on a single generation pass.

---

# 5. AI Agent Instruction Builder

The Agent Builder converts the generated knowledge base into an AI agent instruction set.

The backend supports configuration including:

* instruction template
* instruction type
* inbound/outbound call direction
* agent name
* company name
* additional instructions
* conversational flow tree
* performance mode

Instruction templates are loaded from the `KB_to_AgentInstruction` component.

The generated instruction framework covers concepts such as:

* identity
* role
* objectives
* tone
* rules
* restrictions
* flow
* tools
* error handling
* escalation
* closing
* execution logic

---

# 6. Instruction Generation and Automatic Auditing

Generated agent instructions are automatically evaluated.

```text
Template + Knowledge Base + Configuration
                  |
                  v
          Instruction LLM
                  |
                  v
        Initial Instructions
                  |
                  v
            Auditor Model
                  |
             +----+----+
             |         |
             v         v
           PASS       FAIL
             |         |
             |         v
             |    Refinement Pass
             |         |
             +----+----+
                  |
                  v
         Final Instructions
```

The auditor compares the generated instructions against the selected template and produces a score and reasoning.

When the score is below **75**, a refinement stage is triggered automatically.

The generation endpoint exposes:

* final instructions
* audit score
* reasoning
* generation latency
* selected model

The backend returns these through newline-delimited JSON events so the frontend can display progress and results incrementally.

---

# 7. Conversational Flow Tree Generation

NanoCrawler can generate a conversational decision flow from the generated knowledge base.

The application uses Gemini to generate the flow structure, which the frontend can render and edit.

A simplified example:

```text
Initial Audit
      |
      v
Design System
      |
      v
Installation
      |
      v
Subscription
      |
      v
Outcome
      |
      v
End
```

The generated flow can also be edited manually in the interface before being incorporated into the agent-building process.

---

# 8. Synthetic Q&A Generation

The Agent Builder can generate a testing dataset from the knowledge base.

The system generates multiple classes of questions:

1. Questions directly answerable from the knowledge base
2. Corner-case questions
3. Questions intended to expose hallucination or unsupported behavior

The API returns structured JSON such as:

```json
{
  "question": "...",
  "answer": "...",
  "type_of_question": "..."
}
```

The frontend can display both the complete JSON dataset and a simplified question list.

---

# 9. RAG Intelligence Lab

NanoCrawler includes a lightweight RAG implementation for testing the generated agent.

## Indexing

The knowledge base is divided into overlapping chunks.

Current defaults:

```text
Chunk size: 500 characters
Overlap:    100 characters
```

The chunks are embedded using:

```text
gemini-embedding-2
```

Embeddings are generated in batches of 50 and persisted to:

```text
rag_index.json
```

## Retrieval

The retrieval pipeline is:

```text
User Query
    |
    v
Query Embedding
    |
    v
Cosine Similarity Search
    |
    v
Top-K Chunks
    |
    v
Context Assembly
    |
    v
Gemini Generation
```

The implementation performs cosine similarity calculations directly with NumPy and returns the highest-scoring chunks.

The default query configuration retrieves the top **3** chunks.

---

# 10. Grounded Answer Generation

The RAG subsystem operates in two main modes.

## Raw RAG Mode

The model receives:

* retrieved context
* user question

and is instructed to generate the answer using the retrieved material.

## Agent-Guided Mode

The model additionally receives:

* agent instructions
* retrieved knowledge
* conversation history
* current user query

This allows NanoCrawler to evaluate both:

**Is the answer grounded in the retrieved knowledge?**

and:

**Does the answer follow the intended agent behavior?**

---

# 11. Answer-Level Self Evaluation

Every RAG response can be evaluated against the retrieved context and, when available, a reference answer.

The evaluator checks:

* context grounding
* instruction adherence
* response behavior
* factual consistency
* proactive conversational flow

The evaluator returns structured diagnostics such as:

```json
{
  "score": 0,
  "justification": "...",
  "failure_source": "CONTEXT_MISSING",
  "instruction_violation": "..."
}
```

The backend records information including:

* total latency
* LLM latency
* relevance score
* failure source
* instruction violation
* retrieved context

This allows the RAG subsystem to function both as an answering mechanism and as an evaluation harness.

---

# 12. Automated Agent Benchmarking

NanoCrawler can run multiple generated questions against the RAG agent automatically.

For every test case, the system records:

```text
Question
    |
    v
Answer
    |
    v
Score
    |
    v
Latency
```

The frontend presents the results as a diagnostic test run rather than requiring each question to be tested manually.

---

# 13. Diagnostic Instruction Refinement

A central concept in NanoCrawler is feeding evaluation results back into agent instruction engineering.

When failures are detected, the platform:

1. identifies failed test cases
2. extracts the question, answer, violation and justification
3. constructs a failure context
4. sends the failures to a refinement prompt
5. asks Gemini to identify the underlying instruction gap
6. generates hardened instructions
7. returns the diagnosis and refined instruction set

The refinement process focuses on areas such as:

* recovery behavior
* relevance filtering
* concise responses
* knowledge grounding
* production-oriented instruction structure

The overall loop is:

```text
Agent Instructions
        |
        v
     RAG Test
        |
        v
    Evaluation
        |
        v
 Failure Detection
        |
        v
Root Cause / Gap Analysis
        |
        v
Instruction Refinement
        |
        +--------------------+
                             |
                             v
                           Re-test
```

This creates an iterative:

**Test → Evaluate → Diagnose → Refine → Re-test**

workflow.

---

# 14. Agent Rewriter

NanoCrawler also includes a standalone instruction rewriting component.

```text
Current Instructions
        +
   Rewriting Goal
        |
        v
      Gemini
        |
        v
Refined Instructions
```

The rewriter is designed to preserve the original persona and business logic while improving clarity, consistency and production-readiness.

---

# 15. Voice / TTS Layer

NanoCrawler contains an optional text-to-speech layer using **Azure Cognitive Services Speech**.

The backend:

* accepts generated text
* removes common Markdown formatting characters
* synthesizes speech using an Azure Neural Voice
* measures synthesis latency
* returns MP3 audio
* exposes measured latency through an HTTP response header

The frontend can enable or disable TTS and display TTS latency alongside the response.

The default configured voice is:

```text
en-US-AvaNeural
```

The configured output is a 16 kHz mono MP3 stream.

---

# 16. Performance and Observability

Performance is treated as part of the application's evaluation workflow.

The backend writes structured runtime information to:

```text
rag_performance.log
```

The recorded information includes:

* crawler activity
* model selection
* generation latency
* RAG query latency
* LLM latency
* evaluation scores
* failure sources
* TTS latency
* client-side events

The frontend includes a log viewer capable of retrieving the most recent 500 log lines through the API.

---

# Architecture

The system is organized into several cooperating layers:

```text
                               NANOCRAWLER
                                    |
                                    v
                    +-------------------------------+
                    |       Web Application          |
                    |       HTML / CSS / JS          |
                    +---------------+---------------+
                                    |
                                    v
                    +-------------------------------+
                    |       FastAPI Backend          |
                    |     Async API + Orchestration   |
                    +---------------+---------------+
                                    |
                                    v
                    +-------------------------------+
                    |       Website Crawler           |
                    |                                |
                    |  Playwright / Chromium          |
                    |  - Dynamic rendering            |
                    |  - Concurrent crawling          |
                    |  - Domain filtering             |
                    |  - robots.txt checking          |
                    +---------------+---------------+
                                    |
                                    v
                    +-------------------------------+
                    |   HTML Extraction & Cleaning    |
                    |                                |
                    |  BeautifulSoup                  |
                    |  - Semantic extraction           |
                    |  - Noise removal                |
                    |  - Text normalization            |
                    +---------------+---------------+
                                    |
                                    v
                    +-------------------------------+
                    |   Knowledge Base Generation     |
                    |                                |
                    |          Google Gemini           |
                    +---------------+---------------+
                                    |
                                    v
                    +-------------------------------+
                    |     Knowledge Base Auditor      |
                    |                                |
                    |  Relevance / Coherence / Format |
                    +---------------+---------------+
                                    |
                         +----------+----------+
                         |                     |
                      PASS >=75             FAIL <75
                         |                     |
                         |                     v
                         |        +-------------------------+
                         |        |   AI Reconstruction      |
                         |        +------------+-------------+
                         |                     |
                         +----------+----------+
                                    |
                                    v
                    +-------------------------------+
                    |         Agent Builder          |
                    +-------------------------------+
                       |            |             |
                       |            |             |
                       v            v             v
                 +----------+ +----------+ +-------------+
                 | Agent    | | Flow     | | Synthetic  |
                 | Prompt   | | Tree     | | Q&A Tests  |
                 +----+-----+ +----------+ +------+------+
                      |                         |
                      v                         |
                 +----------+                   |
                 | Prompt   |                   |
                 | Auditor  |                   |
                 +----+-----+                   |
                      |                         |
                 +----+----+                    |
                 |         |                    |
                PASS      FAIL                  |
                 |         |                    |
                 |         v                    |
                 |   +-------------+             |
                 |   | Instruction |             |
                 |   | Refinement  |             |
                 |   +------+------+\            |
                 |          |                    |
                 +----------+--------------------+
                            |
                            v
                 +-------------------------------+
                 |       RAG Intelligence Lab     |
                 |                                |
                 |  Knowledge Base                 |
                 |       |                        |
                 |       v                        |
                 |  Chunking + Embeddings          |
                 |       |                        |
                 |       v                        |
                 |  NumPy Vector Index             |
                 |       |                        |
                 |       v                        |
                 |  Cosine Similarity Retrieval    |
                 |       |                        |
                 |       v                        |
                 |  Gemini Answer Generation       |
                 +---------------+----------------+
                                 |
                                 v
                 +-------------------------------+
                 |       Answer Evaluation         |
                 |                                |
                 |  - Grounding                    |
                 |  - Relevance                    |
                 |  - Instruction adherence        |
                 |  - Failure source               |
                 |  - Latency                      |
                 +---------------+----------------+
                                 |
                                 v
                 +-------------------------------+
                 |       Failure Diagnosis         |
                 +---------------+----------------+
                                 |
                                 v
                 +-------------------------------+
                 |    Instruction Refinement       |
                 +---------------+----------------+
                                 |
                                 +---------------> Re-test
```

### Core Pipeline

```text
Website
   |
   v
Crawl
   |
   v
Clean
   |
   v
Knowledge Base
   |
   v
Audit
   |
   v
Agent Instructions
   |
   +--------------------+
   |                    |
   v                    v
Flow Generation     Synthetic Q&A
   |                    |
   +----------+---------+
              |
              v
         RAG Testing
              |
              v
       Answer Evaluation
              |
              v
       Failure Diagnosis
              |
              v
    Instruction Refinement
              |
              v
           Re-test
```

---

# Supporting Components

```text
                 +-----------------------------+
                 |       Gemini Models         |
                 |                             |
                 |  KB Generation              |
                 |  Evaluation                 |
                 |  Agent Instructions         |
                 |  Flow Generation            |
                 |  Q&A Generation             |
                 |  Refinement                 |
                 +--------------+--------------+
                                |
                                |
       +------------------------+------------------------+
       |                        |                        |
       v                        v                        v
+--------------+      +----------------------+   +-------------+
| Prompt       |      | Performance Logging  |   | Azure TTS   |
| Management   |      |                      |   |             |
|              |      | rag_performance.log  |   | Text -> MP3 |
| prompts.json |      | Latency / diagnostics|   | Neural Voice|
+--------------+      +----------------------+   +-------------+
```

---

# Technology Stack

## Backend

* Python
* FastAPI
* Uvicorn
* Pydantic
* AsyncIO
* HTTPX

## Web Intelligence

* Playwright
* Chromium
* BeautifulSoup4
* `urllib.robotparser`
* URL parsing and normalization

## Generative AI

* Google Gemini API
* Gemini 3.1 Flash-Lite
* Gemini 3.1 Pro Preview
* Gemini Embeddings

## Retrieval

* NumPy
* Vector embeddings
* Cosine similarity
* Persistent JSON vector store

## Voice

* Azure Cognitive Services Speech
* Azure Neural Voices

## Frontend

* HTML
* CSS
* Vanilla JavaScript
* Mermaid.js for rendering generated conversational flow diagrams within the application

---

# Repository Structure

```text
.
├── KB_to_AgentInstruction/
│   └── Agent instruction template configuration
│
├── static/
│   ├── script.js
│   └── style.css
│
├── scratch/
│   └── Development / working artifacts
│
├── index.html
│   └── Main web application interface
│
├── main.py
│   └── FastAPI backend, crawler, AI pipeline, RAG and TTS APIs
│
├── prompts.json
│   └── Editable knowledge-base generation prompts
│
├── rag_index.json
│   └── Persisted RAG chunks and embeddings
│
├── rag_performance.log
│   └── Runtime performance and diagnostic logs
│
├── ARCHITECTURE.md
│   └── Architecture notes
│
├── flow.md
│   └── Generated conversational flow example
│
└── requirements.txt
    └── Python dependencies
```

---

# API Surface

## Crawling

```http
GET  /
POST /api/crawl
```

## Prompt Management

```http
GET    /prompts
POST   /prompts
PUT    /prompts/{key}
DELETE /prompts/{key}
```

## Knowledge Base

```http
POST /generate-kb
POST /api/evaluate
POST /download-kb-txt
POST /download-package
```

## Agent Builder

```http
GET  /api/templates
POST /api/generate
POST /api/generate_qa
POST /api/generate_flow
POST /api/rewrite
POST /api/refine
```

## RAG

```http
POST /api/rag/index
POST /api/rag/query
POST /api/rag/benchmark
```

## Observability

```http
GET  /api/logs
POST /api/log
```

## Voice

```http
POST /api/tts
```

These routes and associated request models are implemented in `main.py`.

---

# Getting Started

## 1. Clone the Repository

```bash
git clone https://github.com/prathyush1019/webcrawling-to-question-check-auditor.git
cd webcrawling-to-question-check-auditor
```

## 2. Create a Virtual Environment

```bash
python -m venv .venv
```

### Windows

```bash
.venv\Scripts\activate
```

### macOS / Linux

```bash
source .venv/bin/activate
```

## 3. Install Dependencies

```bash
pip install -r requirements.txt
```

## 4. Install Playwright Chromium

```bash
playwright install chromium
```

## 5. Configure Environment Variables

Create a `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key

AZURE_SPEECH_KEY=your_azure_speech_key
AZURE_SPEECH_REGION=your_azure_region

AZURE_VOICE_NAME=en-US-AvaNeural
```

The Gemini client uses `GEMINI_API_KEY`, while Azure Speech requires the Azure speech key and region.

## 6. Start the Application

```bash
uvicorn main:app --reload
```

Open:

```text
http://127.0.0.1:8000
```

---

# Typical Workflow

## Website → Agent

```text
1. Enter website URL
       |
       v
2. Crawl website
       |
       v
3. Clean and normalize HTML
       |
       v
4. Generate Knowledge Base
       |
       v
5. Audit KB quality
       |
       v
6. Reconstruct if quality is insufficient
       |
       v
7. Generate agent instructions
       |
       v
8. Generate conversational flow
       |
       v
9. Generate synthetic Q&A tests
       |
       v
10. Index KB into RAG
       |
       v
11. Run agent tests
       |
       v
12. Evaluate answers
       |
       v
13. Inspect failures
       |
       v
14. Refine instructions
       |
       v
15. Re-test
```

This makes NanoCrawler an **AI agent development and evaluation pipeline**, rather than a conventional web scraper.

---

# Design Decisions

## Browser-Based Crawling

Playwright is used because many modern websites rely on client-side JavaScript and dynamic rendering.

## Semantic Preprocessing

Web content is cleaned before LLM processing to reduce navigation and UI noise and focus downstream processing on relevant information.

## Separate Generation and Auditing

Generation and evaluation are deliberately separated so generated artifacts can be checked before being passed into subsequent stages.

## Persistent RAG State

Chunks and embeddings are persisted to `rag_index.json`, allowing the RAG index to be reused.

## Explicit Diagnostics

Latency, evaluation results and failure information are recorded instead of treating model output as an opaque result.

## Failure-Driven Refinement

Evaluation failures are transformed into structured feedback for instruction refinement, creating a feedback loop between testing and prompt engineering.

---

# Engineering Characteristics

NanoCrawler spans multiple layers of an AI system:

```text
Web Automation
      +
Data Extraction
      +
Data Cleaning
      +
LLM Orchestration
      +
Knowledge Engineering
      +
Prompt Engineering
      +
Agent Configuration
      +
RAG
      +
Evaluation
      +
Iterative Refinement
      +
Observability
      +
Voice Interface
```

The backend uses asynchronous execution, crawler workers communicate through an `asyncio.Queue`, FastAPI provides the service layer, and the frontend communicates with the backend using asynchronous JavaScript requests.

---

# Current Limitations

NanoCrawler intentionally keeps several components lightweight.

## RAG Storage

The current vector store is an in-process NumPy implementation persisted to JSON rather than a dedicated vector database.

## Retrieval

The current retrieval mechanism uses top-k cosine similarity and does not implement metadata filtering or a dedicated second-stage reranker.

## Evaluation

Answer scoring relies on an LLM-based evaluator, so evaluation should be treated as model-based judgment rather than absolute ground truth.

## Crawling Compliance Behavior

The system performs a `robots.txt` check, but the current implementation continues in certain cases where the check fails or returns an unexpected result. Production deployments may require stricter policy enforcement.

## Persistence

The current RAG index uses JSON persistence, which is suitable for a lightweight implementation but is not intended to serve as a distributed production vector store.

---

# Why This Project Exists

Building an AI agent is not simply a matter of selecting an LLM and writing a system prompt.

A useful agent-development workflow also requires:

```text
Reliable Data
     |
     v
Structured Knowledge
     |
     v
Agent Instructions
     |
     v
Evaluation
     |
     v
Failure Detection
     |
     v
Refinement
     |
     v
Re-evaluation
```

NanoCrawler is built around this idea:

> **Treat agent configuration as an engineering pipeline with observable intermediate artifacts rather than as a single prompt-generation step.**

---

# Author

**Prathyush P**

AI Engineer

GitHub: https://github.com/prathyush1019

LinkedIn: https://www.linkedin.com/in/prathyush-p-1b13a223a/

---
