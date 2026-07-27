import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInventoryItem } from '../../hooks/useInventory.js';
import { Card, Badge, Button, KeyValueGrid, StatCard } from '../../components/common/index.js';

export default function InventoryDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: item, isLoading, isError, error } = useInventoryItem(id);

  if (isLoading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
        <i className="ri-loader-4-line spinner-icon" style={{ fontSize: '2rem' }}></i>
        <p style={{ marginTop: '16px' }}>Loading stock details...</p>
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--danger-color, #ef4444)' }}>
        <i className="ri-error-warning-line" style={{ fontSize: '3rem' }}></i>
        <h2>Stock Record Not Found</h2>
        <p style={{ marginTop: '8px' }}>{error?.message || "The inventory record you're looking for doesn't exist or an error occurred."}</p>
        <Button variant="outline" onClick={() => navigate('/inventory')} style={{ marginTop: '16px' }}>
          Back to Inventory
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

  const getStatusBadge = (isTrue, trueText, falseText, reverseColor = false) => {
    if (isTrue) {
      return <Badge variant={reverseColor ? 'danger' : 'warning'}>{trueText}</Badge>;
    }
    return <Badge variant="success">{falseText}</Badge>;
  };

  return (
    <div className="page-container details-page-wrapper">
      {/* Header Area */}
      <div className="details-header">
        <div className="details-header-left">
          <button className="back-btn" onClick={() => navigate('/inventory')}>
            <i className="ri-arrow-left-line"></i>
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
              <h1 className="page-title">{item.product_name}</h1>
              {getStatusBadge(item.is_sold_out, 'Sold Out', 'In Stock', true)}
            </div>
            <p style={{ color: 'var(--text-muted)' }}>
              {item.item_code} • Factory: {item.factory_name}
            </p>
          </div>
        </div>

        <div className="details-header-actions">
          <Button
            variant="outline"
            leftIcon="ri-truck-line"
            onClick={() => navigate(`/purchases/${item.purchase}`)}
          >
            View Purchase
          </Button>
        </div>
      </div>

      {/* Metrics & Status Section */}
      <div style={{ marginTop: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <i className="ri-bar-chart-box-line" style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}></i>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Stock Overview</h3>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
          <StatCard
            label="Remaining Bags"
            value={item.remaining_bags}
            icon="ri-box-3-line"
            valueColor={item.is_sold_out ? 'var(--danger-color, #ef4444)' : 'var(--text-color)'}
            iconColor={item.is_sold_out ? 'var(--danger-color, #ef4444)' : 'var(--primary-color, #2563eb)'}
            iconBg={item.is_sold_out ? 'rgba(239, 68, 68, 0.1)' : 'var(--primary-color-light, rgba(37, 99, 235, 0.1))'}
          />
          <StatCard
            label="Remaining Pieces"
            value={item.remaining_pieces}
            icon="ri-function-line"
          />
          <StatCard
            label="Stock Value"
            value={formatCurrency(item.stock_value, item.currency)}
            icon="ri-money-dollar-circle-line"
            valueColor="var(--success-color, #10b981)"
            iconColor="var(--success-color, #10b981)"
            iconBg="rgba(16, 185, 129, 0.15)"
          />
          <StatCard
            label="Sold Bags"
            value={item.sold_bags}
            icon="ri-shopping-cart-2-line"
            iconColor="var(--warning-color, #f59e0b)"
            iconBg="rgba(245, 158, 11, 0.15)"
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>

        {/* Product Information Card */}
        <Card>
          <Card.Header title="Product Information" icon="ri-information-line" />
          <Card.Body>
            <KeyValueGrid items={[
              { label: 'Product Name', value: item.product_name },
              { label: 'Item Code', value: item.item_code },
              { label: 'Factory', value: item.factory_name },
              { label: 'Shipping Code', value: item.shipping_code || '-' },
              { label: 'Purchase Date', value: formatDate(item.purchase_date) }
            ]} />
          </Card.Body>
        </Card>

        {/* Purchase Information Card */}
        <Card>
          <Card.Header title="Purchase Information" icon="ri-shopping-bag-3-line" />
          <Card.Body>
            <KeyValueGrid items={[
              { label: 'Purchase Price', value: formatCurrency(item.purchase_price, item.currency) },
              { label: 'Price Type', value: item.price_type === 'per_piece' ? 'Per Piece' : item.price_type === 'per_bag' ? 'Per Bag' : item.price_type },
              { label: 'Cost Per Piece', value: formatCurrency(item.cost_per_piece, item.currency) },
              { label: 'Currency', value: item.currency },
              { label: 'Pieces Per Bag', value: item.pcs_per_bag }
            ]} />
          </Card.Body>
        </Card>

        {/* Stock Summary Card */}
        <Card>
          <Card.Header title="Stock Summary" icon="ri-archive-line" />
          <Card.Body>
            <KeyValueGrid items={[
              { label: 'Total Bags Purchased', value: item.total_bags_purchased },
              { label: 'Total Pieces Purchased', value: item.total_pieces_purchased },
              { label: 'Sold Bags', value: item.sold_bags },
              { label: 'Sold Pieces', value: item.sold_pieces },
              { label: 'Remaining Bags', value: item.remaining_bags },
              { label: 'Remaining Pieces', value: item.remaining_pieces },
              { label: 'Stock Value', value: formatCurrency(item.stock_value, item.currency) }
            ]} />
          </Card.Body>
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Status Card */}
          <Card>
            <Card.Header title="Status" icon="ri-flag-line" />
            <Card.Body>
              <KeyValueGrid items={[
                { label: 'Sold Out', value: getStatusBadge(item.is_sold_out, 'Yes', 'No', true) },
                { label: 'Low Stock', value: getStatusBadge(item.is_low_stock, 'Yes', 'No', false) }
              ]} />
            </Card.Body>
          </Card>

          {/* System Information Card */}
          <Card>
            <Card.Header title="System Information" icon="ri-settings-4-line" />
            <Card.Body>
              <KeyValueGrid items={[
                { label: 'Created At', value: formatDateTime(item.created_at) }
              ]} />
            </Card.Body>
          </Card>
        </div>

      </div>
    </div>
  );
}
