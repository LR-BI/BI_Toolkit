# BI Toolkit

Small browser tools for SQL Server, SSRS, EBS and Power BI work.
Live at **https://lr-bi.github.io/**

Plain HTML/CSS/JS. No build step. Everything runs client-side.

## Layout

```
index.html              home: search/drop/paste box + all tools
assets/style.css        shared look (light/dark, purple palette #c8bfff #9e89ff #765de5 #522fb6 #2e176d)
assets/tools.js         tool list - sidebar and home page build from this
assets/shell.js         builds the sidebar + top bar on every page
assets/boot.js          theme (light/dark/auto) + home-page file hand-off
assets/howto.js         remembers closed "How to use" boxes
assets/ssrs-expr.js     SSRS expression checks (used by the expression checker and report inspector)
tools/<name>/index.html one folder per tool
tools/_template/        copy this to start a new tool
.nojekyll               serve files as-is
```

## Preview locally

No server needed: unzip or clone, then double-click `index.html`. Links use `index.html` explicitly so they work from disk as well as on GitHub Pages.

## Add a tool

1. Copy `tools/_template/` to `tools/<new-name>/`.
2. Build the tool in its `index.html`. Keep it self-contained; shared look comes from `../../assets/style.css`.
   Fill in the "How to use" box at the top of the template. Keep the four <script> tags (boot, tools, shell, howto).
3. Add an entry to `assets/tools.js` (`cat` is the hub group, `svg` names a line icon in `TOOL_ICONS` at the top of the file; `icon` is 1-3 letters used if there is no icon):
   ```js
   { cat: "SQL Server", icon: "MT", name: "My Tool", path: "tools/new-name/index.html", svg: "new-name", desc: "What it does.", tags: ["SQL"] }
   ```
4. Commit and push. Pages redeploys in about a minute.

## Tools

| Tool | Path |
|---|---|
| Academic Year & ILR Dates | `tools/fe-dates/` |
| Excel to SSRS Width Converter | `tools/excel-to-ssrs/` |
| Flowchart Builder | `tools/flowchart/` | Process maps with swimlanes; build from text; export SVG/PDF/PNG/Mermaid |
| Project Planner | `tools/project-planner/` | Tasks, Kanban board, notes & decisions, risks/issues; Markdown import/export; save to a folder or GitHub |
| SQL Notes Block | `tools/sql-notes/` | Standard header block for queries: title, dated change log, notes; suggests lines from the SQL |
| EBS Validator Fixer | `tools/ebs-fixer/` | Rewrites OUTER/CROSS APPLY (scalar subqueries or joins) and STRING_AGG (STUFF FOR XML PATH) for the EBS Central validator |
| Safe Change Script | `tools/safe-change/` | Preview, backup table, transaction, row-count check, dry run, log and undo for UPDATE/DELETE/INSERT |
| Ontrack Page Builder | `tools/ontrack-builder/` | Rule-based CustomHTML script for Screen Designer pages, with F12 helpers, test plan and checklist |
| Random Password Generator | `tools/password/` |
| Schema Map | `tools/schema-map/` |
| SQL Checker | `tools/sql-checker/` |
| Query Plan Reader | `tools/plan-reader/` |
| Workflow Viewer | `tools/workflow-viewer/` |
| SSRS Report Inspector | `tools/rdl-inspector/` |
| Result Set Diff | `tools/result-diff/` |
| List to SQL | `tools/list-to-sql/` |
| Learner Digit Checker | `tools/learner-digit-checker/` |
| Ontrack Field Helper | `tools/ontrack-helper/` |
| Query ERD | `tools/query-erd/` |
| SSRS Expression Checker | `tools/ssrs-expressions/` (checks shared via `assets/ssrs-expr.js`) |

## Versions

The version number and changelog live at the bottom of `assets/tools.js` (`BITK_VERSION` and `CHANGELOG`); the changelog page is `changelog/index.html`. For each release, bump the version, add an entry at the top, and change the `?v=` number on asset links so browsers fetch the new files.
