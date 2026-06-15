const fs = require("fs");
const path = require("path");
const { generateDocumentation } = require("./src/doc-generator");
const { renderMarkdown } = require("./src/formatters/markdown");
const { renderDocx } = require("./src/formatters/docx");

async function test() {
  console.log("🔍 Reading sample SQL...");
  const sql = fs.readFileSync(path.join(__dirname, "examples/fact_orders.sql"), "utf8");

  const files = [{ name: "fact_orders.sql", content: sql }];

  console.log("🤖 Analyzing SQL with Claude...");
  const docResults = await generateDocumentation(files);

  console.log("📝 Rendering Markdown...");
  const markdown = renderMarkdown(docResults);
  fs.writeFileSync(path.join(__dirname, "outputs/fact_orders_docs.md"), markdown);
  console.log("✅ Markdown saved: outputs/fact_orders_docs.md");

  console.log("📄 Rendering Word document...");
  const docxBuffer = await renderDocx(docResults);
  fs.writeFileSync(path.join(__dirname, "outputs/fact_orders_docs.docx"), docxBuffer);
  console.log("✅ Word doc saved: outputs/fact_orders_docs.docx");

  console.log("\n🎉 Done! Both outputs generated.");
  console.log("\n--- MARKDOWN PREVIEW (first 50 lines) ---");
  console.log(markdown.split("\n").slice(0, 50).join("\n"));
}

test().catch(console.error);
