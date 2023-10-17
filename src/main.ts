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
    const maxSnapshotNums = Number(core.getInput('maxSnapshotNums')) || 2
    const snapshotName =
      core.getInput('snapshotName', { trimWhitespace: true }) ||
      `${instanceId}-${Date.now()}`
    const waitUntilSnapshotCreated = core.getBooleanInput('waitUntilCreated', {
      required: true
    })
    const deleteOldestIfExceedsMax = core.getBooleanInput(
      'deleteOldestIfExceedsMax',
      { required: true }
    )

    const headers = {
      Account: accountId,
      AccessToken: accessToken,
      Accept: 'application/json',
      'Content-Type': 'application/json'
    }

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

    const hasSnapshotRunning = snapshotList.some(
      snapshot => snapshot.status === 'creating'
    )

    if (hasSnapshotRunning) {
      core.setFailed(
        `There is a snapshot running, please wait until it's completed`
      )
      return
    }

    // Get snapshot list, if snapshot count is 2, delete the oldest snapshot
    core.info(`Check snapshot count exceeds the limit ${maxSnapshotNums}`)
    if (snapshotList.length >= maxSnapshotNums) {
      if (!deleteOldestIfExceedsMax) {
        core.setFailed(
          `Snapshot count exceeds the limit ${maxSnapshotNums}, please delete one manually and try again`
        )
        return
      }
      const oldestSnapshot = snapshotList[0]
      core.info(
        `Snapshot count exceeds the limit ${maxSnapshotNums}, delete the oldest snapshot (${oldestSnapshot.id} - ${oldestSnapshot.name})`
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
          core.info(
            `Snapshot created successfully, res: ${JSON.stringify(snapshot)}`
          )
          // Set outputs for other workflow steps to use
          core.setOutput('snapshotName', snapshot.name)
          core.setOutput('snapshotSize', snapshot.size)
          break
        }
        core.info('Waiting for snapshot to be created, retrying in 5 seconds')
        await wait(5000)
      } while (true)
    })
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
