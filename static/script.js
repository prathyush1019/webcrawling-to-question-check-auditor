// ── Utility: Global Functions ──────────────────────────────────────────────
function switchPage(name) {
    if (!name) return;
    const navTabs = document.querySelectorAll('.nav-tab');
    const targetPage = document.getElementById('page-' + name);

    if (targetPage) {
        navTabs.forEach(t => t.classList.toggle('active', t.dataset.page === name));
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        targetPage.classList.add('active');
    }

    // Hide overlay if it exists
    const overlay = document.getElementById('ragAuditOverlay');
    if (overlay) overlay.classList.add('hidden');
}

function markdownToHtml(text) {
    if (!text) return "";
    return text
        .replace(/### (.*$)/gim, '<h3>$1</h3>')
        .replace(/## (.*$)/gim, '<h2>$1</h2>')
        .replace(/# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
        .replace(/\*(.*)\*/gim, '<i>$1</i>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/^\- (.*$)/gim, '<li>$1</li>')
        .replace(/\n/g, '<br>');
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function showStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'status-text ' + (type === 'ok' ? 'status-ok' : 'status-err');
    setTimeout(() => { el.textContent = ''; el.className = 'status-text'; }, 3000);
}

function formatMarkdown(text) {
    if (!text) return "";
    return text
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/^\- (.*$)/gim, '<li>$1</li>')
        .replace(/\n/g, '<br>');
}

document.addEventListener('DOMContentLoaded', () => {

    // ── Safe Page Switching ──────────────────────────────────────────────────
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.dataset.page) {
                switchPage(tab.dataset.page);
            }
        });
    });


    // ── Crawler refs ──────────────────────────────────────────────────────────
    const urlInput = document.getElementById('urlInput');
    const limitInput = document.getElementById('limitInput');
    const concurrencyInput = document.getElementById('concurrencyInput');
    const subdomainToggle = document.getElementById('subdomainToggle');
    const crawlBtn = document.getElementById('crawlBtn');
    const loader = document.getElementById('loader');
    const liveConsole = document.getElementById('liveConsole');
    const consoleFeed = document.getElementById('consoleFeed');
    const resultsSection = document.getElementById('resultsSection');
    const rootUrlDisplay = document.getElementById('rootUrlDisplay');
    const totalPages = document.getElementById('totalPages');
    const pagesGrid = document.getElementById('pagesGrid');
    const downloadJsonBtn = document.getElementById('downloadJsonBtn');
    const kbSection = document.getElementById('kbSection');
    const bizModel = document.getElementById('bizModel');
    const viewPromptBtn = document.getElementById('viewPromptBtn');
    const addInstructionsBtn = document.getElementById('addInstructionsBtn');
    const kbBtn = document.getElementById('kbBtn');
    const kbLoader = document.getElementById('kbLoader');
    const extraBadge = document.getElementById('extraInstructionsBadge');
    const clearExtraBtn = document.getElementById('clearExtraBtn');
    const kbOutputSection = document.getElementById('kbOutputSection');
    const kbContent = document.getElementById('kbContent');
    const kbModelBadge = document.getElementById('kbModelBadge');
    const downloadKbBtn = document.getElementById('downloadKbBtn');
    const sendToAgentBtn = document.getElementById('sendToAgentBtn');
    const crawlerModeBtns = document.querySelectorAll('#page-crawler .mode-selector .mode-btn');

    // View Prompt modal
    const viewPromptModal = document.getElementById('viewPromptModal');
    const promptEditorArea = document.getElementById('promptEditorArea');
    const viewPromptLabel = document.getElementById('viewPromptLabel');
    const savePromptBtn = document.getElementById('savePromptBtn');
    const promptSaveStatus = document.getElementById('promptSaveStatus');
    const closeViewPrompt = document.getElementById('closeViewPromptModal');

    // Add Instructions modal
    const addInstructionsModal = document.getElementById('addInstructionsModal');
    const extraInstructionsArea = document.getElementById('extraInstructionsArea');
    const applyInstructionsBtn = document.getElementById('applyInstructionsBtn');
    const instructionsStatus = document.getElementById('instructionsStatus');
    const closeAddInstructions = document.getElementById('closeAddInstructionsModal');

    // Eval overlay
    const evalOverlay = document.getElementById('evalOverlay');
    const evalLoading = document.getElementById('evalLoading');
    const evalResult = document.getElementById('evalResult');
    const evalCircle = document.getElementById('evalCircleFill');
    const evalScoreText = document.getElementById('evalScoreText');
    const evalReasoning = document.getElementById('evalReasoning');
    const evalReconBadge = document.getElementById('evalReconBadge');
    const evalSending = document.getElementById('evalSending');

    // Agent Builder refs
    const agentKbInput = document.getElementById('agentKbInput');
    const companyName = document.getElementById('companyName');
    const agentName = document.getElementById('agentName');
    const instructionTemplateText = document.getElementById('instructionTemplateText');
    const extraInstructions = document.getElementById('extraInstructions');
    const generateBtn = document.getElementById('generateBtn');
    const generateBtnText = document.getElementById('generateBtnText');
    const generateLoader = document.getElementById('generateLoader');
    const agentOutput = document.getElementById('agentOutput');
    const auditorScore = document.getElementById('auditorScore');
    const auditorReasoning = document.getElementById('auditorReasoning');
    const refinedStatus = document.getElementById('refinedStatus');
    const finalInstructions = document.getElementById('finalInstructions');
    const downloadInstructionBtn = document.getElementById('downloadInstructionBtn');
    const generateQaBtn = document.getElementById('generateQaBtn');
    const qaLoader = document.getElementById('qaLoader');
    const qaOutput = document.getElementById('qaOutput');
    const qaPlainText = document.getElementById('qaPlainText');
    const downloadQaBtn = document.getElementById('downloadQaBtn');
    const copyQuestionsBtn = document.getElementById('copyQuestionsBtn');
    const kbSourceBanner = document.getElementById('kbSourceBanner');
    const kbSourceText = document.getElementById('kbSourceText');
    const kbScorePill = document.getElementById('kbScorePill');
    const industryTabs = document.querySelectorAll('#industryTabs .mode-btn');
    const directionTabs = document.querySelectorAll('#directionTabs .mode-btn');

    const generateFlowText = document.getElementById('generateFlowText');
    const downloadFlowBtn = document.getElementById('downloadFlowBtn');
    const latencyTabs = document.querySelectorAll('#latencyTabs .mode-btn');

    // ── RAG Lab refs ──────────────────────────────────────────────────────────
    const ragIndexBtn = document.getElementById('ragIndexBtn');
    const ragIndexLoader = document.getElementById('ragIndexLoader');
    const ragIndexStatus = document.getElementById('ragIndexStatus');
    const ragChunkSize = document.getElementById('ragChunkSize');
    const ragOverlap = document.getElementById('ragOverlap');
    const ragQueryResults = document.getElementById('ragQueryResults');
    const ragTopK = document.getElementById('ragTopK');
    const ragTopKVal = document.getElementById('ragTopKVal');
    const ragQueryBtn = document.getElementById('ragQueryBtn');
    const ragQueryLoader = document.getElementById('ragQueryLoader');
    const ragOutput = document.getElementById('ragOutput');
    const ragAnswer = document.getElementById('ragAnswer');
    const ragLatency = document.getElementById('ragLatency');
    const ragModel = document.getElementById('ragModel');
    const ragMeta = document.getElementById('ragMeta');
    const ragKbInput = document.getElementById('ragKbInput');
    const ragAgentInstructions = document.getElementById('ragAgentInstructions');
    const sendToRagBtn = document.getElementById('sendToRagBtn');
    const sendAgentToRagBtn = document.getElementById('sendAgentToRagBtn');
    const agentGuidedQueryInput = document.getElementById('agentGuidedQueryInput');
    const agentGuidedQueryBtn = document.getElementById('agentGuidedQueryBtn');
    const agentGuidedQueryLoader = document.getElementById('agentGuidedQueryLoader');
    const clearRagChatBtn = document.getElementById('clearRagChatBtn');

    let currentMode = 'deep';
    let lastCrawlData = null;
    let lastKBData = null;
    let promptsCache = {};
    let extraInstr = '';
    let instructionTemplates = {};
    let activeType = 'Sales';
    let activeDir = 'Inbound';
    let activeLatency = 'standard';
    let currentFlowTree = null;
    let ragChatHistory = [];
    let audioQueue = [];
    let isPlayingAudio = false;
    const autoChatOverlay = document.getElementById('autoChatOverlay');
    const autoChatLog = document.getElementById('autoChatLog');
    const autoChatProgressBar = document.getElementById('autoChatProgressBar');
    const autoChatStatus = document.getElementById('autoChatStatus');
    const startAutoChatBtn = document.getElementById('startAutoChatBtn');
    const openAutoChatBtn = document.getElementById('openAutoChatBtn');
    const closeAutoChat = document.getElementById('closeAutoChat');

    // Auditor refs
    const ragAuditOverlay = document.getElementById('ragAuditOverlay');
    const openAuditorBtn = document.getElementById('openAuditorBtn');
    const closeRagAudit = document.getElementById('closeRagAudit');
    const closeRagAuditBtn = document.getElementById('closeRagAuditBtn');
    const sendToLabBtn = document.getElementById('sendToLabBtn');


    let lastQaData = null; // Ensure this is accessible
    const runAuditBtn = document.getElementById('runAuditBtn');
    const auditQuestionsInput = document.getElementById('auditQuestionsInput');
    const auditResultsList = document.getElementById('auditResultsList');
    const auditProgress = document.getElementById('auditProgress');
    const auditProgressBar = document.getElementById('auditProgressBar');
    const auditStatusText = document.getElementById('auditStatusText');
    const auditSummary = document.getElementById('auditSummary');
    const avgAuditScore = document.getElementById('avgAuditScore');
    const avgAuditScoreFooter = document.getElementById('avgAuditScoreFooter');
    const downloadAuditReport = document.getElementById('downloadAuditReport');
    const downloadViolationReport = document.getElementById('downloadViolationReport');

    const refineHint = document.getElementById('refineHint');
    const viewRefineStrategyBtn = document.getElementById('viewRefineStrategyBtn');
    const refineStrategyOverlay = document.getElementById('refineStrategyOverlay');
    const refineStrategyContent = document.getElementById('refineStrategyContent');
    const closeRefineStrategy = document.getElementById('closeRefineStrategy');
    const closeRefineStrategyBtn = document.getElementById('closeRefineStrategyBtn');
    const applyStrategyToLabBtn = document.getElementById('applyStrategyToLabBtn');
    const ragPerformanceBar = document.getElementById('ragPerformanceBar');
    const avgAuditScoreMain = document.getElementById('avgAuditScoreMain');
    const viewRefineStrategyMainBtn = document.getElementById('viewRefineStrategyMainBtn');
    const sendToLabMainBtn = document.getElementById('sendToLabMainBtn');

    // Rewriter refs
    const rewriterInput = document.getElementById('rewriterInput');
    const rewritingGoal = document.getElementById('rewritingGoal');
    const runRewriterBtn = document.getElementById('runRewriterBtn');
    const rewriterOutput = document.getElementById('rewriterOutput');
    const copyRewriterBtn = document.getElementById('copyRewriterBtn');
    const applyRewriterToBuilderBtn = document.getElementById('applyRewriterToBuilderBtn');

    // Instruction Lab refs
    const labInstructionsInput = document.getElementById('labInstructionsInput');
    const labAuditInput = document.getElementById('labAuditInput');
    const runLabRefineBtn = document.getElementById('runLabRefineBtn');
    const labResultsSection = document.getElementById('labResultsSection');
    const labEmptyState = document.getElementById('labEmptyState');
    const labGapAnalysis = document.getElementById('labGapAnalysis');
    const labRefinedOutput = document.getElementById('labRefinedOutput');
    const copyLabOutputBtn = document.getElementById('copyLabOutputBtn');
    const sendLabToRewriterBtn = document.getElementById('sendLabToRewriterBtn');

    // Refine Diff refs
    const refineDiffOverlay = document.getElementById('refineDiffOverlay');
    const gapAnalysisContent = document.getElementById('gapAnalysisContent');
    const changesMadeContent = document.getElementById('changesMadeContent');
    const oldInstructionsView = document.getElementById('oldInstructionsView');
    const newInstructionsView = document.getElementById('newInstructionsView');
    const applyRefinedBtn = document.getElementById('applyRefinedBtn');
    const closeRefineDiff = document.getElementById('closeRefineDiff');
    const closeRefineDiffBtn = document.getElementById('closeRefineDiffBtn');

    // Flow refs
    const generateFlowBtn = document.getElementById('generateFlowBtn');
    const flowSection = document.getElementById('flowSection');
    const flowLoader = document.getElementById('flowLoader');
    const flowTreeEditor = document.getElementById('flowTreeEditor');
    const mermaidContainer = document.getElementById('mermaidContainer');
    const updateFlowDiagramBtn = document.getElementById('updateFlowDiagramBtn');
    const appendFlowToKbBtn = document.getElementById('appendFlowToKbBtn');

    // Logs refs
    const viewLogsBtn = document.getElementById('viewLogsBtn');
    const logsModal = document.getElementById('logsModal');
    const closeLogsModal = document.getElementById('closeLogsModal');
    const refreshLogsBtn = document.getElementById('refreshLogsBtn');
    const logsContent = document.getElementById('logsContent');
    const downloadFullLogBtn = document.getElementById('downloadFullLogBtn');

    // Voice refs
    const ttsToggle = document.getElementById('ttsToggle');
    const ragQueryMic = document.getElementById('ragQueryMic');
    const agentGuidedMic = document.getElementById('agentGuidedMic');
    let ttsActive = false;
    let audioContext = null;
    let currentAudio = null;

    // ── Crawler Mode buttons ──────────────────────────────────────────────────
    crawlerModeBtns.forEach(btn => btn.addEventListener('click', () => {
        crawlerModeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMode = btn.dataset.mode;
    }));


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
        } catch (e) { console.error(e); }
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
        } catch (e) { console.error(e); }
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

    latencyTabs.forEach(btn => btn.addEventListener('click', () => {
        latencyTabs.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeLatency = btn.dataset.latency;
    }));

    const humanLabel = k => ({
        B2B: 'B2B – Enterprise', B2C: 'B2C – Consumer',
        'Lead Generation': 'Lead Generation', Enquiry: 'Enquiry & FAQ'
    }[k] || k.replace(/_/g, ' '));

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
            const response = await fetch('/crawl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url,
                    max_pages: +limitInput.value || 100,
                    mode: currentMode,
                    include_subdomains: subdomainToggle.checked,
                    concurrency: +concurrencyInput.value || 5
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Connection failed');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line);
                        if (event.type === 'log') {
                            logToConsole(event.message);
                        } else if (event.type === 'error') {
                            alert('Crawl Error: ' + event.message);
                            logToConsole('❌ ' + event.message);
                        } else if (event.type === 'final') {
                            lastCrawlData = event;
                            showResults(event);
                            kbSection.classList.remove('hidden');
                            logToConsole('✅ Crawl Sequence Complete.');
                        }
                    } catch (e) {
                        console.error('Failed to parse event:', line, e);
                    }
                }
            }
        } catch (e) {
            alert('Crawl failed: ' + e.message);
            logToConsole('❌ CRITICAL ERROR: ' + e.message);
        } finally {
            setCrawlLoading(false);
        }
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
        triggerDownload(new Blob([JSON.stringify(lastCrawlData, null, 2)], { type: 'application/json' }), 'crawl_data.json');
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
    viewPromptModal.addEventListener('click', e => { if (e.target === viewPromptModal) viewPromptModal.classList.add('hidden'); });

    savePromptBtn.addEventListener('click', async () => {
        const k = bizModel.value, text = promptEditorArea.value.trim();
        if (!text) return;
        const res = await fetch(`/prompts/${k}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
        if (res.ok) { promptsCache[k] = text; showStatus(promptSaveStatus, '✓ Saved', 'ok'); }
        else showStatus(promptSaveStatus, 'Error', 'err');
    });

    // ── Add Instructions modal ────────────────────────────────────────────────
    addInstructionsBtn.addEventListener('click', () => { instructionsStatus.textContent = ''; addInstructionsModal.classList.remove('hidden'); });
    closeAddInstructions.addEventListener('click', () => addInstructionsModal.classList.add('hidden'));
    addInstructionsModal.addEventListener('click', e => { if (e.target === addInstructionsModal) addInstructionsModal.classList.add('hidden'); });

    applyInstructionsBtn.addEventListener('click', () => {
        extraInstr = extraInstructionsArea.value.trim();
        if (!extraInstr) return showStatus(instructionsStatus, 'Enter instructions', 'err');
        extraBadge.classList.remove('hidden');
        showStatus(instructionsStatus, '✓ Applied', 'ok');
        setTimeout(() => addInstructionsModal.classList.add('hidden'), 700);
    });
    clearExtraBtn.addEventListener('click', () => { extraInstr = ''; extraInstructionsArea.value = ''; extraBadge.classList.add('hidden'); });

    // ── Generate KB ───────────────────────────────────────────────────────────
    kbBtn.addEventListener('click', async () => {
        if (!lastCrawlData?.pages?.length) return alert('Run a crawl first.');
        kbOutputSection.classList.add('hidden');
        kbLoader.classList.remove('hidden');
        kbBtn.disabled = true;
        try {
            const res = await fetch('/generate-kb', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pages: lastCrawlData.pages, model_type: bizModel.value, extra_instructions: extraInstr })
            });
            const data = await res.json();
            if (res.ok) {
                lastKBData = data.kb;
                kbContent.innerHTML = formatMarkdown(data.kb);
                kbModelBadge.textContent = humanLabel(bizModel.value);
                kbOutputSection.classList.remove('hidden');
                kbOutputSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else alert('KB error: ' + (data.detail || JSON.stringify(data)));
        } catch (e) { alert('KB failed: ' + e.message); }
        finally { kbLoader.classList.add('hidden'); kbBtn.disabled = false; }
    });

    // ── Download KB ───────────────────────────────────────────────────────────
    downloadKbBtn.addEventListener('click', async () => {
        if (!lastKBData) return;
        const res = await fetch('/download-kb-txt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kb: lastKBData }) });
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
            const res = await fetch('/api/evaluate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
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
            setTimeout(() => agentKbInput.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);

        } catch (e) {
            evalOverlay.classList.add('hidden');
            alert('Evaluation error: ' + e.message);
        }
    });

    // ── Send to RAG Lab ──────────────────────────────────────────────────────
    if (sendToRagBtn) {
        sendToRagBtn.addEventListener('click', () => {
            const kbToTransfer = agentKbInput.value.trim() || lastKBData;
            if (!kbToTransfer) return alert('No Knowledge Base found to transfer.');
            ragKbInput.value = kbToTransfer;
            switchPage('rag');
            ragIndexBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    if (sendAgentToRagBtn) {
        sendAgentToRagBtn.addEventListener('click', () => {
            const agentText = finalInstructions.textContent;
            const kbToTransfer = agentKbInput.value.trim();

            if (agentText) {
                ragAgentInstructions.value = agentText;
            }
            if (kbToTransfer) {
                ragKbInput.value = kbToTransfer;
            }

            if (!agentText && !kbToTransfer) return alert('No data to deploy. Generate Agent instructions first.');

            switchPage('rag');
            ragAgentInstructions.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    // ── Generate Agent Instructions ───────────────────────────────────────────
    generateBtn.addEventListener('click', async () => {
        if (!agentKbInput.value.trim()) return alert('Knowledge Base is empty.');
        if (!companyName.value.trim()) return alert('Enter a company name.');

        generateBtnText.classList.add('hidden');
        generateLoader.classList.remove('hidden');
        generateBtn.disabled = true;
        agentOutput.classList.add('hidden');

        try {
            const res = await fetch('/api/generate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input_kb: agentKbInput.value,
                    company_name: companyName.value,
                    agent_name: agentName.value || 'Aaliyah',
                    instruction_type: activeType,
                    call_direction: activeDir,
                    instruction_template: instructionTemplateText.value,
                    extra_instructions: extraInstructions.value,
                    flow_tree: flowTreeEditor.value || currentFlowTree,
                    performanceConfig: { latency: activeLatency }
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || 'Generation failed');
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let finalData = null;

            agentOutput.classList.remove('hidden');
            finalInstructions.textContent = 'Initializing synthesis...';
            agentOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(l => l.trim());

                for (const line of lines) {
                    try {
                        const data = JSON.parse(line);
                        if (data.type === 'status') {
                            finalInstructions.textContent = `[SYSTEM] ${data.message}...`;
                        } else if (data.type === 'chunk') {
                            finalInstructions.textContent = data.text;
                        } else if (data.type === 'final') {
                            finalData = data;
                            // Update UI with final metadata
                            auditorScore.textContent = data.score;
                            auditorReasoning.textContent = data.reasoning;
                            finalInstructions.textContent = data.final_instructions;

                            const auditorBadge = document.getElementById('auditorBadge');
                            if (data.score >= 75) {
                                refinedStatus.textContent = '✅ Passed initial criteria.';
                                refinedStatus.style.color = '#10b981';
                                if (auditorBadge) {
                                    auditorBadge.textContent = '✅ VERIFIED';
                                    auditorBadge.style.background = 'rgba(16,185,129,0.15)';
                                    auditorBadge.style.borderColor = 'rgba(16,185,129,0.4)';
                                    auditorBadge.style.color = '#4ade80';
                                }
                            } else {
                                refinedStatus.textContent = '⚠️ Auto-corrected to meet standards.';
                                refinedStatus.style.color = '#f59e0b';
                                if (auditorBadge) {
                                    auditorBadge.textContent = '⚠️ REFINED';
                                    auditorBadge.style.background = 'rgba(245,158,11,0.15)';
                                    auditorBadge.style.borderColor = 'rgba(245,158,11,0.4)';
                                    auditorBadge.style.color = '#fbbf24';
                                }
                            }

                            const latencyPill = document.getElementById('latencyPill');
                            const modelPill = document.getElementById('modelPill');
                            if (latencyPill) {
                                latencyPill.textContent = `⚡ ${data.latency}s`;
                                latencyPill.style.display = 'inline-block';
                            }
                            if (modelPill) modelPill.textContent = data.model;
                        } else if (data.type === 'error') {
                            throw new Error(data.message);
                        }
                    } catch (e) {
                        console.error("JSON parse error on line:", line, e);
                    }
                }
            }
        } catch (e) { alert('Error: ' + e.message); }
        finally {
            generateBtnText.classList.remove('hidden');
            generateLoader.classList.add('hidden');
            generateBtn.disabled = false;
        }
    });

    downloadInstructionBtn.addEventListener('click', () => {
        triggerDownload(new Blob([finalInstructions.textContent], { type: 'text/plain' }), 'agent_instructions.txt');
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
                flowTreeEditor.value = currentFlowTree;

                // Render Mermaid
                mermaidContainer.innerHTML = `<pre class="mermaid">${currentFlowTree}</pre>`;
                await mermaid.run({ nodes: [mermaidContainer] });

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
            const val = flowTreeEditor.value || currentFlowTree;
            if (!val) return;
            triggerDownload(new Blob([val], { type: 'text/markdown' }), 'conversation_flow.md');
        });
    }

    if (updateFlowDiagramBtn) {
        updateFlowDiagramBtn.addEventListener('click', async () => {
            const val = flowTreeEditor.value.trim();
            if (!val) return alert('Editor is empty.');
            
            updateFlowDiagramBtn.disabled = true;
            updateFlowDiagramBtn.innerText = '⌛ Rendering...';
            
            try {
                mermaidContainer.innerHTML = `<pre class="mermaid">${val}</pre>`;
                await mermaid.run({ nodes: [mermaidContainer] });
            } catch (e) {
                console.error(e);
                alert('Mermaid Syntax Error. Please check your flow code.');
            } finally {
                updateFlowDiagramBtn.disabled = false;
                updateFlowDiagramBtn.innerText = '🔄 Update Diagram';
            }
        });
    }

    if (appendFlowToKbBtn) {
        appendFlowToKbBtn.addEventListener('click', () => {
            const val = flowTreeEditor.value.trim();
            if (!val) return alert('Nothing to append.');
            
            const currentKb = agentKbInput.value;
            const flowBlock = `\n\n--- CONVERSATIONAL FLOW LOGIC (MERMAID) ---\n${val}\n`;
            
            if (currentKb.includes('CONVERSATIONAL FLOW LOGIC')) {
                if (confirm('Flow logic already exists in KB. Append anyway?')) {
                    agentKbInput.value += flowBlock;
                }
            } else {
                agentKbInput.value += flowBlock;
                alert('Flow logic appended to Knowledge Base.');
            }
            
            // Scroll KB into view
            agentKbInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            agentKbInput.style.borderColor = 'var(--secondary)';
            setTimeout(() => agentKbInput.style.borderColor = '', 2000);
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

            if (ragTopK) {
                ragTopK.addEventListener('input', () => {
                    if (ragTopKVal) ragTopKVal.textContent = ragTopK.value;
                });
            }
            
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
                    console.log("[QA Agent] Storing Q&A list in lastQaData:", data.qa_list);
                    lastQaData = data.qa_list;
                    qaOutput.textContent = JSON.stringify(data.qa_list, null, 2);
                    qaOutput.classList.remove('hidden');

                    if (qaPlainText) {
                        qaPlainText.value = data.qa_text || '';
                    }

                    // Enable benchmark section if on RAG tab
                    const benchmarkSec = document.getElementById('ragBenchmarkSection');
                    if (benchmarkSec) benchmarkSec.classList.remove('hidden');
                }
                loadQaBtn.classList.remove('hidden');
                if (downloadQaBtn) downloadQaBtn.classList.remove('hidden');
                if (copyQuestionsBtn) copyQuestionsBtn.classList.remove('hidden');

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
        triggerDownload(new Blob([qaOutput.textContent], { type: 'text/plain' }), 'sample_qa.txt');
    });

    if (copyQuestionsBtn) {
        copyQuestionsBtn.addEventListener('click', () => {
            qaPlainText.select();
            document.execCommand('copy');
            const originalText = copyQuestionsBtn.innerText;
            copyQuestionsBtn.innerText = '✅ Copied!';
            setTimeout(() => copyQuestionsBtn.innerText = originalText, 2000);
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────


    function showStatus(el, msg, type) {
        el.textContent = msg;
        el.className = 'status-text ' + (type === 'ok' ? 'status-ok' : 'status-err');
        setTimeout(() => { el.textContent = ''; el.className = 'status-text'; }, 3000);
    }

    function formatMarkdown(text) {
        return text
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/^\* (.*$)/gim, '<li>$1</li>')
            .replace(/^\- (.*$)/gim, '<li>$1</li>')
            .replace(/\n/g, '<br>');
    }
    // ── RAG LAB ───────────────────────────────────────────────────────────────

    if (ragIndexBtn) {
        ragIndexBtn.addEventListener('click', async () => {
            if (!ragKbInput.value.trim()) return alert('Knowledge Base is empty. Please generate or paste content first.');

            ragIndexLoader.classList.remove('hidden');
            ragIndexBtn.disabled = true;
            ragIndexStatus.classList.remove('hidden');
            ragIndexStatus.textContent = '⚡ Initializing Index...';
            ragIndexStatus.style.background = 'rgba(var(--primary-rgb), 0.1)';

            try {
                const res = await fetch('/api/rag/index', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        input_kb: ragKbInput.value,
                        chunk_size: parseInt(ragChunkSize.value),
                        overlap: parseInt(ragOverlap.value)
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Indexing failed');

                ragIndexStatus.textContent = `✅ Successfully indexed ${data.chunks_indexed} chunks.`;
                ragIndexStatus.style.background = 'rgba(16,185,129,0.15)';
                ragQueryBtn.disabled = false;
                agentGuidedQueryBtn.disabled = false;
            } catch (e) {
                alert('Index Error: ' + e.message);
                ragIndexStatus.textContent = '❌ Indexing failed.';
                ragIndexStatus.style.background = 'rgba(239,68,68,0.15)';
            } finally {
                ragIndexLoader.classList.add('hidden');
                ragIndexBtn.disabled = false;
            }
        });
    }

    if (ragQueryBtn) {
        ragQueryBtn.addEventListener('click', () => performRagQuery(false));
    }

    if (agentGuidedQueryBtn) {
        agentGuidedQueryBtn.addEventListener('click', () => performRagQuery(true));
    }

    if (clearRagChatBtn) {
        clearRagChatBtn.addEventListener('click', () => {
            ragChatHistory = [];
            ragOutput.classList.add('hidden');
            ragAnswer.innerHTML = '';
        });
    }

    async function performRagQuery(isGuided) {
        const inputEl = isGuided ? agentGuidedQueryInput : ragQueryInput;
        const loaderEl = isGuided ? agentGuidedQueryLoader : ragQueryLoader;
        const btnEl = isGuided ? agentGuidedQueryBtn : ragQueryBtn;

        const query = inputEl.value.trim();
        if (!query) return;

        // If guided, add to log
        if (isGuided) {
            inputEl.value = '';
        }

        loaderEl.classList.remove('hidden');
        btnEl.disabled = true;

        // Hide standard output if using guided chat
        if (!isGuided) ragOutput.classList.add('hidden');

        try {
            const res = await fetch('/api/rag/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    top_k: parseInt(ragTopK.value) || 3,
                    agent_instructions: isGuided ? ragAgentInstructions.value : "",
                    history: isGuided ? ragChatHistory : []
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Query failed');

            if (isGuided) {
                // Guided Chat Logic
                if (ragAnswer.textContent.includes("Ready for your first question")) {
                    ragAnswer.innerHTML = "";
                }

                ragMeta.classList.remove('hidden');
                ragOutput.classList.remove('hidden');

                const userLine = `<div style="color:var(--primary); font-weight:800; margin-top:1rem;">YOU:</div><div style="margin-bottom:1rem; border-left: 2px solid var(--primary); padding-left: 10px;">${query}</div>`;
                
                let chunksHtml = data.context.map((c, idx) => `
                    <div style="font-size:0.75rem; color:var(--text-dim); margin-bottom:0.5rem; padding:0.75rem; background:rgba(255,255,255,0.03); border-radius:8px; border-left:3px solid var(--primary); white-space:pre-wrap; line-height:1.6;">
                        <strong style="color:var(--primary); display:block; margin-bottom:0.3rem;">[Chunk ${idx + 1}]</strong> ${c.text}
                    </div>
                `).join('');

                const agentLine = `
                    <div style="color:var(--secondary); font-weight:800;">AGENT:</div>
                    <div style="margin-bottom:0.5rem; border-left: 2px solid var(--secondary); padding-left: 10px; line-height:1.6;">${markdownToHtml(data.answer)}</div>
                    <details style="margin-bottom:1.5rem; margin-left:10px;">
                        <summary style="font-size:0.7rem; color:var(--text-dim); cursor:pointer; opacity:0.7;">📖 View Retrieved Context Chunks (${data.context.length})</summary>
                        <div style="margin-top:0.5rem;">${chunksHtml}</div>
                    </details>
                `;

                ragAnswer.innerHTML += userLine + agentLine;
                ragLatency.textContent = `⚡ Latency: ${data.latency}ms`;
                ragModel.textContent = data.model;

                ragChatHistory.push({ role: 'user', content: query });
                ragChatHistory.push({ role: 'bot', content: data.answer });
                if (ragChatHistory.length > 10) ragChatHistory.splice(0, 2);

                ragAnswer.scrollTop = ragAnswer.scrollHeight;
                if (ttsActive) speakText(data.answer);

            } else {
                // Raw Search Logic
                ragOutput.classList.remove('hidden');
                ragMeta.classList.remove('hidden');
                
                let chunksHtml = data.context.map((c, idx) => `
                    <div style="background:rgba(255,255,255,0.02); border:1px solid var(--glass-border); border-radius:12px; padding:1.5rem; margin-bottom:1rem; position:relative; overflow:hidden;">
                        <div style="font-size:0.7rem; color:var(--primary); font-weight:800; margin-bottom:0.8rem; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.5rem;">
                            <span>📄 SOURCE CHUNK ${idx + 1}</span>
                            <span style="background:rgba(var(--primary-rgb), 0.1); color:var(--primary); padding:0.2rem 0.5rem; border-radius:4px; font-size:0.65rem;">Score: ${(c.score * 100).toFixed(1)}%</span>
                        </div>
                        <div style="font-size:0.85rem; color:var(--text-main); line-height:1.8; white-space:pre-wrap;">${c.text}</div>
                    </div>
                `).join('');

                ragAnswer.innerHTML = `
                    <div style="color:var(--secondary); font-weight:800; margin-bottom:0.5rem;">SEARCH RESULT:</div>
                    <div style="border-left: 3px solid var(--secondary); padding-left: 15px; margin-bottom: 2rem; font-size:1rem; line-height:1.6;">${markdownToHtml(data.answer)}</div>
                    <div style="color:var(--primary); font-size:0.8rem; font-weight:800; margin-bottom:1rem; letter-spacing:0.05em;">📖 ALL RETRIEVED CHUNKS (${data.context.length}):</div>
                    ${chunksHtml}
                `;
                
                ragLatency.textContent = `⚡ Latency: ${data.latency}ms (LLM: ${data.llm_latency}ms)`;
                ragModel.textContent = data.model;

                if (ttsActive) speakText(data.answer);

                const scoreEl = document.getElementById('ragScore');
                if (scoreEl) {
                    let scoreText = `Accuracy: ${data.relevance_score}%`;
                    scoreEl.textContent = scoreText;
                    scoreEl.className = 'stat-badge ' + (data.relevance_score > 80 ? 'score-high' : data.relevance_score > 50 ? 'score-med' : 'score-low');
                }
                
                ragOutput.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        } catch (e) {
            alert('Query Error: ' + e.message);
        } finally {
            loaderEl.classList.add('hidden');
            btnEl.disabled = false;
        }
    }

    function appendChat(role, text, score = null, scoreColor = null, latency = null) {
        const msg = document.createElement('div');
        msg.className = `chat-message ${role}`;
        let metaHtml = '';
        if (score !== null || latency !== null) {
            metaHtml = `<div style="font-size:0.65rem; margin-top:0.4rem; opacity:0.8; display:flex; gap:0.6rem;">
                ${score !== null ? `<span style="color:${scoreColor}; font-weight:800;">RELEVANCE: ${score}%</span>` : ''}
                ${latency !== null ? `<span style="color:var(--secondary);">LATENCY: ${latency}ms</span>` : ''}
                <span id="voiceLatency-${Date.now()}" class="voice-meta"></span>
            </div>`;
        }
        msg.innerHTML = `
            <div class="chat-role">${role === 'user' ? 'You' : 'Agent'}</div>
            <div class="chat-bubble">
                ${text}
                ${metaHtml}
            </div>
        `;
        ragChatLog.appendChild(msg);
        ragChatLog.scrollTop = ragChatLog.scrollHeight;
        return msg;
    }


    // ── Automated Chat Runner ─────────────────────────────────────────────
    if (openAutoChatBtn) {
        openAutoChatBtn.addEventListener('click', () => {
            console.log("[AutoTest] Open clicked. lastQaData:", lastQaData);
            if (!lastQaData || !Array.isArray(lastQaData) || lastQaData.length === 0) {
                return alert('No Sample Q&A data found. Please generate Q&A in the Agent Builder tab first.');
            }
            autoChatOverlay.classList.remove('hidden');
            autoChatLog.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:1rem;">Ready to begin automated test sequence.</div>';
            autoChatProgressBar.style.width = '0%';
            autoChatStatus.textContent = `Found ${lastQaData.length} test cases.`;
            startAutoChatBtn.disabled = false;
        });
    }

    if (closeAutoChat) {
        closeAutoChat.addEventListener('click', () => autoChatOverlay.classList.add('hidden'));
    }

    if (startAutoChatBtn) {
        startAutoChatBtn.addEventListener('click', async () => {
            console.log("[AutoTest] Starting test sequence...");
            startAutoChatBtn.disabled = true;
            autoChatLog.innerHTML = '';

            const tests = lastQaData.slice(0, 10);
            if (tests.length === 0) {
                alert("No questions to test.");
                startAutoChatBtn.disabled = false;
                return;
            }

            let completed = 0;
            for (const test of tests) {
                const q = test.question || test.q || test.Question; // Robust key check
                const ref = test.answer || test.a || test.Answer;
                if (!q) {
                    console.warn("[AutoTest] Skipping empty question:", test);
                    continue;
                }

                appendAutoChatMessage('user', q);
                autoChatStatus.textContent = `Testing (${completed + 1}/${tests.length})...`;

                try {
                    console.log(`[AutoTest] Querying: ${q}`);
                    const res = await fetch('/api/rag/query', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: q,
                            agent_instructions: ragAgentInstructions.value,
                            history: [], // Clean history for each test
                            reference_answer: ref
                        })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.detail || 'Query failed');

                    const scoreColor = data.relevance_score > 80 ? '#10b981' : data.relevance_score > 50 ? '#f59e0b' : '#ef4444';
                    appendAutoChatMessage('bot', data.answer, data.relevance_score, scoreColor, data.latency);
                } catch (e) {
                    console.error("[AutoTest] Error during test:", e);
                    appendAutoChatMessage('bot', "⚠️ Error: " + e.message, 0, '#ef4444');
                }

                completed++;
                autoChatProgressBar.style.width = `${(completed / tests.length) * 100}%`;
            }

            autoChatStatus.textContent = '✅ Automation Complete.';
            startAutoChatBtn.disabled = false;
        });
    }

    function appendAutoChatMessage(role, text, score = null, scoreColor = null, latency = null) {
        const msg = document.createElement('div');
        msg.className = `chat-message ${role}`;
        let scoreHtml = score !== null ? `<div style="font-size:0.65rem; color:${scoreColor}; font-weight:800; margin-top:0.2rem;">ACCURACY: ${score}% ${latency ? `| LATENCY: ${latency}ms` : ''}</div>` : '';
        msg.innerHTML = `
            <div class="chat-role">${role === 'user' ? 'You' : 'Agent'}</div>
            <div class="chat-bubble">${text}${scoreHtml}</div>
        `;
        autoChatLog.appendChild(msg);
        autoChatLog.scrollTop = autoChatLog.scrollHeight;
    }

    // ── Intelligence Auditor ──────────────────────────────────────────────
    if (openAuditorBtn) {
        openAuditorBtn.addEventListener('click', () => {
            ragAuditOverlay.classList.remove('hidden');
            if (lastQaData && Array.isArray(lastQaData)) {
                // Pre-fill if we have sample Q&A
                const qs = lastQaData.map(item => item.question || item.q || item.Question).filter(Boolean);
                if (qs.length > 0) {
                    auditQuestionsInput.value = qs.join('\n');
                }
            }
        });
    }

    if (closeRagAudit) {
        closeRagAudit.addEventListener('click', () => ragAuditOverlay.classList.add('hidden'));
    }

    if (runAuditBtn) {
        runAuditBtn.addEventListener('click', async () => {
            const lines = auditQuestionsInput.value.split('\n').map(l => l.trim()).filter(l => l.length > 3);
            if (lines.length === 0) return alert('Enter at least one question.');

            runAuditBtn.disabled = true;
            runAuditBtn.innerText = '⌛ Auditing...';
            auditResultsList.innerHTML = '';
            auditProgress.classList.remove('hidden');
            if (auditSummary) auditSummary.classList.add('hidden');
            if (downloadAuditReport) downloadAuditReport.classList.add('hidden');
            if (downloadViolationReport) downloadViolationReport.classList.add('hidden');
            if (sendToLabBtn) sendToLabBtn.classList.add('hidden');

            let scores = [];
            let auditData = [];

            for (let i = 0; i < lines.length; i++) {
                const q = lines[i];

                // Lookup reference answer in lastQaData for Ground-Truth check
                let refAnswer = null;
                if (lastQaData && Array.isArray(lastQaData)) {
                    const match = lastQaData.find(item => (item.question || item.q || item.Question) === q);
                    if (match) {
                        refAnswer = match.answer || match.a || match.Answer;
                    }
                }

                auditStatusText.textContent = `${i + 1}/${lines.length} Completed`;
                auditProgressBar.style.width = `${((i + 1) / lines.length) * 100}%`;

                try {
                    const res = await fetch('/api/rag/query', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: q,
                            agent_instructions: ragAgentInstructions.value,
                            history: [],
                            reference_answer: refAnswer
                        })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.detail);

                    scores.push(data.relevance_score);
                    auditData.push({
                        q,
                        a: data.answer,
                        expected: refAnswer,
                        score: data.relevance_score,
                        violation: data.instruction_violation,
                        source: data.failure_source,
                        justification: data.justification,
                        chunks: data.context // Store full chunks for download
                    });

                    const item = document.createElement('div');
                    item.className = 'audit-item glass';
                    item.style.padding = '1.25rem';
                    item.style.marginBottom = '1rem';
                    const sColor = data.relevance_score > 80 ? '#10b981' : data.relevance_score > 50 ? '#f59e0b' : '#ef4444';
                    let failureHtml = '';
                    if (data.relevance_score < 100 && data.failure_source !== "NONE") {
                        const sourceLabel = data.failure_source === 'CONTEXT_MISSING' ? 'CONTEXT MISSING' : 'INSTRUCTION FAIL';
                        failureHtml = `<div style="font-size:0.75rem; margin-top:0.4rem; color:#f87171; font-weight:800; background:rgba(239,68,68,0.1); padding:0.4rem; border-radius:4px; border:1px solid rgba(239,68,68,0.2);">
                            🚨 FAILURE SOURCE: ${sourceLabel}
                        </div>`;
                    }

                    let violationHtml = '';
                    if (data.instruction_violation && data.instruction_violation !== 'None' && data.instruction_violation !== 'N/A') {
                        violationHtml = `<div style="font-size:0.75rem; margin-top:0.3rem; padding:0.4rem; background:rgba(239,68,68,0.1); border-radius:4px; border-left:3px solid #ef4444; color:#fca5a5;">
                            <strong>Instruction Violation:</strong> ${data.instruction_violation}
                        </div>`;
                    }

                    let chunksHtml = data.context.map((c, idx) => `
                        <div style="font-size:0.75rem; color:var(--text-dim); margin-top:0.5rem; padding:0.75rem; background:rgba(0,0,0,0.3); border-radius:8px; white-space:pre-wrap; border:1px solid rgba(255,255,255,0.08); line-height:1.6;">
                            <strong style="color:var(--primary); display:block; margin-bottom:0.4rem; font-size:0.8rem;">📄 Retrieved Chunk ${idx + 1}</strong>
                            ${c.text}
                        </div>
                    `).join('');

                    let refAnswerHtml = refAnswer ? `
                        <div style="font-size:0.75rem; color:#10b981; margin-top:0.5rem; padding:0.6rem; background:rgba(16,185,129,0.05); border-radius:6px; border-left:3px solid #10b981;">
                            <strong>Ground Truth (Reference):</strong><br>${refAnswer}
                        </div>
                    ` : '';

                    item.innerHTML = `
                        <div class="audit-q" style="font-size:1rem; margin-bottom:0.5rem;">Q: ${q}</div>
                        <div class="audit-a" style="background:rgba(255,255,255,0.03); padding:1rem; border-radius:8px; border:1px solid var(--glass-border); line-height:1.6; margin-bottom:1rem;">${data.answer}</div>
                        
                        <div style="font-size:0.8rem; color:#f59e0b; font-weight:700; margin-top:0.5rem; padding:0.5rem; border-radius:4px; background:rgba(245,158,11,0.1); border:1px solid rgba(245,158,11,0.2); display:inline-block;">
                            ⚖️ VERDICT: ${data.relevance_score}% Accuracy
                        </div>
                        
                        <div style="font-size:0.8rem; color:var(--text-dim); margin-top:0.8rem; padding:0.5rem; line-height:1.5; font-style:italic; border-left:2px solid var(--primary);">
                            "${data.justification || 'No justification provided'}"
                        </div>

                        <details style="margin-top:1.25rem; border-top:1px solid var(--glass-border); padding-top:1rem;">
                            <summary style="font-size:0.8rem; color:var(--secondary); cursor:pointer; font-weight:800; display:flex; align-items:center; gap:0.5rem;">
                                🛠️ View Technical Diagnostics & Context (${data.context.length})
                            </summary>
                            
                            <div style="margin-top:1rem; display:flex; flex-direction:column; gap:0.75rem;">
                                <div style="font-size:0.75rem; color:var(--primary); padding:0.6rem; background:rgba(99,102,241,0.05); border-radius:6px; border-left:3px solid var(--primary);">
                                    <strong>Original Query:</strong><br>${q}
                                </div>
                                ${refAnswerHtml}
                                ${failureHtml}
                                ${violationHtml}
                                <div style="margin-top:0.5rem;">
                                    <div style="font-size:0.7rem; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.1em; margin-bottom:0.4rem;">Knowledge Base Chunks Used:</div>
                                    ${chunksHtml}
                                </div>
                            </div>
                        </details>

                        <div class="audit-meta" style="margin-top:1rem; display:flex; justify-content:space-between; font-size:0.7rem; color:var(--text-dim);">
                            <span>Latency: ${data.latency}ms (LLM: ${data.llm_latency}ms)</span>
                            <span>Model: ${data.model}</span>
                        </div>
                    `;
                    auditResultsList.appendChild(item);
                    auditResultsList.scrollTop = auditResultsList.scrollHeight;

                } catch (e) {
                    const errItem = document.createElement('div');
                    errItem.className = 'audit-item';
                    errItem.innerHTML = `<div class="audit-q">Q: ${q}</div><div style="color:#ef4444; font-size:0.8rem;">⚠️ Error: ${e.message}</div>`;
                    auditResultsList.appendChild(errItem);
                }
            }

            const avg = Math.round(scores.reduce((a, b) => a + b, 0) / (scores.length || 1));
            if (avgAuditScore) {
                avgAuditScore.textContent = `${avg}%`;
                avgAuditScore.style.color = avg > 80 ? '#10b981' : avg > 50 ? '#f59e0b' : '#ef4444';
            }

            // Always show resolution panel on main RAG page after audit
            if (ragPerformanceBar) ragPerformanceBar.classList.remove('hidden');
            if (avgAuditScoreMain) {
                avgAuditScoreMain.textContent = `${avg}%`;
                avgAuditScoreMain.style.color = avg > 80 ? '#10b981' : avg > 50 ? '#f59e0b' : '#ef4444';
            }
            
            if (viewRefineStrategyMainBtn) viewRefineStrategyMainBtn.classList.remove('hidden');
            if (sendToLabMainBtn) sendToLabMainBtn.classList.remove('hidden');

            runAuditBtn.disabled = false;
            runAuditBtn.innerText = '🚀 Run Full Audit';
            window._lastAuditData = auditData;
        });
    }

    if (sendToLabBtn) {
        sendToLabBtn.addEventListener('click', () => {
            if (!window._lastAuditData) return;

            const failures = window._lastAuditData.filter(d =>
                (d.violation && d.violation !== 'None' && d.violation !== 'N/A') || (d.relevance_score < 80)
            );

            if (failures.length === 0) {
                alert('No failures detected to send to the Lab.');
                return;
            }

            // Safe hide & transfer
            if (ragAuditOverlay) ragAuditOverlay.classList.add('hidden');
            if (labInstructionsInput) labInstructionsInput.value = ragAgentInstructions.value;
            if (labAuditInput) labAuditInput.value = JSON.stringify(failures, null, 2);

            // Navigate
            switchPage('lab');
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Feedback
            if (labInstructionsInput) labInstructionsInput.style.borderColor = 'var(--emerald)';
            if (labAuditInput) labAuditInput.style.borderColor = 'var(--emerald)';
            setTimeout(() => {
                if (labInstructionsInput) labInstructionsInput.style.borderColor = '';
                if (labAuditInput) labAuditInput.style.borderColor = '';
            }, 2000);
        });
    }



    if (sendToLabMainBtn) {
        sendToLabMainBtn.addEventListener('click', () => {
            if (!window._lastAuditData) return;

            const failures = window._lastAuditData.filter(d =>
                (d.violation && d.violation !== 'None' && d.violation !== 'N/A') || (d.score < 80)
            );

            if (failures.length === 0) {
                alert('No failures detected to send to the Lab.');
                return;
            }

            // Transfer
            if (labInstructionsInput) labInstructionsInput.value = ragAgentInstructions.value;
            if (labAuditInput) labAuditInput.value = JSON.stringify(failures, null, 2);

            // Navigate
            switchPage('lab');
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Feedback
            if (labInstructionsInput) labInstructionsInput.style.borderColor = 'var(--emerald)';
            if (labAuditInput) labAuditInput.style.borderColor = 'var(--emerald)';
            setTimeout(() => {
                if (labInstructionsInput) labInstructionsInput.style.borderColor = '';
                if (labAuditInput) labAuditInput.style.borderColor = '';
            }, 2000);
        });
    }

    if (viewRefineStrategyMainBtn) {
        viewRefineStrategyMainBtn.addEventListener('click', () => {
            if (refineStrategyOverlay) refineStrategyOverlay.classList.remove('hidden');
        });
    }

    if (applyStrategyToLabBtn) {
        applyStrategyToLabBtn.addEventListener('click', () => {
            const strategy = refineStrategyContent.textContent.trim();
            const currentInstructions = ragAgentInstructions.value;

            if (!strategy) {
                alert('No strategy generated yet. Run the audit first.');
                return;
            }

            // Transfer to Lab
            if (labInstructionsInput) labInstructionsInput.value = currentInstructions;
            if (labAuditInput) labAuditInput.value = strategy;

            // Close modals
            if (refineStrategyOverlay) refineStrategyOverlay.classList.add('hidden');
            if (ragAuditOverlay) ragAuditOverlay.classList.add('hidden');

            // Switch & Feedback
            switchPage('lab');
            window.scrollTo({ top: 0, behavior: 'smooth' });

            if (labInstructionsInput) labInstructionsInput.style.borderColor = 'var(--emerald)';
            if (labAuditInput) labAuditInput.style.borderColor = 'var(--emerald)';
            setTimeout(() => {
                if (labInstructionsInput) labInstructionsInput.style.borderColor = '';
                if (labAuditInput) labAuditInput.style.borderColor = '';
            }, 2000);
        });
    }

    if (closeRefineDiff) {
        closeRefineDiff.addEventListener('click', () => {
            refineDiffOverlay.classList.add('hidden');
        });
    }
    if (closeRefineDiffBtn) {
        closeRefineDiffBtn.addEventListener('click', () => {
            refineDiffOverlay.classList.add('hidden');
        });
    }

    if (viewRefineStrategyBtn) {
        viewRefineStrategyBtn.addEventListener('click', () => {
            if (!window._lastAuditData) return;
            const failures = window._lastAuditData.filter(d => (d.violation && d.violation !== 'None' && d.violation !== 'N/A') || d.relevance_score < 80);

            const failure_context = failures.map(f =>
                `FAIL CASE:\nQuestion: ${f.q}\nAgent Answered: ${f.a}\nViolation: ${f.violation}\nReason: ${f.justification}`
            ).join('\n\n');

            const strategy = `### AGENT INSTRUCTION REFINEMENT TASK:
You are an expert Prompt Engineer. You have been provided with an audit report of an AI Agent. 
Your task is to update the Agent Instructions to fix the identified failures while maintaining the original persona and constraints.

### AGENT IDENTITY:
Company: ${companyName.value || 'the company'}
Agent: ${agentName.value || 'Aaliyah'}

### CURRENT INSTRUCTIONS:
${finalInstructions.textContent}

### AUDIT FINDINGS (FAILURES):
${failure_context || 'None detected yet.'}

### TASK:
1. Analyze the failures and identify the root cause in the current instructions.
2. Update the instructions to be more precise and prevent these specific errors.
3. Ensure the agent remains grounded in the Knowledge Base.
4. Output ONLY the improved, production-grade System Prompt.`;

            refineStrategyContent.textContent = strategy;
            refineStrategyOverlay.classList.remove('hidden');
        });
    }

    if (closeRefineStrategy) {
        closeRefineStrategy.addEventListener('click', () => {
            refineStrategyOverlay.classList.add('hidden');
        });
    }
    if (closeRefineStrategyBtn) {
        closeRefineStrategyBtn.addEventListener('click', () => {
            refineStrategyOverlay.classList.add('hidden');
        });
    }

    if (downloadAuditReport) {
        downloadAuditReport.addEventListener('click', () => {
            if (!window._lastAuditData) return;
            
            let text = "### INTELLIGENCE AUDITOR REPORT\n";
            text += `Generated on: ${new Date().toLocaleString()}\n`;
            text += "================================================================================\n\n";
            
            window._lastAuditData.forEach((d, i) => {
                text += `TEST CASE #${i + 1}\n`;
                text += `QUESTION: ${d.q}\n`;
                text += `AGENT ANSWER: ${d.a}\n`;
                text += `EXPECTED ANSWER: ${d.expected || 'N/A (No Ground Truth)'}\n`;
                text += `\nAUDIT SCORE: ${d.score}%\n`;
                text += `FAILURE SOURCE: ${d.source}\n`;
                text += `VIOLATION: ${d.violation || 'None'}\n`;
                text += `JUSTIFICATION: ${d.justification || 'No justification provided'}\n`;
                
                text += `\nRETRIEVED CONTEXT CHUNKS:\n`;
                if (d.chunks && d.chunks.length > 0) {
                    d.chunks.forEach((c, ci) => {
                        text += `--- Chunk ${ci + 1} ---\n${c.text}\n`;
                    });
                } else {
                    text += "No chunks retrieved.\n";
                }
                
                text += "\n" + "=".repeat(80) + "\n\n";
            });

            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob), a = document.createElement('a');
            a.href = url; a.download = `intelligence_audit_report_${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url);
        });
    }

    if (downloadViolationReport) {
        downloadViolationReport.addEventListener('click', () => {
            if (!window._lastAuditData) return;
            const violations = window._lastAuditData.filter(d => d.violation && d.violation !== 'None' && d.violation !== 'N/A');
            if (violations.length === 0) return alert('No instruction violations found in this audit.');

            let text = "### AGENT INSTRUCTION VIOLATION REPORT\n";
            text += `Generated on: ${new Date().toLocaleString()}\n`;
            text += "==========================================\n\n";

            violations.forEach((v, i) => {
                text += `CASE #${i + 1}\n`;
                text += `QUESTION: ${v.q}\n`;
                text += `AGENT ANSWER: ${v.a}\n`;
                text += `VIOLATION: ${v.violation}\n`;
                text += `AUDITOR REASONING: ${v.justification}\n`;
                text += `------------------------------------------\n\n`;
            });

            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob), a = document.createElement('a');
            a.href = url; a.download = 'agent_instruction_violations.txt'; a.click(); URL.revokeObjectURL(url);
        });
    }
    if (ragChunkSize) {
        ragChunkSize.addEventListener('input', (e) => {
            const val = document.getElementById('chunkSizeVal');
            if (val) val.textContent = e.target.value;
        });
    }
    if (ragOverlap) {
        ragOverlap.addEventListener('input', (e) => {
            const val = document.getElementById('overlapVal');
            if (val) val.textContent = e.target.value;
        });
    }

    // ── Logs Logic ────────────────────────────────────────────────────────
    if (viewLogsBtn) {
        viewLogsBtn.addEventListener('click', () => {
            fetchLogs();
            logsModal.classList.remove('hidden');
        });
    }
    if (closeLogsModal) {
        closeLogsModal.addEventListener('click', () => logsModal.classList.add('hidden'));
    }
    if (refreshLogsBtn) {
        refreshLogsBtn.addEventListener('click', fetchLogs);
    }
    if (downloadFullLogBtn) {
        downloadFullLogBtn.addEventListener('click', async () => {
            const content = logsContent.textContent;
            if (!content) return;
            triggerDownload(new Blob([content], { type: 'text/plain' }), 'rag_performance.log');
        });
    }

    async function fetchLogs() {
        logsContent.textContent = '⌛ Fetching logs...';
        try {
            const res = await fetch('/api/logs');
            const data = await res.json();
            if (res.ok) {
                logsContent.textContent = data.logs || 'No logs found.';
                logsContent.scrollTop = logsContent.scrollHeight;
            } else {
                logsContent.textContent = 'Error fetching logs: ' + (data.detail || 'Unknown error');
            }
        } catch (e) {
            logsContent.textContent = 'Fetch failed: ' + e.message;
        }
    }

    // ── Voice Logic ────────────────────────────────────────────────────────

    if (ttsToggle) {
        ttsToggle.addEventListener('click', () => {
            ttsActive = !ttsActive;
            ttsToggle.classList.toggle('active', ttsActive);
            const icon = ttsToggle.querySelector('.icon');
            const label = ttsToggle.querySelector('.label');
            icon.textContent = ttsActive ? '🔊' : '🔇';
            label.textContent = ttsActive ? 'TTS On' : 'TTS Off';
            if (!ttsActive && currentAudio) {
                currentAudio.pause();
            }
        });
    }

    async function speakText(text, msgEl = null) {
        if (!text) return;
        const startTime = Date.now();
        const metaEl = msgEl ? msgEl.querySelector('.voice-meta') : null;
        if (metaEl) metaEl.textContent = ' | 🔊 Synthesizing...';

        try {
            const response = await fetch('/api/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            if (!response.ok) throw new Error('TTS Failed');

            const ttsLatency = Date.now() - startTime;
            const azureLatency = response.headers.get('X-TTS-Latency') || 'unknown';

            const latencyStr = ` | TTS: ${ttsLatency}ms (Azure: ${azureLatency}ms)`;

            // Update Raw UI
            const latencyEl = document.getElementById('ragLatency');
            if (latencyEl) latencyEl.textContent += latencyStr;

            // Update Chat UI
            if (metaEl) metaEl.textContent = latencyStr;

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);

            if (currentAudio) currentAudio.pause();
            currentAudio = new Audio(url);
            currentAudio.play();
        } catch (e) {
            console.error("TTS Error:", e);
            if (metaEl) metaEl.textContent = ' | ❌ TTS Error';
        }
    }

    function initSTT(btn, input) {
        if (!btn || !input) return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            btn.style.display = 'none';
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (btn.classList.contains('active')) {
                recognition.stop();
            } else {
                btn._sttStartTime = Date.now();
                recognition.start();
            }
        });

        recognition.onstart = () => {
            btn.classList.add('active');
            input.placeholder = "Listening...";
        };

        recognition.onresult = (event) => {
            const sttLatency = Date.now() - (btn._sttStartTime || Date.now());
            const transcript = event.results[0][0].transcript;
            input.value = transcript;
            input.dispatchEvent(new Event('input')); // Trigger any input listeners

            // Log STT latency to server
            fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ level: 'INFO', message: `STT SUCCESS | Latency: ${sttLatency}ms | Text: "${transcript}"` })
            });

            // Show STT latency in placeholder briefly
            input.placeholder = `Transcribed in ${sttLatency}ms...`;

            // Append STT latency to UI if available
            const latencyEl = document.getElementById('ragLatency');
            if (latencyEl) {
                latencyEl.textContent = `🎤 STT: ${sttLatency}ms | ` + latencyEl.textContent;
            }
        };

        recognition.onerror = (event) => {
            console.error("STT Error:", event.error);
            btn.classList.remove('active');
        };

        recognition.onend = () => {
            btn.classList.remove('active');
            input.placeholder = input.id === 'ragQueryInput' ? "Search the knowledge base..." : "Chat with your Agent...";
        };
    }

    initSTT(ragQueryMic, ragQueryInput);
    // ── Agent Rewriter Logic ──────────────────────────────────────────────────
    runRewriterBtn.addEventListener('click', async () => {
        const current = rewriterInput.value.trim();
        const goal = rewritingGoal.value.trim();
        if (!current || !goal) {
            alert('Please provide both current instructions and a rewriting goal.');
            return;
        }

        runRewriterBtn.disabled = true;
        runRewriterBtn.innerHTML = '✨ Rewriting...';
        rewriterOutput.innerHTML = '<div class="empty-state">AI is synthesizing new instructions...</div>';

        try {
            const res = await fetch('/api/rewrite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ current_instructions: current, goal: goal })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Rewriting failed');

            rewriterOutput.innerHTML = `<pre style="white-space:pre-wrap; font-family:inherit; color:inherit; margin:0;">${data.refined_instructions}</pre>`;
        } catch (e) {
            rewriterOutput.innerHTML = `<div style="color:#f87171;">Error: ${e.message}</div>`;
        } finally {
            runRewriterBtn.disabled = false;
            runRewriterBtn.innerHTML = '✨ AI Rewrite Instructions';
        }
    });

    copyRewriterBtn.addEventListener('click', () => {
        const text = rewriterOutput.innerText;
        if (text && text !== 'Output will appear here...') {
            navigator.clipboard.writeText(text);
            const originalText = copyRewriterBtn.innerText;
            copyRewriterBtn.innerText = '✅ Copied!';
            setTimeout(() => copyRewriterBtn.innerText = originalText, 2000);
        }
    });

    applyRewriterToBuilderBtn.addEventListener('click', () => {
        const text = rewriterOutput.innerText;
        if (text && text !== 'Output will appear here...') {
            if (ragAgentInstructions) {
                ragAgentInstructions.value = text;
                ragAgentInstructions.style.borderColor = 'var(--emerald)';
                setTimeout(() => ragAgentInstructions.style.borderColor = '', 2000);
            }
            switchPage('rag');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    // ── Instruction Lab Logic ──────────────────────────────────────────────────
    runLabRefineBtn.addEventListener('click', async () => {
        const current = labInstructionsInput.value.trim();
        const auditText = labAuditInput.value.trim();
        if (!current || !auditText) {
            alert('Please provide both base instructions and audit failure data.');
            return;
        }

        let failures = [];
        try {
            failures = JSON.parse(auditText);
            if (!Array.isArray(failures)) throw new Error('Audit data must be an array of failures.');
        } catch (e) {
            alert('Invalid Audit JSON: ' + e.message);
            return;
        }

        runLabRefineBtn.disabled = true;
        runLabRefineBtn.innerHTML = '🧪 Analyzing & Refining...';

        try {
            const res = await fetch('/api/refine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_instructions: current,
                    failures: failures,
                    agent_name: agentName.value || 'Agent',
                    company_name: companyName.value || 'Company'
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Refinement failed');

            labEmptyState.classList.add('hidden');
            labResultsSection.classList.remove('hidden');

            const formatList = (val) => {
                if (!val) return 'None analyzed.';
                if (Array.isArray(val)) return val.map(l => `<div style="margin-bottom:0.4rem;">• ${l}</div>`).join('');
                return val.split('\n').map(l => `<div style="margin-bottom:0.4rem;">${l}</div>`).join('');
            };

            labGapAnalysis.innerHTML = formatList(data.gap_analysis);
            labRefinedOutput.innerHTML = `<pre style="white-space:pre-wrap; font-family:inherit; color:inherit; margin:0;">${data.refined_instructions}</pre>`;
        } catch (e) {
            alert('Refinement Error: ' + e.message);
        } finally {
            runLabRefineBtn.disabled = false;
            runLabRefineBtn.innerHTML = '🧪 Run Diagnostic Refinement';
        }
    });

    copyLabOutputBtn.addEventListener('click', () => {
        const text = labRefinedOutput.innerText;
        if (text && text !== 'Refined prompt will appear here...') {
            navigator.clipboard.writeText(text);
            const originalText = copyLabOutputBtn.innerText;
            copyLabOutputBtn.innerText = '✅ Copied!';
            setTimeout(() => copyLabOutputBtn.innerText = originalText, 2000);
        }
    });



    if (sendLabToRewriterBtn) {
        sendLabToRewriterBtn.addEventListener('click', () => {
            const current = labInstructionsInput.value.trim();
            const refined = labRefinedOutput.innerText.trim();

            if (!refined || refined === 'Refined prompt will appear here...') {
                alert('Please run the diagnostic refinement first to generate an output.');
                return;
            }

            // Populate Rewriter
            rewriterInput.value = current;
            rewritingGoal.value = `### DIAGNOSTIC OPTIMIZATION TASK:\nUpdate the instructions based on the following diagnostic refinement:\n\n${refined}\n\nMaintain the original persona while incorporating these fixes.`;

            // Switch & Feedback
            switchPage('rewriter');
            rewritingGoal.style.borderColor = 'var(--secondary)';
            setTimeout(() => rewritingGoal.style.borderColor = '', 2000);
        });
    }

});
