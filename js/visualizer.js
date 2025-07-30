// Advanced Data Visualization for Drive Analyzer

class DriveVisualizer {
    constructor() {
        this.charts = new Map();
        this.colorSchemes = {
            default: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'],
            pastel: ['#93c5fd', '#6ee7b7', '#fcd34d', '#fca5a5', '#c4b5fd', '#67e8f9', '#bef264', '#fdba74'],
            vibrant: ['#1d4ed8', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#65a30d', '#ea580c'],
            dark: ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#38bdf8', '#a3e635', '#fb923c']
        };
        this.currentColorScheme = 'default';
    }
    
    // Set color scheme
    setColorScheme(scheme) {
        if (this.colorSchemes[scheme]) {
            this.currentColorScheme = scheme;
        }
    }
    
    // Get colors for current scheme
    getColors(count = 8) {
        const colors = this.colorSchemes[this.currentColorScheme];
        if (count <= colors.length) {
            return colors.slice(0, count);
        }
        
        // Generate additional colors if needed
        const additionalColors = [];
        for (let i = colors.length; i < count; i++) {
            const hue = (i * 137.508) % 360; // Golden angle
            additionalColors.push(`hsl(${hue}, 70%, 60%)`);
        }
        
        return [...colors, ...additionalColors];
    }
    
    // Create distribution pie chart
    createDistributionChart(canvas, data, options = {}) {
        const ctx = canvas.getContext('2d');
        
        // Destroy existing chart
        if (this.charts.has(canvas.id)) {
            this.charts.get(canvas.id).destroy();
        }
        
        const chartData = this.prepareDistributionData(data, options);
        
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.sizes,
                    backgroundColor: this.getColors(chartData.labels.length),
                    borderColor: '#ffffff',
                    borderWidth: 2,
                    hoverBorderWidth: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.label;
                                const value = Utils.formatBytes(context.raw);
                                const percentage = Utils.percentage(context.raw, chartData.total);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    duration: 1000
                },
                cutout: '50%'
            }
        });
        
        this.charts.set(canvas.id, chart);
        return chartData;
    }
    
    // Create file type chart
    createFileTypeChart(canvas, stats) {
        const ctx = canvas.getContext('2d');
        
        if (this.charts.has(canvas.id)) {
            this.charts.get(canvas.id).destroy();
        }
        
        const fileTypes = stats.fileTypes || {};
        const labels = Object.keys(fileTypes);
        const data = Object.values(fileTypes);
        
        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.map(label => label.charAt(0).toUpperCase() + label.slice(1)),
                datasets: [{
                    label: 'File Count',
                    data: data,
                    backgroundColor: this.getColors(labels.length),
                    borderColor: this.getColors(labels.length),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `${context.label}: ${Utils.formatNumber(context.raw)} files`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => Utils.formatNumber(value)
                        }
                    }
                }
            }
        });
        
        this.charts.set(canvas.id, chart);
        return chart;
    }
    
    // Create size distribution chart
    createSizeDistributionChart(canvas, stats) {
        const ctx = canvas.getContext('2d');
        
        if (this.charts.has(canvas.id)) {
            this.charts.get(canvas.id).destroy();
        }
        
        const sizeDistribution = stats.sizeDistribution || {};
        const labels = ['Tiny (<1KB)', 'Small (<1MB)', 'Medium (<100MB)', 'Large (<1GB)', 'Huge (>1GB)'];
        const data = [
            sizeDistribution.tiny || 0,
            sizeDistribution.small || 0,
            sizeDistribution.medium || 0,
            sizeDistribution.large || 0,
            sizeDistribution.huge || 0
        ];
        
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: this.getColors(5),
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const percentage = Utils.percentage(context.raw, data.reduce((a, b) => a + b, 0));
                                return `${context.label}: ${Utils.formatNumber(context.raw)} files (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '40%'
            }
        });
        
        this.charts.set(canvas.id, chart);
        return chart;
    }
    
    // Create timeline chart showing file modification dates
    createTimelineChart(canvas, files) {
        const ctx = canvas.getContext('2d');
        
        if (this.charts.has(canvas.id)) {
            this.charts.get(canvas.id).destroy();
        }
        
        // Group files by month
        const monthlyData = this.groupFilesByMonth(files);
        const labels = Object.keys(monthlyData).sort();
        const fileCounts = labels.map(month => monthlyData[month].count);
        const sizeTotals = labels.map(month => monthlyData[month].size);
        
        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'File Count',
                    data: fileCounts,
                    borderColor: this.getColors(1)[0],
                    backgroundColor: this.getColors(1)[0] + '20',
                    yAxisID: 'y'
                }, {
                    label: 'Total Size (MB)',
                    data: sizeTotals.map(size => size / (1024 * 1024)),
                    borderColor: this.getColors(2)[1],
                    backgroundColor: this.getColors(2)[1] + '20',
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Month'
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'File Count'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Size (MB)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });
        
        this.charts.set(canvas.id, chart);
        return chart;
    }
    
    // Create tree map visualization
    createTreeMap(container, data, options = {}) {
        container.innerHTML = '';
        
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 400;
        
        // Use D3.js for treemap if available, otherwise fall back to simple implementation
        if (typeof d3 !== 'undefined') {
            this.createD3TreeMap(container, data, width, height);
        } else {
            this.createSimpleTreeMap(container, data, width, height);
        }
    }
    
    // D3.js treemap implementation
    createD3TreeMap(container, data, width, height) {
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);
        
        const treemapData = this.prepareTreeMapData(data);
        
        const treemap = d3.treemap()
            .size([width, height])
            .padding(2);
        
        const root = d3.hierarchy(treemapData)
            .sum(d => d.size)
            .sort((a, b) => b.value - a.value);
        
        treemap(root);
        
        const colors = this.getColors(10);
        const colorScale = d3.scaleOrdinal(colors);
        
        svg.selectAll('rect')
            .data(root.leaves())
            .enter()
            .append('rect')
            .attr('x', d => d.x0)
            .attr('y', d => d.y0)
            .attr('width', d => d.x1 - d.x0)
            .attr('height', d => d.y1 - d.y0)
            .attr('fill', d => colorScale(d.data.type || 'unknown'))
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1)
            .append('title')
            .text(d => `${d.data.name}\n${Utils.formatBytes(d.data.size)}`);
        
        // Add labels for larger rectangles
        svg.selectAll('text')
            .data(root.leaves().filter(d => (d.x1 - d.x0) > 60 && (d.y1 - d.y0) > 20))
            .enter()
            .append('text')
            .attr('x', d => d.x0 + 4)
            .attr('y', d => d.y0 + 16)
            .attr('font-size', '12px')
            .attr('fill', '#333')
            .text(d => d.data.name.length > 20 ? d.data.name.substring(0, 17) + '...' : d.data.name);
    }
    
    // Simple treemap implementation
    createSimpleTreeMap(container, data, width, height) {
        const treemapData = this.prepareTreeMapData(data);
        this.renderSimpleTreeMap(container, treemapData, { x: 0, y: 0, width, height }, 0);
    }
    
    // Custom legend component
    createLegend(container, data, type = 'distribution') {
        container.innerHTML = '';
        
        let legendData = [];
        
        if (type === 'distribution') {
            const chartData = this.prepareDistributionData(data);
            legendData = chartData.items.map((item, index) => ({
                label: item.name,
                value: Utils.formatBytes(item.size),
                percentage: Utils.percentage(item.size, chartData.total),
                color: this.getColors(chartData.items.length)[index]
            }));
        }
        
        legendData.forEach(item => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            legendItem.innerHTML = `
                <div class="legend-color" style="background-color: ${item.color}"></div>
                <div class="legend-details">
                    <div class="legend-label">${item.label}</div>
                    <div class="legend-value">${item.value} (${item.percentage}%)</div>
                </div>
            `;
            container.appendChild(legendItem);
        });
    }
    
    // Prepare data for distribution charts
    prepareDistributionData(data, options = {}) {
        const maxItems = options.maxItems || 10;
        const items = [];
        
        if (data && data.children) {
            const sortedChildren = [...data.children]
                .sort((a, b) => b.size - a.size)
                .slice(0, maxItems);
            
            sortedChildren.forEach(child => {
                items.push({
                    name: child.name,
                    size: child.size,
                    isDirectory: child.isDirectory,
                    type: child.type || (child.isDirectory ? 'folder' : 'file')
                });
            });
            
            // Group remaining items as "Others"
            if (data.children.length > maxItems) {
                const othersSize = data.children
                    .slice(maxItems)
                    .reduce((sum, child) => sum + child.size, 0);
                
                if (othersSize > 0) {
                    items.push({
                        name: `Others (${data.children.length - maxItems} items)`,
                        size: othersSize,
                        isDirectory: false,
                        type: 'others'
                    });
                }
            }
        }
        
        return {
            labels: items.map(item => item.name),
            sizes: items.map(item => item.size),
            total: data ? data.size : 0,
            items: items
        };
    }
    
    // Prepare data for treemap
    prepareTreeMapData(data) {
        if (!data || !data.children) {
            return { name: 'Root', children: [], size: 0 };
        }
        
        const mapData = {
            name: data.name,
            children: data.children.map(child => ({
                name: child.name,
                size: child.size,
                type: child.type || (child.isDirectory ? 'folder' : 'file'),
                path: child.path
            })),
            size: data.size
        };
        
        return mapData;
    }
    
    // Group files by month for timeline chart
    groupFilesByMonth(files) {
        const monthlyData = {};
        
        files.forEach(file => {
            if (file.lastModified) {
                const date = new Date(file.lastModified);
                const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                
                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = { count: 0, size: 0 };
                }
                
                monthlyData[monthKey].count++;
                monthlyData[monthKey].size += file.size;
            }
        });
        
        return monthlyData;
    }
    
    // Render simple treemap recursively
    renderSimpleTreeMap(container, data, rect, depth) {
        if (depth > 2 || !data.children || data.children.length === 0) return;
        
        const colors = this.getColors(10);
        const totalSize = data.size;
        
        let currentY = rect.y;
        
        data.children.forEach((child, index) => {
            if (child.size === 0) return;
            
            const childHeight = (child.size / totalSize) * rect.height;
            
            const childElement = document.createElement('div');
            childElement.style.position = 'absolute';
            childElement.style.left = `${rect.x}px`;
            childElement.style.top = `${currentY}px`;
            childElement.style.width = `${rect.width}px`;
            childElement.style.height = `${childHeight}px`;
            childElement.style.backgroundColor = colors[depth % colors.length];
            childElement.style.border = '1px solid #fff';
            childElement.style.overflow = 'hidden';
            childElement.style.fontSize = '12px';
            childElement.style.padding = '4px';
            childElement.style.boxSizing = 'border-box';
            childElement.style.cursor = 'pointer';
            
            if (childHeight > 20) {
                childElement.innerHTML = `
                    <div style="font-weight: bold; color: #333;">
                        ${child.name.length > 20 ? child.name.substring(0, 17) + '...' : child.name}
                    </div>
                    <div style="font-size: 10px; color: #666;">
                        ${Utils.formatBytes(child.size)}
                    </div>
                `;
            }
            
            childElement.title = `${child.name}\nSize: ${Utils.formatBytes(child.size)}`;
            
            container.appendChild(childElement);
            currentY += childHeight;
        });
    }
    
    // Update all charts with new data
    updateCharts(data, stats) {
        // Update distribution chart
        const distributionCanvas = document.getElementById('distributionChart');
        if (distributionCanvas) {
            this.createDistributionChart(distributionCanvas, data);
        }
        
        // Update file type chart
        const typeCanvas = document.getElementById('typeChart');
        if (typeCanvas && stats) {
            this.createFileTypeChart(typeCanvas, stats);
        }
        
        // Update size distribution chart
        const sizeCanvas = document.getElementById('sizeChart');
        if (sizeCanvas && stats) {
            this.createSizeDistributionChart(sizeCanvas, stats);
        }
        
        // Update treemap
        const treemapContainer = document.getElementById('treeMap');
        if (treemapContainer) {
            this.createTreeMap(treemapContainer, data);
        }
    }
    
    // Destroy all charts
    destroyAllCharts() {
        this.charts.forEach(chart => {
            chart.destroy();
        });
        this.charts.clear();
    }
    
    // Export chart as image
    exportChart(chartId, filename = 'chart.png') {
        const chart = this.charts.get(chartId);
        if (chart) {
            const url = chart.toBase64Image();
            const link = document.createElement('a');
            link.download = filename;
            link.href = url;
            link.click();
        }
    }
}
