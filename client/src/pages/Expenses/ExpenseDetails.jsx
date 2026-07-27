import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useExpenseById, useDeleteExpense } from '../../hooks/useExpenses.js';
import { Card, Button, ConfirmationDialog, KeyValueGrid, StatCard } from '../../components/common/index.js';
import { showToast } from '../../utils/toast.js';
import { handleBackendErrors } from '../../utils/errorHandler.js';
import { ExpenseEditModal } from './ExpenseEditModal.jsx';

export default function ExpenseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: expense, isLoading, isError, error } = useExpenseById(id);
  const deleteExpenseMutation = useDeleteExpense();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleDeleteExpense = () => {
    const toastId = showToast.loading('Deleting expense...');
    deleteExpenseMutation.mutate(id, {
      onSuccess: () => {
        showToast.dismiss(toastId);
        showToast.success('Expense deleted successfully');
        setIsDeleteModalOpen(false);
        navigate('/expenses');
      },
      onError: (err) => {
        showToast.dismiss(toastId);
        handleBackendErrors(err, null, 'Failed to delete expense');
        setIsDeleteModalOpen(false);
      }
    });
  };

  if (isLoading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <i className="ri-loader-4-line spinner-icon" style={{ fontSize: '2rem' }}></i>
        <p style={{ marginTop: '16px' }}>Loading expense details...</p>
      </div>
    );
  }

  if (isError || !expense) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--danger-color, #ef4444)' }}>
        <i className="ri-error-warning-line" style={{ fontSize: '3rem' }}></i>
        <h2>Expense Not Found</h2>
        <p style={{ marginTop: '8px' }}>{error?.message || "The expense you're looking for doesn't exist or an error occurred."}</p>
        <Button variant="outline" onClick={() => navigate('/expenses')} style={{ marginTop: '16px' }}>
          Back to Expenses
        </Button>
      </div>
    );
  }

  const formatCurrency = (amount, currency = 'ETB') => {
    if (amount === undefined || amount === null) return '-';
    return `${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString();
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

  return (
    <div className="page-container details-page-wrapper">
      {/* Header Area */}
      <div className="details-header">
        <div className="details-header-left">
          <button className="back-btn" onClick={() => navigate('/expenses')}>
            <i className="ri-arrow-left-line"></i>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <h1 className="page-title" style={{ margin: 0 }}>Expense {expense.expense_number}</h1>
            </div>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              {formatDate(expense.date)}
            </p>
          </div>
        </div>

        <div className="details-header-actions">
          <Button variant="outline" leftIcon="ri-pencil-line" onClick={() => setIsEditModalOpen(true)}>
            Edit
          </Button>
          <Button variant="danger" leftIcon="ri-delete-bin-line" onClick={() => setIsDeleteModalOpen(true)}>
            Delete
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Information Card */}
        <Card>
          <Card.Header title="Expense Information" icon="ri-file-list-3-line" />
          <Card.Body>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard
                title="Amount"
                value={formatCurrency(expense.amount, expense.currency)}
                icon="ri-wallet-3-line"
                color="danger"
              />
              <StatCard
                title="Payment Method"
                value={formatPaymentMethod(expense.payment_method)}
                icon="ri-bank-card-line"
                color="primary"
              />
            </div>

            <KeyValueGrid items={[
              { label: 'Description', value: expense.description },
              { label: 'Payment Date', value: formatDate(expense.date) },
              { label: 'Currency', value: expense.currency },
              { label: 'Reference', value: expense.reference || '-' }
            ]} />
          </Card.Body>
        </Card>

        {/* Notes */}
        <Card>
          <Card.Header title="Notes" icon="ri-file-text-line" />
          <Card.Body>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: expense.notes ? 'var(--text-color)' : 'var(--text-muted)' }}>
              {expense.notes || '—'}
            </p>
          </Card.Body>
        </Card>

        {/* Timeline / Metadata Card */}
        <Card>
          <Card.Header title="Metadata" icon="ri-time-line" />
          <Card.Body>
            <KeyValueGrid items={[
              { label: 'Created At', value: formatDateTime(expense.created_at) },
              { label: 'Updated At', value: formatDateTime(expense.updated_at) }
            ]} />
          </Card.Body>
        </Card>

      </div>

      {/* Edit Modal */}
      <ExpenseEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        expense={expense}
        isDetailPage={true}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        title="Delete Expense"
        message={`Are you sure you want to delete expense ${expense.expense_number}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger={true}
        isConfirming={deleteExpenseMutation.isPending}
        onConfirm={handleDeleteExpense}
        onClose={() => !deleteExpenseMutation.isPending && setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
