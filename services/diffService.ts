
import * as Diff from 'diff';
import type { IterationLogEntry, ReconstructedProductResult } from '../types.ts';

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
  baseFileManifestInput: string
): ReconstructedProductResult => {
  if (targetIteration < 0) {
    return { product: "", error: `Invalid targetIteration: ${targetIteration}. Cannot reconstruct.` };
  }

  let currentText = "";
  let lastReconstructedIteration = -1;

  // Step 1: Establish the correct base product.
  // The true "base" is the result of Iteration 0 if it exists and represents a synthesis.
  const iterZeroEntry = history.find(e => e.iteration === 0 && (
    e.entryType === 'initial_state' || 
    e.entryType === 'segmented_synthesis_milestone' ||
    e.entryType === 'bootstrap_synthesis_milestone'
  ));

  if (iterZeroEntry && iterZeroEntry.productDiff) {
    try {
      const patchedResult = Diff.applyPatch("", iterZeroEntry.productDiff);
      if (typeof patchedResult === 'string') {
        currentText = normalizeNewlines(patchedResult); // FIX: Only normalize, do not clean here.
        lastReconstructedIteration = 0;
      } else {
        return { product: "", error: `Failed to apply base patch from Iteration 0.` };
      }
    } catch (e: any) {
      return { product: "", error: `Error parsing base patch from Iteration 0: ${e.message}` };
    }
  } else {
    // If no Iteration 0 or it has no diff, the base is the initial prompt text.
    currentText = normalizeNewlines(baseFileManifestInput);
    // lastReconstructedIteration remains -1, so we start applying from iter 1.
  }

  // If the target is the base we just established, we're done.
  if (targetIteration === lastReconstructedIteration) {
    return { product: currentText };
  }

  // Step 2: Sequentially apply diffs from the next iteration up to the target.
  const relevantHistory = history
    .filter(entry => entry.iteration > lastReconstructedIteration && entry.iteration <= targetIteration && entry.productDiff)
    .sort((a, b) => a.iteration - b.iteration);

  for (const logEntry of relevantHistory) {
    try {
      const patchObjects = Diff.parsePatch(logEntry.productDiff!);
      if (patchObjects.length !== 1) {
        const errorMsg = `Patch for Iteration ${logEntry.iteration} parsed into ${patchObjects.length} objects. Reconstruction cannot proceed.`;
        console.error(`reconstructProduct: ${errorMsg}`);
        return { product: currentText, error: errorMsg };
      }

      const patchedResult = Diff.applyPatch(currentText, patchObjects[0]);

      if (typeof patchedResult === 'string') {
        currentText = normalizeNewlines(patchedResult); // FIX: Only normalize newlines. Do not clean diff markers inside the loop.
      } else {
        const errorMsg = `Failed to apply parsed patch for Iteration ${logEntry.iteration}. Reconstruction stopped. The diff may not match the reconstructed text from the previous iteration.`;
        console.error(`reconstructProduct: ${errorMsg}`);
        return { product: currentText, error: errorMsg };
      }
    } catch (e: any) {
      const errorMsg = `Error parsing or applying patch for Iteration ${logEntry.iteration}: ${e.message}. Reconstruction stopped.`;
      console.error(`reconstructProduct: ${errorMsg}`);
      return { product: currentText, error: errorMsg };
    }
  }

  // The final text after all patches should not be cleaned either, to maintain consistency.
  return { product: currentText };
};