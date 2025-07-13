import TelegramBot from 'node-telegram-bot-api';
import { ClientModel } from '../database';
import { Client } from '../types';
import { getConversationState, setConversationState, clearConversationState } from '../bot';
import { sanitizeInput, validateRequired } from '../utils/validators';
import { formatClientName, truncateText } from '../utils/formatters';

export const clientHandlers = (bot: TelegramBot) => {
  bot.onText(/\/clients/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    
    const clients = await ClientModel.findByUserId(userId);
    
    if (clients.length === 0) {
      bot.sendMessage(chatId, '👥 No clients found. Use /addclient to add your first client.');
      return;
    }
    
    const keyboard = clients.map((client: Client) => [{
      text: truncateText(formatClientName(client), 30),
      callback_data: `client_view_${client.id}`
    }]);
    
    keyboard.push([{ text: '➕ Add New Client', callback_data: 'client_add' }]);
    
    bot.sendMessage(chatId, '👥 **Your Clients:**', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  });

  bot.onText(/\/addclient/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    
    setConversationState(userId, {
      step: 'client_add_name',
      data: {}
    });
    
    bot.sendMessage(chatId, '👤 Adding new client.\n\nPlease enter the client name:');
  });

  bot.onText(/\/editclient/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    
    const clients = await ClientModel.findByUserId(userId);
    
    if (clients.length === 0) {
      bot.sendMessage(chatId, '👥 No clients found. Use /addclient to add your first client.');
      return;
    }
    
    const keyboard = clients.map((client: Client) => [{
      text: truncateText(formatClientName(client), 30),
      callback_data: `client_edit_${client.id}`
    }]);
    
    bot.sendMessage(chatId, '✏️ **Select client to edit:**', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  });

  bot.onText(/\/deleteclient/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    
    const clients = await ClientModel.findByUserId(userId);
    
    if (clients.length === 0) {
      bot.sendMessage(chatId, '👥 No clients found.');
      return;
    }
    
    const keyboard = clients.map((client: Client) => [{
      text: truncateText(formatClientName(client), 30),
      callback_data: `client_delete_${client.id}`
    }]);
    
    bot.sendMessage(chatId, '🗑️ **Select client to delete:**', {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message!.chat.id;
    const userId = query.from.id;
    const data = query.data!;
    
    if (data.startsWith('client_')) {
      const [action, operation, id] = data.split('_');
      
      switch (operation) {
        case 'view':
          const client = await ClientModel.findById(parseInt(id));
          if (client) {
            const clientInfo = `👤 **Client Information:**

**Name:** ${client.name}
**Address:** ${client.address_line1 || 'Not set'}
${client.address_line2 ? `**Address 2:** ${client.address_line2}\n` : ''}**Country:** ${client.country || 'Not set'}
**Registration:** ${client.reg_number || 'Not set'}
**VAT Number:** ${client.vat_number || 'Not set'}`;

            const keyboard = [
              [{ text: '✏️ Edit', callback_data: `client_edit_${client.id}` }],
              [{ text: '🗑️ Delete', callback_data: `client_delete_${client.id}` }],
              [{ text: '🔙 Back to Clients', callback_data: 'clients_list' }]
            ];

            bot.editMessageText(clientInfo, {
              chat_id: chatId,
              message_id: query.message!.message_id,
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: keyboard
              }
            });
          }
          break;
          
        case 'add':
          setConversationState(userId, {
            step: 'client_add_name',
            data: {}
          });
          
          bot.sendMessage(chatId, '👤 Adding new client.\n\nPlease enter the client name:');
          break;
          
        case 'edit':
          const editClient = await ClientModel.findById(parseInt(id));
          if (editClient) {
            setConversationState(userId, {
              step: 'client_edit_name',
              data: { client_id: editClient.id, ...editClient }
            });
            
            bot.sendMessage(chatId, `✏️ Editing client: ${editClient.name}\n\nEnter new name (current: ${editClient.name}) or type "skip" to keep current:`);
          }
          break;
          
        case 'delete':
          const deleteClient = await ClientModel.findById(parseInt(id));
          if (deleteClient) {
            const keyboard = [
              [{ text: '✅ Yes, Delete', callback_data: `client_confirm_delete_${id}` }],
              [{ text: '❌ Cancel', callback_data: 'clients_list' }]
            ];

            bot.editMessageText(`🗑️ Are you sure you want to delete client "${deleteClient.name}"?`, {
              chat_id: chatId,
              message_id: query.message!.message_id,
              reply_markup: {
                inline_keyboard: keyboard
              }
            });
          }
          break;
          
        case 'confirm':
          if (data.includes('delete')) {
            const deleteId = parseInt(data.split('_')[3]);
            await ClientModel.delete(deleteId);
            
            bot.editMessageText('✅ Client deleted successfully!', {
              chat_id: chatId,
              message_id: query.message!.message_id
            });
          }
          break;
      }
      
      if (data === 'clients_list') {
        const clients = await ClientModel.findByUserId(userId);
        
        if (clients.length === 0) {
          bot.editMessageText('👥 No clients found. Use /addclient to add your first client.', {
            chat_id: chatId,
            message_id: query.message!.message_id
          });
          return;
        }
        
        const keyboard = clients.map((client: Client) => [{
          text: truncateText(formatClientName(client), 30),
          callback_data: `client_view_${client.id}`
        }]);
        
        keyboard.push([{ text: '➕ Add New Client', callback_data: 'client_add' }]);
        
        bot.editMessageText('👥 **Your Clients:**', {
          chat_id: chatId,
          message_id: query.message!.message_id,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        });
      }
    }
    
    bot.answerCallbackQuery(query.id);
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    const text = msg.text;
    
    if (!text || text.startsWith('/')) return;
    
    const state = getConversationState(userId);
    if (!state || !state.step.startsWith('client_')) return;
    
    const sanitizedText = sanitizeInput(text);
    
    switch (state.step) {
      case 'client_add_name':
        if (!validateRequired(sanitizedText)) {
          bot.sendMessage(chatId, '❌ Client name is required. Please enter a valid client name:');
          return;
        }
        
        state.data.name = sanitizedText;
        state.step = 'client_add_address1';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '📍 Enter client address (or type "skip" to skip):');
        break;
        
      case 'client_add_address1':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.address_line1 = sanitizedText;
        }
        
        state.step = 'client_add_address2';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '📍 Enter second address line (or type "skip" to skip):');
        break;
        
      case 'client_add_address2':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.address_line2 = sanitizedText;
        }
        
        state.step = 'client_add_country';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '🌍 Enter country (or type "skip" to skip):');
        break;
        
      case 'client_add_country':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.country = sanitizedText;
        }
        
        state.step = 'client_add_reg_number';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '📋 Enter registration number (or type "skip" to skip):');
        break;
        
      case 'client_add_reg_number':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.reg_number = sanitizedText;
        }
        
        state.step = 'client_add_vat_number';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '🆔 Enter VAT number (or type "skip" to skip):');
        break;
        
      case 'client_add_vat_number':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.vat_number = sanitizedText;
        }
        
        const clientData = {
          user_id: userId,
          name: state.data.name,
          address_line1: state.data.address_line1,
          address_line2: state.data.address_line2,
          country: state.data.country,
          reg_number: state.data.reg_number,
          vat_number: state.data.vat_number
        };
        
        await ClientModel.create(clientData);
        clearConversationState(userId);
        
        bot.sendMessage(chatId, '✅ Client added successfully!');
        break;
        
      case 'client_edit_name':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.name = sanitizedText;
        }
        
        state.step = 'client_edit_address1';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, `📍 Enter address (current: ${state.data.address_line1 || 'Not set'}) or type "skip" to keep current:`);
        break;
        
      case 'client_edit_address1':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.address_line1 = sanitizedText;
        }
        
        state.step = 'client_edit_address2';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, `📍 Enter second address line (current: ${state.data.address_line2 || 'Not set'}) or type "skip" to keep current:`);
        break;
        
      case 'client_edit_address2':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.address_line2 = sanitizedText;
        }
        
        state.step = 'client_edit_country';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, `🌍 Enter country (current: ${state.data.country || 'Not set'}) or type "skip" to keep current:`);
        break;
        
      case 'client_edit_country':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.country = sanitizedText;
        }
        
        state.step = 'client_edit_reg_number';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, `📋 Enter registration number (current: ${state.data.reg_number || 'Not set'}) or type "skip" to keep current:`);
        break;
        
      case 'client_edit_reg_number':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.reg_number = sanitizedText;
        }
        
        state.step = 'client_edit_vat_number';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, `🆔 Enter VAT number (current: ${state.data.vat_number || 'Not set'}) or type "skip" to keep current:`);
        break;
        
      case 'client_edit_vat_number':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.vat_number = sanitizedText;
        }
        
        const updateData = {
          name: state.data.name,
          address_line1: state.data.address_line1,
          address_line2: state.data.address_line2,
          country: state.data.country,
          reg_number: state.data.reg_number,
          vat_number: state.data.vat_number
        };
        
        await ClientModel.update(state.data.client_id, updateData);
        clearConversationState(userId);
        
        bot.sendMessage(chatId, '✅ Client updated successfully!');
        break;
    }
  });
};