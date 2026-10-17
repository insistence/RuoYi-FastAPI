import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";

// Vite emits same-origin worker files, without inline scripts or a CDN.
globalThis.MonacoEnvironment = {
  globalAPI: false,
  getWorker(_moduleId, label) {
    return label === "json" ? new JsonWorker() : new EditorWorker();
  },
};
