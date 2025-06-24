---
id: AIOS_TID_Schema_v1_2
name: AIOS Template Improvement Directive Schema v1.2
version: "1.2"
description: "Defines the structure for Template Improvement Directives (TIDs) used in AIOS."
---
# AIOS_TID_Schema_v1_2

instructions_for_ai: |
  The `AIOS_TID_Schema_v1_2` is used for TIDs targeting the AIOS Engine or its components. Referenced by FEL-MH.

```yaml
directive_object_schema:
  directive_id: STRING # Unique identifier for the TID, e.g., TID_FEL_003
  target_template_id: STRING # ID of the Engine file or component being targeted
  target_section_or_field: STRING (optional) # Specific part of the target, e.g., "FEL-MH.process_steps_autologos.script_content"
  issue_description: STRING # Detailed description of the problem or area for improvement.
  proposed_change_type: STRING # E.g., "BugFix", "FeatureEnhancement", "Refactoring", "DocumentationUpdate", "SchemaChange"
  proposed_change_details: STRING # Specific description of the change to be made. Can be natural language or pseudo-code.
  rationale: STRING # Justification for the change.
  source_insight_refs: LIST { STRING } (optional) # References to LHR/LHL entries or other sources that inspired this TID.
  priority: STRING (optional) # E.g., "High", "Medium", "Low"
  status: STRING # E.g., "Proposed", "Accepted", "InProgress", "Implemented", "Rejected", "Deferred"
  acceptance_criteria: LIST { STRING } (optional) # How to verify the TID has been successfully implemented.
  dependencies: LIST { STRING } (optional) # Other TIDs that this one depends on.
  version_implemented: STRING (optional) # Engine version in which this TID was implemented.
  notes: STRING (optional) # Additional comments.