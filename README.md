# Plan Sectorial ETECSA - Guía de Instalación

## Requisitos Previos

1. **VSCode** - Editor de código instalado
2. **Bun** - Gestor de paquetes y runtime de JavaScript
3. **Git** - Control de versiones (opcional pero recomendado)

---

## Paso 1: Instalar Bun en Windows

Bun es más rápido que npm/yarn y es el package manager del proyecto.

### Opción A: Usando PowerShell (Recomendado)
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

### Opción B: Usando Winget
```powershell
winget install oven-sh.bun
```

### Opción C: Usando npm
```powershell
npm install -g bun
```

**Verificar instalación:**
```powershell
bun --version
```

---

## Paso 2: Clonar el Proyecto

Si tienes el proyecto en un repositorio Git:
```powershell
git clone <url-del-repositorio>
cd <nombre-del-proyecto>
```

Si estás trabajando directamente con los archivos, simplemente abre la carpeta en VSCode.

---

## Paso 3: Instalar Dependencias

En la terminal de VSCode (Terminal → New Terminal), ejecuta:

```powershell
bun install
```

Esto instalará todas las dependencias del proyecto.

---

## Paso 4: Configurar Variables de Entorno

1. Crea un archivo `.env.local` en la raíz del proyecto
2. Copia el contenido de `.env.example` (si existe) o usa este ejemplo:

```env
# URL de la API de ETECSA (configura según tu entorno)
ETECSA_API_URL=http://192.168.1.100
ETECSA_USERNAME=api.mes
ETECSA_PASSWORD=tu_password_aqui

# Secret para JWT (genera una cadena aleatoria larga)
JWT_SECRET=tu_jwt_secret_muy_largo_y_seguro_aqui
```

---

## Paso 5: Ejecutar las Migraciones de Base de Datos

El proyecto usa Drizzle ORM con SQLite. Para crear las tablas:

```powershell
bun run db:migrate
```

---

## Paso 6: Inicializar Datos Iniciales (Opcional)

### Semillar Universidades
```powershell
curl -X POST http://localhost:3000/api/seed
```

### Crear Usuario Administrador Inicial
```powershell
curl -X POST http://localhost:3000/api/seed-admin
```

Esto creará un usuario admin:
- **Usuario:** `admin`
- **Contraseña:** `admin123`

---

## Paso 7: Iniciar el Servidor de Desarrollo

```powershell
bun run dev
```

El servidor arrancará en: **http://localhost:3000**

---

## Paso 8: Acceder a la Aplicación

1. Abre tu navegador en http://localhost:3000
2. Inicia sesión con las credenciales de admin:
   - Usuario: `admin`
   - Contraseña: `admin123`

---

## Estructura del Proyecto

```
├── src/
│   ├── app/                    # Páginas y rutas de Next.js
│   │   ├── page.tsx            # Página principal
│   │   ├── login/              # Página de login
│   │   ├── admin/users/        # Gestión de usuarios
│   │   └── api/                # Endpoints de API
│   ├── components/             # Componentes React
│   ├── db/                     # Base de datos y esquemas
│   └── lib/                    # Utilidades (ETECSA, auth)
├── .env.local                  # Variables de entorno
├── drizzle.config.ts           # Configuración de Drizzle
└── package.json                # Dependencias
```

---

## Comandos Útiles

| Comando | Descripción |
|---------|-------------|
| `bun run dev` | Iniciar servidor de desarrollo |
| `bun run build` | Construir para producción |
| `bun run start` | Iniciar servidor de producción |
| `bun run lint` | Verificar código con ESLint |
| `bun run typecheck` | Verificar tipos TypeScript |
| `bun run db:migrate` | Ejecutar migraciones |

---

## Solución de Problemas

### "bun no se reconoce como comando"
Cierra y reopen VSCode después de instalar Bun, o reinicia tu terminal.

### Error de conexión a la base de datos
Asegúrate de que el archivo `.env.local` esté configurado correctamente.

### Error con ETECSA API
Verifica que las variables `ETECSA_API_URL`, `ETECSA_USERNAME` y `ETECSA_PASSWORD` estén correctas en `.env.local`.

---

## Despliegue en Producción (Ubuntu 22.04 con HAProxy)

Esta sección describe cómo desplegar la aplicación en un servidor Ubuntu 22.04 con HAProxy como balanceador de carga y proxy reverso con SSL/TLS.

### Arquitectura de Despliegue

```
┌─────────────────────────────────────────────────────────────┐
│                        Internet                              │
│                  plansectorial.mes.gob.cu                    │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTPS (443)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    HAProxy (Puerto 443)                     │
│               + Certificado SSL/TLS                         │
│                         │                                    │
│                         ▼                                    │
│              ┌──────────────────────┐                       │
│              │   Next.js App        │                       │
│              │   (Puerto 3000)      │                       │
│              └──────────────────────┘                       │
└─────────────────────────────────────────────────────────────┘
```

### Puerto para HAProxy

**El HAProxy debe apuntar al puerto `3000`** donde correrá la aplicación Next.js.

### Paso 1: Preparar el Servidor

```bash
# Actualizar paquetes
sudo apt update && sudo apt upgrade -y

# Instalar dependencias
sudo apt install -y curl git unzip xz-utils zip liblibsqliteclient0

# Instalar Bun
curl -fsSL https://bun.sh/install | bash

# Añadir Bun al PATH
source ~/.bashrc
```

### Paso 2: Clonar el Proyecto

```bash
cd /var/www
sudo git clone https://github.com/denysbuedo/plan-sectorial.git
cd plan-sectorial
sudo chown -R $USER:$USER /var/www/plan-sectorial
```

### Paso 3: Instalar Dependencias

```bash
bun install
```

### Paso 4: Configurar Variables de Entorno

```bash
# Copiar el archivo de ejemplo
cp .env.example .env.local

# Editar las variables
nano .env.local
```

Contenido recomendado para producción:

```env
# URL de la API de ETECSA
ETECSA_API_URL=http://192.168.1.100
ETECSA_USERNAME=api.mes
ETECSA_PASSWORD=tu_password_seguro

# Secret para JWT (genera uno seguro)
JWT_SECRET=genera_un_secret_largo_con_openssl_rand_hex_32
```

### Paso 5: Ejecutar Migraciones

```bash
bun run db:migrate
```

### Paso 6: Construir la Aplicación

```bash
bun run build
```

### Paso 7: Crear el Servicio Systemd

```bash
sudo nano /etc/systemd/system/plan-sectorial.service
```

Contenido del servicio:

```ini
[Unit]
Description=Plan Sectorial ETECSA - Next.js App
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/plan-sectorial
ExecStart=/root/.bun/bin/bun run start
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Activar el servicio:

```bash
sudo systemctl daemon-reload
sudo systemctl enable plan-sectorial
sudo systemctl start plan-sectorial
```

### Paso 8: Configurar HAProxy

```bash
sudo nano /etc/haproxy/haproxy.cfg
```

Agregar la configuración:

```haproxy
frontend https_in
    bind *:443 ssl crt /etc/ssl/certs/plan-sectorial.pem
    mode http
    default_backend plan-sectorial-backend

backend plan-sectorial-backend
    mode http
    server nextjs 127.0.0.1:3000 check
```

### Paso 9: Configurar SSL con Let's Encrypt (Opcional)

Si necesitas un certificado SSL:

```bash
# Instalar Certbot
sudo apt install -y certbot python3-certbot-haproxy

# Obtener certificado
sudo certbot certonly --standalone -d plansectorial.mes.gob.cu

# Convertir certificado para HAProxy
sudo cat /etc/letsencrypt/live/plansectorial.mes.gob.cu/fullchain.pem /etc/letsencrypt/live/plansectorial.mes.gob.cu/privkey.pem | sudo tee /etc/ssl/certs/plan-sectorial.pem

# Reniciar HAProxy
sudo systemctl restart haproxy
```

### Paso 10: Inicializar Datos

```bash
# Semillar universidades
curl -X POST https://plansectorial.mes.gob.cu/api/seed

# Crear admin inicial
curl -X POST https://plansectorial.mes.gob.cu/api/seed-admin
```

Credenciales iniciales:
- **Usuario:** admin
- **Contraseña:** admin123

### Verificar el Despliegue

```bash
# Verificar estado del servicio
sudo systemctl status plan-sectorial

# Ver logs
sudo journalctl -u plan-sectorial -f

# Verificar puerto
sudo netstat -tlnp | grep 3000
```

### Comandos de Mantenimiento

| Comando | Descripción |
|---------|-------------|
| `sudo systemctl restart plan-sectorial` | Reiniciar la aplicación |
| `sudo systemctl status plan-sectorial` | Ver estado |
| `tail -f /var/log/syslog` | Ver logs del sistema |
| `bun run build` | Reconstruir después de updates |

### Notas Importantes

- **Puerto interno:** La aplicación Next.js corre en el puerto **3000**
- **HAProxy:** Recibe tráfico en puerto 443 y lo redirige al 3000
- **Base de datos:** El archivo `local.db` se crea en la raíz del proyecto
- **SSL:** El certificado debe estar configurado en HAProxy

---

## Notas

- El proyecto usa **SQLite** como base de datos (archivo `local.db`)
- La autenticación es basada en **JWT** con cookies seguras
- Hay 3 roles: `admin`, `universidad`, `etecsa`
