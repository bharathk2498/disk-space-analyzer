# 🚀 Advanced Drive & Disk Analyzer

A sophisticated web-based disk space analyzer that provides comprehensive drive analysis with real-time scanning, advanced visualizations, and secure file management capabilities. Built entirely with modern web technologies and runs directly in your browser.

## ✨ Features

### 🔍 **Advanced Scanning**
- **Complete Drive Analysis**: Scan entire drives (C:, D:, etc.) or specific folders
- **Real-time Progress**: Live scanning with speed metrics and progress tracking
- **Deep Directory Traversal**: Configurable depth limits with smart scanning
- **Cross-Platform**: Works on Windows, Linux, and macOS
- **Permission-Aware**: Handles restricted files gracefully

### 📊 **Rich Visualizations**
- **Multiple Chart Types**: Pie charts, bar charts, treemaps, and timeline analysis
- **Interactive Displays**: Clickable charts with detailed tooltips
- **Size Distribution**: Visual breakdown by file size categories
- **File Type Analysis**: Comprehensive file type statistics
- **Custom Color Themes**: Multiple color schemes for better visibility

### 📋 **Comprehensive Views**
- **Overview Dashboard**: Quick insights and cleanup suggestions
- **Tree Structure**: Hierarchical folder navigation with expand/collapse
- **Table View**: Sortable, filterable, paginated file listing
- **Visual Charts**: Advanced data visualization with D3.js integration
- **Analysis Panel**: Detailed analytics and recommendations

### 🗂️ **File Management**
- **Safe Deletion**: Secure file and folder deletion with confirmations
- **Bulk Operations**: Select and delete multiple items simultaneously
- **Smart Validation**: Warnings for system files and important directories
- **Operation History**: Track all file operations with undo capabilities
- **Permission Checks**: Real-time permission validation

### 🎯 **Smart Analysis**
- **Cleanup Suggestions**: Identify temporary files, duplicates, and large files
- **Duplicate Detection**: Find identical files by size and name
- **Space Optimization**: Recommendations for freeing up disk space
- **Security Analysis**: Identify potentially risky files and locations
- **Trend Analysis**: File modification patterns over time

### 🎨 **Modern Interface**
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Dark/Light Themes**: Multiple theme options including high contrast
- **Keyboard Shortcuts**: Power user features with hotkeys
- **Accessibility**: Screen reader compatible with proper ARIA labels
- **Progressive Enhancement**: Graceful degradation for older browsers

## 🌐 Browser Requirements

- **Chrome 86+** or **Edge 86+** (File System Access API required)
- **Firefox**: Limited support (coming soon)
- **Safari**: Limited support (File System Access API not yet available)

## 🚀 Quick Start

### Option 1: Direct Usage
1. Download or clone this repository
2. Open `index.html` in Chrome or Edge
3. Click "Scan Drive/Folder" to begin analysis
4. Grant permission when prompted
5. Explore your drive data with multiple views!

### Option 2: Local Server
```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
