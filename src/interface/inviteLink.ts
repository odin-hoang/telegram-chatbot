import TelegramBot from "node-telegram-bot-api";

// Store active invite links and their parameters
interface InviteLink {
  link: string;
  params: Record<string, string>;
  creator: number; // User ID of who created the link
  created: Date;
}
interface ExtendedMessage extends TelegramBot.Message {
  invite_link?: {
    invite_link: string;
  };
}
// Interface for referral tracking
interface ReferralLink {
  hash: string;
  referrerId: number;
  referrerUsername: string;
  created: Date;
  uses: number;
}
// Interface for storing referred users
interface ReferredUser {
  userId: number;
  username: string;
  referrerId: number;
  joinDate: Date;
}
export { InviteLink, ExtendedMessage, ReferralLink, ReferredUser };
