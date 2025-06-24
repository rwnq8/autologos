{
  "type": "object",
  "title": "ObjectiveIterationCycle_KnowledgeArtifact",
  "description": "An exportable summary of an Objective Iteration Cycle session.",
  "properties": {
    "session_metadata": {
      "type": "object",
      "description": "Information about the session itself.",
      "properties": {
        "export_date": {
          "type": "string",
          "format": "date-time"
        },
        "initial_user_goal": {
          "type": "string"
        },
        "total_iterations": {
          "type": "integer"
        },
        "session_ended_mode": {
          "type": "string",
          "enum": ["Brainstorming", "Deep Dive", "Focused Refinement", "Quick Check", "Not Applicable"]
        }
      },
      "required": ["export_date", "initial_user_goal", "session_ended_mode"]
    },
    "final_primary_output": {
      "type": "string",
      "description": "The latest version of the main document, idea, plan, or content that was being refined."
    },
    "key_decisions_log": {
      "type": "array",
      "description": "A log of key decisions made during the session (if explicitly tracked).",
      "items": {
        "type": "object",
        "properties": {
          "decision": {"type": "string"},
          "rationale": {"type": "string"},
          "iteration_number_decided": {"type": "integer"}
        },
        "required": ["decision"]
      }
    },
    "unresolved_critical_questions": {
      "type": "array",
      "description": "Critical questions that were last posed but not yet addressed or resolved.",
      "items": {
        "type": "string"
      }
    },
    "backlog_items": {
      "type": "array",
      "description": "Items in the Backlog for future consideration.",
      "items": {
        "type": "object",
        "properties": {
          "item_description": {"type": "string"},
          "notes": {"type": "string"},
          "intended_phase": {"type": "string"}
        },
        "required": ["item_description"]
      }
    },
    "archived_items": {
      "type": "array",
      "description": "Items in the Archive for record-keeping.",
      "items": {
        "type": "object",
        "properties": {
          "item_description": {"type": "string"},
          "reason_for_archiving": {"type": "string"},
          "date_archived": {"type": "string", "format": "date"}
        },
        "required": ["item_description"]
      }
    }
  },
  "required": [
    "session_metadata",
    "final_primary_output"
  ]
}