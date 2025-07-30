// File system scanning functionality using File System Access API

class DiskScanner {
    constructor() {
        this.isScanning = false;
        this.scanResults = [];
        this.totalFiles = 0;
        this.scannedFiles = 0;
        this.startTime = 0;
        this.onProgressUpdate = null;
        this.onComplete = null;
        this.onError = null;
    }
    
    async selectAndScanDirectory() {
        // Check if File System Access API is supported
        if (!window.showDirectoryPicker) {
            throw new Error('File System Access API not supported. Please use Chrome 86+ or Edge 86+');
        }
        
        try {
            // Request directory access
            const directoryHandle = await window.showDirectoryPicker({
                mode: 'readwrite' // Request both read and write permissions for deletion
            });
            
            return await this.scanDirectory(directoryHandle);
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Directory selection cancelled');
            }
            throw error;
        }
    }
    
    async scanDirectory(directoryHandle, parentPath = '') {
        this.isScanning = true;
        this.scanResults = [];
        this.totalFiles = 0;
        this.scannedFiles = 0;
        this.startTime = Date.now();
        
        try {
            // First pass: count total files for progress tracking
            await this.countFiles(directoryHandle);
            
            // Second pass: scan and collect data
            const rootItem = await this.scanDirectoryRecursive(directoryHandle, parentPath, directoryHandle.name);
            
            this.isScanning = false;
            
            const result = {
                rootDirectory: rootItem,
                totalFiles: this.totalFiles,
                scanTime: Date.now() - this.startTime,
                timestamp: new Date().toISOString()
            };
            
            if (this.onComplete) {
                this.onComplete(result);
            }
            
            return result;
        } catch (error) {
            this.isScanning = false;
            if (this.onError) {
                this.onError(error);
            }
            throw error;
        }
    }
    
    async countFiles(directoryHandle) {
        for await (const [name, handle] of directoryHandle.entries()) {
            this.totalFiles++;
            if (handle.kind === 'directory') {
                await this.countFiles(handle);
            }
        }
    }
    
    async scanDirectoryRecursive(directoryHandle, parentPath, name) {
        const currentPath = parentPath ? `${parentPath}/${name}` : name;
        
        const directoryItem = {
            name: name,
            path: currentPath,
            isDirectory: true,
            size: 0,
            children: [],
            handle: directoryHandle,
            lastModified: null
        };
        
        try {
            for await (const [entryName, handle] of directoryHandle.entries()) {
                this.scannedFiles++;
                
                // Update progress
                if (this.onProgressUpdate) {
                    this.onProgressUpdate({
                        scanned: this.scannedFiles,
                        total: this.totalFiles,
                        percentage: Math.round((this.scannedFiles / this.totalFiles) * 100),
                        currentFile: entryName
                    });
                }
                
                if (handle.kind === 'directory') {
                    const subDirectory = await this.scanDirectoryRecursive(handle, currentPath, entryName);
                    directoryItem.children.push(subDirectory);
                    directoryItem.size += subDirectory.size;
                } else {
                    try {
                        const file = await handle.getFile();
                        const fileItem = {
                            name: entryName,
                            path: `${currentPath}/${entryName}`,
                            isDirectory: false,
                            size: file.size,
                            lastModified: file.lastModified,
                            type: file.type || this.getFileType(entryName),
                            handle: handle
                        };
                        
                        directoryItem.children.push(fileItem);
                        directoryItem.size += file.size;
                    } catch (fileError) {
                        console.warn(`Could not access file ${entryName}:`, fileError);
                        // Add placeholder for inaccessible files
                        directoryItem.children.push({
                            name: entryName,
                            path: `${currentPath}/${entryName}`,
                            isDirectory: false,
                            size: 0,
                            lastModified: null,
                            type: 'unknown',
                            error: 'Access denied',
                            handle: null
                        });
                    }
                }
                
                // Small delay to prevent blocking the UI
                if (this.scannedFiles % 100 === 0) {
                    await Utils.delay(1);
                }
            }
        } catch (error) {
            console.warn(`Error scanning directory ${name}:`, error);
        }
        
        // Sort children by size (largest first)
        directoryItem.children.sort((a, b) => b.size - a.size);
        
        return directoryItem;
    }
    
    getFileType(fileName) {
        const ext = fileName.split('.').pop().toLowerCase();
        const typeMap = {
            // Images
            'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image',
            'bmp': 'image', 'svg': 'image', 'webp': 'image',
            
            // Videos
            'mp4': 'video', 'avi': 'video', 'mov': 'video', 'mkv': 'video',
            'wmv': 'video', 'flv': 'video', 'webm': 'video',
            
            // Audio
            'mp3': 'audio', 'wav': 'audio', 'flac': 'audio', 'aac': 'audio',
            'ogg': 'audio', 'm4a': 'audio',
            
            // Documents
            'pdf': 'document', 'doc': 'document', 'docx': 'document',
            'xls': 'document', 'xlsx': 'document', 'ppt': 'document',
            'pptx': 'document', 'txt': 'document',
            
            // Code
            'js': 'code', 'html': 'code', 'css': 'code', 'php': 'code',
            'py': 'code', 'java': 'code', 'cpp': 'code', 'c': 'code',
            
            // Archives
            'zip': 'archive', 'rar': 'archive', '7z': 'archive',
            'tar': 'archive', 'gz': 'archive'
        };
        
        return typeMap[ext] || 'unknown';
    }
    
    async deleteItem(item) {
        if (!item.handle) {
            throw new Error('Cannot delete item: No file handle available');
        }
        
        try {
            if (item.isDirectory) {
                // For directories, we need to delete all contents first
                await this.deleteDirectoryContents(item.handle);
            }
            
            // Remove the item itself
            await item.handle.remove();
            return true;
        } catch (error) {
            console.error('Delete error:', error);
            throw new Error(`Failed to delete ${item.name}: ${error.message}`);
        }
    }
    
    async deleteDirectoryContents(directoryHandle) {
        for await (const [name, handle] of directoryHandle.entries()) {
            try {
                if (handle.kind === 'directory') {
                    await this.deleteDirectoryContents(handle);
                }
                await handle.remove();
            } catch (error) {
                console.warn(`Failed to delete ${name}:`, error);
                // Continue with other files even if one fails
            }
        }
    }
    
    stopScanning() {
        this.isScanning = false;
    }
    
    // Get flat list of all files for list view
    getFlatFileList(directoryItem) {
        const files = [];
        
        function traverse(item) {
            if (!item.isDirectory) {
                files.push(item);
            }
            
            if (item.children) {
                item.children.forEach(traverse);
            }
        }
        
        traverse(directoryItem);
        return files.sort((a, b) => b.size - a.size);
    }
    
    // Get aggregated data by file type
    getFileTypeStats(directoryItem) {
        const stats = {};
        
        function traverse(item) {
            if (!item.isDirectory) {
                const type = item.type || 'unknown';
                if (!stats[type]) {
                    stats[type] = { count: 0, size: 0 };
                }
                stats[type].count++;
                stats[type].size += item.size;
            }
            
            if (item.children) {
                item.children.forEach(traverse);
            }
        }
        
        traverse(directoryItem);
        return stats;
    }
}
