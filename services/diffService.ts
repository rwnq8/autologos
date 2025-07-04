import * as Diff from 'diff';
import type { IterationLogEntry, ReconstructedProductResult, Version } from '../types/index.ts';
import { compareVersions, formatVersion } from './versionUtils.ts';

const normalizeNewlines = (str: string): string => {
  if (typeof str !== 'string') return "";
  return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
};

export const reconstructProduct = (
  targetVersion: Version,
  history: IterationLogEntry[],
  baseFileManifestInput: string
): ReconstructedProductResult => {
  if (targetVersion.major < 0) {
    return { product: "", error: `Invalid targetVersion: ${JSON.stringify(targetVersion)}. Cannot reconstruct.` };
  }

  // If there's no history, the "product" is just the initial input.
  if (!history || history.length === 0) {
    return { product: normalizeNewlines(baseFileManifestInput) };
  }

  let currentText = "";
  let lastReconstructedVersion: Version = { major: -1, minor: -1, patch: -1 };

  const iterZeroEntry = history.find(e => e.majorVersion === 0 && (
    e.entryType === 'initial_state' || 
    e.entryType === 'ensemble_integration'
  ));

  if (iterZeroEntry && iterZeroEntry.productDiff) {
    try {
      const patchObjects = Diff.parsePatch(iterZeroEntry.productDiff);

      let patchedResult: string | false = "";
      for (const patch of patchObjects) {
        if (typeof patchedResult === 'string') {
          patchedResult = Diff.applyPatch(patchedResult, patch);
        } else {
          break; // Stop if a patch fails
        }
      }

      if (typeof patchedResult === 'string') {
        currentText = normalizeNewlines(patchedResult);
        lastReconstructedVersion = { major: 0, minor: 0, patch: iterZeroEntry.patchVersion };
      } else {
        return { product: "", error: `Failed to apply base patch from Version v0.0.` };
      }
    } catch (e: any) {
      return { product: "", error: `Error parsing base patch from Version v0.0: ${e.message}` };
    }
  } else {
    // If no explicit v0 entry exists, the process starts from an empty product.
    // The history will begin with a patch against an empty string.
    // DO NOT initialize with baseFileManifestInput, as that would be the wrong base for the first patch.
    currentText = "";
  }

  if (targetVersion.major === 0) {
    return { product: currentText };
  }

  const sortedHistory = [...history].sort(compareVersions);

  const relevantHistory = sortedHistory.filter(entry => {
    // Filter out everything before our starting point
    if (compareVersions(entry, lastReconstructedVersion) <= 0) return false;
    // Filter out everything after our target
    if (compareVersions(entry, targetVersion) > 0) return false;
    return !!entry.productDiff;
  });

  for (const logEntry of relevantHistory) {
    try {
      const patchObjects = Diff.parsePatch(logEntry.productDiff!);
      if (patchObjects.length === 0 && logEntry.productDiff?.trim()) {
          // This check prevents benign empty patches from halting reconstruction, but we no longer log it to the console.
          continue;
      }

      let patchedResult: string | false = currentText;
      for (const patch of patchObjects) {
        if (typeof patchedResult === 'string') {
          patchedResult = Diff.applyPatch(patchedResult, patch);
        } else {
          break; // Stop if a patch fails
        }
      }

      if (typeof patchedResult === 'string') {
        currentText = normalizeNewlines(patchedResult);
      } else {
        const errorMsg = `Failed to apply parsed patch for Version ${formatVersion(logEntry)}. Reconstruction stopped.`;
        console.error(`reconstructProduct: ${errorMsg}`);
        return { product: currentText, error: errorMsg };
      }
    } catch (e: any) {
      const errorMsg = `Error parsing or applying patch for Version ${formatVersion(logEntry)}: ${e.message}. Reconstruction stopped.`;
      console.error(`reconstructProduct: ${errorMsg}`);
      return { product: currentText, error: errorMsg };
    }
  }

  return { product: currentText };
};