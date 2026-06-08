"""
0014 — Simplify ProductionStage: cutting→sewing, quality_check→done
"""
from django.db import migrations


def remap_production_stages(apps, schema_editor):
    Order = apps.get_model('atelier_erp', 'Order')
    # cutting is now sewing
    Order.objects.filter(production_stage='cutting').update(production_stage='sewing')
    # quality_check is now done
    Order.objects.filter(production_stage='quality_check').update(production_stage='done')


class Migration(migrations.Migration):

    dependencies = [
        ('atelier_erp', '0013_number_sequence'),
    ]

    operations = [
        migrations.RunPython(remap_production_stages, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='order',
            name='production_stage',
            field=__import__('django.db.models', fromlist=['CharField']).CharField(
                choices=[
                    ('not_started', 'Не начато'),
                    ('sewing', 'Пошив'),
                    ('done', 'Производство завершено'),
                ],
                db_index=True,
                default='not_started',
                help_text='Production progress stage',
                max_length=20,
            ),
        ),
    ]
