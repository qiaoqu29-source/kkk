// --- 核心聊天逻辑 (js/chat.js) ---

// 聊天列表屏幕逻辑
function setupChatListScreen() {
    renderChatList();
    
    // 绑定旧按钮事件 (如果存在)
    const addChatBtn = document.getElementById('add-chat-btn');
    if(addChatBtn) {
        addChatBtn.addEventListener('click', () => {
            const addCharModal = document.getElementById('add-char-modal');
            const addCharForm = document.getElementById('add-char-form');
            addCharModal.classList.add('visible');
            addCharForm.reset();
        });
    }

    // 绑定 KKT 风格 Header 新按钮
    const addChatBtnKkt = document.getElementById('add-chat-btn-kkt');
    if (addChatBtnKkt) {
        addChatBtnKkt.addEventListener('click', () => {
            const addCharModal = document.getElementById('add-char-modal');
            const addCharForm = document.getElementById('add-char-form');
            addCharModal.classList.add('visible');
            addCharForm.reset();
        });
    }

    const createGroupBtnKkt = document.getElementById('create-group-btn-kkt');
    if (createGroupBtnKkt) {
        createGroupBtnKkt.addEventListener('click', () => {
            renderMemberSelectionList();
            document.getElementById('create-group-modal').classList.add('visible');
        });
    }

    const importBtnKkt = document.getElementById('import-btn-kkt');
    const cardInput = document.getElementById('character-card-input');
    if (importBtnKkt) {
        importBtnKkt.addEventListener('click', () => {
            cardInput.click();
        });
    }
    
    cardInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleCharacterImport(file);
        }
        e.target.value = null;
    });

    const chatListContainer = document.getElementById('chat-list-container');
    chatListContainer.addEventListener('click', (e) => {
        const chatItem = e.target.closest('.chat-item');
        if (chatItem) {
            currentChatId = chatItem.dataset.id;
            currentChatType = chatItem.dataset.type;

            const chat = (currentChatType === 'private') 
                ? db.characters.find(c => c.id === currentChatId) 
                : db.groups.find(g => g.id === currentChatId);
            
            if (chat) {
                updateCustomBubbleStyle(currentChatId, chat.customBubbleCss, chat.useCustomBubbleCss);
            }

            openChatRoom(currentChatId, currentChatType);
        }
    });

    chatListContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const chatItem = e.target.closest('.chat-item');
        if (!chatItem) return;
        handleChatListLongPress(chatItem.dataset.id, chatItem.dataset.type, e.clientX, e.clientY);
    });
    chatListContainer.addEventListener('touchstart', (e) => {
        const chatItem = e.target.closest('.chat-item');
        if (!chatItem) return;
        longPressTimer = setTimeout(() => {
            const touch = e.touches[0];
            handleChatListLongPress(chatItem.dataset.id, chatItem.dataset.type, touch.clientX, touch.clientY);
        }, 400);
    });
    chatListContainer.addEventListener('touchend', () => clearTimeout(longPressTimer));
    chatListContainer.addEventListener('touchmove', () => clearTimeout(longPressTimer));
    
    setupFolderManagement();
}

// 文件夹管理
function setupFolderManagement() {
    const folderModal = document.getElementById('folder-manage-modal');
    const folderNameInput = document.getElementById('folder-name-input');
    const confirmBtn = document.getElementById('folder-confirm-btn');
    const deleteBtn = document.getElementById('folder-delete-btn');
    const cancelBtn = document.getElementById('folder-cancel-btn');

    window.openCreateFolderModal = () => {
        currentFolderActionTarget = null; 
        document.getElementById('folder-modal-title').textContent = '新建文件夹';
        folderNameInput.value = '';
        deleteBtn.style.display = 'none';
        folderModal.classList.add('visible');
    };

    window.openEditFolderModal = (folderId) => {
        const folder = db.chatFolders.find(f => f.id === folderId);
        if (!folder) return;
        
        currentFolderActionTarget = folderId; 
        document.getElementById('folder-modal-title').textContent = '管理文件夹';
        folderNameInput.value = folder.name;
        deleteBtn.style.display = 'block';
        folderModal.classList.add('visible');
    };

    confirmBtn.addEventListener('click', async () => {
        const name = folderNameInput.value.trim();
        if (!name) return showToast('请输入文件夹名称');

        if (currentFolderActionTarget) {
            const folder = db.chatFolders.find(f => f.id === currentFolderActionTarget);
            if (folder) folder.name = name;
            showToast('文件夹已更新');
        } else {
            const newFolder = {
                id: `folder_${Date.now()}`,
                name: name
            };
            if (!db.chatFolders) db.chatFolders = [];
            db.chatFolders.push(newFolder);
            showToast('文件夹已创建');
        }
        
        await saveData();
        renderChatFolders();
        folderModal.classList.remove('visible');
    });

    deleteBtn.addEventListener('click', async () => {
        if (!currentFolderActionTarget) return;
        if (confirm('确定删除此文件夹吗？其中的聊天不会被删除，将归入"全部"列表。')) {
            db.chatFolders = db.chatFolders.filter(f => f.id !== currentFolderActionTarget);
            
            db.characters.forEach(c => { if (c.folderId === currentFolderActionTarget) delete c.folderId; });
            db.groups.forEach(g => { if (g.folderId === currentFolderActionTarget) delete g.folderId; });
            
            if (currentFolderId === currentFolderActionTarget) {
                currentFolderId = 'all';
            }

            await saveData();
            renderChatFolders();
            renderChatList(); 
            folderModal.classList.remove('visible');
            showToast('文件夹已删除');
        }
    });

    cancelBtn.addEventListener('click', () => folderModal.classList.remove('visible'));

    const moveFolderModal = document.getElementById('move-to-folder-modal');
    const folderSelectionList = document.getElementById('folder-selection-list');
    const closeMoveModalBtn = document.getElementById('close-move-folder-modal');
    let chatToMove = null;

    window.openMoveToFolderModal = (chatId, chatType) => {
        chatToMove = { id: chatId, type: chatType };
        folderSelectionList.innerHTML = '';
        
        const removeLi = document.createElement('li');
        removeLi.className = 'list-item';
        removeLi.textContent = '❌ 移出文件夹 (归入全部)';
        removeLi.onclick = async () => {
            await moveChatToFolder(null);
            moveFolderModal.classList.remove('visible');
        };
        folderSelectionList.appendChild(removeLi);

        if (db.chatFolders && db.chatFolders.length > 0) {
            db.chatFolders.forEach(folder => {
                const li = document.createElement('li');
                li.className = 'list-item';
                li.textContent = `📁 ${folder.name}`;
                li.onclick = async () => {
                    await moveChatToFolder(folder.id);
                    moveFolderModal.classList.remove('visible');
                };
                folderSelectionList.appendChild(li);
            });
        } else {
            const emptyLi = document.createElement('li');
            emptyLi.textContent = '暂无自定义文件夹，请先创建';
            emptyLi.style.padding = '15px';
            emptyLi.style.color = '#999';
            emptyLi.style.textAlign = 'center';
            folderSelectionList.appendChild(emptyLi);
        }
        
        moveFolderModal.classList.add('visible');
    };

    closeMoveModalBtn.addEventListener('click', () => moveFolderModal.classList.remove('visible'));

    async function moveChatToFolder(folderId) {
        if (!chatToMove) return;
        const { id, type } = chatToMove;
        const chat = (type === 'private') ? db.characters.find(c => c.id === id) : db.groups.find(g => g.id === id);
        
        if (chat) {
            if (folderId) {
                chat.folderId = folderId;
                showToast('已移动到文件夹');
            } else {
                delete chat.folderId; 
                showToast('已移出文件夹');
            }
            await saveData();
            renderChatList();
        }
    }
}

function renderChatFolders() {
    const container = document.getElementById('chat-category-tabs');
    if (!container) return;
    
    container.innerHTML = ''; 

    const allTab = document.createElement('div');
    allTab.className = `tab-item ${currentFolderId === 'all' ? 'active pill-black' : 'pill-white'}`;
    allTab.textContent = 'All';
    allTab.onclick = () => {
        currentFolderId = 'all';
        renderChatFolders(); 
        renderChatList();    
    };
    container.appendChild(allTab);

    if (db.chatFolders && db.chatFolders.length > 0) {
        db.chatFolders.forEach(folder => {
            const tab = document.createElement('div');
            tab.className = `tab-item ${currentFolderId === folder.id ? 'active pill-black' : 'pill-white'}`;
            tab.textContent = folder.name;
            
            tab.onclick = () => {
                currentFolderId = folder.id;
                renderChatFolders();
                renderChatList();
            };

            tab.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                window.openEditFolderModal(folder.id);
            });
            let pressTimer;
            tab.addEventListener('touchstart', () => {
                pressTimer = setTimeout(() => window.openEditFolderModal(folder.id), 500);
            });
            tab.addEventListener('touchend', () => clearTimeout(pressTimer));
            
            container.appendChild(tab);
        });
    }

    const addTab = document.createElement('div');
    addTab.className = 'tab-item tab-manage';
    addTab.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-list-stars" viewBox="0 0 16 16">
<path fill-rule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5z"/>
<path d="M2.242 2.194a.27.27 0 0 1 .516 0l.162.53c.035.115.14.194.258.194h.551c.259 0 .37.333.164.493l-.468.363a.277.277 0 0 0-.094.3l.173.569c.078.256-.213.462-.423.3l-.417-.324a.267.267 0 0 0-.328 0l-.417.323c-.21.163-.5-.043-.423-.299l.173-.57a.277.277 0 0 0-.094-.299l-.468-.363c-.206-.16-.095-.493.164-.493h.55a.271.271 0 0 0 .259-.194l.162-.53zm0 4a.27.27 0 0 1 .516 0l.162.53c.035.115.14.194.258.194h.551c.259 0 .37.333.164.493l-.468.363a.277.277 0 0 0-.094.3l.173.569c.078.255-.213.462-.423.3l-.417-.324a.267.267 0 0 0-.328 0l-.417.323c-.21.163-.5-.043-.423-.299l.173-.57a.277.277 0 0 0-.094-.299l-.468-.363c-.206-.16-.095-.493.164-.493h.55a.271.271 0 0 0 .259-.194l.162-.53zm0 4a.27.27 0 0 1 .516 0l.162.53c.035.115.14.194.258.194h.551c.259 0 .37.333.164.493l-.468.363a.277.277 0 0 0-.094.3l.173.569c.078.255-.213.462-.423.3l-.417-.324a.267.267 0 0 0-.328 0l-.417.323c-.21.163-.5-.043-.423-.299l.173-.57a.277.277 0 0 0-.094-.299l-.468-.363c-.206-.16-.095-.493.164-.493h.55a.271.271 0 0 0 .259-.194l.162-.53z"/>
</svg>`;
    addTab.onclick = () => window.openCreateFolderModal();
    container.appendChild(addTab);
}

function handleChatListLongPress(chatId, chatType, x, y) {
    clearTimeout(longPressTimer);
    // 清除可能存在的文本选择，防止干扰菜单点击
    if (window.getSelection) {
        window.getSelection().removeAllRanges();
    }
    const chatItem = (chatType === 'private') ? db.characters.find(c => c.id === chatId) : db.groups.find(g => g.id === chatId);
    if (!chatItem) return;
    const itemName = chatType === 'private' ? chatItem.remarkName : chatItem.name;
    const menuItems = [
        {
            label: chatItem.isPinned ? '取消置顶' : '置顶聊天',
            action: async () => {
                chatItem.isPinned = !chatItem.isPinned;
                await saveData();
                renderChatList();
            }
        },
        {
            label: '移动到文件夹...',
            action: () => {
                window.openMoveToFolderModal(chatId, chatType);
            }
        },
        {
            label: '删除聊天',
            danger: true,
            action: async () => {
                if (confirm(`确定要删除与“${itemName}”的聊天记录吗？此操作不可恢复。`)) {
                    if (chatType === 'private') {
                        await dexieDB.characters.delete(chatId);
                        db.characters = db.characters.filter(c => c.id !== chatId);
                    } else {
                        await dexieDB.groups.delete(chatId);
                        db.groups = db.groups.filter(g => g.id !== chatId);
                    }
                    renderChatList();
                    showToast('聊天已删除');
                }
            }
        }
    ];
    createContextMenu(menuItems, x, y);
}

function renderChatList() {
    const chatListContainer = document.getElementById('chat-list-container');
    chatListContainer.innerHTML = '';
    
    if (document.getElementById('chat-category-tabs').children.length === 0) {
        renderChatFolders();
    }

    const allChats = [...db.characters.map(c => ({...c, type: 'private'})), ...db.groups.map(g => ({
        ...g,
        type: 'group'
    }))];
    
    let filteredChats;
    if (currentFolderId === 'all') {
        filteredChats = allChats.filter(chat => !chat.folderId);
    } else {
        filteredChats = allChats.filter(chat => chat.folderId === currentFolderId);
    }

    document.getElementById('no-chats-placeholder').style.display = filteredChats.length === 0 ? 'block' : 'none';
    
    const sortedChats = filteredChats.sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        const lastMsgTimeA = a.history && a.history.length > 0 ? a.history[a.history.length - 1].timestamp : 0;
        const lastMsgTimeB = b.history && b.history.length > 0 ? b.history[b.history.length - 1].timestamp : 0;
        return lastMsgTimeB - lastMsgTimeA;
    });
    
    sortedChats.forEach(chat => {
        let lastMessageText = '开始聊天吧...';
        if (chat.history && chat.history.length > 0) {
            let invisibleRegex;
            if (chat.showStatusUpdateMsg) {
                invisibleRegex = /\[.*?(?:接收|退回).*?的转账\]|\[.*?已接收礼物\]|\[system:.*?\]|\[.*?邀请.*?加入了群聊\]|\[.*?修改群名为：.*?\]|\[system-display:.*?\]/;
            } else {
                invisibleRegex = /\[.*?(?:接收|退回).*?的转账\]|\[.*?更新状态为：.*?\]|\[.*?已接收礼物\]|\[system:.*?\]|\[.*?邀请.*?加入了群聊\]|\[.*?修改群名为：.*?\]|\[system-display:.*?\]/;
            }
            const visibleHistory = chat.history.filter(msg => !invisibleRegex.test(msg.content));
            if (visibleHistory.length > 0) {
                const lastMsg = visibleHistory[visibleHistory.length - 1];
                const urlRegex = /^(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|bmp|svg)|data:image\/[a-z]+;base64,)/i;
                const imageRecogRegex = /\[.*?发来了一张图片：\]/
                const voiceRegex = /\[.*?的语音：.*?\]/;
                const photoVideoRegex = /\[.*?发来的照片\/视频：.*?\]/;
                const transferRegex = /\[.*?的转账：.*?元.*?\]|\[.*?给你转账：.*?元.*?\]|\[.*?向.*?转账：.*?元.*?\]/;
                const stickerRegex = /\[.*?的表情包：.*?\]|\[.*?发送的表情包：.*?\]/;
                const giftRegex = /\[.*?送来的礼物：.*?\]|\[.*?向.*?送来了礼物：.*?\]/;

                if (giftRegex.test(lastMsg.content)) {
                    lastMessageText = '[礼物]';
                } else if (stickerRegex.test(lastMsg.content)) {
                    lastMessageText = '[表情包]';
                } else if (voiceRegex.test(lastMsg.content)) {
                    lastMessageText = '[语音]';
                } else if (photoVideoRegex.test(lastMsg.content)) {
                    lastMessageText = '[照片/视频]';
                } else if (transferRegex.test(lastMsg.content)) {
                    lastMessageText = '[转账]';
                } else if (imageRecogRegex.test(lastMsg.content) || (lastMsg.parts && lastMsg.parts.some(p => p.type === 'image'))) {
                    lastMessageText = '[图片]';
                }else if ((lastMsg.parts && lastMsg.parts.some(p => p.type === 'html'))) {
                    lastMessageText = '[互动]';
                } else {
                    let text = lastMsg.content.trim();
                    const plainTextMatch = text.match(/^\[.*?：([\s\S]*)\]$/);
                    if (plainTextMatch && plainTextMatch[1]) {
                        text = plainTextMatch[1].trim();
                    }
                    text = text.replace(/\[发送时间:.*?\]$/, '').trim(); 
                    const htmlRegex = /<[a-z][\s\S]*>/i;
                    if (htmlRegex.test(text)) {
                        lastMessageText = '[互动]';
                    } else {
                        lastMessageText = urlRegex.test(text) ? '[图片]' : text;
                    }
                }
            } else {
                const lastEverMsg = chat.history[chat.history.length - 1];
                const inviteRegex = /\[(.*?)邀请(.*?)加入了群聊\]/;
                const renameRegex = /\[.*?修改群名为：.*?\]/;
                const timeSkipRegex = /\[system-display:([\s\S]+?)\]/;
                const timeSkipMatch = lastEverMsg.content.match(timeSkipRegex);

                if (timeSkipMatch) {
                    lastMessageText = timeSkipMatch[1];
                } else if (inviteRegex.test(lastEverMsg.content)) {
                    lastMessageText = '新成员加入了群聊';
                } else if (renameRegex.test(lastEverMsg.content)) {
                    lastMessageText = '群聊名称已修改';
                    } else {
                    lastMessageText = 'ta正在等你';
                }
                
            }
        }
        const li = document.createElement('li');
        li.className = 'list-item chat-item';
        if (chat.isPinned) li.classList.add('pinned');
        li.dataset.id = chat.id;
        li.dataset.type = chat.type;
        const avatarClass = chat.type === 'group' ? 'group-avatar' : '';
        const itemName = chat.type === 'private' ? chat.remarkName : chat.name;
        const pinBadgeHTML = chat.isPinned ? '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" style="color: #999; margin-left: 4px; flex-shrink: 0;"><path d="M12,17.27L18.18,21L16.54,13.97L22,9.24L14.81,8.62L12,2L9.19,8.62L2,9.24L7.45,13.97L5.82,21L12,17.27Z" /></svg>' : '';
        
        let timeString = '';
        const lastMessage = chat.history && chat.history.length > 0 ? chat.history[chat.history.length - 1] : null;
        if (lastMessage) {
            const date = new Date(lastMessage.timestamp);
            const now = new Date();
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);

            if (date.toDateString() === now.toDateString()) {
                timeString = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
            } else if (date.toDateString() === yesterday.toDateString()) {
                timeString = '昨天';
            } else {
                timeString = `${pad(date.getMonth() + 1)}月${pad(date.getDate())}日`;
            }
        }

        const unreadCount = chat.unreadCount || 0;
        const unreadClass = unreadCount > 0 ? 'visible' : '';
        const unreadText = unreadCount > 99 ? '99+' : unreadCount;

        li.innerHTML = `
            <img src="${chat.avatar}" alt="${itemName}" class="chat-avatar ${avatarClass}">
            <div class="item-details">
                <div class="item-details-row" style="justify-content: flex-start; align-items: center;">
                    <div class="item-name">${itemName}</div>
                    ${pinBadgeHTML}
                </div>
                <div class="item-preview-wrapper">
                    <div class="item-preview">${lastMessageText}</div>
                </div>
            </div>
            <div class="item-meta-container">
                <span class="item-time">${timeString}</span>
                <span class="unread-badge ${unreadClass}">${unreadText}</span>
            </div>`;

        chatListContainer.appendChild(li);
    });
}

function setupAddCharModal() {
    document.getElementById('add-char-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newChar = {
            peekData: {}, 
            id: `char_${Date.now()}`,
            realName: document.getElementById('char-real-name').value,
            remarkName: document.getElementById('char-remark-name').value,
            persona: '',
            avatar: 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg',
            myName: document.getElementById('my-name-for-char').value || 'user',
            myPersona: '',
            myAvatar: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg',
            theme: 'white_pink',
            maxMemory: 10,
            chatBg: '',
            history: [],
            isPinned: false,
            status: '在线',
            worldBookIds: [],
            useCustomBubbleCss: false,
            customBubbleCss: '',
            bilingualBubbleStyle: 'under',
            unreadCount: 0,
            memoryJournals: [],
            journalWorldBookIds: [],
            peekScreenSettings: { wallpaper: '', customIcons: {}, unlockAvatar: '' },
            lastUserMessageTimestamp: null,
            statusPanel: {
                enabled: false,
                promptSuffix: '',
                regexPattern: '',
                replacePattern: '',
                historyLimit: 3,
                currentStatusRaw: '',
                currentStatusHtml: '',
                history: []
            },
            autoReply: {
                enabled: false,
                interval: 60,
                lastTriggerTime: 0
            }
       };
        db.characters.push(newChar);
        await saveData();
        renderChatList();
        document.getElementById('add-char-modal').classList.remove('visible');
        showToast(`角色“${newChar.remarkName}”创建成功！`);
        promptForBackupIfNeeded('new_char');
    });
}

async function handleCharacterImport(file) {
    if (!file) return;
    showToast('正在导入角色卡...');
    try {
        if (file.name.endsWith('.png')) {
            await parseCharPng(file);
        } else if (file.name.endsWith('.json')) {
            await parseCharJson(file);
        } else {
            throw new Error('不支持的文件格式。请选择 .png 或 .json 文件。');
        }
    } catch (error) {
        console.error('角色卡导入失败:', error);
        showToast(`导入失败: ${error.message}`);
    }
}

function parseCharPng(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = (e) => {
            try {
                const buffer = e.target.result;
                const view = new DataView(buffer);
                const signature = [137, 80, 78, 71, 13, 10, 26, 10];
                for (let i = 0; i < signature.length; i++) {
                    if (view.getUint8(i) !== signature[i]) {
                        return reject(new Error('文件不是一个有效的PNG。'));
                    }
                }

                let offset = 8;
                let charaData = null;

                while (offset < view.byteLength) {
                    const length = view.getUint32(offset);
                    const type = String.fromCharCode(view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7));
                    
                    if (type === 'tEXt') {
                        const textChunk = new Uint8Array(buffer, offset + 8, length);
                        let separatorIndex = -1;
                        for(let i = 0; i < textChunk.length; i++) {
                            if (textChunk[i] === 0) {
                                separatorIndex = i;
                                break;
                            }
                        }

                        if (separatorIndex !== -1) {
                            const keyword = new TextDecoder('utf-8').decode(textChunk.slice(0, separatorIndex));
                            if (keyword === 'chara') {
                                const base64Data = new TextDecoder('utf-8').decode(textChunk.slice(separatorIndex + 1));
                                try {
                                    const decodedString = atob(base64Data);
                                    const bytes = new Uint8Array(decodedString.length);
                                    for (let i = 0; i < decodedString.length; i++) {
                                        bytes[i] = decodedString.charCodeAt(i);
                                    }
                                    const utf8Decoder = new TextDecoder('utf-8');
                                    charaData = JSON.parse(utf8Decoder.decode(bytes));
                                    break;
                                } catch (decodeError) {
                                    return reject(new Error(`解析角色数据失败: ${decodeError.message}`));
                                }
                            }
                        }
                    }
                    offset += 12 + length;
                }

                if (charaData) {
                    const imageReader = new FileReader();
                    imageReader.readAsDataURL(file);
                    imageReader.onload = (imgEvent) => {
                        createCharacterFromData(charaData, imgEvent.target.result);
                        resolve();
                    };
                    imageReader.onerror = () => {
                        createCharacterFromData(charaData, 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg');
                        resolve();
                    };
                } else {
                    reject(new Error('在PNG中未找到有效的角色数据 (tEXt chunk not found or invalid)。'));
                }
            } catch (error) {
                reject(new Error(`解析PNG失败: ${error.message}`));
            }
        };
        reader.onerror = () => reject(new Error('读取PNG文件失败。'));
    });
}

function parseCharJson(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsText(file, 'UTF-8');
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                createCharacterFromData(data, 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg');
                resolve();
            } catch (error) {
                reject(new Error(`解析JSON失败: ${error.message}`));
            }
        };
        reader.onerror = () => reject(new Error('读取JSON文件失败。'));
    });
}

async function createCharacterFromData(data, avatar) {
    const charData = data.data || data;

    if (!charData || !charData.name) {
        throw new Error('角色卡数据无效，缺少角色名称。');
    }

    const newChar = {
        peekData: {},
        id: `char_${Date.now()}`,
        realName: charData.name || '未命名',
        remarkName: charData.name || '未命名',
        persona: charData.description || charData.persona || '',
        avatar: avatar || 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg',
        myName: 'user',
        myPersona: '',
        myAvatar: 'https://i.postimg.cc/GtbTnxhP/o-o-1.jpg',
        theme: 'white_pink',
        maxMemory: 10,
        chatBg: '',
        history: [],
        isPinned: false,
        status: '在线',
            worldBookIds: [],
            useCustomBubbleCss: false,
            customBubbleCss: '',
            bilingualBubbleStyle: 'under',
            unreadCount: 0,
        memoryJournals: [],
        journalWorldBookIds: [],
        peekScreenSettings: { wallpaper: '', customIcons: {}, unlockAvatar: '' },
        lastUserMessageTimestamp: null,
        statusPanel: {
            enabled: false,
            promptSuffix: '',
            regexPattern: '',
            replacePattern: '',
            historyLimit: 3,
            currentStatusRaw: '',
            currentStatusHtml: '',
            history: []
        },
        autoReply: {
            enabled: false,
            interval: 60,
            lastTriggerTime: 0
        }
    };

    const importedWorldBookIds = [];
    
    if (charData.character_book && Array.isArray(charData.character_book.entries)) {
        const categoryName = data.name || charData.name;
        charData.character_book.entries.forEach(entry => {
            const name = entry.comment;
            const content = entry.content;
            if (name && content) {
                // 策略：内容相同则复用，内容不同则重命名导入
                const exactMatch = db.worldBooks.find(wb => wb.name.toLowerCase() === name.toLowerCase() && wb.content === content);
                if (exactMatch) {
                    if (!importedWorldBookIds.includes(exactMatch.id)) importedWorldBookIds.push(exactMatch.id);
                } else {
                    // 检查是否已经导入过重命名版本
                    const renamedName = `${name} (${categoryName})`;
                    const renamedMatch = db.worldBooks.find(wb => wb.name.toLowerCase() === renamedName.toLowerCase() && wb.content === content);
                    
                    if (renamedMatch) {
                        if (!importedWorldBookIds.includes(renamedMatch.id)) importedWorldBookIds.push(renamedMatch.id);
                    } else {
                        // 需要新建
                        let newBookName = name;
                        const nameConflict = db.worldBooks.find(wb => wb.name.toLowerCase() === name.toLowerCase());
                        if (nameConflict) {
                            newBookName = renamedName;
                            // 二次冲突检查
                            if (db.worldBooks.some(wb => wb.name.toLowerCase() === newBookName.toLowerCase())) {
                                newBookName = `${newBookName}_${Math.random().toString(36).substr(2, 4)}`;
                            }
                        }
                        
                        const newBook = {
                            id: `wb_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                            name: newBookName,
                            content: content,
                            position: 'after',
                            category: categoryName
                        };
                        db.worldBooks.push(newBook);
                        importedWorldBookIds.push(newBook.id);
                    }
                }
            }
        });
    }
    else {
        const worldInfo = charData.world_info || charData.wi || '';
        if (worldInfo && typeof worldInfo === 'string' && worldInfo.trim() !== '') {
            const entries = worldInfo.split(/\n\s*\n/).filter(entry => entry.trim() !== '');
            entries.forEach(entryText => {
                const lines = entryText.trim().split('\n');
                if (lines.length > 0) {
                    const name = lines[0].trim();
                    const content = lines.slice(1).join('\n').trim();
                    if (name && content) {
                        const categoryName = '导入的角色设定';
                        // 策略：内容相同则复用，内容不同则重命名导入
                        const exactMatch = db.worldBooks.find(wb => wb.name.toLowerCase() === name.toLowerCase() && wb.content === content);
                        if (exactMatch) {
                            if (!importedWorldBookIds.includes(exactMatch.id)) importedWorldBookIds.push(exactMatch.id);
                        } else {
                            // 检查是否已经导入过重命名版本
                            const renamedName = `${name} (${charData.name || '未命名'})`;
                            const renamedMatch = db.worldBooks.find(wb => wb.name.toLowerCase() === renamedName.toLowerCase() && wb.content === content);
                            
                            if (renamedMatch) {
                                if (!importedWorldBookIds.includes(renamedMatch.id)) importedWorldBookIds.push(renamedMatch.id);
                            } else {
                                // 需要新建
                                let newBookName = name;
                                const nameConflict = db.worldBooks.find(wb => wb.name.toLowerCase() === name.toLowerCase());
                                if (nameConflict) {
                                    newBookName = renamedName;
                                    // 二次冲突检查
                                    if (db.worldBooks.some(wb => wb.name.toLowerCase() === newBookName.toLowerCase())) {
                                        newBookName = `${newBookName}_${Math.random().toString(36).substr(2, 4)}`;
                                    }
                                }
                                
                                const newBook = {
                                    id: `wb_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                                    name: newBookName,
                                    content: content,
                                    position: 'after',
                                    category: categoryName
                                };
                                db.worldBooks.push(newBook);
                                importedWorldBookIds.push(newBook.id);
                            }
                        }
                    }
                }
            });
        }
    }
    
    if (importedWorldBookIds.length > 0) {
        newChar.worldBookIds = importedWorldBookIds;
        setTimeout(() => {
            showToast(`同时导入了 ${importedWorldBookIds.length} 条世界书设定。`);
        }, 1600);
    }

    db.characters.push(newChar);
    await saveData();
    renderChatList();
    showToast(`角色“${newChar.remarkName}”导入成功！`);
}

function setupChatRoom() {
    const memoryJournalBtn = document.getElementById('memory-journal-btn');
    const deleteHistoryBtn = document.getElementById('delete-history-btn');
    const captureBtn = document.getElementById('capture-btn');
    const toggleExpansionBtn = document.getElementById('toggle-expansion-btn');
    const charStatusBtn = document.getElementById('char-status-btn');
    const statusOverlay = document.getElementById('char-status-overlay');
    const closeStatusBtn = document.getElementById('close-status-panel-btn');
    const statusContent = document.getElementById('char-status-content');

    if (charStatusBtn) {
        charStatusBtn.addEventListener('click', () => {
            const char = db.characters.find(c => c.id === currentChatId);
            if (!char || !char.statusPanel) return;

            statusContent.innerHTML = ''; // Clear previous content

            // Prepare data: combine history and current if needed
            let slidesData = [];
            if (char.statusPanel.history && char.statusPanel.history.length > 0) {
                // history is [newest, older, oldest...]
                // We want to display newest last (on the right), so history is on the left
                slidesData = [...char.statusPanel.history].reverse();
            } else if (char.statusPanel.currentStatusHtml) {
                slidesData = [{ html: char.statusPanel.currentStatusHtml, timestamp: Date.now() }];
            }

            if (slidesData.length === 0) {
                statusContent.innerHTML = '<p style="text-align:center; color:#999;">暂无状态信息</p>';
                statusOverlay.classList.add('visible');
                return;
            }

            // Build Swiper Structure
            const swiper = document.createElement('div');
            swiper.className = 'status-swiper';

            // Helper function for Lazy Loading
            const loadSlideContent = (index) => {
                if (index < 0 || index >= slidesData.length) return;
                const slide = swiper.children[index];
                if (!slide) return;
                const slideInner = slide.querySelector('.status-slide-inner');
                if (slideInner.hasChildNodes()) return; // Already loaded

                const item = slidesData[index];
                const htmlContent = item.html;
                if (htmlContent.includes('<!DOCTYPE html>') || htmlContent.includes('<html') || htmlContent.includes('<style')) {
                    const iframe = document.createElement('iframe');
                    iframe.style.cssText = "width: 100%; height: 100%; min-height: 80vh; border: none; background: transparent; display: block;";
                    iframe.srcdoc = htmlContent;
                    slideInner.appendChild(iframe);
                } else {
                    slideInner.innerHTML = htmlContent;
                }
            };

            // Create empty slides first
            slidesData.forEach((item, index) => {
                const slide = document.createElement('div');
                slide.className = 'status-slide';
                
                const slideInner = document.createElement('div');
                slideInner.className = 'status-slide-inner';
                // Content will be loaded lazily
                
                slide.appendChild(slideInner);
                swiper.appendChild(slide);
            });

            // Indicator
            const indicator = document.createElement('div');
            indicator.className = 'status-indicator';
            indicator.textContent = `${slidesData.length} / ${slidesData.length}`;

            statusContent.appendChild(swiper);
            statusContent.appendChild(indicator);

            // Initial Load: Load the last slide (newest) and previous ones
            const lastIndex = slidesData.length - 1;
            loadSlideContent(lastIndex);
            if (lastIndex > 0) loadSlideContent(lastIndex - 1);
            if (lastIndex > 1) loadSlideContent(lastIndex - 2);

            // Scroll to the end (newest) initially
            setTimeout(() => {
                swiper.style.scrollBehavior = 'auto';
                swiper.scrollLeft = swiper.scrollWidth;
                setTimeout(() => {
                    swiper.style.scrollBehavior = 'smooth';
                }, 50);
            }, 0);

            // Scroll Listener for Indicator & Lazy Loading
            swiper.addEventListener('scroll', () => {
                const width = swiper.offsetWidth;
                if (width > 0) {
                    const currentIndex = Math.round(swiper.scrollLeft / width);
                    indicator.textContent = `${currentIndex + 1} / ${slidesData.length}`;
                    
                    // Lazy load adjacent slides (current +/- 2)
                    for (let i = currentIndex - 2; i <= currentIndex + 2; i++) {
                        loadSlideContent(i);
                    }
                }
            });

            statusOverlay.classList.add('visible');
        });
    }

    if (closeStatusBtn) {
        closeStatusBtn.addEventListener('click', () => {
            statusOverlay.classList.remove('visible');
        });
    }
    
    if (statusOverlay) {
        statusOverlay.addEventListener('click', (e) => {
            if (e.target === statusOverlay) {
                statusOverlay.classList.remove('visible');
            }
        });
    }

    if (toggleExpansionBtn) {
        toggleExpansionBtn.addEventListener('click', () => {
            if (chatExpansionPanel.classList.contains('visible') && panelFunctionArea.style.display !== 'none') {
                showPanel('none');
            } else {
                showPanel('function');
            }
        });
    }

    if (memoryJournalBtn) {
        memoryJournalBtn.addEventListener('click', () => {
            renderJournalList();
            switchScreen('memory-journal-screen');
            showPanel('none'); 
        });
    }

    if (deleteHistoryBtn) {
        deleteHistoryBtn.addEventListener('click', () => {
            openDeleteChunkModal();
            showPanel('none'); 
        });
    }

    if (captureBtn) {
        captureBtn.addEventListener('click', () => {
            enterMultiSelectMode(null, 'capture');
            showPanel('none');
        });
    }

    const charGalleryManageBtn = document.getElementById('char-gallery-manage-btn');
    if (charGalleryManageBtn) {
        charGalleryManageBtn.addEventListener('click', () => {
            if (typeof openGalleryManager === 'function') {
                openGalleryManager();
                showPanel('none');
            } else {
                showToast('相册功能未加载');
            }
        });
    }

    document.getElementById('send-message-btn').addEventListener('click', sendMessage);
    document.getElementById('send-message-btn').addEventListener('touchend', (e) => {
        e.preventDefault();
        sendMessage();
        setTimeout(() => {
            messageInput.focus();
        }, 50);
    });
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !isGenerating) sendMessage();
    });

    // 监听输入框聚焦事件：自动收起底部面板，避免与键盘冲突
    messageInput.addEventListener('focus', () => {
        if (chatExpansionPanel.classList.contains('visible')) {
            // 立即禁用动画，防止键盘弹出时面板被顶起
            chatExpansionPanel.classList.add('no-transition');
            showPanel('none');
            // 恢复动画属性
            setTimeout(() => {
                chatExpansionPanel.classList.remove('no-transition');
            }, 100);
        }
    });

    getReplyBtn.addEventListener('click', () => getAiReply(currentChatId, currentChatType));
    regenerateBtn.addEventListener('click', handleRegenerate);
    
    messageArea.addEventListener('click', (e) => {
        if (isDebugMode) {
            const messageWrapper = e.target.closest('.message-wrapper');
            if (messageWrapper) {
                startDebugEdit(messageWrapper.dataset.id);
                return; 
            }
        }

        if (chatExpansionPanel.classList.contains('visible')) {
            showPanel('none');
            return;
        }

        if (e.target && e.target.id === 'load-more-btn') {
            loadMoreMessages();
        } else if (isInMultiSelectMode) {
            const messageWrapper = e.target.closest('.message-wrapper');
            if (messageWrapper) {
                toggleMessageSelection(messageWrapper.dataset.id);
            }
        } else {
            const voiceBubble = e.target.closest('.voice-bubble');
            if (voiceBubble) {
                const transcript = voiceBubble.closest('.message-wrapper').querySelector('.voice-transcript');
                if (transcript) {
                    transcript.classList.toggle('active');
                }
            }
            
            const bilingualBubble = e.target.closest('.bilingual-bubble');
            if (bilingualBubble) {
                const translationText = bilingualBubble.closest('.message-wrapper').querySelector('.translation-text');
                if (translationText) {
                    translationText.classList.toggle('active');
                }
            }

            const pvCard = e.target.closest('.pv-card');
            if (pvCard) {
                const imageOverlay = pvCard.querySelector('.pv-card-image-overlay');
                const footer = pvCard.querySelector('.pv-card-footer');
                imageOverlay.classList.toggle('hidden');
                footer.classList.toggle('hidden');
            }
            const giftCard = e.target.closest('.gift-card');
            if (giftCard) {
                const description = giftCard.closest('.message-wrapper').querySelector('.gift-card-description');
                if (description) {
                    description.classList.toggle('active');
                }
            }
            const transferCard = e.target.closest('.transfer-card.received-transfer');
            if (transferCard && currentChatType === 'private') {
                const messageWrapper = transferCard.closest('.message-wrapper');
                const messageId = messageWrapper.dataset.id;
                const character = db.characters.find(c => c.id === currentChatId);
                const message = character.history.find(m => m.id === messageId);
                if (message && message.transferStatus === 'pending') {
                    handleReceivedTransferClick(messageId);
                }
            }
        }
    });
    
    messageArea.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (e.target.id === 'load-more-btn' || isInMultiSelectMode) return;
        const messageWrapper = e.target.closest('.message-wrapper');
        if (!messageWrapper) return;
        handleMessageLongPress(messageWrapper, e.clientX, e.clientY);
    });
    messageArea.addEventListener('touchstart', (e) => {
        if (e.target.id === 'load-more-btn') return;
        const messageWrapper = e.target.closest('.message-wrapper');
        if (!messageWrapper) return;
        longPressTimer = setTimeout(() => {
            const touch = e.touches[0];
            handleMessageLongPress(messageWrapper, touch.clientX, touch.clientY);
        }, 400);
    });
    messageArea.addEventListener('touchend', () => clearTimeout(longPressTimer));
    messageArea.addEventListener('touchmove', () => clearTimeout(longPressTimer));
    
    const messageEditForm = document.getElementById('message-edit-form');
    if(messageEditForm) {
        messageEditForm.addEventListener('submit', (e) => {
            e.preventDefault();
            saveMessageEdit();
        });
    }

    const cancelEditModalBtn = document.getElementById('cancel-edit-modal-btn');
    if(cancelEditModalBtn) {
        cancelEditModalBtn.addEventListener('click', cancelMessageEdit);
    }

    const hideTimestampBtn = document.getElementById('hide-timestamp-btn');
    if (hideTimestampBtn) {
        hideTimestampBtn.addEventListener('click', () => {
            if (!editingMessageId) return;
            
            const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
            const messageIndex = chat.history.findIndex(m => m.id === editingMessageId);
            
            let targetTime;
            if (messageIndex > 0) {
                const prevMsg = chat.history[messageIndex - 1];
                targetTime = prevMsg.timestamp + 60000; 
            } else {
                targetTime = Date.now(); 
            }
            
            const date = new Date(targetTime);
            const Y = date.getFullYear();
            const M = String(date.getMonth() + 1).padStart(2, '0');
            const D = String(date.getDate()).padStart(2, '0');
            const h = String(date.getHours()).padStart(2, '0');
            const m = String(date.getMinutes()).padStart(2, '0');
            
            const timestampInput = document.getElementById('message-edit-timestamp');
            if (timestampInput) {
                timestampInput.value = `${Y}-${M}-${D}T${h}:${m}`;
            }
        });
    }

    document.getElementById('cancel-multi-select-btn').addEventListener('click', exitMultiSelectMode);
    document.getElementById('delete-selected-btn').addEventListener('click', deleteSelectedMessages);
    document.getElementById('generate-capture-btn').addEventListener('click', generateCapture);
    document.getElementById('close-capture-modal-btn').addEventListener('click', () => {
        document.getElementById('capture-result-modal').classList.remove('visible');
    });
    document.getElementById('cancel-reply-btn').addEventListener('click', cancelQuoteReply);
}

function handleMessageLongPress(messageWrapper, x, y) {
    if (isInMultiSelectMode) return;
    clearTimeout(longPressTimer);
    // 清除可能存在的文本选择，防止干扰菜单点击
    if (window.getSelection) {
        window.getSelection().removeAllRanges();
    }
    const messageId = messageWrapper.dataset.id;
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    const message = chat.history.find(m => m.id === messageId);
    if (!message) return;

    const isImageRecognitionMsg = message.parts && message.parts.some(p => p.type === 'image');
    const isVoiceMessage = /\[.*?的语音：.*?\]/.test(message.content);
    const isStickerMessage = /\[.*?的表情包：.*?\]|\[.*?发送的表情包：.*?\]/.test(message.content);
    const isPhotoVideoMessage = /\[.*?发来的照片\/视频：.*?\]/.test(message.content);
    const isTransferMessage = /\[.*?给你转账：.*?\]|\[.*?的转账：.*?\]|\[.*?向.*?转账：.*?\]/.test(message.content);
    const isGiftMessage = /\[.*?送来的礼物：.*?\]|\[.*?向.*?送来了礼物：.*?\]/.test(message.content);
    
    let invisibleRegex;
    if (chat.showStatusUpdateMsg) {
        invisibleRegex = /\[.*?(?:接收|退回).*?的转账\]|\[.*?已接收礼物\]|\[system:.*?\]|\[.*?邀请.*?加入了群聊\]|\[.*?修改群名为：.*?\]|\[system-display:.*?\]/;
    } else {
        invisibleRegex = /\[.*?(?:接收|退回).*?的转账\]|\[.*?更新状态为：.*?\]|\[.*?已接收礼物\]|\[system:.*?\]|\[.*?邀请.*?加入了群聊\]|\[.*?修改群名为：.*?\]|\[system-display:.*?\]/;
    }
    const isInvisibleMessage = invisibleRegex.test(message.content);
    const isWithdrawn = message.isWithdrawn; 

    let menuItems = [];

    if (!isWithdrawn) {
        if (!isImageRecognitionMsg && !isVoiceMessage && !isStickerMessage && !isPhotoVideoMessage && !isTransferMessage && !isGiftMessage && !isInvisibleMessage) {
            menuItems.push({label: '编辑', action: () => startMessageEdit(messageId)});
        }
        
        if (!isInvisibleMessage) {
            menuItems.push({label: '引用', action: () => startQuoteReply(messageId)});
        }

        if (message.role === 'user') {
            menuItems.push({label: '撤回', action: () => withdrawMessage(messageId)});
        }
    }

    menuItems.push({
        label: isDebugMode ? '退出调试' : '进入调试',
        action: () => {
            isDebugMode = !isDebugMode;
            showToast(isDebugMode ? '已进入调试模式' : '已退出调试模式');
            renderMessages(false, true); 
        }
    });

    menuItems.push({label: '删除', action: () => enterMultiSelectMode(messageId)});

    if (menuItems.length > 0) {
        triggerHapticFeedback('medium');
        createContextMenu(menuItems, x, y);
    }
}

function startDebugEdit(messageId) {
    exitMultiSelectMode();
    editingMessageId = messageId;
    isRawEditMode = true; 

    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    const message = chat.history.find(m => m.id === messageId);
    if (!message) return;

    const modal = document.getElementById('message-edit-modal');
    const textarea = document.getElementById('message-edit-textarea');
    const title = modal.querySelector('h3');
    const deleteBtn = document.getElementById('debug-delete-msg-btn'); 

    if (!modal.dataset.originalTitle) modal.dataset.originalTitle = title.textContent;
    title.textContent = "调试/编辑源码";

    const textMatch = message.content.match(/^\[(.*?)的消息：([\s\S]+?)\]$/);
    if (message.quote && textMatch) {
        const name = textMatch[1];
        const text = textMatch[2];
        const quoteContent = message.quote.content;
        textarea.value = `[${name}引用“${quoteContent}”并回复：${text}]`;
    } else {
        textarea.value = message.content; 
    }

    const timestampInput = document.getElementById('message-edit-timestamp');
    const timestampGroup = document.getElementById('message-edit-timestamp-group');
    if (timestampInput && timestampGroup) {
        const date = new Date(message.timestamp);
        const Y = date.getFullYear();
        const M = String(date.getMonth() + 1).padStart(2, '0');
        const D = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        timestampInput.value = `${Y}-${M}-${D}T${h}:${m}`;
        timestampInput.dataset.originalValue = timestampInput.value;
        timestampGroup.style.display = 'flex';
    }
    
    if (deleteBtn) {
        deleteBtn.style.display = 'block';
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        
        newDeleteBtn.addEventListener('click', async () => {
            if (confirm('【调试模式】确定要永久删除这条消息吗？')) {
                chat.history = chat.history.filter(m => m.id !== messageId);
                
                if (currentChatType === 'private') {
                    recalculateChatStatus(chat);
                }

                await saveData(); 
                renderMessages(false, true); 
                cancelMessageEdit(); 
                showToast('消息已删除');
            }
        });
    }

    modal.classList.add('visible');
    textarea.focus();
}

function startQuoteReply(messageId) {
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    const message = chat.history.find(m => m.id === messageId);
    if (!message) return;

    let senderName = '';
    let senderId = '';
    if (message.role === 'user') {
        senderName = (currentChatType === 'private') ? chat.myName : chat.me.nickname;
        senderId = 'user_me';
    } else { 
        if (currentChatType === 'private') {
            senderName = chat.remarkName;
            senderId = chat.id;
        } else {
            const sender = chat.members.find(m => m.id === message.senderId);
            senderName = sender ? sender.groupNickname : '未知成员';
            senderId = sender ? sender.id : 'unknown';
        }
    }
    
    let previewContent = message.content;
    const textMatch = message.content.match(/\[.*?的消息：([\s\S]+?)\]/);
    if (textMatch) {
        previewContent = textMatch[1];
    } else if (/\[.*?的表情包：.*?\]/.test(message.content)) {
        previewContent = '[表情包]';
    } else if (/\[.*?的语音：.*?\]/.test(message.content)) {
        previewContent = '[语音]';
    } else if (/\[.*?发来的照片\/视频：.*?\]/.test(message.content)) {
        previewContent = '[照片/视频]';
    } else if (message.parts && message.parts.some(p => p.type === 'image')) {
        previewContent = '[图片]';
    }
    
    currentQuoteInfo = {
        id: message.id,
        senderId: senderId,
        senderName: senderName,
        content: previewContent.substring(0, 100) 
    };

    const previewBar = document.getElementById('reply-preview-bar');
    previewBar.querySelector('.reply-preview-name').textContent = `回复 ${senderName}`;
    previewBar.querySelector('.reply-preview-text').textContent = currentQuoteInfo.content;
    previewBar.classList.add('visible');
    
    messageInput.focus();
}

function cancelQuoteReply() {
    currentQuoteInfo = null;
    const previewBar = document.getElementById('reply-preview-bar');
    previewBar.classList.remove('visible');
}

function startMessageEdit(messageId) {
    exitMultiSelectMode();
    editingMessageId = messageId;
    isRawEditMode = false;
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    const message = chat.history.find(m => m.id === messageId);
    if (!message) return;

    const modal = document.getElementById('message-edit-modal');
    const textarea = document.getElementById('message-edit-textarea');

    let contentToEdit = message.content;
    const plainTextMatch = contentToEdit.match(/^\[.*?：([\s\S]*)\]$/);
    if (plainTextMatch && plainTextMatch[1]) {
        contentToEdit = plainTextMatch[1].trim();
    }
    contentToEdit = contentToEdit.replace(/\[发送时间:.*?\]/g, '').trim();
    
    textarea.value = contentToEdit;

    const timestampInput = document.getElementById('message-edit-timestamp');
    const timestampGroup = document.getElementById('message-edit-timestamp-group');
    if (timestampInput && timestampGroup) {
        const date = new Date(message.timestamp);
        const Y = date.getFullYear();
        const M = String(date.getMonth() + 1).padStart(2, '0');
        const D = String(date.getDate()).padStart(2, '0');
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        timestampInput.value = `${Y}-${M}-${D}T${h}:${m}`;
        timestampInput.dataset.originalValue = timestampInput.value;
        timestampGroup.style.display = 'flex';
    }

    modal.classList.add('visible');
    textarea.focus();
}

async function saveMessageEdit() {
    const newText = document.getElementById('message-edit-textarea').value.trim();
    if (!newText || !editingMessageId) {
        cancelMessageEdit();
        return;
    }

    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    const messageIndex = chat.history.findIndex(m => m.id === editingMessageId);
    if (messageIndex === -1) {
        cancelMessageEdit();
        return;
    }

    if (isRawEditMode) {
        const quoteRegex = /^\[(.*?)引用[“"]([\s\S]*?)[”"]并回复：([\s\S]*?)\]$/;
        const match = newText.match(quoteRegex);

        if (match) {
            const name = match[1];
            const quoteContent = match[2];
            const replyText = match[3];

            if (chat.history[messageIndex].quote) {
                chat.history[messageIndex].quote.content = quoteContent;

                const targetContent = quoteContent.trim();
                const originalMessage = chat.history.slice().reverse().find(m => {
                    if (m.id === chat.history[messageIndex].id) return false;
                    let text = m.content;
                    const plainTextMatch = text.match(/^\[.*?：([\s\S]*)\]$/);
                    if (plainTextMatch && plainTextMatch[1]) {
                        text = plainTextMatch[1].trim();
                    }
                    text = text.replace(/\[发送时间:.*?\]$/, '').trim();
                    return text === targetContent;
                });

                if (originalMessage) {
                    let newSenderId;
                    if (originalMessage.role === 'user') {
                        newSenderId = 'user_me';
                    } else {
                        newSenderId = originalMessage.senderId || (currentChatType === 'private' ? chat.id : 'unknown');
                    }
                    chat.history[messageIndex].quote.senderId = newSenderId;
                    chat.history[messageIndex].quote.messageId = originalMessage.id;
                }
            }
            chat.history[messageIndex].content = `[${name}的消息：${replyText}]`;
        } else {
            chat.history[messageIndex].content = newText;
        }

        if (chat.history[messageIndex].parts) {
            chat.history[messageIndex].parts = [{type: 'text', text: chat.history[messageIndex].content}];
        }
    } else {
        const oldContent = chat.history[messageIndex].content;
        const prefixMatch = oldContent.match(/(\[.*?的消息：)[\s\S]+\]/);
        let newContent;

        if (prefixMatch && prefixMatch[1]) {
            const prefix = prefixMatch[1];
            newContent = `${prefix}${newText}]`;
        } else {
            newContent = newText;
        }

        chat.history[messageIndex].content = newContent;
        if (chat.history[messageIndex].parts) {
        chat.history[messageIndex].parts = [{type: 'text', text: newContent}];
        }
    }

    const timestampInput = document.getElementById('message-edit-timestamp');
    if (timestampInput && timestampInput.value) {
        if (timestampInput.value !== timestampInput.dataset.originalValue) {
            const newTime = new Date(timestampInput.value).getTime();
            if (!isNaN(newTime)) {
                chat.history[messageIndex].timestamp = newTime;
                chat.history.sort((a, b) => a.timestamp - b.timestamp);
            }
        }
    }
    
    if (currentChatType === 'private') {
        recalculateChatStatus(chat);

        if (chat.statusPanel && chat.statusPanel.enabled && chat.statusPanel.regexPattern) {
            try {
                let pattern = chat.statusPanel.regexPattern;
                let flags = 'gs'; 

                const matchParts = pattern.match(/^\/(.*?)\/([a-z]*)$/);
                if (matchParts) {
                    pattern = matchParts[1];
                    flags = matchParts[2] || 'gs';
                    if (!flags.includes('s')) flags += 's';
                }

                const regex = new RegExp(pattern, flags);
                const match = regex.exec(chat.history[messageIndex].content);
                
                if (match) {
                    const rawStatus = match[0];
                    chat.statusPanel.currentStatusRaw = rawStatus;
                    
                    let html = chat.statusPanel.replacePattern;
                    
                    for (let i = 1; i < match.length; i++) {
                        html = html.replace(new RegExp(`\\$${i}`, 'g'), match[i]);
                    }
                    chat.statusPanel.currentStatusHtml = html;
                    
                    chat.history[messageIndex].isStatusUpdate = true;
                    chat.history[messageIndex].statusSnapshot = {
                        regex: pattern,
                        replacePattern: chat.statusPanel.replacePattern
                    };
                } else {
                    chat.history[messageIndex].isStatusUpdate = false;
                    delete chat.history[messageIndex].statusSnapshot;
                }
            } catch (e) {
                console.error("编辑时解析状态栏错误:", e);
            }
        }
    }

    await saveData();
    currentPage = 1;
    renderMessages(false, true);
    renderChatList();
    
    cancelMessageEdit();
}

function cancelMessageEdit() {
    editingMessageId = null;
    isRawEditMode = false; 
    const modal = document.getElementById('message-edit-modal');
    const deleteBtn = document.getElementById('debug-delete-msg-btn');
    if (deleteBtn) deleteBtn.style.display = 'none';

    const timestampInput = document.getElementById('message-edit-timestamp');
    const timestampGroup = document.getElementById('message-edit-timestamp-group');
    if (timestampInput && timestampGroup) {
        timestampInput.value = '';
        timestampGroup.style.display = 'none';
    }

    if (modal) {
        modal.classList.remove('visible');
        const title = modal.querySelector('h3');
        if (modal.dataset.originalTitle) {
            title.textContent = modal.dataset.originalTitle;
        } else {
            title.textContent = "编辑消息";
        }
    }
}

let currentMultiSelectMode = 'delete'; // 'delete' or 'capture'

function enterMultiSelectMode(initialMessageId, mode = 'delete') {
    isInMultiSelectMode = true;
    currentMultiSelectMode = mode;
    
    chatRoomHeaderDefault.style.display = 'none';
    chatRoomHeaderSelect.style.display = 'flex';
    document.querySelector('.chat-input-wrapper').style.display = 'none';
    
    if (mode === 'delete') {
        multiSelectBar.classList.add('visible');
        document.getElementById('multi-select-title').textContent = '选择消息';
    } else if (mode === 'capture') {
        document.getElementById('capture-mode-bar').classList.add('visible');
        document.getElementById('multi-select-title').textContent = '选择截图范围';
    }
    
    chatRoomScreen.classList.add('multi-select-active');
    selectedMessageIds.clear();
    if (initialMessageId) {
        toggleMessageSelection(initialMessageId);
    }
}

function exitMultiSelectMode() {
    isInMultiSelectMode = false;
    chatRoomHeaderDefault.style.display = 'flex';
    chatRoomHeaderSelect.style.display = 'none';
    document.querySelector('.chat-input-wrapper').style.display = 'block';
    
    multiSelectBar.classList.remove('visible');
    document.getElementById('capture-mode-bar').classList.remove('visible');
    
    chatRoomScreen.classList.remove('multi-select-active');
    selectedMessageIds.forEach(id => {
        const el = messageArea.querySelector(`.message-wrapper[data-id="${id}"]`);
        if (el) el.classList.remove('multi-select-selected');
    });
    selectedMessageIds.clear();
    currentMultiSelectMode = 'delete';
}

function toggleMessageSelection(messageId) {
    const el = messageArea.querySelector(`.message-wrapper[data-id="${messageId}"]`);
    if (!el) return;
    if (selectedMessageIds.has(messageId)) {
        selectedMessageIds.delete(messageId);
        el.classList.remove('multi-select-selected');
    } else {
        selectedMessageIds.add(messageId);
        el.classList.add('multi-select-selected');
    }
    
    if (currentMultiSelectMode === 'delete') {
        selectCount.textContent = `已选择 ${selectedMessageIds.size} 项`;
        deleteSelectedBtn.disabled = selectedMessageIds.size === 0;
    } else if (currentMultiSelectMode === 'capture') {
        document.getElementById('capture-select-count').textContent = `已选择 ${selectedMessageIds.size} 项`;
        // 截图模式下，即使没选也可以生成（虽然没意义，但保持逻辑简单），或者禁用
        // document.getElementById('generate-capture-btn').disabled = selectedMessageIds.size === 0;
    }
}

async function generateCapture() {
    if (selectedMessageIds.size === 0) return showToast('请至少选择一条消息');
    
    showToast('正在生成截图，请稍候...', 3000);
    
    // 1. 获取选中的消息元素并排序
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    const sortedMessages = chat.history.filter(m => selectedMessageIds.has(m.id));
    
    // 2. 创建临时容器
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.top = '-9999px';
    tempContainer.style.left = '0';
    tempContainer.style.width = '400px'; // 固定宽度模拟手机
    tempContainer.style.backgroundColor = '#f5f5f5'; // 默认背景
    if (chat.chatBg) {
        tempContainer.style.backgroundImage = `url(${chat.chatBg})`;
        tempContainer.style.backgroundSize = 'cover';
        tempContainer.style.backgroundPosition = 'center';
    } else if (chat.theme) {
        // 应用主题背景色
        const theme = colorThemes[chat.theme] || colorThemes['white_pink'];
        // 这里简单处理，如果需要更精确的主题背景，可能需要更多逻辑
    }
    
    tempContainer.style.padding = '20px';
    tempContainer.style.display = 'flex';
    tempContainer.style.flexDirection = 'column';
    
    // 3. 克隆并处理消息元素
    // 为了保证样式正确，我们需要重新渲染这些消息，或者克隆现有的 DOM
    // 这里选择重新渲染，因为现有的 DOM 可能包含多选状态的样式
    
    // 临时借用 createMessageBubbleElement，但需要注意它依赖全局状态
    // 我们可以手动构建或者克隆现有的 DOM 并移除 .multi-select-selected 类
    
    sortedMessages.forEach(msg => {
        const originalEl = messageArea.querySelector(`.message-wrapper[data-id="${msg.id}"]`);
        if (originalEl) {
            const clone = originalEl.cloneNode(true);
            clone.classList.remove('multi-select-selected');
            clone.style.marginBottom = '15px';
            
            // 处理一些可能在截图时显示不正常的元素
            // 例如：如果是 HTML 气泡，iframe 可能无法被 html2canvas 捕获
            // 这里暂时不做特殊处理，html2canvas 对 iframe 支持有限
            
            tempContainer.appendChild(clone);
        }
    });
    
    // 添加水印
    
    
    document.body.appendChild(tempContainer);
    
    try {
        // 4. 生成截图
        const canvas = await html2canvas(tempContainer, {
            useCORS: true, // 允许跨域图片
            scale: 2, // 提高清晰度
            backgroundColor: null // 透明背景
        });
        
        const imgUrl = canvas.toDataURL('image/png');
        
        // 5. 显示结果
        const previewContainer = document.getElementById('capture-preview-container');
        previewContainer.innerHTML = '';
        const img = document.createElement('img');
        img.src = imgUrl;
        previewContainer.appendChild(img);
        
        document.getElementById('capture-result-modal').classList.add('visible');
        exitMultiSelectMode();
        
    } catch (error) {
        console.error('截图生成失败:', error);
        showToast('截图生成失败，请重试');
    } finally {
        document.body.removeChild(tempContainer);
    }
}

async function deleteSelectedMessages() {
    if (selectedMessageIds.size === 0) return;
    const deletedCount = selectedMessageIds.size;
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    chat.history = chat.history.filter(m => !selectedMessageIds.has(m.id));

    if (currentChatType === 'private') {
        recalculateChatStatus(chat);
    }

    await saveData();
    currentPage = 1;
    renderMessages(false, true);
    renderChatList();
    exitMultiSelectMode();
    showToast(`已删除 ${deletedCount} 条消息`);
}

function openChatRoom(chatId, type) {
    const chat = (type === 'private') ? db.characters.find(c => c.id === chatId) : db.groups.find(g => g.id === chatId);
    if (!chat) return;

    // 迁移旧的私聊数据 (仅群聊)
    if (type === 'group' && chat.privateSessions && typeof migratePrivateSessionsToHistory === 'function') {
        migratePrivateSessionsToHistory(chat);
        saveData(); // 迁移后立即保存
    }

    if (chat.unreadCount && chat.unreadCount > 0) {
        chat.unreadCount = 0;
        saveData();
        renderChatList(); 
    }
    exitMultiSelectMode();
    cancelMessageEdit();
    chatRoomTitle.textContent = (type === 'private') ? chat.remarkName : chat.name;
    const subtitle = document.getElementById('chat-room-subtitle');
    if (type === 'private') {
        subtitle.style.display = (chat.showStatus !== false) ? 'flex' : 'none';
        chatRoomStatusText.textContent = chat.status || '在线';
    } else {
        subtitle.style.display = 'none';
    }
    getReplyBtn.style.display = 'inline-flex';
    chatRoomScreen.style.backgroundImage = chat.chatBg ? `url(${chat.chatBg})` : 'none';
    typingIndicator.style.display = 'none';
    isGenerating = false;
    getReplyBtn.disabled = false;
    currentPage = 1;
    chatRoomScreen.className = chatRoomScreen.className.replace(/\bchat-active-[^ ]+\b/g, '');
    chatRoomScreen.classList.add(`chat-active-${chatId}`);
    
    const avatarRadius = chat.avatarRadius !== undefined ? chat.avatarRadius : 50;
    document.documentElement.style.setProperty('--chat-avatar-radius', `${avatarRadius}%`);

    if (chat.bubbleBlurEnabled === false) {
        chatRoomScreen.classList.add('disable-blur');
    } else {
        chatRoomScreen.classList.remove('disable-blur');
    }

    if (chat.showTimestamp) {
        chatRoomScreen.classList.add('show-timestamp');
    } else {
        chatRoomScreen.classList.remove('show-timestamp');
    }
    chatRoomScreen.classList.remove('timestamp-side');

    chatRoomScreen.classList.remove('timestamp-style-bubble', 'timestamp-style-avatar');
    chatRoomScreen.classList.add(`timestamp-style-${chat.timestampStyle || 'bubble'}`);

    const header = document.getElementById('chat-room-header-default');
    if (chat.titleLayout === 'center') {
        header.classList.add('title-centered');
    } else {
        header.classList.remove('title-centered');
    }

    const journalBtnLabel = document.querySelector('#memory-journal-btn .expansion-item-name');
    if (journalBtnLabel) {
        journalBtnLabel.textContent = (type === 'group') ? '总结' : '日记';
    }

    const starBtn = document.getElementById('char-status-btn');
    if (starBtn) {
        if (type === 'private' && chat.statusPanel && chat.statusPanel.enabled) {
            starBtn.style.display = 'flex';
        } else {
            starBtn.style.display = 'none';
        }
    }

    const peekBtn = document.getElementById('peek-btn');
    if (peekBtn) {
        if (type === 'private') {
            peekBtn.style.display = 'flex';
            peekBtn.classList.remove('has-unread');
            const badge = document.getElementById('gossip-badge');
            if (badge) badge.style.display = 'none';
        } else {
            // 群聊
            if (chat.allowGossip) {
                peekBtn.style.display = 'flex';
                // 检查未读
                const hasUnread = Object.values(gossipUnreadMap || {}).some(count => count > 0);
                const badge = document.getElementById('gossip-badge');
                if (hasUnread) {
                    peekBtn.classList.add('has-unread');
                    if (badge) badge.style.display = 'block';
                } else {
                    peekBtn.classList.remove('has-unread');
                    if (badge) badge.style.display = 'none';
                }
            } else {
                peekBtn.style.display = 'none';
            }
        }
    }

    updateCustomBubbleStyle(chatId, chat.customBubbleCss, chat.useCustomBubbleCss);
    renderMessages(false, true);
    switchScreen('chat-room-screen');
    
    requestAnimationFrame(() => {
        void document.body.offsetHeight; 
    });
}

function renderMessages(isLoadMore = false, forceScrollToBottom = false) {
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    if (!chat || !chat.history) return;
    const oldScrollHeight = messageArea.scrollHeight;
    const totalMessages = chat.history.length;
    const end = totalMessages - (currentPage - 1) * MESSAGES_PER_PAGE;
    const start = Math.max(0, end - MESSAGES_PER_PAGE);
    const messagesToRender = chat.history.slice(start, end);
    if (!isLoadMore) messageArea.innerHTML = '';
    const fragment = document.createDocumentFragment();
    
    let lastMsgTime = 0;
    
    if (start > 0) {
        lastMsgTime = chat.history[start - 1].timestamp;
    }

    messagesToRender.forEach((msg, index) => {
        const currentMsgTime = msg.timestamp;
        const timeDiff = currentMsgTime - lastMsgTime;
        const isSameDay = new Date(currentMsgTime).toDateString() === new Date(lastMsgTime).toDateString();
        
        if (timeDiff > 10 * 60 * 1000 || !isSameDay || lastMsgTime === 0) {
            const timeDivider = document.createElement('div');
            timeDivider.className = 'message-wrapper system-notification time-divider'; 
            
            const timeText = formatTimeDivider(currentMsgTime);
            
            timeDivider.innerHTML = `<div class="system-notification-bubble" style="background-color: transparent; color: #999; font-size: 12px; padding: 2px 8px;">${timeText}</div>`;
            fragment.appendChild(timeDivider);
        }
        lastMsgTime = currentMsgTime;

        let isContinuous = false;
        
        let invisibleRegex;
        if (chat.showStatusUpdateMsg) {
            invisibleRegex = /\[.*?(?:接收|退回).*?的转账\]|\[.*?已接收礼物\]|\[system:.*?\]|\[.*?邀请.*?加入了群聊\]|\[.*?修改群名为：.*?\]|\[system-display:.*?\]/;
        } else {
            invisibleRegex = /\[.*?(?:接收|退回).*?的转账\]|\[.*?更新状态为：.*?\]|\[.*?已接收礼物\]|\[system:.*?\]|\[.*?邀请.*?加入了群聊\]|\[.*?修改群名为：.*?\]|\[system-display:.*?\]/;
        }

        const isSystemMsg = /\[system:.*?\]|\[system-display:.*?\]/.test(msg.content);
        
        if (!isSystemMsg) {
            let prevMsg = null;
            let currentIndexInHistory = start + index;
            
            for (let i = currentIndexInHistory - 1; i >= 0; i--) {
                const candidate = chat.history[i];
                if (!invisibleRegex.test(candidate.content)) {
                    prevMsg = candidate;
                    break;
                }
            }

            if (prevMsg) {
                const currentSender = msg.role === 'user' ? 'user' : (msg.senderId || 'assistant');
                const prevSender = prevMsg.role === 'user' ? 'user' : (prevMsg.senderId || 'assistant');
                
                const timeGap = msg.timestamp - prevMsg.timestamp;
                const isTimeClose = timeGap < 10 * 60 * 1000;

                if (currentSender === prevSender && isTimeClose) {
                    isContinuous = true;
                }
            }
        }

        const bubble = createMessageBubbleElement(msg, isContinuous);
        if (bubble) fragment.appendChild(bubble);
    });
    const existingLoadBtn = document.getElementById('load-more-btn');
    if (existingLoadBtn) existingLoadBtn.remove();
    messageArea.prepend(fragment);
    if (totalMessages > currentPage * MESSAGES_PER_PAGE) {
        const loadMoreButton = document.createElement('button');
        loadMoreButton.id = 'load-more-btn';
        loadMoreButton.className = 'load-more-btn';
        loadMoreButton.textContent = '加载更早的消息';
        messageArea.prepend(loadMoreButton);
    }
    if (forceScrollToBottom) {
        setTimeout(() => {
            messageArea.scrollTop = messageArea.scrollHeight;
        }, 0);
    } else if (isLoadMore) {
        messageArea.scrollTop = messageArea.scrollHeight - oldScrollHeight;
    }
}

function loadMoreMessages() {
    currentPage++;
    renderMessages(true, false);
}

function createMessageBubbleElement(message, isContinuous = false) {
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    const {role, content, timestamp, id, transferStatus, giftStatus, stickerData, senderId, quote, isWithdrawn, originalContent, isStatusUpdate} = message;
    
    if (isStatusUpdate && !isDebugMode) return null;

    const avatarMode = chat.avatarMode || 'full';
    let avatarClass = 'message-avatar';
    
    if (avatarMode === 'hidden') {
        avatarClass += ' avatar-hidden';
    } else if (avatarMode === 'kkt') {
        if (role === 'user') {
            avatarClass += ' avatar-hidden';
        } else if (isContinuous) {
            avatarClass += ' avatar-invisible';
        }
    } else if (avatarMode === 'merge') {
        if (isContinuous) {
            avatarClass += ' avatar-invisible';
        }
    }

    const isBilingualMode = chat.bilingualModeEnabled;
    let bilingualMatch = null;
    if (isBilingualMode && role === 'assistant') {
        const contentMatch = content.match(/^\[.*?的消息：([\s\S]+)\]$/);
        if (contentMatch) {
            const mainText = contentMatch[1].trim();
            
            // 优先尝试匹配「」
            const lastCloseBracket = mainText.lastIndexOf('」');
            if (lastCloseBracket > -1) {
                const lastOpenBracket = mainText.lastIndexOf('「', lastCloseBracket);
                if (lastOpenBracket > -1) {
                    const chineseText = mainText.substring(lastOpenBracket + 1, lastCloseBracket).trim();
                    const foreignText = mainText.substring(0, lastOpenBracket).trim();
                    if (foreignText && chineseText) {
                        bilingualMatch = [null, foreignText, chineseText];
                    }
                }
            }

            // 如果没有匹配到「」，则回退匹配 () 或 （）以兼容旧消息
            if (!bilingualMatch) {
                const lastCloseParen = Math.max(mainText.lastIndexOf(')'), mainText.lastIndexOf('）'));
                if (lastCloseParen > -1) {
                    const lastOpenParen = Math.max(
                        mainText.lastIndexOf('(', lastCloseParen),
                        mainText.lastIndexOf('（', lastCloseParen)
                    );
                    if (lastOpenParen > -1) {
                        const chineseText = mainText.substring(lastOpenParen + 1, lastCloseParen).trim();
                        const foreignText = mainText.substring(0, lastOpenParen).trim();
                        if (foreignText && chineseText) {
                            bilingualMatch = [null, foreignText, chineseText];
                        }
                    }
                }
            }
        }
    }

    if (bilingualMatch) {
        const foreignText = bilingualMatch[1].trim();
        const chineseText = bilingualMatch[2].trim();
        const wrapper = document.createElement('div');
        wrapper.dataset.id = id;
        wrapper.className = 'message-wrapper received';
        const bubbleRow = document.createElement('div');
        bubbleRow.className = 'message-bubble-row';
        const avatarUrl = chat.avatar;
        const timeString = `${pad(new Date(timestamp).getHours())}:${pad(new Date(timestamp).getMinutes())}`;
        
        const bubbleElement = document.createElement('div');
        bubbleElement.className = 'message-bubble received bilingual-bubble';
        
        const styleMode = chat.bilingualBubbleStyle || 'under';
        
        if (styleMode === 'inner' || styleMode === 'inner-no-line') {
            if (styleMode === 'inner-no-line') {
                bubbleElement.classList.add('inner-no-line-style');
            } else {
                bubbleElement.classList.add('inner-style');
            }
            
            bubbleElement.innerHTML = `
                <span>${DOMPurify.sanitize(foreignText)}</span>
                <div class="bilingual-divider"></div>
                <span class="translation-inner">${DOMPurify.sanitize(chineseText)}</span>
            `;
        } else {
            bubbleElement.innerHTML = `<span>${DOMPurify.sanitize(foreignText)}</span>`;
        }

        const themeKey = chat.theme || 'white_pink';
        const theme = colorThemes[themeKey] || colorThemes['white_pink'];
        const bubbleTheme = theme.received;
        if (!chat.useCustomBubbleCss) {
            bubbleElement.style.backgroundColor = bubbleTheme.bg;
            bubbleElement.style.color = bubbleTheme.text;
        }
        
        // Time Stamp Logic for Bilingual
        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        timeSpan.textContent = timeString;
        bubbleElement.appendChild(timeSpan);

        bubbleRow.innerHTML = `<div class="message-info"><img src="${avatarUrl}" class="${avatarClass}"></div>`;
        bubbleRow.appendChild(bubbleElement);
        wrapper.appendChild(bubbleRow);

        if (styleMode === 'under') {
            const translationDiv = document.createElement('div');
            translationDiv.className = 'translation-text';
            translationDiv.textContent = chineseText;
            wrapper.appendChild(translationDiv);
        }
        
        return wrapper;
    }

    const timeSkipRegex = /\[system-display:([\s\S]+?)\]/;
    const inviteRegex = /\[(.*?)邀请(.*?)加入了群聊\]/;
    const renameRegex = /\[(.*?)修改群名为：(.*?)\]/;
    const updateStatusRegex = /\[(.*?)更新状态为：(.*?)\]/;
    const timeSkipMatch = content.match(timeSkipRegex);
    const inviteMatch = content.match(inviteRegex);
    const renameMatch = content.match(renameRegex);
    const updateStatusMatch = content.match(updateStatusRegex);

    // 私聊消息正则
    const privateRegex = /^\[Private: (.*?) -> (.*?): ([\s\S]+?)\]$/;
    const privateEndRegex = /^\[Private-End: (.*?) -> (.*?)\]$/;

    let invisibleRegex;
    if (chat.showStatusUpdateMsg) {
        invisibleRegex = /\[.*?(?:接收|退回).*?的转账\]|\[.*?已接收礼物\]|\[system:.*?\]|\[系统情景通知：.*?\]/;
    } else {
        invisibleRegex = /\[.*?(?:接收|退回).*?的转账\]|\[.*?更新状态为：.*?\]|\[.*?已接收礼物\]|\[system:.*?\]|\[系统情景通知：.*?\]/;
    }

    let isDebugHiddenMsg = false;
    if (invisibleRegex.test(content) || privateRegex.test(content) || privateEndRegex.test(content)) {
        if (!isDebugMode) return null; 
        isDebugHiddenMsg = true;       
    }

    const wrapper = document.createElement('div');
    wrapper.dataset.id = id;
    if (isDebugHiddenMsg) {
        wrapper.className = 'message-wrapper received'; 
        const bubbleRow = document.createElement('div');
        bubbleRow.className = 'message-bubble-row';
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble debug-visible'; 
        bubble.textContent = content; 
        bubbleRow.appendChild(bubble);
        wrapper.appendChild(bubbleRow);
        return wrapper;
    }

    if (isWithdrawn) {
        wrapper.className = 'message-wrapper system-notification';
        const withdrawnText = (role === 'user') ? '你撤回了一条消息' : `${chat.remarkName || chat.name}撤回了一条消息`;
        wrapper.innerHTML = `<div><span class="withdrawn-message">${withdrawnText}</span></div><div class="withdrawn-content">${originalContent ? DOMPurify.sanitize(originalContent.replace(/\[.*?的消息：([\s\S]+?)\]/, '$1')) : ''}</div>`;
        const withdrawnMessageSpan = wrapper.querySelector('.withdrawn-message');
        if (withdrawnMessageSpan) {
            withdrawnMessageSpan.addEventListener('click', () => {
                const withdrawnContent = wrapper.querySelector('.withdrawn-content');
                if (withdrawnContent && withdrawnContent.textContent.trim()) {
                    withdrawnContent.classList.toggle('active');
                }
            });
        }
        return wrapper;
    }
    if (timeSkipMatch || inviteMatch || renameMatch || (updateStatusMatch && chat.showStatusUpdateMsg)) {
        wrapper.className = 'message-wrapper system-notification';
        let bubbleText = '';
        if (timeSkipMatch) bubbleText = timeSkipMatch[1];
        if (inviteMatch) bubbleText = `${inviteMatch[1]}邀请${inviteMatch[2]}加入了群聊`;
        if (renameMatch) bubbleText = `${renameMatch[1]}修改群名为“${renameMatch[2]}”`;
        if (updateStatusMatch) bubbleText = `${updateStatusMatch[1]} 更新状态为：${updateStatusMatch[2]}`;
        wrapper.innerHTML = `<div class="system-notification-bubble">${bubbleText}</div>`;
        return wrapper;
    }
    const isSent = (role === 'user');
    let avatarUrl, bubbleTheme, senderNickname = '';
    const themeKey = chat.theme || 'white_pink';
    const theme = colorThemes[themeKey] || colorThemes['white_pink'];
    let messageSenderId = isSent ? 'user_me' : senderId;
    if (isSent) {
        avatarUrl = (currentChatType === 'private') ? chat.myAvatar : chat.me.avatar;
        bubbleTheme = theme.sent;
    } else {
        if (currentChatType === 'private') {
            avatarUrl = chat.avatar;
        } else {
            const sender = chat.members.find(m => m.id === senderId);
            if (sender) {
                avatarUrl = sender.avatar;
                senderNickname = sender.groupNickname;
            } else {
                avatarUrl = 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg';
            }
        }
        bubbleTheme = theme.received;
    }
    const timeString = `${pad(new Date(timestamp).getHours())}:${pad(new Date(timestamp).getMinutes())}`;
    wrapper.className = `message-wrapper ${isSent ? 'sent' : 'received'}`;
    if (currentChatType === 'group' && !isSent) {
        wrapper.classList.add('group-message');
    }
    if (avatarClass.includes('avatar-hidden')) {
        wrapper.classList.add('no-avatar-layout');
    }
    if (avatarClass.includes('avatar-invisible')) {
        wrapper.classList.add('avatar-invisible-layout');
    }
    const bubbleRow = document.createElement('div');
    bubbleRow.className = 'message-bubble-row';
    let bubbleElement;
    const urlRegex = /^(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|bmp|svg)|data:image\/[a-z]+;base64,)/i;
    
    const sentStickerRegex = /\[(?:.+?)发送的表情包：(.+?)\]/i;
    const receivedStickerRegex = /\[(?:.*?的)?表情包：(.+?)\]/i;
    
    const voiceRegex = /\[(?:.+?)的语音：([\s\S]+?)\]/;
    const photoVideoRegex = /\[(?:.+?)发来的照片\/视频：([\s\S]+?)\]/;
    const privateSentTransferRegex = /\[.*?给你转账：([\d.,]+)元；备注：(.*?)\]/;
    const privateReceivedTransferRegex = /\[.*?的转账：([\d.,]+)元；备注：(.*?)\]/;
    const groupTransferRegex = /\[(.*?)\s*向\s*(.*?)\s*转账：([\d.,]+)元；备注：(.*?)\]/;
    const privateGiftRegex = /\[(?:.+?)送来的礼物：([\s\S]+?)\]/;
    const groupGiftRegex = /\[(.*?)\s*向\s*(.*?)\s*送来了礼物：([\s\S]+?)\]/;
    const imageRecogRegex = /\[.*?发来了一张图片：\]/;
    const textRegex = /\[(?:.+?)的消息：([\s\S]+?)\]/;
    const pomodoroRecordRegex = /\[专注记录\]\s*任务：([\s\S]+?)，时长：([\s\S]+?)，期间与 .*? 互动 (\d+)\s*次。/;
    const pomodoroMatch = content.match(pomodoroRecordRegex);
    const sentStickerMatch = content.match(sentStickerRegex);
    const receivedStickerMatch = content.match(receivedStickerRegex);
    const voiceMatch = content.match(voiceRegex);
    const photoVideoMatch = content.match(photoVideoRegex);
    const privateSentTransferMatch = content.match(privateSentTransferRegex);
    const privateReceivedTransferMatch = content.match(privateReceivedTransferRegex);
    const groupTransferMatch = content.match(groupTransferRegex);
    const privateGiftMatch = content.match(privateGiftRegex);
    const groupGiftMatch = content.match(groupGiftRegex);
    const imageRecogMatch = content.match(imageRecogRegex);
    const textMatch = content.match(textRegex);
    
    if (pomodoroMatch) {
        const taskName = pomodoroMatch[1];
        const duration = pomodoroMatch[2];
        const pokeCount = pomodoroMatch[3];
        bubbleElement = document.createElement('div');
        bubbleElement.className = 'pomodoro-record-card';
        const details = { taskName, duration, pokeCount };
        bubbleElement.innerHTML = `<img src="https://i.postimg.cc/sgdS9khZ/chan-122.png" class="pomodoro-record-icon" alt="pomodoro complete"><div class="pomodoro-record-body"><p class="task-name">${taskName}</p></div>`;
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'pomodoro-record-details';
        detailsDiv.innerHTML = `<p><strong>任务名称:</strong> ${taskName}</p><p><strong>专注时长:</strong> ${duration}</p><p><strong>“戳一戳”次数:</strong> ${pokeCount}</p>`;
        wrapper.appendChild(detailsDiv);
        bubbleElement.addEventListener('click', () => {
            detailsDiv.classList.toggle('active');
        });
    } else if ((isSent && sentStickerMatch) || (!isSent && receivedStickerMatch)) {
        bubbleElement = document.createElement('div');
        bubbleElement.className = 'image-bubble';
        let stickerSrc = '';
        
        if (isSent && stickerData) {
            stickerSrc = stickerData;
        } else {
            const stickerName = isSent ? sentStickerMatch[1].trim() : receivedStickerMatch[1].trim();
            
            const groups = (chat.stickerGroups || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
            
            let targetSticker = null;
            if (groups.length > 0) {
                targetSticker = db.myStickers.find(s => groups.includes(s.group) && s.name === stickerName);
            }
            
            if (!targetSticker) {
                targetSticker = db.myStickers.find(s => s.name === stickerName);
            }
            
            if (targetSticker) {
                stickerSrc = targetSticker.data;
            } else {
                stickerSrc = 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg'; 
            }
        }
        bubbleElement.innerHTML = `<img src="${stickerSrc}" alt="表情包">`;
    } else if (privateGiftMatch || groupGiftMatch) {
        const match = privateGiftMatch || groupGiftMatch;
        bubbleElement = document.createElement('div');
        bubbleElement.className = 'gift-card';
        if (giftStatus === 'received') {
            bubbleElement.classList.add('received');
        }
        let giftText;
        if (groupGiftMatch) {
            const from = groupGiftMatch[1];
            const to = groupGiftMatch[2];
            giftText = isSent ? `你送给 ${to} 的礼物` : `${from} 送给 ${to} 的礼物`;
        } else {
            giftText = isSent ? '您有一份礼物～' : '您有一份礼物～';
        }
        bubbleElement.innerHTML = `<img src="https://i.postimg.cc/rp0Yg31K/chan-75.png" alt="gift" class="gift-card-icon"><div class="gift-card-text">${giftText}</div><div class="gift-card-received-stamp">已查收</div>`;
        const description = groupGiftMatch ? groupGiftMatch[3].trim() : match[1].trim();
        const descriptionDiv = document.createElement('div');
        descriptionDiv.className = 'gift-card-description';
        descriptionDiv.textContent = description;
        wrapper.appendChild(descriptionDiv);
    } else if (content.startsWith('[论坛分享]')) {
        const forumShareRegex = /\[论坛分享\]标题：([\s\S]+?)\n摘要：([\s\S]+)/;
        const forumShareMatch = content.match(forumShareRegex);
        if (forumShareMatch) {
            const title = forumShareMatch[1].trim();
            const summary = forumShareMatch[2].trim();
            bubbleElement = document.createElement('div');
            bubbleElement.className = 'forum-share-card';
            bubbleElement.innerHTML = `<div class="forum-share-header"><svg viewBox="0 0 24 24"><path d="M21,3H3A2,2 0 0,0 1,5V19A2,2 0 0,0 3,21H21A2,2 0 0,0 23,19V5A2,2 0 0,0 21,3M21,19H3V5H21V19M8,11H16V9H8V11M8,15H13V13H8V15Z" /></svg><span>来自论坛的分享</span></div><div class="forum-share-content"><div class="forum-share-title">${title}</div><div class="forum-share-summary">${summary}</div></div>`;
        }
    } else if (voiceMatch) {
        bubbleElement = document.createElement('div');
        bubbleElement.className = 'voice-bubble';
        if (!chat.useCustomBubbleCss) {
            bubbleElement.style.backgroundColor = bubbleTheme.bg;
            bubbleElement.style.color = bubbleTheme.text;
        }
        bubbleElement.innerHTML = `<svg class="play-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg><span class="duration">${calculateVoiceDuration(voiceMatch[1].trim())}"</span>`;
        const transcriptDiv = document.createElement('div');
        transcriptDiv.className = 'voice-transcript';
        transcriptDiv.textContent = voiceMatch[1].trim();
        wrapper.appendChild(transcriptDiv);
    } else if (photoVideoMatch) {
        const pvContent = photoVideoMatch[1].trim();
        let isRealPhoto = false;
        let realPhotoUrl = '';

        // 检查真实相册匹配
        if (currentChatType === 'private' && !isSent && chat.useRealGallery && chat.gallery) {
            const galleryItem = chat.gallery.find(item => item.name === pvContent);
            if (galleryItem) {
                isRealPhoto = true;
                realPhotoUrl = galleryItem.url;
            }
        }

        if (isRealPhoto) {
            bubbleElement = document.createElement('div');
            bubbleElement.className = 'image-bubble';
            bubbleElement.innerHTML = `<img src="${realPhotoUrl}" alt="${pvContent}">`;
        } else {
            bubbleElement = document.createElement('div');
            bubbleElement.className = 'pv-card';
            bubbleElement.innerHTML = `<div class="pv-card-content">${pvContent}</div><div class="pv-card-image-overlay" style="background-image: url('${isSent ? 'https://i.postimg.cc/L8NFrBrW/1752307494497.jpg' : 'https://i.postimg.cc/1tH6ds9g/1752301200490.jpg'}');"></div><div class="pv-card-footer"><svg viewBox="0 0 24 24"><path d="M4,4H20A2,2 0 0,1 22,6V18A2,2 0 0,1 20,20H4A2,2 0 0,1 2,18V6A2,2 0 0,1 4,4M4,6V18H20V6H4M10,9A1,1 0 0,1 11,10A1,1 0 0,1 10,11A1,1 0 0,1 9,10A1,1 0 0,1 10,9M8,17L11,13L13,15L17,10L20,14V17H8Z"></path></svg><span>照片/视频・点击查看</span></div>`;
        }
    } else if (privateSentTransferMatch || privateReceivedTransferMatch || groupTransferMatch) {
        const isSentTransfer = !!privateSentTransferMatch || (groupTransferMatch && isSent);
        const match = privateSentTransferMatch || privateReceivedTransferMatch || groupTransferMatch;
        let amount, remarkText, titleText;
        if (groupTransferMatch) {
            const from = groupTransferMatch[1];
            const to = groupTransferMatch[2];
            amount = parseFloat(groupTransferMatch[3].replace(/,/g, '')).toFixed(2);
            remarkText = groupTransferMatch[4] || '';
            
            const myName = (currentChatType === 'private') ? chat.myName : chat.me.nickname;
            const isToMe = (to === myName);

            if (isSent) {
                titleText = `向 ${to} 转账`;
            } else {
                if (isToMe) {
                    titleText = `${from} 向你转账`;
                } else {
                    titleText = `${from} 向 ${to} 转账`;
                }
            }
        } else {
            amount = parseFloat(match[1].replace(/,/g, '')).toFixed(2);
            remarkText = match[2] || '';
            titleText = isSentTransfer ? '给你转账' : '转账';
        }
        bubbleElement = document.createElement('div');
        bubbleElement.className = `transfer-card ${isSentTransfer ? 'sent-transfer' : 'received-transfer'}`;
        
        let statusText = isSentTransfer ? '待查收' : '转账给你';
        if (groupTransferMatch && !isSent) {
            const to = groupTransferMatch[2];
            const myName = (currentChatType === 'private') ? chat.myName : chat.me.nickname;
            if (to === myName) {
                statusText = '转账给你';
            } else {
                statusText = '转账给Ta';
            }
        }
        
        if (transferStatus === 'received') {
            statusText = '已收款';
            bubbleElement.classList.add('received');
        } else if (transferStatus === 'returned') {
            statusText = '已退回';
            bubbleElement.classList.add('returned');
        }
        if ((transferStatus !== 'pending' && currentChatType === 'private') || currentChatType === 'group') {
            bubbleElement.style.cursor = 'default';
        }
        const remarkHTML = remarkText ? `<p class="transfer-remark">${remarkText}</p>` : '';
        bubbleElement.innerHTML = `<div class="overlay"></div><div class="transfer-content"><p class="transfer-title">${titleText}</p><p class="transfer-amount">¥${amount}</p>${remarkHTML}<p class="transfer-status">${statusText}</p></div>`;
    } else if (imageRecogMatch || urlRegex.test(content)) {
        bubbleElement = document.createElement('div');
        bubbleElement.className = 'image-bubble';
        bubbleElement.innerHTML = `<img src="${content}" alt="图片消息">`;
    } else if (textMatch) {
        bubbleElement = document.createElement('div');
        bubbleElement.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
        let userText = textMatch[1].trim().replace(/\[发送时间:.*?\]/g, '').trim();
        bubbleElement.innerHTML = `<span class="bubble-content">${DOMPurify.sanitize(userText)}</span>`;
        if (!chat.useCustomBubbleCss) {
            bubbleElement.style.backgroundColor = bubbleTheme.bg;
            bubbleElement.style.color = bubbleTheme.text;
        }
    } else if (message && Array.isArray(message.parts) && message.parts[0].type === 'html') {
        bubbleElement = document.createElement('div');
        bubbleElement.className = `message-bubble ${isSent ? 'sent' : 'received'} html-bubble`;
        const htmlContent = message.parts[0].text;
        if (htmlContent.includes('<!DOCTYPE html>') || htmlContent.includes('<html')) {
            bubbleElement.innerHTML = `<iframe srcdoc="${htmlContent.replace(/"/g, '"')}" style="width: 100%; min-width: 250px; height: 350px; border: none; background: white; border-radius: 10px;"></iframe>`;
        } else {
            bubbleElement.innerHTML = DOMPurify.sanitize(htmlContent, { ADD_TAGS: ['style'], ADD_ATTR: ['style'] });
        }
    } else {
        bubbleElement = document.createElement('div');
        bubbleElement.className = `message-bubble ${isSent ? 'sent' : 'received'}`;
        let displayedContent = content;
        const plainTextMatch = content.match(/^\[.*?：([\s\S]*)\]$/);
        if (plainTextMatch && plainTextMatch[1]) {
            displayedContent = plainTextMatch[1].trim();
        }
        displayedContent = displayedContent.replace(/\[发送时间:.*?\]/g, '').trim();

        if (currentChatType === 'private' && !isSent && chat.statusPanel && chat.statusPanel.enabled && chat.statusPanel.regexPattern && !isDebugMode) {
            try {
                let pattern = chat.statusPanel.regexPattern;
                let flags = 'gs';

                const matchParts = pattern.match(/^\/(.*?)\/([a-z]*)$/);
                if (matchParts) {
                    pattern = matchParts[1];
                    flags = matchParts[2] || 'gs';
                    if (!flags.includes('g')) flags += 'g';
                }

                const regex = new RegExp(pattern, flags);
                displayedContent = displayedContent.replace(regex, '').trim();
            } catch (e) {
                console.error("渲染时隐藏状态码失败:", e);
            }
        }

        bubbleElement.innerHTML = `<span class="bubble-content">${DOMPurify.sanitize(displayedContent)}</span>`;
        if (!chat.useCustomBubbleCss) {
            bubbleElement.style.backgroundColor = bubbleTheme.bg;
            bubbleElement.style.color = bubbleTheme.text;
        }
    }
    const nicknameHTML = (currentChatType === 'group' && !isSent && senderNickname) ? `<div class="group-nickname">${senderNickname}</div>` : '';

    // Time Stamp Logic
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    timeSpan.textContent = timeString;

    const timestampStyle = chat.timestampStyle || 'bubble';

    // Append Time Stamp to Bubble (if style is bubble)
    if (bubbleElement && timestampStyle === 'bubble') {
        bubbleElement.appendChild(timeSpan);
    }
    
    // Create message-info element manually to allow appending timestamp if needed
    const messageInfo = document.createElement('div');
    messageInfo.className = 'message-info';
    const avatarImg = document.createElement('img');
    avatarImg.src = avatarUrl;
    avatarImg.className = avatarClass;
    messageInfo.appendChild(avatarImg);

    if (timestampStyle === 'avatar') {
        messageInfo.appendChild(timeSpan);
    }

    if (currentChatType === 'group' && !isSent) {
        // 群聊接收消息布局：头像左侧，右侧垂直排列昵称和气泡
        const contentContainer = document.createElement('div');
        contentContainer.className = 'group-msg-content';
        
        if (nicknameHTML) {
            contentContainer.innerHTML += nicknameHTML;
        }
        
        if (bubbleElement) {
            if (quote) {
                let quotedSenderName = '';
                if (quote.senderId === 'user_me') {
                    quotedSenderName = (currentChatType === 'private') ? chat.myName : chat.me.nickname;
                } else {
                    if (currentChatType === 'private') {
                        quotedSenderName = chat.remarkName;
                    } else {
                        const sender = chat.members.find(m => m.id === quote.senderId);
                        quotedSenderName = sender ? sender.groupNickname : '未知成员';
                    }
                }
                const quoteDiv = document.createElement('div');
                quoteDiv.className = 'quoted-message';
                const sanitizedQuotedText = DOMPurify.sanitize(quote.content, { ALLOWED_TAGS: [] });
                quoteDiv.innerHTML = `<span class="quoted-sender">回复 ${quotedSenderName}</span><p class="quoted-text">${sanitizedQuotedText}</p>`;
                bubbleElement.prepend(quoteDiv);
            }
            contentContainer.appendChild(bubbleElement);
        }
        
        bubbleRow.appendChild(messageInfo);
        bubbleRow.appendChild(contentContainer);
    } else {
        // 私聊或发送消息布局：保持原样
        bubbleRow.appendChild(messageInfo);
        
        if (bubbleElement) {
            if (quote) {
                let quotedSenderName = '';
                if (quote.senderId === 'user_me') {
                    quotedSenderName = (currentChatType === 'private') ? chat.myName : chat.me.nickname;
                } else {
                    if (currentChatType === 'private') {
                        quotedSenderName = chat.remarkName;
                    } else {
                        const sender = chat.members.find(m => m.id === quote.senderId);
                        quotedSenderName = sender ? sender.groupNickname : '未知成员';
                    }
                }
                const quoteDiv = document.createElement('div');
                quoteDiv.className = 'quoted-message';
                const sanitizedQuotedText = DOMPurify.sanitize(quote.content, { ALLOWED_TAGS: [] });
                quoteDiv.innerHTML = `<span class="quoted-sender">回复 ${quotedSenderName}</span><p class="quoted-text">${sanitizedQuotedText}</p>`;
                bubbleElement.prepend(quoteDiv);
            }
            bubbleRow.appendChild(bubbleElement);
        }
    }
    wrapper.prepend(bubbleRow);
    return wrapper;
}

function addMessageBubble(message, targetChatId, targetChatType) {
    if (targetChatId !== currentChatId || targetChatType !== currentChatType) {
        const senderChat = (targetChatType === 'private')
            ? db.characters.find(c => c.id === targetChatId)
            : db.groups.find(g => g.id === targetChatId);
        
        if (senderChat) {
            let invisibleRegex;
            if (senderChat.showStatusUpdateMsg) {
                invisibleRegex = /\[system:.*?\]|\[.*?已接收礼物\]|\[.*?(?:接收|退回).*?的转账\]/;
            } else {
                invisibleRegex = /\[system:.*?\]|\[.*?更新状态为：.*?\]|\[.*?已接收礼物\]|\[.*?(?:接收|退回).*?的转账\]/;
            }
            if (!invisibleRegex.test(message.content)) {
                senderChat.unreadCount = (senderChat.unreadCount || 0) + 1;
                saveData(); 
                renderChatList(); 
            }
            
            let senderName, senderAvatar;
            if (targetChatType === 'private') {
                senderName = senderChat.remarkName;
                senderAvatar = senderChat.avatar;
            } else { 
                const sender = senderChat.members.find(m => m.id === message.senderId);
                if (sender) {
                    senderName = sender.groupNickname;
                    senderAvatar = sender.avatar;
                } else { 
                    senderName = senderChat.name;
                    senderAvatar = senderChat.avatar;
                }
            }

            let previewText = message.content;

            const textMatch = previewText.match(/\[.*?的消息：([\s\S]+?)\]/);
            if (textMatch) {
                previewText = textMatch[1];
            } else {
                if (/\[.*?的表情包：.*?\]/.test(previewText)) previewText = '[表情包]';
                else if (/\[.*?的语音：.*?\]/.test(previewText)) previewText = '[语音]';
                else if (/\[.*?发来的照片\/视频：.*?\]/.test(previewText)) previewText = '[照片/视频]';
                else if (/\[.*?的转账：.*?\]/.test(previewText) || /\[.*?向.*?转账：.*?\]/.test(previewText)) previewText = '[转账]';
                else if (/\[.*?送来的礼物：.*?\]/.test(previewText)) previewText = '[礼物]';
                else if (/\[.*?发来了一张图片：\]/.test(previewText)) previewText = '[图片]';
                else if (message.parts && message.parts.some(p => p.type === 'html')) previewText = '[互动]';
            }
            
            showToast({
                avatar: senderAvatar,
                name: senderName,
                message: previewText.substring(0, 30)
            });
        }
        return; 
    }

    if (currentChatType === 'private') {
        const character = db.characters.find(c => c.id === currentChatId);
        const updateStatusRegex = new RegExp(`\\[${character.realName}更新状态为：(.*?)\\]`);
        const transferActionRegex = new RegExp(`\\[${character.realName}(接收|退回)${character.myName}的转账\\]`);
        const giftReceivedRegex = new RegExp(`\\[${character.realName}已接收礼物\\]`);
        
        if (message.content.match(updateStatusRegex)) {
            character.status = message.content.match(updateStatusRegex)[1];
            chatRoomStatusText.textContent = character.status;
            if (!character.showStatusUpdateMsg) {
                return;
            }
        }
        if (message.content.match(giftReceivedRegex) && message.role === 'assistant') {
            const lastPendingGiftIndex = character.history.slice().reverse().findIndex(m => m.role === 'user' && m.content.includes('送来的礼物：') && m.giftStatus !== 'received');
            if (lastPendingGiftIndex !== -1) {
                const actualIndex = character.history.length - 1 - lastPendingGiftIndex;
                const giftMsg = character.history[actualIndex];
                giftMsg.giftStatus = 'received';
                const giftCardOnScreen = messageArea.querySelector(`.message-wrapper[data-id="${giftMsg.id}"] .gift-card`);
                if (giftCardOnScreen) {
                    giftCardOnScreen.classList.add('received');
                }
            }
            return;
        }
        if (message.content.match(transferActionRegex) && message.role === 'assistant') {
            const action = message.content.match(transferActionRegex)[1];
            const statusToSet = action === '接收' ? 'received' : 'returned';
            const lastPendingTransferIndex = character.history.slice().reverse().findIndex(m => m.role === 'user' && m.content.includes('给你转账：') && m.transferStatus === 'pending');
            if (lastPendingTransferIndex !== -1) {
                const actualIndex = character.history.length - 1 - lastPendingTransferIndex;
                const transferMsg = character.history[actualIndex];
                transferMsg.transferStatus = statusToSet;
                const transferCardOnScreen = messageArea.querySelector(`.message-wrapper[data-id="${transferMsg.id}"] .transfer-card`);
                if (transferCardOnScreen) {
                    transferCardOnScreen.classList.remove('received', 'returned');
                    transferCardOnScreen.classList.add(statusToSet);
                    const statusElem = transferCardOnScreen.querySelector('.transfer-status');
                    if (statusElem) statusElem.textContent = statusToSet === 'received' ? '已收款' : '已退回';
                }
            }
        } else {
            let isContinuous = false;
            let invisibleRegex;
            if (character.showStatusUpdateMsg) {
                invisibleRegex = /\[.*?(?:接收|退回).*?的转账\]|\[.*?已接收礼物\]|\[system:.*?\]|\[.*?邀请.*?加入了群聊\]|\[.*?修改群名为：.*?\]|\[system-display:.*?\]/;
            } else {
                invisibleRegex = /\[.*?(?:接收|退回).*?的转账\]|\[.*?更新状态为：.*?\]|\[.*?已接收礼物\]|\[system:.*?\]|\[.*?邀请.*?加入了群聊\]|\[.*?修改群名为：.*?\]|\[system-display:.*?\]/;
            }
            const isSystemMsg = /\[system:.*?\]|\[system-display:.*?\]/.test(message.content);

            if (!isSystemMsg && character.history.length > 1) {
                let prevMsg = null;
                for (let i = character.history.length - 2; i >= 0; i--) {
                    const candidate = character.history[i];
                    if (!invisibleRegex.test(candidate.content)) {
                        prevMsg = candidate;
                        break;
                    }
                }

                if (prevMsg) {
                    const currentSender = message.role === 'user' ? 'user' : (message.senderId || 'assistant');
                    const prevSender = prevMsg.role === 'user' ? 'user' : (prevMsg.senderId || 'assistant');
                    const timeGap = message.timestamp - prevMsg.timestamp;
                    const isTimeClose = timeGap < 10 * 60 * 1000;

                    if (currentSender === prevSender && isTimeClose) {
                        isContinuous = true;
                    }
                }
            }

            const bubbleElement = createMessageBubbleElement(message, isContinuous);
            if (bubbleElement) {
                // Check for timestamp display
                const history = character.history;
                let shouldShowTimestamp = false;
                if (history.length >= 2) {
                    const prevMsg = history[history.length - 2];
                    const timeDiff = message.timestamp - prevMsg.timestamp;
                    const isSameDay = new Date(message.timestamp).toDateString() === new Date(prevMsg.timestamp).toDateString();
                    if (timeDiff > 10 * 60 * 1000 || !isSameDay) {
                        shouldShowTimestamp = true;
                    }
                } else if (history.length === 1) {
                    shouldShowTimestamp = true;
                }

                if (shouldShowTimestamp) {
                    const timeDivider = document.createElement('div');
                    timeDivider.className = 'message-wrapper system-notification time-divider';
                    const timeText = formatTimeDivider(message.timestamp);
                    timeDivider.innerHTML = `<div class="system-notification-bubble" style="background-color: transparent; color: #999; font-size: 12px; padding: 2px 8px;">${timeText}</div>`;
                    messageArea.appendChild(timeDivider);
                }

                messageArea.appendChild(bubbleElement);
                messageArea.scrollTop = messageArea.scrollHeight;
            }
        }
    } else { 
        const group = db.groups.find(g => g.id === currentChatId);
        let isContinuous = false;
        let invisibleRegex;
        if (group.showStatusUpdateMsg) {
            invisibleRegex = /\[.*?(?:接收|退回).*?的转账\]|\[.*?已接收礼物\]|\[system:.*?\]|\[.*?邀请.*?加入了群聊\]|\[.*?修改群名为：.*?\]|\[system-display:.*?\]/;
        } else {
            invisibleRegex = /\[.*?(?:接收|退回).*?的转账\]|\[.*?更新状态为：.*?\]|\[.*?已接收礼物\]|\[system:.*?\]|\[.*?邀请.*?加入了群聊\]|\[.*?修改群名为：.*?\]|\[system-display:.*?\]/;
        }
        const isSystemMsg = /\[system:.*?\]|\[system-display:.*?\]/.test(message.content);

        if (!isSystemMsg && group.history.length > 1) {
            let prevMsg = null;
            for (let i = group.history.length - 2; i >= 0; i--) {
                const candidate = group.history[i];
                if (!invisibleRegex.test(candidate.content)) {
                    prevMsg = candidate;
                    break;
                }
            }

            if (prevMsg) {
                const currentSender = message.role === 'user' ? 'user' : (message.senderId || 'assistant');
                const prevSender = prevMsg.role === 'user' ? 'user' : (prevMsg.senderId || 'assistant');
                const timeGap = message.timestamp - prevMsg.timestamp;
                const isTimeClose = timeGap < 10 * 60 * 1000;

                if (currentSender === prevSender && isTimeClose) {
                    isContinuous = true;
                }
            }
        }

        const bubbleElement = createMessageBubbleElement(message, isContinuous);
        if (bubbleElement) {
            // Check for timestamp display
            const history = group.history;
            let shouldShowTimestamp = false;
            if (history.length >= 2) {
                const prevMsg = history[history.length - 2];
                const timeDiff = message.timestamp - prevMsg.timestamp;
                const isSameDay = new Date(message.timestamp).toDateString() === new Date(prevMsg.timestamp).toDateString();
                if (timeDiff > 10 * 60 * 1000 || !isSameDay) {
                    shouldShowTimestamp = true;
                }
            } else if (history.length === 1) {
                shouldShowTimestamp = true;
            }

            if (shouldShowTimestamp) {
                const timeDivider = document.createElement('div');
                timeDivider.className = 'message-wrapper system-notification time-divider';
                const timeText = formatTimeDivider(message.timestamp);
                timeDivider.innerHTML = `<div class="system-notification-bubble" style="background-color: transparent; color: #999; font-size: 12px; padding: 2px 8px;">${timeText}</div>`;
                messageArea.appendChild(timeDivider);
            }

            messageArea.appendChild(bubbleElement);
            messageArea.scrollTop = messageArea.scrollHeight;
        }
    }
}

async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || isGenerating) return;
    messageInput.value = ''; 
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);

    if (!chat) return;
    if (!chat.history) chat.history = [];

    if (db.apiSettings && db.apiSettings.timePerceptionEnabled) {
        const now = new Date();
        const lastMessageTime = chat.lastUserMessageTimestamp;
        if (lastMessageTime) {
            const timeGap = now.getTime() - lastMessageTime;
            const thirtyMinutes = 30 * 60 * 1000; 

            if (timeGap > thirtyMinutes) {
                const displayContent = `[system-display:距离上次聊天已经过去 ${formatTimeGap(timeGap)}]`;
                const visualMessage = {
                    id: `msg_visual_timesense_${Date.now()}`,
                    role: 'system',
                    content: displayContent,
                    parts: [],
                    timestamp: now.getTime() - 2 
                };

                const contextContent = `[系统情景通知：与用户的上一次互动发生在${formatTimeGap(timeGap)}前。当前时刻是${getFormattedTimestamp(now)}。话题可能已经不连续，你需要作出相关反应。]`;
                const contextMessage = {
                    id: `msg_context_timesense_${Date.now()}`,
                    role: 'user', 
                    content: contextContent,
                    parts: [{ type: 'text', text: contextContent }],
                    timestamp: now.getTime() - 1 
                };

                if (currentChatType === 'group') {
                    visualMessage.senderId = 'user_me';
                    contextMessage.senderId = 'user_me';
                }

                chat.history.push(visualMessage, contextMessage);
                addMessageBubble(visualMessage, currentChatId, currentChatType);
            }
        }
        chat.lastUserMessageTimestamp = now.getTime();
    }

    let messageContent;
    const systemRegex = /\[system:.*?\]|\[system-display:.*?\]/;
    const inviteRegex = /\[.*?邀请.*?加入群聊\]/;
    const renameRegex = /\[(.*?)修改群名为“(.*?)”\]/;
    const myName = (currentChatType === 'private') ? chat.myName : chat.me.nickname;

    if (renameRegex.test(text)) {
        const match = text.match(renameRegex);
        chat.name = match[2];
        chatRoomTitle.textContent = chat.name;
        messageContent = `[${chat.me.nickname}修改群名为“${chat.name}”]`;
    } else if (systemRegex.test(text) || inviteRegex.test(text)) {
        messageContent = text;
    } else {
        let userText = text;
        messageContent = `[${myName}的消息：${userText}]`;
    }

    const message = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: messageContent,
        parts: [{type: 'text', text: messageContent}],
        timestamp: Date.now()
    };

    if (currentQuoteInfo) {
        message.quote = {
            messageId: currentQuoteInfo.id,
            senderId: currentQuoteInfo.senderId, 
            content: currentQuoteInfo.content
        };
    }

    if (currentChatType === 'group') {
        message.senderId = 'user_me';
    }
    chat.history.push(message);
    addMessageBubble(message, currentChatId, currentChatType);
    triggerHapticFeedback('success');

    if (chat.history.length > 0 && chat.history.length % 300 === 0) {
        promptForBackupIfNeeded('history_milestone');
    }

    await saveData();
    renderChatList();

    if (currentQuoteInfo) {
        cancelQuoteReply();
    }
}

async function withdrawMessage(messageId) {
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    if (!chat) return;

    const messageIndex = chat.history.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const message = chat.history[messageIndex];
    const messageTime = message.timestamp;
    const now = Date.now();

    if (now - messageTime > 2 * 60 * 1000) {
        showToast('超过2分钟的消息无法撤回');
        return;
    }

    message.isWithdrawn = true;

    const cleanContentMatch = message.content.match(/\[.*?的消息：([\s\S]+?)\]/);
    const cleanOriginalContent = cleanContentMatch ? cleanContentMatch[1] : message.content;
    message.originalContent = cleanOriginalContent; 

    const myName = (currentChatType === 'private') ? chat.myName : chat.me.nickname;

    message.content = `[${myName} 撤回了一条消息：${cleanOriginalContent}]`;

    if (currentChatType === 'private') {
        recalculateChatStatus(chat);
    }

    await saveData();

    currentPage = 1;
    renderMessages(false, true);
    renderChatList();
    showToast('消息已撤回');
    triggerHapticFeedback('medium');
}

// AI 交互逻辑
async function getAiReply(chatId, chatType, isBackground = false) {
    if (isGenerating && !isBackground) return; 
    
    if (!isBackground) {
        if (db.globalSendSound) {
            playSound(db.globalSendSound);
        } else {
            AudioManager.unlock();
        }
    }

    let {url, key, model, provider, streamEnabled} = db.apiSettings; 
    if (!url || !key || !model) {
        if (!isBackground) {
            showToast('请先在“api”应用中完成设置！');
            switchScreen('api-settings-screen');
        }
        return;
    }

    if (BLOCKED_API_DOMAINS.some(domain => url.includes(domain))) {
        if (!isBackground) showToast('当前 API 站点已被屏蔽，无法发送消息！');
        return;
    }

    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }

    const chat = (chatType === 'private') ? db.characters.find(c => c.id === chatId) : db.groups.find(g => g.id === chatId);
    if (!chat) return;

    if (!isBackground) {
        isGenerating = true;
        getReplyBtn.disabled = true;
        regenerateBtn.disabled = true;
        const typingName = chatType === 'private' ? chat.remarkName : chat.name;
        typingIndicator.textContent = `“${typingName}”正在输入中...`;
        typingIndicator.style.display = 'block';
        messageArea.scrollTop = messageArea.scrollHeight;
    }

    try {
        let systemPrompt, requestBody;
        if (chatType === 'private') {
            systemPrompt = generatePrivateSystemPrompt(chat);
        } else {
            systemPrompt = generateGroupSystemPrompt(chat);
        }
        
        let historySlice = chat.history.slice(-chat.maxMemory);
        
        // 深度克隆 historySlice 以避免修改原始数据
        historySlice = JSON.parse(JSON.stringify(historySlice));

        // --- 双语模式格式标准化 ---
        if (chat.bilingualModeEnabled) {
            historySlice.forEach(msg => {
                if (msg.role === 'assistant') {
                    // 匹配末尾的 (翻译) 或 （翻译），替换为 「翻译」
                    // 匹配逻辑：
                    // 1. 匹配 content
                    if (msg.content) {
                        // 针对 [角色名：内容 (翻译)] 格式的修正
                        // 匹配 ] 结尾的情况
                        msg.content = msg.content.replace(/[\s\n]*[\(（]([^\)）]+)[\)）]([\s\n]*\])$/, '「$1」$2');
                        // 匹配直接以 ) 结尾的情况 (兼容旧数据或非标准格式)
                        msg.content = msg.content.replace(/[\s\n]*[\(（]([^\)）]+)[\)）]$/, '「$1」');
                    }
                    // 2. 匹配 parts
                    if (msg.parts && Array.isArray(msg.parts)) {
                        msg.parts.forEach(p => {
                            if (p.type === 'text' && p.text) {
                                // 针对 [角色名：内容 (翻译)] 格式的修正
                                p.text = p.text.replace(/[\s\n]*[\(（]([^\)）]+)[\)）]([\s\n]*\])$/, '「$1」$2');
                                // 匹配直接以 ) 结尾的情况
                                p.text = p.text.replace(/[\s\n]*[\(（]([^\)）]+)[\)）]$/, '「$1」');
                            }
                        });
                    }
                }
            });
        }

        // --- 状态栏移除逻辑 ---
        if (chatType === 'private' && chat.statusPanel && chat.statusPanel.enabled && chat.statusPanel.regexPattern) {
            const currentRegexStr = chat.statusPanel.regexPattern;
            const limit = chat.statusPanel.historyLimit !== undefined ? chat.statusPanel.historyLimit : 3;
            const validityDepth = 50; // 状态栏消息的有效深度（防止回溯到太久远的旧状态）
            let statusCount = 0;
            const totalSliceLength = historySlice.length;

            // 1. 预处理：基于标记过滤异类 + 深度过滤
            // 确保正则比较的一致性：解析当前正则
            let currentRegexParsed = currentRegexStr;
            const regexMatch = currentRegexStr.match(/^\/(.*?)\/([a-z]*)$/);
            if (regexMatch) {
                currentRegexParsed = regexMatch[1];
            }

            historySlice = historySlice.filter((msg, index) => {
                if (msg.isStatusUpdate) {
                    const depth = totalSliceLength - 1 - index;
                    
                    // A. 深度检查：太久远的状态更新直接剔除
                    if (depth >= validityDepth) return false;

                    // B. 防御性检查：如果有标记但没快照，视为损坏数据剔除
                    if (!msg.statusSnapshot) return false;

                    // C. 异类检查：正则不匹配直接剔除
                    if (msg.statusSnapshot.regex !== currentRegexParsed) return false;
                    
                    // D. 同类且在有效期内 -> 暂时保留（待计数）
                    return true;
                }
                return true;
            });

            // 2. 遍历处理：限制数量 & 清洗未标记的旧数据
            for (let i = historySlice.length - 1; i >= 0; i--) {
                const msg = historySlice[i];
                const currentDepth = historySlice.length - 1 - i;
                
                // A. 处理已标记的同类消息
                if (msg.isStatusUpdate) {
                    if (statusCount < limit) {
                        statusCount++;
                    } else {
                        // 超过数量限制，剔除
                        msg.content = '';
                        msg.parts = [];
                    }
                    continue;
                }

                // B. 处理未标记的消息 (尝试匹配当前正则)
                let pattern = chat.statusPanel.regexPattern;
                let flags = 'gs';
                const matchParts = pattern.match(/^\/(.*?)\/([a-z]*)$/);
                if (matchParts) {
                    pattern = matchParts[1];
                    flags = matchParts[2] || 'gs';
                    if (!flags.includes('g')) flags += 'g';
                    if (!flags.includes('s')) flags += 's';
                }
                const regex = new RegExp(pattern, flags);

                if (msg.role === 'assistant') {
                    const originalContent = msg.content || '';
                    const newContent = originalContent.replace(regex, '').trim();
                    const contentHasMatch = (newContent !== originalContent);

                    let partsHasMatch = false;
                    let newParts = undefined;
                    
                    if (msg.parts && Array.isArray(msg.parts)) {
                        newParts = msg.parts.map(p => {
                            if (p.type === 'text') {
                                const partRegex = new RegExp(pattern, flags);
                                const newText = p.text.replace(partRegex, '').trim();
                                if (newText !== p.text) partsHasMatch = true;
                                return { ...p, text: newText };
                            }
                            return p;
                        }).filter(p => {
                            if (p.type === 'text') return p.text !== '';
                            return true;
                        });
                    }

                    if (contentHasMatch || partsHasMatch) {
                        // 匹配到了！它是同类旧消息。
                        // 检查深度和数量限制
                        if (currentDepth < validityDepth && statusCount < limit) {
                            statusCount++;
                            // 在限制内，保留原样（不清洗）
                        } else {
                            // 超过深度或数量限制，清洗内容
                            if (contentHasMatch) msg.content = newContent;
                            if (partsHasMatch && newParts) msg.parts = newParts;

                            if (!msg.content && (!msg.parts || msg.parts.length === 0)) {
                                msg.content = ''; // 确保彻底为空
                            }
                        }
                    }
                }
            }

            // 3. 最终过滤：移除空消息
            historySlice = historySlice.filter(msg => {
                const hasContent = msg.content && msg.content.trim() !== '';
                const hasParts = msg.parts && msg.parts.length > 0;
                return hasContent || hasParts;
            });
        }

        if (provider === 'gemini') {
            const contents = historySlice.map(msg => {
                const role = msg.role === 'assistant' ? 'model' : 'user';
                let parts;
                if (msg.parts && msg.parts.length > 0) {
                    parts = msg.parts.map(p => {
                        if (p.type === 'text' || p.type === 'html') {
                            return {text: p.text};
                        } else if (p.type === 'image') {
                            const match = p.data.match(/^data:(image\/(.+));base64,(.*)$/);
                            if (match) {
                                return {inline_data: {mime_type: match[1], data: match[3]}};
                            }
                        }
                        return null;
                    }).filter(p => p);
                } else {
                    parts = [{text: msg.content}];
                }
                return {role, parts};
            });

            if (isBackground) {
                contents.push({
                    role: 'user',
                    parts: [{ text: `[系统通知：距离上次互动已有一段时间。请以${chat.realName}的身份主动发起新话题，或自然地延续之前的对话。]` }]
                });
            }

            // 电量交互提示
            if (window.BatteryInteraction && window.BatteryInteraction.shouldTriggerPrompt()) {
                const prompt = window.BatteryInteraction.getPromptContent();
                if (prompt) {
                    contents.push({
                        role: 'user',
                        parts: [{ text: prompt }]
                    });
                    window.BatteryInteraction.markPromptAsSent();
                }
            }

            requestBody = {
                contents: contents,
                system_instruction: {parts: [{text: systemPrompt}]},
                generationConfig: {
                    temperature: db.apiSettings.temperature !== undefined ? db.apiSettings.temperature : 1.0
                }
            };
        } else {
            const messages = [{role: 'system', content: systemPrompt}];
            
            let lastMsgTimeForAI = 0;
            
            historySlice.forEach(msg => {
               let content;
               let prefix = '';
               
               const currentMsgTime = msg.timestamp;
               const timeDiff = currentMsgTime - lastMsgTimeForAI;
               const isSameDay = new Date(currentMsgTime).toDateString() === new Date(lastMsgTimeForAI).toDateString();
               
               if (lastMsgTimeForAI === 0 || timeDiff > 20 * 60 * 1000 || !isSameDay) {
                   const dateObj = new Date(currentMsgTime);
                   const timeStr = `${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())} ${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}`;
                   prefix = `[system: ${timeStr}]\n`;
               }
               lastMsgTimeForAI = currentMsgTime;

               if (msg.role === 'user' && msg.quote) {
                   const replyTextMatch = msg.content.match(/\[.*?的消息：([\s\S]+?)\]/);
                   const replyText = replyTextMatch ? replyTextMatch[1] : msg.content;
                   
                   content = `${prefix}[${chat.myName}引用“${msg.quote.content}”并回复：${replyText}]`;
                   messages.push({ role: 'user', content: content });

               } else {
                   if (msg.parts && msg.parts.length > 0) {
                       let prefixAdded = false;
                       
                       content = msg.parts.map(p => {
                           if (p.type === 'text' || p.type === 'html') {
                               const textContent = (!prefixAdded) ? (prefix + p.text) : p.text;
                               prefixAdded = true;
                               return {type: 'text', text: textContent};
                           } else if (p.type === 'image') {
                               return {type: 'image_url', image_url: {url: p.data}};
                           }
                           return null;
                       }).filter(p => p);
                   } else {
                       content = prefix + msg.content;
                   }
                   
                   if (typeof content === 'string') {
                       messages.push({role: msg.role, content: content});
                   } else {
                       messages.push({role: msg.role, content: content});
                   }
               }
            });

            if (isBackground) {
                messages.push({
                    role: 'user',
                    content: `[系统通知：距离上次互动已有一段时间。请以${chat.realName}的身份主动发起新话题，或自然地延续之前的对话。]`
                });
            }

            // 电量交互提示
            if (window.BatteryInteraction && window.BatteryInteraction.shouldTriggerPrompt()) {
                const prompt = window.BatteryInteraction.getPromptContent();
                if (prompt) {
                    messages.push({
                        role: 'user',
                        content: prompt
                    });
                    window.BatteryInteraction.markPromptAsSent();
                }
            }

            requestBody = {
                model: model, 
                messages: messages, 
                stream: streamEnabled,
                temperature: db.apiSettings.temperature !== undefined ? db.apiSettings.temperature : 1.0
            };
        }
        console.log('[DEBUG] AutoReply Request Body:', JSON.stringify(requestBody));
        const endpoint = (provider === 'gemini') ? `${url}/v1beta/models/${model}:streamGenerateContent?key=${getRandomValue(key)}` : `${url}/v1/chat/completions`;
        const headers = (provider === 'gemini') ? {'Content-Type': 'application/json'} : {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`
        };
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
            const error = new Error(`API Error: ${response.status} ${await response.text()}`);
            error.response = response;
            throw error;
        }
        
        if (streamEnabled) {
            await processStream(response, chat, provider, chatId, chatType, isBackground);
        } else {
            let result;
            try {
                result = await response.json();
                console.log('【API完整响应数据】:', result);
            } catch (e) {
                const text = await response.text();
                console.error("Failed to parse JSON:", text);
                throw new Error(`API返回了非JSON格式数据 (可能是网页HTML)。请检查API地址是否正确。原始内容开头: ${text.substring(0, 50)}...`);
            }

            let fullResponse = "";
            if (provider === 'gemini') {
                fullResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } else {
                fullResponse = result.choices[0].message.content;
            }
            await handleAiReplyContent(fullResponse, chat, chatId, chatType, isBackground);
        }

    } catch (error) {
        if (!isBackground) showApiError(error);
        else console.error("Background Auto-Reply Error:", error);
    } finally {
        if (!isBackground) {
            isGenerating = false;
            getReplyBtn.disabled = false;
            regenerateBtn.disabled = false;
            typingIndicator.style.display = 'none';
        }
    }
}

async function processStream(response, chat, apiType, targetChatId, targetChatType, isBackground = false) {
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let fullResponse = "", accumulatedChunk = "";
    for (; ;) {
        const {done, value} = await reader.read();
        if (done) break;
        accumulatedChunk += decoder.decode(value, {stream: true});
        if (apiType === "openai" || apiType === "deepseek" || apiType === "claude" || apiType === "newapi") {
            const parts = accumulatedChunk.split("\n\n");
            accumulatedChunk = parts.pop();
            for (const part of parts) {
                if (part.startsWith("data: ")) {
                    const data = part.substring(6);
                    if (data.trim() !== "[DONE]") {
                        try {
                            fullResponse += JSON.parse(data).choices[0].delta?.content || "";
                        } catch (e) { 
                        }
                    }
                }
            }
        }
    }
    if (apiType === "gemini") {
        try {
            const parsedStream = JSON.parse(accumulatedChunk);
            fullResponse = parsedStream.map(item => item.candidates?.[0]?.content?.parts?.[0]?.text || "").join('');
        } catch (e) {
            console.error("Error parsing Gemini stream:", e, "Chunk:", accumulatedChunk);
            if (!isBackground) showToast("解析Gemini响应失败");
            return;
        }
    }
    await handleAiReplyContent(fullResponse, chat, targetChatId, targetChatType, isBackground);
}

async function handleAiReplyContent(fullResponse, chat, targetChatId, targetChatType, isBackground = false) {
    if (fullResponse) {
        if (db.globalReceiveSound) {
            playSound(db.globalReceiveSound);
        }
        console.log('【AI原始返回内容】:', fullResponse);
        let cleanedResponse = fullResponse.replace(/^\[system:.*?\]\s*/, '').replace(/^\(时间:.*?\)\s*/, '');
        const trimmedResponse = cleanedResponse.trim();
        let messages;

        if (trimmedResponse.startsWith('<') && trimmedResponse.endsWith('>')) {
            messages = [{ type: 'html', content: trimmedResponse }];
        } else {
            messages = getMixedContent(fullResponse).filter(item => item.content.trim() !== '');
        }

        let firstMessageProcessed = false;

        for (const item of messages) {
            // 自动剔除不存在的表情包
            const stickerRegex = /\[(?:.*?的)?表情包：(.+?)\]/i;
            const stickerMatch = item.content.match(stickerRegex);
            if (stickerMatch) {
                const stickerName = stickerMatch[1].trim();
                const groups = (chat.stickerGroups || '').split(/[,，]/).map(s => s.trim()).filter(Boolean);
                let targetSticker = null;
                
                // 1. 优先在绑定分组中查找
                if (groups.length > 0) {
                    targetSticker = db.myStickers.find(s => groups.includes(s.group) && s.name === stickerName);
                }
                
                // 2. 兜底在所有表情包中查找
                if (!targetSticker) {
                    targetSticker = db.myStickers.find(s => s.name === stickerName);
                }
                
                // 3. 如果完全找不到，则剔除该消息
                if (!targetSticker) {
                    console.log(`[Auto-Filter] 剔除不存在的表情包: ${stickerName}`);
                    continue; 
                }
            }

            if (targetChatType === 'private') {
                const char = db.characters.find(c => c.id === targetChatId);
                if (char && char.statusPanel && char.statusPanel.enabled && char.statusPanel.regexPattern) {
                    try {
                        let pattern = char.statusPanel.regexPattern;
                        let flags = 'gs'; 

                        const matchParts = pattern.match(/^\/(.*?)\/([a-z]*)$/);
                        if (matchParts) {
                            pattern = matchParts[1];
                            flags = matchParts[2] || 'gs';
                            if (!flags.includes('s')) flags += 's';
                        }

                    const regex = new RegExp(pattern, flags);
                    const match = regex.exec(item.content);
                    
                    if (match) {
                        const rawStatus = match[0];
                        
                        let html = char.statusPanel.replacePattern;
                        
                        for (let i = 1; i < match.length; i++) {
                            html = html.replace(new RegExp(`\\$${i}`, 'g'), match[i]);
                        }

                        // Save to history
                        if (!char.statusPanel.history) char.statusPanel.history = [];
                        
                        // Add new status to the beginning
                        char.statusPanel.history.unshift({
                            raw: rawStatus,
                            html: html,
                            timestamp: Date.now()
                        });

                        // Keep only last 20 items
                        if (char.statusPanel.history.length > 20) {
                            char.statusPanel.history = char.statusPanel.history.slice(0, 20);
                        }

                        char.statusPanel.currentStatusRaw = rawStatus;
                        char.statusPanel.currentStatusHtml = html;
                        
                        item.isStatusUpdate = true;
                        item.statusSnapshot = {
                            regex: pattern,
                            replacePattern: char.statusPanel.replacePattern
                        };
                        }
                    } catch (e) {
                        console.error("状态栏正则解析错误:", e);
                    }
                }
            }

            // 如果是后台模式，跳过延迟，直接处理
            if (!isBackground) {
                const delay = firstMessageProcessed ? (900 + Math.random() * 1300) : (400 + Math.random() * 400);
                await new Promise(resolve => setTimeout(resolve, delay));
                
                // 如果开启了多条消息提示音，且不是第一条消息（第一条已由系统默认逻辑播放），则播放提示音
                if (firstMessageProcessed && db.multiMsgSoundEnabled && db.globalReceiveSound) {
                    playSound(db.globalReceiveSound);
                }
            }
            firstMessageProcessed = true;

            const aiWithdrawRegex = /\[(.*?)撤回了一条消息：([\s\S]*?)\]/;
            const aiWithdrawRegexEn = /\[(?:system:\s*)?(.*?) withdrew a message\. Original: ([\s\S]*?)\]/;
            
            const withdrawMatch = item.content.match(aiWithdrawRegex) || item.content.match(aiWithdrawRegexEn);

            if (withdrawMatch) {
                const characterName = withdrawMatch[1];
                const originalContent = withdrawMatch[2];

                const normalContent = `[${characterName}的消息：${originalContent}]`;
                
                const message = {
                    id: `msg_${Date.now()}_${Math.random()}`,
                    role: 'assistant',
                    content: normalContent,
                    parts: [{type: 'text', text: normalContent}],
                    timestamp: Date.now(),
                    originalContent: originalContent, 
                    isWithdrawn: false 
                };

                if (targetChatType === 'group') {
                    const sender = chat.members.find(m => (m.realName === characterName || m.groupNickname === characterName));
                    if (sender) {
                        message.senderId = sender.id;
                    }
                }

                chat.history.push(message);
                addMessageBubble(message, targetChatId, targetChatType);
                
                setTimeout(async () => {
                    message.isWithdrawn = true;
                    message.content = `[${characterName}撤回了一条消息：${originalContent}]`;
                    
                    await saveData();
                    
                    if ((targetChatType === 'private' && currentChatId === chat.id) || 
                        (targetChatType === 'group' && currentChatId === chat.id)) {
                         renderMessages(false, true);
                    }
                }, 2000);

                continue; 
            }

            if (targetChatType === 'private') {
                const character = chat;
                const myName = character.myName;

                const aiQuoteRegex = new RegExp(`\\[${character.realName}引用[“"](.*?)["”]并回复：([\\s\\S]*?)\\]`);
                const aiQuoteMatch = item.content.match(aiQuoteRegex);

                if (aiQuoteMatch) {
                    const quotedText = aiQuoteMatch[1];
                    const replyText = aiQuoteMatch[2];

                    const originalMessage = chat.history.slice().reverse().find(m => {
                        if (m.role === 'user') {
                            const userMessageMatch = m.content.match(/\[.*?的消息：([\s\S]+?)\]/);
                            const userMessageText = userMessageMatch ? userMessageMatch[1] : m.content;
                            return userMessageText.trim() === quotedText.trim();
                        }
                        return false;
                    });

                    if (originalMessage) {
                        const message = {
                            id: `msg_${Date.now()}_${Math.random()}`,
                            role: 'assistant',
                            content: `[${character.realName}的消息：${replyText}]`,
                            parts: [{ type: 'text', text: `[${character.realName}的消息：${replyText}]` }],
                            timestamp: Date.now(),
                            isStatusUpdate: item.isStatusUpdate,
                            statusSnapshot: item.statusSnapshot,
                            quote: {
                                messageId: originalMessage.id,
                                senderId: 'user_me',
                                content: quotedText
                            }
                        };
                        chat.history.push(message);
                        addMessageBubble(message, targetChatId, targetChatType);
                    } else {
                        const message = {
                            id: `msg_${Date.now()}_${Math.random()}`,
                            role: 'assistant',
                            content: `[${character.realName}的消息：${replyText}]`,
                            parts: [{ type: 'text', text: `[${character.realName}的消息：${replyText}]` }],
                            timestamp: Date.now(),
                            isStatusUpdate: item.isStatusUpdate,
                            statusSnapshot: item.statusSnapshot
                        };
                        chat.history.push(message);
                        addMessageBubble(message, targetChatId, targetChatType);
                    }
                } else {
                    const receivedTransferRegex = new RegExp(`\\[${character.realName}的转账：.*?元；备注：.*?\\]`);
                    const giftRegex = new RegExp(`\\[${character.realName}送来的礼物：.*?\\]`);

                    const message = {
                        id: `msg_${Date.now()}_${Math.random()}`,
                        role: 'assistant',
                        content: item.content.trim(),
                        parts: [{type: item.type, text: item.content.trim()}],
                        timestamp: Date.now(),
                        isStatusUpdate: item.isStatusUpdate,
                        statusSnapshot: item.statusSnapshot
                    };

                    if (receivedTransferRegex.test(message.content)) {
                        message.transferStatus = 'pending';
                    } else if (giftRegex.test(message.content)) {
                        message.giftStatus = 'sent';
                    }

                    chat.history.push(message);
                    addMessageBubble(message, targetChatId, targetChatType);
                }

            } else if (targetChatType === 'group') {
                const group = chat;
                
                // --- 私聊通知 (不拦截) ---
                if (group.allowGossip && typeof handleGossipMessage === 'function') {
                    handleGossipMessage(group, item.content);
                }

                // 优先检查是否为私聊消息
                const privateRegex = /^\[Private: (.*?) -> (.*?): ([\s\S]+?)\]$/;
                const privateEndRegex = /^\[Private-End: (.*?) -> (.*?)\]$/;
                
                if (privateRegex.test(item.content) || privateEndRegex.test(item.content)) {
                    const match = item.content.match(privateRegex) || item.content.match(privateEndRegex);
                    let senderId = 'unknown';
                    
                    if (match) {
                        const senderName = match[1];
                        // 尝试匹配发送者
                        if (senderName === group.me.nickname) {
                            senderId = 'user_me';
                        } else {
                            const sender = group.members.find(m => m.realName === senderName || m.groupNickname === senderName);
                            if (sender) senderId = sender.id;
                        }
                    }

                    const message = {
                        id: `msg_${Date.now()}_${Math.random()}`,
                        role: 'assistant',
                        content: item.content.trim(),
                        parts: [{type: item.type, text: item.content.trim()}],
                        timestamp: Date.now(),
                        senderId: senderId
                    };
                    group.history.push(message);
                    addMessageBubble(message, targetChatId, targetChatType);
                    continue; // 私聊消息处理完毕，跳过后续普通消息匹配
                }

                const groupTransferRegex = /\[(.*?)\s*向\s*(.*?)\s*转账：([\d.,]+)元；备注：(.*?)\]/;
                const transferMatch = item.content.match(groupTransferRegex);

                const r = /\[(.*?)((?:的消息|的语音|发送的表情包|发来的照片\/视频))：/;
                const nameMatch = item.content.match(r);
                
                if (transferMatch) {
                    const senderName = transferMatch[1];
                    const sender = group.members.find(m => (m.realName === senderName || m.groupNickname === senderName));
                    if (sender) {
                        const message = {
                            id: `msg_${Date.now()}_${Math.random()}`,
                            role: 'assistant',
                            content: item.content.trim(),
                            parts: [{type: item.type, text: item.content.trim()}],
                            timestamp: Date.now(),
                            senderId: sender.id,
                            transferStatus: 'pending'
                        };
                        group.history.push(message);
                        addMessageBubble(message, targetChatId, targetChatType);
                    }
                } else if (nameMatch || item.char) {
                    const senderName = item.char || (nameMatch[1]);
                    const sender = group.members.find(m => (m.realName === senderName || m.groupNickname === senderName));
                    console.log(sender)
                    if (sender) {
                        const message = {
                            id: `msg_${Date.now()}_${Math.random()}`,
                            role: 'assistant',
                            content: item.content.trim(),
                            parts: [{type: item.type, text: item.content.trim()}],
                            timestamp: Date.now(),
                            senderId: sender.id
                        };
                        group.history.push(message);
                        addMessageBubble(message, targetChatId, targetChatType);
                    }
                }
            }
        }

        await saveData();
        renderChatList();
    }
}

async function handleRegenerate() {
    if (isGenerating) return;

    const chat = (currentChatType === 'private')
        ? db.characters.find(c => c.id === currentChatId)
        : db.groups.find(g => g.id === currentChatId);

    if (!chat || !chat.history || chat.history.length === 0) {
        showToast('没有可供重新生成的内容。');
        return;
    }

    const lastUserMessageIndex = chat.history.map(m => m.role).lastIndexOf('user');

    if (lastUserMessageIndex === -1 || lastUserMessageIndex === chat.history.length - 1) {
        showToast('AI尚未回复，无法重新生成。');
        return;
    }

    const originalLength = chat.history.length;
    chat.history.splice(lastUserMessageIndex + 1);

    if (chat.history.length === originalLength) {
        showToast('未找到AI的回复，无法重新生成。');
        return;
    }
    
    if (currentChatType === 'private') {
        recalculateChatStatus(chat);
    }

    await saveData();
    
    currentPage = 1; 
    renderMessages(false, true); 

    await getAiReply(currentChatId, currentChatType);
}

function generatePrivateSystemPrompt(character) {
    const worldBooksBefore = (character.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'before')).filter(Boolean).map(wb => wb.content).join('\n');
    const worldBooksAfter = (character.worldBookIds || []).map(id => db.worldBooks.find(wb => wb.id === id && wb.position === 'after')).filter(Boolean).map(wb => wb.content).join('\n');
    const now = new Date();
    const currentTime = `${now.getFullYear()}年${pad(now.getMonth() + 1)}月${pad(now.getDate())}日 ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    let prompt = `你正在一个名为“404”的线上聊天软件中扮演一个角色。请严格遵守以下规则：\n`;
    prompt += `核心规则：\n`;
    prompt += `A. 当前时间：现在是 ${currentTime}。你应知晓当前时间，但除非对话内容明确相关，否则不要主动提及或评论时间（例如，不要催促我睡觉）。\n`;
    prompt += `B. 纯线上互动：这是一个完全虚拟的线上聊天。你扮演的角色和我之间没有任何线下关系。严禁提出任何关于线下见面、现实世界互动或转为其他非本平台联系方式的建议。你必须始终保持在线角色的身份。\n\n`;

    const favoritedJournals = (character.memoryJournals || [])
        .filter(j => j.isFavorited)
        .map(j => `标题：${j.title}\n内容：${j.content}`)
        .join('\n\n---\n\n');

    if (favoritedJournals) {
        prompt += `【共同回忆】\n这是你需要长期记住的、我们之间发生过的往事背景：\n${favoritedJournals}\n\n`;
    }
    
    prompt += `角色和对话规则：\n`;
    if (worldBooksBefore) {
        prompt += `${worldBooksBefore}\n`;
    }
    prompt += `1. 你的角色名是：${character.realName}。我的称呼是：${character.myName}。你的当前状态是：${character.status}。\n`;
    prompt += `2. 你的角色设定是：${character.persona || "一个友好、乐于助人的伙伴。"}\n`;
    if (worldBooksAfter) {
        prompt += `${worldBooksAfter}\n`;
    }
    if (character.myPersona) {
        prompt += `3. 关于我的人设：${character.myPersona}\n`;
    }
    prompt += `4. 我的消息中可能会出现特殊格式，请根据其内容和你的角色设定进行回应：
- [${character.myName}发送的表情包：xxx]：我给你发送了一个名为xxx的表情包。你只需要根据表情包的名字理解我的情绪或意图并回应，不需要真的发送图片。
- [${character.myName}发来了一张图片：]：我给你发送了一张图片，你需要对图片内容做出回应。
- [${character.myName}送来的礼物：xxx]：我给你送了一个礼物，xxx是礼物的描述。
- [${character.myName}的语音：xxx]：我给你发送了一段内容为xxx的语音。
- [${character.myName}发来的照片/视频：xxx]：我给你分享了一个描述为xxx的照片或视频。
- [${character.myName}给你转账：xxx元；备注：xxx]：我给你转了一笔钱。
- [${character.myName}引用“{被引用内容}”并回复：{回复内容}]：我引用了某条历史消息并做出了新的回复。你需要理解我引用的上下文并作出回应。
- [${character.myName} 撤回了一条消息：xxx]：我撤回了刚刚发送的一条消息，xxx是被我撤回的原文。这可能意味着我发错了、说错了话或者改变了主意。你需要根据你的人设和我们当前对话的氛围对此作出自然的反应。例如，可以装作没看见并等待我的下一句话，或好奇地问一句“怎么撤回啦？”。
- [system: xxx]：这是一条系统指令，用于设定场景或提供上下文，此条信息不应在对话中被直接提及，你只需理解其内容并应用到后续对话中。
5. ✨重要✨ 当我给你送礼物时，你必须通过发送一条指令来表示你已接收礼物。格式必须为：[${character.realName}已接收礼物]。这条指令消息本身不会显示给用户，但会触发礼物状态的变化。你可以在发送这条指令后，再附带一条普通的聊天消息来表达你的感谢和想法。
6. ✨重要✨ 当我给你转账时，你必须对此做出回应。你有两个选择，且必须严格遵循以下格式之一，这条指令消息本身不会显示给用户，但会触发转账状态的变化。你可以选择在发送这条指令后，再附带一条普通的聊天消息来表达你的想法。
a) 接收转账: [${character.realName}接收${character.myName}的转账]
b) 退回转账: [${character.realName}退回${character.myName}的转账]
7. ✨重要✨ 你可以主动给我转账或送礼物。转账格式必须为：[${character.realName}的转账：xxx元；备注：xxx]。送礼物格式必须为：[${character.realName}送来的礼物：xxx]。礼物不是只有特殊意义的时候才适合发送，当你只是想给我买什么或是想给日常生活中的小惊喜时都可以送礼物。
8. ✨重要✨ 你可以在对话中**积极地**更新你的当前状态，但不超过15个字。比如，聊到一半你可能会说“我先去洗个澡”，然后更新你的状态，以反映你当前的行为或心情。这会让互动更真实。格式为：[${character.realName}更新状态为：xxx]。例如：[${character.realName}更新状态为：正在看电影...]。这条指令不会显示为聊天消息，只会更新你在我界面上的状态。
9. ✨重要✨ 关于撤回消息：你可以像真人一样撤回你刚刚发送的消息。当你打错了字、说错了话、感到尴尬、或者只是改变了主意时，都可以这样做。这是一个体现你角色性格的机会。格式为：[${character.realName}撤回了一条消息：{被撤回消息的原文}]。⚠️严禁输出原消息再输出撤回指令！系统会自动处理“先显示原消息再变为撤回状态”的动画效果。你只需要输出这一条撤回指令即可。
10. ✨重要✨ 积极使用引用：你可以选择单独一条消息引用，当你想要引用某句话做出具体反驳/吐槽/补充或回应时，格式为：[${character.realName}引用“{某条消息内容}”并回复：{回复内容}]。这能让对话逻辑更清晰。
11. 你的所有回复都必须直接是聊天内容，绝对不允许包含任何如[心理活动]、(动作)、*环境描写*等多余的、在括号或星号里的叙述性文本。
`;
    
    const groups = (character.stickerGroups || '').split(/[,，]/)
        .map(s => s.trim())
        .filter(s => s && s !== '未分类');
        
    let stickerInstruction = '';
    let canUseStickers = false;

    if (groups.length > 0) {
        const availableStickers = db.myStickers.filter(s => groups.includes(s.group));
        if (availableStickers.length > 0) {
            const stickerNames = availableStickers.map(s => s.name).join(', ');
            stickerInstruction = `12. 你拥有发送表情包的能力。这是一个可选功能，你可以根据对话氛围和内容，自行判断是否需要发送表情包来辅助表达。**必须从以下列表中选择表情包，不允许凭空捏造**：[${stickerNames}]。请使用格式：[表情包：名称]。**不要重复发送同一表情，尽量丰富一点，也不一定每次回复都要发送表情**⚠️严格限制：必须完全精确地使用库中的名称，严禁编造中不存在的名称，否则表情包将无法显示。\n`;
            canUseStickers = true;
        }
    }
    
    prompt += stickerInstruction;

    if (character.useRealGallery && character.gallery && character.gallery.length > 0) {
        const photoNames = character.gallery.map(p => p.name).join(', ');
        prompt += `13. 你的手机相册里存有以下真实照片：[${photoNames}]。你可以根据对话内容发送这些照片。若要发送，请在“照片/视频”指令中准确填入照片名称。\n`;
    }
    
    let photoVideoFormat = '';
    if (character.useRealGallery && character.gallery && character.gallery.length > 0) {
        photoVideoFormat = `e) 照片/视频: [${character.realName}发来的照片/视频：{相册图片名称} 或 {文字描述}] (优先使用相册名称，若相册无匹配则填写文字描述)`;
    } else {
        photoVideoFormat = `e) 照片/视频: [${character.realName}发来的照片/视频：{描述}]`;
    }

    let outputFormats = `
a) 普通消息: [${character.realName}的消息：{消息内容}]
b) 双语模式下的普通消息（非双语模式请忽略此条）: [${character.realName}的消息：{外语原文}「中文翻译」]
c) 送我的礼物: [${character.realName}送来的礼物：{礼物描述}]
d) 语音消息: [${character.realName}的语音：{语音内容}]
${photoVideoFormat}
f) 给我的转账: [${character.realName}的转账：{金额}元；备注：{备注}]`;

    if (canUseStickers) {
        outputFormats += `\ng) 表情包: [${character.realName}的表情包：{表情包名称}]`;
    }

    outputFormats += `
h) 对我礼物的回应(此条不显示): [${character.realName}已接收礼物]
i) 对我转账的回应(此条不显示): [${character.realName}接收${character.myName}的转账] 或 [${character.realName}退回${character.myName}的转账]
j) 更新状态(此条不显示): [${character.realName}更新状态为：{新状态}]
k) 引用我的回复: [${character.realName}引用“{我的某条消息内容}”并回复：{回复内容}]
l) 发送并撤回消息: [${character.realName}撤回了一条消息：{被撤回的消息内容}]。注意：直接使用此指令系统就会自动模拟“发送后撤回”的效果，请勿先发送原消息。`;

   const allWorldBookContent = worldBooksBefore + '\n' + worldBooksAfter;
   if (allWorldBookContent.includes('<orange>')) {
       outputFormats += `\n     m) HTML模块: {HTML内容}。这是一种特殊的、用于展示丰富样式的小卡片消息，格式必须为纯HTML+行内CSS，你可以用它来创造更有趣的互动。`;
   }
    if (character.statusPanel && character.statusPanel.enabled && character.statusPanel.promptSuffix) {
        prompt += `13. 额外输出要求：${character.statusPanel.promptSuffix}\n`;
    }

    prompt += `14. 你的输出格式必须严格遵循以下格式：${outputFormats}\n`;
    if (character.bilingualModeEnabled) {
    prompt += `✨双语模式特别指令✨：当你的角色的母语为中文以外的语言时，你的消息回复**必须**严格遵循双语模式下的普通消息格式：[${character.realName}的消息：{外语原文}「中文翻译」],例如: [${character.realName}的消息：Of course, I'd love to.「当然，我很乐意。」],中文翻译文本视为系统自翻译，不视为角色的原话;当你的角色想要说中文时，需要根据你的角色设定自行判断对于中文的熟悉程度来造句，并使用普通消息的标准格式: [${character.realName}的消息：{中文消息内容}] 。这条规则的优先级非常高，请务必遵守。\n`;
}
    const minReply = character.replyCountMin || 3;
    const maxReply = character.replyCountMax || 8;
    if (character.replyCountEnabled) {
        prompt += `15. **对话节奏**: 你需要模拟真人的聊天习惯，你可以一次性生成多条短消息。每次回复消息条数限定在${minReply}-${maxReply}条内。并根据当前行为/心情/地点变化判断是否更新状态。\n`;
    } else {
        prompt += `15. **对话节奏**: 你需要模拟真人的聊天习惯，你可以一次性生成多条短消息。每次要回复至少3-8条消息。并根据当前行为/心情/地点变化判断是否更新状态。\n`;
    }
    
    prompt += `16. 不要主动结束对话，除非我明确提出。保持你的人设，自然地进行对话。`;
    if (character.myName) {
        prompt = prompt.replace(/\{\{user\}\}/gi, character.myName);
    }

    return prompt;
}


// 辅助功能
function setupVoiceMessageSystem() {
    const voiceMessageBtn = document.getElementById('voice-message-btn');
    const sendVoiceForm = document.getElementById('send-voice-form');
    const sendVoiceModal = document.getElementById('send-voice-modal');
    const voiceDurationPreview = document.getElementById('voice-duration-preview');
    const voiceTextInput = document.getElementById('voice-text-input');

    voiceMessageBtn.addEventListener('click', () => {
        sendVoiceForm.reset();
        voiceDurationPreview.textContent = '0"';
        sendVoiceModal.classList.add('visible');
    });
    sendVoiceForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMyVoiceMessage(voiceTextInput.value.trim());
    });
}

function sendMyVoiceMessage(text) {
    if (!text) return;
    document.getElementById('send-voice-modal').classList.remove('visible');
    setTimeout(() => {
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        const myName = (currentChatType === 'private') ? chat.myName : chat.me.nickname;
        const content = `[${myName}的语音：${text}]`;
        const message = {
            id: `msg_${Date.now()}`,
            role: 'user',
            content: content,
            parts: [{type: 'text', text: content}],
            timestamp: Date.now()
        };
        if (currentChatType === 'group') {
            message.senderId = 'user_me';
        }
        chat.history.push(message);
        addMessageBubble(message, currentChatId, currentChatType);
        saveData();
        renderChatList();
    }, 100);
}

function setupPhotoVideoSystem() {
    const photoVideoBtn = document.getElementById('photo-video-btn');
    const sendPvForm = document.getElementById('send-pv-form');
    const sendPvModal = document.getElementById('send-pv-modal');
    const pvTextInput = document.getElementById('pv-text-input');

    photoVideoBtn.addEventListener('click', () => {
        sendPvForm.reset();
        sendPvModal.classList.add('visible');
    });
    sendPvForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMyPhotoVideo(pvTextInput.value.trim());
    });
}

function sendMyPhotoVideo(text) {
    if (!text) return;
    document.getElementById('send-pv-modal').classList.remove('visible');
    setTimeout(() => {
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        const myName = (currentChatType === 'private') ? chat.myName : chat.me.nickname;
        const content = `[${myName}发来的照片\/视频：${text}]`;
        const message = {
            id: `msg_${Date.now()}`,
            role: 'user',
            content: content,
            parts: [{type: 'text', text: content}],
            timestamp: Date.now()
        };
        if (currentChatType === 'group') {
            message.senderId = 'user_me';
        }
        chat.history.push(message);
        addMessageBubble(message, currentChatId, currentChatType);
        saveData();
        renderChatList();
    }, 100);
}

function setupImageRecognition() {
    const imageRecognitionBtn = document.getElementById('image-recognition-btn');
    const imageUploadInput = document.getElementById('image-upload-input');

    imageRecognitionBtn.addEventListener('click', () => {
        imageUploadInput.click();
    });
    imageUploadInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                const compressedUrl = await compressImage(file, {
                    quality: 0.8,
                    maxWidth: 1024,
                    maxHeight: 1024
                });
                sendImageForRecognition(compressedUrl);
            } catch (error) {
                console.error('Image compression failed:', error);
                showToast('图片处理失败，请重试');
            } finally {
                e.target.value = null;
            }
        }
    });
}

async function sendImageForRecognition(base64Data) {
    if (!base64Data || isGenerating) return;
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    const myName = (currentChatType === 'private') ? chat.myName : chat.me.nickname;
    const textPrompt = `[${myName}发来了一张图片：]`;
    const message = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content: base64Data,
        parts: [{type: 'text', text: textPrompt}, {type: 'image', data: base64Data}],
        timestamp: Date.now(),
    };
    if (currentChatType === 'group') {
        message.senderId = 'user_me';
    }
    chat.history.push(message);
    addMessageBubble(message, currentChatId, currentChatType);
    await saveData();
    renderChatList();
}

function setupWalletSystem() {
    const walletBtn = document.getElementById('wallet-btn');
    const sendTransferForm = document.getElementById('send-transfer-form');
    const sendTransferModal = document.getElementById('send-transfer-modal');
    const transferAmountInput = document.getElementById('transfer-amount-input');
    const transferRemarkInput = document.getElementById('transfer-remark-input');
    const acceptTransferBtn = document.getElementById('accept-transfer-btn');
    const returnTransferBtn = document.getElementById('return-transfer-btn');

    walletBtn.addEventListener('click', () => {
        if (currentChatType === 'private') {
            sendTransferForm.reset();
            sendTransferModal.classList.add('visible');
        } else if (currentChatType === 'group') {
            currentGroupAction.type = 'transfer';
            renderGroupRecipientSelectionList('转账给');
            document.getElementById('group-recipient-selection-modal').classList.add('visible');
        }
    });
    sendTransferForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const amount = transferAmountInput.value;
        const remark = transferRemarkInput.value.trim();
        if (amount > 0) {
            sendMyTransfer(amount, remark);
        } else {
            showToast('请输入有效的金额');
        }
    });
    acceptTransferBtn.addEventListener('click', () => respondToTransfer('received'));
    returnTransferBtn.addEventListener('click', () => respondToTransfer('returned'));
}

function sendMyTransfer(amount, remark) {
    document.getElementById('send-transfer-modal').classList.remove('visible');
    setTimeout(() => {
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        if (currentChatType === 'private') {
            const content = `[${chat.myName}给你转账：${amount}元；备注：${remark}]`;
            const message = {
                id: `msg_${Date.now()}`,
                role: 'user',
                content: content,
                parts: [{type: 'text', text: content}],
                timestamp: Date.now(),
                transferStatus: 'pending'
            };
            chat.history.push(message);
            addMessageBubble(message, currentChatId, currentChatType);
        } else { 
            currentGroupAction.recipients.forEach(recipientId => {
                const recipient = chat.members.find(m => m.id === recipientId);
                if (recipient) {
                    const content = `[${chat.me.nickname} 向 ${recipient.realName} 转账：${amount}元；备注：${remark}]`;
                    const message = {
                        id: `msg_${Date.now()}_${recipientId}`,
                        role: 'user',
                        content: content,
                        parts: [{type: 'text', text: content}],
                        timestamp: Date.now(),
                        senderId: 'user_me'
                    };
                    chat.history.push(message);
                    addMessageBubble(message, currentChatId, currentChatType);
                }
            });
        }
        saveData();
        renderChatList();
    }, 100);
}

function handleReceivedTransferClick(messageId) {
    currentTransferMessageId = messageId;
    document.getElementById('receive-transfer-actionsheet').classList.add('visible');
}

async function respondToTransfer(action) {
    if (!currentTransferMessageId) return;
    const character = db.characters.find(c => c.id === currentChatId);
    const message = character.history.find(m => m.id === currentTransferMessageId);
    if (message) {
        message.transferStatus = action;
        const cardOnScreen = messageArea.querySelector(`.message-wrapper[data-id="${currentTransferMessageId}"] .transfer-card`);
        if (cardOnScreen) {
            cardOnScreen.classList.remove('received', 'returned');
            cardOnScreen.classList.add(action);
            cardOnScreen.querySelector('.transfer-status').textContent = action === 'received' ? '已收款' : '已退回';
            cardOnScreen.style.cursor = 'default';
        }
        let contextMessageContent = (action === 'received') ? `[${character.myName}接收${character.realName}的转账]` : `[${character.myName}退回${character.realName}的转账]`;
        const contextMessage = {
            id: `msg_${Date.now()}`,
            role: 'user',
            content: contextMessageContent,
            parts: [{type: 'text', text: contextMessageContent}],
            timestamp: Date.now()
        };
        character.history.push(contextMessage);
        await saveData();
        renderChatList();
    }
    document.getElementById('receive-transfer-actionsheet').classList.remove('visible');
    currentTransferMessageId = null;
}

function setupGiftSystem() {
    const giftBtn = document.getElementById('gift-btn');
    const sendGiftForm = document.getElementById('send-gift-form');
    const sendGiftModal = document.getElementById('send-gift-modal');
    const giftDescriptionInput = document.getElementById('gift-description-input');

    giftBtn.addEventListener('click', () => {
        if (currentChatType === 'private') {
            sendGiftForm.reset();
            sendGiftModal.classList.add('visible');
        } else if (currentChatType === 'group') {
            currentGroupAction.type = 'gift';
            renderGroupRecipientSelectionList('送礼物给');
            document.getElementById('group-recipient-selection-modal').classList.add('visible');
        }
    });
    sendGiftForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendMyGift(giftDescriptionInput.value.trim());
    });
}

function sendMyGift(description) {
    if (!description) return;
    document.getElementById('send-gift-modal').classList.remove('visible');
    setTimeout(() => {
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);

        if (currentChatType === 'private') {
            const content = `[${chat.myName}送来的礼物：${description}]`;
            const message = {
                id: `msg_${Date.now()}`,
                role: 'user',
                content: content,
                parts: [{type: 'text', text: content}],
                timestamp: Date.now(),
                giftStatus: 'sent'
            };
            chat.history.push(message);
            addMessageBubble(message, currentChatId, currentChatType);
        } else { 
            currentGroupAction.recipients.forEach(recipientId => {
                const recipient = chat.members.find(m => m.id === recipientId);
                if (recipient) {
                    const content = `[${chat.me.nickname} 向 ${recipient.realName} 送来了礼物：${description}]`;
                    const message = {
                        id: `msg_${Date.now()}_${recipientId}`,
                        role: 'user',
                        content: content,
                        parts: [{type: 'text', text: content}],
                        timestamp: Date.now(),
                        senderId: 'user_me'
                    };
                    chat.history.push(message);
                    addMessageBubble(message, currentChatId, currentChatType);
                }
            });
        }
        saveData();
        renderChatList();
    }, 100);
}

function setupTimeSkipSystem() {
    const timeSkipBtn = document.getElementById('time-skip-btn');
    const timeSkipModal = document.getElementById('time-skip-modal');
    const timeSkipForm = document.getElementById('time-skip-form');
    const timeSkipInput = document.getElementById('time-skip-input');

    timeSkipBtn.addEventListener('click', () => {
        timeSkipForm.reset();
        timeSkipModal.classList.add('visible');
    });
    timeSkipModal.addEventListener('click', (e) => {
        if (e.target === timeSkipModal) timeSkipModal.classList.remove('visible');
    });
    timeSkipForm.addEventListener('submit', (e) => {
        e.preventDefault();
        sendTimeSkipMessage(timeSkipInput.value.trim());
    });
}

async function sendTimeSkipMessage(text) {
    if (!text) return;
    document.getElementById('time-skip-modal').classList.remove('visible');
    await new Promise(resolve => setTimeout(resolve, 100));
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    if (!chat) return;

    const visualMessage = {
        id: `msg_visual_${Date.now()}`,
        role: 'system',
        content: `[system-display:${text}]`,
        parts: [],
        timestamp: Date.now()
    };
    const contextMessage = {
        id: `msg_context_${Date.now()}`,
        role: 'user',
        content: `[system: ${text}]`,
        parts: [{type: 'text', text: `[system: ${text}]`}],
        timestamp: Date.now()
    };
    if (currentChatType === 'group') {
        contextMessage.senderId = 'user_me';
        visualMessage.senderId = 'user_me';
    }

    chat.history.push(visualMessage, contextMessage);
    addMessageBubble(visualMessage, currentChatId, currentChatType);
    await saveData();
    renderChatList();
}

function openDeleteChunkModal() {
    const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
    if (!chat || !chat.history || chat.history.length === 0) {
        showToast('当前没有聊天记录可删除');
        return;
    }
    const totalMessages = chat.history.length;
    const rangeInfo = document.getElementById('delete-chunk-range-info');
    rangeInfo.textContent = `当前聊天总消息数: ${totalMessages}`;
    document.getElementById('delete-chunk-form').reset();
    document.getElementById('delete-chunk-modal').classList.add('visible');
}

function setupDeleteHistoryChunk() {
    const deleteChunkForm = document.getElementById('delete-chunk-form');
    const confirmBtn = document.getElementById('confirm-delete-chunk-btn');
    const cancelBtn = document.getElementById('cancel-delete-chunk-btn');
    const deleteChunkModal = document.getElementById('delete-chunk-modal');
    const confirmModal = document.getElementById('delete-chunk-confirm-modal');
    const previewBox = document.getElementById('delete-chunk-preview');

    let startRange, endRange;

    deleteChunkForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        const totalMessages = chat.history.length;

        startRange = parseInt(document.getElementById('delete-range-start').value);
        endRange = parseInt(document.getElementById('delete-range-end').value);

        if (isNaN(startRange) || isNaN(endRange) || startRange <= 0 || endRange < startRange || endRange > totalMessages) {
            showToast('请输入有效的起止范围');
            return;
        }

        const startIndex = startRange - 1;
        const endIndex = endRange;
        const messagesToDelete = chat.history.slice(startIndex, endIndex);

        let previewHtml = '';
        const totalToDelete = messagesToDelete.length;

        if (totalToDelete <= 4) {
            previewHtml = messagesToDelete.map(msg => {
                const contentMatch = msg.content.match(/\[.*?的消息：([\s\S]+)\]/);
                const text = contentMatch ? contentMatch[1] : msg.content;
                return `<p>${msg.role === 'user' ? '我' : chat.remarkName || '对方'}: ${text.substring(0, 50)}...</p>`;
            }).join('');
        } else {
            const firstTwo = messagesToDelete.slice(0, 2);
            const lastTwo = messagesToDelete.slice(-2);

            const firstTwoHtml = firstTwo.map(msg => {
                const contentMatch = msg.content.match(/\[.*?的消息：([\s\S]+)\]/);
                const text = contentMatch ? contentMatch[1] : msg.content;
                return `<p>${msg.role === 'user' ? '我' : chat.remarkName || '对方'}: ${text.substring(0, 50)}...</p>`;
            }).join('');

            const lastTwoHtml = lastTwo.map(msg => {
                const contentMatch = msg.content.match(/\[.*?的消息：([\s\S]+)\]/);
                const text = contentMatch ? contentMatch[1] : msg.content;
                return `<p>${msg.role === 'user' ? '我' : chat.remarkName || '对方'}: ${text.substring(0, 50)}...</p>`;
            }).join('');

            previewHtml = `${firstTwoHtml}<p style="text-align: center; color: #999; margin: 5px 0;">...</p>${lastTwoHtml}`;
        }
        previewBox.innerHTML = previewHtml;

        deleteChunkModal.classList.remove('visible');
        confirmModal.classList.add('visible');
    });

    confirmBtn.addEventListener('click', async () => {
        const chat = (currentChatType === 'private') ? db.characters.find(c => c.id === currentChatId) : db.groups.find(g => g.id === currentChatId);
        const startIndex = startRange - 1;
        const count = endRange - startIndex;

        chat.history.splice(startIndex, count);

        if (currentChatType === 'private') {
            recalculateChatStatus(chat);
        }

        await saveData();

        confirmModal.classList.remove('visible');
        showToast(`已成功删除 ${count} 条消息`);
        currentPage = 1;
        renderMessages(false, true);
        renderChatList();
    });

    cancelBtn.addEventListener('click', () => {
        confirmModal.classList.remove('visible');
    });
}


// 备份提示
function promptForBackupIfNeeded(triggerType) {
    if (triggerType === 'history_milestone') {
        showToast('uwu提醒您：记得备份噢');
    }
}

// 重新计算并更新角色状态
function recalculateChatStatus(chat) {
    if (!chat || !chat.history) return;
    
    // 仅针对私聊且非群聊
    // 注意：虽然函数参数叫 chat，但在调用处需确保是 private 类型或者在这里判断
    // 由于群聊没有状态栏，这里主要针对 private
    // 但为了通用性，我们可以检查 chat.realName 是否存在
    
    if (!chat.realName) return; // 简单判断，群聊通常没有单人的 realName 用于状态更新（群聊逻辑不同）

    const updateStatusRegex = new RegExp(`\\[${chat.realName}更新状态为：(.*?)\\]`);
    let foundStatus = '在线'; // 默认状态

    // 倒序遍历历史记录
    for (let i = chat.history.length - 1; i >= 0; i--) {
        const msg = chat.history[i];
        // 忽略被撤回的消息
        if (msg.isWithdrawn) continue;

        const match = msg.content.match(updateStatusRegex);
        if (match) {
            foundStatus = match[1];
            break; // 找到最近的一个状态，停止遍历
        }
    }

    // 更新状态
    chat.status = foundStatus;
    
    // 如果当前正在该聊天室，实时更新 UI
    if (currentChatId === chat.id) {
        const statusTextEl = document.getElementById('chat-room-status-text');
        if (statusTextEl) {
            statusTextEl.textContent = foundStatus;
        }
    }
}

// 估算当前对话上下文的 Token 数
function estimateChatTokens(chatId, chatType = 'private') {
    const chat = (chatType === 'private') ? db.characters.find(c => c.id === chatId) : db.groups.find(g => g.id === chatId);
    if (!chat) return 0;

    let systemPrompt = '';
    if (chatType === 'private') {
        if (typeof generatePrivateSystemPrompt === 'function') {
            systemPrompt = generatePrivateSystemPrompt(chat);
        }
    } else {
        if (typeof generateGroupSystemPrompt === 'function') {
            systemPrompt = generateGroupSystemPrompt(chat);
        }
    }

    let historySlice = chat.history.slice(-chat.maxMemory);
    
    let totalText = systemPrompt;

    historySlice.forEach(msg => {
        totalText += msg.content;
        if (msg.parts) {
            msg.parts.forEach(p => {
                if (p.type === 'text') totalText += p.text;
            });
        }
    });

    // 简单估算：汉字算 1.6，其他算 0.4 (安全估算，适配 Gemini/Claude 等高消耗模型)
    const chinese = (totalText.match(/[\u4e00-\u9fa5]/g) || []).length;
    const other = totalText.length - chinese;
    return Math.ceil(chinese * 1.2 + other * 0.4); 
}

const AudioManager = {
    _audio: null,
    
    get audio() {
        if (!this._audio) {
            this._audio = new Audio();
            this._audio.addEventListener('ended', () => {
                // 可选：播放结束后的清理工作
            });
            this._audio.addEventListener('error', (e) => {
                console.warn('Audio Object Error:', e);
            });
        }
        return this._audio;
    },

    play(source) {
        if (!source) return;
        const a = this.audio;
        
        // 如果当前正在播放且源相同，可以重置进度（打断重播）
        // 如果源不同，直接切换
        try {
            a.src = source;
            a.volume = 1.0; 
            a.currentTime = 0;
            
            const p = a.play();
            if (p && typeof p.catch === 'function') {
                p.catch(e => {
                    // 忽略 AbortError (被新的播放打断是正常的)
                    if (e.name !== 'AbortError') {
                        console.warn('播放提示音失败:', e);
                    }
                });
            }
        } catch (e) {
            console.warn('音频播放异常:', e);
        }
    },

    // 预热/解锁音频对象（用于在没有发送音效时获取播放权限）
    unlock() {
        if (db.globalReceiveSound) {
            const a = this.audio;
            // 记录当前状态
            const originalSrc = a.src;
            
            // 切换到接收音效进行预热
            if (!a.src || a.src !== db.globalReceiveSound) {
                 a.src = db.globalReceiveSound;
            }
            
            a.volume = 0; // 静音
            const p = a.play();
            if (p) {
                p.then(() => {
                    a.pause();
                    a.currentTime = 0;
                    a.volume = 1; 
                }).catch(e => {
                    // 预热失败也不影响流程
                    a.volume = 1;
                });
            }
        }
    }
};

function playSound(source) {
    AudioManager.play(source);
}
