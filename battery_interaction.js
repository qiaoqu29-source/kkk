/**
 * 电量交互模块
 * 负责监听设备电量状态，并在满足特定条件时（低电量且未充电）
 * 为 AI 对话提供上下文提示。
 */

const BatteryInteraction = {
    batteryManager: null,
    hasSentLowBatteryPrompt: false,
    threshold: 0.20, // 20% 电量阈值

    /**
     * 初始化电池监听
     */
    async init() {
        if ('getBattery' in navigator) {
            try {
                this.batteryManager = await navigator.getBattery();
                
                // 初始检查，如果电量充足或正在充电，确保重置状态
                this.checkResetCondition();

                // 监听事件
                this.batteryManager.addEventListener('levelchange', () => {
                    this.checkResetCondition();
                });
                
                this.batteryManager.addEventListener('chargingchange', () => {
                    this.checkResetCondition();
                });

                console.log('BatteryInteraction initialized');
            } catch (error) {
                console.warn('BatteryInteraction: Failed to get battery manager', error);
            }
        } else {
            console.warn('BatteryInteraction: Battery API not supported');
        }
    },

    /**
     * 检查是否需要重置“已发送提示”的状态
     * 当电量恢复到阈值以上，或者开始充电时，重置状态
     */
    checkResetCondition() {
        if (!this.batteryManager) return;

        const level = this.batteryManager.level;
        const isCharging = this.batteryManager.charging;

        // 如果正在充电 或者 电量高于阈值，则重置标记
        if (isCharging || level > this.threshold) {
            if (this.hasSentLowBatteryPrompt) {
                console.log('BatteryInteraction: Resetting prompt status (Charging or Level > 20%)');
                this.hasSentLowBatteryPrompt = false;
            }
        }
    },

    /**
     * 判断当前是否应该触发低电量提示
     * @returns {boolean}
     */
    shouldTriggerPrompt() {
        if (!this.batteryManager) return false;

        const level = this.batteryManager.level;
        const isCharging = this.batteryManager.charging;

        // 条件：电量 <= 阈值 且 未充电 且 尚未发送过提示
        if (level <= this.threshold && !isCharging && !this.hasSentLowBatteryPrompt) {
            return true;
        }

        return false;
    },

    /**
     * 获取提示内容
     * @returns {string}
     */
    getPromptContent() {
        if (!this.batteryManager) return '';
        
        const levelPercent = Math.floor(this.batteryManager.level * 100);
        return `[system:检测到用户设备电量仅剩 ${levelPercent}% 且未处于充电状态。请根据你的人设，在回复中自然地提醒用户去充电，或者表达对用户手机即将没电的关心。]`;
    },

    /**
     * 标记提示已发送
     * 应在成功将提示加入对话上下文后调用
     */
    markPromptAsSent() {
        this.hasSentLowBatteryPrompt = true;
        console.log('BatteryInteraction: Prompt marked as sent');
    }
};

// 导出到全局对象，以便其他文件访问
window.BatteryInteraction = BatteryInteraction;
