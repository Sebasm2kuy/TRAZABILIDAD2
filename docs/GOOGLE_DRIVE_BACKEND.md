# Propuesta de backend con Google Drive

## Estado actual

La aplicación es una exportación estática y guarda las mutaciones en `localStorage`.
Las funciones de `src/lib/googleSheets.ts` conservan una API histórica, pero las
operaciones de red están desactivadas. Por tanto, actualmente no hay sincronización,
control de concurrencia, autorización en servidor ni recuperación centralizada.

## Arquitectura recomendada

```text
Navegador (GitHub Pages)
        |
        | HTTPS + comandos JSON versionados
        v
Google Apps Script Web App
        |-- valida usuario, rol, esquema y revisión esperada
        |-- serializa escrituras con LockService
        |-- registra auditoría append-only
        v
Google Sheets (estado estructurado)
        |
        +--> Google Drive (backups JSON periódicos y exportaciones originales)
```

Drive debe usarse para copias de seguridad y documentos, no como un único JSON que
todos los navegadores descargan y sobrescriben. Una hoja permite actualizar filas y
consultar entidades; Apps Script aporta una frontera de confianza para que las
credenciales y reglas no vivan en el cliente.

Documentación oficial relevante:

- [Apps Script Web Apps](https://developers.google.com/apps-script/guides/web)
- [LockService](https://developers.google.com/apps-script/reference/lock/lock-service)
- [Drive `appDataFolder`](https://developers.google.com/drive/api/guides/appdata)
- [Cuotas de Apps Script](https://developers.google.com/apps-script/guides/services/quotas)

## Por qué no acceder directamente a Drive desde React

1. Una cuenta de servicio requeriría una clave privada que nunca debe publicarse en
   el bundle del navegador.
2. OAuth directo haría que cada usuario opere con su identidad y tokens; requiere
   definir consentimiento, renovación y permisos sobre una carpeta compartida.
3. Drive ofrece archivos, no transacciones de registros. Dos clientes que hagan
   read-modify-write sobre el mismo JSON pueden perder cambios.
4. `appDataFolder` es privado por aplicación/usuario y no es un almacén compartido
   adecuado para este caso multiusuario.

Si el volumen, la concurrencia o los requisitos regulatorios crecen, la alternativa
correcta es un servicio en Cloud Run con una base transaccional; no ampliar
indefinidamente una hoja de cálculo.

## Modelo de datos inicial

Un spreadsheet administrado por el propietario del sistema:

| Hoja | Clave | Contenido |
|---|---|---|
| `records` | `id` | ingresos y exportaciones normalizados, tipo y timestamps |
| `batches` | `id` | metadatos del archivo, tipo, conteos y usuario |
| `edits` | `mutationId` | comandos idempotentes aplicados |
| `audit_log` | secuencia | usuario, fecha, acción, entidad, antes/después |
| `metadata` | nombre | `schemaVersion`, `revision`, última copia y migración |

Los archivos originales importados y los snapshots JSON se guardan en una carpeta de
Drive cuyo ID permanece en `PropertiesService` de Apps Script, nunca en el cliente.

## Contrato mínimo de la API

Todas las respuestas usan JSON y contienen `ok`, `schemaVersion`, `revision` y
`serverTime`. Las mutaciones incluyen un `mutationId` UUID para que los reintentos
sean idempotentes y `expectedRevision` para detectar conflictos.

### Lecturas

- `GET ?action=health`: versión y usuario reconocido.
- `GET ?action=changes&sinceRevision=42`: cambios incrementales.
- `GET ?action=snapshot`: estado completo para primera carga/recuperación.

### Escrituras

`POST` recibe un comando, no un reemplazo indiscriminado del estado:

```json
{
  "schemaVersion": 1,
  "mutationId": "uuid",
  "expectedRevision": 42,
  "action": "upsertRecord",
  "payload": { "id": "...", "tipo": "INGRESO" }
}
```

El servidor debe adquirir un `ScriptLock`, volver a comprobar la revisión, validar
el rol y el payload, escribir registro y auditoría, incrementar la revisión y liberar
el lock. Un conflicto devuelve un código funcional `REVISION_CONFLICT`; el cliente
hace pull y solicita resolución, nunca aplica silenciosamente “última escritura gana”.

## Autenticación y autorización

La decisión depende del dominio de los usuarios:

1. **Google Workspace de una sola organización (preferido):** desplegar el Web App
   solo para el dominio y mantener una tabla servidor `email -> role`.
2. **Cuentas externas:** usar Google Identity Services en el cliente y verificar el
   ID token en un backend real (por ejemplo Cloud Run). No confiar en email/rol
   enviados en el cuerpo ni en `localStorage`.

Antes de elegir Apps Script hay que hacer una prueba con el despliegue real para
confirmar que la identidad activa está disponible con la configuración seleccionada.
El endpoint nunca debe desplegarse como público anónimo si permite escrituras.

## Migración por etapas

### Fase 0 — decisiones necesarias

- confirmar si todos los usuarios pertenecen al mismo Google Workspace;
- identificar propietario de Drive y administradores;
- estimar usuarios simultáneos, registros diarios y tamaño de archivos;
- definir retención, restauración y datos sensibles;
- decidir qué roles pueden importar, editar, borrar y restaurar.

### Fase 1 — backend aislado

- crear spreadsheet y carpeta en una cuenta institucional;
- implementar `health`, `snapshot` y comandos idempotentes en Apps Script;
- agregar validación de esquema, `LockService`, revisión y auditoría;
- crear backups diarios en Drive y probar una restauración completa.

### Fase 2 — cliente en modo piloto

- conservar `localStorage` como caché, no como fuente autoritativa;
- configurar la URL mediante variable de build, no desde un campo libre persistido;
- enviar snapshots solo para la migración inicial; después enviar comandos pequeños;
- mostrar estados `pendiente`, `sincronizado`, `conflicto` y `error`;
- usar una cola local durable para reintentos con el mismo `mutationId`.

### Fase 3 — migración y corte

- bloquear temporalmente escrituras;
- importar un snapshot versionado y comprobar conteos/hashes;
- activar backend como fuente de verdad para un grupo piloto;
- verificar auditoría, conflictos, cuotas y restauración;
- retirar gradualmente las lecturas directas de claves operativas.

## Snapshot local preparado

`createSyncSnapshot()` genera un payload versionado únicamente a partir de una lista
explícita de claves permitidas. No recorre todo `localStorage`, por lo que sesión,
contraseñas y preferencias privadas no se envían accidentalmente. También informa
claves corruptas y agrega un `mutationId`; este formato sirve para la migración
inicial, no para sobrescribir continuamente el backend.

## Información necesaria para continuar

1. ¿Los usuarios usan cuentas del mismo Google Workspace?
2. ¿Qué cuenta institucional será propietaria de la hoja y carpeta?
3. ¿Cuántos usuarios simultáneos y cuántas operaciones diarias se esperan?
4. ¿Se deben conservar los Excel/PDF originales? ¿Por cuánto tiempo?
5. ¿Quién puede borrar y quién puede restaurar datos?

## Decisiones confirmadas

- todos los usuarios pertenecen al mismo Google Workspace;
- la cuenta institucional que despliegue será propietaria de los recursos;
- se esperan como máximo cinco usuarios simultáneos;
- los Excel/PDF originales y backups se conservarán indefinidamente;
- solo el propietario podrá importar, editar, borrar y restaurar; los demás usuarios
  del dominio tendrán acceso de solo lectura.

La fase 1 correspondiente está preparada en `google-apps-script/`. El frontend debe
permanecer desconectado hasta comprobar con el despliegue real que Apps Script expone
la identidad activa del dominio de forma fiable.

## Resultado del piloto CORS

Desde GitHub Pages, Apps Script devuelve un origen CORS wildcard. El navegador bloquea
las solicitudes con cookies (`credentials: include`), por lo que la comprobación usa
`credentials: omit`. Si con ello el despliegue restringido no entrega JSON e identidad,
la integración necesitará Google Identity Services: OAuth Client ID Web, origen
autorizado `https://sebasm2kuy.github.io` y verificación del token en el backend. No se
debe degradar el Web App a escritura anónima.
