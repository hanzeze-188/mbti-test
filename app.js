// ============ 状态管理 ============
const state = {
    currentQuestion: 0,
    answers: null,
    dimensionOrder: [],
    shuffledQuestions: [],
    result: null,
    isTransitioning: false,
    questionAnswers: []   // 逐题答案记录
};

// ============ DOM 引用 ============
const $ = id => document.getElementById(id);
const welcomePage = $('welcome-page');
const testPage = $('test-page');
const resultPage = $('result-page');
const questionText = $('question-text');
const optionsContainer = $('options-container');
const qNumberDisplay = $('q-number-display');
const qDimension = $('q-dimension');
const progressFill = $('progress-fill');
const progressText = $('progress-text');
const progressPercent = $('progress-percent');
const dimPills = document.querySelectorAll('.dim-pill');
const questionArea = $('question-area');
const typeLetters = $('type-letters');
const toast = $('toast');
const prevBtn = $('prev-btn');
const sheetOverlay = $('sheet-overlay');
const sheetGrid = $('sheet-grid');
const sheetStat = $('sheet-stat');

// ============ 工具函数 ============
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function initScores() {
    return { EI: { E: 0, I: 0 }, SN: { S: 0, N: 0 }, TF: { T: 0, F: 0 }, JP: { J: 0, P: 0 } };
}

function opposite(dir) {
    return ({ E: 'I', I: 'E', S: 'N', N: 'S', T: 'F', F: 'T', J: 'P', P: 'J' })[dir];
}

// ============ 开始测试 ============
function startTest() {
    const shuffled = shuffle(questions);
    state.currentQuestion = 0;
    state.answers = initScores();
    state.dimensionOrder = shuffled.map(q => q.dimension);
    state.shuffledQuestions = shuffled;
    state.isTransitioning = false;
    state.questionAnswers = [];

    welcomePage.classList.add('hidden');
    testPage.classList.remove('hidden');
    resultPage.classList.add('hidden');

    window.scrollTo({ top: 0 });
    renderQuestion();
}

// ============ 维度药丸更新 ============
function updateDimPills(dimension) {
    dimPills.forEach(pill => {
        const dim = pill.dataset.dim;
        pill.classList.remove('active', 'done');
        if (dim === dimension) {
            pill.classList.add('active');
        } else {
            const scores = state.answers[dim];
            if (scores) {
                const total = Object.values(scores).reduce((a, b) => a + b, 0);
                if (total > 0) pill.classList.add('done');
            }
        }
    });
}

// ============ 渲染题目 ============
function renderQuestion() {
    if (state.isTransitioning) return;

    const q = state.shuffledQuestions[state.currentQuestion];
    const total = state.shuffledQuestions.length;
    const progress = (state.currentQuestion / total) * 100;

    qNumberDisplay.textContent = String(state.currentQuestion + 1).padStart(2, '0');
    progressText.textContent = `${state.currentQuestion + 1} / ${total}`;
    progressPercent.textContent = `${Math.round(progress)}%`;
    progressFill.style.width = `${progress}%`;

    // 上一题按钮 — 第一题隐藏
    prevBtn.classList.toggle('hidden', state.currentQuestion === 0);

    // 维度指示
    qDimension.textContent = q.dimension;
    updateDimPills(q.dimension);

    // 内容过渡
    questionArea.classList.add('transitioning');
    clearTimeout(questionArea._renderTimer);

    questionArea._renderTimer = setTimeout(() => {
        questionText.textContent = q.text;
        renderOptions(q);
        restoreSelection();

        questionArea.classList.remove('transitioning');
    }, 280);
}

// ============ 渲染选项 ============
function renderOptions(q) {
    optionsContainer.innerHTML = '';
    const labels = ['A', 'B', 'C', 'D', 'E'];
    const baseText = q.dimension === 'EI' ? '符合' : '同意';

    const options = [
        { text: `完全${baseText}`, value: q.direction },
        { text: `比较${baseText}`, value: q.direction },
        { text: '不确定 / 中立', value: null },
        { text: `不太${baseText}`, value: opposite(q.direction) },
        { text: `完全不${baseText}`, value: opposite(q.direction) }
    ];

    const weights = [1, 0.5, 0, 0.5, 1];

    options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerHTML = `
            <span class="option-marker">${labels[idx]}</span>
            <span>${opt.text}</span>
        `;
        btn.dataset.value = opt.value || '';
        btn.dataset.weight = weights[idx];
        btn.addEventListener('click', () => selectOption(idx));

        // 重置动画 — 移除再添加以触发重播
        btn.style.animation = 'none';
        btn.offsetHeight; // 强制回流
        btn.style.animation = '';

        optionsContainer.appendChild(btn);
    });
}

// ============ 选择选项 ============
function selectOption(idx) {
    if (state.isTransitioning) return;
    state.isTransitioning = true;

    const btns = optionsContainer.querySelectorAll('.option-btn');
    btns.forEach(b => b.classList.remove('selected'));
    btns[idx].classList.add('selected');

    const q = state.shuffledQuestions[state.currentQuestion];
    const opt = btns[idx];
    const weight = parseFloat(opt.dataset.weight);

    // 如果是重新作答（回退或跳题后再次选择），先撤销旧分数
    const oldAnswer = state.questionAnswers[state.currentQuestion];
    if (oldAnswer && oldAnswer.dir) {
        state.answers[oldAnswer.dim][oldAnswer.dir] -= oldAnswer.weight;
    }

    // 存入新答案
    state.questionAnswers[state.currentQuestion] = {
        optionIdx: idx,
        dim: q.dimension,
        dir: opt.dataset.value || null,
        weight: weight
    };

    if (opt.dataset.value) {
        state.answers[q.dimension][opt.dataset.value] += weight;
    }

    setTimeout(() => {
        state.currentQuestion++;
        state.isTransitioning = false;
        if (state.currentQuestion >= state.shuffledQuestions.length) {
            showResult();
        } else {
            renderQuestion();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, 380);
}

// ============ 返回上一题 ============
function goBack() {
    if (state.isTransitioning || state.currentQuestion <= 0) return;
    state.isTransitioning = true;

    // 回退到上一题，保留旧答案以便恢复 UI，分数在重新作答时由 selectOption 替换
    state.currentQuestion--;

    setTimeout(() => {
        state.isTransitioning = false;
        renderQuestion();
    }, 100);
}

function restoreSelection() {
    const stored = state.questionAnswers[state.currentQuestion];
    if (!stored || stored.optionIdx === undefined) return;
    const btns = optionsContainer.querySelectorAll('.option-btn');
    if (btns[stored.optionIdx]) {
        btns.forEach(b => b.classList.remove('selected'));
        btns[stored.optionIdx].classList.add('selected');
    }
}

// ============ 显示结果 ============
function showResult() {
    testPage.classList.add('hidden');
    resultPage.classList.remove('hidden');

    const dims = ['EI', 'SN', 'TF', 'JP'];
    let typeStr = '';

    dims.forEach(dim => {
        const s = state.answers[dim];
        typeStr += s[dim[0]] >= s[dim[1]] ? dim[0] : dim[1];
    });

    state.result = typeStr;
    saveResult(typeStr);          // ← 保存到本地
    renderResult(typeStr);

    window.scrollTo({ top: 0 });
}

// ============ 渲染结果 ============
function renderResult(type) {
    const profile = typeProfiles[type];
    if (!profile) return;

    // ---- 类型字母 ----
    typeLetters.innerHTML = '';
    const letters = type.split('');
    letters.forEach((letter, i) => {
        const card = document.createElement('div');
        card.className = 'type-letter-card';
        card.textContent = letter;
        card.style.background = `linear-gradient(145deg, ${profile.color}, ${adjustColor(profile.color, -30)})`;
        typeLetters.appendChild(card);
    });

    // ---- 标题 ----
    $('result-title').textContent = profile.title;
    $('result-brief').textContent = profile.brief;

    // ---- 维度详情 ----
    const dimContainer = $('result-dimensions');
    dimContainer.innerHTML = '';

    const dimConfig = [
        { first: 'E', second: 'I', label: '外向', oppLabel: '内向', pair: 'EI' },
        { first: 'S', second: 'N', label: '实感', oppLabel: '直觉', pair: 'SN' },
        { first: 'T', second: 'F', label: '思考', oppLabel: '情感', pair: 'TF' },
        { first: 'J', second: 'P', label: '判断', oppLabel: '感知', pair: 'JP' }
    ];

    dimConfig.forEach(cfg => {
        const scores = state.answers[cfg.pair];
        const fScore = scores[cfg.first];
        const sScore = scores[cfg.second];
        const total = fScore + sScore || 1;
        const fPct = (fScore / total) * 100;
        const fActive = fScore >= sScore;

        const card = document.createElement('div');
        card.className = 'dim-result-card';
        card.innerHTML = `
            <div>
                <div class="dim-letter ${fActive ? 'active' : ''}">${cfg.first}</div>
                <div class="dim-label-text">${cfg.label}</div>
            </div>
            <div class="dim-bar-wrapper">
                <div class="dim-bar-fill" style="width: 0%"></div>
            </div>
            <div style="text-align:right">
                <div class="dim-letter opposite ${!fActive ? 'active' : ''}">${cfg.second}</div>
                <div class="dim-label-text">${cfg.oppLabel}</div>
            </div>
        `;
        dimContainer.appendChild(card);

        // 动画填充条
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const fill = card.querySelector('.dim-bar-fill');
                fill.style.width = `${fPct}%`;
            });
        });
    });

    // ---- 性格解读 ----
    const detailContent = $('detail-content');
    detailContent.innerHTML = profile.detail
        .split('\n\n')
        .map(p => p.trim() ? `<p>${p.replace(/\n/g, '<br>')}</p>` : '')
        .join('');

    // ---- 特质 ----
    const traitsContainer = $('result-traits');
    traitsContainer.innerHTML = '';
    profile.traits.forEach(trait => {
        const tag = document.createElement('div');
        tag.className = 'trait-tag';
        tag.textContent = trait;
        // 延迟入场
        tag.style.opacity = '0';
        traitsContainer.appendChild(tag);
        requestAnimationFrame(() => {
            tag.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            tag.style.opacity = '1';
        });
    });
}

// ============ 辅助函数 ============
function adjustColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, ((num >> 16) & 0xFF) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0xFF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0xFF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ============ 重新测试 ============
function resetTest() {
    resultPage.classList.add('hidden');
    welcomePage.classList.remove('hidden');
    window.scrollTo({ top: 0 });
}

// ============ 分享结果 ============
function shareResult() {
    const type = state.result;
    const profile = typeProfiles[type];
    if (!profile) return;

    const text = `我的 MBTI 类型是 ${type}「${profile.title}」— ${profile.brief}\n\n快来测试你的性格类型吧！`;

    if (navigator.share) {
        navigator.share({ title: 'MBTI 性格测试结果', text }).catch(() => {});
    } else {
        navigator.clipboard.writeText(text).then(() => {
            showToast('结果已复制到剪贴板，快去分享吧！');
        }).catch(() => {
            showToast('复制失败，请手动复制！');
        });
    }
}

// ============ 保存 / 读取结果 ============
const STORAGE_KEY = 'mbti_last_result';

function saveResult(type) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            type: type,
            scores: state.answers,
            timestamp: Date.now()
        }));
    } catch (e) { /* localStorage 不可用时静默失败 */ }
}

function loadSavedResult() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function formatDate(ts) {
    const d = new Date(ts);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function displaySavedResult() {
    const saved = loadSavedResult();
    const container = $('saved-result');
    if (!saved || !typeProfiles[saved.type]) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');

    const profile = typeProfiles[saved.type];
    const letters = saved.type.split('');

    const miniContainer = $('saved-type-mini');
    miniContainer.innerHTML = '';
    letters.forEach(letter => {
        const span = document.createElement('span');
        span.textContent = letter;
        span.style.background = profile.color;
        miniContainer.appendChild(span);
    });

    $('saved-title').textContent = profile.title;
    $('saved-date').textContent = formatDate(saved.timestamp);
}

function viewSavedResult() {
    const saved = loadSavedResult();
    if (!saved || !typeProfiles[saved.type]) return;

    state.result = saved.type;
    if (saved.scores) state.answers = saved.scores;

    welcomePage.classList.add('hidden');
    testPage.classList.add('hidden');
    resultPage.classList.remove('hidden');

    renderResult(saved.type);
    window.scrollTo({ top: 0 });
}

// ============ 答题卡 ============
function toggleAnswerSheet() {
    const opened = sheetOverlay.classList.toggle('hidden');
    if (!opened) renderAnswerSheet();
    document.body.style.overflow = opened ? '' : 'hidden';
}

function closeSheetOutside(e) {
    if (e.target === sheetOverlay) toggleAnswerSheet();
}

function renderAnswerSheet() {
    const total = state.shuffledQuestions.length;
    let answered = 0;
    let html = '';

    for (let i = 0; i < total; i++) {
        const hasAnswer = state.questionAnswers[i] && state.questionAnswers[i].optionIdx !== undefined;
        const isCurrent = i === state.currentQuestion;
        const isReached = i <= state.currentQuestion;
        let cls = 'sheet-cell';
        if (isCurrent) cls += ' current';
        else if (hasAnswer) cls += ' done';
        else if (!isReached) cls += ' dim';

        if (isReached) {
            html += `<button class="${cls}" onclick="jumpToQuestion(${i})">${i + 1}</button>`;
        } else {
            html += `<span class="${cls}">${i + 1}</span>`;
        }
        if (hasAnswer) answered++;
    }

    sheetGrid.innerHTML = html;
    sheetStat.textContent = `已答 ${answered} / ${total}`;
}

function jumpToQuestion(index) {
    if (state.isTransitioning || index === state.currentQuestion) {
        toggleAnswerSheet();
        return;
    }

    // 纯导航：不撤销任何已作答的分数，已答题目保持原样
    state.isTransitioning = true;
    state.currentQuestion = index;
    toggleAnswerSheet();
    document.body.style.overflow = '';

    setTimeout(() => {
        state.isTransitioning = false;
        renderQuestion();
    }, 150);
}

// ESC 关闭答题卡
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !sheetOverlay.classList.contains('hidden')) {
        toggleAnswerSheet();
    }
});

// ============ Toast ============
function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// 页面加载时显示保存的结果
displaySavedResult();
