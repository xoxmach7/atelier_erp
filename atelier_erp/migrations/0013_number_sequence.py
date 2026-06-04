"""
Атомарный счётчик номеров документов (NumberSequence).

Заменяет racy count()+1 / "latest+1" при генерации номеров заказов, КП и задач.
"""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("atelier_erp", "0012_canonicalize_role_groups"),
    ]

    operations = [
        migrations.CreateModel(
            name="NumberSequence",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("prefix", models.CharField(max_length=8)),
                ("year", models.PositiveIntegerField()),
                ("last_value", models.PositiveIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Number Sequence",
                "verbose_name_plural": "Number Sequences",
                "db_table": "number_sequence",
            },
        ),
        migrations.AddConstraint(
            model_name="numbersequence",
            constraint=models.UniqueConstraint(fields=("prefix", "year"), name="uniq_number_sequence_prefix_year"),
        ),
    ]
