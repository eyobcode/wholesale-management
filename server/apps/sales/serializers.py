from rest_framework import serializers
from django.db import transaction
from .models import Sale, SaleItem
from ..inventory.models import StockBatch
from ..payments.models import CustomerIncome



class SaleItemReadSerializer(serializers.ModelSerializer):
    selling_price_per_piece = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        read_only=True
    )
    profit = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        read_only=True
    )

    item_code = serializers.CharField(
        source='stock_batch.item_code',
        read_only=True
    )
    product_name = serializers.CharField(
        source='stock_batch.product_name',
        read_only=True
    )
    shipping_code = serializers.CharField(
        source='stock_batch.shipping_code',
        read_only=True
    )
    factory_name = serializers.CharField(
        source='stock_batch.factory.name',
        read_only=True
    )

    class Meta:
        model = SaleItem
        fields = [
            'id',
            'sale',
            'stock_batch',
            'item_code',
            'product_name',
            'shipping_code',
            'factory_name',
            'bags_sold',
            'pcs_per_bag',
            'pieces_sold',
            'sell_price_type',
            'selling_price',
            'selling_price_per_piece',
            'total_line_amount',
            'purchase_cost_per_piece',
            'profit',
            'created_at',
        ]
        read_only_fields = fields


class SaleItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleItem
        fields = [
            'id',
            'stock_batch',
            'bags_sold',
            'sell_price_type',
            'selling_price',
        ]

    def validate_bags_sold(self, value):
        """Bags sold must be positive."""
        if value <= 0:
            raise serializers.ValidationError(
                "Bags sold must be greater than 0."
            )
        return value

    def validate_selling_price(self, value):
        """Selling price must be positive."""
        if value <= 0:
            raise serializers.ValidationError(
                "Selling price must be greater than 0."
            )
        return value

    def validate(self, data):
        batch = data.get('stock_batch')
        bags_requested = data.get('bags_sold', 0)

        if batch and bags_requested:
            # If editing existing item, we need to consider old bags
            # self.instance is the existing SaleItem if editing
            # self.instance is None if creating new
            if self.instance:
                # Return old bags to available before checking
                available = batch.remaining_bags + self.instance.bags_sold
            else:
                available = batch.remaining_bags

            if bags_requested > available:
                raise serializers.ValidationError(
                    f"Not enough stock. "
                    f"Batch '{batch.shipping_code}' has "
                    f"{available} bags available. "
                    f"You requested {bags_requested} bags."
                )

            if batch.is_sold_out and not self.instance:
                raise serializers.ValidationError(
                    f"Batch '{batch.shipping_code}' is sold out."
                )

        return data
    def save(self, **kwargs):
        try:
            return super().save(**kwargs)
        except Exception:
            import traceback
            traceback.print_exc()
            raise


class AddSaleItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SaleItem
        fields = [
            'id',
            'sale',
            'stock_batch',
            'bags_sold',
            'sell_price_type',
            'selling_price',
        ]
        read_only_fields = ['id']

    def validate_sale(self, value):
        """Ensure the sale exists."""
        if not value:
            raise serializers.ValidationError("Sale is required.")

        sale_id = value.pk if hasattr(value, 'pk') else value
        if not Sale.objects.filter(pk=sale_id).exists():
            raise serializers.ValidationError("Sale does not exist.")

        return value

    def validate_stock_batch(self, value):
        """Ensure the stock batch exists."""
        if not value:
            raise serializers.ValidationError("Stock batch is required.")

        batch_id = value.pk if hasattr(value, 'pk') else value
        if not StockBatch.objects.filter(pk=batch_id).exists():
            raise serializers.ValidationError("Stock batch does not exist.")

        return value

    def validate_bags_sold(self, value):
        """Bags sold must be positive."""
        if value <= 0:
            raise serializers.ValidationError("Bags sold must be greater than 0.")
        return value

    def validate_selling_price(self, value):
        """Selling price must be positive."""
        if value <= 0:
            raise serializers.ValidationError("Selling price must be greater than 0.")
        return value

    def validate(self, data):
        """Stock availability check for new sale item only."""
        batch = data.get('stock_batch')
        bags_requested = data.get('bags_sold', 0)

        if batch and bags_requested:
            available = batch.remaining_bags

            if bags_requested > available:
                raise serializers.ValidationError({
                    'bags_sold': (
                        f"Not enough stock. Batch '{batch.shipping_code}' has "
                        f"{available} bags available. You requested {bags_requested} bags."
                    )
                })

            if batch.is_sold_out:
                raise serializers.ValidationError({
                    'stock_batch': f"Batch '{batch.shipping_code}' is sold out."
                })

        return data


class SaleReadSerializer(serializers.ModelSerializer):
    # Nested read-only items
    items = SaleItemReadSerializer(
        many=True,
        read_only=True
    )

    # Customer info for display
    customer_name = serializers.CharField(
        source='customer.name',
        read_only=True
    )
    customer_location = serializers.CharField(
        source='customer.location',
        read_only=True
    )
    customer_phone = serializers.CharField(
        source='customer.phone',
        read_only=True
    )
    customer_current_balance = serializers.DecimalField(
        source='customer.current_balance',
        max_digits=15,
        decimal_places=2,
        read_only=True
    )

    # Total profit for this entire sale (sum of all item profits)
    total_profit = serializers.SerializerMethodField()

    # Human readable payment status
    payment_status = serializers.CharField(read_only=True)
    
    class Meta:
        model = Sale
        fields = [
            'id',
            'customer',
            'customer_name',
            'customer_location',
            'customer_phone',
            'customer_current_balance',
            'date',
            'currency',
            'payment_type',
            'payment_method',
            'amount_paid_now',
            'total_sale_amount',
            'credit_amount',
            'invoice_number',
            'notes',
            'total_profit',
            'payment_status',
            'items',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'total_sale_amount',
            'credit_amount',
            'invoice_number',
        ]

    def get_total_profit(self, obj):
        return sum(item.profit for item in obj.items.all())


class SaleCreateSerializer(serializers.ModelSerializer):
    items = SaleItemWriteSerializer(many=True, write_only=True)

    class Meta:
        model = Sale
        fields = [
            'id',
            'customer',
            'date',
            'currency',
            'amount_paid_now',
            'payment_method',
            'notes', 'items',
            'invoice_number',
            'total_sale_amount',
            'credit_amount',
            'payment_type',
        ]
        read_only_fields = [
            'invoice_number', 'total_sale_amount', 'credit_amount', 'payment_type',
        ]

    def validate_amount_paid_now(self, value):
        if value < 0:
            raise serializers.ValidationError("Amount paid cannot be negative.")
        return value

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("A sale must have at least one item.")
        return value

    def validate(self, data):
        # Remove any mistakenly sent payment_type
        data.pop('payment_type', None)

        amount_paid_now = data.get('amount_paid_now', 0)
        total_sale_amount = data.get('total_sale_amount') or 0
        payment_method = data.get('payment_method')

        # Auto determine payment_type
        if amount_paid_now == 0:
            payment_type = Sale.PaymentType.CREDIT
        elif amount_paid_now >= total_sale_amount:
            payment_type = Sale.PaymentType.CASH
        else:
            payment_type = Sale.PaymentType.PARTIAL

        data['payment_type'] = payment_type

        # Force payment_method when there is payment
        if amount_paid_now > 0:
            if not payment_method:
                raise serializers.ValidationError(
                     "Payment method is required when 'Amount Paid Now' > 0."
                )
        else:
            data['payment_method'] = None

        return data

    @transaction.atomic
    def create(self, validated_data):
        items_data = validated_data.pop('items')

        sale = Sale.objects.create(**validated_data)

        # Create items
        for item_data in items_data:
            SaleItem.objects.create(sale=sale, **item_data)

        # Sale totals/payment_type were already updated by SaleItem.save()
        sale.refresh_from_db()

        # Create auto income if payment was made
        if sale.amount_paid_now > 0:
            self._create_auto_customer_income(sale)

        return sale

    def _create_auto_customer_income(self, sale):
        from ..payments.models import CustomerIncome
        CustomerIncome.objects.create(
            sale=sale,
            customer=sale.customer,
            date=sale.date,
            paid_amount=sale.amount_paid_now,
            payment_method=sale.payment_method,
            currency=sale.currency,
            is_auto=True,
            notes=f"Auto from sale #{sale.invoice_number}",
        )


class SaleUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sale
        fields = [
            'id',
            'customer',
            'date',
            'currency',
            'payment_type',
            'payment_method',
            'amount_paid_now',
            'notes',
            'invoice_number',
            'total_sale_amount',
            'credit_amount',
        ]
        read_only_fields = [
            'invoice_number',
            'total_sale_amount',
            'credit_amount',
            'payment_type',
        ]

    def validate_amount_paid_now(self, value):
        if value is None:
            return value

        if value < 0:
            raise serializers.ValidationError("Amount paid now cannot be negative.")

        instance = self.instance
        if instance and value > instance.total_sale_amount:
            raise serializers.ValidationError(
                f"Amount paid now ({value:,}) cannot be greater than "
                f"the total sale amount ({instance.total_sale_amount:,})."
            )
        return value

    def validate(self, data):
        instance = self.instance
        amount_paid_now = data.get(
            'amount_paid_now',
            instance.amount_paid_now if instance else 0
        )
        payment_method = data.get('payment_method')

        if amount_paid_now and amount_paid_now > 0:
            if not payment_method and not getattr(instance, 'payment_method', None):
                raise serializers.ValidationError({
                    "payment_method": "Payment method is required when amount_paid_now > 0."
                })
        else:
            # no payment made -> force payment_method to None
            if payment_method is not None:
                data['payment_method'] = None

        return data

    # Fields that, if changed, require CustomerIncome to be re-synced
    INCOME_TRACKED_FIELDS = {'amount_paid_now', 'payment_method', 'customer', 'date', 'currency'}

    @transaction.atomic
    def update(self, instance, validated_data):
        # Snapshot old values of tracked fields BEFORE applying changes
        old_values = {
            field: getattr(instance, field)
            for field in self.INCOME_TRACKED_FIELDS
        }

        # Apply all incoming updates
        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()  # triggers recalculate_totals() + payment_type logic in model

        # Snapshot new values after save
        new_values = {
            field: getattr(instance, field)
            for field in self.INCOME_TRACKED_FIELDS
        }

        # Only re-sync CustomerIncome if something relevant actually changed
        if old_values != new_values:
            self._sync_auto_income(instance)

        instance.refresh_from_db()
        return instance

    def _sync_auto_income(self, sale):
        if sale.amount_paid_now > 0 and sale.payment_method:
            CustomerIncome.objects.update_or_create(
                sale=sale,
                is_auto=True,
                defaults={
                    'customer': sale.customer,
                    'date': sale.date,
                    'paid_amount': sale.amount_paid_now,
                    'payment_method': sale.payment_method,
                    'currency': sale.currency,
                    'notes': f"Auto from sale #{sale.invoice_number}",
                }
            )
        else:
            CustomerIncome.objects.filter(sale=sale, is_auto=True).delete()
