---
theme: default
title: First Byte — Git and GitHub Mystery
info: Concept slides for the workshop. The dashboard shows where you are.
favicon: /git.svg
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

<div class="slide-pill mt-8">Start here</div>

<div class="slide-caption mt-8">
Slides teach one concept right before the action that needs it.<br>
Your progress, current mission, and checkpoint live on the dashboard at
<b>127.0.0.1:3031</b>.
</div>

<div class="slide-note mt-6 text-left">
<span class="slide-note-title">How to use these slides</span>
Clone <code>github.com/universitysjp/git-mystery</code> to begin. Stop reading once you start an action. The dashboard names the next Git state to produce;
these slides explain why that state matters. Case files are in <code>activity/case/</code> —
yours to edit. <code>slides/</code> and <code>dashboard/</code> are the app; you never need
to touch them.
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

<!--
Facilitator note: the two fragments are deliberately different in kind. One is a Git
problem (a deleted line still exists in an older commit); the other is not a Git problem
at all (a courier manifest in the case folder). Only one of them needs history.
-->

---
layout: default
---

<div class="text-xs opacity-50 font-mono">M0</div>

# Clone

**Clone** copies a whole repository to your laptop, history included.

```bash
git clone https://github.com/universitysjp/git-mystery.git
cd git-mystery
bun install
bun run start
```

<div class="slide-tinted mt-8">
One command starts both pages and opens them in your browser.
<br>Dashboard <b>3031</b> · Slides <b>3030</b>
</div>

<div class="slide-note mt-8 text-left">
<span class="slide-note-title">Reading the commands</span>
<b>git clone</b> copies everything: files, full history, and the list of remote
branches. <b>bun install</b> downloads the checked-in dependencies into
<code>node_modules/</code> — run it once, not before every session.
<b>bun run start</b> starts the slides and the dashboard together and stops both when
you stop it.
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
cd git-mystery
git status
```

<div class="slide-caption mt-6">
The dashboard now reports this checkout as detected.
</div>


<div class="slide-note mt-6">
<span class="slide-note-title">Reading git status</span>
Status is the fastest way to answer one question: <i>is what I see on screen the same as
what Git recorded?</i> Three words cover most of it — <b>clean</b>, <b>modified</b>,
<b>staged</b>. Learn to read this line before you read anything else.
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

<div class="slide-note mt-8 text-left">
<span class="slide-note-title">Reading the commands</span>
<b>git remote</b> only stores names and URLs in a local file; renaming costs nothing and
loses nothing. <b>-v</b> adds <i>verbose</i>, which prints the URL for each name — use it
whenever you are unsure where you are pushing. <b>git push -u origin main</b> both uploads
the branch and records that it now tracks <code>origin/main</code>, so later pushes are
just <code>git push</code>.
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


<div class="slide-note mt-6">
<span class="slide-note-title">Why two names</span>
Remote names are yours to choose. Keeping the workshop copy as <code>starter</code> means
you can still fetch new workshop material later without disturbing your own work.
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


<div class="slide-note mt-4">
<span class="slide-note-title">Reading the commands</span>
<b>--oneline</b> shortens <code>git log</code> to one line per commit — start there, then
<b>git show</b> a single commit by its short hash. A commit contains a message, an author,
a timestamp, and a snapshot of the files it touched: the state <i>after</i> the change, so
<code>&lt;commit&gt;^</code> gives you the state before it.
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


<div class="slide-note mt-4">
<span class="slide-note-title">Reading git diff</span>
A diff is a conversation between two versions: <code>-</code> is what the old version had,
<code>+</code> is what it has now, and unchanged context sits between them. Reading a diff
is how you check your own work before anyone else sees it.
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


<div class="slide-note mt-4">
<span class="slide-note-title">Reading the commands</span>
<b>git add &lt;file&gt;</b> stages one path — name the file, and you cannot stage the
wrong thing by accident. <b>git diff --staged</b> shows exactly what the commit will
contain. <b>-m</b> gives the commit its message inline; a useful message says what changed
and why.
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
# edit, diff, add, commit
git push -u origin lead-a
git switch main
git switch -c lead-b
# edit, diff, add, commit
git push -u origin lead-b
```

::right::

<div class="slide-tinted mt-2">
Create both branches from the same unchanged <code>main</code>.

Now two answers can be proposed without either overwriting the other.
</div>


<div class="slide-note mt-4">
<span class="slide-note-title">Reading the commands</span>
<b>git switch</b> moves you between branches; <b>-c</b> creates the branch and switches in
one step. A branch is only a label, so creating one changes no files. The same
edit–diff–add–commit–push loop you just learned now runs on a branch instead of on
<code>main</code>.
</div>

---
layout: default
---

<div class="text-xs opacity-50 font-mono">M6</div>

# Pull requests

A **pull request** proposes merging one branch into another. Here the
**base** is <code>main</code> and the **compare** branch is <code>lead-a</code>, then
<code>lead-b</code>.

<div class="slide-tinted mt-6">
Review the diff before you merge. Open both pull requests before you merge either.
</div>

<div class="slide-note mt-6 text-left">
<span class="slide-note-title">What to look at</span>
The diff on a pull request is the same kind of diff you just read locally. Read it as a
reviewer: does this change exactly one thing, and does it belong in <code>main</code>?
Merging on GitHub is <b>not</b> merging on your laptop — the two stay separate until you
bring the result down yourself. The dashboard marks these steps self-confirmed.
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

<pre class="slide-conflict mt-4"><<<<<<< HEAD
one version
=======
another version
>>>>>>> main</pre>


<div class="slide-note mt-4">
<span class="slide-note-title">Reading the markers</span>
<b>HEAD</b> is the version you currently have checked out; the other side is the branch
you merged in. <b>git pull</b> is <i>fetch</i> plus <i>merge</i>: download the new commits
from <code>origin/main</code> and merge them into your local <code>main</code>.
</div>

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
git status
git commit -m "Resolve the conflict"
git push
```

<div class="slide-caption mt-6">
<code>git status</code> is your proof that no unmerged path remains.
</div>


<div class="slide-note mt-4">
<span class="slide-note-title">Reading the commands</span>
Git keeps a conflicted file in the working tree and in the staging area at once, which is
why status says <i>unmerged</i> until you <b>git add</b> your resolution. That <code>add</code>
is not saving a new finding; it is telling Git the conflict is now answered.
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

<div class="slide-note mt-8 text-left">
<span class="slide-note-title">Reading the graph</span>
<code>--graph</code> draws the branch shape, so merges appear as edges rather than as
separate lines. One branch, two pull requests, one conflict, one resolution — the history
now shows the whole investigation.
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

<div class="slide-note mt-10 text-left max-w-3xl mx-auto">
<span class="slide-note-title">The four verbs worth memorising</span>
<b>diff</b> to see, <b>add</b> to choose, <b>commit</b> to record, <b>push</b> to share.
Every other command arranges when those four happen.
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
