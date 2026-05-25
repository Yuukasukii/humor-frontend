// 全局存储原始统计数据
let rawStats = null;

// 获取后端统计数据
async function fetchStatistics() {
    try {
        const response = await fetch('/api/statistics');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        rawStats = await response.json();
        renderDashboard('all');
    } catch (error) {
        console.error('获取统计数据失败:', error);
        document.getElementById('total-submissions').innerText = '加载失败';
        // 可显示错误提示，但保持页面不崩溃
    }
}

// 根据天数筛选每日趋势数据
function filterDailyTrend(days) {
    if (!rawStats || !rawStats.daily_trend) return [];
    let trend = [...rawStats.daily_trend];
    if (days === 'all') return trend;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return trend.filter(item => new Date(item.date) >= cutoff);
}

// 更新统计卡片
function updateStats() {
    if (!rawStats) return;
    document.getElementById('total-submissions').innerText = rawStats.total_submissions || 0;
    const avg = rawStats.avg_scores || {};
    document.getElementById('avg-fun').innerText = (avg.fun || 0).toFixed(1);
    document.getElementById('avg-creativity').innerText = (avg.creativity || 0).toFixed(1);
    document.getElementById('avg-naturalness').innerText = (avg.naturalness || 0).toFixed(1);
    document.getElementById('avg-relevance').innerText = (avg.relevance || 0).toFixed(1);

    if (rawStats.daily_trend && rawStats.daily_trend.length > 0) {
        const minDate = rawStats.daily_trend[0].date;
        const maxDate = rawStats.daily_trend[rawStats.daily_trend.length-1].date;
        document.getElementById('date-range').innerText = `${minDate} 至 ${maxDate}`;
    } else {
        document.getElementById('date-range').innerText = '暂无数据';
    }
}

// 渲染柱状图（四个维度平均分）
function renderBarChart() {
    if (!rawStats) return;
    const avg = rawStats.avg_scores || { fun:0, creativity:0, naturalness:0, relevance:0 };
    const chart = echarts.init(document.getElementById('bar-chart'));
    chart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { containLabel: true },
        xAxis: { type: 'category', data: ['趣味性', '创意性', '自然度', '内容关联度'] },
        yAxis: { type: 'value', name: '平均分', min: 0, max: 5 },
        series: [{
            data: [avg.fun, avg.creativity, avg.naturalness, avg.relevance],
            type: 'bar',
            itemStyle: {
                borderRadius: [8,8,0,0],
                color: params => {
                    const colors = ['#f97316', '#8b5cf6', '#10b981', '#3b82f6'];
                    return colors[params.dataIndex];
                }
            },
            label: { show: true, position: 'top', formatter: '{c}' }
        }]
    });
}

// 渲染折线图（每日提交趋势）
function renderLineChart(days = 'all') {
    if (!rawStats) return;
    const trend = filterDailyTrend(days);
    const dates = trend.map(item => item.date);
    const counts = trend.map(item => item.count);
    const chart = echarts.init(document.getElementById('line-chart'));
    chart.setOption({
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: dates, axisLabel: { rotate: 45, interval: 'auto' } },
        yAxis: { type: 'value', name: '提交次数' },
        series: [{
            data: counts,
            type: 'line',
            smooth: true,
            lineStyle: { color: '#f97316', width: 3 },
            areaStyle: { opacity: 0.1, color: '#f97316' },
            symbol: 'circle',
            symbolSize: 6
        }]
    });
}

// 渲染饼图（趣味性评分分布）
function renderPieChart() {
    if (!rawStats) return;
    const dist = rawStats.score_distribution?.fun || [0,0,0,0,0];
    const chart = echarts.init(document.getElementById('pie-chart'));
    chart.setOption({
        tooltip: { trigger: 'item' },
        legend: { orient: 'vertical', left: 'left', itemWidth: 20 },
        series: [{
            type: 'pie',
            radius: '55%',
            data: [
                { name: '1星（差）', value: dist[0] },
                { name: '2星（较差）', value: dist[1] },
                { name: '3星（一般）', value: dist[2] },
                { name: '4星（较好）', value: dist[3] },
                { name: '5星（趣味性拉满）', value: dist[4] }
            ],
            emphasis: { scale: true },
            label: { show: true, formatter: '{b}: {d}%' }
        }]
    });
}

// 主渲染函数
function renderDashboard(days = 'all') {
    if (!rawStats) return;
    updateStats();
    renderBarChart();
    renderLineChart(days);
    renderPieChart();
}

// 筛选按钮交互
function initFilters() {
    const btns = document.querySelectorAll('.filter-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const days = btn.getAttribute('data-days');
            renderLineChart(days);
        });
    });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    fetchStatistics();
});