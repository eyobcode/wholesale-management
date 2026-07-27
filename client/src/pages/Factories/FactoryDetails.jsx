import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFactory, useDeleteFactory } from '../../services/factoryService.js';
import { Card, Button, Badge, Modal, PaymentForm } from '../../components/common/index.js';
import { showToast } from '../../utils/toast.js';
import { handleBackendErrors } from '../../utils/errorHandler.js';
import { formatCurrency } from '../../utils/formatters.js';
import FactoryForm from './FactoryForm.jsx';
import '../Customers/Customers.css'; // Reusing the same grid layout styles

export default function FactoryDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: factory, isLoading, error } = useFactory(id);
  const deleteMutation = useDeleteFactory();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="middle-class" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <i className="ri-loader-4-line spinner-icon" style={{ fontSize: '2rem', color: 'var(--text-muted)' }}></i>
      </div>
    );
  }

  if (error || !factory) {
    return (
      <div className="middle-class">
        <Card>
          <Card.Body style={{ textAlign: 'center', padding: '48px 20px' }}>
            <i className="ri-error-warning-line" style={{ fontSize: '3rem', color: '#ef4444', marginBottom: '16px' }}></i>
            <h2 style={{ marginBottom: '8px' }}>Factory Not Found</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>The factory you are looking for does not exist or an error occurred.</p>
            <Button variant="outline" onClick={() => navigate('/factories')}>Back to Factories</Button>
          </Card.Body>
        </Card>
      </div>
    );
  }

  // Helper to render balance badge
  const renderBalanceBadge = () => {
    const balance = parseFloat(factory.current_balance || 0);
    const currency = factory.initial_balance_currency || 'ETB';

    if (balance > 0) return <Badge variant="danger">You Owe {formatCurrency(balance, currency)}</Badge>;
    if (balance < 0) return <Badge variant="success">They Owe {formatCurrency(Math.abs(balance), currency)}</Badge>;
    return <Badge variant="default">Settled</Badge>;
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${factory.name}?`)) {
      const toastId = showToast.loading('Deleting...');
      deleteMutation.mutate(id, {
        onSuccess: () => {
          showToast.success('Deleted', 'Factory deleted successfully');
          showToast.dismiss(toastId);
          navigate('/factories', { replace: true });
        },
        onError: (err) => {
          handleBackendErrors(err, null, 'Delete Failed');
          showToast.dismiss(toastId);
        }
      });
    }
  };

  const isActive = factory.is_active === true || factory.is_active === 'true';

  return (
    <div className="page-container details-page-wrapper">
      {/* Header Area */}
      <div className="details-header">
        <div className="details-header-left">
          <button className="back-btn" onClick={() => navigate('/factories')}>
            <i className="ri-arrow-left-line"></i>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <h1 className="page-title">{factory.name}</h1>
              <Badge variant={isActive ? "success" : "warning"}>
                {isActive ? 'Active' : 'Archived'}
              </Badge>
            </div>
            <p style={{ color: 'var(--text-muted)' }}>Factory ID: #{factory.id}</p>
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
          <Card.Header title="Basic Information" icon="ri-building-line" />
          <Card.Body>
            <div className="info-list">
              <div className="info-item">
                <span className="info-label">Name</span>
                <span className="info-value">{factory.name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Phone</span>
                <span className="info-value">{factory.phone || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Location</span>
                <span className="info-value">{factory.location || 'N/A'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Status</span>
                <span className="info-value">
                  {isActive ? 'Active' : 'Archived'}
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
                  {formatCurrency(factory.current_balance || 0, factory.initial_balance_currency)}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Initial Balance</span>
                <span className="info-value">
                  {formatCurrency(factory.initial_balance || 0, factory.initial_balance_currency)}
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
                <span className="info-label">Total Purchased Amount</span>
                <span className="info-value">{parseFloat(factory.total_purchased_amount || 0).toFixed(2)} {factory.initial_balance_currency || 'ETB'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Total Unpaid Purchases</span>
                <span className="info-value">{parseFloat(factory.total_purchased_unpaid || 0).toFixed(2)} {factory.initial_balance_currency || 'ETB'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Total Payments Made</span>
                <span className="info-value">{parseFloat(factory.total_payments_made || 0).toFixed(2)} {factory.initial_balance_currency || 'ETB'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Last Purchase Date</span>
                <span className="info-value">{factory.last_purchase_date ? new Date(factory.last_purchase_date).toLocaleDateString() : 'No purchases yet'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Last Payment Date</span>
                <span className="info-value">{factory.last_payment_date ? new Date(factory.last_payment_date).toLocaleDateString() : 'No payments yet'}</span>
              </div>
            </div>
          </Card.Body>
        </Card>

      </div>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Factory"
      >
        <FactoryForm
          initialData={factory}
          onCancel={() => setIsEditModalOpen(false)}
          onSuccess={() => setIsEditModalOpen(false)}
        />
      </Modal>

      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Record Payment for ${factory.name}`}
      >
        <PaymentForm
          entityIdKey="factory"
          entityId={factory.id}
          onCancel={() => setIsPaymentModalOpen(false)}
          onSuccess={() => setIsPaymentModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
