from decimal import Decimal

from django.db import transaction

from apps.inventory.models import Product, StockMovement


class InventoryService:
    """Service for inventory operations."""

    @classmethod
    @transaction.atomic
    def update_stock(
        cls,
        product_id: str,
        quantity: float,
        movement_type: str,
        notes: str = "",
        user=None,
    ) -> StockMovement:
        """Update product stock and create movement record."""
        from core.exceptions import NotFoundError

        try:
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            raise NotFoundError(f"Product with id {product_id} not found")

        # Create movement record
        movement = StockMovement.objects.create(
            product=product,
            type=movement_type,
            quantity=Decimal(str(quantity)),
            notes=notes,
            created_by=user,
        )

        # Update stock quantity
        if movement_type == StockMovement.Type.IN:
            product.stock_quantity += Decimal(str(quantity))
        elif movement_type == StockMovement.Type.OUT:
            product.stock_quantity -= Decimal(str(quantity))
        elif movement_type == StockMovement.Type.ADJUSTMENT:
            product.stock_quantity = Decimal(str(quantity))

        product.save(update_fields=["stock_quantity"])

        return movement

    @classmethod
    def get_low_stock_products(cls):
        """Get products that need reordering."""
        products = Product.objects.filter(
            track_stock=True,
            is_active=True,
        )
        return [p for p in products if p.needs_reorder]

    @classmethod
    def get_inventory_value(cls):
        """Calculate total inventory value."""
        from django.db.models import Sum, F

        result = Product.objects.filter(
            track_stock=True,
            is_active=True,
        ).aggregate(
            total_value=Sum(F("stock_quantity") * F("cost_price"))
        )
        return result["total_value"] or 0
