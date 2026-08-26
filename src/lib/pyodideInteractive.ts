/**
 * Execution reelle de Python dans le navigateur via Pyodide (WASM), pour le
 * bloc "algo_sandbox". Chargement paresseux : le runtime (~10 Mo) n'est
 * telecharge qu'au premier clic sur "Executer", jamais au chargement de la
 * page. Une seule instance Pyodide est partagee entre tous les blocs de la
 * page (cout de demarrage eleve, ~1-3s).
 */

declare global {
  interface Window {
    loadPyodide?: (opts?: { indexURL?: string }) => Promise<PyodideInterface>;
  }
}

type PyodideInterface = {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (options: { batched: (msg: string) => void }) => void;
  setStderr: (options: { batched: (msg: string) => void }) => void;
};

const PYODIDE_VERSION = "0.26.4";
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

let pyodidePromise: Promise<PyodideInterface> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossible de charger Pyodide."));
    document.head.appendChild(script);
  });
}

async function getPyodide(): Promise<PyodideInterface> {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      await loadScript(`${PYODIDE_CDN}pyodide.js`);
      if (!window.loadPyodide) throw new Error("Pyodide indisponible après chargement du script.");
      return window.loadPyodide({ indexURL: PYODIDE_CDN });
    })();
  }
  return pyodidePromise;
}

function wireAlgoSandbox(figure: HTMLElement) {
  const button = figure.querySelector<HTMLButtonElement>(".algo-sandbox-run");
  const textarea = figure.querySelector<HTMLTextAreaElement>(".algo-sandbox-code");
  const output = figure.querySelector<HTMLElement>(".algo-sandbox-output");
  if (!button || !textarea || !output || button.dataset.wired) return;
  button.dataset.wired = "1";

  button.addEventListener("click", async () => {
    output.hidden = false;
    output.textContent = "Chargement de Python (première fois seulement)...";
    button.disabled = true;
    try {
      const pyodide = await getPyodide();
      const lines: string[] = [];
      pyodide.setStdout({ batched: (msg) => lines.push(msg) });
      pyodide.setStderr({ batched: (msg) => lines.push(msg) });
      output.textContent = "Exécution...";
      try {
        const result = await pyodide.runPythonAsync(textarea.value);
        if (result !== undefined && result !== null && lines.length === 0) {
          lines.push(String(result));
        }
        output.textContent = lines.length ? lines.join("\n") : "(aucune sortie)";
        output.classList.remove("algo-sandbox-output-error");
      } catch (err) {
        output.textContent = (lines.length ? lines.join("\n") + "\n" : "") + String(err);
        output.classList.add("algo-sandbox-output-error");
      }
    } catch (err) {
      output.textContent = `Erreur de chargement : ${err instanceof Error ? err.message : String(err)}`;
      output.classList.add("algo-sandbox-output-error");
    } finally {
      button.disabled = false;
    }
  });
}

export function enhanceAlgoSandboxes(root: ParentNode | null | undefined) {
  if (!root || typeof window === "undefined") return;
  root.querySelectorAll<HTMLElement>(".course-figure-algo-sandbox").forEach(wireAlgoSandbox);
}
