import * as Diff from 'diff';
import type { IterationLogEntry, ReconstructedProductResult, Version } from '../types/index.ts';
import { compareVersions, formatVersion } from './versionUtils.ts';

const normalizeNewlines = (str: string): string => {
  if (typeof str !== 'string') return "";
  return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};

export const reconstructProduct = (
  targetVersion: Version | IterationLogEntry,
  history: IterationLogEntry[],
  baseFileManifestInput: string // This is only used as a fallback if history is empty
): ReconstructedProductResult => {
  if (!history || history.length === 0) {
    return { product: normalizeNewlines(baseFileManifestInput) };
  }

  const sortedHistory = [...history].sort(compareVersions);
  
  const relevantHistory = sortedHistory.filter(entry => {
    // We only want entries up to and including our target version
    return compareVersions(entry, targetVersion) <= 0 && !!entry.productDiff;
  });

  if (relevantHistory.length === 0) {
    // This can happen if we request a version before any patch exists (e.g., v0.0.0). The base is an empty string.
    return { product: "" };
  }
  
  let currentText = ""; // ALWAYS start from an empty base for patch application.

  for (const logEntry of relevantHistory) {
    try {
      const patchObjects = Diff.parsePatch(logEntry.productDiff!);
      
      if (patchObjects.length === 0) {
        // Some diffs might be empty (e.g., no change). This is valid.
        continue;
      }

      let patchedResult: string | false = currentText;
      // Diff.applyPatch can take a single patch object or an array of them.
      // Looping is safer to handle potential library changes or single/multiple patch files in the diff string.
      for (const patch of patchObjects) {
          if (typeof patchedResult === 'string') {
              patchedResult = Diff.applyPatch(patchedResult, patch);
          } else {
              break; // A patch failed. Stop processing this entry's patches.
          }
      }

      if (typeof patchedResult === 'string') {
        currentText = normalizeNewlines(patchedResult);
      } else {
        const errorMsg = `Failed to apply patch for Version ${formatVersion(logEntry)}. Reconstruction may be incomplete.`;
        console.error(errorMsg, { logEntry });
        // Return the text up to the point of failure.
        return { product: currentText, error: errorMsg };
      }
    } catch (e: any) {
      const errorMsg = `Error parsing or applying patch for Version ${formatVersion(logEntry)}: ${e.message}. Reconstruction stopped.`;
      console.error(errorMsg, { logEntry });
      return { product: currentText, error: errorMsg };
    }
  }

  return { product: currentText };
};