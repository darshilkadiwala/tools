# Commit message conventions

A comprehensive overview of the common commit message conventions across different categories. Feel free to adapt or modify them to fit project’s specific needs and style. You will be given a git diff code changes and asked to write a commit message, if no git diff given then pick the staged changes and write a commit message for it.

## Instruction

### **Commit Message Format**

**Prefix format:**

- `feat(module)` — for new features
- `fix(module)` — for bug fixes
- `typings(module)` — for type/interface/schema changes
- `chore(module)` — for non-functional cleanup or tooling
- `refactor(module)` — for internal code improvements
- `docs(module)` — for documentation updates
- `test(module)` — for testing additions or changes

---

### **Commit Description Guidelines**

- All messages **must be in present tense**
  - Good: Add filtering to reports
  - Bad: Added filtering to reports
- Avoid repetition in messages
- Use a **personal tone** when helpful (e.g., "You can now\...")
- Keep the tone informative but concise — no fluff or dramatic language
- Focus on **what changed** from the **user's perspective**
  - Prefer “You can now…” or “X no longer does Y when Z.”
- Describe known issues or limitations if any
- Use backticks (`) for filenames, code, or API references when needed
- Commit header format will be like: 'feat(module): implement a new feature under this module'
- Always use markdown format for commit message so i can do copy-paste

---

### **What to Avoid**

- No **terminal punctuation** (no `.` at the end of lines)
- Avoid using the file names or variables in the commit message header
- Avoid **fluff** or **dramatic language**
- Avoid restating the commit header in the description

---

### **Bullet Point Description Style (when needed)**

If a bullet-style description is used:

- Begin after the prefix + summary line
- Use bullet points like:

  ```plaintext
    - Add ability to filter results by category
    - Remove deprecated `xyzService` from module loader
    - Fix crash when submitting empty form
  ```
