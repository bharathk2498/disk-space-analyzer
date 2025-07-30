// Fallback for when Chart.js or D3.js fails to load

// Simple fallback chart
function createFallbackChart(container, data) {
    if (!data || !data.children) return;
    
    const items = data.children.slice(0, 8).sort((a, b) => b.size - a.size);
    const total = data.size;
    
    container.innerHTML = items.map((item, index) => {
        const percentage = ((item.size / total) * 100).toFixed(1);
        const color = `hsl(${index * 45}, 70%, 60%)`;
        
        return `
            <div style="display: flex; align-items: center; margin-bottom: 8px; padding: 8px; border-radius: 4px; background: ${color}20;">
                <div style="width: 12px; height: 12px; background: ${color}; border-radius: 50%; margin-right: 8px;"></div>
                <span style="flex: 1; font-size: 14px;">${item.name}</span>
                <span style="font-size: 12px; color: #666;">${Utils.formatBytes(item.size)} (${percentage}%)</span>
            </div>
        `;
    }).join('');
}

// Enhanced overview update with fallbacks
function updateOverviewViewFallback() {
    if (!window.app || !window.app.currentData) return;
    
    const data = window.app.currentData.rootDirectory;
    const stats = window.app.currentStats;
    
    // Try to create chart, fall back to simple display
    const distributionCanvas = document.getElementById('distributionChart');
    if (distributionCanvas) {
        try {
            if (window.Chart && window.app.visualizer) {
                window.app.visualizer.createDistributionChart(distributionCanvas, data);
            } else {
                createFallbackChart(distributionCanvas.parentElement, data);
            }
        } catch (error) {
            console.warn('Chart creation failed, using fallback:', error);
            createFallbackChart(distributionCanvas.parentElement, data);
        }
    }
    
    // Update other panels with fallbacks
    updateLargestItemsFallback(data);
    updateFileTypesFallback(stats);
    updateCleanupSuggestionsFallback();
}

function updateLargestItemsFallback(data) {
    const container = document.getElementById('largestItems');
    if (!container || !data.children) return;
    
    const items = data.children.slice(0, 10).sort((a, b) => b.size - a.size);
    
    container.innerHTML = items.map(item => `
        <div class="largest-item">
            <div class="item-info">
                <i class="${Utils.getFileIcon(item.name, item.isDirectory)}"></i>
                <span class="item-name" title="${item.path}">${item.name}</span>
            </div>
            <div class="item-size">${Utils.formatBytes(item.size)}</div>
            <div class="item-actions">
                ${item.handle ? `<button class="btn btn-sm btn-danger" onclick="app.deleteItem('${item.path}')">
                    <i class="fas fa-trash"></i>
                </button>` : ''}
            </div>
        </div>
    `).join('');
}

function updateFileTypesFallback(stats) {
    const container = document.getElementById('fileTypes');
    if (!container || !stats?.fileTypes) return;
    
    const fileTypes = stats.fileTypes;
    const total = Object.values(fileTypes).reduce((sum, count) => sum + count, 0);
    
    if (total === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No files found</p>';
        return;
    }
    
    container.innerHTML = Object.entries(fileTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 8)
        .map(([type, count]) => {
            const percentage = Utils.percentage(count, total);
            return `
                <div class="file-type-item">
                    <div class="file-type-info">
                        <i class="${Utils.getFileIcon('', false)} file-icon ${type}"></i>
                        <span class="type-name">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                    </div>
                    <div class="type-stats">
                        <span class="type-count">${Utils.formatNumber(count)}</span>
                        <span class="type-percentage">${percentage}%</span>
                    </div>
                </div>
            `;
        }).join('');
}

function updateCleanupSuggestionsFallback() {
    const container = document.getElementById('cleanupSuggestions');
    if (!container) return;
    
    // Provide basic cleanup suggestions
    container.innerHTML = `
        <div class="cleanup-suggestion">
            <div class="suggestion-icon">
                <i class="fas fa-broom"></i>
            </div>
            <div class="suggestion-info">
                <div class="suggestion-title">Scan Complete</div>
                <div class="suggestion-desc">Use other views to explore your files</div>
            </div>
        </div>
        
        <div class="cleanup-suggestion">
            <div class="suggestion-icon">
                <i class="fas fa-table"></i>
            </div>
            <div class="suggestion-info">
                <div class="suggestion-title">Table View</div>
                <div class="suggestion-desc">Sort and filter files by size, type, date</div>
            </div>
        </div>
        
        <div class="cleanup-suggestion">
            <div class="suggestion-icon">
                <i class="fas fa-sitemap"></i>
            </div>
            <div class="suggestion-info">
                <div class="suggestion-title">Tree View</div>
                <div class="suggestion-desc">Navigate folder hierarchy</div>
            </div>
        </div>
    `;
}

// Auto-fix overview when page loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.app && window.app.currentData) {
            updateOverviewViewFallback();
        }
    }, 1000);
});

// Auto-fix when scan completes
window.addEventListener('load', () => {
    if (window.app) {
        const originalHandleScanComplete = window.app.handleScanComplete;
        window.app.handleScanComplete = function(result) {
            originalHandleScanComplete.call(this, result);
            setTimeout(() => updateOverviewViewFallback(), 500);
        };
    }
});
