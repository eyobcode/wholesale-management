"""
Main URL configuration for the business app.
All app URLs are included under /api/ prefix.

API Endpoints:
    /api/settings/             → App settings (singleton)
    /api/customers/            → Customer CRUD
    /api/factories/            → Factory CRUD
    /api/purchases/            → Purchase CRUD (with nested items)
    /api/purchase-items/       → Standalone purchase item CRUD
    /api/stock/                → Stock batch list (read-only)
    /api/stock/summary/        → Aggregated stock by item_code
    /api/stock/available/      → Batches with remaining stock
    /api/stock/low-stock/      → Low stock and sold out alerts
    /api/sales/                → Sale CRUD (with nested items)
    /api/sale-items/           → Standalone sale item CRUD
    /api/income/               → Customer income records
    /api/factory-payments/     → Factory payment records
    /api/expenses/             → General expense records
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/', include('apps.dashboard.urls')),

    path('api/', include('apps.core.urls')),
    path('api/', include('apps.customers.urls')),
    path('api/', include('apps.factories.urls')),
    path('api/', include('apps.inventory.urls')),
    path('api/', include('apps.payments.urls')),
    path('api/', include('apps.purchases.urls')),
    path('api/', include('apps.sales.urls')),
    path('api/', include('apps.shareholders.urls')),
]
