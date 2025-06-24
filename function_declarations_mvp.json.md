[
  {
    "name": "echo_message_v1",
    "description": "A simple function that echoes a message back. Used for testing the function calling mechanism.",
    "parameters": {
      "type": "object",
      "properties": {
        "message": {
          "type": "string",
          "description": "The message to be echoed."
        },
        "repeat_count": {
          "type": "integer",
          "description": "Optional. How many times to repeat the message. Defaults to 1."
        }
      },
      "required": ["message"]
    }
  },
  {
    "name": "elicit_user_input_v3",
    "description": "Prompts the user for text input and returns their response. Used for getting specific information from the user during a process.",
    "parameters": {
      "type": "object",
      "properties": {
        "prompt_message": {
          "type": "string",
          "description": "The message to display to the user as a prompt."
        },
        "response_format_hint": {
          "type": "string",
          "description": "Optional. Hint about the expected format of the user's response (e.g., 'text', 'number', 'yes_no', 'json')."
        }
      },
      "required": ["prompt_message"]
    }
  },
  {
    "name": "draft_text_segment_v3",
    "description": "Generates a text segment based on provided instructions, context, and constraints. This is a core content generation function.",
    "parameters": {
      "type": "object",
      "properties": {
        "instructions": {
          "type": "string",
          "description": "Specific instructions for generating the text (e.g., 'Explain concept X', 'Summarize section Y')."
        },
        "context_json": {
          "type": "string",
          "description": "JSON string providing relevant context (e.g., CCO snippet, previous draft, source material). Can be a large object."
        },
        "length_hint": {
          "type": "string",
          "description": "Optional. Hint about the desired length (e.g., 'short', 'one paragraph', 'approx 500 words')."
        },
        "style_guide_json": {
          "type": "string",
          "description": "Optional. JSON string of a style guide to adhere to."
        },
        "rhetorical_goal": {
          "type": "string",
          "description": "Optional. The rhetorical goal for the segment (e.g., 'persuade', 'inform', 'summarize')."
        }
      },
      "required": ["instructions", "context_json"]
    }
  },
  {
    "name": "critique_text_segment_v3",
    "description": "Critiques a text segment based on provided criteria and context, returning a structured report of findings. Used by MRO and other components for quality assessment.",
    "parameters": {
      "type": "object",
      "properties": {
        "text_segment": {
          "type": "string",
          "description": "The text segment to be critiqued."
        },
        "criteria_json": {
          "type": "string",
          "description": "JSON string detailing the critique criteria (e.g., '{'clarity': true, 'logic': true, 'repetition_check': 'keyword X'}'). This can include quantitative metrics thresholds."
        },
        "context_json": {
          "type": "string",
          "description": "JSON string providing context for the critique (e.g., CCO snippet, goals, style guide, adaptive critique rules from LHR/LHL)."
        }
      },
      "required": ["text_segment", "criteria_json", "context_json"]
    }
  },
    {
    "name": "synthesize_critique_findings_v3",
    "description": "Synthesizes raw critique findings and validation results into a structured summary, identifies actionable issues, and checks for convergence based on goals and thresholds.",
    "parameters": {
      "type": "object",
      "properties": {
        "quality_report_json": {
          "type": "string",
          "description": "JSON string of the quality metrics and findings report."
        },
        "validation_result_json": {
          "type": "string",
          "description": "Optional. JSON string of schema validation results."
        },
        "refinement_goals_json": {
          "type": "string",
          "description": "JSON string detailing refinement goals and convergence thresholds."
        },
        "adaptive_rules_json": {
          "type": "string",
          "description": "Optional. JSON string of adaptive critique rules used."
        }
      },
      "required": ["quality_report_json", "refinement_goals_json"]
    }
  },
  {
    "name": "suggest_content_revisions_from_critique_v3",
    "description": "Analyzes a critique summary and suggests specific revisions or actions to improve a text segment.",
    "parameters": {
      "type": "object",
      "properties": {
        "current_draft_json": {
          "type": "string",
          "description": "The current draft text segment as a JSON string."
        },
        "synthesized_critique_json": {
          "type": "string",
          "description": "JSON string of the synthesized critique summary."
        },
        "cco_context_json": {
          "type": "string",
          "description": "JSON string of the CCO context for relevant suggestions."
        }
      },
      "required": ["current_draft_json", "synthesized_critique_json", "cco_context_json"]
    }
  },
  {
    "name": "apply_revisions_to_draft_v3",
    "description": "Applies suggested revisions to a text segment. This function may internally call other functions like generate_alternative_phrasing_v3.",
    "parameters": {
      "type": "object",
      "properties": {
        "current_draft_json": {
          "type": "string",
          "description": "The current draft text segment as a JSON string."
        },
        "revision_suggestions_json": {
          "type": "string",
          "description": "JSON string detailing the suggested revisions."
        },
         "cco_context_json": {
          "type": "string",
          "description": "JSON string of the CCO context."
        }
      },
      "required": ["current_draft_json", "revision_suggestions_json", "cco_context_json"]
    }
  },
  {
    "name": "compare_drafts_for_meaningful_change_v3",
    "description": "Compares two versions of a draft text segment to determine if significant, meaningful changes were made, potentially using quantitative metrics.",
    "parameters": {
      "type": "object",
      "properties": {
        "draft1_json": {
          "type": "string",
          "description": "The first draft text segment as a JSON string."
        },
        "draft2_json": {
          "type": "string",
          "description": "The second draft text segment as a JSON string."
        },
        "threshold_json": {
          "type": "string",
          "description": "JSON string defining the threshold for 'meaningful change' (e.g., '{'metric': 'info_gain', 'value': 0.05}')."
        }
      },
      "required": ["draft1_json", "draft2_json", "threshold_json"]
    }
  },
  {
    "name": "update_cco_section_v3",
    "description": "Updates a specific section or field within the CCO data structure. Ensures data integrity and schema adherence for the modified section.",
    "parameters": {
      "type": "object",
      "properties": {
        "cco_data_json": {
          "type": "string",
          "description": "The current CCO data as a JSON string."
        },
        "section_path": {
          "type": "string",
          "description": "The dot-separated path to the section or field to update (e.g., 'product_content_data.draft_section_1', 'metadata_internal_cco.current_form')."
        },
        "new_content_json": {
          "type": "string",
          "description": "The new content for the specified section or field, as a JSON string."
        }
      },
      "required": ["cco_data_json", "section_path", "new_content_json"]
    }
  },
  {
    "name": "generate_unique_id_v3",
    "description": "Generates a unique identifier string.",
    "parameters": {
      "type": "object",
      "properties": {
        "prefix": {
          "type": "string",
          "description": "Optional. A prefix for the generated ID."
        }
      }
    }
  },
  {
    "name": "log_to_cco_history_v3",
    "description": "Logs a structured event to the CCO's operational history log.",
    "parameters": {
      "type": "object",
      "properties": {
        "cco_data_json": {
          "type": "string",
          "description": "The current CCO data as a JSON string."
        },
        "log_entry_type": {
          "type": "string",
          "description": "Type of log entry (e.g., 'FunctionCall', 'UserAction', 'AIStateChange')."
        },
        "message": {
          "type": "string",
          "description": "A summary message for the log entry."
        },
        "associated_data_json": {
          "type": "string",
          "description": "Optional. JSON string of associated data for the log entry."
        }
      },
      "required": ["cco_data_json", "log_entry_type", "message"]
    }
  },
  {
    "name": "get_cco_section_v3",
    "description": "Retrieves a specific section or field from the CCO data structure as a JSON string.",
    "parameters": {
      "type": "object",
      "properties": {
        "cco_data_json": {
          "type": "string",
          "description": "The current CCO data as a JSON string."
        },
        "section_path": {
          "type": "string",
          "description": "The dot-separated path to the section or field to retrieve (e.g., 'product_content_data.draft_section_1', 'metadata_internal_cco.current_form')."
        }
      },
      "required": ["cco_data_json", "section_path"]
    }
  },
  {
    "name": "parse_json_string_to_internal_object_v3",
    "description": "Parses a JSON string into the AI's internal object representation.",
    "parameters": {
      "type": "object",
      "properties": {
        "json_string": {
          "type": "string",
          "description": "The JSON string to parse."
        }
      },
      "required": ["json_string"]
    }
  },
  {
    "name": "convert_internal_object_to_json_string_v3",
    "description": "Converts the AI's internal object representation into a JSON string.",
    "parameters": {
      "type": "object",
      "properties": {
        "internal_object": {
          "type": "object",
          "description": "The AI's internal object to convert."
        }
      },
      "required": ["internal_object"]
    }
  }
]