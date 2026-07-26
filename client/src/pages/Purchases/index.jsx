import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePurchases, useDeletePurchase } from '../../hooks/usePurchases.js';
import { purchaseService } from '../../services/purchaseService.js';
import { DataTable, Badge, Button, Modal } from '../../components/common/index.js';
import PurchaseEditForm from './PurchaseEditForm.jsx';
import { showToast } from '../../utils/toast.js';
import { formatCurrency } from '../../utils/formatters.js';
import { handleBackendErrors } from '../../utils/errorHandler.js';

export default function Purchases() {
  const navigate = useNavigate();
  const deleteMutation = useDeletePurchase();

  // Query state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeSort, setActiveSort] = useState('-date');
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState(null);

  // Filters state
  const [filters, setFilters] = useState({
    factory: '',
    has_unpaid: '',
    is_fully_editable: '',
    date_from: '',
    date_to: '',
    min_total: '',
    max_total: '',
    min_unpaid: ''
  });

  // Fetch data
  const queryParams = {
    page,
    search: search || undefined,
    ordering: activeSort || undefined,
    ...(filters.factory ? { factory: filters.factory } : {}),
    ...(filters.has_unpaid !== '' ? { has_unpaid: filters.has_unpaid } : {}),
    ...(filters.is_fully_editable !== '' ? { is_fully_editable: filters.is_fully_editable } : {}),
    ...(filters.date_from ? { date_from: filters.date_from } : {}),
    ...(filters.date_to ? { date_to: filters.date_to } : {}),
    ...(filters.min_total ? { min_total: filters.min_total } : {}),
    ...(filters.max_total ? { max_total: filters.max_total } : {}),
    ...(filters.min_unpaid ? { min_unpaid: filters.min_unpaid } : {})
  };

  const { data, isLoading } = usePurchases(queryParams);

  // DataTable Configuration
  const columns = [
    { key: 'factory_name', title: 'Factory', sortable: false },
    { key: 'date', title: 'Purchase Date', sortable: true, render: (val) => new Date(val).toLocaleDateString() },
    { key: 'shipping_code', title: 'Shipping Code', sortable: false },
    {
      key: 'total_purchase_amount',
      title: 'Total Amount',
      sortable: true,
      render: (val) => formatCurrency(val)
    },
    {
      key: 'unpaid_amount',
      title: 'Unpaid Amount',
      sortable: true,
      render: (val) => {
        const amt = parseFloat(val || 0);
        return amt > 0 ? <span style={{ color: '#ef4444', fontWeight: 500 }}>{formatCurrency(amt)}</span> : formatCurrency(0);
      }
    },
    {
      key: 'payment_status',
      title: 'Payment Status',
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
    if (!row.is_deletable) {
      showToast.error('Cannot Delete', 'This purchase has linked payments or is restricted.');
      return;
    }
    if (window.confirm(`Are you sure you want to delete this purchase?`)) {
      const toastId = showToast.loading('Deleting purchase...');
      deleteMutation.mutate(row.id, {
        onSuccess: () => {
          showToast.success('Deleted', 'Purchase deleted successfully');
          showToast.dismiss(toastId);
        },
        onError: (err) => {
          handleBackendErrors(err, null, 'Delete Failed');
          showToast.dismiss(toastId);
        }
      });
    }
  };

  const rowActions = [
    {
      icon: 'ri-eye-line',
      label: 'View',
      onClick: (row) => navigate(`/purchases/${row.id}`)
    },
    {
      icon: 'ri-edit-line',
      label: 'Edit',
      onClick: (row) => {
        setEditingPurchase(row);
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
      key: 'factory',
      type: 'async-select',
      label: 'Factory',
      placeholder: 'All Factories',
      value: filters.factory,
      loadOptions: async (query) => {
        // We use the raw service function to decouple from the React lifecycle here
        try {
          const res = await purchaseService.getFactoryOptions(query);
          // Backend returns standard {value, label} objects per the instructions
          return Array.isArray(res) ? res : (res.results || []);
        } catch (e) {
          console.error(e);
          return [];
        }
      }
    },
    {
      key: 'has_unpaid',
      placeholder: 'Payment Status',
      value: filters.has_unpaid,
      options: [
        { label: 'All Statuses', value: '' },
        { label: 'Has Unpaid', value: 'true' },
        { label: 'Fully Paid', value: 'false' }
      ]
    },
    {
      key: 'is_fully_editable',
      placeholder: 'Editable',
      value: filters.is_fully_editable,
      options: [
        { label: 'All', value: '' },
        { label: 'Fully Editable', value: 'true' },
        { label: 'Restricted', value: 'false' }
      ]
    },
    {
      type: 'date-range',
      keyFrom: 'date_from',
      keyTo: 'date_to',
      valueFrom: filters.date_from,
      valueTo: filters.date_to,
      placeholderFrom: 'From Date',
      placeholderTo: 'To Date'
    },
    {
      type: 'number-range',
      keyFrom: 'min_total',
      keyTo: 'max_total',
      valueFrom: filters.min_total,
      valueTo: filters.max_total,
      placeholderFrom: 'Min Total Amount',
      placeholderTo: 'Max Total Amount'
    },
    {
      type: 'number',
      key: 'min_unpaid',
      value: filters.min_unpaid,
      placeholder: 'Min Unpaid Amount'
    }
  ];

  const sortConfig = [
    { label: 'Date (Newest)', value: '-date' },
    { label: 'Date (Oldest)', value: 'date' },
    { label: 'Total Amount (Highest)', value: '-total_purchase_amount' },
    { label: 'Total Amount (Lowest)', value: 'total_purchase_amount' },
    { label: 'Unpaid Amount (Highest)', value: '-unpaid_amount' },
    { label: 'Created (Newest)', value: '-created_at' }
  ];

  // Handlers
  const handleSearch = (val) => {
    setSearch(val);
    setPage(1);
  };

  const handleFilterChange = (keyOrUpdates, val) => {
    if (typeof keyOrUpdates === 'object') {
      updateURLParams({ ...keyOrUpdates, page: 1 });
    } else {
      updateURLParams({ [keyOrUpdates]: val, page: 1 });
    }
  };

  const handleSortChange = (val) => {
    setActiveSort(val);
    setPage(1);
  };

  const handleNewPurchase = () => {
    navigate('/purchases/new');
  };

  // Pagination config
  const totalPages = data?.total_pages || 1;

  return (
    <div className="middle-class">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Purchases</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage inventory purchases and supplier invoices</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.results || []}
        isLoading={isLoading}

        searchPlaceholder="Search purchases..."
        searchValue={search}
        onSearch={handleSearch}

        filters={filterConfig}
        onFilterChange={handleFilterChange}

        sortOptions={sortConfig}
        activeSort={activeSort}
        onSortChange={handleSortChange}

        toolbarActions={
          <Button variant="primary" leftIcon="ri-add-line" onClick={handleNewPurchase}>
            Create Purchase
          </Button>
        }

        rowActions={rowActions}

        pagination={{
          currentPage: page,
          totalPages: totalPages,
          hasNext: !!data?.next,
          hasPrev: !!data?.previous,
          onPageChange: (newPage) => setPage(newPage)
        }}
      />

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Purchase (Partial)"
      >
        {editingPurchase && (
          <PurchaseEditForm
            initialData={editingPurchase}
            onCancel={() => setIsEditModalOpen(false)}
            onSuccess={() => setIsEditModalOpen(false)}
          />
        )}
      </Modal>
    </div>
  );
}
