// Utility functions for the Drive Analyzer

class Utils {
    // File size formatting with precise calculations
    static formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 B';
        if (bytes < 0) return '- ' + this.formatBytes(-bytes, decimals);
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const size = parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
        
        return size + ' ' + sizes[i];
    }
    
    // Get file size category for styling
    static getSizeCategory(bytes) {
        if (bytes < 1024) return 'tiny';           // < 1KB
        if (bytes < 1024 * 1024) return 'small';  // < 1MB
        if (bytes < 100 * 1024 * 1024) return 'medium'; // < 100MB
        if (bytes < 1024 * 1024 * 1024) return 'large';  // < 1GB
        return 'huge'; // > 1GB
    }
    
    // Format date with relative time
    static formatDate(date, includeRelative = true) {
        if (!date) return 'Unknown';
        
        const dateObj = date instanceof Date ? date : new Date(date);
        const now = new Date();
        const diffMs = now - dateObj;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        const formatted = new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(dateObj);
        
        if (!includeRelative) return formatted;
        
        let relative = '';
        if (diffDays === 0) relative = 'Today';
        else if (diffDays === 1) relative = 'Yesterday';
        else if (diffDays < 7) relative = `${diffDays} days ago`;
        else if (diffDays < 30) relative = `${Math.floor(diffDays / 7)} weeks ago`;
        else if (diffDays < 365) relative = `${Math.floor(diffDays / 30)} months ago`;
        else relative = `${Math.floor(diffDays / 365)} years ago`;
        
        return `${formatted} (${relative})`;
    }
    
    // Get file type from extension
    static getFileType(fileName) {
        if (!fileName || typeof fileName !== 'string') return 'unknown';
        
        const ext = fileName.split('.').pop().toLowerCase();
        const typeMap = {
            // Images
            'jpg': 'image', 'jpeg': 'image', 'png': 'image', 'gif': 'image',
            'bmp': 'image', 'svg': 'image', 'webp': 'image', 'ico': 'image',
            'tiff': 'image', 'tif': 'image', 'raw': 'image', 'cr2': 'image',
            
            // Videos
            'mp4': 'video', 'avi': 'video', 'mov': 'video', 'mkv': 'video',
            'wmv': 'video', 'flv': 'video', 'webm': 'video', 'm4v': 'video',
            'mpg': 'video', 'mpeg': 'video', '3gp': 'video', 'ogv': 'video',
            
            // Audio
            'mp3': 'audio', 'wav': 'audio', 'flac': 'audio', 'aac': 'audio',
            'ogg': 'audio', 'm4a': 'audio', 'wma': 'audio', 'opus': 'audio',
            
            // Documents
            'pdf': 'document', 'doc': 'document', 'docx': 'document',
            'xls': 'document', 'xlsx': 'document', 'ppt': 'document',
            'pptx': 'document', 'txt': 'document', 'rtf': 'document',
            'odt': 'document', 'ods': 'document', 'odp': 'document',
            
            // Code
            'js': 'code', 'html': 'code', 'css': 'code', 'php': 'code',
            'py': 'code', 'java': 'code', 'cpp': 'code', 'c': 'code',
            'cs': 'code', 'rb': 'code', 'go': 'code', 'rs': 'code',
            'ts': 'code', 'jsx': 'code', 'vue': 'code', 'scss': 'code',
            'json': 'code', 'xml': 'code', 'yaml': 'code', 'yml': 'code',
            
            // Archives
            'zip': 'archive', 'rar': 'archive', '7z': 'archive',
            'tar': 'archive', 'gz': 'archive', 'bz2': 'archive',
            'xz': 'archive', 'tar.gz': 'archive', 'tar.bz2': 'archive',
            
            // Executables
            'exe': 'executable', 'msi': 'executable', 'app': 'executable',
            'deb': 'executable', 'rpm': 'executable', 'dmg': 'executable',
            'pkg': 'executable', 'run': 'executable',
            
            // System files
            'dll': 'system', 'sys': 'system', 'ini': 'system',
            'cfg': 'system', 'conf': 'system', 'log': 'system'
        };
        
        return typeMap[ext] || 'unknown';
    }
    
    // Get icon for file type
    static getFileIcon(fileName, isDirectory = false) {
        if (isDirectory) return 'fas fa-folder';
        
        const type = this.getFileType(fileName);
        const iconMap = {
            'image': 'fas fa-image',
            'video': 'fas fa-video',
            'audio': 'fas fa-music',
            'document': 'fas fa-file-alt',
            'code': 'fas fa-code',
            'archive': 'fas fa-file-archive',
            'executable': 'fas fa-cogs',
            'system': 'fas fa-cog',
            'unknown': 'fas fa-file'
        };
        
        return iconMap[type] || 'fas fa-file';
    }
    
    // Check if file is potentially temporary/cache
    static isTempFile(fileName, path = '') {
        const tempPatterns = [
            /^temp/i, /^tmp/i, /\.tmp$/i, /\.temp$/i,
            /\.cache$/i, /^cache/i, /\.log$/i,
            /\.bak$/i, /\.backup$/i, /~$/,
            /thumbs\.db$/i, /\.ds_store$/i
        ];
        
        const tempPaths = [
            'temp', 'tmp', 'cache', 'logs', 'backup',
            'recycle', 'trash', 'windows/temp',
            'users/*/appdata/local/temp'
        ];
        
        const lowerPath = path.toLowerCase();
        return tempPatterns.some(pattern => pattern.test(fileName)) ||
               tempPaths.some(temp => lowerPath.includes(temp));
    }
    
    // Check if file is potentially large media file
    static isLargeMediaFile(fileName, size) {
        const mediaTypes = ['video', 'audio', 'image'];
        const type = this.getFileType(fileName);
        return mediaTypes.includes(type) && size > 100 * 1024 * 1024; // > 100MB
    }
    
    // Generate unique ID
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    // Debounce function calls
    static debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }
    
    // Throttle function calls
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // Deep clone object
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const cloned = {};
            Object.keys(obj).forEach(key => {
                cloned[key] = this.deepClone(obj[key]);
            });
            return cloned;
        }
    }
    
    // Export data to various formats
    static exportToCSV(data, filename = 'export.csv') {
        const headers = ['Name', 'Size (Bytes)', 'Size', 'Type', 'Path', 'Modified'];
        const csvContent = [
            headers.join(','),
            ...data.map(item => [
                `"${(item.name || '').replace(/"/g, '""')}"`,
                item.size || 0,
                `"${this.formatBytes(item.size || 0)}"`,
                `"${item.type || 'unknown'}"`,
                `"${(item.path || '').replace(/"/g, '""')}"`,
                `"${item.lastModified ? new Date(item.lastModified).toISOString() : 'Unknown'}"`
            ].join(','))
        ].join('\n');
        
        this.downloadBlob(new Blob([csvContent], { type: 'text/csv' }), filename);
    }
    
    static exportToJSON(data, filename = 'export.json') {
        const jsonContent = JSON.stringify(data, null, 2);
        this.downloadBlob(new Blob([jsonContent], { type: 'application/json' }), filename);
    }
    
    static exportToExcel(data, filename = 'export.xlsx') {
        // Simplified Excel export - in real implementation, use a library like SheetJS
        const csvContent = this.generateCSVContent(data);
        this.downloadBlob(new Blob([csvContent], { type: 'application/vnd.ms-excel' }), filename);
    }
    
    // Download blob as file
    static downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
    
    // Format number with commas
    static formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }
    
    // Calculate percentage
    static percentage(value, total) {
        if (total === 0) return 0;
        return Math.round((value / total) * 100 * 100) / 100; // Round to 2 decimal places
    }
    
    // Sort array by multiple criteria
    static multiSort(array, criteria) {
        return array.sort((a, b) => {
            for (const { key, direction = 'asc' } of criteria) {
                let aVal = this.getNestedValue(a, key);
                let bVal = this.getNestedValue(b, key);
                
                // Handle different data types
                if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                if (typeof bVal === 'string') bVal = bVal.toLowerCase();
                
                const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                
                if (comparison !== 0) {
                    return direction === 'asc' ? comparison : -comparison;
                }
            }
            return 0;
        });
    }
    
    // Get nested object value by key path
    static getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    
    // Check if File System Access API is supported
    static supportsFileSystemAccess() {
        return 'showDirectoryPicker' in window;
    }
    
    // Get OS detection
    static getOS() {
        const userAgent = navigator.userAgent;
        if (userAgent.includes('Windows')) return 'windows';
        if (userAgent.includes('Mac')) return 'mac';
        if (userAgent.includes('Linux')) return 'linux';
        return 'unknown';
    }
    
    // Performance measurement
    static performance = {
        start: (label) => {
            console.time(label);
        },
        
        end: (label) => {
            console.timeEnd(label);
        },
        
        measure: async (label, fn) => {
            const start = performance.now();
            const result = await fn();
            const end = performance.now();
            console.log(`${label}: ${(end - start).toFixed(2)}ms`);
            return result;
        }
    };
    
    // Local storage helpers
    static storage = {
        set: (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.warn('Failed to save to localStorage:', e);
                return false;
            }
        },
        
        get: (key, defaultValue = null) => {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                console.warn('Failed to read from localStorage:', e);
                return defaultValue;
            }
        },
        
        remove: (key) => {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (e) {
                console.warn('Failed to remove from localStorage:', e);
                return false;
            }
        }
    };
}

// Global error handler with user-friendly messages
window.addEventListener('error', (event) => {
    console.error('Application Error:', event.error);
    
    const userFriendlyMessages = {
        'NotAllowedError': 'Permission denied. Please grant access to continue.',
        'AbortError': 'Operation was cancelled.',
        'NotFoundError': 'File or folder not found.',
        'SecurityError': 'Security restriction. This action is not allowed.',
        'InvalidStateError': 'Invalid operation state.',
        'NetworkError': 'Network error occurred.'
    };
    
    const message = userFriendlyMessages[event.error?.name] || 
                   'An unexpected error occurred. Please try again.';
    
    // You could show a toast notification here
    console.warn('User-friendly error:', message);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled Promise Rejection:', event.reason);
    event.preventDefault();
});

// Export Utils class for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}
