require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const commands = [
  new SlashCommandBuilder()
    .setName("eren")
    .setDescription("エレンの自己紹介システム")
    .addSubcommand(sub =>
      sub
        .setName("list")
        .setDescription("同じVCにいるメンバーの自己紹介を一覧表示します（表示は本人のみ・ログには残りません）")
    )
    .addSubcommand(sub =>
      sub
        .setName("show")
        .setDescription("指定ユーザーの自己紹介を表示します（表示は本人のみ・ログには残りません）")
        .addUserOption(option =>
          option
            .setName("target")
            .setDescription("表示したいユーザー")
            .setRequired(true)
        )
    )
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("⏳ コマンド登録中...");
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );
    console.log("✅ コマンド登録完了");
  } catch (error) {
    console.error("❌ コマンド登録失敗:", error);
  }
})();