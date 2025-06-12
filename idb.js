// idb.js
export function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("MyFileDB", 1);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore("files");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveFileToCache(fileName, blob) {
  const db = await openDatabase();
  const tx = db.transaction("files", "readwrite");
  tx.objectStore("files").put(blob, fileName);
}

export async function getFileFromCache(fileName) {
  const db = await openDatabase();
  const tx = db.transaction("files", "readonly");
  return tx.objectStore("files").get(fileName);
}