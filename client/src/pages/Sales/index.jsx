import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSales, useDeleteSale } from '../../hooks/useSales.js';
import { saleService } from '../../services/saleService.js';
import { DataTable, Badge, Button, Card, Modal } from '../../components/common/index.js';
import { showToast } from '../../utils/toast.js';
import { formatCurrency } from '../../utils/formatters.js';
import SaleEditForm from './SaleEditForm.jsx';

export default function Sales() {
  const navigate = useNavigate();
  const deleteMutation = useDeleteSale();

  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);

  // URL state
  const [searchParams, setSearchParams] = useSearchParams();

  const page = parseInt(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const activeSort = searchParams.get('ordering') || '-date';

  const filters = {
    customer: searchParams.get('customer') || '',
    payment_type: searchParams.get('payment_type') || '',
    has_credit: searchParams.get('has_credit') || '',
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
    min_total: searchParams.get('min_total') || '',
    max_total: searchParams.get('max_total') || ''
  };

  // Fetch data
  const queryParams = {
    page,
    search: search || undefined,
    ordering: activeSort || undefined,
    ...(filters.customer ? { customer: filters.customer } : {}),
    ...(filters.payment_type ? { payment_type: filters.payment_type } : {}),
    ...(filters.has_credit !== '' ? { has_credit: filters.has_credit } : {}),
    ...(filters.date_from ? { date_from: filters.date_from } : {}),
    ...(filters.date_to ? { date_to: filters.date_to } : {}),
    ...(filters.min_total ? { min_total: filters.min_total } : {}),
    ...(filters.max_total ? { max_total: filters.max_total } : {})
  };

  const { data, isLoading } = useSales(queryParams);

  // DataTable Configuration
  const columns = [
    { key: 'invoice_number', title: 'Invoice Number', sortable: true },
    { key: 'customer_name', title: 'Customer Name', sortable: true },
    { key: 'date', title: 'Date', sortable: true, render: (val) => new Date(val).toLocaleDateString() },
    {
      key: 'total_sale_amount',
      title: 'Total Amount',
      sortable: true,
      render: (val) => formatCurrency(val)
    },
    {
      key: 'credit_amount',
      title: 'Credit Amount',
      sortable: true,
      render: (val) => {
        const amt = parseFloat(val || 0);
        return amt > 0 ? <span style={{ color: '#ef4444', fontWeight: 500 }}>{formatCurrency(amt)}</span> : formatCurrency(0);
      }
    },
    {
      key: 'payment_status',
      title: 'Payment Status',
      sortable: true,
      render: (val) => {
        const statusMap = {
          'Unpaid': 'danger',
          'Partial': 'warning',
          'Paid': 'success'
        };
        return <Badge variant={statusMap[val] || 'default'}>{val}</Badge>;
      }
    }
  ];

  const handleDelete = (row) => {
    // Delete logic disabled as per instructions
    console.log('Delete placeholder for', row.id);
  };

  const rowActions = [
    {
      icon: 'ri-eye-line',
      label: 'View',
      onClick: (row) => navigate(`/sales/${row.id}`)
    },
    {
      icon: 'ri-edit-line',
      label: 'Edit',
      onClick: (row) => {
        setEditingSale(row);
        setIsEditModalOpen(true);
      }
    },
    {
      icon: 'ri-delete-bin-line',
      label: 'Delete',
      variant: 'danger',
      onClick: handleDelete
    }
  ];

  const filterConfig = [
    {
      key: 'customer',
      type: 'async-select',
      label: 'Customer',
      placeholder: 'All Customers',
      value: filters.customer,
      loadOptions: async (query) => {
        try {
          const res = await saleService.getCustomerOptions(query);
          return Array.isArray(res) ? res : (res.results || []);
        } catch (e) {
          console.error(e);
          return [];
        }
      }
    },
    {
      key: 'payment_type',
      type: 'select',
      label: 'Payment Type',
      options: [
        { value: '', label: 'All' },
        { value: 'cash', label: 'Cash' },
        { value: 'partial', label: 'Partial' },
        { value: 'credit', label: 'Credit' }
      ],
      value: filters.payment_type
    },
    {
      key: 'has_credit',
      type: 'select',
      label: 'Has Credit',
      options: [
        { value: '', label: 'All' },
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' }
      ],
      value: filters.has_credit
    },
    {
      key: 'date_from',
      type: 'date',
      label: 'From Date',
      value: filters.date_from
    },
    {
      key: 'date_to',
      type: 'date',
      label: 'To Date',
      value: filters.date_to
    },
    {
      key: 'min_total',
      type: 'number',
      label: 'Min Total',
      placeholder: 'Min Total Amount',
      value: filters.min_total
    },
    {
      key: 'max_total',
      type: 'number',
      label: 'Max Total',
      placeholder: 'Max Total Amount',
      value: filters.max_total
    }
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

  const clearFilters = () => {
    setSearchParams({}, { replace: true });
  };

  const sortConfig = [
    { value: '-date', label: 'Sale Date (Newest)' },
    { value: 'date', label: 'Sale Date (Oldest)' },
    { value: '-total_sale_amount', label: 'Total Amount (High to Low)' },
    { value: 'total_sale_amount', label: 'Total Amount (Low to High)' },
    { value: '-credit_amount', label: 'Credit Amount (High to Low)' },
    { value: 'credit_amount', label: 'Credit Amount (Low to High)' },
    { value: '-created_at', label: 'Recently Created' },
    { value: 'created_at', label: 'Oldest Created' }
  ];

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <h1 className="page-title">Sales</h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage customer sales, invoices, and payments.</p>
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={data?.results || []}
          isLoading={isLoading}
          keyField="id"

          // Search props
          searchPlaceholder="Search invoices or customers..."
          searchValue={search}
          onSearch={(v) => updateURLParams({ search: v, page: 1 })}

          // Filter props
          filters={filterConfig}
          onFilterChange={handleFilterChange}

          // Sort props
          sortOptions={sortConfig}
          activeSort={activeSort}
          onSortChange={(val) => updateURLParams({ ordering: val, page: 1 })}

          // Toolbar Actions
          toolbarActions={
            <Button
              variant="primary"
              leftIcon="ri-add-line"
              onClick={() => navigate('/sales/new')}
            >
              New Sale
            </Button>
          }

          // Row Actions
          rowActions={rowActions}

          // Pagination
          pagination={{
            currentPage: page,
            totalPages: data?.total_pages || 1,
            hasNext: !!data?.next,
            hasPrev: !!data?.previous,
            onPageChange: (newPage) => updateURLParams({ page: newPage })
          }}
        />
      </Card>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Sale (Partial)"
      >
        {editingSale && (
          <SaleEditForm
            initialData={editingSale}
            onCancel={() => setIsEditModalOpen(false)}
            onSuccess={() => setIsEditModalOpen(false)}
          />
        )}
      </Modal>
    </div>
  );
}
