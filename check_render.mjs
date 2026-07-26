import fs from "node:fs";
import path from "node:path";
import katex from "katex";
import {
  repairLatex,
  stripFigureNumberPrefix,
  renderMathAsPlainTextInSvg,
  normalizeSvgArrowMarkers,
  mathToReadableText,
} from "./src/lib/latexRepair.ts";

const inputArg = process.argv[2];
const outputArg = process.argv[3] || "public/_test_course_render.html";

if (!inputArg) {
  console.error(
    "Usage : node --experimental-strip-types check_render.mjs <cours.json> [sortie.html]",
  );
  process.exit(1);
}

const inputPath = path.resolve(inputArg);
const outputPath = path.resolve(outputArg);
const reportPath = outputPath.replace(/\.html?$/i, ".report.json");

const course = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const katexErrors = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function safeRenderMath(math, displayMode, context) {
  const source = String(math ?? "").trim();

  const render = (value) =>
    katex.renderToString(value, {
      displayMode,
      throwOnError: true,
      strict: false,
    });

  try {
    return render(source);
  } catch (firstError) {
    const cleaned = source.replace(/<[^>]*>/g, "").trim();

    if (cleaned && cleaned !== source) {
      try {
        return render(cleaned);
      } catch (secondError) {
        katexErrors.push({
          context,
          source,
          cleaned,
          error: String(secondError?.message || secondError),
        });
      }
    } else {
      katexErrors.push({
        context,
        source,
        cleaned,
        error: String(firstError?.message || firstError),
      });
    }

    const readable =
      mathToReadableText(cleaned || source) || "Formule illisible";

    const escaped = escapeHtml(readable);

    return displayMode
      ? `<div class="katex-fallback katex-fallback-display">${escaped}</div>`
      : `<span class="katex-fallback">${escaped}</span>`;
  }
}

function renderLatexInHTML(html, context) {
  if (!html) return "";

  let result = stripFigureNumberPrefix(repairLatex(String(html)));

  result = result.replace(/<svg[\s\S]*?<\/svg>/g, (svg) =>
    normalizeSvgArrowMarkers(renderMathAsPlainTextInSvg(svg)),
  );

  result = result.replace(/\$\$([^<>]*?)\$\$/g, (match, math) =>
    math.trim() ? safeRenderMath(math, true, context) : match,
  );

  result = result.replace(/\$([^$<>\r\n]+?)\$/g, (match, math) =>
    math.trim() ? safeRenderMath(math, false, context) : match,
  );

  result = result.replace(/\\\(([^<>]+?)\\\)/g, (_match, math) =>
    safeRenderMath(math, false, context),
  );

  result = result.replace(/\\\[([^<>]+?)\\\]/g, (_match, math) =>
    safeRenderMath(math, true, context),
  );

  return result.replace(/\$\$/g, "");
}

const chapters = Array.isArray(course.content_json) ? course.content_json : [];

let lessonsHtml = "";
let lessonCount = 0;
let exerciseCount = 0;

chapters.forEach((chapter, chapterIndex) => {
  lessonsHtml += `
    <section class="chapter">
      <h1>
        Chapitre ${chapterIndex + 1} —
        ${escapeHtml(chapter.title || "Sans titre")}
      </h1>
  `;

  const lessons = Array.isArray(chapter.lessons) ? chapter.lessons : [];

  lessons.forEach((lesson, lessonIndex) => {
    lessonCount += 1;

    const base =
      `${chapterIndex + 1}.${lessonIndex + 1} ` + `${lesson.title || "Leçon"}`;

    lessonsHtml += `
      <article class="lesson">
        <div class="lesson-number">
          ${chapterIndex + 1}.${lessonIndex + 1}
        </div>

        <h2>${escapeHtml(lesson.title || "Sans titre")}</h2>

        <div class="lesson-content">
          ${renderLatexInHTML(lesson.content || "", `${base} / content`)}
        </div>
    `;

    const exercises = Array.isArray(lesson.exercises) ? lesson.exercises : [];

    if (exercises.length > 0) {
      lessonsHtml += `
        <section class="exercise-list">
          <h3>Exercices et corrections</h3>
      `;

      exercises.forEach((exercise, exerciseIndex) => {
        exerciseCount += 1;

        const exBase =
          `${base} / ` + `${exercise.id || `ex-${exerciseIndex + 1}`}`;

        lessonsHtml += `
          <article class="exercise-card">
            <div class="exercise-title">
              Exercice ${exerciseIndex + 1}
            </div>

            <div class="exercise-question">
              ${renderLatexInHTML(
                exercise.question || "",
                `${exBase} / question`,
              )}
            </div>
        `;

        if (exercise.hint) {
          lessonsHtml += `
            <details>
              <summary>Indice</summary>
              <div>
                ${renderLatexInHTML(exercise.hint, `${exBase} / hint`)}
              </div>
            </details>
          `;
        }

        if (exercise.answer) {
          lessonsHtml += `
            <div class="exercise-answer">
              <strong>Réponse :</strong>
              ${renderLatexInHTML(exercise.answer, `${exBase} / answer`)}
            </div>
          `;
        }

        if (exercise.explanation) {
          lessonsHtml += `
            <div class="exercise-explanation">
              <strong>Explication :</strong>
              ${renderLatexInHTML(
                exercise.explanation,
                `${exBase} / explanation`,
              )}
            </div>
          `;
        }

        lessonsHtml += `</article>`;
      });

      lessonsHtml += `</section>`;
    }

    lessonsHtml += `</article>`;
  });

  lessonsHtml += `</section>`;
});

const katexCssPath = path.resolve("node_modules/katex/dist/katex.min.css");

const katexCss = fs.existsSync(katexCssPath)
  ? fs
      .readFileSync(katexCssPath, "utf8")
      // Certaines distributions embarquent une feuille KaTeX préfixée
      // par un conteneur. Le rapport local doit rester autonome.
      .replace(/\.gradio-container-[A-Za-z0-9_-]+ /g, "")
  : "";

const page = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>
  Contrôle de rendu —
  ${escapeHtml(course.title || path.basename(inputPath))}
</title>

<style>
${katexCss}

* {
  box-sizing: border-box;
}

html,
body {
  max-width: 100%;
  overflow-x: hidden;
}

body {
  margin: 0;
  background: #f3f6fa;
  color: #15223b;
  font-family:
    Inter,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
  line-height: 1.65;
}

.shell {
  width: min(1120px, calc(100% - 32px));
  margin: 24px auto;
}

.header,
.chapter {
  background: #fff;
  border: 1px solid #dce4ee;
  border-radius: 18px;
  padding: 28px;
  box-shadow: 0 8px 28px rgba(15, 30, 58, 0.06);
  margin-bottom: 24px;
}

.header h1,
.chapter > h1 {
  font-family: Georgia, "Times New Roman", serif;
  color: #10213d;
}

.lesson {
  padding: 28px 0;
  border-top: 1px solid #e7edf4;
}

.lesson:first-of-type {
  border-top: 0;
}

.lesson-number {
  color: #8a6a28;
  font-weight: 700;
}

.lesson h2,
.lesson-content h3,
.lesson-content h4 {
  font-family: Georgia, "Times New Roman", serif;
  color: #10213d;
}

.lesson-content p {
  margin: 0.85rem 0;
}

.lesson-content blockquote,
.course-callout {
  border-left: 4px solid #102b57;
  background: #eef5ff;
  border-radius: 10px;
  padding: 14px 18px;
  margin: 18px 0;
}

.course-callout-warning {
  border-left-color: #f59e0b;
  background: #fff8df;
}

.katex-display {
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 4px 0;
}

.math-table {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}

.math-table th,
.math-table td {
  border: 1px solid #d7c288;
  padding: 8px 12px;
}

.course-figure {
  text-align: center;
  margin: 24px auto;
}

.course-figure svg {
  max-width: min(100%, 360px);
  height: auto;
}

.exercise-list {
  border-top: 2px solid #e2e8f0;
  margin-top: 34px;
  padding-top: 24px;
}

.exercise-card {
  background: #f9fbfd;
  border: 1px solid #dce4ee;
  border-radius: 14px;
  padding: 18px;
  margin: 14px 0;
  min-width: 0;
}

.exercise-title {
  font-weight: 800;
  margin-bottom: 8px;
}

.exercise-answer,
.exercise-explanation {
  border-top: 1px dashed #d8e0ea;
  margin-top: 12px;
  padding-top: 10px;
}

.katex-fallback {
  font-family: Georgia, "Times New Roman", serif;
}

.katex-fallback-display {
  display: block;
  overflow-x: auto;
  text-align: center;
  white-space: pre-wrap;
  margin: 1rem 0;
}

pre {
  max-width: 100%;
  overflow-x: auto;
  background: #0f1e3a;
  color: #fff;
  padding: 14px;
  border-radius: 10px;
}

@media (max-width: 640px) {
  .shell {
    width: min(100% - 16px, 1120px);
    margin: 8px auto;
  }

  .header,
  .chapter {
    padding: 16px;
    border-radius: 12px;
  }

  .lesson {
    padding: 20px 0;
  }

  .exercise-card {
    padding: 14px;
  }
}
</style>
</head>

<body>
  <main class="shell">
    <header class="header">
      <h1>${escapeHtml(course.title || "Cours")}</h1>

      <p>${escapeHtml(course.description || "")}</p>

      <p>
        <strong>${lessonCount}</strong> leçons ·
        <strong>${exerciseCount}</strong> exercices ·
        <strong>${katexErrors.length}</strong>
        erreur(s) KaTeX après réparation
      </p>
    </header>

    ${lessonsHtml}
  </main>
</body>
</html>`;

fs.mkdirSync(path.dirname(outputPath), {
  recursive: true,
});

fs.writeFileSync(outputPath, page);

fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      input: inputPath,
      output: outputPath,
      lessons: lessonCount,
      exercises: exerciseCount,
      katexErrors,
    },
    null,
    2,
  ),
);

console.log(`Rendu écrit : ${outputPath}`);
console.log(`Rapport écrit : ${reportPath}`);

console.log(
  `Leçons : ${lessonCount} — ` +
    `exercices : ${exerciseCount} — ` +
    `erreurs KaTeX : ${katexErrors.length}`,
);

if (katexErrors.length > 0) {
  process.exitCode = 2;
}
