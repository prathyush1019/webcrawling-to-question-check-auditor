document.addEventListener('DOMContentLoaded', () => {

    // ── Page switching ────────────────────────────────────────────────────────
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => tab.addEventListener('click', () => {
        navTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-' + tab.dataset.page).classList.add('active');
    }));

    function switchPage(name) {
        navTabs.forEach(t => t.classList.toggle('active', t.dataset.page === name));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById('page-' + name).classList.add('active');
    }

    // ── Crawler refs ──────────────────────────────────────────────────────────
    const urlInput          = document.getElementById('urlInput');
    const limitInput        = document.getElementById('limitInput');
    const concurrencyInput  = document.getElementById('concurrencyInput');
    const subdomainToggle   = document.getElementById('subdomainToggle');
    const crawlBtn          = document.getElementById('crawlBtn');
    const loader            = document.getElementById('loader');
    const liveConsole       = document.getElementById('liveConsole');
    const consoleFeed       = document.getElementById('consoleFeed');
    const resultsSection    = document.getElementById('resultsSection');
    const rootUrlDisplay    = document.getElementById('rootUrlDisplay');
    const totalPages        = document.getElementById('totalPages');
    const pagesGrid         = document.getElementById('pagesGrid');
    const downloadJsonBtn   = document.getElementById('downloadJsonBtn');
    const kbSection         = document.getElementById('kbSection');
    const bizModel          = document.getElementById('bizModel');
    const viewPromptBtn     = document.getElementById('viewPromptBtn');
    const addInstructionsBtn= document.getElementById('addInstructionsBtn');
    const kbBtn             = document.getElementById('kbBtn');
    const kbLoader          = document.getElementById('kbLoader');
    const extraBadge        = document.getElementById('extraInstructionsBadge');
    const clearExtraBtn     = document.getElementById('clearExtraBtn');
    const kbOutputSection   = document.getElementById('kbOutputSection');
    const kbContent         = document.getElementById('kbContent');
    const kbModelBadge      = document.getElementById('kbModelBadge');
    const downloadKbBtn     = document.getElementById('downloadKbBtn');
    const sendToAgentBtn    = document.getElementById('sendToAgentBtn');
    const modeBtns          = document.querySelectorAll('.mode-btn');

    // View Prompt modal
    const viewPromptModal   = document.getElementById('viewPromptModal');
    const promptEditorArea  = document.getElementById('promptEditorArea');
    const viewPromptLabel   = document.getElementById('viewPromptLabel');
    const savePromptBtn     = document.getElementById('savePromptBtn');
    const promptSaveStatus  = document.getElementById('promptSaveStatus');
    const closeViewPrompt   = document.getElementById('closeViewPromptModal');

    // Add Instructions modal
    const addInstructionsModal  = document.getElementById('addInstructionsModal');
    const extraInstructionsArea = document.getElementById('extraInstructionsArea');
    const applyInstructionsBtn  = document.getElementById('applyInstructionsBtn');
    const instructionsStatus    = document.getElementById('instructionsStatus');
    const closeAddInstructions  = document.getElementById('closeAddInstructionsModal');

    // Eval overlay
    const evalOverlay   = document.getElementById('evalOverlay');
    const evalLoading   = document.getElementById('evalLoading');
    const evalResult    = document.getElementById('evalResult');
    const evalCircle    = document.getElementById('evalCircleFill');
    const evalScoreText = document.getElementById('evalScoreText');
    const evalReasoning = document.getElementById('evalReasoning');
    const evalReconBadge= document.getElementById('evalReconBadge');
    const evalSending   = document.getElementById('evalSending');

    // Agent Builder refs
    const agentKbInput          = document.getElementById('agentKbInput');
    const companyName           = document.getElementById('companyName');
    const agentName             = document.getElementById('agentName');
    const instructionTemplateText= document.getElementById('instructionTemplateText');
    const extraInstructions     = document.getElementById('extraInstructions');
    const generateBtn           = document.getElementById('generateBtn');
    const generateBtnText       = document.getElementById('generateBtnText');
    const generateLoader        = document.getElementById('generateLoader');
    const agentOutput           = document.getElementById('agentOutput');
    const auditorScore          = document.getElementById('auditorScore');
    const auditorReasoning      = document.getElementById('auditorReasoning');
    const refinedStatus         = document.getElementById('refinedStatus');
    const finalInstructions     = document.getElementById('finalInstructions');
    const downloadInstructionBtn= document.getElementById('downloadInstructionBtn');
    const generateQaBtn         = document.getElementById('generateQaBtn');
    const qaLoader              = document.getElementById('qaLoader');
    const qaOutput              = document.getElementById('qaOutput');
    const downloadQaBtn         = document.getElementById('downloadQaBtn');
    const kbSourceBanner        = document.getElementById('kbSourceBanner');
    const kbSourceText          = document.getElementById('kbSourceText');
    const kbScorePill           = document.getElementById('kbScorePill');
    const industryTabs          = document.querySelectorAll('#industryTabs .mode-btn');
    const directionTabs         = document.querySelectorAll('#directionTabs .mode-btn');

    const generateFlowBtn       = document.getElementById('generateFlowBtn');
    const flowSection           = document.getElementById('flowSection');
    const flowTreeContent       = document.getElementById('flowTreeContent');
    const mermaidContainer      = document.getElementById('mermaidContainer');
    const flowLoader            = document.getElementById('flowLoader');
    const generateFlowText      = document.getElementById('generateFlowText');
    const downloadFlowBtn       = document.getElementById('downloadFlowBtn');

    let currentMode      = 'deep';
    let lastCrawlData    = null;
    let lastKBData       = null;
    let promptsCache     = {};
    let extraInstr       = '';
    let instructionTemplates = {};
    let activeType       = 'Sales';
    let activeDir        = 'Inbound';
    let currentFlowTree  = null;
    let socket           = null;

    // ── Mode buttons ──────────────────────────────────────────────────────────
    modeBtns.forEach(btn => btn.addEventListener('click', () => {
        modeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
    }));

    // ── WebSocket ─────────────────────────────────────────────────────────────
    function initWebSocket() {
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        socket = new WebSocket(`${protocol}//${location.host}/ws`);
        socket.onmessage = e => logToConsole(e.data);
        socket.onclose   = () => setTimeout(initWebSocket, 2000);
    }
    initWebSocket();

    function logToConsole(msg) {
        const line = document.createElement('div');
        line.className = 'console-line';
        line.innerHTML = `<span class="console-msg">${msg}</span>`;
        consoleFeed.appendChild(line);
        consoleFeed.scrollTop = consoleFeed.scrollHeight;
    }

    // ── Load prompts ──────────────────────────────────────────────────────────
    async function loadPrompts() {
        try {
            promptsCache = await (await fetch('/prompts')).json();
            buildBizSelect();
        } catch(e) { console.error(e); }
    }

    function buildBizSelect() {
        const prev = bizModel.value;
        bizModel.innerHTML = '';
        Object.keys(promptsCache).forEach(k => {
            const o = document.createElement('option');
            o.value = k; o.textContent = humanLabel(k);
            bizModel.appendChild(o);
        });
        if (prev && promptsCache[prev]) bizModel.value = prev;
    }

    // ── Load agent templates ──────────────────────────────────────────────────
    async function loadTemplates() {
        try {
            instructionTemplates = await (await fetch('/api/templates')).json();
            updateAgentTemplate();
        } catch(e) { console.error(e); }
    }

    function updateAgentTemplate() {
        const cat = instructionTemplates[activeType];
        if (!cat) return;
        instructionTemplateText.value = (typeof cat === 'object' ? cat[activeDir] : cat) || '';
    }

    loadPrompts();
    loadTemplates();

    // ── Industry / Direction tabs ─────────────────────────────────────────────
    industryTabs.forEach(btn => btn.addEventListener('click', () => {
        industryTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeType = btn.dataset.type;
        updateAgentTemplate();
    }));
    // Set Sales active by default
    const salesBtn = document.querySelector('#industryTabs .mode-btn[data-type="Sales"]');
    if (salesBtn) salesBtn.classList.add('active');

    directionTabs.forEach(btn => btn.addEventListener('click', () => {
        directionTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeDir = btn.dataset.dir;
        updateAgentTemplate();
    }));

    const humanLabel = k => ({
        B2B:'B2B – Enterprise', B2C:'B2C – Consumer', C2B:'C2B – Contributor',
        SALES_LEAD:'Sales Lead', ENQUIRY:'Enquiry & FAQ'
    }[k] || k.replace(/_/g,' '));

    // ── CRAWL ─────────────────────────────────────────────────────────────────
    crawlBtn.addEventListener('click', async () => {
        let url = urlInput.value.trim();
        if (!url) return alert('Please enter a URL');
        if (!url.startsWith('http')) url = 'https://' + url;

        setCrawlLoading(true);
        resultsSection.classList.add('hidden');
        kbSection.classList.add('hidden');
        kbOutputSection.classList.add('hidden');
        liveConsole.classList.remove('hidden');
        consoleFeed.innerHTML = '';

        try {
            const res  = await fetch('/crawl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, max_pages: +limitInput.value||30, mode: currentMode,
                    include_subdomains: subdomainToggle.checked, concurrency: +concurrencyInput.value||2 })
            });
            const data = await res.json();
            if (res.ok) { lastCrawlData = data; showResults(data); kbSection.classList.remove('hidden'); }
            else alert('Crawl error: ' + (data.detail || JSON.stringify(data)));
        } catch(e) { alert('Crawl failed: ' + e.message); }
        finally { setCrawlLoading(false); }
    });

    function setCrawlLoading(on) {
        crawlBtn.disabled = on;
        loader.style.display = on ? 'block' : 'none';
        crawlBtn.querySelector('span').style.display = on ? 'none' : 'block';
    }

    function showResults(data) {
        resultsSection.classList.remove('hidden');
        rootUrlDisplay.textContent = new URL(data.root_url).hostname;
        totalPages.textContent = data.total_pages;
        pagesGrid.innerHTML = '';
        data.pages.forEach(p => {
            const card = document.createElement('div');
            card.className = 'page-card glass';
            card.innerHTML = `<h4>${p.title}</h4><p>${p.url}</p>`;
            pagesGrid.appendChild(card);
        });
    }

    downloadJsonBtn.addEventListener('click', () => {
        if (!lastCrawlData) return;
        triggerDownload(new Blob([JSON.stringify(lastCrawlData, null, 2)], {type:'application/json'}), 'crawl_data.json');
    });

    // ── View Prompt modal ─────────────────────────────────────────────────────
    viewPromptBtn.addEventListener('click', () => {
        const k = bizModel.value;
        if (!promptsCache[k]) return;
        viewPromptLabel.textContent = humanLabel(k);
        promptEditorArea.value = promptsCache[k];
        promptSaveStatus.textContent = '';
        viewPromptModal.classList.remove('hidden');
    });
    closeViewPrompt.addEventListener('click', () => viewPromptModal.classList.add('hidden'));
    viewPromptModal.addEventListener('click', e => { if(e.target===viewPromptModal) viewPromptModal.classList.add('hidden'); });

    savePromptBtn.addEventListener('click', async () => {
        const k = bizModel.value, text = promptEditorArea.value.trim();
        if (!text) return;
        const res = await fetch(`/prompts/${k}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text}) });
        if (res.ok) { promptsCache[k]=text; showStatus(promptSaveStatus,'✓ Saved','ok'); }
        else showStatus(promptSaveStatus,'Error','err');
    });

    // ── Add Instructions modal ────────────────────────────────────────────────
    addInstructionsBtn.addEventListener('click', () => { instructionsStatus.textContent=''; addInstructionsModal.classList.remove('hidden'); });
    closeAddInstructions.addEventListener('click', () => addInstructionsModal.classList.add('hidden'));
    addInstructionsModal.addEventListener('click', e => { if(e.target===addInstructionsModal) addInstructionsModal.classList.add('hidden'); });

    applyInstructionsBtn.addEventListener('click', () => {
        extraInstr = extraInstructionsArea.value.trim();
        if (!extraInstr) return showStatus(instructionsStatus,'Enter instructions','err');
        extraBadge.classList.remove('hidden');
        showStatus(instructionsStatus,'✓ Applied','ok');
        setTimeout(() => addInstructionsModal.classList.add('hidden'), 700);
    });
    clearExtraBtn.addEventListener('click', () => { extraInstr=''; extraInstructionsArea.value=''; extraBadge.classList.add('hidden'); });

    // ── Generate KB ───────────────────────────────────────────────────────────
    kbBtn.addEventListener('click', async () => {
        if (!lastCrawlData?.pages?.length) return alert('Run a crawl first.');
        kbOutputSection.classList.add('hidden');
        kbLoader.classList.remove('hidden');
        kbBtn.disabled = true;
        try {
            const res  = await fetch('/generate-kb', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ pages: lastCrawlData.pages, model_type: bizModel.value, extra_instructions: extraInstr })
            });
            const data = await res.json();
            if (res.ok) {
                lastKBData = data.kb;
                kbContent.innerHTML = formatMarkdown(data.kb);
                kbModelBadge.textContent = humanLabel(bizModel.value);
                kbOutputSection.classList.remove('hidden');
                kbOutputSection.scrollIntoView({ behavior:'smooth', block:'start' });
            } else alert('KB error: ' + (data.detail||JSON.stringify(data)));
        } catch(e) { alert('KB failed: '+e.message); }
        finally { kbLoader.classList.add('hidden'); kbBtn.disabled=false; }
    });

    // ── Download KB ───────────────────────────────────────────────────────────
    downloadKbBtn.addEventListener('click', async () => {
        if (!lastKBData) return;
        const res = await fetch('/download-kb-txt', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({kb:lastKBData}) });
        if (res.ok) triggerDownload(await res.blob(), 'knowledge_base.txt');
    });

    // ── Evaluate & Send to Agent Builder ─────────────────────────────────────
    sendToAgentBtn.addEventListener('click', async () => {
        if (!lastKBData) return;

        // Show overlay - loading phase
        evalOverlay.classList.remove('hidden');
        evalLoading.classList.remove('hidden');
        evalResult.classList.add('hidden');
        evalReconBadge.classList.add('hidden');

        try {
            const res  = await fetch('/api/evaluate', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ input_kb: lastKBData })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Evaluation failed');

            const score = data.score;
            const finalKB = data.improved_kb || lastKBData;

            // Switch overlay to result phase
            evalLoading.classList.add('hidden');
            evalResult.classList.remove('hidden');
            evalReasoning.textContent = data.reasoning;
            if (data.improved_kb) evalReconBadge.classList.remove('hidden');

            // Animate score circle
            const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
            evalCircle.style.stroke = color;
            let current = 0;
            const target = score;
            const step = () => {
                current = Math.min(current + 2, target);
                evalCircle.setAttribute('stroke-dasharray', `${current},100`);
                evalScoreText.textContent = current + '%';
                if (current < target) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);

            // After 2s, close and switch tab
            await new Promise(r => setTimeout(r, 2200));
            evalSending.style.opacity = '1';
            await new Promise(r => setTimeout(r, 800));

            evalOverlay.classList.add('hidden');

            // Pre-fill agent builder
            agentKbInput.value = finalKB;
            agentKbInput.style.borderColor = '#6366f1';
            kbSourceBanner.classList.remove('hidden');
            kbSourceText.textContent = data.improved_kb
                ? 'KB evaluated, reconstructed by AI, and pre-filled'
                : 'KB evaluated and pre-filled from Crawler';
            kbScorePill.textContent = `Score: ${score}/100`;
            kbScorePill.style.background = color;

            switchPage('agent');
            setTimeout(() => agentKbInput.scrollIntoView({ behavior:'smooth', block:'center' }), 300);

        } catch(e) {
            evalOverlay.classList.add('hidden');
            alert('Evaluation error: ' + e.message);
        }
    });

    // ── Generate Agent Instructions ───────────────────────────────────────────
    generateBtn.addEventListener('click', async () => {
        if (!agentKbInput.value.trim()) return alert('Knowledge Base is empty.');
        if (!companyName.value.trim()) return alert('Enter a company name.');

        generateBtnText.classList.add('hidden');
        generateLoader.classList.remove('hidden');
        generateBtn.disabled = true;
        agentOutput.classList.add('hidden');

        try {
            const res  = await fetch('/api/generate', {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({
                    input_kb: agentKbInput.value,
                    company_name: companyName.value,
                    agent_name: agentName.value || 'Aaliyah',
                    instruction_type: activeType,
                    call_direction: activeDir,
                    instruction_template: instructionTemplateText.value,
                    extra_instructions: extraInstructions.value,
                    flow_tree: currentFlowTree
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Generation failed');

            const auditorBadge = document.getElementById('auditorBadge');
            auditorScore.textContent   = data.auditor_score;
            auditorReasoning.textContent = data.auditor_reasoning;
            if (data.was_refined) {
                refinedStatus.textContent = '⚠️ Auto-corrected to meet standards.';
                refinedStatus.style.color = '#f59e0b';
                if (auditorBadge) { auditorBadge.textContent = '⚠️ REFINED'; auditorBadge.style.background = 'rgba(245,158,11,0.15)'; auditorBadge.style.borderColor = 'rgba(245,158,11,0.4)'; auditorBadge.style.color = '#fbbf24'; }
            } else {
                refinedStatus.textContent = '✅ Passed initial criteria.';
                refinedStatus.style.color = '#10b981';
                if (auditorBadge) { auditorBadge.textContent = '✅ VERIFIED'; auditorBadge.style.background = 'rgba(16,185,129,0.15)'; auditorBadge.style.borderColor = 'rgba(16,185,129,0.4)'; auditorBadge.style.color = '#4ade80'; }
            }
            finalInstructions.textContent = data.final_instructions;
            agentOutput.classList.remove('hidden');
            agentOutput.scrollIntoView({ behavior:'smooth', block:'start' });
        } catch(e) { alert('Error: ' + e.message); }
        finally {
            generateBtnText.classList.remove('hidden');
            generateLoader.classList.add('hidden');
            generateBtn.disabled = false;
        }
    });

    downloadInstructionBtn.addEventListener('click', () => {
        triggerDownload(new Blob([finalInstructions.textContent], {type:'text/plain'}), 'agent_instructions.txt');
    });

    // ── Generate Flow Tree ───────────────────────────────────────────────────
    if (generateFlowBtn) {
        generateFlowBtn.addEventListener('click', async () => {
            if (!agentKbInput.value.trim()) return alert('KB is empty.');
            
            flowSection.classList.remove('hidden');
            flowLoader.classList.remove('hidden');
            generateFlowText.classList.add('hidden');
            generateFlowBtn.disabled = true;
            flowTreeContent.textContent = '';

            try {
                const res = await fetch('/api/generate_flow', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ input_kb: agentKbInput.value })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Flow generation failed');
                
                currentFlowTree = data.flow_tree;
                
                // Render Mermaid
                mermaidContainer.innerHTML = `<pre class="mermaid">${currentFlowTree}</pre>`;
                await mermaid.run({ nodes: [mermaidContainer] });
                
                flowTreeContent.textContent = currentFlowTree; // Keep hidden for download
                flowSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (e) {
                alert('Flow Error: ' + e.message);
                flowSection.classList.add('hidden');
            } finally {
                flowLoader.classList.add('hidden');
                generateFlowText.classList.remove('hidden');
                generateFlowBtn.disabled = false;
            }
        });
    }

    if (downloadFlowBtn) {
        downloadFlowBtn.addEventListener('click', () => {
            if (!currentFlowTree) return;
            triggerDownload(new Blob([currentFlowTree], {type:'text/markdown'}), 'conversation_flow.md');
        });
    }

    // ── Generate Q&A ──────────────────────────────────────────────────────────
    if (generateQaBtn) {
        generateQaBtn.addEventListener('click', async () => {
            console.log("[QA Agent] Clicked");
            const kbText = agentKbInput.value.trim();
            if (!kbText) return alert('Knowledge Base is empty. Please generate or paste a KB first.');

            const qaSection = document.getElementById('qaSection');
            if (!qaSection) return console.error("qaSection not found");

            // Show section and loader immediately
            qaSection.classList.remove('hidden');
            if (qaLoader) qaLoader.style.display = 'flex';
            if (qaOutput) qaOutput.classList.add('hidden');
            if (downloadQaBtn) downloadQaBtn.classList.add('hidden');
            
            generateQaBtn.disabled = true;
            const originalText = generateQaBtn.innerText;
            generateQaBtn.innerText = '⌛ Generating Q&A...';

            console.log("[QA Agent] Sending request...");
            try {
                const res = await fetch('/api/generate_qa', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ input_kb: kbText })
                });
                
                const data = await res.json();
                console.log("[QA Agent] Response received", data);

                if (!res.ok) throw new Error(data.detail || 'Q&A Generation failed');
                
                if (qaOutput) {
                    qaOutput.textContent = JSON.stringify(data.qa_list, null, 2);
                    qaOutput.classList.remove('hidden');
                }
                if (downloadQaBtn) downloadQaBtn.classList.remove('hidden');
                
                console.log("[QA Agent] Done");
            } catch (e) {
                console.error("[QA Agent] Error:", e);
                alert('Q&A Error: ' + e.message);
                qaSection.classList.add('hidden');
            } finally {
                if (qaLoader) qaLoader.style.display = 'none';
                generateQaBtn.disabled = false;
                generateQaBtn.innerText = originalText;
            }
        });
    } else {
        console.error("generateQaBtn not found in DOM");
    }

    downloadQaBtn.addEventListener('click', () => {
        triggerDownload(new Blob([qaOutput.textContent], {type:'text/plain'}), 'sample_qa.txt');
    });

    // ── Helpers ───────────────────────────────────────────────────────────────
    function triggerDownload(blob, filename) {
        const url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
    }

    function showStatus(el, msg, type) {
        el.textContent = msg;
        el.className = 'status-text ' + (type==='ok' ? 'status-ok' : 'status-err');
        setTimeout(() => { el.textContent=''; el.className='status-text'; }, 3000);
    }

    function formatMarkdown(text) {
        return text
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim,  '<h2>$1</h2>')
            .replace(/^# (.*$)/gim,   '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g,       '<code>$1</code>')
            .replace(/^\* (.*$)/gim,   '<li>$1</li>')
            .replace(/^\- (.*$)/gim,   '<li>$1</li>')
            .replace(/\n/g, '<br>');
    }
});
