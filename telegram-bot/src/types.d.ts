declare module 'node-telegram-bot-api' {
  class TelegramBot {
    constructor(token: string, options?: any);
    onText(regexp: RegExp, callback: (msg: any, match: any) => void): void;
    on(event: string, callback: (query: any) => void): void;
    onReplyToMessage(chatId: number, messageId: number, callback: (reply: any) => void): void;
    sendMessage(chatId: number, text: string, options?: any): Promise<any>;
    editMessageText(text: string, options?: any): Promise<any>;
    answerCallbackQuery(queryId: string, options?: any): Promise<any>;
  }

  export default TelegramBot;
}
