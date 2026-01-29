// --- 角色相册管理模块 (js/modules/gallery.js) ---

function setupGalleryManagement() {
    const galleryModal = document.getElementById('char-gallery-modal');
    const closeGalleryBtn = document.getElementById('close-gallery-modal-btn');
    const addGalleryBtn = document.getElementById('add-gallery-item-btn');
    const batchAddBtn = document.getElementById('batch-add-gallery-btn');
    
    const itemModal = document.getElementById('gallery-item-modal');
    const itemForm = document.getElementById('gallery-item-form');
    const cancelItemBtn = document.getElementById('cancel-gallery-item-btn');
    
    const batchModal = document.getElementById('batch-gallery-modal');
    const batchTextarea = document.getElementById('batch-gallery-textarea');
    const confirmBatchBtn = document.getElementById('confirm-batch-gallery-btn');
    const cancelBatchBtn = document.getElementById('cancel-batch-gallery-btn');
    const exportGalleryBtn = document.getElementById('export-gallery-btn');
    const importGalleryFileBtn = document.getElementById('import-gallery-file-btn');
    const batchGalleryFileInput = document.getElementById('batch-gallery-file-input');

    // 暴露给全局的打开函数
    window.openGalleryManager = () => {
        if (typeof currentChatType !== 'undefined' && currentChatType !== 'private') {
            return showToast('仅支持私聊角色');
        }
        
        const char = db.characters.find(c => c.id === currentChatId);
        if (!char) return;
        
        renderGalleryList(char);
        galleryModal.classList.add('visible');
    };

    if (closeGalleryBtn) closeGalleryBtn.addEventListener('click', () => galleryModal.classList.remove('visible'));

    // 单个添加
    if (addGalleryBtn) addGalleryBtn.addEventListener('click', () => {
        document.getElementById('gallery-item-id').value = '';
        document.getElementById('gallery-item-name').value = '';
        document.getElementById('gallery-item-url').value = '';
        const preview = document.getElementById('gallery-item-preview');
        preview.innerHTML = '预览';
        preview.style.backgroundImage = 'none';
        itemModal.classList.add('visible');
    });

    if (cancelItemBtn) cancelItemBtn.addEventListener('click', () => itemModal.classList.remove('visible'));

    // 图片上传预览
    const uploadInput = document.getElementById('gallery-item-upload');
    if (uploadInput) {
        uploadInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    // 使用 utils.js 中的 compressImage
                    const compressedUrl = await compressImage(file, { quality: 0.8, maxWidth: 1024, maxHeight: 1024 });
                    document.getElementById('gallery-item-url').value = compressedUrl;
                    const preview = document.getElementById('gallery-item-preview');
                    preview.style.backgroundImage = `url(${compressedUrl})`;
                    preview.textContent = '';
                } catch (err) {
                    showToast('图片处理失败');
                    console.error(err);
                }
            }
        });
    }

    const urlInput = document.getElementById('gallery-item-url');
    if (urlInput) {
        urlInput.addEventListener('input', (e) => {
            const url = e.target.value;
            const preview = document.getElementById('gallery-item-preview');
            if (url) {
                preview.style.backgroundImage = `url(${url})`;
                preview.textContent = '';
            } else {
                preview.style.backgroundImage = 'none';
                preview.textContent = '预览';
            }
        });
    }

    if (itemForm) {
        itemForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const char = db.characters.find(c => c.id === currentChatId);
            if (!char) return;
            
            const id = document.getElementById('gallery-item-id').value;
            const name = document.getElementById('gallery-item-name').value.trim();
            const url = document.getElementById('gallery-item-url').value.trim();
            
            if (!name || !url) return showToast('请填写完整信息');
            
            // 检查重名 (编辑模式下排除自己)
            if (!char.gallery) char.gallery = [];
            const exists = char.gallery.some(p => p.name === name && p.id !== id);
            if (exists) return showToast('图片名称已存在，请更换');

            if (id) {
                const index = char.gallery.findIndex(p => p.id === id);
                if (index > -1) {
                    char.gallery[index] = { ...char.gallery[index], name, url };
                }
            } else {
                char.gallery.push({
                    id: `pic_${Date.now()}`,
                    name,
                    url
                });
            }
            
            await saveData();
            renderGalleryList(char);
            itemModal.classList.remove('visible');
            showToast('保存成功');
        });
    }

    // 批量添加
    if (batchAddBtn) batchAddBtn.addEventListener('click', () => {
        batchTextarea.value = '';
        batchModal.classList.add('visible');
    });

    if (cancelBatchBtn) cancelBatchBtn.addEventListener('click', () => batchModal.classList.remove('visible'));

    // 导出相册
    if (exportGalleryBtn) {
        exportGalleryBtn.addEventListener('click', () => {
            const char = db.characters.find(c => c.id === currentChatId);
            if (!char || !char.gallery || char.gallery.length === 0) {
                return showToast('相册为空，无法导出');
            }

            let content = '';
            char.gallery.forEach(item => {
                content += `${item.name}:${item.url}\n`;
            });

            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${char.realName}_相册导出.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('相册已导出');
        });
    }

    // 从文件导入
    if (importGalleryFileBtn && batchGalleryFileInput) {
        importGalleryFileBtn.addEventListener('click', () => {
            batchGalleryFileInput.click();
        });

        batchGalleryFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target.result;
                batchTextarea.value = content; // 将内容填充到文本框，方便用户确认或编辑
                e.target.value = ''; // 重置 input，允许重复选择同一文件
            };
            reader.readAsText(file);
        });
    }

    if (confirmBatchBtn) confirmBatchBtn.addEventListener('click', async () => {
        const text = batchTextarea.value.trim();
        if (!text) return;
        
        const char = db.characters.find(c => c.id === currentChatId);
        if (!char) return;
        if (!char.gallery) char.gallery = [];

        const lines = text.split('\n');
        let count = 0;
        
        lines.forEach(line => {
            // 支持 "名称:URL" 或 "名称:URL" (中文冒号)
            // 如果是 "名称:描述:URL"，取第一段做名称，最后一段做URL（虽然目前没存描述，但做个简单解析）
            // 简单起见，按第一个冒号分割
            const parts = line.split(/[:：]/);
            if (parts.length >= 2) {
                const name = parts[0].trim();
                // 剩下的部分重新组合作为URL (防止URL中有冒号)
                const url = parts.slice(1).join(':').trim(); 
                
                if (name && url && !char.gallery.some(p => p.name === name)) {
                    char.gallery.push({
                        id: `pic_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                        name,
                        url
                    });
                    count++;
                }
            }
        });

        await saveData();
        renderGalleryList(char);
        batchModal.classList.remove('visible');
        showToast(`成功导入 ${count} 张图片`);
    });
}

function renderGalleryList(char) {
    const container = document.getElementById('gallery-list-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (!char.gallery || char.gallery.length === 0) {
        container.innerHTML = '<p class="placeholder-text" style="text-align: center; color: #999; margin-top: 20px;">相册空空如也~</p>';
        return;
    }

    char.gallery.forEach(item => {
        const el = document.createElement('div');
        el.className = 'gallery-list-item';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.padding = '8px';
        el.style.borderBottom = '1px solid #eee';
        el.style.gap = '10px';
        el.style.cursor = 'pointer';
        
        el.innerHTML = `
            <div style="width: 50px; height: 50px; background-image: url('${item.url}'); background-size: cover; background-position: center; border-radius: 4px; flex-shrink: 0;"></div>
            <div style="flex: 1; overflow: hidden;">
                <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 14px;">${item.name}</div>
                <div style="font-size: 12px; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.url}</div>
            </div>
            <button class="btn btn-danger btn-small delete-btn" style="padding: 4px 8px;">删除</button>
        `;
        
        el.querySelector('.delete-btn').addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`确定删除图片“${item.name}”吗？`)) {
                char.gallery = char.gallery.filter(p => p.id !== item.id);
                await saveData();
                renderGalleryList(char);
            }
        });

        // 点击编辑
        el.addEventListener('click', () => {
            document.getElementById('gallery-item-id').value = item.id;
            document.getElementById('gallery-item-name').value = item.name;
            document.getElementById('gallery-item-url').value = item.url;
            const preview = document.getElementById('gallery-item-preview');
            preview.style.backgroundImage = `url(${item.url})`;
            preview.textContent = '';
            document.getElementById('gallery-item-modal').classList.add('visible');
        });

        container.appendChild(el);
    });
}
