
import * as Diff from 'diff';
import type { IterationLogEntry, ReconstructedProductResult } from '../types.ts';

const CONVERGED_PREFIX = "CONVERGED:";

const normalizeNewlines = (str: string): string => {
  // Also handle null/undefined to prevent errors if somehow passed, though type is string
  if (typeof str !== 'string') return "";
  return str.replace(/\r\n/g, '\n');
};

export const reconstructProduct = (
  targetIteration: number,
  history: IterationLogEntry[],
  baseFileManifestInput: string
): ReconstructedProductResult => {
  // Normalize the baseFileManifestInput upfront.
  const baseFileManifest = normalizeNewlines(baseFileManifestInput);

  if (targetIteration < 0) {
    const errorMsg = `reconstructProduct: Called with invalid targetIteration ${targetIteration}. Returning normalized baseFileManifest.`;
    console.warn(errorMsg);
    return { product: baseFileManifest, error: errorMsg };
  }
  let iterationZeroProduct: string = ""; 
  let iterationZeroError: string | undefined;
  const iterZeroEntry = history.find(entry => entry.iteration === 0);

  if (iterZeroEntry && iterZeroEntry.productDiff && iterZeroEntry.productDiff.trim() !== "") {
    try {
      const patchObjects = Diff.parsePatch(iterZeroEntry.productDiff);
      if (patchObjects.length === 1) {
        const patchObject = patchObjects[0];
        const patchedResult = Diff.applyPatch("", patchObject);
        if (typeof patchedResult === 'string') {
          iterationZeroProduct = patchedResult; // Result from patch should be \n consistent
        } else {
          iterationZeroError = `CRITICAL: Failed to apply patch for Iteration 0 (applyPatch returned false). Base product (from empty string) could not be established. Reconstruction halted.`;
          console.error(`reconstructProduct: ${iterationZeroError} Patch was from "" to intended Iteration 0 product. Hunks (first 2): ${JSON.stringify(patchObject.hunks?.slice(0,2))}`);
          return { product: "", error: iterationZeroError }; 
        }
      } else {
         iterationZeroError = `Iteration 0: Patch string parsed into ${patchObjects.length} objects (expected 1). Cannot establish base product.`;
         console.warn(`reconstructProduct: ${iterationZeroError} Diff (first 200): ${iterZeroEntry.productDiff.substring(0,200)}...`);
         return { product: "", error: iterationZeroError }; 
      }
    } catch (e: any) {
      iterationZeroError = `Error parsing patch for Iteration 0 (Message: "${e.message}"). Cannot establish base product. Diff (first 200): ${iterZeroEntry.productDiff.substring(0, 200)}...`;
      console.warn(`reconstructProduct: ${iterationZeroError}`);
      return { product: "", error: iterationZeroError }; 
    }
  } else if (iterZeroEntry && (!iterZeroEntry.productDiff || iterZeroEntry.productDiff.trim() === "")) {
     if (history.find(entry => entry.iteration === 0 && entry.fileProcessingInfo && entry.fileProcessingInfo.numberOfFilesActuallySent > 0)){
        iterationZeroProduct = ""; // Empty string is already normalized
     } else {
        iterationZeroProduct = baseFileManifest; // Already normalized at the start of the function
     }
  } else if (!iterZeroEntry && targetIteration >= 0) {
    iterationZeroProduct = baseFileManifest; // Already normalized at the start of the function
    if (targetIteration > 0) {
        console.warn(`reconstructProduct: No Iteration 0 log entry found, but target is ${targetIteration}. Using baseFileManifest ("${baseFileManifest.substring(0,50)}...") as starting point.`);
    }
  }


  if (targetIteration === 0) {
    return { product: iterationZeroProduct, error: iterationZeroError };
  }

  let currentText = iterationZeroProduct; // Starts normalized
  let cumulativeError = iterationZeroError; 
  
  const sortedHistory = [...history].filter(entry => entry.iteration > 0 && entry.iteration <= targetIteration).sort((a, b) => a.iteration - b.iteration);

  for (const logEntry of sortedHistory) {
    if (logEntry.productDiff && logEntry.productDiff.trim() !== "") {
      try {
        const patchObjects = Diff.parsePatch(logEntry.productDiff);
        if (patchObjects.length === 1) {
          const patchObject = patchObjects[0];
          if (!patchObject.hunks || patchObject.hunks.length === 0) {
            console.warn(`reconstructProduct: Patch for Iteration ${logEntry.iteration} (from diff string) resulted in no hunks. Assuming no textual change from Iteration ${logEntry.iteration-1}.`);
          } else {
            // currentText should be \n normalized here if previous steps worked.
            const patchedResult = Diff.applyPatch(currentText, patchObject);
            if (typeof patchedResult === 'string') {
              currentText = patchedResult; // Result of applyPatch with \n patch should also be \n
            } else {
              const errorMsg = `Failed to apply parsed patch for Iteration ${logEntry.iteration} (applyPatch returned false). Reconstruction stopped at Iteration ${logEntry.iteration - 1}.`;
              console.error(`reconstructProduct: ${errorMsg} Patch Hunks (first 2): ${JSON.stringify(patchObject.hunks?.slice(0,2))}. Current text (first 100): "${currentText.substring(0, 100)}..."`);
              return { product: currentText, error: cumulativeError ? `${cumulativeError}\n${errorMsg}` : errorMsg };
            }
          }
        } else {
          const errorMsg = `Patch string for Iteration ${logEntry.iteration} parsed into ${patchObjects.length} patch objects (expected 1). Reconstruction stopped at Iteration ${logEntry.iteration - 1}.`;
          console.error(`reconstructProduct: ${errorMsg} Diff (first 200): ${logEntry.productDiff.substring(0, 200)}...`);
          return { product: currentText, error: cumulativeError ? `${cumulativeError}\n${errorMsg}` : errorMsg };
        }
      } catch (e: any) {
        const errorMsg = `Error parsing or applying patch for Iteration ${logEntry.iteration} (Message: "${e.message}"). Reconstruction stopped at Iteration ${logEntry.iteration - 1}.`;
        console.error(`reconstructProduct: ${errorMsg} Diff (first 200): ${logEntry.productDiff.substring(0, 200)}...`);
        return { product: currentText, error: cumulativeError ? `${cumulativeError}\n${errorMsg}` : errorMsg };
      }
    }
  }
  return { product: currentText, error: cumulativeError };
};
