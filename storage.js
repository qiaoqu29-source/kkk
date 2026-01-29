// --- 存储分析 (js/modules/storage.js) ---

function setupStorageAnalysisScreen() {
    const screen = document.getElementById('storage-analysis-screen');
    const chartContainer = document.getElementById('storage-chart-container');
    const detailsList = document.getElementById('storage-details-list');
    let myChart = null;

    const colorPalette = ['#ff80ab', '#90caf9', '#a5d6a7', '#fff59d', '#b39ddb', '#ffcc80'];

    const categoryNames = {
        messages: '聊天记录',
        charactersAndGroups: '角色与群组',
        worldAndForum: '世界书与论坛',
        personalization: '个性化设置',
        apiAndCore: '核心与API',
        other: '其他数据'
    };

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    function renderStorageChart(info, colors) {
        if (!myChart) {
            myChart = echarts.init(chartContainer);
        }

        const chartData = Object.entries(info.categorizedSizes)
            .map(([key, value]) => ({
                name: categoryNames[key] || key,
                value: value
            }))
            .filter(item => item.value > 0);

        const option = {
            color: colors,
            tooltip: {
                trigger: 'item',
                formatter: '{a} <br/>{b}: {c} ({d}%)'
            },
            legend: {
                show: false 
            },
            series: [
                {
                    name: '存储占比',
                    type: 'pie',
                    radius: ['50%', '70%'],
                    avoidLabelOverlap: false,
                    label: {
                        show: false,
                        position: 'center'
                    },
                    emphasis: {
                        label: {
                            show: true,
                            fontSize: '20',
                            fontWeight: 'bold'
                        }
                    },
                    labelLine: {
                        show: false
                    },
                    data: chartData
                }
            ]
        };
        myChart.setOption(option);
    }

    function renderStorageDetails(info, colors) {
        detailsList.innerHTML = '';
        const totalSize = info.totalSize;

        const totalSizeEl = document.getElementById('storage-total-size');
        if (totalSizeEl) {
            totalSizeEl.textContent = formatBytes(totalSize);
        }

        const sortedData = Object.entries(info.categorizedSizes)
            .map(([key, value]) => ({
                key: key,
                name: categoryNames[key] || key,
                value: value
            }))
            .sort((a, b) => b.value - a.value);

        sortedData.forEach((item, index) => {
            if (item.value <= 0) return; 
            const percentage = totalSize > 0 ? ((item.value / totalSize) * 100).toFixed(2) : 0;
            const color = colors[index % colors.length];

            const detailItem = document.createElement('div');
            detailItem.className = 'storage-detail-item';
            detailItem.innerHTML = `
                <div class="storage-color-indicator" style="background-color: ${color};"></div>
                <div class="storage-detail-info">
                    <span class="storage-detail-name">${item.name}</span>
                    <span class="storage-detail-size">${formatBytes(item.value)}</span>
                </div>
                <span class="storage-detail-percentage">${percentage}%</span>
            `;
            detailsList.appendChild(detailItem);
        });
    }

    const observer = new MutationObserver(async (mutations) => {
        if (screen.classList.contains('active')) {
            showToast('正在分析存储空间...');
            const storageInfo = await dataStorage.getStorageInfo();
            if (storageInfo) {
                renderStorageChart(storageInfo, colorPalette);
                renderStorageDetails(storageInfo, colorPalette);
            } else {
                showToast('分析失败');
            }
        }
    });

    observer.observe(screen, { attributes: true, attributeFilter: ['class'] });
}
