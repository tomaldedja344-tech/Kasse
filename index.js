const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    EmbedBuilder
} = require('discord.js');

require('dotenv').config();

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

// Produkte
const PRODUKTE = {
    "SchniPo": 420,
    "Fleischsalat": 400,
    "Bier": 350,
    "Whisky": 500,
    "Whisky Cola": 500,
    "Cola/Cappuccino": 300
};

// Umsatz
const sales = {};

client.once('ready', async () => {
    console.log(`🤖 Online als ${client.user.tag}`);

    await client.application.commands.set([
        new SlashCommandBuilder()
            .setName('kasse')
            .setDescription('Öffnet Kassen-System'),

        new SlashCommandBuilder()
            .setName('umsatz')
            .setDescription('Zeigt Umsatz')
            .addUserOption(opt =>
                opt.setName('user')
                    .setDescription('User')
                    .setRequired(true)
            )
    ]);

    console.log("✅ Globaler Bot aktiv");
});

client.on('interactionCreate', async (interaction) => {

    // =========================
    // /kasse (GLOBAL)
    // =========================
    if (interaction.isChatInputCommand() && interaction.commandName === "kasse") {

        const produktListe = Object.entries(PRODUKTE)
            .map(([name, price]) => `🛒 ${name} → ${price}€`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle("💰 KASSENSYSTEM")
            .setDescription(produktListe)
            .setColor(0x00ff99);

        const button = new ButtonBuilder()
            .setCustomId("open_kasse")
            .setLabel("🧾 Rechnung erstellen")
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(button);

        await interaction.reply({
            embeds: [embed],
            components: [row]
        });
    }

    // =========================
    // BUTTON
    // =========================
    if (interaction.isButton() && interaction.customId === "open_kasse") {

        const modal = new ModalBuilder()
            .setCustomId("kasse_modal")
            .setTitle("🧾 Rechnung erstellen");

        const input = new TextInputBuilder()
            .setCustomId("items")
            .setLabel("Produkte (jede Zeile: Produkt 3 / x3 / 3x)")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        const rabatt = new TextInputBuilder()
            .setCustomId("rabatt")
            .setLabel("Rabatt % (optional)")
            .setStyle(TextInputStyle.Short)
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder().addComponents(input),
            new ActionRowBuilder().addComponents(rabatt)
        );

        await interaction.showModal(modal);
    }

    // =========================
    // MODAL
    // =========================
    if (interaction.isModalSubmit() && interaction.customId === "kasse_modal") {

        await interaction.deferReply({ ephemeral: true });

        const text = interaction.fields.getTextInputValue("items");
        const rabatt = Number(interaction.fields.getTextInputValue("rabatt")) || 0;

        const items = text.split('\n').map(x => x.trim()).filter(Boolean);

        let total = 0;
        let lines = [];

        for (const item of items) {

            let found = null;
            let qty = null;

            for (const name of Object.keys(PRODUKTE)) {

                const regex = new RegExp(`^${name}\\s*(\\d+|x\\d+|\\d+x)$`, "i");
                const match = item.match(regex);

                if (match) {
                    found = name;
                    qty = parseInt(match[1].replace(/x/i, ""));
                    break;
                }
            }

            if (!found || !qty) {
                return interaction.editReply(`❌ Fehler bei: ${item}`);
            }

            const price = PRODUKTE[found] * qty;
            total += price;

            lines.push(`${found} x${qty} = ${price}€`);
        }

        const final = total - (total * rabatt / 100);

        const userId = interaction.user.id;

        if (!sales[userId]) {
            sales[userId] = {
                name: interaction.user.username,
                total: 0,
                count: 0
            };
        }

        sales[userId].total += final;
        sales[userId].count++;

        const embed = new EmbedBuilder()
            .setTitle("🧾 RECHNUNG")
            .setDescription(lines.join('\n'))
            .addFields(
                { name: "💸 Rabatt", value: `${rabatt}%`, inline: true },
                { name: "💰 Gesamt", value: `${final.toFixed(0)}€`, inline: true }
            )
            .setColor(0xf1c40f);

        await interaction.channel.send({ embeds: [embed] });

        return interaction.editReply("✅ Rechnung erstellt");
    }

    // =========================
    // /UMSATZ
    // =========================
    if (interaction.isChatInputCommand() && interaction.commandName === "umsatz") {

        const user = interaction.options.getUser("user");
        const data = sales[user.id];

        if (!data) {
            return interaction.reply({
                content: "❌ Keine Daten gefunden",
                ephemeral: true
            });
        }

        return interaction.reply(
`📊 Umsatz von ${data.name}

💰 Gesamt: ${data.total.toFixed(0)}€
🧾 Rechnungen: ${data.count}`
        );
    }
});

client.login(process.env.TOKEN);