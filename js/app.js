// Main Application Controller for Drive Analyzer

class DriveAnalyzerApp {
    constructor() {
        // Core components
        this.scanner = new DriveScanner();
        this.visualizer = new DriveVisualizer();
        this.fileManager = new FileManager();
        
        // Application state
        this.currentData = null;
        this.currentStats = null;
        this.currentView = 'overview';
        this.isInitialized = false;
        
        // UI state
        this.currentPage = 1;
        this.itemsPerPage = 100;
        this.currentSort = { field: 'size', direction: 'desc' };
        this.currentFilter = 'all';
        this.searchTerm = '';
        
        // Delete operations state
        this.pendingDeleteItem = null;
        this.pendingDeleteItems = null;
        
        // Settings
        this.settings = {
            theme: 'light',
            autoRefresh: false,
            showHidden: false,
            confirmDelete: true,
            maxScanDepth: 50,
            animationsEnabled: true
        };
        
        this.initialize();
    }
    
    // Initialize the application
    async initialize() {
        try {
            this.loadSettings();
            this.setupEventListeners();
            this.setupComponentCallbacks();
            this.checkBrowserSupport();
            this.setupKeyboardShortcuts();
            this.initializeTooltips();
            this.loadTheme();
            
            this.isInitialized = true;
            console.log('Drive Analyzer App initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showNotification('Failed to initialize application', 'error');
        }
    }
    
    // Check browser compatibility
    checkBrowserSupport() {
        const requirements = {
            fileSystemAccess: 'showDirectoryPicker' in window,
            webWorkers: 'Worker' in window,
            indexedDB: 'indexedDB' in window,
            canvas: 'getContext' in document.createElement('canvas')
        };
        
        const unsupported = Object.entries(requirements)
            .filter(([feature, supported]) => !supported)
            .map(([feature]) => feature);
        
        if (unsupported.length > 0) {
            const message = `Unsupported features: ${unsupported.join(', ')}. Please use Chrome 86+ or Edge 86+`;
            this.showNotification(message, 'error');
            console.warn('Browser support check failed:', unsupported);
        }
        
        return unsupported.length === 0;
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Main action buttons
        document.getElementById('scanDrive')?.addEventListener('click', () => this.startScan());
        document.getElementById('scanMultiple')?.addEventListener('click', () => this.startMultipleScan());
        document.getElementById('refreshScan')?.addEventListener('click', () => this.refreshScan());
        document.getElementById('exportData')?.addEventListener('click', () => this.showExportModal());
        document.getElementById('bulkDelete')?.addEventListener('click', () => this.showBulkDeleteConfirmation());
        
        // View switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });
        
        // Search and filters
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.addEventListener('input', 
                Utils.debounce((e) => this.handleSearch(e.target.value), 300));
        }
        
        const filterSelect = document.getElementById('filterType');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => this.handleFilter(e.target.value));
        }
        
        // Theme switching
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => this.switchTheme(e.target.value));
        }
        
        // Table sorting
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', () => this.handleTableSort(header.dataset.sort));
        });
        
        // Pagination
        document.getElementById('prevPage')?.addEventListener('click', () => this.previousPage());
        document.getElementById('nextPage')?.addEventListener('click', () => this.nextPage());
        
        // Selection
        document.getElementById('selectAll')?.addEventListener('click', () => this.selectAllVisible());
        document.getElementById('selectNone')?.addEventListener('click', () => this.fileManager.deselectAll());
        document.getElementById('selectAllCheck')?.addEventListener('change', (e) => {
            if (e.target.checked) this.selectAllVisible();
            else this.fileManager.deselectAll();
        });
        
        // Modal controls
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => this.closeModal(e.target.closest('.modal')));
        });
        
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
            backdrop.addEventListener('click', (e) => this.closeModal(e.target.closest('.modal')));
        });
        
        // Delete confirmation
        document.getElementById('confirmDelete')?.addEventListener('click', () => this.executeDelete());
        document.getElementById('cancelDelete')?.addEventListener('click', () => this.closeDeleteModal());
        
        // Export modal
        document.getElementById('startExport')?.addEventListener('click', () => this.executeExport());
        
        // Loading overlay
        document.getElementById('cancelScan')?.addEventListener('click', () => this.cancelScan());
        
        // Window events
        window.addEventListener('beforeunload', () => this.saveSettings());
        window.addEventListener('resize', Utils.debounce(() => this.handleResize(), 250));
    }
    
    // Setup component callbacks
    setupComponentCallbacks() {
        // Scanner callbacks
        this.scanner.onProgress = (progress) => this.updateScanProgress(progress);
        this.scanner.onComplete = (result) => this.handleScanComplete(result);
        this.scanner.onError = (error) => this.handleScanError(error);
        this.scanner.onCancel = () => this.handleScanCancelled();
        
        // File manager callbacks
        this.fileManager.onProgress = (progress) => this.updateDeleteProgress(progress);
        this.fileManager.onComplete = (result) => this.handleDeleteComplete(result);
        this.fileManager.onError = (error) => this.handleDeleteError(error);
        
        // Custom events
        window.addEventListener('selectionChanged', (e) => this.handleSelectionChanged(e.detail));
    }
    
    // Start scanning process
    async startScan() {
        try {
            this.showLoading('Requesting folder access...');
            await this.scanner.selectAndScan({
                includeHidden: this.settings.showHidden,
                maxDepth: this.settings.maxScanDepth
            });
        } catch (error) {
            this.hideLoading();
            this.handleScanError(error);
        }
    }
    
    // Start multiple location scan
    async startMultipleScan() {
        this.showNotification('Multiple location scanning coming soon!', 'info');
    }
    
    // Refresh current scan
    async refreshScan() {
        if (!this.currentData?.rootDirectory?.handle) {
            this.showNotification('No data to refresh. Please scan a folder first.', 'warning');
            return;
        }
        
        try {
            this.showLoading('Refreshing scan...');
            await this.scanner.scanDirectory(this.currentData.rootDirectory.handle);
        } catch (error) {
            this.hideLoading();
            this.handleScanError(error);
        }
    }
    
    // Cancel ongoing scan
    cancelScan() {
        this.scanner.cancelScan();
        this.hideLoading();
    }
    
    // Handle scan completion
    handleScanComplete(result) {
        this.hideLoading();
        this.currentData = result;
        this.currentStats = this.scanner.getDirectoryStats();
        
        this.updateUI();
        this.showNotification(
            `Scan complete! Found ${Utils.formatNumber(result.scanProgress.totalItems)} items (${Utils.formatBytes(result.rootDirectory.size)})`,
            'success'
        );
        
        // Auto-switch to overview if not already there
        if (this.currentView === 'overview') {
            this.updateOverviewView();
        }
    }
    
    // Handle scan error
    handleScanError(error) {
        this.hideLoading();
        console.error('Scan error:', error);
        
        let message = 'Scan failed';
        if (error.message.includes('cancelled')) {
            message = 'Scan cancelled';
        } else if (error.message.includes('Permission')) {
            message = 'Permission denied. Please grant access to the folder.';
        } else if (error.message.includes('Too many files')) {
            message = 'Directory too large. Please select a smaller folder.';
        } else {
            message = `Scan failed: ${error.message}`;
        }
        
        this.showNotification(message, 'error');
    }
    
    // Handle scan cancelled
    handleScanCancelled() {
        this.hideLoading();
        this.showNotification('Scan cancelled', 'info');
    }
    
    // Update scan progress
    updateScanProgress(progress) {
        const loadingTitle = document.getElementById('loadingTitle');
        const loadingStatus = document.getElementById('loadingStatus');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const speedText = document.getElementById('speedText');
        const scanFileCount = document.getElementById('scanFileCount');
        const scanFolderCount = document.getElementById('scanFolderCount');
        const scanSize = document.getElementById('scanSize');
        
        if (progress.phase === 'counting') {
            loadingTitle.textContent = 'Counting Items...';
            loadingStatus.textContent = progress.message || 'Preparing scan...';
            progressFill.style.width = '25%';
            progressText.textContent = 'Counting...';
        } else {
            loadingTitle.textContent = 'Scanning Drive...';
            loadingStatus.textContent = progress.message || `Processing: ${progress.currentItem || ''}`;
            progressFill.style.width = `${progress.percentage || 0}%`;
            progressText.textContent = `${progress.percentage || 0}%`;
            speedText.textContent = `${Utils.formatNumber(progress.speed || 0)} items/sec`;
            
            scanFileCount.textContent = Utils.formatNumber(progress.fileCount || 0);
            scanFolderCount.textContent = Utils.formatNumber(progress.folderCount || 0);
            scanSize.textContent = Utils.formatBytes(progress.totalSize || 0);
        }
    }
    
    // Update delete progress
    updateDeleteProgress(progress) {
        const loadingTitle = document.getElementById('loadingTitle');
        const loadingStatus = document.getElementById('loadingStatus');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        loadingTitle.textContent = 'Deleting Items...';
        loadingStatus.textContent = progress.message || 'Processing deletion...';
        
        if (progress.total > 0) {
            const percentage = Math.round((progress.processed / progress.total) * 100);
            progressFill.style.width = `${percentage}%`;
            progressText.textContent = `${percentage}% (${progress.processed}/${progress.total})`;
        }
    }
    
    // Handle delete completion
    handleDeleteComplete(result) {
        this.hideLoading();
        
        if (result.success > 0) {
            this.showNotification(`Successfully deleted ${result.success} items`, 'success');
        }
        if (result.failed > 0) {
            this.showNotification(`Failed to delete ${result.failed} items`, 'warning');
            console.warn('Delete errors:', result.errors);
        }
    }
    
    // Handle delete error
    handleDeleteError(error) {
        this.hideLoading();
        console.error('Delete error:', error);
        this.showNotification(`Delete failed: ${error.message}`, 'error');
    }
    
    // Update main UI after scan
    updateUI() {
        if (!this.currentData) return;
        
        this.updateStatusBar();
        this.updateCurrentView();
        this.updateNavigationState();
    }
    
    // Update status bar
    updateStatusBar() {
        if (!this.currentData) return;
        
        const data = this.currentData;
        const stats = this.currentStats;
        
        document.getElementById('currentPath').textContent = data.rootDirectory.path || data.rootDirectory.name;
        document.getElementById('totalItems').textContent = Utils.formatNumber(data.scanProgress.totalItems);
        document.getElementById('totalSize').textContent = Utils.formatBytes(data.rootDirectory.size);
        document.getElementById('scanTime').textContent = `${(data.scanTime / 1000).toFixed(1)}s`;
        
        // Count deletable items (items with handles)
        const flatFiles = this.scanner.getFlatFileList();
        const deletableCount = flatFiles.filter(item => item.handle).length;
        document.getElementById('deletableItems').textContent = Utils.formatNumber(deletableCount);
    }
    
    // Switch views
    switchView(viewName) {
        if (!viewName || this.currentView === viewName) return;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewName}"]`)?.classList.add('active');
        
        // Update view panels
        document.querySelectorAll('.view-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${viewName}View`)?.classList.add('active');
        
        this.currentView = viewName;
        this.updateCurrentView();
        
        // Save view preference
        this.settings.defaultView = viewName;
        this.saveSettings();
    }
    
    // Update current view content
    updateCurrentView() {
        if (!this.currentData) return;
        
        switch (this.currentView) {
            case 'overview':
                this.updateOverviewView();
                break;
            case 'tree':
                this.updateTreeView();
                break;
            case 'table':
                this.updateTableView();
                break;
            case 'visual':
                this.updateVisualView();
                break;
            case 'analysis':
                this.updateAnalysisView();
                break;
        }
    }
    
    // Update overview view
    updateOverviewView() {
        if (!this.currentData || !this.currentStats) return;
        
        // Update distribution chart
        const distributionCanvas = document.getElementById('distributionChart');
        if (distributionCanvas) {
            this.visualizer.createDistributionChart(distributionCanvas, this.currentData.rootDirectory);
        }
        
        // Update largest items
        this.updateLargestItems();
        
        // Update file types summary
        this.updateFileTypesSummary();
        
        // Update cleanup suggestions
        this.updateCleanupSuggestions();
    }
    
    // Update largest items display
    updateLargestItems() {
        const container = document.getElementById('largestItems');
        if (!container || !this.currentData) return;
        
        const items = this.currentData.rootDirectory.children
            .slice(0, 10)
            .sort((a, b) => b.size - a.size);
        
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
    
    // Update file types summary
    updateFileTypesSummary() {
        const container = document.getElementById('fileTypes');
        if (!container || !this.currentStats) return;
        
        const fileTypes = this.currentStats.fileTypes;
        const total = Object.values(fileTypes).reduce((sum, count) => sum + count, 0);
        
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
    
    // Update cleanup suggestions
    updateCleanupSuggestions() {
        const container = document.getElementById('cleanupSuggestions');
        if (!container) return;
        
        const suggestions = this.scanner.getCleanupSuggestions();
        
        const totalTempSize = suggestions.tempFiles.reduce((sum, file) => sum + file.size, 0);
        const totalLargeSize = suggestions.largeFiles.slice(0, 5).reduce((sum, file) => sum + file.size, 0);
        const totalOldSize = suggestions.oldFiles.slice(0, 5).reduce((sum, file) => sum + file.size, 0);
        
        container.innerHTML = `
            <div class="cleanup-suggestion">
                <div class="suggestion-icon">
                    <i class="fas fa-broom"></i>
                </div>
                <div class="suggestion-info">
                    <div class="suggestion-title">Temporary Files</div>
                    <div class="suggestion-desc">${suggestions.tempFiles.length} files, ${Utils.formatBytes(totalTempSize)}</div>
                </div>
                <button class="btn btn-sm btn-primary" onclick="app.cleanupTempFiles()">Clean</button>
            </div>
            
            <div class="cleanup-suggestion">
                <div class="suggestion-icon">
                    <i class="fas fa-weight-hanging"></i>
                </div>
                <div class="suggestion-info">
                    <div class="suggestion-title">Large Files</div>
                    <div class="suggestion-desc">${suggestions.largeFiles.length} files >1GB</div>
                </div>
                <button class="btn btn-sm btn-secondary" onclick="app.showLargeFiles()">Review</button>
            </div>
            
            <div class="cleanup-suggestion">
                <div class="suggestion-icon">
                    <i class="fas fa-clock"></i>
                </div>
                <div class="suggestion-info">
                    <div class="suggestion-title">Old Files</div>
                    <div class="suggestion-desc">${suggestions.oldFiles.length} files >1 year old</div>
                </div>
                <button class="btn btn-sm btn-secondary" onclick="app.showOldFiles()">Review</button>
            </div>
            
            <div class="cleanup-suggestion">
                <div class="suggestion-icon">
                    <i class="fas fa-copy"></i>
                </div>
                <div class="suggestion-info">
                    <div class="suggestion-title">Duplicates</div>
                    <div class="suggestion-desc">${Object.keys(suggestions.duplicates).length} duplicate groups</div>
                </div>
                <button class="btn btn-sm btn-secondary" onclick="app.showDuplicates()">Review</button>
            </div>
        `;
    }
    
    // Update tree view
    updateTreeView() {
        if (!this.currentData) return;
        
        const container = document.getElementById('treeContainer');
        container.innerHTML = '';
        
        this.renderTreeLevel(container, this.currentData.rootDirectory, 0);
    }
    
    // Render tree level recursively
    renderTreeLevel(container, item, level) {
        const treeItem = document.createElement('div');
        treeItem.className = 'tree-item';
        treeItem.style.paddingLeft = `${level * 20 + 12}px`;
        treeItem.dataset.path = item.path;
        
        const hasChildren = item.isDirectory && item.children && item.children.length > 0;
        const icon = hasChildren ? 'fas fa-chevron-right' : Utils.getFileIcon(item.name, item.isDirectory);
        
        treeItem.innerHTML = `
            <div class="tree-item-content">
                <i class="tree-toggle ${hasChildren ? icon : 'tree-file'}" ${hasChildren ? 'data-toggle="true"' : ''}></i>
                <div class="selection-checkbox">
                    <input type="checkbox" class="item-checkbox" data-item='${JSON.stringify({path: item.path, name: item.name})}'>
                    <span class="checkmark"></span>
                </div>
                <i class="file-icon ${Utils.getFileIcon(item.name, item.isDirectory)}"></i>
                <span class="item-name" title="${item.path}">${item.name}</span>
                <span class="item-size">${Utils.formatBytes(item.size)}</span>
                <div class="item-actions">
                    ${item.handle ? `<button class="btn-icon btn-danger" onclick="app.showDeleteConfirmation('${item.path}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>` : ''}
                </div>
            </div>
        `;
        
        // Add click handlers
        if (hasChildren) {
            const toggle = treeItem.querySelector('.tree-toggle');
            toggle.addEventListener('click', () => this.toggleTreeItem(treeItem, item));
        }
        
        // Add selection handler
        const checkbox = treeItem.querySelector('.item-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.fileManager.selectItem(item);
            } else {
                this.fileManager.deselectItem(item);
            }
        });
        
        container.appendChild(treeItem);
        
        // Add children container
        if (hasChildren) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children';
            childrenContainer.style.display = 'none';
            container.appendChild(childrenContainer);
        }
    }
    
    // Toggle tree item expansion
    toggleTreeItem(element, item) {
        const toggle = element.querySelector('.tree-toggle');
        const childrenContainer = element.nextElementSibling;
        
        if (childrenContainer.style.display === 'none') {
            // Expand
            toggle.classList.remove('fa-chevron-right');
            toggle.classList.add('fa-chevron-down');
            childrenContainer.style.display = 'block';
            
            // Render children if not already rendered
            if (childrenContainer.children.length === 0 && item.children) {
                const currentLevel = (element.style.paddingLeft.match(/\d+/) || ['0'])[0] / 20;
                item.children.forEach(child => {
                    this.renderTreeLevel(childrenContainer, child, currentLevel + 1);
                });
            }
        } else {
            // Collapse
            toggle.classList.remove('fa-chevron-down');
            toggle.classList.add('fa-chevron-right');
            childrenContainer.style.display = 'none';
        }
    }
    
    // Update table view
    updateTableView() {
        if (!this.currentData) return;
        
        const files = this.scanner.getFlatFileList();
        const filteredFiles = this.applyFiltersAndSearch(files);
        const sortedFiles = this.applySorting(filteredFiles);
        const paginatedFiles = this.applyPagination(sortedFiles);
        
        this.renderTable(paginatedFiles);
        this.updatePaginationInfo(filteredFiles.length);
    }
    
    // Apply filters and search
    applyFiltersAndSearch(files) {
        let filtered = files;
        
        // Apply type filter
        if (this.currentFilter !== 'all') {
            switch (this.currentFilter) {
                case 'large':
                    filtered = filtered.filter(f => f.size > 100 * 1024 * 1024);
                    break;
                case 'huge':
                    filtered = filtered.filter(f => f.size > 1024 * 1024 * 1024);
                    break;
                case 'temp':
                    filtered = filtered.filter(f => Utils.isTempFile(f.name, f.path));
                    break;
                default:
                    filtered = filtered.filter(f => f.type === this.currentFilter);
            }
        }
        
        // Apply search
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            filtered = filtered.filter(f => 
                f.name.toLowerCase().includes(term) || 
                f.path.toLowerCase().includes(term)
            );
        }
        
        return filtered;
    }
    
    // Apply sorting
    applySorting(files) {
        const { field, direction } = this.currentSort;
        
        return files.sort((a, b) => {
            let aVal = a[field];
            let bVal = b[field];
            
            // Handle different data types
            if (typeof aVal === 'string') aVal = aVal.toLowerCase();
            if (typeof bVal === 'string') bVal = bVal.toLowerCase();
            
            let comparison = 0;
            if (aVal < bVal) comparison = -1;
            else if (aVal > bVal) comparison = 1;
            
            return direction === 'asc' ? comparison : -comparison;
        });
    }
    
    // Apply pagination
    applyPagination(files) {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        return files.slice(start, end);
    }
    
    // Render table
    renderTable(files) {
        const tbody = document.getElementById('filesTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = files.map(file => `
            <tr data-path="${file.path}">
                <td>
                    <div class="selection-checkbox">
                        <input type="checkbox" class="item-checkbox" data-item='${JSON.stringify({path: file.path, name: file.name})}'>
                        <span class="checkmark"></span>
                    </div>
                </td>
                <td>
                    <div class="file-info">
                        <i class="${Utils.getFileIcon(file.name, file.isDirectory)}"></i>
                        <span class="file-name" title="${file.path}">${file.name}</span>
                    </div>
                </td>
                <td>
                    <span class="size-indicator ${Utils.getSizeCategory(file.size)}">
                        ${Utils.formatBytes(file.size)}
                    </span>
                </td>
                <td>
                    <span class="file-type ${file.type}">${(file.type || 'unknown').charAt(0).toUpperCase() + (file.type || 'unknown').slice(1)}</span>
                </td>
                <td>${Utils.formatDate(file.lastModified)}</td>
                <td><span class="file-path" title="${file.path}">${file.path}</span></td>
                <td>
                    <div class="table-actions">
                        ${file.handle ? `
                            <button class="btn btn-sm btn-danger" onclick="app.showDeleteConfirmation('${file.path}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-sm btn-secondary" onclick="app.showItemProperties('${file.path}')" title="Properties">
                            <i class="fas fa-info-circle"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
        
        // Add selection handlers
        tbody.querySelectorAll('.item-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const itemData = JSON.parse(e.target.dataset.item);
                const item = this.findItemByPath(itemData.path);
                
                if (item) {
                    if (e.target.checked) {
                        this.fileManager.selectItem(item);
                    } else {
                        this.fileManager.deselectItem(item);
                    }
                }
            });
        });
    }
    
    // Update visual view
    updateVisualView() {
        if (!this.currentData || !this.currentStats) return;
        
        this.visualizer.updateCharts(this.currentData.rootDirectory, this.currentStats);
    }
    
    // Update analysis view
    updateAnalysisView() {
        if (!this.currentData) return;
        
        const suggestions = this.scanner.getCleanupSuggestions();
        const duplicates = suggestions.duplicates;
        
        // Update cleanup analysis
        this.updateCleanupAnalysis(suggestions);
        
        // Update duplicate analysis
        this.updateDuplicateAnalysis(duplicates);
        
        // Update trend analysis
        this.updateTrendAnalysis();
        
        // Update security analysis
        this.updateSecurityAnalysis();
    }
    
    // ENHANCED DELETE CONFIRMATION WITH SMART PERMISSION HANDLING
    async showDeleteConfirmation(itemOrPath) {
        const item = typeof itemOrPath === 'string' ? this.findItemByPath(itemOrPath) : itemOrPath;
        if (!item) return;
        
        const modal = document.getElementById('deleteModal');
        const message = document.getElementById('deleteMessage');
        const preview = document.getElementById('deletePreview');
        
        // Check if we have write permissions
        let hasWritePermission = false;
        if (item.handle) {
            try {
                const permission = await item.handle.queryPermission({ mode: 'readwrite' });
                hasWritePermission = permission === 'granted';
            } catch (error) {
                console.warn('Permission check failed:', error);
            }
        }
        
        message.textContent = `Are you sure you want to permanently delete "${item.name}"?`;
        
        let warningContent = '';
        
        // Add permission warning if needed
        if (!hasWritePermission && item.handle) {
            warningContent += `
                <div class="permission-notice" style="background: #e0f2fe; border: 1px solid #0891b2; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
                    <h4 style="color: #0891b2; margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-key"></i> Permission Required
                    </h4>
                    <p style="margin: 0; color: #0c4a6e; font-size: 14px;">Additional permission will be requested to delete this item securely.</p>
                </div>
            `;
        }
        
        // Add validation warnings
        const validation = this.fileManager.validateItemForDeletion(item);
        if (validation.warnings.length > 0) {
            warningContent += `
                <div class="delete-warnings" style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px;">
                    <h4 style="color: #92400e; margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-exclamation-triangle"></i> Warnings:
                    </h4>
                    ${validation.warnings.map(warning => `<p style="margin: 4px 0; color: #92400e; font-size: 14px;">• ${warning}</p>`).join('')}
                </div>
            `;
        }
        
        preview.innerHTML = warningContent;
        modal.classList.add('active');
        this.pendingDeleteItem = item;
    }
    
    // BULK DELETE CONFIRMATION
    async showBulkDeleteConfirmation() {
        const selectedItems = this.fileManager.getSelectedItems();
        if (selectedItems.length === 0) {
            this.showNotification('No items selected for deletion', 'warning');
            return;
        }
        
        const modal = document.getElementById('deleteModal');
        const message = document.getElementById('deleteMessage');
        const preview = document.getElementById('deletePreview');
        
        const totalSize = this.fileManager.getSelectedSize();
        message.textContent = `Are you sure you want to permanently delete ${selectedItems.length} selected items (${Utils.formatBytes(totalSize)})?`;
        
        // Check permissions for selected items
        const itemsNeedingPermission = [];
        for (const item of selectedItems) {
            if (item.handle) {
                try {
                    const permission = await item.handle.queryPermission({ mode: 'readwrite' });
                    if (permission !== 'granted') {
                        itemsNeedingPermission.push(item);
                    }
                } catch (error) {
                    itemsNeedingPermission.push(item);
                }
            }
        }
        
        let warningContent = '';
        
        if (itemsNeedingPermission.length > 0) {
            warningContent += `
                <div class="permission-notice" style="background: #e0f2fe; border: 1px solid #0891b2; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
                    <h4 style="color: #0891b2; margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-key"></i> Permissions Required
                    </h4>
                    <p style="margin: 0; color: #0c4a6e; font-size: 14px;">Additional permissions will be requested for ${itemsNeedingPermission.length} items that require write access.</p>
                </div>
            `;
        }
        
        // Validate all items
        const validation = this.fileManager.validateItemsForDeletion(selectedItems);
        if (validation.warnings.length > 0 || validation.highRisk.length > 0) {
            warningContent += `
                <div class="delete-warnings" style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 6px; padding: 12px;">
                    <h4 style="color: #92400e; margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-exclamation-triangle"></i> Bulk Delete Warnings:
                    </h4>
                    <p style="margin: 4px 0; color: #92400e; font-size: 14px;">• ${validation.safe.length} items safe to delete</p>
                    ${validation.warnings.length > 0 ? `<p style="margin: 4px 0; color: #92400e; font-size: 14px;">• ${validation.warnings.length} items with warnings</p>` : ''}
                    ${validation.highRisk.length > 0 ? `<p style="margin: 4px 0; color: #92400e; font-size: 14px;">• ${validation.highRisk.length} high-risk items</p>` : ''}
                </div>
            `;
        }
        
        preview.innerHTML = warningContent;
        modal.classList.add('active');
        this.pendingDeleteItems = selectedItems;
    }
    
    // ENHANCED EXECUTE DELETE
    async executeDelete() {
        try {
            this.closeDeleteModal();
            
            if (this.pendingDeleteItem) {
                this.showLoading('Deleting item...');
                await this.fileManager.deleteItem(this.pendingDeleteItem);
                this.showNotification(`Successfully deleted ${this.pendingDeleteItem.name}`, 'success');
                this.pendingDeleteItem = null;
            } else if (this.pendingDeleteItems) {
                this.showLoading('Deleting selected items...');
                const result = await this.fileManager.deleteItems(this.pendingDeleteItems);
                
                if (result.success > 0) {
                    this.showNotification(`Successfully deleted ${result.success} items`, 'success');
                }
                if (result.failed > 0) {
                    this.showNotification(`Failed to delete ${result.failed} items`, 'warning');
                }
                this.pendingDeleteItems = null;
            }
            
            this.hideLoading();
            
            // Refresh the scan
            await this.refreshScan();
            
        } catch (error) {
            this.hideLoading();
            this.handleDeleteError(error);
            this.pendingDeleteItem = null;
            this.pendingDeleteItems = null;
        }
    }
    
    // Handle search input
    handleSearch(searchTerm) {
        this.searchTerm = searchTerm;
        this.currentPage = 1; // Reset to first page
        this.updateCurrentView();
    }
    
    // Handle filter change
    handleFilter(filterType) {
        this.currentFilter = filterType;
        this.currentPage = 1; // Reset to first page
        this.updateCurrentView();
    }
    
    // Handle table sorting
    handleTableSort(field) {
        if (this.currentSort.field === field) {
            this.currentSort.direction = this.currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.currentSort.field = field;
            this.currentSort.direction = 'desc'; // Default to descending
        }
        this.updateCurrentView();
    }
    
    // Pagination methods
    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updateCurrentView();
        }
    }
    
    nextPage() {
        this.currentPage++;
        this.updateCurrentView();
    }
    
    // Select all visible items
    selectAllVisible() {
        if (this.currentView === 'table') {
            const files = this.scanner.getFlatFileList();
            const filteredFiles = this.applyFiltersAndSearch(files);
            const paginatedFiles = this.applyPagination(filteredFiles);
            paginatedFiles.forEach(file => this.fileManager.selectItem(file));
        } else if (this.currentView === 'tree') {
            // Select visible tree items
            const visibleItems = document.querySelectorAll('.tree-item:not([style*="display: none"])');
            visibleItems.forEach(element => {
                const path = element.dataset.path;
                const item = this.findItemByPath(path);
                if (item) this.fileManager.selectItem(item);
            });
        }
    }
    
    // Update pagination info
    updatePaginationInfo(totalItems) {
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const start = (this.currentPage - 1) * this.itemsPerPage + 1;
        const end = Math.min(this.currentPage * this.itemsPerPage, totalItems);
        
        const tableInfo = document.getElementById('tableInfo');
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (tableInfo) {
            tableInfo.textContent = `${Utils.formatNumber(totalItems)} items`;
        }
        
        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        }
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
        }
    }
    
    // Update navigation state
    updateNavigationState() {
        // Enable/disable buttons based on current state
        const hasData = !!this.currentData;
        
        document.getElementById('refreshScan')?.toggleAttribute('disabled', !hasData);
        document.getElementById('exportData')?.toggleAttribute('disabled', !hasData);
    }
    
    // Settings management
    loadSettings() {
        const saved = Utils.storage.get('driveAnalyzerSettings', {});
        this.settings = { ...this.settings, ...saved };
    }
    
    saveSettings() {
        Utils.storage.set('driveAnalyzerSettings', this.settings);
    }
    
    // Theme management
    switchTheme(theme) {
        this.settings.theme = theme;
        this.loadTheme();
        this.visualizer.setColorScheme(theme === 'dark' ? 'dark' : 'default');
        this.saveSettings();
    }
    
    loadTheme() {
        document.documentElement.setAttribute('data-theme', this.settings.theme);
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) {
            themeSelect.value = this.settings.theme;
        }
    }
    
    // Export functionality
    showExportModal() {
        if (!this.currentData) {
            this.showNotification('No data to export. Please scan a folder first.', 'warning');
            return;
        }
        
        const modal = document.getElementById('exportModal');
        modal.classList.add('active');
    }
    
    executeExport() {
        const format = document.querySelector('input[name="exportFormat"]:checked')?.value || 'csv';
        const files = this.scanner.getFlatFileList();
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `drive-analysis-${timestamp}.${format}`;
        
        try {
            switch (format) {
                case 'csv':
                    Utils.exportToCSV(files, filename);
                    break;
                case 'json':
                    Utils.exportToJSON(this.currentData, filename.replace('.csv', '.json'));
                    break;
                case 'excel':
                    Utils.exportToExcel(files, filename.replace('.csv', '.xlsx'));
                    break;
                default:
                    throw new Error(`Unsupported format: ${format}`);
            }
            
            this.showNotification(`Data exported as ${filename}`, 'success');
            this.closeModal(document.getElementById('exportModal'));
            
        } catch (error) {
            this.showNotification(`Export failed: ${error.message}`, 'error');
        }
    }
    
    // Cleanup methods for overview suggestions
    cleanupTempFiles() {
        const suggestions = this.scanner.getCleanupSuggestions();
        if (suggestions.tempFiles.length > 0) {
            // Select temp files and show bulk delete
            suggestions.tempFiles.forEach(file => this.fileManager.selectItem(file));
            this.showBulkDeleteConfirmation();
        } else {
            this.showNotification('No temporary files found', 'info');
        }
    }
    
    showLargeFiles() {
        this.currentFilter = 'huge';
        this.switchView('table');
        this.showNotification('Showing files larger than 1GB', 'info');
    }
    
    showOldFiles() {
        // Switch to table view and apply old files filter
        this.switchView('table');
        this.showNotification('Showing files older than 1 year', 'info');
    }
    
    showDuplicates() {
        this.switchView('analysis');
        this.showNotification('Showing duplicate file analysis', 'info');
    }
    
    showItemProperties(path) {
        const item = this.findItemByPath(path);
        if (item) {
            // Show properties modal or panel
            this.showNotification(`Properties for: ${item.name}`, 'info');
        }
    }
    
    // Global methods for onclick handlers
    deleteItem(path) {
        const item = this.findItemByPath(path);
        if (item) {
            this.showDeleteConfirmation(item);
        }
    }
    
    // Utility methods
    findItemByPath(path) {
        if (!this.currentData) return null;
        
        const allItems = [this.currentData.rootDirectory, ...this.scanner.getFlatFileList()];
        return allItems.find(item => item.path === path);
    }
    
    // Selection changed handler
    handleSelectionChanged(detail) {
        // Update UI elements based on selection
        const bulkDeleteBtn = document.getElementById('bulkDelete');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.disabled = detail.count === 0;
            bulkDeleteBtn.textContent = detail.count > 0 ? 
                `Delete Selected (${detail.count})` : 'Bulk Delete';
        }
    }
    
    // Update analysis view components
    updateCleanupAnalysis(suggestions) {
        const container = document.getElementById('cleanupAnalysis');
        if (!container) return;
        
        const totalSavings = suggestions.tempFiles.reduce((sum, f) => sum + f.size, 0) +
                           suggestions.oldFiles.reduce((sum, f) => sum + f.size, 0);
        
        container.innerHTML = `
            <div class="analysis-summary">
                <h4>Potential Space Savings: ${Utils.formatBytes(totalSavings)}</h4>
                <div class="cleanup-categories">
                    <div class="cleanup-category">
                        <span class="category-name">Temporary Files</span>
                        <span class="category-count">${suggestions.tempFiles.length} files</span>
                        <span class="category-size">${Utils.formatBytes(suggestions.tempFiles.reduce((sum, f) => sum + f.size, 0))}</span>
                    </div>
                    <div class="cleanup-category">
                        <span class="category-name">Old Files</span>
                        <span class="category-count">${suggestions.oldFiles.length} files</span>
                        <span class="category-size">${Utils.formatBytes(suggestions.oldFiles.reduce((sum, f) => sum + f.size, 0))}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    updateDuplicateAnalysis(duplicates) {
        const container = document.getElementById('duplicateAnalysis');
        if (!container) return;
        
        const duplicateGroups = Object.entries(duplicates);
        const totalDuplicateSize = duplicateGroups.reduce((sum, [, files]) => 
            sum + (files.length - 1) * files[0].size, 0);
        
        container.innerHTML = `
            <div class="duplicate-summary">
                <h4>Duplicate Groups: ${duplicateGroups.length}</h4>
                <p>Potential savings: ${Utils.formatBytes(totalDuplicateSize)}</p>
                <div class="duplicate-groups">
                    ${duplicateGroups.slice(0, 5).map(([key, files]) => `
                        <div class="duplicate-group">
                            <span class="duplicate-name">${files[0].name}</span>
                            <span class="duplicate-count">${files.length} copies</span>
                            <span class="duplicate-size">${Utils.formatBytes(files[0].size)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    updateTrendAnalysis() {
        const container = document.getElementById('trendAnalysis');
        if (!container) return;
        
        container.innerHTML = `
            <div class="trend-summary">
                <h4>File Activity Trends</h4>
                <p>Analysis of file modification patterns and growth trends would appear here.</p>
            </div>
        `;
    }
    
    updateSecurityAnalysis() {
        const container = document.getElementById('securityAnalysis');
        if (!container) return;
        
        container.innerHTML = `
            <div class="security-summary">
                <h4>Security Assessment</h4>
                <p>Security risk analysis and recommendations would appear here.</p>
            </div>
        `;
    }
    
    // Notification system
    showNotification(message, type = 'info', duration = 5000) {
        const container = this.getOrCreateToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const toastId = Utils.generateId();
        toast.innerHTML = `
            <div class="toast-header">
                <span class="toast-title">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                <button class="toast-close" onclick="app.closeToast('${toastId}')">&times;</button>
            </div>
            <div class="toast-body">${message}</div>
        `;
        
        toast.id = toastId;
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Auto-remove
        setTimeout(() => this.closeToast(toastId), duration);
    }
    
    getOrCreateToastContainer() {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        return container;
    }
    
    closeToast(toastId) {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }
    }
    
    // Loading overlay
    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const title = document.getElementById('loadingTitle');
        const status = document.getElementById('loadingStatus');
        
        title.textContent = message;
        status.textContent = 'Please wait...';
        overlay.classList.add('active');
    }
    
    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('active');
    }
    
    // Modal management
    closeModal(modal) {
        modal.classList.remove('active');
    }
    
    closeDeleteModal() {
        this.closeModal(document.getElementById('deleteModal'));
        this.pendingDeleteItem = null;
        this.pendingDeleteItems = null;
    }
    
    // Keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when not typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'o':
                        e.preventDefault();
                        this.startScan();
                        break;
                    case 'r':
                        e.preventDefault();
                        this.refreshScan();
                        break;
                    case 'e':
                        e.preventDefault();
                        this.showExportModal();
                        break;
                    case 'a':
                        e.preventDefault();
                        this.selectAllVisible();
                        break;
                    case 'f':
                        e.preventDefault();
                        document.getElementById('globalSearch')?.focus();
                        break;
                }
            }
            
            // Delete key
            if (e.key === 'Delete' && this.fileManager.getSelectedItems().length > 0) {
                e.preventDefault();
                this.showBulkDeleteConfirmation();
            }
            
            // Escape key
            if (e.key === 'Escape') {
                this.fileManager.deselectAll();
                document.querySelectorAll('.modal.active').forEach(modal => {
                    this.closeModal(modal);
                });
            }
        });
    }
    
    // Initialize tooltips
    initializeTooltips() {
        // Simple tooltip implementation
        document.addEventListener('mouseover', (e) => {
            if (e.target.hasAttribute('title') && !e.target.querySelector('.tooltip-content')) {
                const title = e.target.getAttribute('title');
                if (title) {
                    e.target.setAttribute('data-original-title', title);
                    e.target.removeAttribute('title');
                    
                    const tooltip = document.createElement('div');
                    tooltip.className = 'tooltip-content';
                    tooltip.textContent = title;
                    e.target.appendChild(tooltip);
                }
            }
        });
        
        document.addEventListener('mouseout', (e) => {
            const tooltip = e.target.querySelector('.tooltip-content');
            if (tooltip) {
                const originalTitle = e.target.getAttribute('data-original-title');
                if (originalTitle) {
                    e.target.setAttribute('title', originalTitle);
                    e.target.removeAttribute('data-original-title');
                }
                tooltip.remove();
            }
        });
    }
    
    // Handle window resize
    handleResize() {
        // Update charts
        if (this.currentView === 'visual' && this.currentData) {
            this.updateVisualView();
        }
        
        // Update treemap
        const treemapContainer = document.getElementById('treeMap');
        if (treemapContainer && this.currentData) {
            this.visualizer.createTreeMap(treemapContainer, this.currentData.rootDirectory);
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DriveAnalyzerApp();
});

// Export for global access
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DriveAnalyzerApp;
}
