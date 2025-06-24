---
created: 2025-05-16T19:14:04Z
modified: 2025-05-16T23:53:01Z
---
{
  "title": "EngineMetaSchemaASO",
  "description": "Schema for the MetaProcessEngineASO.md file structure (v1.1.2 of this schema). This is an OpenAPI Schema Object representation, compatible with Google AI Studio.",
  "type": "object",
  "x-engine-meta-schema-version": "1.1.2",
  "properties": {
    "file_level_metadata": {
      "description": "The initial YAML frontmatter block (--- delimited) of the Engine file.",
      "type": "object",
      "properties": {
        "filename": {
          "type": "string",
          "description": "Conceptual base name, e.g., 'MetaProcessEngineASO'."
        },
        "id": {
          "type": "string",
          "description": "Full unique filename for this Engine file instance, WITHOUT extension, e.g., 'MetaProcessEngineASO_v2.6'."
        },
        "version": {
          "type": "string",
          "description": "Semantic version of the Engine file instance, e.g., '2.6'."
        },
        "title": {
          "type": "string",
          "description": "Human-readable descriptive title."
        },
        "path": {
          "type": "string",
          "description": "Intended full save path, WITHOUT extension, e.g., 'process/MetaProcessEngineASO_v2.6'."
        },
        "project_code": {
          "type": "string"
        },
        "purpose": {
          "type": "string"
        },
        "segment_info": {
          "type": "string",
          "description": "'Complete' or platform segment info."
        },
        "aliases": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "type": {
          "type": "string",
          "enum": ["Process_Engine_SelfContained_MH_Driven"],
          "description": "File type classification. Assumed .md in Obsidian."
        },
        "conforms_to_engine_meta_schema_version": {
          "type": "string",
          "pattern": "^1\\\\$",
          "description": "Must conform to this schema version."
        }
      },
      "required": [
        "filename",
        "id",
        "version",
        "title",
        "path",
        "project_code",
        "purpose",
        "segment_info",
        "type",
        "conforms_to_engine_meta_schema_version"
      ],
      "additionalProperties": true
    },
    "engine_content_metadata_block": {
      "description": "The primary # METADATA YAML comment block immediately following file-level frontmatter, defining the Engine's conceptual properties.",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "enum": ["MetaProcessEngineASO"]
        },
        "name": {
          "type": "string",
          "pattern": "^Meta Process Engine \\(Autonomous Self-Improving Orchestrator v\\d+\\.\\d+.*\\)$"
        },
        "version": {
          "type": "string",
          "description": "Engine content version, must match file_level_metadata.version."
        },
        "status": {
          "type": "string",
          "enum": [
            "Active",
            "Deprecated",
            "Experimental"
          ]
        },
        "description": {
          "type": "string"
        },
        "type": {
          "type": "string",
          "enum": ["Process_Engine_SelfContained_MH_Driven"]
        },
        "domain": {
          "type": "string"
        },
        "keywords": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "relationships": {
          "type": "object",
          "properties": {
            "process_group": {
              "type": "string"
            },
            "leads_to": {
              "type": "string"
            },
            "references_schema": {
              "type": "string",
              "pattern": "^SELF:I\\.A\\..*$"
            },
            "uses_skills_from": {
              "type": "string",
              "pattern": "^SELF:I\\.B\\..*$"
            },
            "invokes_meta_process": {
              "type": "string",
              "pattern": "^SELF:I\\.C\\..*$"
            },
            "uses_knowledge_artifacts": {
              "type": "array",
              "items": {
                "type": "string"
              }
            }
          },
          "required": [
            "references_schema",
            "uses_skills_from",
            "invokes_meta_process",
            "uses_knowledge_artifacts"
          ],
          "additionalProperties": true
        },
        "usage": {
          "type": "object",
          "properties": {
            "instructions_for_ai": {
              "type": "string"
            }
          },
          "required": [
            "instructions_for_ai"
          ]
        }
      },
      "required": [
        "id",
        "name",
        "version",
        "status",
        "description",
        "type",
        "relationships",
        "usage"
      ],
      "additionalProperties": true
    },
    "markdown_structure": {
      "description": "Defines the expected sequence and content model of major Markdown H1 sections.",
      "type": "object",
      "properties": {
        "h1_section_sequence": {
          "type": "array",
          "description": "Ordered list of required H1 section titles.",
          "items": [
            {
              "type": "string",
              "enum": ["# I. CORE EMBEDDED DEFINITIONS"]
            },
            {
              "type": "string",
              "enum": ["# II. ORCHESTRATION KERNEL"]
            },
            {
              "type": "string",
              "enum": ["# III. META-HEURISTIC (MH) LIBRARY DEFINITIONS"]
            }
          ],
          "minItems": 3,
          "maxItems": 3
        },
        "section_I_content": {
          "$ref": "#/definitions/SectionICoreDefinitionsContent"
        },
        "section_II_content": {
          "$ref": "#/definitions/SectionIIOrchestrationKernelContent"
        },
        "section_III_content": {
          "$ref": "#/definitions/SectionIIIMHLibraryContent"
        }
      },
      "required": [
        "h1_section_sequence",
        "section_I_content",
        "section_II_content",
        "section_III_content"
      ],
      "additionalProperties": false
    }
  },
  "required": [
    "file_level_metadata",
    "engine_content_metadata_block",
    "markdown_structure"
  ],
  "additionalProperties": false,
  "definitions": {
    "InternalComponentMetadata": {
      "description": "Reusable definition for component-level # METADATA comment blocks within YAML definitions (e.g., for MHs).",
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "Unique identifier for the component, e.g., 'IFE-MH'."
        },
        "name": {
          "type": "string",
          "description": "Human-readable name, e.g., 'Idea Formulation & Exploration Meta-Heuristic v2.11'."
        },
        "version": {
          "type": "string",
          "description": "Version of this component, often tied to parent Engine version."
        },
        "status": {
          "type": "string",
          "enum": [
            "Active",
            "Experimental",
            "Deprecated"
          ],
          "description": "Status of this component."
        },
        "description": {
          "type": "string",
          "description": "Brief description of the component's purpose."
        }
      },
      "required": [
        "id"
      ],
      "additionalProperties": true
    },
    "ExplicitYAMLComponent": {
      "description": "Structure for a component primarily defined by a Markdown preamble (instructions) and a YAML code block (e.g., Schemas, KAs, Skill Catalog).",
      "type": "object",
      "properties": {
        "markdown_instructions_for_ai": {
          "type": "string",
          "description": "Markdown block (e.g., blockquote) preceding the YAML, guiding AI use."
        },
        "yaml_code_block": {
          "type": "object",
          "description": "The actual YAML content parsed into an object. For schemas or catalogs, this is the root of that schema/catalog definition.",
          "additionalProperties": true
        }
      },
      "required": [
        "markdown_instructions_for_ai",
        "yaml_code_block"
      ]
    },
    "LogicComponent": {
      "description": "Structure for a component primarily defined by descriptive logic/steps in Markdown (e.g., Kernel, MetaRefineOutput).",
      "type": "object",
      "properties": {
        "markdown_instructions_for_ai": {
          "type": "string",
          "description": "Core instructions for this logic block."
        },
        "descriptive_content_markdown": {
          "type": "string",
          "description": "The main body of text detailing principles, steps, logic."
        }
      },
      "required": [
        "markdown_instructions_for_ai",
        "descriptive_content_markdown"
      ],
      "additionalProperties": false
    },
    "MetaHeuristicDefinition": {
      "description": "Structure for an individual Meta-Heuristic definition within the MH Library.",
      "type": "object",
      "properties": {
        "markdown_h3_header": {
          "type": "string",
          "pattern": "^### III\\.[A-Z]\\. `[A-Z]{3,}-MH`.*$",
          "description": "Expected format for MH section headers."
        },
        "markdown_instructions_for_ai_mh_level": {
          "type": "string",
          "description": "Overall instructions for the MH, in Markdown, preceding its YAML definition."
        },
        "yaml_code_block": {
          "type": "object",
          "properties": {
            "metadata_comment_block": {
              "$ref": "#/definitions/InternalComponentMetadata",
              "description": "MH's own # METADATA block within the YAML."
            },
            "instructions_for_ai_yaml": {
              "type": "string",
              "description": "Specific instructions for AI on using this MH, within the YAML."
            },
            "trigger": {
              "type": "string",
              "description": "Natural language description of when this MH is triggered."
            },
            "inputs": {
              "type": "string",
              "description": "Natural language description of inputs."
            },
            "process_steps": {
              "type": "string",
              "description": "Natural language description of process steps."
            },
            "outputs": {
              "type": "string",
              "description": "Natural language description of outputs."
            },
            "type": {
              "type": "string",
              "enum": ["MetaHeuristic_Definition"]
            },
            "domain": {
              "type": "string"
            },
            "keywords": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "uses_skills": {
              "type": "array",
              "items": {
                "type": "string"
              }
            },
            "invokes_meta_process": {
              "type": "array",
              "items": {
                "type": "string",
                "pattern": "^SELF:I\\.C\\..*$"
              }
            }
          },
          "required": [
            "metadata_comment_block",
            "instructions_for_ai_yaml",
            "trigger",
            "inputs",
            "process_steps",
            "outputs"
          ],
          "additionalProperties": true
        }
      },
      "required": [
        "markdown_h3_header",
        "markdown_instructions_for_ai_mh_level",
        "yaml_code_block"
      ],
      "additionalProperties": false
    },
    "SectionICoreDefinitionsContent": {
      "description": "Defines the expected sub-components within Section I.",
      "type": "object",
      "properties": {
        "project_state_schema": {
          "$ref": "#/definitions/ExplicitYAMLComponent"
        },
        "ai_skills_catalog": {
          "$ref": "#/definitions/ExplicitYAMLComponent"
        },
        "meta_refine_output": {
          "$ref": "#/definitions/LogicComponent"
        },
        "ai_operational_protocols": {
          "$ref": "#/definitions/ExplicitYAMLComponent"
        },
        "tid_schema": {
          "$ref": "#/definitions/ExplicitYAMLComponent"
        }
      },
      "required": [
        "project_state_schema",
        "ai_skills_catalog",
        "meta_refine_output",
        "ai_operational_protocols",
        "tid_schema"
      ],
      "additionalProperties": false
    },
    "SectionIIOrchestrationKernelContent": {
      "description": "Defines the content model for Section II.",
      "allOf": [
        {
          "$ref": "#/definitions/LogicComponent"
        }
      ]
    },
    "SectionIIIMHLibraryContent": {
      "description": "Defines the content model for Section III.",
      "type": "object",
      "properties": {
        "library_instructions_for_ai": {
          "type": "string",
          "description": "Overall instructions for the MH Library section."
        },
        "meta_heuristics_list": {
          "type": "array",
          "description": "List of all MH definitions.",
          "items": {
            "$ref": "#/definitions/MetaHeuristicDefinition"
          },
          "minItems": 1
        }
      },
      "required": [
        "library_instructions_for_ai",
        "meta_heuristics_list"
      ],
      "additionalProperties": false
    }
  }
}