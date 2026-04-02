# QA Release Candidate Gate

This repo treats QA handoff as a release-candidate event, not a statement about whatever happens to be in a local workspace.

## Required artifact

Before assigning QA, engineering must commit a release-candidate manifest under `qa-evidence/release-candidates/`.

The manifest must include:

- `branch`: the exact candidate branch name
- `commit`: the exact 40-character commit SHA QA should test
- `issues`: the included issue links for the candidate scope
- `validation`: the commands engineering ran against that exact commit

Use the template at `qa-evidence/release-candidates/template.json`.

## Gate command

Run the gate from the candidate branch:

```bash
npm run qa:release-candidate -- --manifest qa-evidence/release-candidates/<candidate-name>.json
```

The command fails unless all of the following are true:

1. The workspace is clean.
2. The current branch matches the manifest `branch`.
3. The manifest `commit` exists on the current branch.
4. Any commits after the manifest `commit` modify only the manifest file itself.
5. The current branch is fully pushed to its upstream.
6. The manifest includes at least one issue link and one validation command.

## Engineering handoff rule

Only assign QA after the gate passes. The normal flow is:

1. Commit and push the candidate changes.
2. Record that candidate SHA in the manifest.
3. Commit the manifest as the only follow-up delta on the branch.
4. Run the gate and hand QA the manifest path plus the candidate SHA.

Engineering comments should hand QA one exact commit and one exact manifest path, for example:

```md
## Ready for QA

- Candidate manifest: `qa-evidence/release-candidates/spoa-121-r2.json`
- Branch: `spoa-121-r2-candidate`
- Commit: `f44e29c5786b121c1145ef0d9e63fb347d0bd7d7`
- Validation:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run test`
```

If the branch is dirty or unpushed, it is not a QA candidate yet.
