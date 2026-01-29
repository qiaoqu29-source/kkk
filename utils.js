// --- 工具函数库 (js/utils.js) ---

// 电池状态更新
async function updateBatteryStatus() {
    if ('getBattery' in navigator) {
        try {
            const battery = await navigator.getBattery();
            const batteryLevelText = document.getElementById('battery-level');
            const batteryFillRect = document.getElementById('battery-fill-rect');

            const updateDisplay = () => {
                if (!batteryLevelText || !batteryFillRect) return;
                const level = Math.floor(battery.level * 100);
                batteryLevelText.textContent = `${level}%`;
                batteryFillRect.setAttribute('width', 18 * battery.level);
                let fillColor = "#666"; 
                if (battery.charging) {
                    fillColor = "#4CAF50"; 
                } else if (level <= 20) {
                    fillColor = "#f44336"; 
                }
                batteryFillRect.setAttribute('fill', fillColor);
            };

            updateDisplay();
            battery.addEventListener('levelchange', updateDisplay);
            battery.addEventListener('chargingchange', updateDisplay);

        } catch (error) {
            console.error('无法获取电池信息:', error);
            const batteryWidget = document.querySelector('.widget-battery');
            if (batteryWidget) batteryWidget.style.display = 'none';
        }
    } else {
        const batteryWidget = document.querySelector('.widget-battery');
        if (batteryWidget) batteryWidget.style.display = 'none';
    }
}

// 随机获取 API Key
function getRandomValue(str) {
    if (str && str.includes(',')) {
        const arr = str.split(',').map(item => item.trim());
        const randomIndex = Math.floor(Math.random() * arr.length);
        return arr[randomIndex];
    }
    return str;
}

// 图片压缩工具
async function compressImage(file, options = {}) {
    const { quality = 0.8, maxWidth = 800, maxHeight = 800 } = options;

    if (file.type === 'image/gif') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onerror = reject;
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onerror = reject;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                if (file.type === 'image/png') {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, width, height);
                }

                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataUrl);
            };
        };
    });
}

// 数字补零
const pad = (num) => num.toString().padStart(2, '0');

// UUID 生成器
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Toast 通知系统
let notificationQueue = [];
let isToastVisible = false;

function processToastQueue() {
    if (isToastVisible || notificationQueue.length === 0) {
        return;
    }

    isToastVisible = true;
    const notification = notificationQueue.shift();

    const toastElement = document.getElementById('toast-notification');
    const avatarEl = toastElement.querySelector('.toast-avatar');
    const nameEl = toastElement.querySelector('.toast-name');
    const messageEl = toastElement.querySelector('.toast-message');

    const isRichNotification = typeof notification === 'object' && notification !== null && notification.name;

    if (isRichNotification) {
        toastElement.classList.remove('simple');
        avatarEl.style.display = 'block';
        nameEl.style.display = 'block';
        messageEl.style.textAlign = 'left';
        avatarEl.src = notification.avatar || 'https://i.postimg.cc/Y96LPskq/o-o-2.jpg';
        nameEl.textContent = notification.name;
        messageEl.textContent = notification.message;
    } else {
        toastElement.classList.add('simple');
        avatarEl.style.display = 'none';
        nameEl.style.display = 'none';
        messageEl.style.textAlign = 'center';
        messageEl.textContent = notification;
    }

    toastElement.classList.add('show');

    setTimeout(() => {
        toastElement.classList.remove('show');
        setTimeout(() => {
            isToastVisible = false;
            processToastQueue();
        }, 500);
    }, 3000);
}

const showToast = (notification) => {
    notificationQueue.push(notification);
    processToastQueue();
};

// 触感反馈工具
function triggerHapticFeedback(type = 'light') {
    if (!navigator.vibrate) return;

    try {
        switch (type) {
            case 'light':
                navigator.vibrate(5); // 极轻微震动
                break;
            case 'medium':
                navigator.vibrate(15); // 中等震动
                break;
            case 'heavy':
                navigator.vibrate(30); // 重度震动
                break;
            case 'success':
                navigator.vibrate([10, 30, 10]); // 成功震动模式
                break;
            case 'error':
                navigator.vibrate([50, 30, 50, 30, 50]); // 错误震动模式
                break;
            case 'selection':
                navigator.vibrate(10); // 选择震动
                break;
            default:
                navigator.vibrate(5);
        }
    } catch (e) {
        // 忽略不支持或被禁用的情况
    }
}

// 错误处理翻译
function getFriendlyErrorMessage(error) {
    if (error.name === 'AbortError') return '请求超时了，请检查您的网络或稍后再试。';
    if (error instanceof SyntaxError) return '服务器返回的数据格式不对，建议您重试一次。';
    
    if (error.response) {
        const status = error.response.status;
        switch (status) {
            case 400: return '请求参数有误 (400)，通常是模型版本不对或发送内容过长。';
            case 401: return 'API密钥无效 (401)，请检查API设置中的Key是否正确。';
            case 403: return '访问被拒绝 (403)，可能是密钥权限不足或账号被封禁。';
            case 404: return 'API地址错误 (404)，找不到请求的接口，请检查Base URL。';
            case 429: return '请求太频繁啦 (429)，触发了速率限制，请稍等一会再试。';
            case 500: return '服务器内部错误 (500)，服务商那边出问题了。';
            case 502: return '网关错误 (502)，服务商网络异常。';
            case 503: return '服务暂时不可用 (503)，服务器可能正在维护或过载。';
            case 504: return '网关超时 (504)，服务器响应太慢了，请检查网络。';
            default: return `服务器返回了一个错误 (状态码: ${status})，请稍后再试。`;
        }
    }

    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        return '无法连接到服务器，请检查您的网络连接或API地址是否正确。';
    }

    return `发生了一个未知错误：${error.message}`;
}

// 显示错误弹窗
function showErrorModal(friendlyMessage, fullError) {
    const oldModal = document.getElementById('error-modal-overlay');
    if (oldModal) oldModal.remove();

    let logContent = `Error: ${fullError.name}: ${fullError.message}\n`;
    if (fullError.stack) logContent += `\nStack:\n${fullError.stack}\n`;
    if (fullError.response) {
        logContent += `\nResponse Status: ${fullError.response.status}\n`;
    }

    const modalHtml = `
    <div id="error-modal-overlay" class="modal-overlay visible" style="z-index: 9999; align-items: center; justify-content: center; display: flex;">
        <div class="modal-window" style="max-width: 90%; width: 380px; padding: 0; overflow: hidden; display: flex; flex-direction: column; max-height: 85vh; border-radius: 16px; background: #fff; box-shadow: 0 10px 40px rgba(0,0,0,0.2);">
            <div style="padding: 25px 20px 15px; text-align: center; flex-shrink: 0;">
                <div style="width: 56px; height: 56px; background: #ffebee; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px;">
                    <svg style="width: 32px; height: 32px; color: #d32f2f;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </div>
                <h3 style="margin: 0; color: #333; font-size: 18px; font-weight: 700;">出错了</h3>
                <p style="margin: 10px 0 0; color: #666; font-size: 15px; line-height: 1.5;">${friendlyMessage}</p>
            </div>
            <div style="flex-grow: 1; overflow-y: auto; padding: 0 20px 10px;">
                <div class="collapsible-section" style="border: 1px solid #eee; background: #f9f9f9; margin: 0; border-radius: 8px;">
                    <div class="collapsible-header" style="padding: 12px; background: #f5f5f5; border-bottom: 1px solid #eee;" onclick="this.parentElement.classList.toggle('open')">
                        <span style="font-size: 13px; color: #666; font-weight: 600; display: flex; align-items: center; gap: 5px;">
                            <svg style="width: 14px; height: 14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                            查看详细日志
                        </span>
                        <span class="collapsible-arrow" style="color: #999;">▼</span>
                    </div>
                    <div class="collapsible-content" style="padding: 0 12px;">
                        <pre id="error-log-content" style="font-family: 'Menlo', 'Monaco', 'Courier New', monospace; font-size: 11px; color: #444; white-space: pre-wrap; word-break: break-all; margin: 10px 0; background: #fff; padding: 10px; border: 1px solid #eee; border-radius: 4px; max-height: 200px; overflow-y: auto; line-height: 1.4;">${logContent}</pre>
                        <button id="copy-error-btn" class="btn btn-small btn-neutral" style="margin-bottom: 10px; font-size: 12px; padding: 6px 12px; width: 100%; display: flex; justify-content: center; background: #eee; color: #555; border: none;">
                            <svg style="width: 14px; height: 14px; margin-right: 5px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            复制完整日志
                        </button>
                    </div>
                </div>
            </div>
            <div style="padding: 15px 20px 20px; border-top: none; text-align: center; background: #fff; flex-shrink: 0;">
                <button class="btn btn-primary" style="width: 100%; border-radius: 12px; font-weight: 600; font-size: 16px; padding: 12px;" onclick="document.getElementById('error-modal-overlay').remove()">知道了</button>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('copy-error-btn').addEventListener('click', function() {
        navigator.clipboard.writeText(logContent).then(() => {
            this.innerHTML = `<svg style="width: 14px; height: 14px; margin-right: 5px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"></path></svg>已复制`;
            this.style.background = '#e8f5e9';
            this.style.color = '#2e7d32';
            setTimeout(() => {
                this.innerHTML = `<svg style="width: 14px; height: 14px; margin-right: 5px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>复制完整日志`;
                this.style.background = '#eee';
                this.style.color = '#555';
            }, 2000);
        });
    });
}

function showApiError(error) {
    console.error("API Error Detected:", error);
    const friendlyMessage = getFriendlyErrorMessage(error);
    showErrorModal(friendlyMessage, error);
}

// 格式化时间分割线
function formatTimeDivider(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    const isSameYear = date.getFullYear() === now.getFullYear();
    
    const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    
    if (isToday) {
        return timeStr;
    } else if (isYesterday) {
        return `昨天 ${timeStr}`;
    } else if (isSameYear) {
        return `${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`;
    } else {
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`;
    }
}

// 格式化时间戳 YYYY-MM-DD HH:MM:SS
function getFormattedTimestamp(date) {
    const Y = date.getFullYear();
    const M = String(date.getMonth() + 1).padStart(2, '0');
    const D = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

// 格式化时间差
function formatTimeGap(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}天${hours % 24}小时`;
    if (hours > 0) return `${hours}小时${minutes % 60}分钟`;
    if (minutes > 0) return `${minutes}分钟`;
    return `${seconds}秒`;
}

function calculateVoiceDuration(text) {
    return Math.max(1, Math.min(60, Math.ceil(text.length / 3.5)));
}

// 解析混合内容 (文本+HTML)
function getMixedContent(responseData) {
    const results = [];
    let i = 0;

    while (i < responseData.length) {
        const nextTagStart = responseData.indexOf('<', i);
        const nextBracketStart = responseData.indexOf('[', i);

        let firstSpecialIndex = -1;
        if (nextTagStart !== -1 && nextBracketStart !== -1) {
            firstSpecialIndex = Math.min(nextTagStart, nextBracketStart);
        } else {
            firstSpecialIndex = Math.max(nextTagStart, nextBracketStart);
        }

        if (firstSpecialIndex === -1) {
            const text = responseData.substring(i).trim();
            if (text) results.push({ type: 'text', content: `[unknown的消息：${text}]` });
            break;
        }

        if (firstSpecialIndex > i) {
            const text = responseData.substring(i, firstSpecialIndex).trim();
            if (text) results.push({ type: 'text', content: `[unknown的消息：${text}]` });
        }

        i = firstSpecialIndex;

        if (responseData[i] === '<') {
            const tagMatch = responseData.substring(i).match(/^<([a-zA-Z0-9]+)/);
            if (tagMatch) {
                const tagName = tagMatch[1];
                let openCount = 0;
                let searchIndex = i;
                let blockEnd = -1;

                while (searchIndex < responseData.length) {
                    const openTagPos = responseData.indexOf('<' + tagName, searchIndex);
                    const closeTagPos = responseData.indexOf('</' + tagName, searchIndex);

                    if (openTagPos !== -1 && (closeTagPos === -1 || openTagPos < closeTagPos)) {
                        openCount++;
                        searchIndex = openTagPos + 1;
                    } else if (closeTagPos !== -1) {
                        openCount--;
                        searchIndex = closeTagPos + 1;
                        if (openCount === 0) {
                            blockEnd = closeTagPos + `</${tagName}>`.length;
                            break;
                        }
                    } else {
                        break; 
                    }
                }

                if (blockEnd !== -1) {
                    const htmlBlock = responseData.substring(i, blockEnd);
                    const charMatch = htmlBlock.match(/<[a-z][a-z0-9]*\s+char="([^"]*)"/i);
                    const char = charMatch ? charMatch[1] : null;
                    results.push({ type: 'html', char: char, content: htmlBlock });
                    i = blockEnd;
                    continue;
                }
            }
        }
        
        if (responseData[i] === '[') {
            const endBracket = responseData.indexOf(']', i);
            if (endBracket !== -1) {
                const text = responseData.substring(i, endBracket + 1);
                results.push({ type: 'text', content: text });
                i = endBracket + 1;
                continue;
            }
        }

        const nextSpecial1 = responseData.indexOf('<', i + 1);
        const nextSpecial2 = responseData.indexOf('[', i + 1);
        let endOfText = -1;
        if (nextSpecial1 !== -1 && nextSpecial2 !== -1) {
            endOfText = Math.min(nextSpecial1, nextSpecial2);
        } else {
            endOfText = Math.max(nextSpecial1, nextSpecial2);
        }
        if (endOfText === -1) {
            endOfText = responseData.length;
        }
        const text = responseData.substring(i, endOfText).trim();
        if (text) results.push({ type: 'text', content: `[unknown的消息：${text}]` });
        i = endOfText;
    }
    return results;
}
