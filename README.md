# Plan Sectorial ETECSA

Sistema de gestión de estudiantes del Plan Sectorial (código 506) para universidades cubanas, con integración completa a la API de ETECSA.

## Características

- ✅ Registro y gestión de estudiantes universitarios
- ✅ Integración con API de ETECSA (ALTA, BAJA, Análisis)
- ✅ Sincronización automática con el sistema de ETECSA
- ✅ Importación/Exportación de datos desde Excel
- ✅ Autenticación con 3 roles: Admin, Universidad, ETECSA
- ✅ 23 universidades cubanas soportadas

## Requisitos

- Bun (última versión)
- Node.js 20+
- SQLite (a través de libSQL)

## Instalación

```bash
# Instalar Bun
curl -fsSL https://bun.sh/install | bash

# Clonar el proyecto
git clone https://github.com/denysbuedo/plan-sectorial.git
cd plan-sectorial

# Instalar dependencias
bun install

# Copiar archivo de variables de entorno
cp .env.example .env

# Configurar variables de entorno en .env:
# ETECSA_API_URL=http://192.168.1.100
# ETECSA_USERNAME=api.mes
# ETECSA_PASSWORD=tu_password
```

## Base de datos

```bash
# Generar cliente de base de datos
bun run db:generate

# Ejecutar migraciones
bun run db:migrate

# Poblar universidades (requiere servidor corriendo)
bun dev  # iniciar en otra terminal
curl -X POST http://localhost:3000/api/seed

# Crear admin inicial (requiere servidor corriendo)
curl -X POST http://localhost:3000/api/seed-admin
```

## Desarrollo

```bash
bun dev
```

La aplicación estará disponible en [http://localhost:3000](http://localhost:3000)

## Construcción para producción

```bash
bun run build
bun start
```

## Despliegue en Producción (Ubuntu 22.04 con HAProxy)

### Arquitectura

```
Internet → HAProxy (443/https) → Next.js (localhost:3000)
```

El HAProxy escuchará en el puerto 443 (HTTPS) y redirigirá al puerto 3000 donde corre Next.js.

### Preparar el servidor

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y
```

## Instalar dependencias del sistema

```bash
sudo apt install -y curl git unzip xz-utils zip
```

## Instalar Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

**Importante para producción**: Instalar Bun también para el usuario www-data:

```bash
# Instalar bun para el usuario www-data
sudo su - www-data -s /bin/bash -c "curl -fsSL https://bun.sh/install | bash"

# Verificar
sudo -u www-data /home/www-data/.bun/bin/bun --version
```

## Configurar el proyecto

```bash
# Clonar proyecto
cd /var/www
sudo git clone https://github.com/denysbuedo/plan-sectorial.git
cd plan-sectorial

# Instalar dependencias
sudo -u www-data bun install

# Copiar y configurar .env
sudo cp .env.example .env
sudo nano .env
```

## Migraciones y Build

```bash
# Generar cliente y migraciones
sudo -u www-data bun run db:generate
sudo -u www-data bun run db:migrate

# Build de producción
sudo -u www-data bun run build
```

## Iniciar servidor y poblar base de datos

Primero iniciar el servidor:

```bash
sudo systemctl start plan-sectorial
```

Esperar unos segundos a que inicie, luego poblar universidades y crear admin:

```bash
# Poblar universidades
curl -X POST http://localhost:3000/api/seed

# Crear usuario admin inicial
curl -X POST http://localhost:3000/api/seed-admin
```

## Servicio Systemd

Crear `/etc/systemd/system/plan-sectorial.service`:

```ini
[Unit]
Description=Plan Sectorial ETECSA (Next.js)
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/plan-sectorial
ExecStart=/home/www-data/.bun/bin/bun start
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

**Importante**: Verifica que bun esté instalado para el usuario www-data:

```bash
# Verificar instalación de bun
sudo -u www-data /home/www-data/.bun/bin/bun --version

# Si no está instalado, instalar para www-data
sudo su - www-data -s /bin/bash -c "curl -fsSL https://bun.sh/install | bash"
```

**Si ya tienes un servicio plan-sectorial para Python**, debes detenerlo y crear uno nuevo para Next.js:

```bash
# Detener servicio Python antiguo
sudo systemctl stop plan-sectorial
sudo systemctl disable plan-sectorial

# Eliminar si es necesario
sudo rm /etc/systemd/system/plan-sectorial.service

# Crear el nuevo servicio para Next.js (como se muestra arriba)
sudo nano /etc/systemd/system/plan-sectorial.service

# Recargar yiciar
sudo systemctl daemon-reload
sudo systemctl enable plan-sectorial
sudo systemctl start plan-sectorial
```

Verificar que Next.js esté corriendo:

```bash
sudo systemctl status plan-sectorial
curl http://localhost:3000
```

## Configurar HAProxy

Instalar HAProxy:

```bash
sudo apt install -y haproxy
```

Editar `/etc/haproxy/haproxy.cfg`:

```cfg
global
    log /dev/log    local0
    log /dev/log    local1 notice
    chroot /var/lib/haproxy
    stats socket /run/haproxy/admin.sock mode 660 level admin
    stats timeout 30s
    user haproxy
    group haproxy
    daemon

defaults
    log     global
    mode    http
    option  httplog
    option  dontlognull
    option  http-server-close
    option  forwardfor except 127.0.0.0/8
    option  redispatch
    retries 3
    timeout connect 5000
    timeout client  50000
    timeout server  50000
    errorfile 400 /etc/haproxy/errors/400.http
    errorfile 403 /etc/haproxy/errors/403.http
    errorfile 408 /etc/haproxy/errors/408.http
    errorfile 500 /etc/haproxy/errors/500.http
    errorfile 502 /etc/haproxy/errors/502.http
    errorfile 503 /etc/haproxy/errors/503.http
    errorfile 504 /etc/haproxy/errors/504.http

frontend http-frontend
    bind *:80
    redirect scheme https code 301

frontend https-frontend
    bind *:443 ssl crt /etc/ssl/certs/plansectorial.pem
    http-check expect status 200
    default_backend nextjs-backend

backend nextjs-backend
    option httpchk GET /
    server nextjs 127.0.0.1:3000 check inter 2000 rise 2 fall 3
```

## SSL con Let's Encrypt

```bash
# Instalar Certbot
sudo apt install -y certbot

# Obtener certificado (detener HAProxy primero)
sudo systemctl stop haproxy
sudo certbot certonly --standalone -d plansectorial.mes.gob.cu

# Combinar certificado y clave
sudo cat /etc/letsencrypt/live/plansectorial.mes.gob.cu/fullchain.pem \
    /etc/letsencrypt/live/plansectorial.mes.gob.cu/privkey.pem | \
    sudo tee /etc/ssl/certs/plansectorial.pem > /dev/null

# Iniciar HAProxy
sudo systemctl start haproxy

# Renovar automáticamente (crontab)
sudo crontab -e
# Añadir: 0 3 * * * certbot renew --quiet --deploy-hook "cat /etc/letsencrypt/live/plansectorial.mes.gob.cu/fullchain.pem /etc/letsencrypt/live/plansectorial.mes.gob.cu/privkey.pem | tee /etc/ssl/certs/plansectorial.pem > /dev/null && systemctl reload haproxy"
```

## Puerto para HAProxy

**El puerto donde debe apuntar HAProxy es el 3000** (puerto por defecto de Next.js).

## Mantenimiento

```bash
# Ver logs
sudo journalctl -u plan-sectorial -f

# Reiniciar servicio
sudo systemctl restart plan-sectorial

# Verificar estado
sudo systemctl status plan-sectorial

# Actualizar aplicación
cd /var/www/plan-sectorial
sudo git pull
sudo systemctl restart plan-sectorial
```

## Entidades/Universidades Soportadas

| Código | Universidad |
|--------|-------------|
| 50601 | Universidad de Ciencias Informáticas (UCI) |
| 50602 | Universidad de La Habana (UH) |
| 50603 | Instituto Politécnico José Antonio Echeverría (CUJAE) |
| 50604 | Universidad Tecnológica de La Habana (CUJAE) |
| 50605 | Universidad de Oriente (UO) |
| 50606 | Universidad Central de Las Villas (UCLV) |
| 50607 | Universidad de Camagüey (UC) |
| 50608 | Universidad de Ciego de Ávila (UNICA) |
| 50609 | Universidad de Cienfuegos (UCF) |
| 50610 | Universidad de Granma (UG) |
| 50611 | Universidad de Holguín (UOH) |
| 50612 | Universidad de Matanzas (UM) |
| 50613 | Universidad de Pinar del Río (UPR) |
| 50614 | Universidad de Sancti Spíritus (UNISS) |
| 50615 | Universidad de Villa Clara (UEC) |
| 50616 | Universidad del Arte (ISA) |
| 50617 | Universidad del Turismo (UT) |
| 50618 | Universidad de La蕾 spit> |
| 50619 | Centro Universitario de Guantánamo |
| 50620 | Universidad de Bayamo |
| 50621 | Universidad de Las Tunas |
| 50622 | Universidad de Mayabeque |
| 50623 | Universidad del Sur |

## Licencia

MIT
