// Enhanced Drive Scanner with File System Access API

class DriveScanner {
    constructor() {
        this.isScanning = false;
        this.scanCancelled = false;
        this.scanResults = null;
        this.scanProgress = {
            totalItems: 0,
            scannedItems: 0,
            totalSize: 0,
            fileCount: 0,
            folderCount: 0,
            startTime: 0,
            speed: 0
        };
        
        // Event callbacks
        this.onProgress = null;
        this.onComplete = null;
        this.onError = null;
        this.onCancel = null;
        
        // Scanning options
        this.options = {
            maxDepth: 50,
            followSymlinks: false,
            includeHidden: false,
            skipTempFiles: false,
            maxFiles: 1000000, // Safety limit
            updateInterval: 100 // Progress update frequency (ms)
        };
        
        this.lastProgressUpdate = 0;
    }
    
    // Main entry point for drive/folder scanning - FIXED PERMISSION ISSUE
    async selectAndScan(options = {}) {
        if (!Utils.supportsFileSystemAccess()) {
            throw new Error('File System Access API not supported. Please use Chrome 86+ or Edge 86+');
        }
        
        this.options = { ...this.options, ...options };
        
        try {
            // Start with READ-ONLY access for scanning - NO EXTRA DIALOG
            const directoryHandle = await window.showDirectoryPicker({
                mode: 'read', // Changed from 'readwrite' to 'read'
                startIn: 'desktop'
            });
            
            return await this.scanDirectory(directoryHandle);
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Folder selection cancelled');
            }
            throw error;
        }
    }
    
    // Scan a specific directory handle
    async scanDirectory(directoryHandle, rootPath = '') {
        this.resetScanProgress();
        this.isScanning = true;
        this.scanCancelled = false;
        
        try {
            Utils.performance.start('Directory Scan');
            
            // Phase 1: Quick count for progress tracking
            if (this.onProgress) {
                this.onProgress({ phase: 'counting', message: 'Counting items...' });
            }
            
            await this.countItems(directoryHandle, 0);
            
            // Phase 2: Detailed scanning
            if (this.onProgress) {
                this.onProgress({ 
                    phase: 'scanning', 
                    message: 'Scanning files...',
                    total: this.scanProgress.totalItems 
                });
            }
            
            const rootItem = await this.scanDirectoryRecursive(
                directoryHandle, 
                rootPath || directoryHandle.name, 
                directoryHandle.name,
                0
            );
            
            Utils.performance.end('Directory Scan');
            
            this.scanResults = {
                rootDirectory: rootItem,
                scanProgress: { ...this.scanProgress },
                scanTime: Date.now() - this.scanProgress.startTime,
                timestamp: new Date().toISOString(),
                options: { ...this.options }
            };
            
            this.isScanning = false;
            
            if (this.onComplete && !this.scanCancelled) {
                this.onComplete(this.scanResults);
            }
            
            return this.scanResults;
            
        } catch (error) {
            this.isScanning = false;
            
            if (this.scanCancelled) {
                if (this.onCancel) {
                    this.onCancel();
                }
                throw new Error('Scan cancelled by user');
            }
            
            if (this.onError) {
                this.onError(error);
            }
            throw error;
        }
    }
    
    // Count items for progress tracking
    async countItems(directoryHandle, depth) {
        if (this.scanCancelled || depth > this.options.maxDepth) return;
        
        try {
            for await (const [name, handle] of directoryHandle.entries()) {
                if (this.scanCancelled) return;
                
                // Skip hidden files if option is set
                if (!this.options.includeHidden && name.startsWith('.')) continue;
                
                // Skip temp files if option is set
                if (this.options.skipTempFiles && Utils.isTempFile(name)) continue;
                
                this.scanProgress.totalItems++;
                
                if (handle.kind === 'directory') {
                    this.scanProgress.folderCount++;
                    await this.countItems(handle, depth + 1);
                } else {
                    this.scanProgress.fileCount++;
                }
                
                // Safety check
                if (this.scanProgress.totalItems > this.options.maxFiles) {
                    throw new Error(`Too many files (>${this.options.maxFiles}). Please select a smaller directory.`);
                }
            }
        } catch (error) {
            console.warn(`Error counting items in directory: ${error.message}`);
        }
    }
    
    // Recursive directory scanning with detailed file information
    async scanDirectoryRecursive(directoryHandle, currentPath, name, depth) {
        if (this.scanCancelled || depth > this.options.maxDepth) {
            return null;
        }
        
        const directoryItem = {
            name: name,
            path: currentPath,
            isDirectory: true,
            size: 0,
            children: [],
            handle: directoryHandle,
            lastModified: null,
            permissions: await this.getPermissions(directoryHandle),
            depth: depth,
            childCount: 0,
            metadata: {
                hidden: name.startsWith('.'),
                system: this.isSystemDirectory(name, currentPath)
            }
        };
        
        try {
            const entries = [];
            
            // Collect all entries first
            for await (const [entryName, handle] of directoryHandle.entries()) {
                if (this.scanCancelled) return directoryItem;
                
                // Apply filters
                if (!this.options.includeHidden && entryName.startsWith('.')) continue;
                if (this.options.skipTempFiles && Utils.isTempFile(entryName, currentPath)) continue;
                
                entries.push({ name: entryName, handle });
            }
            
            // Process entries
            for (const { name: entryName, handle } of entries) {
                if (this.scanCancelled) return directoryItem;
                
                this.scanProgress.scannedItems++;
                this.updateProgress();
                
                const entryPath = `${currentPath}/${entryName}`;
                
                if (handle.kind === 'directory') {
                    const subDirectory = await this.scanDirectoryRecursive(
                        handle, 
                        entryPath, 
                        entryName, 
                        depth + 1
                    );
                    
                    if (subDirectory) {
                        directoryItem.children.push(subDirectory);
                        directoryItem.size += subDirectory.size;
                        directoryItem.childCount += 1 + subDirectory.childCount;
                    }
                } else {
                    try {
                        const fileInfo = await this.getFileInfo(handle, entryPath, entryName);
                        if (fileInfo) {
                            directoryItem.children.push(fileInfo);
                            directoryItem.size += fileInfo.size;
                            directoryItem.childCount++;
                            this.scanProgress.totalSize += fileInfo.size;
                        }
                    } catch (fileError) {
                        console.warn(`Could not access file ${entryName}:`, fileError);
                        // Add placeholder for inaccessible files
                        directoryItem.children.push({
                            name: entryName,
                            path: entryPath,
                            isDirectory: false,
                            size: 0,
                            lastModified: null,
                            type: 'unknown',
                            error: fileError.message || 'Access denied',
                            handle: null
                        });
                    }
                }
                
                // Yield control periodically
                if (this.scanProgress.scannedItems % 50 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 1));
                }
            }
            
            // Sort children by size (largest first)
            directoryItem.children.sort((a, b) => b.size - a.size);
            
        } catch (error) {
            console.warn(`Error scanning directory ${name}:`, error);
            directoryItem.error = error.message;
        }
        
        return directoryItem;
    }
    
    // Get detailed file information
    async getFileInfo(fileHandle, path, name) {
        try {
            const file = await fileHandle.getFile();
            const type = Utils.getFileType(name);
            
            return {
                name: name,
                path: path,
                isDirectory: false,
                size: file.size,
                lastModified: file.lastModified,
                type: type,
                mimeType: file.type,
                handle: fileHandle,
                permissions: await this.getPermissions(fileHandle),
                metadata: {
                    extension: name.split('.').pop().toLowerCase(),
                    hidden: name.startsWith('.'),
                    temp: Utils.isTempFile(name, path),
                    large: Utils.isLargeMediaFile(name, file.size),
                    sizeCategory: Utils.getSizeCategory(file.size)
                }
            };
        } catch (error) {
            throw error;
        }
    }
    
    // Get file/directory permissions
    async getPermissions(handle) {
        const permissions = {
            readable: false,
            writable: false
        };
        
        try {
            // Test read permission
            if (handle.kind === 'directory') {
                // Try to iterate (read permission)
                const iterator = handle.entries();
                await iterator.next();
                permissions.readable = true;
            } else {
                // Try to get file (read permission)
                await handle.getFile();
                permissions.readable = true;
            }
        } catch (e) {
            // Read permission denied
        }
        
        try {
            // Test write permission (don't request, just query)
            const testPermission = await handle.queryPermission({ mode: 'readwrite' });
            permissions.writable = testPermission === 'granted';
        } catch (e) {
            // Write permission check failed
        }
        
        return permissions;
    }
    
    // Check if directory is a system directory
    isSystemDirectory(name, path) {
        const systemDirs = [
            'system32', 'windows', 'program files', 'program files (x86)',
            'boot', 'recovery', 'system volume information',
            'bin', 'sbin', 'usr', 'lib', 'lib64', 'etc', 'proc', 'sys'
        ];
        
        return systemDirs.some(sysDir => 
            name.toLowerCase().includes(sysDir) || 
            path.toLowerCase().includes(sysDir)
        );
    }
    
    // Update progress and notify listeners
    updateProgress() {
        const now = Date.now();
        
        if (now - this.lastProgressUpdate >= this.options.updateInterval) {
            const elapsed = now - this.scanProgress.startTime;
            this.scanProgress.speed = elapsed > 0 ? 
                Math.round(this.scanProgress.scannedItems / (elapsed / 1000)) : 0;
            
            const progress = {
                ...this.scanProgress,
                percentage: this.scanProgress.totalItems > 0 ? 
                    Math.round((this.scanProgress.scannedItems / this.scanProgress.totalItems) * 100) : 0,
                phase: 'scanning'
            };
            
            if (this.onProgress) {
                this.onProgress(progress);
            }
            
            this.lastProgressUpdate = now;
        }
    }
    
    // Cancel ongoing scan
    cancelScan() {
        this.scanCancelled = true;
        this.isScanning = false;
    }
    
    // Reset scan progress
    resetScanProgress() {
        this.scanProgress = {
            totalItems: 0,
            scannedItems: 0,
            totalSize: 0,
            fileCount: 0,
            folderCount: 0,
            startTime: Date.now(),
            speed: 0
        };
        this.lastProgressUpdate = 0;
    }
    
    // Get flat list of all files for table view
    getFlatFileList(rootItem = null) {
        const root = rootItem || this.scanResults?.rootDirectory;
        if (!root) return [];
        
        const files = [];
        
        function traverse(item) {
            if (!item.isDirectory) {
                files.push(item);
            }
            
            if (item.children) {
                item.children.forEach(traverse);
            }
        }
        
        traverse(root);
        return files;
    }
    
    // Get directory statistics
    getDirectoryStats(rootItem = null) {
        const root = rootItem || this.scanResults?.rootDirectory;
        if (!root) return null;
        
        const stats = {
            totalFiles: 0,
            totalFolders: 0,
            totalSize: 0,
            largestFile: null,
            largestFolder: null,
            fileTypes: {},
            sizeDistribution: {
                tiny: 0, small: 0, medium: 0, large: 0, huge: 0
            },
            permissions: {
                readable: 0,
                writable: 0,
                restricted: 0
            }
        };
        
        function traverse(item) {
            if (item.isDirectory) {
                stats.totalFolders++;
                if (!stats.largestFolder || item.size > stats.largestFolder.size) {
                    stats.largestFolder = item;
                }
            } else {
                stats.totalFiles++;
                stats.totalSize += item.size;
                
                if (!stats.largestFile || item.size > stats.largestFile.size) {
                    stats.largestFile = item;
                }
                
                // File type statistics
                const type = item.type || 'unknown';
                stats.fileTypes[type] = (stats.fileTypes[type] || 0) + 1;
                
                // Size distribution
                const sizeCategory = Utils.getSizeCategory(item.size);
                stats.sizeDistribution[sizeCategory]++;
            }
            
            // Permission statistics
            if (item.permissions) {
                if (item.permissions.readable) stats.permissions.readable++;
                if (item.permissions.writable) stats.permissions.writable++;
                if (!item.permissions.readable && !item.permissions.writable) {
                    stats.permissions.restricted++;
                }
            }
            
            if (item.children) {
                item.children.forEach(traverse);
            }
        }
        
        traverse(root);
        return stats;
    }
    
    // Find duplicate files by size and name
    findDuplicates(rootItem = null) {
        const files = this.getFlatFileList(rootItem);
        const duplicates = {};
        const sizeGroups = {};
        
        // Group by size first (more efficient)
        files.forEach(file => {
            if (file.size > 0) {
                const size = file.size;
                if (!sizeGroups[size]) sizeGroups[size] = [];
                sizeGroups[size].push(file);
            }
        });
        
        // Find actual duplicates within size groups
        Object.values(sizeGroups).forEach(group => {
            if (group.length > 1) {
                const nameGroups = {};
                group.forEach(file => {
                    const name = file.name.toLowerCase();
                    if (!nameGroups[name]) nameGroups[name] = [];
                    nameGroups[name].push(file);
                });
                
                Object.entries(nameGroups).forEach(([name, files]) => {
                    if (files.length > 1) {
                        duplicates[`${files[0].size}_${name}`] = files;
                    }
                });
            }
        });
        
        return duplicates;
    }
    
    // Get cleanup suggestions
    getCleanupSuggestions(rootItem = null) {
        const files = this.getFlatFileList(rootItem);
        const suggestions = {
            tempFiles: [],
            largeFiles: [],
            oldFiles: [],
            duplicates: this.findDuplicates(rootItem),
            emptyFolders: []
        };
        
        const now = Date.now();
        const oneYearAgo = now - (365 * 24 * 60 * 60 * 1000);
        const sixMonthsAgo = now - (180 * 24 * 60 * 60 * 1000);
        
        files.forEach(file => {
            // Temp files
            if (file.metadata?.temp) {
                suggestions.tempFiles.push(file);
            }
            
            // Large files (>1GB)
            if (file.size > 1024 * 1024 * 1024) {
                suggestions.largeFiles.push(file);
            }
            
            // Old files (>1 year, >100MB)
            if (file.lastModified && 
                file.lastModified < oneYearAgo && 
                file.size > 100 * 1024 * 1024) {
                suggestions.oldFiles.push(file);
            }
        });
        
        // Sort by potential space savings
        suggestions.tempFiles.sort((a, b) => b.size - a.size);
        suggestions.largeFiles.sort((a, b) => b.size - a.size);
        suggestions.oldFiles.sort((a, b) => b.size - a.size);
        
        return suggestions;
    }
}
