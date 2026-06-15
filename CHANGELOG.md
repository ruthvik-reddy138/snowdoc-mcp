# Changelog

All notable changes to SnowDoc MCP will be documented here.

## [1.0.0] — 2026-06-15

### Initial Release

**Core Features**
- AI-powered SQL analysis using Claude (Anthropic)
- Automatic generation of business summaries, column dictionaries, and data lineage
- CTE breakdown and dependency mapping
- Data quality notes and risk flags

**Input Sources**
- SQL file upload (one or multiple files)
- Live Snowflake connection via `snowflake-sdk` (schema extraction from `INFORMATION_SCHEMA`)

**Output Formats**
- Markdown (free tier)
- Word `.docx` for SharePoint upload (premium)
- Confluence Storage Format markup (premium)
- Direct Confluence REST API push — create or update pages (premium)

**MCP Tools Exposed**
- `generate_docs_from_sql` — free tier
- `generate_docs_from_snowflake` — premium
- `export_docs_to_docx` — premium
- `push_to_confluence` — premium
