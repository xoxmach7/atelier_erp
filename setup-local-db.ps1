# ============================================
# НАСТРОЙКА ЛОКАЛЬНОЙ БД POSTGRESQL
# ============================================

Write-Host "🐘 Настройка локальной PostgreSQL для Ателье Бригада" -ForegroundColor Cyan

# Параметры
$DB_NAME = "atelier"
$DB_USER = "postgres"
$DB_PASSWORD = "postgres"
$DB_HOST = "localhost"
$DB_PORT = "5432"

# Проверяем psql
$psqlPath = (Get-Command psql -ErrorAction SilentlyContinue)?.Source
if (-not $psqlPath) {
    # Ищем в Program Files
    $possiblePaths = @(
        "C:\Program Files\PostgreSQL\16\bin\psql.exe",
        "C:\Program Files\PostgreSQL\15\bin\psql.exe",
        "C:\Program Files\PostgreSQL\14\bin\psql.exe",
        "C:\Program Files\PostgreSQL\13\bin\psql.exe"
    )
    foreach ($path in $possiblePaths) {
        if (Test-Path $path) {
            $psqlPath = $path
            break
        }
    }
}

if (-not $psqlPath) {
    Write-Host "❌ PostgreSQL не найден!" -ForegroundColor Red
    Write-Host "Установите PostgreSQL:" -ForegroundColor Yellow
    Write-Host "   winget install PostgreSQL.PostgreSQL.16" -ForegroundColor White
    exit 1
}

Write-Host "✅ PostgreSQL найден: $psqlPath" -ForegroundColor Green

# Создаём базу данных
Write-Host "`n📦 Создание базы данных '$DB_NAME'..." -ForegroundColor Cyan
$env:PGPASSWORD = $DB_PASSWORD
& $psqlPath -U $DB_USER -h $DB_HOST -p $DB_PORT -c "CREATE DATABASE $DB_NAME;" 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ База данных создана" -ForegroundColor Green
} else {
    Write-Host "⚠️ База данных уже существует или ошибка создания" -ForegroundColor Yellow
}

# Создаём .env файл
Write-Host "`n📝 Создание .env файла..." -ForegroundColor Cyan
$envContent = @"
# ============================================
# ЛОКАЛЬНАЯ КОНФИГУРАЦИЯ PostgreSQL
# ============================================

DB_HOST=localhost
DB_PORT=5432
DB_NAME=atelier
DB_USER=postgres
DB_PASSWORD=postgres

# JWT Secret (сгенерирован автоматически)
JWT_SECRET=$((New-Guid).ToString().Replace('-','') + (New-Guid).ToString().Replace('-',''))

# Server
PORT=5001
NODE_ENV=development

# CORS
CLIENT_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000

# Email (опционально)
# RESEND_API_KEY=re_xxxxxxxx

# Kaspi Pay (опционально)
# KASPI_MERCHANT_ID=xxx
# KASPI_API_KEY=xxx

# Sentry (опционально)
# SENTRY_DSN=https://xxx@sentry.io/xxx
"@

$envContent | Out-File -FilePath ".env" -Encoding UTF8 -Force
Write-Host "✅ Файл .env создан" -ForegroundColor Green

# Инициализируем таблицы
Write-Host "`n🏗️ Инициализация таблиц..." -ForegroundColor Cyan
& $psqlPath -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -f "db/init.sql" 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Таблицы созданы" -ForegroundColor Green
} else {
    Write-Host "⚠️ Ошибка инициализации таблиц (возможно они уже существуют)" -ForegroundColor Yellow
}

Write-Host "`n✅ ГОТОВО!" -ForegroundColor Green
Write-Host "`nЗапустите сервер:" -ForegroundColor Cyan
Write-Host "   npm start" -ForegroundColor White
Write-Host "`nТестовый логин:" -ForegroundColor Cyan
Write-Host "   Email: admin@test.com" -ForegroundColor White
Write-Host "   Пароль: test123" -ForegroundColor White

Remove-Item env:PGPASSWORD
