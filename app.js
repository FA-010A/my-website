if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.error('SW registration failed:', err));
  });
}
import { loadFile } from "./fileLoader.js";

window.addEventListener("DOMContentLoaded", async () => {
  const fileUrl = await loadFile("docs/sample.pdf"); // Storage 上のパス
  if (fileUrl) {
    const preview = document.getElementById("preview");
    preview.src = fileUrl;
  } else {
    alert("ファイルの読み込みに失敗しました");
  }
});