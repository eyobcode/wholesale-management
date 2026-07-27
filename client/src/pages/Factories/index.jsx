import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFactories } from '../../services/factoryService.js';
import { DataTable, Badge, Button, Modal, PaymentForm } from '../../components/common/index.js';
import { showToast } from '../../utils/toast.js';
import { formatCurrency } from '../../utils/formatters.js';
import FactoryForm from './FactoryForm.jsx';

export default function Factories() {
  const navigate = useNavigate();
  // Query state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeSort, setActiveSort] = useState('name');

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [paymentFactory, setPaymentFactory] = useState(null);

  // Filters state
  const [filters, setFilters] = useState({
    is_active: 'true',
    has_balance: ''
  });

  // Fetch data
  const queryParams = {
    page,
    search: search || undefined,
    ordering: activeSort || undefined,
    ...(filters.is_active !== '' ? { is_active: filters.is_active } : {}),
    ...(filters.has_balance !== '' ? { has_balance: filters.has_balance } : {})
  };

  const { data, isLoading } = useFactories(queryParams);

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
        const currency = row.initial_balance_currency || 'ETB';

        // Positive means we owe them (Danger). Negative means they owe us (Success).
        if (balance > 0) return <Badge variant="danger">You Owe {formatCurrency(balance, currency)}</Badge>;
        if (balance < 0) return <Badge variant="success">They Owe {formatCurrency(Math.abs(balance), currency)}</Badge>;
        return <Badge variant="default">Settled</Badge>;
      }
    },
    {
      key: 'is_active',
      title: 'Status',
      render: (val) => {
        const isActive = val === true || val === 'true';
        return (
          <Badge variant={isActive ? "success" : "warning"}>
            {isActive ? 'Active' : 'Archived'}
          </Badge>
        );
      }
    }
  ];

  const rowActions = [
    {
      icon: 'ri-eye-line',
      label: 'View',
      onClick: (row) => navigate(`/factories/${row.id}`)
    },
    {
      icon: 'ri-money-dollar-circle-line',
      label: 'Record Payment',
      onClick: (row) => setPaymentFactory(row),
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
      key: 'has_balance',
      placeholder: 'Balance Status',
      value: filters.has_balance,
      options: [
        { label: 'All Balances', value: '' },
        { label: 'Has Balance', value: 'true' },
        { label: 'Settled', value: 'false' }
      ]
    }
  ];

  const sortConfig = [
    { label: 'Name', value: 'name' },
    { label: 'Initial Balance', value: 'initial_balance' },
    { label: 'Created Date', value: 'created_at' }
  ];

  // Handlers
  const handleSearch = (val) => {
    setSearch(val);
    setPage(1);
  };

  const handleFilterChange = (key, val) => {
    setFilters(prev => ({ ...prev, [key]: val }));
    setPage(1);
  };

  const handleSortChange = (val) => {
    setActiveSort(val);
    setPage(1);
  };

  const handleNewFactory = () => {
    setIsCreateModalOpen(true);
  };

  // Pagination config
  const totalPages = data?.total_pages || 1;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Factories</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage suppliers and factories</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.results || []}
        isLoading={isLoading}

        searchPlaceholder="Search by name, phone..."
        searchValue={search}
        onSearch={handleSearch}

        filters={filterConfig}
        onFilterChange={handleFilterChange}

        sortOptions={sortConfig}
        activeSort={activeSort}
        onSortChange={handleSortChange}

        toolbarActions={
          <Button variant="primary" leftIcon="ri-add-line" onClick={handleNewFactory}>
            New Factory
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
        title="New Factory"
      >
        <FactoryForm
          onCancel={() => setIsCreateModalOpen(false)}
          onSuccess={() => setIsCreateModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={!!paymentFactory}
        onClose={() => setPaymentFactory(null)}
        title={paymentFactory ? `Record Payment for ${paymentFactory.name}` : 'Record Payment'}
      >
        {paymentFactory && (
          <PaymentForm
            entityIdKey="factory"
            entityId={paymentFactory.id}
            onCancel={() => setPaymentFactory(null)}
            onSuccess={() => setPaymentFactory(null)}
          />
        )}
      </Modal>
    </div>
  );
}
