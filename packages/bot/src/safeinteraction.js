import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { ethers } = require("ethers");
const {
  EthersAdapter,
  SafeFactory,
  SafeAccountConfig,
} = require("@safe-global/protocol-kit");
import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";

///state RPC, provider and info for the interactions
/// we will be using goerli for now
// polygon mumbai rpc url = "https://polygon-mumbai.gateway.tenderly.co"
// we will also be using goerli txServiceUrl
const RPC_URL = "https://ethereum-goerli.publicnode.com";
const txServiceUrl = "https://safe-transaction-goerli.safe.global";
const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
const { TEST_PRIVATE_KEY } = process.env;
const createRandomWallet = () => {
  const user_details = ethers.Wallet.createRandom();
  return user_details;
};

/// function to create safe wallet
const createSafeWallet = async (generated_wallet_mnemonic) => {
  const _walletMnemonicInstance = ethers.Wallet.fromMnemonic(
    generated_wallet_mnemonic
  );

  //console.log(_walletMnemonicInstance.privateKey);
  const walletMnemonicInstance = new ethers.Wallet(
    _walletMnemonicInstance.privateKey,
    provider
  );
  //const login_user_signer = walletMnemonicInstance.connect(provider);
  const login_user_signer = walletMnemonicInstance;
  //console.log(await login_user_signer.getAddress());
  const safeAccountConfig = {
    owners: [await login_user_signer.getAddress()],
    threshold: 1,
  };
  const ethAdapterSafeWalletCreation = new EthersAdapter({
    ethers,
    signerOrProvider: login_user_signer,
  });
  const safeFactory = await SafeFactory.create({
    ethAdapter: ethAdapterSafeWalletCreation,
  });
  /* const txOptions = {
    gas: 2100000,
    gasPrice: 8000000000,
  }; */
  //const txOptions = { gasLimit: 2100000 };
  const txOptions = {
    gasLimit: ethers.utils.hexlify(21000000),
    gasPrice: ethers.utils.parseUnits("15", "gwei"),
  };
  const timestamp = (await provider.getBlock("latest")).timestamp;

  //console.log(timestamp);
  const user_safe_account = await safeFactory.deploySafe({
    safeAccountConfig,
    saltNonce: timestamp,
  });

  const safeAddress = await user_safe_account.getAddress();

  //console.log("Your Safe has been deployed:");
  //console.log(`https://goerli.etherscan.io/address/${safeAddress}`);
  //console.log(`https://app.safe.global/gor:${safeAddress}`);

  return safeAddress;
};

/// function to create safe wallet
/* Erorr codes
 * 701 - input (safe) address does not match a valid eth address
 * 702 - input (safe) address does not belong/no valid signer to the user
 * 703 - amount is not valid input
 * 704 - input safe address is not a safe on that chain
 * 705 - insufficient balance
 */

const importSafeWallet = async (
  generated_wallet_mnemonic,
  safe_wallet_address
) => {
  const walletMnemonicInstance = ethers.Wallet.fromMnemonic(
    generated_wallet_mnemonic
  );
  const login_user_signer = walletMnemonicInstance.connect(provider);
  const ethAdapterSafeWalletCreation = new EthersAdapter({
    ethers,
    signerOrProvider: login_user_signer,
  });
  const userAddress = await login_user_signer.getAddress();
  const safeService = new SafeApiKit.default({
    txServiceUrl: "https://safe-transaction-goerli.safe.global",
    ethAdapter: ethAdapterSafeWalletCreation,
  });
  //console.log("started the stuff 1");
  if (/^0x[a-fA-F0-9]{40}$/gm.test(safe_wallet_address.trim())) {
    // check if the address belongs to the user
    //console.log("started the stuff 2");
    var safeInfo;
    try {
      safeInfo = await safeService.getSafeInfo(safe_wallet_address);
    } catch (error) {
      throw 704;
    }
    //console.log(safeInfo);
    //console.log("started the stuff 3");
    //console.log(safeInfo);
    for (var i = 0; safeInfo.owners.length >= i; i++) {
      if (safeInfo.owners[i] === userAddress) {
        //console.log("started the stuff 4");
        //console.log(true);
        return true;
      }
    }
    throw 702;
  } else {
    throw 701;
  }
};

const fundSafeWalletWithEth = async (
  generated_wallet_mnemonic,
  safeWalletAddress,
  amountInEth
) => {
  const _walletMnemonicInstance = ethers.Wallet.fromMnemonic(
    generated_wallet_mnemonic
  );

  //console.log(_walletMnemonicInstance.privateKey);
  const walletMnemonicInstance = new ethers.Wallet(
    _walletMnemonicInstance.privateKey,
    provider
  );
  //const login_user_signer = walletMnemonicInstance.connect(provider);
  const login_user_signer = walletMnemonicInstance;
  //console.log(await login_user_signer.getAddress());

  const safeFundAmount = ethers.utils
    .parseUnits(amountInEth.toString(), "ether")
    .toHexString();

  const transactionParameters = {
    to: safeWalletAddress,
    value: safeFundAmount,
  };
  try {
    const tx = await login_user_signer.sendTransaction(transactionParameters);
    return tx;
  } catch (error) {
    //console.log(error);
  }

  //console.log("Fundraising.");
  //console.log(`Deposit Transaction: https://goerli.etherscan.io/tx/${tx.hash}`);
};

async function create(config) {
  const safeSdk = new Safe.default();
  await safeSdk.init(config);
  return safeSdk;
}

const createSafeTransactionSendETH = async (
  destination,
  amountInEth,
  generated_wallet_mnemonic,
  safe_wallet_address
) => {
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(amountInEth.trim())) throw 703;
  const amount = ethers.utils
    .parseUnits(amountInEth.toString(), "ether")
    .toString();
  const _walletMnemonicInstance = ethers.Wallet.fromMnemonic(
    generated_wallet_mnemonic
  );

  ////console.log(_walletMnemonicInstance.privateKey);
  const walletMnemonicInstance = new ethers.Wallet(
    _walletMnemonicInstance.privateKey,
    provider
  );
  const login_user_signer = walletMnemonicInstance;
  const safeTransactionData = {
    to: destination,
    data: "0x",
    value: amount,
  };

  const Injection = new EthersAdapter({
    ethers,
    signerOrProvider: login_user_signer,
  });
  /*
  let ABI = ["function transfer(address to, uint amount)"];
  let iface = new ethers.utils.Interface(ABI);
  console.log(iface);

  let data = iface.encodeFunctionData("transfer", [
    "0xD43D9bBcC3E7bbc58a11b4b7Cae1Be1d10898dA6",
    parseEther("0.0001"),
  ]);
  console.log(data); */
  // ("0xa9059cbb00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000de0b6b3a7640000");

  const SafeInjection = await create({
    ethAdapter: Injection,
    safeAddress: safe_wallet_address,
  });
  //console.log(safeTransactionData, "injection");
  // Create a Safe transaction with the provided parameters
  console.log("pass");
  const safeTransaction = await SafeInjection.createTransaction({
    safeTransactionData,
  });
  console.log("pass1");

  //console.log("data passed on");
  /*
  const safeTxHash = await SafeInjection.getTransactionHash(safeTransaction);

  const signerSignature = await SafeInjection.signTransactionHash(safeTxHash);
  //console.log(
    safe_wallet_address,
    safeTransaction.data,
    safeTxHash,
    await login_user_signer.getAddress(),
    signerSignature.data,
    "test"
  );
  await safeService.proposeTransaction({
    safe_wallet_address,
    safeTransactionData: safeTransaction.data,
    safeTxHash,
    senderAddress: await login_user_signer.getAddress(),
    senderSignature: signerSignature.data,
  });

  const safeTransactionTx = await safeService.getTransaction(safeTxHash);
  */
  const executeTxResponse = await SafeInjection.executeTransaction(
    safeTransaction
  );
  const receipt = await executeTxResponse.transactionResponse?.wait();

  console.log("Transaction executed:");
  console.log(`https://goerli.etherscan.io/tx/${receipt.transactionHash}`);
  /*
   */
  return receipt.transactionHash;
};

const createSafeTransactionSendETH1 = async (
  destination,
  amountInEth,
  generated_wallet_mnemonic,
  safe_wallet_address
) => {
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(amountInEth.trim())) throw 703;
  const amount = ethers.utils
    .parseUnits(amountInEth.toString(), "ether")
    .toString();
  const _walletMnemonicInstance = ethers.Wallet.fromMnemonic(
    generated_wallet_mnemonic
  );

  ////console.log(_walletMnemonicInstance.privateKey);
  const walletMnemonicInstance = new ethers.Wallet(
    _walletMnemonicInstance.privateKey,
    provider
  );
  const login_user_signer = walletMnemonicInstance;
  const safeTransactionData = {
    to: destination,
    data: "0x",
    value: amount,
  };

  const Injection = new EthersAdapter({
    ethers,
    signerOrProvider: login_user_signer,
  });
  /*
  let ABI = ["function transfer(address to, uint amount)"];
  let iface = new ethers.utils.Interface(ABI);
  console.log(iface);

  let data = iface.encodeFunctionData("transfer", [
    "0xD43D9bBcC3E7bbc58a11b4b7Cae1Be1d10898dA6",
    parseEther("0.0001"),
  ]);
  console.log(data); */
  const safeTransactionData1 = {
    to: "0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6",
    data: "0x6cb927d8000000000000000000000000d43d9bbcc3e7bbc58a11b4b7cae1be1d10898da6000000000000000000000000000000000000000000000000000000e8d4a51000", //"0xa9059cbb000000000000000000000000d43d9bbcc3e7bbc58a11b4b7cae1be1d10898da6000000000000000000000000000000000000000000000000000000e8d4a51000",
    value: "0.001",
  };

  // ("0xa9059cbb00000000000000000000000012345678901234567890123456789012345678900000000000000000000000000000000000000000000000000de0b6b3a7640000");
  console.log(safeTransactionData1);

  const SafeInjection = await create({
    ethAdapter: Injection,
    safeAddress: safe_wallet_address,
  });
  //console.log(safeTransactionData, "injection");
  // Create a Safe transaction with the provided parameters
  console.log("pass");

  const safeTransaction1 = await SafeInjection.createTransaction({
    safeTransactionData1,
  });
  console.log("pass3");
  const executeTxResponse1 = await SafeInjection.executeTransaction(
    safeTransaction1
  );
  console.log("pass4");
  const receipt1 = await executeTxResponse1.transactionResponse?.wait();

  console.log("Transaction executed:");
  console.log(`https://goerli.etherscan.io/tx/${receipt1.transactionHash}`);
  /*
   */
  return "lol";
};

/*
exports.safeinteractions = {
  createSafeWallet,
  createRandomWallet,
  fundSafeWalletWithEth,
  createSafeTransactionETH,
};
*/
/*
exports.createRandomWallet = createRandomWallet;
exports.createSafeWallet = createSafeWallet;
exports.importSafeWallet = importSafeWallet;
exports.fundSafeWalletWithEth = fundSafeWalletWithEth;
exports.createSafeTransactionETH = createSafeTransactionETH;
*/

const sendUserEth = async (
  destination,
  amountInEth,
  generated_wallet_mnemonic
) => {
  if (!/^(0|[1-9]\d*)(\.\d+)?$/.test(amountInEth.trim())) throw 701;
  if (!/^0x[a-fA-F0-9]{40}$/gm.test(destination.trim())) throw 703;

  const _walletMnemonicInstance = ethers.Wallet.fromMnemonic(
    generated_wallet_mnemonic
  );

  ////console.log(_walletMnemonicInstance.privateKey);
  const walletMnemonicInstance = new ethers.Wallet(
    _walletMnemonicInstance.privateKey,
    provider
  );

  // Create a transaction object
  let tx = {
    to: destination,
    // Convert currency unit from ether to wei
    value: ethers.utils.parseEther(amountInEth),
  };
  const balance = await userEthBalance(generated_wallet_mnemonic);
  console.log(balance);
  if (amountInEth >= balance) throw 705;

  // Send a transaction
  return walletMnemonicInstance.sendTransaction(tx).then((txObj) => {
    //console.log("txHash", txObj.hash);
    return txObj.hash;
  });
};

const userEthBalance = async (generated_wallet_mnemonic) => {
  const _walletMnemonicInstance = ethers.Wallet.fromMnemonic(
    generated_wallet_mnemonic
  );

  ////console.log(_walletMnemonicInstance.privateKey);
  const walletMnemonicInstance = new ethers.Wallet(
    _walletMnemonicInstance.privateKey,
    provider
  );
  try {
    //console.log("mnemonic");
    return provider
      .getBalance(
        await walletMnemonicInstance.getAddress(),
        await provider.getBlock("latest").timestamp
      )
      .then((balance) => {
        //console.log(balance.toString() / 10 ** 18);
        return balance.toString() / Math.pow(10, 18);
      });
  } catch (error) {
    //console.log(error);
  }
};
const safeEthBalance = async (safe_wallet_address) => {
  if (!/^0x[a-fA-F0-9]{40}$/gm.test(safe_wallet_address.trim())) throw 703;
  try {
    //console.log("address");
    return provider
      .getBalance(
        safe_wallet_address,
        await provider.getBlock("latest").timestamp
      )
      .then((balance) => {
        //console.log(balance.toString() / 10 ** 18);
        return balance.toString() / Math.pow(10, 18);
      });
  } catch (error) {
    //console.log(error);
  }
};
export {
  createRandomWallet,
  createSafeWallet,
  importSafeWallet,
  fundSafeWalletWithEth,
  createSafeTransactionSendETH,
  sendUserEth,
  userEthBalance,
  safeEthBalance,
};
