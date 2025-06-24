---
created: 2025-05-18T09:00:00Z # Placeholder
modified: 2025-05-18T09:00:00Z # Placeholder
---
# AIOS_EngineFile_Schema_v1.2.0-MVP (Fully Explicit)
# Minimal Schema for AIOS Engine v3.0 MVP (Function-Driven, autologos-Orchestrated)
# Version 1.2.0-MVP: Defines the MINIMAL file structure for the v3.0 MVP Engine.
# Focuses on demonstrating autologos orchestration of a single external function.
# All definitions herein are explicit and self-contained for this version.

$schema: "http://json-schema.org/draft-07/schema#"
title: "AIOS_EngineFile_Schema_MVP"
description: "Minimal Schema for the AIOS Engine MVP file structure (v1.2.0-MVP)."
type: "object"
x-schema-version: "1.2.0-MVP"

properties:
  file_level_metadata:
    description: "The initial YAML frontmatter block (--- delimited) of the Engine file."
    type: "object"
    properties:
      filename: { type: "string", const: "AIOS_Engine_MVP" }
      id: { type: "string", const: "AIOS_Engine_v3.0_MVP" }
      version: { type: "string", const: "3.0-MVP" }
      title: { type: "string", description: "Human-readable descriptive title for the MVP." }
      path: { type: "string", description: "Intended save path." }
      project_code: { type: "string", const: "AIOS_MVP" }
      purpose: { type: "string", description: "Purpose of the MVP." }
      segment_info: { type: "string", const: "MVP Draft" }
      type: { type: "string", const: "Process_Engine_SelfContained_MH_Driven" }
      conforms_to_schema_version: { type: "string", const: "1.2.0-MVP" }
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
    additionalProperties: true

  engine_content_metadata_block:
    description: "The primary # METADATA YAML comment block."
    type: "object"
    properties:
      id: { type: "string", const: "AIOS_Engine_MVP_Core" }
      name: { type: "string", const: "AIOS Engine v3.0 MVP" }
      version: { type: "string", const: "3.0-MVP" }
      status: { type: "string", const: "Experimental" }
      description: { type: "string", description: "Describes the MVP's function-driven nature." }
      type: { type: "string", const: "Process_Engine_SelfContained_MH_Driven" }
      relationships:
        type: "object"
        properties:
          uses_knowledge_artifacts: {
            type: "array",
            items: { type: "string" },
            description: "Includes critical reference to external function declarations (e.g., 'function_declarations_mvp.json')."
          }
        required: ["uses_knowledge_artifacts"]
        additionalProperties: true
      usage:
        type: "object"
        properties:
          instructions_for_ai: { type: "string", description: "High-level instructions for the MVP." }
        required: ["instructions_for_ai"]
    required: ["id", "name", "version", "status", "description", "type", "relationships", "usage"]
    additionalProperties: true

  markdown_structure:
    description: "Defines the expected sequence and content model of major Markdown H1 sections for the MVP."
    type: "object"
    properties:
      h1_section_sequence:
        type: "array"
        items:
          - { type: "string", const: "# I. CORE EMBEDDED DEFINITIONS (MVP)" } # Minimal sections
          - { type: "string", const: "# II. ORCHESTRATION KERNEL (MVP)" }
        minItems: 2
        maxItems: 2
      section_I_content: { "$ref": "#/definitions/SectionICoreDefinitionsContent_MVP" }
      section_II_content: { "$ref": "#/definitions/SectionIIOrchestrationKernelContent_MVP" }
    required: ["h1_section_sequence", "section_I_content", "section_II_content"]
    additionalProperties: false

definitions:
  AutologosInstructionBlock: # Defines where Internal Autologos scripts live
    description: "A block containing Internal Autologos script."
    type: "object"
    properties:
      autologos_version_used: { type: "string", const: "0.2" }
      script_content: { type: "string", description: "The actual Internal Autologos script." }
      script_description: { type: "string", description: "Optional human-readable description." }
    required: ["autologos_version_used", "script_content"]
    additionalProperties: false

  ExplicitYAMLComponent_MVP: # For minimal schemas
    description: "Structure for a component defined by Markdown and YAML (Schema definition)."
    type: "object"
    properties:
      markdown_instructions_for_ai: { type: "string" }
      yaml_code_block: { type: "object", additionalProperties: true, description: "The actual YAML schema definition." }
    required: ["markdown_instructions_for_ai", "yaml_code_block"]
    additionalProperties: false

  FunctionOrchestratorLogicComponent_MVP: # For Kernel logic
    description: "A component whose core logic is orchestrating external functions, defined in Internal Autologos."
    type: "object"
    properties:
      markdown_instructions_for_ai: { type: "string", description: "Core instructions for the MVP logic." }
      orchestration_logic_autologos: { "$ref": "#/definitions/AutologosInstructionBlock" }
    required: ["markdown_instructions_for_ai", "orchestration_logic_autologos"]
    additionalProperties: false

  SectionICoreDefinitionsContent_MVP:
    description: "Defines the MINIMAL sub-components within Section I for the MVP."
    type: "object"
    properties:
      project_state_schema: { "$ref": "#/definitions/ExplicitYAMLComponent_MVP" } # Minimal CCO Schema
      aios_operational_protocols: { "$ref": "#/definitions/FunctionOrchestratorLogicComponent_MVP" } # Minimal Protocols
      tid_schema: { "$ref": "#/definitions/ExplicitYAMLComponent_MVP" } # Minimal TID Schema
    required: ["project_state_schema", "aios_operational_protocols", "tid_schema"]
    additionalProperties: false

  SectionIIOrchestrationKernelContent_MVP:
    description: "Defines the content model for Section II (Kernel MVP)."
    allOf:
      - { "$ref": "#/definitions/FunctionOrchestratorLogicComponent_MVP" }

required: ["file_level_metadata", "engine_content_metadata_block", "markdown_structure"]
additionalProperties: false