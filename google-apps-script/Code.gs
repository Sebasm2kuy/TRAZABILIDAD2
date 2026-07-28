const SCHEMA_VERSION = 1;
const PROPERTY_KEYS = Object.freeze({
  spreadsheetId: 'SPREADSHEET_ID',
  backupFolderId: 'BACKUP_FOLDER_ID',
  ownerEmail: 'OWNER_EMAIL',
  allowedDomain: 'ALLOWED_DOMAIN',
});
const SHEETS = Object.freeze({ state: 'state', metadata: 'metadata', audit: 'audit_log' });
const ALLOWED_SYNC_KEYS = Object.freeze([
  'trazabilidad_new_records',
  'trazabilidad_exp_edits',
  'trazabilidad_exp_deleted',
  'trazabilidad_exp_ingresos',
  'trazabilidad_dep_edits',
  'trazabilidad_dep_new_records',
  'trazabilidad_dep_deleted',
  'cruce_caliral_edits',
  'trazabilidad_stock_data',
  'trazabilidad_dep_imported',
  'trazabilidad_exp_imported',
  'trazabilidad_imported_batches',
  'trazabilidad_stock_assignments',
]);

/**
 * Run once from the Apps Script editor while signed in with the institutional
 * owner account. IDs and authorization rules stay in Script Properties.
 */
function setupBackend(ownerEmail, allowedDomain) {
  const initialProperties = PropertiesService.getScriptProperties();
  ownerEmail = ownerEmail || initialProperties.getProperty(PROPERTY_KEYS.ownerEmail);
  allowedDomain = allowedDomain || initialProperties.getProperty(PROPERTY_KEYS.allowedDomain);
  ownerEmail = normalizeEmail_(ownerEmail);
  allowedDomain = String(allowedDomain || '').trim().toLowerCase().replace(/^@/, '');
  if (!ownerEmail || !allowedDomain || !ownerEmail.endsWith('@' + allowedDomain)) {
    throw new Error('El propietario debe pertenecer al dominio permitido.');
  }

  const properties = initialProperties;
  if (properties.getProperty(PROPERTY_KEYS.spreadsheetId)) {
    throw new Error('El backend ya está configurado. Use getBackendStatus() para inspeccionarlo.');
  }

  const spreadsheet = SpreadsheetApp.create('Trazabilidad - Backend');
  const folder = DriveApp.createFolder('Trazabilidad - Backups permanentes');
  properties.setProperties({
    [PROPERTY_KEYS.spreadsheetId]: spreadsheet.getId(),
    [PROPERTY_KEYS.backupFolderId]: folder.getId(),
    [PROPERTY_KEYS.ownerEmail]: ownerEmail,
    [PROPERTY_KEYS.allowedDomain]: allowedDomain,
  });
  initializeSheets_(spreadsheet);
  appendAudit_(spreadsheet, ownerEmail, 'BACKEND_CREATED', '', 0, 'Configuración inicial');
  return getBackendStatus();
}

function getBackendStatus() {
  const config = getConfig_();
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  return {
    configured: true,
    ownerEmail: config.ownerEmail,
    allowedDomain: config.allowedDomain,
    revision: getRevision_(spreadsheet),
    spreadsheetUrl: spreadsheet.getUrl(),
    backupFolderUrl: DriveApp.getFolderById(config.backupFolderId).getUrl(),
  };
}

function doGet(event) {
  try {
    const user = requireDomainUser_();
    const action = String((event && event.parameter && event.parameter.action) || 'health');
    if (action === 'health') return jsonResponse_(health_(user));
    if (action === 'snapshot') return jsonResponse_(readSnapshot_(user));
    return jsonError_('UNKNOWN_ACTION', 'Acción no reconocida.', 400);
  } catch (error) {
    return exceptionResponse_(error);
  }
}

function doPost(event) {
  try {
    const user = requireOwner_();
    const command = parseCommand_(event);
    if (command.action === 'importSnapshot') return jsonResponse_(importSnapshot_(command, user));
    if (command.action === 'createBackup') return jsonResponse_(createBackupCommand_(command, user));
    return jsonError_('UNKNOWN_ACTION', 'Acción no reconocida.', 400);
  } catch (error) {
    return exceptionResponse_(error);
  }
}

function health_(user) {
  const spreadsheet = openBackend_();
  return success_({
    revision: getRevision_(spreadsheet),
    user: user,
    role: isOwner_(user) ? 'owner' : 'reader',
  });
}

function readSnapshot_(user) {
  const spreadsheet = openBackend_();
  const rows = readDataRows_(spreadsheet.getSheetByName(SHEETS.state));
  const data = {};
  rows.forEach(function(row) {
    if (!row[0]) return;
    try { data[row[0]] = JSON.parse(row[1]); } catch (error) { throw apiError_('CORRUPT_STATE', 'Hay datos inválidos en el backend.', 500); }
  });
  return success_({ revision: getRevision_(spreadsheet), data: data, user: user });
}

function importSnapshot_(command, user) {
  validateBaseCommand_(command);
  if (!command.payload || !command.payload.data || typeof command.payload.data !== 'object' || Array.isArray(command.payload.data)) {
    throw apiError_('INVALID_PAYLOAD', 'El snapshot no contiene un objeto data válido.', 400);
  }
  const keys = Object.keys(command.payload.data);
  const forbidden = keys.filter(function(key) { return ALLOWED_SYNC_KEYS.indexOf(key) === -1; });
  if (forbidden.length) throw apiError_('FORBIDDEN_KEYS', 'El snapshot contiene claves no permitidas.', 400);

  return withScriptLock_(function() {
    const spreadsheet = openBackend_();
    const duplicate = findMutation_(spreadsheet, command.mutationId);
    if (duplicate) return success_({ revision: duplicate.revision, duplicate: true });

    const revision = getRevision_(spreadsheet);
    if (Number(command.expectedRevision) !== revision) {
      throw apiError_('REVISION_CONFLICT', 'El backend cambió desde la última lectura.', 409, { revision: revision });
    }

    const backup = createBackup_(spreadsheet, user, 'before-import-' + command.mutationId);
    replaceState_(spreadsheet, command.payload.data, user);
    const nextRevision = revision + 1;
    setRevision_(spreadsheet, nextRevision);
    appendAudit_(spreadsheet, user, 'SNAPSHOT_IMPORTED', command.mutationId, nextRevision, backup.fileId);
    return success_({ revision: nextRevision, backupCreated: true });
  });
}

function createBackupCommand_(command, user) {
  validateBaseCommand_(command);
  return withScriptLock_(function() {
    const spreadsheet = openBackend_();
    const duplicate = findMutation_(spreadsheet, command.mutationId);
    if (duplicate) return success_({ revision: duplicate.revision, duplicate: true });
    const revision = getRevision_(spreadsheet);
    const backup = createBackup_(spreadsheet, user, 'manual');
    appendAudit_(spreadsheet, user, 'BACKUP_CREATED', command.mutationId, revision, backup.fileId);
    return success_({ revision: revision, backupCreated: true });
  });
}

function createBackup_(spreadsheet, user, reason) {
  const config = getConfig_();
  const state = readSnapshot_(user);
  const timestamp = Utilities.formatDate(new Date(), 'Etc/UTC', "yyyyMMdd'T'HHmmss'Z'");
  const name = 'trazabilidad-' + timestamp + '-r' + state.revision + '-' + reason + '.json';
  const contents = JSON.stringify({
    schemaVersion: SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    revision: state.revision,
    createdBy: user,
    data: state.data,
  });
  const file = DriveApp.getFolderById(config.backupFolderId).createFile(name, contents, MimeType.PLAIN_TEXT);
  return { fileId: file.getId(), name: name };
}

function replaceState_(spreadsheet, data, user) {
  const sheet = spreadsheet.getSheetByName(SHEETS.state);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 4).setValues([['key', 'json', 'updatedAt', 'updatedBy']]);
  const now = new Date().toISOString();
  const rows = Object.keys(data).sort().map(function(key) {
    return [key, JSON.stringify(data[key]), now, user];
  });
  if (rows.length) sheet.getRange(2, 1, rows.length, 4).setValues(rows);
}

function initializeSheets_(spreadsheet) {
  const first = spreadsheet.getSheets()[0];
  first.setName(SHEETS.state);
  first.getRange(1, 1, 1, 4).setValues([['key', 'json', 'updatedAt', 'updatedBy']]);
  const metadata = spreadsheet.insertSheet(SHEETS.metadata);
  metadata.getRange(1, 1, 3, 2).setValues([
    ['name', 'value'],
    ['schemaVersion', SCHEMA_VERSION],
    ['revision', 0],
  ]);
  const audit = spreadsheet.insertSheet(SHEETS.audit);
  audit.getRange(1, 1, 1, 7).setValues([['timestamp', 'user', 'action', 'mutationId', 'revision', 'detail', 'schemaVersion']]);
}

function getRevision_(spreadsheet) {
  const rows = readDataRows_(spreadsheet.getSheetByName(SHEETS.metadata));
  const row = rows.find(function(item) { return item[0] === 'revision'; });
  return row ? Number(row[1]) || 0 : 0;
}

function setRevision_(spreadsheet, revision) {
  const sheet = spreadsheet.getSheetByName(SHEETS.metadata);
  const rows = readDataRows_(sheet);
  const index = rows.findIndex(function(item) { return item[0] === 'revision'; });
  if (index === -1) sheet.appendRow(['revision', revision]);
  else sheet.getRange(index + 2, 2).setValue(revision);
}

function appendAudit_(spreadsheet, user, action, mutationId, revision, detail) {
  spreadsheet.getSheetByName(SHEETS.audit).appendRow([
    new Date().toISOString(), user, action, mutationId || '', revision, detail || '', SCHEMA_VERSION,
  ]);
}

function findMutation_(spreadsheet, mutationId) {
  const rows = readDataRows_(spreadsheet.getSheetByName(SHEETS.audit));
  const row = rows.find(function(item) { return item[3] === mutationId; });
  return row ? { revision: Number(row[4]) || 0 } : null;
}

function readDataRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
}

function parseCommand_(event) {
  if (!event || !event.postData || !event.postData.contents) throw apiError_('EMPTY_BODY', 'Falta el cuerpo JSON.', 400);
  try { return JSON.parse(event.postData.contents); }
  catch (error) { throw apiError_('INVALID_JSON', 'El cuerpo no es JSON válido.', 400); }
}

function validateBaseCommand_(command) {
  if (!command || command.schemaVersion !== SCHEMA_VERSION) throw apiError_('SCHEMA_MISMATCH', 'Versión de esquema incompatible.', 400);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(String(command.mutationId || ''))) throw apiError_('INVALID_MUTATION_ID', 'mutationId inválido.', 400);
}

function requireDomainUser_() {
  const config = getConfig_();
  const email = normalizeEmail_(Session.getActiveUser().getEmail());
  if (!email) throw apiError_('IDENTITY_UNAVAILABLE', 'Google no proporcionó la identidad activa.', 401);
  if (!email.endsWith('@' + config.allowedDomain)) throw apiError_('FORBIDDEN_DOMAIN', 'Usuario fuera del dominio permitido.', 403);
  return email;
}

function requireOwner_() {
  const email = requireDomainUser_();
  if (!isOwner_(email)) throw apiError_('READ_ONLY', 'Solo el propietario puede modificar o restaurar información.', 403);
  return email;
}

function isOwner_(email) { return normalizeEmail_(email) === getConfig_().ownerEmail; }
function normalizeEmail_(email) { return String(email || '').trim().toLowerCase(); }
function openBackend_() { return SpreadsheetApp.openById(getConfig_().spreadsheetId); }

function getConfig_() {
  const properties = PropertiesService.getScriptProperties().getProperties();
  const config = {
    spreadsheetId: properties[PROPERTY_KEYS.spreadsheetId],
    backupFolderId: properties[PROPERTY_KEYS.backupFolderId],
    ownerEmail: normalizeEmail_(properties[PROPERTY_KEYS.ownerEmail]),
    allowedDomain: String(properties[PROPERTY_KEYS.allowedDomain] || '').toLowerCase(),
  };
  if (!config.spreadsheetId || !config.backupFolderId || !config.ownerEmail || !config.allowedDomain) {
    throw apiError_('NOT_CONFIGURED', 'Ejecute setupBackend(ownerEmail, allowedDomain) desde el editor.', 503);
  }
  return config;
}

function withScriptLock_(callback) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw apiError_('BACKEND_BUSY', 'El backend está procesando otra escritura.', 503);
  try { return callback(); } finally { lock.releaseLock(); }
}

function success_(values) {
  return Object.assign({ ok: true, schemaVersion: SCHEMA_VERSION, serverTime: new Date().toISOString() }, values || {});
}

function apiError_(code, message, status, details) {
  const error = new Error(message);
  error.apiCode = code;
  error.httpStatus = status;
  error.details = details || {};
  return error;
}

function exceptionResponse_(error) {
  return jsonResponse_({
    ok: false,
    schemaVersion: SCHEMA_VERSION,
    serverTime: new Date().toISOString(),
    error: { code: error.apiCode || 'INTERNAL_ERROR', message: error.message || 'Error interno', details: error.details || {} },
  });
}

function jsonError_(code, message, status) { return exceptionResponse_(apiError_(code, message, status)); }
function jsonResponse_(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }
