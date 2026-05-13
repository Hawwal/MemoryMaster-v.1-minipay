import { ethers } from "ethers";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  const USDT_CELO_MAINNET = "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e";
  const ENTRY_FEE = "100000"; // 0.1 USDT (6 decimals)

  const provider = new ethers.JsonRpcProvider("https://forno.celo.org");
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

  console.log("🚀 Deploying updated MemoryMasterEntry to Celo Mainnet...");
  console.log("Deploying with account:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("CELO balance:", ethers.formatEther(balance), "CELO\n");

  const artifactPath = join(
    __dirname,
    "../artifacts/contracts/MemoryMasterEntry.sol/MemoryMasterEntry.json"
  );
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));

  const factory = new ethers.ContractFactory(
    artifact.abi,
    artifact.bytecode,
    wallet
  );

  const contract = await factory.deploy(USDT_CELO_MAINNET, ENTRY_FEE);
  await contract.waitForDeployment();

  const address = await contract.getAddress();

  console.log("✅ New contract deployed to:", address);
  console.log("\n─────────────────────────────────────────");
  console.log("NEXT STEPS:");
  console.log("1. Update your .env:");
  console.log("   VITE_CONTRACT_ADDRESS=" + address);
  console.log("\n2. Verify on CeloScan:");
  console.log(
    `   npx hardhat verify --network celo ${address} "${USDT_CELO_MAINNET}" "${ENTRY_FEE}"`
  );
  console.log("\n3. Submit new address to Talent Protocol");
  console.log("─────────────────────────────────────────");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
