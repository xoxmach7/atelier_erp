from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('atelier_erp', '0019_data_migrate_default_tenant'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='materials_ready_at',
            field=models.DateTimeField(blank=True, help_text='When material_readiness became ready', null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='production_started_at',
            field=models.DateTimeField(blank=True, help_text='When production_stage first left not_started', null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='production_done_at',
            field=models.DateTimeField(blank=True, help_text='When production_stage became done', null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='handover_done_at',
            field=models.DateTimeField(blank=True, help_text='When handover_stage became done', null=True),
        ),
    ]
