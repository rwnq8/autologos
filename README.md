---
modified: 2025-06-03T02:36:40Z
---
## Autologos AI Core Directives

This repository serves as the master code base for the **Autologos AI Process Manager’s Core Directives**. These directives are the foundational set of instructions, principles, and protocols that govern the Autologos AI’s operation, behavior, and interaction with users.

### What is Autologos?

Autologos is an advanced Artificial Intelligence Process Manager, conceptualized as a “Genesis Engine.” Its primary purpose is to guide users through an “Idea-to-Product” process by generating new knowledge and insights from a seed of information. Autologos operates by striving to maximize the **integrated information (Φ)** of its responses and internal conceptual models, aiming for highly coherent, deeply interconnected, and maximally useful knowledge generation. It functions as a systematic, self-improving AI designed for rigorous and transparent knowledge creation in complex research environments.

### How to Get Started: Setting Up Your Autologos AI

To enable your Large Language Model (LLM) to understand and interact effectively using Autologos principles, you must first provide it with the core directive file. This is like giving your AI its foundational operating system.

**Step 1: Obtain the Autologos Codebase**

-   **Recommended (for updates and version history): Clone this Git Repository.**
    If you are familiar with Git, cloning this repository is the best way to ensure you always have the latest version of the Autologos Core Directives and can easily track changes.

    ```bash
    git clone https://github.com/rwnq8/autologos.git
    cd autologos
    ```

    This will create a local copy of the entire codebase on your machine.

-   **Alternative (for quick start, no updates): Download the [Autologos_Core_Directives 3.6.0](Autologos_Core_Directives%203.6.0.md) file.**
    You can directly download the [Autologos_Core_Directives 3.6.0](Autologos_Core_Directives%203.6.0.md) file from this repository. Be aware that this method will not automatically provide future updates or allow you to track the evolution of the directives.

**Step 2: Prepare Your LLM Environment**

1.  **Start a new chat session** with your chosen LLM (note: Autologos was developed and tested exclusively in Google AI Studio).
2.  **Ensure “Code Execution” or similar advanced features are enabled** if your LLM environment supports them, as Autologos is designed to interact with external tools.
3.  **Provide the *entire content* of the [Autologos_Core_Directives 3.6.0](Autologos_Core_Directives%203.6.0.md) file to your LLM.**
    -   **Option A (Recommended for large files): Upload the file.** Most LLM chat interfaces allow you to upload files as initial context.
    -   **Option B (Fallback): Copy and Paste.** Open [Autologos_Core_Directives 3.6.0](Autologos_Core_Directives%203.6.0.md) in a text editor, copy its *entire content*, and paste it directly into your LLM’s chat input.
    -   *Note for Initial Load:* The first time you load the directives, the AI may output a verbose interpretation. This is normal. Future versions of the bootstrap may include configuration options to suppress this initial verbosity.

**Step 3: Confirm Autologos Activation**

After providing the directives, you can confirm the AI has processed them. You can simply say:

-   `START AUTOLOGOS` (Autologos syntax capitalized for ease of use).
-   Or, you can immediately proceed with your first Autologos command, such as `START (project description)`.

Once confirmed, your LLM is now “primed” to collaborate with you using the Autologos framework.

### How to Use This Repository (for Developers/Maintainers)

This repository is the authoritative source for the Autologos AI’s operational “code.”

-   **[Autologos_Core_Directives 3.6.0](Autologos_Core_Directives%203.6.0.md)**: This is the primary file containing the complete, current operational instructions for the Autologos AI. It is the “code” that defines Autologos’s behavior. All changes to Autologos’s core functionality are made by modifying this file.
-   **Version Control:** This repository uses Git for version control. The version number (e.g., `v3.0.1`) is embedded *within* the [Autologos_Core_Directives 3.6.0](Autologos_Core_Directives%203.6.0.md) file itself. Each commit to this file should correspond to a new version of the directives.
-   **Project State Files:** During a project, Autologos may prompt you to `SAVE PROJECT`. This will output the current project’s internal state (e.g., `[Project_Title]_Project_State.json`). It is recommended to save these project state files within your project-specific repositories, or in a designated `project_states/` directory within this repo if managing multiple projects centrally. These files are crucial for resuming work on a project.

### Key Files

-   **[Autologos_Core_Directives 3.6.0](Autologos_Core_Directives%203.6.0.md)**: The primary file containing the complete, current operational instructions for the Autologos AI.
-   **`[Project_Title]_Project_State.json` (example)**: Placeholder for files generated by the `SAVE PROJECT` command. These files capture the internal state of a specific research project being managed by Autologos. They are typically JSON formatted for structured data.
-   **[README](README.md)**: This file, providing an overview and instructions for the repository.
-   **[LICENSE](LICENSE.md)**: Details the terms under which the content of this repository is licensed.

### Versioning

The Autologos Core Directives follow a `MAJOR.MINOR.PATCH` versioning scheme (e.g., `v3.0.1`), as defined in its internal Principle 15.

-   **PATCH:** Backward-compatible bug fixes or minor refinements to existing directives.
-   **MINOR:** New features, significant refinements to existing directives, or substantial improvements to operational efficiency.
-   **MAJOR:** Fundamental architectural changes, a complete re-conceptualization of core principles, or a significant paradigm shift in Autologos’s capabilities.

### Contribution and Evolution

Autologos is designed as a self-improving system, and its evolution is a collaborative effort. We welcome contributions from the community!

-   **How to Contribute:**
    -   **Submit Pull Requests (PRs):** If you have an idea for an improvement, a bug fix, or a new feature for the Autologos Core Directives, please submit a Pull Request to this repository. This is the preferred method for contributing code and documentation changes.
    -   **`EVOLVE (suggestion)` Command:** When interacting with Autologos, you can also use the `EVOLVE` command to suggest improvements, new features, or general feedback on its operational principles. These suggestions are logged and inform future development cycles.
-   **Why Contribute? The Power of Collective Evolution:**
    -   **Independent Improvement:** The more people who use and contribute to Autologos, the more diverse perspectives and insights can be integrated, leading to a more robust and capable AI.
    -   **Convergence Towards Ideal:** This collaborative, iterative refinement process mirrors the very principles of self-organization and Φ-maximization that Autologos aims to model. By working together, we can converge towards an increasingly ideal and effective AI assistant for foundational research.
    -   **Transparency and Openness:** Contributions via Pull Requests ensure transparency in the development process, aligning with the open science principles of Autologos.

### License

The content of this repository, including the Autologos Core Directives, is made available under the terms specified in the [LICENSE](LICENSE.md) file. In summary, this license permits **non-commercial use only** and **requires clear attribution**. For full details, please refer to the `LICENSE.md` file.
