import TelegramBot from "node-telegram-bot-api";
import { CommandText } from "./types";
import dotenv from "dotenv";
import { inlineKeyboard } from "telegraf/typings/markup";
import { MongoClient } from "mongodb";
import { getTransaction } from "./services/transaction";
import cron from "node-cron";
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN || "";
const bot = new TelegramBot(token, { polling: true });

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017";
const client = new MongoClient(mongoUrl);
const dbName = "telegram_bot"; // Database name
let db, sessionsCollection: any;

async function connectToMongo() {
  try {
    await client.connect();
    db = client.db(dbName);
    sessionsCollection = db.collection("sessions");
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("MongoDB connection error:", err);
  }
}
connectToMongo();

// Create a Web App button (mini-app) in the reply markup
const webAppKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "Open Mini App",
          web_app: {
            url: "https://thansohoconline.vercel.app",
          },
        },
      ],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};
bot.setMyCommands([
  { command: CommandText.ADD_ADDRESS, description: "Add Address" },
  { command: CommandText.START, description: "Start" },
  { command: CommandText.HELP, description: "Help" },
  { command: CommandText.WALLET, description: "Wallet" },
]);

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await saveSession(chatId, "start");
  bot.sendMessage(chatId, "Hello! Welcome to the bot.");
});

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text as CommandText;
  const user = msg.from?.username;
  // Retrieve user session
  const session = await sessionsCollection.findOne({ chatId });
  const currentAddress = session.address;
  // Add the new address to the user's address list

  // If the user is expected to enter their address
  if (session && session.state === "awaiting_address") {
    currentAddress.push(messageText);
    await updateSession(chatId, { address: currentAddress, state: null });
    bot.sendMessage(chatId, `🗿 Address saved: ${messageText}`);
    return; // Exit since the address has been handled
  }
  if (messageText.startsWith("/")) {
    switch (messageText) {
      case CommandText.START:
        bot.sendMessage(chatId, `👋 Welcome, ${user} to the aptos notifier!`);
        await updateSession(chatId, { userName: user, address: [] });
        break;
      case CommandText.WALLET:
        bot.sendMessage(chatId, "😴 Open Mini App here!", webAppKeyboard);
        break;
      case CommandText.HELP:
        bot.sendMessage(chatId, "ℹ️ Please contact our support team.");
        break;
      case CommandText.ADD_ADDRESS:
        // Ask user to enter their address and set state to 'awaiting_address'
        await updateSession(chatId, { state: "awaiting_address" });
        bot.sendMessage(chatId, "👋 Please enter your address:");
        break;
      case CommandText.GET_ADDRESS:
        const addresses = session.address;
        if (addresses.length === 0) {
          bot.sendMessage(chatId, "👋 You have no address.");
          break;
        }
        bot.sendMessage(
          chatId,
          `👋 Your address is:\n ${addresses.map(
            (addr: string) => addr + "\n"
          )} `
        );
        break;
      case CommandText.FLUSH_ADDRESS:
        await updateSession(chatId, { address: [] });
        bot.sendMessage(chatId, "🗿 Address list flushed.");
        break;
      default:
        bot.sendMessage(
          chatId,
          "❗ Unknown command. Please try other commands."
        );
        break;
    }
  } else {
    bot.sendMessage(chatId, `👋 Nice to meet you, ${user}!`);
  }
});

// Helper function to save new session
async function saveSession(chatId: number, sessionData: any) {
  try {
    const existingSession = await sessionsCollection.findOne({ chatId });
    if (!existingSession) {
      await sessionsCollection.insertOne(sessionData);
      console.log("Session saved for chatId:", chatId);
    } else {
      console.log("Session already exists for chatId:", chatId);
    }
  } catch (err) {
    console.error("Error saving session:", err);
  }
}

// Helper function to update session
async function updateSession(chatId: number, updates: any) {
  try {
    await sessionsCollection.updateOne(
      { chatId },
      { $set: updates },
      { upsert: true }
    );
    console.log("Session updated for chatId:", chatId);
  } catch (err) {
    console.error("Error updating session:", err);
  }
}

cron.schedule("*/1 * * * *", async () => {
  console.log("Running cron job...");
  triggerSendNotify();
});

async function triggerSendNotify() {
  const users = await sessionsCollection.find().toArray();
  for (const user of users) {
    const chatId = user.chatId;
    const addresses = user.address;
    const DECIMAL = Math.pow(10, 8);
    // iterate through each address
    for (const address of addresses) {
      const transactions = await getTransaction(address, "0");
      const messages = transactions.map((tx: any) => {
        bot.sendMessage(
          chatId,
          `💰 Transaction Hash: ${tx.transaction_hash}\n💰 Amount: ${
            tx.amount / DECIMAL
          }\n💰 Timestamp: ${tx.timestamp}`
        );
      });
    }
  }
}
