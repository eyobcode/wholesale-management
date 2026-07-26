from django.db import models
from ..core.models import TimeStampedModel, PaymentMethod
from ..factories.models import Factory
from datetime import datetime
from django.utils import timezone


def generate_shipping_code():
    return f"SHP-{datetime.now():%y%m%d}-{datetime.now():%H%M%S}"


class Purchase(TimeStampedModel):
    factory = models.ForeignKey(
        Factory,
        on_delete=models.PROTECT,
        related_name='purchases',
        help_text="Which factory this purchase is from"
    )
    date = models.DateField(
    default = timezone.now,
        help_text="Actual date of purchase"
    )
    shipping_code = models.CharField(
        max_length=20,
        unique=True,
        default=generate_shipping_code,
        help_text="Auto-generated unique shipping/batch code"
    )
    currency = models.CharField(
        max_length=10,
        default='ETB',
        help_text="Currency used for this purchase"
    )
    total_purchase_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        help_text="Sum of all item amounts. Auto-updated when items change."
    )
    amount_paid_now = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        help_text=(
            "Amount paid to factory at purchase time. "
            "0 = buy on credit. Any amount = reduces what you owe."
        )
    )
    unpaid_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        help_text=(
            "total_purchase_amount - amount_paid_now. "
            "This amount is added to factory balance."
        )
    )
    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        blank=True,
        null=True,
        help_text="Payment method used (CBE, Telebirr, etc.)"
    )
    notes = models.TextField(
        blank=True,
        null=True
    )

    class Meta:
        ordering = ['-date', '-created_at']
        verbose_name = 'Purchase'
        verbose_name_plural = 'Purchases'

    def __str__(self):
        return (
            f"Purchase [{self.shipping_code}] "
            f"from {self.factory.name} "
            f"on {self.date}"
        )

    def save(self, *args, **kwargs):
        if not self.date:
            self.date = timezone.now().date()

        if self.pk:
            self.recalculate_totals()
        super().save(*args, **kwargs)


    def recalculate_totals(self):
        from django.db.models import Sum
        result = self.items.aggregate(total=Sum('total_item_amount'))

        self.total_purchase_amount = result['total'] or 0
        self.unpaid_amount = self.total_purchase_amount - self.amount_paid_now

        if self.unpaid_amount < 0:
            self.unpaid_amount = 0

    @property
    def is_fully_editable(self):
        return not self.stock_batches.filter(sold_bags__gt=0).exists()

    @property
    def is_deletable(self):
        return self.is_fully_editable

    @property
    def payment_status(self):
        if self.total_purchase_amount == 0:
            return "No Items"
        elif self.amount_paid_now == 0:
            return "Unpaid"
        elif self.amount_paid_now >= self.total_purchase_amount:
            return "Fully Paid"
        return "Partial"


class PurchaseItem(TimeStampedModel):
    class PriceType(models.TextChoices):
        PER_PIECE = 'per_piece', 'Price Per Piece'
        PER_BAG = 'per_bag', 'Price Per Bag'

    purchase = models.ForeignKey(
        Purchase,
        on_delete=models.CASCADE,
        related_name='items',
        help_text="The purchase order this item belongs to"
    )
    item_code = models.CharField(
        max_length=100,
        help_text="Product code typed freely. Example: SOCK-ANKLE-01"
    )
    product_name = models.CharField(
        max_length=255,
        help_text="Human readable product name"
    )
    price_type = models.CharField(
        max_length=10,
        choices=PriceType.choices,
        default=PriceType.PER_PIECE,
        help_text="Is the price per single piece or per whole bag?"
    )
    purchase_price = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        help_text="Cost price per piece OR per bag depending on price_type"
    )
    pcs_per_bag = models.PositiveIntegerField(
        help_text=(
            "How many pieces in ONE bag. "
            "Example: 24 means one bag contains 24 pieces. "
            "This is critical for stock and sales calculations."
        )
    )
    total_bags_purchased = models.PositiveIntegerField(
        help_text="How many bags were purchased"
    )
    total_pieces_purchased = models.PositiveIntegerField(
        default=0,
        help_text="Auto calculated: total_bags × pcs_per_bag"
    )
    total_item_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        help_text="Auto calculated total cost for this product line"
    )
    currency = models.CharField(
        max_length=10,
        default='ETB'
    )

    class Meta:
        ordering = ['item_code']
        verbose_name = 'Purchase Item'
        verbose_name_plural = 'Purchase Items'

    def __str__(self):
        return (
            f"{self.product_name} [{self.item_code}] | "
            f"{self.total_bags_purchased} bags × "
            f"{self.pcs_per_bag} pcs/bag"
        )

    def save(self, *args, **kwargs):
        self.total_pieces_purchased = (
                self.total_bags_purchased * self.pcs_per_bag
        )

        if self.price_type == self.PriceType.PER_PIECE:
            self.total_item_amount = (
                    self.purchase_price * self.total_pieces_purchased
            )
        else:  # PER_BAG
            self.total_item_amount = (
                    self.purchase_price * self.total_bags_purchased
            )

        super().save(*args, **kwargs)

        self.purchase.recalculate_totals()
        self.purchase.save()
        self._sync_stock_batch()

    def _sync_stock_batch(self):
        from ..inventory.models import StockBatch
        StockBatch.objects.update_or_create(
            purchase_item=self,
            defaults={
                'item_code': self.item_code,
                'product_name': self.product_name,
                'factory': self.purchase.factory,
                'purchase': self.purchase,
                'shipping_code': self.purchase.shipping_code,
                'pcs_per_bag': self.pcs_per_bag,
                'purchase_price': self.purchase_price,
                'price_type': self.price_type,
                'currency': self.currency,
                'total_bags_purchased': self.total_bags_purchased,
                'total_pieces_purchased': self.total_pieces_purchased,
            }
        )

    @property
    def cost_per_piece(self):
        if self.price_type == self.PriceType.PER_PIECE:
            return self.purchase_price
        if self.pcs_per_bag and self.pcs_per_bag > 0:
            return self.purchase_price / self.pcs_per_bag
        return 0