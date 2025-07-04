// types/project.ts

import type { AutologosIterativeEngineData } from './state';

export const THIS_APP_ID = "com.autologos.iterativeengine";
export const APP_VERSION = "2.0.0"; // Version bump for new versioning system
export const AUTOLOGOS_PROJECT_FILE_FORMAT_VERSION = "AutologosProjectFile/2.0"; // Version Bump for new versioning

export interface LoadedFile {
  name: string;
  mimeType: string;
  content: string;
  size: number;
}

export interface ReconstructedProductResult {
  product: string;
  error?: string;
}

export interface FileProcessingInfo {
  filesSentToApiIteration: number | null;
  numberOfFilesActuallySent: number;
  totalFilesSizeBytesSent: number;
  fileManifestProvidedCharacterCount: number;
  loadedFilesForIterationContext?: LoadedFile[];
}

export interface ThemeHints {
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
}

export interface AppManifestEntry {
  appId: string;
  appName: string;
  appVersion: string;
  dataDescription: string;
}

export interface ProjectFileHeader {
  fileFormatVersion: string;
  projectId: string;
  projectName: string;
  projectObjective?: string;
  createdAt: string;
  lastModifiedAt: string;
  lastExportedByAppId?: string;
  lastExportedByAppVersion?: string;
  themeHints?: ThemeHints;
  appManifest?: AppManifestEntry[];
}

export interface AutologosProjectFile {
  header: ProjectFileHeader;
  applicationData: {
    [appId: string]: AutologosIterativeEngineData;
  };
}
