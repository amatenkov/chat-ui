import { defaultModel } from "$lib/server/models";
import { modelEndpoint } from "./modelEndpoint";
import { trimSuffix } from "$lib/utils/trimSuffix";
import { trimPrefix } from "$lib/utils/trimPrefix";
import { PUBLIC_SEP_TOKEN } from "$lib/constants/publicSepToken";
import { AwsClient } from "aws4fetch";

interface Parameters {
	temperature: number;
	truncate: number;
	max_new_tokens: number;
	stop: string[];
}
export async function generateFromDefaultEndpoint(
	prompt: string,
	parameters?: Partial<Parameters>,
	preprompt: string = ""
): Promise<string> {
	const newParameters = {
		...defaultModel.parameters,
		...parameters,
		return_full_text: false,
	};

	const randomEndpoint = modelEndpoint(defaultModel);

	const abortController = new AbortController();

	let resp: Response;

	if (randomEndpoint.host === "sagemaker") {
		const requestParams = JSON.stringify({
			parameters: newParameters,
			inputs: prompt,
		});

		const aws = new AwsClient({
			accessKeyId: randomEndpoint.accessKey,
			secretAccessKey: randomEndpoint.secretKey,
			sessionToken: randomEndpoint.sessionToken,
			service: "sagemaker",
		});

		resp = await aws.fetch(randomEndpoint.url, {
			method: "POST",
			body: requestParams,
			signal: abortController.signal,
			headers: {
				"Content-Type": "application/json",
			},
		});
	} else {
		console.log('generateFromDefaultEndpoint params', JSON.stringify({
			parameters: newParameters,
			preprompt: preprompt,
			messages: [{ from: 'user', content: prompt }],
		}))

		await fetch(randomEndpoint.url + '/reset', {
			headers: {
				"Content-Type": "application/json"
			},
			method: "GET"
		});

		resp = await fetch(randomEndpoint.url, {
			headers: {
				"Content-Type": "application/json"
			},
			method: "POST",
			body: JSON.stringify({
				parameters: newParameters,
				preprompt: preprompt,
				messages: [{ from: 'user', content: prompt }],
			})
		});
	}

	if (!resp.ok) {
		throw new Error(await resp.text());
	}

	if (!resp.body) {
		throw new Error("Body is empty");
	}

	const decoder = new TextDecoder();
	const reader = resp.body.getReader();

	let isDone = false;
	let result = "";

	while (!isDone) {
		const { done, value } = await reader.read();

		isDone = done;
		result += decoder.decode(value, { stream: true }); // Convert current chunk to text
	}

	// Close the reader when done
	reader.releaseLock();

	console.log('Model raw result:', result)
	return result;

	// let results;
	// if (result.startsWith("data:")) {
	// 	results = [JSON.parse(result.split("data:")?.pop() ?? "")];
	// } else {
	// 	results = JSON.parse(result);
	// }

	// let generated_text = trimSuffix(
	// 	trimPrefix(trimPrefix(results[0].generated_text, "<|startoftext|>"), prompt),
	// 	PUBLIC_SEP_TOKEN
	// ).trimEnd();

	// for (const stop of [...(newParameters?.stop ?? []), "<|endoftext|>"]) {
	// 	if (generated_text.endsWith(stop)) {
	// 		generated_text = generated_text.slice(0, -stop.length).trimEnd();
	// 	}
	// }

	// return generated_text;
}

export async function generateSearchQuery(prompt: string,
	parameters?: Partial<Parameters>,
	maxRetries: number = 3
): Promise<string> {
	
	const newParameters = {
		...defaultModel.parameters,
		...parameters,
		return_full_text: false,
	};

	const randomEndpoint = modelEndpoint(defaultModel);
	// const apiUrl = randomEndpoint.url+'/search_request'; // Replace with your Flask API URL
	// const requestOptions = {
	// 	method: 'POST',
	// 	headers: {
	// 		'Content-Type': 'application/json',
	// 	},
	// 	body: JSON.stringify({
	// 		query: "Сгенерируй запрос в поисковую систему для ответа на вопрос \""+prompt+"\". Используй русский язык. Выбери один наиболее релевантный запрос. Ответь только текстом запроса без лишних символов и слов.",
	// 		preprompt: "" //Ты — русскоязычный автоматический ассистент для написании запросов для поисковых систем на русском языке. Отвечай на сообщения пользователя только текстом поискового запроса, релевантным запросу пользователя. Если запрос пользователя уже хорош, используй его в качестве результата.
	// 	}),
	// };
	
	const apiUrl = randomEndpoint.url;
	const requestOptions = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			messages: [{from:'user', content: `Исправь ошибки в запросе "${prompt}". Верни только исправленный текст.`}],//[{from: 'user', content: "Сгенерируй запрос в поисковую систему для ответа на вопрос \""+prompt+"\". Используй русский язык. Выбери один наиболее релевантный запрос. Ответь только текстом запроса без лишних символов и слов."}],
			preprompt: "" //Ты — русскоязычный автоматический ассистент для написании запросов для поисковых систем на русском языке. Отвечай на сообщения пользователя только текстом поискового запроса, релевантным запросу пользователя. Если запрос пользователя уже хорош, используй его в качестве результата.
		}),
	};

	let retries = 0;

	await fetch(randomEndpoint.url+'/stop_generation', {
		method: "GET"
	});

	while (retries < maxRetries) {
		try {
			const response = await fetch(apiUrl, requestOptions);

			if (!response.ok) {
				console.error(`HTTP ${response.status} - ${response.statusText}`);
				throw new Error(`HTTP ${response.status} - ${response.statusText}`);
			}

			// Check if the response has a body
			if (!response.body) {
				console.error(response);
				throw new Error('Response has no body');
			}

			const textDecoder = new TextDecoder();
			const reader = response.body.getReader();
			let fullText = '';

			while (true) {
				const { done, value } = await reader.read();

				if (done) {
					reader.releaseLock();
					break;
				}

				// Process the chunk of text (value) here
				const chunk = textDecoder.decode(value);
				fullText += chunk
			}
			
			return fullText;

		} catch (error) {
			console.error('Error:', error);
			retries++;
			console.log(`Retrying request (${retries}/${maxRetries})...`);
			continue; // Retry the loop

		}
	}

	throw new Error(`Max retries (${maxRetries}) exceeded.`);
}