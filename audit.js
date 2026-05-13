const lighthousePkg = require("lighthouse");
const lighthouse = lighthousePkg.default || lighthousePkg;

const chromeLauncher = require("chrome-launcher");
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

// Map Lighthouse audit → WCAG
function mapWCAG(id) {
  if (!id) return "Unknown";

  if (id.includes("image-alt")) return "1.1.1";
  if (id.includes("color-contrast")) return "1.4.3 / 1.4.11";
  if (id.includes("link-name")) return "2.4.4";
  if (id.includes("label")) return "3.3.2";
  if (id.includes("aria")) return "4.1.2";
  if (id.includes("heading")) return "1.3.1";

  return "Needs Manual Mapping";
}

// Category grouping
function getCategory(id) {
  if (!id) return "Unknown";

  if (id.includes("image")) return "Images";
  if (id.includes("color")) return "Visual Contrast";
  if (id.includes("label") || id.includes("form")) return "Forms";
  if (id.includes("link")) return "Links";
  if (id.includes("heading") || id.includes("table")) return "Structure";
  if (id.includes("aria")) return "ARIA";

  return "Other";
}

// Severity
function getSeverity(score) {
  if (score === 0) return "High";
  if (score === 0.5) return "Medium";
  return "Low";
}

(async () => {
  const chrome = await chromeLauncher.launch({
    chromeFlags: ["--headless", "--no-sandbox"]
  });

  let rows = [];

  for (const url of urls) {
    console.log("Auditing:", url);

    const runnerResult = await lighthouse(url, {
      port: chrome.port,
      onlyCategories: ["accessibility"]
    });

    const lhr = runnerResult.lhr;
    const audits = lhr.audits;

    const failedAudits = Object.values(audits)
      .filter(a => a.score !== null && a.score < 1);

    for (const a of failedAudits) {
      rows.push({
        url,
        score: (lhr.categories.accessibility.score * 100).toFixed(1),
        audit_id: a.id,
        title: a.title,
        description: (a.description || "").replace(/(\r\n|\n|\r)/gm, " "),
        wcag: mapWCAG(a.id),
        category: getCategory(a.id),
        severity: getSeverity(a.score),
        evidence: "Fail",
        raw_score: a.score
      });
    }
  }

  await chrome.kill();

  // Convert to CSV
  const headers = Object.keys(rows[0]).join(",");

  const csv = [
    headers,
    ...rows.map(r =>
      Object.values(r)
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    )
  ].join("\n");

  fs.writeFileSync("lighthouse-wcag-report.csv", csv);

  console.log("Done → lighthouse-wcag-report.csv generated");
})();