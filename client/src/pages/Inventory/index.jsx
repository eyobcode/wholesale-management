import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useInventory } from '../../hooks/useInventory.js';
import { factoryService } from '../../services/factoryService.js';
import { DataTable, Card, Button } from '../../components/common/index.js';

export default function Inventory() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseInt(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const activeSort = searchParams.get('ordering') || '-purchase__date';

  const filters = {
    factory: searchParams.get('factory') || '',
    shipping_code: searchParams.get('shipping_code') || '',
    price_type: searchParams.get('price_type') || '',
    stock_status: searchParams.get('stock_status') || '',
    purchase_date_from: searchParams.get('purchase_date_from') || '',
    purchase_date_to: searchParams.get('purchase_date_to') || '',
    min_purchase_price: searchParams.get('min_purchase_price') || '',
    max_purchase_price: searchParams.get('max_purchase_price') || '',
    min_remaining_bags: searchParams.get('min_remaining_bags') || '',
  };

  const getStockStatusParams = () => {
    if (filters.stock_status === 'has_stock') return { has_stock: 'true' };
    if (filters.stock_status === 'is_sold_out') return { is_sold_out: 'true' };
    if (filters.stock_status === 'is_low_stock') return { is_low_stock: 'true' };
    return {};
  };

  const queryParams = {
    page,
    search: search || undefined,
    ordering: activeSort || undefined,
    ...(filters.factory ? { factory: filters.factory } : {}),
    ...(filters.shipping_code ? { shipping_code: filters.shipping_code } : {}),
    ...(filters.price_type ? { price_type: filters.price_type } : {}),
    ...getStockStatusParams(),
    ...(filters.purchase_date_from ? { purchase_date_from: filters.purchase_date_from } : {}),
    ...(filters.purchase_date_to ? { purchase_date_to: filters.purchase_date_to } : {}),
    ...(filters.min_purchase_price ? { min_purchase_price: filters.min_purchase_price } : {}),
    ...(filters.max_purchase_price ? { max_purchase_price: filters.max_purchase_price } : {}),
    ...(filters.min_remaining_bags ? { min_remaining_bags: filters.min_remaining_bags } : {}),
  };

  const { data, isLoading } = useInventory(queryParams);

  const formatCurrency = (val) => val ? parseFloat(val).toFixed(2) : '0.00';

  const formatRemainingStock = (row) => {
    const bags = parseFloat(row.remaining_bags || 0);
    const pcs = parseInt(row.remaining_pieces || 0);
    const bagText = bags === 1 ? '1 Bag' : `${bags} Bags`;
    return `${bagText} (${pcs} pcs)`;
  };

  const columns = [
    { key: 'product_name', title: 'Product Name', sortable: true },
    { key: 'item_code', title: 'Item Code', sortable: true },
    { key: 'factory_name', title: 'Factory', sortable: false },
    { key: 'shipping_code', title: 'Shipping Code', sortable: true },
    {
      key: 'remaining_stock',
      title: 'Remaining Stock',
      sortable: false,
      render: (_, row) => formatRemainingStock(row)
    },
    {
      key: 'stock_value',
      title: 'Stock Value',
      sortable: true,
      render: (val) => formatCurrency(val)
    }
  ];

  const rowActions = [
    {
      icon: 'ri-eye-line',
      label: 'View',
      onClick: (row) => navigate(`/inventory/${row.id}`)
    }
  ];

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
      key: 'stock_status',
      type: 'select',
      label: 'Stock Status',
      options: [
        { value: '', label: 'All' },
        { value: 'has_stock', label: 'Has Stock' },
        { value: 'is_sold_out', label: 'Sold Out' },
        { value: 'is_low_stock', label: 'Low Stock' }
      ],
      value: filters.stock_status
    },
    {
      key: 'price_type',
      type: 'select',
      label: 'Price Type',
      options: [
        { value: '', label: 'All' },
        { value: 'per_piece', label: 'Per Piece' },
        { value: 'per_bag', label: 'Per Bag' }
      ],
      value: filters.price_type
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
    },
    {
      type: 'number-range',
      keyFrom: 'min_purchase_price',
      keyTo: 'max_purchase_price',
      valueFrom: filters.min_purchase_price,
      valueTo: filters.max_purchase_price,
      placeholderFrom: 'Min Price',
      placeholderTo: 'Max Price',
      label: 'Purchase Price Range'
    },
    {
      key: 'shipping_code',
      type: 'text',
      label: 'Shipping Code',
      placeholder: 'Enter shipping code...',
      value: filters.shipping_code
    },
    {
      key: 'min_remaining_bags',
      type: 'number',
      label: 'Min Remaining Bags',
      placeholder: 'Min bags...',
      value: filters.min_remaining_bags
    }
  ];

  const sortConfig = [
    { value: 'product_name', label: 'Product Name (A-Z)' },
    { value: '-product_name', label: 'Product Name (Z-A)' },
    { value: '-purchase_date', label: 'Purchase Date (Newest)' },
    { value: 'purchase_date', label: 'Purchase Date (Oldest)' },
    { value: '-purchase_price', label: 'Purchase Price (High to Low)' },
    { value: 'purchase_price', label: 'Purchase Price (Low to High)' },
    { value: '-stock_value', label: 'Stock Value (High to Low)' },
    { value: 'stock_value', label: 'Stock Value (Low to High)' },
    { value: '-remaining_bags', label: 'Remaining Bags (High to Low)' },
    { value: 'remaining_bags', label: 'Remaining Bags (Low to High)' },
    { value: '-created_at', label: 'Recently Created' },
    { value: 'created_at', label: 'Oldest Created' }
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
          <h1 className="page-title">Inventory</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage stock levels, tracking, and valuation.</p>
        </div>
        <Button
          variant="primary"
          leftIcon="ri-bar-chart-box-line"
          onClick={() => navigate('/inventory-summary')}
        >
          View Summary
        </Button>
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={data?.results || []}
          isLoading={isLoading}
          keyField="id"

          searchPlaceholder="Search product, item code, shipping..."
          searchValue={search}
          onSearch={(v) => updateURLParams({ search: v, page: 1 })}

          filters={filterConfig}
          onFilterChange={handleFilterChange}

          sortOptions={sortConfig}
          activeSort={activeSort}
          onSortChange={(val) => updateURLParams({ ordering: val, page: 1 })}

          rowActions={rowActions}

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
