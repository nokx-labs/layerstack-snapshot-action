## Layerstack Snapshot Action

GitHub Actions for creating a snapshot of a LayerStack instance

## Usage
```yaml
steps:
  - name: Create snapshot
    uses: nokx-labs/layerstack-snapshot-action@v1
    with:
      accessToken: ${{ secret.accessToken }}
      accountId: ${{ secret.accountId }}
      instanceId: abcasas
```

## Inputs

<!-- AUTO-DOC-INPUT:START - Do not remove or modify this section -->

| INPUT         | TYPE   | REQUIRED | DEFAULT                     | DESCRIPTION                         |
| ------------- | ------ | -------- | --------------------------- | ----------------------------------- |
| accessToken   | string | true     |                             | LayerStack API access token URL     |
| accountId     | string | true     |                             | LayerStack account ID - XX-12345678 |
| instanceId    | string | true     |                             | LayerStack instance ID              |
| snapshotLimit | string | false    | 2                           | Maximum number of snapshots to keep |
| snapshotName  | string | false    | \${instanceId}-\${YYYYMMDD} | Name of the snapshot                |

<!-- AUTO-DOC-INPUT:END -->
## Report Bugs

Report bugs at https://github.com/nokx-labs/layerstack-snapshot-action/issues.

If you are reporting a bug, please include:

- Your operating system name and version.
- Any details about your workflow that might be helpful in troubleshooting.
- Detailed steps to reproduce the bug.

## License
[MIT license](LICENSE)