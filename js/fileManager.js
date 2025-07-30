// File Management Operations for Drive Analyzer

class FileManager {
    constructor() {
        this.selectedItems = new Set();
        this.clipboard = [];
        this.operationQueue = [];
        this.isProcessing = false;
        
        // Event callbacks
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
        
        // Operation history for undo functionality
        this.operationHistory = [];
        this.maxHistorySize = 50;
    }
    
    // Select/deselect items
    selectItem(item) {
        this.selectedItems.add(item);
        this.updateSelectionUI();
    }
    
    deselectItem(item) {
        this.selectedItems.delete(item);
        this.updateSelectionUI();
    }
    
    selectAll(items) {
        items.forEach(item => this.selectedItems.add(item));
        this.updateSelectionUI();
    }
    
    deselectAll() {
        this.selectedItems.clear();
        this.updateSelectionUI();
    }
    
    toggleSelection(item) {
        if (this.selectedItems.has(item)) {
            this.deselectItem(item);
        } else {
            this.selectItem(item);
        }
    }
    
    getSelectedItems() {
        return Array.from(this.selectedItems);
    }
    
    getSelectedSize() {
        return Array.from(this.selectedItems)
            .reduce((total, item) => total + (item.size || 0), 0);
    }
    
    // Delete operations
    async deleteItem(item) {
        return this.deleteItems([item]);
    }
    
    async deleteItems(items) {
        if (!items || items.length === 0) {
            throw new Error('No items to delete');
        }
        
        // Validate items have handles
        const validItems = items.filter(item => item.handle);
        if (validItems.length === 0) {
            throw new Error('No valid items to delete (missing file handles)');
        }
        
        const operation = {
            type: 'delete',
            items: validItems,
            totalItems: validItems.length,
            processedItems: 0,
            errors: [],
            startTime: Date.now()
        };
        
        try {
            this.isProcessing = true;
            
            if (this.onProgress) {
                this.onProgress({
                    type: 'delete',
                    phase: 'starting',
                    processed: 0,
                    total: operation.totalItems,
                    message: `Preparing to delete ${operation.totalItems} items...`
                });
            }
            
            // Process deletions
            for (const item of validItems) {
                try {
                    await this.deleteItemRecursive(item);
                    operation.processedItems++;
                    
                    // Remove from selection
                    this.selectedItems.delete(item);
                    
                    if (this.onProgress) {
                        this.onProgress({
                            type: 'delete',
                            phase: 'processing',
                            processed: operation.processedItems,
                            total: operation.totalItems,
                            message: `Deleted: ${item.name}`,
                            currentItem: item.name
                        });
                    }
                    
                } catch (error) {
                    console.error(`Failed to delete ${item.name}:`, error);
                    operation.errors.push({
                        item: item,
                        error: error.message
                    });
                }
                
                // Small delay to prevent UI blocking
                await Utils.delay(10);
            }
            
            // Record operation in history
            this.addToHistory(operation);
            
            const result = {
                success: operation.processedItems,
                failed: operation.errors.length,
                errors: operation.errors,
                duration: Date.now() - operation.startTime
            };
            
            this.isProcessing = false;
            this.updateSelectionUI();
            
            if (this.onComplete) {
                this.onComplete(result);
            }
            
            return result;
            
        } catch (error) {
            this.isProcessing = false;
            
            if (this.onError) {
                this.onError(error);
            }
            throw error;
        }
    }
    
    // Recursive deletion for directories
    async deleteItemRecursive(item) {
        if (!item.handle) {
            throw new Error(`No handle available for ${item.name}`);
        }
        
        try {
            if (item.isDirectory) {
                // For directories, delete all contents first
                await this.deleteDirectoryContents(item.handle);
            }
            
            // Delete the item itself
            await item.handle.remove();
            
        } catch (error) {
            // Provide more specific error messages
            if (error.name === 'NotAllowedError') {
                throw new Error(`Permission denied: Cannot delete ${item.name}`);
            } else if (error.name === 'InvalidStateError') {
                throw new Error(`Invalid state: ${item.name} may be in use`);
            } else if (error.name === 'NotFoundError') {
                throw new Error(`Not found: ${item.name} may have been moved or deleted`);
            } else {
                throw new Error(`Failed to delete ${item.name}: ${error.message}`);
            }
        }
    }
    
    // Delete directory contents recursively
    async deleteDirectoryContents(directoryHandle) {
        try {
            const entries = [];
            
            // Collect all entries first
            for await (const [name, handle] of directoryHandle.entries()) {
                entries.push({ name, handle });
            }
            
            // Delete each entry
            for (const { name, handle } of entries) {
                try {
                    if (handle.kind === 'directory') {
                        await this.deleteDirectoryContents(handle);
                    }
                    await handle.remove();
                } catch (error) {
                    console.warn(`Failed to delete ${name} in directory:`, error);
                    // Continue with other items even if one fails
                }
            }
        } catch (error) {
            console.warn('Error deleting directory contents:', error);
        }
    }
    
    // Bulk operations
    async deleteSelected() {
        const selectedItems = this.getSelectedItems();
        if (selectedItems.length === 0) {
            throw new Error('No items selected for deletion');
        }
        
        return this.deleteItems(selectedItems);
    }
    
    // Move/rename operations (limited by File System Access API)
    async renameItem(item, newName) {
        // Note: Direct rename is not supported by File System Access API
        // This would require copying and deleting the original
        throw new Error('Rename operation not supported by browser security restrictions');
    }
    
    // Copy operations (limited by File System Access API)
    async copyItems(items, targetDirectory) {
        // Note: Copy operations are limited by File System Access API
        throw new Error('Copy operation not supported by browser security restrictions');
    }
    
    // Get file/folder properties
    async getItemProperties(item) {
        try {
            const properties = {
                name: item.name,
                path: item.path,
                size: item.size,
                type: item.type,
                isDirectory: item.isDirectory,
                lastModified: item.lastModified,
                permissions: item.permissions,
                metadata: item.metadata
            };
            
            if (item.isDirectory) {
                properties.childCount = item.childCount || 0;
                properties.depth = item.depth || 0;
            } else {
                properties.extension = item.metadata?.extension;
                properties.mimeType = item.mimeType;
                properties.sizeCategory = item.metadata?.sizeCategory;
            }
            
            return properties;
        } catch (error) {
            throw new Error(`Failed to get properties for ${item.name}: ${error.message}`);
        }
    }
    
    // Calculate folder size (for folders that weren't fully scanned)
    async calculateFolderSize(directoryHandle) {
        let totalSize = 0;
        let fileCount = 0;
        let folderCount = 0;
        
        try {
            for await (const [name, handle] of directoryHandle.entries()) {
                if (handle.kind === 'directory') {
                    folderCount++;
                    const subResult = await this.calculateFolderSize(handle);
                    totalSize += subResult.size;
                    fileCount += subResult.fileCount;
                    folderCount += subResult.folderCount;
                } else {
                    try {
                        const file = await handle.getFile();
                        totalSize += file.size;
                        fileCount++;
                    } catch (error) {
                        console.warn(`Could not access file ${name}:`, error);
                    }
                }
            }
        } catch (error) {
            console.warn('Error calculating folder size:', error);
        }
        
        return { size: totalSize, fileCount, folderCount };
    }
    
    // Filter operations
    filterItemsByType(items, type) {
        return items.filter(item => {
            if (type === 'all') return true;
            if (type === 'folders') return item.isDirectory;
            if (type === 'files') return !item.isDirectory;
            return item.type === type;
        });
    }
    
    filterItemsBySize(items, minSize, maxSize = Infinity) {
        return items.filter(item => {
            const size = item.size || 0;
            return size >= minSize && size <= maxSize;
        });
    }
    
    filterItemsByDate(items, startDate, endDate = new Date()) {
        return items.filter(item => {
            if (!item.lastModified) return false;
            const itemDate = new Date(item.lastModified);
            return itemDate >= startDate && itemDate <= endDate;
        });
    }
    
    filterItemsByName(items, searchTerm) {
        const term = searchTerm.toLowerCase();
        return items.filter(item => 
            item.name.toLowerCase().includes(term) || 
            item.path.toLowerCase().includes(term)
        );
    }
    
    // Advanced filtering
    getCleanupCandidates(items, options = {}) {
        const candidates = {
            tempFiles: [],
            largeFiles: [],
            oldFiles: [],
            duplicates: [],
            emptyFolders: []
        };
        
        const now = Date.now();
        const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
        const sixMonthsAgo = now - (180 * 24 * 60 * 60 * 1000);
        
        items.forEach(item => {
            // Temporary files
            if (item.metadata?.temp || Utils.isTempFile(item.name, item.path)) {
                candidates.tempFiles.push(item);
            }
            
            // Large files (configurable threshold, default 1GB)
            const largeThreshold = options.largeFileThreshold || (1024 * 1024 * 1024);
            if (!item.isDirectory && item.size > largeThreshold) {
                candidates.largeFiles.push(item);
            }
            
            // Old files (configurable age, default 1 year for files >100MB)
            const oldFileThreshold = options.oldFileThreshold || (100 * 1024 * 1024);
            const oldDateThreshold = options.oldDateThreshold || oneYearAgo;
            
            if (!item.isDirectory && 
                item.lastModified && 
                item.lastModified < oldDateThreshold && 
                item.size > oldFileThreshold) {
                candidates.oldFiles.push(item);
            }
            
            // Empty folders
            if (item.isDirectory && item.size === 0 && item.childCount === 0) {
                candidates.emptyFolders.push(item);
            }
        });
        
        // Sort by size (largest first) for better cleanup impact
        candidates.tempFiles.sort((a, b) => b.size - a.size);
        candidates.largeFiles.sort((a, b) => b.size - a.size);
        candidates.oldFiles.sort((a, b) => b.size - a.size);
        
        return candidates;
    }
    
    // Operation history management
    addToHistory(operation) {
        this.operationHistory.unshift(operation);
        
        // Keep history size manageable
        if (this.operationHistory.length > this.maxHistorySize) {
            this.operationHistory = this.operationHistory.slice(0, this.maxHistorySize);
        }
    }
    
    getOperationHistory() {
        return [...this.operationHistory];
    }
    
    clearHistory() {
        this.operationHistory = [];
    }
    
    // Security and validation
    validateItemForDeletion(item) {
        const warnings = [];
        
        // System file warnings
        if (item.metadata?.system) {
            warnings.push('This appears to be a system file or folder');
        }
        
        // Large size warnings
        if (item.size > 10 * 1024 * 1024 * 1024) { // >10GB
            warnings.push('This is a very large item (>10GB)');
        }
        
        // Important directory warnings
        const importantDirs = ['documents', 'desktop', 'downloads', 'pictures', 'videos', 'music'];
        if (item.isDirectory && 
            importantDirs.some(dir => item.name.toLowerCase().includes(dir))) {
            warnings.push('This appears to be an important user directory');
        }
        
        // Recently modified warnings
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        if (item.lastModified && item.lastModified > oneDayAgo) {
            warnings.push('This item was modified recently (within 24 hours)');
        }
        
        return {
            canDelete: true, // Browser security handles actual restrictions
            warnings: warnings,
            isHighRisk: warnings.length > 1
        };
    }
    
    // Batch validation
    validateItemsForDeletion(items) {
        const results = {
            safe: [],
            warnings: [],
            highRisk: [],
            totalSize: 0
        };
        
        items.forEach(item => {
            const validation = this.validateItemForDeletion(item);
            results.totalSize += item.size || 0;
            
            if (validation.isHighRisk) {
                results.highRisk.push({ item, validation });
            } else if (validation.warnings.length > 0) {
                results.warnings.push({ item, validation });
            } else {
                results.safe.push({ item, validation });
            }
        });
        
        return results;
    }
    
    // UI update helpers
    updateSelectionUI() {
        const selectedCount = this.selectedItems.size;
        const selectedSize = this.getSelectedSize();
        
        // Update selection count displays
        const countElements = document.querySelectorAll('.selection-count');
        countElements.forEach(el => {
            el.textContent = selectedCount.toString();
        });
        
        // Update selection size displays
        const sizeElements = document.querySelectorAll('.selection-size');
        sizeElements.forEach(el => {
            el.textContent = Utils.formatBytes(selectedSize);
        });
        
        // Update bulk action buttons
        const bulkButtons = document.querySelectorAll('.bulk-action-btn');
        bulkButtons.forEach(btn => {
            btn.disabled = selectedCount === 0;
        });
        
        // Update select all checkbox
        const selectAllCheckbox = document.getElementById('selectAllCheck');
        if (selectAllCheckbox) {
            const allItems = document.querySelectorAll('.item-checkbox');
            const checkedItems = document.querySelectorAll('.item-checkbox:checked');
            
            if (checkedItems.length === 0) {
                selectAllCheckbox.indeterminate = false;
                selectAllCheckbox.checked = false;
            } else if (checkedItems.length === allItems.length) {
                selectAllCheckbox.indeterminate = false;
                selectAllCheckbox.checked = true;
            } else {
                selectAllCheckbox.indeterminate = true;
                selectAllCheckbox.checked = false;
            }
        }
        
        // Dispatch custom event for other components
        window.dispatchEvent(new CustomEvent('selectionChanged', {
            detail: {
                count: selectedCount,
                size: selectedSize,
                items: this.getSelectedItems()
            }
        }));
    }
    
    // Export selected items info
    exportSelection(format = 'csv') {
        const items = this.getSelectedItems();
        if (items.length === 0) {
            throw new Error('No items selected for export');
        }
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        const filename = `selected-items-${timestamp}.${format}`;
        
        switch (format) {
            case 'csv':
                Utils.exportToCSV(items, filename);
                break;
            case 'json':
                Utils.exportToJSON(items, filename);
                break;
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    
    // Get operation statistics
    getOperationStats() {
        const stats = {
            totalOperations: this.operationHistory.length,
            deleteOperations: 0,
            totalItemsDeleted: 0,
            totalSizeDeleted: 0,
            errors: 0
        };
        
        this.operationHistory.forEach(op => {
            if (op.type === 'delete') {
                stats.deleteOperations++;
                stats.totalItemsDeleted += op.processedItems;
                stats.errors += op.errors.length;
                
                // Calculate size deleted (approximate)
                op.items.forEach(item => {
                    if (!op.errors.some(err => err.item === item)) {
                        stats.totalSizeDeleted += item.size || 0;
                    }
                });
            }
        });
        
        return stats;
    }
}
