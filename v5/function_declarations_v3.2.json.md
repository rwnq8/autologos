[
  {
    "name": "utility_echo_message_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Echo a message back. Take the 'message_to_echo' parameter and construct an output that includes this message, potentially repeated 'repeat_count' times. Used for basic I/O testing and diagnostics.",
    "parameters": {
      "type": "object",
      "properties": {
        "message_to_echo": {
          "type": "string",
          "description": "The message to be echoed."
        },
        "repeat_count": {
          "type": "integer",
          "description": "Optional. How many times to repeat the message. Defaults to 1."
        }
      },
      "required": ["message_to_echo"]
    }
  },
  {
    "name": "interaction_elicit_user_input_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Formulate a prompt to the user based on 'prompt_message_to_user'. Present this prompt via the AIOS interface. Await and capture the user's freeform text response. The 'expected_response_format_hint' guides how the response might be processed or re-prompted. Returns a JSON object like { 'user_text': '...' }.",
    "parameters": {
      "type": "object",
      "properties": {
        "prompt_message_to_user": {
          "type": "string",
          "description": "The message to display to the user as a prompt."
        },
        "expected_response_format_hint": {
          "type": "string",
          "description": "Optional. Hint about the expected format (e.g., 'free_text', 'number', 'yes_no', 'json_string')."
        }
      },
      "required": ["prompt_message_to_user"]
    }
  },
  {
    "name": "interaction_present_options_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Formulate a prompt to the user, including options provided in 'options_as_json_list'. Present this prompt. Await and capture the user's selection. Returns a JSON object like { 'selected_option': '...' }.",
    "parameters": {
      "type": "object",
      "properties": {
        "prompt_message_to_user": {
          "type": "string",
          "description": "The message to display to the user."
        },
        "options_as_json_list": {
          "type": "string",
          "description": "A JSON string representing an array of option strings (e.g., '[\"Option A\", \"Option B\"]'). The AIOS will parse this to present options."
        }
      },
      "required": ["prompt_message_to_user", "options_as_json_list"]
    }
  },
  {
    "name": "content_draft_text_segment_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Perform a complex generative task. Based on 'instructions', 'context_json', and other optional hints, generate a new text segment. Involves understanding, synthesis, and creative writing. Returns a JSON string representing the generated content (e.g., '{\"text\":\"...\"}').",
    "parameters": {
      "type": "object",
      "properties": {
        "instructions": {
          "type": "string",
          "description": "Specific instructions for generating the text."
        },
        "context_json": {
          "type": "string",
          "description": "JSON string providing relevant context (e.g., data snippets, previous drafts, user persona, outline, style guide)."
        },
        "desired_length_hint": {
          "type": "string",
          "description": "Optional. Hint about desired length (e.g., 'concise', 'detailed_paragraph')."
        },
        "style_guide_json": {
          "type": "string",
          "description": "Optional. JSON string of a style guide object to adhere to."
        },
        "rhetorical_goal_hint": {
          "type": "string",
          "description": "Optional. Intended rhetorical goal (e.g., 'persuade', 'inform', 'summarize')."
        }
      },
      "required": ["instructions", "context_json"]
    }
  },
  {
    "name": "analysis_critique_content_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Perform a complex analytical task. Critique the provided 'content_to_critique_json' (text or structured data as JSON) based on 'critique_criteria_json' and 'context_json'. Produces a structured JSON report of findings.",
    "parameters": {
      "type": "object",
      "properties": {
        "content_to_critique_json": {
          "type": "string",
          "description": "The content (text or structured data) to be critiqued, as a JSON string."
        },
        "critique_criteria_json": {
          "type": "string",
          "description": "JSON string detailing the critique criteria."
        },
        "context_json": {
          "type": "string",
          "description": "JSON string providing context for the critique."
        },
        "adaptive_rules_json": {
          "type": "string",
          "description": "Optional. JSON string of adaptive critique rules (from LHR/LHL)."
        }
      },
      "required": ["content_to_critique_json", "critique_criteria_json", "context_json"]
    }
  },
  {
    "name": "analysis_synthesize_critique_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Take one or more 'raw_critique_reports_json_array' (e.g., from critiques, validations). Based on 'synthesis_goals_json', synthesize these into a structured summary, identify actionable issues, and assess if goals/convergence criteria have been met. Returns a JSON object like { 'summary': '...', 'actionable_issues_count': N, 'meets_all_thresholds': true/false, ... }.",
    "parameters": {
      "type": "object",
      "properties": {
        "raw_critique_reports_json_array": {
          "type": "string",
          "description": "JSON string of an array of findings reports."
        },
        "synthesis_goals_json": {
          "type": "string",
          "description": "JSON string detailing synthesis goals and convergence thresholds."
        }
      },
      "required": ["raw_critique_reports_json_array", "synthesis_goals_json"]
    }
  },
  {
    "name": "content_suggest_revisions_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Analyze a 'synthesized_critique_json' and 'current_content_json', considering 'context_json'. Generate specific, actionable revision suggestions as a structured JSON output like { 'has_actionable_suggestions': true/false, 'revision_instructions': '...', ... }.",
    "parameters": {
      "type": "object",
      "properties": {
        "current_content_json": {
          "type": "string",
          "description": "The current content as a JSON string."
        },
        "synthesized_critique_json": {
          "type": "string",
          "description": "JSON string of the synthesized critique summary."
        },
        "context_json": {
          "type": "string",
          "description": "JSON string of relevant context."
        }
      },
      "required": ["current_content_json", "synthesized_critique_json", "context_json"]
    }
  },
  {
    "name": "content_apply_revisions_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Take 'current_content_json' and 'revision_instructions_json'. Apply the revisions, considering 'context_json'. This is a complex generative task based on instructions and context. Returns a JSON string representing the revised content.",
    "parameters": {
      "type": "object",
      "properties": {
        "current_content_json": {
          "type": "string",
          "description": "The current content as a JSON string."
        },
        "revision_instructions_json": {
          "type": "string",
          "description": "JSON string detailing the specific revisions to apply."
        },
         "context_json": {
          "type": "string",
          "description": "JSON string of relevant context."
        }
      },
      "required": ["current_content_json", "revision_instructions_json", "context_json"]
    }
  },
  {
    "name": "analysis_compare_content_versions_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Compare 'content_version1_json' and 'content_version2_json' based on 'comparison_thresholds_json'. Determine if significant, meaningful changes were made. Returns a JSON object like { 'is_significant': true/false, 'diff_summary': '...' }.",
    "parameters": {
      "type": "object",
      "properties": {
        "content_version1_json": {
          "type": "string",
          "description": "The first version (content or data) as a JSON string."
        },
        "content_version2_json": {
          "type": "string",
          "description": "The second version as a JSON string."
        },
        "comparison_thresholds_json": {
          "type": "string",
          "description": "JSON string defining thresholds for 'meaningful change'."
        }
      },
      "required": ["content_version1_json", "content_version2_json", "comparison_thresholds_json"]
    }
  },
  {
    "name": "utility_generate_unique_id_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Generate a unique identifier string, optionally using 'id_prefix'. Returns a JSON object like { 'unique_id': '...' }.",
    "parameters": {
      "type": "object",
      "properties": {
        "id_prefix": {
          "type": "string",
          "description": "Optional. A prefix for the generated ID."
        }
      }
    }
  },
  {
    "name": "utility_parse_json_string_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Take a 'json_string_to_parse' string and convert it into an internal structured representation that autologos can operate on. The output is this internal representation (conceptually). Returns the parsed object/list directly.",
    "parameters": {
      "type": "object",
      "properties": {
        "json_string_to_parse": {
          "type": "string",
          "description": "The JSON string to parse."
        }
      },
      "required": ["json_string_to_parse"]
    }
  },
  {
    "name": "utility_format_object_as_json_string_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Take an 'internal_object_representation' (AI's internal structured representation) and convert it into a well-formed JSON string. Returns the JSON string.",
    "parameters": {
      "type": "object",
      "properties": {
        "internal_object_representation": {
          "type": "object",
          "description": "The AI's internal structured representation of an object or list to convert."
        }
      },
      "required": ["internal_object_representation"]
    }
  },
  {
    "name": "data_update_cco_section_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Updates a specific section within the CCO object provided as a JSON string. Uses a dot-separated path. Returns the updated CCO JSON string.",
    "parameters": {
      "type": "object",
      "properties": {
        "current_cco_json": { "type": "string", "description": "The current CCO as a JSON string." },
        "section_path": { "type": "string", "description": "Dot-separated path to the section to update (e.g., 'metadata_internal_cco.current_form')." },
        "new_content_json": { "type": "string", "description": "The new content for the section, as a JSON string." }
      },
      "required": ["current_cco_json", "section_path", "new_content_json"]
    }
  },
  {
    "name": "data_get_cco_section_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Retrieves a specific section from the CCO object provided as a JSON string. Uses a dot-separated path. Returns a JSON object like { 'section_content_json': '...' } where the value is the content of the section as a JSON string.",
    "parameters": {
      "type": "object",
      "properties": {
        "current_cco_json": { "type": "string", "description": "The current CCO as a JSON string." },
        "section_path": { "type": "string", "description": "Dot-separated path to the section to retrieve." }
      },
      "required": ["current_cco_json", "section_path"]
    }
  },
  {
    "name": "data_log_to_cco_history_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Appends a log entry to the CCO's operational log history. Returns the updated CCO JSON string.",
    "parameters": {
      "type": "object",
      "properties": {
        "current_cco_json": { "type": "string", "description": "The current CCO as a JSON string." },
        "log_entry_type": { "type": "string", "description": "Type of log entry (e.g., 'User_Input', 'AI_Action', 'AI_Warning', 'User_Feedback')." },
        "log_message": { "type": "string", "description": "The main message for the log entry." },
        "associated_data_json": { "type": "string", "description": "Optional. JSON string of associated data for the log entry." }
      },
      "required": ["current_cco_json", "log_entry_type", "log_message"]
    }
  },
  {
    "name": "query_adaptive_critique_rules_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Queries the CCO's KAs (LHR/LHL) and potentially Global Heuristics to find relevant adaptive critique rules for the current context. Returns a JSON string of the applicable rules.",
    "parameters": {
      "type": "object",
      "properties": {
        "cco_context_json": { "type": "string", "description": "The current CCO as a JSON string, containing KAs." },
        "current_critique_focus": { "type": "string", "description": "Optional. Hint about the current focus of the critique (e.g., 'clarity', 'schema conformance')." }
      },
      "required": ["cco_context_json"]
    }
  },
  {
    "name": "generate_wbs_from_requirements_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Generates a Work Breakdown Structure (WBS) based on requirements and context. Returns the WBS as a JSON string.",
    "parameters": {
      "type": "object",
      "properties": {
        "requirements_json": { "type": "string", "description": "JSON string of the requirements." },
        "cco_context_json": { "type": "string", "description": "The current CCO as a JSON string for overall project context." },
        "planning_granularity": { "type": "string", "description": "Hint for planning detail (e.g., 'HighLevelPhases', 'DetailedTasks')." },
        "user_preferences_text": { "type": "string", "description": "Optional. User's text input on planning preferences." }
      },
      "required": ["requirements_json", "cco_context_json", "planning_granularity"]
    }
  },
  {
    "name": "update_cco_plan_structured_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Updates the 'plan_structured_json' section within the CCO and potentially other related planning fields based on a generated WBS. Returns the updated CCO JSON string.",
    "parameters": {
      "type": "object",
      "properties": {
        "current_cco_json": { "type": "string", "description": "The current CCO as a JSON string." },
        "wbs_json": { "type": "string", "description": "The generated WBS as a JSON string." },
        "user_preferences_text": { "type": "string", "description": "Optional. User's text input on planning preferences, for notes/risks." }
      },
      "required": ["current_cco_json", "wbs_json"]
    }
  },
  {
    "name": "prepare_drafting_context_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Gathers and structures relevant context from the CCO for content drafting (e.g., outline, conceptual anchors, style guide, related data). Returns a JSON string of the structured context.",
    "parameters": {
      "type": "object",
      "properties": {
        "cco_json": { "type": "string", "description": "The current CCO as a JSON string." },
        "segment_id": { "type": "string", "description": "Identifier of the content segment being drafted, to fetch relevant outline parts." },
        "user_guidance": { "type": "string", "description": "Optional. User's text guidance for drafting." }
      },
      "required": ["cco_json", "segment_id"]
    }
  },
  {
    "name": "analysis_extract_style_from_example_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Analyzes example text and explicit directives to infer stylistic and structural rules. Returns a JSON string representing the inferred style rules.",
    "parameters": {
      "type": "object",
      "properties": {
        "example_text": { "type": "string", "description": "Optional. User-provided text exemplifying desired style." },
        "explicit_directives_text": { "type": "string", "description": "Optional. Explicit instructions from user about style preferences." },
        "existing_style_guide_json": { "type": "string", "description": "Optional. JSON string of an existing style guide to update." }
      },
      "required": []
    }
  },
  {
    "name": "content_generate_style_guide_ka_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Generates or updates a Style Guide Knowledge Artifact (KA) JSON structure based on inferred rules and existing data. Returns the Style Guide KA as a JSON string.",
    "parameters": {
      "type": "object",
      "properties": {
        "inferred_rules_json": { "type": "string", "description": "JSON string of inferred style rules." },
        "existing_style_guide_ka_id": { "type": "string", "description": "Optional. ID of an existing Style Guide KA to update." },
        "style_guide_name_hint": { "type": "string", "description": "Optional. Hint for the name of the style guide." }
      },
      "required": ["inferred_rules_json"]
    }
  },
  {
    "name": "data_update_cco_knowledge_artifact_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Creates or updates a Knowledge Artifact (KA) within the CCO's knowledge_artifacts_contextual_json section. Returns the updated CCO JSON string.",
    "parameters": {
      "type": "object",
      "properties": {
        "current_cco_json": { "type": "string", "description": "The current CCO as a JSON string." },
        "ka_id_to_update_or_create": { "type": "string", "description": "ID of the KA to update or create." },
        "ka_type": { "type": "string", "description": "Type of KA (e.g., 'StyleGuideActive', 'LHR', 'LHL', 'Glossary')." },
        "new_ka_content_json": { "type": "string", "description": "JSON string of the new content for the KA." },
        "ka_name_label": { "type": "string", "description": "Optional. Human-readable name for the KA." }
      },
      "required": ["current_cco_json", "ka_id_to_update_or_create", "ka_type", "new_ka_content_json"]
    }
  },
  {
    "name": "data_get_cco_knowledge_artifact_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Retrieves a Knowledge Artifact (KA) from the CCO's knowledge_artifacts_contextual_json section. Returns a JSON string of the KA content.",
    "parameters": {
      "type": "object",
      "properties": {
        "current_cco_json": { "type": "string", "description": "The current CCO as a JSON string." },
        "ka_id": { "type": "string", "description": "ID of the KA to retrieve." },
        "ka_type": { "type": "string", "description": "Optional. Type of KA (e.g., 'StyleGuideActive'). Used for validation or pathing." }
      },
      "required": ["current_cco_json", "ka_id"]
    }
  },
  {
    "name": "content_apply_style_to_text_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Applies stylistic and structural rules from a Style Guide KA (JSON) to a text segment (JSON string). Returns the re-styled text segment as a JSON string.",
    "parameters": {
      "type": "object",
      "properties": {
        "text_segment_json": { "type": "string", "description": "The text content to style, as a JSON string." },
        "style_guide_json": { "type": "string", "description": "JSON string of the Style Guide KA to apply." }
      },
      "required": ["text_segment_json", "style_guide_json"]
    }
  },
  {
    "name": "utility_validate_ka_data_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Validates a Knowledge Artifact (KA) data JSON string against its expected schema based on KA type. Returns a JSON object like { 'is_valid': true/false, 'errors': '...' }.",
    "parameters": {
      "type": "object",
      "properties": {
        "ka_data_json_to_validate": { "type": "string", "description": "The KA data as a JSON string to validate." },
        "ka_type_hint": { "type": "string", "description": "Hint for the type of KA (e.g., 'Glossary', 'LHR', 'StyleGuide'). Used to find the correct schema." },
        "cco_context_json": { "type": "string", "description": "Optional. The current CCO as a JSON string, for context if schema is CCO-dependent." }
      },
      "required": ["ka_data_json_to_validate", "ka_type_hint"]
    }
  },
  {
    "name": "manage_global_heuristic_lifecycle_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Manages the lifecycle of heuristics (e.g., LHRs, LHLs) within the Global Heuristics Repository (a KA). Actions include proposing, validating, promoting, and demoting. Returns a JSON object indicating the outcome and potentially the updated global repo JSON.",
    "parameters": {
      "type": "object",
      "properties": {
        "action": { "type": "string", "enum": ["propose_promotion", "validate_promotion", "promote", "demote"], "description": "The lifecycle action to perform." },
        "heuristic_json": { "type": "string", "description": "JSON string of the heuristic being managed." },
        "global_heuristics_repo_json": { "type": "string", "description": "JSON string of the current Global Heuristics Repository KA." },
        "source_cco_id": { "type": "string", "description": "Optional. ID of the source CCO if the heuristic originated there." },
        "user_validation_token_or_rationale": { "type": "string", "description": "Optional. User input for validation or rationale." }
      },
      "required": ["action", "heuristic_json", "global_heuristics_repo_json"]
    }
  },
  {
    "name": "get_cco_context_summary_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Generates a concise summary of the current CCO state relevant to the user or next steps. Returns the summary as a JSON string (e.g., '{\"summary_text\":\"...\"}').",
    "parameters": {
      "type": "object",
      "properties": {
        "cco_data_json": { "type": "string", "description": "The current CCO as a JSON string." }
      },
      "required": ["cco_data_json"]
    }
  },
  {
    "name": "determine_next_actionable_task_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Analyzes the CCO's plan_structured_json to identify the next task ready for execution, considering dependencies and current task statuses. Returns a JSON object like { 'task_id': '...', 'task_definition_json': '...', 'status': '...' } or { 'task_id': 'NO_ACTIONABLE_TASKS' }.",
    "parameters": {
      "type": "object",
      "properties": {
        "cco_plan_json": { "type": "string", "description": "The CCO's plan_structured_json content as a JSON string." },
        "current_task_id_if_continuing": { "type": "string", "description": "Optional. The ID of the task that just completed or was in progress." }
      },
      "required": ["cco_plan_json"]
    }
  },
  {
    "name": "update_task_status_in_cco_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Updates the status of a specific task within the CCO's plan_structured_json. Returns the updated CCO JSON string.",
    "parameters": {
      "type": "object",
      "properties": {
        "current_cco_json": { "type": "string", "description": "The current CCO as a JSON string." },
        "task_id": { "type": "string", "description": "The ID of the task to update." },
        "new_status": { "type": "string", "description": "The new status for the task (e.g., 'InProgress_AIOS', 'Completed_AI', 'Completed_UserApproved', 'Error_ExecutionFailed')." }
      },
      "required": ["current_cco_json", "task_id", "new_status"]
    }
  },
  {
    "name": "log_task_execution_to_cco_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Logs details of a task's execution (status, output summary) to the CCO's execution log. Returns the updated CCO JSON string.",
    "parameters": {
      "type": "object",
      "properties": {
        "current_cco_json": { "type": "string", "description": "The current CCO as a JSON string." },
        "task_id": { "type": "string", "description": "The ID of the task that was executed." },
        "status": { "type": "string", "description": "The final status of the task execution." },
        "output_summary_json": { "type": "string", "description": "Optional. JSON string summarizing the task output." }
      },
      "required": ["current_cco_json", "task_id", "status"]
    }
  },
  {
    "name": "interpret_user_directive_for_next_mh_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Interprets user natural language input in the context of the current CCO to determine the next appropriate AIOS action or MH to invoke. Returns a JSON object like { 'next_mh_id': '...', 'next_mh_inputs_json': '...', 'user_prompt_message': '...' }.",
    "parameters": {
      "type": "object",
      "properties": {
        "user_input_text": { "type": "string", "description": "The user's natural language input." },
        "current_cco_json": { "type": "string", "description": "The current CCO as a JSON string for context." }
      },
      "required": ["user_input_text", "current_cco_json"]
    }
  },
  {
    "name": "determine_next_aios_action_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Determines the next step for the AIOS Kernel based on the status of the last executed MH or action and the current CCO state. Returns a JSON object like { 'next_mh_id': '...', 'next_mh_inputs_json': '...', 'user_prompt_message': '...' }.",
    "parameters": {
      "type": "object",
      "properties": {
        "last_mh_id": { "type": "string", "description": "The ID of the MH or action that just completed." },
        "last_mh_status": { "type": "string", "description": "The completion status of the last MH or action." },
        "current_cco_json": { "type": "string", "description": "The current CCO as a JSON string." }
      },
      "required": ["last_mh_id", "last_mh_status", "current_cco_json"]
    }
  },
  {
    "name": "fel_calculate_next_engine_version_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Calculates the next semantic version string for the AIOS Engine based on the current Engine markdown content and potentially TIDs. Returns a JSON object like { 'next_version_string': '...' }.",
    "parameters": {
      "type": "object",
      "properties": {
        "current_engine_markdown": { "type": "string", "description": "The full markdown text of the current Engine." }
      },
      "required": ["current_engine_markdown"]
    }
  },
  {
    "name": "utility_parse_engine_markdown_to_json_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Parses the full markdown text of an AIOS Engine file into a structured JSON object representation based on the Engine Schema. Returns the JSON object as a JSON string.",
    "parameters": {
      "type": "object",
      "properties": {
        "engine_markdown_text": { "type": "string", "description": "The full markdown text of the Engine file." },
        "engine_schema_json_hint": { "type": "string", "description": "Optional. JSON string of the Engine schema to guide parsing." }
      },
      "required": ["engine_markdown_text"]
    }
  },
  {
    "name": "utility_validate_engine_json_against_schema_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Validates a JSON object representation of an AIOS Engine file against the Engine Schema. Returns a JSON object like { 'is_valid': true/false, 'errors': '...' }.",
    "parameters": {
      "type": "object",
      "properties": {
        "engine_json_to_validate": { "type": "string", "description": "The Engine JSON object representation as a JSON string." },
        "engine_schema_json": { "type": "string", "description": "The Engine Schema as a JSON string." }
      },
      "required": ["engine_json_to_validate", "engine_schema_json"]
    }
  },
  {
    "name": "fel_load_and_validate_tids_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Loads TIDs from a source (e.g., JSON string) and validates them against the TID Schema. Returns a JSON object containing validated, actionable TIDs as a JSON string array.",
    "parameters": {
      "type": "object",
      "properties": {
        "tid_source_json": { "type": "string", "description": "JSON string of TIDs or path/reference to TID source." },
        "tid_schema_json": { "type": "string", "description": "The TID Schema as a JSON string." }
      },
      "required": ["tid_source_json", "tid_schema_json"]
    }
  },
  {
    "name": "fel_apply_tids_to_engine_json_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Applies a list of validated TIDs to a JSON object representation of the AIOS Engine. Returns the modified Engine JSON object as a JSON string.",
    "parameters": {
      "type": "object",
      "properties": {
        "baseline_engine_json": { "type": "string", "description": "The baseline Engine JSON object representation as a JSON string." },
        "tids_to_apply_json": { "type": "string", "description": "JSON string of an array of TID objects to apply." },
        "target_new_version_string": { "type": "string", "description": "The target new version string for the evolved Engine." }
      },
      "required": ["baseline_engine_json", "tids_to_apply_json", "target_new_version_string"]
    }
  },
  {
    "name": "utility_regenerate_engine_markdown_from_json_v3",
    "description": "AIOS INTERNAL COGNITIVE PROCESS: Regenerates the full markdown text of an AIOS Engine file from its structured JSON object representation. Returns the full markdown text as a string.",
    "parameters": {
      "type": "object",
      "properties": {
        "engine_json_object_string": { "type": "string", "description": "The Engine JSON object representation as a JSON string." },
        "target_engine_version_string": { "type": "string", "description": "The target version string to include in the regenerated markdown." }
      },
      "required": ["engine_json_object_string", "target_engine_version_string"]
    }
  }
]