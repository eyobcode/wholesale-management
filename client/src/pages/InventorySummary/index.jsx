import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInventorySummary } from '../../hooks/useInventorySummary.js';
import { factoryService } from '../../services/factoryService.js';
import { DataTable, Card, Badge, Button } from '../../components/common/index.js';

export default function InventorySummary() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [expandedRowId, setExpandedRowId] = useState(null);

  const page = parseInt(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const activeSort = searchParams.get('ordering') || 'product_name';

  const filters = {
    factory: searchParams.get('factory') || '',
    is_low_stock: searchParams.get('is_low_stock') || '',
    is_sold_out: searchParams.get('is_sold_out') || '',
    has_stock: searchParams.get('has_stock') || '',
    min_remaining_bags: searchParams.get('min_remaining_bags') || '',
    purchase_date_from: searchParams.get('purchase_date_from') || '',
    purchase_date_to: searchParams.get('purchase_date_to') || '',
  };

  const queryParams = {
    page,
    search: search || undefined,
    ordering: activeSort || undefined,
    ...(filters.factory ? { factory: filters.factory } : {}),
    ...(filters.is_low_stock ? { is_low_stock: filters.is_low_stock } : {}),
    ...(filters.is_sold_out ? { is_sold_out: filters.is_sold_out } : {}),
    ...(filters.has_stock ? { has_stock: filters.has_stock } : {}),
    ...(filters.min_remaining_bags ? { min_remaining_bags: filters.min_remaining_bags } : {}),
    ...(filters.purchase_date_from ? { purchase_date_from: filters.purchase_date_from } : {}),
    ...(filters.purchase_date_to ? { purchase_date_to: filters.purchase_date_to } : {}),
  };

  const { data, isLoading } = useInventorySummary(queryParams);

  const formatCurrency = (val) => val ? parseFloat(val).toFixed(2) : '0.00';

  const formatRemainingStock = (bags, pcs) => {
    const b = parseFloat(bags || 0);
    const p = parseInt(pcs || 0);
    const bagText = b === 1 ? '1 Bag' : `${b} Bags`;
    return `${bagText} (${p} pcs)`;
  };

  const renderStatusBadges = (hasSoldOut, hasLowStock) => {
    if (!hasSoldOut && !hasLowStock) {
      return <Badge variant="success">Healthy</Badge>;
    }
    return (
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {hasSoldOut && <Badge variant="danger">Sold Out Batch</Badge>}
        {hasLowStock && <Badge variant="warning">Low Stock Batch</Badge>}
      </div>
    );
  };

  // --- Parent Table Configuration ---
  const parentColumns = [
    { key: 'product_name', title: 'Product Name', sortable: true },
    { key: 'item_code', title: 'Item Code', sortable: true },
    {
      key: 'total_remaining_stock',
      title: 'Total Remaining Stock',
      sortable: false,
      render: (_, row) => formatRemainingStock(row.total_remaining_bags, row.total_remaining_pieces)
    },
    {
      key: 'total_stock_value',
      title: 'Total Stock Value',
      sortable: false,
      render: (val) => formatCurrency(val)
    },
    { key: 'batch_count', title: 'Batch Count', sortable: false },
    {
      key: 'status',
      title: 'Status',
      sortable: false,
      render: (_, row) => renderStatusBadges(row.has_sold_out_batch, row.has_low_stock_batch)
    }
  ];

  const handleRowExpandToggle = (row) => {
    // Treat the product ID as item_code since the summary is grouped by product.
    // The backend serializer uses item_code as the unique key.
    const rowId = row.item_code;
    setExpandedRowId(prev => prev === rowId ? null : rowId);
  };

  // --- Nested Table Configuration ---
  const nestedColumns = [
    { key: 'shipping_code', title: 'Shipping Code' },
    { key: 'factory_name', title: 'Factory' },
    {
      key: 'purchase_date',
      title: 'Purchase Date',
      render: (val) => val ? new Date(val).toLocaleDateString() : '-'
    },
    {
      key: 'remaining_stock',
      title: 'Remaining Stock',
      render: (_, row) => formatRemainingStock(row.remaining_bags, row.remaining_pieces)
    },
    {
      key: 'stock_value',
      title: 'Stock Value',
      render: (val) => formatCurrency(val)
    },
    {
      key: 'status',
      title: 'Status',
      render: (_, row) => {
        if (!row.is_sold_out && !row.is_low_stock) return <Badge variant="success">Healthy</Badge>;
        return (
          <div style={{ display: 'flex', gap: '8px' }}>
            {row.is_sold_out && <Badge variant="danger">Sold Out</Badge>}
            {row.is_low_stock && <Badge variant="warning">Low Stock</Badge>}
          </div>
        );
      }
    }
  ];

  const nestedRowActions = [
    {
      icon: 'ri-eye-line',
      label: 'View',
      onClick: (batch) => navigate(`/inventory/${batch.id}`)
    }
  ];

  const renderExpandedRow = (row) => {
    return (
      <Card style={{ margin: '8px 24px', boxShadow: 'none', border: '1px solid var(--card-border)' }}>
        <DataTable
          columns={nestedColumns}
          data={row.batches || []}
          rowActions={nestedRowActions}
          emptyMessage="No batches found."
        />
      </Card>
    );
  };

  // --- Filter and Sort Configuration ---
  const filterConfig = [
    {
      key: 'factory',
      type: 'async-select',
      label: 'Factory',
      placeholder: 'All Factories',
      value: filters.factory,
      loadOptions: async (query) => {
        try {
          const res = await factoryService.getFactoryOptions(query);
          return Array.isArray(res) ? res : (res.results || []);
        } catch (e) {
          console.error(e);
          return [];
        }
      }
    },
    {
      key: 'is_low_stock',
      type: 'select',
      label: 'Low Stock',
      options: [
        { value: '', label: 'All' },
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' }
      ],
      value: filters.is_low_stock
    },
    {
      key: 'is_sold_out',
      type: 'select',
      label: 'Sold Out',
      options: [
        { value: '', label: 'All' },
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' }
      ],
      value: filters.is_sold_out
    },
    {
      key: 'has_stock',
      type: 'select',
      label: 'Has Stock',
      options: [
        { value: '', label: 'All' },
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' }
      ],
      value: filters.has_stock
    },
    {
      key: 'min_remaining_bags',
      type: 'number',
      label: 'Min Remaining Bags',
      placeholder: 'Min bags...',
      value: filters.min_remaining_bags
    },
    {
      type: 'date-range',
      keyFrom: 'purchase_date_from',
      keyTo: 'purchase_date_to',
      valueFrom: filters.purchase_date_from,
      valueTo: filters.purchase_date_to,
      placeholderFrom: 'From Date',
      placeholderTo: 'To Date',
      label: 'Purchase Date Range'
    }
  ];

  const sortConfig = [
    { value: 'item_code', label: 'Item Code (A-Z)' },
    { value: '-item_code', label: 'Item Code (Z-A)' },
    { value: 'product_name', label: 'Product Name (A-Z)' },
    { value: '-product_name', label: 'Product Name (Z-A)' },
    { value: '-total_remaining_bags', label: 'Total Remaining Bags (High to Low)' },
    { value: 'total_remaining_bags', label: 'Total Remaining Bags (Low to High)' },
    { value: '-total_stock_value', label: 'Total Stock Value (High to Low)' },
    { value: 'total_stock_value', label: 'Total Stock Value (Low to High)' },
  ];

  const updateURLParams = (updates) => {
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });
      return newParams;
    });
  };

  const handleFilterChange = (keyOrUpdates, val) => {
    if (typeof keyOrUpdates === 'object') {
      updateURLParams({ ...keyOrUpdates, page: 1 });
    } else {
      updateURLParams({ [keyOrUpdates]: val, page: 1 });
    }
  };

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Inventory Summary</h1>
          <p style={{ color: 'var(--text-muted)' }}>Aggregated stock overview by product.</p>
        </div>
        <Button
          variant="outline"
          leftIcon="ri-arrow-left-line"
          onClick={() => navigate('/inventory')}
        >
          Back to Inventory
        </Button>
      </div>

      <Card>
        <DataTable
          columns={parentColumns}
          data={data?.results || []}
          isLoading={isLoading}
          keyField="item_code"

          searchPlaceholder="Search product or item code..."
          searchValue={search}
          onSearch={(v) => updateURLParams({ search: v, page: 1 })}

          filters={filterConfig}
          onFilterChange={handleFilterChange}

          sortOptions={sortConfig}
          activeSort={activeSort}
          onSortChange={(val) => updateURLParams({ ordering: val, page: 1 })}

          expandedRowId={expandedRowId}
          renderExpandedRow={renderExpandedRow}

          pagination={{
            currentPage: page,
            totalPages: data?.total_pages || 1,
            totalItems: data?.count || 0,
            hasNext: !!data?.next,
            hasPrev: !!data?.previous,
            onPageChange: (newPage) => updateURLParams({ page: newPage })
          }}
        />
      </Card>
    </div>
  );
}
