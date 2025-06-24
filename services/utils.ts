
export const DEFAULT_PROJECT_NAME_FALLBACK = "Untitled Project";
export const INITIAL_PROJECT_NAME_STATE = "";

export const generateFileName = (currentProjectName: string | null, suffix: string, extension: string, iterationNum?: number): string => {
  let namePart = DEFAULT_PROJECT_NAME_FALLBACK;
  if (currentProjectName && currentProjectName.trim() !== "" && currentProjectName !== INITIAL_PROJECT_NAME_STATE) {
    namePart = currentProjectName.trim();
  }
  
  namePart = namePart.replace(/[^a-zA-Z0-9_.-]/g, '_').substring(0, 60);
  if (!namePart) namePart = DEFAULT_PROJECT_NAME_FALLBACK; 

  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
  
  const iterSuffix = iterationNum !== undefined ? `iter_${iterationNum}_` : "";

  return `${namePart}_${iterSuffix}${suffix}_${timestamp}.${extension}`;
}