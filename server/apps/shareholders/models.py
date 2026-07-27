from django.db import models
from apps.core.models import TimeStampedModel


class Shareholder(TimeStampedModel):
    """
    Represents one person who owns a percentage of the business profit.

    BALANCE FORMULA (never stored, always calculated live):
        balance = initial_balance
                + (net_distributable_profit × percentage / 100)
                - sum(tagged expenses)

    Where:
        net_distributable_profit = gross_profit - untagged_general_expenses
        gross_profit = sum of all SaleItem profits
        untagged_general_expenses = GeneralExpenses where shareholder is NULL

    FIELDS:

    name
        → Full name of the shareholder
        → Example: "Ahmed Mohammed" or "Kebede Alemu"
        → Required, cannot be empty

    percentage
        → What percentage of net profit this person owns
        → Example: 40.00 means 40%
        → Must be between 0.01 and 100
        → All active shareholders percentages should add up to 100
          but we do not enforce this strictly in the model
          because you might add them one by one
        → We validate total in the serializer instead

    initial_balance
        → Money this shareholder already had BEFORE the app tracked anything
        → Same pattern as Customer.initial_credit and Factory.initial_balance
        → Example: Ahmed had 15,000 ETB accumulated before we started
          tracking → enter 15,000
        → Default is 0 (clean slate)
        → This is added ON TOP of their calculated profit share

    initial_balance_currency
        → Which currency the initial_balance is in
        → Must be in AppSetting.available_currencies

    is_active
        → True = active shareholder, included in profit split
        → False = archived shareholder, excluded from calculations
        → We never delete, just archive
        → When archived, their historical data stays intact

    notes
        → Any extra info about this shareholder
        → Free text, optional
        → Example: "Silent partner" or "Managing director"
    """

    name = models.CharField(max_length=255)
    percentage = models.DecimalField(max_digits=5,decimal_places=2)
    initial_balance = models.DecimalField(max_digits=15,decimal_places=2,default=0)
    initial_balance_currency = models.CharField(max_length=10,default='ETB')
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True,null=True)

    class Meta:
        ordering = ['-percentage', 'name']
        verbose_name = 'Shareholder'
        verbose_name_plural = 'Shareholders'

    def __str__(self):
        return f"{self.name} ({self.percentage}%)"

    @staticmethod
    def calculate_gross_profit(date_from=None, date_to=None):
        """
        Calculate total business gross profit from ALL sale items.

        This is a staticmethod because it belongs to the business
        as a whole, not to one specific shareholder.
        All shareholders share the same gross profit pool.

        staticmethod means:
            → No 'self' parameter needed
            → Called as Shareholder.calculate_gross_profit()
            → Does not need a specific shareholder instance

        HOW PROFIT IS CALCULATED PER SALE ITEM:
            profit = (selling_price_per_piece - purchase_cost_per_piece)
                     × pieces_sold

            selling_price_per_piece → what customer paid per piece
            purchase_cost_per_piece → what we paid factory per piece
            pieces_sold             → how many pieces sold

        date_from, date_to:
            → Optional date range filter
            → If None, calculates all time
            → Format: datetime.date object or 'YYYY-MM-DD' string

        Returns:
            Decimal → total gross profit amount
        """
        from apps.sales.models import SaleItem

        # Start with all sale items
        queryset = SaleItem.objects.all()

        # Apply date filters if provided
        # sale__date means: go to the related Sale, then get its date field
        if date_from:
            queryset = queryset.filter(sale__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(sale__date__lte=date_to)

        # Calculate profit for each item and sum them all
        # We do this in Python (not SQL) because selling_price_per_piece
        # and profit are Python properties, not database fields
        # For large datasets, we could optimize with annotate()
        # but for this business size Python loop is fine
        total_profit = sum(item.profit for item in queryset)

        return total_profit

    @staticmethod
    def calculate_untagged_expenses(date_from=None, date_to=None):
        """
        Sum of all GeneralExpenses where shareholder is NULL.

        These are business expenses not assigned to any specific person.
        They reduce EVERYONE's profit share equally
        because they come off the total before splitting.

        Untagged means shareholder field is NULL (not assigned to anyone).

        Returns:
            Decimal → total untagged expense amount
        """
        from apps.payments.models import GeneralExpense
        from django.db.models import Sum

        queryset = GeneralExpense.objects.filter(
            # shareholder__isnull=True means WHERE shareholder_id IS NULL
            # These are expenses not tagged to any shareholder
            shareholder__isnull=True
        )

        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)

        result = queryset.aggregate(total=Sum('amount'))
        # aggregate returns a dict: {'total': value_or_None}
        # 'or 0' handles the case where there are no expenses (None)
        return result['total'] or 0

    @staticmethod
    def calculate_net_distributable_profit(date_from=None, date_to=None):
        """
        Net profit available to distribute among shareholders.

        Formula:
            net = gross_profit - untagged_expenses

        This is the pool that gets split by percentage.

        Can be negative if expenses exceed profit.
        In that case, all shareholders have a negative share too.

        Returns:
            Decimal → net distributable profit
        """
        gross = Shareholder.calculate_gross_profit(date_from, date_to)
        untagged = Shareholder.calculate_untagged_expenses(date_from, date_to)
        return gross - untagged

    def calculate_raw_share(self, date_from=None, date_to=None):
        """
        This shareholder's portion of the net distributable profit.

        Formula:
            raw_share = net_distributable_profit × (percentage / 100)

        Example:
            net = 100,000 ETB
            percentage = 40%
            raw_share = 100,000 × 0.40 = 40,000 ETB

        Returns:
            Decimal → this person's profit share before expenses
        """
        net = Shareholder.calculate_net_distributable_profit(
            date_from,
            date_to
        )
        # Convert percentage to decimal by dividing by 100
        share = net * (self.percentage / 100)
        return share

    def calculate_tagged_expenses(self, date_from=None, date_to=None):
        """
        Sum of GeneralExpenses specifically tagged to THIS shareholder.

        These are expenses that come out of only this person's share.
        Other shareholders are not affected by these.

        self.tagged_expenses is the reverse relation name
        we set in GeneralExpense.shareholder FK
        (related_name='tagged_expenses')

        Returns:
            Decimal → total expenses tagged to this shareholder
        """
        from django.db.models import Sum

        # self.tagged_expenses = all GeneralExpense records
        # where shareholder = this shareholder
        # This works because of related_name='tagged_expenses' on the FK
        queryset = self.tagged_expenses.all()

        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)

        result = queryset.aggregate(total=Sum('amount'))
        return result['total'] or 0

    def calculate_balance(self, date_from=None, date_to=None):
        """
        THE MAIN BALANCE — this shareholder's total money right now.

        Formula:
            balance = initial_balance
                    + raw_share (from profit %)
                    - tagged_expenses (personal withdrawals/expenses)

        Example:
            initial_balance  = 15,000
            raw_share        = 40,000
            tagged_expenses  =  8,000
            ─────────────────────────
            balance          = 47,000 ETB

        Positive = shareholder has this much money earned
        Negative = shareholder has spent more than they earned
                   (unusual but possible)

        date_from/date_to filter only the CALCULATED parts
        (raw_share and tagged_expenses).
        initial_balance is always included (it is a starting point).

        Returns:
            Decimal → this shareholder's current balance
        """
        raw_share = self.calculate_raw_share(date_from, date_to)
        tagged = self.calculate_tagged_expenses(date_from, date_to)
        return self.initial_balance + raw_share - tagged

    def get_full_summary(self, date_from=None, date_to=None):
        """
        Returns a complete breakdown dict for this shareholder.
        Used by the serializer and API response.

        Returns all intermediate calculation steps so the
        frontend can show a clear breakdown to the owner.

        Returns:
            dict → complete profit summary with all steps shown
        """
        gross_profit = Shareholder.calculate_gross_profit(
            date_from, date_to
        )
        untagged_expenses = Shareholder.calculate_untagged_expenses(
            date_from, date_to
        )
        net_distributable = gross_profit - untagged_expenses
        raw_share = self.calculate_raw_share(date_from, date_to)
        tagged_expenses = self.calculate_tagged_expenses(
            date_from, date_to
        )
        final_balance = self.initial_balance + raw_share - tagged_expenses

        return {
            # Business level numbers (same for all shareholders)
            'business_gross_profit': gross_profit,
            'business_untagged_expenses': untagged_expenses,
            'business_net_distributable_profit': net_distributable,

            # This shareholder's numbers
            'shareholder_id': self.id,
            'shareholder_name': self.name,
            'shareholder_percentage': self.percentage,
            'initial_balance': self.initial_balance,
            'raw_profit_share': raw_share,
            'tagged_expenses': tagged_expenses,
            'final_balance': final_balance,

            # Period info
            'period': {
                'from': date_from,
                'to': date_to,
                'is_all_time': date_from is None and date_to is None,
            }
        }