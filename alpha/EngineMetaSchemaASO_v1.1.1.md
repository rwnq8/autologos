---
created: 2025-05-16T02:30:16Z
modified: 2025-05-16T02:32:25Z
---
# EngineMetaSchemaASO_v1.1.1 (Fully Explicit)
# A machine-readable schema defining the structure of MetaProcessEngineASO.md files.
# Version 1.1.1: Adjusted for no file extensions in 'id' and 'path' fields for Obsidian context.
# All definitions herein are explicit and self-contained for this version.

$schema: "http://json-schema.org/draft-07/schema#"
title: "EngineMetaSchemaASO"
description: "Schema for the MetaProcessEngineASO.md file structure (v1.1.1 of this schema)."
type: "object"
engine_meta_schema_version: "1.1.1"

properties:
  file_level_metadata:
    description: "The initial YAML frontmatter block (--- delimited) of the Engine file."
    type: "object"
    properties:
      filename: { type: "string", description: "Conceptual base name, e.g., 'MetaProcessEngineASO'." }
      id: { type: "string", description: "Full unique filename for this Engine file instance, WITHOUT extension, e.g., 'MetaProcessEngineASO_v2.6'." }
      version: { type: "string", description: "Semantic version of the Engine file instance, e.g., '2.6'." }
      title: { type: "string", description: "Human-readable descriptive title." }
      path: { type: "string", description: "Intended full save path, WITHOUT extension, e.g., 'process/MetaProcessEngineASO_v2.6'." }
      project_code: { type: "string" }
      purpose: { type: "string" }
      segment_info: { type: "string" } # "Complete" or platform segment info
      aliases: { type: "array", items: { type: "string" }, optional: true }
      type: { type: "string", const: "Process_Engine_SelfContained_MH_Driven", description: "File type classification. Assumed .md in Obsidian." }
      conforms_to_engine_meta_schema_version: { type: "string", const: "1.1.1" }
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
      - "conforms_to_engine_meta_schema_version"
    additionalProperties: true

  engine_content_metadata_block:
    description: "The primary # METADATA YAML comment block immediately following file-level frontmatter, defining the Engine's conceptual properties."
    type: "object"
    properties:
      id: { type: "string", const: "MetaProcessEngineASO" }
      name: { type: "string", pattern: "^Meta Process Engine \\(Autonomous Self-Improving Orchestrator v\\d+\\.\\d+.*\\)$" }
      version: { type: "string", description: "Engine content version, must match file_level_metadata.version." }
      status: { type: "string", enum: ["Active", "Deprecated", "Experimental"] }
      description: { type: "string" }
      type: { type: "string", const: "Process_Engine_SelfContained_MH_Driven" }
      domain: { type: "string" }
      keywords: { type: "array", items: { type: "string" } }
      relationships:
        type: "object"
        properties:
          process_group: { type: "string", optional: true }
          leads_to: { type: "string", optional: true }
          references_schema: { type: "string", pattern: "^SELF:I\\.A\\..*$" }
          uses_skills_from: { type: "string", pattern: "^SELF:I\\.B\\..*$" }
          invokes_meta_process: { type: "string", pattern: "^SELF:I\\.C\\..*$" }
          uses_knowledge_artifacts: { type: "array", items: {type: "string"} }
        required: ["references_schema", "uses_skills_from", "invokes_meta_process", "uses_knowledge_artifacts"]
      usage:
        type: "object"
        properties:
          instructions_for_ai: { type: "string" }
        required: ["instructions_for_ai"]
    required: ["id", "name", "version", "status", "description", "type", "usage"]
    additionalProperties: true

  markdown_structure:
    description: "Defines the expected sequence and content model of major Markdown H1 sections."
    type: "object"
    properties:
      h1_section_sequence:
        type: "array"
        description: "Ordered list of required H1 section titles."
        items:
          - { type: "string", const: "# I. CORE EMBEDDED DEFINITIONS" }
          - { type: "string", const: "# II. ORCHESTRATION KERNEL" }
          - { type: "string", const: "# III. META-HEURISTIC (MH) LIBRARY DEFINITIONS" }
      section_I_content: { $ref: "#/definitions/SectionICoreDefinitionsContent" }
      section_II_content: { $ref: "#/definitions/SectionIIOrchestrationKernelContent" }
      section_III_content: { $ref: "#/definitions/SectionIIIMHLibraryContent" }
    required: ["h1_section_sequence", "section_I_content", "section_II_content", "section_III_content"]
    additionalProperties: true

definitions:
  InternalComponentMetadata:
    description: "Reusable definition for component-level # METADATA comment blocks within YAML definitions."
    type: "object"
    properties:
      id: { type: "string", description: "Unique identifier for the component, e.g., 'ProjectStateSchemaASO', 'IFE-MH'." }
      name: { type: "string", optional: true, description: "Human-readable name, e.g., 'Project State Schema ASO v2.6'." }
      version: { type: "string", optional: true, description: "Version of this component, often tied to parent Engine version." }
      status: { type: "string", enum: ["Active", "Experimental", "Deprecated"], optional: true }
      description: { type: "string", optional: true }
    required: ["id"]
    additionalProperties: true

  ExplicitYAMLComponent:
    description: "Structure for a component primarily defined by a Markdown preamble (instructions) and a YAML code block (e.g., Schemas, KAs, Skill Catalog)."
    type: "object"
    properties:
      markdown_instructions_for_ai: { type: "string", description: "Markdown block (e.g., blockquote) preceding the YAML, guiding AI use." }
      yaml_code_block:
        type: "object" # Represents the parsed YAML from the code block.
        properties:
          metadata_comment_block: { $ref: "#/definitions/InternalComponentMetadata", description: "The # METADATA at start of YAML content." }
          yaml_content_structure_specific_to_component_type: { type: "object", description: "Placeholder for the component-specific fields. Actual validation requires a sub-schema."}
        required: ["metadata_comment_block", "yaml_content_structure_specific_to_component_type"]
        yaml_content_sub_schema_ref: { type: "string", optional: true, description: "Reference to a specific sub-schema for validating the yaml_content_structure (e.g., 'ProjectStateSchemaDefinitionSchema_v1.0'). Future enhancement." }
    required: ["markdown_instructions_for_ai", "yaml_code_block"]

  LogicComponent:
    description: "Structure for a component primarily defined by descriptive logic/steps in Markdown (e.g., Kernel, MetaRefineOutput)."
    type: "object"
    properties:
      markdown_instructions_for_ai: { type: "string", description: "Core instructions for this logic block." }
      descriptive_content_markdown: { type: "string", description: "The main body of text detailing principles, steps, logic." }
    required: ["markdown_instructions_for_ai", "descriptive_content_markdown"]

  MetaHeuristicDefinition:
    description: "Structure for an individual Meta-Heuristic definition within the MH Library."
    type: "object"
    properties:
      markdown_h3_header: { type: "string", pattern: "^### III\\.[A-Z]\\. `[A-Z]{3,}-MH`.*$", description: "Expected format for MH section headers." }
      markdown_instructions_for_ai_mh_level: { type: "string", description: "Overall instructions for the MH, in Markdown, preceding its YAML definition."}
      yaml_code_block:
        type: "object" # Represents the parsed YAML content of the MH definition.
        properties:
          metadata_comment_block: { $ref: "#/definitions/InternalComponentMetadata", description: "MH's own # METADATA block within the YAML." }
          instructions_for_ai_yaml: { type: "string", description: "Specific instructions for AI on using this MH, within the YAML." }
          trigger: { type: "string", description: "Natural language description of when this MH is triggered." }
          inputs: { type: "string", description: "Natural language description of inputs." }
          process_steps: { type: "string", description: "Natural language description of process steps." }
          outputs: { type: "string", description: "Natural language description of outputs." }
        required:
          - "metadata_comment_block"
          - "instructions_for_ai_yaml"
          - "trigger"
          - "inputs"
          - "process_steps"
          - "outputs"
        yaml_content_sub_schema_ref: { type: "string", const: "MH_DefinitionSubSchema_v1.0", optional: true, description: "Points to a conceptual sub-schema for MH YAML structure." }
    required: ["markdown_h3_header", "markdown_instructions_for_ai_mh_level", "yaml_code_block"]

  SectionICoreDefinitionsContent:
    description: "Defines the expected sub-components within Section I."
    type: "object"
    properties:
      project_state_schema: { $ref: "#/definitions/ExplicitYAMLComponent" }
      ai_skills_catalog: { $ref: "#/definitions/ExplicitYAMLComponent" }
      meta_refine_output: { $ref: "#/definitions/LogicComponent" }
      ai_operational_protocols: { $ref: "#/definitions/ExplicitYAMLComponent" }
      tid_schema: { $ref: "#/definitions/ExplicitYAMLComponent" }
    required:
      - "project_state_schema"
      - "ai_skills_catalog"
      - "meta_refine_output"
      - "ai_operational_protocols"
      - "tid_schema"
    additionalProperties: false

  SectionIIOrchestrationKernelContent:
    description: "Defines the content model for Section II."
    allOf:
      - { $ref: "#/definitions/LogicComponent" }

  SectionIIIMHLibraryContent:
    description: "Defines the content model for Section III."
    type: "object"
    properties:
      library_instructions_for_ai: { type: "string", description: "Overall instructions for the MH Library section." }
      meta_heuristics_list:
        type: "array"
        description: "List of all MH definitions."
        items: { $ref: "#/definitions/MetaHeuristicDefinition" }
        minItems: 1
    required: ["library_instructions_for_ai", "meta_heuristics_list"]

required:
  - "file_level_metadata"
  - "engine_content_metadata_block"
  - "markdown_structure"