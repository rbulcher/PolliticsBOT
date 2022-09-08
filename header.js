const crypto = require("crypto");

const base_url = "https://api.twitter.com/2/tweets";
const method = "POST";

function getHeader() {
	const secret_key = process.env.CONSUMER_SECRET;

	const oauth_timestamp = Math.floor(Date.now() / 1000);
	let oauth_nonce = crypto.randomBytes(32).toString("base64");
	oauth_nonce = oauth_nonce.replace(/[^a-zA-Z]/g, "");

	const parameters = {
		oauth_consumer_key: process.env.CONSUMER_KEY,
		oauth_nonce: oauth_nonce,
		oauth_signature_method: "HMAC-SHA1",
		oauth_timestamp: oauth_timestamp,
		oauth_token: process.env.ACCESS_TOKEN,
		oauth_version: "1.0",
	};

	let ordered = {};
	Object.keys(parameters)
		.sort()
		.forEach(function (key) {
			ordered[key] = parameters[key];
		});
	let encodedParameters = "";
	for (k in ordered) {
		let encodedValue = encodeURIComponent(ordered[k]);
		let encodedKey = encodeURIComponent(k);
		if (encodedParameters === "") {
			encodedParameters += `${encodedKey}=${encodedValue}`;
		} else {
			encodedParameters += `&${encodedKey}=${encodedValue}`;
		}
	}
	if (encodedParameters.includes("!" || "*" || "'" || "(" || ")" || ";")) {
		encodedParameters = encodedParameters.replace(/!/g, "%21");
		encodedParameters = encodedParameters.replace(/\*/g, "%2A");
		encodedParameters = encodedParameters.replace(/'/g, "%27");
		encodedParameters = encodedParameters.replace(/\(/g, "%28");
		encodedParameters = encodedParameters.replace(/\)/g, "%29");
		encodedParameters = encodedParameters.replace(/;/g, "%3B");
	}

	const encodedUrl = encodeURIComponent(base_url);
	encodedParameters = encodeURIComponent(encodedParameters);

	const signature_base_string = `${method}&${encodedUrl}&${encodedParameters}`;

	const signing_key = `${secret_key}&${process.env.ACCESS_TOKEN_SECRET}`;

	const oauth_signature = crypto
		.createHmac("sha1", signing_key)
		.update(signature_base_string)
		.digest("base64");

	const encoded_oauth_signature = encodeURIComponent(oauth_signature);

	const authorization_header = `OAuth oauth_consumer_key="${process.env.CONSUMER_KEY}",oauth_token="${process.env.ACCESS_TOKEN}",oauth_signature_method="HMAC-SHA1",oauth_timestamp="${oauth_timestamp}",oauth_nonce="${oauth_nonce}",oauth_version="1.0",oauth_signature="${encoded_oauth_signature}"`;

	return authorization_header;
}

module.exports = { getHeader };
