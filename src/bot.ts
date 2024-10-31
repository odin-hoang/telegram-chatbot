import TelegramBot from "node-telegram-bot-api";
import { CommandText } from "./types";
import dotenv from "dotenv";

import { Collection, Db, MongoClient } from "mongodb";
import { getTransaction } from "./services/transaction";
import cron from "node-cron";
import { welcomeMessage } from "./message/welcome";
import { transactionMessage } from "./message/transaction";
dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN || "";
const bot = new TelegramBot(token, { polling: true });

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost:27017";
const client = new MongoClient(mongoUrl);
const dbName = "telegram_bot"; // Database name
let db: Db;
let sessionsCollection: Collection;

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

// Add error handling for polling errors
bot.on("polling_error", (error) => {
  console.error("Polling error:", error.name, error.message);
});

// Create a Web App button (mini-app) in the reply markup
const webAppKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [
        {
          text: "Open Mini App",
          web_app: {
            url: `${process.env.WEB_APP_URL}` || "",
          },
        },
      ],
    ],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};

bot.setMyCommands([{ command: CommandText.START, description: "Start" }]);

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  await saveSession(chatId, { chatId, state: "start" });
});

bot.on("new_chat_members", async (msg) => {
  const chatId = msg.chat.id;

  const newMembers = msg.new_chat_members || [];
  for (const newMember of newMembers) {
    // Skip if the new member is the bot itself
    if (
      newMember.is_bot &&
      newMember.username === (await bot.getMe()).username
    ) {
      continue;
    }
    const memberName = newMember.username || newMember.first_name;
    const message = welcomeMessage.replace("{user}", memberName);
    bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
    });

    await updateSession(
      chatId,
      { userName: memberName, joinedAt: new Date() },
      memberName
    );
  }
});
bot.on("left_chat_member", async (msg) => {
  const chatId = msg.chat.id;
  const memberName =
    msg.left_chat_member?.username || msg.left_chat_member?.first_name;
  if (memberName) {
    await updateSession(chatId, { leftAt: new Date() }, memberName);
  }
});
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text as CommandText;
  const user = msg.from?.username;

  if (user === (await bot.getMe()).username) {
    return; // Skip messages from the bot itself
  }
  if (!messageText) {
    return; // Skip messages without text
  }

  // Retrieve user session
  const session = await sessionsCollection.findOne({ chatId, userName: user });
  const currentAddress = session?.address || [];

  // Add the new address to the user's address list
  // if (session && session.state === "awaiting_address") {
  //   currentAddress.push(messageText);
  //   if (user) {
  //     await updateSession(
  //       chatId,
  //       { address: currentAddress, state: null },
  //       user
  //     );
  //   }
  //   bot.sendMessage(chatId, `🗿 Address saved: ${messageText}`);
  //   return; // Exit since the address has been handled
  // }

  // Handle commands
  if (messageText.startsWith("/")) {
    switch (messageText) {
      case CommandText.START:
        const message = welcomeMessage.replace("{user}", user || "User");
        bot.sendMessage(chatId, message, {
          parse_mode: "Markdown",
        });
        await updateSession(
          chatId,
          { userName: user, address: [] },
          user || ""
        );
        break;

      case CommandText.GET_ADDRESS:
        const addresses = session?.address || [];
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
        await updateSession(chatId, { address: [] }, user || "");
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
    // Handle normal messages
    console.log("Normal message:", messageText);

    // Update the number of messages in the session
    const numberOfMessages = (session?.numberOfMessages || 0) + 1;

    await updateSession(chatId, { numberOfMessages }, user || "");
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
async function updateSession(
  chatId: number,
  updates: any,
  userName: string = ""
) {
  try {
    await sessionsCollection.updateOne(
      { userName },
      { $set: updates },
      { upsert: true }
    );
    console.log("Session updated for chatId:", chatId);
  } catch (err) {
    console.error("Error updating session:", err);
  }
}
async function getSession(chatId: number, userName: string) {
  try {
    const session = await sessionsCollection.findOne({
      chatId,
      userName,
    });
    return session;
  } catch (err) {
    console.error("Error getting session:", err);
  }
}

// cron.schedule("*/1 * * * *", async () => {
//   console.log("Running cron job...");
//   triggerSendNotify();
// });

const inlineKeyboard = {
  inline_keyboard: [
    [
      {
        text: "🔍 Explore Transaction",
        url: `${process.env.EXPLORE_URL}`,
      },
      {
        text: "✅ Trade",
        url: `${process.env.TRADE_URL}`,
      },
    ],
  ],
  resize_keyboard: true,
  one_time_keyboard: true,
};
// async function triggerSendNotify() {
//   try {
//     const users = await sessionsCollection.find().toArray();
//     for (const user of users) {
//       const chatId = user.chatId;
//       const addresses = user.address || [];
//       const DECIMAL = Math.pow(10, 8);
//       for (const address of addresses) {
//         const transactions = await getTransaction(address, "0");
//         transactions.forEach((tx: any) => {
//           const message = transactionMessage
//             .replace("{txHash}", tx.transaction_hash)
//             .replace("{amount}", `${tx.amount / DECIMAL}`)
//             .replace("{timestamp}", `${new Date(tx.timestamp / 1000)}`);
//           bot.sendMessage(chatId, message, {
//             parse_mode: "Markdown",
//             reply_markup: inlineKeyboard,
//           });
//         });
//       }
//     }
//   } catch (err) {
//     console.error("Error in triggerSendNotify:", err);
//   }
// }
