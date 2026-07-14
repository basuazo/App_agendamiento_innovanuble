# Prompt — Agregar cron keep-alive (evitar hibernación en Render free)

> Copia todo lo que está debajo de la línea y pégalo como instrucción a Claude (o a otra herramienta) para que implemente el keep-alive en este proyecto.

---

## Contexto del proyecto

Estás trabajando en **CoWork — App de Agendamiento de Máquinas y Espacios** (Innova Ñuble), un monorepo full-stack:

- **Frontend**: React 18 + TypeScript + Vite + Tailwind + FullCalendar + Zustand (`/client`)
- **Backend**: Node.js + Express + TypeScript (`/server`)
- **BD**: PostgreSQL (Neon en prod) + Prisma
- **Hosting**: Render (Web Service, plan **free**)
- **CI**: GitHub Actions ya configurado en `.github/workflows/ci.yml`
- Ya existe un health check: **`GET /api/health`** que verifica la conexión a la BD.

## Problema

El plan gratuito de Render **hiberna el servicio tras 15 min de inactividad**. El primer request después de dormir tarda ~30 s (cold start). Queremos mantenerlo despierto con un ping externo periódico.

## Restricción clave

El ping debe venir **desde fuera** del servicio. Un cron dentro del propio backend NO sirve: cuando Render lo duerme, ese cron también se apaga. Por eso usaremos **GitHub Actions** (gratis, ya está en el repo) como pinger externo.

---

## Tarea

Implementa un keep-alive en **dos capas**:

### 1. Endpoint de ping liviano (backend)

Verifica si conviene usar el `GET /api/health` existente o agregar un endpoint más liviano.

- `GET /api/health` ya hace una query a la BD en cada llamada. Para un ping cada 10 min eso es aceptable, pero para no gastar recursos innecesarios, **agrega un endpoint separado** `GET /api/ping` en `server/src/app.ts` que responda `200` con `{ "status": "ok" }` **sin tocar la BD**.
- Debe quedar **antes** del middleware de auth y del SPA fallback, y estar excluido del rate limiting.
- No debe requerir token.

### 2. Workflow programado de GitHub Actions (pinger externo)

Crea `.github/workflows/keep-alive.yml`:

- Trigger: `schedule` con `cron: "*/10 * * * *"` (cada 10 min; Render duerme a los 15) **y** `workflow_dispatch` para poder ejecutarlo manualmente.
- Un job en `ubuntu-latest` que haga `curl` a la URL de producción, p. ej.:
  ```yaml
  - name: Ping
    run: curl -sSf "$APP_URL/api/ping" || exit 1
  ```
- La URL debe leerse de un **secret/variable** del repo (`APP_URL`), no hardcodeada. Documenta que hay que crear ese secret en *Settings → Secrets and variables → Actions* con el valor de la URL de Render (`https://<tu-app>.onrender.com`).
- Que el job falle si el ping no responde `2xx` (`curl -f`), para enterarnos si algo se cayó.

---

## Consideraciones importantes (menciónalas en el PR/resumen)

1. **Consumo de horas Render**: el free tier da ~750 h/mes por workspace. Mantener el servicio despierto 24/7 son ~730 h, así que consume casi toda la cuota. Si hay más de un servicio free en el mismo workspace, no alcanza. Considerar limitar el cron a horario hábil (ej. `cron: "*/10 8-20 * * 1-6"`) para reducir consumo si aplica.
2. **Cron de GitHub Actions no es exacto**: puede retrasarse varios minutos bajo carga. Con intervalo de 10 min hay margen suficiente frente al límite de 15.
3. **Alternativa / respaldo externo**: dejar documentada la opción de usar **UptimeRobot** o **cron-job.org** apuntando a `/api/ping` cada 5–10 min (además avisan por email si se cae). Útil como redundancia porque los crons de GitHub Actions a veces se pausan en repos sin actividad reciente.

---

## Entregables

- `server/src/app.ts` con el endpoint `GET /api/ping`.
- `.github/workflows/keep-alive.yml`.
- Actualizar `README.md` (sección Deploy) explicando el keep-alive, el secret `APP_URL` y las advertencias de consumo de horas.
- Un resumen breve de los cambios y de cómo configurar el secret.

## Verificación

- `curl https://<tu-app>.onrender.com/api/ping` responde `200 {"status":"ok"}`.
- El workflow aparece en la pestaña *Actions* y puede dispararse con *Run workflow* (workflow_dispatch) sin errores.
- `npx tsc --noEmit` en `/server` pasa sin errores de tipos.
