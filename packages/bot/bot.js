//require("dotenv").config();
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import { run } from "@grammyjs/runner";
import "dotenv/config";
import {
  createRandomWallet,
  createSafeWallet,
  fundSafeWalletWithEth,
  createSafeTransactionSendETH,
  importSafeWallet,
  sendUserEth,
  userEthBalance,
  safeEthBalance,
} from "./safeinteraction.js";
const { hydrate } = require("@grammyjs/hydrate");
const {
  conversations,
  createConversation,
} = require("@grammyjs/conversations");
const { Bot, session, GrammyError, HttpError } = require("grammy");
const { Menu } = require("@grammyjs/menu");
const {
  bold,
  fmt,
  hydrateReply,
  italic,
  link,
  code,
  spoiler,
} = require("@grammyjs/parse-mode");

const bot = new Bot(process.env.BOT_TOKEN);
const NETWORK_SCAN_ADDRESS = "https://goerli.etherscan.io/address/";
const NETWORK_SCAN_TX = "https://goerli.etherscan.io/tx/";

/// using sessions to persist values && creating initial sessions data
function createInitialSessionData() {
  return {
    log: 1,
    existing_chat: false,
    generated_wallet_address: "" || process.env.WALLET_ADDRESS,
    generated_wallet_privatekey: "",
    generated_wallet_mnemonic: "" || process.env.PRIVATE_MNEMONIC,
    safe_wallets_array: [],
    safe_wallet: "" || process.env.TEST_WALLET,
    has_safe_wallet: true,
    edit_able_message_id: 0,
  };
}
bot.use(session({ initial: createInitialSessionData }));
bot.use(hydrateReply);
bot.use(conversations());
bot.use(hydrate());
async function ask_for_reciever_amount_input(conversation, ctx) {
  /*if (!ctx.session.existing_chat)
    return ctx.replyFmt(fmt`Error processing request`); */
  const balance = await userEthBalance(ctx.session.generated_wallet_mnemonic);
  console.log("bot", balance);

  await ctx.replyFmt(
    fmt`You are transfering from your Eth balance
ETH balance : ${code(balance)} ETH`
  );
  ctx.replyFmt(fmt`Please input reciever address`);

  // TODO: code the conversation
  const reciever_address = await conversation.waitFor("message:text");
  if (reciever_address.message?.text === "/cancel") {
    await ctx.replyFmt(fmt`Cancelled conversation`);
    return;
  }
  if (!/^0x[a-fA-F0-9]{40}$/gm.test(reciever_address.message?.text.trim()))
    return ctx.replyFmt(fmt`Invalid Address format`);

  console.log(reciever_address.message, "raw rct");
  console.log(reciever_address.message.text, "rct");
  console.log(
    reciever_address.message.text.toString().trim(),
    "string and trim"
  );
  console.log(reciever_address.message.text.trim(), "trim");
  ctx.replyFmt(fmt`Please input amount`);
  const amount_input = await conversation.waitFor("message:text");
  if (amount_input.message?.text === "/cancel") {
    await ctx.replyFmt(fmt`Cancelled conversation`);
    return;
  }
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(amount_input.message?.text.trim()))
    return ctx.replyFmt(fmt`Invalid Amount format`);
  const verify = await ctx.replyFmt(
    fmt`Proccessing transaction..., This process will take ~ 5minutes`
  );
  try {
    const _sendUserEthtx = await sendUserEth(
      reciever_address.message.text,
      amount_input.message.text,
      ctx.session.generated_wallet_mnemonic
    );
    console.log(_sendUserEthtx, "tx");
    const fmtString = fmt`Successfully Transferred ${code(
      amount_input.message.text.trim()
    )} ETH to ${code(reciever_address.message.text.trim())} ${link(
      "↗",
      "" + NETWORK_SCAN_TX + _sendUserEthtx + ""
    )}`;
    await verify.editText(fmtString.toString(), {
      entities: fmtString.entities,
      disable_web_page_preview: true,
    });

    return;
  } catch (e) {
    console.log(e);
    console.log(e.Error);
    if (e === 701) {
      verify.editText("Invalid amount format");
      return;
    }
    if (e === 702) {
      verify.editText("Cannot import. This safe does not belong to this user.");
      return;
    }
    if (e === 703) {
      verify.editText("Invalid address format");
      return;
    }
    if (e === 705) {
      verify.editText("Insufficient balance for this transaction");
      return;
    }
    return;
  }
}
bot.use(createConversation(ask_for_reciever_amount_input));
async function ask_for_safe_transfer_eth_input(conversation, ctx) {
  /*if (!ctx.session.existing_chat)
    return ctx.replyFmt(fmt`Error processing request`); */
  const balance = await safeEthBalance(ctx.session.safe_wallet);
  console.log("bot", balance);

  await ctx.replyFmt(
    fmt`You are transfering from your safe Eth balance
ETH balance : ${code(balance)} ETH`
  );
  ctx.replyFmt(fmt`Please input reciever address`);

  // TODO: code the conversation
  const reciever_address = await conversation.waitFor("message:text");
  if (reciever_address.message?.text === "/cancel") {
    await ctx.replyFmt(fmt`Cancelled conversation`);
    return;
  }
  if (!/^0x[a-fA-F0-9]{40}$/gm.test(reciever_address.message?.text.trim()))
    return ctx.replyFmt(fmt`Invalid Address format`);

  console.log(reciever_address.message, "raw rct");
  console.log(reciever_address.message.text, "rct");
  console.log(
    reciever_address.message.text.toString().trim(),
    "string and trim"
  );
  console.log(reciever_address.message.text.trim(), "trim");
  ctx.replyFmt(fmt`Please input amount`);
  const amount_input = await conversation.waitFor("message:text");
  if (amount_input.message?.text === "/cancel") {
    await ctx.replyFmt(fmt`Cancelled conversation`);
    return;
  }
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(amount_input.message?.text.trim()))
    return ctx.replyFmt(fmt`Invalid Amount format`);
  const verify = await ctx.replyFmt(
    fmt`Proccessing transaction..., This process will take ~ 5minutes`
  );
  try {
    const _sendUserEthtx = await createSafeTransactionSendETH(
      reciever_address.message.text,
      amount_input.message.text,
      ctx.session.generated_wallet_mnemonic,
      ctx.session.safe_wallet
    );
    console.log(_sendUserEthtx, "tx");
    const fmtString = fmt`Successfully Transferred ${code(
      amount_input.message.text.trim()
    )} ETH to ${code(reciever_address.message.text.trim())} ${link(
      "↗",
      "" + NETWORK_SCAN_TX + _sendUserEthtx + ""
    )}`;
    await verify.editText(fmtString.toString(), {
      entities: fmtString.entities,
      disable_web_page_preview: true,
    });

    return;
  } catch (e) {
    console.log(e);
    console.log(e.Error);
    if (e === 701) {
      verify.editText("Invalid amount format");
      return;
    }
    if (e === 702) {
      verify.editText("Cannot import. This safe does not belong to this user.");
      return;
    }
    if (e === 703) {
      verify.editText("Invalid address format");
      return;
    }
    if (e === 705) {
      verify.editText("Insufficient balance for this transaction");
      return;
    }
    return;
  }
}
bot.use(createConversation(ask_for_safe_transfer_eth_input));

//bot.use(createConversation(ask_for_input_for_safeimport));
const intro_menu = new Menu("my-intro-menu-identifier")
  .text("Fund wallet", (ctx) => {
    ctx.session.log++;
    ctx.replyFmt(
      fmt`${fmt`Click the address to copy it.`}
${bold(
  fmt`▰ ${link(
    "Wallet",
    NETWORK_SCAN_ADDRESS + ctx.session.generated_wallet_address
  )} ▰ `
)}
${code(ctx.session.generated_wallet_address)}
${fmt`Send ethereum to this address to pay for gas`}
      `,
      { disable_web_page_preview: true }
    );
  })
  .row()
  .text("Create Safe Wallet", async (ctx) => {
    const verify = await ctx.replyFmt(
      fmt`Please wait while we setup you Safe Wallet, This process will take ~ 5minutes ...`
    );
    try {
      const safeAccountWallet = await createSafeWallet(
        ctx.session.generated_wallet_mnemonic
      );
      console.log(safeAccountWallet);
      ctx.session.safe_wallet = safeAccountWallet;
      ctx.session.has_safe_wallet = true;
      verify.editText("Safe Wallet successfully created: " + safeAccountWallet);
      return;
      // Menu_refresh(ctx);
    } catch (error) {
      verify.editText(
        `Cannot create safe wallet. Please ensure you have enough ETH to cover the gas fee.`
      );
      console.log(error);
      return;
    }
  })

  /* .text("Import Safe Wallet", async (ctx) => {
    await ctx.conversation.enter("ask_for_input_for_safeimport");
  })
  */
  .submenu("Manage Safe", "my-safe-identifier")
  .row()

  .text("Help", (ctx) => ctx.replyFmt("help"))
  .submenu("⚙️ Settings", "my-settings-identifier");

const refresh_menu = new Menu("my-refresh-menu-identifier")
  .text(
    "Fund Safe wallet",
    (ctx) => {
      console.log("test");
      /*
    ctx.replyFmt(
      fmt`${fmt`Click the address to copy it.`}
${bold(
  fmt`▰ ${link(
    "Wallet",
    NETWORK_SCAN_ADDRESS + ctx.session.generated_wallet_address
  )} ▰ `
)}
${code(ctx.session.generated_wallet_address)}
${fmt`Send ethereum to this address to pay for gas`}
      `*/ //,
    },
    { disable_web_page_preview: true }
  )
  .row()
  .text("Transfer Safe Eth ", async (ctx) => {})
  .text("Transfer Safe Token ", async (ctx) => {})
  .row()
  .text("Help", (ctx) => ctx.replyFmt("help"));
// .submenu("⚙️ Settings", "my-settings-identifier");
bot.use(refresh_menu);

async function ask_for_input_for_safeimport(conversation, ctx) {
  ctx.replyFmt(fmt`Please input the address of the safe account`);
  // TODO: code the conversation
  const { message } = await conversation.waitFor("message:text");
  console.log(message?.text);
  if (message?.text === "/cancel") {
    await ctx.replyFmt(fmt`Cancelled conversation`);
    return;
  }
  if (!/^0x[a-fA-F0-9]{40}$/gm.test(message?.text))
    return ctx.replyFmt(fmt`Invalid Address format`);
  const verify = await ctx.replyFmt(
    fmt`Please wait while we verify..., This process will take ~ 5minutes`
  );
  try {
    console.log("started the stuff");
    const ImportSafeWallet = await importSafeWallet(
      ctx.session.generated_wallet_mnemonic,
      message.text
    );
    console.log();
    verify.editText(`Successfully Imported: ${message.text}`);
    ctx.session.safe_wallet = message?.text;
    ctx.session.has_safe_wallet = true;
    console.log(ctx.session.safe_wallet, "bool check 320");
    console.log(ctx.session.has_safe_wallet, "bool check 321");
    // Menu_refresh(ctx);
    return;
  } catch (e) {
    console.log(e);
    console.log(e.Error);
    if (e === 701) {
      verify.editText("Cannot import. Invalid address.");
      return;
    }
    if (e === 702) {
      verify.editText("Cannot import. This safe does not belong to this user.");
      return;
    }
    if (e === 704) {
      verify.editText("Cannot import. Safe does not exist on this network.");
      return;
    }
    return;
  }
}

bot.use(createConversation(ask_for_input_for_safeimport));

const settings_menu = new Menu("my-settings-identifier")
  .back("⬅ Menu")
  .text("Close", (ctx) => {
    ctx.replyFmt(
      fmt`${bold(fmt`═══ Your Wallets ═══`)}
${bold(
  fmt`▰ ${link(
    "Wallet",
    NETWORK_SCAN_ADDRESS + ctx.session.generated_wallet_address
  )} ▰`
)}
${code(ctx.session.generated_wallet_address)}
      `,
      {
        reply_markup: intro_menu,
        disable_web_page_preview: true,
      }
    );
    ctx.deleteMessage();
  })
  .row()
  .text("Transfer Eth", async (ctx) => {
    await ctx.conversation.enter("ask_for_reciever_amount_input");
  })
  .text("Transfer Token ", (ctx) => ctx.replyFmt("transfer_tokens"))
  .row()
  .text("Import Safe Wallet", async (ctx) => {
    await ctx.conversation.enter("ask_for_input_for_safeimport");
  })
  .row()
  .text("View Mnemonic", (ctx) =>
    ctx.replyFmt(
      fmt`${bold("Keep your mnemonic safe and do not share it with anyone.")}
${spoiler(ctx.session.generated_wallet_mnemonic)}
`
    )
  )
  .text("Regenerate Account", (ctx) => ctx.replyFmt("regenerate_account"));

const safe_menu = new Menu("my-safe-identifier")
  .back("⬅ Menu")
  .row()
  .text("Fund safe wallet ETH", async (ctx) => {})
  .row()
  .text("Transfer Safe Eth", async (ctx) => {
    if (!ctx.session.has_safe_wallet) {
      ctx.replyFmt("User currently have no Created or Imported Safe");
      return;
    }
    await ctx.conversation.enter("ask_for_safe_transfer_eth_input");
    try {
      //  const sendingEth = sendUserEth();
    } catch (error) {}
  })
  .text("Transfer Safe Token ", async (ctx) => {
    if (!ctx.session.has_safe_wallet)
      ctx.replyFmt("User currently have no Created or Imported Safe");
    ctx.replyFmt("transfer_tokens");
  })
  .row()
  .text("Import Safe Wallet", async (ctx) => {
    await ctx.conversation.enter("ask_for_input_for_safeimport");
  });
/*
  .text("Close", (ctx) => {
    ctx.replyFmt(
      fmt`${bold(fmt`═══ Your Wallets ═══`)}
${bold(
  fmt`▰ ${link(
    "Wallet",
    NETWORK_SCAN_ADDRESS + ctx.session.generated_wallet_address
  )} ▰`
)}
${code(ctx.session.generated_wallet_address)}
      `,
      {
        reply_markup: intro_menu,
        disable_web_page_preview: true,
      }
    );
    ctx.deleteMessage();
  })
*/

/*
  .text("View Mnemonic", (ctx) =>
    ctx.replyFmt(
      fmt`${bold("Keep your mnemonic safe and do not share it with anyone.")}
${spoiler(ctx.session.generated_wallet_mnemonic)}
`
    )
  )
  .text("Regenerate Account", (ctx) => ctx.replyFmt("regenerate_account"));
*/
bot.use(intro_menu);
intro_menu.register(safe_menu);
intro_menu.register(settings_menu);

// Handle the /start command.
bot.command("start", (ctx) => {
  Start(ctx);
});
bot.command("start", (ctx) => {
  Start(ctx);
});

bot.command("help", (ctx) => ctx.replyFmt("hello, you need help"));

// Handle other messages.
bot.on("message", (ctx) => {
  ctx.replyFmt("Got another message!");
});

bot.use(refresh_menu);

const Menu_refresh = (ctx) => {
  ctx.replyFmt(
    fmt`${
      !ctx.session.existing_chat
        ? fmt`Welcome to safebot.
You are now registered and have been assigned a new wallet.
Create or Import a safe wallet to transact safely on the blockchian with OTP authentication.`
        : ""
    }

${bold(fmt`═══ Your Wallets ═══`)}
${bold(
  fmt`▰ ${link(
    "Wallet",
    NETWORK_SCAN_ADDRESS + ctx.session.generated_wallet_address
  )} ▰ `
)}
${code(ctx.session.generated_wallet_address)}

${
  ctx.session.has_safe_wallet
    ? fmt`${bold(fmt`═══ Safe Wallet ═══`)}
${bold(
  fmt`▰ ${link("Wallet", NETWORK_SCAN_ADDRESS + ctx.session.safe_wallet)} ▰ `
)}
${code(ctx.session.safe_wallet)}`
    : ""
}

`,
    { reply_markup: refresh_menu, disable_web_page_preview: true }
  );
  ctx.session.existing_chat = true;
};

const Start = (ctx) => {
  /* will comment out when ready for testing 
  if (!ctx.session.existing_chat) {
    const user_wallet = createRandomWallet();
    ctx.session.generated_wallet_mnemonic = user_wallet.mnemonic.phrase;
    ctx.session.generated_wallet_address = user_wallet.address;
    console.log(user_wallet);
  }
  */

  console.log("bool for safe wallet", ctx.session.has_safe_wallet);
  console.log("bool for safe wallet 504", ctx.session.safe_wallet);
  ctx.replyFmt(
    fmt`${
      !ctx.session.existing_chat
        ? fmt`Welcome to safebot.
You are now registered and have been assigned a new wallet.
Create or Import a safe wallet to transact safely on the blockchian with OTP authentication.`
        : ""
    }

${bold(fmt`═══ Your Wallets ═══`)}
${bold(
  fmt`▰ ${link(
    "Wallet ↗",
    NETWORK_SCAN_ADDRESS + ctx.session.generated_wallet_address
  )} ▰ `
)}
${code(ctx.session.generated_wallet_address)}
${
  ctx.session.has_safe_wallet
    ? fmt`${bold(fmt`═══ Safe Wallet ═══`)}
${bold(
  fmt`▰ ${link("Wallet", NETWORK_SCAN_ADDRESS + ctx.session.safe_wallet)} ▰ `
)}
${code(ctx.session.safe_wallet)}`
    : ""
}`,
    { reply_markup: intro_menu, disable_web_page_preview: true }
  );
  ctx.session.existing_chat = true;
};

bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`Error while handling update ${ctx.update.update_id}:`);
  const e = err.error;
  if (e instanceof GrammyError) {
    console.error("Error in request:", e.description);
  } else if (e instanceof HttpError) {
    console.error("Could not contact Telegram:", e);
  } else {
    console.error("Unknown error:", e);
  }
});
bot.start();
//run(bot);
