// services/versionUtils.ts
import type { IterationLogEntry, Version } from '../types.ts';

/**
 * Formats a Version object into a standard string.
 * e.g., v1.0, v0.0.1 (for ensemble sub-iterations)
 */
export const formatVersion = (entry: Version | IterationLogEntry): string => {
  const major = 'majorVersion' in entry ? entry.majorVersion : entry.major;
  const minor = 'minorVersion' in entry ? entry.minorVersion : entry.minor;
  const patch = 'patchVersion' in entry ? entry.patchVersion : (entry as Version).patch;

  if (patch !== undefined && patch !== null) {
    return `v${major}.${minor}.${patch}`;
  }
  return `v${major}.${minor}`;
};

/**
 * A comparison function for sorting IterationLogEntry objects by version.
 */
export const compareVersions = (a: IterationLogEntry | Version, b: IterationLogEntry | Version): number => {
  const aMajor = 'majorVersion' in a ? a.majorVersion : a.major;
  const bMajor = 'majorVersion' in b ? b.majorVersion : b.major;
  if (aMajor !== bMajor) {
    return aMajor - bMajor;
  }

  const aMinor = 'minorVersion' in a ? a.minorVersion : a.minor;
  const bMinor = 'minorVersion' in b ? b.minorVersion : b.minor;
  if (aMinor !== bMinor) {
    return aMinor - bMinor;
  }
  
  const aPatch = ('patchVersion' in a ? a.patchVersion : (a as Version).patch) || 0;
  const bPatch = ('patchVersion' in b ? b.patchVersion : (b as Version).patch) || 0;
  return aPatch - bPatch;
};
