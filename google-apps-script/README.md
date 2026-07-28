# Backend de trazabilidad en Apps Script

Este directorio contiene la primera fase del backend descrito en
`docs/GOOGLE_DRIVE_BACKEND.md`. Todavía no está conectado al frontend.

## Decisiones aplicadas

- acceso limitado al Google Workspace de la organización;
- ejecución bajo la cuenta institucional que despliega el Web App;
- todos los usuarios del dominio pueden leer;
- solo el propietario configurado puede importar, respaldar, borrar o restaurar;
- escrituras serializadas con `ScriptLock` para hasta cinco usuarios concurrentes;
- originales y backups con retención indefinida (no se implementa borrado automático).

## Instalación inicial

1. Crear un proyecto de Apps Script **con la cuenta institucional propietaria**.
2. Copiar `Code.gs` y `appsscript.json` al proyecto (o usar `clasp`).
3. En **Project Settings → Script Properties**, crear temporalmente:

   - `OWNER_EMAIL`: email completo de la cuenta institucional;
   - `ALLOWED_DOMAIN`: dominio sin `@`.

4. Ejecutar manualmente `setupBackend()` desde el editor.

5. Autorizar Sheets y Drive. La función crea un spreadsheet y una carpeta privada de
   backups, guardando sus IDs y reglas en Script Properties.
6. Ejecutar `getBackendStatus()` y guardar de forma segura las URLs mostradas.
7. Desplegar como Web App:
   - ejecutar como **usuario que despliega**;
   - acceso: **usuarios del dominio**.
8. Abrir `...?action=health` con la cuenta propietaria y con una cuenta lectora.
   Deben devolver respectivamente los roles `owner` y `reader`.

No se debe desplegar como público/anónimo ni copiar IDs, tokens o credenciales al
repositorio.

## Prueba piloto obligatoria

Antes de conectar el frontend, confirmar que `health` devuelve el email institucional
en `user`. Si responde `IDENTITY_UNAVAILABLE`, no se debe relajar la autorización:
hay que revisar la configuración del despliegue o usar Cloud Run con verificación de
Google Identity.

## API implementada

### GET

- `?action=health`: identidad, rol, versión y revisión.
- `?action=snapshot`: snapshot actual para usuarios del dominio.

### POST (solo propietario)

- `importSnapshot`: migración inicial versionada. Crea un backup antes de reemplazar.
- `createBackup`: copia manual permanente en Drive.

Apps Script devuelve errores funcionales dentro del JSON. Debido a las limitaciones
de `ContentService`, el cliente debe comprobar siempre `body.ok` y `body.error.code`,
no depender exclusivamente del código HTTP.

## Ejemplo de importación inicial

```json
{
  "schemaVersion": 1,
  "mutationId": "2c52d349-7995-4cab-9cb3-89952befa7cc",
  "expectedRevision": 0,
  "action": "importSnapshot",
  "payload": {
    "data": {
      "trazabilidad_imported_batches": []
    }
  }
}
```

## Controles incluidos

- lista permitida de claves sincronizables;
- validación de dominio y propietario en servidor;
- esquema versionado;
- revisión optimista (`REVISION_CONFLICT`);
- mutaciones idempotentes mediante `mutationId` y auditoría;
- bloqueo global de escrituras;
- backup previo a una importación;
- auditoría append-only;
- IDs de recursos únicamente en Script Properties.

## Siguiente implementación

Tras superar el piloto de identidad:

1. agregar comandos incrementales `upsertRecord`, `deleteRecord` y `restoreRecord`;
2. validar sus payloads con las mismas reglas del cliente;
3. añadir una cola durable en el navegador;
4. conectar primero un grupo piloto en modo lectura;
5. habilitar escrituras solo para el propietario;
6. ensayar restauración desde un backup antes del corte definitivo.
