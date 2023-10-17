import * as core from '@actions/core'
import { wait } from './wait'
import { Snapshot } from './types/snapshot'

/**
 * The main function for the action.
 * @returns {Promise<void>} Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const accessToken = core.getInput('accessToken', {
      required: true,
      trimWhitespace: true
    })
    const accountId = core.getInput('accountId', {
      required: true,
      trimWhitespace: true
    })
    const instanceId = core.getInput('instanceId', {
      required: true,
      trimWhitespace: true
    })
    const snapshotLimit = Number(core.getInput('snapshotLimit')) || 2
    const snapshotName =
      core.getInput('snapshotName', { trimWhitespace: true }) ||
      `${instanceId}-${Date.now()}`
    const waitUntilSnapshotCreated =
      core.getBooleanInput('waitUntilCreated') || true

    if (!accessToken) {
      core.setFailed('accessToken is required')
      return
    }

    if (!accountId) {
      core.setFailed('accountId is required')
      return
    }

    if (!instanceId) {
      core.setFailed('instanceId is required')
      return
    }

    const headers = {
      Account: accountId,
      AccessToken: accessToken,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }

    // Get snapshot list, if snapshot count is 2, delete the oldest snapshot
    core.info(`Check snapshot count exceeds the limit ${snapshotLimit}`)

    const getSnapshotListRes = await fetch(
      `https://api.layerpanel.com/api/cloudserver/account/templates/${accountId}`,
      {
        headers
      }
    )
    if (!getSnapshotListRes.ok) {
      const resJson = await getSnapshotListRes.json()
      core.setFailed(
        `Failed to get snapshot list, res: ${JSON.stringify(resJson)}`
      )
      return
    }
    const snapshotList = (await getSnapshotListRes.json()) as Snapshot[]

    if (snapshotList.length >= snapshotLimit) {
      const oldestSnapshot = snapshotList[0]
      core.info(
        `Snapshot count reached the max limit ${snapshotLimit}, deleting the oldest snapshot (${oldestSnapshot.id})`
      )
      const deleteSnapshotRes = await fetch(
        `https://api.layerpanel.com/api/cloudserver/account_templates/${oldestSnapshot.id}`,
        {
          method: 'DELETE',
          headers
        }
      )
      if (!deleteSnapshotRes.ok) {
        const resJson = await deleteSnapshotRes.json()
        core.setFailed(
          `Failed to delete the oldest snapshot, res: ${JSON.stringify(
            resJson
          )}`
        )
        return
      }
    }

    await wait(1000)
    await core.group(`Create snapshot ${snapshotName}`, async () => {
      // Create snapshot
      const createSnapshotRes = await fetch(
        `https://api.layerpanel.com/api/cloudserver/${instanceId}/create_account_vm_template`,
        {
          method: 'POST',
          body: JSON.stringify({
            tamplate_name: snapshotName
          }),
          headers
        }
      )

      if (!createSnapshotRes.ok) {
        const resJson = await createSnapshotRes.json()
        core.setFailed(
          `Failed to create snapshot, res: ${JSON.stringify(resJson)}`
        )
        return
      }

      do {
        const getSnapshotListRes = await fetch(
          `https://api.layerpanel.com/api/cloudserver/account/templates/${accountId}`,
          {
            headers
          }
        )
        const snapshotList = (await getSnapshotListRes.json()) as Snapshot[]

        const snapshot = snapshotList.find(snapshot =>
          snapshot.name === snapshotName && waitUntilSnapshotCreated
            ? snapshot.status === 'working'
            : true
        )

        if (snapshot) {
          core.info('Snapshot created successfully')
          break
        }
        core.info('Waiting for snapshot to be created, retrying in 5 seconds')
        await wait(5000)
      } while (true)
    })

    // Set outputs for other workflow steps to use
    core.setOutput('snapshotName', snapshotName)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
