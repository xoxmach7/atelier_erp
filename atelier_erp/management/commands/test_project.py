"""
Management command to run project tests
"""

from django.core.management.base import BaseCommand
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Run Atelier ERP project tests with coverage'

    def add_arguments(self, parser):
        parser.add_argument(
            '--verbose', '-v',
            action='store_true',
            help='Verbose output'
        )
        parser.add_argument(
            '--test-type',
            choices=['all', 'unit', 'integration', 'api'],
            default='all',
            help='Type of tests to run'
        )

    def handle(self, *args, **options):
        verbosity = 2 if options['verbose'] else 1
        test_type = options['test_type']
        
        self.stdout.write(self.style.MIGRATE_HEADING('Running Atelier ERP Tests'))
        
        # Map test types to test modules
        test_modules = {
            'all': 'atelier_erp.tests',
            'unit': 'atelier_erp.tests.test_models atelier_erp.tests.test_services',
            'integration': 'atelier_erp.tests.test_api',
            'api': 'atelier_erp.tests.test_api',
        }
        
        tests = test_modules.get(test_type, 'atelier_erp.tests')
        
        self.stdout.write(f'Running: {tests}')
        
        try:
            call_command(
                'test',
                tests,
                verbosity=verbosity,
                failfast=False
            )
            self.stdout.write(self.style.SUCCESS('\n✓ All tests passed!'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\n✗ Tests failed: {e}'))
