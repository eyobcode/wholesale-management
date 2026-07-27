import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFactoryPaymentById, useDeleteFactoryPayment } from '../../hooks/useFactoryPayments.js';
import { Card, Badge, Button, ConfirmationDialog, KeyValueGrid, StatCard } from '../../components/common/index.js';
import { showToast } from '../../utils/toast.js';
import { handleBackendErrors } from '../../utils/errorHandler.js';
import { FactoryPaymentEditModal } from './FactoryPaymentEditModal.jsx';

export default function FactoryPaymentDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: payment, isLoading, isError, error } = useFactoryPaymentById(id);
  const deletePaymentMutation = useDeleteFactoryPayment();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleDeletePayment = () => {
    const toastId = showToast.loading('Deleting payment...');
    deletePaymentMutation.mutate(id, {
      onSuccess: () => {
        showToast.dismiss(toastId);
        showToast.success('Factory payment deleted successfully');
        setIsDeleteModalOpen(false);
        navigate('/payments');
      },
      onError: (err) => {
        showToast.dismiss(toastId);
        handleBackendErrors(err, null, 'Failed to delete factory payment');
        setIsDeleteModalOpen(false);
      }
    });
  };

  if (isLoading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <i className="ri-loader-4-line spinner-icon" style={{ fontSize: '2rem' }}></i>
        <p style={{ marginTop: '16px' }}>Loading payment details...</p>
      </div>
    );
  }

  if (isError || !payment) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--danger-color, #ef4444)' }}>
        <i className="ri-error-warning-line" style={{ fontSize: '3rem' }}></i>
        <h2>Payment Not Found</h2>
        <p style={{ marginTop: '8px' }}>{error?.message || "The payment you're looking for doesn't exist or an error occurred."}</p>
        <Button variant="outline" onClick={() => navigate('/payments')} style={{ marginTop: '16px' }}>
          Back to Payments
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
          <button className="back-btn" onClick={() => navigate('/payments')}>
            <i className="ri-arrow-left-line"></i>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <h1 className="page-title" style={{ margin: 0 }}>Payment {payment.payment_number}</h1>
              {payment.is_auto ? (
                <Badge variant="info">Auto Payment</Badge>
              ) : (
                <Badge variant="primary">Manual Payment</Badge>
              )}
            </div>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              {payment.factory_name} • {formatDate(payment.date)}
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

        {/* Factory Information */}
        <Card>
          <Card.Header title="Factory Information" icon="ri-building-2-line" />
          <Card.Body>
            <KeyValueGrid items={[
              { label: 'Factory Name', value: payment.factory_name },
              { label: 'Payment Number', value: payment.payment_number },
              { label: 'Purchase Shipping Code', value: payment.purchase_shipping_code || '-' },
              {
                label: 'Factory Balance After',
                value: <span style={{ fontWeight: 600 }}>{formatCurrency(payment.factory_balance_after, payment.currency)}</span>
              }
            ]} />
          </Card.Body>
        </Card>

        {/* Payment Information */}
        <Card>
          <Card.Header title="Payment Information" icon="ri-money-dollar-circle-line" />
          <Card.Body>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
              <StatCard
                title="Paid Amount"
                value={formatCurrency(payment.paid_amount, payment.currency)}
                icon="ri-wallet-3-line"
                color="success"
              />
              <StatCard
                title="Payment Method"
                value={formatPaymentMethod(payment.payment_method)}
                icon="ri-bank-card-line"
                color="primary"
              />
            </div>

            <KeyValueGrid items={[
              { label: 'Payment Date', value: formatDate(payment.date) },
              { label: 'Currency', value: payment.currency },
              { label: 'Reference', value: payment.reference || '-' },
              { label: 'Created At', value: formatDateTime(payment.created_at) },
              { label: 'Updated At', value: formatDateTime(payment.updated_at) }
            ]} />
          </Card.Body>
        </Card>

        {/* Notes */}
        <Card>
          <Card.Header title="Notes" icon="ri-file-text-line" />
          <Card.Body>
            <p style={{ margin: 0, whiteSpace: 'pre-wrap', color: payment.notes ? 'var(--text-color)' : 'var(--text-muted)' }}>
              {payment.notes || 'No notes provided for this payment.'}
            </p>
          </Card.Body>
        </Card>

      </div>

      {/* Edit Modal */}
      <FactoryPaymentEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        payment={payment}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        title="Delete Factory Payment"
        message={`Are you sure you want to delete payment ${payment.payment_number}? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger={true}
        isConfirming={deletePaymentMutation.isPending}
        onConfirm={handleDeletePayment}
        onClose={() => !deletePaymentMutation.isPending && setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
