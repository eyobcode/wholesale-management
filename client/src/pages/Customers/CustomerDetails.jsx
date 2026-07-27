import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCustomer, useDeleteCustomer } from '../../services/customerService.js';
import { Card, Button, Badge, Modal, PaymentForm } from '../../components/common/index.js';
import { showToast } from '../../utils/toast.js';
import { handleBackendErrors } from '../../utils/errorHandler.js';
import { formatCurrency } from '../../utils/formatters.js';
import CustomerForm from './CustomerForm.jsx';
import './Customers.css';

export default function CustomerDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: customer, isLoading, error } = useCustomer(id);
  const deleteMutation = useDeleteCustomer();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="middle-class" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <i className="ri-loader-4-line spinner-icon" style={{ fontSize: '2rem', color: 'var(--text-muted)' }}></i>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="middle-class">
        <Card>
          <Card.Body style={{ textAlign: 'center', padding: '48px 20px' }}>
            <i className="ri-error-warning-line" style={{ fontSize: '3rem', color: '#ef4444', marginBottom: '16px' }}></i>
            <h2 style={{ marginBottom: '8px' }}>Customer Not Found</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>The customer you are looking for does not exist or an error occurred.</p>
            <Button variant="outline" onClick={() => navigate('/customers')}>Back to Customers</Button>
          </Card.Body>
        </Card>
      </div>
    );
  }

  // Helper to render balance badge
  const renderBalanceBadge = () => {
    const balance = parseFloat(customer.current_balance || 0);
    const currency = customer.initial_credit_currency || 'ETB';

    if (balance > 0) return <Badge variant="danger">Owes {formatCurrency(balance, currency)}</Badge>;
    if (balance < 0) return <Badge variant="success">You Owe {formatCurrency(Math.abs(balance), currency)}</Badge>;
    return <Badge variant="default">Settled</Badge>;
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${customer.name}?`)) {
      const toastId = showToast.loading('Deleting...');
      deleteMutation.mutate(id, {
        onSuccess: () => {
          showToast.success('Deleted', 'Customer deleted successfully');
          showToast.dismiss(toastId);
          navigate('/customers', { replace: true });
        },
        onError: (err) => {
          handleBackendErrors(err, null, 'Delete Failed');
          showToast.dismiss(toastId);
        }
      });
    }
  };

  return (
    <div className="page-container details-page-wrapper">
      {/* Header Area */}
      <div className="details-header">
        <div className="details-header-left">
          <button className="back-btn" onClick={() => navigate('/customers')}>
            <i className="ri-arrow-left-line"></i>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <h1 className="page-title">{customer.name}</h1>
              <Badge variant={(customer.is_active === true || customer.is_active === 'true') ? "success" : "warning"}>
                {(customer.is_active === true || customer.is_active === 'true') ? 'Active' : 'Archived'}
              </Badge>
            </div>
            <p style={{ color: 'var(--text-muted)' }}>Customer ID: #{customer.id}</p>
          </div>
        </div>

        <div className="details-header-actions">
          <Button
            variant="outline"
            leftIcon="ri-edit-line"
            onClick={() => setIsEditModalOpen(true)}
          >
            Edit
          </Button>
          <Button
            variant="danger"
            leftIcon="ri-delete-bin-line"
            onClick={handleDelete}
            disabled={deleteMutation.isLoading}
            isLoading={deleteMutation.isLoading}
          >
            Delete
          </Button>
          <Button
            variant="primary"
            leftIcon="ri-money-dollar-circle-line"
            onClick={() => setIsPaymentModalOpen(true)}
          >
            Record Payment
          </Button>
        </div>
      </div>

      {/* Grid Layout for details */}
      <div className="details-grid">

        {/* Basic Information */}
        <Card>
          <Card.Header title="Basic Information" icon="ri-user-line" />
          <Card.Body>
            <div className="info-list">
              <div className="info-item">
                <span className="info-label">Name</span>
                <span className="info-value">{customer.name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Phone</span>
                <span className="info-value">{customer.phone || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Location</span>
                <span className="info-value">{customer.location || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Opening Date</span>
                <span className="info-value">{customer.opening_date ? new Date(customer.opening_date).toLocaleDateString() : 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Status</span>
                <span className="info-value">
                  {(customer.is_active === true || customer.is_active === 'true') ? 'Active' : 'Archived'}
                </span>
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Financial Information */}
        <Card>
          <Card.Header title="Financial Information" icon="ri-wallet-3-line" />
          <Card.Body>
            <div className="info-list">
              <div className="info-item">
                <span className="info-label">Current Balance</span>
                <span className="info-value" style={{ fontWeight: '600' }}>
                  {formatCurrency(customer.current_balance || 0, customer.initial_credit_currency)}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Initial Credit</span>
                <span className="info-value">
                  {formatCurrency(customer.initial_credit || 0, customer.initial_credit_currency)}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Balance Status</span>
                <span className="info-value">
                  {renderBalanceBadge()}
                </span>
              </div>
            </div>
          </Card.Body>
        </Card>

        {/* Business Summary */}
        <Card>
          <Card.Header title="Business Summary" icon="ri-bar-chart-box-line" />
          <Card.Body>
            <div className="info-list">
              <div className="info-item">
                <span className="info-label">Total Sales Amount</span>
                <span className="info-value">{parseFloat(customer.total_sales_amount || 0).toFixed(2)} {customer.initial_credit_currency || 'ETB'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Total Credit Sales</span>
                <span className="info-value">{parseFloat(customer.total_sale_credit_amount || 0).toFixed(2)} {customer.initial_credit_currency || 'ETB'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Total Payments Received</span>
                <span className="info-value">{parseFloat(customer.total_payments_received || 0).toFixed(2)} {customer.initial_credit_currency || 'ETB'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Last Purchase Date</span>
                <span className="info-value">{customer.last_purchase_date ? new Date(customer.last_purchase_date).toLocaleDateString() : 'No purchases yet'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Last Payment Date</span>
                <span className="info-value">{customer.last_payment_date ? new Date(customer.last_payment_date).toLocaleDateString() : 'No payments yet'}</span>
              </div>
            </div>
          </Card.Body>
        </Card>

      </div>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Customer"
      >
        <CustomerForm
          initialData={customer}
          onCancel={() => setIsEditModalOpen(false)}
          onSuccess={() => setIsEditModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Record Payment for ${customer.name}`}
      >
        <PaymentForm
          entityIdKey="customer"
          entityId={customer.id}
          onCancel={() => setIsPaymentModalOpen(false)}
          onSuccess={() => setIsPaymentModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
