---
theme: default
title: First Byte — Git and GitHub Mystery
info: Concept slides for the workshop. The dashboard shows where you are.
class: text-center
drawings: false
transition: slide-left
mdc: true
colorSchema: light
fonts:
  sans: Instrument Sans
  provider: none
---

# First Byte
## Git and GitHub Mystery

Case FB-01 · the missing final briefing

<div class="slide-pill mt-10">Start here</div>

<div class="slide-caption mt-10">
Slides teach one concept right before the action that needs it.<br>
Your progress, current mission, and checkpoint live on the dashboard at
<b>127.0.0.1:3031</b>.
</div>

<div class="grid grid-cols-2 gap-8 mt-12 text-left">

<div class="slide-card">
<h3>Case files</h3>
<p class="slide-caption">Live in <code>activity/case/</code>. These are yours to edit.</p>
</div>

<div class="slide-card">
<h3>App source</h3>
<p class="slide-caption">Lives in <code>slides/</code> and <code>dashboard/</code>. You never need to touch it.</p>
</div>

</div>

---
layout: center
class: text-center
---

# The case

A morning briefing was filed, then vanished from the archive.

<div class="slide-tinted mt-10 text-left max-w-2xl mx-auto">

Two fragments survived:

- one **committed to this repository**, then edited
- one that **travelled with a courier**

</div>

<div class="slide-caption mt-10">
Recover both. Propose one conclusion that carries both facts.
</div>

---
layout: default
---

<div class="text-xs opacity-50 font-mono">M0</div>

# Clone

**Clone** copies a whole repository to your laptop, history included.

```bash
git clone <starter-repository-url> first-byte-git-mystery
cd first-byte-git-mystery
bun install
bun run start
```

<div class="slide-tinted mt-8">
One command starts both pages and opens them in your browser.
<br>Dashboard <b>3031</b> · Slides <b>3030</b>
</div>

---
layout: two-cols
---

<div class="text-xs opacity-50 font-mono">M0</div>

# Your laptop is a real repository

::left::

- `.git/` holds the entire history
- `git status` describes the working tree
- the clone is yours to move, break, and rebuild

::right::

```bash
cd first-byte-git-mystery
git status
```

<div class="slide-caption mt-6">
The dashboard now reports this checkout as detected.
</div>

---
layout: default
---

<div class="text-xs opacity-50 font-mono">M1</div>

# Remotes

A **remote** is a named copy of your repository, stored somewhere else.

```bash
git remote rename origin starter
git remote add origin <your-new-empty-repository-url>
git remote -v
git push -u origin main
```

<div class="slide-tinted mt-8">
Your new GitHub repository must be empty.
No README, no license, no ignore file.
</div>

---
layout: two-cols
---

<div class="text-xs opacity-50 font-mono">M1</div>

# Two remotes, two jobs

::left::

| Name | Holds |
| --- | --- |
| `starter` | the workshop repository you cloned |
| `origin` | your own GitHub repository |

::right::

```bash
git remote -v
git push -u origin main
```

<div class="slide-caption mt-6">
<code>-u</code> links your local <code>main</code> to
<code>origin/main</code>, so later pushes need no arguments.
</div>

---
layout: two-cols
---

<div class="text-xs opacity-50 font-mono">M2</div>

# Status and history

::left::

```bash
git status
git log --oneline
git show <commit>
```

<div class="slide-caption mt-4">
- <code>status</code> — right now, what is changed
- <code>log</code> — what happened, newest first
- <code>show</code> — the whole commit, not only its subject
</div>

::right::

<div class="slide-tinted mt-2">
A line can be deleted from a file and still exist in an
**earlier version** of that file.

That is why history is evidence, not decoration.
</div>

---
layout: two-cols
---

<div class="text-xs opacity-50 font-mono">M3</div>

# The working tree

::left::

**Working tree** = the files in your folder right now.

```bash
git status
git diff
```

::right::

<div class="slide-tinted mt-2">

<code>git diff</code> compares your files with the last commit.

- <code>-</code> lines came out
- <code>+</code> lines went in

</div>

---
layout: two-cols
---

<div class="text-xs opacity-50 font-mono">M4</div>

# The staging area

::left::

**Staging** is your shortlist of what the next commit will contain.

```bash
git add activity/case/findings.md
git diff --staged
git commit -m "Record first finding"
git push
```

::right::

<div class="slide-tinted mt-2">

The staged diff is visible only between <code>git add</code> and
<code>git commit</code>.

Use <b>Check step</b> in the dashboard while it is on screen.
</div>

---
layout: two-cols
---

<div class="text-xs opacity-50 font-mono">M5</div>

# Branches

::left::

A **branch** is a movable label on a commit.

```bash
git switch -c lead-a
# edit, add, commit, push
git switch main
git switch -c lead-b
```

::right::

<div class="slide-tinted mt-2">
Create both branches from the same unchanged <code>main</code>.

Now two answers can be proposed without either overwriting the other.
</div>

---
layout: default
---

<div class="text-xs opacity-50 font-mono">M6</div>

# Pull requests

A **pull request** proposes merging one branch into another.

<div class="grid grid-cols-2 gap-8 mt-6">

<div class="slide-card">
<h3>Base branch</h3>
<p class="slide-caption"><code>main</code> — the branch that receives the change</p>
</div>

<div class="slide-card">
<h3>Compare branch</h3>
<p class="slide-caption"><code>lead-a</code>, then <code>lead-b</code></p>
</div>

</div>

<div class="slide-tinted mt-8">
Review the diff before you merge. Open both pull requests before you merge either.
</div>

<div class="slide-caption mt-6">
The dashboard cannot see GitHub, so it marks these steps self-confirmed.
</div>

---
layout: two-cols
---

<div class="text-xs opacity-50 font-mono">M7</div>

# Merge and conflict

::left::

```bash
git switch main
git pull
git switch lead-b
git merge main
```

::right::

<div class="mt-2 slide-caption">
Git stops when two commits changed the <b>same line</b> differently. It writes
the disagreement into the file:
</div>

<div class="slide-conflict mt-4"><<<<<<< HEAD
one version
=======
another version
>>>>>>> main</div>

---
layout: two-cols
---

<div class="text-xs opacity-50 font-mono">M7</div>

# Resolving is deciding

::left::

The markers are not the answer. They are two candidate answers, side by side.

1. Re-read both clues
2. Write the one line that keeps **both** supported facts
3. Delete every marker line

::right::

```bash
git status
git add activity/case/summary.md
git commit -m "Resolve the conflict"
git push
```

<div class="slide-caption mt-6">
<code>git status</code> is your proof that no unmerged path remains.
</div>

---
layout: default
---

<div class="text-xs opacity-50 font-mono">M8</div>

# Merge and retrieve

```bash
git switch main
git pull
git log --oneline --graph
```

<div class="slide-tinted mt-8">
Your case summary now carries both supported findings, and both pull requests are merged.
</div>

---
layout: center
class: text-center
---

# The whole workflow, once

```bash
clone → remote → inspect → edit → diff → add → commit → push
→ branch → push → pull request → merge → pull → conflict → resolve → push
```

<div class="slide-tinted mt-10 inline-block text-left">
<b>Say it back:</b> which command puts your change on GitHub, and in what order?
</div>

---
layout: center
class: text-center
---

# Case closed

Your history, your branches, your two pull requests, your resolution.

<div class="slide-pill mt-10">Dashboard · 127.0.0.1:3031</div>

<div class="slide-caption mt-10">
These slides, the dashboard, and the learner guide never contain the answers.
</div>