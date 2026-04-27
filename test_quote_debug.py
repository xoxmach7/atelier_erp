#!/usr/bin/env python
"""
Debug script to trace quote creation and identify why total is 0
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'atelier_erp.settings')
sys.path.insert(0, 'c:/Users/XoXmach/Desktop/Projects/atelie erp')
django.setup()

from decimal import Decimal
from atelier_erp.models import Quote, QuoteItem, Customer, Task, Fabric

# Check the most recently created quote
latest_quote = Quote.objects.order_by('-created_at').first()

if not latest_quote:
    print("No quotes found!")
    sys.exit(1)

print(f"Latest Quote: {latest_quote.quote_number}")
print(f"  ID: {latest_quote.id}")
print(f"  Subtotal: {latest_quote.subtotal} (type: {type(latest_quote.subtotal).__name__})")
print(f"  Total: {latest_quote.total} (type: {type(latest_quote.total).__name__})")
print(f"  Discount: {latest_quote.discount_amount}")
print(f"  Installation: {latest_quote.installation_cost}")
print(f"  Delivery: {latest_quote.delivery_cost}")
print(f"  Items count: {latest_quote.items.count()}")

# Check items
items_total = Decimal('0')
for item in latest_quote.items.all():
    print(f"  - Item: {item.room_name}, line_total: {item.line_total}")
    items_total += item.line_total

print(f"\nComputed subtotal from items: {items_total}")
print(f"Expected total: {items_total - latest_quote.discount_amount + latest_quote.installation_cost + latest_quote.delivery_cost}")

# Check if there's a mismatch
if latest_quote.subtotal != items_total:
    print(f"\n⚠️  MISMATCH: stored subtotal ({latest_quote.subtotal}) != items sum ({items_total})")
else:
    print(f"\n✓ Subtotal matches items sum")

if latest_quote.total == 0 and items_total > 0:
    print(f"\n❌ BUG CONFIRMED: total is 0 but should be {items_total}")
