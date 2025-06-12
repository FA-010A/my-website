// fileLoader.js
import { ref, getBlob } from "firebase/storage";
import { storage } from "./firebase-config";
import { getFileFromCache, saveFileToCache } from "./idb";

export async function loadFile(filePath) {
  const cached = await getFileFromCache(filePath);
  if (cached) {
    console.log("キャッシュから読み込みました:", filePath);
    return URL.createObjectURL(cached);
  }

  try {
    const fileRef = ref(storage, filePath);
    const blob = await getBlob(fileRef);
    await saveFileToCache(filePath, blob);
    console.log("Firebase から取得してキャッシュしました:", filePath);
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error("Firebase Storage 読み込み失敗:", err);
    return null;
  }
}