import type { Message } from "$lib/types/Message";
import { format } from "date-fns";
import { generateFromDefaultEndpoint, generateSearchQuery } from "../generateFromDefaultEndpoint";
import { defaultModel } from "../models";

export async function generateQuery(messages: Message[]) {
	const currentDate = format(new Date(), "yyyy.mm.dd");
	const userMessages = messages.filter(({ from }) => from === "user");
	const previousUserMessages = userMessages.slice(0, -1);
	const lastMessage = userMessages.slice(-1)[0];
	// const promptSearchQuery = defaultModel.webSearchQueryPromptRender({
	// 	message: lastMessage,
	// 	previousMessages: previousUserMessages.map(({ content }) => content).join(" "),
	// 	currentDate,
	// });
	const prepromt = ""
	let searchQuery = await generateSearchQuery(lastMessage.content, {});
	
	// const regex = /"([^"]+)"/;
	// const matches = searchQuery.match(regex);

	// if (matches && matches.length > 1) {
	// 	searchQuery = matches[1];
	// }
	console.log('searchQuery', searchQuery)
	

	return searchQuery;
}


