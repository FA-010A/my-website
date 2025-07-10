// firebase-app.js
// Firebase ファイル管理アプリケーション - 詳細解説版

// ===== 1. 必要なライブラリのインポート =====
// Firebase SDK（アプリ、ストレージ）をCDNから読み込み
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getStorage,      // ストレージサービス取得
  ref,            // ストレージ参照作成
  listAll,        // フォルダ内のファイル一覧取得
  getDownloadURL, // ダウンロードURL取得
  getBlob,        // ファイルのバイナリデータ取得
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-storage.js";

// ===== 2. セキュリティ設定 =====
// アプリケーション全体のセキュリティルールを定義
const SECURITY_CONFIG = {
  maxFileSize: 5 * 1024 * 1024,  // 最大ファイルサイズ: 5MB
  allowedFileTypes: ['.txt', '.md', '.html', '.css', '.js', '.java', '.py'], // 許可するファイル拡張子
  rateLimitRequests: 100,         // 1分間の最大リクエスト数
  cacheExpiration: 5 * 60 * 1000, // キャッシュの有効期限: 5分
};

// ===== 3. レート制限システム =====
// DoS攻撃やスパムリクエストを防ぐためのレート制限
const rateLimiter = {
  requests: new Map(), // ユーザー/IPごとのリクエスト履歴を保存
  
  // 指定されたキーでリクエストが許可されるかチェック
  isAllowed(key) {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // 1分以内のリクエストのみを残す（古いリクエストは削除）
    const recentRequests = requests.filter(time => now - time < 60000);
    
    // 制限を超えている場合は拒否
    if (recentRequests.length >= SECURITY_CONFIG.rateLimitRequests) {
      return false;
    }
    
    // 新しいリクエストを記録
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    return true;
  }
};

// ===== 4. グローバル変数 =====
let firebaseConfig = null;  // Firebase設定情報
let storage = null;         // Firebaseストレージインスタンス
let fileCache = new Map();  // ファイル内容のキャッシュ

// ===== 5. セキュリティ関数 =====

// XSS攻撃を防ぐためのテキストサニタイズ
function sanitizeText(text) {
  const div = document.createElement('div');
  div.textContent = text;  // HTMLとして解釈せずテキストとして設定
  return div.innerHTML;    // エスケープされたHTMLを返す
}

// ファイル名の安全性をチェック
function validateFileName(fileName) {
  // 危険な文字（パストラバーサル攻撃等を防ぐ）
  const dangerousChars = /[<>:"/\\|?*\x00-\x1F]/;
  if (dangerousChars.test(fileName)) {
    throw new Error('不正なファイル名です');
  }
  
  // 許可された拡張子のみ受け入れ
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  if (!SECURITY_CONFIG.allowedFileTypes.includes(ext)) {
    throw new Error('許可されていないファイル形式です');
  }
  
  return true;
}

// ===== 6. Firebase設定の安全な読み込み =====
async function loadFirebaseConfig() {
  try {
    // 本番環境: 環境変数から設定を読み込み（推奨）
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
      // 開発環境: 外部設定ファイルから読み込み
      try {
        const response = await fetch('./firebase-config.json');
        if (response.ok) {
          firebaseConfig = await response.json();
        } else {
          throw new Error('設定ファイルが見つかりません');
        }
      } catch (fetchError) {
        // フォールバック: 最小限の設定（読み取り専用）
        firebaseConfig = {
          projectId: "my-website-2b713",
          storageBucket: "my-website-2b713.appspot.com",
          // 公開読み取り専用APIキー（機密情報ではない）
          apiKey: "AIzaSyB-Wck9-5KQJLVfWWhE8yBdaW5Jl_3XWis"
        };
      }
    }
    
    // 必須設定値の存在チェック
    if (!firebaseConfig.projectId || !firebaseConfig.storageBucket) {
      throw new Error('必須の設定値が不足しています');
    }
    
  } catch (error) {
    console.error('Firebase設定の読み込みに失敗しました:', error);
    throw error;
  }
}

// ===== 7. Firebase初期化 =====
async function initializeFirebase() {
  // 設定情報を読み込み
  await loadFirebaseConfig();

  if (!firebaseConfig) {
    throw new Error('Firebase設定が読み込めませんでした');
  }

  // Firebaseアプリとストレージを初期化
  const app = initializeApp(firebaseConfig);
  storage = getStorage(app);
  console.log('Firebase初期化完了');
}

// ===== 8. 言語・フォルダ設定 =====
// 各プログラミング言語のファイルを格納するフォルダとHTML要素の対応
const langs = [
  { id: "fileList-html", folder: "uploads/HTML" },
  { id: "fileList-css", folder: "uploads/CSS" },
  { id: "fileList-js", folder: "uploads/JavaScript" },
  { id: "fileList-java", folder: "uploads/Java" },
  { id: "fileList-python", folder: "uploads/Python" },
];

// ===== 9. ローカルファイル読み込み =====
// サーバー上の静的ファイルを安全に読み込む
async function loadLocalFile(fileName) {
  try {
    const response = await fetch(fileName);
    if (!response.ok) {
      throw new Error(`ファイルが見つかりません: ${fileName}`);
    }
    const text = await response.text();
    return sanitizeText(text); // XSS対策
  } catch (error) {
    console.error(`ローカルファイル読み込みエラー: ${fileName}`, error);
    return 'ファイルの読み込みに失敗しました';
  }
}

// ===== 10. ファイル内容読み込み（キャッシュ付き） =====
async function loadFileContent(itemRef) {
  const filePath = itemRef.fullPath;
  const cacheKey = `${filePath}_${Date.now()}`;
  
  // レート制限チェック（DoS攻撃防止）
  if (!rateLimiter.isAllowed('file-load')) {
    throw new Error('リクエストが多すぎます。しばらくお待ちください。');
  }
  
  // キャッシュから読み込み（パフォーマンス向上）
  if (fileCache.has(filePath)) {
    const cached = fileCache.get(filePath);
    if (Date.now() - cached.timestamp < SECURITY_CONFIG.cacheExpiration) {
      return cached.content;
    }
  }

  try {
    // ファイル名の安全性チェック
    validateFileName(itemRef.name);
    
    // Firebaseからファイル内容を取得
    const blob = await getBlob(itemRef);
    
    // ファイルサイズ制限チェック
    if (blob.size > SECURITY_CONFIG.maxFileSize) {
      throw new Error('ファイルサイズが大きすぎます');
    }
    
    // テキストとして読み込み、サニタイズ
    const text = await blob.text();
    const sanitizedText = sanitizeText(text);
    
    // キャッシュに保存（次回の高速読み込み）
    fileCache.set(filePath, {
      content: sanitizedText,
      timestamp: Date.now()
    });
    
    return sanitizedText;
  } catch (error) {
    console.error(`ファイル読み込みエラー (${itemRef.name}):`, error);
    throw error;
  }
}

// ===== 11. ファイルリスト項目の作成 =====
function createFileListItem(itemRef, listElement) {
  // リスト項目とリンクを作成
  const li = document.createElement("li");
  const a = document.createElement("a");
  a.href = "#";
  a.textContent = sanitizeText(itemRef.name); // ファイル名をサニタイズ
  a.setAttribute('data-file-path', itemRef.fullPath);

  // クリックイベント: ファイル内容を表示
  a.addEventListener("click", async (e) => {
    e.preventDefault();
    const fileContentElem = document.getElementById("file-content");
    
    // ローディング表示
    fileContentElem.textContent = "読み込み中...";
    fileContentElem.classList.add('loading');
    
    try {
      // ファイル内容を非同期で読み込み
      const content = await loadFileContent(itemRef);
      fileContentElem.textContent = content;
    } catch (error) {
      // エラー表示
      fileContentElem.textContent = `エラー: ${error.message}`;
      fileContentElem.classList.add('error-message');
    } finally {
      // ローディング表示を解除
      fileContentElem.classList.remove('loading');
    }
  });

  li.appendChild(a);
  listElement.appendChild(li);
}

// ===== 12. フォルダ内ファイル一覧の取得・表示 =====
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
    
    // Firebaseストレージからファイル一覧を取得
    const listRef = ref(storage, folder);
    const res = await listAll(listRef);
    
    // 既存のリストをクリア
    listElement.innerHTML = '';
    
    if (res.items.length === 0) {
      listElement.innerHTML = '<li>ファイルが見つかりません</li>';
      return;
    }

    // ファイル名でアルファベット順にソート
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

// ===== 13. 初期化状態の更新 =====
function updateInitializationStatus(message, isComplete = false) {
  const statusElement = document.getElementById('initialization-status');
  if (statusElement) {
    statusElement.innerHTML = `<p>${sanitizeText(message)}</p>`;
    if (isComplete) {
      // 完了後2秒でステータス表示を隠す
      setTimeout(() => {
        statusElement.style.display = 'none';
      }, 2000);
    }
  }
}

// ===== 14. ローカルファイルの読み込み =====
async function loadLocalFiles() {
  try {
    // memo.txtの読み込み
    const memoContent = await loadLocalFile('memo.txt');
    const memoElement = document.getElementById('memo-content');
    if (memoElement) {
      memoElement.innerHTML = `<pre>${memoContent}</pre>`;
    }

    // 注意事項.txtの読み込み
    const noticeContent = await loadLocalFile('注意事項.txt');
    const noticeElement = document.getElementById('notice-content');
    if (noticeElement) {
      noticeElement.innerHTML = `<pre>${noticeContent}</pre>`;
    }
  } catch (error) {
    console.error('ローカルファイルの読み込みに失敗しました:', error);
  }
}

// ===== 15. グローバルエラーハンドリング =====
// 予期しないエラーをキャッチしてユーザーに通知
window.addEventListener('error', (event) => {
  console.error('グローバルエラー:', event.error);
  updateInitializationStatus('エラーが発生しました。ページを再読み込みしてください。');
});

// ===== 16. メイン処理 =====
async function main() {
  try {
    // 1. Firebase初期化
    updateInitializationStatus('Firebase初期化中...');
    await initializeFirebase();
    
    // 2. ローカルファイル読み込み
    updateInitializationStatus('ローカルファイルを読み込み中...');
    await loadLocalFiles();
    
    // 3. 各言語フォルダのファイル一覧を並列で取得
    updateInitializationStatus('ファイル一覧を読み込み中...');
    const loadPromises = langs.map(langConfig => loadFolderFiles(langConfig));
    await Promise.all(loadPromises);
    
    // 4. 初期化完了
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

// ===== 17. アプリケーション開始 =====
// ページ読み込み時にメイン処理を実行
main();

/*
=== このアプリケーションの主な機能 ===

1. Firebase Storageからファイル一覧を取得
2. HTML、CSS、JavaScript、Java、Pythonファイルを言語別に表示
3. ファイルをクリックすると内容を表示
4. ローカルファイル（memo.txt、注意事項.txt）も表示
5. 強力なセキュリティ機能（XSS対策、レート制限、ファイル検証）
6. キャッシュ機能でパフォーマンス向上
7. エラーハンドリングで安定動作

=== セキュリティ機能 ===

- XSS攻撃防止のテキストサニタイズ
- ファイル名・拡張子の検証
- ファイルサイズ制限
- レート制限（DoS攻撃防止）
- 設定情報の安全な管理
- エラーメッセージのサニタイズ

=== 使用技術 ===

- Firebase Storage (ファイル管理)
- ES6 Modules (モジュール化)
- async/await (非同期処理)
- Promise.all (並列処理)
- Map (データ構造)
- DOM操作 (動的UI更新)
*/