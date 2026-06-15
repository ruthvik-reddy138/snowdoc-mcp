const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic();

/**
 * Parses raw SQL and extracts structured metadata using Claude AI
 */
async function analyzeSql(sqlContent, filename = "unknown.sql") {
  const systemPrompt = `You are a senior data engineer specializing in Snowflake SQL documentation.
Analyze the provided SQL and extract structured metadata. Respond ONLY with valid JSON, no markdown, no preamble.

Return this exact structure:
{
  "tables": [
    {
      "name": "fully_qualified_table_name",
      "alias": "alias_if_used",
      "type": "source|target|cte|temp",
      "description": "inferred business purpose in plain English"
    }
  ],
  "columns": [
    {
      "name": "column_name",
      "source_table": "table_name_or_cte",
      "data_type": "inferred_type_or_unknown",
      "transformation": "description of any transformation applied, or 'direct' if none",
      "business_description": "plain English description of what this column represents",
      "nullable": true,
      "is_key": false
    }
  ],
  "ctes": [
    {
      "name": "cte_name",
      "purpose": "plain English description of what this CTE does",
      "depends_on": ["list", "of", "tables", "or", "ctes"]
    }
  ],
  "lineage": {
    "target_table": "final_output_table_or_null",
    "source_tables": ["list of source tables"],
    "transformation_summary": "2-3 sentence plain English summary of what this SQL does end to end"
  },
  "data_quality_notes": [
    "any notable joins, filters, deduplication, null handling or potential issues"
  ],
  "business_summary": "3-5 sentence plain English explanation of what this SQL does, written for a business analyst who doesn't know SQL",
  "complexity": "simple|moderate|complex",
  "estimated_grain": "description of the grain/granularity of the output"
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: `Analyze this SQL file (${filename}):\n\n${sqlContent}`,
      },
    ],
  });

  const text = response.content[0].text.trim();
  // Strip any accidental markdown fences
  const clean = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  return JSON.parse(clean);
}

/**
 * Generates full documentation object from SQL analysis
 */
async function generateDocumentation(files) {
  const results = [];

  for (const file of files) {
    console.error(`Analyzing: ${file.name}...`);
    const analysis = await analyzeSql(file.content, file.name);
    results.push({
      filename: file.name,
      analysis,
      generated_at: new Date().toISOString(),
    });
  }

  return results;
}

module.exports = { analyzeSql, generateDocumentation };
