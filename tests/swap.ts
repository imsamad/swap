import { randomBytes } from "node:crypto";

import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { Swap } from "../target/types/swap";
import {
  TOKEN_2022_PROGRAM_ID,
  type TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { assert } from "chai";
import {
  confirmTransaction,
  createAccountsMintsAndTokenAccounts,
  makeKeypairs,
} from "@solana-developers/helpers";

const TOKEN_PROGRAM: typeof TOKEN_2022_PROGRAM_ID | typeof TOKEN_PROGRAM_ID =
  TOKEN_2022_PROGRAM_ID;

const SECONDS = 1000;

const ANCHOR_SLOW_TEST_THRESHOLDS = 40 & SECONDS;

const gentRandomBigNumber = (size = 8) => new BN(randomBytes(size));

describe("swap", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const user = (provider.wallet as anchor.Wallet).payer;
  const payer = user;

  const connection = provider.connection;
  const program = anchor.workspace.Swap as Program<Swap>;

  const accounts: Record<string, PublicKey> = {
    tokenProgram: TOKEN_PROGRAM,
  };

  let alice: anchor.web3.Keypair;
  let bob: anchor.web3.Keypair;

  let tokenMintA: anchor.web3.Keypair;

  let tokenMintB: anchor.web3.Keypair;

  [alice, bob, tokenMintA, tokenMintB] = makeKeypairs(4);

  const tokenAOffersAmount = new BN(1_000_000);
  const tokenBWantedAmount = new BN(1_000_000);

  before(
    "Create Alice and Bob accounts, 2 token mints and associated token accounts for both tokens for both users",
    async () => {
      const usersMintAndTokenAccounts =
        await createAccountsMintsAndTokenAccounts(
          [
            // alice token balances
            // two tokens balances
            [1_000_000_000, 0],
            // bob token balances
            // two tokens balances
            [0, 1_000_000_000],
          ],
          1 * LAMPORTS_PER_SOL,
          connection,
          payer
        );

      alice = usersMintAndTokenAccounts.users[0];
      bob = usersMintAndTokenAccounts.users[1];

      tokenMintA = usersMintAndTokenAccounts.mints[0];
      tokenMintB = usersMintAndTokenAccounts.mints[1];

      const aliceTokenAccountA = usersMintAndTokenAccounts.tokenAccounts[0][0];
      const aliceTokenAccountB = usersMintAndTokenAccounts.tokenAccounts[0][1];

      const bobTokenAccountA = usersMintAndTokenAccounts.tokenAccounts[1][0];
      const bobTokenAccountB = usersMintAndTokenAccounts.tokenAccounts[1][1];

      accounts.maker = alice.publicKey;
      accounts.taker = bob.publicKey;
      accounts.tokenMintA = tokenMintA.publicKey;
      accounts.makerTokenAccountA = aliceTokenAccountA;
      accounts.takerTokenAccountA = bobTokenAccountA;
      accounts.tokenMintB = tokenMintB.publicKey;
      accounts.makerTokenAccountB = aliceTokenAccountB;
      accounts.takerTokenAccountB = bobTokenAccountB;
    }
  );

  it("Put Alice offers into the vault!", async () => {
    const offerId = gentRandomBigNumber();
    const offer = PublicKey.findProgramAddressSync(
      [
        Buffer.from("offer"),
        accounts.maker.toBuffer(),
        offerId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];

    const vault = await getAssociatedTokenAddress(
      accounts.tokenMintA,
      offer,
      true,
      TOKEN_PROGRAM
    );

    accounts.offer = offer;
    accounts.vault = vault;

    const transactionSignature = await program.methods
      .makeOffer(offerId, tokenAOffersAmount, tokenBWantedAmount)
      .accounts(accounts)
      .signers([alice])
      .rpc();

    await confirmTransaction(connection, transactionSignature);
    console.log("transactionSignature: ", transactionSignature);
    const vaultBalanceResponse = await connection.getTokenAccountBalance(vault);

    const vaultBalance = new BN(vaultBalanceResponse.value.amount);
    assert(vaultBalance.eq(tokenAOffersAmount));

    const offerAccount = await program.account.offer.fetch(offer);

    assert(offerAccount.maker.equals(alice.publicKey));
    assert(offerAccount.tokenMintA.equals(accounts.tokenMintA));
    assert(offerAccount.tokenMintB.equals(accounts.tokenMintB));
    assert(offerAccount.tokenBWantedAmount.eq(tokenBWantedAmount));
  }).slow(ANCHOR_SLOW_TEST_THRESHOLDS);
});
