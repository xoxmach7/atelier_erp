#!/usr/bin/env python
"""
Actually create a quote through the serializer to trace the bug
"""
import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'atelier_erp.settings')
sys.path.insert(0, 'c:/Users/XoXmach/Desktop/Projects/atelie erp')
django.setup()

from decimal import Decimal
from atelier_erp.api.serializers import QuoteCreateSerializer
from atelier_erp.models import Customer, Fabric

# Get real data
real_customer = Customer.objects.first()
real_fabric = Fabric.objects.first()

if not real_customer:
    print("No customers found!")
    sys.exit(1)

print(f"Using customer: {real_customer.id}")
print(f"Using fabric: {real_fabric.id if real_fabric else 'None'}")

# Simulate what the frontend sends (matching the actual flow)
input_data = {
    'customer': str(real_customer.id),
    'status': 'draft',
    'subtotal': 180000.0,  # Float from JSON
    'discount_amount': 0.0,
    'installation_cost': 0.0,
    'delivery_cost': 0.0,
    'prepayment_percent': 0.5,
    'items': [
        {
            'room_name': 'Debug Room',
            'window_width_cm': 200,
            'window_height_cm': 150,
            'folds_count': 0,
            'fabric': str(real_fabric.id) if real_fabric else None,
            'fabric_meters': 10.0,
            'fabric_cost': 180000.0,
            'sewing_type': 'standard',
            'complexity': 'medium',
            'sewing_cost': 0.0,
            'accessories_cost': 0.0,
            'cornice': None,
            'cornice_cost': 0.0,
        }
    ]
}

# Create serializer and save
serializer = QuoteCreateSerializer(data=input_data)
if serializer.is_valid():
    print("\n✓ Serializer is valid")
    
    # Manually trace through create logic
    validated_data = dict(serializer.validated_data)  # Copy to avoid modifying original
    
    print(f"\n--- BEFORE CREATE ---")
    print(f"validated_data keys: {list(validated_data.keys())}")
    for key, val in validated_data.items():
        if key != 'items':
            print(f"  {key}: {val} (type: {type(val).__name__})")
    
    # Simulate create()
    items_data = validated_data.pop('items', [])
    
    # Line 363
    subtotal_var = validated_data.pop('subtotal', Decimal('0')) or Decimal('0')
    print(f"\n  subtotal_var = {subtotal_var} (type: {type(subtotal_var).__name__})")
    
    # Lines 364-366
    discount_var = validated_data.get('discount_amount', Decimal('0')) or Decimal('0')
    install_var = validated_data.get('installation_cost', Decimal('0')) or Decimal('0')
    delivery_var = validated_data.get('delivery_cost', Decimal('0')) or Decimal('0')
    
    print(f"  discount_var = {discount_var} (type: {type(discount_var).__name__})")
    print(f"  install_var = {install_var} (type: {type(install_var).__name__})")
    print(f"  delivery_var = {delivery_var} (type: {type(delivery_var).__name__})")
    
    print(f"\n--- VALIDATED_DATA AFTER POP/GET ---")
    print(f"Keys remaining: {list(validated_data.keys())}")
    for key, val in validated_data.items():
        print(f"  {key}: {val} (type: {type(val).__name__})")
    
    # Check if discount_amount, installation_cost, delivery_cost are still in validated_data
    print(f"\n  discount_amount in validated_data: {'discount_amount' in validated_data}")
    print(f"  installation_cost in validated_data: {'installation_cost' in validated_data}")
    print(f"  delivery_cost in validated_data: {'delivery_cost' in validated_data}")
    
    # Simulate item processing
    computed_subtotal = Decimal('0')
    for item_data in items_data:
        if not item_data.get('line_total'):
            fabric_cost = item_data.get('fabric_cost', Decimal('0')) or Decimal('0')
            sewing_cost = item_data.get('sewing_cost', Decimal('0')) or Decimal('0')
            accessories_cost = item_data.get('accessories_cost', Decimal('0')) or Decimal('0')
            cornice_cost = item_data.get('cornice_cost', Decimal('0')) or Decimal('0')
            item_data['line_total'] = fabric_cost + sewing_cost + accessories_cost + cornice_cost
        
        line_total = item_data.get('line_total', Decimal('0')) or Decimal('0')
        computed_subtotal += line_total
        print(f"\n  Item: {item_data['room_name']}, line_total: {line_total}")
    
    print(f"\n--- COMPUTED VALUES ---")
    print(f"computed_subtotal: {computed_subtotal}")
    
    # Calculate total
    if computed_subtotal > 0:
        calculated_total = computed_subtotal - discount_var + install_var + delivery_var
        print(f"calculated_total: {calculated_total}")
        print(f"calculated_total type: {type(calculated_total).__name__}")
    
    # Now actually save and see what happens
    print(f"\n--- ACTUAL SAVE ---")
    try:
        # Create in a transaction so we can rollback if needed
        from django.db import transaction
        with transaction.atomic():
            quote = serializer.save()
            print(f"Quote created: {quote.quote_number}")
            print(f"  subtotal: {quote.subtotal}")
            print(f"  total: {quote.total}")
            print(f"  discount_amount: {quote.discount_amount}")
            print(f"  installation_cost: {quote.installation_cost}")
            print(f"  delivery_cost: {quote.delivery_cost}")
            
            # Check if they match
            if quote.subtotal == computed_subtotal and quote.total == calculated_total:
                print("\n✓ VALUES MATCH!")
            else:
                print(f"\n❌ MISMATCH!")
                print(f"  Expected subtotal: {computed_subtotal}, got: {quote.subtotal}")
                print(f"  Expected total: {calculated_total}, got: {quote.total}")
            
            # Rollback
            raise Exception("Rollback")
    except Exception as e:
        if str(e) == "Rollback":
            print("\n(Rolled back test quote)")
        else:
            raise
else:
    print("❌ Serializer errors:")
    print(serializer.errors)
