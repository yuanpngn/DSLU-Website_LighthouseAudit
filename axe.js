const puppeteer = require("puppeteer");
const fs = require("fs");

const urls = [
  "https://www.dlsu.edu.ph/",
  "https://www.dlsu.edu.ph/academics/",
  "https://www.dlsu.edu.ph/admission/landing/",
  "https://www.dlsu.edu.ph/research-overview/overview/",
  "https://www.dlsu.edu.ph/global/international-students/",
  "https://www.dlsu.edu.ph/about/",
  "https://www.dlsu.edu.ph/campus-life-landing/",
  "https://old.dlsu.edu.ph/offices/registrar/academic-calendar/",
  "https://www.dlsu.edu.ph/program/",
  "https://old.dlsu.edu.ph/offices/osa/",
  "https://old.dlsu.edu.ph/faculty/",
  "https://old.dlsu.edu.ph/give/",
  "https://applyarchershub.dlsu.edu.ph/ApplicationLandingPage/index/DLSU"
];

// WCAG mapping
function mapWCAG(tags = []) {
  const t = tags.join(" ").toLowerCase();

  if (t.includes("color-contrast")) return "1.4.3 / 1.4.11";
  if (t.includes("image") || t.includes("alt")) return "1.1.1";
  if (t.includes("label") || t.includes("form")) return "3.3.2";
  if (t.includes("aria")) return "4.1.2";
  if (t.includes("heading")) return "1.3.1";
  if (t.includes("link")) return "2.4.4";

  return "Needs Manual Mapping";
}

// Category grouping
function getCategory(tags = []) {
  const t = tags.join(" ").toLowerCase();

  if (t.includes("color")) return "Visual Contrast";
  if (t.includes("image") || t.includes("alt")) return "Images";
  if (t.includes("label") || t.includes("form")) return "Forms";
  if (t.includes("link")) return "Links";
  if (t.includes("heading") || t.includes("structure")) return "Structure";
  if (t.includes("aria")) return "ARIA";

  return "Other";
}

// Severity normalization
function getSeverity(impact) {
  if (impact === "critical") return "High";
  if (impact === "serious") return "High";
  if (impact === "moderate") return "Medium";
  return "Low";
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  let rows = [];

  for (const url of urls) {
    console.log("Running axe on:", url);

    const page = await browser.newPage();

    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60000
      });

      // Inject axe-core into page
      await page.addScriptTag({
        url: "https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.9.1/axe.min.js"
      });

      // Run axe inside browser context
      const results = await page.evaluate(async () => {
        return await axe.run(document, {
          resultTypes: ["violations"]
        });
      });

      const violations = results.violations;

      for (const v of violations) {
        for (const node of v.nodes) {
          rows.push({
            url,
            tool: "axe",
            audit_id: v.id,
            title: v.help,
            description: v.description,
            wcag: mapWCAG(v.tags),
            category: getCategory(v.tags),
            severity: getSeverity(v.impact),
            impact: v.impact || "unknown",
            help_url: v.helpUrl,
            element: node.html,
            selector: (node.target || []).join(" "),
            failure_summary: node.failureSummary || "",
          });
        }
      }

    } catch (err) {
      console.error("Error on:", url, err.message);
    }

    await page.close();
  }

  await browser.close();

  // CSV export
  if (rows.length === 0) {
    console.log("No issues found.");
    return;
  }

  const headers = Object.keys(rows[0]).join(",");

  const csv = [
    headers,
    ...rows.map(r =>
      Object.values(r)
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    )
  ].join("\n");

  fs.writeFileSync("axe-wcag-report.csv", csv);

  console.log("Done → axe-wcag-report.csv generated");
})();