// Utility functions for file size formatting and data manipulation

class Utils {
    static formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
    
    static formatDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    }
    
    static getFileIcon(fileName, isDirectory = false) {
        if (isDirectory) return 'fas fa-folder';
        
        const ext = fileName.split('.').pop().toLowerCase();
        const iconMap = {
            // Images
            'jpg': 'fas fa-image', 'jpeg': 'fas fa-image', 'png': 'fas fa-image',
            'gif': 'fas fa-image', 'bmp': 'fas fa-image', 'svg': 'fas fa-image',
            
            // Videos
            'mp4': 'fas fa-video', 'avi': 'fas fa-video', 'mov': 'fas fa-video',
            'mkv': 'fas fa-video', 'wmv': 'fas fa-video', 'flv': 'fas fa-video',
            
            // Audio
            'mp3': 'fas fa-music', 'wav': 'fas fa-music', 'flac': 'fas fa-music',
            'aac': 'fas fa-music', 'ogg': 'fas fa-music',
            
            // Documents
            'pdf': 'fas fa-file-pdf', 'doc': 'fas fa-file-word', 'docx': 'fas fa-file-word',
            'xls': 'fas fa-file-excel', 'xlsx': 'fas fa-file-excel',
            'ppt': 'fas fa-file-powerpoint', 'pptx': 'fas fa-file-powerpoint',
            'txt': 'fas fa-file-alt',
            
            // Code
            'js': 'fas fa-file-code', 'html': 'fas fa-file-code', 'css': 'fas fa-file-code',
            'php': 'fas fa-file-code', 'py': 'fas fa-file-code', 'java': 'fas fa-file-code',
            'cpp': 'fas fa-file-code', 'c': 'fas fa-file-code',
            
            // Archives
            'zip': 'fas fa-file-archive', 'rar': 'fas fa-file-archive', '7z': 'fas fa-file-archive',
            'tar': 'fas fa-file-archive', 'gz': 'fas fa-file-archive'
        };
        
        return iconMap[ext] || 'fas fa-file';
    }
    
    static generateId() {
        return Math.random().toString(36).substr(2, 9);
    }
    
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    static async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    static exportToJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        this.downloadBlob(blob, filename);
    }
    
    static exportToCSV(data, filename) {
        const headers = ['Name', 'Size (Bytes)', 'Size (Formatted)', 'Type', 'Path'];
        const csvContent = [
            headers.join(','),
            ...data.map(item => [
                `"${item.name}"`,
                item.size,
                `"${Utils.formatBytes(item.size)}"`,
                `"${item.isDirectory ? 'Folder' : 'File'}"`,
                `"${item.path}"`
            ].join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        this.downloadBlob(blob, filename);
    }
    
    static downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
}

// Global error handler
window.addEventListener('error', (e) => {
    console.error('Application Error:', e.error);
    // You could add user notification here
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled Promise Rejection:', e.reason);
    e.preventDefault();
});
