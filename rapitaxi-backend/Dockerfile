FROM php:8.2-fpm

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpng-dev libonig-dev libpq-dev nginx gettext-base unzip \
    && docker-php-ext-install pdo_pgsql mbstring bcmath gd \
    && rm -rf /var/lib/apt/lists/*

# El limite mayor de la API es 10 MB para libros contables.
RUN printf 'upload_max_filesize=11M\npost_max_size=12M\nexpose_php=Off\n' \
    > /usr/local/etc/php/conf.d/uploads.ini

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www
COPY . /var/www
RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && composer install --no-interaction --no-dev --prefer-dist --optimize-autoloader \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R u+rwX storage bootstrap/cache \
    && chmod +x docker/start.sh

COPY docker/nginx.conf.template /etc/nginx/conf.d/rapitaxi.conf.template
RUN rm -f /etc/nginx/sites-enabled/default

EXPOSE 10000
CMD ["/bin/sh", "docker/start.sh"]
