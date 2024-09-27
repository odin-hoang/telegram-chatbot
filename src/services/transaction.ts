import dotenv from "dotenv";
dotenv.config();
export async function getTransaction(wallet_addr: string, timestamp: string) {
  try {
    const response = await fetch(
      `${process.env.BACKEND_URL}/api/transactions?accountId=${wallet_addr}&timestamp=${timestamp}`
    );
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return [];
  }
}
