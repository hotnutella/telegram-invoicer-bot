import TelegramBot from 'node-telegram-bot-api';
import { UserModel } from '../database';
import { getConversationState, setConversationState, clearConversationState } from '../bot';
import { validateEmail, validatePhone, validateIBAN, sanitizeInput, validateRequired } from '../utils/validators';

export const setupHandlers = (bot: TelegramBot) => {
  bot.onText(/\/setup/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    
    setConversationState(userId, {
      step: 'setup_company_name',
      data: {}
    });
    
    bot.sendMessage(chatId, '🏢 Let\'s set up your company information.\n\nPlease enter your company name:');
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from!.id;
    const text = msg.text;
    
    if (!text || text.startsWith('/')) return;
    
    const state = getConversationState(userId);
    if (!state || !state.step.startsWith('setup_')) return;
    
    const sanitizedText = sanitizeInput(text);
    
    switch (state.step) {
      case 'setup_company_name':
        if (!validateRequired(sanitizedText)) {
          bot.sendMessage(chatId, '❌ Company name is required. Please enter a valid company name:');
          return;
        }
        
        state.data.company_name = sanitizedText;
        state.step = 'setup_reg_number';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '📋 Enter your company registration number (or type "skip" to skip):');
        break;
        
      case 'setup_reg_number':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.reg_number = sanitizedText;
        }
        
        state.step = 'setup_vat_number';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '🆔 Enter your VAT number (or type "skip" to skip):');
        break;
        
      case 'setup_vat_number':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.vat_number = sanitizedText;
        }
        
        state.step = 'setup_address';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '📍 Enter your company address:');
        break;
        
      case 'setup_address':
        if (!validateRequired(sanitizedText)) {
          bot.sendMessage(chatId, '❌ Address is required. Please enter your company address:');
          return;
        }
        
        state.data.address = sanitizedText;
        state.step = 'setup_city';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '🏙️ Enter your city:');
        break;
        
      case 'setup_city':
        if (!validateRequired(sanitizedText)) {
          bot.sendMessage(chatId, '❌ City is required. Please enter your city:');
          return;
        }
        
        state.data.city = sanitizedText;
        state.step = 'setup_zip_code';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '📮 Enter your zip code:');
        break;
        
      case 'setup_zip_code':
        if (!validateRequired(sanitizedText)) {
          bot.sendMessage(chatId, '❌ Zip code is required. Please enter your zip code:');
          return;
        }
        
        state.data.zip_code = sanitizedText;
        state.step = 'setup_phone';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '📞 Enter your phone number:');
        break;
        
      case 'setup_phone':
        if (!validatePhone(sanitizedText)) {
          bot.sendMessage(chatId, '❌ Invalid phone number format. Please enter a valid phone number:');
          return;
        }
        
        state.data.phone = sanitizedText;
        state.step = 'setup_email';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '📧 Enter your email address:');
        break;
        
      case 'setup_email':
        if (!validateEmail(sanitizedText)) {
          bot.sendMessage(chatId, '❌ Invalid email format. Please enter a valid email address:');
          return;
        }
        
        state.data.email = sanitizedText;
        state.step = 'setup_bank_name';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '🏦 Enter your bank name:');
        break;
        
      case 'setup_bank_name':
        if (!validateRequired(sanitizedText)) {
          bot.sendMessage(chatId, '❌ Bank name is required. Please enter your bank name:');
          return;
        }
        
        state.data.bank_name = sanitizedText;
        state.step = 'setup_iban';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '💳 Enter your IBAN:');
        break;
        
      case 'setup_iban':
        if (!validateIBAN(sanitizedText)) {
          bot.sendMessage(chatId, '❌ Invalid IBAN format. Please enter a valid IBAN:');
          return;
        }
        
        state.data.iban = sanitizedText.replace(/\s/g, '').toUpperCase();
        state.step = 'setup_swift';
        setConversationState(userId, state);
        
        bot.sendMessage(chatId, '🏧 Enter your SWIFT code (or type "skip" to skip):');
        break;
        
      case 'setup_swift':
        if (sanitizedText.toLowerCase() !== 'skip') {
          state.data.swift = sanitizedText.toUpperCase();
        }
        
        const userData = {
          telegram_id: userId,
          ...state.data
        };
        
        await UserModel.create(userData);
        clearConversationState(userId);
        
        bot.sendMessage(chatId, '✅ Company setup completed successfully! You can now start creating invoices with /newinvoice');
        break;
    }
  });
};