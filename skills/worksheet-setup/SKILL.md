---
name: worksheet-setup
description: Set up a new LaTeX worksheet or assignment from a PDF. Use this skill whenever the user wants to create a new assignment, worksheet, problem set, or homework from a PDF file. Triggers on "new worksheet", "set up assignment", "new assignment", "setup worksheet", "create worksheet", "/worksheet", or when the user provides an assignment PDF and wants questions extracted into LaTeX \qs{}{} format. Also use when the user says "here's the new worksheet", "I got a new assignment", "set up w6", or anything about preparing a blank worksheet from assignment questions. Even if the user just drops a PDF path and says "set this up" in a worksheets/assignments directory, use this skill.
---

# Worksheet Setup

Create a complete LaTeX worksheet project from an assignment PDF. The output is a folder with individual question files using the `\qs{}{}` macro, ready for the user to write solutions.

## Why this exists

The user repeatedly does the same thing: gets a new assignment PDF, creates a LaTeX project, and types out each question into `\qs{}{}` blocks. This skill automates that so they can jump straight to solving.

## Workflow

### 1. Derive the project from the PDF path

The user provides a PDF path — that's all you need. Everything else is derived automatically:
- **Folder name**: strip the `.pdf` extension from the filename (e.g., `w6.pdf` → `w6/`, `a4.pdf` → `a4/`)
- **Parent directory**: the current working directory
- **PDF location**: move or copy the PDF into the new folder after creation

Do not ask for a project name, parent directory, or anything else. If the user says "set up w6.pdf" or "here's the new assignment: /path/to/w6.pdf", just go. If they explicitly provide a different folder name (e.g., "call it hw3"), use that instead.

### 2. Find and copy template files

The user's LaTeX setup uses three shared template files that are identical across all their projects:
- `preamble.tex` — full LaTeX preamble (~19K lines, defines the `\qs{}{}` command, tcolorbox environments, styling)
- `macros.tex` — custom commands (`\sol`, `\solve`, math shortcuts like `\eps`, `\R`, `\del`)
- `letterfonts.tex` — font configuration

To find them:
1. Look for sibling directories in the parent folder (e.g., if creating `w6/`, look in `w5/`, `w4/`, etc.)
2. Pick one that has all three files
3. Copy them to the new project folder

```bash
cp <sibling>/preamble.tex <sibling>/macros.tex <sibling>/letterfonts.tex <new-folder>/
```

If no sibling has these files, ask the user where they are.

### 3. Create the project structure

```bash
mkdir -p <folder-name>/images
```

Copy the template files into the new folder, then copy/move the PDF into it too (so everything is self-contained).

### 4. Read the PDF and extract questions

Read the PDF with the Read tool. Questions follow this pattern:
- **"Question N"** followed by a point value in parentheses like "(6 pts)" or "(3 pts + 3 pts extra credit)"
- The question body runs until the next "Question N+1" heading

For each question, capture:
- The question number
- The complete question text

### 5. Create question files

For each question, create `qN.tex` using this exact template:

```latex
\documentclass[main.tex]{subfiles}
\begin{document}

\qs{Question N}{
<question text>
}

\sol

\end{document}
```

**Formatting the question text inside `\qs{}{}`:**

- Convert all math to LaTeX: `$...$` for inline, `\[...\]` or `align*` for display math
- Greek letters become LaTeX commands: lambda -> `$\lambda$`, gamma -> `$\gamma$`, etc.
- Equation/page references from the textbook stay as-is: "(12.2)", "page 310"
- Monospace/code text (like `wrong`, `right` in the PDF) -> `\texttt{wrong}`, `\texttt{right}`
- Bold text -> `\textbf{}`
- Subscripts/superscripts in math mode: `$G_{t:t+n}^{\lambda s}$`
- Point values like "(6 pts)" should be included at the start of the question text, matching the PDF
- Preserve paragraph breaks within multi-paragraph questions

**Rules:**
- **Never write solution content.** Only `\sol` followed by a blank line — nothing else after it. The user will write their own solutions.
- **Do not add `\solve{}`.** Just `\sol` by itself.
- Figures/diagrams from the PDF cannot be extracted. Add a comment `% TODO: Add figure from assignment PDF` where the figure should go, and tell the user which questions need manual figure insertion.

### 6. Create main.tex

```latex
\documentclass{report}

\input{preamble}
\input{macros}
\input{letterfonts}

\usepackage{subfiles}

\title{\Huge{<title>}}
\author{\huge{Seif Metwally}}
\date{}

\begin{document}

\maketitle

\subfile{q1}
\subfile{q2}
...
\subfile{qN}

\end{document}
```

For the title: use the assignment title from the PDF header if available (e.g., "Worksheet 5", "Assignment w5 -- Eligibility traces"). Otherwise, use the project name.

Include exactly as many `\subfile{}` lines as there are questions — no more, no fewer.

### 7. Report what was created

After creating everything, tell the user:
- How many question files were created
- The title used
- Any questions that need attention (figures to add, ambiguous formatting, etc.)
