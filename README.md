# toggl-redmine
Simple non-destructive Toggl API to Redmine API sync tool with update capability

Features:
* Idempotent, no database (time entry matching by appendix `[id]` at the end of redmine time entry description) 
* Create and update time entries in redmine, Toggl entry description is searched for an issue number hashtag, e.g. `#150` 
* Report error in case of no corresponding Toggl entry is found for existing Redmine entry (possibly deleted)
* Pretty tabular console/log report
* Mail reports

Environment/prerequisites:
* Docker OR Node.js v8.x

How to:
* create `config.json`
* `npm run build`
* manual run: `node ./built/main.js sync`
* scheduled run: `crontab` or other tools

Use at your own risk.