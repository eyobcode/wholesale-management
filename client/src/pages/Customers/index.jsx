import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCustomers } from '../../services/customerService.js';
import { DataTable, Badge, Button, Card, Modal, PaymentForm } from '../../components/common/index.js';
import { showToast } from '../../utils/toast.js';
import { formatCurrency } from '../../utils/formatters.js';
import CustomerForm from './CustomerForm.jsx';

export default function Customers() {
  const navigate = useNavigate();
  // Query state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeSort, setActiveSort] = useState('name');

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [paymentCustomer, setPaymentCustomer] = useState(null);

  // Filters state
  const [filters, setFilters] = useState({
    is_active: 'true',
    has_debt: ''
  });

  // Fetch data
  const queryParams = {
    page,
    search: search || undefined,
    ordering: activeSort || undefined,
    ...(filters.is_active !== '' ? { is_active: filters.is_active } : {}),
    ...(filters.has_debt !== '' ? { has_debt: filters.has_debt } : {})
  };

  const { data, isLoading } = useCustomers(queryParams);

  // DataTable Configuration
  const columns = [
    { key: 'name', title: 'Name', sortable: true },
    { key: 'phone', title: 'Phone' },
    { key: 'location', title: 'Location' },
    {
      key: 'current_balance',
      title: 'Balance Status',
      render: (_, row) => {
        const balance = parseFloat(row.current_balance || 0);
        const currency = row.initial_credit_currency || 'ETB';

        if (balance > 0) return <Badge variant="danger">Owes {formatCurrency(balance, currency)}</Badge>;
        if (balance < 0) return <Badge variant="success">You Owe {formatCurrency(Math.abs(balance), currency)}</Badge>;
        return <Badge variant="default">Settled</Badge>;
      }
    },
    {
      key: 'is_active',
      title: 'Status',
      render: (isActive) => (
        console.log(isActive),
        <Badge variant={isActive ? "success" : "warning"}>
          {isActive ? 'Active' : 'Archived'}
        </Badge>
      )
    }
  ];

  const rowActions = [
    {
      icon: 'ri-eye-line',
      label: 'View',
      onClick: (row) => navigate(`/customers/${row.id}`)
    },
    {
      icon: 'ri-money-dollar-circle-line',
      label: 'Record Payment',
      onClick: (row) => setPaymentCustomer(row),
      variant: 'primary'
    }
  ];

  const filterConfig = [
    {
      key: 'is_active',
      placeholder: 'Status',
      value: filters.is_active,
      options: [
        { label: 'All Statuses', value: '' },
        { label: 'Active', value: 'true' },
        { label: 'Archived', value: 'false' }
      ]
    },
    {
      key: 'has_debt',
      placeholder: 'Debt Status',
      value: filters.has_debt,
      options: [
        { label: 'All Balances', value: '' },
        { label: 'Has Debt', value: 'true' },
        { label: 'Settled', value: 'false' }
      ]
    }
  ];

  const sortConfig = [
    { label: 'Name (A-Z)', value: 'name' },
    { label: 'Name (Z-A)', value: '-name' },
    { label: 'Newest First', value: '-opening_date' },
    { label: 'Oldest First', value: 'opening_date' },
    { label: 'Credit (Highest)', value: '-initial_credit' },
    { label: 'Credit (Lowest)', value: 'initial_credit' },
    { label: 'Recently Added', value: '-created_at' }
  ];

  // Handlers
  const handleSearch = (val) => {
    setSearch(val);
    setPage(1); // Reset to page 1 on new search
  };

  const handleFilterChange = (keyOrUpdates, val) => {
    if (typeof keyOrUpdates === 'object') {
      setFilters(prev => ({ ...prev, ...keyOrUpdates }));
    } else {
      setFilters(prev => ({ ...prev, [keyOrUpdates]: val }));
    }
    setPage(1); // Reset to page 1 on filter change
  };

  const handleSortChange = (val) => {
    setActiveSort(val);
    setPage(1);
  };

  const handleNewCustomer = () => {
    setIsCreateModalOpen(true);
  };

  // Pagination config
  // DRF returns { count, next, previous, results } by default using StandardPagination
  const totalPages = data?.total_pages || 1;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" >Customers</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage your wholesale clients and view their balances.</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.results || []}
        isLoading={isLoading}
        emptyMessage="No customers found matching your criteria."

        searchPlaceholder="Search by name, phone..."
        searchValue={search}
        onSearch={handleSearch}

        filters={filterConfig}
        onFilterChange={handleFilterChange}

        sortOptions={sortConfig}
        activeSort={activeSort}
        onSortChange={handleSortChange}

        toolbarActions={
          <Button variant="primary" leftIcon="ri-add-line" onClick={handleNewCustomer}>
            New Customer
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
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="New Customer"
      >
        <CustomerForm
          onCancel={() => setIsCreateModalOpen(false)}
          onSuccess={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={!!paymentCustomer}
        onClose={() => setPaymentCustomer(null)}
        title={paymentCustomer ? `Record Payment for ${paymentCustomer.name}` : 'Record Payment'}
      >
        {paymentCustomer && (
          <PaymentForm
            entityIdKey="customer"
            entityId={paymentCustomer.id}
            onCancel={() => setPaymentCustomer(null)}
            onSuccess={() => setPaymentCustomer(null)}
          />
        )}
      </Modal>
    </div>
  );
}
