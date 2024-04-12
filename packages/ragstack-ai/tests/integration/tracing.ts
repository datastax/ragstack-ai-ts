import {appendTestCaseProperty} from "./config";

export async function recordLangsmithPublicUrl(runId: string) {
    const langsmith = await import("langsmith")
    const client = new langsmith.Client()
    let retries = 5
    let publicUrl: string
    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            publicUrl = await client.shareRun(runId)
            break
        } catch (e) {
            if (retries === 0) {
                // give up, we don't want to make the test fail because of this
                console.error("Failed to share run", e)
                return
            }
            retries -= 1
        }
    }

    appendTestCaseProperty("langsmith_url", publicUrl)
}
