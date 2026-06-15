const snowflake = require("snowflake-sdk");

/**
 * Creates a Snowflake connection from credentials
 */
function createConnection(credentials) {
  return snowflake.createConnection({
    account: credentials.account,
    username: credentials.username,
    password: credentials.password,
    database: credentials.database,
    schema: credentials.schema,
    warehouse: credentials.warehouse,
    role: credentials.role,
  });
}

/**
 * Promisified query execution
 */
function executeQuery(conn, sql) {
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText: sql,
      complete: (err, stmt, rows) => {
        if (err) reject(err);
        else resolve(rows);
      },
    });
  });
}

/**
 * Promisified connection
 */
function connect(conn) {
  return new Promise((resolve, reject) => {
    conn.connect((err, c) => {
      if (err) reject(err);
      else resolve(c);
    });
  });
}

/**
 * Extract full schema metadata from Snowflake
 */
async function extractSnowflakeSchema(credentials, tableFilter = null) {
  const conn = createConnection(credentials);
  await connect(conn);

  try {
    // Get all tables in the schema
    let tableQuery = `
      SELECT 
        TABLE_CATALOG, TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE, 
        ROW_COUNT, BYTES, COMMENT, CREATED, LAST_ALTERED
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = '${credentials.schema}'
    `;
    if (tableFilter) {
      tableQuery += ` AND TABLE_NAME ILIKE '%${tableFilter}%'`;
    }
    tableQuery += " ORDER BY TABLE_NAME";

    const tables = await executeQuery(conn, tableQuery);

    // Get all columns for those tables
    const columnQuery = `
      SELECT 
        TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION, 
        DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COMMENT,
        CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${credentials.schema}'
      ORDER BY TABLE_NAME, ORDINAL_POSITION
    `;
    const columns = await executeQuery(conn, columnQuery);

    // Group columns by table
    const columnsByTable = {};
    for (const col of columns) {
      if (!columnsByTable[col.TABLE_NAME]) {
        columnsByTable[col.TABLE_NAME] = [];
      }
      columnsByTable[col.TABLE_NAME].push(col);
    }

    // Build structured schema
    const schema = tables.map((table) => ({
      database: table.TABLE_CATALOG,
      schema: table.TABLE_SCHEMA,
      name: table.TABLE_NAME,
      type: table.TABLE_TYPE,
      row_count: table.ROW_COUNT,
      size_bytes: table.BYTES,
      comment: table.COMMENT,
      created: table.CREATED,
      last_altered: table.LAST_ALTERED,
      columns: (columnsByTable[table.TABLE_NAME] || []).map((col) => ({
        name: col.COLUMN_NAME,
        position: col.ORDINAL_POSITION,
        data_type: col.DATA_TYPE,
        nullable: col.IS_NULLABLE === "YES",
        default: col.COLUMN_DEFAULT,
        comment: col.COMMENT,
        max_length: col.CHARACTER_MAXIMUM_LENGTH,
        precision: col.NUMERIC_PRECISION,
        scale: col.NUMERIC_SCALE,
      })),
    }));

    return schema;
  } finally {
    conn.destroy((err) => {
      if (err) console.error("Error destroying connection:", err);
    });
  }
}

/**
 * Convert live Snowflake schema into file-like objects for the doc generator
 */
function schemaToSqlFiles(schema) {
  return schema.map((table) => {
    const cols = table.columns
      .map(
        (c) =>
          `  ${c.name} ${c.data_type}${c.nullable ? "" : " NOT NULL"}${c.comment ? ` -- ${c.comment}` : ""}`
      )
      .join(",\n");

    const sql = `-- Table: ${table.database}.${table.schema}.${table.name}
-- Type: ${table.type}
-- Rows: ${table.row_count || "unknown"}
-- Last Modified: ${table.last_altered || "unknown"}
${table.comment ? `-- Description: ${table.comment}` : ""}

CREATE OR REPLACE TABLE ${table.database}.${table.schema}.${table.name} (
${cols}
);`;

    return {
      name: `${table.name}.sql`,
      content: sql,
      metadata: table,
    };
  });
}

module.exports = { extractSnowflakeSchema, schemaToSqlFiles };
