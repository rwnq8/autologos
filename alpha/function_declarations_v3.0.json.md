[
  {
    "name": "calculate_lexical_diversity_metrics_v3",
    "description": "Calculates advanced lexical diversity, repetition, and readability metrics for a text segment. Supports MetaRefineOutputASO_v3.0 by providing quantitative data for self-critique, contributing to higher quality and more varied textual outputs from the Engine. (Evolves Phase 1 function for v3.0).",
    "parameters": {
      "type": "object",
      "properties": {
        "text_segment": {
          "type": "string",
          "description": "The text segment to be analyzed."
        },
        "analysis_profile": {
          "type": "string",
          "description": "Optional. Profile defining specific metrics to calculate or thresholds (e.g., 'concise_technical', 'creative_descriptive'). Defaults to 'standard'."
        }
      },
      "required": ["text_segment"]
    }
  },
  {
    "name": "generate_alternative_phrasing_v3",
    "description": "Generates multiple alternative phrasings for a given text segment based on a specified goal (e.g., reduce repetition, improve clarity, change tone, meet rhetorical objective). Directly used by MetaRefineOutputASO_v3.0 to act on critique findings. (Evolves Phase 1 function for v3.0).",
    "parameters": {
      "type": "object",
      "properties": {
        "text_segment": {
          "type": "string",
          "description": "The text segment to be rephrased."
        },
        "rephrasing_goal": {
          "type": "string",
          "description": "The specific goal for rephrasing (e.g., 'reduce_repetition_of_term_X', 'strengthen_persuasive_tone', 'simplify_for_target_audience_Y')."
        },
        "num_alternatives": {
          "type": "integer",
          "description": "Optional. Number of alternative phrasings to generate. Defaults to 3."
        }
      },
      "required": ["text_segment", "rephrasing_goal"]
    }
  },
  {
    "name": "query_adaptive_critique_rules_v3",
    "description": "Queries available LHR/LHL (CCO-specific and Global) for entries tagged as relevant to MetaRefineOutputASO critique, filtered by context or error category. Enables MetaRefineOutputASO_v3.0 to dynamically prioritize critique based on learned patterns. (Evolves Phase 1 'query_global_lhr_lhl_by_mro_tags' for v3.0).",
    "parameters": {
      "type": "object",
      "properties": {
        "cco_lhr_lhl_json": {
          "type": "string",
          "description": "JSON string of CCO-specific LHR/LHL entries."
        },
        "global_lhr_lhl_json": {
          "type": "string",
          "description": "JSON string of Global LHR/LHL entries."
        },
        "current_critique_focus": {
          "type": "string",
          "description": "Optional. The current area MRO is focusing on (e.g., 'lexical_diversity', 'argument_strength', 'list_formatting') to retrieve highly relevant rules."
        }
      },
      "required": ["cco_lhr_lhl_json", "global_lhr_lhl_json"]
    }
  },
  {
    "name": "validate_data_against_schema_v3",
    "description": "Validates a given data object (as JSON string) against a specified schema (e.g., ProjectStateSchemaASO, EngineMetaSchemaASO, KA schemas). Essential for data integrity within CCOs and during FEL-MH framework evolution. (Evolves Phase 1 function for v3.0).",
    "parameters": {
      "type": "object",
      "properties": {
        "data_object_json": {
          "type": "string",
          "description": "A JSON string representation of the data object to be validated."
        },
        "schema_name": {
          "type": "string",
          "description": "The unique name/ID of the schema (e.g., 'ProjectStateSchemaASO_v3.0', 'EngineMetaSchemaASO_v1.2.0')."
        },
        "schema_definition_json": {
          "type": "string",
          "description": "Optional. The JSON string of the schema definition itself if not pre-registered or to override."
        }
      },
      "required": ["data_object_json", "schema_name"]
    }
  },
  {
    "name": "get_cco_context_summary_v3",
    "description": "Extracts key details from a CCO (as JSON string) for context summaries. Used by OrchestrationKernel_v3.0 or TDE-MH_v3.0 when resuming work or starting new phases. (Evolves Phase 1 function for v3.0).",
    "parameters": {
      "type": "object",
      "properties": {
        "cco_data_json": {
          "type": "string",
          "description": "A JSON string representation of the full CCO data."
        }
      },
      "required": ["cco_data_json"]
    }
  },
  {
    "name": "evaluate_mh_sequence_effectiveness_v3",
    "description": "Analyzes historical CCO data and LHLs to evaluate the effectiveness of different Meta-Heuristic sequences for specific CCO types or goals. Output informs OrchestrationKernel_v3.0 for adaptive MH sequencing (Roadmap FIR_003).",
    "parameters": {
      "type": "object",
      "properties": {
        "historical_cco_data_json_array": {
          "type": "string",
          "description": "JSON string of an array of CCO summaries or relevant log data."
        },
        "target_cco_type": {
          "type": "string",
          "description": "The type of CCO for which to evaluate MH sequences."
        },
        "success_metrics_definition_json": {
          "type": "string",
          "description": "JSON string defining how success/effectiveness is measured."
        }
      },
      "required": ["historical_cco_data_json_array", "target_cco_type", "success_metrics_definition_json"]
    }
  },
  {
    "name": "manage_global_heuristic_lifecycle_v3",
    "description": "Manages the promotion of CCO-specific LHR/LHL to Global KAs, or demotion/archival. Involves user validation steps. Supports Global LHR/LHL architecture (Roadmap FIR_005).",
    "parameters": {
      "type": "object",
      "properties": {
        "action": {
          "type": "string",
          "enum": ["propose_promotion", "validate_promotion", "demote_heuristic", "archive_heuristic"],
          "description": "The lifecycle action to perform."
        },
        "heuristic_json": {
          "type": "string",
          "description": "JSON string of the heuristic in question."
        },
        "source_cco_id": {
          "type": "string",
          "description": "Optional. The CCO ID from which the heuristic originated if proposing promotion."
        },
        "user_rationale_or_approval": {
          "type": "string",
          "description": "Optional. User's rationale or explicit approval token."
        }
      },
      "required": ["action", "heuristic_json"]
    }
  },
  {
    "name": "apply_specific_learned_heuristic_v3",
    "description": "Directly applies a specific, validated LHR to a draft text segment for targeted self-correction or proactive guidance, as part of TID_ASO_AUT_001. More direct than general MRO critique.",
    "parameters": {
      "type": "object",
      "properties": {
        "text_segment": {
          "type": "string",
          "description": "The draft text segment to apply the heuristic to."
        },
        "lhr_definition_json": {
          "type": "string",
          "description": "JSON string of the specific LHR to apply (including its corrective logic or pattern)."
        }
      },
      "required": ["text_segment", "lhr_definition_json"]
    }
  },
  {
    "name": "calculate_comprehensive_quality_metrics_v3",
    "description": "Calculates a broad set of quantitative quality proxies for a text segment, including clarity, coherence, argument strength, information value, in addition to lexical metrics. Supports advanced MRO (Roadmap FIR_009).",
    "parameters": {
      "type": "object",
      "properties": {
        "text_segment": {
          "type": "string",
          "description": "The text segment to analyze."
        },
        "cco_context_json": {
          "type": "string",
          "description": "JSON string of the CCO context for relevance and goal alignment."
        },
        "rhetorical_goal": {
          "type": "string",
          "description": "Optional. The rhetorical goal of the segment."
        }
      },
      "required": ["text_segment", "cco_context_json"]
    }
  },
  {
    "name": "review_cco_sub_object_definitions_v3",
    "description": "Performs a completeness review of ProjectStateSchemaASO sub-object definitions within a given CCO, flagging missing or underdeveloped areas (Roadmap FIR_001).",
    "parameters": {
      "type": "object",
      "properties": {
        "cco_data_json": {
          "type": "string",
          "description": "JSON string of the CCO to review."
        },
        "project_state_schema_definition_json": {
          "type": "string",
          "description": "JSON string of the ProjectStateSchemaASO definition for reference."
        }
      },
      "required": ["cco_data_json", "project_state_schema_definition_json"]
    }
  },
  {
    "name": "manage_pfkb_v3",
    "description": "Queries or updates the Product Form Knowledge Base (PFKB). Retrieves schemas/requirements for strict product forms or characteristics for loose forms. (Roadmap FIR_004).",
    "parameters": {
      "type": "object",
      "properties": {
        "action": {
          "type": "string",
          "enum": ["query_form", "update_form_entry", "add_form_entry"],
          "description": "Action to perform on the PFKB."
        },
        "product_form_descriptor": {
          "type": "string",
          "description": "Descriptor of the product form (e.g., 'RFP_Document', 'Patent_Application')."
        },
        "pfkb_data_json": {
          "type": "string",
          "description": "Optional. JSON string of data for updating/adding an entry."
        },
        "pfkb_ka_json_string": {
          "type": "string",
          "description": "JSON string representing the current state of the PFKB KA."
        }
      },
      "required": ["action", "product_form_descriptor", "pfkb_ka_json_string"]
    }
  },
  {
    "name": "analyze_cco_strategic_health_v3",
    "description": "Performs a comprehensive health check on a CCO, assessing progress, risks, and alignment with its initiating document and broader strategic goals. (Roadmap FIR_006).",
    "parameters": {
      "type": "object",
      "properties": {
        "cco_data_json": {
          "type": "string",
          "description": "JSON string of the CCO to analyze."
        },
        "strategic_directives_json": {
          "type": "string",
          "description": "Optional. JSON string of user-defined strategic directives or success criteria beyond the CCO's immediate objective."
        }
      },
      "required": ["cco_data_json"]
    }
  },
  {
    "name": "synthesize_cross_cco_insights_v3",
    "description": "Analyzes a set of CCOs to identify common patterns, transferable LHRs/LHLs, reusable components, or emergent strategic insights. (Blue Sky).",
    "parameters": {
      "type": "object",
      "properties": {
        "cco_data_json_array": {
          "type": "string",
          "description": "JSON string of an array of CCO data objects."
        },
        "synthesis_focus_keywords": {
          "type": "array",
          "items": {"type": "string"},
          "description": "Optional. Keywords to guide the synthesis (e.g., 'risk_mitigation', 'user_engagement_strategies')."
        }
      },
      "required": ["cco_data_json_array"]
    }
  },
  {
    "name": "predict_task_outcome_v3",
    "description": "Predicts properties for a new task (e.g., estimated duration, complexity score, probability of requiring user intervention) based on historical task data and CCO context. (Blue Sky).",
    "parameters": {
      "type": "object",
      "properties": {
        "task_definition_json": {
          "type": "string",
          "description": "JSON string of the task to be analyzed."
        },
        "historical_task_data_json": {
          "type": "string",
          "description": "JSON string of historical task data for model training/inference."
        },
        "cco_context_json": {
          "type": "string",
          "description": "JSON string of the current CCO context."
        }
      },
      "required": ["task_definition_json", "historical_task_data_json", "cco_context_json"]
    }
  },
  {
    "name": "draft_new_mh_definition_v3",
    "description": "Generates a draft definition (YAML structure) for a new Meta-Heuristic based on a description of a recurring workflow or an unmet process need. (Blue Sky for FEL-MH).",
    "parameters": {
      "type": "object",
      "properties": {
        "workflow_description_text": {
          "type": "string",
          "description": "Detailed natural language description of the workflow pattern."
        },
        "existing_mh_definitions_json": {
          "type": "string",
          "description": "JSON string of existing MH definitions for reference and to avoid duplication or to use as building blocks."
        },
        "target_mh_id_suggestion": {
          "type": "string",
          "description": "Optional. A suggested ID for the new MH."
        }
      },
      "required": ["workflow_description_text", "existing_mh_definitions_json"]
    }
  },
  {
    "name": "infer_and_apply_user_profile_v3",
    "description": "Infers user preferences and collaboration style from interaction history (LHLs, feedback) and applies these to adapt the Engine's behavior (e.g., verbosity, proactivity, default parameters). (Blue Sky).",
    "parameters": {
      "type": "object",
      "properties": {
        "user_interaction_history_json": {
          "type": "string",
          "description": "JSON string of user interaction logs (LHLs, explicit feedback, prompt history)."
        },
        "current_engine_settings_json": {
          "type": "string",
          "description": "JSON string of the Engine's current configurable settings."
        },
        "target_interaction_context": {
          "type": "string",
          "description": "The context for which to adapt behavior (e.g., 'next_draft_generation', 'error_reporting_style')."
        }
      },
      "required": ["user_interaction_history_json", "current_engine_settings_json", "target_interaction_context"]
    }
  },
  {
    "name": "parse_engine_structure_v3",
    "description": "Parses the MetaProcessEngineASO.md file content into a structured JSON object based on EngineMetaSchemaASO. Used by FEL-MH for easier manipulation during framework evolution.",
    "parameters": {
      "type": "object",
      "properties": {
        "engine_markdown_text": {
          "type": "string",
          "description": "The full Markdown text of the MetaProcessEngineASO.md file."
        },
        "engine_meta_schema_json": {
          "type": "string",
          "description": "The JSON string of the EngineMetaSchemaASO to guide parsing."
        }
      },
      "required": ["engine_markdown_text", "engine_meta_schema_json"]
    }
  },
  {
    "name": "regenerate_engine_markdown_v3",
    "description": "Regenerates the full MetaProcessEngineASO.md file from a structured JSON object (previously parsed and modified by FEL-MH).",
    "parameters": {
      "type": "object",
      "properties": {
        "engine_json_object": {
          "type": "string",
          "description": "JSON string representation of the complete, modified Engine structure."
        },
        "target_engine_version": {
          "type": "string",
          "description": "The new version number for the regenerated Engine."
        }
      },
      "required": ["engine_json_object", "target_engine_version"]
    }
  },
  {
    "name": "orchestrate_mro_critique_pipeline_v3",
    "description": "Orchestrates the full MetaRefineOutputASO v3.0 pipeline. Takes a draft, CCO context, and goals, then internally calls various analytical functions (lexical, quality, rhetorical) and refinement functions (alternative phrasing, direct heuristic application) to produce a refined output.",
    "parameters": {
      "type": "object",
      "properties": {
        "draft_text_segment": {
          "type": "string",
          "description": "The initial draft text to be refined."
        },
        "cco_context_json": {
          "type": "string",
          "description": "JSON string of the CCO context."
        },
        "refinement_goals_json": {
          "type": "string",
          "description": "JSON string detailing specific refinement goals, including rhetorical targets, quality thresholds, etc."
        },
        "adaptive_critique_rules_json": {
          "type": "string",
          "description": "JSON string of dynamically loaded critique rules from LHR/LHL."
        }
      },
      "required": ["draft_text_segment", "cco_context_json", "refinement_goals_json", "adaptive_critique_rules_json"]
    }
  }
]
