#!/bin/sh
set -eu

PORT="${PORT:-10000}"
export PORT

# Render Free no ofrece pre-deploy. Mantener esto activo hasta configurar una
# migracion previa independiente; el seeder es idempotente.
if [ "${RUN_DATABASE_SETUP_ON_START:-true}" = "true" ]; then
    php artisan migrate --force
    php artisan db:seed --force
fi

# Las variables secretas de Render solo existen al arrancar el contenedor.
php artisan config:cache
php artisan route:cache
php artisan view:cache
chown -R www-data:www-data storage bootstrap/cache
chmod -R u+rwX storage bootstrap/cache

envsubst '${PORT}' < /etc/nginx/conf.d/rapitaxi.conf.template > /etc/nginx/conf.d/rapitaxi.conf
php-fpm -D
exec nginx -g 'daemon off;'
