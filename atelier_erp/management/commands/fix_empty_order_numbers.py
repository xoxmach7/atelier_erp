"""
Fix existing orders with empty order_number
Assigns proper О-YYYY-NNN format numbers to bad records
"""
import re
from datetime import datetime

from django.core.management.base import BaseCommand
from django.db import transaction

from atelier_erp.models import Order


class Command(BaseCommand):
    help = 'Fix orders with empty order_number by assigning proper numbers'

    def handle(self, *args, **options):
        # Find orders with empty order_number
        bad_orders = Order.objects.filter(order_number='')
        count = bad_orders.count()
        
        if count == 0:
            self.stdout.write(self.style.SUCCESS('No orders with empty order_number found.'))
            return
        
        self.stdout.write(f'Found {count} orders with empty order_number. Fixing...')
        
        # Group by year based on created_at
        orders_by_year = {}
        for order in bad_orders:
            year = order.created_at.year
            if year not in orders_by_year:
                orders_by_year[year] = []
            orders_by_year[year].append(order)
        
        fixed_count = 0
        
        with transaction.atomic():
            for year in sorted(orders_by_year.keys()):
                orders = orders_by_year[year]
                
                # Find the highest sequence number for this year
                latest = Order.objects.filter(
                    order_number__regex=f'^О-{year}-\\d{{3}}$'
                ).order_by('-order_number').first()
                
                if latest:
                    match = re.match(rf'^О-{year}-(\d{{3}})$', latest.order_number)
                    if match:
                        seq = int(match.group(1)) + 1
                    else:
                        seq = 1
                else:
                    seq = 1
                
                # Assign numbers to bad orders
                for order in orders:
                    order_number = f"О-{year}-{seq:03d}"
                    
                    # Check if this number already exists (shouldn't happen, but safety check)
                    while Order.objects.filter(order_number=order_number).exists():
                        seq += 1
                        order_number = f"О-{year}-{seq:03d}"
                    
                    order.order_number = order_number
                    order.save(update_fields=['order_number'])
                    
                    self.stdout.write(f'  Fixed order {order.id}: assigned {order_number}')
                    
                    seq += 1
                    fixed_count += 1
        
        self.stdout.write(self.style.SUCCESS(f'Successfully fixed {fixed_count} orders.'))
