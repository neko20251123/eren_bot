// ==============================
// DNS対策（VPS安定用）
// ==============================
const dns = require("node:dns");
dns.setDefaultResultOrder("ipv4first");

// ==============================
// 初期設定
// ==============================
require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");
const store = require("./store");

const INTRO_CHANNEL_ID = process.env.INTRO_CHANNEL_ID;

// ephemeral (discord.js v14系)
const EPHEMERAL = { flags: 64 };

// listで本文を出す時の安全策（長文対策）
const LIST_INTRO_MAX = 160; // 120〜200くらいが無難

// Discordの1メッセージ制限は2000字。余裕を見て
const DISCORD_LIMIT = 1900;

// ==============================
// Client
// ==============================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,

    // introチャンネルの投稿を読む（保存用）
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,

    // VCメンバー取得
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// ==============================
// ユーティリティ
// ==============================
function displayNameOf(member) {
  // ✅ サーバーニックネーム（＝プレイヤー名扱い）優先
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

// 長文を分割してephemeralで返す（followUpで送る）
async function replyChunkedEphemeral(interaction, content) {
  const chunks = [];
  let buf = "";

  for (const line of String(content).split("\n")) {
    // +1 は改行
    if ((buf + line + "\n").length > DISCORD_LIMIT) {
      chunks.push(buf);
      buf = "";
    }
    buf += line + "\n";
  }
  if (buf.trim().length) chunks.push(buf);

  // 1通目
  await interaction.reply({
    content: chunks[0] ?? "（空）",
    ...EPHEMERAL,
    allowedMentions: { parse: [] },
  });

  // 2通目以降
  for (let i = 1; i < chunks.length; i++) {
    await interaction.followUp({
      content: chunks[i],
      ...EPHEMERAL,
      allowedMentions: { parse: [] },
    });
  }
}

// ==============================
// 起動確認
// ==============================
client.once("ready", () => {
  console.log("=================================");
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🧠 INTRO_CHANNEL_ID: ${INTRO_CHANNEL_ID}`);
  console.log(`📦 data.json users: ${store.count?.() ?? "?"}`);
  console.log("=================================");
});

// ==============================
// 自己紹介チャンネルの投稿を保存
// - introチャンネルに「最新で投稿した内容」をその人の自己紹介として保存
// - 編集にも追従（messageUpdate）
// ==============================
client.on("messageCreate", async (msg) => {
  try {
    if (msg.author.bot) return;
    if (!INTRO_CHANNEL_ID) return;
    if (msg.channelId !== INTRO_CHANNEL_ID) return;

    await store.saveIntro(msg.author.id, msg.content);
  } catch (e) {
    console.error("messageCreate(save intro) error:", e);
  }
});

client.on("messageUpdate", async (_oldMsg, newMsg) => {
  try {
    if (!newMsg) return;
    if (newMsg.author?.bot) return;
    if (!INTRO_CHANNEL_ID) return;
    if (newMsg.channelId !== INTRO_CHANNEL_ID) return;

    // newMsg.content が空のケース対策
    const content = newMsg.content ?? "";
    await store.saveIntro(newMsg.author.id, content);
  } catch (e) {
    console.error("messageUpdate(save intro) error:", e);
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
          "🛈 この表示はあなただけに見えます（ログには残りません）",
        ...EPHEMERAL,
      });
    }

    // VCメンバー（bot除外）
    const members = [...vc.members.values()].filter((m) => !m.user.bot);

    // ------------------------------
    // /eren list
    // ------------------------------
    if (sub === "list") {
      if (members.length === 0) {
        return interaction.reply({
          content:
            "⚠️ このVCにはユーザーがいないみたいだ。\n\n" +
            "🛈 この表示はあなただけに見えます（ログには残りません）",
          ...EPHEMERAL,
        });
      }

      const blocks = members.map((m) => {
        const name = displayNameOf(m);
        const intro = store.getIntro(m.id);

        if (!intro) return `👤 ${name}\n→ 自己紹介未登録`;

        // ✅ listでも「自己紹介を展開」する（ただし長文は短縮）
        const short = shorten(intro, LIST_INTRO_MAX);
        return `👤 ${name}\n→ ${short}`;
      });

      const text =
        `🟥 エレン\n\n` +
        `現在このVCにいる者たちだ。\n\n` +
        blocks.join("\n\n") +
        `\n\n🛈 この表示はあなただけに見えます（ログには残りません）`;

      // 長文なら分割
      return replyChunkedEphemeral(interaction, text);
    }

    // ------------------------------
    // /eren show target:@user
    // ------------------------------
    if (sub === "show") {
      // ✅ register-commands.js と同じ "target"
      const targetUser = interaction.options.getUser("target", true);

      const targetMember = members.find((m) => m.id === targetUser.id);
      if (!targetMember) {
        return interaction.reply({
          content:
            `⚠️ ${targetUser.username} は今このVCにはいない。\n\n` +
            "🛈 この表示はあなただけに見えます（ログには残りません）",
          ...EPHEMERAL,
          allowedMentions: { parse: [] },
        });
      }

      const name = displayNameOf(targetMember);
      const intro = store.getIntro(targetUser.id);

      if (!intro) {
        return interaction.reply({
          content:
            `🟥 エレン\n\n` +
            `⚠️ ${name} は自己紹介を登録していません。\n\n` +
            `（自己紹介は <#${INTRO_CHANNEL_ID}> に投稿 or 編集すると登録される）\n\n` +
            "🛈 この表示はあなただけに見えます（ログには残りません）",
          ...EPHEMERAL,
          allowedMentions: { parse: [] },
        });
      }

      const text =
        `🟥 エレン\n\n` +
        `👤 ${name} の自己紹介\n\n` +
        intro +
        `\n\n🛈 この表示はあなただけに見えます（ログには残りません）`;

      return replyChunkedEphemeral(interaction, text);
    }
  } catch (err) {
    console.error("❌ interactionCreate error:", err);

    try {
      const payload = {
        content:
          "⚠️ エラーが発生した。ログを見てくれ。\n" +
          "🛈 この表示はあなただけに見えます（ログには残りません）",
        ...EPHEMERAL,
      };

      if (interaction?.replied || interaction?.deferred) {
        await interaction.followUp(payload);
      } else {
        await interaction.reply(payload);
      }
    } catch {}
  }
});

// ==============================
// ログイン
// ==============================
client.login(process.env.DISCORD_TOKEN);