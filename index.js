#!/usr/bin/env node

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const fs = require("fs");
const path = require("path");

const { generateDocumentation } = require("./src/doc-generator");
const { renderMarkdown } = require("./src/formatters/markdown");
const { renderDocx } = require("./src/formatters/docx");
const { renderConfluenceMarkup, pushToConfluence } = require("./src/formatters/confluence");
const { extractSnowflakeSchema, schemaToSqlFiles } = require("./src/snowflake-connector");

const server = new Server(
  { name: "snowdoc-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ─── Tool Definitions ───────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // FREE TIER
    {
      name: "generate_docs_from_sql",
      description:
        "Upload one or more SQL files and generate structured documentation including table descriptions, column dictionaries, data lineage, and business summaries. Returns Markdown by default.",
      inputSchema: {
        type: "object",
        properties: {
          files: {
            type: "array",
            description: "Array of SQL file objects with name and content",
            items: {
              type: "object",
              properties: {
                name: { type: "string", description: "Filename e.g. fact_orders.sql" },
                content: { type: "string", description: "Raw SQL content" },
              },
              required: ["name", "content"],
            },
          },
          output_format: {
            type: "string",
            enum: ["markdown", "confluence_markup"],
            description: "Output format. markdown is default (free). confluence_markup returns raw Confluence XHTML.",
            default: "markdown",
          },
        },
        required: ["files"],
      },
    },

    // PREMIUM TIER
    {
      name: "generate_docs_from_snowflake",
      description:
        "[PREMIUM] Connect live to Snowflake, extract schema metadata, and auto-generate full documentation for all tables in a schema.",
      inputSchema: {
        type: "object",
        properties: {
          credentials: {
            type: "object",
            description: "Snowflake connection credentials",
            properties: {
              account: { type: "string" },
              username: { type: "string" },
              password: { type: "string" },
              database: { type: "string" },
              schema: { type: "string" },
              warehouse: { type: "string" },
              role: { type: "string" },
            },
            required: ["account", "username", "password", "database", "schema"],
          },
          table_filter: {
            type: "string",
            description: "Optional: filter tables by name pattern (ILIKE match)",
          },
          output_format: {
            type: "string",
            enum: ["markdown", "docx_base64", "confluence_markup"],
            default: "markdown",
          },
        },
        required: ["credentials"],
      },
    },

    {
      name: "export_docs_to_docx",
      description:
        "[PREMIUM] Convert previously generated documentation JSON into a professionally formatted Word document (.docx) for SharePoint upload. Returns base64-encoded file.",
      inputSchema: {
        type: "object",
        properties: {
          doc_results: {
            type: "array",
            description: "Documentation results array (output from generate_docs_from_sql or generate_docs_from_snowflake)",
          },
        },
        required: ["doc_results"],
      },
    },

    {
      name: "push_to_confluence",
      description:
        "[PREMIUM] Push generated documentation directly to a Confluence page via REST API. Creates or updates the page automatically.",
      inputSchema: {
        type: "object",
        properties: {
          doc_results: {
            type: "array",
            description: "Documentation results array",
          },
          confluence_config: {
            type: "object",
            properties: {
              baseUrl: { type: "string", description: "e.g. https://yourcompany.atlassian.net" },
              spaceKey: { type: "string", description: "Confluence space key e.g. DATA" },
              pageTitle: { type: "string", description: "Page title to create or update" },
              username: { type: "string" },
              apiToken: { type: "string", description: "Confluence API token" },
              parentPageId: { type: "string", description: "Optional parent page ID" },
            },
            required: ["baseUrl", "spaceKey", "pageTitle", "username", "apiToken"],
          },
        },
        required: ["doc_results", "confluence_config"],
      },
    },
  ],
}));

// ─── Tool Handlers ───────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    // ── FREE: Generate docs from SQL files ──────────────────────────────────
    if (name === "generate_docs_from_sql") {
      const { files, output_format = "markdown" } = args;

      if (!files?.length) {
        return error("No SQL files provided. Pass at least one { name, content } object.");
      }

      const docResults = await generateDocumentation(files);

      if (output_format === "confluence_markup") {
        const markup = renderConfluenceMarkup(docResults);
        return success(`# Confluence Markup\n\nReady to paste into Confluence:\n\n\`\`\`xml\n${markup}\n\`\`\``);
      }

      const markdown = renderMarkdown(docResults);
      return success(markdown, docResults);
    }

    // ── PREMIUM: Generate docs from live Snowflake ───────────────────────────
    if (name === "generate_docs_from_snowflake") {
      const { credentials, table_filter, output_format = "markdown" } = args;

      const schema = await extractSnowflakeSchema(credentials, table_filter);
      if (!schema.length) {
        return error(`No tables found in ${credentials.database}.${credentials.schema}`);
      }

      const sqlFiles = schemaToSqlFiles(schema);
      const docResults = await generateDocumentation(sqlFiles);

      if (output_format === "docx_base64") {
        const buffer = await renderDocx(docResults);
        return success(`Documentation generated for ${docResults.length} tables.\n\n**docx_base64:**\n${buffer.toString("base64")}`);
      }

      if (output_format === "confluence_markup") {
        const markup = renderConfluenceMarkup(docResults);
        return success(markup);
      }

      const markdown = renderMarkdown(docResults);
      return success(markdown, docResults);
    }

    // ── PREMIUM: Export to .docx ─────────────────────────────────────────────
    if (name === "export_docs_to_docx") {
      const { doc_results } = args;
      const buffer = await renderDocx(doc_results);
      const b64 = buffer.toString("base64");
      return success(
        `Word document generated successfully.\n\n**File:** documentation.docx\n**Size:** ${Math.round(buffer.length / 1024)} KB\n**Base64:** ${b64}`
      );
    }

    // ── PREMIUM: Push to Confluence ──────────────────────────────────────────
    if (name === "push_to_confluence") {
      const { doc_results, confluence_config } = args;
      const result = await pushToConfluence(confluence_config, doc_results);
      return success(
        `✅ Confluence page ${result.action} successfully!\n\n**Page URL:** ${result.url}\n**Page ID:** ${result.pageId}`
      );
    }

    return error(`Unknown tool: ${name}`);
  } catch (err) {
    return error(`Tool error: ${err.message}`);
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function success(text, data = null) {
  const content = [{ type: "text", text }];
  if (data) {
    content.push({ type: "text", text: `\n\n<!-- doc_results_json\n${JSON.stringify(data)}\n-->` });
  }
  return { content };
}

function error(message) {
  return { content: [{ type: "text", text: `❌ Error: ${message}` }], isError: true };
}

// ─── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("SnowDoc MCP server running...");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
