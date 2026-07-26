from rest_framework import serializers
from django.db import transaction
from .models import Purchase, PurchaseItem


class PurchaseItemSerializer(serializers.ModelSerializer):
    cost_per_piece = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        read_only=True,
        help_text="Calculated cost per piece regardless of price type"
    )

    total_pieces_purchased = serializers.IntegerField(read_only=True)
    total_item_amount = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        read_only=True
    )

    shipping_code = serializers.CharField(
        source='purchase.shipping_code',
        read_only=True
    )
    class Meta:
        model = PurchaseItem
        fields = [
            'id',
            'purchase',
            'item_code',
            'product_name',
            'price_type',
            'purchase_price',
            'pcs_per_bag',
            'total_bags_purchased',
            'total_pieces_purchased',
            'total_item_amount',
            'cost_per_piece',
            'currency',
            'shipping_code',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'purchase',
            'total_pieces_purchased',
            'total_item_amount',
            'shipping_code',
        ]

    def validate_item_code(self, value):
        if not value.strip():
            raise serializers.ValidationError(
                "Item code cannot be empty."
            )
        return value.strip().upper()

    def validate_product_name(self, value):
        if not value.strip():
            raise serializers.ValidationError(
                "Product name cannot be empty."
            )
        return value.strip()

    def validate_purchase_price(self, value):
        if value <= 0:
            raise serializers.ValidationError(
                "Purchase price must be greater than 0."
            )
        return value

    def validate_pcs_per_bag(self, value):
        """Must have at least 1 piece per bag."""
        if value <= 0:
            raise serializers.ValidationError(
                "Pieces per bag must be at least 1."
            )
        return value

    def validate_total_bags_purchased(self, value):
        """Must buy at least 1 bag."""
        if value <= 0:
            raise serializers.ValidationError(
                "Total bags purchased must be at least 1."
            )
        return value

    def validate_currency(self, value):
        from ..core.models import AppSetting
        settings = AppSetting.get_settings()
        if value not in settings.available_currencies:
            raise serializers.ValidationError(
                f"Currency '{value}' not available. "
                f"Available: {settings.available_currencies}"
            )
        return value


class PurchaseItemReadSerializer(serializers.ModelSerializer):
    cost_per_piece = serializers.DecimalField(
        max_digits=15,
        decimal_places=2,
        read_only=True
    )
    shipping_code = serializers.CharField(
        source='purchase.shipping_code',
        read_only=True
    )
    factory_name = serializers.CharField(
        source='purchase.factory.name',
        read_only=True
    )

    remaining_bags = serializers.SerializerMethodField()
    remaining_pieces = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseItem
        fields = [
            'id',
            'purchase',
            'item_code',
            'product_name',
            'price_type',
            'purchase_price',
            'cost_per_piece',
            'pcs_per_bag',
            'total_bags_purchased',
            'total_pieces_purchased',
            'total_item_amount',
            'currency',
            'shipping_code',
            'factory_name',
            'remaining_bags',
            'remaining_pieces',
            'created_at',
        ]

    def get_remaining_bags(self, obj):
        if hasattr(obj, 'stock_batch'):
            return obj.stock_batch.remaining_bags
        return obj.total_bags_purchased

    def get_remaining_pieces(self, obj):
        if hasattr(obj, 'stock_batch'):
            return obj.stock_batch.remaining_pieces
        return obj.total_pieces_purchased


class PurchaseSerializer(serializers.ModelSerializer):
    items = PurchaseItemReadSerializer(
        many=True,
        read_only=True
    )

    factory_name = serializers.CharField(
        source='factory.name',
        read_only=True
    )

    is_deletable = serializers.BooleanField(read_only=True)
    is_fully_editable = serializers.BooleanField(read_only=True)

    payment_status = serializers.CharField(read_only=True)

    class Meta:
        model = Purchase
        fields = [
            'id',
            'factory',
            'factory_name',
            'date',
            'shipping_code',
            'currency',
            'total_purchase_amount',
            'amount_paid_now',
            'payment_method',
            'unpaid_amount',
            'notes',
            'is_deletable',
            'is_fully_editable',
            'payment_status',
            'items',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'shipping_code',
            'total_purchase_amount',
            'unpaid_amount',
        ]



class PurchaseCreateSerializer(serializers.ModelSerializer):
    items = PurchaseItemSerializer(
        many=True,
        write_only=True
    )

    class Meta:
        model = Purchase
        fields = [
            'id',
            'factory',
            'date',
            'currency',
            'amount_paid_now',
            'payment_method',
            'notes',
            'items',
            'shipping_code',
            'total_purchase_amount',
            'unpaid_amount',
        ]
        read_only_fields = [
            'shipping_code',
            'total_purchase_amount',
            'unpaid_amount',
        ]

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError(
                "A purchase must have at least one item."
            )
        return value

    def validate_amount_paid_now(self, value):
        """Amount paid cannot be negative."""
        if value < 0:
            raise serializers.ValidationError(
                "Amount paid cannot be negative."
            )
        return value

    def validate(self, data):
        items_data = data.get('items', [])
        amount_paid = data.get('amount_paid_now', 0)
        payment_method = data.get('payment_method')

        # Calculate approximate total from submitted items
        estimated_total = 0
        for item in items_data:
            price = item.get('purchase_price', 0)
            bags = item.get('total_bags_purchased', 0)
            pcs = item.get('pcs_per_bag', 0)
            price_type = item.get('price_type', 'per_piece')
            if price_type == 'per_piece':
                estimated_total += price * bags * pcs
            else:
                estimated_total += price * bags

        if estimated_total > 0 and amount_paid > estimated_total:
            raise serializers.ValidationError(
                f"Amount paid ({amount_paid}) cannot exceed "
                f"total purchase amount ({estimated_total})."
            )

        # Force payment_method when there is payment
        if amount_paid > 0:
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

        purchase = Purchase.objects.create(**validated_data)

        for item_data in items_data:
            PurchaseItem.objects.create(
                purchase=purchase,
                **item_data
            )
            # PurchaseItem.save() auto-calculates totals and creates StockBatch
            # PurchaseItem.save() also calls purchase.recalculate_totals()

        if purchase.amount_paid_now > 0:
            self._create_auto_factory_payment(purchase)

        # Refresh from database to get updated totals
        purchase.refresh_from_db()
        return purchase

    def _create_auto_factory_payment(self, purchase):
        from ..payments.models import FactoryPayment
        FactoryPayment.objects.create(
            factory=purchase.factory,
            purchase=purchase,
            date=purchase.date,
            paid_amount=purchase.amount_paid_now,
            currency=purchase.currency,
            payment_method='cash',
            # Default to cash, owner can change if needed
            is_auto=True,
            notes=f"Auto payment from purchase {purchase.shipping_code}"
        )


class PurchaseUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Purchase
        fields = [
            'id',
            'factory',
            'date',
            'currency',
            'amount_paid_now',
            'payment_method',
            'notes',
            'shipping_code',
            'total_purchase_amount',
            'unpaid_amount',
        ]
        read_only_fields = [
            'shipping_code',
            'total_purchase_amount',
            'unpaid_amount'
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        instance = getattr(self, 'instance', None)

        # Restrict fields if purchase is NOT fully editable
        if instance and not instance.is_fully_editable:
            self.fields['factory'].read_only = True
            self.fields['date'].read_only = True
            self.fields['currency'].read_only = True

    def validate(self, data):
        instance = getattr(self, 'instance', None)

        # 1. Partially Editable Protection
        if instance and not instance.is_fully_editable:
            restricted_fields = ['factory', 'date', 'currency']
            errors = {}

            for field in restricted_fields:
                if field in data and data[field] != getattr(instance, field):
                    errors[
                        field] = "You cannot change this field because some items from this purchase have already been sold."

            if errors:
                raise serializers.ValidationError(errors)

        # 2. Prevent Over Payment
        if 'amount_paid_now' in data and instance:
            if data['amount_paid_now'] > instance.total_purchase_amount:
                error_msg = f"Amount paid cannot exceed total purchase amount. Maximum allowed is {instance.total_purchase_amount} {instance.currency}."

                raise serializers.ValidationError({
                    'amount_paid_now': error_msg
                })

        return data

    def validate_amount_paid_now(self, value):
        if value < 0:
            raise serializers.ValidationError("Amount paid cannot be negative.")
        return value

    @transaction.atomic
    def update(self, instance, validated_data):
        old_paid = instance.amount_paid_now

        # Update fields
        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()

        # Sync auto factory payment if amount_paid_now changed
        new_paid = instance.amount_paid_now
        if old_paid != new_paid:
            self._sync_auto_factory_payment(instance)

        instance.refresh_from_db()
        return instance

    def _sync_auto_factory_payment(self, purchase):
        from ..payments.models import FactoryPayment

        if purchase.amount_paid_now > 0:
            FactoryPayment.objects.update_or_create(
                purchase=purchase,
                is_auto=True,
                defaults={
                    'factory': purchase.factory,
                    'date': purchase.date,
                    'paid_amount': purchase.amount_paid_now,
                    'currency': purchase.currency,
                    'notes': f"Auto payment from purchase {purchase.shipping_code}"
                }
            )
        else:
            FactoryPayment.objects.filter(
                purchase=purchase,
                is_auto=True
            ).delete()

class AddItemToPurchaseSerializer(serializers.ModelSerializer):
    cost_per_piece = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True
    )
    total_pieces_purchased = serializers.IntegerField(read_only=True)
    total_item_amount = serializers.DecimalField(
        max_digits=15, decimal_places=2, read_only=True
    )

    class Meta:
        model = PurchaseItem
        fields = [
            'purchase', 'item_code', 'product_name', 'price_type',
            'purchase_price', 'pcs_per_bag', 'total_bags_purchased',
            'total_pieces_purchased', 'total_item_amount',
            'cost_per_piece', 'currency'
        ]
        read_only_fields = ['total_pieces_purchased', 'total_item_amount']

    def validate_purchase(self, purchase):
        """Important validation"""
        if not purchase.is_fully_editable:
            raise serializers.ValidationError(
                "Cannot add items to this purchase. Some items have already been sold."
            )
        return purchase

