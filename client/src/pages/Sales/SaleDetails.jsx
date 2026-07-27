import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSale, useSaleItems, useDeleteSaleItem, useDeleteSale } from '../../hooks/useSales.js';
import { usePaymentMethods } from '../../services/paymentService.js';
import { Card, Badge, Button, DataTable, Modal, ConfirmationDialog, KeyValueGrid, StatCard } from '../../components/common/index.js';
import { showToast } from '../../utils/toast.js';
import { handleBackendErrors } from '../../utils/errorHandler.js';
import SaleFullEditForm from './SaleFullEditForm.jsx';
import SaleItemEditForm from './SaleItemEditForm.jsx';
import SaleItemAddForm from './SaleItemAddForm.jsx';
import SaleInvoicePreviewModal from './SaleInvoicePreviewModal.jsx';

export default function SaleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: sale, isLoading, isError, error } = useSale(id);
  const { data: paymentMethods } = usePaymentMethods();
  const deleteItemMutation = useDeleteSaleItem();
  const deleteSaleMutation = useDeleteSale();

  const [selectedItem, setSelectedItem] = useState(null); // For View action
  const [editingItem, setEditingItem] = useState(null); // For Item Edit
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false); // For Item Add
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // For Sale Edit
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false); // For Sale Delete
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false); // For Invoice Preview

  // Sale Items State
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsSearch, setItemsSearch] = useState('');
  const [itemsActiveSort, setItemsActiveSort] = useState('');
  const [itemsFilters, setItemsFilters] = useState({ sell_price_type: '' });

  // Fetch Sale Items
  const itemsQueryParams = {
    sale: id,
    page: itemsPage,
    search: itemsSearch || undefined,
    ordering: itemsActiveSort || undefined,
    ...(itemsFilters.sell_price_type ? { sell_price_type: itemsFilters.sell_price_type } : {})
  };
  const { data: itemsData, isLoading: itemsLoading } = useSaleItems(itemsQueryParams);

  const handleDeleteSale = () => {
    const toastId = showToast.loading('Deleting sale...');
    deleteSaleMutation.mutate(id, {
      onSuccess: () => {
        showToast.success('Deleted', 'Sale deleted successfully');
        showToast.dismiss(toastId);
        setIsDeleteModalOpen(false);
        navigate('/sales');
      },
      onError: (err) => {
        showToast.dismiss(toastId);
        handleBackendErrors(err, null, 'Failed to delete sale');
      }
    });
  };

  if (isLoading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <i className="ri-loader-4-line spinner-icon" style={{ fontSize: '2rem' }}></i>
        <p style={{ marginTop: '16px' }}>Loading sale details...</p>
      </div>
    );
  }

  if (isError || !sale) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--danger-color, #ef4444)' }}>
        <i className="ri-error-warning-line" style={{ fontSize: '3rem' }}></i>
        <h2>Sale Not Found</h2>
        <p style={{ marginTop: '8px' }}>{error?.message || "The sale you're looking for doesn't exist or an error occurred."}</p>
        <Button variant="outline" onClick={() => navigate('/sales')} style={{ marginTop: '16px' }}>
          Back to Sales
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

  // Payment status badge helper
  const getPaymentStatusBadge = () => {
    const status = sale.payment_status;
    const statusMap = {
      'Fully Paid': 'success',
      'Partial': 'warning',
      'Unpaid': 'danger',
      'No Items': 'default'
    };
    return <Badge variant={statusMap[status] || 'default'}>{status}</Badge>;
  };

  // Payment type display
  const getPaymentTypeLabel = () => {
    const map = { cash: 'Cash', credit: 'Credit', partial: 'Partial Payment' };
    return map[sale.payment_type] || sale.payment_type || '-';
  };

  // Payment method display
  const getPaymentMethodLabel = () => {
    if (!sale.payment_method) return '-';
    if (!paymentMethods) return sale.payment_method; // fallback while loading

    const methodsArray = Array.isArray(paymentMethods) ? paymentMethods : (paymentMethods.results || []);
    const methodObj = methodsArray.find(m => m.value === sale.payment_method);

    return methodObj ? methodObj.label : sale.payment_method;
  };

  // Item table columns
  const itemColumns = [
    { key: 'product_name', title: 'Product Name', sortable: false },
    { key: 'item_code', title: 'Item Code', sortable: false },
    { key: 'factory_name', title: 'Factory', sortable: false },
    { key: 'shipping_code', title: 'Shipping Code', sortable: false },
    { key: 'bags_sold', title: 'Bags Sold', sortable: false },
    { key: 'pieces_sold', title: 'Pieces Sold', sortable: false },
    {
      key: 'selling_price',
      title: 'Selling Price',
      render: (val) => formatCurrency(val, sale.currency)
    },
    {
      key: 'sell_price_type',
      title: 'Price Type',
      render: (val) => {
        if (val === 'per_piece') return <Badge variant="info">Per Piece</Badge>;
        if (val === 'per_bag') return <Badge variant="primary">Per Bag</Badge>;
        return <Badge variant="default">{val}</Badge>;
      }
    },
    {
      key: 'total_line_amount',
      title: 'Total Amount',
      render: (val) => <span style={{ fontWeight: 600 }}>{formatCurrency(val, sale.currency)}</span>
    },
    {
      key: 'profit',
      title: 'Profit',
      render: (val) => {
        const amt = parseFloat(val || 0);
        return (
          <span style={{ fontWeight: 600, color: amt >= 0 ? 'var(--success-color, #10b981)' : 'var(--danger-color, #ef4444)' }}>
            {formatCurrency(val, sale.currency)}
          </span>
        );
      }
    }
  ];

  const handleDeleteItem = (item) => {
    if (window.confirm(`Are you sure you want to delete this sale item? This action cannot be undone.`)) {
      const toastId = showToast.loading('Deleting sale item...');
      deleteItemMutation.mutate(item.id, {
        onSuccess: () => {
          showToast.success('Deleted', 'Sale item deleted successfully');
          showToast.dismiss(toastId);
        },
        onError: (err) => {
          showToast.dismiss(toastId);
          handleBackendErrors(err, null, 'Failed to delete sale item');
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
      key: 'sell_price_type',
      type: 'select',
      label: 'Price Type',
      placeholder: 'All Types',
      value: itemsFilters.sell_price_type,
      options: [
        { value: '', label: 'All Types' },
        { value: 'per_piece', label: 'Per Piece' },
        { value: 'per_bag', label: 'Per Bag' }
      ]
    }
  ];

  const itemsSortConfig = [
    { value: '', label: 'Default' },
    { value: 'stock_batch__item_code', label: 'Item Code (A-Z)' },
    { value: '-stock_batch__item_code', label: 'Item Code (Z-A)' },
    { value: 'total_line_amount', label: 'Total Amount (Low-High)' },
    { value: '-total_line_amount', label: 'Total Amount (High-Low)' },
    { value: 'selling_price', label: 'Price (Low-High)' },
    { value: '-selling_price', label: 'Price (High-Low)' },
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

  // Calculate total profit
  const totalProfit = sale.total_profit !== undefined ? sale.total_profit : 0;
  const profitValue = parseFloat(totalProfit);

  return (
    <div className="page-container details-page-wrapper">
      {/* Header Area */}
      <div className="details-header">
        <div className="details-header-left">
          <button className="back-btn" onClick={() => navigate('/sales')}>
            <i className="ri-arrow-left-line"></i>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <h1 className="page-title">Sale #{sale.invoice_number}</h1>
              {getPaymentStatusBadge()}
            </div>
            <p style={{ color: 'var(--text-muted)' }}>
              {sale.customer_name} • {formatDate(sale.date)}
            </p>
          </div>
        </div>

        <div className="details-header-actions">
          <Button variant="outline" leftIcon="ri-file-list-3-line" onClick={() => setIsInvoiceModalOpen(true)}>
            View Invoice
          </Button>
          <Button variant="outline" leftIcon="ri-edit-line" onClick={() => setIsEditModalOpen(true)}>
            Edit Sale
          </Button>
          <Button variant="danger" leftIcon="ri-delete-bin-line" onClick={() => setIsDeleteModalOpen(true)}>
            Delete Sale
          </Button>
        </div>
      </div>

      {/* Metrics & Status Section */}
      <div style={{ marginTop: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <i className="ri-dashboard-3-line" style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}></i>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Payment Summary</h3>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <StatCard
            label="Total Sale Amount"
            value={formatCurrency(sale.total_sale_amount, sale.currency)}
            icon="ri-bank-card-line"
          />
          <StatCard
            label="Amount Paid"
            value={formatCurrency(sale.amount_paid_now, sale.currency)}
            icon="ri-checkbox-circle-line"
            valueColor="var(--success-color, #10b981)"
            iconColor="var(--success-color, #10b981)"
            iconBg="rgba(16, 185, 129, 0.15)"
          />
          <StatCard
            label="Credit Amount"
            value={formatCurrency(sale.credit_amount, sale.currency)}
            icon="ri-error-warning-line"
            valueColor={parseFloat(sale.credit_amount) > 0 ? 'var(--danger-color, #ef4444)' : 'var(--text-color)'}
            iconColor={parseFloat(sale.credit_amount) > 0 ? 'var(--danger-color, #ef4444)' : 'var(--text-muted)'}
            iconBg={parseFloat(sale.credit_amount) > 0 ? 'rgba(239, 68, 68, 0.15)' : undefined}
          />
          <StatCard
            label="Total Profit"
            value={formatCurrency(totalProfit, sale.currency)}
            icon="ri-line-chart-line"
            valueColor={profitValue >= 0 ? 'var(--success-color, #10b981)' : 'var(--danger-color, #ef4444)'}
            iconColor={profitValue >= 0 ? 'var(--success-color, #10b981)' : 'var(--danger-color, #ef4444)'}
            iconBg={profitValue >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}
          />
        </div>
      </div>

      {/* Sale Information Card */}
      <div style={{ marginBottom: '24px' }}>
        <Card>
          <Card.Header title="Sale Information" icon="ri-information-line" />
          <Card.Body>
            <KeyValueGrid items={[
              { label: 'Customer', value: sale.customer_name },
              { label: 'Sale Date', value: formatDate(sale.date) },
              { label: 'Invoice Number', value: sale.invoice_number },
              { label: 'Currency', value: sale.currency || 'ETB' },
              { label: 'Payment Type', value: getPaymentTypeLabel() },
              { label: 'Payment Method', value: getPaymentMethodLabel() },
              { label: 'Created At', value: formatDateTime(sale.created_at) },
              { label: 'Updated At', value: formatDateTime(sale.updated_at) },
            ]} />

            {/* Notes Section */}
            {sale.notes && (
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
                  {sale.notes}
                </div>
              </div>
            )}
          </Card.Body>
        </Card>
      </div>

      {/* Sale Items Section */}
      <div style={{ marginTop: '24px' }}>
        <Card>
          <Card.Header title="Sale Items" icon="ri-shopping-cart-2-line" />
          <Card.Body style={{ padding: 0 }}>
            <DataTable
              columns={itemColumns}
              data={itemsData?.results || sale.items || []}
              rowActions={itemActions}
              keyField="id"
              emptyMessage="No items found for this sale."
              isLoading={itemsLoading}

              toolbarActions={
                <Button
                  variant="primary"
                  leftIcon="ri-add-line"
                  onClick={() => setIsAddItemModalOpen(true)}
                >
                  Add Item
                </Button>
              }

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
        title="Sale Item Details"
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
                    <span className="info-value">{selectedItem.factory_name || '-'}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Shipping Code</span>
                    <span className="info-value">{selectedItem.shipping_code || '-'}</span>
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
                      {selectedItem.sell_price_type === 'per_piece' ? <Badge variant="info">Per Piece</Badge> :
                        selectedItem.sell_price_type === 'per_bag' ? <Badge variant="primary">Per Bag</Badge> :
                          <Badge variant="default">{selectedItem.sell_price_type}</Badge>}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Selling Price</span>
                    <span className="info-value" style={{ fontWeight: 600 }}>
                      {formatCurrency(selectedItem.selling_price, sale.currency)}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Selling Price Per Piece</span>
                    <span className="info-value">
                      {formatCurrency(selectedItem.selling_price_per_piece, sale.currency)}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Purchase Cost Per Piece</span>
                    <span className="info-value">
                      {formatCurrency(selectedItem.purchase_cost_per_piece, sale.currency)}
                    </span>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header title="Quantity" icon="ri-box-3-line" />
              <Card.Body>
                <div className="info-list">
                  <div className="info-item">
                    <span className="info-label">Pieces Per Bag</span>
                    <span className="info-value">{selectedItem.pcs_per_bag}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Bags Sold</span>
                    <span className="info-value">{selectedItem.bags_sold}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Pieces Sold</span>
                    <span className="info-value">{selectedItem.pieces_sold}</span>
                  </div>
                  <div className="info-item" style={{ borderTop: '1px solid var(--border-color)', marginTop: '8px', paddingTop: '16px' }}>
                    <span className="info-label">Total Line Amount</span>
                    <span className="info-value" style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                      {formatCurrency(selectedItem.total_line_amount, sale.currency)}
                    </span>
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Card>
              <Card.Header title="Profit" icon="ri-line-chart-line" />
              <Card.Body>
                <div className="info-list">
                  <div className="info-item">
                    <span className="info-label">Profit</span>
                    <span className="info-value" style={{
                      fontWeight: 600,
                      fontSize: '1.1rem',
                      color: parseFloat(selectedItem.profit || 0) >= 0 ? 'var(--success-color, #10b981)' : 'var(--danger-color, #ef4444)'
                    }}>
                      {formatCurrency(selectedItem.profit, sale.currency)}
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

      {/* Edit Sale Item Modal */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Edit Sale Item"
      >
        {editingItem && (
          <SaleItemEditForm
            item={editingItem}
            saleId={id}
            onClose={() => setEditingItem(null)}
          />
        )}
      </Modal>

      {/* Add Sale Item Modal */}
      <Modal
        isOpen={isAddItemModalOpen}
        onClose={() => setIsAddItemModalOpen(false)}
        title="Add Sale Item"
      >
        {isAddItemModalOpen && (
          <SaleItemAddForm
            saleId={id}
            onClose={() => setIsAddItemModalOpen(false)}
          />
        )}
      </Modal>

      {/* Edit Sale Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Sale"
      >
        {isEditModalOpen && (
          <SaleFullEditForm
            initialData={sale}
            onSuccess={() => setIsEditModalOpen(false)}
            onCancel={() => setIsEditModalOpen(false)}
          />
        )}
      </Modal>

      {/* Delete Sale Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteSale}
        title="Delete Sale"
        message="Are you sure you want to delete this sale? This will return all sold stock to inventory. This action cannot be undone."
        confirmLabel="Delete"
        danger={true}
        isConfirming={deleteSaleMutation.isLoading}
      />

      <SaleInvoicePreviewModal
        isOpen={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        saleId={id}
        invoiceNumber={sale.invoice_number}
      />

    </div>
  );
}
