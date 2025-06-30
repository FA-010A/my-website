//app.js

// Service Worker登録
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.error('SW registration failed:', err));
  });
}

window.addEventListener("DOMContentLoaded", async () => {
  const fileContentElem = document.getElementById("file-content");

  // Firebase 初期化
  const firebaseConfig = {
    apiKey: "AIzaSyB-Wck9-5KQJLVfWWhE8yBdaW5Jl_3XWis",
    authDomain: "my-website-2b713.firebaseapp.com",
    projectId: "my-website-2b713",
    storageBucket: "my-website-2b713.firebasestorage.app",
    messagingSenderId: "474696820051",
    appId: "1:474696820051:web:7cba8563bb4b025af7eda6",
    measurementId: "G-52N4LS8E57",
  };

  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js");
  const { getStorage, ref, listAll, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js");

  const app = initializeApp(firebaseConfig);
  const storage = getStorage(app);

  // 言語ごとのフォルダと UL の対応
  const langs = [
    { id: "fileList-html", folder: "uploads/HTML" },
    { id: "fileList-css", folder: "uploads/CSS" },
    { id: "fileList-js", folder: "uploads/JavaScript" },
    { id: "fileList-java", folder: "uploads/Java" },
    { id: "fileList-python", folder: "uploads/Python" },
  ];

  const cachedFiles = {}; // キャッシュ保存用

  async function cacheFileContent(itemRef) {
    const fullPath = itemRef.fullPath;
    try {
      const url = await getDownloadURL(itemRef);
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error("ファイル取得失敗");
      const text = await response.text();
      cachedFiles[fullPath] = text;
    } catch (err) {
      console.error("読み込み失敗:", err);
      cachedFiles[fullPath] = "読み込みに失敗しました";
    }
  }

  function displayFileLink(itemRef, listElement) {
    const fullPath = itemRef.fullPath;
    const a = document.createElement("a");
    a.href = "#";
    a.textContent = itemRef.name;
    a.style.cursor = "pointer";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const content = cachedFiles[fullPath];
      fileContentElem.textContent = content || "キャッシュに存在しません";
    });

    listElement.appendChild(a);
    listElement.appendChild(document.createElement("br"));
  }

  langs.forEach(({ id, folder }) => {
    const listElement = document.getElementById(id);
    listElement.textContent = "";
    const listRef = ref(storage, folder);

    listAll(listRef)
      .then((res) => {
        if (res.items.length === 0) {
          listElement.textContent = "ファイルが見つかりません";
          return;
        }

        res.items.forEach(async (itemRef) => {
          await cacheFileContent(itemRef);       // ① 起動時にキャッシュ
          displayFileLink(itemRef, listElement); // ② クリックリンク表示
        });
      })
      .catch((error) => {
        listElement.textContent = "エラー: " + error.message;
        console.error(error);
      });
  });
});