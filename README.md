# Eth Wallet Manager Bot

## Overview

EthWalletManagerBot is a Telegram bot designed to manage Ethereum wallets and perform transactions on the Arbitrum network. The bot allows users to send and receive ETH, track transaction history, and manage a whitelist of authorized users. 

## Features

- **Initialize Wallet**: Securely initialize an Ethereum wallet using a private key.
- **Whitelist Management**: Add and manage whitelisted Telegram usernames.
- **Send ETH**: Send a specified amount of ETH to provided Ethereum addresses.
- **Transaction Tracking**: Track total incoming and outgoing ETH transactions.
- **Address Management**: Track addresses that have already received ETH to prevent duplicate transactions.
- **User-Friendly Commands**: Simple commands for users to interact with the bot.

## Commands

- `/setprivatekey <private_key>`: Initialize the Ethereum wallet with the provided private key.
- `/addwhitelist <username>`: Add a Telegram username to the whitelist.
- `/total`: Get the total incoming and outgoing ETH and the total number of transactions.
- Send an Ethereum address: Send ETH to the provided address if it hasn't received ETH before.

## Installation

1. **Clone the repository**:
    ```bash
    git clone https://github.com/mesamirh/EthWalletManagerBot.git
    cd EthWalletManagerBot
    ```

2. **Install dependencies**:
    ```bash
    npm install
    ```

3. **Configure the bot**:
   - Edit the `.env` file in the root directory
4. **Run the bot**:
    ```bash
    npm start
    ```

## Usage

- Start the bot and interact with it on Telegram using the commands listed above.
- Ensure your Ethereum wallet is initialized before attempting to send ETH.

## Contributing

Feel free to submit issues, fork the repository and send pull requests!