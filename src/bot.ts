import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { UserModel, PaymentModel } from './database/models';
import { ConversationState } from './types';
import { setupHandlers } from './handlers/setup';
import { clientHandlers } from './handlers/clients';
import { productHandlers } from './handlers/products';
import { invoiceHandlers } from './handlers/invoices';
import { paymentHandlers } from './handlers/payments';

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN!;
const bot = new TelegramBot(token, { polling: true });

const conversationStates = new Map<number, ConversationState>();

export const getConversationState = (userId: number): ConversationState | undefined => {
  return conversationStates.get(userId);
};

export const setConversationState = (userId: number, state: ConversationState): void => {
  conversationStates.set(userId, state);
};

export const clearConversationState = (userId: number): void => {
  conversationStates.delete(userId);
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;

  const user = await UserModel.findByTelegramId(userId);
  
  if (!user) {
    await UserModel.create({ telegram_id: userId });
  }

  const welcomeMessage = `🎉 Welcome to Invoice Generator Bot!

This bot helps you create professional invoices and get paid through Telegram Stars.

Available commands:
📋 /setup - Configure your company information
👥 /clients - Manage clients
📦 /products - Manage products/services
📄 /newinvoice - Create new invoice
📊 /invoices - View recent invoices
❓ /help - Get help

${!user?.company_name ? '⚠️ Please run /setup first to configure your company details.' : '✅ Your company is set up. You can start creating invoices!'}`;

  bot.sendMessage(chatId, welcomeMessage);
});

bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `📖 **Invoice Generator Bot Help**

**Setup Commands:**
/setup - Configure company information
/profile - View current company settings

**Client Management:**
/clients - List all clients
/addclient - Add new client
/editclient - Edit existing client
/deleteclient - Remove client

**Product Management:**
/products - List all products/services
/addproduct - Add new product/service
/editproduct - Edit existing product
/deleteproduct - Remove product

**Invoice Management:**
/newinvoice - Create new invoice
/invoices - View recent invoices
/invoice [number] - Regenerate specific invoice

**Payment & Support:**
/paysupport - Get payment support and refund info
/refund [payment_id] - Request refund for a payment

**General:**
/cancel - Cancel current operation
/help - Show this help message

**Payment:**
PDF generation requires ${process.env.TELEGRAM_STARS_PRICE || 25} Telegram Stars.

**Note:** Stars earned by the bot can be used for Telegram Ads or withdrawn to TON (coming soon).`;

  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/cancel/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;
  
  clearConversationState(userId);
  bot.sendMessage(chatId, '❌ Operation cancelled.');
});

bot.onText(/\/profile/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;
  
  const user = await UserModel.findByTelegramId(userId);
  
  if (!user || !user.company_name) {
    bot.sendMessage(chatId, '⚠️ No company profile found. Please run /setup first.');
    return;
  }

  const profileMessage = `🏢 **Company Profile:**

**Company:** ${user.company_name}
**Registration:** ${user.reg_number || 'Not set'}
**VAT Number:** ${user.vat_number || 'Not set'}
**Address:** ${user.address || 'Not set'}
**City:** ${user.city || 'Not set'}
**Zip Code:** ${user.zip_code || 'Not set'}
**Phone:** ${user.phone || 'Not set'}
**Email:** ${user.email || 'Not set'}

**Banking:**
**Bank:** ${user.bank_name || 'Not set'}
**IBAN:** ${user.iban || 'Not set'}
**SWIFT:** ${user.swift || 'Not set'}

Use /setup to update your information.`;

  bot.sendMessage(chatId, profileMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/paysupport/, (msg) => {
  const chatId = msg.chat.id;
  
  const supportMessage = `🛠️ **Payment Support**\n\n` +
    `If you're experiencing issues with payments or need a refund, please provide:\n\n` +
    `• Your payment transaction ID\n` +
    `• Invoice number\n` +
    `• Description of the issue\n\n` +
    `**Refund Policy:**\n` +
    `- Refunds are available within 24 hours of payment\n` +
    `- Technical issues: Full refund\n` +
    `- PDF delivery failures: Full refund\n\n` +
    `**Contact:** Send details to this chat and we'll assist you.`;
  
  bot.sendMessage(chatId, supportMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/refund (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from!.id;
  const paymentId = match![1];
  
  try {
    const payment = await PaymentModel.findByTelegramPaymentId(paymentId);
    
    if (!payment || payment.user_id !== userId) {
      bot.sendMessage(chatId, '❌ Payment not found or you don\'t have permission to refund it.');
      return;
    }
    
    if (payment.refunded) {
      bot.sendMessage(chatId, '❌ This payment has already been refunded.');
      return;
    }
    
    // Check if payment is within refund window (24 hours)
    const paymentDate = new Date(payment.created_at!);
    const now = new Date();
    const hoursDiff = (now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      bot.sendMessage(chatId, '❌ Refund window has expired. Refunds are only available within 24 hours of payment.');
      return;
    }
    
    // Process refund using direct API call (node-telegram-bot-api doesn't have this method yet)
    const refundResult = await fetch(`https://api.telegram.org/bot${token}/refundStarPayment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        telegram_payment_charge_id: paymentId
      })
    });
    
    const refundData = await refundResult.json();
    if (!refundData.ok) {
      throw new Error(refundData.description || 'Refund failed');
    }
    
    // Mark payment as refunded
    await PaymentModel.markAsRefunded(payment.id!);
    
    bot.sendMessage(chatId, `✅ Refund processed successfully!\n\n**Refunded:** ${payment.amount} ${payment.currency}\n**Transaction ID:** ${paymentId}`);
    
  } catch (error) {
    console.error('Refund error:', error);
    bot.sendMessage(chatId, '❌ Failed to process refund. Please contact support.');
  }
});

setupHandlers(bot);
clientHandlers(bot);
productHandlers(bot);
invoiceHandlers(bot);
paymentHandlers(bot);

bot.on('polling_error', (error) => {
  console.error('Polling error:', error);
});

console.log('🤖 Invoice Generator Bot is running...');

export { bot };