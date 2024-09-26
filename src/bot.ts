// src/bot.ts

import { Telegraf } from "telegraf";
import { CommandContext } from "./types";

// Create an instance of the Telegram bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Set up event listeners and command handlers
bot.start((ctx) => ctx.reply("Welcome to the chatbot!"));
bot.help((ctx) => ctx.reply("This is a Telegram chatbot."));
bot.command("ping", (ctx) => ctx.reply("Pong!"));

// Handle incoming messages
bot.on("text", async (ctx) => {
  const command = ctx.message.text;
  const commandContext: CommandContext = {
    message: ctx.message,
    reply: ctx.reply.bind(ctx),
  };

  // Execute the command
  switch (command) {
    case "/hello":
      await handleHelloCommand(commandContext);
      break;
    case "/bye":
      await handleByeCommand(commandContext);
      break;
    default:
      await handleUnknownCommand(commandContext);
      break;
  }
});

// Start the bot
bot.launch();

// Handle the /hello command
async function handleHelloCommand(ctx: CommandContext) {
  await ctx.reply("Hello!");
}

// Handle the /bye command
async function handleByeCommand(ctx: CommandContext) {
  await ctx.reply("Goodbye!");
}

// Handle unknown commands
async function handleUnknownCommand(ctx: CommandContext) {
  await ctx.reply("Unknown command. Please try again.");
}

export default bot;
