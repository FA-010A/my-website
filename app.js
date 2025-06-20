// app.js

// Service Worker 登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.error('SW registration failed:', err));
  });
}

// Firebase 関連インポート
import { loadFile } from "./fileLoader.js";
import { listTxtFilesInDirectory } from "./listFiles.js";
import { loadTextFile } from "./fileLoader.js";

// 画面描画
window.addEventListener("DOMContentLoaded", async () => {
  const fileUrl = await loadFile("uploads/");

  // 画像・PDF等のプレビュー表示
  if (fileUrl) {
    const preview = document.getElementById("preview");
    preview.src = fileUrl;
  } else {
    alert("ファイルの読み込みに失敗しました");
  }

  // 【⑤】テキストファイル一覧＋内容表示
  const fileListContainer = document.getElementById("file-list");
  const contentDisplay = document.getElementById("file-content");

  try {
    const txtFiles = await listTxtFilesInDirectory("uploads/");

    if (txtFiles.length === 0) {
      fileListContainer.innerHTML = "<li>テキストファイルが見つかりません</li>";
      return;
    }

    txtFiles.forEach(file => {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = "#";
      link.textContent = file.name;
      link.addEventListener("click", async (e) => {
        e.preventDefault();
        contentDisplay.textContent = "読み込み中...";
        const content = await loadTextFile(file.fullPath);
        contentDisplay.textContent = content || "読み込みに失敗しました";
      });
      li.appendChild(link);
      fileListContainer.appendChild(li);
    });

  } catch (err) {
    console.error("一覧取得エラー:", err);
    fileListContainer.innerHTML = "<li>一覧取得に失敗しました</li>";
  }
});