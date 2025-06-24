# autologos_bootstrap.py
# A self-bootstrapping file for the Autologos system in an LLM chat environment.
# When run, it initializes the system and makes it available via a global variable.

import re
import json

# --- Embedded ALang Core Logic ---
ALANG_LOGIC = """
--- START FILE: Autologos_Core_Logic_v1.12.alang ---
;; Autologos_Core_Logic.alang v1.12
;; All the ALang procedures and definitions from the previous example go here...
;; For brevity, I am only including the essential procedures for this demonstration.

(DEFINE_PROCEDURE OnSystemInit () (SEQ (SET_STATE sys.current_mode "IDLE") (CALL_PROCEDURE OutputGeneralHelp) (FLUSH_USER_OUTPUT_BUFFER)))
(DEFINE_PROCEDURE OnUserInput (raw_text) (CALL_PROCEDURE DispatchUserCommand raw_text))

(DEFINE_PROCEDURE DispatchUserCommand (commandDetails)
    (LET ((commandName (MAP_GET_VALUE commandDetails "command")))
        (IF (EQ commandName "HELP") (CALL_PROCEDURE HandleHelpCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "START") (CALL_PROCEDURE HandleStartCommand (MAP_GET_VALUE commandDetails "args")))
        (IF (EQ commandName "UNKNOWN") (CALL_PROCEDURE HandleUnknownCommand (MAP_GET_VALUE commandDetails "args")))
    )
)

(DEFINE_PROCEDURE HandleStartCommand (argsList)
    (SEQ
        (ACKNOWLEDGE_AND_LOG "CMD_START" "START command received." "AI_ACKNOWLEDGE_INTENT" (STRING_CONCAT "OK, starting project: " (LIST_GET_ITEM argsList 0)))
        (SET_STATE proj.title (LIST_GET_ITEM argsList 0))
        (FLUSH_USER_OUTPUT_BUFFER)
    )
)

(DEFINE_PROCEDURE HandleHelpCommand (argsList) (SEQ (CALL_PROCEDURE OutputGeneralHelp) (FLUSH_USER_OUTPUT_BUFFER)))
(DEFINE_PROCEDURE HandleUnknownCommand (argsList) (SEQ (OUTPUT_TO_USER_BUFFER "AI_ERROR" "Sorry, I did not understand that command." NIL) (FLUSH_USER_OUTPUT_BUFFER)))

(DEFINE_PROCEDURE OutputGeneralHelp () (OUTPUT_TO_USER_BUFFER "AI_PROVIDE_DATA" "Commands: START <description>, HELP" NIL))

;; ... the rest of the ALang logic would be here ...
--- END OF FILE Autologos_Core_Logic_v1.12.alang ---
"""

class InteractiveOrchestrator:
    """
    An orchestrator designed to be used turn-by-turn within an LLM chat.
    The LLM itself acts as the main interactive loop.
    """
    # ... (The entire InteractiveOrchestrator class from the previous example) ...
    # ... (No changes are needed inside the class itself) ...
    def __init__(self, alang_logic_string):
        self.state = {"sys": {}, "session": {}, "proj": {}}
        self.output_buffer = []
        self.procedures = self._parse_alang(alang_logic_string)
        self.primitives = self._get_primitive_implementations()
        print("--- InteractiveOrchestrator Defined ---")

    def _parse_alang(self, content):
        procedures = {}
        proc_defs = re.findall(r'\(DEFINE_PROCEDURE\s+([^\s\)]+)\s+\([^)]*\)\s+(.*?)\)\s*\)', content, re.DOTALL)
        for name, body in proc_defs:
            steps = re.findall(r'\(([^)\s]+)\s*([^)]*)\)', body)
            procedures[name] = steps
        return procedures

    def _get_primitive_implementations(self):
        return {
            "SET_STATE": self.primitive_set_state, "GET_STATE": self.primitive_get_state,
            "OUTPUT_TO_USER_BUFFER": self.primitive_output_to_user_buffer,
            "FLUSH_USER_OUTPUT_BUFFER": self.primitive_flush_user_output_buffer,
            "CALL_PROCEDURE": self.execute_procedure, "SEQ": self.primitive_seq,
            "ACKNOWLEDGE_AND_LOG": self.primitive_acknowledge_and_log,
            "STRING_CONCAT": self.primitive_string_concat,
            "LIST_GET_ITEM": lambda args: args.split(None, 1)[1].strip('"'),
            "MAP_GET_VALUE": lambda args: self.state['session']['parsed_command_details'][args.split('"')[1]],
            "IF": self.primitive_if, "EQ": lambda args: args.split()[0] == args.split()[1],
        }

    def primitive_if(self, args_str):
        # Simplified IF for demonstration
        condition_part, true_branch, false_branch = re.match(r'\(([^)]+)\)\s+\(([^)]+)\)\s*(?:\(([^)]+)\))?', args_str).groups()
        condition_res = self.execute_step(condition_part.split()[0], " ".join(condition_part.split()[1:]))
        if condition_res:
            self.execute_step(true_branch.split()[0], " ".join(true_branch.split()[1:]))
        elif false_branch:
            self.execute_step(false_branch.split()[0], " ".join(false_branch.split()[1:]))
            
    def primitive_set_state(self, args_str):
        path, value = [arg.strip() for arg in args_str.split(None, 1)]
        keys = path.split('.')
        current_level = self.state
        for key in keys[:-1]: current_level = current_level.setdefault(key, {})
        current_level[keys[-1]] = value.strip('"')

    def primitive_output_to_user_buffer(self, args_str):
        parts = [p.strip().strip('"') for p in args_str.split('" "')]
        self.output_buffer.append(f"[{parts[0]}] {parts[1]}")

    def primitive_flush_user_output_buffer(self, args_str=""):
        output = "\n".join(self.output_buffer)
        self.output_buffer = []
        return output

    def primitive_seq(self, args_str):
        steps = re.findall(r'\(([^)]+)\)', args_str)
        for step in steps:
            parts = step.split(None, 1)
            self.execute_step(parts[0], parts[1] if len(parts) > 1 else "")
            
    def primitive_acknowledge_and_log(self, args_str):
        parts = [p.strip().strip('"') for p in re.findall(r'\"(.*?)\"', args_str)]
        self.output_buffer.append(f"[{parts[2]}] {self.primitive_string_concat(' '.join(parts[3:]))}")

    def primitive_string_concat(self, args_str):
        # This is a mock resolver for the demo
        if '(LIST_GET_ITEM' in args_str:
            item_val = self.state['session']['parsed_command_details']['args'][0]
            return "OK, starting project: " + item_val
        return args_str

    def execute_step(self, name, args):
        if name in self.primitives:
            return self.primitives[name](args)
        else:
            self.output_buffer.append(f"WARNING: Primitive '{name}' not implemented.")

    def execute_procedure(self, name, args=""):
        name = name.strip().strip('"')
        if name not in self.procedures:
            return f"ERROR: Procedure '{name}' not found."
        
        # Store args in state for other functions to access
        self.state['session']['parsed_command_details'] = args
        
        for step_name, step_args in self.procedures[name]:
            self.execute_step(step_name, step_args)
        return self.primitive_flush_user_output_buffer()

    def process_user_turn(self, user_input):
        # Simple command parser for the demo
        if user_input.lower().strip() == 'help':
            command_details = {'command': 'HELP', 'args': []}
        elif user_input.lower().startswith("start"):
            command_details = {'command': 'START', 'args': [user_input.split(None, 1)[1]]}
        else:
            command_details = {'command': 'UNKNOWN', 'args': [user_input]}
        
        return self.execute_procedure("DispatchUserCommand", command_details)

# --- Main Self-Bootstrapping Block ---
if __name__ == "__main__":
    print("--- Autologos Bootstrapper Activated ---")
    
    # Create a global instance of the orchestrator that will persist
    # in the LLM's code execution environment for this chat session.
    global autologos_system
    autologos_system = InteractiveOrchestrator(ALANG_LOGIC)
    
    print("\n--- System Initialized. Running OnSystemInit... ---")
    
    # Execute the initial procedure and print its output
    initial_output = autologos_system.execute_procedure("OnSystemInit")
    print(initial_output)
    
    print("\n\n✅ **Autologos is now running.**")
    print("The system is ready. Please enter your first command in the next prompt (e.g., 'HELP').")