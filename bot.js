const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

// Directly setting the environment variables
const BOT_TOKEN = 'YOUR BOT TOKEN'; // Replace with your Telegram Bot token
const ARB_URL = 'https://rpc.ankr.com/arbitrum'; // Arbitrum RPC URL

const provider = new ethers.providers.JsonRpcProvider(ARB_URL);
let wallet; // Define wallet variable
let whitelistedUsernames = []; // Array to store whitelisted Telegram usernames

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

let receivedAddresses = [];
let totalIncoming = ethers.BigNumber.from(0); // Track total incoming ETH
let totalOutgoing = ethers.BigNumber.from(0); // Track total outgoing ETH

// Read received addresses from JSON file (if exists)
try {
  const receivedData = fs.readFileSync("received_addresses.json", "utf8");
  receivedAddresses = JSON.parse(receivedData);
} catch (err) {
  console.error("Error reading received_addresses.json:", err);
  receivedAddresses = []; // Initialize if file doesn't exist
}

// Function to initialize wallet from private key
function initializeWallet(privateKey) {
  try {
    if (wallet) {
      return false; // Wallet already initialized
    }
    
    wallet = new ethers.Wallet(privateKey, provider);
    console.log("Wallet initialized for address:", wallet.address);
    return true;
  } catch (error) {
    console.error("Error initializing wallet:", error);
    return false;
  }
}

// Function to add a whitelisted username
function addWhitelistedUsername(username) {
  if (!whitelistedUsernames.includes(username)) {
    whitelistedUsernames.push(username);
    fs.writeFileSync("whitelisted_usernames.json", JSON.stringify(whitelistedUsernames));
    return true;
  } else {
    return false; // Username already whitelisted
  }
}

// Function to send ETH
async function sendETH(address) {
  try {
    const amountToSend = ethers.utils.parseEther("0.00001");
    const balance = await wallet.getBalance();

    console.log("Wallet Balance:", ethers.utils.formatEther(balance));
    console.log("Amount to Send:", ethers.utils.formatEther(amountToSend));

    if (balance.lt(amountToSend)) {
      console.log("Insufficient funds in the wallet.");
      return "Insufficient funds in the wallet.";
    }

    // Fetch gas price and base fee per gas
    let [gasPrice, feeData] = await Promise.all([
      provider.getGasPrice(),
      provider.getFeeData(),
    ]);

    let baseFeePerGas = feeData.baseFeePerGas;

    if (!baseFeePerGas) {
      console.error("baseFeePerGas is undefined after retries.");
      baseFeePerGas = ethers.utils.parseUnits("10", "gwei"); // Fallback gas price
    }

    // Calculate max fee per gas based on current network conditions
    const maxFeePerGas = baseFeePerGas.add(gasPrice);
    console.log("Max Fee Per Gas:", ethers.utils.formatUnits(maxFeePerGas, "gwei"));

    // Set gas limit based on transaction complexity
    const gasLimit = ethers.BigNumber.from("21000"); // Minimum gas limit for simple transfers

    console.log(`Preparing to send transaction to ${address} with gas limit ${gasLimit.toString()}`);

    // Send transaction
    let tx;
    try {
      tx = await wallet.sendTransaction({
        to: address,
        value: amountToSend,
        gasLimit: gasLimit,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: ethers.utils.parseUnits("1", "gwei"), // Optional: Set a max priority fee per gas
      });
      console.log("Transaction sent:", tx.hash);

      // Update total outgoing ETH
      totalOutgoing = totalOutgoing.add(amountToSend);
    } catch (error) {
      console.error("Error sending transaction:", error);
      return `Error: ${error.message}`;
    }

    // Wait for transaction confirmation
    try {
      const receipt = await tx.wait();
      console.log("Transaction confirmed. Gas used:", receipt.gasUsed.toString());

      // Update receivedAddresses array and write to JSON file
      receivedAddresses.push(address);
      fs.writeFileSync("received_addresses.json", JSON.stringify(receivedAddresses));

      // Update total incoming ETH
      totalIncoming = totalIncoming.add(amountToSend);

      return `Transaction successful: ${tx.hash}`;
    } catch (error) {
      console.error("Error waiting for transaction confirmation:", error);
      return `Error: ${error.message}`;
    }
  } catch (error) {
    console.error("Error in sendETH function:", error);
    return `Error: ${error.message}`;
  }
}

// Function to get total transactions
function getTotalTransactions() {
  return receivedAddresses.length;
}

// Function to get total incoming ETH
function getTotalIncoming() {
  return totalIncoming;
}

// Function to get total outgoing ETH
function getTotalOutgoing() {
  return totalOutgoing;
}

// Function to check if a username is whitelisted
function isWhitelistedUsername(username) {
  return whitelistedUsernames.includes(username);
}

// Telegram bot listener
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const username = msg.chat.username;

  if (text.startsWith("/setprivatekey ")) {
    const privateKey = text.replace("/setprivatekey ", "").trim();
    const initialized = initializeWallet(privateKey);

    if (initialized) {
      bot.sendMessage(chatId, `Wallet initialized for address: ${wallet.address}`);
      // Clear whitelisted usernames after initializing wallet
      whitelistedUsernames = [];
      fs.writeFileSync("whitelisted_usernames.json", JSON.stringify(whitelistedUsernames));
    } else {
      bot.sendMessage(chatId, "Wallet already initialized or error in initialization.");
    }
  } else if (text.startsWith("/addwhitelist ")) {
    const usernameToAdd = text.replace("/addwhitelist ", "").trim();
    if (addWhitelistedUsername(usernameToAdd)) {
      bot.sendMessage(chatId, `Username ${usernameToAdd} added to whitelist.`);
    } else {
      bot.sendMessage(chatId, `Username ${usernameToAdd} is already whitelisted.`);
    }
  } else if (ethers.utils.isAddress(text)) {
    if (!wallet) {
      bot.sendMessage(chatId, "Wallet not initialized. Please set your private key first using /setprivatekey <your_private_key>");
      return;
    }

    if (receivedAddresses.includes(text)) {
      bot.sendMessage(chatId, "This address has already received ETH.");
    } else {
      const result = await sendETH(text);
      bot.sendMessage(chatId, result);
    }
  } else if (text === "/total") {
    const totalIncomingFormatted = ethers.utils.formatEther(getTotalIncoming());
    const totalOutgoingFormatted = ethers.utils.formatEther(getTotalOutgoing());
    const totalTransactions = getTotalTransactions();

    bot.sendMessage(chatId, `Total Incoming ETH: ${totalIncomingFormatted} ETH\nTotal Outgoing ETH: ${totalOutgoingFormatted} ETH\nTotal Transactions: ${totalTransactions}`);
  } else if (isWhitelistedUsername(username)) {
    if (ethers.utils.isAddress(text)) {
      const result = await sendETH(text);
      bot.sendMessage(chatId, result);
    } else {
      bot.sendMessage(chatId, "Invalid input. Please provide a valid Ethereum address to receive ETH.");
    }
  } else {
    bot.sendMessage(chatId, "Send your Arbitrum ETH address to receive ETH or use /setprivatekey <your_private_key> to initialize your wallet. You can also use /total to get total transaction details. Only whitelisted users can send ETH directly.");
  }
});

// Handle /start command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Send your Arbitrum ETH address to receive ETH or use /setprivatekey <your_private_key> to initialize your wallet. You can also use /total to get total transaction details. Only whitelisted users can send ETH directly.");
});

// Polling error handler
bot.on("polling_error", (error) => {
  console.error("Polling error:", error.code, error.response?.body);
});

console.log("Bot is running...");
