/**
 * DataTable Component
 * Reusable sortable, filterable, paginated table
 * Supports custom actions and row selection
 */

class DataTable extends Component {
    constructor(props = {}) {
        super(props);
        
        this.state = {
            columns: props.columns || [],
            data: props.data || [],
            filteredData: [],
            sortColumn: props.sortColumn || null,
            sortDirection: props.sortDirection || 'asc',
            currentPage: 1,
            pageSize: props.pageSize || 20,
            searchQuery: '',
            selectedRows: new Set(),
            loading: false
        };

        // Initialize filtered data
        this.state.filteredData = [...this.state.data];
    }

    /**
     * Set table data
     * @param {array} data - Table data
     */
    setData(data) {
        this.setState({
            data: data,
            filteredData: this.applyFilters(data),
            currentPage: 1,
            selectedRows: new Set()
        });
    }

    /**
     * Apply filters to data
     */
    applyFilters(data) {
        let filtered = [...data];

        // Apply search
        if (this.state.searchQuery) {
            const query = this.state.searchQuery.toLowerCase();
            filtered = filtered.filter(row => {
                return this.state.columns.some(col => {
                    const value = this.getCellValue(row, col.field);
                    return value && value.toString().toLowerCase().includes(query);
                });
            });
        }

        // Apply sorting
        if (this.state.sortColumn) {
            filtered.sort((a, b) => {
                const aVal = this.getCellValue(a, this.state.sortColumn);
                const bVal = this.getCellValue(b, this.state.sortColumn);

                if (aVal < bVal) return this.state.sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return this.state.sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    }

    /**
     * Get cell value from row
     */
    getCellValue(row, field) {
        if (typeof field === 'function') {
            return field(row);
        }
        return field.split('.').reduce((obj, key) => obj?.[key], row);
    }

    /**
     * Handle search
     */
    handleSearch(query) {
        this.setState({
            searchQuery: query,
            filteredData: this.applyFilters(this.state.data),
            currentPage: 1
        });
    }

    /**
     * Handle sort
     */
    handleSort(column) {
        if (!column.sortable) return;

        const newDirection = 
            this.state.sortColumn === column.field && this.state.sortDirection === 'asc'
                ? 'desc'
                : 'asc';

        this.setState({
            sortColumn: column.field,
            sortDirection: newDirection,
            filteredData: this.applyFilters(this.state.data)
        });
    }

    /**
     * Handle row selection
     */
    toggleRow(rowId) {
        const selectedRows = new Set(this.state.selectedRows);
        
        if (selectedRows.has(rowId)) {
            selectedRows.delete(rowId);
        } else {
            selectedRows.add(rowId);
        }

        this.setState({ selectedRows });
    }

    /**
     * Toggle all rows
     */
    toggleAllRows() {
        const pageData = this.getPageData();
        const allSelected = pageData.every(row => 
            this.state.selectedRows.has(this.getRowId(row))
        );

        const selectedRows = new Set(this.state.selectedRows);

        if (allSelected) {
            pageData.forEach(row => selectedRows.delete(this.getRowId(row)));
        } else {
            pageData.forEach(row => selectedRows.add(this.getRowId(row)));
        }

        this.setState({ selectedRows });
    }

    /**
     * Get row ID
     */
    getRowId(row) {
        return row.id || row._id || JSON.stringify(row);
    }

    /**
     * Get current page data
     */
    getPageData() {
        const { filteredData, currentPage, pageSize } = this.state;
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        return filteredData.slice(start, end);
    }

    /**
     * Get total pages
     */
    getTotalPages() {
        return Math.ceil(this.state.filteredData.length / this.state.pageSize);
    }

    /**
     * Go to page
     */
    goToPage(page) {
        const totalPages = this.getTotalPages();
        if (page < 1 || page > totalPages) return;

        this.setState({ currentPage: page });
    }

    /**
     * Render template
     */
    template() {
        return `
            <div class="datatable-container">
                ${this.renderToolbar()}
                ${this.renderTable()}
                ${this.renderPagination()}
            </div>
        `;
    }

    /**
     * Render toolbar with search and actions
     */
    renderToolbar() {
        const { selectedRows } = this.state;
        const hasSelection = selectedRows.size > 0;

        return `
            <div class="datatable-toolbar">
                <div class="datatable-search">
                    <input type="text" 
                           class="search-input" 
                           placeholder="Search..." 
                           value="${this.state.searchQuery}"
                           oninput="dataTableComponent.handleSearch(this.value)">
                    <i data-lucide="search"></i>
                </div>
                ${hasSelection ? `
                    <div class="datatable-actions">
                        <span>${selectedRows.size} selected</span>
                        ${this.props.bulkActions ? this.renderBulkActions() : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Render bulk actions
     */
    renderBulkActions() {
        if (!this.props.bulkActions) return '';

        return this.props.bulkActions.map(action => `
            <button class="btn btn-sm btn-secondary" 
                    onclick="dataTableComponent.handleBulkAction('${action.id}')">
                ${action.icon ? `<i data-lucide="${action.icon}"></i>` : ''}
                ${action.label}
            </button>
        `).join('');
    }

    /**
     * Render table
     */
    renderTable() {
        const { columns, loading } = this.state;
        const pageData = this.getPageData();

        return `
            <div class="datatable-wrapper">
                <table class="datatable">
                    <thead>
                        <tr>
                            ${this.props.selectable ? '<th class="datatable-checkbox"><input type="checkbox" onclick="dataTableComponent.toggleAllRows()"></th>' : ''}
                            ${columns.map(col => this.renderHeaderCell(col)).join('')}
                            ${this.props.actions ? '<th class="datatable-actions">Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${loading ? this.renderLoadingRow() : ''}
                        ${!loading && pageData.length === 0 ? this.renderEmptyRow() : ''}
                        ${!loading ? pageData.map(row => this.renderRow(row)).join('') : ''}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Render header cell
     */
    renderHeaderCell(column) {
        const sortable = column.sortable !== false;
        const isSorted = this.state.sortColumn === column.field;
        const sortIcon = isSorted 
            ? (this.state.sortDirection === 'asc' ? 'chevron-up' : 'chevron-down')
            : 'chevrons-up-down';

        return `
            <th class="datatable-header ${sortable ? 'sortable' : ''}" 
                ${sortable ? `onclick="dataTableComponent.handleSort(${JSON.stringify(column).replace(/"/g, '&quot;')})"` : ''}>
                ${column.label}
                ${sortable ? `<i data-lucide="${sortIcon}" class="sort-icon"></i>` : ''}
            </th>
        `;
    }

    /**
     * Render data row
     */
    renderRow(row) {
        const rowId = this.getRowId(row);
        const isSelected = this.state.selectedRows.has(rowId);

        return `
            <tr class="${isSelected ? 'selected' : ''}">
                ${this.props.selectable ? `
                    <td class="datatable-checkbox">
                        <input type="checkbox" 
                               ${isSelected ? 'checked' : ''}
                               onchange="dataTableComponent.toggleRow('${rowId}')">
                    </td>
                ` : ''}
                ${this.state.columns.map(col => this.renderCell(row, col)).join('')}
                ${this.props.actions ? this.renderActionsCell(row) : ''}
            </tr>
        `;
    }

    /**
     * Render data cell
     */
    renderCell(row, column) {
        let value = this.getCellValue(row, column.field);

        // Apply formatter if provided
        if (column.formatter) {
            value = column.formatter(value, row);
        }

        return `<td class="datatable-cell">${value !== null && value !== undefined ? value : '-'}</td>`;
    }

    /**
     * Render actions cell
     */
    renderActionsCell(row) {
        if (!this.props.actions) return '';

        const actions = this.props.actions.map(action => `
            <button class="btn-icon" 
                    onclick="dataTableComponent.handleAction('${action.id}', ${JSON.stringify(row).replace(/"/g, '&quot;')})"
                    title="${action.label}">
                <i data-lucide="${action.icon}"></i>
            </button>
        `).join('');

        return `<td class="datatable-actions">${actions}</td>`;
    }

    /**
     * Render loading row
     */
    renderLoadingRow() {
        const colSpan = this.state.columns.length + 
                        (this.props.selectable ? 1 : 0) + 
                        (this.props.actions ? 1 : 0);

        return `
            <tr>
                <td colspan="${colSpan}" class="datatable-empty">
                    Loading...
                </td>
            </tr>
        `;
    }

    /**
     * Render empty row
     */
    renderEmptyRow() {
        const colSpan = this.state.columns.length + 
                        (this.props.selectable ? 1 : 0) + 
                        (this.props.actions ? 1 : 0);

        return `
            <tr>
                <td colspan="${colSpan}" class="datatable-empty">
                    No data available
                </td>
            </tr>
        `;
    }

    /**
     * Render pagination
     */
    renderPagination() {
        const { currentPage, filteredData, pageSize } = this.state;
        const totalPages = this.getTotalPages();
        const start = (currentPage - 1) * pageSize + 1;
        const end = Math.min(currentPage * pageSize, filteredData.length);

        if (totalPages <= 1) return '';

        return `
            <div class="datatable-pagination">
                <div class="pagination-info">
                    Showing ${start}-${end} of ${filteredData.length}
                </div>
                <div class="pagination-controls">
                    <button class="btn-icon" 
                            onclick="dataTableComponent.goToPage(${currentPage - 1})"
                            ${currentPage === 1 ? 'disabled' : ''}>
                        <i data-lucide="chevron-left"></i>
                    </button>
                    <span class="pagination-page">
                        Page ${currentPage} of ${totalPages}
                    </span>
                    <button class="btn-icon" 
                            onclick="dataTableComponent.goToPage(${currentPage + 1})"
                            ${currentPage === totalPages ? 'disabled' : ''}>
                        <i data-lucide="chevron-right"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Handle action click
     */
    handleAction(actionId, row) {
        if (this.props.onAction) {
            this.props.onAction(actionId, row);
        }
    }

    /**
     * Handle bulk action
     */
    handleBulkAction(actionId) {
        const selectedRows = Array.from(this.state.selectedRows);
        const selectedData = this.state.data.filter(row => 
            selectedRows.includes(this.getRowId(row))
        );

        if (this.props.onBulkAction) {
            this.props.onBulkAction(actionId, selectedData);
        }
    }

    /**
     * After render
     */
    afterRender() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    /**
     * Get selected rows
     */
    getSelectedRows() {
        const selectedIds = Array.from(this.state.selectedRows);
        return this.state.data.filter(row => 
            selectedIds.includes(this.getRowId(row))
        );
    }

    /**
     * Clear selection
     */
    clearSelection() {
        this.setState({ selectedRows: new Set() });
    }
}

// Create global instance
let dataTableComponent;

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DataTable };
}
