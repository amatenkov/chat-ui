import { searchWeb } from "$lib/server/websearch/searchWeb";
import type { Message } from "$lib/types/Message";
import type { WebSearch, WebSearchSource } from "$lib/types/WebSearch";
import { generateQuery } from "$lib/server/websearch/generateQuery";
import { parseWeb } from "$lib/server/websearch/parseWeb";
import { chunk } from "$lib/utils/chunk";
import {
	MAX_SEQ_LEN as CHUNK_CAR_LEN//,
	//findSimilarSentences,
} from "$lib/server/websearch/sentenceSimilarity";
import type { Conversation } from "$lib/types/Conversation";
import type { MessageUpdate } from "$lib/types/MessageUpdate";

const MAX_N_PAGES_SCRAPE = 10 as const;
const MAX_N_PAGES_EMBED = 5 as const;

export async function runWebSearch(
	conv: Conversation,
	prompt: string,
	updatePad: (upd: MessageUpdate) => void
) {
	const messages = (() => {
		return [...conv.messages, { content: prompt, from: "user", id: crypto.randomUUID() }];
	})() satisfies Message[];

	const webSearch: WebSearch = {
		prompt: prompt,
		searchQuery: "",
		results: [],
		context: "",
		contextSources: [],
		createdAt: new Date(),
		updatedAt: new Date(),
	};

	function appendUpdate(message: string, args?: string[], type?: "error" | "update") {
		updatePad({ type: "webSearch", messageType: type ?? "update", message: message, args: args });
	}

	try {
		webSearch.searchQuery = await generateQuery(messages);
		console.log('Web search query: ', webSearch.searchQuery)
		appendUpdate("Сгенерирован запрос для поиска", [webSearch.searchQuery]);
		const results = await searchWeb(webSearch.searchQuery);
		webSearch.results =
			(results.organic_results &&
				results.organic_results.map((el: { title: string; link: string }) => {
					const { title, link } = el;
					const { hostname } = new URL(link);
					return { title, link, hostname };
				})) ??
			[];
		webSearch.results = webSearch.results
			.filter(({ link }) => !link.includes("youtube.com")) // filter out youtube links
			.slice(0, MAX_N_PAGES_SCRAPE); // limit to first 10 links only

		let paragraphChunks: { source: WebSearchSource; text: string }[] = [];
		if (webSearch.results.length > 0) {
			appendUpdate("Обработка результатов");
			const promises = webSearch.results.map(async (result) => {
				const { link } = result;
				let text = "";
				try {
					text = await parseWeb(link);
					appendUpdate("Обработка страницы", [link]);
				} catch (e) {
					console.error(`Error parsing webpage "${link}"`, e);
				}
				const MAX_N_CHUNKS = 100;
				const texts = chunk(text, CHUNK_CAR_LEN).slice(0, MAX_N_CHUNKS);
				return texts.map((t) => ({ source: result, text: t }));
			});
			const nestedParagraphChunks = (await Promise.all(promises)).slice(0, MAX_N_PAGES_EMBED);
			paragraphChunks = nestedParagraphChunks.flat();
			if (!paragraphChunks.length) {
				throw new Error("No text found on the first 5 results");
			}
		} else {
			throw new Error("No results found for this search query");
		}

		appendUpdate("Получение релевантной информации");
		const topKClosestParagraphs = 8;

		const explodedTexts = paragraphChunks.flatMap(({ text }) => text.split('.'));
		
		const indices = await findSimilarSentences(prompt, explodedTexts);//, { topK: topKClosestParagraphs});
		// webSearch.context = indices.map((idx) => texts[idx]).join("");
		webSearch.context = indices.join(". ").slice(0, 1000);
		updatePad({
			type: "webSearch",
			messageType: "sources",
			message: "sources",
			sources: [],
		});
		// const usedSources = new Set<string>();
		// for (const idx of indices) {
		// 	const { source } = paragraphChunks[idx];
		// 	if (!usedSources.has(source.link)) {
		// 		usedSources.add(source.link);
		// 		webSearch.contextSources.push(source);
		// 		updatePad({
		// 			type: "webSearch",
		// 			messageType: "sources",
		// 			message: "sources",
		// 			sources: webSearch.contextSources,
		// 		});
		// 	}
		// }
	} catch (searchError) {
		if (searchError instanceof Error) {
			appendUpdate(
				"Произошла ошибка",
				[JSON.stringify(searchError.message)],
				"error"
			);
		}
	}

	return webSearch;
}


async function findSimilarSentences(query: string, sentences: string[]): Promise<string[]> {

	const apiUrl = 'https://muryshev-e5-sentence-similarity.hf.space/get_similar_sentences';
	const requestOptions = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			query: query,
			sentences: sentences,
			threshold: 0.8
		}),
	};

	let retries = 0;
	const maxRetries = 3;

	while (retries < maxRetries) {
		try {
			const response = await fetch(apiUrl, requestOptions);
			if (!response.ok) {
				throw new Error('Network response was not ok');
			}

			const jsonData = await response.json();

			return jsonData.result;

		} catch (error) {
			console.error('Error:', error);
			retries++;
			console.log(`Retrying request (${retries}/${maxRetries})...`);
			continue; // Retry the loop

		}
	}

	throw new Error(`Max retries (${maxRetries}) exceeded.`);
}