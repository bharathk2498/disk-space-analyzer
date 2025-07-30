// Main application controller

class DiskAnalyzerApp {
    constructor() {
        this.scanner = new DiskScanner();
        this.visualizer = new DiskVisualizer();
        this.currentData = null;
        this.currentView = 'tree';
        this.deleteQueue = [];
        
        this.initializeEventListeners();
        this.initializeScanner();
        this.checkBrowserSupport();
    }
    
    checkBrowserSupport() {
        if (!window.showDirectoryPicker) {
            this.showError('Your browser does not support the File System Access API. Please use Chrome 86+ or Edge 86+');
        }
    }
    
    initializeEventListeners() {
        // Main controls
        document.getElementById('selectFolder').addEventListener('click', () => this.selectFolder());
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshAnalysis());
        document.getElementById('exportBtn').addEventListener('click', () => this.showExportOptions());
        
        // View switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });
        
        // Theme switching
        document.getElementById('themeSelect').addEventListener('change', (e) => {
            this.switchTheme(e.target.value);
        });
        
        // Search and filtering
        document.getElementById('searchFilter').addEventListener('input', 
            Utils.debounce((e) => this.filterResults(e.target.value), 300));
        
        document.getElementById('sortBy').addEventListener('change', (e) => {
            this.sortResults(e.target.value);
        });
        
        // Delete modal
        document.getElementById('confirmDelete').addEventListener('click', () => this.executeDelete());
        document.getElementById('cancelDelete').addEventListener('click', () => this.hideDeleteModal());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }
    
    initializeScanner() {
        this.scanner.onProgressUpdate = (progress) => this.updateProgress(progress);
        this.scanner.onComplete = (result) => this.handleScanComplete(result);
        this.scanner.onError = (error) => this.handleScanError(error);
    }
    
    async selectFolder() {
        try {
            this.showLoading('Requesting folder access...');
            await this.scanner.selectAndScanDirectory();
        } catch (error) {
            this.hideLoading();
            this.handleScanError(error);
        }
    }
    
    async refreshAnalysis() {
        if (!this.currentData) {
            this.showError('No folder selected. Please select a folder first.');
            return;
        }
        
        try {
            this.showLoading('Refreshing analysis...');
            // Re-scan the current directory
            await this.scanner.scanDirectory(this.currentData.rootDirectory.handle);
        } catch (error) {
            this.hideLoading();
            this.handleScanError(error);
        }
    }
    
    handleScanComplete(result) {
        this.hideLoading();
        this.currentData = result;
        this.updateUI(result);
        this.showSuccess(`Analysis complete! Scanned ${result.totalFiles} items in ${(result.scanTime / 1000).toFixed(1)}s`);
    }
    
    handleScanError(error) {
        this.hideLoading();
        this.showError(error.message || 'An error occurred while scanning');
        console.error('Scan error:', error);
    }
    
    updateProgress(progress) {
        const statusEl = document.getElementById('loadingStatus');
        const progressEl = document.getElementById('progressFill');
        
        statusEl.textContent = `Scanning: ${progress.currentFile} (${progress.scanned}/${progress.total})`;
        progressEl.style.width = `${progress.percentage}%`;
    }
    
    updateUI(data) {
        this.updateStatusPanel(data);
        this.updateTreeView(data.rootDirectory);
        this.updateChartView(data.rootDirectory);
        this.updateListView(data.rootDirectory);
    }
    
    updateStatusPanel(data) {
        document.getElementById('currentPath').textContent = data.rootDirectory.name;
        document.getElementById('scanTime').textContent = `${(data.scanTime / 1000).toFixed(1)}s`;
        document.getElementById('fileCount').textContent = `${data.totalFiles.toLocaleString()} items`;
        document.getElementById('totalSize').textContent = Utils.formatBytes(data.rootDirectory.size);
    }
    
    updateTreeView(rootDirectory) {
        const container = document.getElementById('treeContent');
        container.innerHTML = '';
        
        this.renderTreeItem(container, rootDirectory, 0);
    }
    
    renderTreeItem(container, item, depth) {
        const treeItem = document.createElement('div');
        treeItem.className = 'tree-item';
        treeItem.style.paddingLeft = `${depth * 20 + 20}px`;
        
        if (item.isDirectory) {
            treeItem.classList.add('folder');
        }
        
        const icon = Utils.getFileIcon(item.name, item.isDirectory);
        const size = Utils.formatBytes(item.size);
        
        treeItem.innerHTML = `
            <i class="${icon}"></i>
            <span class="name">${item.name}</span>
            <span class="size">${size}</span>
            <div class="actions">
                <button class="action-btn delete-btn" data-path="${item.path}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        // Add click handler for folders
        if (item.isDirectory && item.children && item.children.length > 0) {
            treeItem.style.cursor = 'pointer';
            treeItem.addEventListener('click', (e) => {
                if (!e.target.closest('.actions')) {
                    this.toggleTreeItem(treeItem, item);
                }
            });
        }
        
        // Add delete handler
        const deleteBtn = treeItem.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showDeleteModal(item);
        });
        
        container.appendChild(treeItem);
    }
    
    toggleTreeItem(element, item) {
        const isExpanded = element.classList.contains('expanded');
        
        if (isExpanded) {
            // Collapse - remove children
            element.classList.remove('expanded');
            let nextElement = element.nextElementSibling;
            while (nextElement && nextElement.style.paddingLeft > element.style.paddingLeft) {
                const toRemove = nextElement;
                nextElement = nextElement.nextElementSibling;
                toRemove.remove();
            }
        } else {
            // Expand - add children
            element.classList.add('expanded');
            const currentDepth = parseInt(element.style.paddingLeft) / 20;
            
            if (item.children) {
                const fragment = document.createDocumentFragment();
                item.children.forEach(child => {
                    this.renderTreeItem(fragment, child, currentDepth + 1);
                });
                element.after(fragment);
            }
        }
    }
    
    updateChartView(rootDirectory) {
        const canvas = document.getElementById('diskChart');
        const legend = document.getElementById('chartLegend');
        
        const chartData = this.visualizer.createPieChart(canvas, rootDirectory);
        this.visualizer.createCustomLegend(legend, chartData);
    }
    
    updateListView(rootDirectory) {
        const tbody = document.getElementById('fileTableBody');
        const files = this.scanner.getFlatFileList(rootDirectory);
        
        tbody.innerHTML = '';
        
        files.slice(0, 1000).forEach(file => { // Limit to 1000 for performance
            const row = document.createElement('tr');
            
            const icon = Utils.getFileIcon(file.name, file.isDirectory);
            const formattedDate = file.lastModified ? 
                Utils.formatDate(new Date(file.lastModified)) : 'Unknown';
            
            row.innerHTML = `
                <td>
                    <i class="${icon}"></i>
                    ${file.name}
                </td>
                <td>${Utils.formatBytes(file.size)}</td>
                <td>${file.type || 'Unknown'}</td>
                <td>${formattedDate}</td>
                <td>
                    <button class="action-btn delete-btn" data-path="${file.path}">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            `;
            
            // Add delete handler
            row.querySelector('.delete-btn').addEventListener('click', () => {
                this.showDeleteModal(file);
            });
            
            tbody.appendChild(row);
        });
    }
    
    switchView(viewName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');
        
        // Update view panels
        document.querySelectorAll('.view-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${viewName}View`).classList.add('active');
        
        this.currentView = viewName;
    }
    
    switchTheme(themeName) {
        document.documentElement.setAttribute('data-theme', themeName);
        localStorage.setItem('preferred-theme', themeName);
    }
    
    filterResults(searchTerm) {
        if (!this.currentData) return;
        
        const treeItems = document.querySelectorAll('.tree-item');
        const tableRows = document.querySelectorAll('#fileTableBody tr');
        
        const term = searchTerm.toLowerCase();
        
        // Filter tree view
        treeItems.forEach(item => {
            const name = item.querySelector('.name').textContent.toLowerCase();
            item.style.display = name.includes(term) ? 'flex' : 'none';
        });
        
        // Filter table view
        tableRows.forEach(row => {
            const name = row.cells[0].textContent.toLowerCase();
            row.style.display = name.includes(term) ? 'table-row' : 'none';
        });
    }
    
    sortResults(sortBy) {
        if (!this.currentData) return;
        
        // This would require re-rendering with sorted data
        // For now, just update the list view
        this.updateListView(this.currentData.rootDirectory);
    }
    
    showDeleteModal(item) {
        const modal = document.getElementById('deleteModal');
        const message = document.getElementById('deleteMessage');
        
        message.textContent = `Are you sure you want to delete "${item.name}"? This action cannot be undone.`;
        modal.classList.add('active');
        
        // Store item for deletion
        this.deleteQueue = [item];
    }
    
    hideDeleteModal() {
        document.getElementById('deleteModal').classList.remove('active');
        this.deleteQueue = [];
    }
    
    async executeDelete() {
        if (this.deleteQueue.length === 0) return;
        
        const item = this.deleteQueue[0];
        
        try {
            this.showLoading(`Deleting ${item.name}...`);
            await this.scanner.deleteItem(item);
            this.hideLoading();
            this.hideDeleteModal();
            this.showSuccess(`Successfully deleted ${item.name}`);
            
            // Refresh the analysis
            await this.refreshAnalysis();
        } catch (error) {
            this.hideLoading();
            this.showError(`Failed to delete ${item.name}: ${error.message}`);
        }
    }
    
    showExportOptions() {
        if (!this.currentData) {
            this.showError('No data to export. Please analyze a folder first.');
            return;
        }
        
        const options = [
            { text: 'Export as JSON', action: () => this.exportJSON() },
            { text: 'Export as CSV', action: () => this.exportCSV() }
        ];
        
        // Simple export menu (you could make this fancier)
        const choice = prompt('Export options:\n1. JSON\n2. CSV\n\nEnter 1 or 2:');
        
        if (choice === '1') {
            this.exportJSON();
        } else if (choice === '2') {
            this.exportCSV();
        }
    }
    
    exportJSON() {
        const exportData = {
            ...this.currentData,
            exportDate: new Date().toISOString()
        };
        
        Utils.exportToJSON(exportData, `disk-analysis-${Date.now()}.json`);
        this.showSuccess('Data exported as JSON');
    }
    
    exportCSV() {
        const files = this.scanner.getFlatFileList(this.currentData.rootDirectory);
        Utils.exportToCSV(files, `disk-analysis-${Date.now()}.csv`);
        this.showSuccess('Data exported as CSV');
    }
    
    handleKeyboardShortcuts(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key) {
                case 'o':
                    event.preventDefault();
                    this.selectFolder();
                    break;
                case 'r':
                    event.preventDefault();
                    this.refreshAnalysis();
                    break;
                case 'e':
                    event.preventDefault();
                    this.showExportOptions();
                    break;
            }
        }
    }
    
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const status = document.getElementById('loadingStatus');
        
        status.textContent = message;
        overlay.classList.add('active');
    }
    
    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    showNotification(message, type = 'info') {
        // Simple notification system
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 2rem;
            background: ${type === 'error' ? 'var(--danger)' : 'var(--success)'};
            color: white;
            border-radius: var(--radius);
            z-index: 10000;
            animation: fadeIn 0.3s ease;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DiskAnalyzerApp();
    
    // Load saved theme
    const savedTheme = localStorage.getItem('preferred-theme');
    if (savedTheme) {
        document.getElementById('themeSelect').value = savedTheme;
        document.documentElement.setAttribute('data-theme', savedTheme);
    }
});
