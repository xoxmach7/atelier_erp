from django.core.management.base import BaseCommand

from apps.users.models import User


class Command(BaseCommand):
    help = "Seed database with initial data"

    def handle(self, *args, **kwargs):
        self.stdout.write("Seeding database...")

        # Create default admin if not exists
        if not User.objects.filter(email="admin@brigada.kz").exists():
            User.objects.create_superuser(
                email="admin@brigada.kz",
                password="admin123",
                first_name="Admin",
                last_name="User",
            )
            self.stdout.write(self.style.SUCCESS("Default admin created"))

        # Create sample manager
        if not User.objects.filter(email="manager@brigada.kz").exists():
            User.objects.create_user(
                email="manager@brigada.kz",
                password="manager123",
                first_name="Manager",
                last_name="User",
                role=User.Role.MANAGER,
            )
            self.stdout.write(self.style.SUCCESS("Default manager created"))

        self.stdout.write(self.style.SUCCESS("Database seeding completed!"))
