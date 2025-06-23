// app.js

// Service Worker登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.error('SW registration failed:', err));
  });
}

// ここからモジュールとしてimport可能にする場合
// import { loadFile, loadTextFile } from './fileLoader.js';
// import { listTxtFilesInDirectory } from './listFiles.js';

// 画面描画（例として非モジュールで書くなら下記のように書く）
// もしモジュールを使いたいなら、ちゃんとサーバー立ててimportすること

window.addEventListener("DOMContentLoaded", async () => {
  // 例: ファイル一覧表示領域とファイル内容表示領域を取得
  const fileListContainer = document.getElementById("file-list");
  const contentDisplay = document.getElementById("file-content");

  // ファイル一覧取得関数の呼び出し例（モジュール内のlistTxtFilesInDirectoryを使うならコメント解除）
  /*
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
  */
});