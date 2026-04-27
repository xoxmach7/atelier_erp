"""
Fix quotes with empty quote_number by assigning proper sequential numbers.

Usage:
    python manage.py fix_empty_quote_numbers [--dry-run]
"""

from django.core.management.base import BaseCommand, CommandError
from atelier_erp.models import Quote


class Command(BaseCommand):
    help = 'Fix quotes with empty quote_number by assigning proper sequential numbers'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be changed without actually modifying data',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        # Find quotes with empty quote_number
        bad_quotes = Quote.objects.filter(quote_number='')
        
        if not bad_quotes.exists():
            self.stdout.write(self.style.SUCCESS('No quotes with empty quote_number found.'))
            return
        
        self.stdout.write(f'Found {bad_quotes.count()} quote(s) with empty quote_number')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN - no changes will be made'))
        
        fixed_count = 0
        year = 2026  # Use current year for new numbers
        
        for quote in bad_quotes:
            # Generate a unique quote number
            latest = Quote.objects.filter(
                quote_number__regex=f'^КП-{year}-\\d{{3}}$'
            ).order_by('-quote_number').first()
            
            if latest and latest.quote_number:
                import re
                match = re.match(rf'^КП-{year}-(\d{{3}})$', latest.quote_number)
                seq = int(match.group(1)) + 1 if match else 1
            else:
                seq = 1
            
            new_number = f"КП-{year}-{seq:03d}"
            
            self.stdout.write(f'  Quote {quote.id}: "" -> {new_number}')
            
            if not dry_run:
                quote.quote_number = new_number
                quote.save(update_fields=['quote_number'])
            
            fixed_count += 1
        
        if dry_run:
            self.stdout.write(self.style.WARNING(f'Would fix {fixed_count} quote(s)'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Fixed {fixed_count} quote(s)'))
