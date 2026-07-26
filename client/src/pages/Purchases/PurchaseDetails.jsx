import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePurchase, usePurchaseItems, useDeletePurchaseItem, useDeletePurchase } from '../../services/purchaseService.js';
import { usePaymentMethods } from '../../services/paymentService.js';
import { Card, Badge, Button, DataTable, Modal, ConfirmationDialog, KeyValueGrid, StatCard } from '../../components/common/index.js';
import { showToast } from '../../utils/toast.js';
import { handleBackendErrors } from '../../utils/errorHandler.js';
import PurchaseItemForm from './PurchaseItemForm.jsx';
import PurchaseItemAddForm from './PurchaseItemAddForm.jsx';
import PurchaseEditForm from './PurchaseEditForm.jsx';
import PurchaseFullEditForm from './PurchaseFullEditForm.jsx';
import InvoicePreviewModal from './InvoicePreviewModal.jsx';

export default function PurchaseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: purchase, isLoading, isError, error } = usePurchase(id);
  const { data: paymentMethods } = usePaymentMethods();
  const deleteItemMutation = useDeletePurchaseItem();
  const deletePurchaseMutation = useDeletePurchase();

  const [selectedItem, setSelectedItem] = useState(null); // For View action
  const [editingItem, setEditingItem] = useState(null);   // For Edit action
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // For Purchase Edit
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false); // For Add Item
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false); // For Purchase Delete
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false); // For Invoice Preview

  // Purchase Items State
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsSearch, setItemsSearch] = useState('');
  const [itemsActiveSort, setItemsActiveSort] = useState('');
  const [itemsFilters, setItemsFilters] = useState({ price_type: '' });

  // Fetch Purchase Items
  const itemsQueryParams = {
    purchase: id,
    page: itemsPage,
    search: itemsSearch || undefined,
    ordering: itemsActiveSort || undefined,
    ...(itemsFilters.price_type ? { price_type: itemsFilters.price_type } : {})
  };
  const { data: itemsData, isLoading: itemsLoading } = usePurchaseItems(itemsQueryParams);

  const handleDeletePurchase = () => {
    const toastId = showToast.loading('Deleting purchase...');
    deletePurchaseMutation.mutate(id, {
      onSuccess: () => {
        showToast.success('Deleted', 'Purchase deleted successfully');
        showToast.dismiss(toastId);
        setIsDeleteModalOpen(false);
        navigate('/purchases');
      },
      onError: (err) => {
        showToast.dismiss(toastId);
        handleBackendErrors(err, null, 'Failed to delete purchase');
      }
    });
  };

  if (isLoading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <i className="ri-loader-4-line spinner-icon" style={{ fontSize: '2rem' }}></i>
        <p style={{ marginTop: '16px' }}>Loading purchase details...</p>
      </div>
    );
  }

  if (isError || !purchase) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--danger-color, #ef4444)' }}>
        <i className="ri-error-warning-line" style={{ fontSize: '3rem' }}></i>
        <h2>Purchase Not Found</h2>
        <p style={{ marginTop: '8px' }}>{error?.message || "The purchase you're looking for doesn't exist or an error occurred."}</p>
        <Button variant="outline" onClick={() => navigate('/purchases')} style={{ marginTop: '16px' }}>
          Back to Purchases
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

  const getPaymentMethodLabel = () => {
    if (!purchase.payment_method) return '-';
    if (!paymentMethods) return purchase.payment_method;

    const methodsArray = Array.isArray(paymentMethods) ? paymentMethods : (paymentMethods.results || []);
    const methodObj = methodsArray.find(m => m.value === purchase.payment_method);

    return methodObj ? methodObj.label : purchase.payment_method;
  };

  const itemColumns = [
    { key: 'product_name', title: 'Product Name', sortable: false },
    { key: 'item_code', title: 'Item Code', sortable: false },
    { key: 'total_bags_purchased', title: 'Bags Purchased', sortable: false },
    { key: 'pcs_per_bag', title: 'Pieces per Bag', sortable: false },
    { key: 'total_pieces_purchased', title: 'Total Pieces', sortable: false },
    {
      key: 'purchase_price',
      title: 'Purchase Price',
      render: (val, row) => formatCurrency(val, row.currency || purchase.currency)
    },
    {
      key: 'price_type',
      title: 'Price Type',
      render: (val) => {
        if (val === 'per_piece') return <Badge variant="info">Per Piece</Badge>;
        if (val === 'per_bag') return <Badge variant="primary">Per Bag</Badge>;
        return <Badge variant="default">{val}</Badge>;
      }
    },
    {
      key: 'total_item_amount',
      title: 'Total Amount',
      render: (val, row) => <span style={{ fontWeight: 600 }}>{formatCurrency(val, row.currency || purchase.currency)}</span>
    }
  ];

  const handleDeleteItem = (item) => {
    if (window.confirm(`Are you sure you want to delete this purchase item? This action cannot be undone.`)) {
      const toastId = showToast.loading('Deleting purchase item...');
      deleteItemMutation.mutate(item.id, {
        onSuccess: () => {
          showToast.success('Deleted', 'Purchase item deleted successfully');
          showToast.dismiss(toastId);
        },
        onError: (err) => {
          showToast.dismiss(toastId);
          handleBackendErrors(err, null, 'Failed to delete purchase item');
        }
      });
    }
  };

  const itemActions = [
    {
      icon: 'ri-eye-line',
      label: 'View',
      onClick: (row) => setSelectedItem(row)
    },
    {
      icon: 'ri-edit-line',
      label: 'Edit',
      onClick: (row) => setEditingItem(row)
    },
    {
      icon: 'ri-delete-bin-line',
      label: 'Delete',
      onClick: handleDeleteItem,
      danger: true
    }
  ];

  // Items Toolbar Configuration
  const itemsFilterConfig = [
    {
      key: 'price_type',
      type: 'select',
      label: 'Price Type',
      placeholder: 'All Types',
      value: itemsFilters.price_type,
      options: [
        { value: '', label: 'All Types' },
        { value: 'per_piece', label: 'Per Piece' },
        { value: 'per_bag', label: 'Per Bag' }
      ]
    }
  ];

  const itemsSortConfig = [
    { value: '', label: 'Default' },
    { value: 'item_code', label: 'Item Code (A-Z)' },
    { value: '-item_code', label: 'Item Code (Z-A)' },
    { value: 'total_item_amount', label: 'Total Amount (Low-High)' },
    { value: '-total_item_amount', label: 'Total Amount (High-Low)' },
    { value: 'purchase_price', label: 'Price (Low-High)' },
    { value: '-purchase_price', label: 'Price (High-Low)' },
    { value: 'created_at', label: 'Oldest First' },
    { value: '-created_at', label: 'Newest First' }
  ];

  const handleItemsFilterChange = (key, value) => {
    setItemsFilters(prev => ({ ...prev, [key]: value }));
    setItemsPage(1);
  };

  const handleItemsSearch = (val) => {
    setItemsSearch(val);
    setItemsPage(1);
  };

  return (
    <div className="page-container">
      {/* Header Area */}
      <div className="details-header">
        <div className="details-header-left">
          <button className="back-btn" onClick={() => navigate('/purchases')}>
            <i className="ri-arrow-left-line"></i>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <h1 className="page-title">Purchase #{purchase.id}</h1>
              <Badge
                status={
                  purchase.payment_status === 'paid' ? 'success' :
                    purchase.payment_status === 'partial' ? 'warning' : 'danger'
                }
              >
                {purchase.payment_status?.toUpperCase() || 'UNKNOWN'}
              </Badge>
            </div>
            <p style={{ color: 'var(--text-muted)' }}>
              {purchase.factory_name} • {formatDate(purchase.date)}
            </p>
          </div>
        </div>

        <div className="details-header-actions">
          <Button variant="outline" leftIcon="ri-file-list-3-line" onClick={() => setIsInvoiceModalOpen(true)}>
            View Invoice
          </Button>
          <Button variant="outline" leftIcon="ri-edit-line" onClick={() => setIsEditModalOpen(true)}>
            Edit
          </Button>
          <Button variant="danger" leftIcon="ri-delete-bin-line" onClick={() => setIsDeleteModalOpen(true)}>
            Delete
          </Button>
          <Button variant="primary" leftIcon="ri-add-line" onClick={() => setIsAddItemModalOpen(true)}>
            Add Item
          </Button>
        </div>
      </div>

      {/* Metrics & Status Section */}
      <div style={{ marginTop: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <i className="ri-dashboard-3-line" style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}></i>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Metrics & Status</h3>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <StatCard
            label="Total Amount"
            value={formatCurrency(purchase.total_purchase_amount, purchase.currency)}
            icon="ri-bank-card-line"
          />
          <StatCard
            label="Amount Paid"
            value={formatCurrency(purchase.amount_paid_now, purchase.currency)}
            icon="ri-checkbox-circle-line"
            valueColor="var(--success-color, #10b981)"
            iconColor="var(--success-color, #10b981)"
            iconBg="rgba(16, 185, 129, 0.15)"
          />
          <StatCard
            label="Unpaid Amount"
            value={formatCurrency(purchase.unpaid_amount, purchase.currency)}
            icon="ri-error-warning-line"
            valueColor="var(--danger-color, #ef4444)"
            iconColor="var(--danger-color, #ef4444)"
            iconBg="rgba(239, 68, 68, 0.15)"
          />
          <StatCard
            label="Editability"
            value={purchase.is_fully_editable ? 'Fully Editable' : 'Partially Editable'}
            icon={purchase.is_fully_editable ? "ri-check-line" : "ri-error-warning-line"}
            valueColor={purchase.is_fully_editable ? 'var(--success-color, #10b981)' : 'var(--warning-color, #f59e0b)'}
            iconColor={purchase.is_fully_editable ? 'var(--success-color, #10b981)' : 'var(--warning-color, #f59e0b)'}
            iconBg={purchase.is_fully_editable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'}
          />
        </div>
      </div>

      {/* Purchase Information Card */}
      <div style={{ marginBottom: '24px' }}>
        <Card>
          <Card.Header title="Purchase Information" icon="ri-information-line" />
          <Card.Body>

            {/* Clean Dashboard Layout */}
            <KeyValueGrid items={[
              { label: 'Factory', value: purchase.factory_name },
              { label: 'Purchase Date', value: formatDate(purchase.date) },
              { label: 'Shipping Code', value: purchase.shipping_code || '-' },
              { label: 'Payment Method', value: getPaymentMethodLabel() },
              { label: 'Currency', value: purchase.currency || 'ETB' },
              { label: 'Created At', value: formatDateTime(purchase.created_at) },
              { label: 'Updated At', value: formatDateTime(purchase.updated_at) },
            ]} />

            {/* Nice Notes Section */}
            {purchase.notes && (
              <div style={{ marginTop: '24px' }}>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="ri-sticky-note-line"></i> Notes
                </h4>
                <div style={{
                  backgroundColor: 'rgba(14, 165, 233, 0.1)',
                  border: '1px solid rgba(14, 165, 233, 0.2)',
                  borderLeft: '4px solid #0ea5e9',
                  padding: '16px 20px',
                  borderRadius: '6px',
                  color: 'var(--text-color)',
                  fontSize: '0.95rem',
                  lineHeight: '1.6',
                  fontWeight: 500
                }}>
                  {purchase.notes}
                </div>
              </div>
            )}

          </Card.Body>
        </Card>
      </div>

      {/* Purchase Items Section */}
      <div style={{ marginTop: '24px' }}>
        <Card>
          <Card.Header title="Purchase Items" icon="ri-shopping-cart-2-line" />
          <Card.Body style={{ padding: 0 }}>
            <DataTable
              columns={itemColumns}
              data={itemsData?.results || []}
              rowActions={itemActions}
              keyField="id"
              emptyMessage="No items found for this purchase."
              isLoading={itemsLoading}

              searchPlaceholder="Search items..."
              searchValue={itemsSearch}
              onSearch={handleItemsSearch}

              filters={itemsFilterConfig}
              onFilterChange={handleItemsFilterChange}

              sortOptions={itemsSortConfig}
              activeSort={itemsActiveSort}
              onSortChange={(val) => {
                setItemsActiveSort(val);
                setItemsPage(1);
              }}

              pagination={{
                currentPage: itemsPage,
                totalPages: itemsData?.total_pages || 1,
                hasNext: !!itemsData?.next,
                hasPrev: !!itemsData?.previous,
                onPageChange: (newPage) => setItemsPage(newPage)
              }}
            />
          </Card.Body>
        </Card>
      </div>

      {/* Item Details Modal */}
      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title="Purchase Item Details"
      >
        {selectedItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            <Card>
              <Card.Header title="Basic Information" icon="ri-information-line" />
              <Card.Body>
                <div className="info-list">
                  <div className="info-item">
                    <span className="info-label">Product Name</span>
                    <span className="info-value" style={{ fontWeight: 600 }}>{selectedItem.product_name}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Item Code</span>
                    <span className="info-value" style={{ fontWeight: 600 }}>{selectedItem.item_code}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Factory</span>
                    <span className="info-value">{selectedItem.factory_name || purchase.factory_name}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Shipping Code</span>
                    <span className="info-value">{selectedItem.shipping_code || purchase.shipping_code || '-'}</span>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header title="Pricing" icon="ri-price-tag-3-line" />
              <Card.Body>
                <div className="info-list">
                  <div className="info-item">
                    <span className="info-label">Price Type</span>
                    <span className="info-value">
                      {selectedItem.price_type === 'per_piece' ? <Badge variant="info">Per Piece</Badge> :
                        selectedItem.price_type === 'per_bag' ? <Badge variant="primary">Per Bag</Badge> :
                          <Badge variant="default">{selectedItem.price_type}</Badge>}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Purchase Price</span>
                    <span className="info-value" style={{ fontWeight: 600 }}>
                      {formatCurrency(selectedItem.purchase_price, selectedItem.currency || purchase.currency)}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Cost Per Piece</span>
                    <span className="info-value">
                      {formatCurrency(selectedItem.cost_per_piece, selectedItem.currency || purchase.currency)}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Currency</span>
                    <span className="info-value">{selectedItem.currency || purchase.currency}</span>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header title="Packaging" icon="ri-box-3-line" />
              <Card.Body>
                <div className="info-list">
                  <div className="info-item">
                    <span className="info-label">Pieces Per Bag</span>
                    <span className="info-value">{selectedItem.pcs_per_bag}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Bags Purchased</span>
                    <span className="info-value">{selectedItem.total_bags_purchased}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Pieces Purchased</span>
                    <span className="info-value">{selectedItem.total_pieces_purchased}</span>
                  </div>
                  <div className="info-item" style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '16px' }}>
                    <span className="info-label">Total Item Amount</span>
                    <span className="info-value" style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                      {formatCurrency(selectedItem.total_item_amount, selectedItem.currency || purchase.currency)}
                    </span>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header title="Inventory" icon="ri-stack-line" />
              <Card.Body>
                <div className="info-list">
                  <div className="info-item">
                    <span className="info-label">Remaining Bags</span>
                    <span className="info-value" style={{ fontWeight: 600, color: selectedItem.remaining_bags > 0 ? 'var(--success-color, #10b981)' : 'var(--danger-color, #ef4444)' }}>
                      {selectedItem.remaining_bags}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Remaining Pieces</span>
                    <span className="info-value" style={{ fontWeight: 600, color: selectedItem.remaining_pieces > 0 ? 'var(--success-color, #10b981)' : 'var(--danger-color, #ef4444)' }}>
                      {selectedItem.remaining_pieces}
                    </span>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header title="System" icon="ri-settings-4-line" />
              <Card.Body>
                <div className="info-list">
                  <div className="info-item">
                    <span className="info-label">Created At</span>
                    <span className="info-value">{formatDateTime(selectedItem.created_at)}</span>
                  </div>
                </div>
              </Card.Body>
            </Card>

          </div>
        )}
      </Modal>

      {/* Edit Item Modal */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Edit Purchase Item"
      >
        {editingItem && (
          <PurchaseItemForm
            item={editingItem}
            purchaseId={id}
            onClose={() => setEditingItem(null)}
          />
        )}
      </Modal>

      {/* Edit Purchase Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={purchase.is_fully_editable ? "Edit Purchase" : "Edit Payment"}
      >
        {isEditModalOpen && purchase.is_fully_editable ? (
          <PurchaseFullEditForm
            initialData={purchase}
            onSuccess={() => setIsEditModalOpen(false)}
            onCancel={() => setIsEditModalOpen(false)}
          />
        ) : isEditModalOpen && (
          <PurchaseEditForm
            initialData={purchase}
            onSuccess={() => setIsEditModalOpen(false)}
            onCancel={() => setIsEditModalOpen(false)}
          />
        )}
      </Modal>

      {/* Add Item Modal */}
      <Modal
        isOpen={isAddItemModalOpen}
        onClose={() => setIsAddItemModalOpen(false)}
        title="Add Purchase Item"
      >
        {isAddItemModalOpen && (
          <PurchaseItemAddForm
            purchaseId={id}
            onClose={() => setIsAddItemModalOpen(false)}
          />
        )}
      </Modal>

      {/* Delete Purchase Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeletePurchase}
        title="Delete Purchase"
        message="Are you sure you want to delete this purchase? This action cannot be undone."
        confirmLabel="Delete"
        danger={true}
        isConfirming={deletePurchaseMutation.isLoading}
      />

      {/* Invoice Preview Modal */}
      <InvoicePreviewModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        purchaseId={id}
        shippingCode={purchase.shipping_code}
      />

    </div>
  );
}
