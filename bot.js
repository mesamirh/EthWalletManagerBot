require("dotenv").config();
const { ethers } = require("ethers");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

console.log("===================================");
console.log("          mesamirh                ");
console.log("===================================");

// Getting data from .env file
const BOT_TOKEN = process.env.BOT_TOKEN;
const ARB_URL = process.env.ARB_URL;
const OWNER_ID = process.env.OWNER_ID;

const provider = new ethers.JsonRpcProvider(ARB_URL);
let wallet;
let whitelistedUsernames = [];

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

let receivedAddresses = [];
let totalIncoming = 0n;
let totalOutgoing = 0n;

function ensureFileExists(filePath, defaultContent = Buffer.from([])) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, defaultContent);
  }
}

ensureFileExists("received_addresses.bin");
ensureFileExists("whitelisted_usernames.bin");

try {
  const receivedData = fs.readFileSync("received_addresses.bin");
  if (receivedData.length > 0) {
    receivedAddresses = JSON.parse(receivedData.toString());
  } else {
    receivedAddresses = [];
  }
} catch (err) {
  console.error("Error while reading received_addresses.bin:", err);
  receivedAddresses = [];
}

try {
  const whitelistedData = fs.readFileSync("whitelisted_usernames.bin");
  if (whitelistedData.length > 0) {
    whitelistedUsernames = JSON.parse(whitelistedData.toString());
  } else {
    whitelistedUsernames = [];
  }
} catch (err) {
  console.error("Error while reading whitelisted_usernames.bin:", err);
  whitelistedUsernames = [];
}

bot
  .getChat(OWNER_ID)
  .then((chat) => {
    bot.sendMessage(OWNER_ID, `Sir ${chat.first_name}, I'm awake!`);
  })
  .catch((error) => {
    console.error("Error fetching owner's name:", error);
    bot.sendMessage(
      OWNER_ID,
      `Error: Could not retrieve your name. Bot is awake!`
    );
  });

function initializeWallet(privateKey) {
  try {
    if (wallet) {
      return false;
    }

    wallet = new ethers.Wallet(privateKey, provider);
    console.log("Wallet initialized for address:", wallet.address);
    return true;
  } catch (error) {
    console.error("Error while initializing wallet:", error);
    bot.sendMessage(
      OWNER_ID,
      `Error while initializing wallet: ${error.message}`
    );
    return false;
  }
}

function addWhitelistedUsername(username) {
  if (!whitelistedUsernames.includes(username)) {
    whitelistedUsernames.push(username);
    fs.writeFileSync(
      "whitelisted_usernames.bin",
      Buffer.from(JSON.stringify(whitelistedUsernames))
    );
    return true;
  } else {
    return false;
  }
}

async function sendETH(address) {
  try {
    const amountToSend = ethers.utils.parseEther("0.00001");
    const balance = await wallet.getBalance();

    console.log("Wallet ETH Balance:", ethers.utils.formatEther(balance));
    console.log("Amount to Send:", ethers.utils.formatEther(amountToSend));

    if (balance.lt(amountToSend)) {
      console.log("No funds available in the wallet.");
      return "No funds available in the wallet.";
    }

    let [gasPrice, feeData] = await Promise.all([
      provider.getGasPrice(),
      provider.getFeeData(),
    ]);

    let baseFeePerGas = feeData.baseFeePerGas;

    if (!baseFeePerGas) {
      console.error("baseFeePerGas is undefined after retries.");
      baseFeePerGas = ethers.utils.parseUnits("10", "gwei");
    }

    const maxFeePerGas = baseFeePerGas.add(gasPrice);
    console.log(
      "Max Fee Per Gas:",
      ethers.utils.formatUnits(maxFeePerGas, "gwei")
    );

    const gasLimit = 21000n;

    console.log(
      `Sending transaction to ${address} with gas limit ${gasLimit.toString()}`
    );

    let tx;
    try {
      tx = await wallet.sendTransaction({
        to: address,
        value: amountToSend,
        gasLimit: gasLimit,
        maxFeePerGas: maxFeePerGas,
        maxPriorityFeePerGas: ethers.utils.parseUnits("1", "gwei"),
      });
      console.log("Transaction sent:", tx.hash);

      totalOutgoing = totalOutgoing.add(amountToSend);
    } catch (error) {
      console.error("Error while sending transaction:", error);
      bot.sendMessage(
        OWNER_ID,
        `Error while sending transaction: ${error.message}`
      );
      return `Error: ${error.message}`;
    }

    try {
      const receipt = await tx.wait();
      console.log(
        "Transaction confirmed. Gas used:",
        receipt.gasUsed.toString()
      );

      receivedAddresses.push(address);
      fs.writeFileSync(
        "received_addresses.bin",
        Buffer.from(JSON.stringify(receivedAddresses))
      );

      totalIncoming = totalIncoming.add(amountToSend);

      return `Transaction successful: ${tx.hash}`;
    } catch (error) {
      console.error("Error waiting for transaction confirmation:", error);
      bot.sendMessage(
        OWNER_ID,
        `Error waiting for transaction confirmation: ${error.message}`
      );
      return `Error: ${error.message}`;
    }
  } catch (error) {
    console.error("Error in sendETH function:", error);
    bot.sendMessage(OWNER_ID, `Error in sendETH function: ${error.message}`);
    return `Error: ${error.message}`;
  }
}

function getTotalTransactions() {
  return receivedAddresses.length;
}

function getTotalIncoming() {
  return totalIncoming;
}

function getTotalOutgoing() {
  return totalOutgoing;
}

function isWhitelistedUsername(username) {
  return whitelistedUsernames.includes(username);
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const username = msg.chat.username;

  if (text.startsWith("/setprivatekey ")) {
    const privateKey = text.replace("/setprivatekey ", "").trim();
    const initialized = initializeWallet(privateKey);

    if (initialized) {
      bot.sendMessage(
        chatId,
        `Wallet initialized for address: ${wallet.address}`
      );

      whitelistedUsernames = [];
      fs.writeFileSync(
        "whitelisted_usernames.bin",
        Buffer.from(JSON.stringify(whitelistedUsernames))
      );
    } else {
      bot.sendMessage(
        chatId,
        "Wallet already initialized or error in initialization."
      );
    }
  } else if (text.startsWith("/addwhitelist ")) {
    const usernameToAdd = text.replace("/addwhitelist ", "").trim();
    if (addWhitelistedUsername(usernameToAdd)) {
      bot.sendMessage(chatId, `Username ${usernameToAdd} added to whitelist.`);
    } else {
      bot.sendMessage(
        chatId,
        `Username ${usernameToAdd} is already whitelisted.`
      );
    }
  } else if (ethers.utils.isAddress(text)) {
    if (!wallet) {
      bot.sendMessage(
        chatId,
        "Wallet not initialized. Set your private key first using /setprivatekey <your_private_key>"
      );
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

    bot.sendMessage(
      chatId,
      `Total Incoming ETH: ${totalIncomingFormatted} ETH\nTotal Outgoing ETH: ${totalOutgoingFormatted} ETH\nTotal Transactions: ${totalTransactions}`
    );
  } else if (isWhitelistedUsername(username)) {
    if (ethers.utils.isAddress(text)) {
      const result = await sendETH(text);
      bot.sendMessage(chatId, result);
    } else {
      bot.sendMessage(
        chatId,
        "Wrong address. Please provide a valid Ethereum address to receive ETH."
      );
    }
  } else {
    bot.sendMessage(
      chatId,
      "Hello, send Arbitrum ETH address to receive ETH or use /setprivatekey <your_private_key> to initialize your wallet. You can also use /total to get total transaction details."
    );
  }
});

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "Hello, send Arbitrum ETH address to receive ETH or use /setprivatekey <your_private_key> to initialize your wallet. You can also use /total to get total transaction details."
  );
});

bot.on("polling_error", (error) => {
  console.error("Polling error:", error.code, error.response?.body);
  bot.sendMessage(
    OWNER_ID,
    `Polling error: ${error.code} - ${error.response?.body}`
  );
});

console.log("Bot is running...");
