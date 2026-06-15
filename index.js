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

// Umsatzspeicher
const sales = {};

// Speichert pro Channel die aktive Kasse
const activeKassen = {};

client.once('ready', async () => {
    console.log(`🤖 Online als ${client.user.tag}`);

    await client.application.commands.set([
        new SlashCommandBuilder()
            .setName('kasse')
            .setDescription('Erstellt eine neue Kasse'),

        new SlashCommandBuilder()
            .setName('umsatz')
            .setDescription('Zeigt Umsatz eines Users')
            .addUserOption(opt =>
                opt.setName('user')
                    .setDescription('User auswählen')
                    .setRequired(true)
            )
    ]);

    console.log("✅ Commands geladen");
});

client.on('interactionCreate', async (interaction) => {

    // =========================
    // /kasse
    // =========================
    if (interaction.isChatInputCommand() && interaction.commandName === "kasse") {

        const channel = interaction.channel;

        // Alte Kasse im selben Channel löschen
        if (activeKassen[channel.id]) {
            try {
                const oldMsg = await channel.messages.fetch(activeKassen[channel.id]);
                if (oldMsg) await oldMsg.delete();
            } catch {}
        }

        const produktListe = Object.entries(PRODUKTE)
            .map(([name, price]) => `🛒 ${name} → ${price}€`)
            .join('\n');

        const embed = new EmbedBuilder()
            .setTitle('💰 LOST MC KASSE')
            .setColor(0x00ff99)
            .setDescription(produktListe);

        const button = new ButtonBuilder()
            .setCustomId(`open_kasse_${channel.id}`)
            .setLabel('🧾 Rechnung erstellen')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(button);

        const msg = await channel.send({
            embeds: [embed],
            components: [row]
        });

        activeKassen[channel.id] = msg.id;

        return interaction.reply({
            content: "✅ Kasse erstellt",
            ephemeral: true
        });
    }

    // =========================
    // BUTTON
    // =========================
    if (interaction.isButton() && interaction.customId.startsWith("open_kasse_")) {

        const modal = new ModalBuilder()
            .setCustomId(`kasse_modal_${interaction.channel.id}`)
            .setTitle("🧾 Rechnung erstellen");

        const input = new TextInputBuilder()
            .setCustomId("items")
            .setLabel("Produkte (jede Zeile ein Produkt)")
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

        return interaction.showModal(modal);
    }

    // =========================
    // MODAL
    // =========================
    if (interaction.isModalSubmit() && interaction.customId.startsWith("kasse_modal_")) {

        const text = interaction.fields.getTextInputValue("items");
        const rabatt = Number(interaction.fields.getTextInputValue("rabatt")) || 0;

        const items = text.split('\n').map(i => i.trim()).filter(Boolean);

        let total = 0;
        let lines = [];

        for (const item of items) {

            let productFound = null;
            let qty = null;

            for (const productName of Object.keys(PRODUKTE)) {

                const regex = new RegExp(
                    `^${productName}\\s*(\\d+|x\\d+|\\d+x)$`,
                    "i"
                );

                const match = item.match(regex);

                if (match) {
                    productFound = productName;
                    qty = parseInt(match[1].toLowerCase().replace(/x/g, ""));
                    break;
                }
            }

            if (!productFound || !qty || qty <= 0) {
                return interaction.reply({
                    content: `❌ Fehler bei: "${item}"`,
                    ephemeral: true
                });
            }

            const price = PRODUKTE[productFound] * qty;
            total += price;

            lines.push(`${productFound} x${qty} = ${price}€`);
        }

        const final = total - (total * rabatt / 100);

        // Umsatz addieren
        const userId = interaction.user.id;

        if (!sales[userId]) {
            sales[userId] = {
                name: interaction.user.username,
                total: 0,
                count: 0
            };
        }

        sales[userId].total += final;
        sales[userId].count += 1;

        const embed = new EmbedBuilder()
            .setTitle("🧾 KASSENBON")
            .setColor(0xf1c40f)
            .setDescription(lines.join('\n'))
            .addFields(
                { name: "💸 Rabatt", value: `${rabatt}%`, inline: true },
                { name: "💰 Gesamt", value: `${final.toFixed(0)}€`, inline: true }
            )
            .setFooter({
                text: `Kassierer: ${interaction.user.username}`
            });

        const channel = interaction.channel;

        await channel.send({
            embeds: [embed]
        });

        // Kasse löschen
        try {
            const kasseMsg = await channel.messages.fetch(activeKassen[channel.id]);

            if (kasseMsg) {
                await kasseMsg.delete();
                delete activeKassen[channel.id];
            }
        } catch {}

        return interaction.reply({
            content: "✅ Rechnung erstellt & Kasse geschlossen",
            ephemeral: true
        });
    }

    // =========================
    // /umsatz
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

💰 Gesamtumsatz: ${data.total.toFixed(0)}€
🧾 Rechnungen: ${data.count}`
        );
    }
});

client.login(process.env.TOKEN);
    }
});

client.login(process.env.TOKEN);
