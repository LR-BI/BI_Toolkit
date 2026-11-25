// Line icons for each tool (24x24, drawn with the current text colour).
window.TOOL_ICONS = {
  "sql-checker": '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8.5 14.5l2.5 2.5 4.5-5"/>',
  "plan-reader": '<path d="M3.5 17a8.5 8.5 0 0 1 17 0"/><path d="M12 17l4.5-6"/><circle cx="12" cy="17" r="1.6"/><path d="M3 21h18"/>',
  "schema-map": '<ellipse cx="12" cy="5.5" rx="8" ry="2.8"/><path d="M4 5.5v13c0 1.6 3.6 2.8 8 2.8s8-1.2 8-2.8v-13"/><path d="M4 12c0 1.6 3.6 2.8 8 2.8s8-1.2 8-2.8"/>',
  "query-erd": '<rect x="2.5" y="3" width="8" height="7" rx="1.5"/><rect x="13.5" y="14" width="8" height="7" rx="1.5"/><path d="M2.5 6.5h8M13.5 17.5h8"/><path d="M10.5 6.5h3a2 2 0 0 1 2 2V14"/>',
  "result-diff": '<path d="M7 3v14"/><path d="M3 13l4 4 4-4"/><path d="M17 21V7"/><path d="M13 11l4-4 4 4"/>',
  "list-to-sql": '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" stroke-width="3"/>',
  "fe-dates": '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" stroke-width="2.6"/>',
  "workflow-viewer": '<rect x="3" y="3" width="6" height="6" rx="1.2"/><rect x="15" y="3" width="6" height="6" rx="1.2"/><rect x="15" y="15" width="6" height="6" rx="1.2"/><path d="M9 6h6M6 9v6a3 3 0 0 0 3 3h6"/>',
  "learner-digit-checker": '<path d="M5 9h14M4 15h14M10 3L8 21M16 3l-2 18"/>',
  "ontrack-helper": '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M7 9.5v5"/><path d="M5.8 9.5h2.4M5.8 14.5h2.4"/>',
  "rdl-inspector": '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4.5"/><path d="M14 3v6h6v2.5"/><circle cx="16" cy="16.5" r="3.2"/><path d="M18.4 18.9L21 21.5"/>',
  "ssrs-expressions": '<path d="M8.5 20c2 0 2.6-1.4 3-3.8l1.6-8.4c.4-2.4 1-3.8 3-3.8"/><path d="M8 10.5h7"/><path d="M15.5 13.5l5 5.5M20.5 13.5l-5 5.5"/>',
  "excel-to-ssrs": '<rect x="2" y="7" width="20" height="10" rx="1.5"/><path d="M6 7v3.5M10 7v5M14 7v3.5M18 7v5"/>',
  "flowchart": '<rect x="7" y="2" width="10" height="5" rx="2.5"/><path d="M12 7v2.5"/><path d="M12 9.5l5 3.5-5 3.5-5-3.5z"/><path d="M17 13h2.5V19H14.5"/><rect x="5" y="17" width="9.5" height="4.5" rx="1"/>',
  "project-planner": '<rect x="4" y="3.5" width="16" height="18" rx="2"/><path d="M9 3.5V2h6v1.5"/><path d="M8 9.5l1.5 1.5L12 8.5M8 15l1.5 1.5L12 14"/><path d="M14 10h3M14 15.5h3"/>',
  "sql-notes": '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 12.5h8M8 16h5"/>',
  "ebs-fixer": '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  "safe-change": '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  "ontrack-builder": '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M7 13h5M7 16h8"/><path d="M16 12.5l1.5 1.5-1.5 1.5"/>',
  "password": '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3L20 3"/><path d="M17 6l3 3M14.5 8.5l2.5 2.5"/>'
};
// Tool list. Add one entry per tool; the hub builds itself from this.
// cat: category heading on the hub. icon: 1-3 letters for the tile.
window.CATEGORIES = ["SQL Server", "EBS & ILR", "Reporting", "Diagrams", "Planning", "Admin"];
window.TOOLS = [
  { cat: "SQL Server", icon: "SQL", name: "SQL Checker", path: "tools/sql-checker/index.html", svg: "sql-checker",
    desc: "Seven-step check of a T-SQL query: syntax slips SQL Server rejects, unknown aliases, GROUP BY mistakes, join and NULL traps, and (with Schema Map) missing tables and columns.",
    tags: ["SQL", "EBS", "lint"] },
  { cat: "SQL Server", icon: "FX", name: "EBS Validator Fixer", path: "tools/ebs-fixer/index.html", svg: "ebs-fixer",
    desc: "Rewrite what EBS Central's validator rejects: OUTER/CROSS APPLY into scalar subqueries or joins, STRING_AGG into STUFF(FOR XML PATH).",
    tags: ["validator", "ebs central", "outer apply", "cross apply", "string_agg", "rewrite", "configurable screen"] },
  { cat: "SQL Server", icon: "SC", name: "Safe Change Script", path: "tools/safe-change/index.html", svg: "safe-change",
    desc: "Build a safe UPDATE / DELETE / INSERT for live data: preview, backup table, transaction, row-count check, dry run by default, log and undo script.",
    tags: ["update", "delete", "insert", "backup", "rollback", "transaction", "undo", "permissions", "live data"] },
  { cat: "SQL Server", icon: "NB", name: "SQL Notes Block", path: "tools/sql-notes/index.html", svg: "sql-notes",
    desc: "Add the standard header block to a query: title, dated change log (LR - ... | dd/mm/yy) and open notes, with lines suggested from the SQL.",
    tags: ["notes", "header", "comment", "change log", "documentation", "block"] },
  { cat: "SQL Server", icon: "QP", name: "Query Plan Reader", path: "tools/plan-reader/index.html", svg: "plan-reader",
    desc: "Drop in a .sqlplan: costly steps, scans, key lookups, bad estimates, fan-out, spills, per-row functions, missing indexes.",
    tags: ["SQL", "performance", "execution plan"] },
  { cat: "SQL Server", icon: "ERD", name: "Schema Map", path: "tools/schema-map/index.html", svg: "schema-map",
    desc: "ERD for a database with no docs: browse tables and links, get JOIN SQL between any two tables.",
    tags: ["SQL", "4CAST", "ERD"] },
  { cat: "SQL Server", icon: "JN", name: "Query ERD", path: "tools/query-erd/index.html", svg: "query-erd",
    desc: "Paste a query to see its tables, aliases and joins as a diagram, with warnings for cross joins, unlinked tables, undone LEFT JOINs and row fan-out.",
    tags: ["SQL", "joins", "ERD", "relationships", "diagram"] },
  { cat: "SQL Server", icon: "DIF", name: "Result Set Diff", path: "tools/result-diff/index.html", svg: "result-diff",
    desc: "Paste query results before and after a change: rows added, removed and changed, with the changed cells highlighted.",
    tags: ["SQL", "compare", "diff", "testing"] },
  { cat: "SQL Server", icon: "IN", name: "List to SQL", path: "tools/list-to-sql/index.html", svg: "list-to-sql",
    desc: "Paste a column of values and get an IN list, VALUES table, temp table or CTE, deduplicated and quoted.",
    tags: ["SQL", "IN list", "excel", "values"] },
  { cat: "EBS & ILR", icon: "AY", name: "Academic Year & ILR Dates", path: "tools/fe-dates/index.html", svg: "fe-dates",
    desc: "Academic year, CALOCC, ILR period, funding age, QAR hybrid end year and return dates, with T-SQL.",
    tags: ["ILR", "SQL", "CALOCC", "QAR"] },
  { cat: "EBS & ILR", icon: "WF", name: "Workflow Viewer", path: "tools/workflow-viewer/index.html", svg: "workflow-viewer",
    desc: "Open EBS workflow .xoml / .xaml files as a readable diagram, outline and property list, with rule conditions.",
    tags: ["EBS", "workflow", "xoml", "xaml"] },
  { cat: "EBS & ILR", icon: "#", name: "Learner Digit Checker", path: "tools/learner-digit-checker/index.html", svg: "learner-digit-checker",
    desc: "Check ULN check digits, NI numbers, postcodes and UKPRNs against ILR rules, with a cleaned-up list.",
    tags: ["ILR", "ULN", "NINO", "postcode", "UKPRN", "data quality"] },
  { cat: "EBS & ILR", icon: "OB", name: "Ontrack Page Builder", path: "tools/ontrack-builder/index.html", svg: "ontrack-builder",
    desc: "Build a Screen Designer CustomHTML script from rules: defaults, show/hide, required, locks, ULN/NI checks, grid colours, banners, buttons and after-save steps. Includes F12 helpers and a test plan.",
    tags: ["ontrack", "screen designer", "customhtml", "javascript", "default", "validation", "show hide", "16-18", "age"] },
  { cat: "EBS & ILR", icon: "OT", name: "Ontrack Field Helper", path: "tools/ontrack-helper/index.html", svg: "ontrack-helper",
    desc: "Field name to jQuery selectors (input, hidden twin, read-only text) and ready-made Screen Designer snippets.",
    tags: ["EBS", "Ontrack", "Screen Designer", "jQuery", "javascript"] },
  { cat: "Reporting", icon: "RDL", name: "SSRS Report Inspector", path: "tools/rdl-inspector/index.html", svg: "rdl-inspector",
    desc: "Open an .rdl: datasets and SQL, parameters, every expression, page fit, unknown/unused fields and self-referencing LookupSet.",
    tags: ["SSRS", "rdl", "report", "LookupSet"] },
  { cat: "Reporting", icon: "EXP", name: "SSRS Expression Checker", path: "tools/ssrs-expressions/index.html", svg: "ssrs-expressions",
    desc: "Check SSRS expressions (or every expression in an .rdl) for VB mistakes: IIf traps, = Nothing, + on text, mm vs MM, LookupSet, scope and more.",
    tags: ["SSRS", "expression", "VB", "IIf", "rdl"] },
  { cat: "Reporting", icon: "XL", name: "Excel to SSRS Width Converter", path: "tools/excel-to-ssrs/index.html", svg: "excel-to-ssrs",
    desc: "Excel column widths and row heights to cm / in / px for SSRS, based on the workbook's default font.",
    tags: ["SSRS", "Excel"] },
  { cat: "Diagrams", icon: "FC", name: "Flowchart Builder", path: "tools/flowchart/index.html", svg: "flowchart",
    desc: "Draw process maps with swimlanes, decisions and connectors, or build one from a list of steps. Export to SVG, PDF, PNG or Mermaid.",
    tags: ["flowchart", "process", "visio", "diagram", "swimlane", "map"] },
  { cat: "Planning", icon: "PP", name: "Project Planner", path: "tools/project-planner/index.html", svg: "project-planner",
    desc: "Plan projects with tasks, a Kanban board, notes & decisions and a risks/issues log. Import plans from Markdown; save to a folder or GitHub.",
    tags: ["project", "plan", "tasks", "kanban", "raid", "risks", "issues", "decisions", "github", "uafx", "screen designer", "screens"] },
  { cat: "Admin", icon: "PW", name: "Random Password Generator", path: "tools/password/index.html", svg: "password",
    desc: "Easy-to-read Colour + Animal + number + symbol passwords, one at a time or in a batch.",
    tags: ["accounts", "password"] }
];

// ---- Version and changelog (newest first). Bump BITK_VERSION and add an entry for each release. ----
window.BITK_VERSION = "1.2.1";
window.CHANGELOG = [
  { v: "1.2.1", date: "25 Nov 2026", title: "Fix: GitHub save errors", items: [
    "Project Planner retries a GitHub save when GitHub answers with a server error (500), and says which file failed if it still can't"
  ] },
  { v: "1.2.0", date: "25 Nov 2026", title: "Screens in projects", items: [
    "Project Planner: new Screens tab for Screen Designer exports (.uafx): page versions, DataLinks, layout, custom HTML and notes",
    "Checks each screen for validator problems, hard-coded dates, expander columns, writeback tables and access groups",
    "Send a DataLink to the SQL store, SQL Checker or EBS Validator Fixer; screens save as screens/*.uafx to a folder or GitHub",
    "Example project has a made-up screen to show what it reads (no real screens in the site)"
  ] },
  { v: "1.1.2", date: "25 Nov 2026", title: "Fix: delete diagram", items: [
    "Flowchart Builder: Delete this diagram works (it used to come straight back)"
  ] },
  { v: "1.1.1", date: "25 Nov 2026", title: "Flowchart import", items: [
    "Flowchart Builder opens React Flow JSON (nodes + edges), by Open file, paste into From text, or drop on the home page"
  ] },
  { v: "1.1.0", date: "25 Nov 2026", title: "Big update", items: [
    "New: Project Planner: tasks, board, notes, risks & issues, forecast, SQL store and diagrams; save to a folder or GitHub",
    "New: Flowchart Builder: swimlanes, decisions, build from text, export SVG/PDF/PNG/Mermaid",
    "New: SQL Notes Block, EBS Validator Fixer, Safe Change Script, Ontrack Page Builder",
    "SQL Checker runs seven steps; Query ERD exports and traces columns",
    "Home page: tool groups open and close, falling penguin background",
    "Moved to tools.lwr.fyi with the penguin icon; contrast and scrollbar fixes"
  ] },
  { v: "1.0.0", date: "Nov 2026", title: "First version", items: [
    "One site for the toolkit: 14 tools for SQL Server, EBS/ILR and SSRS, with search and light/dark themes"
  ] }
];
