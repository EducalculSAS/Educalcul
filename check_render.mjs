import { repairLatex, normalizeSvgArrowMarkers, renderMathAsPlainTextInSvg, stripFigureNumberPrefix } from "/Users/ruben/Educalcul/src/lib/latexRepair.ts";
import katex from "katex";
import fs from "fs";

function safeRenderMath(math, displayMode) {
  const trimmed = math.trim();
  try { return katex.renderToString(trimmed, { displayMode, throwOnError: true, strict: false }); }
  catch {
    const cleaned = trimmed.replace(/<[^>]*>/g, "").trim();
    try { return katex.renderToString(cleaned, { displayMode, throwOnError: true, strict: false }); }
    catch { return `<span>${cleaned}</span>`; }
  }
}
function renderLatexInHTML(html) {
  if (!html) return html;
  let result = stripFigureNumberPrefix(repairLatex(html));
  result = result.replace(/<svg[\s\S]*?<\/svg>/g, (svgBlock) => normalizeSvgArrowMarkers(renderMathAsPlainTextInSvg(svgBlock)));
  result = result.replace(/\$\$([^<>]*?)\$\$/g, (m, math) => (math.trim() ? safeRenderMath(math, true) : m));
  result = result.replace(/\$([^$<>\r\n]+?)\$/g, (m, math) => (math.trim() ? safeRenderMath(math, false) : m));
  result = result.replace(/\\\(([^<>]+?)\\\)/g, (m, math) => safeRenderMath(math, false));
  result = result.replace(/\\\[([^<>]+?)\\\]/g, (m, math) => safeRenderMath(math, true));
  return result.replace(/\$\$/g, "");
}

const data = JSON.parse(fs.readFileSync("/Users/ruben/Downloads/course_le_produit_scalaire_dans_le_plan___d_finitions__propri_t_s_et_applications_1785075372683.json", "utf8"));

let html = "";
for (const ch of data.content_json) {
  for (const lesson of ch.lessons) {
    if (lesson.content.includes("<figure")) {
      html += `<h2>${lesson.title}</h2>` + renderLatexInHTML(lesson.content);
    }
  }
}

const page = `<!DOCTYPE html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<style>
body { font-family: system-ui, sans-serif; max-width: 700px; margin: 40px auto; color: #1a1a2e; background: #fff; }
.prose { counter-reset: educalcul-figure; }
.course-figure { counter-increment: educalcul-figure; margin: 1.5rem 0; text-align: center; }
.course-figure svg { max-width: min(100%, 22rem); max-height: 18rem; }
.course-figure figcaption { font-size: 0.85rem; color: #444; margin-top: 0.4rem; }
.course-figure figcaption::before { content: "Figure " counter(educalcul-figure) " — "; font-weight: 600; color: #2b6cb0; }
</style></head><body><div class="prose">${html}</div></body></html>`;
fs.writeFileSync("public/_test_figures_check.html", page);
console.log("written");
