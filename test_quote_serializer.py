#!/usr/bin/env python
"""
Test the QuoteCreateSerializer logic directly to find the bug
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
from atelier_erp.models import Customer

# Get a real customer
real_customer = Customer.objects.first()
if not real_customer:
    print("No customers found!")
    sys.exit(1)

print(f"Using customer: {real_customer.id}")

# Simulate what the frontend sends
input_data = {
    'customer': str(real_customer.id),  # Real customer UUID
    'status': 'draft',
    'subtotal': 180000.0,  # Python float from JSON
    'discount_amount': 0.0,
    'installation_cost': 0.0,
    'delivery_cost': 0.0,
    'prepayment_percent': 0.5,
    'items': [
        {
            'room_name': 'Test Room',
            'window_width_cm': 200,
            'window_height_cm': 150,
            'fabric': None,
            'fabric_meters': 10.0,
            'fabric_cost': 180000.0,  # This becomes line_total
            'sewing_type': 'standard',
            'complexity': 'medium',
            'sewing_cost': 0.0,
            'accessories_cost': 0.0,
            'cornice': None,
            'cornice_cost': 0.0,
        }
    ]
}

# Create serializer and validate
serializer = QuoteCreateSerializer(data=input_data)
if serializer.is_valid():
    print("✓ Serializer is valid")
    validated_data = serializer.validated_data
    print(f"\nValidated data keys: {list(validated_data.keys())}")
    print(f"subtotal type: {type(validated_data.get('subtotal')).__name__} = {validated_data.get('subtotal')}")
    print(f"discount_amount type: {type(validated_data.get('discount_amount')).__name__} = {validated_data.get('discount_amount')}")
    print(f"installation_cost type: {type(validated_data.get('installation_cost')).__name__} = {validated_data.get('installation_cost')}")
    print(f"delivery_cost type: {type(validated_data.get('delivery_cost')).__name__} = {validated_data.get('delivery_cost')}")
    
    # Simulate what happens in create()
    items_data = validated_data.pop('items', [])
    subtotal = validated_data.pop('subtotal', Decimal('0')) or Decimal('0')
    discount_amount = validated_data.get('discount_amount', Decimal('0')) or Decimal('0')
    installation_cost = validated_data.get('installation_cost', Decimal('0')) or Decimal('0')
    delivery_cost = validated_data.get('delivery_cost', Decimal('0')) or Decimal('0')
    
    print(f"\nAfter pop/get:")
    print(f"  subtotal var: {subtotal} (type: {type(subtotal).__name__})")
    print(f"  discount_amount var: {discount_amount} (type: {type(discount_amount).__name__})")
    print(f"  installation_cost var: {installation_cost} (type: {type(installation_cost).__name__})")
    print(f"  delivery_cost var: {delivery_cost} (type: {type(delivery_cost).__name__})")
    
    # Simulate item processing
    computed_subtotal = Decimal('0')
    for item_data in items_data:
        if not item_data.get('line_total'):
            fabric_cost = item_data.get('fabric_cost', Decimal('0')) or Decimal('0')
            sewing_cost = item_data.get('sewing_cost', Decimal('0')) or Decimal('0')
            accessories_cost = item_data.get('accessories_cost', Decimal('0')) or Decimal('0')
            cornice_cost = item_data.get('cornice_cost', Decimal('0')) or Decimal('0')
            item_data['line_total'] = fabric_cost + sewing_cost + accessories_cost + cornice_cost
        
        computed_subtotal += item_data.get('line_total', Decimal('0')) or Decimal('0')
    
    print(f"\nComputed subtotal: {computed_subtotal}")
    
    # Calculate what total SHOULD be
    if computed_subtotal > 0:
        expected_total = computed_subtotal - discount_amount + installation_cost + delivery_cost
        print(f"Expected total: {expected_total}")
        print(f"Expected total type: {type(expected_total).__name__}")
else:
    print("❌ Serializer errors:")
    print(serializer.errors)
