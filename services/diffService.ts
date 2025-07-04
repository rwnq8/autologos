
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

  let currentText = "";
  let lastReconstructedVersion: Version = { major: -1, minor: -1, patch: -1 };

  const iterZeroEntry = history.find(e => e.majorVersion === 0 && (
    e.entryType === 'initial_state' || 
    e.entryType === 'ensemble_integration'
  ));

  if (iterZeroEntry && iterZeroEntry.productDiff) {
    try {
      const patchedResult = Diff.applyPatch("", iterZeroEntry.productDiff);
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
    currentText = normalizeNewlines(baseFileManifestInput);
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
          console.warn(`reconstructProduct: Patch for Version ${formatVersion(logEntry)} was non-empty but parsed to zero hunks. Treating as no-op.`);
          continue;
      }
      if (patchObjects.length > 1) {
        console.warn(`reconstructProduct: Patch for Version ${formatVersion(logEntry)} parsed into ${patchObjects.length} objects. Applying only the first.`);
      }

      const patchedResult = Diff.applyPatch(currentText, logEntry.productDiff!);

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
