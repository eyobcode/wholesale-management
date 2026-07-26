from django.db import models
from ..core.models import TimeStampedModel

class Customer(TimeStampedModel):
    name = models.CharField(
        max_length=255,
        help_text="Full name or business name"
    )
    phone = models.CharField(
        max_length=20,
        blank=True,
        null=True,
        help_text="Main contact number"
    )
    location = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="City, area, or shop location"
    )
    initial_credit = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        help_text=(
            "Debt this customer had BEFORE the app was used. "
            "Added to balance from day one."
        )
    )
    initial_credit_currency = models.CharField(
        max_length=10,
        default='ETB',
        help_text="Currency of the initial credit amount"
    )
    opening_date = models.DateField(
        help_text="Date customer was registered"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="False means archived/hidden, not deleted"
    )

    class Meta:
        ordering = ['name']
        verbose_name = 'Customer'
        verbose_name_plural = 'Customers'

    def __str__(self):
        return self.name

    @property
    def total_sale_credit_amount(self):
        from django.db.models import Sum
        result = self.sales.aggregate(total=Sum('credit_amount'))
        return result['total'] or 0

    @property
    def total_payments_received(self):
        from django.db.models import Sum
        result = self.income_records.aggregate(total=Sum('paid_amount'))
        return result['total'] or 0

    @property
    def current_balance(self):
        return (
                self.initial_credit
                + self.total_sales_amount
                - self.total_payments_received
        )

    @property
    def total_sales_amount(self):
        """Total value of ALL sales to this customer (cash + credit)."""
        from django.db.models import Sum
        result = self.sales.aggregate(total=Sum('total_sale_amount'))
        return result['total'] or 0

    @property
    def last_payment_date(self):
        """Date of most recent payment from this customer."""
        last = self.income_records.order_by('-date').first()
        return last.date if last else None

    @property
    def last_purchase_date(self):
        """Date of most recent sale to this customer."""
        last = self.sales.order_by('-date').first()
        return last.date if last else None

    @property
    def days_since_last_payment(self):
        import datetime
        if self.last_payment_date:
            return (datetime.date.today() - self.last_payment_date).days
        return None