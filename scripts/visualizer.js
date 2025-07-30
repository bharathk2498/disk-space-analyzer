// Visualization components for charts and graphs

class DiskVisualizer {
    constructor() {
        this.chart = null;
        this.colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF',
            '#4BC0C0', '#FF6384', '#36A2EB', '#FFCE56'
        ];
    }
    
    createPieChart(container, data) {
        const ctx = container.getContext('2d');
        
        // Destroy existing chart
        if (this.chart) {
            this.chart.destroy();
        }
        
        // Prepare data for Chart.js
        const chartData = this.prepareChartData(data);
        
        this.chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.sizes,
                    backgroundColor: this.colors,
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
                        display: false // We'll create custom legend
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const label = context.label;
                                const value = Utils.formatBytes(context.raw);
                                const percentage = ((context.raw / chartData.total) * 100).toFixed(1);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateRotate: true,
                    duration: 1000
                },
                cutout: '40%'
            }
        });
        
        return chartData;
    }
    
    prepareChartData(directoryItem) {
        const data = [];
        const maxItems = 10; // Show top 10 items
        
        if (directoryItem.children) {
            // Get top items by size
            const sortedChildren = [...directoryItem.children]
                .sort((a, b) => b.size - a.size)
                .slice(0, maxItems);
            
            sortedChildren.forEach(child => {
                data.push({
                    name: child.name,
                    size: child.size,
                    isDirectory: child.isDirectory
                });
            });
            
            // If there are more items, group them as "Others"
            if (directoryItem.children.length > maxItems) {
                const othersSize = directoryItem.children
                    .slice(maxItems)
                    .reduce((sum, child) => sum + child.size, 0);
                
                if (othersSize > 0) {
                    data.push({
                        name: `Others (${directoryItem.children.length - maxItems} items)`,
                        size: othersSize,
                        isDirectory: false
                    });
                }
            }
        }
        
        return {
            labels: data.map(item => item.name),
            sizes: data.map(item => item.size),
            total: directoryItem.size,
            items: data
        };
    }
    
    createCustomLegend(container, chartData) {
        container.innerHTML = '';
        
        chartData.items.forEach((item, index) => {
            const legendItem = document.createElement('div');
            legendItem.className = 'legend-item';
            
            const color = this.colors[index % this.colors.length];
            const percentage = ((item.size / chartData.total) * 100).toFixed(1);
            
            legendItem.innerHTML = `
                <div class="legend-color" style="background-color: ${color}"></div>
                <span class="legend-label">${item.name}</span>
                <span class="legend-size">${Utils.formatBytes(item.size)} (${percentage}%)</span>
            `;
            
            container.appendChild(legendItem);
        });
    }
    
    createTreeMap(container, data, maxDepth = 2) {
        // Simple HTML/CSS treemap implementation
        container.innerHTML = '';
        container.className = 'treemap-container';
        
        const treemap = document.createElement('div');
        treemap.className = 'treemap';
        treemap.style.width = '100%';
        treemap.style.height = '400px';
        treemap.style.position = 'relative';
        treemap.style.border = '1px solid var(--border)';
        
        this.renderTreeMapLevel(treemap, data, 0, maxDepth, {
            x: 0, y: 0, width: 100, height: 100
        });
        
        container.appendChild(treemap);
    }
    
    renderTreeMapLevel(container, item, depth, maxDepth, rect) {
        if (depth >= maxDepth || !item.children || item.children.length === 0) {
            return;
        }
        
        // Sort children by size
        const sortedChildren = [...item.children].sort((a, b) => b.size - a.size);
        const totalSize = item.size;
        
        let currentY = rect.y;
        let remainingHeight = rect.height;
        
        sortedChildren.forEach((child, index) => {
            if (child.size === 0) return;
            
            const childHeight = (child.size / totalSize) * rect.height;
            
            const childRect = {
                x: rect.x,
                y: currentY,
                width: rect.width,
                height: childHeight
            };
            
            const childElement = document.createElement('div');
            childElement.className = 'treemap-item';
            childElement.style.position = 'absolute';
            childElement.style.left = `${childRect.x}%`;
            childElement.style.top = `${childRect.y}%`;
            childElement.style.width = `${childRect.width}%`;
            childElement.style.height = `${childRect.height}%`;
            childElement.style.border = '1px solid #fff';
            childElement.style.backgroundColor = this.colors[depth % this.colors.length];
            childElement.style.opacity = 0.7 - (depth * 0.1);
            childElement.style.display = 'flex';
            childElement.style.alignItems = 'center';
            childElement.style.justifyContent = 'center';
            childElement.style.fontSize = `${Math.max(10, 14 - depth * 2)}px`;
            childElement.style.color = '#333';
            childElement.style.fontWeight = 'bold';
            childElement.style.textAlign = 'center';
            childElement.style.overflow = 'hidden';
            childElement.style.cursor = 'pointer';
            
            if (childHeight > 5) { // Only show label if item is large enough
                childElement.innerHTML = `
                    <div>
                        <div>${child.name}</div>
                        <div style="font-size: 0.8em; font-weight: normal;">
                            ${Utils.formatBytes(child.size)}
                        </div>
                    </div>
                `;
            }
            
            childElement.title = `${child.name}\nSize: ${Utils.formatBytes(child.size)}\nType: ${child.isDirectory ? 'Folder' : 'File'}`;
            
            container.appendChild(childElement);
            
            // Recursively render children
            this.renderTreeMapLevel(container, child, depth + 1, maxDepth, {
                x: childRect.x + 2,
                y: childRect.y + 2,
                width: childRect.width - 4,
                height: childRect.height - 4
            });
            
            currentY += childHeight;
        });
    }
    
    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}
