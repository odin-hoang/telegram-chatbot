# Telegram Chatbot

This project is a Telegram chatbot that provides various commands and functionalities.

## Getting Started

To get started with the chatbot, follow these steps:

1. Clone the repository: `git clone https://github.com/your-username/telegram-chatbot.git`
2. Install the dependencies: `npm install`
3. Configure the Telegram bot token in the `src/bot.ts` file.
4. Start the chatbot: `npm start`

## Project Structure

The project has the following file structure:

- `src/bot.ts`: This file is the entry point of the chatbot application. It creates an instance of the Telegram bot and sets up event listeners and command handlers.

- `src/commands/index.ts`: This file exports classes for each command supported by the chatbot. Each command class has a method that handles the execution of the command.

- `src/middlewares/index.ts`: This file exports middleware functions that can be used to intercept and modify incoming messages or actions before they are processed by the chatbot.

- `src/types/index.ts`: This file exports interfaces and types related to the Telegram API. It provides type definitions for message objects, user objects, and other API entities.

- `tsconfig.json`: This file is the configuration file for TypeScript. It specifies the compiler options and the files to include in the compilation.

- `package.json`: This file is the configuration file for npm. It lists the dependencies and scripts for the project.

For more information on how to use and extend the chatbot, refer to the documentation in the respective files.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
```

Please note that the placeholders like `your-username` and `LICENSE` should be replaced with the appropriate values based on your project.