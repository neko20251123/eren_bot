// ==============================
// DNS対策（VPS安定用）
// ==============================
const dns = require("node:dns");
dns.setDefaultResultOrder("ipv4first");

// ==============================
// 初期設定
// ==============================
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
} = require("discord.js");

const store = require("./store"); // getIntro/saveIntro がある想定

const INTRO_CHANNEL_ID = process.env.INTRO_CHANNEL_ID;

// ephemeral (v14.14+ は flags 推奨)
const EPHEMERAL = { flags: 64 };

// listで本文を出す時の安全策（長文対策）
const LIST_INTRO_MAX = 160; // 好きに調整（120〜200くらいが無難）

// ==============================
// Client
// ==============================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// ==============================
// 表示名ユーティリティ
// ==============================
function displayNameOf(member) {
  return (
    member?.displayName ||
    member?.user?.globalName ||
    member?.user?.username ||
    "unknown"
  );
}

function shorten(text, max) {
  if (!text) return "";
  const t = String(text).trim();
  if (t.length <= max) return t;
  return t.slice(0, max) + "…";
}

// VCにいるか
function getCallerVoiceChannel(interaction) {
  return interaction.member?.voice?.channel ?? null;
}

// ==============================
// 起動確認
// ==============================
client.once("ready", () => {
  console.log("=================================");
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🧠 INTRO_CHANNEL_ID: ${INTRO_CHANNEL_ID}`);
  console.log("=================================");
});

// ==============================
// 自己紹介チャンネルの投稿を保存
// ==============================
client.on("messageCreate", async (msg) => {
  try {
    if (msg.author.bot) return;
    if (!INTRO_CHANNEL_ID) return;
    if (msg.channelId !== INTRO_CHANNEL_ID) return;

    if (typeof store.saveIntro === "function") {
      await store.saveIntro(msg.author.id, msg.content);
    }
  } catch (e) {
    console.error("messageCreate(save intro) error:", e);
  }
});

// ==============================
// /eren コマンド処理
// ==============================
client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "eren") return;

    const sub = interaction.options.getSubcommand();
    const vc = getCallerVoiceChannel(interaction);

    if (!vc) {
      return interaction.reply({
        content:
          "⚠️ まずボイスチャンネルに参加してから使ってくれ。\n\n" +
          "🛈 この表示はあなただけに見えます",
        ...EPHEMERAL,
      });
    }

    // VCメンバー（bot除外）
    const members = [...vc.members.values()].filter((m) => !m.user.bot);

    // /eren list
    if (sub === "list") {
      if (members.length === 0) {
        return interaction.reply({
          content:
            "⚠️ このVCにはユーザーがいないみたいだ。\n\n" +
            "🛈 この表示はあなただけに見えます",
          ...EPHEMERAL,
        });
      }

      const blocks = members.map((m) => {
        const name = displayNameOf(m);
        const intro = store.getIntro?.(m.id);

        if (!intro) {
          return `👤 ${name}\n→ 自己紹介未登録`;
        }

        // listで全部貼ると荒れるので短縮
        const short = shorten(intro, LIST_INTRO_MAX);

        return `👤 ${name}\n→ ${short}`;
      });

      return interaction.reply({
        content:
          `🟥 エレン\n\n現在このVCにいる者たちだ。\n\n` +
          blocks.join("\n\n") +
          `\n\n🛈 この表示はあなただけに見えます`,
        ...EPHEMERAL,
        allowedMentions: { parse: [] },
      });
    }

    // /eren show
    if (sub === "show") {
      const targetUser = interaction.options.getUser("user", true);

      const targetMember = members.find((m) => m.id === targetUser.id);
      if (!targetMember) {
        return interaction.reply({
          content:
            `⚠️ ${targetUser.username} は今このVCにはいない。\n\n` +
            "🛈 この表示はあなただけに見えます",
          ...EPHEMERAL,
          allowedMentions: { parse: [] },
        });
      }

      const name = displayNameOf(targetMember);
      const intro = store.getIntro?.(targetUser.id);

      if (!intro) {
        return interaction.reply({
          content:
            `🟥 エレン\n\n⚠️ ${name} は自己紹介を登録していません。\n\n` +
            `（自己紹介は <#${INTRO_CHANNEL_ID}> に投稿すると登録される）\n\n` +
            "🛈 この表示はあなただけに見えます",
          ...EPHEMERAL,
          allowedMentions: { parse: [] },
        });
      }

      return interaction.reply({
        content:
          `🟥 エレン\n\n👤 ${name} の自己紹介\n\n` +
          intro +
          `\n\n🛈 この表示はあなただけに見えます`,
        ...EPHEMERAL,
        allowedMentions: { parse: [] },
      });
    }
  } catch (err) {
    console.error("❌ interactionCreate error:", err);

    try {
      if (interaction?.replied || interaction?.deferred) {
        await interaction.followUp({
          content:
            "⚠️ エラーが発生した。ログを見てくれ。\n🛈 この表示はあなただけに見えます",
          ...EPHEMERAL,
        });
      } else {
        await interaction.reply({
          content:
            "⚠️ エラーが発生した。ログを見てくれ。\n🛈 この表示はあなただけに見えます",
          ...EPHEMERAL,
        });
      }
    } catch {}
  }
});

// ==============================
// ログイン
// ==============================
client.login(process.env.DISCORD_TOKEN);