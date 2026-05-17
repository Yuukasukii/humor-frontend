// ================== DOM 元素 ==================
const sendBtn = document.getElementById('send-btn');
const userInput = document.getElementById('user-input');
const chatContainer = document.getElementById('chat-messages');
const newChatBtn = document.getElementById('new-chat-btn');
const sessionList = document.getElementById('session-list');
const loadingIndicator = document.getElementById('loading-indicator');
const todayQuestionsSpan = document.getElementById('today-questions');
const searchInput = document.getElementById('search-session');

// ================== 数据结构 ==================
let sessions = [];
let currentSessionId = null;
let searchKeyword = '';
let sessionItemMap = new Map(); // 存储会话ID到DOM元素的映射，用于增量更新

// ================== 今日提问计数 ==================
function getTodayKey() {
    const today = new Date().toISOString().slice(0,10);
    return `today_questions_${today}`;
}
function updateTodayQuestionsCount(increment = false) {
    const key = getTodayKey();
    let count = parseInt(localStorage.getItem(key)) || 0;
    if (increment) {
        count++;
        localStorage.setItem(key, count);
    }
    if (todayQuestionsSpan) todayQuestionsSpan.innerText = count;
}
function resetTodayQuestionsIfNeeded() {
    const key = getTodayKey();
    const todayStr = new Date().toISOString().slice(0,10);
    const lastDate = localStorage.getItem('last_reset_date');
    if (lastDate !== todayStr) {
        localStorage.setItem(key, '0');
        localStorage.setItem('last_reset_date', todayStr);
    }
    updateTodayQuestionsCount(false);
}

// ================== 本地存储 ==================
const STORAGE_KEY = 'humor_sessions';
function saveSessionsToLocalStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessions, currentSessionId }));
}
function loadSessionsFromLocalStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const data = JSON.parse(saved);
            sessions = data.sessions || [];
            currentSessionId = data.currentSessionId || null;
            sessions.forEach(session => {
                if (!session.messages) session.messages = [];
                session.messages.forEach(msg => {
                    if (!msg.msgId) {
                        msg.msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
                    }
                });
                if (!session.createdAt) session.createdAt = 0;
            });
            sessions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            return true;
        } catch(e) { console.error(e); }
    }
    return false;
}

// ================== 工具函数 ==================
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : (m === '<' ? '&lt;' : '&gt;'));
}
function generateId() {
    return 'sid_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

// ================== 显示空状态 ==================
function showEmptyState() {
    const container = chatContainer.querySelector('.max-w-\\[1200px\\].mx-auto.space-y-12');
    if (!container) return;
    const hasMessages = Array.from(container.children).some(child => child.classList && child.classList.contains('chat-group'));
    if (!hasMessages && currentSessionId) {
        if (!container.querySelector('.empty-state')) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'empty-state flex flex-col items-center justify-center py-20 text-center';
            emptyDiv.innerHTML = `
                <iconify-icon icon="mdi:robot-happy" class="text-6xl text-slate-300 mb-4"></iconify-icon>
                <p class="text-slate-400 text-sm">暂无对话，输入一个问题开始吧～</p>
            `;
            container.appendChild(emptyDiv);
        }
    } else {
        const emptyState = container.querySelector('.empty-state');
        if (emptyState) emptyState.remove();
    }
}

// ================== 五角星评分组件（事件委托版本） ==================
function createStarRatingRow(dimension, msgId, initialValue = 5) {
    const row = document.createElement('div');
    row.className = 'flex items-center space-x-1 text-xs';
    
    const nameMap = { fun:'趣味', creativity:'创意', naturalness:'自然', relevance:'关联' };
    const nameSpan = document.createElement('span');
    nameSpan.className = 'text-slate-600 w-8';
    nameSpan.innerText = nameMap[dimension];
    
    const starsContainer = document.createElement('div');
    starsContainer.className = 'flex space-x-0.5';
    starsContainer.setAttribute('data-dimension', dimension);
    starsContainer.setAttribute('data-msgid', msgId);
    starsContainer.style.cursor = 'pointer';
    
    const tooltipBox = document.createElement('div');
    tooltipBox.className = 'text-[10px] text-slate-500 bg-slate-100 px-1 rounded';
    tooltipBox.innerText = '?';
    tooltipBox.style.cursor = 'help';
    
    const descriptions = {
        fun: ['差', '较差', '一般', '较好', '趣味性拉满'],
        creativity: ['差', '较差', '一般', '较好', '创意性爆表'],
        naturalness: ['差', '较差', '一般', '较好', '自然度完美'],
        relevance: ['差', '较差', '一般', '较好', '内容关联度MAX']
    };
    const descList = descriptions[dimension] || ['差','较差','一般','较好','完美'];
    let currentValue = initialValue;
    const stars = [];
    
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('iconify-icon');
        star.setAttribute('icon', 'mdi:star');
        star.setAttribute('width', '14');
        star.classList.add('star', i <= currentValue ? 'selected' : 'star-default');
        star.setAttribute('data-star-value', i);
        stars.push(star);
        starsContainer.appendChild(star);
    }
    
    // 使用事件委托处理鼠标悬停和点击
    starsContainer.addEventListener('mouseenter', (e) => {
        const star = e.target.closest('.star');
        if (!star) return;
        const idx = parseInt(star.getAttribute('data-star-value')) - 1;
        tooltipBox.innerText = descList[idx];
    }, true);
    starsContainer.addEventListener('mouseleave', () => {
        tooltipBox.innerText = '?';
    });
    starsContainer.addEventListener('click', (e) => {
        const star = e.target.closest('.star');
        if (!star) return;
        const idx = parseInt(star.getAttribute('data-star-value'));
        if (isNaN(idx)) return;
        star.classList.add('star-bounce');
        setTimeout(() => star.classList.remove('star-bounce'), 200);
        currentValue = idx;
        stars.forEach((s, i) => {
            if (i < idx) s.classList.add('selected');
            else s.classList.remove('selected');
        });
        row.setAttribute('data-value', currentValue);
    });
    
    row.appendChild(nameSpan);
    row.appendChild(starsContainer);
    row.appendChild(tooltipBox);
    row.setAttribute('data-dimension', dimension);
    row.setAttribute('data-msgid', msgId);
    row.setAttribute('data-value', currentValue);
    return row;
}

// ================== 模拟数据生成 ==================
function getMockResponse(question) {
    const q = question.toLowerCase();
    if (q.includes('天空') || q.includes('蓝色') || q.includes('天气')) {
        return {
            modelA: "天空是蓝色的因为空气里有蓝色颜料，而且天很高所以看起来远？",
            modelB: "哎呀，这位老兄又在胡扯了。实际上，瑞利散射导致短波蓝光更容易被大气散射，所以我们看到蔚蓝的天空。懂了吗？"
        };
    } else if (q.includes('量子') || q.includes('纠缠')) {
        return {
            modelA: "量子纠缠就是两个粒子互相打电话，一个说向左转，另一个就向右转。",
            modelB: "你这个解释太玄幻了！量子纠缠是量子态叠加，测量一个瞬间影响另一个，可不是打电话哦。简单说就是“鬼魅般的超距作用”。"
        };
    } else if (q.includes('学习效率') || q.includes('提高学习')) {
        return {
            modelA: "多喝咖啡，每天只睡4小时，就能提高学习效率。",
            modelB: "你这是要修仙吗？科学的方法是番茄工作法、间隔重复、保证睡眠。别拿健康开玩笑！"
        };
    } else if (q.includes('冷笑话') || q.includes('笑话')) {
        return {
            modelA: "为什么数学书总是很忧伤？因为它有太多问题。",
            modelB: "这个笑话还行，不过我给你来个更冷的：为什么程序员总是分不清万圣节和圣诞节？因为 Oct 31 = Dec 25。哈哈！"
        };
    } else {
        return {
            modelA: "这个问题嘛，我觉得答案是42。",
            modelB: "别信他的！这是《银河系漫游指南》的梗。你的问题需要具体分析，但当前我无法给出准确答案，请检查网络或稍后再试。"
        };
    }
}

// ================== 复制文本功能 ==================
async function copyToClipboard(text, btnElement) {
    try {
        await navigator.clipboard.writeText(text);
        const originalText = btnElement.innerHTML;
        btnElement.innerHTML = '<iconify-icon icon="mdi:check" class="text-sm"></iconify-icon>';
        setTimeout(() => {
            btnElement.innerHTML = originalText;
        }, 1500);
    } catch (err) {
        console.error('复制失败:', err);
        alert('复制失败，请手动复制');
    }
}

// ================== 添加消息到界面 ==================
function addMessageToChatDOM(question, modelA, modelB, timestamp, msgId) {
    const container = chatContainer.querySelector('.max-w-\\[1200px\\].mx-auto.space-y-12');
    if (!container) return;
    
    const emptyState = container.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    const groupDiv = document.createElement('div');
    groupDiv.className = 'chat-group space-y-6';
    
    // 用户气泡
    const userDiv = document.createElement('div');
    userDiv.className = 'flex justify-end items-start space-x-2';
    userDiv.innerHTML = `
        <div class="bg-white px-5 py-3 rounded-2xl rounded-tr-none shadow-sm max-w-xl border border-slate-200 user-bubble">
            <p class="text-slate-800">${escapeHtml(question)}</p>
            <span class="text-[10px] text-slate-400 mt-1 block text-right">${timestamp}</span>
        </div>
        <div class="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
            <iconify-icon icon="mdi:account" class="text-orange-500"></iconify-icon>
        </div>
    `;
    
    // 模型A区域
    const modelADiv = document.createElement('div');
    modelADiv.className = 'flex items-start space-x-2';
    modelADiv.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <iconify-icon icon="mdi:robot-dead" class="text-amber-500"></iconify-icon>
        </div>
        <div class="flex-1">
            <div class="flex items-center space-x-2 mb-1">
                <span class="text-sm font-semibold text-slate-700">模型A · 犯错者</span>
            </div>
            <div class="bg-white rounded-2xl shadow-md hover:shadow-lg transition-all card-hover border border-amber-200 p-5">
                <p class="text-slate-600 leading-relaxed">${escapeHtml(modelA)}</p>
                <div class="flex justify-end mt-3">
                    <button class="copy-answer-btn text-slate-400 hover:text-amber-600 text-xs flex items-center space-x-1 transition-colors" data-text="${escapeHtml(modelA)}">
                        <iconify-icon icon="mdi:content-copy"></iconify-icon>
                        <span>复制</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // 模型B区域
    const modelBDiv = document.createElement('div');
    modelBDiv.className = 'flex items-start space-x-2';
    const ratingContainerId = `rating-container-${msgId}`;
    modelBDiv.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <iconify-icon icon="mdi:microphone" class="text-indigo-500"></iconify-icon>
        </div>
        <div class="flex-1">
            <div class="flex items-center space-x-2 mb-1">
                <span class="text-sm font-semibold text-slate-700">模型B · 幽默纠错</span>
            </div>
            <div class="bg-gradient-to-br from-indigo-50 to-white rounded-2xl shadow-md hover:shadow-lg transition-all card-hover border border-indigo-200 p-4">
                <p class="text-indigo-800 leading-relaxed font-medium text-sm">
                    <iconify-icon icon="mdi:lightbulb-outline" class="inline mr-1 text-indigo-400" width="16"></iconify-icon>
                    ${escapeHtml(modelB)}
                </p>
                <div class="flex justify-end mt-2">
                    <button class="copy-answer-btn text-slate-400 hover:text-indigo-600 text-xs flex items-center space-x-1 transition-colors" data-text="${escapeHtml(modelB)}">
                        <iconify-icon icon="mdi:content-copy"></iconify-icon>
                        <span>复制</span>
                    </button>
                </div>
                <div id="${ratingContainerId}" class="rating-area hidden mt-2 pt-2 border-t border-indigo-100"></div>
                <div class="flex justify-start mt-2">
                    <button class="toggle-rating-btn text-indigo-500 hover:text-indigo-700 text-xs font-medium px-2 py-0.5 rounded-md bg-indigo-50 transition-colors" data-target="${ratingContainerId}">
                        展开评分 ▼
                    </button>
                </div>
            </div>
        </div>
    `;
    
    groupDiv.appendChild(userDiv);
    groupDiv.appendChild(modelADiv);
    groupDiv.appendChild(modelBDiv);
    container.appendChild(groupDiv);
    
    // 绑定复制按钮事件
    const copyBtns = groupDiv.querySelectorAll('.copy-answer-btn');
    copyBtns.forEach(btn => {
        const text = btn.getAttribute('data-text');
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(text, btn);
        });
    });
    
    // 滑入动画
    groupDiv.classList.add('message-enter');
    requestAnimationFrame(() => {
        groupDiv.classList.add('message-enter-active');
    });
    groupDiv.addEventListener('transitionend', () => {
        groupDiv.classList.remove('message-enter', 'message-enter-active');
    }, { once: true });
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // 生成评分内容
    const ratingContainer = document.getElementById(ratingContainerId);
    if (ratingContainer) {
        ratingContainer.innerHTML = '';
        const flexRow = document.createElement('div');
        flexRow.className = 'flex flex-wrap items-center gap-2 mb-2';
        const dimensions = ['fun', 'creativity', 'naturalness', 'relevance'];
        dimensions.forEach(dim => {
            const row = createStarRatingRow(dim, msgId, 5);
            flexRow.appendChild(row);
        });
        const submitBtn = document.createElement('button');
        submitBtn.className = 'submit-rating-btn text-xs bg-indigo-500 hover:bg-indigo-600 text-white px-2 py-1 rounded-md transition-colors';
        submitBtn.innerText = '提交';
        submitBtn.setAttribute('data-msgid', msgId);
        flexRow.appendChild(submitBtn);
        ratingContainer.appendChild(flexRow);
    }
    
    // 折叠按钮事件
    const toggleBtn = modelBDiv.querySelector('.toggle-rating-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetId = toggleBtn.getAttribute('data-target');
            const targetArea = document.getElementById(targetId);
            if (targetArea) {
                targetArea.classList.toggle('hidden');
                const isExpanded = !targetArea.classList.contains('hidden');
                toggleBtn.innerHTML = isExpanded ? '收起评分 ▲' : '展开评分 ▼';
            }
        });
    }
}

// ================== 构建单个会话条目 ==================
function buildSessionItem(session) {
    const div = document.createElement('div');
    const isCurrent = (session.id === currentSessionId);
    div.className = `session-item flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${isCurrent ? 'bg-slate-800' : 'hover:bg-slate-800'}`;
    const left = document.createElement('div');
    left.className = 'flex items-center space-x-3 flex-1 cursor-pointer';
    const titleSpan = document.createElement('span');
    titleSpan.className = `text-sm truncate ${isCurrent ? 'text-orange-400' : 'text-slate-300'}`;
    titleSpan.innerText = escapeHtml(session.title);
    titleSpan.title = session.title;
    // 双击重命名
    titleSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const newName = prompt('请输入新的会话名称:', session.title);
        if (newName && newName.trim() !== '') {
            session.title = newName.trim();
            saveSessionsToLocalStorage();
            // 更新当前会话的标题显示
            const targetSpan = sessionItemMap.get(session.id)?.querySelector('span:last-child');
            if (targetSpan) targetSpan.innerText = escapeHtml(session.title);
            // 如果当前会话被重命名且当前显示的是该会话，不需要刷新内容
        }
    });
    left.innerHTML = `<iconify-icon icon="mdi:chat" class="group-hover:text-orange-400 ${isCurrent ? 'text-orange-400' : 'text-slate-400'}"></iconify-icon>`;
    left.appendChild(titleSpan);
    left.addEventListener('click', (e) => {
        e.stopPropagation();
        switchSession(session.id);
    });
    const del = document.createElement('button');
    del.className = 'delete-session-btn text-slate-500 hover:text-red-500 transition-colors';
    del.innerHTML = '<iconify-icon icon="mdi:delete-outline"></iconify-icon>';
    del.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSession(session.id);
    });
    div.appendChild(left);
    div.appendChild(del);
    return div;
}

// ================== 增量渲染会话列表（修复颜色问题） ==================
function renderSessionListIncremental() {
    if (!sessionList) return;
    let filteredSessions = sessions;
    if (searchKeyword.trim() !== '') {
        const keyword = searchKeyword.toLowerCase();
        filteredSessions = sessions.filter(s => s.title.toLowerCase().includes(keyword));
    }
    // 获取当前列表中已有的会话ID
    const existingIds = new Set();
    sessionList.querySelectorAll('.session-item').forEach(item => {
        const id = item.getAttribute('data-session-id');
        if (id) existingIds.add(id);
    });
    // 移除不在 filteredSessions 中的项
    for (let item of sessionList.querySelectorAll('.session-item')) {
        const id = item.getAttribute('data-session-id');
        if (id && !filteredSessions.some(s => s.id === id)) {
            item.remove();
            sessionItemMap.delete(id);
        }
    }
    // 按顺序插入/更新
    filteredSessions.forEach((session, idx) => {
        let existingItem = sessionItemMap.get(session.id);
        const isCurrent = (session.id === currentSessionId);
        if (!existingItem) {
            existingItem = buildSessionItem(session);
            existingItem.setAttribute('data-session-id', session.id);
            sessionItemMap.set(session.id, existingItem);
            // 插入到正确位置
            const children = sessionList.children;
            if (idx === 0) {
                sessionList.prepend(existingItem);
            } else {
                const prevItem = sessionList.children[idx-1];
                if (prevItem) {
                    sessionList.insertBefore(existingItem, prevItem.nextSibling);
                } else {
                    sessionList.appendChild(existingItem);
                }
            }
        } else {
            // 更新背景色
            existingItem.classList.toggle('bg-slate-800', isCurrent);
            existingItem.classList.toggle('hover:bg-slate-800', !isCurrent);
            // 更新图标颜色
            const icon = existingItem.querySelector('iconify-icon');
            if (icon) {
                icon.classList.toggle('text-orange-400', isCurrent);
                icon.classList.toggle('text-slate-400', !isCurrent);
            }
            // 更新标题文字颜色
            const titleSpan = existingItem.querySelector('span:last-child');
            if (titleSpan) {
                titleSpan.classList.toggle('text-orange-400', isCurrent);
                titleSpan.classList.toggle('text-slate-300', !isCurrent);
                // 同时更新文本内容（如果标题变了）
                if (titleSpan.innerText !== escapeHtml(session.title)) {
                    titleSpan.innerText = escapeHtml(session.title);
                    titleSpan.title = session.title;
                }
            }
            // 重新排序：如果位置变了，需要移动DOM
            const currentIndex = Array.from(sessionList.children).indexOf(existingItem);
            if (currentIndex !== idx) {
                const targetNode = sessionList.children[idx];
                if (targetNode && targetNode !== existingItem) {
                    sessionList.insertBefore(existingItem, targetNode);
                } else if (!targetNode && idx === sessionList.children.length) {
                    sessionList.appendChild(existingItem);
                }
            }
        }
    });
}

// ================== 会话管理函数 ==================
function deleteSession(sessionId) {
    const idx = sessions.findIndex(s => s.id === sessionId);
    if (idx === -1) return;
    if (confirm(`删除会话“${sessions[idx].title}”?`)) {
        sessions.splice(idx, 1);
        // 移除DOM映射
        const item = sessionItemMap.get(sessionId);
        if (item) item.remove();
        sessionItemMap.delete(sessionId);
        saveSessionsToLocalStorage();
        if (sessions.length === 0) {
            createNewSession();
        } else {
            if (currentSessionId === sessionId) {
                currentSessionId = sessions[0].id;
                renderCurrentSession();
            }
            renderSessionListIncremental();
        }
    }
}

function switchSession(sessionId) {
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return;
    if (currentSessionId === sessionId) return;
    chatContainer.classList.add('fade-out');
    setTimeout(() => {
        currentSessionId = sessionId;
        renderCurrentSession();
        renderSessionListIncremental();
        saveSessionsToLocalStorage();
        chatContainer.classList.remove('fade-out');
    }, 200);
}

function createNewSession() {
    const empty = sessions.find(s => s.messages.length === 0 && s.title === '新对话');
    if (empty) { switchSession(empty.id); return; }
    const newId = generateId();
    const now = Date.now();
    const newSession = { 
        id: newId, 
        title: '新对话', 
        messages: [],
        createdAt: now
    };
    sessions.unshift(newSession);
    saveSessionsToLocalStorage();
    renderSessionListIncremental();
    switchSession(newId);
}

// ================== 会话渲染 ==================
function renderCurrentSession() {
    if (!currentSessionId) return;
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return;
    chatContainer.innerHTML = `
        <div class="max-w-[1200px] mx-auto space-y-12">
            <div class="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex items-start space-x-4">
                <div class="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shrink-0">
                    <iconify-icon class="text-2xl text-white" icon="mdi:lightbulb-on"></iconify-icon>
                </div>
                <div>
                    <h3 class="font-bold text-blue-900">使用指南</h3>
                    <p class="text-sm text-blue-700 font-medium leading-relaxed opacity-80 mt-1">
                        这是一个致力于让知识变得"易懂"的实验室。模型A会一本正经"胡说八道"，模型B负责用幽默感"拯救世界"。输入任何常识尝试一下！
                    </p>
                </div>
            </div>
        </div>
    `;
    session.messages.forEach(msg => {
        addMessageToChatDOM(msg.question, msg.modelA, msg.modelB, msg.timestamp, msg.msgId);
    });
    showEmptyState();
    chatContainer.scrollTop = 0;
}

// ================== 发送消息 ==================
async function sendQuestion() {
    let question = userInput.value.trim();
    if (!question) return;
    if (!currentSessionId) createNewSession();
    const currentSession = sessions.find(s => s.id === currentSessionId);
    if (!currentSession) return;

    if (loadingIndicator) loadingIndicator.classList.remove('hidden');
    sendBtn.disabled = true;
    sendBtn.style.opacity = '0.6';

    try {
        const response = await fetch('/api/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question })
        });
        if (!response.ok) throw new Error();
        const data = await response.json();
        const timestamp = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
        const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
        const newMsg = { msgId, question, modelA: data.modelA_answer, modelB: data.modelB_answer, timestamp };
        currentSession.messages.push(newMsg);
        currentSession.createdAt = Date.now();
        const index = sessions.findIndex(s => s.id === currentSession.id);
        if (index !== -1) {
            sessions.splice(index, 1);
            sessions.unshift(currentSession);
        }
        if (currentSession.title === '新对话' && currentSession.messages.length === 1) {
            currentSession.title = question.length > 20 ? question.slice(0,20)+'...' : question;
        }
        renderSessionListIncremental();
        addMessageToChatDOM(question, data.modelA_answer, data.modelB_answer, timestamp, msgId);
        userInput.value = '';
        userInput.style.height = 'auto';
        saveSessionsToLocalStorage();
        updateTodayQuestionsCount(true);
    } catch (error) {
        console.error(error);
        alert('请求失败，使用模拟数据');
        const timestamp = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
        const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2,6)}`;
        const mock = getMockResponse(question);
        const newMsg = {
            msgId, question,
            modelA: mock.modelA,
            modelB: mock.modelB,
            timestamp
        };
        currentSession.messages.push(newMsg);
        currentSession.createdAt = Date.now();
        const index = sessions.findIndex(s => s.id === currentSession.id);
        if (index !== -1) {
            sessions.splice(index, 1);
            sessions.unshift(currentSession);
        }
        if (currentSession.title === '新对话' && currentSession.messages.length === 1) {
            currentSession.title = question.length > 20 ? question.slice(0,20)+'...' : question;
        }
        renderSessionListIncremental();
        addMessageToChatDOM(question, mock.modelA, mock.modelB, timestamp, msgId);
        userInput.value = '';
        userInput.style.height = 'auto';
        saveSessionsToLocalStorage();
        updateTodayQuestionsCount(true);
    } finally {
        if (loadingIndicator) loadingIndicator.classList.add('hidden');
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
    }
}

// ================== 评分提交 ==================
chatContainer.addEventListener('click', async (e) => {
    const btn = e.target.closest('.submit-rating-btn');
    if (!btn) return;
    const msgId = btn.getAttribute('data-msgid');
    if (!msgId) return;

    let targetMsg = null, targetSessionId = null;
    for (const session of sessions) {
        const msg = session.messages.find(m => m.msgId === msgId);
        if (msg) { targetMsg = msg; targetSessionId = session.id; break; }
    }
    if (!targetMsg) { alert('未找到消息'); return; }

    const container = btn.closest('.flex-1');
    const ratingRows = container.querySelectorAll('[data-dimension]');
    const scores = {};
    ratingRows.forEach(row => {
        const dim = row.getAttribute('data-dimension');
        scores[dim] = parseInt(row.getAttribute('data-value')) || 5;
    });

    const ratingData = {
        msg_id: msgId, session_id: targetSessionId,
        question: targetMsg.question, error_answer: targetMsg.modelA,
        humor_text: targetMsg.modelB, timestamp: targetMsg.timestamp,
        fun: scores.fun, creativity: scores.creativity,
        naturalness: scores.naturalness, relevance: scores.relevance
    };

    try {
        const response = await fetch('/api/score', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ratingData)
        });
        if (response.ok) {
            alert('评分已提交！');
            btn.disabled = true;
            btn.innerText = '已评分';
            btn.classList.remove('bg-indigo-500', 'hover:bg-indigo-600');
            btn.classList.add('bg-slate-400', 'cursor-not-allowed');
        } else alert('提交失败');
    } catch (err) {
        console.error(err);
        alert('网络错误');
    }
});

// ================== 快捷问题 ==================
function setupQuickQuestions() {
    const btns = document.querySelectorAll('.quick-question-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            const question = btn.getAttribute('data-question');
            if (question) userInput.value = question;
            userInput.dispatchEvent(new Event('input'));
        });
    });
}

// ================== 输入框高度自适应 ==================
function autoResizeTextarea() {
    if (!userInput) return;
    userInput.style.height = 'auto';
    const newHeight = Math.min(userInput.scrollHeight, 160);
    userInput.style.height = newHeight + 'px';
}

// ================== 搜索框防抖 ==================
let searchDebounceTimer = null;
function handleSearchInput(e) {
    if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
        searchKeyword = e.target.value;
        renderSessionListIncremental();
    }, 300);
}

// ================== 初始化 ==================
function init() {
    resetTodayQuestionsIfNeeded();
    const hasSaved = loadSessionsFromLocalStorage();
    if (!hasSaved || sessions.length === 0) createNewSession();
    else {
        renderSessionListIncremental();
        renderCurrentSession();
        if (!sessions.find(s => s.id === currentSessionId) && sessions.length) {
            currentSessionId = sessions[0].id;
            renderCurrentSession();
            renderSessionListIncremental();
        }
    }
    sendBtn.addEventListener('click', sendQuestion);
    userInput.addEventListener('keypress', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuestion(); } });
    userInput.addEventListener('input', autoResizeTextarea);
    newChatBtn.addEventListener('click', createNewSession);
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('zh-CN');
    setupQuickQuestions();
    
    sendBtn.classList.add('send-btn-ripple');
    sendBtn.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        ripple.classList.add('ripple');
        const rect = sendBtn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${e.clientX - rect.left - size/2}px`;
        ripple.style.top = `${e.clientY - rect.top - size/2}px`;
        sendBtn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    });
    
    document.body.classList.add('loaded');
    
    // 表情面板功能
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiPicker = document.getElementById('emoji-picker');
    if (emojiBtn && emojiPicker) {
        emojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            emojiPicker.classList.toggle('hidden');
        });
        document.addEventListener('click', (e) => {
            if (emojiPicker && !emojiPicker.contains(e.target) && e.target !== emojiBtn) {
                emojiPicker.classList.add('hidden');
            }
        });
        const emojis = emojiPicker.querySelectorAll('span');
        emojis.forEach(emojiSpan => {
            emojiSpan.addEventListener('click', (e) => {
                e.stopPropagation();
                const emoji = emojiSpan.innerText;
                const input = userInput;
                const start = input.selectionStart;
                const end = input.selectionEnd;
                const text = input.value;
                const newText = text.substring(0, start) + emoji + text.substring(end);
                input.value = newText;
                input.selectionStart = input.selectionEnd = start + emoji.length;
                input.focus();
                autoResizeTextarea();
                emojiPicker.classList.add('hidden');
            });
        });
    }
    
    // 搜索框防抖绑定
    if (searchInput) {
        searchInput.addEventListener('input', handleSearchInput);
    }
    
    const topBtn = document.getElementById('scroll-to-top');
    const bottomBtn = document.getElementById('scroll-to-bottom');
    const update = () => {
        if (!chatContainer) return;
        const st = chatContainer.scrollTop, sh = chatContainer.scrollHeight, ch = chatContainer.clientHeight;
        topBtn.classList.toggle('opacity-0', st <= 200);
        topBtn.classList.toggle('opacity-100', st > 200);
        bottomBtn.classList.toggle('opacity-0', sh - st - ch <= 200);
        bottomBtn.classList.toggle('opacity-100', sh - st - ch > 200);
    };
    chatContainer.addEventListener('scroll', update);
    update();
    topBtn.addEventListener('click', () => chatContainer.scrollTo({ top:0, behavior:'smooth' }));
    bottomBtn.addEventListener('click', () => chatContainer.scrollTo({ top:chatContainer.scrollHeight, behavior:'smooth' }));

    // 移动端侧边栏开关
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('-translate-x-full');
        });
    // 点击聊天区域时自动关闭侧边栏（移动端友好）
        chatContainer.addEventListener('click', () => {
            if (window.innerWidth < 768 && !sidebar.classList.contains('-translate-x-full')) {
                sidebar.classList.add('-translate-x-full');
            }
        });
    }
    // 窗口大小变化时，恢复侧边栏状态
    window.addEventListener('resize', () => {
        if (window.innerWidth >= 768) {
            sidebar.classList.remove('-translate-x-full');
        } else {
            sidebar.classList.add('-translate-x-full');
        }
    });
}
init();