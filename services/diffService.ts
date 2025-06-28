
import * as Diff from 'diff';
import type { IterationLogEntry, ReconstructedProductResult } from '../types.ts';

const CONVERGED_PREFIX = "CONVERGED:";

const normalizeNewlines = (str: string): string => {
  if (typeof str !== 'string') return "";
  // Replace CRLF with LF, then replace standalone CR with LF
  return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};

const cleanDiffMarkerLiterals = (text: string): string => {
  let cleanedText = text;
  const markers = [
    "\n\\ No newline at end of file",
    "\\ No newline at end of file"
  ];
  for (const marker of markers) {
    if (cleanedText.endsWith(marker)) {
      cleanedText = cleanedText.substring(0, cleanedText.length - marker.length);
    }
  }
  return cleanedText;
};


export const reconstructProduct = (
  targetIteration: number,
  history: IterationLogEntry[],
  baseFileManifestInput: string // This is processState.initialPrompt at the time of calling
): ReconstructedProductResult => {
  
  const actualInitialStateForProcess = cleanDiffMarkerLiterals(normalizeNewlines(baseFileManifestInput));

  if (targetIteration < 0) {
    const errorMsg = `reconstructProduct: Called with invalid targetIteration ${targetIteration}. Returning normalized actualInitialStateForProcess.`;
    // console.warn(errorMsg); // Reduced verbosity
    return { product: actualInitialStateForProcess, error: errorMsg };
  }

  let iterationZeroProduct: string;
  let iterationZeroError: string | undefined;
  const iterZeroEntry = history.find(entry => entry.iteration === 0);

  if (iterZeroEntry && iterZeroEntry.productDiff && iterZeroEntry.productDiff.trim() !== "") {
    try {
      const patchObjects = Diff.parsePatch(iterZeroEntry.productDiff);
      if (patchObjects.length === 1) {
        const patchObject = patchObjects[0];
        const patchedResult = Diff.applyPatch("", patchObject); 
        if (typeof patchedResult === 'string') {
          iterationZeroProduct = cleanDiffMarkerLiterals(normalizeNewlines(patchedResult));
          // console.debug("reconstructProduct: Iteration 0 product established from its own diff (applied to empty string)."); // Reduced verbosity
        } else {
          iterationZeroError = `CRITICAL: Failed to apply patch for Iteration 0 (from its own diff) to empty string. Base product could not be established.`;
          console.error(`reconstructProduct: ${iterationZeroError} Patch Hunks (first 2): ${JSON.stringify(patchObject.hunks?.slice(0,2))}.`);
          return { product: actualInitialStateForProcess, error: iterationZeroError }; 
        }
      } else {
         iterationZeroError = `Iteration 0: Patch string parsed into ${patchObjects.length} objects (expected 1). Cannot establish base product from Iter0 diff. Diff (first 200): ${iterZeroEntry.productDiff.substring(0,200)}...`;
         console.warn(`reconstructProduct: ${iterationZeroError}`);
         return { product: actualInitialStateForProcess, error: iterationZeroError }; 
      }
    } catch (e: any) {
      iterationZeroError = `Error parsing patch for Iteration 0 (from its own diff) (Message: "${e.message}"). Cannot establish base product from Iter0 diff. Diff (first 200): ${iterZeroEntry.productDiff.substring(0, 200)}...`;
      console.warn(`reconstructProduct: ${iterationZeroError}`);
      return { product: actualInitialStateForProcess, error: iterationZeroError }; 
    }
  } else {
    iterationZeroProduct = actualInitialStateForProcess;
    // console.debug("reconstructProduct: Iteration 0 has no diff or no entry. Product set to actualInitialStateForProcess (from argument)."); // Reduced verbosity
  }
  
  if (typeof iterationZeroProduct !== 'string') { 
    iterationZeroProduct = actualInitialStateForProcess;
    const fallbackMsg = "reconstructProduct: Fallback - Iteration 0 product reset to actualInitialStateForProcess due to unexpected undefined state after initial setup.";
    console.error(fallbackMsg); 
    iterationZeroError = (iterationZeroError ? iterationZeroError + "\n" : "") + fallbackMsg;
  }


  const iterOneEntry = history.find(entry => entry.iteration === 1);
  if (iterOneEntry && iterOneEntry.productDiff && iterOneEntry.productDiff.trim() !== "") {
      try {
          const iterOnePatchObjects = Diff.parsePatch(iterOneEntry.productDiff);
          if (iterOnePatchObjects.length === 1) {
              const iterOnePatchObject = iterOnePatchObjects[0];
              const attemptOnCurrentIterZero = Diff.applyPatch(iterationZeroProduct, iterOnePatchObject);

              if (typeof attemptOnCurrentIterZero !== 'string') { 
                  // console.debug(`reconstructProduct: Override Check - Iteration 1 patch FAILED on current Iteration 0 product ("${iterationZeroProduct.substring(0,100)}...").`); // Reduced verbosity
                  const attemptOnBaseManifestArg = Diff.applyPatch(actualInitialStateForProcess, iterOnePatchObject);
                  if (typeof attemptOnBaseManifestArg === 'string') { 
                      const warningMsg = `OVERRIDE APPLIED: Iteration 1's patch is incompatible with Iteration 0's derived product/state. Forcing Iteration 0 product to be actualInitialStateForProcess (from argument) to allow Iteration 1 to apply. Iteration 0's specific content (if derived from its own diff) might be effectively superseded for this reconstruction path.`;
                      console.warn(`reconstructProduct: ${warningMsg}`); // Keep important override warning
                      iterationZeroProduct = actualInitialStateForProcess; 
                      iterationZeroError = (iterationZeroError ? iterationZeroError + "\n" : "") + warningMsg;
                  } else {
                      console.warn(`reconstructProduct: Override for Iteration 0 product NOT APPLIED. Iteration 1 patch FAILED on current Iteration 0 product AND ALSO FAILED on actualInitialStateForProcess.`); // Keep important warning
                  }
              } else {
                // console.debug(`reconstructProduct: Override Check - Iteration 1 patch SUCCEEDED on current Iteration 0 product ("${iterationZeroProduct.substring(0,100)}..."). No override needed.`); // Reduced verbosity
              }
          } else {
            console.warn(`reconstructProduct: Override Check - Iteration 1 patch string parsed into ${iterOnePatchObjects.length} objects (expected 1). Cannot perform override check.`);
          }
      } catch (e: any) {
          console.warn(`reconstructProduct: Error parsing Iteration 1 patch during override check: ${e.message}`);
      }
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
            // console.debug(`reconstructProduct: Patch for Iteration ${logEntry.iteration} (from diff string) resulted in no hunks. Assuming no textual change from Iteration ${logEntry.iteration-1}.`); // Reduced verbosity
          } else {
            const patchedResult = Diff.applyPatch(currentText, patchObject);
            if (typeof patchedResult === 'string') {
              currentText = cleanDiffMarkerLiterals(normalizeNewlines(patchedResult)); 
            } else {
              const errorMsg = `Failed to apply parsed patch for Iteration ${logEntry.iteration} (applyPatch returned false). Reconstruction stopped at Iteration ${logEntry.iteration - 1}.`;
              console.error(`reconstructProduct: ${errorMsg} Patch Hunks (first 2): ${JSON.stringify(patchObject.hunks?.slice(0,2))}.`);
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
