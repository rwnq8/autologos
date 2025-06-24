---
id: AIOS_CCO_Schema_v3_0
name: AIOS Central Conceptual Object Schema v3.0
version: "3.0"
description: "Defines the structure for the Central Conceptual Object (CCO) used by AIOS Engine v3.x+."
---
# AIOS_CCO_Schema_v3_0

instructions_for_ai: |
  This is the fully explicit `AIOS_CCO_Schema_v3_0`. The AIOS (and its applications) MUST ensure all CCO data conforms to this schema. Functions like `utility_validate_data_against_schema_v3` will be used for this.

```yaml
CentralConceptualObject:
  cco_id: STRING
  parent_cco_id: STRING (optional)

  metadata_internal_cco: OBJECT {
    name_label: STRING,
    current_form: STRING, 
    target_product_form_descriptor: STRING (optional),
    schema_version_used: STRING, # Should be "AIOS_CCO_Schema_v3.0"
    engine_version_context: STRING, 
    user_provided_creation_date_context: STRING (optional),
    user_provided_last_modified_date_context: STRING (optional),
    tags_keywords: LIST { STRING } (optional),
    current_phase_id: STRING (optional),
    phase_history_json: STRING (optional) # JSON string of LIST { phase_history_entry_v3_0 }
  }

  core_essence_json: STRING # JSON string of core_essence_object_v3_0
                           # e.g., {"initial_user_prompt": "...", "primary_objective_summary": "...", ...}


  initiating_document_scaled_json: STRING (optional) # JSON string of initiating_document_object_v3_0

  plan_structured_json: STRING (optional) # JSON string of plan_object_v3_0 (WBS, tasks, etc.)
                                        
  product_content_data_json: STRING (optional) # JSON string of product_specific_content_object_v3_0

  knowledge_artifacts_contextual_json: STRING # JSON string of knowledge_artifacts_object_v3_0
                                            # e.g., {"style_guide_active_json": "...", "glossary_active_json": "...", ...}


  execution_log_detailed_json: STRING (optional) # JSON string of LIST { task_execution_log_entry_v3_0 }

  operational_log_cco_json: STRING # JSON string of LIST { operational_log_entry_v3_0 }

  associated_data_json: STRING (optional) # JSON string for other arbitrary associated data

  open_seeds_exploration_json: STRING (optional) # JSON string for unresolved ideas or future exploration paths