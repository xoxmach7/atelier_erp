import uuid6
from django.db import models


class TimeStampedModel(models.Model):
    """Abstract base model with created/modified timestamps."""

    id = models.UUIDField(primary_key=True, default=uuid6.uuid7, editable=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    modified_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        abstract = True
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.__class__.__name__}({self.id})"


class SoftDeleteModel(TimeStampedModel):
    """Abstract model with soft delete capability."""

    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        abstract = True

    def delete(self, *args, **kwargs) -> None:
        """Soft delete instead of hard delete."""
        self.is_active = False
        self.save(update_fields=["is_active"])

    def hard_delete(self, *args, **kwargs) -> None:
        """Actually delete the record."""
        super().delete(*args, **kwargs)

    @property
    def is_deleted(self) -> bool:
        return not self.is_active
