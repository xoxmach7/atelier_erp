from rest_framework import serializers


class EmptySerializer(serializers.Serializer):
    """Empty serializer for actions without data."""

    pass


class SuccessResponseSerializer(serializers.Serializer):
    """Standard success response serializer."""

    success = serializers.BooleanField(default=True)
    message = serializers.CharField()
    data = serializers.JSONField(required=False)


class ErrorResponseSerializer(serializers.Serializer):
    """Standard error response serializer."""

    success = serializers.BooleanField(default=False)
    error = serializers.DictField(child=serializers.CharField())


class PaginationSerializer(serializers.Serializer):
    """Pagination metadata serializer."""

    count = serializers.IntegerField()
    total_pages = serializers.IntegerField()
    current_page = serializers.IntegerField()
    page_size = serializers.IntegerField()
    next = serializers.URLField(required=False, allow_null=True)
    previous = serializers.URLField(required=False, allow_null=True)


class IDSerializer(serializers.Serializer):
    """Serializer for ID-only requests."""

    id = serializers.UUIDField()


class StatusSerializer(serializers.Serializer):
    """Status update serializer."""

    status = serializers.ChoiceField(choices=[])

    def __init__(self, choices, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["status"].choices = choices
