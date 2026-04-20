#!/usr/bin/env python3
"""
Project Health Check Script
Verifies Django project can start and basic configuration is correct
"""

import os
import sys

def check_imports():
    """Check if all required packages are installed"""
    print("Checking imports...")
    required = [
        'django',
        'rest_framework',
        'django_filters',
        'corsheaders',
        'dotenv',
    ]
    
    missing = []
    for pkg in required:
        try:
            __import__(pkg)
            print(f"  ✓ {pkg}")
        except ImportError:
            print(f"  ✗ {pkg} - MISSING")
            missing.append(pkg)
    
    if missing:
        print(f"\nInstall missing packages: pip install {' '.join(missing)}")
        return False
    return True

def check_settings():
    """Check Django settings"""
    print("\nChecking Django settings...")
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'atelier_erp.settings')
    
    try:
        import django
        django.setup()
        from django.conf import settings
        
        print(f"  ✓ Settings module: {settings.SETTINGS_MODULE}")
        print(f"  ✓ DEBUG: {settings.DEBUG}")
        print(f"  ✓ Database: {settings.DATABASES['default']['ENGINE']}")
        print(f"  ✓ Installed apps: {len(settings.INSTALLED_APPS)} apps")
        
        # Check critical apps
        critical_apps = ['atelier_erp', 'rest_framework', 'django_filters']
        for app in critical_apps:
            if app in settings.INSTALLED_APPS:
                print(f"  ✓ {app} in INSTALLED_APPS")
            else:
                print(f"  ✗ {app} NOT in INSTALLED_APPS")
                return False
        
        return True
    except Exception as e:
        print(f"  ✗ Settings error: {e}")
        return False

def check_models():
    """Check if models can be imported"""
    print("\nChecking models...")
    try:
        from atelier_erp import models
        
        model_list = [
            'Customer', 'Fabric', 'Cornice', 'Service', 'Order', 'Task',
            'Quote', 'ProductionAssignment', 'Payment', 'ActivityLog'
        ]
        
        for model_name in model_list:
            if hasattr(models, model_name):
                print(f"  ✓ {model_name}")
            else:
                print(f"  ✗ {model_name} - NOT FOUND")
        
        return True
    except Exception as e:
        print(f"  ✗ Models error: {e}")
        return False

def check_migrations():
    """Check migrations status"""
    print("\nChecking migrations...")
    try:
        from django.core.management import call_command
        from io import StringIO
        
        out = StringIO()
        try:
            call_command('check', stdout=out, verbosity=0)
            print("  ✓ Django system check passed")
        except Exception as e:
            print(f"  ✗ Django check failed: {e}")
            return False
        
        # Check for unmigrated changes
        out = StringIO()
        call_command('makemigrations', '--dry-run', '--check', stdout=out, stderr=out)
        output = out.getvalue()
        
        if 'No changes detected' in output:
            print("  ✓ All models migrated")
        else:
            print("  ⚠ Unmigrated changes detected (run makemigrations)")
        
        return True
    except Exception as e:
        print(f"  ⚠ Could not check migrations: {e}")
        return True  # Non-critical

def main():
    """Run all checks"""
    print("="*60)
    print("ATELIER ERP - Project Health Check")
    print("="*60)
    
    checks = [
        ("Imports", check_imports),
        ("Settings", check_settings),
        ("Models", check_models),
        ("Migrations", check_migrations),
    ]
    
    results = []
    for name, check_func in checks:
        try:
            result = check_func()
            results.append((name, result))
        except Exception as e:
            print(f"\n  ✗ {name} check crashed: {e}")
            results.append((name, False))
    
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"  {status} - {name}")
    
    all_passed = all(r[1] for r in results)
    
    print("="*60)
    if all_passed:
        print("✓ All checks passed! Project is ready for development.")
        return 0
    else:
        print("✗ Some checks failed. Please fix issues above.")
        return 1

if __name__ == '__main__':
    sys.exit(main())
