import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useIncome, useDeleteIncome } from '../../hooks/useIncome.js';
import { useFactoryPayments, useDeleteFactoryPayment } from '../../hooks/useFactoryPayments.js';
import { incomeService } from '../../services/incomeService.js';
import { factoryService } from '../../services/factoryService.js';
import { DataTable, Card, Button, ConfirmationDialog } from '../../components/common/index.js';
import { showToast } from '../../utils/toast.js';
import { handleBackendErrors } from '../../utils/errorHandler.js';
import { IncomeEditModal } from './IncomeEditModal.jsx';
import { IncomeCreateModal } from './IncomeCreateModal.jsx';
import { FactoryPaymentEditModal } from './FactoryPaymentEditModal.jsx';
import { FactoryPaymentCreateModal } from './FactoryPaymentCreateModal.jsx';
import { customerService } from '../../services/customerService.js';

export default function Payments() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('income'); // 'income' or 'factory'

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedIncome, setSelectedIncome] = useState(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [incomeToDelete, setIncomeToDelete] = useState(null);

  // Factory payments state
  const [isFactoryDeleteDialogOpen, setIsFactoryDeleteDialogOpen] = useState(false);
  const [factoryPaymentToDelete, setFactoryPaymentToDelete] = useState(null);

  const [isFactoryEditModalOpen, setIsFactoryEditModalOpen] = useState(false);
  const [factoryPaymentToEdit, setFactoryPaymentToEdit] = useState(null);

  const [isFactoryCreateModalOpen, setIsFactoryCreateModalOpen] = useState(false);

  const deleteIncomeMutation = useDeleteIncome();
  const deleteFactoryPaymentMutation = useDeleteFactoryPayment();

  const page = parseInt(searchParams.get('page')) || 1;
  const search = searchParams.get('search') || '';
  const activeSort = searchParams.get('ordering') || '-date';

  // --- Income filters ---
  const filters = {
    customer: searchParams.get('customer') || '',
    payment_method: searchParams.get('payment_method') || '',
    has_sale: searchParams.get('has_sale') || '',
    is_auto: searchParams.get('is_auto') || '',
    receipt_number: searchParams.get('receipt_number') || '',
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
    min_amount: searchParams.get('min_amount') || '',
    max_amount: searchParams.get('max_amount') || '',
  };

  const queryParams = {
    page,
    search: search || undefined,
    ordering: activeSort || undefined,
    ...(filters.customer ? { customer: filters.customer } : {}),
    ...(filters.payment_method ? { payment_method: filters.payment_method } : {}),
    ...(filters.has_sale ? { has_sale: filters.has_sale } : {}),
    ...(filters.is_auto ? { is_auto: filters.is_auto } : {}),
    ...(filters.receipt_number ? { receipt_number: filters.receipt_number } : {}),
    ...(filters.date_from ? { date_from: filters.date_from } : {}),
    ...(filters.date_to ? { date_to: filters.date_to } : {}),
    ...(filters.min_amount ? { min_amount: filters.min_amount } : {}),
    ...(filters.max_amount ? { max_amount: filters.max_amount } : {}),
  };

  // --- Factory payment filters ---
  const factoryFilters = {
    factory: searchParams.get('factory') || '',
    payment_method: searchParams.get('payment_method') || '',
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
    min_amount: searchParams.get('min_amount') || '',
    max_amount: searchParams.get('max_amount') || '',
    is_auto: searchParams.get('is_auto') || '',
    has_purchase: searchParams.get('has_purchase') || '',
    currency: searchParams.get('currency') || '',
    payment_number: searchParams.get('payment_number') || '',
  };

  const factoryQueryParams = {
    page,
    search: search || undefined,
    ordering: activeSort || undefined,
    ...(factoryFilters.factory ? { factory: factoryFilters.factory } : {}),
    ...(factoryFilters.payment_method ? { payment_method: factoryFilters.payment_method } : {}),
    ...(factoryFilters.date_from ? { date_from: factoryFilters.date_from } : {}),
    ...(factoryFilters.date_to ? { date_to: factoryFilters.date_to } : {}),
    ...(factoryFilters.min_amount ? { min_amount: factoryFilters.min_amount } : {}),
    ...(factoryFilters.max_amount ? { max_amount: factoryFilters.max_amount } : {}),
    ...(factoryFilters.is_auto ? { is_auto: factoryFilters.is_auto } : {}),
    ...(factoryFilters.has_purchase ? { has_purchase: factoryFilters.has_purchase } : {}),
    ...(factoryFilters.currency ? { currency: factoryFilters.currency } : {}),
    ...(factoryFilters.payment_number ? { payment_number: factoryFilters.payment_number } : {}),
  };

  const { data: incomeData, isLoading: isIncomeLoading } = useIncome(queryParams);
  const { data: factoryPaymentsData, isLoading: isFactoryLoading } = useFactoryPayments(
    activeTab === 'factory' ? factoryQueryParams : { page: 1 }
  );

  const formatCurrency = (val, currency = 'ETB') => {
    if (val === undefined || val === null) return '-';
    return `${parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  };

  const formatPaymentMethod = (method) => {
    if (!method) return '-';
    const methodMap = {
      'cash': 'Cash',
      'telebirr': 'Telebirr',
      'cbe': 'CBE',
      'cbe_birr': 'CBE Birr',
      'awash': 'Awash Bank',
      'dashen': 'Dashen Bank',
      'abyssinia': 'Bank of Abyssinia',
      'boa': 'Bank of Abyssinia',
      'coop': 'Coop Bank',
      'nib': 'Nib Bank',
      'wegagen': 'Wegagen Bank',
      'zemen': 'Zemen Bank',
      'oromia': 'Oromia Bank',
      'hibret': 'Hibret Bank',
      'amhara': 'Amhara Bank'
    };
    return methodMap[method.toLowerCase()] || method.charAt(0).toUpperCase() + method.slice(1);
  };

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

  const handleFilterChange = (key, val) => {
    updateURLParams({ [key]: val, page: 1 });
  };

  const incomeColumns = [
    { key: 'receipt_number', title: 'Receipt Number', sortable: true },
    { key: 'customer_name', title: 'Customer', sortable: false },
    {
      key: 'sale_invoice',
      title: 'Sale Invoice',
      sortable: false,
      render: (val) => val ? val : '-'
    },
    {
      key: 'date',
      title: 'Payment Date',
      sortable: true,
      render: (val) => val ? new Date(val).toLocaleDateString() : '-'
    },
    {
      key: 'paid_amount',
      title: 'Paid Amount',
      sortable: true,
      render: (_, row) => formatCurrency(row.paid_amount, row.currency)
    },
    {
      key: 'payment_method',
      title: 'Payment Method',
      sortable: false,
      render: (val) => formatPaymentMethod(val)
    }
  ];

  const incomeRowActions = [
    {
      icon: 'ri-eye-line',
      label: 'View',
      onClick: (row) => navigate(`/payments/income/${row.id}`)
    },
    {
      icon: 'ri-pencil-line',
      label: 'Edit',
      onClick: (row) => {
        setSelectedIncome(row);
        setIsEditModalOpen(true);
      }
    },
    {
      icon: 'ri-delete-bin-line',
      label: 'Delete',
      variant: 'danger',
      onClick: (row) => {
        setIncomeToDelete(row);
        setIsDeleteDialogOpen(true);
      }
    }
  ];

  const incomeFilterConfig = [
    {
      key: 'customer',
      type: 'async-select',
      label: 'Customer',
      placeholder: 'All Customers',
      value: filters.customer,
      loadOptions: async (query) => {
        try {
          const res = await customerService.getCustomerOptions(query);
          return Array.isArray(res) ? res : (res.results || []);
        } catch (e) {
          console.error(e);
          return [];
        }
      }
    },
    {
      key: 'payment_method',
      type: 'async-select',
      label: 'Payment Method',
      placeholder: 'All Methods',
      value: filters.payment_method,
      loadOptions: async () => {
        try {
          const res = await incomeService.getPaymentMethodOptions();
          return Array.isArray(res) ? res : (res.results || []);
        } catch (e) {
          console.error(e);
          return [];
        }
      }
    },
    {
      type: 'date-range',
      keyFrom: 'date_from',
      keyTo: 'date_to',
      valueFrom: filters.date_from,
      valueTo: filters.date_to,
      placeholderFrom: 'From Date',
      placeholderTo: 'To Date',
      label: 'Date Range'
    },
    {
      key: 'has_sale',
      type: 'select',
      label: 'Payment Source',
      options: [
        { value: '', label: 'All' },
        { value: 'true', label: 'Automatic (Created from Sale)' },
        { value: 'false', label: 'Manual' }
      ],
      value: filters.has_sale
    },
    {
      key: 'is_auto',
      type: 'select',
      label: 'Auto Generated',
      options: [
        { value: '', label: 'All' },
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' }
      ],
      value: filters.is_auto
    },
    {
      key: 'receipt_number',
      type: 'text',
      label: 'Receipt Number',
      placeholder: 'RCP-2026...',
      value: filters.receipt_number
    },
    {
      type: 'number-range',
      keyFrom: 'min_amount',
      keyTo: 'max_amount',
      valueFrom: filters.min_amount,
      valueTo: filters.max_amount,
      placeholderFrom: 'Min Amount',
      placeholderTo: 'Max Amount',
      label: 'Amount Range'
    }
  ];

  const incomeSortConfig = [
    { value: '-date', label: 'Payment Date (Newest)' },
    { value: 'date', label: 'Payment Date (Oldest)' },
    { value: '-paid_amount', label: 'Paid Amount (Highest)' },
    { value: 'paid_amount', label: 'Paid Amount (Lowest)' },
    { value: '-created_at', label: 'Created At (Newest)' },
    { value: 'created_at', label: 'Created At (Oldest)' }
  ];

  const renderIncomeTable = () => (
    <Card>
      <DataTable
        columns={incomeColumns}
        data={incomeData?.results || []}
        isLoading={isIncomeLoading}
        keyField="id"

        searchPlaceholder="Search receipt, customer, notes..."
        searchValue={search}
        onSearch={(v) => updateURLParams({ search: v, page: 1 })}

        filters={incomeFilterConfig}
        onFilterChange={handleFilterChange}

        sortOptions={incomeSortConfig}
        activeSort={activeSort}
        onSortChange={(val) => updateURLParams({ ordering: val, page: 1 })}

        rowActions={incomeRowActions}
        toolbarActions={
          <Button variant="primary" leftIcon="ri-add-line" onClick={() => setIsCreateModalOpen(true)}>
            Record Payment
          </Button>
        }

        pagination={{
          currentPage: page,
          totalPages: incomeData?.total_pages || 1,
          hasNext: !!incomeData?.next,
          hasPrev: !!incomeData?.previous,
          onPageChange: (newPage) => updateURLParams({ page: newPage })
        }}
      />
    </Card>
  );

  // --- Factory Payments columns, actions, filters, sort ---
  const factoryColumns = [
    { key: 'payment_number', title: 'Payment Number', sortable: true },
    { key: 'factory_name', title: 'Factory', sortable: false },
    {
      key: 'purchase_shipping_code',
      title: 'Purchase',
      sortable: false,
      render: (val) => val ? val : '-'
    },
    {
      key: 'date',
      title: 'Payment Date',
      sortable: true,
      render: (val) => val ? new Date(val).toLocaleDateString() : '-'
    },
    {
      key: 'paid_amount',
      title: 'Paid Amount',
      sortable: true,
      render: (_, row) => formatCurrency(row.paid_amount, row.currency)
    },
    {
      key: 'payment_method',
      title: 'Payment Method',
      sortable: false,
      render: (val) => formatPaymentMethod(val)
    }
  ];

  const factoryRowActions = [
    {
      icon: 'ri-eye-line',
      label: 'View',
      onClick: (row) => navigate(`/payments/factory/${row.id}`)
    },
    {
      icon: 'ri-pencil-line',
      label: 'Edit',
      onClick: (row) => {
        setFactoryPaymentToEdit(row);
        setIsFactoryEditModalOpen(true);
      }
    },
    {
      icon: 'ri-delete-bin-line',
      label: 'Delete',
      variant: 'danger',
      onClick: (row) => {
        setFactoryPaymentToDelete(row);
        setIsFactoryDeleteDialogOpen(true);
      }
    }
  ];

  const factoryFilterConfig = [
    // First 3 shown inline, rest go to Advanced Filters modal
    {
      key: 'factory',
      type: 'async-select',
      label: 'Factory',
      placeholder: 'All Factories',
      value: factoryFilters.factory,
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
      key: 'payment_method',
      type: 'async-select',
      label: 'Payment Method',
      placeholder: 'All Methods',
      value: factoryFilters.payment_method,
      loadOptions: async () => {
        try {
          const res = await incomeService.getPaymentMethodOptions();
          return Array.isArray(res) ? res : (res.results || []);
        } catch (e) {
          console.error(e);
          return [];
        }
      }
    },
    {
      type: 'date-range',
      keyFrom: 'date_from',
      keyTo: 'date_to',
      valueFrom: factoryFilters.date_from,
      valueTo: factoryFilters.date_to,
      placeholderFrom: 'From Date',
      placeholderTo: 'To Date',
      label: 'Date Range'
    },
    // — Advanced Filters below (goes into modal since > 3 total) —
    {
      key: 'is_auto',
      type: 'select',
      label: 'Auto Payment',
      value: factoryFilters.is_auto,
      options: [
        { value: '', label: 'All' },
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' }
      ]
    },
    {
      key: 'has_purchase',
      type: 'select',
      label: 'Linked To Purchase',
      value: factoryFilters.has_purchase,
      options: [
        { value: '', label: 'All' },
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' }
      ]
    },
    {
      key: 'currency',
      type: 'select',
      label: 'Currency',
      value: factoryFilters.currency,
      options: [
        { value: '', label: 'All Currencies' },
        { value: 'ETB', label: 'ETB' },
        { value: 'USD', label: 'USD' }
      ]
    },
    {
      key: 'payment_number',
      type: 'text',
      label: 'Payment Number',
      placeholder: 'PAY-2024...',
      value: factoryFilters.payment_number
    },
    {
      type: 'number-range',
      keyFrom: 'min_amount',
      keyTo: 'max_amount',
      valueFrom: factoryFilters.min_amount,
      valueTo: factoryFilters.max_amount,
      placeholderFrom: 'Min Amount',
      placeholderTo: 'Max Amount',
      label: 'Amount Range'
    }
  ];

  const factorySortConfig = [
    { value: '-date', label: 'Payment Date (Newest)' },
    { value: 'date', label: 'Payment Date (Oldest)' },
    { value: '-paid_amount', label: 'Paid Amount (Highest)' },
    { value: 'paid_amount', label: 'Paid Amount (Lowest)' },
    { value: '-created_at', label: 'Created At (Newest)' },
    { value: 'created_at', label: 'Created At (Oldest)' }
  ];

  const renderFactoryPaymentsTable = () => (
    <Card>
      <DataTable
        columns={factoryColumns}
        data={factoryPaymentsData?.results || []}
        isLoading={isFactoryLoading}
        keyField="id"

        searchPlaceholder="Search payment number, factory..."
        searchValue={search}
        onSearch={(v) => updateURLParams({ search: v, page: 1 })}

        filters={factoryFilterConfig}
        onFilterChange={handleFilterChange}

        sortOptions={factorySortConfig}
        activeSort={activeSort}
        onSortChange={(val) => updateURLParams({ ordering: val, page: 1 })}

        rowActions={factoryRowActions}
        toolbarActions={
          <Button variant="primary" leftIcon="ri-add-line" onClick={() => setIsFactoryCreateModalOpen(true)}>
            Record Payment
          </Button>
        }

        pagination={{
          currentPage: page,
          totalPages: factoryPaymentsData?.total_pages || 1,
          hasNext: !!factoryPaymentsData?.next,
          hasPrev: !!factoryPaymentsData?.previous,
          onPageChange: (newPage) => updateURLParams({ page: newPage })
        }}
      />
    </Card>
  );

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Payments</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage incoming customer payments and outgoing factory payments.</p>
        </div>
        <div className="page-actions">
          {/* Add buttons here if needed */}
        </div>
      </div>

      {/* Segmented Switch */}
      <div className="segmented-control" style={{ marginBottom: '24px' }}>
        <button
          className={`segmented-tab ${activeTab === 'income' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('income');
            setSearchParams(new URLSearchParams()); // Clear URL params when switching tabs
          }}
        >
          <i className="ri-wallet-3-line" style={{ marginRight: '8px' }}></i>
          Customer Income
        </button>
        <button
          className={`segmented-tab ${activeTab === 'factory' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('factory');
            setSearchParams(new URLSearchParams()); // Clear URL params when switching tabs
          }}
        >
          <i className="ri-building-4-line" style={{ marginRight: '8px' }}></i>
          Factory Payments
        </button>
      </div>

      {activeTab === 'income' ? renderIncomeTable() : renderFactoryPaymentsTable()}

      <IncomeEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedIncome(null);
        }}
        income={selectedIncome}
      />

      <IncomeCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        title="Delete Payment"
        message={`Are you sure you want to delete payment ${incomeToDelete?.receipt_number || ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger={true}
        isConfirming={deleteIncomeMutation.isPending}
        onConfirm={() => {
          const toastId = showToast.loading('Deleting payment...');
          deleteIncomeMutation.mutate(incomeToDelete.id, {
            onSuccess: () => {
              showToast.dismiss(toastId);
              showToast.success('Payment deleted successfully');
              setIsDeleteDialogOpen(false);
              setIncomeToDelete(null);
            },
            onError: (err) => {
              showToast.dismiss(toastId);
              handleBackendErrors(err, null, 'Failed to delete payment');
              setIsDeleteDialogOpen(false);
            }
          });
        }}
        onClose={() => {
          if (!deleteIncomeMutation.isPending) {
            setIsDeleteDialogOpen(false);
            setIncomeToDelete(null);
          }
        }}
      />
      {/* Factory Payment Edit Modal */}
      <FactoryPaymentEditModal
        isOpen={isFactoryEditModalOpen}
        onClose={() => {
          setIsFactoryEditModalOpen(false);
          setFactoryPaymentToEdit(null);
        }}
        payment={factoryPaymentToEdit}
      />
      {/* Factory Payment Create Modal */}
      <FactoryPaymentCreateModal
        isOpen={isFactoryCreateModalOpen}
        onClose={() => setIsFactoryCreateModalOpen(false)}
      />
      {/* Factory Payment Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isFactoryDeleteDialogOpen}
        title="Delete Factory Payment"
        message={`Are you sure you want to delete payment ${factoryPaymentToDelete?.payment_number || ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger={true}
        isConfirming={deleteFactoryPaymentMutation.isPending}
        onConfirm={() => {
          const toastId = showToast.loading('Deleting factory payment...');
          deleteFactoryPaymentMutation.mutate(factoryPaymentToDelete.id, {
            onSuccess: () => {
              showToast.dismiss(toastId);
              showToast.success('Factory payment deleted successfully');
              setIsFactoryDeleteDialogOpen(false);
              setFactoryPaymentToDelete(null);
            },
            onError: (err) => {
              showToast.dismiss(toastId);
              handleBackendErrors(err, null, 'Failed to delete factory payment');
              setIsFactoryDeleteDialogOpen(false);
            }
          });
        }}
        onClose={() => {
          if (!deleteFactoryPaymentMutation.isPending) {
            setIsFactoryDeleteDialogOpen(false);
            setFactoryPaymentToDelete(null);
          }
        }}
      />
    </div>
  );
}
