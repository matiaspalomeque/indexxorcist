import type { Lang } from "../store/i18nStore";

// Supports simple {variable} interpolation
export type Translations = Record<string, string>;

const en: Translations = {
  // Sidebar
  "sidebar.appName": "Indexxorcist",
  "sidebar.profilesHome": "Profiles Home",
  "sidebar.connectedTabs": "Connected Tabs",
  "sidebar.noTabs": "Connect a profile from Profiles Home to open a wizard tab.",
  "sidebar.wizardLocked": "Wizard steps are locked for this running profile.",
  "sidebar.closeTabDisabled": "Cannot close while run is active",
  "sidebar.closeTab": "Close tab",

  // AppShell wizard steps
  "wizard.databases": "Databases",
  "wizard.run": "Run",
  "wizard.summary": "Summary",

  // Profiles list
  "profiles.title": "Server Profiles",
  "profiles.subtitle": "Manage SQL Server connection profiles",
  "profiles.newProfile": "New Profile",
  "profiles.empty": "No profiles yet. Create one to get started.",

  // Profile card
  "profileCard.connected": "Connected",
  "profileCard.failed": "Failed",
  "profileCard.testConnection": "Test connection",
  "profileCard.edit": "Edit",
  "profileCard.delete": "Delete",
  "profileCard.tls": "TLS",
  "profileCard.alreadyOpened": "Profile Already Opened",
  "profileCard.connect": "Connect & Select Databases →",

  // Profile form modal
  "profileForm.titleNew": "New Profile",
  "profileForm.titleEdit": "Edit Profile",
  "profileForm.nameLabel": "Profile Name *",
  "profileForm.namePlaceholder": "e.g. Production",
  "profileForm.serverLabel": "Server *",
  "profileForm.serverPlaceholder": "myserver.database.windows.net",
  "profileForm.portLabel": "Port",
  "profileForm.usernameLabel": "Username *",
  "profileForm.passwordLabel": "Password",
  "profileForm.encryptLabel": "Encrypt (TLS)",
  "profileForm.trustCertLabel": "Trust Certificate",
  "profileForm.validationError": "Name, server, and username are required.",
  "profileForm.cancel": "Cancel",
  "profileForm.save": "Save",
  "profileForm.saving": "Saving…",

  // Database selector
  "databases.title": "Select Databases",
  "databases.refresh": "Refresh Databases",
  "databases.refreshing": "Refreshing...",
  "databases.filterPlaceholder": "Filter databases...",
  "databases.filterClear": "Clear filter",
  "databases.noDataEmpty": "No databases loaded yet.",
  "databases.noDataHint": "Use \"Refresh Databases\" to fetch all user databases from this server.",
  "databases.loading": "Loading databases...",
  "databases.selectAll": "Select All",
  "databases.deselectAll": "Deselect All",
  "databases.selectFiltered": "Select filtered ({count})",
  "databases.deselectFiltered": "Deselect filtered ({count})",
  "databases.selectedCount": "{selected} / {total} selected",
  "databases.noProfile": "No profile selected. Go to Profiles and click \"Connect & Select Databases\".",

  // Start button states
  "databases.btnStarting": "Starting...",
  "databases.btnRunActive": "Run in progress for this profile",
  "databases.btnLoading": "Loading databases...",
  "databases.btnLoadFirst": "Load databases to continue",
  "databases.btnSelectOne": "Select at least one database",
  "databases.btnStart": "Start Maintenance ({count} databases)",

  // Status bar
  "databases.statusSelected": "{selected} selected / {total} total databases",

  // Options panel
  "options.title": "Profile Settings",
  "options.sqlTimeouts": "SQL Timeouts",
  "options.connectionTimeout": "Connection timeout (ms)",
  "options.requestTimeout": "Request timeout (ms)",
  "options.noTimeout": "0 = no timeout",
  "options.rebuildOnline": "REBUILD with ONLINE = ON",
  "options.rebuildOnlineDesc": "Allows concurrent reads/writes during rebuild",
  "options.freeProcCache": "DBCC FREEPROCCACHE after run",
  "options.freeProcCacheDesc": "Force execution plan recompilation after maintenance",
  "options.retry": "Retry",
  "options.maxAttempts": "Max attempts",
  "options.baseDelay": "Base delay (ms)",
  "options.maxDelay": "Max delay (ms)",

  // Maintenance dashboard
  "dashboard.title": "Maintenance Dashboard",
  "dashboard.noProfile": "Select a connected profile tab to view its run dashboard.",
  "dashboard.noRun": "No run data yet for this profile. Start from the Databases step.",
  "dashboard.waiting": "Waiting for database events...",
  "dashboard.rebuilt": "Rebuilt",
  "dashboard.reorganized": "Reorganized",
  "dashboard.skipped": "Skipped",
  "dashboard.failedDbs": "Failed DBs",
  "dashboard.viewSummary": "View Summary",

  // Run state labels
  "runState.idle": "idle",
  "runState.running": "running",
  "runState.paused": "paused",
  "runState.finished": "finished",
  "runState.stopped": "stopped",

  // Database card states
  "dbState.queued": "Queued",
  "dbState.running": "Running",
  "dbState.done": "Done",
  "dbState.error": "Error",
  "dbState.skipped": "Skipped",

  // Database card stats
  "dbCard.rebuilt": "rebuilt",
  "dbCard.reorganized": "reorganized",
  "dbCard.skipped": "skipped",
  "dbCard.errors": "{count} error",
  "dbCard.errorsPlural": "{count} errors",

  // Run controls
  "controls.pause": "Pause",
  "controls.resume": "Resume",
  "controls.updating": "Updating...",
  "controls.skipDb": "Skip DB",
  "controls.skipping": "Skipping...",
  "controls.stop": "Stop",
  "controls.stopping": "Stopping...",

  // Overall progress bar
  "progress.label": "Overall Progress",
  "progress.count": "{current} / {total} databases ({pct}%)",

  // Results summary
  "summary.title": "Maintenance Summary",
  "summary.noProfile": "Select a connected profile tab to view its summary.",
  "summary.noSummary": "No summary yet for this profile. Complete a run first.",
  "summary.completedIn": "Completed in {duration}",
  "summary.runAgain": "Run Again",
  "summary.statDatabases": "Databases",
  "summary.statRebuilt": "Indexes Rebuilt",
  "summary.statReorganized": "Indexes Reorganized",
  "summary.statSkipped": "Indexes Skipped",
  "summary.statFailedDbs": "Failed DBs",
  "summary.statSkippedDbs": "Skipped DBs",
  "summary.colDatabase": "Database",
  "summary.colStatus": "Status",
  "summary.colRebuilt": "Rebuilt",
  "summary.colReorganized": "Reorganized",
  "summary.colSkipped": "Skipped",
  "summary.colDuration": "Duration",
  "summary.colErrors": "Errors",
  "summary.statusDone": "Done",
  "summary.statusSkipped": "Skipped",
  "summary.statusFailed": "Failed",

  // Index detail drawer
  "drawer.indexesTotal": "{count} indexes total",
  "drawer.dbErrors": "Database Errors ({count})",
  "drawer.noIndexData": "No index data yet.",
  "drawer.colSchemaTable": "Schema.Table",
  "drawer.colIndex": "Index",
  "drawer.colFrag": "Frag%",
  "drawer.colPages": "Pages",
  "drawer.colAction": "Action",
  "drawer.colStatus": "Status",
  "drawer.colDuration": "Duration",
  "drawer.colRetries": "Retries",
  "drawer.colError": "Error",

  // About modal
  "about.madeBy": "Made by",

  // Theme / language controls
  "settings.theme": "Toggle theme",
  "settings.lightMode": "Light mode",
  "settings.darkMode": "Dark mode",

  // Auth type (profile form)
  "profileForm.authTypeLabel": "Authentication",
  "profileForm.authSqlServer": "SQL Server",
  "profileForm.authWindowsIntegrated": "Windows (Current User)",
  "profileForm.authWindowsCredentials": "Windows (Credentials)",
  "profileForm.authWindowsNote": "Windows authentication requires running on Windows",
  "profileForm.windowsDomainHint": "(DOMAIN\\user)",

  // Fragmentation thresholds (options panel)
  "options.thresholds": "Fragmentation Thresholds",
  "options.reorganizeThreshold": "Reorganize threshold (%)",
  "options.rebuildThreshold": "Rebuild threshold (%)",
  "options.thresholdHint": "Rebuild threshold should be ≥ reorganize threshold",

  // Parallel processing (options panel)
  "options.parallel": "Parallel Processing",
  "options.parallelDatabases": "Process databases in parallel",
  "options.parallelDatabasesDesc": "Run multiple databases concurrently",
  "options.maxParallelDatabases": "Max concurrent databases",

  // Skip disabled in parallel mode
  "controls.skipDisabledParallel": "Skip is not available in parallel mode",

  // Update banner
  "update.label": "Update",
  "update.available": "available",
  "update.installButton": "Update & Restart",
  "update.installing": "Installing…",
  "update.dismiss": "Dismiss",

  // Sidebar history
  "sidebar.history": "History",

  // History view
  "history.title": "Run History",
  "history.noRuns": "No runs recorded yet.",
  "history.loading": "Loading history...",
  "history.clearAll": "Clear All",
  "history.clearConfirm": "Are you sure you want to clear all run history?",
  "history.colProfile": "Profile",
  "history.colServer": "Server",
  "history.colStarted": "Started",
  "history.colDuration": "Duration",
  "history.colDbs": "DBs",
  "history.colRebuilt": "Rebuilt",
  "history.colReorganized": "Reorganized",
  "history.colSkipped": "Skipped",
  "history.confirmClear": "Confirm Clear",
  "history.cancel": "Cancel",
  "history.noDetails": "No details available for this run.",
  "history.statusDone": "Done",
  "history.statusFailed": "Failed",
  "history.statusSkipped": "Skipped",
  "history.colIndex": "Index",
  "history.colTable": "Table",
  "history.colFrag": "Frag%",
  "history.colAction": "Action",
  "history.colStatus": "Status",
};

const esAR: Translations = {
  // Sidebar
  "sidebar.appName": "Indexxorcist",
  "sidebar.profilesHome": "Inicio de Perfiles",
  "sidebar.connectedTabs": "Pestañas Conectadas",
  "sidebar.noTabs": "Conectá un perfil desde Inicio de Perfiles para abrir una pestaña.",
  "sidebar.wizardLocked": "Los pasos están bloqueados para este perfil en ejecución.",
  "sidebar.closeTabDisabled": "No se puede cerrar mientras hay una ejecución activa",
  "sidebar.closeTab": "Cerrar pestaña",

  // AppShell wizard steps
  "wizard.databases": "Bases de Datos",
  "wizard.run": "Ejecución",
  "wizard.summary": "Resumen",

  // Profiles list
  "profiles.title": "Perfiles de Servidor",
  "profiles.subtitle": "Administrá tus perfiles de conexión SQL Server",
  "profiles.newProfile": "Nuevo Perfil",
  "profiles.empty": "Sin perfiles aún. Creá uno para comenzar.",

  // Profile card
  "profileCard.connected": "Conectado",
  "profileCard.failed": "Error",
  "profileCard.testConnection": "Probar conexión",
  "profileCard.edit": "Editar",
  "profileCard.delete": "Eliminar",
  "profileCard.tls": "TLS",
  "profileCard.alreadyOpened": "Perfil Ya Abierto",
  "profileCard.connect": "Conectar y Seleccionar Bases de Datos →",

  // Profile form modal
  "profileForm.titleNew": "Nuevo Perfil",
  "profileForm.titleEdit": "Editar Perfil",
  "profileForm.nameLabel": "Nombre del Perfil *",
  "profileForm.namePlaceholder": "ej. Producción",
  "profileForm.serverLabel": "Servidor *",
  "profileForm.serverPlaceholder": "miservidor.database.windows.net",
  "profileForm.portLabel": "Puerto",
  "profileForm.usernameLabel": "Usuario *",
  "profileForm.passwordLabel": "Contraseña",
  "profileForm.encryptLabel": "Encriptar (TLS)",
  "profileForm.trustCertLabel": "Confiar en Certificado",
  "profileForm.validationError": "El nombre, servidor y usuario son obligatorios.",
  "profileForm.cancel": "Cancelar",
  "profileForm.save": "Guardar",
  "profileForm.saving": "Guardando…",

  // Database selector
  "databases.title": "Seleccionar Bases de Datos",
  "databases.refresh": "Actualizar Bases de Datos",
  "databases.refreshing": "Actualizando...",
  "databases.filterPlaceholder": "Filtrar bases de datos...",
  "databases.filterClear": "Limpiar filtro",
  "databases.noDataEmpty": "Sin bases de datos cargadas aún.",
  "databases.noDataHint": "Usá \"Actualizar Bases de Datos\" para obtener todas las bases de datos del servidor.",
  "databases.loading": "Cargando bases de datos...",
  "databases.selectAll": "Seleccionar Todo",
  "databases.deselectAll": "Deseleccionar Todo",
  "databases.selectFiltered": "Seleccionar filtradas ({count})",
  "databases.deselectFiltered": "Deseleccionar filtradas ({count})",
  "databases.selectedCount": "{selected} / {total} seleccionadas",
  "databases.noProfile": "Sin perfil seleccionado. Andá a Perfiles y hacé clic en \"Conectar y Seleccionar Bases de Datos\".",

  // Start button states
  "databases.btnStarting": "Iniciando...",
  "databases.btnRunActive": "Hay una ejecución activa para este perfil",
  "databases.btnLoading": "Cargando bases de datos...",
  "databases.btnLoadFirst": "Cargá las bases de datos para continuar",
  "databases.btnSelectOne": "Seleccioná al menos una base de datos",
  "databases.btnStart": "Iniciar Mantenimiento ({count} bases de datos)",

  // Status bar
  "databases.statusSelected": "{selected} seleccionadas / {total} bases de datos totales",

  // Options panel
  "options.title": "Configuración del Perfil",
  "options.sqlTimeouts": "Tiempos de Espera SQL",
  "options.connectionTimeout": "Tiempo de conexión (ms)",
  "options.requestTimeout": "Tiempo de solicitud (ms)",
  "options.noTimeout": "0 = sin límite",
  "options.rebuildOnline": "REBUILD con ONLINE = ON",
  "options.rebuildOnlineDesc": "Permite lecturas/escrituras simultáneas durante el rebuild",
  "options.freeProcCache": "DBCC FREEPROCCACHE al finalizar",
  "options.freeProcCacheDesc": "Fuerza la recompilación de planes de ejecución tras el mantenimiento",
  "options.retry": "Reintentos",
  "options.maxAttempts": "Intentos máximos",
  "options.baseDelay": "Demora base (ms)",
  "options.maxDelay": "Demora máxima (ms)",

  // Maintenance dashboard
  "dashboard.title": "Panel de Mantenimiento",
  "dashboard.noProfile": "Seleccioná una pestaña de perfil conectado para ver su panel.",
  "dashboard.noRun": "Sin datos de ejecución para este perfil. Iniciá desde el paso de Bases de Datos.",
  "dashboard.waiting": "Esperando eventos de bases de datos...",
  "dashboard.rebuilt": "Reconstruidos",
  "dashboard.reorganized": "Reorganizados",
  "dashboard.skipped": "Omitidos",
  "dashboard.failedDbs": "BDs con Error",
  "dashboard.viewSummary": "Ver Resumen",

  // Run state labels
  "runState.idle": "inactivo",
  "runState.running": "ejecutando",
  "runState.paused": "pausado",
  "runState.finished": "finalizado",
  "runState.stopped": "detenido",

  // Database card states
  "dbState.queued": "En Cola",
  "dbState.running": "Ejecutando",
  "dbState.done": "Completado",
  "dbState.error": "Error",
  "dbState.skipped": "Omitido",

  // Database card stats
  "dbCard.rebuilt": "reconstruidos",
  "dbCard.reorganized": "reorganizados",
  "dbCard.skipped": "omitidos",
  "dbCard.errors": "{count} error",
  "dbCard.errorsPlural": "{count} errores",

  // Run controls
  "controls.pause": "Pausar",
  "controls.resume": "Reanudar",
  "controls.updating": "Actualizando...",
  "controls.skipDb": "Omitir BD",
  "controls.skipping": "Omitiendo...",
  "controls.stop": "Detener",
  "controls.stopping": "Deteniendo...",

  // Overall progress bar
  "progress.label": "Progreso General",
  "progress.count": "{current} / {total} bases de datos ({pct}%)",

  // Results summary
  "summary.title": "Resumen de Mantenimiento",
  "summary.noProfile": "Seleccioná una pestaña de perfil conectado para ver su resumen.",
  "summary.noSummary": "Sin resumen para este perfil. Completá una ejecución primero.",
  "summary.completedIn": "Completado en {duration}",
  "summary.runAgain": "Ejecutar de Nuevo",
  "summary.statDatabases": "Bases de Datos",
  "summary.statRebuilt": "Índices Reconstruidos",
  "summary.statReorganized": "Índices Reorganizados",
  "summary.statSkipped": "Índices Omitidos",
  "summary.statFailedDbs": "BDs con Error",
  "summary.statSkippedDbs": "BDs Omitidas",
  "summary.colDatabase": "Base de Datos",
  "summary.colStatus": "Estado",
  "summary.colRebuilt": "Reconstruidos",
  "summary.colReorganized": "Reorganizados",
  "summary.colSkipped": "Omitidos",
  "summary.colDuration": "Duración",
  "summary.colErrors": "Errores",
  "summary.statusDone": "Completada",
  "summary.statusSkipped": "Omitida",
  "summary.statusFailed": "Error",

  // Index detail drawer
  "drawer.indexesTotal": "{count} índices en total",
  "drawer.dbErrors": "Errores de Base de Datos ({count})",
  "drawer.noIndexData": "Sin datos de índices aún.",
  "drawer.colSchemaTable": "Esquema.Tabla",
  "drawer.colIndex": "Índice",
  "drawer.colFrag": "Frag%",
  "drawer.colPages": "Páginas",
  "drawer.colAction": "Acción",
  "drawer.colStatus": "Estado",
  "drawer.colDuration": "Duración",
  "drawer.colRetries": "Reintentos",
  "drawer.colError": "Error",

  // About modal
  "about.madeBy": "Hecho por",

  // Theme / language controls
  "settings.theme": "Cambiar tema",
  "settings.lightMode": "Modo claro",
  "settings.darkMode": "Modo oscuro",

  // Auth type (profile form)
  "profileForm.authTypeLabel": "Autenticación",
  "profileForm.authSqlServer": "SQL Server",
  "profileForm.authWindowsIntegrated": "Windows (Usuario Actual)",
  "profileForm.authWindowsCredentials": "Windows (Credenciales)",
  "profileForm.authWindowsNote": "La autenticación de Windows requiere ejecutar en Windows",
  "profileForm.windowsDomainHint": "(DOMINIO\\usuario)",

  // Fragmentation thresholds (options panel)
  "options.thresholds": "Umbrales de Fragmentación",
  "options.reorganizeThreshold": "Umbral de reorganización (%)",
  "options.rebuildThreshold": "Umbral de reconstrucción (%)",
  "options.thresholdHint": "El umbral de reconstrucción debe ser ≥ al de reorganización",

  // Parallel processing (options panel)
  "options.parallel": "Procesamiento Paralelo",
  "options.parallelDatabases": "Procesar bases de datos en paralelo",
  "options.parallelDatabasesDesc": "Ejecutar múltiples bases de datos de forma concurrente",
  "options.maxParallelDatabases": "Máximo de bases de datos concurrentes",

  // Skip disabled in parallel mode
  "controls.skipDisabledParallel": "Omitir no está disponible en modo paralelo",

  // Update banner
  "update.label": "Actualización",
  "update.available": "disponible",
  "update.installButton": "Actualizar y reiniciar",
  "update.installing": "Instalando…",
  "update.dismiss": "Cerrar",

  // Sidebar history
  "sidebar.history": "Historial",

  // History view
  "history.title": "Historial de Ejecuciones",
  "history.noRuns": "Sin ejecuciones registradas aún.",
  "history.loading": "Cargando historial...",
  "history.clearAll": "Borrar Todo",
  "history.clearConfirm": "¿Seguro que querés borrar todo el historial de ejecuciones?",
  "history.colProfile": "Perfil",
  "history.colServer": "Servidor",
  "history.colStarted": "Inicio",
  "history.colDuration": "Duración",
  "history.colDbs": "BDs",
  "history.colRebuilt": "Reconstruidos",
  "history.colReorganized": "Reorganizados",
  "history.colSkipped": "Omitidos",
  "history.confirmClear": "Confirmar Borrado",
  "history.cancel": "Cancelar",
  "history.noDetails": "Sin detalles disponibles para esta ejecución.",
  "history.statusDone": "Completada",
  "history.statusFailed": "Error",
  "history.statusSkipped": "Omitida",
  "history.colIndex": "Índice",
  "history.colTable": "Tabla",
  "history.colFrag": "Frag%",
  "history.colAction": "Acción",
  "history.colStatus": "Estado",
};

export const translations: Record<Lang, Translations> = { en, "es-AR": esAR };
