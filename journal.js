// --- 回忆日记功能 (js/modules/journal.js) ---

let generatingChatId = null;

function setupMemoryJournalScreen() {
    const generateNewJournalBtn = document.getElementById('generate-new-journal-btn');
    const generateJournalModal = document.getElementById('generate-journal-modal');
    const generateJournalForm = document.getElementById('generate-journal-form');
    const journalListContainer = document.getElementById('journal-list-container');
    const editDetailBtn = document.getElementById('edit-journal-detail-btn');
    const bindWorldBookBtn = document.getElementById('bind-journal-worldbook-btn');
    const journalWorldBookModal = document.getElementById('journal-worldbook-selection-modal');
    const journalWorldBookList = document.getElementById('journal-worldbook-selection-list');
    const saveJournalWorldBookBtn = document.getElementById('save-journal-worldbook-selection-btn');

    bindWorldBookBtn.addEventListener('click', () => {
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        if (!chat) return;
        renderCategorizedWorldBookList(journalWorldBookList, db.worldBooks, chat.journalWorldBookIds || [], 'journal-wb-select');
        journalWorldBookModal.classList.add('visible');
    });

    saveJournalWorldBookBtn.addEventListener('click', async () => {
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        if (!chat) return;

        const selectedIds = Array.from(journalWorldBookList.querySelectorAll('.item-checkbox:checked')).map(input => input.value);
        chat.journalWorldBookIds = selectedIds;
        await saveData();
        journalWorldBookModal.classList.remove('visible');
        showToast('日记绑定的世界书已更新');
    });

    generateNewJournalBtn.addEventListener('click', () => {
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        const totalMessages = chat ? chat.history.length : 0;
        
        const rangeInfo = document.getElementById('journal-range-info');
        rangeInfo.textContent = `当前聊天总消息数: ${totalMessages}`;

        const modalTitle = document.querySelector('#generate-journal-modal h3');
        if (modalTitle) {
            modalTitle.textContent = (currentChatType === 'group') ? '生成群聊总结' : '指定总结范围';
        }

        generateJournalForm.reset();
        generateJournalModal.classList.add('visible');
    });

    generateJournalForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const startInput = document.getElementById('journal-range-start');
        const endInput = document.getElementById('journal-range-end');

        const start = parseInt(startInput.value);
        const end = parseInt(endInput.value);
        
        if (isNaN(start) || isNaN(end) || start <= 0 || end < start) {
            showToast('请输入有效的起止范围');
            return;
        }

        generateJournalModal.classList.remove('visible');
        await generateJournal(start, end);
    });

    journalListContainer.addEventListener('click', async (e) => {
        const target = e.target;
        const card = target.closest('.journal-card');
        if (!card) return;

        const journalId = card.dataset.id;
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        if (!chat) return;
        const journal = chat.memoryJournals.find(j => j.id === journalId);
        if (!journal) return;

        if (target.closest('.delete-journal-btn')) {
            if (confirm('确定要删除这篇日记吗？')) {
                chat.memoryJournals = chat.memoryJournals.filter(j => j.id !== journalId);
                await saveData();
                renderJournalList();
                showToast('日记已删除');
            }
            return;
        }

        if (target.closest('.favorite-journal-btn')) {
            journal.isFavorited = !journal.isFavorited;
            await saveData();
            target.closest('.favorite-journal-btn').classList.toggle('favorited', journal.isFavorited);
            showToast(journal.isFavorited ? '已收藏' : '已取消收藏');
            return;
        }
        
        const date = new Date(journal.createdAt);
        const formattedDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        
        currentJournalDetailId = journal.id;

        const titleEl = document.getElementById('journal-detail-title');
        const contentEl = document.getElementById('journal-detail-content');

        titleEl.isContentEditable = false;
        contentEl.isContentEditable = false;
        titleEl.style.border = 'none';
        contentEl.style.border = 'none';
        titleEl.style.padding = '0';
        contentEl.style.padding = '0';
        editDetailBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.13,5.12L18.88,8.87M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25Z" /></svg>`;

        titleEl.textContent = journal.title;
        document.getElementById('journal-detail-meta').textContent = `创建于 ${formattedDate} | 消息范围: ${journal.range.start}-${journal.range.end}`;
        document.getElementById('journal-detail-content').textContent = journal.content;
        
        switchScreen('memory-journal-detail-screen');
    });

    editDetailBtn.addEventListener('click', async () => {
        if (!currentJournalDetailId) return;

        const titleEl = document.getElementById('journal-detail-title');
        const contentEl = document.getElementById('journal-detail-content');
        const isEditing = titleEl.isContentEditable;

        if (isEditing) {
            const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
            if (!chat) return;
            const journal = chat.memoryJournals.find(j => j.id === currentJournalDetailId);
            if (!journal) return;

            journal.title = titleEl.textContent.trim();
            journal.content = contentEl.textContent.trim();
            await saveData();

            titleEl.isContentEditable = false;
            contentEl.isContentEditable = false;
            titleEl.style.border = 'none';
            contentEl.style.border = 'none';
            titleEl.style.padding = '0';
            contentEl.style.padding = '0';
            editDetailBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.13,5.12L18.88,8.87M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25Z" /></svg>`;
            showToast('日记已保存');
            renderJournalList(); 
        } else {
            titleEl.setAttribute('contenteditable', 'true');
            contentEl.setAttribute('contenteditable', 'true');
            titleEl.style.border = '1px dashed #ccc';
            titleEl.style.padding = '5px';
            contentEl.style.border = '1px dashed #ccc';
            contentEl.style.padding = '10px';
            editDetailBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9,16.17L4.83,12L3.41,13.41L9,19L21,7L19.59,5.59L9,16.17Z" /></svg>`; 
            titleEl.focus();
        }
    });
}

function renderJournalList() {
    const container = document.getElementById('journal-list-container');
    const placeholder = document.getElementById('no-journals-placeholder');
    container.innerHTML = '';

    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    const journals = chat ? chat.memoryJournals : [];

    // 更新标题和按钮显示
    const bindBtn = document.getElementById('bind-journal-worldbook-btn');
    const title = document.querySelector('#memory-journal-screen .title');
    
    if (currentChatType === 'group') {
        if (bindBtn) bindBtn.style.display = 'none';
        if (title) title.textContent = '智能总结';
        if (placeholder) {
            placeholder.innerHTML = '<p>还没有总结哦~</p><p>点击右上角的“+号”来生成第一篇吧！</p>';
        }
    } else {
        if (bindBtn) bindBtn.style.display = 'flex';
        if (title) title.textContent = '回忆日记';
        if (placeholder) {
            placeholder.innerHTML = '<p>还没有日记哦~</p><p>点击右上角的“+号”来创建第一篇吧！</p>';
        }
    }

    let isShowingLoading = false;
    // 恢复生成状态卡片
    if (typeof isGenerating !== 'undefined' && isGenerating && generatingChatId === currentChatId) {
        const loadingCard = document.createElement('li');
        loadingCard.className = 'journal-card generating';
        loadingCard.id = 'journal-generating-card';
        loadingCard.innerHTML = `
            <div class="spinner"></div>
            <div class="text">正在${currentChatType === 'group' ? '总结群聊' : '编织回忆'}...</div>
        `;
        container.appendChild(loadingCard);
        isShowingLoading = true;
    }

    if ((!journals || journals.length === 0) && !isShowingLoading) {
        if (placeholder) placeholder.style.display = 'block';
        return;
    }

    if (placeholder) placeholder.style.display = 'none';

    const sortedJournals = [...journals].sort((a, b) => a.createdAt - b.createdAt);

    sortedJournals.forEach(journal => {
        const card = document.createElement('li');
        card.className = 'journal-card';
        card.dataset.id = journal.id;

        const date = new Date(journal.createdAt);
        const formattedDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

        card.innerHTML = `
            <div class="journal-card-header">
                <div class="journal-card-title">${journal.title}</div>
            </div>
            <div class="journal-card-actions">
                <button class="action-icon-btn favorite-journal-btn" title="收藏">
                    <svg viewBox="0 0 24 24">
                        <path class="star-outline" d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" fill="currentColor"/>
                        <path class="star-solid" d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z"/>
                    </svg>
                </button>
                <button class="action-icon-btn delete-journal-btn" title="删除">
                    <svg viewBox="0 0 24 24"><path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" /></svg>
                </button>
            </div>
            <div class="journal-card-footer" style="justify-content: space-between; height: auto; opacity: 1; margin-top: 10px;">
                <span class="journal-card-date">${formattedDate}</span>
                <span class="journal-card-range">范围: ${journal.range.start}-${journal.range.end}</span>
            </div>
        `;

        if (journal.isFavorited) {
            card.querySelector('.favorite-journal-btn').classList.add('favorited');
        }

        container.appendChild(card);
    });
}

async function generateJournal(start, end) {
    showToast('正在生成日记，请稍候...');
    
    // 显示列表占位卡片
    const container = document.getElementById('journal-list-container');
    const placeholder = document.getElementById('no-journals-placeholder');
    if (placeholder) placeholder.style.display = 'none';

    const loadingCard = document.createElement('li');
    loadingCard.className = 'journal-card generating';
    loadingCard.id = 'journal-generating-card';
    loadingCard.innerHTML = `
        <div class="spinner"></div>
        <div class="text">正在${currentChatType === 'group' ? '总结群聊' : '编织回忆'}...</div>
    `;
    
    if (container.firstChild) {
        container.insertBefore(loadingCard, container.firstChild);
    } else {
        container.appendChild(loadingCard);
    }
    container.scrollTop = 0;

    isGenerating = true; 
    generatingChatId = currentChatId;

    try {
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        if (!chat) {
            throw new Error("未找到当前聊天。");
        }

        const startIndex = start - 1;
        const endIndex = end;
        
        if (startIndex < 0 || endIndex > chat.history.length || startIndex >= endIndex) {
            throw new Error("无效的消息范围。");
        }

        const messagesToSummarize = chat.history.slice(startIndex, endIndex);
        
        let worldBooksContent = '';
        let summaryPrompt = '';

        if (currentChatType === 'group') {
            // 群聊逻辑
            const groupWorldBooks = (chat.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id)).filter(Boolean);
            worldBooksContent = groupWorldBooks.map(wb => wb.content).join('\n\n');

            summaryPrompt = `你是一个群聊记录总结助手。请以完全客观的第三视角，对以下群聊记录进行精简总结。\n\n`;

            // 注入群聊基础信息
            summaryPrompt += `群聊名称: ${chat.name}\n`;
            summaryPrompt += `群成员列表: ${chat.members.map(m => `${m.groupNickname}(${m.realName})`).join(', ')}\n\n`;

            // 注入群聊关联的世界书
            if (worldBooksContent) {
                summaryPrompt += `背景设定参考:\n${worldBooksContent}\n\n`;
            }

            summaryPrompt += `总结要求：\n`;
            summaryPrompt += `1. **客观中立**：使用第三人称视角，不带个人情感色彩，不使用强烈的情绪词汇。\n`;
            summaryPrompt += `2. **精简准确**：只陈述事实，概括主要话题和事件，去除无关的闲聊细节。\n`;
            summaryPrompt += `3. **无升华**：不要进行价值升华、感悟或总结性评价，仅记录发生了什么。\n\n`;

            summaryPrompt += `你的输出必须是一个JSON对象，包含以下两个字段：\n`;
            summaryPrompt += `- 'title': 格式为“日期·核心事件”，例如“1月20日·讨论周末计划”。\n`;
            summaryPrompt += `- 'content': 总结正文。分条列出主要讨论点或事件。\n\n`;

            summaryPrompt += `Strictly output in JSON format only. Do not speak outside the JSON object.\n\n`;
            summaryPrompt += `聊天记录如下：\n\n---\n${messagesToSummarize.map(m => m.content).join('\n')}\n---`;

        } else {
            // 私聊逻辑 (保持原样)
            const journalWorldBooks = (chat.journalWorldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id)).filter(Boolean);
            worldBooksContent = journalWorldBooks.map(wb => wb.content).join('\n\n');

            summaryPrompt = `你是一个日记整理助手。请以角色 "${chat.remarkName || chat.name}" 的第一人称视角，总结以下聊天记录。请专注于重要的情绪、事件和细节。\n\n`;
            summaryPrompt += "为了更好地理解角色和背景，请参考以下信息：\n";
            summaryPrompt += "=====\n";

            if (worldBooksContent) {
                summaryPrompt += `世界观设定:\n${worldBooksContent}\n\n`;
            }

            summaryPrompt += `你的角色设定:\n- 角色名: ${chat.realName}\n- 人设: ${chat.persona || "一个友好、乐于助人的伙伴。"}\n\n`;
            summaryPrompt += `我的角色设定:\n- 我的称呼: ${chat.myName}\n- 我的人设: ${chat.myPersona || "无特定人设。"}\n\n`;
            summaryPrompt += "=====\n";
            summaryPrompt += `请基于以上所有背景信息，总结以下聊天记录。你的输出必须是一个JSON对象，包含 'title' (年月日·一个简洁的标题) 和 'content' (完整的日记正文) 两个字段，​Strictly output in JSON format only. Do not speak outside the JSON object.聊天记录如下：\n\n---\n${messagesToSummarize.map(m => m.content).join('\n')}\n---`;
        }

        let { url, key, model, provider } = db.apiSettings;
        if (!url || !key || !model) {
            throw new Error("API设置不完整。");
        }

        if (url.endsWith('/')) {
            url = url.slice(0, -1);
        }

        const requestBody = {
            model: model,
            messages: [{ role: 'user', content: summaryPrompt }],
            temperature: 0.7,
            response_format: { type: "json_object" }, 
        };
        const endpoint = `${url}/v1/chat/completions`;
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };

        const response = await fetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(requestBody) });
        if (!response.ok) {
            const error = new Error(`API 错误: ${response.status} ${await response.text()}`);
            error.response = response;
            throw error;
        }

        let result;
        try {
            result = await response.json();
        } catch (e) {
            const text = await response.text();
            console.error("Failed to parse JSON:", text);
            throw new Error(`API返回了非JSON格式数据 (可能是网页HTML)。请检查API地址是否正确。原始内容开头: ${text.substring(0, 50)}...`);
        }

        const rawContent = result.choices[0].message.content;

        let cleanContent = rawContent.trim();
        cleanContent = cleanContent.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
        cleanContent = cleanContent.trim();

        const journalData = JSON.parse(cleanContent);

        const newJournal = {
            id: `journal_${Date.now()}`,
            range: { start, end },
            title: journalData.title || "无标题日记",
            content: journalData.content || "内容为空。",
            createdAt: Date.now(),
            chatId: currentChatId,
            chatType: currentChatType,
            isFavorited: false 
        };

        if (!chat.memoryJournals) {
            chat.memoryJournals = [];
        }
        chat.memoryJournals.push(newJournal);
        await saveData();

        renderJournalList();
        showToast('新日记已生成！');

    } catch (error) {
        // 移除生成卡片
        const card = document.getElementById('journal-generating-card');
        if(card) card.remove();
        
        // 如果列表为空，恢复显示 placeholder
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        if (!chat || !chat.memoryJournals || chat.memoryJournals.length === 0) {
             const placeholder = document.getElementById('no-journals-placeholder');
             if (placeholder) placeholder.style.display = 'block';
        }

        showApiError(error);
    } finally {
        isGenerating = false; 
        generatingChatId = null;
    }
}
