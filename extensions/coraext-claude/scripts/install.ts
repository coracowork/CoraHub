import { $ } from "bun";
import { mkdirSync, symlinkSync, existsSync } from "fs";
import { join } from "path";

const dir = process.env.CORA_COWORK_AGENT_INSTALL_DIR;
if (!dir) {
  console.error("[install] CORA_COWORK_AGENT_INSTALL_DIR is not set");
  process.exit(1);
}

const PKGS = ["@anthropic-ai/claude-code", "@agentclientprotocol/claude-agent-acp"];

const registries: { name: string; url: string }[] = [
  { name: "npm 官方源", url: "https://registry.npmjs.org" },
  { name: "华为开源镜像站", url: "https://repo.huaweicloud.com/repository/npm/" },
  { name: "腾讯云镜像源", url: "https://mirrors.cloud.tencent.com/npm/" },
  { name: "淘宝镜像源", url: "https://registry.npmmirror.com" },
];

let installed = false;

for (const reg of registries) {
  console.log(`[install] 尝试 ${reg.name} (${reg.url}) ...`);
  try {
    await $`bun install --cwd ${dir} ${PKGS[0]} ${PKGS[1]} --registry=${reg.url}`.quiet();
    console.log(`[install] 通过 ${reg.name} 安装成功`);
    installed = true;
    break;
  } catch {
    console.warn(`[install] ${reg.name} 安装失败，尝试下一个源...`);
  }
}

if (!installed) {
  console.error("[install] 所有源均安装失败，请检查网络连接后重试");
  process.exit(1);
}

const binDir = join(dir, "bin");
mkdirSync(binDir, { recursive: true });
const link = join(binDir, "claude");
if (!existsSync(link)) {
  symlinkSync(join(dir, "node_modules", ".bin", "claude-agent-acp"), link);
}
