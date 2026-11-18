const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    AttachmentBuilder
} = require("discord.js");

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Configuration
const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
    throw new Error("Configuration Discord manquante !");
}

// Commandes
const commands = [

    new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Vérifier si Cap'tain Wow fonctionne"),

    new SlashCommandBuilder()
        .setName("salons")
        .setDescription("Afficher les salons du serveur"),

    new SlashCommandBuilder()
        .setName("dire")
        .setDescription("Envoyer un message")
        .addStringOption(option =>
            option.setName("message")
                .setDescription("Message à envoyer")
                .setRequired(true))
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages
        ),

    new SlashCommandBuilder()
        .setName("lien")
        .setDescription("Partager un lien")
        .addStringOption(option =>
            option.setName("url")
                .setDescription("Lien à partager")
                .setRequired(true))
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages
        ),

    new SlashCommandBuilder()
        .setName("fichier")
        .setDescription("Partager un fichier")
        .addAttachmentOption(option =>
            option.setName("fichier")
                .setDescription("Fichier à envoyer")
                .setRequired(true))
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageMessages
        ),

    new SlashCommandBuilder()
        .setName("role")
        .setDescription("Ajouter ou retirer un rôle")
        .addUserOption(option =>
            option.setName("membre")
                .setDescription("Membre concerné")
                .setRequired(true))
        .addRoleOption(option =>
            option.setName("role")
                .setDescription("Rôle concerné")
                .setRequired(true))
        .addStringOption(option =>
            option.setName("action")
                .setDescription("Action à effectuer")
                .setRequired(true)
                .addChoices(
                    { name: "Ajouter", value: "ajouter" },
                    { name: "Retirer", value: "retirer" }
                ))
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageRoles
        )

].map(command => command.toJSON());

// Enregistrement des commandes
const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
    await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: commands }
    );

    console.log("Commandes enregistrées !");
}

// Démarrage
client.once("ready", async () => {
    console.log(`Cap'tain Wow connecté : ${client.user.tag}`);

    try {
        await registerCommands();
    } catch (error) {
        console.error("Erreur commandes :", error);
    }
});

// Gestion des commandes
client.on("interactionCreate", async interaction => {

    if (!interaction.isChatInputCommand()) return;
    if (!interaction.guild) return;

    const { commandName } = interaction;

    try {

        // PING
        if (commandName === "ping") {
            return interaction.reply({
                content: `🏴‍☠️ Cap'tain Wow est en ligne ! Latence : ${client.ws.ping} ms`,
                ephemeral: true
            });
        }

        // SALONS
        if (commandName === "salons") {
            const channels = interaction.guild.channels.cache
                .filter(channel =>
                    channel.type === ChannelType.GuildText ||
                    channel.type === ChannelType.GuildVoice
                );

            const list = channels.map(channel =>
                `${channel.type === ChannelType.GuildText ? "💬" : "🔊"} ${channel.name}`
            );

            return interaction.reply({
                content: list.length
                    ? `📂 **Salons du serveur :**\n${list.join("\n")}`
                    : "Aucun salon visible.",
                ephemeral: true
            });
        }

        // DIRE
        if (commandName === "dire") {
            const message = interaction.options.getString("message");
            const channel = interaction.channel;

            if (!channel || !channel.isTextBased()) {
                return interaction.reply({
                    content: "Impossible d'envoyer un message ici.",
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            await channel.send({
                content: message,
                allowedMentions: { parse: [] }
            });

            return interaction.editReply("✅ Message envoyé !");
        }

        // LIEN
        if (commandName === "lien") {
            const url = interaction.options.getString("url");

            let parsedUrl;

            try {
                parsedUrl = new URL(url);
            } catch {
                return interaction.reply({
                    content: "❌ Adresse invalide.",
                    ephemeral: true
                });
            }

            if (!["https:", "http:"].includes(parsedUrl.protocol)) {
                return interaction.reply({
                    content: "❌ Seuls les liens HTTP et HTTPS sont acceptés.",
                    ephemeral: true
                });
            }

            await interaction.channel.send({
                content: url,
                allowedMentions: { parse: [] }
            });

            return interaction.reply({
                content: "🔗 Lien envoyé !",
                ephemeral: true
            });
        }

        // FICHIER
        if (commandName === "fichier") {
            const file = interaction.options.getAttachment("fichier");

            if (file.size > 8 * 1024 * 1024) {
                return interaction.reply({
                    content: "❌ Fichier trop volumineux (maximum 8 Mo).",
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            const response = await fetch(file.url);

            if (!response.ok) {
                return interaction.editReply("❌ Impossible de récupérer le fichier.");
            }

            const buffer = Buffer.from(await response.arrayBuffer());

            const attachment = new AttachmentBuilder(buffer, {
                name: file.name
            });

            await interaction.channel.send({
                files: [attachment]
            });

            return interaction.editReply("📎 Fichier envoyé !");
        }

        // ROLES
        if (commandName === "role") {
            const user = interaction.options.getUser("membre");
            const role = interaction.options.getRole("role");
            const action = interaction.options.getString("action");

            const member = await interaction.guild.members.fetch(user.id);

            if (role.id === interaction.guild.id || !role.editable) {
                return interaction.reply({
                    content: "❌ Je ne peux pas gérer ce rôle. Vérifie ma hiérarchie de rôles.",
                    ephemeral: true
                });
            }

            if (action === "ajouter") {
                await member.roles.add(role);
                return interaction.reply({
                    content: `✅ Rôle ${role.name} ajouté à ${user.username}.`
                });
            }

            if (action === "retirer") {
                await member.roles.remove(role);
                return interaction.reply({
                    content: `✅ Rôle ${role.name} retiré à ${user.username}.`
                });
            }
        }

    } catch (error) {
        console.error(error);

        const message = "❌ Une erreur est survenue.";

        if (interaction.deferred) {
            await interaction.editReply(message).catch(() => {});
        } else if (interaction.replied) {
            await interaction.followUp({
                content: message,
                ephemeral: true
            }).catch(() => {});
        } else {
            await interaction.reply({
                content: message,
                ephemeral: true
            }).catch(() => {});
        }
    }
});

// Connexion
client.login(TOKEN);