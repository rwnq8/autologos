---
created: 2025-05-18T10:00:00Z # Placeholder
modified: 2025-05-18T10:00:00Z # Placeholder
---
# AIOS_EngineFile_Schema_v1.2 (Fully Explicit)
# Schema for AIOS Engine v3.0 Alpha (Function-Driven, autologos-Orchestrated)
# Version 1.2: Defines the file structure for the v3.0 Alpha Engine.
# Reflects the function-driven architecture and the use of Internal Autologos for logic.
# All definitions herein are explicit and self-contained for this version.

$schema: "http://json-schema.org/draft-07/schema#"
title: "AIOS_EngineFile_Schema"
description: "Schema for the AIOS Engine file structure (v1.2 of this schema, for Engine v3.0 Alpha+)."
type: "object"
x-schema-version: "1.2"

properties:
  file_level_metadata:
    description: "The initial YAML frontmatter block (--- delimited) of the Engine file."
    type: "object"
    properties:
      filename: { type: "string", const: "AIOS_Engine", description: "Expected filename (without extension)." }
      id: { type: "string", pattern: "^AIOS_Engine_v3\\.\\d+.*$", description: "Full unique filename for this Engine file instance, WITHOUT extension, e.g., 'AIOS_Engine_v3.0_Alpha'." }
      version: { type: "string", pattern: "^3\\.\\d+.*$", description: "Semantic version of the Engine file instance, e.g., '3.0-Alpha'." }
      title: { type: "string", description: "Human-readable descriptive title, e.g., 'AIOS Engine v3.0 Alpha (Function-Driven Orchestrator)'." }
      path: { type: "string", description: "Intended full save path, WITHOUT extension." }
      project_code: { type: "string", const: "AIOS", description: "Project code for AIOS." }
      purpose: { type: "string", description: "The overall purpose of this Engine definition file." }
      segment_info: { type: "string", description: "'Complete Alpha Draft' or similar status." }
      aliases: { type: "array", items: { type: "string" } }
      type: { type: "string", const: "Process_Engine_SelfContained_MH_Driven", description: "Classification of this file type." }
      conforms_to_schema_version: { type: "string", const: "1.2", description: "Indicates this Engine file conforms to version 1.2 of AIOS_EngineFile_Schema." }
    required:
      - "filename"
      - "id"
      - "version"
      - "title"
      - "path"
      - "project_code"
      - "purpose"
      - "segment_info"
      - "type"
      - "conforms_to_schema_version"
    additionalProperties: true # Allows for user-added frontmatter like created/modified

  engine_content_metadata_block:
    description: "The primary # METADATA YAML comment block, defining the Engine's conceptual properties."
    type: "object"
    properties:
      id: { type: "string", const: "AIOS_Engine_Core", description: "Conceptual ID for the core AIOS application defined by this file." }
      name: { type: "string", pattern: "^AIOS Engine v3\\.\\d+.*$", description: "Human-readable name of the Engine version." }
      version: { type: "string", pattern: "^3\\.\\d+.*$", description: "Engine content version (e.g., '3.0-Alpha'), must match file_level_metadata.version." }
      status: { type: "string", enum: ["Active", "Deprecated", "Experimental"], description: "Development status of this Engine version." }
      description: { type: "string", description: "Describes the Engine's function-driven architecture and use of autologos." }
      type: { type: "string", const: "Process_Engine_SelfContained_MH_Driven" }
      domain: { type: "string", description: "Primary application domain of this AIOS Engine." }
      keywords: { type: "array", items: { type: "string" } }
      relationships:
        type: "object"
        properties:
          process_group: { type: "string", description: "Conceptual grouping of the process this Engine manages." }
          leads_to: { type: "string", description: "Typical outcomes or products of using this Engine." }
          references_cco_schema: { type: "string", pattern: "^SELF:I\\.A\\.AIOS_CCO_Schema_v3\\.\\d+.*$", description: "Reference to the embedded CCO Schema definition." }
          uses_internal_utilities_from: { type: "string", pattern: "^SELF:I\\.B\\.AIOS_Internal_Utilities_v3\\.\\d+.*$", description: "References minimal internal utilities; primary capabilities are AI Cognitive Functions." }
          invokes_meta_process: { type: "string", pattern: "^SELF:I\\.C\\.MRO_Orchestrator_v3\\.\\d+.*$", description: "References the Meta Refinement Output Orchestrator." }
          references_operational_protocols: { type: "string", pattern: "^SELF:I\\.D\\.AIOS_OperationalProtocols_v3\\.\\d+.*$", description: "References the embedded Operational Protocols." } # Added
          references_tid_schema: { type: "string", pattern: "^SELF:I\\.E\\.AIOS_TID_Schema_v1\\.\\d+.*$", description: "References the embedded TID Schema." }
          references_autologos_library: { type: "string", pattern: "^SELF:I\\.F\\.autologos_Function_Library_v3\\.\\d+.*$", description: "References the embedded Autologos Function Library." } # Added
          references_mh_library: { type: "string", pattern: "^SELF:III\\.AIOS_MetaHeuristicLibrary_v3\\.\\d+.*$", description: "References the Meta-Heuristic Library." }
          uses_knowledge_artifacts: {
            type: "array",
            items: { type: "string" },
            description: "Lists key knowledge artifacts used or referenced. CRITICAL: Must include 'function_declarations_v3.0.json' (for AI Cognitive Functions) and 'AIOS_EngineFile_Schema_v1.2.md' (for FEL-MH self-update)."
          }
        required: ["references_cco_schema", "uses_internal_utilities_from", "invokes_meta_process", "references_operational_protocols", "references_tid_schema", "references_autologos_library", "references_mh_library", "uses_knowledge_artifacts"] # Updated required list
        additionalProperties: true
      usage:
        type: "object"
        properties:
          instructions_for_ai: { type: "string", description: "High-level instructions for the AIOS instance operating from this Engine file, emphasizing autologos interpretation and function orchestration." }
        required: ["instructions_for_ai"]
    required: ["id", "name", "version", "status", "description", "type", "relationships", "usage"]
    additionalProperties: true

  markdown_structure:
    description: "Defines the expected sequence and content model of major Markdown H1 sections."
    type: "object"
    properties:
      h1_section_sequence: { "$ref": "#/definitions/H1SectionSequence" }
      section_I_content: { "$ref": "#/definitions/SectionICoreDefinitionsContent_v3" }
      section_II_content: { "$ref": "#/definitions/SectionIIOrchestrationKernelContent_v3" }
      section_III_content: { "$ref": "#/definitions/SectionIIIMetaHeuristicLibraryContent_v3" }
    required: ["h1_section_sequence", "section_I_content", "section_II_content", "section_III_content"]
    additionalProperties: false

definitions:
  H1SectionSequence:
    type: "array"
    description: "Ordered list of required H1 section titles."
    items:
      - { type: "string", const: "# I. CORE EMBEDDED DEFINITIONS" }
      - { type: "string", const: "# II. ORCHESTRATION KERNEL" }
      - { type: "string", const: "# III. META-HEURISTIC (MH) LIBRARY DEFINITIONS" }
    minItems: 3
    maxItems: 3

  AutologosInstructionBlock:
    description: "A block containing Internal Autologos script. This is the structured representation of procedural logic interpreted by the aiOS, conforming to the 'Internal Autologos Specification Alpha v0.2'."
    type: "object"
    properties:
      autologos_version_used: { type: "string", const: "0.2", description: "Version of Internal Autologos syntax this script conforms to." } # Changed to "0.2" literal
      script_description: { type: "string", description: "Optional human-readable summary of what this autologos script does." }
      script_content: { type: "string", description: "The actual Internal Autologos script." }
    required: ["autologos_version_used", "script_content"]
    additionalProperties: false

  InternalComponentMetadata_v3:
    description: "Metadata for components like Meta-Heuristics within their YAML block, specific to v3.0 Engine."
    type: "object"
    properties:
      id: { type: "string", description: "Unique identifier for the component (e.g., 'IFE-MH')." }
      name: { type: "string", description: "Human-readable name of the component." }
      version: { type: "string", pattern: "^3\\.\\d+.*$", description: "Version of this component, aligned with Engine v3.x." }
      status: { type: "string", enum: ["Active", "Deprecated", "Experimental"] }
      description: { type: "string", description: "Describes the component's role in the AIOS application, focusing on its orchestration tasks." }
      type: { type: "string", const: "MetaHeuristic_Definition", description: "Indicates this is a Meta-Heuristic definition." } # Could be other types for other components
      domain: { type: "string", description: "Primary operational domain of this component." }
      keywords: { type: "array", items: { type: "string" } }
      primary_functions_orchestrated: { type: "array", items: {type: "string"}, description: "Names of key AI Cognitive Functions this component typically orchestrates."}
    required: ["id", "name", "version", "status", "description", "type", "primary_functions_orchestrated"]
    additionalProperties: true

  ExplicitYAMLComponent_v3:
    description: "Structure for a component primarily defined by a Markdown preamble and an embedded YAML code block (e.g., a Schema definition like CCO or TID schema)."
    type: "object"
    properties:
      markdown_instructions_for_ai: { type: "string", description: "Instructions for the AI regarding this embedded YAML component." }
      yaml_code_block: { type: "object", additionalProperties: true, description: "The actual YAML definition (e.g., the schema itself)." }
    required: ["markdown_instructions_for_ai", "yaml_code_block"]
    additionalProperties: false

  MinimizedInternalUtilitiesComponent_v3:
    description: "Defines a minimal set of internal utilities for the AIOS Engine, written in Internal Autologos. Most capabilities are external AI Cognitive Functions."
    type: "object"
    properties:
      markdown_instructions_for_ai: { type: "string", description: "Instructions emphasizing that these are for minimal, self-contained internal actions." }
      internal_utility_definitions: {
        type: "array",
        items: { "$ref": "#/definitions/AutologosInstructionBlock" },
        description: "An array of AutologosInstructionBlocks, each defining an internal utility function using 'DEFINE'."
      }
    required: ["markdown_instructions_for_ai", "internal_utility_definitions"]
    additionalProperties: false

  FunctionOrchestratorLogicComponent_v3:
    description: "A component whose core logic is primarily for orchestrating AI Cognitive Functions. This logic is defined in Internal Autologos."
    type: "object"
    properties:
      markdown_instructions_for_ai: { type: "string", description: "Core instructions for this component, emphasizing its role in function orchestration via autologos." }
      orchestration_logic_autologos: { "$ref": "#/definitions/AutologosInstructionBlock", description: "The Internal Autologos script that defines the orchestration logic." }
      descriptive_logic_summary: { type: "string", description: "Optional human-readable summary of what the autologos script orchestrates." }
    required: ["markdown_instructions_for_ai", "orchestration_logic_autologos"]
    additionalProperties: false

  AutologosFunctionLibraryComponent_v3: # Added definition for the Autologos Function Library section
    description: "Defines a library of reusable functions written in Internal Autologos."
    type: "object"
    properties:
      markdown_instructions_for_ai: { type: "string", description: "Instructions for the AI regarding this library." }
      functions: {
        type: "array",
        items: { "$ref": "#/definitions/AutologosInstructionBlock" },
        description: "A list of globally available Internal Autologos function definitions."
      }
    required: ["markdown_instructions_for_ai", "functions"]
    additionalProperties: false

  MetaHeuristicDefinition_v3:
    description: "Structure for an individual Meta-Heuristic definition in the v3.0 function-driven, autologos-orchestrated Engine."
    type: "object",
    properties:
      markdown_h3_header: { type: "string", pattern: "^### III\\.[A-Z]\\. `[A-Z]{2,}-MH`.*$", description: "Expected format for MH section headers (e.g., ### III.A. `IFE-MH`)." }
      markdown_instructions_for_ai_mh_level: { type: "string", description: "Overall instructions for this MH, emphasizing its role in orchestrating AI Cognitive Functions using autologos to achieve a specific phase of a process." }
      yaml_code_block:
        type: "object"
        properties:
          metadata_comment_block: { "$ref": "#/definitions/InternalComponentMetadata_v3" }
          instructions_for_ai_yaml: { type: "string", description: "Specific instructions for the AI on how to interpret and execute the autologos script for this MH, including key functions it will orchestrate." }
          trigger: { type: "string", description: "Natural language description of when this MH (and its autologos script) is typically triggered by the Kernel." }
          inputs_description_json_schema: { type: "object", additionalProperties: true, description: "A JSON schema object describing the expected inputs to this MH (which are often passed as JSON to its initial AI Cognitive Function calls)." }
          process_steps_autologos: { "$ref": "#/definitions/AutologosInstructionBlock", description: "The core logic of the MH, written in Internal Autologos, orchestrating AI Cognitive Functions." }
          outputs_description_json_schema: { type: "object", additionalProperties: true, description: "A JSON schema object describing the expected outputs from this MH (often aggregated from the results of AI Cognitive Function calls)." }
        required: ["metadata_comment_block", "instructions_for_ai_yaml", "trigger", "inputs_description_json_schema", "process_steps_autologos", "outputs_description_json_schema"]
        additionalProperties: true # Allows for MH-specific fields if needed in future
    required: ["markdown_h3_header", "markdown_instructions_for_ai_mh_level", "yaml_code_block"]
    additionalProperties: false

  SectionICoreDefinitionsContent_v3:
    description: "Defines the expected sub-components within Section I for v3.0."
    type: "object"
    properties:
      aios_cco_schema: { "$ref": "#/definitions/ExplicitYAMLComponent_v3", description: "Defines the AIOS_CCO_Schema_v3_0." }
      aios_internal_utilities: { "$ref": "#/definitions/MinimizedInternalUtilitiesComponent_v3", description: "Defines AIOS_Internal_Utilities_v3_0." }
      mro_orchestrator: { "$ref": "#/definitions/FunctionOrchestratorLogicComponent_v3", description: "Defines MRO_Orchestrator_v3_0." }
      aios_operational_protocols: { "$ref": "#/definitions/FunctionOrchestratorLogicComponent_v3", description: "Defines AIOS_OperationalProtocols_v3_0." }
      aios_tid_schema: { "$ref": "#/definitions/ExplicitYAMLComponent_v3", description: "Defines AIOS_TID_Schema_v1_2." }
      autologos_function_library: { "$ref": "#/definitions/AutologosFunctionLibraryComponent_v3", description: "Defines the autologos_Function_Library_v3_0." } # Added
    required: ["aios_cco_schema", "aios_internal_utilities", "mro_orchestrator", "aios_operational_protocols", "aios_tid_schema", "autologos_function_library"] # Updated required list
    additionalProperties: false

  SectionIIOrchestrationKernelContent_v3:
    description: "Defines the content model for Section II (Kernel v3.0)."
    allOf:
      - { "$ref": "#/definitions/FunctionOrchestratorLogicComponent_v3" }

  SectionIIIMetaHeuristicLibraryContent_v3:
    description: "Defines the content model for Section III (MH Library v3.0)."
    type: "object"
    properties:
      library_instructions_for_ai: { type: "string", description: "Overall instructions for the MH Library, emphasizing function call orchestration via autologos." }
      meta_heuristics_list:
        type: "array"
        items: { "$ref": "#/definitions/MetaHeuristicDefinition_v3" }
        minItems: 1 # At least one MH (e.g., FEL-MH) should be defined
    required: ["library_instructions_for_ai", "meta_heuristics_list"]
    additionalProperties: false

required: ["file_level_metadata", "engine_content_metadata_block", "markdown_structure"]
additionalProperties: false