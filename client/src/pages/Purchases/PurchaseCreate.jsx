import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button } from '../../components/common/index.js';
import { FormField, Input, Select, TextArea, AsyncSelect } from '../../components/common/Form/index.jsx';
import { factoryService } from '../../services/factoryService.js';
import { useCreatePurchase, purchaseService } from '../../services/purchaseService.js';
import { showToast } from '../../utils/toast.js';
import { handleBackendErrors } from '../../utils/errorHandler.js';

export default function PurchaseCreate() {
  const navigate = useNavigate();
  const createMutation = useCreatePurchase();
  const [formData, setFormData] = useState({
    factory: null,
    date: new Date().toISOString().split('T')[0],
    currency: 'ETB',
    payment_method: null,
    amount_paid_now: '',
    notes: '',
    items: [
      {
        item_code: '',
        product_name: '',
        price_type: 'per_piece',
        purchase_price: '',
        pcs_per_bag: '',
        total_bags_purchased: '',
        currency: 'ETB'
      }
    ]
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleFactoryChange = (factoryId) => {
    setFormData(prev => ({ ...prev, factory: factoryId }));
    if (errors.factory) {
      setErrors(prev => ({ ...prev, factory: null }));
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
    // Clear error for this item field if exists
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
          item_code: '',
          product_name: '',
          price_type: 'per_piece',
          purchase_price: '',
          pcs_per_bag: '',
          total_bags_purchased: '',
          currency: 'ETB'
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
    const price = parseFloat(item.purchase_price) || 0;
    const bags = parseInt(item.total_bags_purchased, 10) || 0;
    const pcs = parseInt(item.pcs_per_bag, 10) || 0;
    
    if (item.price_type === 'per_piece') {
      return price * pcs * bags;
    }
    return price * bags;
  };

  const handleContinue = () => {
    // Basic frontend validation
    const newErrors = {};
    if (!formData.factory) newErrors.factory = 'Factory is required';
    if (!formData.date) newErrors.date = 'Date is required';
    if (!formData.currency) newErrors.currency = 'Currency is required';

    formData.items.forEach((item, index) => {
      if (!item.item_code) newErrors[`items.${index}.item_code`] = 'Required';
      if (!item.product_name) newErrors[`items.${index}.product_name`] = 'Required';
      if (!item.purchase_price) newErrors[`items.${index}.purchase_price`] = 'Required';
      if (!item.pcs_per_bag) newErrors[`items.${index}.pcs_per_bag`] = 'Required';
      if (!item.total_bags_purchased) newErrors[`items.${index}.total_bags_purchased`] = 'Required';
    });
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast.error('Validation Error', 'Please fill all required fields.');
      return;
    }

    // Submit payload matching requirements exactly
    const payload = {
      ...formData,
      amount_paid_now: formData.amount_paid_now ? parseFloat(formData.amount_paid_now) : 0,
      payment_method: formData.payment_method || null,
      items: formData.items.map(item => ({
        ...item,
        purchase_price: parseFloat(item.purchase_price),
        pcs_per_bag: parseInt(item.pcs_per_bag, 10),
        total_bags_purchased: parseInt(item.total_bags_purchased, 10)
      }))
    };

    const toastId = showToast.loading('Creating purchase...');
    createMutation.mutate(payload, {
      onSuccess: (data) => {
        showToast.success('Success', 'Purchase created successfully');
        showToast.dismiss(toastId);
        navigate(`/purchases/${data.id}`);
      },
      onError: (err) => {
        showToast.dismiss(toastId);
        // Handle nested item errors manually, then fall through to handleBackendErrors for top-level
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
        handleBackendErrors(err, null, 'Failed to create purchase');
      }
    });
  };

  const loadFactoryOptions = async (search) => {
    return await factoryService.getFactoryOptions(search);
  };

  const loadPaymentMethodOptions = async (search) => {
    try {
      const res = await purchaseService.getPaymentMethodOptions(search);
      return Array.isArray(res) ? res : (res.results || []);
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
          <button className="back-btn" onClick={() => navigate('/purchases')} title="Back to Purchases">
            <i className="ri-arrow-left-line"></i>
          </button>
          <div>
            <h1 className="page-title">Create Purchase</h1>
            <p className="page-subtitle">Enter the details for a new purchase order</p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <Card>
          <Card.Header title="Purchase Details" icon="ri-file-text-line" />
          <Card.Body>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* Core Information */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '20px' }}>
                  <FormField label="Factory" required error={errors.factory}>
                    <AsyncSelect 
                      value={formData.factory}
                      onChange={handleFactoryChange}
                      loadOptions={loadFactoryOptions}
                      placeholder="Search for a factory..."
                    />
                  </FormField>

                  <FormField label="Purchase Date" required error={errors.date}>
                    <Input 
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleChange}
                    />
                  </FormField>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '20px' }}>
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

              {/* Dynamic Purchase Items Section */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-color)', margin: 0 }}>Purchase Items</h3>
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

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '20px' }}>
                        <FormField label="Item Code" required error={errors[`items.${index}.item_code`]}>
                          <Input 
                            value={item.item_code}
                            onChange={(e) => handleItemChange(index, 'item_code', e.target.value)}
                            placeholder="e.g. SOCK-01"
                          />
                        </FormField>
                        <FormField label="Product Name" required error={errors[`items.${index}.product_name`]}>
                          <Input 
                            value={item.product_name}
                            onChange={(e) => handleItemChange(index, 'product_name', e.target.value)}
                            placeholder="e.g. Ankle Socks"
                          />
                        </FormField>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '20px' }}>
                        <FormField label="Price Type" required>
                          <div style={{ display: 'flex', gap: '20px', alignItems: 'center', height: '40px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                              <input 
                                type="radio" 
                                name={`price_type_${index}`} 
                                value="per_piece"
                                checked={item.price_type === 'per_piece'}
                                onChange={(e) => handleItemChange(index, 'price_type', e.target.value)}
                                style={{ accentColor: 'var(--primary-color, #0ea5e9)', width: '16px', height: '16px' }}
                              />
                              Per Piece
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.95rem' }}>
                              <input 
                                type="radio" 
                                name={`price_type_${index}`} 
                                value="per_bag"
                                checked={item.price_type === 'per_bag'}
                                onChange={(e) => handleItemChange(index, 'price_type', e.target.value)}
                                style={{ accentColor: 'var(--primary-color, #0ea5e9)', width: '16px', height: '16px' }}
                              />
                              Per Bag
                            </label>
                          </div>
                        </FormField>

                        <FormField label="Purchase Price" required error={errors[`items.${index}.purchase_price`]}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ flex: 2 }}>
                              <Input 
                                type="number"
                                value={item.purchase_price}
                                onChange={(e) => handleItemChange(index, 'purchase_price', e.target.value)}
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                              />
                            </div>
                            <div style={{ flex: 1 }}>
                              <Select 
                                value={item.currency}
                                onChange={(e) => handleItemChange(index, 'currency', e.target.value)}
                                options={[
                                  { label: 'ETB', value: 'ETB' },
                                  { label: 'USD', value: 'USD' }
                                ]}
                              />
                            </div>
                          </div>
                        </FormField>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: '20px' }}>
                          <FormField label="Pcs / Bag" required error={errors[`items.${index}.pcs_per_bag`]}>
                            <Input 
                              type="number"
                              value={item.pcs_per_bag}
                              onChange={(e) => handleItemChange(index, 'pcs_per_bag', e.target.value)}
                              placeholder="24"
                              min="1"
                            />
                          </FormField>
                          <FormField label="Total Bags" required error={errors[`items.${index}.total_bags_purchased`]}>
                            <Input 
                              type="number"
                              value={item.total_bags_purchased}
                              onChange={(e) => handleItemChange(index, 'total_bags_purchased', e.target.value)}
                              placeholder="5"
                              min="1"
                            />
                          </FormField>
                        </div>
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
                marginTop: '32px',
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
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Sum of all purchase items</span>
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
            <Button variant="secondary" onClick={() => navigate('/purchases')} disabled={createMutation.isLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleContinue} isLoading={createMutation.isLoading}>
              Save Purchase Order
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
