// fileLoader.js
import { ref, getBlob } from "firebase/storage";
import { storage } from "./firebase-config.js";
import { getFileFromCache, saveFileToCache } from "./idb.js";

export async function loadTextFile(filePath) {
  const cached = await getFileFromCache(filePath);
  if (cached) {
    return blobToText(cached);
  }

  try {
    const fileRef = ref(storage, filePath);
    const blob = await getBlob(fileRef);
    await saveFileToCache(filePath, blob);
    return blobToText(blob);
  } catch (error) {
    console.error("読み込みエラー:", error);
    return null;
  }
}

function blobToText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}