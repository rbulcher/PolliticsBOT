console.log("The bot is starting");
const axios = require("axios");
const needle = require("needle");
require("dotenv").config();
const oauth = require("./header");
const token = process.env.BEARER_TOKEN;
const rulesURL = "https://api.twitter.com/2/tweets/search/stream/rules";
const streamURL =
	"https://api.twitter.com/2/tweets/search/stream?tweet.fields=created_at,author_id,id,conversation_id,referenced_tweets";

// Edit rules as desired below
const rules = [
	{
		value: "@PolliticsBOT",
		tag: "mentioning @PolliticsBOT",
	},
];

async function setRules() {
	const data = {
		add: rules,
	};

	const response = await needle("post", rulesURL, data, {
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${token}`,
		},
	});

	if (response.statusCode !== 201) {
		throw new Error(response.body);
	}

	return response.body;
}

async function getAllRules() {
	const response = await needle("get", rulesURL, {
		headers: {
			authorization: `Bearer ${token}`,
		},
	});

	if (response.statusCode !== 200) {
		console.log("Error:", response.statusMessage, response.statusCode);
		throw new Error(response.body);
	}

	return response.body;
}

async function sendTweetNoPoll(tweetAuthor, tweetId, response) {
	if (tweetAuthor != "1565884322732818433") {
		var data = JSON.stringify({
			text: response,
			reply: {
				in_reply_to_tweet_id: tweetId,
				exclude_reply_user_ids: ["1565884322732818433"],
			},
		});

		var config = {
			method: "post",
			url: "https://api.twitter.com/2/tweets",
			headers: {
				Authorization: oauth.getHeader(),
				"Content-Type": "application/json",
			},
			data: data,
		};
		axios(config)
			.then(function (response) {
				console.log(JSON.stringify(response.data));
			})
			.catch(function (error) {
				console.log(error);
			});
	}
}
async function getUsername(userId) {
	const response = await needle(
		"get",
		`https://api.twitter.com/2/users/${userId}`,
		{
			headers: {
				authorization: `Bearer ${token}`,
			},
		}
	);

	if (response.statusCode !== 200) {
		console.log("Error:", response.statusMessage, response.statusCode);
		throw new Error(response.body);
	}

	return response.body;
}

async function sendTweetWithPoll(tweetAuthor, tweetId, question, options) {
	if (tweetAuthor != "1565884322732818433") {
		let userData = await getUsername(tweetAuthor);
		let userName = userData.data.username;
		question = question.replace(/\@[^\s]*/g, "");
		question += "\nQuestion by @" + userName;
		var data = JSON.stringify({
			text: question,
			poll: {
				options: options,
				duration_minutes: 10080,
			},
			reply: {
				in_reply_to_tweet_id: tweetId,
				exclude_reply_user_ids: ["1565884322732818433"],
			},
		});
		var config = {
			method: "post",
			url: "https://api.twitter.com/2/tweets",
			headers: {
				Authorization: oauth.getHeader(),
				"Content-Type": "application/json",
			},
			data: data,
		};
		axios(config)
			.then(function (response) {
				console.log(JSON.stringify(response.data));
			})
			.catch(function (error) {
				console.log(error);
			});
	}
}

async function parseData(data) {
	if (data) {
		const json = JSON.parse(data);

		return json;
	}
}

function streamConnect(retryAttempt) {
	const stream = needle.get(streamURL, {
		headers: {
			"User-Agent": "v2FilterStreamJS",
			Authorization: `Bearer ${token}`,
		},
		timeout: 20000,
	});

	stream
		.on("data", async (data) => {
			try {
				await parseData(data).then(async (tweet) => {
					if (
						!(
							tweet.data.referenced_tweets[0].type === "retweeted" ||
							tweet.data.referenced_tweets[0].type === "quoted"
						)
					) {
						let tweetId = tweet.data.id;
						let tweetAuthor = tweet.data.author_id;
						let tweetText = tweet.data.text;
						let tweetConversationId = tweet.data.conversation_id;
						let tweetResponse = "";
						if (!tweetText.includes("?")) {
							tweetResponse =
								"I'm sorry, I can't create that poll. Please ask a question with a question mark at the end.";
							sendTweetNoPoll(tweetAuthor, tweetId, tweetResponse);
						} else {
							let question = tweetText.split("?")[0];
							let options = tweetText.split("?")[1].split(",");
							question = question.replace("@PolliticsBOT  ", "");
							question = question + "?";

							let questionLenPass = question.length <= 200 ? true : false;
							console.log(questionLenPass);

							options = options.map((option) => option.trim());
							let optionLenCheckPass = true;
							options.forEach((option) => {
								if (option.length > 25) {
									tweetResponse =
										"I'm sorry, I can't create that poll. Please make sure all options are less than 25 characters.";
									optionLenCheckPass = false;
								}
							});

							if (!questionLenPass) {
								tweetResponse =
									"I'm sorry, I can't create that poll. Please make sure the question is less than 200 characters.";
								sendTweetNoPoll(tweetAuthor, tweetId, tweetResponse);
							} else {
								if (optionLenCheckPass) {
									if (options.length > 1) {
										if (options.length > 4) {
											tweetResponse =
												"I'm sorry, I can't create that poll. Please only include up to 4 options.";
											sendTweetNoPoll(tweetAuthor, tweetId, tweetResponse);
										} else {
											options = options.filter(function (el) {
												return el != "";
											});
											sendTweetWithPoll(
												tweetAuthor,
												tweetConversationId,
												question,
												options
											);
										}
									} else {
										options = ["Yes", "No"];
										sendTweetWithPoll(
											tweetAuthor,
											tweetConversationId,
											question,
											options
										);
									}
								} else {
									sendTweetNoPoll(tweetAuthor, tweetId, tweetResponse);
								}
							}
						}
					}
				});

				retryAttempt = 0;
			} catch (e) {
				if (
					data.detail ===
					"This stream is currently at the maximum allowed connection limit."
				) {
					console.log(data.detail);
					process.exit(1);
				} else {
					// Keep alive signal received. Do nothing.
				}
			}
		})
		.on("err", (error) => {
			if (error.code !== "ECONNRESET") {
				console.log(error.code);
				process.exit(1);
			} else {
				// This reconnection logic will attempt to reconnect when a disconnection is detected.
				// To avoid rate limits, this logic implements exponential backoff, so the wait time
				// will increase if the client cannot reconnect to the stream.
				setTimeout(() => {
					console.warn("A connection error occurred. Reconnecting...");
					streamConnect(++retryAttempt);
				}, 2 ** retryAttempt);
			}
		});

	return stream;
}
async function deleteAllRules(rules) {
	if (!Array.isArray(rules.data)) {
		return null;
	}

	const ids = rules.data.map((rule) => rule.id);

	const data = {
		delete: {
			ids: ids,
		},
	};

	const response = await needle("post", rulesURL, data, {
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${token}`,
		},
	});

	if (response.statusCode !== 200) {
		throw new Error(response.body);
	}

	return response.body;
}

(async () => {
	let currentRules;

	try {
		// Gets the complete list of rules currently applied to the stream
		currentRules = await getAllRules();

		// Delete all rules. Comment the line below if you want to keep your existing rules.
		await deleteAllRules(currentRules);

		// Add rules to the stream. Comment the line below if you don't want to add new rules.
		await setRules();
	} catch (e) {
		console.error(e);
		process.exit(1);
	}

	// Listen to the stream.
	streamConnect(0);
})();
