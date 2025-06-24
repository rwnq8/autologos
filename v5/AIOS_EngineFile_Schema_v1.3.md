---
modified: 2025-05-24T04:38:53Z
---
# AIOS_EngineFile_Schema_v1.3 (Fully Explicit)
# Schema for AIOS Engine v3.x+ (Function-Driven, Autologos-Orchestrated Framework)
# Version 1.3: Defines the file structure for v3.x+ Engines.
# Emphasizes function-driven architecture and embedded Internal Autologos for logic.

$schema: "http://json-schema.org/draft-07/schema#"
title: "AIOS_EngineFile_Schema"
description: "Schema for the AIOS Engine file structure (v1.3 of this schema, for Engine v3.x+)."
type: "object"
x-schema-version: "1.3"

properties:
  file_level_metadata:
    description: "The initial YAML frontmatter block (--- delimited) of the Engine file."
    type: "object"
    properties:
      filename: { type: "string", description: "Conceptual base name, e.g., 'AIOS_Engine'." }
      id: { type: "string", description: "Full unique filename for this Engine file instance, WITHOUT extension, e.g., 'AIOS_Engine_v3.3.3_autonomous_stubs'." }
      version: { type: "string", description: "Semantic version of the Engine file instance, e.g., '3.3.3-autonomous_stubs'." }
      title: { type: "string", description: "Human-readable descriptive title." }
      path: { type: "string", description: "Intended full save path, WITHOUT extension." }
      project_code: { type: "string" }
      purpose: { type: "string" }
      segment_info: { type: "string", description: "'Complete Draft' or similar." }
      type: { type: "string", const: "Process_Engine_SelfContained_MH_Driven" }
      conforms_to_schema_version: { type: "string", pattern: "^1\\.3$", description: "Must conform to this schema version (v1.3)." }
    required: ["filename","id","version","title","path","project_code","purpose","segment_info","type","conforms_to_schema_version"]
    additionalProperties: true

  engine_content_metadata_block:
    description: "The primary # METADATA YAML comment block, defining the Engine's conceptual properties."
    type: "object"
    properties:
      id: { type: "string" } 
      name: { type: "string", pattern: "^AIOS Engine v[3-9]\\.\\d+.*$" } 
      version: { type: "string", description: "Engine content version, must match file_level_metadata.version." }
      status: { type: "string", enum: ["Active", "Deprecated", "Experimental"] }
      description: { type: "string", description: "Describes the Engine's function-driven architecture and use of autologos." }
      type: { type: "string", const: "Process_Engine_SelfContained_MH_Driven" }
      domain: { type: "string" }
      keywords: { type: "array", items: { type: "string" } }
      relationships:
        type: "object"
        properties:
          references_cco_schema: { type: "string", pattern: "^SELF:I\\.A\\..*CCO_Schema_v3\\.\\d+.*$" }
          uses_internal_utilities_from: { type: "string", pattern: "^SELF:I\\.B\\..*Internal_Utilities_v3\\.\\d+.*$" }
          invokes_meta_process: { type: "string", pattern: "^SELF:I\\.C\\..*MRO_Orchestrator_v3\\.\\d+.*$" }
          references_operational_protocols: { type: "string", pattern: "^SELF:I\\.D\\..*OperationalProtocols_v3\\.\\d+.*$" }
          references_tid_schema: { type: "string", pattern: "^SELF:I\\.E\\..*TID_Schema_v1\\.\\d+.*$" }
          references_autologos_library: { type: "string", pattern: "^SELF:I\\.F\\.autologos_Function_Library_v3\\.\\d+.*$" }
          references_embedded_autologos_syntax: { type: "string", pattern: "^SELF:I\\.G\\.autologos_Syntax_Specification_v0\\.2_Embedded$" }
          references_mh_library: { type: "string", pattern: "^SELF:III\\..*MetaHeuristicLibrary_v3\\.\\d+.*$" }
          uses_knowledge_artifacts: { type: "array", items: { type: "string" }, description: "Includes 'function_declarations_vX.Y.json' and 'AIOS_EngineFile_Schema_v1.3.md'."}
        required: ["references_cco_schema", "uses_internal_utilities_from", "invokes_meta_process", "references_operational_protocols", "references_tid_schema", "references_autologos_library", "references_embedded_autologos_syntax", "references_mh_library", "uses_knowledge_artifacts"]
        additionalProperties: true
      usage:
        type: "object"
        properties:
          instructions_for_ai: { type: "string", description: "High-level instructions emphasizing autologos interpretation and function orchestration." }
        required: ["instructions_for_ai"]
    required: ["id", "name", "version", "status", "description", "type", "relationships", "usage"]
    additionalProperties: true

  markdown_structure: { "$ref": "#/definitions/MarkdownStructure_v1_3" }

definitions:
  MarkdownStructure_v1_3:
    description: "Defines the expected sequence and content model of major Markdown H1 sections for Engine File Schema v1.3."
    type: "object"
    properties:
      h1_section_sequence: { "$ref": "#/definitions/H1SectionSequence_v1_3" }
      section_I_content: { "$ref": "#/definitions/SectionICoreDefinitionsContent_v1_3" }
      section_II_content: { "$ref": "#/definitions/SectionIIOrchestrationKernelContent_v1_3" }
      section_III_content: { "$ref": "#/definitions/SectionIIIMetaHeuristicLibraryContent_v1_3" }
      section_IV_content: { "$ref": "#/definitions/SectionIVAppendicesContent_v1_3" } # Optional, for future use like detailed KA stubs
      section_V_content: { "$ref": "#/definitions/SectionVChangeLogContent_v1_3" }
    required: ["h1_section_sequence", "section_I_content", "section_II_content", "section_III_content", "section_V_content"]
    additionalProperties: false

  H1SectionSequence_v1_3:
    type: "array",
    description: "Ordered list of required H1 section titles for v1.3."
    items:
      - { type: "string", const: "# I. CORE EMBEDDED DEFINITIONS" }
      - { type: "string", const: "# II. ORCHESTRATION KERNEL" }
      - { type: "string", const: "# III. META-HEURISTIC (MH) LIBRARY DEFINITIONS" }
      - { type: "string", const: "# IV. APPENDICES (Optional)" } # Made optional for now
      - { type: "string", const: "# V. CHANGE LOG" }
    minItems: 4 # I, II, III, V are mandatory
    maxItems: 5

  AutologosInstructionBlock_v0_2: 
    description: "A block containing Internal Autologos script, conforming to Alpha v0.2."
    type: "object"
    properties:
      autologos_version_used: { type: "string", const: "0.2" }
      script_description: { type: "string" }
      script_content: { type: "string" }
    required: ["autologos_version_used", "script_content"]
    additionalProperties: false

  InternalComponentMetadata_v3_plus:
    description: "Metadata for components like MHs, for Engine v3.x+."
    type: "object"
    properties:
      id: { type: "string" }; name: { type: "string" }; version: { type: "string", pattern: "^[3-9]\\.\\d+.*$" }; status: { type: "string", enum: ["Active", "Deprecated", "Experimental"] }; description: { type: "string" }; type: { type: "string" }; domain: { type: "string" }; keywords: { type: "array", items: { type: "string" } }; primary_functions_orchestrated: { type: "array", items: {type: "string"}}
    required: ["id", "name", "version", "status", "description", "type", "primary_functions_orchestrated"]
    additionalProperties: true

  ExplicitYAMLComponent_v3_plus: 
    description: "Structure for a component defined by Markdown and YAML (e.g., Schema definition)."
    type: "object"
    properties:
      markdown_instructions_for_ai: { type: "string" }
      yaml_code_block: { type: "object", additionalProperties: true }
    required: ["markdown_instructions_for_ai", "yaml_code_block"]
    additionalProperties: false

  FunctionOrchestratorLogicComponent_v3_plus: 
    description: "A component whose core logic is orchestrating external functions, defined in Internal Autologos."
    type: "object"
    properties:
      markdown_instructions_for_ai: { type: "string" }
      orchestration_logic_autologos: { "$ref": "#/definitions/AutologosInstructionBlock_v0_2" }
      descriptive_logic_summary: { type: "string" }
    required: ["markdown_instructions_for_ai", "orchestration_logic_autologos"]
    additionalProperties: false
  
  AutologosFunctionLibraryComponent_v3_plus:
    description: "Defines a library of reusable functions written in Internal Autologos."
    type: "object"
    properties:
      markdown_instructions_for_ai: { type: "string" }
      functions: { type: "array", items: { "$ref": "#/definitions/AutologosInstructionBlock_v0_2" } }
    required: ["markdown_instructions_for_ai", "functions"]
    additionalProperties: false

  MetaHeuristicDefinition_v3_plus:
    description: "Structure for an individual Meta-Heuristic definition for Engine v3.x+."
    type: "object",
    properties:
      markdown_h3_header: { type: "string", pattern: "^### [IVXLCDM]+\\.[A-Z]\\. `[A-Z]{2,}-MH`.*$" } # More flexible H3
      markdown_instructions_for_ai_mh_level: { type: "string" }
      yaml_code_block:
        type: "object"
        properties:
          metadata_comment_block: { "$ref": "#/definitions/InternalComponentMetadata_v3_plus" }
          instructions_for_ai_yaml: { type: "string" }
          trigger: { type: "string" }
          inputs_description_json_schema: { type: "object", additionalProperties: true }
          process_steps_autologos: { "$ref": "#/definitions/AutologosInstructionBlock_v0_2" }
          outputs_description_json_schema: { type: "object", additionalProperties: true }
        required: ["metadata_comment_block", "instructions_for_ai_yaml", "trigger", "inputs_description_json_schema", "process_steps_autologos", "outputs_description_json_schema"]
        additionalProperties: true
    required: ["markdown_h3_header", "markdown_instructions_for_ai_mh_level", "yaml_code_block"]
    additionalProperties: false

  SectionICoreDefinitionsContent_v1_3:
    description: "Defines sub-components within Section I for Schema v1.3."
    type: "object"
    properties:
      aios_cco_schema: { "$ref": "#/definitions/ExplicitYAMLComponent_v3_plus" }
      aios_internal_utilities: { "$ref": "#/definitions/FunctionOrchestratorLogicComponent_v3_plus" } # Changed from MinimizedInternalUtilitiesComponent
      mro_orchestrator: { "$ref": "#/definitions/FunctionOrchestratorLogicComponent_v3_plus" }
      aios_operational_protocols: { "$ref": "#/definitions/FunctionOrchestratorLogicComponent_v3_plus" }
      aios_tid_schema: { "$ref": "#/definitions/ExplicitYAMLComponent_v3_plus" }
      autologos_function_library: { "$ref": "#/definitions/AutologosFunctionLibraryComponent_v3_plus" }
      embedded_autologos_syntax_spec: { "$ref": "#/definitions/ExplicitYAMLComponent_v3_plus", "description": "The embedded Internal Autologos Syntax Specification (e.g., v0.2)." }
    required: ["aios_cco_schema", "aios_internal_utilities", "mro_orchestrator", "aios_operational_protocols", "aios_tid_schema", "autologos_function_library", "embedded_autologos_syntax_spec"]
    additionalProperties: false

  SectionIIOrchestrationKernelContent_v1_3:
    description: "Defines content model for Section II (Kernel) for Schema v1.3."
    allOf: [ { "$ref": "#/definitions/FunctionOrchestratorLogicComponent_v3_plus" } ]

  SectionIIIMetaHeuristicLibraryContent_v1_3:
    description: "Defines content model for Section III (MH Library) for Schema v1.3."
    type: "object"
    properties:
      library_instructions_for_ai: { type: "string" }
      meta_heuristics_list: { type: "array", items: { "$ref": "#/definitions/MetaHeuristicDefinition_v3_plus" }, minItems: 1 }
    required: ["library_instructions_for_ai", "meta_heuristics_list"]
    additionalProperties: false
  
  SectionIVAppendicesContent_v1_3:
    description: "Optional. Defines content model for Section IV (Appendices) for Schema v1.3."
    type: "object"
    properties:
      appendix_items: { 
        type: "array", 
        items: { 
          type: "object", 
          properties: {
            appendix_title: {type: "string"},
            appendix_content_markdown: {type: "string"}
          },
          required: ["appendix_title", "appendix_content_markdown"]
        } 
      }
    additionalProperties: true

  SectionVChangeLogContent_v1_3:
    description: "Defines content model for Section V (Change Log) for Schema v1.3."
    type: "object"
    properties:
      change_log_intro_markdown: { type: "string", description: "Optional introductory text for the changelog."}
      change_log_entries_markdown: { type: "string", description: "The main changelog content as a Markdown string, typically using H2 or H3 for versions."}
    required: ["change_log_entries_markdown"]
    additionalProperties: false

required: ["file_level_metadata", "engine_content_metadata_block", "markdown_structure"]
additionalProperties: false