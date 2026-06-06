"""
Unit of Work Pattern
Manages transaction boundaries.
"""

from contextlib import contextmanager
from typing import List
from django.db import transaction


class UnitOfWork:
    """
    Unit of Work pattern implementation for Django.
    Manages database transactions.
    """

    def __init__(self):
        self._transaction = None
        self._is_committed = False
        self._atomic_context = None

    def __enter__(self):
        self._atomic_context = self.atomic()
        return self._atomic_context.__enter__()

    def __exit__(self, exc_type, exc_val, exc_tb):
        return self._atomic_context.__exit__(exc_type, exc_val, exc_tb)

    @contextmanager
    def atomic(self, savepoint=True):
        with transaction.atomic(durable=False) as txn:
            self._transaction = txn
            try:
                yield self
                self._is_committed = True
            finally:
                self._transaction = None

    @contextmanager
    def atomic_with_locks(self, lock_items: List[tuple]):
        """Atomic transaction with row-level SELECT FOR UPDATE locks."""
        with transaction.atomic():
            for model_class, pk in lock_items:
                model_class.objects.select_for_update().get(pk=pk)
            yield self
            self._is_committed = True

    def commit(self):
        self._is_committed = True

    def is_active(self) -> bool:
        return self._transaction is not None

    def is_committed(self) -> bool:
        return self._is_committed


@contextmanager
def unit_of_work_context():
    uow = UnitOfWork()
    with uow.atomic():
        yield uow
