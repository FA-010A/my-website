// firebase-app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getStorage, ref, listAll, getBlob } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

// Service Worker登録
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
// 設定
const CONFIG = {
  maxFileSize: 5 * 1024 * 1024,
  allowedFileTypes: ['.txt'],
  cacheExpiration: 5 * 60 * 1000
};

// グローバル変数
let firebaseConfig = null;
let storage = null;
const fileCache = new Map();

// 言語フォルダ設定
const folders = [
  { id: "fileList-html", path: "uploads/HTML" },
  { id: "fileList-css", path: "uploads/CSS" },
  { id: "fileList-js", path: "uploads/JavaScript" },
  { id: "fileList-java", path: "uploads/Java" },
  { id: "fileList-python", path: "uploads/Python" }
];

// XSS対策のためのサニタイズ関数
const sanitize = text => {
  const div = document.createElement('div'); // 一時的なDOM要素を作成
  div.textContent = text;                   // 入力文字列を「テキスト」として代入（ここで自動エスケープ）
  return div.innerHTML;                     // エスケープ後の文字列を返す
};

// ファイル名検証
function validateFileName(fileName) {
  // 危険な文字チェック
  const dangerousChars = /[<>:"/\\|?*\x00-\x1F]/;
  if (dangerousChars.test(fileName)) {
    throw new Error('不正なファイル名です');
  }
  
  // 拡張子チェック
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  if (!CONFIG.allowedFileTypes.includes(ext)) {
    throw new Error('許可されていないファイル形式です');
  }
  return true;
}

// Firebase設定読み込み
async function loadFirebaseConfig() {
  try {
    // 環境変数チェック
    if (typeof process !== 'undefined' && process.env) {
      firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        authDomain: process.env.FIREBASE_AUTH_DOMAIN,
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.FIREBASE_APP_ID,
        measurementId: process.env.FIREBASE_MEASUREMENT_ID,
      };
    } else {
      // 外部設定ファイル
      try {
        const response = await fetch('./firebase-config.json');
        if (response.ok) {
          firebaseConfig = await response.json();
        } else {
          throw new Error('設定ファイルが見つかりません');
        }
      } catch (fetchError) {
        // フォールバック設定
        firebaseConfig = {
          projectId: "my-website-2b713",
          storageBucket: "my-website-2b713.appspot.com",
          apiKey: "AIzaSyB-Wck9-5KQJLVfWWhE8yBdaW5Jl_3XWis"
        };
      }
    }
    
    // 必須項目チェック
    if (!firebaseConfig.projectId || !firebaseConfig.storageBucket) {
      throw new Error('必須の設定値が不足しています');
    }
  } catch (error) {
    console.error('Firebase設定の読み込みに失敗しました:', error);
    throw error;
  }
}

// Firebase初期化
async function initFirebase() {
  await loadFirebaseConfig();
  if (!firebaseConfig) {
    throw new Error('Firebase設定が読み込めませんでした');
  }
  const app = initializeApp(firebaseConfig);
  storage = getStorage(app);
  console.log('Firebase初期化完了');
}

// ファイル内容読み込み
async function loadFile(itemRef) {
  const filePath = itemRef.fullPath;
  // キャッシュチェック
  if (fileCache.has(filePath)) {
    const cached = fileCache.get(filePath);
    if (Date.now() - cached.timestamp < CONFIG.cacheExpiration) {
      return cached.content;
    }
  }
  // ファイル名検証
  validateFileName(itemRef.name);
  const blob = await getBlob(itemRef);
  if (blob.size > CONFIG.maxFileSize) {
    throw new Error('ファイルサイズが大きすぎます');
  }
  const content = await blob.text();
  // キャッシュ保存
  fileCache.set(filePath, {
    content: content,
    timestamp: Date.now()
  });
  return content;
}

// 事前キャッシュ
async function cacheFileContent(itemRef) {
  const filePath = itemRef.fullPath;
  // 既存キャッシュチェック
  if (fileCache.has(filePath)) {
    const cached = fileCache.get(filePath);
    if (Date.now() - cached.timestamp < CONFIG.cacheExpiration) {
      return;
    }
  }
  try {
    validateFileName(itemRef.name);
    const blob = await getBlob(itemRef);
    if (blob.size > CONFIG.maxFileSize) {
      console.warn(`ファイルサイズが大きすぎます: ${itemRef.name}`);
      return;
    }
    const text = await blob.text();
    fileCache.set(filePath, {
      content: text,
      timestamp: Date.now()
    });
    console.log(`キャッシュ保存: ${itemRef.name}`);
  } catch (error) {
    console.warn(`キャッシュ保存エラー (${itemRef.name}):`, error);
  }
}

// フォルダ全体を事前キャッシュ
async function cacheAllFilesInFolder(folder) {
  try {
    const listRef = ref(storage, folder);
    const res = await listAll(listRef);
    const cachePromises = res.items.map(itemRef => cacheFileContent(itemRef));
    await Promise.all(cachePromises);
    console.log(`${folder}: ${res.items.length}個のファイルをキャッシュしました`);
  } catch (error) {
    console.error(`フォルダキャッシュエラー (${folder}):`, error);
  }
}

// ファイルリスト作成
function createFileItem(itemRef, container) {
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.href = '#';
  a.textContent = sanitize(itemRef.name);
  a.onclick = async (e) => {
    e.preventDefault();
    const contentEl = document.getElementById('file-content');
    contentEl.textContent = '読み込み中...';
    try {
      const content = await loadFile(itemRef);
      contentEl.textContent = content;
    } catch (error) {
      contentEl.textContent = `エラー: ${error.message}`;
    }
  };
  
  li.appendChild(a);
  container.appendChild(li);
}

// フォルダのファイル一覧取得
async function loadFolder(config) {
  const container = document.getElementById(config.id);
  if (!container) {
    console.error(`要素が見つかりません: ${config.id}`);
    return;
  }
  try {
    const listRef = ref(storage, config.path);
    const result = await listAll(listRef);
    container.innerHTML = '';
    if (result.items.length === 0) {
      container.innerHTML = '<li>ファイルが見つかりません</li>';
      return;
    }
    result.items.forEach(itemRef => {
      try {
        validateFileName(itemRef.name);
        createFileItem(itemRef, container);
      } catch (error) {
        console.warn(`スキップされたファイル: ${itemRef.name}`, error);
      }
    });
    console.log(`${config.path}: ${result.items.length}個のファイルを読み込みました`);
  } catch (error) {
    console.error(`フォルダ読み込みエラー (${config.path}):`, error);
    container.innerHTML = `<li>エラー: ${sanitize(error.message)}</li>`;
  }
}

// ローカルファイル読み込み
async function loadLocalFiles() {
  //ローカルで作成しているファイル読み込み
  const files = [
    { name: 'memo.txt', elementId: 'memo-content' },
    { name: '注意事項.txt', elementId: 'notice-content' }
  ];
  for (const file of files) {
    try {
      const response = await fetch(file.name);
      if (!response.ok) {
        throw new Error(`ファイルが見つかりません: ${file.name}`);
      }
      const content = await response.text();
      const element = document.getElementById(file.elementId);
      if (element) {
        element.innerHTML = `<pre>${content}</pre>`;
      }
    } catch (error) {
      console.error(`ローカルファイル読み込みエラー: ${file.name}`, error);
    }
  }
}
//メイン処理で発生するステータスの更新を行う
function updateStatus(message, isComplete = false) {
  const statusEl = document.getElementById('initialization-status');
  if (statusEl) {
    statusEl.textContent = message;
    if (isComplete) {// 完了した場合メッセージは2秒後に非表示
      setTimeout(() => statusEl.style.display = 'none', 2000);
    }
  }
}
// メイン処理
async function main() {
  try {
    updateStatus('Firebase初期化中...');
    await initFirebase();
    
    updateStatus('ローカルファイルを読み込み中...');
    await loadLocalFiles();
    
    updateStatus('ファイル一覧を読み込み中...');
    await Promise.all(folders.map(loadFolder));
    
    updateStatus('ファイルをキャッシュに保存中...');
    const cachePromises = folders.map(config => cacheAllFilesInFolder(config.path));
    await Promise.all(cachePromises);
    
    updateStatus('初期化完了！', true);
  } catch (error) {
    console.error('アプリケーション初期化エラー:', error);
    updateStatus(`初期化エラー: ${error.message}`);
  }
}

// 実行
main();