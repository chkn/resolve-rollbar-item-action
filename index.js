const core = require('@actions/core');
const http = require('@actions/http-client');

const body = core.getInput('body', { required: true });
const regex = /^View details in Rollbar: \[https:\/\/rollbar.com\/[^/]+\/[^/]+\/items\/([^/]+)/m;

const main = async () => {
	const token = process.env.ROLLBAR_TOKEN;
	if (!token) {
		throw new Error('ROLLBAR_TOKEN environment variable is not set');
	}

	const match = regex.exec(body);
	if (match) {
		const itemCounter = match[1];
		core.debug(`Found Rollbar item counter: ${itemCounter}`);

		const rollbar = new http.HttpClient(undefined, undefined, {
			allowRedirects: false,
			headers: {
				"X-Rollbar-Access-Token": token
			}
		});

		const response1 = await rollbar.getJson(
			`https://api.rollbar.com/api/1/item_by_counter/${itemCounter}`,
			{ [http.Headers.Accept]: "application/json" }
		);
		const itemId = response1.result?.itemId;
		if (!itemId) {
			throw new Error(`Could not find item ID for counter ${itemCounter}`);
		}
		core.debug(`Got item ID: ${itemId}`);

		const response2 = await rollbar.patch(
			`https://api.rollbar.com/api/1/item/${itemId}`,
			'{"status": "resolved"}',
			{ [http.Headers.ContentType]: "application/json" }
		);
		if (response2.statusCode !== 200) {
			throw new Error(`Could not resolve item ${itemId}: ${response2.message}`);
		} else {
			core.info(`Resolved item ${itemId}`);
		}
	} else {
		core.info('No Rollbar item link found');
	}
};

main().catch(error => {
	core.setFailed(error.message);
});