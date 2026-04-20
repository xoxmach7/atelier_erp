import time

from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError


class Command(BaseCommand):
    help = "Wait for database to be available"

    def add_arguments(self, parser):
        parser.add_argument(
            "--timeout",
            type=int,
            default=60,
            help="Maximum time to wait in seconds",
        )
        parser.add_argument(
            "--interval",
            type=int,
            default=1,
            help="Interval between checks in seconds",
        )

    def handle(self, *args, **options):
        timeout = options["timeout"]
        interval = options["interval"]
        start_time = time.time()

        self.stdout.write("Waiting for database...")

        db_conn = None
        while not db_conn:
            try:
                db_conn = connections["default"]
                db_conn.ensure_connection()
            except OperationalError:
                if time.time() - start_time > timeout:
                    self.stdout.write(
                        self.style.ERROR(
                            f"Database not available after {timeout} seconds"
                        )
                    )
                    raise
                self.stdout.write(
                    f"Database unavailable, waiting {interval} second(s)..."
                )
                time.sleep(interval)

        self.stdout.write(self.style.SUCCESS("Database available!"))
