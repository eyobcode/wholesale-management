import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/common/index.js';
import { FormField, Input, Select, TextArea, AsyncSelect } from '../../components/common/Form/index.jsx';
import { saleService } from '../../services/saleService.js';
import { useCreateSale } from '../../hooks/useSales.js';
import { showToast } from '../../utils/toast.js';
import { handleBackendErrors } from '../../utils/errorHandler.js';

export default function SaleCreate() {
  const navigate = useNavigate();
  const createMutation = useCreateSale();
  
  const [stockOptionsCache, setStockOptionsCache] = useState({});
  
  const [formData, setFormData] = useState({
    customer: null,
    date: new Date().toISOString().split('T')[0],
    currency: 'ETB',

    amount_paid_now: '',
    payment_method: null,
    notes: '',
    items: [
      {
        stock_batch: '',
        bags_sold: '',
        sell_price_type: 'per_piece',
        selling_price: ''
      }
    ]
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleCustomerChange = (customerId) => {
    setFormData(prev => ({ ...prev, customer: customerId }));
    if (errors.customer) {
      setErrors(prev => ({ ...prev, customer: null }));
    }
  };

  const handlePaymentMethodChange = (methodId) => {
    setFormData(prev => ({ ...prev, payment_method: methodId }));
    if (errors.payment_method) {
      setErrors(prev => ({ ...prev, payment_method: null }));
    }
  };

  const handleItemChange = (index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev.items];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, items: newItems };
    });
    if (errors[`items.${index}.${field}`]) {
      setErrors(prev => ({ ...prev, [`items.${index}.${field}`]: null }));
    }
  };

  const handleAddItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          stock_batch: '',
          bags_sold: '',
          sell_price_type: 'per_piece',
          selling_price: ''
        }
      ]
    }));
  };

  const handleRemoveItem = (index) => {
    if (formData.items.length === 1) return; // do not allow removing last item
    setFormData(prev => {
      const newItems = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: newItems };
    });
  };

  const getLineTotal = (item) => {
    const price = parseFloat(item.selling_price) || 0;
    const bags = parseFloat(item.bags_sold) || 0;
    
    if (item.sell_price_type === 'per_piece') {
      const stock = stockOptionsCache[item.stock_batch];
      const pcs = stock && stock.pcs_per_bag ? stock.pcs_per_bag : 0;
      return price * pcs * bags;
    }
    return price * bags;
  };

  const handleContinue = () => {
    // Basic frontend validation
    const newErrors = {};
    if (!formData.customer) newErrors.customer = 'Customer is required';
    if (!formData.date) newErrors.date = 'Date is required';
    if (!formData.currency) newErrors.currency = 'Currency is required';


    formData.items.forEach((item, index) => {
      if (!item.stock_batch) newErrors[`items.${index}.stock_batch`] = 'Required';
      if (!item.bags_sold) newErrors[`items.${index}.bags_sold`] = 'Required';
      if (!item.selling_price) newErrors[`items.${index}.selling_price`] = 'Required';
    });
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast.error('Validation Error', 'Please fill all required fields.');
      return;
    }

    // Submit payload (payment_type is determined server-side)
    const { payment_type, ...restFormData } = formData;
    const payload = {
      ...restFormData,
      amount_paid_now: formData.amount_paid_now ? parseFloat(formData.amount_paid_now) : 0,
      items: formData.items.map(item => ({
        ...item,
        bags_sold: parseFloat(item.bags_sold),
        selling_price: parseFloat(item.selling_price)
      }))
    };

    const toastId = showToast.loading('Creating sale...');
    createMutation.mutate(payload, {
      onSuccess: (data) => {
        showToast.success('Success', 'Sale created successfully');
        showToast.dismiss(toastId);
        navigate(`/sales/${data.id}`);
      },
      onError: (err) => {
        showToast.dismiss(toastId);
        // Handle nested item errors manually
        if (err && typeof err === 'object') {
          const backendErrors = {};
          Object.keys(err).forEach(key => {
            if (key === 'items' && Array.isArray(err[key])) {
              err[key].forEach((itemErr, i) => {
                if (itemErr) {
                  Object.keys(itemErr).forEach(itemKey => {
                    backendErrors[`items.${i}.${itemKey}`] = Array.isArray(itemErr[itemKey]) ? itemErr[itemKey][0] : itemErr[itemKey];
                  });
                }
              });
            } else {
              backendErrors[key] = Array.isArray(err[key]) ? err[key][0] : err[key];
            }
          });
          setErrors(backendErrors);
        }
        handleBackendErrors(err, null, 'Failed to create sale');
      }
    });
  };

  const loadCustomerOptions = async (search) => {
    try {
      const res = await saleService.getCustomerOptions(search);
      return Array.isArray(res) ? res : (res.results || []);
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const loadPaymentMethodOptions = async (search) => {
    try {
      const res = await saleService.getPaymentMethodOptions(search);
      return Array.isArray(res) ? res : (res.results || []);
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const loadStockOptions = async (search) => {
    try {
      const res = await saleService.getStockOptions(search);
      const opts = Array.isArray(res) ? res : (res.results || []);
      
      setStockOptionsCache(prev => {
        const next = { ...prev };
        opts.forEach(o => { next[o.value] = o; });
        return next;
      });
      
      return opts;
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="details-header" style={{ marginBottom: '24px' }}>
        <div className="details-header-left">
          <button className="back-btn" onClick={() => navigate('/sales')} title="Back to Sales">
            <i className="ri-arrow-left-line"></i>
          </button>
          <div>
            <h1 className="page-title">Create Sale</h1>
            <p className="page-subtitle">Enter the details for a new customer sale</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <Card>
          <Card.Header title="Sale Details" icon="ri-file-text-line" />
          <Card.Body>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Core Information */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '20px' }}>
                  <FormField label="Customer" required error={errors.customer}>
                    <AsyncSelect 
                      value={formData.customer}
                      onChange={handleCustomerChange}
                      loadOptions={loadCustomerOptions}
                      placeholder="Search for a customer..."
                    />
                  </FormField>

                  <FormField label="Sale Date" required error={errors.date}>
                    <Input 
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleChange}
                    />
                  </FormField>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))', gap: '20px' }}>
                  <FormField label="Currency" required error={errors.currency}>
                    <Select 
                      name="currency"
                      value={formData.currency}
                      onChange={handleChange}
                      options={[
                        { label: 'ETB (Birr)', value: 'ETB' },
                        { label: 'USD (Dollar)', value: 'USD' }
                      ]}
                    />
                  </FormField>
                  
                  <FormField label="Payment Method" error={errors.payment_method}>
                    <AsyncSelect
                      loadOptions={loadPaymentMethodOptions}
                      value={formData.payment_method}
                      onChange={handlePaymentMethodChange}
                      placeholder="Search payment method..."
                      error={errors.payment_method}
                    />
                  </FormField>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '20px' }}>
                  <FormField label="Amount Paid Now" error={errors.amount_paid_now}>
                    <Input 
                      type="number"
                      name="amount_paid_now"
                      value={formData.amount_paid_now}
                      onChange={handleChange}
                      placeholder="0.00"
                      step="0.01"
                      min="0"
                    />
                  </FormField>
                </div>

                <FormField label="Notes" error={errors.notes}>
                  <TextArea 
                    name="notes"
                    value={formData.notes}
                    onChange={handleChange}
                    placeholder="Enter any additional notes..."
                    rows={2}
                  />
                </FormField>
              </div>

              {/* Divider */}
              <div style={{ height: '1px', backgroundColor: 'var(--card-border, #e5e7eb)' }} />

              {/* Dynamic Sale Items Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-color)', margin: 0 }}>Sale Items</h3>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {formData.items.map((item, index) => (
                    <div 
                      key={index}
                      style={{
                        position: 'relative',
                        padding: '24px',
                        backgroundColor: 'var(--content-bg, #f9fafb)',
                        border: '1px solid var(--card-border, #e5e7eb)',
                        borderRadius: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                        transition: 'var(--transition)'
                      }}
                    >
                      {/* Top Row: Item # and Delete Button */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Item {index + 1}
                        </span>
                        {formData.items.length > 1 && (
                          <button 
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            style={{ 
                              background: 'transparent', 
                              border: 'none', 
                              color: '#ef4444', 
                              cursor: 'pointer',
                              padding: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '4px'
                            }}
                            title="Remove Item"
                          >
                            <i className="ri-delete-bin-line" style={{ fontSize: '1.2rem' }}></i>
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
                        <FormField label="Stock Batch" required error={errors[`items.${index}.stock_batch`]}>
                          <AsyncSelect 
                            value={item.stock_batch}
                            onChange={(val) => handleItemChange(index, 'stock_batch', val)}
                            loadOptions={loadStockOptions}
                            placeholder="Search available stock..."
                          />
                        </FormField>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '20px' }}>
                        
                        <FormField label="Bags Sold" required error={errors[`items.${index}.bags_sold`]}>
                          <Input 
                            type="number"
                            value={item.bags_sold}
                            onChange={(e) => handleItemChange(index, 'bags_sold', e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                          />
                        </FormField>

                        <FormField label="Sell Price Type" required>
                          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', height: '40px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                              <input 
                                type="radio" 
                                name={`sell_price_type_${index}`} 
                                value="per_piece"
                                checked={item.sell_price_type === 'per_piece'}
                                onChange={(e) => handleItemChange(index, 'sell_price_type', e.target.value)}
                                style={{ accentColor: 'var(--primary-color, #0ea5e9)', width: '16px', height: '16px' }}
                              />
                              Per Piece
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                              <input 
                                type="radio" 
                                name={`sell_price_type_${index}`} 
                                value="per_bag"
                                checked={item.sell_price_type === 'per_bag'}
                                onChange={(e) => handleItemChange(index, 'sell_price_type', e.target.value)}
                                style={{ accentColor: 'var(--primary-color, #0ea5e9)', width: '16px', height: '16px' }}
                              />
                              Per Bag
                            </label>
                          </div>
                        </FormField>

                        <FormField label="Selling Price" required error={errors[`items.${index}.selling_price`]}>
                          <Input 
                            type="number"
                            value={item.selling_price}
                            onChange={(e) => handleItemChange(index, 'selling_price', e.target.value)}
                            placeholder="0.00"
                            step="0.01"
                            min="0"
                          />
                        </FormField>

                      </div>
                    </div>
                  ))}
                  
                </div>

                <div style={{ marginTop: '20px' }}>
                  <button 
                    type="button"
                    onClick={handleAddItem}
                    style={{
                      width: '100%',
                      padding: '16px',
                      background: 'transparent',
                      border: '2px dashed var(--card-border, #e5e7eb)',
                      borderRadius: '12px',
                      color: 'var(--text-muted)',
                      fontSize: '1rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--text-muted)';
                      e.currentTarget.style.color = 'var(--text-color)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--card-border, #e5e7eb)';
                      e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                  >
                    <i className="ri-add-line" style={{ fontSize: '1.2rem' }}></i>
                    Add Another Item
                  </button>
                </div>
              </div>

              {/* Grand Total Section */}
              <div style={{
                marginTop: '16px',
                padding: '24px',
                backgroundColor: 'rgba(14, 165, 233, 0.05)',
                border: '1px solid rgba(14, 165, 233, 0.2)',
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-color)' }}>Grand Total</span>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Sum of all sale items</span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0ea5e9' }}>
                  {formData.items.reduce((sum, item) => sum + getLineTotal(item), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {formData.currency}
                </div>
              </div>

            </div>
          </Card.Body>
          
          {/* Unified Footer */}
          <div style={{ 
            padding: '24px', 
            borderTop: '1px solid var(--card-border, #e5e7eb)',
            backgroundColor: 'var(--content-bg, #f9fafb)',
            borderBottomLeftRadius: '12px',
            borderBottomRightRadius: '12px',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '16px'
          }}>
            <Button variant="secondary" onClick={() => navigate('/sales')} disabled={createMutation.isLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleContinue} isLoading={createMutation.isLoading}>
              Create Sale
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
