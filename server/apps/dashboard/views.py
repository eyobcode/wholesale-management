"""
Dashboard ViewSet — the brain of the app.
Every endpoint returns aggregated, computed data for charts, cards, and reports.
No create/update/delete — everything is READ-ONLY.

Endpoints:
    GET /api/dashboard/                     → Main dashboard
    GET /api/dashboard/sales-trend/         → Sales over time
    GET /api/dashboard/profit-trend/        → Gross profit, expenses, net profit over time
    GET /api/dashboard/top-products/        → Best selling products
    GET /api/dashboard/top-customers/       → Top customers
    GET /api/dashboard/overdue-customers/   → Customers who haven't paid
    GET /api/dashboard/stock-overview/      → Full stock health report
    GET /api/dashboard/payment-methods/     → Payment method distribution
    GET /api/dashboard/expenses-breakdown/  → Expense categories
    GET /api/dashboard/factory-balances/    → All factory balances
    GET /api/dashboard/customer-balances/   → All customer balances
    GET /api/dashboard/revenue-vs-expenses/ → Revenue vs expenses chart
    GET /api/dashboard/inventory-aging/     → Inventory age buckets
    GET /api/dashboard/product-performance/ → Fast/slow/dead stock analysis
"""
import datetime
from decimal import Decimal

from django.db.models import (
    Sum, Count, F, ExpressionWrapper, DecimalField, Q
)
from django.db.models.functions import (
    TruncDate, TruncWeek, TruncMonth, Coalesce
)
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from ..core.models import AppSetting
from ..customers.models import Customer
from ..factories.models import Factory
from ..inventory.models import StockBatch
from ..payments.models import CustomerIncome, FactoryPayment, GeneralExpense
from ..sales.models import Sale, SaleItem
from .serializers import (
    CustomerBalancesSerializer,
    ExpenseBreakdownSerializer,
    FactoryBalancesSerializer,
    InventoryAgingSerializer,
    MainDashboardSerializer,
    OverdueCustomersSerializer,
    PaymentMethodDistributionSerializer,
    ProductPerformanceListSerializer,
    ProfitTrendSerializer,
    RevenueVsExpensesSerializer,
    SalesTrendSerializer,
    StockOverviewSerializer,
    TopCustomersSerializer,
    TopProductsSerializer,
)


# GLOBAL HELPERS

def _date_range_from_request(request, default_days: int = 30):
    """Parse start_date / end_date from query params."""
    today = datetime.date.today()
    start_str = request.query_params.get("start_date")
    end_str = request.query_params.get("end_date")
    start_date = (
        datetime.date.fromisoformat(start_str)
        if start_str
        else today - datetime.timedelta(days=default_days)
    )
    end_date = datetime.date.fromisoformat(end_str) if end_str else today
    return start_date, end_date


def _currency_from_request(request) -> str:
    """Resolve currency from query param, falling back to app default."""
    currency = request.query_params.get("currency")
    if not currency:
        settings = AppSetting.get_settings()
        currency = settings.default_currency
    return currency


def _change_direction(current, previous) -> str:
    """Return 'up', 'down', or 'neutral'."""
    if previous is None or previous == 0:
        return "up" if current and current > 0 else "neutral"
    if current > previous:
        return "up"
    if current < previous:
        return "down"
    return "neutral"


def _change_percent(current, previous):
    """Percentage change between two values. Returns None if no baseline."""
    if previous is None or previous == 0:
        return None
    try:
        return round(((current - previous) / previous) * 100, 1)
    except (ZeroDivisionError, TypeError):
        return None


def _make_card(label, value, currency, previous=None, positive_direction="up"):
    """
    Build a summary-card dict.

    positive_direction: 'up'  → going up is GOOD  (e.g. sales, profit)
                        'down' → going down is GOOD (e.g. expenses, debt)
    """
    direction = _change_direction(value, previous)
    pct = _change_percent(value, previous)

    if direction == "up":
        is_positive = positive_direction == "up"
    elif direction == "down":
        is_positive = positive_direction == "down"
    else:
        is_positive = True

    return {
        "label": label,
        "value": value or Decimal("0"),
        "currency": currency,
        "change_percent": pct,
        "change_direction": direction,
        "is_positive": is_positive,
    }


def _trunc_fn(period: str):
    if period == "daily":
        return lambda field_name: F(field_name)

    if period == "weekly":
        return lambda field_name: TruncWeek(field_name)

    if period == "monthly":
        return lambda field_name: TruncMonth(field_name)

    raise ValidationError("period must be daily, weekly, or monthly.")

def _period_expr(field_name: str, period: str):
    if period == "daily":
        return F(field_name)

    if period == "weekly":
        return TruncWeek(field_name)

    if period == "monthly":
        return TruncMonth(field_name)

    raise ValidationError("period must be daily, weekly, or monthly.")

class DashboardViewSet(viewsets.ViewSet):
    # MAIN DASHBOARD  GET /api/dashboard/

    def list(self, request):
        """
        Full main-dashboard payload:
            - 6 summary cards with month-over-month comparison
            - monthly_comparison breakdown
            - overdue_customers buckets
            - recent_transactions (last 10)
            - stock_alerts
            - quick-count stats
        """
        today = datetime.date.today()
        currency = _currency_from_request(request)

        this_month_start = today.replace(day=1)
        last_month_end = this_month_start - datetime.timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)

        this_month = self._get_period_aggregates(this_month_start, today, currency)
        last_month = self._get_period_aggregates(
            last_month_start, last_month_end, currency
        )

        cards = [
            _make_card(
                "Monthly Sales",
                this_month["sales"],
                currency,
                last_month["sales"],
                "up",
            ),
            _make_card(
                "Monthly Profit",
                this_month["profit"],
                currency,
                last_month["profit"],
                "up",
            ),
            _make_card(
                "Monthly Expenses",
                this_month["expenses"],
                currency,
                last_month["expenses"],
                "down",
            ),
            _make_card(
                "Customer Credit",
                self._get_total_customer_credit(),
                currency,
                positive_direction="down",
            ),
            _make_card(
                "Factory Balance",
                self._get_total_factory_balance(),
                currency,
                positive_direction="down",
            ),
            _make_card(
                "Stock Value",
                self._get_total_stock_value(),
                currency,
                positive_direction="up",
            ),
        ]

        data = {
            "cards": cards,
            "monthly_comparison": self._build_monthly_comparison(
                this_month, last_month
            ),
            "overdue_customers": self._compute_overdue_buckets(),
            "recent_transactions": self._compute_recent_transactions(limit=10),
            "stock_alerts": self._compute_stock_alerts(),
            "total_customers": Customer.objects.count(),
            "active_customers": Customer.objects.filter(is_active=True).count(),
            "total_factories": Factory.objects.count(),
            "active_factories": Factory.objects.filter(is_active=True).count(),
            "total_products": StockBatch.objects.values("item_code")
            .distinct()
            .count(),
            "total_stock_batches": StockBatch.objects.count(),
        }

        serializer = MainDashboardSerializer(data)
        return Response(serializer.data)


    def _get_period_aggregates(self, start, end, currency: str) -> dict:
        """Sales, gross profit and expenses for a date range."""
        sales = Sale.objects.filter(
            date__gte=start, date__lte=end, currency=currency
        ).aggregate(
            total=Coalesce(Sum("total_sale_amount"), Decimal("0"))
        )[
            "total"
        ]

        expenses = GeneralExpense.objects.filter(
            date__gte=start, date__lte=end, currency=currency
        ).aggregate(
            total=Coalesce(Sum("amount"), Decimal("0"))
        )[
            "total"
        ]

        profit = (
            SaleItem.objects.filter(
                sale__date__gte=start,
                sale__date__lte=end,
                sale__currency=currency,
            )
            .annotate(
                line_profit=ExpressionWrapper(
                    (F("selling_price") - F("purchase_cost_per_piece"))
                    * F("pieces_sold"),
                    output_field=DecimalField(max_digits=20, decimal_places=2),
                )
            )
            .aggregate(total=Coalesce(Sum("line_profit"), Decimal("0")))["total"]
        )

        return {"sales": sales, "profit": profit, "expenses": expenses}

    def _build_monthly_comparison(self, this_month: dict, last_month: dict) -> dict:
        def _entry(key):
            return {
                "this_month": this_month[key],
                "last_month": last_month[key],
                "change": this_month[key] - last_month[key],
                "change_percent": _change_percent(this_month[key], last_month[key]),
            }

        return {
            "sales": _entry("sales"),
            "profit": _entry("profit"),
            "expenses": _entry("expenses"),
        }

    def _get_total_customer_credit(self) -> Decimal:
        """
        Sum of positive customer balances (money owed to you).
        Formula per customer:
            balance = initial_credit + SUM(sale.total_sale_amount) - SUM(income.paid_amount)
        """
        credit_totals = (
            Customer.objects.filter(is_active=True)
            .annotate(
                sale_total=Coalesce(
                    Sum("sales__total_sale_amount"), Decimal("0")
                ),
                payments_in=Coalesce(
                    Sum("income_records__paid_amount"), Decimal("0")
                ),
            )
            .annotate(
                balance=ExpressionWrapper(
                    F("initial_credit") + F("sale_total") - F("payments_in"),
                    output_field=DecimalField(max_digits=20, decimal_places=2),
                )
            )
            .filter(balance__gt=0)
            .aggregate(total=Coalesce(Sum("balance"), Decimal("0")))
        )
        return credit_totals["total"]

    def _get_total_factory_balance(self) -> Decimal:
        """
        Sum of positive factory balances (money you owe to factories).

        balance = SUM(purchase.unpaid_amount) - SUM(manual factory payments)
        We read it from Factory model properties safely using DB aggregation.
        """
        total = Decimal("0")
        for factory in Factory.objects.filter(is_active=True):
            bal = factory.current_balance
            if bal and bal > 0:
                total += bal
        return total

    def _get_total_stock_value(self) -> Decimal:
        """Total value of all remaining stock at purchase cost."""
        total = Decimal("0")
        for batch in StockBatch.objects.all():
            total += batch.stock_value
        return total

    @action(detail=False, methods=["get"], url_path="sales-trend")
    def sales_trend(self, request):
        """
        Sales over time — daily, weekly, or monthly.

        Query params:
            period     → daily | weekly | monthly (default: daily)
            start_date → default: 30 days ago
            end_date   → default: today
            currency   → default: app default
        """
        try:
            period = request.query_params.get("period", "daily")
            if period not in ("daily", "weekly", "monthly"):
                raise ValidationError("period must be daily, weekly, or monthly.")

            start_date, end_date = _date_range_from_request(request, default_days=30)
            currency = _currency_from_request(request)

            sales_period = _period_expr("date", period)
            items_period = _period_expr("sale__date", period)

            sales_qs = (
                Sale.objects.filter(
                    date__isnull=False,
                    date__gte=start_date,
                    date__lte=end_date,
                    currency=currency,
                )
                .annotate(period=sales_period)
                .values("period")
                .annotate(
                    total_sales=Coalesce(Sum("total_sale_amount"), Decimal("0")),
                    num_sales=Count("id"),
                )
                .order_by("period")
            )

            items_qs = (
                SaleItem.objects.filter(
                    sale__date__isnull=False,
                    sale__date__gte=start_date,
                    sale__date__lte=end_date,
                    sale__currency=currency,
                )
                .annotate(
                    period=items_period,
                    line_cost=ExpressionWrapper(
                        F("purchase_cost_per_piece") * F("pieces_sold"),
                        output_field=DecimalField(max_digits=20, decimal_places=2),
                    ),
                )
                .values("period")
                .annotate(
                    total_cost=Coalesce(Sum("line_cost"), Decimal("0")),
                    num_items_sold=Coalesce(Sum("pieces_sold"), 0),
                )
                .order_by("period")
            )

            sales_lookup = {r["period"]: r for r in sales_qs if r["period"]}
            items_lookup = {r["period"]: r for r in items_qs if r["period"]}

            all_periods = sorted(
                set(list(sales_lookup.keys()) + list(items_lookup.keys()))
            )

            data_points = []
            totals = {
                "total_sales": Decimal("0"),
                "total_cost": Decimal("0"),
                "gross_profit": Decimal("0"),
                "num_sales": 0,
                "num_items_sold": 0,
            }

            for p in all_periods:
                s = sales_lookup.get(p, {})
                i = items_lookup.get(p, {})

                t_sales = s.get("total_sales", Decimal("0"))
                t_cost = i.get("total_cost", Decimal("0"))
                gp = t_sales - t_cost
                n_sales = s.get("num_sales", 0)
                n_items = i.get("num_items_sold", 0)

                data_points.append(
                    {
                        "date": p.isoformat() if hasattr(p, "isoformat") else str(p),
                        "total_sales": t_sales,
                        "total_cost": t_cost,
                        "gross_profit": gp,
                        "num_sales": n_sales,
                        "num_items_sold": n_items,
                    }
                )

                totals["total_sales"] += t_sales
                totals["total_cost"] += t_cost
                totals["gross_profit"] += gp
                totals["num_sales"] += n_sales
                totals["num_items_sold"] += n_items

            result = {
                "period": period,
                "start_date": start_date,
                "end_date": end_date,
                "currency": currency,
                "data": data_points,
                "totals": totals,
            }

            return Response(SalesTrendSerializer(result).data)
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response(
                {"error": str(e)},
                status=500,
            )


    @action(detail=False, methods=["get"], url_path="profit-trend")
    def profit_trend(self, request):
        """
        Gross profit, expenses and net profit over time.

        Query params:
            period     → daily | weekly | monthly (default: monthly)
            start_date → default: 90 days ago
            end_date   → default: today
            currency   → default: app default
        """
        period = request.query_params.get("period", "monthly")
        if period not in ("daily", "weekly", "monthly"):
            raise ValidationError("period must be daily, weekly, or monthly.")

        start_date, end_date = _date_range_from_request(request, default_days=90)
        currency = _currency_from_request(request)
        trunc = _trunc_fn(period)

        # Gross profit per period
        profit_qs = (
            SaleItem.objects.filter(
                sale__date__gte=start_date,
                sale__date__lte=end_date,
                sale__currency=currency,
            )
            .annotate(period=trunc("sale__date"))
            .values("period")
            .annotate(
                gross_profit=Coalesce(
                    Sum(
                        ExpressionWrapper(
                            (F("selling_price") - F("purchase_cost_per_piece"))
                            * F("pieces_sold"),
                            output_field=DecimalField(max_digits=20, decimal_places=2),
                        )
                    ),
                    Decimal("0"),
                )
            )
            .order_by("period")
        )

        # Total sales per period (for margin %)
        sales_qs = (
            Sale.objects.filter(
                date__gte=start_date, date__lte=end_date, currency=currency
            )
            .annotate(period=trunc("date"))
            .values("period")
            .annotate(total_sales=Coalesce(Sum("total_sale_amount"), Decimal("0")))
            .order_by("period")
        )

        # Expenses per period
        expense_qs = (
            GeneralExpense.objects.filter(
                date__gte=start_date, date__lte=end_date, currency=currency
            )
            .annotate(period=trunc("date"))
            .values("period")
            .annotate(
                total_expenses=Coalesce(Sum("amount"), Decimal("0"))
            )
            .order_by("period")
        )

        profit_lookup = {r["period"]: r["gross_profit"] for r in profit_qs if r["period"]}
        sales_lookup = {r["period"]: r["total_sales"] for r in sales_qs if r["period"]}
        expense_lookup = {r["period"]: r["total_expenses"] for r in expense_qs if r["period"]}

        all_periods = sorted(
            set(
                list(profit_lookup.keys())
                + list(sales_lookup.keys())
                + list(expense_lookup.keys())
            )
        )

        data_points = []
        totals = {
            "gross_profit": Decimal("0"),
            "total_expenses": Decimal("0"),
            "net_profit": Decimal("0"),
        }

        for p in all_periods:
            gp = profit_lookup.get(p, Decimal("0"))
            exp = expense_lookup.get(p, Decimal("0"))
            net = gp - exp
            sales_total = sales_lookup.get(p, Decimal("0"))
            margin = (
                round(float(net) / float(sales_total) * 100, 1) if sales_total else 0.0
            )

            data_points.append(
                {
                    "date": p.isoformat() if hasattr(p, "isoformat") else str(p),
                    "gross_profit": gp,
                    "total_expenses": exp,
                    "net_profit": net,
                    "profit_margin_percent": margin,
                }
            )
            totals["gross_profit"] += gp
            totals["total_expenses"] += exp
            totals["net_profit"] += net

        result = {
            "period": period,
            "start_date": start_date,
            "end_date": end_date,
            "currency": currency,
            "data": data_points,
            "totals": totals,
        }
        return Response(ProfitTrendSerializer(result).data)


    @action(detail=False, methods=["get"], url_path="top-products")
    def top_products(self, request):
        """
        Best-selling products ranked by revenue, profit, or quantity.

        Query params:
            by         → revenue | profit | quantity (default: revenue)
            limit      → 1-50 (default: 10)
            start_date → default: 30 days ago
            end_date   → default: today
            currency   → default: app default
        """
        by = request.query_params.get("by", "revenue")
        if by not in ("revenue", "profit", "quantity"):
            raise ValidationError("'by' must be revenue, profit, or quantity.")

        limit = min(int(request.query_params.get("limit", 10)), 50)
        start_date, end_date = _date_range_from_request(request, default_days=30)
        currency = _currency_from_request(request)

        product_qs = (
            SaleItem.objects.filter(
                sale__date__gte=start_date,
                sale__date__lte=end_date,
                sale__currency=currency,
            )
            .annotate(
                line_profit=ExpressionWrapper(
                    (F("selling_price") - F("purchase_cost_per_piece"))
                    * F("pieces_sold"),
                    output_field=DecimalField(max_digits=20, decimal_places=2),
                ),
                line_cost=ExpressionWrapper(
                    F("purchase_cost_per_piece") * F("pieces_sold"),
                    output_field=DecimalField(max_digits=20, decimal_places=2),
                ),
            )
            .values("stock_batch__item_code", "stock_batch__product_name")
            .annotate(
                total_bags_sold=Coalesce(Sum("bags_sold"), Decimal("0")),
                total_pieces_sold=Coalesce(Sum("pieces_sold"), 0),
                total_revenue=Coalesce(Sum("total_line_amount"), Decimal("0")),
                total_cost=Coalesce(Sum("line_cost"), Decimal("0")),
                gross_profit=Coalesce(Sum("line_profit"), Decimal("0")),
                num_sales=Count("sale", distinct=True),
            )
        )

        order_map = {
            "revenue": "-total_revenue",
            "profit": "-gross_profit",
            "quantity": "-total_bags_sold",
        }
        product_qs = product_qs.order_by(order_map[by])[:limit]

        products = []
        for idx, p in enumerate(product_qs, 1):
            item_code = p["stock_batch__item_code"]
            remaining = StockBatch.objects.filter(item_code=item_code).aggregate(
                rem_bags=Coalesce(
                    Sum(
                        ExpressionWrapper(
                            F("total_bags_purchased") - F("sold_bags"),
                            output_field=DecimalField(max_digits=15, decimal_places=2),
                        )
                    ),
                    Decimal("0"),
                )
            )["rem_bags"]

            revenue = p["total_revenue"]
            profit = p["gross_profit"]
            margin = (
                round(float(profit) / float(revenue) * 100, 1) if revenue else 0.0
            )

            products.append(
                {
                    "item_code": item_code,
                    "product_name": p["stock_batch__product_name"],
                    "total_bags_sold": p["total_bags_sold"],
                    "total_pieces_sold": p["total_pieces_sold"],
                    "total_revenue": revenue,
                    "total_cost": p["total_cost"],
                    "gross_profit": profit,
                    "profit_margin_percent": margin,
                    "num_sales": p["num_sales"],
                    "remaining_bags": remaining,
                    "rank": idx,
                }
            )

        period_label = (
            f"{start_date.strftime('%b %d')} – {end_date.strftime('%b %d, %Y')}"
        )
        result = {"period_label": period_label, "by": by, "products": products}
        return Response(TopProductsSerializer(result).data)


    @action(detail=False, methods=["get"], url_path="top-customers")
    def top_customers(self, request):
        """
        Top customers by revenue, balance, or purchase frequency.

        Query params:
            by         → revenue | balance | frequency (default: revenue)
            limit      → 1-50 (default: 10)
            start_date → default: 30 days ago
            end_date   → default: today
            currency   → default: app default
        """
        by = request.query_params.get("by", "revenue")
        if by not in ("revenue", "balance", "frequency"):
            raise ValidationError("'by' must be revenue, balance, or frequency.")

        limit = min(int(request.query_params.get("limit", 10)), 50)
        start_date, end_date = _date_range_from_request(request, default_days=30)
        currency = _currency_from_request(request)

        def _build_row(c: Customer, total_purchases, num_sales, rank: int) -> dict:
            """
            Build a customer row using the Customer model's actual properties.
            All balance/date fields are pulled from the model exactly as defined.
            """
            return {
                "id": c.id,
                "name": c.name,
                "phone": c.phone,
                "location": c.location,
                "total_purchases": total_purchases,
                # current_balance  → initial_credit + sale_credits - payments
                "total_paid": c.total_payments_received,
                "current_balance": c.current_balance,
                "num_sales": num_sales,
                # last_purchase_date and last_payment_date are model properties
                "last_purchase_date": c.last_purchase_date,
                "last_payment_date": c.last_payment_date,
                "rank": rank,
            }

        customer_list = []

        if by == "balance":
            # Rank by current outstanding balance regardless of date range.
            # We fetch all active customers and sort in Python because
            # current_balance is a computed property (initial_credit + aggregates).
            customers = Customer.objects.filter(is_active=True).prefetch_related(
                "sales", "income_records"
            )
            rows = []
            for c in customers:
                bal = c.current_balance
                if bal <= 0:
                    continue
                rows.append(
                    _build_row(
                        c,
                        total_purchases=c.total_sales_amount,
                        num_sales=c.sales.count(),
                        rank=0,
                    )
                )
            rows.sort(key=lambda x: x["current_balance"], reverse=True)
            customer_list = rows[:limit]
            for idx, row in enumerate(customer_list, 1):
                row["rank"] = idx

        else:
            # For both 'revenue' and 'frequency' we aggregate in the DB
            # for the given date range, then fetch Customer objects in bulk.
            order_field = (
                "-total_purchases" if by == "revenue" else "-num_sales"
            )
            sale_data = (
                Sale.objects.filter(
                    date__gte=start_date,
                    date__lte=end_date,
                    currency=currency,
                )
                .values("customer")
                .annotate(
                    total_purchases=Coalesce(
                        Sum("total_sale_amount"), Decimal("0")
                    ),
                    num_sales=Count("id"),
                )
                .order_by(order_field)[:limit]
            )

            # Fetch all needed Customer objects in ONE query
            customer_ids = [row["customer"] for row in sale_data]
            customer_map = {
                c.id: c
                for c in Customer.objects.filter(id__in=customer_ids).prefetch_related(
                    "sales", "income_records"
                )
            }

            for idx, sd in enumerate(sale_data, 1):
                c = customer_map.get(sd["customer"])
                if not c:
                    continue
                customer_list.append(
                    _build_row(
                        c,
                        total_purchases=sd["total_purchases"],
                        num_sales=sd["num_sales"],
                        rank=idx,
                    )
                )

        period_label = (
            f"{start_date.strftime('%b %d')} – {end_date.strftime('%b %d, %Y')}"
        )
        result = {"period_label": period_label, "by": by, "customers": customer_list}
        return Response(TopCustomersSerializer(result).data)

    @action(detail=False, methods=["get"], url_path="overdue-customers")
    def overdue_customers(self, request):
        buckets = self._compute_overdue_buckets()
        flat_list = self._compute_overdue_flat()

        total_amount = sum((c["current_balance"] for c in flat_list), Decimal("0"))
        total_customers = len(flat_list)

        result = {
            "total_overdue_amount": total_amount,
            "total_overdue_customers": total_customers,
            "buckets": buckets,
            "all_overdue": flat_list,
        }
        return Response(OverdueCustomersSerializer(result).data)


    @action(detail=False, methods=["get"], url_path="stock-overview")
    def stock_overview(self, request):
        """
        Complete stock-health overview grouped by item_code.
        """
        settings = AppSetting.get_settings()
        threshold = settings.low_stock_alert_percentage / 100

        batches = StockBatch.objects.select_related("purchase", "factory")
        item_codes = (
            batches.values_list("item_code", flat=True)
            .distinct()
            .order_by("item_code")
        )

        products = []
        total_stock_value = Decimal("0")
        sold_out_count = 0
        low_stock_count = 0
        healthy_count = 0

        for code in item_codes:
            code_batches = batches.filter(item_code=code)

            agg = code_batches.aggregate(
                total_bags=Coalesce(Sum("total_bags_purchased"), 0),
                total_sold_bags=Coalesce(Sum("sold_bags"), Decimal("0")),
                total_pieces=Coalesce(Sum("total_pieces_purchased"), 0),
                total_sold_pieces=Coalesce(Sum("sold_pieces"), 0),
                batch_count=Count("id"),
            )

            remaining_bags = agg["total_bags"] - agg["total_sold_bags"]
            remaining_pieces = agg["total_pieces"] - agg["total_sold_pieces"]

            # Use each batch's stock_value property (respects price_type + rounding)
            stock_value = sum(b.stock_value for b in code_batches)

            if remaining_bags <= 0:
                status = "sold_out"
                sold_out_count += 1
            elif agg["total_bags"] > 0 and (
                remaining_bags / agg["total_bags"]
            ) <= threshold:
                status = "low_stock"
                low_stock_count += 1
            else:
                status = "available"
                healthy_count += 1

            first_batch = code_batches.first()
            products.append(
                {
                    "item_code": code,
                    "product_name": first_batch.product_name if first_batch else code,
                    "total_bags_purchased": agg["total_bags"],
                    "total_bags_sold": agg["total_sold_bags"],
                    "total_bags_remaining": remaining_bags,
                    "total_pieces_purchased": agg["total_pieces"],
                    "total_pieces_sold": agg["total_sold_pieces"],
                    "total_pieces_remaining": remaining_pieces,
                    "stock_value": stock_value,
                    "currency": first_batch.currency if first_batch else "ETB",
                    "batch_count": agg["batch_count"],
                    "status": status,
                }
            )
            total_stock_value += stock_value

        result = {
            "total_stock_value": total_stock_value,
            "total_products": len(products),
            "total_batches": batches.count(),
            "sold_out_count": sold_out_count,
            "low_stock_count": low_stock_count,
            "healthy_stock_count": healthy_count,
            "products": products,
        }
        return Response(StockOverviewSerializer(result).data)


    @action(detail=False, methods=["get"], url_path="payment-methods")
    def payment_methods(self, request):
        """
        Distribution of payments across all payment methods.

        Query params:
            start_date → default: 30 days ago
            end_date   → default: today
        """
        start_date, end_date = _date_range_from_request(request, default_days=30)

        def _breakdown(model_cls, amount_field: str) -> list:
            qs = (
                model_cls.objects.filter(
                    date__gte=start_date, date__lte=end_date
                )
                .values("payment_method")
                .annotate(
                    count=Count("id"),
                    total_amount=Coalesce(Sum(amount_field), Decimal("0")),
                )
                .order_by("-total_amount")
            )
            total = sum(r["total_amount"] for r in qs)
            return [
                {
                    "payment_method": r["payment_method"],
                    "count": r["count"],
                    "total_amount": r["total_amount"],
                    "percentage": (
                        round(float(r["total_amount"]) / float(total) * 100, 1)
                        if total
                        else 0.0
                    ),
                }
                for r in qs
            ]

        result = {
            "income_by_method": _breakdown(CustomerIncome, "paid_amount"),
            "factory_payments_by_method": _breakdown(FactoryPayment, "paid_amount"),
            "expenses_by_method": _breakdown(GeneralExpense, "amount"),
        }
        return Response(PaymentMethodDistributionSerializer(result).data)


    @action(detail=False, methods=["get"], url_path="expenses-breakdown")
    def expenses_breakdown(self, request):
        """
        Expenses grouped by description category with a daily trend chart.

        Query params:
            start_date → default: 30 days ago
            end_date   → default: today
            currency   → default: app default
        """
        start_date, end_date = _date_range_from_request(request, default_days=30)
        currency = _currency_from_request(request)

        expenses = GeneralExpense.objects.filter(
            date__gte=start_date, date__lte=end_date, currency=currency
        )

        # Categorize by first 2 words of description
        categories: dict = {}
        for exp in expenses:
            words = exp.description.strip().split()
            key = " ".join(words[:2]) if len(words) >= 2 else exp.description.strip()
            if key not in categories:
                categories[key] = {
                    "description": key,
                    "total_amount": Decimal("0"),
                    "count": 0,
                    "last_date": exp.date,
                }
            categories[key]["total_amount"] += exp.amount
            categories[key]["count"] += 1
            if exp.date > categories[key]["last_date"]:
                categories[key]["last_date"] = exp.date

        total_expenses = sum(c["total_amount"] for c in categories.values())
        category_list = sorted(
            categories.values(), key=lambda x: x["total_amount"], reverse=True
        )
        for c in category_list:
            c["percentage"] = (
                round(float(c["total_amount"]) / float(total_expenses) * 100, 1)
                if total_expenses
                else 0.0
            )

        # Daily trend
        daily_raw = (
            expenses.annotate(period=TruncDate("date"))
            .values("period")
            .annotate(total=Coalesce(Sum("amount"), Decimal("0")))
            .order_by("period")
        )
        daily_trend = [
            {
                "date": r["period"].isoformat() if r["period"] else None,
                "total": r["total"],
            }
            for r in daily_raw
            if r["period"]
        ]

        result = {
            "total_expenses": total_expenses,
            "categories": category_list,
            "daily_trend": daily_trend,
        }
        return Response(ExpenseBreakdownSerializer(result).data)


    @action(detail=False, methods=["get"], url_path="factory-balances")
    def factory_balances(self, request):
        """All factory balances — how much you owe vs. how much they owe you."""
        factories = Factory.objects.filter(is_active=True).prefetch_related(
            "purchases", "payment_records"
        )

        factory_list = []
        total_you_owe = Decimal("0")
        total_they_owe = Decimal("0")

        for f in factories:
            bal = f.current_balance  # defined on the Factory model

            # total_purchased  → sum of all purchase totals for this factory
            total_purchased = (
                f.purchases.aggregate(
                    total=Coalesce(Sum("total_purchase_amount"), Decimal("0"))
                )["total"]
            )
            # total_paid → sum of all factory payments
            total_paid = (
                f.payment_records.aggregate(
                    total=Coalesce(Sum("paid_amount"), Decimal("0"))
                )["total"]
            )

            # last purchase / payment dates
            last_purchase = f.purchases.order_by("-date").first()
            last_payment = f.payment_records.order_by("-date").first()

            # Determine currency label from most recent purchase
            currency_label = (
                last_purchase.currency if last_purchase else "ETB"
            )

            if bal > 0:
                total_you_owe += bal
                status = f"You owe {f.name} {bal} {currency_label}"
            elif bal < 0:
                total_they_owe += abs(bal)
                status = f"{f.name} owes you {abs(bal)} {currency_label}"
            else:
                status = "Settled"

            factory_list.append(
                {
                    "id": f.id,
                    "name": f.name,
                    "phone": f.phone,
                    "location": f.location,
                    "total_purchased": total_purchased,
                    "total_paid": total_paid,
                    "current_balance": bal,
                    "balance_status": status,
                    "last_purchase_date": last_purchase.date if last_purchase else None,
                    "last_payment_date": last_payment.date if last_payment else None,
                }
            )

        factory_list.sort(key=lambda x: x["current_balance"], reverse=True)

        result = {
            "total_you_owe": total_you_owe,
            "total_they_owe": total_they_owe,
            "net_factory_balance": total_you_owe - total_they_owe,
            "factories": factory_list,
        }
        return Response(FactoryBalancesSerializer(result).data)


    @action(detail=False, methods=["get"], url_path="customer-balances")
    def customer_balances(self, request):
        """
        All customer balances overview.

        Uses Customer model properties exactly as defined:
            current_balance       = initial_credit + sale_credits - payments_in
            total_sales_amount    = SUM(sale.total_sale_amount)
            total_payments_received = SUM(income.paid_amount)
            last_purchase_date    = most recent sale date
            last_payment_date     = most recent payment date
            initial_credit_currency → used for status label
        """
        customers = Customer.objects.filter(is_active=True).prefetch_related(
            "sales", "income_records"
        )

        customer_list = []
        total_they_owe = Decimal("0")
        total_you_owe = Decimal("0")
        settled_count = 0
        owing_count = 0
        overpaid_count = 0

        for c in customers:
            bal = c.current_balance  # Customer.current_balance property

            if bal > 0:
                total_they_owe += bal
                # Use initial_credit_currency — the correct field name
                status = f"Owes you {bal} {c.initial_credit_currency}"
                owing_count += 1
            elif bal < 0:
                total_you_owe += abs(bal)
                status = f"You owe them {abs(bal)} {c.initial_credit_currency}"
                overpaid_count += 1
            else:
                status = "Settled"
                settled_count += 1

            customer_list.append(
                {
                    "id": c.id,
                    "name": c.name,
                    "phone": c.phone,
                    "location": c.location,
                    # total_sales_amount covers ALL sales (cash + credit)
                    "total_sales": c.total_sales_amount,
                    # total_payments_received is a Customer property
                    "total_paid": c.total_payments_received,
                    "current_balance": bal,
                    "balance_status": status,
                    # last_purchase_date / last_payment_date are Customer properties
                    "last_purchase_date": c.last_purchase_date,
                    "last_payment_date": c.last_payment_date,
                }
            )

        customer_list.sort(key=lambda x: x["current_balance"], reverse=True)

        result = {
            "total_they_owe": total_they_owe,
            "total_you_owe": total_you_owe,
            "net_customer_balance": total_they_owe - total_you_owe,
            "settled_count": settled_count,
            "owing_count": owing_count,
            "overpaid_count": overpaid_count,
            "customers": customer_list,
        }
        return Response(CustomerBalancesSerializer(result).data)


    @action(detail=False, methods=["get"], url_path="revenue-vs-expenses")
    def revenue_vs_expenses(self, request):
        """
        Side-by-side revenue and expense comparison over time.

        Query params:
            period     → daily | weekly | monthly (default: monthly)
            start_date → default: 90 days ago
            end_date   → default: today
            currency   → default: app default
        """
        period = request.query_params.get("period", "monthly")
        if period not in ("daily", "weekly", "monthly"):
            raise ValidationError("period must be daily, weekly, or monthly.")

        start_date, end_date = _date_range_from_request(request, default_days=90)
        currency = _currency_from_request(request)
        trunc = _trunc_fn(period)

        revenue_qs = (
            Sale.objects.filter(
                date__gte=start_date, date__lte=end_date, currency=currency
            )
            .annotate(period=trunc("date"))
            .values("period")
            .annotate(revenue=Coalesce(Sum("total_sale_amount"), Decimal("0")))
            .order_by("period")
        )

        cogs_qs = (
            SaleItem.objects.filter(
                sale__date__gte=start_date,
                sale__date__lte=end_date,
                sale__currency=currency,
            )
            .annotate(
                period=trunc("sale__date"),
                line_cost=ExpressionWrapper(
                    F("purchase_cost_per_piece") * F("pieces_sold"),
                    output_field=DecimalField(max_digits=20, decimal_places=2),
                ),
            )
            .values("period")
            .annotate(cost_of_goods=Coalesce(Sum("line_cost"), Decimal("0")))
            .order_by("period")
        )

        expense_qs = (
            GeneralExpense.objects.filter(
                date__gte=start_date, date__lte=end_date, currency=currency
            )
            .annotate(period=trunc("date"))
            .values("period")
            .annotate(expenses=Coalesce(Sum("amount"), Decimal("0")))
            .order_by("period")
        )

        rev_lookup = {r["period"]: r["revenue"] for r in revenue_qs if r["period"]}
        cogs_lookup = {r["period"]: r["cost_of_goods"] for r in cogs_qs if r["period"]}
        exp_lookup = {r["period"]: r["expenses"] for r in expense_qs if r["period"]}

        all_periods = sorted(
            set(
                list(rev_lookup.keys())
                + list(cogs_lookup.keys())
                + list(exp_lookup.keys())
            )
        )

        data_points = []
        totals = {
            "revenue": Decimal("0"),
            "cost_of_goods": Decimal("0"),
            "gross_profit": Decimal("0"),
            "expenses": Decimal("0"),
            "net_profit": Decimal("0"),
        }

        for p in all_periods:
            rev = rev_lookup.get(p, Decimal("0"))
            cogs = cogs_lookup.get(p, Decimal("0"))
            gp = rev - cogs
            exp = exp_lookup.get(p, Decimal("0"))
            net = gp - exp

            data_points.append(
                {
                    "date": p.isoformat() if hasattr(p, "isoformat") else str(p),
                    "revenue": rev,
                    "cost_of_goods": cogs,
                    "gross_profit": gp,
                    "expenses": exp,
                    "net_profit": net,
                }
            )
            totals["revenue"] += rev
            totals["cost_of_goods"] += cogs
            totals["gross_profit"] += gp
            totals["expenses"] += exp
            totals["net_profit"] += net

        result = {
            "period": period,
            "start_date": start_date,
            "end_date": end_date,
            "currency": currency,
            "data": data_points,
            "totals": totals,
        }
        return Response(RevenueVsExpensesSerializer(result).data)


    @action(detail=False, methods=["get"], url_path="inventory-aging")
    def inventory_aging(self, request):
        """
        Groups unsold inventory by how many days it has been sitting.

        Buckets: 0-30, 30-60, 60-90, 90+ days since purchase date.
        """
        today = datetime.date.today()
        batches = list(StockBatch.objects.select_related("purchase").all())

        bucket_defs = [
            ("0-30 days", 0, 30),
            ("30-60 days", 31, 60),
            ("60-90 days", 61, 90),
            ("90+ days", 91, 99999),
        ]

        buckets = {
            label: {
                "label": label,
                "batch_count": 0,
                "total_bags": Decimal("0"),
                "total_value": Decimal("0"),
            }
            for label, _, _ in bucket_defs
        }

        total_value = Decimal("0")
        oldest_date = None

        for batch in batches:
            if batch.remaining_bags <= 0:
                continue

            value = batch.stock_value  # property: remaining_pieces × cost_per_piece
            total_value += value

            age_days = (today - batch.purchase.date).days
            if oldest_date is None or batch.purchase.date < oldest_date:
                oldest_date = batch.purchase.date

            for label, min_d, max_d in bucket_defs:
                if min_d <= age_days <= max_d:
                    buckets[label]["batch_count"] += 1
                    buckets[label]["total_bags"] += batch.remaining_bags
                    buckets[label]["total_value"] += value
                    break

        bucket_list = []
        for label, _, _ in bucket_defs:
            b = buckets[label]
            bucket_list.append(
                {
                    "label": label,
                    "batch_count": b["batch_count"],
                    "total_bags": b["total_bags"],
                    "total_value": b["total_value"],
                    "percentage": (
                        round(float(b["total_value"]) / float(total_value) * 100, 1)
                        if total_value
                        else 0.0
                    ),
                }
            )

        result = {
            "total_inventory_value": total_value,
            "total_batches": sum(b["batch_count"] for b in bucket_list),
            "oldest_batch_date": oldest_date,
            "aging_buckets": bucket_list,
        }
        return Response(InventoryAgingSerializer(result).data)


    @action(detail=False, methods=["get"], url_path="product-performance")
    def product_performance(self, request):
        """
        Fast/slow/dead stock analysis for every product.

        Query params:
            start_date → default: 90 days ago
            end_date   → default: today
            currency   → default: app default
        """
        start_date, end_date = _date_range_from_request(request, default_days=90)
        currency = _currency_from_request(request)
        settings = AppSetting.get_settings()
        threshold = settings.low_stock_alert_percentage / 100
        today = datetime.date.today()

        item_codes = (
            StockBatch.objects.values_list("item_code", flat=True)
            .distinct()
            .order_by("item_code")
        )

        products = []
        fast_count = 0
        slow_count = 0
        dead_count = 0

        for code in item_codes:
            code_batches = StockBatch.objects.filter(item_code=code).select_related(
                "purchase"
            )

            total_purchased = 0
            total_sold = Decimal("0")
            remaining = Decimal("0")
            oldest_purchase_date = None

            for b in code_batches:
                total_purchased += b.total_bags_purchased
                total_sold += b.sold_bags
                remaining += b.remaining_bags
                if (
                    oldest_purchase_date is None
                    or b.purchase.date < oldest_purchase_date
                ):
                    oldest_purchase_date = b.purchase.date

            sale_items = SaleItem.objects.filter(
                stock_batch__item_code=code,
                sale__date__gte=start_date,
                sale__date__lte=end_date,
                sale__currency=currency,
            ).annotate(
                line_profit=ExpressionWrapper(
                    (F("selling_price") - F("purchase_cost_per_piece"))
                    * F("pieces_sold"),
                    output_field=DecimalField(max_digits=20, decimal_places=2),
                ),
                line_cost=ExpressionWrapper(
                    F("purchase_cost_per_piece") * F("pieces_sold"),
                    output_field=DecimalField(max_digits=20, decimal_places=2),
                ),
            )

            agg = sale_items.aggregate(
                total_revenue=Coalesce(Sum("total_line_amount"), Decimal("0")),
                total_cost=Coalesce(Sum("line_cost"), Decimal("0")),
                gross_profit=Coalesce(Sum("line_profit"), Decimal("0")),
            )

            total_revenue = agg["total_revenue"]
            total_cost = agg["total_cost"]
            gross_profit = agg["gross_profit"]

            sell_through = (
                round(float(total_sold) / float(total_purchased) * 100, 1)
                if total_purchased > 0
                else 0.0
            )
            profit_margin = (
                round(float(gross_profit) / float(total_revenue) * 100, 1)
                if total_revenue > 0
                else 0.0
            )

            avg_days_to_sell = None
            if oldest_purchase_date and total_sold > 0:
                avg_days_to_sell = float((today - oldest_purchase_date).days)

            age_days = (
                (today - oldest_purchase_date).days if oldest_purchase_date else 0
            )

            if sell_through > 70 and (avg_days_to_sell or 0) < 60:
                velocity = "fast"
                fast_count += 1
            elif sell_through < 10 and age_days > 90:
                velocity = "dead"
                dead_count += 1
            elif sell_through < 30:
                velocity = "slow"
                slow_count += 1
            else:
                velocity = "medium"

            if remaining <= 0:
                status = "sold_out"
            elif total_purchased > 0 and (remaining / total_purchased) < threshold:
                status = "low_stock"
            elif sell_through < 20 and remaining > total_purchased * Decimal("0.5"):
                status = "overstocked"
            else:
                status = "healthy"

            first_batch = code_batches.first()
            products.append(
                {
                    "item_code": code,
                    "product_name": first_batch.product_name if first_batch else code,
                    "total_bags_purchased": total_purchased,
                    "total_bags_sold": total_sold,
                    "total_bags_remaining": remaining,
                    "sell_through_rate": sell_through,
                    "total_revenue": total_revenue,
                    "total_cost": total_cost,
                    "gross_profit": gross_profit,
                    "profit_margin_percent": profit_margin,
                    "avg_days_to_sell": avg_days_to_sell,
                    "velocity": velocity,
                    "status": status,
                }
            )

        result = {
            "total_products": len(products),
            "fast_moving_count": fast_count,
            "slow_moving_count": slow_count,
            "dead_stock_count": dead_count,
            "products": products,
        }
        return Response(ProductPerformanceListSerializer(result).data)

    # PRIVATE COMPUTATION HELPERS

    _BUCKET_DEFS = [
        ("0-6 days", 0, 6),  # ← new
        ("7-15 days", 7, 14),
        ("15-30 days", 15, 29),
        ("30-60 days", 30, 59),
        ("60+ days", 60, 99999),
    ]

    def _days_overdue(self, customer: Customer, today: datetime.date) -> int | None:
        """
        How many days since this customer last paid?

        Uses customer.days_since_last_payment property directly.
        Falls back to days since first sale if no payment exists.
        """
        days = customer.days_since_last_payment
        if days is not None:
            return days

        # No payment ever recorded — measure from first sale
        first_sale = customer.sales.order_by("date").first()
        if first_sale and first_sale.date:
            return (today - first_sale.date).days

        return None

    def _compute_overdue_buckets(self) -> list:
        today = datetime.date.today()
        customers = Customer.objects.filter(is_active=True).prefetch_related(
            "income_records", "sales"
        )

        buckets = {
            label: {
                "label": label,
                "count": 0,
                "total_amount": Decimal("0"),
                "customers": [],
            }
            for label, _, _ in self._BUCKET_DEFS
        }

        for c in customers:
            bal = c.current_balance
            if bal <= 0:
                continue

            days = self._days_overdue(c, today)
            if days is None:
                days = 0  # treat as newest if we have no date at all

            for label, min_d, max_d in self._BUCKET_DEFS:
                if min_d <= days <= max_d:
                    buckets[label]["count"] += 1
                    buckets[label]["total_amount"] += bal
                    buckets[label]["customers"].append({
                        "id": c.id,
                        "name": c.name,
                        "amount": bal,
                        "days": days,
                    })
                    break

        return list(buckets.values())

    def _compute_overdue_flat(self) -> list:
        today = datetime.date.today()
        customers = Customer.objects.filter(is_active=True).prefetch_related(
            "income_records", "sales"
        )

        result = []
        for c in customers:
            bal = c.current_balance
            if bal <= 0:
                continue

            days = self._days_overdue(c, today)
            if days is None:
                days = 0

            # Find matching bucket label
            bucket_label = "0-6 days"
            for label, min_d, max_d in self._BUCKET_DEFS:
                if min_d <= days <= max_d:
                    bucket_label = label
                    break

            result.append({
                "id": c.id,
                "name": c.name,
                "phone": c.phone,
                "location": c.location,
                "current_balance": bal,
                "total_sales_amount": c.total_sales_amount,
                "total_paid": c.total_payments_received,
                "last_payment_date": c.last_payment_date,
                "last_purchase_date": c.last_purchase_date,
                "days_since_last_payment": days,
                "bucket": bucket_label,
            })

        result.sort(key=lambda x: x["days_since_last_payment"] or 0, reverse=True)
        return result


    def _compute_recent_transactions(self, limit: int = 10) -> list:
        """
        Last N transactions across all four transaction types,
        merged and sorted newest-first.
        """
        transactions = []

        for sale in Sale.objects.select_related("customer").order_by(
                "-date", "-created_at"
        )[:limit]:
            transactions.append(
                {
                    "id": sale.id,
                    "type": "sale",
                    "reference": sale.invoice_number,
                    "description": f"Sale to {sale.customer.name}",
                    "amount": sale.total_sale_amount,
                    "currency": sale.currency,
                    "date": sale.date,
                    "party_name": sale.customer.name,
                }
            )

        for income in CustomerIncome.objects.select_related("customer").order_by(
                "-date", "-created_at"
        )[:limit]:
            label = "Auto" if income.is_auto else "Manual"
            transactions.append(
                {
                    "id": income.id,
                    "type": "income",
                    "reference": income.receipt_number,
                    "description": f"Payment from {income.customer.name} ({label})",
                    "amount": income.paid_amount,
                    "currency": income.currency,
                    "date": income.date,
                    "party_name": income.customer.name,
                }
            )

        for payment in FactoryPayment.objects.select_related("factory").order_by(
                "-date", "-created_at"
        )[:limit]:
            label = "Auto" if payment.is_auto else "Manual"
            transactions.append(
                {
                    "id": payment.id,
                    "type": "factory_payment",
                    "reference": payment.payment_number,
                    "description": f"Payment to {payment.factory.name} ({label})",
                    "amount": payment.paid_amount,
                    "currency": payment.currency,
                    "date": payment.date,
                    "party_name": payment.factory.name,
                }
            )

        for expense in GeneralExpense.objects.order_by("-date", "-created_at")[:limit]:
            transactions.append(
                {
                    "id": expense.id,
                    "type": "expense",
                    "reference": expense.expense_number,
                    "description": expense.description[:80],
                    "amount": expense.amount,
                    "currency": expense.currency,
                    "date": expense.date,
                    "party_name": "",
                }
            )

        # Drop any transaction with no date — can't be sorted/ranked meaningfully
        transactions = [t for t in transactions if t["date"] is not None]

        transactions.sort(key=lambda x: x["date"], reverse=True)
        return transactions[:limit]


    def _compute_stock_alerts(self) -> list:
        """
        Items that need attention: sold out, low stock, or slow-moving.

        Uses StockBatch properties:
            remaining_bags, total_bags_purchased,
            is_sold_out, is_low_stock
        """
        settings = AppSetting.get_settings()
        threshold = settings.low_stock_alert_percentage / 100
        today = datetime.date.today()

        alerts = []
        for batch in StockBatch.objects.select_related("purchase"):
            remaining = batch.remaining_bags
            total = batch.total_bags_purchased
            pct_remaining = round(float(remaining) / float(total) * 100, 1) if total > 0 else 0.0

            if remaining <= 0:
                alert_type = "sold_out"
            elif total > 0 and (remaining / total) < threshold:
                alert_type = "low_stock"
            elif (today - batch.purchase.date).days > 90 and pct_remaining > 80:
                alert_type = "slow_moving"
            else:
                continue

            alerts.append(
                {
                    "id": batch.id,
                    "item_code": batch.item_code,
                    "product_name": batch.product_name,
                    "shipping_code": batch.shipping_code,
                    "remaining_bags": remaining,
                    "total_bags": total,
                    "percentage_remaining": pct_remaining,
                    "alert_type": alert_type,
                }
            )

        type_order = {"sold_out": 0, "low_stock": 1, "slow_moving": 2}
        alerts.sort(
            key=lambda x: (type_order.get(x["alert_type"], 3), x["percentage_remaining"])
        )
        return alerts
