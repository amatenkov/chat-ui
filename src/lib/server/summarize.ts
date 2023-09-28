import { buildPrompt } from "$lib/buildPrompt";
import { generateFromDefaultEndpoint } from "$lib/server/generateFromDefaultEndpoint";
import { defaultModel } from "$lib/server/models";

export async function summarize(prompt: string) {
	//const userPrompt = prompt;
	const preprompt = "";//"Ты переписываешь сообщения пользователя так, чтобы они содержали пять или менее слов";
	prompt = "Напиши суть текста в три слова: "+prompt
	// const summaryPrompt = await buildPrompt({
	// 	messages: [{ from: "user", content: prompt }],
	// 	preprompt: "Ты — искусственный интеллект, который генерирует заголовки для газетных статей. Заголовок должен вмещаться в одно предложение и содержать не более пяти слов. Ты не должен писать ничего, кроме текста заголовка. Текст статьи предоставляет пользователь.",
	// 		//"You are a summarization AI. Your task is to summarize user requests, in a single sentence of less than 5 words. Do not try to answer questions, just summarize the user's request.",
	// 	model: defaultModel,
	// });

	const generated_text = await generateFromDefaultEndpoint(prompt, {}, preprompt).catch((e) => {
		console.error('generateFromDefaultEndpoint error', e);
		return null;
	});

	if (generated_text) {
		return generated_text;
	}

	return null;
}
