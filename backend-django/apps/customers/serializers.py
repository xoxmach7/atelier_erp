from rest_framework import serializers

from apps.customers.models import Customer


class CustomerListSerializer(serializers.ModelSerializer):
    """Serializer for listing customers."""

    display_name = serializers.CharField(read_only=True)
    assigned_to_name = serializers.CharField(
        source="assigned_to.get_full_name", read_only=True
    )

    class Meta:
        model = Customer
        fields = [
            "id",
            "type",
            "display_name",
            "phone",
            "email",
            "city",
            "total_orders",
            "total_spent",
            "last_order_date",
            "assigned_to",
            "assigned_to_name",
            "is_active",
            "created_at",
        ]


class CustomerDetailSerializer(serializers.ModelSerializer):
    """Serializer for customer details."""

    display_name = serializers.CharField(read_only=True)
    full_name = serializers.CharField(read_only=True)
    type_display = serializers.CharField(source="get_type_display", read_only=True)
    source_display = serializers.CharField(source="get_source_display", read_only=True)

    class Meta:
        model = Customer
        exclude = ["is_active", "deleted_at"]


class CustomerCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating customers."""

    class Meta:
        model = Customer
        fields = [
            "type",
            "first_name",
            "last_name",
            "company_name",
            "phone",
            "phone_secondary",
            "email",
            "address",
            "city",
            "region",
            "bin",
            "source",
            "notes",
            "discount_percent",
            "assigned_to",
        ]

    def validate(self, data):
        if data.get("type") == Customer.Type.COMPANY:
            if not data.get("company_name") and not data.get("bin"):
                raise serializers.ValidationError(
                    "Company name or BIN is required for company customers."
                )
        return data


class CustomerUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating customers."""

    class Meta:
        model = Customer
        fields = [
            "first_name",
            "last_name",
            "company_name",
            "phone",
            "phone_secondary",
            "email",
            "address",
            "city",
            "region",
            "notes",
            "discount_percent",
            "assigned_to",
        ]


class CustomerStatsSerializer(serializers.ModelSerializer):
    """Serializer for customer statistics."""

    class Meta:
        model = Customer
        fields = ["total_orders", "total_spent", "last_order_date"]
