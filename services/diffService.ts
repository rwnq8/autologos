
import * as Diff from 'diff';
import type { IterationLogEntry, ReconstructedProductResult } from '../types.ts';

const CONVERGED_PREFIX = "CONVERGED:";

export const reconstructProduct = (
  targetIteration: number,
  history: IterationLogEntry[],
  baseFileManifest: string
): ReconstructedProductResult => {
  if (targetIteration < 0) {
    const errorMsg = `reconstructProduct: Called with invalid targetIteration ${targetIteration}. Returning baseFileManifest.`;
    console.warn(errorMsg);
    return { product: baseFileManifest, error: errorMsg };
  }
  let iterationZeroProduct: string = baseFileManifest;
  let iterationZeroError: string | undefined;
  const iterZeroEntry = history.find(entry => entry.iteration === 0);

  if (iterZeroEntry && iterZeroEntry.productDiff && iterZeroEntry.productDiff.trim() !== "") {
    try {
      const patchObjects = Diff.parsePatch(iterZeroEntry.productDiff);
      if (patchObjects.length === 1) {
        const patchObject = patchObjects[0];
        if (!patchObject.hunks || patchObject.hunks.length === 0) {
           iterationZeroProduct = "";
           // The console.debug line previously here was removed to prevent console spam.
           // This condition (no hunks for iteration 0 diff when starting with files) is normal,
           // as the initial product is empty, and the diff from "" to "" has no hunks.
        } else {
          const patchedResult = Diff.applyPatch("", patchObject);
          if (typeof patchedResult === 'string') {
            iterationZeroProduct = patchedResult;
          } else {
            iterationZeroError = `Iteration 0: Parsed patch application returned non-string (likely 'false'). Falling back to baseFileManifest.`;
            console.warn(`reconstructProduct: ${iterationZeroError} Patch Hunks (first 2): ${JSON.stringify(patchObject.hunks?.slice(0,2))}`);
            iterationZeroProduct = baseFileManifest;
          }
        }
      } else {
         iterationZeroError = `Iteration 0: Patch string parsed into ${patchObjects.length} objects (expected 1). Falling back to baseFileManifest. Diff (first 200): ${iterZeroEntry.productDiff.substring(0,200)}...`;
         console.warn(`reconstructProduct: ${iterationZeroError}`);
         iterationZeroProduct = baseFileManifest;
      }
    } catch (e: any) {
      iterationZeroError = `Error parsing/applying patch for Iteration 0 (Message: "${e.message}"). Falling back to baseFileManifest. Diff (first 200): ${iterZeroEntry.productDiff.substring(0, 200)}...`;
      console.warn(`reconstructProduct: ${iterationZeroError}`);
      iterationZeroProduct = baseFileManifest;
    }
  } else if (iterZeroEntry && (!iterZeroEntry.productDiff || iterZeroEntry.productDiff.trim() === "")) {
    // Iteration 0 exists but has no diff, so initialPrompt (baseFileManifest) is the product
    // if files were not loaded, or "" if files were loaded.
    // Logic for Iteration 0 product being "" if files were loaded is handled by `addLogEntry` setting `previousFullProduct` to "" for Iteration 0.
    // If files are loaded, initialPrompt (which is the fileManifest) IS NOT the iterationZeroProduct.
    // IterationZeroProduct should be an empty string if files are present.
     if (history.find(entry => entry.iteration === 0 && entry.fileProcessingInfo && entry.fileProcessingInfo.numberOfFilesActuallySent > 0)){
        iterationZeroProduct = "";
     } else {
        iterationZeroProduct = baseFileManifest; // No files, Iteration 0 product is the manifest (initial prompt)
     }
  } else if (!iterZeroEntry && targetIteration >= 0) {
    // No Iteration 0 entry, this is unusual if targetIteration > 0.
    // If targetIteration is 0, iterationZeroProduct (baseFileManifest) is correct.
    // If targetIteration > 0, this might indicate incomplete history.
    if (targetIteration > 0) {
        console.warn(`reconstructProduct: No Iteration 0 log entry found, but target is ${targetIteration}. Using baseFileManifest as starting point.`);
    }
     // If no Iteration 0 entry and target is 0, it means no files were loaded initially, and no initial prompt was given,
     // or iteration history is empty.
     // In such a case, baseFileManifest (which would be the current `initialPrompt` from ProcessState) is the correct starting point.
     iterationZeroProduct = baseFileManifest;
  }


  if (targetIteration === 0) {
    return { product: iterationZeroProduct, error: iterationZeroError };
  }

  let currentText = iterationZeroProduct;
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
            const patchedResult = Diff.applyPatch(currentText, patchObject);
            if (typeof patchedResult === 'string') {
              currentText = patchedResult;
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
    // If no productDiff, currentText remains unchanged for this iteration.
  }
  return { product: currentText, error: cumulativeError };
};
