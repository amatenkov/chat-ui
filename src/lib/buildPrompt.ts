import type { BackendModel } from "./server/models";
import type { Message } from "./types/Message";
import { format } from "date-fns";
import type { WebSearch } from "./types/WebSearch";
/**
 * Convert [{user: "assistant", content: "hi"}, {user: "user", content: "hello"}] to:
 *
 * <|assistant|>hi<|endoftext|><|prompter|>hello<|endoftext|><|assistant|>
 */

interface buildPromptOptions {
	messages: Pick<Message, "from" | "content">[];
	model: BackendModel;
	locals?: App.Locals;
	webSearch?: WebSearch;
	preprompt?: string;
}

export async function buildPrompt({
	messages,
	model,
	webSearch,
	preprompt,
}: buildPromptOptions): Promise<string> {
	if (webSearch && webSearch.context) {
		const messagesWithoutLastUsrMsg = messages.slice(0, -1);
		const lastUserMsg = messages.slice(-1)[0];
		const currentDate = format(new Date(), "yyyy.MM.dd");
		messages = [
			//...messagesWithoutLastUsrMsg,
			{
				from: "user",
				content: `Ответь на запрос "${lastUserMsg.content}" опираясь на факты из текста статей. Не отвечай ложными фактами. Отвечай подробно. Текст статей: ${webSearch.context}`,
			},
		];
	}
	// console.log('messages', messages)
	return (
		model
			.chatPromptRender({ messages, preprompt })
			// Not super precise, but it's truncated in the model's backend anyway
			.split(" ")
			.slice(-(model.parameters?.truncate ?? 0))
			.join(" ")
	);
}
