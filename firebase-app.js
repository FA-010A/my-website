// firebase-app.js
// Firebase SDK（アプリ、ストレージ）をインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getStorage,
  ref,
  listAll,
  getDownloadURL,
  getBlob,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
// セキュリティ設定
const SECURITY_CONFIG = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  allowedFileTypes: ['.txt', '.md', '.html', '.css', '.js', '.java', '.py'],
  rateLimitRequests: 100, // 1分間の最大リクエスト数
  cacheExpiration: 5 * 60 * 1000, // 5分
};

// レート制限用
const rateLimiter = {
  requests: new Map(),
  isAllowed(key) {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    // 1分以内のリクエストをフィルタ
    const recentRequests = requests.filter(time => now - time < 60000);
    
    if (recentRequests.length >= SECURITY_CONFIG.rateLimitRequests) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    return true;
  }
};

// 🔒 セキュリティ改善: 設定を環境変数や外部ファイルから読み込む
let firebaseConfig = null;
let storage = null;
let fileCache = new Map(); // ファイルキャッシュ用

// 入力値のサニタイズ（ファイル名、エラーメッセージ等の表示用）
function sanitizeText(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ファイル名の検証
function validateFileName(fileName) {
  // 危険な文字をチェック
  const dangerousChars = /[<>:"/\\|?*\x00-\x1F]/;
  if (dangerousChars.test(fileName)) {
    throw new Error('不正なファイル名です');
  }
  
  // 許可された拡張子をチェック
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  if (!SECURITY_CONFIG.allowedFileTypes.includes(ext)) {
    throw new Error('許可されていないファイル形式です');
  }
  
  return true;
}

// 設定ファイルを安全に読み込む関数
async function loadFirebaseConfig() {
  try {
    // 環境変数から設定を読み込む（本番環境）
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
      // 外部設定ファイルを使用（開発環境）
      try {
        const response = await fetch('./firebase-config.json');
        if (response.ok) {
          firebaseConfig = await response.json();
        } else {
          throw new Error('設定ファイルが見つかりません');
        }
      } catch (fetchError) {
        // フォールバック: 最小限の設定のみ使用（読み取り専用）
        firebaseConfig = {
          projectId: "my-website-2b713",
          storageBucket: "my-website-2b713.appspot.com",
          // 公開読み取り専用APIキー
          apiKey: "AIzaSyB-Wck9-5KQJLVfWWhE8yBdaW5Jl_3XWis"
        };
      }
    }
    
    // 設定値の検証
    if (!firebaseConfig.projectId || !firebaseConfig.storageBucket) {
      throw new Error('必須の設定値が不足しています');
    }
    
  } catch (error) {
    console.error('Firebase設定の読み込みに失敗しました:', error);
    throw error;
  }
}

// Firebase アプリとストレージを初期化
async function initializeFirebase() {
  await loadFirebaseConfig();

  if (!firebaseConfig) {
    throw new Error('Firebase設定が読み込めませんでした');
  }

  const app = initializeApp(firebaseConfig);
  storage = getStorage(app);
  console.log('Firebase初期化完了');
}

// 各言語ごとのストレージパスとHTML要素の対応表
const langs = [
  { id: "fileList-html", folder: "uploads/HTML" },
  { id: "fileList-css", folder: "uploads/CSS" },
  { id: "fileList-js", folder: "uploads/JavaScript" },
  { id: "fileList-java", folder: "uploads/Java" },
  { id: "fileList-python", folder: "uploads/Python" },
];

// ローカルファイルの安全な読み込み
async function loadLocalFile(fileName) {
  try {
    const response = await fetch(fileName);
    if (!response.ok) {
      throw new Error(`ファイルが見つかりません: ${fileName}`);
    }
    const text = await response.text();
    // ローカルファイルの内容はそのまま返す（HTMLエスケープしない）
    return text;
  } catch (error) {
    console.error(`ローカルファイル読み込みエラー: ${fileName}`, error);
    return 'ファイルの読み込みに失敗しました';
  }
}

// ファイルコンテンツを非同期で読み込む関数
async function loadFileContent(itemRef) {
  const filePath = itemRef.fullPath;
  
  // レート制限チェック
  if (!rateLimiter.isAllowed('file-load')) {
    throw new Error('リクエストが多すぎます。しばらくお待ちください。');
  }
  
  // キャッシュがあるかチェック
  if (fileCache.has(filePath)) {
    const cached = fileCache.get(filePath);
    if (Date.now() - cached.timestamp < SECURITY_CONFIG.cacheExpiration) {
      return cached.content;
    }
  }

  try {
    // ファイル名の検証
    validateFileName(itemRef.name);
    
    const blob = await getBlob(itemRef);
    
    // ファイルサイズチェック
    if (blob.size > SECURITY_CONFIG.maxFileSize) {
      throw new Error('ファイルサイズが大きすぎます');
    }
    
    const text = await blob.text();
    // ファイルの内容はそのまま保存（HTMLエスケープしない）
    
    // キャッシュに保存
    fileCache.set(filePath, {
      content: text,
      timestamp: Date.now()
    });
    
    return text;
  } catch (error) {
    console.error(`ファイル読み込みエラー (${itemRef.name}):`, error);
    throw error;
  }
}

// ファイルを事前にキャッシュに保存する関数
async function cacheFileContent(itemRef) {
  const filePath = itemRef.fullPath;
  
  // 既にキャッシュされているかチェック
  if (fileCache.has(filePath)) {
    const cached = fileCache.get(filePath);
    if (Date.now() - cached.timestamp < SECURITY_CONFIG.cacheExpiration) {
      return; // 既にキャッシュされている
    }
  }

  try {
    // ファイル名の検証
    validateFileName(itemRef.name);
    
    const blob = await getBlob(itemRef);
    
    // ファイルサイズチェック
    if (blob.size > SECURITY_CONFIG.maxFileSize) {
      console.warn(`ファイルサイズが大きすぎます: ${itemRef.name}`);
      return;
    }
    
    const text = await blob.text();
    // ファイルの内容はそのまま保存（HTMLエスケープしない）
    
    // キャッシュに保存
    fileCache.set(filePath, {
      content: text,
      timestamp: Date.now()
    });
    
    console.log(`キャッシュに保存: ${itemRef.name}`);
    
  } catch (error) {
    console.warn(`キャッシュ保存エラー (${itemRef.name}):`, error);
  }
}

// フォルダ内の全ファイルを事前にキャッシュする関数
async function cacheAllFilesInFolder(folder) {
  try {
    const listRef = ref(storage, folder);
    const res = await listAll(listRef);
    
    // 各ファイルをキャッシュに保存（並列処理）
    const cachePromises = res.items.map(itemRef => cacheFileContent(itemRef));
    await Promise.all(cachePromises);
    
    console.log(`${folder}: ${res.items.length}個のファイルをキャッシュしました`);
    
  } catch (error) {
    console.error(`フォルダキャッシュエラー (${folder}):`, error);
  }
}

// ファイルリストを表示する関数
function createFileListItem(itemRef, listElement) {
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = "#";
  a.textContent = sanitizeText(itemRef.name); // ファイル名のみサニタイズ
  a.setAttribute('data-file-path', itemRef.fullPath);

  // クリック時の処理
  a.addEventListener("click", async (e) => {
    e.preventDefault();
    const fileContentElem = document.getElementById("file-content");
    
    // ローディング表示
    fileContentElem.textContent = "読み込み中...";
    fileContentElem.classList.add('loading');
    
    try {
      const content = await loadFileContent(itemRef);
      // ファイル内容をそのまま表示（HTMLエスケープしない）
      fileContentElem.textContent = content;
    } catch (error) {
      // エラーメッセージのみサニタイズ
      fileContentElem.textContent = `エラー: ${error.message}`;
      fileContentElem.classList.add('error-message');
    } finally {
      fileContentElem.classList.remove('loading');
    }
  });

  li.appendChild(a);
  listElement.appendChild(li);
}

// 各フォルダのファイル一覧を取得・表示
async function loadFolderFiles(langConfig) {
  const { id, folder } = langConfig;
  const listElement = document.getElementById(id);
  
  if (!listElement) {
    console.error(`要素が見つかりません: ${id}`);
    return;
  }
  
  try {
    // レート制限チェック
    if (!rateLimiter.isAllowed('folder-load')) {
      throw new Error('リクエストが多すぎます。しばらくお待ちください。');
    }
    
    const listRef = ref(storage, folder);
    const res = await listAll(listRef);
    
    // リスト要素をクリア
    listElement.innerHTML = '';
    
    if (res.items.length === 0) {
      listElement.innerHTML = '<li>ファイルが見つかりません</li>';
      return;
    }

    // ファイル名でソート
    res.items.sort((a, b) => a.name.localeCompare(b.name));

    // 各ファイルのリストアイテムを作成
    res.items.forEach(itemRef => {
      try {
        validateFileName(itemRef.name);
        createFileListItem(itemRef, listElement);
      } catch (error) {
        console.warn(`スキップされたファイル: ${itemRef.name}`, error);
      }
    });
    
    console.log(`${folder}: ${res.items.length}個のファイルを読み込みました`);
    
  } catch (error) {
    console.error(`フォルダ読み込みエラー (${folder}):`, error);
    listElement.innerHTML = `<li>エラー: ${sanitizeText(error.message)}</li>`;
  }
}

// 初期化状態を更新
function updateInitializationStatus(message, isComplete = false) {
  const statusElement = document.getElementById('initialization-status');
  if (statusElement) {
    statusElement.innerHTML = `<p>${sanitizeText(message)}</p>`;
    if (isComplete) {
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 2000);
    }
  }
}

// ローカルファイルの読み込み
async function loadLocalFiles() {
  try {
    // memo.txtの読み込み
    const memoContent = await loadLocalFile('memo.txt');
    const memoElement = document.getElementById('memo-content');
    if (memoElement) {
      // pre要素でプレーンテキストとして表示
      memoElement.innerHTML = `<pre>${memoContent}</pre>`;
    }

    // 注意事項.txtの読み込み
    const noticeContent = await loadLocalFile('注意事項.txt');
    const noticeElement = document.getElementById('notice-content');
    if (noticeElement) {
      // pre要素でプレーンテキストとして表示
      noticeElement.innerHTML = `<pre>${noticeContent}</pre>`;
    }
  } catch (error) {
    console.error('ローカルファイルの読み込みに失敗しました:', error);
  }
}

// エラーハンドリング
window.addEventListener('error', (event) => {
  console.error('グローバルエラー:', event.error);
  updateInitializationStatus('エラーが発生しました。ページを再読み込みしてください。');
});

// メイン処理
async function main() {
  try {
    updateInitializationStatus('Firebase初期化中...');
    
    // Firebase初期化
    await initializeFirebase();
    
    updateInitializationStatus('ローカルファイルを読み込み中...');
    
    // ローカルファイルの読み込み
    await loadLocalFiles();
    
    updateInitializationStatus('ファイル一覧を読み込み中...');
    
    // 各フォルダのファイル一覧を並列で取得
    const loadPromises = langs.map(langConfig => loadFolderFiles(langConfig));
    await Promise.all(loadPromises);
    
    updateInitializationStatus('ファイルをキャッシュに保存中...');
    
    // 全フォルダのファイルを事前にキャッシュ
    const cachePromises = langs.map(langConfig => cacheAllFilesInFolder(langConfig.folder));
    await Promise.all(cachePromises);
    
    updateInitializationStatus('初期化完了！', true);
    
  } catch (error) {
    console.error('アプリケーション初期化エラー:', error);
    updateInitializationStatus(`初期化エラー: ${error.message}`);
    
    // エラー時の代替表示
    langs.forEach(({ id }) => {
      const listElement = document.getElementById(id);
      if (listElement) {
        listElement.innerHTML = `<li>読み込みエラー: ${sanitizeText(error.message)}</li>`;
      }
    });
  }
}

// アプリケーション開始
main();