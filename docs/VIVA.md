# Viva notes: Git

Short answers to the 13 Git questions in section 13 of the manual, with commands. The examples use this repository.

**1. What is a Git repository?**
A project folder whose full history Git tracks. The history lives in the hidden `.git` directory: every commit, branch and tag. `git init` creates one and `git clone <url>` copies one, history included.

**2. How does Git work?**
Git stores snapshots, not diffs. Files move through three areas: the **working tree** (your files), the **staging area / index** (what the next commit will contain) and the **repository** (committed snapshots). Each commit points to its parent, so history is a chain (a graph, once branches merge). Every clone is a full copy, which is why Git is called *distributed*.

**3. What is `git add`?**
It moves changes from the working tree into the staging area. `git add server/game/engine.js` stages one file. `git add -p` lets you pick individual hunks. Nothing is saved to history until you commit.

**4. What is `git status`?**
It shows the current branch, staged changes, unstaged changes and untracked files, and how far you are ahead of or behind the remote. Run it before every commit.

**5. What is a commit?**
A saved snapshot of the staged files with an author, a timestamp, a message and a pointer to its parent commit. It is identified by a SHA hash. Example: `git commit -m "feat(game): add spill validation"`. Good commits are small and do one thing.

**6. What is branching?**
A branch is a movable pointer to a commit, so you can work on something without touching `main`. We used one branch per feature (`feature/game-engine`, `feature/lobby-ui`, ...), each merged through a pull request.
```bash
git switch -c feature/game-engine   # create and switch
git switch main                     # go back
```

**7. What is a conflict?**
When two branches change the same lines (or one edits a file the other deleted), Git can't merge them automatically. It marks the file:
```
<<<<<<< HEAD
const HAND_SIZE = 7;
=======
const HAND_SIZE = 8;
>>>>>>> feature/bigger-hands
```
You edit the file to the correct result, remove the markers, then `git add` and commit (or `git merge --continue`).

**8. What is merge?**
It combines another branch's history into the current one. If `main` hasn't moved, Git just fast-forwards. Otherwise it creates a **merge commit** with two parents. `git merge feature/game-engine`, or merge a pull request on GitHub.

**9. What is a remote?**
A named URL of another copy of the repository, usually on GitHub. `origin` is the default name after cloning. `git remote -v` lists remotes. `git fetch` downloads their commits, `git pull` = fetch + merge, `git push` uploads yours.

**10. How do you revert a commit that has already been pushed and made public?**
Use `git revert <sha>`. It creates a **new** commit that undoes the old one, so nobody else's history is rewritten. Then `git push`. Don't use `git reset` + force-push on a shared branch: that rewrites history other people already pulled. To revert a merge commit: `git revert -m 1 <merge-sha>`.

**11. What is `git stash`?**
It shelves uncommitted changes so you get a clean working tree, for example to switch branches and fix something urgent. `git stash` (or `git stash push -m "wip lobby filters"`), then `git stash list`, then `git stash pop` to bring the changes back.

**12. What is `git reflog`?**
A local log of every place `HEAD` has pointed: commits, checkouts, resets, rebases. It's the safety net for "I lost my commit". Find the entry in `git reflog`, then `git switch -c rescue <sha>` or `git reset --hard <sha>`. Entries expire after about 90 days and are never pushed.

**13. How do you make an existing branch track a remote branch?**
```bash
git branch --set-upstream-to=origin/feature/lobby-ui feature/lobby-ui
# or, while on the branch:
git branch -u origin/feature/lobby-ui
# or set it during the first push:
git push -u origin feature/lobby-ui
```
After that, a plain `git pull` / `git push` on that branch talks to `origin/feature/lobby-ui`, and `git status` shows ahead/behind counts.
