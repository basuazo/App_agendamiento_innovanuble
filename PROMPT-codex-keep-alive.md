# Prompt para Codex — Agregar cron keep-alive (Render free)

> Pégalo directamente como tarea en Codex, ejecutándose en la raíz de este repositorio.

---

**Tarea:** Evitar que el servicio de Render (plan free) hiberne tras 15 min de inactividad, agregando un ping externo periódico. El ping debe venir de fuera del servicio, por eso se usa GitHub Actions como pinger. NO uses un cron interno del backend (se apaga cuando Render duerme).

**Repositorio:** monorepo full-stack. Backend Express+TypeScript en `/server`, frontend React+Vite en `/client`, CI en `.github/workflows/ci.yml`. Ya existe `GET /api/health` (hace query a la BD).

Realiza exactamente estos cambios:

1. **Endpoint de ping liviano.** En `server/src/app.ts`, agrega `GET /api/ping` que responda `200` con `{ "status": "ok" }` **sin tocar la base de datos**. Colócalo antes del middleware de autenticación y del SPA fallback, y asegúrate de que quede excluido del rate limiting y no requiera token.

2. **Workflow programado.** Crea `.github/workflows/keep-alive.yml`:
   - Triggers: `schedule` con `cron: "*/10 * * * *"` y también `workflow_dispatch`.
   - Un job en `ubuntu-latest` con un paso que ejecute `curl -sSf "$APP_URL/api/ping" || exit 1`.
   - `APP_URL` debe venir de un secret/variable del repo (`${{ secrets.APP_URL }}`), no hardcodeado.
   - El job debe fallar si el ping no responde 2xx.

3. **Documentación.** Actualiza la sección de Deploy del `README.md`: explica el keep-alive, que hay que crear el secret `APP_URL` en *Settings → Secrets and variables → Actions* con la URL de Render (`https://<app>.onrender.com`), y advierte que mantener el servicio despierto 24/7 consume casi toda la cuota free (~750 h/mes por workspace). Menciona que se puede acotar el cron a horario hábil (`"*/10 8-20 * * 1-6"`) para reducir consumo, y que UptimeRobot o cron-job.org sirven como respaldo externo.

**Restricciones:**
- No modifiques la lógica de negocio existente ni el endpoint `/api/health`.
- Sigue las convenciones de TypeScript y el estilo del código ya presente.
- No agregues dependencias nuevas.

**Verificación (ejecútala al terminar):**
- `cd server && npx tsc --noEmit` pasa sin errores.
- Confirma que la ruta `/api/ping` está registrada antes del SPA fallback y no pasa por auth ni rate limit.
- Valida la sintaxis del YAML del nuevo workflow.
- Entrega un resumen de los archivos modificados y el paso manual pendiente (crear el secret `APP_URL`).
