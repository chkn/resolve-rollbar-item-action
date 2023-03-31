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

		// sadly this comes through as an error because we set allowRedirects: false
		let response1;
		try {
			response1 = await rollbar.getJson(
				`https://api.rollbar.com/api/1/item_by_counter/${itemCounter}`,
				{ [http.Headers.Accept]: "application/json" }
			);
		} catch (err) {
			response1 = err;
		}
		const itemId = response1.result?.result?.itemId;
		if (!itemId) {
			throw new Error(`Could not find item ID for counter ${itemCounter}`);
		}
		core.debug(`Got item ID: ${itemId}`);

		await rollbar.patchJson(
			`https://api.rollbar.com/api/1/item/${itemId}`,
			'{"status": "resolved"}',
			{ [http.Headers.ContentType]: "application/json" }
		);
		// the above should throw if not successful
		core.info(`Resolved item ${itemId}`);
	} else {
		core.info('No Rollbar item link found');
	}
};

main().catch(error => {
	core.setFailed(error.message);
});