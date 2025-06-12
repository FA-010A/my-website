// listFiles.js
import { storage } from "./firebase-config.js";
import { ref, listAll } from "firebase/storage";

export async function listTxtFilesInDirectory(path) {
  const dirRef = ref(storage, path);
  const result = await listAll(dirRef);

  return result.items
    .filter(item => item.name.endsWith(".txt"))
    .map(item => ({
      name: item.name,
      fullPath: item.fullPath
    }));
}