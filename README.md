# SnowDoc MCP

**AI-powered SQL & Snowflake documentation generator for data teams.**

> Stop spending days writing data docs manually. SnowDoc connects to your SQL files or live Snowflake instance and generates publication-ready documentation in seconds — column dictionaries, data lineage, business summaries, and direct export to Confluence or SharePoint.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-purple)](https://mcpmarket.com)

---

## The Problem

Large organisations have **hundreds of undocumented SQL files and Snowflake tables**. Writing data dictionaries, lineage maps, and business descriptions manually takes hours per table — work that's always deprioritised and always out of date.

## The Solution

SnowDoc reads your SQL and generates structured, accurate documentation automatically using AI. It understands CTEs, joins, transformations, and business logic — then exports directly to Confluence or Word for immediate upload to SharePoint.

---

## Features

| Feature | Free | Premium |
|---|---|---|
| Upload SQL files | ✅ | ✅ |
| Business summary (plain English) | ✅ | ✅ |
| Column dictionary with descriptions | ✅ | ✅ |
| Data lineage mapping | ✅ | ✅ |
| CTE breakdown | ✅ | ✅ |
| Data quality notes | ✅ | ✅ |
| Markdown export | ✅ | ✅ |
| Live Snowflake connection | ❌ | ✅ |
| Word `.docx` export (SharePoint) | ❌ | ✅ |
| Confluence API push | ❌ | ✅ |
| Bulk / multi-table | ❌ | ✅ |

---

## Quick Start

### 1. Install

```bash
npm install -g snowdoc-mcp
```

### 2. Set your API key

```bash
# Get a free key at console.groq.com or aistudio.google.com
export ANTHROPIC_API_KEY=your-key-here
```

### 3. Add to Cursor or Claude

Create or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "snowdoc": {
      "command": "snowdoc-mcp",
      "env": {
        "ANTHROPIC_API_KEY": "your-key-here"
      }
    }
  }
}
```

Restart Cursor. SnowDoc tools will appear in Agent mode.

---

## MCP Tools

### `generate_docs_from_sql` — Free

Upload one or more SQL files and get full documentation instantly.

```json
{
  "files": [
    {
      "name": "fact_orders.sql",
      "content": "WITH raw_orders AS (...) SELECT ..."
    }
  ],
  "output_format": "markdown"
}
```

**output_format options:** `markdown` · `confluence_markup`

---

### `generate_docs_from_snowflake` — Premium

Connect live to Snowflake and document an entire schema automatically.

```json
{
  "credentials": {
    "account": "myorg.us-east-1",
    "username": "analyst",
    "password": "...",
    "database": "ANALYTICS",
    "schema": "CORE",
    "warehouse": "COMPUTE_WH"
  },
  "table_filter": "fact_",
  "output_format": "markdown"
}
```

**output_format options:** `markdown` · `docx_base64` · `confluence_markup`

---

### `export_docs_to_docx` — Premium

Convert any doc results into a professionally formatted Word document for SharePoint.

```json
{
  "doc_results": [...]
}
```

Returns base64-encoded `.docx` with branded headers, colour-coded tables, page numbers, and footer.

---

### `push_to_confluence` — Premium

Push documentation directly to Confluence — creates the page if it doesn't exist, updates it if it does.

```json
{
  "doc_results": [...],
  "confluence_config": {
    "baseUrl": "https://yourcompany.atlassian.net",
    "spaceKey": "DATA",
    "pageTitle": "ANALYTICS.CORE Documentation",
    "username": "you@company.com",
    "apiToken": "your-confluence-token"
  }
}
```

---

## Sample Output

```markdown
## fact_orders.sql

### Overview
This SQL builds the central orders fact table combining raw order data with
customer segments and order item aggregations. It serves as the primary source
for revenue reporting and customer analytics dashboards.

**Complexity:** moderate | **Grain:** One row per order

### Data Lineage
**Target:** `ANALYTICS.FACT.FACT_ORDERS`
**Sources:** `RAW.ECOMMERCE.ORDERS`, `RAW.ECOMMERCE.ORDER_ITEMS`, `CORE.DIM.DIM_CUSTOMERS`

### Column Dictionary
| Column          | Source       | Type    | Nullable | Description                             |
|-----------------|--------------|---------|----------|-----------------------------------------|
| 🔑 order_id     | raw_orders   | VARCHAR | ❌       | Unique identifier for each order        |
| customer_segment| dim_customers| VARCHAR | ✅       | Business segment (Enterprise, SMB, etc) |
| net_revenue     | order_items  | FLOAT   | ✅       | Gross revenue minus applied discounts   |
| is_first_order  | derived      | BOOLEAN | ✅       | True if this is the customer's first order |

### Data Quality Notes
- LEFT JOIN to order_items may produce NULL revenue for orders with no items
- Orders from inactive customers will have NULL segment and region
- No deduplication — assumes order_id is unique in source
```

---

## Project Structure

```
snowdoc-mcp/
├── index.js                      # MCP server entry point (4 tools)
├── src/
│   ├── doc-generator.js          # Core AI engine (SQL → structured JSON)
│   ├── snowflake-connector.js    # Live Snowflake schema extractor
│   └── formatters/
│       ├── markdown.js           # Markdown renderer (free tier)
│       ├── docx.js               # Word document renderer (premium)
│       └── confluence.js         # Confluence markup + REST API push (premium)
├── examples/
│   └── fact_orders.sql           # Sample SQL for testing
├── .env.example                  # Environment variable template
└── test.js                       # Test runner
```

---

## Requirements

- **Node.js** >= 18
- **API key** from any of these free providers:
  - [Google AI Studio](https://aistudio.google.com) — free, no credit card
  - [Groq](https://console.groq.com) — free, no credit card, very fast
  - [Anthropic](https://console.anthropic.com) — best quality, paid
- **Snowflake credentials** — only for the premium live-connect tool
- **Confluence API token** — only for the premium push tool

---

## Why SnowDoc?

| Without SnowDoc | With SnowDoc |
|---|---|
| 2–4 hours per table, manually | Under 30 seconds per table |
| Written by engineers, for engineers | Business-readable language |
| Lives in Notion or nowhere | Direct push to Confluence / SharePoint |
| Goes stale immediately | Re-run any time in seconds |
| Requires a documentation sprint | Runs inside your existing AI tools |

---

## Roadmap

- [ ] dbt model support (parse `schema.yml`)
- [ ] Data lineage diagrams (Mermaid export)
- [ ] GitHub Actions integration (auto-doc on PR)
- [ ] Slack notification on doc update
- [ ] Multi-schema bulk documentation

---

## Contributing

Pull requests welcome. Please open an issue first for major changes.

---

## License

MIT — free tier is fully open source. See [LICENSE](LICENSE).

---

*Built by a Senior Snowflake Developer who got tired of writing docs at 11pm.*
