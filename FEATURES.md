# Future Opportunities

This file tracks only features that are not implemented yet in the current codebase.

## Near-Term

### Profile duplication
Clone an existing profile, including its connection details and maintenance settings, to speed up setup for similar environments.

### Profile import/export
Export profile definitions and saved maintenance settings so they can be moved between machines or shared across a team. Passwords can stay outside the export and be re-entered on import.

### Keyboard shortcuts and command palette
Add power-user navigation for common actions such as refreshing databases, starting runs, opening history, switching tabs, and moving between wizard steps.

### Dry-run / analysis-only mode
Analyze fragmentation, decide the action for each index, and produce the same preview data without executing `ALTER INDEX` statements.

### Resume failed or skipped databases
From the summary or history view, start a follow-up run that is pre-populated with only the databases that failed or were manually skipped.

## Mid-Term

### Advanced maintenance policies
Expose more granular controls such as per-database thresholds, configurable minimum page count, optional statistics-update behavior, and exclusion rules for specific databases, tables, or indexes.

### Run comparison and trend analytics
Compare two historical runs side by side and visualize how fragmentation, durations, failures, and rebuild/reorganize counts change over time.

### Scheduled maintenance runs
Allow recurring execution per profile so the app can run maintenance automatically during approved windows.

### File-based logs and report bundles
Write detailed execution logs to disk and optionally generate a shareable report bundle with CSV and printable summaries for audits or change-management records.

### Finish Windows authentication support
There is some early auth-type scaffolding in the frontend types and translations, but the app still operates with SQL Server authentication in practice. Completing integrated and credential-based Windows auth would unlock more enterprise environments.

### Custom pre/post SQL hooks
Let users run optional SQL before a run, before each database, or after completion for environment-specific orchestration.

## Longer-Term

### Headless / CLI runner
Provide a command-line or background execution mode so maintenance can be integrated with Task Scheduler, cron, CI, or remote operations tooling.

### External alerts
Send run summaries and failures to email, Slack, or Microsoft Teams in addition to the native desktop notifications that already exist.

### Team profile sharing
Support a safer way to share approved profile definitions and run settings across operators without recreating everything manually on each machine.

### Smart recommendations
Use accumulated run history to recommend thresholds, scheduling frequency, and concurrency settings based on observed fragmentation patterns.

### Multi-engine support
Extend the product beyond SQL Server to engines such as PostgreSQL or MySQL while preserving the same maintenance workflow and reporting experience.
