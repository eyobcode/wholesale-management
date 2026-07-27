import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useExpenses, useDeleteExpense } from '../../hooks/useExpenses.js';
import { DataTable, Card, Button, ConfirmationDialog, Badge } from '../../components/common/index.js';
import { showToast } from '../../utils/toast.js';
import { handleBackendErrors } from '../../utils/errorHandler.js';
import { incomeService } from '../../services/incomeService.js';
import { ExpenseEditModal } from './ExpenseEditModal.jsx';
import { ExpenseCreateModal } from './ExpenseCreateModal.jsx';

export default function Expenses() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Parse URL state
  const page = parseInt(searchParams.get('page') || '1', 10);
  const search = searchParams.get('search') || '';
  const activeSort = searchParams.get('ordering') || '-date';

  // Filters state from URL
  const filters = {
    payment_method: searchParams.get('payment_method') || '',
    date_from: searchParams.get('date_from') || '',
    date_to: searchParams.get('date_to') || '',
    min_amount: searchParams.get('min_amount') || '',
    max_amount: searchParams.get('max_amount') || '',
    currency: searchParams.get('currency') || '',
    description: searchParams.get('description') || '',
    expense_number: searchParams.get('expense_number') || '',
  };

  // UI state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [expenseToEdit, setExpenseToEdit] = useState(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const deleteExpenseMutation = useDeleteExpense();

  // Helper to sync state to URL
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

  // Fetch data
  const queryParams = {
    page,
    search: search || undefined,
    ordering: activeSort || undefined,
    ...(filters.payment_method ? { payment_method: filters.payment_method } : {}),
    ...(filters.date_from ? { date_from: filters.date_from } : {}),
    ...(filters.date_to ? { date_to: filters.date_to } : {}),
    ...(filters.min_amount ? { min_amount: filters.min_amount } : {}),
    ...(filters.max_amount ? { max_amount: filters.max_amount } : {}),
    ...(filters.currency ? { currency: filters.currency } : {}),
    ...(filters.description ? { description: filters.description } : {}),
    ...(filters.expense_number ? { expense_number: filters.expense_number } : {}),
  };

  const { data, isLoading } = useExpenses(queryParams);

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

  // DataTable Configuration
  const columns = [
    { key: 'expense_number', title: 'Expense Number', sortable: true },
    {
      key: 'date',
      title: 'Date',
      sortable: true,
      render: (val) => val ? new Date(val).toLocaleDateString() : '-'
    },
    { key: 'description', title: 'Description', sortable: false },
    {
      key: 'amount',
      title: 'Amount',
      sortable: true,
      render: (_, row) => formatCurrency(row.amount, row.currency)
    },
    {
      key: 'payment_method',
      title: 'Payment Method',
      sortable: false,
      render: (val) => formatPaymentMethod(val)
    }
  ];

  const rowActions = [
    {
      icon: 'ri-eye-line',
      label: 'View',
      onClick: (row) => navigate(`/expenses/${row.id}`)
    },
    {
      icon: 'ri-pencil-line',
      label: 'Edit',
      onClick: (row) => {
        setExpenseToEdit(row);
        setIsEditModalOpen(true);
      }
    },
    {
      icon: 'ri-delete-bin-line',
      label: 'Delete',
      variant: 'danger',
      onClick: (row) => {
        setExpenseToDelete(row);
        setIsDeleteDialogOpen(true);
      }
    }
  ];

  const filterConfig = [
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
      type: 'number-range',
      keyFrom: 'min_amount',
      keyTo: 'max_amount',
      valueFrom: filters.min_amount,
      valueTo: filters.max_amount,
      placeholderFrom: 'Min Amount',
      placeholderTo: 'Max Amount',
      label: 'Amount Range'
    },
    {
      key: 'currency',
      type: 'select',
      label: 'Currency',
      value: filters.currency,
      options: [
        { value: '', label: 'All Currencies' },
        { value: 'ETB', label: 'ETB' },
        { value: 'USD', label: 'USD' }
      ]
    },
    {
      key: 'description',
      type: 'text',
      label: 'Description',
      placeholder: 'Search description...',
      value: filters.description
    },
    {
      key: 'expense_number',
      type: 'text',
      label: 'Expense Number',
      placeholder: 'EXP-2024...',
      value: filters.expense_number
    }
  ];

  const sortConfig = [
    { value: '-date', label: 'Date (Newest)' },
    { value: 'date', label: 'Date (Oldest)' },
    { value: '-amount', label: 'Amount (Highest)' },
    { value: 'amount', label: 'Amount (Lowest)' },
    { value: '-description', label: 'Description (Z-A)' },
    { value: 'description', label: 'Description (A-Z)' }
  ];

  const handleFilterChange = (keyOrUpdates, val) => {
    if (typeof keyOrUpdates === 'object') {
      updateURLParams({ ...keyOrUpdates, page: 1 });
    } else {
      updateURLParams({ [keyOrUpdates]: val, page: 1 });
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" >Expenses</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage and track your business expenses.</p>
        </div>
      </div>

      <Card>
        <DataTable
          columns={columns}
          data={data?.results || []}
          isLoading={isLoading}
          keyField="id"
          emptyMessage="No expenses found matching your criteria."

          searchPlaceholder="Search description, expense number..."
          searchValue={search}
          onSearch={(v) => updateURLParams({ search: v, page: 1 })}

          filters={filterConfig}
          onFilterChange={handleFilterChange}

          sortOptions={sortConfig}
          activeSort={activeSort}
          onSortChange={(val) => updateURLParams({ ordering: val, page: 1 })}

          rowActions={rowActions}
          toolbarActions={
            <Button variant="primary" leftIcon="ri-add-line" onClick={() => setIsCreateModalOpen(true)}>
              Record Expense
            </Button>
          }

          pagination={{
            currentPage: page,
            totalPages: data?.total_pages || 1,
            hasNext: !!data?.next,
            hasPrev: !!data?.previous,
            onPageChange: (newPage) => updateURLParams({ page: newPage })
          }}
        />
      </Card>

      <ConfirmationDialog
        isOpen={isDeleteDialogOpen}
        title="Delete Expense"
        message={`Are you sure you want to delete expense ${expenseToDelete?.expense_number}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger={true}
        isConfirming={deleteExpenseMutation.isPending}
        onConfirm={() => {
          const toastId = showToast.loading('Deleting expense...');
          deleteExpenseMutation.mutate(expenseToDelete.id, {
            onSuccess: () => {
              showToast.dismiss(toastId);
              showToast.success('Expense deleted successfully');
              setIsDeleteDialogOpen(false);
              setExpenseToDelete(null);
            },
            onError: (err) => {
              showToast.dismiss(toastId);
              handleBackendErrors(err, null, 'Failed to delete expense');
              setIsDeleteDialogOpen(false);
            }
          });
        }}
        onClose={() => {
          if (!deleteExpenseMutation.isPending) {
            setIsDeleteDialogOpen(false);
            setExpenseToDelete(null);
          }
        }}
      />

      {/* Edit Modal */}
      <ExpenseEditModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setExpenseToEdit(null);
        }}
        expense={expenseToEdit}
      />

      {/* Create Modal */}
      <ExpenseCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
