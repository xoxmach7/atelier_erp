"""
Order Execution Service
Workflow management and execution tracking for orders.
This is a helper service that complements OrderService, not a replacement.
"""

from decimal import Decimal
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID

from django.utils import timezone

from ..models import Order, OrderCompletionAct
from ..constants import (
    OrderFSMRules, OrderExecutionGuide,
    MaterialReadiness, ProductionStage, HandoverStage
)
from .exceptions import OrderValidationError, InvalidOrderStatusTransition


class OrderExecutionService:
    """
    Service for order execution workflow management.
    
    Provides:
    - Available actions for current order state
    - Workflow summary with warnings
    - Stage change operations (materials, production, handover)
    """
    
    def __init__(self, order_service=None):
        """
        Args:
            order_service: Optional OrderService instance for transitions
        """
        self.order_service = order_service
    
    # ============================================
    # ROLE-BASED EXECUTION SUMMARY
    # ============================================
    
    def get_order_execution_summary(
        self,
        order: Order,
        user=None
    ) -> Dict[str, Any]:
        """
        Get complete execution summary for order detail page.
        Role-based view for all MVP roles.
        
        Returns:
            Dict with order core data, payment state, blockers, warnings,
            available actions, and role-specific sections.
        """
        # Core order info
        summary = {
            'order_id': str(order.id),
            'order_number': order.order_number,
            'customer': self._get_customer_summary(order),
            'status': order.status,
            'status_label': order.get_status_display(),
            'material_readiness': order.material_readiness,
            'material_readiness_label': self._get_material_readiness_label(order.material_readiness),
            'production_stage': order.production_stage,
            'production_stage_label': self._get_production_stage_label(order.production_stage),
            'handover_stage': order.handover_stage,
            'handover_stage_label': self._get_handover_stage_label(order.handover_stage),
        }
        
        # Payment summary
        payment_info = self._get_payment_info(order)
        summary.update({
            'paid_amount': payment_info['paid_amount'],
            'total_amount': payment_info['total_amount'],
            'balance_due': payment_info['balance_due'],
            'payment_state': payment_info['payment_state'],
            'payment_state_label': payment_info['payment_state_label'],
        })
        
        # Даты и адрес/замеры — верхний уровень, который читает мобильный
        # экран деталей заказа ([id].tsx). Раньше измерения жили только внутри
        # role_sections.designer, поэтому список замеров на экране был пустым,
        # а адрес брался из customer.address (куда мобилка адрес не пишет —
        # она кладёт его в order.installation_address_*). Отдаём явно.
        summary['created_at'] = order.created_at.isoformat() if getattr(order, 'created_at', None) else None
        summary['designer_name'] = self._responsible_name(order)
        summary['measurement_date'] = order.measurement_date.isoformat() if order.measurement_date else None
        summary['installation_date'] = order.installation_date.isoformat() if order.installation_date else None
        summary['planned_completion'] = order.planned_completion.isoformat() if order.planned_completion else None
        summary['installation_address'] = self._format_installation_address(order)
        summary['measurements'] = self._get_designer_section(order)['measurements']

        # Computed fields
        summary['is_overdue'] = self._is_overdue(order)
        summary['next_step'] = self._get_next_step(order)
        
        # Workflow state
        summary['blocking_reasons'] = self._get_blockers(order)
        summary['warnings'] = self._get_warnings(order)
        summary['available_actions'] = self.get_available_actions(order, user)
        
        # Role sections
        summary['role_sections'] = self.get_role_sections(order, user)
        
        return summary
    
    def _get_customer_summary(self, order: Order) -> Dict[str, Any]:
        """Get minimal customer summary"""
        customer = order.customer
        return {
            'id': str(customer.id),
            'full_name': customer.full_name,
            'phone': customer.phone,
            'address': {
                'city': customer.address_city,
                'street': customer.address_street,
                'building': customer.address_building,
                'apartment': customer.address_apartment,
            } if any([customer.address_city, customer.address_street]) else None
        }
    
    def _responsible_name(self, order: Order) -> str:
        """Дизайнер/ответственный по заказу — для карточки заказа в мобилке."""
        user = getattr(order, 'responsible_user', None)
        if not user:
            return ''
        full = user.get_full_name() if hasattr(user, 'get_full_name') else ''
        return (full or getattr(user, 'username', '') or '').strip()

    def _format_installation_address(self, order: Order) -> str:
        """Адрес монтажа из полей заказа (в упрощённом мобильном режиме весь
        адрес лежит в installation_address_street). Пусто → ''."""
        parts = [
            order.installation_address_city,
            order.installation_address_street,
            order.installation_address_building,
            order.installation_address_apartment,
        ]
        return ', '.join(p for p in parts if p) or ''

    def _is_overdue(self, order: Order) -> bool:
        """Check if order is overdue based on planned_completion"""
        if not order.planned_completion:
            return False
        from datetime import date
        return date.today() > order.planned_completion and order.status not in [
            Order.Status.COMPLETED, Order.Status.CANCELLED
        ]
    
    def _get_next_step(self, order: Order) -> Dict[str, str]:
        """Get next recommended step based on status"""
        guidance = OrderExecutionGuide.get_guidance(order.status)
        steps = guidance.get('next_steps', [])
        return {
            'description': guidance.get('description', ''),
            'recommended_actions': steps[:3] if steps else [],
        }
    
    def get_role_sections(
        self,
        order: Order,
        user=None
    ) -> Dict[str, Any]:
        """
        Get role-specific sections for order detail.
        Each role sees only relevant data.
        """
        return {
            'admin': self._get_admin_section(order),
            'designer': self._get_designer_section(order),
            'warehouse': self._get_warehouse_section(order),
            'production': self._get_production_section(order),
            'installer': self._get_installer_section(order),
        }
    
    def _get_admin_section(self, order: Order) -> Dict[str, Any]:
        """Admin/Owner section - full overview"""
        # Quote status
        quote_status = None
        if order.quote:
            quote_status = {
                'id': str(order.quote.id),
                'quote_number': order.quote.quote_number,
                'status': order.quote.status,
                'total': order.quote.total,
            }
        
        # Production assignment summary
        prod_assignment = None
        if hasattr(order, 'production_assignment') and order.production_assignment:
            pa = order.production_assignment
            prod_assignment = {
                'assigned_to': pa.assigned_to.get_full_name() if pa.assigned_to else None,
                'status': pa.status,
                'deadline': pa.deadline,
                'complexity': pa.complexity,
            }
        
        return {
            'customer': self._get_customer_summary(order),
            'order_status': {
                'status': order.status,
                'label': order.get_status_display(),
                'material_readiness': order.material_readiness,
                'production_stage': order.production_stage,
                'handover_stage': order.handover_stage,
            },
            'payment_summary': {
                'total': order.total_amount,
                'paid': order.paid_amount,
                'balance_due': order.total_amount - order.paid_amount,
                'is_fully_paid': order.paid_amount >= order.total_amount,
            },
            'quote_status': quote_status,
            'measurement_count': order.measurements.count(),
            'production_status': prod_assignment,
            'next_step': self._get_next_step(order),
        }
    
    def _get_designer_section(self, order: Order) -> Dict[str, Any]:
        """Designer/Measurer section - measurements and materials"""
        measurements = []
        # prefetch фото: без него каждый замер делал бы свой запрос за
        # photo_reports (N+1 на заказе с десятком окон).
        for m in order.measurements.prefetch_related('photo_reports').all():
            measurements.append({
                'id': str(m.id),
                'room_name': m.room_name,
                'window_name': m.window_name,
                'width_cm': m.width_cm,
                'height_cm': m.height_cm,
                'mounting_type': m.mounting_type,
                # Phase 3: Curtain and tulle fabrics with meters
                'curtain_fabric': str(m.curtain_fabric.id) if m.curtain_fabric else None,
                'curtain_fabric_name': m.curtain_fabric.name if m.curtain_fabric else None,
                'curtain_meters': float(m.curtain_meters) if m.curtain_meters else 0,
                'tulle_fabric': str(m.tulle_fabric.id) if m.tulle_fabric else None,
                'tulle_fabric_name': m.tulle_fabric.name if m.tulle_fabric else None,
                'tulle_meters': float(m.tulle_meters) if m.tulle_meters else 0,
                'notes': m.notes,
                # Склад отмечает по каждому окну, что материалы собраны
                'materials_ready': m.materials_ready,
                # Швея отмечает по каждому окну, что изделие сшито
                'sewing_done': m.sewing_done,
                # Установщик отмечает по каждому окну, что изделие повешено
                'installation_done': m.installation_done,
                'photos': [
                    {
                        'id': str(p.id),
                        'url': p.file.url if p.file else None,
                        'caption': p.caption,
                    }
                    for p in m.photo_reports.filter(is_active=True)
                ],
            })

        # Selected materials from quote items if available
        selected_materials = []
        if order.quote:
            for qi in order.quote.items.all():
                material = {
                    'room': qi.room_name if hasattr(qi, 'room_name') else None,
                    # Phase 3: Include both curtain and tulle fabrics
                    'fabric': qi.fabric.name if qi.fabric else None,
                    'fabric_meters': qi.fabric_meters if hasattr(qi, 'fabric_meters') else None,
                    'tulle_fabric': qi.tulle_fabric.name if qi.tulle_fabric else None,
                    'tulle_meters': float(qi.tulle_meters) if qi.tulle_meters else None,
                    'sewing_type': qi.sewing_type,
                }
                selected_materials.append(material)
        
        return {
            'measurements': measurements,
            'rooms_count': len(set(m.room_name for m in order.measurements.all())),
            'windows_count': order.measurements.count(),
            'selected_materials': selected_materials,
            'quote_items_count': order.quote.items.count() if order.quote else 0,
        }
    
    def _get_warehouse_section(self, order: Order) -> Dict[str, Any]:
        """Warehouse section - material requirements"""
        material_requirements = []
        
        # From quote items
        if order.quote:
            for qi in order.quote.items.all():
                if qi.fabric:
                    material_requirements.append({
                        'type': 'fabric',
                        'name': qi.fabric.name,
                        'hanger_number': qi.fabric.hanger_number,
                        'required_meters': qi.fabric_meters if hasattr(qi, 'fabric_meters') else None,
                        'supply_mode': qi.supply_mode if hasattr(qi, 'supply_mode') else 'in_stock',
                        'in_stock': qi.fabric.stock_meters >= (qi.fabric_meters or 0) if hasattr(qi, 'fabric_meters') else False,
                    })
        
        # From order items (if no quote or additional items)
        for oi in order.items.all():
            if oi.fabric and not any(m.get('name') == oi.fabric.name for m in material_requirements):
                material_requirements.append({
                    'type': 'fabric',
                    'name': oi.fabric.name,
                    'hanger_number': oi.fabric.hanger_number,
                    'required_meters': oi.quantity,
                    'supply_mode': 'in_stock',
                    'in_stock': oi.fabric.stock_meters >= oi.quantity,
                })
        
        # Missing materials summary
        missing = [m for m in material_requirements if not m.get('in_stock')]
        
        return {
            'material_requirements': material_requirements,
            'material_readiness': order.material_readiness,
            'material_readiness_label': self._get_material_readiness_label(order.material_readiness),
            'missing_materials_count': len(missing),
            'missing_materials': missing,
            'total_fabrics_required': len(material_requirements),
        }
    
    def _get_production_section(self, order: Order) -> Dict[str, Any]:
        """Production/Seamstress section - what to sew"""
        # Production assignment
        assignment = None
        if hasattr(order, 'production_assignment') and order.production_assignment:
            pa = order.production_assignment
            assignment = {
                'assigned_to': pa.assigned_to.get_full_name() if pa.assigned_to else None,
                'status': pa.status,
                'complexity': pa.complexity,
                'deadline': pa.deadline,
                'started_at': pa.started_at,
                'total_payment': pa.total_payment,
            }
        
        # Order items / products to sew
        # Prefetch fabrics to avoid N+1 queries
        items = []
        for oi in order.items.select_related('fabric').all():
            # Get fabric name from related Fabric object
            fabric_name = None
            if oi.fabric:
                fabric_name = getattr(oi.fabric, 'name', None)
                # Fallback to hanger_number if name is missing
                if not fabric_name:
                    fabric_name = getattr(oi.fabric, 'hanger_number', None)
            
            items.append({
                'id': str(oi.id),
                'room': oi.sewing_type,  # Using as room indicator
                'fabric': fabric_name,
                'fabric_name': fabric_name,  # For DTO compatibility
                'quantity': oi.quantity,
                'sewing_type': oi.sewing_type,
                'window_width_cm': oi.window_width_cm,
                'window_height_cm': oi.window_height_cm,
                'folds_count': oi.folds_count,
            })
        
        return {
            'production_assignment': assignment,
            'items_to_sew': items,
            'items_count': len(items),
            'production_stage': order.production_stage,
            'production_stage_label': self._get_production_stage_label(order.production_stage),
            'deadline': assignment.get('deadline') if assignment else None,
        }
    
    def _get_installer_section(self, order: Order) -> Dict[str, Any]:
        """Installer section - installation and handover"""
        # Address info
        address = None
        if order.installation_address_city or order.installation_address_street:
            address = {
                'city': order.installation_address_city,
                'street': order.installation_address_street,
                'building': order.installation_address_building,
                'apartment': order.installation_address_apartment,
                'notes': order.installation_address_notes,
            }
        
        # Order items for installation (full details)
        # Prefetch fabrics to avoid N+1 queries
        order_items = []
        for item in order.items.select_related('fabric').all():
            # Safe field extraction with fallbacks
            # room_name/window_name stored in notes as "Room / Window / ..."
            notes_parts = (item.notes or '').split(' / ') if item.notes else []
            room_name = notes_parts[0] if len(notes_parts) > 0 else '—'
            window_name = notes_parts[1] if len(notes_parts) > 1 else None
            
            # Fabric name from related Fabric object
            fabric_name = None
            if item.fabric:
                fabric_name = getattr(item.fabric, 'name', None)
                # Fallback to hanger_number if name is missing
                if not fabric_name:
                    fabric_name = getattr(item.fabric, 'hanger_number', None)
            
            order_items.append({
                'id': str(item.id),
                'room_name': room_name,
                'window_name': window_name,
                'description': item.sewing_type or item.notes or 'Изделие',
                'fabric': fabric_name,
                'fabric_name': fabric_name,  # For DTO compatibility
                'quantity': float(item.quantity) if item.quantity else 1,
                'width_cm': item.window_width_cm,
                'height_cm': item.window_height_cm,
            })
        
        # Fallback: measurements if no order items
        fallback_items = []
        if not order_items:
            for m in order.measurements.all():
                fallback_items.append({
                    'id': f'fallback-measure-{m.id}',
                    'room_name': m.room_name,
                    'window_name': m.window_name,
                    'description': f"Замер: {m.room_name} - {m.window_name}",
                    'fabric': m.selected_fabric,
                    'quantity': 1,
                    'width_cm': m.width_cm,
                    'height_cm': m.height_cm,
                })
        
        # Calculate payment state
        balance_due = order.total_amount - order.paid_amount
        payment_state = 'paid' if balance_due <= 0 else 'partial' if order.paid_amount > 0 else 'unpaid'
        
        # Photo report status
        # Available if: handover_stage == done OR (not_required AND production done)
        photo_report_count = order.photo_reports.filter(is_active=True).count()

        is_handover_done = order.handover_stage == HandoverStage.DONE
        is_not_required_with_production_done = (
            order.handover_stage == HandoverStage.NOT_REQUIRED
            and order.production_stage == ProductionStage.DONE
        )
        photo_report_available = is_handover_done or is_not_required_with_production_done

        if not photo_report_available:
            photo_report_status = 'not_available'
        elif photo_report_count == 0:
            photo_report_status = 'not_uploaded'
        else:
            photo_report_status = 'uploaded'

        # Build photo reports list
        photo_reports = []
        for pr in order.photo_reports.filter(is_active=True):
            photo_reports.append({
                'id': str(pr.id),
                'file_url': pr.file.url if pr.file else None,
                'caption': pr.caption,
                'uploaded_at': pr.created_at,
                'uploaded_by_name': pr.uploaded_by.get_full_name() if pr.uploaded_by else None,
            })

        # Completion act (АВР) status - same availability as photo reports
        completion_act_available = is_handover_done or is_not_required_with_production_done

        completion_act_status = 'not_available'
        completion_act_data = None

        if completion_act_available:
            try:
                act = order.completion_act
                if act.is_active:
                    completion_act_status = act.status
                    completion_act_data = {
                        'id': str(act.id),
                        'act_number': act.act_number,
                        'status': act.status,
                        'status_label': act.get_status_display(),
                        'signed_file_url': act.signed_file.url if act.signed_file else None,
                        'signed_at': act.signed_at,
                        'signed_file_uploaded_by_name': (
                            act.signed_file_uploaded_by.get_full_name()
                            if act.signed_file_uploaded_by else None
                        ),
                        'notes': act.notes,
                    }
                else:
                    completion_act_status = 'not_created'
            except Exception:
                completion_act_status = 'not_created'

        # Build warnings
        warnings = []
        if not order_items and not fallback_items:
            warnings.append({
                'type': 'no_items',
                'message': 'Сначала сформируйте позиции заказа из КП',
                'severity': 'error',
            })
        if balance_due > 0:
            warnings.append({
                'type': 'balance_due',
                'message': f'Остаток к оплате: {balance_due}',
                'severity': 'warning',
            })
        if order.production_stage != ProductionStage.DONE:
            warnings.append({
                'type': 'production_not_done',
                'message': 'Производство не завершено',
                'severity': 'warning',
            })

        return {
            'address': address,
            'customer': {
                'id': str(order.customer.id),
                'name': order.customer.full_name,
                'phone': order.customer.phone,
            },
            'order_items': order_items if order_items else fallback_items,
            'items_count': len(order_items) if order_items else len(fallback_items),
            'installation_date': order.installation_date,
            'handover_stage': order.handover_stage,
            'handover_stage_label': self._get_handover_stage_label(order.handover_stage),
            'balance_due': balance_due,
            'payment_state': payment_state,
            'warnings': warnings,
            # Photo report summary
            'photo_report_status': photo_report_status,
            'photo_report_count': photo_report_count,
            'photo_reports': photo_reports,
            # Completion act (АВР) summary
            'completion_act_status': completion_act_status,
            'completion_act_available': completion_act_available,
            'completion_act': completion_act_data,
        }
    
    def get_available_actions(
        self,
        order: Order,
        user=None
    ) -> List[Dict[str, Any]]:
        """
        Get available actions considering user role.
        Wrapper around get_available_order_actions with role awareness.
        """
        actions = self.get_available_order_actions(order)
        
        # Filter by role if user provided
        if user and hasattr(user, 'groups'):
            user_groups = [g.name for g in user.groups.all()]
            
            # Role-based filtering
            if 'Seamstress' in user_groups:
                # Seamstress only sees production-related actions
                actions = [a for a in actions if a.get('action') in [
                    'change_production_stage', 'transition_to_ready'
                ]] or []
            
            elif 'Installer' in user_groups:
                # Installer only sees handover actions
                actions = [a for a in actions if a.get('action') in [
                    'change_handover_stage', 'transition_to_waiting_final_payment',
                    'transition_to_completed'
                ]] or []
        
        return actions
    
    # ============================================
    # WORKFLOW SUMMARY (legacy compatibility)
    # ============================================
    
    def get_order_workflow_summary(self, order: Order) -> Dict[str, Any]:
        """
        Get complete workflow summary for an order.
        Legacy method - use get_order_execution_summary for new code.
        
        Returns dict with:
        - status_info: current status labels and guidance
        - payment_info: paid_amount, balance_due, payment_state
        - material_info: material_readiness with warnings
        - production_info: production_stage with warnings
        - handover_info: handover_stage with warnings
        - blockers: list of issues preventing progress
        - warnings: non-critical issues
        """
        summary = {
            'status_info': self._get_status_info(order),
            'payment_info': self._get_payment_info(order),
            'material_info': self._get_material_info(order),
            'production_info': self._get_production_info(order),
            'handover_info': self._get_handover_info(order),
            'blockers': self._get_blockers(order),
            'warnings': self._get_warnings(order),
        }
        return summary
    
    def _get_status_info(self, order: Order) -> Dict[str, Any]:
        """Get current status information with guidance"""
        guidance = OrderExecutionGuide.get_guidance(order.status)
        
        return {
            'status': order.status,
            'status_label': order.get_status_display(),
            'title': guidance['title'],
            'description': guidance['description'],
            'next_steps': guidance['next_steps'],
            'allowed_transitions': OrderFSMRules.get_allowed_transitions(order.status),
        }
    
    def _get_payment_info(self, order: Order) -> Dict[str, Any]:
        """Get payment information with calculated state"""
        balance_due = order.total_amount - order.paid_amount
        
        # Determine payment state
        if order.paid_amount == 0:
            payment_state = 'unpaid'
            payment_state_label = 'Не оплачен'
        elif balance_due <= 0:
            payment_state = 'paid'
            payment_state_label = 'Оплачен полностью'
        elif order.paid_amount >= order.total_amount * Decimal('0.5'):
            payment_state = 'partial'
            payment_state_label = 'Оплачен частично (≥50%)'
        else:
            payment_state = 'prepayment_due'
            payment_state_label = 'Требуется предоплата'
        
        return {
            'paid_amount': order.paid_amount,
            'total_amount': order.total_amount,
            'balance_due': balance_due,
            'payment_state': payment_state,
            'payment_state_label': payment_state_label,
        }
    
    def _get_material_info(self, order: Order) -> Dict[str, Any]:
        """Get material readiness information"""
        return {
            'material_readiness': order.material_readiness,
            'material_readiness_label': self._get_material_readiness_label(order.material_readiness),
            'hint': OrderExecutionGuide.get_guidance(order.status).get('material_readiness_hint', ''),
        }
    
    def _get_production_info(self, order: Order) -> Dict[str, Any]:
        """Get production stage information"""
        return {
            'production_stage': order.production_stage,
            'production_stage_label': self._get_production_stage_label(order.production_stage),
        }
    
    def _get_handover_info(self, order: Order) -> Dict[str, Any]:
        """Get handover stage information"""
        return {
            'handover_stage': order.handover_stage,
            'handover_stage_label': self._get_handover_stage_label(order.handover_stage),
        }
    
    def _get_blockers(self, order: Order) -> List[Dict[str, str]]:
        """Get list of issues blocking progress"""
        blockers = []
        
        # Cannot modify cancelled order
        if order.status == Order.Status.CANCELLED:
            blockers.append({
                'type': 'cancelled',
                'message': 'Заказ отменён. Изменения невозможны.',
                'severity': 'error'
            })
            return blockers
        
        # Cannot modify completed order
        if order.status == Order.Status.COMPLETED:
            blockers.append({
                'type': 'completed',
                'message': 'Заказ завершён. Изменения невозможны.',
                'severity': 'error'
            })
            return blockers
        
        # Production cannot start without materials
        if order.status == Order.Status.IN_WORK:
            if order.material_readiness == MaterialReadiness.NOT_READY:
                blockers.append({
                    'type': 'materials_not_ready',
                    'message': 'Материалы не обеспечены. Нельзя начать производство.',
                    'severity': 'error'
                })
        
        # Cannot complete production if stage not done
        if order.status == Order.Status.IN_PRODUCTION:
            if order.production_stage != ProductionStage.DONE:
                blockers.append({
                    'type': 'production_not_done',
                    'message': 'Производство не завершено. Смените этап на "Производство завершено".',
                    'severity': 'error'
                })
        
        # Cannot complete order if not paid
        if order.status == Order.Status.WAITING_FINAL_PAYMENT:
            if order.paid_amount < order.total_amount:
                blockers.append({
                    'type': 'not_fully_paid',
                    'message': f'Требуется оплата: {order.total_amount - order.paid_amount}',
                    'severity': 'error'
                })
        
        return blockers
    
    def _get_warnings(self, order: Order) -> List[Dict[str, str]]:
        """Get list of non-critical warnings"""
        warnings = []
        
        # Partial materials warning
        if order.material_readiness == MaterialReadiness.PARTIALLY_READY:
            if order.status in [Order.Status.IN_WORK, Order.Status.IN_PRODUCTION]:
                warnings.append({
                    'type': 'partial_materials',
                    'message': 'Материалы обеспечены частично. Возможны задержки.',
                    'severity': 'warning'
                })
        
        # Payment warnings
        balance_due = order.total_amount - order.paid_amount
        if order.status == Order.Status.ON_INSTALLATION and balance_due > 0:
            warnings.append({
                'type': 'installation_not_paid',
                'message': f'Установка выполняется, но есть неоплаченный остаток: {balance_due}',
                'severity': 'warning'
            })
        
        return warnings
    
    # ============================================
    # AVAILABLE ACTIONS
    # ============================================
    
    def get_available_order_actions(self, order: Order) -> List[Dict[str, Any]]:
        """
        Get list of available actions for current order state.
        
        Each action has:
        - action: action code
        - label: human-readable label
        - description: what this action does
        - required: whether it's required to proceed
        - disabled_reason: why action is disabled (if applicable)
        """
        actions = []
        
        # Terminal states - no actions
        if order.status in [Order.Status.COMPLETED, Order.Status.CANCELLED]:
            return actions
        
        # Material readiness actions
        if order.status in [Order.Status.NEW, Order.Status.IN_WORK]:
            actions.append(self._build_material_actions(order))
        
        # Production stage actions (only in production)
        if order.status == Order.Status.IN_PRODUCTION:
            actions.append(self._build_production_actions(order))
        
        # Handover stage actions (only in installation)
        if order.status == Order.Status.ON_INSTALLATION:
            actions.append(self._build_handover_actions(order))
        
        # Status transitions
        actions.extend(self._build_transition_actions(order))
        
        # Cancel action (always available except terminal states)
        actions.append({
            'action': 'cancel',
            'label': 'Отменить заказ',
            'description': 'Отменить заказ с указанием причины',
            'required': False,
            'dangerous': True,
        })
        
        return actions
    
    def _build_material_actions(self, order: Order) -> Dict[str, Any]:
        """Build action for changing material readiness"""
        disabled_reason = None
        if order.status == Order.Status.CANCELLED:
            disabled_reason = 'Заказ отменён'
        
        return {
            'action': 'change_material_readiness',
            'label': 'Изменить готовность материалов',
            'description': 'Обновить статус обеспеченности материалами',
            'required': order.status == Order.Status.IN_WORK and order.material_readiness == MaterialReadiness.NOT_READY,
            'current_value': order.material_readiness,
            'current_label': self._get_material_readiness_label(order.material_readiness),
            'allowed_values': MaterialReadiness.choices,
            'disabled_reason': disabled_reason,
        }
    
    def _build_production_actions(self, order: Order) -> Dict[str, Any]:
        """Build action for changing production stage"""
        return {
            'action': 'change_production_stage',
            'label': 'Изменить этап производства',
            'description': 'Обновить текущий этап производства',
            'required': order.production_stage != ProductionStage.DONE,
            'current_value': order.production_stage,
            'current_label': self._get_production_stage_label(order.production_stage),
            'allowed_values': ProductionStage.choices,
        }
    
    def _build_handover_actions(self, order: Order) -> Dict[str, Any]:
        """Build action for changing handover stage"""
        action = {
            'action': 'change_handover_stage',
            'label': 'Изменить этап установки/выдачи',
            'description': 'Обновить текущий этап установки или выдачи',
            'required': order.handover_stage != HandoverStage.DONE,
            'current_value': order.handover_stage,
            'current_label': self._get_handover_stage_label(order.handover_stage),
            'allowed_values': HandoverStage.choices,
        }
        
        # Check for blockers
        blockers = []
        if order.production_stage != ProductionStage.DONE:
            blockers.append('Производство не завершено')
        if order.items.count() == 0:
            blockers.append('Сначала сформируйте позиции заказа из КП')
        if order.status == Order.Status.CANCELLED:
            blockers.append('Заказ отменён')
        if order.status == Order.Status.COMPLETED:
            blockers.append('Заказ завершён')
        
        if blockers:
            action['disabled_reason'] = '; '.join(blockers)
        
        return action
    
    def _build_transition_actions(self, order: Order) -> List[Dict[str, Any]]:
        """Build actions for allowed status transitions"""
        actions = []
        allowed = OrderFSMRules.get_allowed_transitions(order.status)
        
        transition_labels = {
            'new': 'Вернуть в "Новый"',
            'in_work': 'Взять в работу',
            'in_production': 'Передать в производство',
            'ready': 'Отметить готовность',
            'on_installation': 'Начать установку/выдачу',
            'waiting_final_payment': 'Ожидать финальную оплату',
            'completed': 'Завершить заказ',
            'cancelled': 'Отменить заказ',
        }
        
        for status in allowed:
            if status == 'cancelled':
                continue  # Cancel is handled separately
            
            action = {
                'action': f'transition_to_{status}',
                'label': transition_labels.get(status, f'Перевести в "{status}"'),
                'description': f'Изменить статус заказа на "{transition_labels.get(status, status)}"',
                'required': False,
                'target_status': status,
            }
            
            # Check for blockers
            blockers = self._get_transition_blockers(order, status)
            if blockers:
                action['disabled_reason'] = '; '.join(blockers)
            
            actions.append(action)
        
        return actions
    
    def _has_accepted_quote(self, order: Order) -> bool:
        """Check if order has an accepted/approved quote"""
        from ..models import Quote
        # Check source quote (order created from quote)
        if order.quote and order.quote.status == Quote.Status.APPROVED:
            return True
        # Check related quotes (quotes created for this order - direct order flow)
        if order.related_quotes.filter(status=Quote.Status.APPROVED).exists():
            return True
        return False

    def _get_first_accepted_quote(self, order: Order):
        """Get first accepted quote for order (source or related)"""
        from ..models import Quote
        # Check source quote first
        if order.quote and order.quote.status == Quote.Status.APPROVED:
            return order.quote
        # Check related quotes
        return order.related_quotes.filter(status=Quote.Status.APPROVED).first()

    def _get_transition_blockers(self, order: Order, target_status: str) -> List[str]:
        """Get blockers for a specific transition"""
        blockers = []
        
        # in_work requires accepted quote and order items
        if target_status == Order.Status.IN_WORK:
            if not self._has_accepted_quote(order):
                blockers.append('Сначала примите КП и сформируйте позиции заказа')
            elif order.items.count() == 0:
                blockers.append('Сначала сформируйте позиции заказа из КП')
        
        # in_production requires materials ready and order items
        if target_status == Order.Status.IN_PRODUCTION:
            if order.material_readiness == MaterialReadiness.NOT_READY:
                blockers.append('Материалы не обеспечены')
            if order.items.count() == 0:
                blockers.append('Сначала сформируйте позиции заказа из КП')
        
        # ready requires production done
        if target_status == Order.Status.READY:
            if order.production_stage != ProductionStage.DONE:
                blockers.append('Производство не завершено')
        
        # on_installation requires production done and order items
        if target_status == Order.Status.ON_INSTALLATION:
            if order.production_stage != ProductionStage.DONE:
                blockers.append('Производство не завершено')
            if order.items.count() == 0:
                blockers.append('Сначала сформируйте позиции заказа из КП')
        
        # completed requires: production done, handover done/not_required, signed act, full payment
        if target_status == Order.Status.COMPLETED:
            if order.production_stage != ProductionStage.DONE:
                blockers.append('Производство не завершено')
            if order.handover_stage not in [HandoverStage.DONE, HandoverStage.NOT_REQUIRED]:
                blockers.append('Установка/выдача не завершена')
            # Check for signed completion act
            try:
                act = order.completion_act
                if not act.is_active or act.status != OrderCompletionAct.Status.SIGNED:
                    blockers.append('Требуется подписанный АВР')
            except OrderCompletionAct.DoesNotExist:
                blockers.append('Требуется подписанный АВР')
            if order.paid_amount < order.total_amount:
                blockers.append(f'Требуется полная оплата. Остаток: {order.total_amount - order.paid_amount}')

        return blockers
    
    # ============================================
    # STAGE CHANGE OPERATIONS
    # ============================================
    
    def change_material_readiness(
        self,
        order: Order,
        material_readiness: str,
        changed_by: Optional[UUID] = None,
        notes: str = ""
    ) -> Tuple[Order, List[str]]:
        """
        Change material readiness state.
        
        Returns:
            Tuple of (updated_order, warnings)
        
        Raises:
            OrderValidationError: If change not allowed
        """
        # Validate state is valid
        valid_states = [s[0] for s in MaterialReadiness.choices]
        if material_readiness not in valid_states:
            raise OrderValidationError(f"Invalid material readiness: {material_readiness}")
        
        # Cannot modify cancelled/completed orders
        if order.status in [Order.Status.CANCELLED, Order.Status.COMPLETED]:
            raise OrderValidationError(f"Cannot modify {order.status} order")

        warnings = []
        
        # Warning for partial readiness
        if material_readiness == MaterialReadiness.PARTIALLY_READY:
            warnings.append("Материалы обеспечены частично. Возможны задержки в производстве.")
        
        # Update order
        old_value = order.material_readiness
        from django.utils import timezone
        order.material_readiness = material_readiness
        update_fields = ['material_readiness', 'updated_at']
        if material_readiness == 'ready' and not order.materials_ready_at:
            order.materials_ready_at = timezone.now()
            update_fields.append('materials_ready_at')
        order.save(update_fields=update_fields)
        
        # Create history entry via OrderService if available
        if self.order_service:
            from ..models import OrderStatusHistory
            OrderStatusHistory.objects.create(
                order=order,
                old_status=order.status,
                new_status=order.status,
                changed_by_id=changed_by,
                notes=f"Material readiness changed: {old_value} -> {material_readiness}. {notes}".strip()
            )

        # Материалы обеспечены — пошив может начинаться.
        if material_readiness == MaterialReadiness.READY and order.status == Order.Status.IN_WORK:
            from .status_automation import auto_advance
            auto_advance(order, Order.Status.IN_PRODUCTION, "материалы готовы", changed_by)

        return order, warnings
    
    def change_production_stage(
        self,
        order: Order,
        production_stage: str,
        changed_by: Optional[UUID] = None,
        notes: str = ""
    ) -> Order:
        """
        Change production stage.
        
        Raises:
            OrderValidationError: If change not allowed
        """
        # Validate state is valid
        valid_stages = [s[0] for s in ProductionStage.choices]
        if production_stage not in valid_stages:
            raise OrderValidationError(f"Invalid production stage: {production_stage}")
        
        # Can only change in IN_PRODUCTION status
        if order.status != Order.Status.IN_PRODUCTION:
            raise OrderValidationError(
                f"Cannot change production stage in status {order.status}. "
                "Must be in 'in_production' status."
            )
        
        # Update order
        old_value = order.production_stage
        from django.utils import timezone
        order.production_stage = production_stage
        update_fields = ['production_stage', 'updated_at']
        now = timezone.now()
        if production_stage != 'not_started' and not order.production_started_at:
            order.production_started_at = now
            update_fields.append('production_started_at')
        if production_stage == 'done' and not order.production_done_at:
            order.production_done_at = now
            update_fields.append('production_done_at')
        order.save(update_fields=update_fields)
        
        # Create history entry
        if self.order_service:
            from ..models import OrderStatusHistory
            OrderStatusHistory.objects.create(
                order=order,
                old_status=order.status,
                new_status=order.status,
                changed_by_id=changed_by,
                notes=f"Production stage changed: {old_value} -> {production_stage}. {notes}".strip()
            )

        # Пошив завершён — заказ готов.
        if production_stage == ProductionStage.DONE:
            from .status_automation import auto_advance
            auto_advance(order, Order.Status.READY, "производство завершено", changed_by)

        return order
    
    def change_handover_stage(
        self,
        order: Order,
        handover_stage: str,
        changed_by: Optional[UUID] = None,
        notes: str = ""
    ) -> Tuple[Order, bool]:
        """
        Change handover stage.
        
        Returns:
            Tuple of (updated_order, can_auto_complete)
            can_auto_complete is True if handover done AND fully paid
        
        Raises:
            OrderValidationError: If change not allowed
        """
        # Validate state is valid
        valid_stages = [s[0] for s in HandoverStage.choices]
        if handover_stage not in valid_stages:
            raise OrderValidationError(f"Invalid handover stage: {handover_stage}")
        
        # Cannot modify cancelled or completed orders
        if order.status == Order.Status.CANCELLED:
            raise OrderValidationError("Нельзя изменить этап установки для отменённого заказа.")
        if order.status == Order.Status.COMPLETED:
            raise OrderValidationError("Нельзя изменить этап установки для завершённого заказа.")
        
        # Cannot set handover done or not_required before production is done
        if handover_stage in [HandoverStage.DONE, HandoverStage.NOT_REQUIRED]:
            if order.production_stage != ProductionStage.DONE:
                raise OrderValidationError(
                    "Нельзя изменить этап установки: производство не завершено. "
                    "Сначала отметьте производство как готовое."
                )
        
        # Can only change handover in specific statuses
        allowed_statuses_for_handover = [
            Order.Status.READY,
            Order.Status.ON_INSTALLATION,
            Order.Status.WAITING_FINAL_PAYMENT,
        ]
        if order.status not in allowed_statuses_for_handover:
            raise OrderValidationError(
                f"Нельзя изменить этап установки в статусе '{order.get_status_display()}'. "
                "Заказ должен быть готов к установке."
            )
        
        # Update order
        from django.utils import timezone
        old_value = order.handover_stage
        old_status = order.status
        order.handover_stage = handover_stage
        if handover_stage == 'done' and not order.handover_done_at:
            order.handover_done_at = timezone.now()
        
        # Auto-transition status after handover done
        status_changed = False
        if handover_stage == HandoverStage.DONE:
            balance_due = order.total_amount - order.paid_amount
            if balance_due > 0:
                # Still has balance due - move to waiting_final_payment
                if order.status != Order.Status.WAITING_FINAL_PAYMENT:
                    order.status = Order.Status.WAITING_FINAL_PAYMENT
                    status_changed = True
            # If balance_due <= 0, stay in current status (ready/on_installation)
            # User can manually complete the order
        
        order.save(update_fields=['handover_stage', 'status', 'updated_at'])
        
        # Create history entry
        if self.order_service:
            from ..models import OrderStatusHistory
            status_note = ""
            if status_changed:
                status_note = f" Status changed: {old_status} -> {order.status}."
            OrderStatusHistory.objects.create(
                order=order,
                old_status=old_status,
                new_status=order.status,
                changed_by_id=changed_by,
                notes=f"Handover stage changed: {old_value} -> {handover_stage}.{status_note} {notes}".strip()
            )
        
        # Check if can auto-complete (handover done AND fully paid)
        can_auto_complete = (
            handover_stage == HandoverStage.DONE and
            order.paid_amount >= order.total_amount
        )

        # Раньше флаг только возвращался наружу, и его никто не применял —
        # заказ так и оставался незакрытым. Пробуем завершить сами; если не
        # хватает АВР или фотоотчёта, transition_status_mvp не пропустит и
        # заказ просто останется в текущем статусе.
        if can_auto_complete:
            from .status_automation import auto_advance
            auto_advance(order, Order.Status.COMPLETED, "установка завершена и оплачена", changed_by)

        return order, can_auto_complete
    
    def cancel_order(
        self,
        order: Order,
        reason: str,
        user=None
    ) -> Order:
        """
        Cancel order with business rule validation.
        
        Business rules:
        - Cannot cancel completed orders
        - Cannot cancel already cancelled orders
        - Reason is required
        - Sets cancel_reason, cancelled_at, cancelled_by, status=cancelled
        
        Args:
            order: Order to cancel
            reason: Cancellation reason (required)
            user: User performing cancellation (optional)
            
        Returns:
            Updated cancelled order
            
        Raises:
            OrderValidationError: If cancellation not allowed
        """
        # Validate reason
        if not reason or not reason.strip():
            raise OrderValidationError("Причина отмены обязательна.")
        
        # Check if already cancelled
        if order.status == Order.Status.CANCELLED:
            raise OrderValidationError("Заказ уже отменён.")
        
        # Check if completed
        if order.status == Order.Status.COMPLETED:
            raise OrderValidationError("Нельзя отменить завершённый заказ.")
        
        # Perform cancellation
        order.cancel_reason = reason.strip()
        order.cancelled_at = timezone.now()
        order.cancelled_by = user
        old_status = order.status
        order.status = Order.Status.CANCELLED
        order.save(update_fields=[
            'cancel_reason', 'cancelled_at', 'cancelled_by',
            'status', 'updated_at'
        ])
        
        # Create history entry if order_service available
        if self.order_service:
            from ..models import OrderStatusHistory
            OrderStatusHistory.objects.create(
                order=order,
                old_status=old_status,
                new_status=Order.Status.CANCELLED,
                changed_by=user,
                notes=f"Order cancelled. Reason: {reason}"
            )
        
        return order
    
    # ============================================
    # HELPER METHODS
    # ============================================
    
    def _get_material_readiness_label(self, value: str) -> str:
        """Get human-readable label for material readiness"""
        labels = {
            MaterialReadiness.NOT_READY: 'Не обеспечен',
            MaterialReadiness.PARTIALLY_READY: 'Частично обеспечен',
            MaterialReadiness.READY: 'Обеспечен материалами',
        }
        return labels.get(value, value)
    
    def _get_production_stage_label(self, value: str) -> str:
        """Get human-readable label for production stage"""
        labels = {
            ProductionStage.NOT_STARTED: 'Не начато',
            ProductionStage.SEWING: 'Раскрой',
            ProductionStage.SEWING: 'Пошив',
            ProductionStage.DONE: 'Контроль качества',
            ProductionStage.DONE: 'Производство завершено',
        }
        return labels.get(value, value)
    
    def _get_handover_stage_label(self, value: str) -> str:
        """Get human-readable label for handover stage"""
        labels = {
            HandoverStage.NOT_REQUIRED: 'Не требуется',
            HandoverStage.PENDING: 'Ожидает установки / выдачи',
            HandoverStage.SCHEDULED: 'Запланировано',
            HandoverStage.IN_PROGRESS: 'В процессе',
            HandoverStage.DONE: 'Передано / установлено',
        }
        return labels.get(value, value)
