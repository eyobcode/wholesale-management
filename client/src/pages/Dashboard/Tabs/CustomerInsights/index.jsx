import React from 'react';
import { useOverdueCustomers } from '../../../../services/dashboardService.js';
import { formatCurrency, formatDate } from '../../../../utils/formatters.js';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Skeleton from 'react-loading-skeleton';
import './CustomerInsights.css';

export function CustomerInsightsSkeleton() {
  return (
    <>
      <div className="ci-summary-row">
        {[1, 2].map(i => (
          <div key={i} className="ci-summary-card">
            <Skeleton height={14} width={100} style={{ marginBottom: 16 }} />
            <Skeleton height={36} width={150} />
          </div>
        ))}
      </div>
      <div className="ci-middle-row">
        <div className="ci-panel" style={{ flex: 1, minWidth: '300px' }}>
          <div className="ci-panel-header">
            <Skeleton height={24} width={200} />
          </div>
          <div className="ci-panel-content">
            {[1, 2, 3].map(i => (
              <div key={i} style={{ marginBottom: 16 }}>
                <Skeleton height={20} width="100%" style={{ marginBottom: 8 }} />
                <Skeleton height={14} width="80%" />
              </div>
            ))}
          </div>
        </div>
        <div className="ci-panel" style={{ flex: 1, minWidth: '300px' }}>
          <div className="ci-panel-header">
            <Skeleton height={24} width={200} />
          </div>
          <div className="ci-panel-content">
            <Skeleton height={250} borderRadius={16} />
          </div>
        </div>
      </div>
      <div className="ci-panel">
        <div className="ci-panel-header">
          <Skeleton height={24} width={250} />
        </div>
        <div className="ci-panel-content">
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid var(--card-border)' }}>
              <div style={{ flex: 1 }}>
                <Skeleton height={20} width={200} style={{ marginBottom: 8 }} />
                <Skeleton height={16} width={300} />
              </div>
              <div style={{ width: 150, textAlign: 'right' }}>
                <Skeleton height={24} width="100%" style={{ marginBottom: 8 }} />
                <Skeleton height={16} width="80%" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// Colors for the donut chart and badges (using our B&W consistent theme colors)
const getBucketColors = (label) => {
  const l = label.toLowerCase();
  if (l.includes('0-30') || l.includes('1-7') || l.includes('7-15')) {
    return { colorHex: '#eab308', badgeClass: 'stat-bg-success stat-text-success' }; // soft yellow/green
  }
  if (l.includes('30-60') || l.includes('15-30')) {
    return { colorHex: '#f97316', badgeClass: 'stat-bg-info stat-text-info' }; // soft orange
  }
  if (l.includes('60-90') || l.includes('30-60')) {
    return { colorHex: '#ef4444', badgeClass: 'stat-bg-danger stat-text-danger' }; // red
  }
  if (l.includes('90+') || l.includes('60+')) {
    return { colorHex: '#991b1b', badgeClass: 'stat-bg-danger stat-text-danger' }; // dark red
  }
  return { colorHex: '#6b7280', badgeClass: 'stat-bg-primary stat-text-primary' };
};

const CustomDonutTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ backgroundColor: 'var(--card-bg)', padding: '12px', border: '1px solid var(--card-border)', borderRadius: '8px', boxShadow: 'var(--shadow-sm)' }}>
        <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: 'var(--text-color)' }}>{payload[0].name}</p>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Amount: <span style={{ color: 'var(--text-color)', fontWeight: 600 }}>{formatCurrency(payload[0].value)}</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function CustomerInsightsTab() {
  const { data, isLoading, isError } = useOverdueCustomers();

  if (isLoading) {
    return (
      <div className="ci-page">
        <CustomerInsightsSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="ci-page">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', color: '#ef4444' }}>
          <p>Failed to load customer insights data.</p>
        </div>
      </div>
    );
  }

  const { total_overdue_amount = 0, total_overdue_customers = 0, buckets = [], all_overdue = [] } = data || {};

  // Filter buckets for donut chart
  const pieData = buckets.filter(b => b.total_amount > 0).map(b => ({
    name: b.label,
    value: b.total_amount,
    color: getBucketColors(b.label).colorHex
  }));

  return (
    <div className="ci-page">
      {/* 1. Top Stat Cards */}
      <div className="ci-summary-row">
        <div className="ci-summary-card stat-bg-danger">
          <p className="ci-summary-label stat-text-danger">Total Overdue Amount</p>
          <h3 className="ci-summary-value stat-text-danger">{formatCurrency(total_overdue_amount)}</h3>
        </div>
        <div className="ci-summary-card stat-bg-info">
          <p className="ci-summary-label stat-text-info">Overdue Customers</p>
          <h3 className="ci-summary-value stat-text-info">{total_overdue_customers}</h3>
        </div>
      </div>

      {/* 2. Middle Row (Buckets vs Donut) */}
      <div className="ci-middle-row">

        {/* Left: Overdue Buckets List */}
        <div className="ci-panel">
          <div className="ci-panel-header">
            <h2 className="ci-panel-title">Overdue Buckets</h2>
          </div>
          <div className="ci-panel-content">
            {buckets.map(bucket => {
              const { badgeClass } = getBucketColors(bucket.label);
              return (
                <div key={bucket.label} className="ci-bucket-item">
                  <div className="ci-bucket-header">
                    <span className={`ci-badge ${badgeClass}`}>{bucket.label}</span>
                    <div className="ci-bucket-total">
                      <h4 className="ci-bucket-total-amount">{formatCurrency(bucket.total_amount)}</h4>
                      <p className="ci-bucket-total-count">{bucket.count} customers</p>
                    </div>
                  </div>

                  {bucket.customers && bucket.customers.length > 0 && (
                    <div className="ci-bucket-customers">
                      {bucket.customers.slice(0, 2).map(c => (
                        <div key={c.id} className="ci-bucket-customer-row">
                          <span className="ci-bucket-customer-name">{c.name}</span>
                          <div className="ci-bucket-customer-details">
                            <span>{(c.amount / 1000).toFixed(1)}K ETB</span>
                            <span>&middot;</span>
                            <span>{c.days}d</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Distribution Donut Chart */}
        <div className="ci-panel">
          <div className="ci-panel-header">
            <h2 className="ci-panel-title">Distribution by Amount</h2>
          </div>
          <div className="ci-panel-content" style={{ justifyContent: 'center' }}>
            {pieData.length > 0 ? (
              <>
                <div style={{ height: '250px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={120}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomDonutTooltip />} cursor={{ fill: 'transparent' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend */}
                <div className="ci-donut-legend">
                  {pieData.map(entry => (
                    <div key={entry.name} className="ci-legend-item">
                      <span className="ci-legend-dot" style={{ backgroundColor: entry.color }}></span>
                      <span>{entry.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                No overdue data available
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 3. Bottom List: All Overdue Customers */}
      <div className="ci-panel">
        <div className="ci-panel-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="ri-error-warning-line stat-text-danger"></i>
          <h2 className="ci-panel-title">All Overdue Customers (Most Overdue First)</h2>
        </div>

        <div className="ci-customer-list">
          {all_overdue.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No customers are currently overdue.</div>
          ) : (
            // Clone array before sorting to avoid mutating the prop directly if we were in strict mode
            [...all_overdue].sort((a, b) => b.days_since_last_payment - a.days_since_last_payment).map(cust => {
              const { badgeClass } = getBucketColors(cust.bucket);

              return (
                <div key={cust.id} className="ci-customer-row">
                  <div className="ci-customer-left">
                    <div className="ci-customer-name-row">
                      <h3 className="ci-customer-name">{cust.name}</h3>
                      <span className={`ci-badge ${badgeClass}`}>{cust.bucket}</span>
                    </div>
                    <div className="ci-customer-meta">
                      {cust.phone && (
                        <span className="ci-meta-item">
                          <i className="ri-phone-line"></i> {cust.phone}
                        </span>
                      )}
                      {cust.location && (
                        <span className="ci-meta-item">
                          <i className="ri-map-pin-line"></i> {cust.location}
                        </span>
                      )}
                      <span className="ci-meta-item">
                        <i className="ri-calendar-line"></i> Last paid: {cust.last_payment_date ? formatDate(cust.last_payment_date) : 'Never'}
                      </span>
                    </div>
                  </div>

                  <div className="ci-customer-right">
                    <h3 className="ci-customer-balance">{formatCurrency(cust.current_balance)}</h3>
                    <p className="ci-customer-days">{cust.days_since_last_payment} days overdue</p>
                    <div className="ci-customer-paid-summary">
                      <span>Total: {formatCurrency(cust.total_sales_amount)}</span>
                      <span style={{ color: 'var(--text-success, #10b981)', fontWeight: 600 }}>Paid: {formatCurrency(cust.total_paid)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

    </div>
  );
}
