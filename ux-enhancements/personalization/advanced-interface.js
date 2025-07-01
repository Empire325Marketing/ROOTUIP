/**
 * ROOTUIP Advanced Interface Features
 * Keyboard shortcuts, bulk operations, search, and export capabilities
 */

const EventEmitter = require('events');

class AdvancedInterfaceManager extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            enableKeyboardShortcuts: config.enableKeyboardShortcuts !== false,
            enableBulkOperations: config.enableBulkOperations !== false,
            enableAdvancedSearch: config.enableAdvancedSearch !== false,
            maxBulkOperations: config.maxBulkOperations || 1000,
            searchDebounceTime: config.searchDebounceTime || 300
        };
        
        // Keyboard shortcuts registry
        this.shortcuts = new Map();
        
        // Search filters and operators
        this.searchFilters = new Map();
        this.searchOperators = new Map();
        
        // Export formats
        this.exportFormats = new Map();
        
        // Bulk operation handlers
        this.bulkOperations = new Map();
        
        // Search history
        this.searchHistory = [];
        
        // Selected items for bulk operations
        this.selectedItems = new Set();
        
        // Initialize features
        this.initializeKeyboardShortcuts();
        this.initializeSearchOperators();
        this.initializeExportFormats();
        this.initializeBulkOperations();
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    // Initialize keyboard shortcuts
    initializeKeyboardShortcuts() {
        // Global shortcuts
        this.addShortcut('ctrl+k', 'global_search', 'Open global search', () => {
            this.openGlobalSearch();
        });
        
        this.addShortcut('ctrl+/', 'show_shortcuts', 'Show keyboard shortcuts', () => {
            this.showShortcutsHelp();
        });
        
        this.addShortcut('ctrl+shift+d', 'toggle_dark_mode', 'Toggle dark mode', () => {
            this.toggleDarkMode();
        });
        
        this.addShortcut('ctrl+shift+s', 'save_view', 'Save current view', () => {
            this.saveCurrentView();
        });
        
        // Navigation shortcuts
        this.addShortcut('g d', 'goto_dashboard', 'Go to dashboard', () => {
            this.navigateTo('/dashboard');
        });
        
        this.addShortcut('g s', 'goto_shipments', 'Go to shipments', () => {
            this.navigateTo('/shipments');
        });
        
        this.addShortcut('g c', 'goto_customers', 'Go to customers', () => {
            this.navigateTo('/customers');
        });
        
        this.addShortcut('g r', 'goto_reports', 'Go to reports', () => {
            this.navigateTo('/reports');
        });
        
        // Data manipulation shortcuts
        this.addShortcut('ctrl+a', 'select_all', 'Select all items', () => {
            this.selectAllItems();
        });
        
        this.addShortcut('ctrl+shift+a', 'deselect_all', 'Deselect all items', () => {
            this.deselectAllItems();
        });
        
        this.addShortcut('ctrl+e', 'export_data', 'Export selected data', () => {
            this.exportSelectedData();
        });
        
        this.addShortcut('delete', 'delete_selected', 'Delete selected items', () => {
            this.deleteSelectedItems();
        });
        
        // Table navigation shortcuts
        this.addShortcut('j', 'next_row', 'Next row', () => {
            this.navigateTableRow('down');
        });
        
        this.addShortcut('k', 'prev_row', 'Previous row', () => {
            this.navigateTableRow('up');
        });
        
        this.addShortcut('space', 'toggle_select', 'Toggle row selection', () => {
            this.toggleCurrentRowSelection();
        });
        
        this.addShortcut('enter', 'open_item', 'Open selected item', () => {
            this.openCurrentItem();
        });
        
        // Quick actions
        this.addShortcut('n', 'new_item', 'Create new item', () => {
            this.createNewItem();
        });
        
        this.addShortcut('e', 'edit_item', 'Edit selected item', () => {
            this.editCurrentItem();
        });
        
        this.addShortcut('f', 'filter_table', 'Focus filter input', () => {
            this.focusFilterInput();
        });
        
        this.addShortcut('r', 'refresh_data', 'Refresh current data', () => {
            this.refreshCurrentData();
        });
    }
    
    // Add keyboard shortcut
    addShortcut(keys, action, description, handler) {
        this.shortcuts.set(keys, {
            keys,
            action,
            description,
            handler,
            enabled: true
        });
    }
    
    // Initialize search operators
    initializeSearchOperators() {
        // Text operators
        this.addSearchOperator('contains', 'Contains', 'text', (value, searchTerm) => {
            return value.toLowerCase().includes(searchTerm.toLowerCase());
        });
        
        this.addSearchOperator('equals', 'Equals', 'text', (value, searchTerm) => {
            return value.toLowerCase() === searchTerm.toLowerCase();
        });
        
        this.addSearchOperator('starts_with', 'Starts with', 'text', (value, searchTerm) => {
            return value.toLowerCase().startsWith(searchTerm.toLowerCase());
        });
        
        this.addSearchOperator('ends_with', 'Ends with', 'text', (value, searchTerm) => {
            return value.toLowerCase().endsWith(searchTerm.toLowerCase());
        });
        
        this.addSearchOperator('regex', 'Regular expression', 'text', (value, searchTerm) => {
            try {
                const regex = new RegExp(searchTerm, 'i');
                return regex.test(value);
            } catch (e) {
                return false;
            }
        });
        
        // Number operators
        this.addSearchOperator('gt', 'Greater than', 'number', (value, searchTerm) => {
            return parseFloat(value) > parseFloat(searchTerm);
        });
        
        this.addSearchOperator('gte', 'Greater than or equal', 'number', (value, searchTerm) => {
            return parseFloat(value) >= parseFloat(searchTerm);
        });
        
        this.addSearchOperator('lt', 'Less than', 'number', (value, searchTerm) => {
            return parseFloat(value) < parseFloat(searchTerm);
        });
        
        this.addSearchOperator('lte', 'Less than or equal', 'number', (value, searchTerm) => {
            return parseFloat(value) <= parseFloat(searchTerm);
        });
        
        this.addSearchOperator('between', 'Between', 'number', (value, searchTerm) => {
            const [min, max] = searchTerm.split(',').map(v => parseFloat(v.trim()));
            const numValue = parseFloat(value);
            return numValue >= min && numValue <= max;
        });
        
        // Date operators
        this.addSearchOperator('date_equals', 'Date equals', 'date', (value, searchTerm) => {
            const date1 = new Date(value).toDateString();
            const date2 = new Date(searchTerm).toDateString();
            return date1 === date2;
        });
        
        this.addSearchOperator('date_after', 'Date after', 'date', (value, searchTerm) => {
            return new Date(value) > new Date(searchTerm);
        });
        
        this.addSearchOperator('date_before', 'Date before', 'date', (value, searchTerm) => {
            return new Date(value) < new Date(searchTerm);
        });
        
        this.addSearchOperator('date_range', 'Date range', 'date', (value, searchTerm) => {
            const [start, end] = searchTerm.split(',').map(d => new Date(d.trim()));
            const date = new Date(value);
            return date >= start && date <= end;
        });
        
        // Array operators
        this.addSearchOperator('in', 'In list', 'array', (value, searchTerm) => {
            const list = searchTerm.split(',').map(v => v.trim().toLowerCase());
            return list.includes(value.toLowerCase());
        });
        
        this.addSearchOperator('not_in', 'Not in list', 'array', (value, searchTerm) => {
            const list = searchTerm.split(',').map(v => v.trim().toLowerCase());
            return !list.includes(value.toLowerCase());
        });
    }
    
    // Add search operator
    addSearchOperator(id, name, type, evaluator) {
        this.searchOperators.set(id, {
            id,
            name,
            type,
            evaluator
        });
    }
    
    // Initialize export formats
    initializeExportFormats() {
        // CSV format
        this.addExportFormat('csv', 'CSV', 'text/csv', (data, options) => {
            return this.exportToCSV(data, options);
        });
        
        // Excel format
        this.addExportFormat('xlsx', 'Excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', (data, options) => {
            return this.exportToExcel(data, options);
        });
        
        // JSON format
        this.addExportFormat('json', 'JSON', 'application/json', (data, options) => {
            return this.exportToJSON(data, options);
        });
        
        // PDF format
        this.addExportFormat('pdf', 'PDF', 'application/pdf', (data, options) => {
            return this.exportToPDF(data, options);
        });
        
        // XML format
        this.addExportFormat('xml', 'XML', 'application/xml', (data, options) => {
            return this.exportToXML(data, options);
        });
    }
    
    // Add export format
    addExportFormat(id, name, mimeType, exporter) {
        this.exportFormats.set(id, {
            id,
            name,
            mimeType,
            exporter
        });
    }
    
    // Initialize bulk operations
    initializeBulkOperations() {
        // Update operation
        this.addBulkOperation('update', 'Update Fields', async (items, params) => {
            return this.bulkUpdate(items, params);
        });
        
        // Delete operation
        this.addBulkOperation('delete', 'Delete Items', async (items, params) => {
            return this.bulkDelete(items, params);
        });
        
        // Status change operation
        this.addBulkOperation('change_status', 'Change Status', async (items, params) => {
            return this.bulkChangeStatus(items, params);
        });
        
        // Assign operation
        this.addBulkOperation('assign', 'Assign To', async (items, params) => {
            return this.bulkAssign(items, params);
        });
        
        // Tag operation
        this.addBulkOperation('tag', 'Add Tags', async (items, params) => {
            return this.bulkAddTags(items, params);
        });
        
        // Export operation
        this.addBulkOperation('export', 'Export Items', async (items, params) => {
            return this.bulkExport(items, params);
        });
    }
    
    // Add bulk operation
    addBulkOperation(id, name, handler) {
        this.bulkOperations.set(id, {
            id,
            name,
            handler
        });
    }
    
    // Setup event listeners
    setupEventListeners() {
        if (typeof document !== 'undefined') {
            // Keyboard event listener
            document.addEventListener('keydown', (event) => {
                this.handleKeyDown(event);
            });
            
            // Selection event listeners
            document.addEventListener('click', (event) => {
                this.handleItemSelection(event);
            });
        }
    }
    
    // Handle keyboard shortcuts
    handleKeyDown(event) {
        if (!this.config.enableKeyboardShortcuts) return;
        
        // Build key combination string
        const keys = [];
        
        if (event.ctrlKey) keys.push('ctrl');
        if (event.shiftKey) keys.push('shift');
        if (event.altKey) keys.push('alt');
        if (event.metaKey) keys.push('meta');
        
        // Add the main key
        if (event.key.length === 1) {
            keys.push(event.key.toLowerCase());
        } else {
            keys.push(event.key.toLowerCase());
        }
        
        const keyCombo = keys.join('+');
        
        // Check for matching shortcut
        if (this.shortcuts.has(keyCombo)) {
            const shortcut = this.shortcuts.get(keyCombo);
            
            if (shortcut.enabled) {
                event.preventDefault();
                shortcut.handler();
                
                this.emit('shortcut:executed', {
                    keys: keyCombo,
                    action: shortcut.action
                });
            }
        }
    }
    
    // Handle item selection
    handleItemSelection(event) {
        const itemElement = event.target.closest('[data-item-id]');
        if (!itemElement) return;
        
        const itemId = itemElement.dataset.itemId;
        
        if (event.ctrlKey || event.metaKey) {
            // Toggle selection
            if (this.selectedItems.has(itemId)) {
                this.selectedItems.delete(itemId);
                itemElement.classList.remove('selected');
            } else {
                this.selectedItems.add(itemId);
                itemElement.classList.add('selected');
            }
        } else if (event.shiftKey) {
            // Range selection
            this.selectRange(itemId);
        } else {
            // Single selection
            this.clearSelection();
            this.selectedItems.add(itemId);
            itemElement.classList.add('selected');
        }
        
        this.emit('selection:changed', {
            selectedItems: Array.from(this.selectedItems),
            count: this.selectedItems.size
        });
    }
    
    // Advanced search
    performAdvancedSearch(query, options = {}) {
        const searchConfig = {
            query,
            fields: options.fields || [],
            operators: options.operators || {},
            filters: options.filters || [],
            sorting: options.sorting || {},
            pagination: options.pagination || { page: 1, limit: 50 }
        };
        
        // Add to search history
        this.addToSearchHistory(searchConfig);
        
        // Emit search event
        this.emit('search:performed', searchConfig);
        
        return searchConfig;
    }
    
    // Add to search history
    addToSearchHistory(searchConfig) {
        this.searchHistory.unshift({
            ...searchConfig,
            timestamp: new Date()
        });
        
        // Keep only last 50 searches
        if (this.searchHistory.length > 50) {
            this.searchHistory = this.searchHistory.slice(0, 50);
        }
    }
    
    // Get search suggestions
    getSearchSuggestions(query, field = null) {
        const suggestions = [];
        
        // Get suggestions from search history
        this.searchHistory.forEach(search => {
            if (search.query.toLowerCase().includes(query.toLowerCase())) {
                suggestions.push({
                    type: 'history',
                    query: search.query,
                    timestamp: search.timestamp
                });
            }
        });
        
        // Get field-specific suggestions
        if (field && this.searchFilters.has(field)) {
            const filter = this.searchFilters.get(field);
            if (filter.suggestions) {
                filter.suggestions.forEach(suggestion => {
                    if (suggestion.toLowerCase().includes(query.toLowerCase())) {
                        suggestions.push({
                            type: 'field_suggestion',
                            field,
                            value: suggestion
                        });
                    }
                });
            }
        }
        
        return suggestions.slice(0, 10);
    }
    
    // Export data
    async exportData(data, format, options = {}) {
        const exportFormat = this.exportFormats.get(format);
        if (!exportFormat) {
            throw new Error(`Unsupported export format: ${format}`);
        }
        
        try {
            const result = await exportFormat.exporter(data, options);
            
            this.emit('export:completed', {
                format,
                recordCount: data.length,
                options
            });
            
            return result;
        } catch (error) {
            this.emit('export:error', {
                format,
                error: error.message
            });
            throw error;
        }
    }
    
    // Export to CSV
    exportToCSV(data, options) {
        const headers = options.columns || Object.keys(data[0] || {});
        const rows = [headers];
        
        data.forEach(item => {
            const row = headers.map(header => {
                const value = item[header];
                // Escape quotes and wrap in quotes if contains comma or quote
                if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value || '';
            });
            rows.push(row);
        });
        
        return rows.map(row => row.join(',')).join('\n');
    }
    
    // Export to JSON
    exportToJSON(data, options) {
        if (options.formatted) {
            return JSON.stringify(data, null, 2);
        }
        return JSON.stringify(data);
    }
    
    // Export to XML
    exportToXML(data, options) {
        const rootElement = options.rootElement || 'data';
        const itemElement = options.itemElement || 'item';
        
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootElement}>\n`;
        
        data.forEach(item => {
            xml += `  <${itemElement}>\n`;
            Object.entries(item).forEach(([key, value]) => {
                xml += `    <${key}>${this.escapeXML(value)}</${key}>\n`;
            });
            xml += `  </${itemElement}>\n`;
        });
        
        xml += `</${rootElement}>`;
        return xml;
    }
    
    // Escape XML characters
    escapeXML(value) {
        if (typeof value !== 'string') {
            return value;
        }
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    
    // Bulk operations
    async executeBulkOperation(operationId, items, params = {}) {
        if (!this.config.enableBulkOperations) {
            throw new Error('Bulk operations are disabled');
        }
        
        if (items.length > this.config.maxBulkOperations) {
            throw new Error(`Cannot process more than ${this.config.maxBulkOperations} items at once`);
        }
        
        const operation = this.bulkOperations.get(operationId);
        if (!operation) {
            throw new Error(`Unknown bulk operation: ${operationId}`);
        }
        
        try {
            this.emit('bulk_operation:started', {
                operation: operationId,
                itemCount: items.length,
                params
            });
            
            const result = await operation.handler(items, params);
            
            this.emit('bulk_operation:completed', {
                operation: operationId,
                itemCount: items.length,
                result
            });
            
            return result;
        } catch (error) {
            this.emit('bulk_operation:error', {
                operation: operationId,
                error: error.message
            });
            throw error;
        }
    }
    
    // Bulk update
    async bulkUpdate(items, params) {
        const results = [];
        const updateFields = params.fields || {};
        
        for (const item of items) {
            try {
                const updatedItem = { ...item, ...updateFields };
                // Here you would typically call your API to update the item
                results.push({ id: item.id, status: 'success', item: updatedItem });
            } catch (error) {
                results.push({ id: item.id, status: 'error', error: error.message });
            }
        }
        
        return results;
    }
    
    // Bulk delete
    async bulkDelete(items, params) {
        const results = [];
        
        for (const item of items) {
            try {
                // Here you would typically call your API to delete the item
                results.push({ id: item.id, status: 'deleted' });
            } catch (error) {
                results.push({ id: item.id, status: 'error', error: error.message });
            }
        }
        
        return results;
    }
    
    // Utility methods
    selectAllItems() {
        const itemElements = document.querySelectorAll('[data-item-id]');
        itemElements.forEach(element => {
            const itemId = element.dataset.itemId;
            this.selectedItems.add(itemId);
            element.classList.add('selected');
        });
        
        this.emit('selection:all');
    }
    
    deselectAllItems() {
        this.clearSelection();
        this.emit('selection:none');
    }
    
    clearSelection() {
        this.selectedItems.clear();
        document.querySelectorAll('[data-item-id].selected').forEach(element => {
            element.classList.remove('selected');
        });
    }
    
    getSelectedItems() {
        return Array.from(this.selectedItems);
    }
    
    // Navigation helpers
    navigateTo(path) {
        if (typeof window !== 'undefined' && window.history) {
            window.history.pushState({}, '', path);
            this.emit('navigation:changed', { path });
        }
    }
    
    // Show shortcuts help
    showShortcutsHelp() {
        const shortcuts = Array.from(this.shortcuts.values()).filter(s => s.enabled);
        this.emit('shortcuts:help_requested', { shortcuts });
    }
    
    // Toggle dark mode
    toggleDarkMode() {
        this.emit('theme:toggle_dark_mode');
    }
    
    // Save current view
    saveCurrentView() {
        this.emit('view:save_requested');
    }
    
    // Get available shortcuts
    getAvailableShortcuts() {
        return Array.from(this.shortcuts.values()).filter(s => s.enabled);
    }
    
    // Get available bulk operations
    getAvailableBulkOperations() {
        return Array.from(this.bulkOperations.values());
    }
    
    // Get available export formats
    getAvailableExportFormats() {
        return Array.from(this.exportFormats.values());
    }
    
    // Get search operators
    getSearchOperators(type = null) {
        const operators = Array.from(this.searchOperators.values());
        if (type) {
            return operators.filter(op => op.type === type);
        }
        return operators;
    }
}

module.exports = AdvancedInterfaceManager;