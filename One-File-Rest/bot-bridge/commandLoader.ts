import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function loadCommands(client: any) {
  const commands: any[] = [];
  const commandsPath = path.join(__dirname, 'commands');

  if (!fs.existsSync(commandsPath)) {
    console.warn('Commands directory not found');
    return commands;
  }

  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await import(filePath);

    if (command.data && command.execute) {
      commands.push(command.data.toJSON());
      client.commands.set(command.data.name, command);
      console.log(`✓ Loaded command: ${command.data.name}`);
    }
  }

  return commands;
}

export async function registerCommands(client: any) {
  try {
    const commands = await loadCommands(client);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN || '');

    console.log(`Registering ${commands.length} commands...`);

    const data = await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID || '',
        process.env.DISCORD_GUILD_ID || ''
      ),
      { body: commands }
    );

    console.log(`✓ Successfully registered ${(data as any[]).length} commands`);
  } catch (err) {
    console.error('Failed to register commands:', err);
  }
}

export function setupCommandHandler(client: any) {
  client.on('interactionCreate', async (interaction: any) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
      console.error(`No command matching ${interaction.commandName} was found.`);
      return;
    }

    try {
      await command.execute(interaction);
    } catch (err) {
      console.error(`Error executing command ${interaction.commandName}:`, err);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: '❌ There was an error while executing this command!',
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: '❌ There was an error while executing this command!',
          ephemeral: true
        });
      }
    }
  });
}
