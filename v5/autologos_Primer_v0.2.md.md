## Welcome to autologos!

Imagine talking to your AI assistant not just casually, but in a way that helps it understand your logical instructions clearly, like teaching a smart, eager student. That's the idea behind **autologos**. It's a special way of using natural language that makes it easier for you to guide your AI through complex tasks, and easier for the AI to understand exactly what you mean.

Think of it like **Logo for the AI Age**. Logo taught kids how to program by moving a turtle with simple commands. autologos helps you "program" your AI assistant by using simple, logical ideas and clear commands to orchestrate tasks and manage information.

The best part? You don't need to be a programmer, and you don't need to memorize complicated rules!

## The Core Idea: Speak Your Logic, The AI Understands

autologos is a **controlled natural language**. But unlike strict programming languages, the "control" part is mostly the **AI's job**. Your job is to express your logical intent clearly in your own words. The AI will do its best to understand, even if your phrasing isn't perfect.

Think of it as: **You speak your logic, and the AI interprets it.**

## How to Help Your AI Understand (Simple Principles)

While the AI is fault-tolerant, you can help it understand your logical instructions better by keeping a few simple principles in mind:

1.  **Be Clear About Conditions:** If you want something to happen *only if* something else is true, use clear "if... then..." phrasing.
    *   *Example:* "IF the task status is 'Not Started', THEN add it to the 'To Do' list."
2.  **Be Clear About Repetition:** If you want the AI to do something for *every* item in a group, say so clearly.
    *   *Example:* "FOR EACH item in the 'Critique Findings' list, check its severity."
3.  **Be Clear About Actions:** Use clear verbs to tell the AI what to do.
    *   *Example:* "GET the data from the 'Input File'." "SET the status of 'Task 5' to 'Complete'."
4.  **Be Clear About What You're Talking About (Data):** Use consistent names or descriptions for the information.
5.  **Use Commands to Guide (Optional but Helpful!):** Use **ALL CAPS** for core commands as strong signals.

## Core autologos Commands (Your AI Assistant Will Understand These!)

*   **`THOUGHTS?` / `ANALYSIS?`**: AI analyzes and shares its thoughts.
*   **`PLAN?` / `NEXT_STEPS?`**: AI proposes a plan.
*   **`PROCEED` / `OK` / `CONTINUE`**: You agree for AI to execute.
*   **`QUESTIONS?`**: AI asks clarifying questions.
*   **`EXPAND (on X)` / `ELABORATE (on X)`**: Request more detail.
*   **`CRITIQUE (X)` / `REVIEW (X)`**: AI evaluates something.
*   **`GENERATE (X based on Y)` / `DRAFT (X based on Y)`**: AI creates something.
*   **`OPTIONS? (for X)`**: AI lists alternatives.
*   **`DECIDE (Option A)` / `CHOOSE (Option A)`**: You select an option.
*   **`INVOKE (FunctionName with parameters)`**: Tell AI to run an external function.
    *   *You say:* "`INVOKE` 'calculate_metrics' with data = 'Report JSON'."
    *   *AI responds:* "FUNCTION_CALL_REQUEST: INVOKE calculate_metrics(data = Report_JSON). EXECUTE_AND_PROVIDE_RESULT?"
*   **`STOP` / `PAUSE`**: Halt current process.
*   **`SNAPSHOT?` / `SAVE_SESSION?`**: AI generates a state summary for resumption.
*   **`RESUME (from Snapshot Data)`**: Provide snapshot to continue.

## The AI's Side of the Conversation
The AI will also use ALL CAPS commands in its responses for clarity (e.g., `ANALYSIS_COMPLETE. NEXT?`, `PROPOSED_PLAN: [...] PROCEED?`).

## Conclusion: Your Partner in Logic
autologos is about clear logical communication with your AI, empowering you to orchestrate complex tasks.