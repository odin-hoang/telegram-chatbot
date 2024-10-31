import TelegramBot from "node-telegram-bot-api";
import { CommandText } from "./types";
import dotenv from "dotenv";

import { Collection, Db, MongoClient } from "mongodb";
import { getTransaction } from "./services/transaction";
import cron from "node-cron";
import { refMessage, welcomeMessage } from "./message/welcome";
import { transactionMessage } from "./message/transaction";
import {
  ExtendedMessage,
  InviteLink,
  ReferralLink,
  ReferredUser,
} from "./interface/inviteLink";
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

bot.setMyCommands([{ command: CommandText.START, description: "Start" }]);

// bot.onText(/\/start /, async (msg, match) => {
//   const chatId = msg.chat.id;
//   const userName = msg.from?.username;
//   const userId = msg.from?.id;
//   if (!userName || !userId || !chatId) {
//     return;
//   }
//   const refParam = match ? match[1] : null;
//   console.log("Referral param:", refParam);

//   const referrerId =
//     refParam && refParam.startsWith("ref_") ? refParam.split("_")[1] : null;
//   let message = welcomeMessage.replace("{userName}", userName || "you");
//   if (referrerId) {
//     console.log("Referrer ID:", referrerId);
//     message = refMessage.replace("{referrerId}", referrerId);
//   }

//   await updateSession(
//     chatId,
//     { chatId, state: "start", userName, joinedAt: new Date() },
//     userId
//   );

//   bot.sendMessage(chatId, message, {
//     parse_mode: "Markdown",
//   });
// });
// ================== Handle Invite Link ==================
const commands: { [key: string]: any } = {
  [CommandText.START]: async ({ chat, from, text }: any) => {
    const chatId = chat.id;
    const userName = from.username;
    const userId = from.id;
    const refParam = text ? text.split(" ")[1] : null;

    console.log("Referral param:", refParam);
    const referrerId =
      refParam && refParam.startsWith("ref_") ? refParam.split("_")[1] : null;

    let message = welcomeMessage.replace("{userName}", userName);

    // If the user was referred by someone
    const referrer = await sessionsCollection.findOne({ userId: referrerId });
    const referrerName = referrer?.userName;

    if (referrerId) {
      console.log("Referrer ID:", referrerId);
      message = refMessage.replace("{referrer}", referrerName);
    }

    await updateSession(
      chatId,
      { chatId, state: "start", userName, joinedAt: new Date() },
      userId
    );

    await updateSession(
      chatId,
      { referred: [userId], updatedAt: new Date() },
      Number(referrerId)
    );

    bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
    });
  },
};
const handleCommand = async (
  chatId: number,
  messageText: string,
  user: TelegramBot.User
) => {
  const userName = user.username;
  const userId = user.id;
  if (!userName || !userId || !chatId) {
    return;
  }

  const command = messageText.split(" ")[0];

  const handler = commands[command];
  if (handler) {
    handler({ chat: { id: chatId }, from: user, text: messageText });
    return;
  }
};
// ================== Event listeners ==================
// Listen for new chat members

bot.on("new_chat_members", async (msg: ExtendedMessage) => {
  const chatId = msg.chat.id;
  console.log("New chat members in chat:", chatId);

  const newMembers = msg.new_chat_members || [];
  console.log("New members:", newMembers);

  for (const newMember of newMembers) {
    console.log("Processing new member:", newMember);

    // Skip if the new member is the bot itself
    if (
      newMember.is_bot &&
      newMember.username === (await bot.getMe()).username
    ) {
      console.log("Skipping bot itself:", newMember.username);
      continue;
    }

    const memberName = newMember.username || newMember.first_name;
    const memberId = newMember.id;
    console.log("New member name and ID:", { memberName, memberId });

    let welcomeMessage = `Hi ${memberName} ! 👋\nWelcome to the group!`;
    console.log("Initial welcome message:", welcomeMessage);

    bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: "Markdown",
    });

    console.log("Sent welcome message to chat:", chatId);

    await updateSession(
      chatId,
      { userName: memberName, joinedAt: new Date() },
      memberId
    );
    console.log("Updated session for member:", memberId);
  }
});

bot.on("left_chat_member", async (msg) => {
  const chatId = msg.chat.id;
  const memberName =
    msg.left_chat_member?.username || msg.left_chat_member?.first_name;
  const memberId = msg.left_chat_member?.id;
  if (memberName && memberId) {
    await updateSession(chatId, { leftAt: new Date() }, memberId);
  }
});
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const messageText = msg.text;
  const user = msg.from;

  if (user === (await bot.getMe()).username) {
    return; // Skip messages from the bot itself
  }
  if (!messageText) {
    return; // Skip messages without text
  }
  if (!user) {
    return; // Skip messages without user information
  }
  // ? ==== COMMAND ==== //
  if (messageText.startsWith("/")) {
    handleCommand(chatId, messageText, user);
    return;
  }

  // ? ==== NORMAL MESSAGE ==== //

  // Retrieve user session
  const session = await sessionsCollection.findOne({ chatId, userId: user.id });

  // Handle normal messages
  console.log("Normal message:", messageText);

  // Update the number of messages in the session
  const numberOfMessages = (session?.numberOfMessages || 0) + 1;

  await updateSession(chatId, { numberOfMessages }, user.id || 0);
});

// Command to generate an invite link for a user (for demonstration)
bot.onText(/\/invite/, async (msg) => {
  const userId = msg?.from?.id;
  const groupId = msg.chat.id;
  const chatInviteLink = await bot.createChatInviteLink(groupId, {
    name: `start=ref_${userId}`,
  });
  console.log("uri", chatInviteLink.invite_link);
  // const botUsername = "zOdinK_bot"; // Replace with your bot's username

  // Generate a referral link
  const inviteLink = `${chatInviteLink.invite_link}?start=ref_${userId}`;

  bot.sendMessage(
    msg.chat.id,
    `Share this link to invite others:\n${inviteLink}`
  );
});

// // Command to view your referral stats
// bot.onText(/\/mystats/, async (msg) => {
//   try {
//       const userId = msg.from!.id;

//       // Count referrals
//       let referralCount = 0;
//       const referredUsersList: string[] = [];

//       referredUsers.forEach((user) => {
//           if (user.referrerId === userId) {
//               referralCount++;
//               referredUsersList.push(`- ${user.username} (joined ${user.joinDate.toLocaleDateString()})`);
//           }
//       });

//       let message = `Your Referral Stats:\n\n`;
//       message += `Total Referrals: ${referralCount}\n\n`;

//       if (referralCount > 0) {
//           message += `Referred Users:\n${referredUsersList.join('\n')}`;
//       }

//       await bot.sendMessage(msg.chat.id, message);
//   } catch (error) {
//       console.error('Error getting referral stats:', error);
//       await bot.sendMessage(msg.chat.id, 'Error getting stats. Please try again.');
//   }
// });
// ================== Helper functions ==================
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
async function updateSession(chatId: number, updates: any, userId: number) {
  try {
    await sessionsCollection.updateOne(
      { userId, chatId },
      {
        $set: {
          ...updates,
          chatId,
          userId,
        },
      },
      { upsert: true }
    );
    console.log("Session updated for chatId:", chatId);
  } catch (err) {
    console.error("Error updating session:", err);
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
